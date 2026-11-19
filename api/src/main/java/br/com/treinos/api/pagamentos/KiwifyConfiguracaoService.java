package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.pagamentos.KiwifyDtos.KiwifyRequest;
import br.com.treinos.api.pagamentos.KiwifyDtos.KiwifyResponse;
import br.com.treinos.api.pagamentos.provedor.KiwifyCliente;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * A credencial com que o treinador recebe pela Kiwify: token do webhook, {@code client_id}, {@code client_secret} e
 * {@code account_id}, cifrados. Os valores só entram: nenhuma resposta, auditoria, log ou mensagem de erro os repete (a
 * auditoria tem resumo fixo). O token do webhook novo guarda o anterior por 24 h, porque a Kiwify pode reenviar com ele um
 * aviso que falhou antes da troca.
 */
@Service
public class KiwifyConfiguracaoService {

    /** Código do provedor na cobrança e no aviso. */
    public static final String PROVEDOR = "KIWIFY";
    /** O token anterior do webhook vale por um dia depois da troca (a Kiwify reenvia entregas antigas com ele). */
    static final Duration VALIDADE_DO_TOKEN_ANTERIOR = Duration.ofHours(24);

    private static final Pattern SEM_ESPACO_NEM_CONTROLE = Pattern.compile("^[^\\s\\p{Cntrl}]+$");
    private static final int TOKEN_MINIMO = 16;
    private static final int CAMPO_MAXIMO = 200;
    private static final String CAMINHO_DO_AVISO = "/publico/pagamentos/kiwify/";

    private final CredencialKiwifyRepository credenciais;
    private final CifraDePagamento cifra;
    private final InfinitePayProperties infinitePay;
    private final KiwifyCliente cliente;
    private final Auditoria auditoria;
    private final SecureRandom aleatorio = new SecureRandom();

