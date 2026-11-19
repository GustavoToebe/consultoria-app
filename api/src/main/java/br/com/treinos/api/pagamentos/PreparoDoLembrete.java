package br.com.treinos.api.pagamentos;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.consultoria.Consultoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.consultoria.RemetenteDaConsultoria;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * A conferência de um lembrete reservado, logo antes do envio, numa transação curta somente leitura dentro da consultoria
 * dele (quem chama abre o {@code TenantContext}): a cobrança ainda está ABERTA, a regra ainda diz que este tipo é devido
 * hoje (configuração desligada, alterada ou vencimento reajustado cancelam), a contratação, quando a cobrança tem uma (a avulsa
 * não tem), está ATIVA, o aluno está ativo e
 * não anonimizado, que não desligou os lembretes para si ({@code ALUNO_DESLIGOU}), e há um e-mail (o do responsável financeiro, se tiver, senão o do aluno; desligar vale também para o responsável). Devolve a mensagem pronta ou o motivo do cancelamento. O envio fica fora daqui (e de
 * qualquer transação). Nada daqui vai a log.
 */
@Service
class PreparoDoLembrete {

    static final String COBRANCA_NAO_ABERTA = "COBRANCA_NAO_ABERTA";
    static final String NAO_E_MAIS_DEVIDO = "NAO_E_MAIS_DEVIDO";
    static final String CONTRATACAO_NAO_ATIVA = "CONTRATACAO_NAO_ATIVA";
    static final String ALUNO_INATIVO = "ALUNO_INATIVO";
    static final String ALUNO_DESLIGOU = "ALUNO_DESLIGOU";
    static final String SEM_EMAIL = "SEM_EMAIL";
    /** Defesa: a cobrança de saída nunca recebe e-mail (o planejamento já a pula); mensalidade e avulsa recebem. */
    static final String NAO_E_MENSALIDADE = "NAO_E_MENSALIDADE";
    /** D18: a mensalidade que a Kiwify cobra não recebe lembrete por e-mail (a Kiwify tenta de novo por conta própria). */
    static final String COBRANCA_AUTOMATICA = "COBRANCA_AUTOMATICA";

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@<>\"(),;:]+@[^\\s@<>\"(),;:]+\\.[^\\s@<>\"(),;:]+$");

    /** O resultado: {@code para}, {@code mensagem} e o {@code remetente} da consultoria para enviar, ou só o {@code motivo} do cancelamento. */
    record Preparo(String para, TextoDoLembrete.Mensagem mensagem, RemetenteDaConsultoria.Remetente remetente, String motivo) {

        static Preparo cancelar(String motivo) {
            return new Preparo(null, null, null, motivo);
        }

        boolean enviar() {
            return motivo == null;
        }

        @Override
        public String toString() {
            return "Preparo[" + (motivo == null ? "enviar" : motivo) + "]";
        }
    }

    private final CobrancaAlunoRepository cobrancas;
    private final ContratacaoAlunoRepository contratacoes;
    private final ConfiguracaoDeLembretesRepository configuracoes;
    private final AlunoRepository alunos;
    private final UsuarioRepository usuarios;
    private final ConsultoriaRepository consultorias;
    private final ResponsavelFinanceiroRepository responsaveis;
    private final CobrancaAutomatica automatica;
    private final String appUrl;

    PreparoDoLembrete(CobrancaAlunoRepository cobrancas, ContratacaoAlunoRepository contratacoes,
                      ConfiguracaoDeLembretesRepository configuracoes, AlunoRepository alunos, UsuarioRepository usuarios,
                      ConsultoriaRepository consultorias, ResponsavelFinanceiroRepository responsaveis,
                      CobrancaAutomatica automatica, @Value("${treinos.app-url:}") String appUrl) {
        this.automatica = automatica;
        this.cobrancas = cobrancas;
        this.contratacoes = contratacoes;
        this.configuracoes = configuracoes;
        this.alunos = alunos;
        this.usuarios = usuarios;
        this.consultorias = consultorias;
        this.responsaveis = responsaveis;
        this.appUrl = appUrl;
    }

    @Transactional(readOnly = true)
    Preparo preparar(LembretesRepositorio.Reservado lembrete, LocalDate hoje) {
        Optional<CobrancaAluno> achada = cobrancas.findById(lembrete.cobrancaId());
        if (achada.isEmpty() || achada.get().getSituacao() != CobrancaAluno.Situacao.ABERTA) {
            return Preparo.cancelar(COBRANCA_NAO_ABERTA);
        }
        CobrancaAluno cobranca = achada.get();
        if (cobranca.getTipo() == CobrancaAluno.Tipo.SAIDA) {
            return Preparo.cancelar(NAO_E_MENSALIDADE);
        }
        if (automatica.eh(cobranca)) {
            return Preparo.cancelar(COBRANCA_AUTOMATICA);
        }
        RegraDosLembretes.Configuracao configuracao = configuracoes.daConsultoria()
                .map(ConfiguracaoDeLembretes::configuracao).orElse(RegraDosLembretes.Configuracao.PADRAO);
        if (RegraDosLembretes.devido(hoje, cobranca.getVencimento(), configuracao).filter(lembrete.tipo()::equals).isEmpty()) {
            return Preparo.cancelar(NAO_E_MAIS_DEVIDO);
        }
        boolean ativa = cobranca.getContratacaoId() == null || contratacoes.findById(cobranca.getContratacaoId())
                .map(c -> c.getSituacao() == ContratacaoAluno.Situacao.ATIVA).orElse(false);
        if (!ativa) {
            return Preparo.cancelar(CONTRATACAO_NAO_ATIVA);
        }
        Optional<Aluno> aluno = alunos.findById(cobranca.getAlunoId());
        if (aluno.isEmpty() || !aluno.get().isAtivo() || aluno.get().isAnonimizado()) {
            return Preparo.cancelar(ALUNO_INATIVO);
        }
        if (aluno.get().getLembretesCobrancaDesligadosEm() != null) {
            return Preparo.cancelar(ALUNO_DESLIGOU);
        }
        String para = destino(aluno.get());
        if (para == null) {
            return Preparo.cancelar(SEM_EMAIL);
        }
        Consultoria consultoria = consultorias.findById(lembrete.consultoriaId()).orElse(null);
        var dados = new TextoDoLembrete.Dados(aluno.get().getNome(), consultoria == null ? null : consultoria.getNome(),
                cobranca.getValorCentavos(), cobranca.getVencimento(), appUrl, emAberto(cobrancas, cobranca),
                cobranca.getTipo() == CobrancaAluno.Tipo.MENSALIDADE);
        return new Preparo(para, TextoDoLembrete.email(lembrete.tipo(), dados),
                consultoria == null ? null : RemetenteDaConsultoria.de(consultoria), null);
    }

    /** Quantas cobranças do aluno estão em aberto (a de saída não entra: não tem lembrete), a desta inclusive. */
    static int emAberto(CobrancaAlunoRepository cobrancas, CobrancaAluno cobranca) {
        return (int) cobrancas.findByAlunoIdAndSituacao(cobranca.getAlunoId(), CobrancaAluno.Situacao.ABERTA).stream()
                .filter(c -> c.getTipo() != CobrancaAluno.Tipo.SAIDA).count();
    }

    /**
     * Quem recebe: o e-mail do responsável financeiro, quando o aluno tem um com e-mail (D15; o texto não muda e não leva o nome
     * dele); senão o e-mail do cadastro do aluno e, sem ele, o de login. Nulo se nenhum serve.
     */
    private String destino(Aluno aluno) {
        String doResponsavel = responsaveis.findByAlunoId(aluno.getId()).map(ResponsavelFinanceiro::getEmail)
                .map(PreparoDoLembrete::valido).orElse(null);
        if (doResponsavel != null) {
            return doResponsavel;
        }
        String doCadastro = valido(aluno.getEmail());
        if (doCadastro != null || aluno.getUsuarioId() == null) {
            return doCadastro;
        }
        return usuarios.findById(aluno.getUsuarioId()).map(Usuario::getEmail).map(PreparoDoLembrete::valido).orElse(null);
    }

    static String valido(String email) {
        if (email == null) {
            return null;
        }
        String limpo = email.trim();
        return limpo.length() <= 254 && EMAIL.matcher(limpo).matches() ? limpo : null;
    }
}
