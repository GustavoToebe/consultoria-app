package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.auth.EnviadorDeEmail;
import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.consultoria.Consultoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.pagamentos.PagamentosDtos.LembreteResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.LembretesDaCobranca;
import br.com.treinos.api.pagamentos.PagamentosDtos.LembretesRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.LembretesResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.WhatsAppDaCobranca;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * A configuração dos lembretes de cobrança por e-mail da consultoria (desligada por padrão) e o que a folha da cobrança mostra:
 * os lembretes dela e a mensagem pronta para o WhatsApp, com o mesmo texto do e-mail ({@link TextoDoLembrete}). O WhatsApp é
 * ação manual do treinador: nada é registrado como enviado. A auditoria tem resumo fixo e só sai quando a configuração muda.
 */
@Service
public class LembretesService {

    private final ConfiguracaoDeLembretesRepository configuracoes;
    private final LembreteDeCobrancaRepository lembretes;
    private final CobrancaAlunoRepository cobrancas;
    private final AlunoRepository alunos;
    private final UsuarioRepository usuarios;
    private final ConsultoriaRepository consultorias;
    private final ObjectProvider<EnviadorDeEmail> emails;
    private final Auditoria auditoria;
    private final String appUrl;

    public LembretesService(ConfiguracaoDeLembretesRepository configuracoes, LembreteDeCobrancaRepository lembretes,
                            CobrancaAlunoRepository cobrancas, AlunoRepository alunos, UsuarioRepository usuarios,
                            ConsultoriaRepository consultorias, ObjectProvider<EnviadorDeEmail> emails, Auditoria auditoria,
                            @Value("${treinos.app-url:}") String appUrl) {
        this.configuracoes = configuracoes;
        this.lembretes = lembretes;
        this.cobrancas = cobrancas;
        this.alunos = alunos;
        this.usuarios = usuarios;
        this.consultorias = consultorias;
        this.emails = emails;
        this.auditoria = auditoria;
        this.appUrl = appUrl;
    }

    @Transactional(readOnly = true)
    public LembretesResponse obter() {
        return resposta(configuracoes.daConsultoria());
    }

    /**
     * Cria ou altera, como o recebimento online: sem configuração, {@code versao} preenchida é 409 (alguém a apagou); com ela,
     * a versão é obrigatória e conferida. Igual ao que está gravado = 200 sem auditoria. Os lembretes já planejados não são
     * mexidos aqui: o job confere a regra de novo antes de cada envio e cancela o que deixou de ser devido.
     */
    @Transactional
    public LembretesResponse salvar(LembretesRequest r) {
        RegraDosLembretes.Configuracao nova = validar(r);
        Instant agora = Instant.now();
        Optional<ConfiguracaoDeLembretes> existente = configuracoes.daConsultoria();
        ConfiguracaoDeLembretes gravada;
        boolean mudou;
        try {
            if (existente.isEmpty()) {
                if (r.versao() != null) {
                    throw conflito();
                }
                gravada = configuracoes.saveAndFlush(new ConfiguracaoDeLembretes(nova, agora));
                mudou = true;
            } else {
                gravada = existente.get();
                if (r.versao() == null || !r.versao().equals(gravada.getVersao())) {
                    throw conflito();
                }
                mudou = gravada.alterar(nova, agora);
                gravada = configuracoes.saveAndFlush(gravada);
            }
        } catch (DataIntegrityViolationException e) {
            if (ContratacaoService.violou(e, "ux_lembrete_configuracao_consultoria")) {
                throw conflito();
            }
            throw e;
        }
        if (mudou) {
            auditoria.registrarEvento("LEMBRETES_DE_COBRANCA_CONFIGURADOS", "LEMBRETES_DE_COBRANCA", gravada.getId(),
                    "Configurou os lembretes de cobrança.");
        }
        return resposta(Optional.of(gravada));
    }