    public KiwifyConfiguracaoService(CredencialKiwifyRepository credenciais, CifraDePagamento cifra,
                                     InfinitePayProperties infinitePay, KiwifyCliente cliente, Auditoria auditoria) {
        this.credenciais = credenciais;
        this.cifra = cifra;
        this.infinitePay = infinitePay;
        this.cliente = cliente;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public KiwifyResponse obter() {
        return resposta(credenciais.daConsultoria());
    }

    /**
     * Cria (sem credencial: {@code versao} nula e os quatro campos) ou altera ({@code versao} atual; campo ausente mantém o
     * gravado). Criar com versão, ou alterar sem versão ou com versão velha, é 409. O token do caminho nasce na criação e fica.
     */
    @Transactional
    public KiwifyResponse salvar(KiwifyRequest r) {
        UUID consultoria = consultoriaAtual();
        Instant agora = Instant.now();
        Optional<CredencialKiwify> existente = credenciais.daConsultoria();
        if (existente.isEmpty() ? r.versao() != null : r.versao() == null || !r.versao().equals(existente.get().getVersao())) {
            throw conflito();
        }
        boolean criando = existente.isEmpty();
        List<ApiError.FieldError> erros = new ArrayList<>();
        String token = campo(erros, "tokenDoWebhook", r.tokenDoWebhook(), TOKEN_MINIMO, criando);
        String clientId = campo(erros, "clientId", r.clientId(), 1, criando);
        String clientSecret = campo(erros, "clientSecret", r.clientSecret(), 1, criando);
        String accountId = campo(erros, "accountId", r.accountId(), 1, criando);
        if (!erros.isEmpty()) {
            throw new ValidacaoException("Confira a credencial da Kiwify.", "KIWIFY_INVALIDA", erros);
        }
        CredencialKiwify gravada;
        try {
            if (criando) {
                gravada = credenciais.saveAndFlush(new CredencialKiwify(cifra.cifrar(consultoria, token),
                        cifra.cifrar(consultoria, clientId), cifra.cifrar(consultoria, clientSecret),
                        cifra.cifrar(consultoria, accountId), novoToken(), agora));
            } else {
                CredencialKiwify c = existente.get();
                // Regravar o mesmo token não é troca: não guarda "anterior" nem renova a janela de 24 h.
                boolean trocouToken = token != null && !token.equals(cifra.decifrar(consultoria, c.getTokenWebhookCifrado()));
                c.alterar(trocouToken ? cifra.cifrar(consultoria, token) : null,
                        clientId == null ? null : cifra.cifrar(consultoria, clientId),
                        clientSecret == null ? null : cifra.cifrar(consultoria, clientSecret),
                        accountId == null ? null : cifra.cifrar(consultoria, accountId),
                        agora.plus(VALIDADE_DO_TOKEN_ANTERIOR), agora);
                gravada = credenciais.saveAndFlush(c);
            }
        } catch (DataIntegrityViolationException e) {
            if (ContratacaoService.violou(e, "ux_credencial_kiwify_consultoria")) {
                throw conflito();
            }
            throw e;
        }
        cliente.esquecerToken(consultoria);
        auditoria.registrarEvento("KIWIFY_CONFIGURADA", "KIWIFY", gravada.getId(), "Configurou a Kiwify.");
        return resposta(Optional.of(gravada));
    }

    /**
     * Sem credencial não há o que remover (204 do mesmo jeito, sem auditoria); versão dada e velha é 409. Apaga a credencial e o
     * token do caminho: a URL antiga do webhook passa a dar 404. As cobranças e baixas já gravadas não mudam.
     */
    @Transactional
    public void remover(Long versao) {
        UUID consultoria = consultoriaAtual();
        credenciais.daConsultoria().ifPresent(c -> {
            if (versao != null && !versao.equals(c.getVersao())) {
                throw conflito();
            }
            credenciais.delete(c);
            credenciais.flush();
            cliente.esquecerToken(consultoria);
            auditoria.registrarEvento("KIWIFY_REMOVIDA", "KIWIFY", c.getId(), "Removeu a Kiwify.");
        });
    }

    private KiwifyResponse resposta(Optional<CredencialKiwify> credencial) {
        if (credencial.isEmpty()) {
            return new KiwifyResponse(false, null, null, null);
        }
        CredencialKiwify c = credencial.get();
        String url = AcessoAtual.pode("FINANCEIRO_ALTERAR") ? infinitePay.urlPublica() + CAMINHO_DO_AVISO + c.getTokenCaminho() : null;
        String clientId = cifra.decifrar(c.getConsultoriaId(), c.getClientIdCifrado());
        String ultimos = clientId.substring(Math.max(0, clientId.length() - 4));
        return new KiwifyResponse(true, url, ultimos, c.getVersao());
    }

    /**
     * Valor depois do strip ou nulo se o campo não veio (e a criação não o exige). Em branco, com espaço ou controle no meio,
     * curto ou longo demais, vai para a lista de erros com mensagem fixa: o valor nunca é repetido.
     */
    private static String campo(List<ApiError.FieldError> erros, String nome, String valor, int minimo, boolean obrigatorio) {
        if (valor == null) {
            if (obrigatorio) {
                erros.add(new ApiError.FieldError(nome, "Obrigatório."));
            }
            return null;
        }
        String limpo = valor.strip();
        if (limpo.isEmpty()) {
            erros.add(new ApiError.FieldError(nome, "Informe o valor ou deixe o campo de fora."));
        } else if (limpo.length() > CAMPO_MAXIMO || limpo.length() < minimo || !SEM_ESPACO_NEM_CONTROLE.matcher(limpo).matches()) {
            erros.add(new ApiError.FieldError(nome, minimo > 1
                    ? "Use de " + minimo + " a " + CAMPO_MAXIMO + " caracteres, sem espaços."
                    : "Use de 1 a " + CAMPO_MAXIMO + " caracteres, sem espaços."));
        } else {
            return limpo;
        }
        return null;
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
        return new ConflictException("Outra pessoa ou aba alterou a Kiwify. Recarregue para ver a versão atual.", "CONFLITO_EDICAO");
    }
}
