package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.pagamentos.PagamentosDtos.RecebimentoOnlineRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.RecebimentoOnlineResponse;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * A credencial com que o treinador recebe pela InfinitePay: a InfiniteTag (obrigatória) e a API Key (opcional, cifrada).
 * A chave só entra: nenhuma resposta, auditoria, log ou mensagem de erro a repete. A auditoria tem resumo fixo.
 */
@Service
public class RecebimentoOnlineService {

    /** Código do provedor na credencial e na cobrança. */
    public static final String PROVEDOR = "INFINITEPAY";

    private static final Pattern TAG = Pattern.compile("^[a-z0-9_.-]{3,40}$");
    private static final Pattern CHAVE = Pattern.compile("^[^\\s\\p{Cntrl}]{10,200}$");

    private final CredencialPagamentoRepository credenciais;
    private final CobrancaAlunoRepository cobrancas;
    private final CifraDePagamento cifra;
    private final InfinitePayProperties infinitePay;
    private final Auditoria auditoria;
    private final SecureRandom aleatorio = new SecureRandom();

    public RecebimentoOnlineService(CredencialPagamentoRepository credenciais, CobrancaAlunoRepository cobrancas,
                                    CifraDePagamento cifra, InfinitePayProperties infinitePay, Auditoria auditoria) {
        this.credenciais = credenciais;
        this.cobrancas = cobrancas;
        this.cifra = cifra;
        this.infinitePay = infinitePay;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public RecebimentoOnlineResponse obter() {
        return resposta(credenciais.findByProvedor(PROVEDOR));
    }

    /**
     * Cria ou altera. Sem credencial, {@code versao} preenchida é 409 (alguém a removeu); com credencial, a versão é
     * obrigatória e conferida. O {@code token_aviso} nasce na criação e fica. Trocar a Tag, ter chave onde não tinha (e o
     * contrário) ou mudar quem paga os juros esquece os links das cobranças abertas: o link velho apontaria para a conta
     * antiga ou teria sido gerado com outra regra (só com chave ele vale para um pagamento, vence e leva a opção de
     * parcelas). Regravar a mesma Tag e trocar uma chave por outra não mudam nada disso, e o link continua valendo.
     *
     * <p>Os juros {@code TREINADOR} só valem com chave: é conferido sobre o estado final (juros e chave que ficam), então
     * remover a chave de quem está em {@code TREINADOR}, sem pedir {@code ALUNO}, também é 422.
     */
    @Transactional
    public RecebimentoOnlineResponse salvar(RecebimentoOnlineRequest r) {
        String tag = normalizarTag(r.infiniteTag());
        String chave = normalizarChave(r.apiKey());
        JurosDoParcelamento jurosPedidos = normalizarJuros(r.jurosDoParcelamento());
        boolean remover = Boolean.TRUE.equals(r.removerApiKey());
        if (chave != null && remover) {
            throw invalido("apiKey", "Informe a chave nova ou peça para removê-la, não as duas coisas.");
        }
        UUID consultoria = consultoriaAtual();
        Instant agora = Instant.now();
        Optional<CredencialPagamento> existente = credenciais.findByProvedor(PROVEDOR);
        CredencialPagamento gravada;
        boolean linksVelhos = false;
        try {
            if (existente.isEmpty()) {
                if (r.versao() != null) {
                    throw conflito();
                }
                JurosDoParcelamento juros = jurosPedidos == null ? JurosDoParcelamento.ALUNO : jurosPedidos;
                exigirChaveParaJuros(juros, chave != null);
                String segredo = chave == null ? null : cifra.cifrar(consultoria, chave);
                gravada = credenciais.saveAndFlush(new CredencialPagamento(PROVEDOR, tag, segredo, juros, novoToken(), agora));
            } else {
                CredencialPagamento c = existente.get();
                if (r.versao() == null || !r.versao().equals(c.getVersao())) {
                    throw conflito();
                }
                JurosDoParcelamento juros = jurosPedidos == null ? c.getJurosDoParcelamento() : jurosPedidos;
                boolean temChave = chave != null || (!remover && c.getSegredoCifrado() != null);
                exigirChaveParaJuros(juros, temChave);
                String segredo = c.getSegredoCifrado();
                if (chave != null) {
                    segredo = cifra.cifrar(consultoria, chave);
                } else if (remover) {
                    segredo = null;
                }
                linksVelhos = !tag.equals(c.getConta()) || (c.getSegredoCifrado() != null) != (segredo != null)
                        || juros != c.getJurosDoParcelamento();
                c.alterar(tag, segredo, juros, agora);
                gravada = credenciais.saveAndFlush(c);
            }
        } catch (DataIntegrityViolationException e) {
            if (ContratacaoService.violou(e, "ux_credencial_consultoria_provedor")) {
                throw conflito();
            }
            throw e;
        }
        if (linksVelhos) {
            cobrancas.esquecerLinksDasAbertas(CobrancaAluno.Situacao.ABERTA);
        }
        auditoria.registrarEvento("RECEBIMENTO_ONLINE_CONFIGURADO", "RECEBIMENTO_ONLINE", gravada.getId(),
                "Configurou o recebimento online.");
        return resposta(Optional.of(gravada));
    }

    /**
     * Sem credencial não há o que remover (204 do mesmo jeito, sem auditoria); versão dada e velha é 409. Os links das
     * cobranças abertas saem junto (a pagas e as demais mantêm o histórico). Risco aceito: um novo cadastro gera outro
     * {@code token_aviso}, então o webhook dos links que já estavam com o aluno passa a dar 404; a cobrança, se paga por um
     * deles, não é baixada sozinha (o treinador a vê paga na InfinitePay e registra à mão).
     */
    @Transactional
    public void remover(Long versao) {
        credenciais.findByProvedor(PROVEDOR).ifPresent(c -> {
            if (versao != null && !versao.equals(c.getVersao())) {
                throw conflito();
            }
            credenciais.delete(c);
            credenciais.flush();
            cobrancas.esquecerLinksDasAbertas(CobrancaAluno.Situacao.ABERTA);
            auditoria.registrarEvento("RECEBIMENTO_ONLINE_REMOVIDO", "RECEBIMENTO_ONLINE", c.getId(),
                    "Removeu o recebimento online.");
        });
    }

    private RecebimentoOnlineResponse resposta(Optional<CredencialPagamento> credencial) {
        return new RecebimentoOnlineResponse(infinitePay.habilitado(), credencial.isPresent(),
                credencial.map(CredencialPagamento::getConta).orElse(null),
                credencial.map(c -> c.getSegredoCifrado() != null).orElse(false),
                credencial.map(CredencialPagamento::getVersao).orElse(null),
                credencial.map(c -> c.getJurosDoParcelamento().name()).orElse(null));
    }

    /** Tira espaços e o cifrão do começo, e minúscula; o que sobrar precisa ser uma InfiniteTag. */
    private static String normalizarTag(String texto) {
        String tag = texto == null ? "" : texto.trim();
        if (tag.startsWith("$")) {
            tag = tag.substring(1).trim();
        }
        tag = tag.toLowerCase(Locale.ROOT);
        if (!TAG.matcher(tag).matches()) {
            throw invalido("infiniteTag", "Use a InfiniteTag sem o cifrão: de 3 a 40 letras, números, ponto, hífen ou sublinhado.");
        }
        return tag;
    }

    /** Em branco = não mandou. A mensagem de erro nunca repete o valor. */
    private static String normalizarChave(String texto) {
        String chave = texto == null ? "" : texto.trim();
        if (chave.isEmpty()) {
            return null;
        }
        if (!CHAVE.matcher(chave).matches()) {
            throw invalido("apiKey", "A chave precisa ter de 10 a 200 caracteres, sem espaços.");
        }
        return chave;
    }

    /** Nulo = não mandou. Só os dois valores do enum; a mensagem não repete o que veio. */
    private static JurosDoParcelamento normalizarJuros(String texto) {
        if (texto == null || texto.isBlank()) {
            return null;
        }
        try {
            return JurosDoParcelamento.valueOf(texto.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw invalido("jurosDoParcelamento", "Use ALUNO ou TREINADOR.");
        }
    }

    private static void exigirChaveParaJuros(JurosDoParcelamento juros, boolean comChave) {
        if (juros == JurosDoParcelamento.TREINADOR && !comChave) {
            throw invalido("jurosDoParcelamento", "Precisa da chave de API para valer.");
        }
    }

    private String novoToken() {
        byte[] bytes = new byte[32];
        aleatorio.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static UUID consultoriaAtual() {
        UUID consultoria = TenantContext.get();
        if (consultoria == null) {
            throw new IllegalStateException("Sem consultoria na requisição.");
        }
        return consultoria;
    }

    private static ConflictException conflito() {
        return new ConflictException("Outra pessoa ou aba alterou o recebimento online. Recarregue para ver a versão atual.",
                "CONFLITO_EDICAO");
    }

    private static ValidacaoException invalido(String campo, String mensagem) {
        return new ValidacaoException("Confira os dados do recebimento online.", "RECEBIMENTO_ONLINE_INVALIDO",
                List.of(new ApiError.FieldError(campo, mensagem)));
    }
}