    /**
     * Os lembretes da cobrança (do mais antigo ao mais novo) e, se ela está em aberto e o aluno ativo, a mensagem do WhatsApp
     * de hoje com o telefone do aluno (nulo sem telefone). Cobrança de outra consultoria = 404.
     */
    @Transactional(readOnly = true)
    public LembretesDaCobranca daCobranca(UUID cobrancaId) {
        CobrancaAluno cobranca = cobrancas.findById(cobrancaId)
                .orElseThrow(() -> new NaoEncontradoException("Cobrança não encontrada."));
        List<LembreteResponse> itens = lembretes.findByCobrancaIdOrderByDataPrevistaAscTipoAsc(cobrancaId).stream()
                .map(l -> new LembreteResponse(l.getId(), l.getTipo(), l.getSituacao(),
                        l.getSituacao() == LembreteDeCobranca.Situacao.CANCELADO ? l.getMotivo() : null,
                        l.getDataPrevista(), l.getEnviadoEm(), l.getAtualizadoEm()))
                .toList();
        return new LembretesDaCobranca(itens, whatsapp(cobranca));
    }

    private WhatsAppDaCobranca whatsapp(CobrancaAluno cobranca) {
        if (cobranca.getSituacao() != CobrancaAluno.Situacao.ABERTA) {
            return null;
        }
        Optional<Aluno> aluno = alunos.findById(cobranca.getAlunoId());
        if (aluno.isEmpty() || !aluno.get().isAtivo() || aluno.get().isAnonimizado()) {
            return null;
        }
        String telefone = aluno.get().getUsuarioId() == null ? null
                : usuarios.findById(aluno.get().getUsuarioId()).map(Usuario::getTelefone)
                        .filter(t -> !t.isBlank()).orElse(null);
        String consultoria = consultorias.findById(TenantContext.get()).map(Consultoria::getNome).orElse(null);
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        String mensagem = TextoDoLembrete.mensagem(RegraDosLembretes.situacaoDeHoje(hoje, cobranca.getVencimento()),
                new TextoDoLembrete.Dados(aluno.get().getNome(), consultoria, cobranca.getValorCentavos(),
                        cobranca.getVencimento(), appUrl));
        return new WhatsAppDaCobranca(telefone, mensagem);
    }

    private LembretesResponse resposta(Optional<ConfiguracaoDeLembretes> gravada) {
        RegraDosLembretes.Configuracao c = gravada.map(ConfiguracaoDeLembretes::configuracao)
                .orElse(RegraDosLembretes.Configuracao.PADRAO);
        return new LembretesResponse(c.ligado(), c.diasAntes(), c.noDia(), c.diasDepois(),
                gravada.map(ConfiguracaoDeLembretes::getVersao).orElse(null), emails.getIfAvailable() != null);
    }

    private static RegraDosLembretes.Configuracao validar(LembretesRequest r) {
        List<ApiError.FieldError> problemas = new ArrayList<>();
        if (r.diasAntes() < 0 || r.diasAntes() > RegraDosLembretes.MAXIMO_ANTES) {
            problemas.add(new ApiError.FieldError("diasAntes", "Use de 0 a " + RegraDosLembretes.MAXIMO_ANTES + " dias."));
        }
        if (r.diasDepois() < 0 || r.diasDepois() > RegraDosLembretes.MAXIMO_DEPOIS) {
            problemas.add(new ApiError.FieldError("diasDepois", "Use de 0 a " + RegraDosLembretes.MAXIMO_DEPOIS + " dias."));
        }
        if (!problemas.isEmpty()) {
            throw new ValidacaoException("Confira os lembretes de cobrança.", "LEMBRETES_INVALIDOS", problemas);
        }
        return new RegraDosLembretes.Configuracao(r.ligado(), r.diasAntes(), r.noDia(), r.diasDepois());
    }

    private static ConflictException conflito() {
        return new ConflictException("Outra pessoa ou aba alterou os lembretes. Recarregue para ver a versão atual.",
                "CONFLITO_EDICAO");
    }
}
