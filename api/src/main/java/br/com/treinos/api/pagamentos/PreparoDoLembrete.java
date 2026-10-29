package br.com.treinos.api.pagamentos;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.consultoria.Consultoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * A conferência de um lembrete reservado, logo antes do envio, numa transação curta somente leitura dentro da consultoria
 * dele (quem chama abre o {@code TenantContext}): a cobrança ainda está ABERTA, a regra ainda diz que este tipo é devido
 * hoje (configuração desligada, alterada ou vencimento reajustado cancelam), a contratação está ATIVA, o aluno está ativo e
 * não anonimizado e há um e-mail. Devolve a mensagem pronta ou o motivo do cancelamento. O envio fica fora daqui (e de
 * qualquer transação). Nada daqui vai a log.
 */
@Service
class PreparoDoLembrete {

    static final String COBRANCA_NAO_ABERTA = "COBRANCA_NAO_ABERTA";
    static final String NAO_E_MAIS_DEVIDO = "NAO_E_MAIS_DEVIDO";
    static final String CONTRATACAO_NAO_ATIVA = "CONTRATACAO_NAO_ATIVA";
    static final String ALUNO_INATIVO = "ALUNO_INATIVO";
    static final String SEM_EMAIL = "SEM_EMAIL";

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@<>\"(),;:]+@[^\\s@<>\"(),;:]+\\.[^\\s@<>\"(),;:]+$");

    /** O resultado: {@code para} e {@code mensagem} para enviar, ou só o {@code motivo} do cancelamento. */
    record Preparo(String para, TextoDoLembrete.Mensagem mensagem, String motivo) {

        static Preparo cancelar(String motivo) {
            return new Preparo(null, null, motivo);
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
    private final String appUrl;

    PreparoDoLembrete(CobrancaAlunoRepository cobrancas, ContratacaoAlunoRepository contratacoes,
                      ConfiguracaoDeLembretesRepository configuracoes, AlunoRepository alunos, UsuarioRepository usuarios,
                      ConsultoriaRepository consultorias, @Value("${treinos.app-url:}") String appUrl) {
        this.cobrancas = cobrancas;
        this.contratacoes = contratacoes;
        this.configuracoes = configuracoes;
        this.alunos = alunos;
        this.usuarios = usuarios;
        this.consultorias = consultorias;
        this.appUrl = appUrl;
    }

    @Transactional(readOnly = true)
    Preparo preparar(LembretesRepositorio.Reservado lembrete, LocalDate hoje) {
        Optional<CobrancaAluno> achada = cobrancas.findById(lembrete.cobrancaId());
        if (achada.isEmpty() || achada.get().getSituacao() != CobrancaAluno.Situacao.ABERTA) {
            return Preparo.cancelar(COBRANCA_NAO_ABERTA);
        }
        CobrancaAluno cobranca = achada.get();
        RegraDosLembretes.Configuracao configuracao = configuracoes.daConsultoria()
                .map(ConfiguracaoDeLembretes::configuracao).orElse(RegraDosLembretes.Configuracao.PADRAO);
        if (RegraDosLembretes.devido(hoje, cobranca.getVencimento(), configuracao).filter(lembrete.tipo()::equals).isEmpty()) {
            return Preparo.cancelar(NAO_E_MAIS_DEVIDO);
        }
        boolean ativa = contratacoes.findById(cobranca.getContratacaoId())
                .map(c -> c.getSituacao() == ContratacaoAluno.Situacao.ATIVA).orElse(false);
        if (!ativa) {
            return Preparo.cancelar(CONTRATACAO_NAO_ATIVA);
        }
        Optional<Aluno> aluno = alunos.findById(cobranca.getAlunoId());
        if (aluno.isEmpty() || !aluno.get().isAtivo() || aluno.get().isAnonimizado()) {
            return Preparo.cancelar(ALUNO_INATIVO);
        }
        String para = destino(aluno.get());
        if (para == null) {
            return Preparo.cancelar(SEM_EMAIL);
        }
        String consultoria = consultorias.findById(lembrete.consultoriaId()).map(Consultoria::getNome).orElse(null);
        var dados = new TextoDoLembrete.Dados(aluno.get().getNome(), consultoria, cobranca.getValorCentavos(),
                cobranca.getVencimento(), appUrl);
        return new Preparo(para, TextoDoLembrete.email(lembrete.tipo(), dados), null);
    }

    /** O e-mail do cadastro do aluno; sem ele, o de login. Nulo se nenhum serve. */
    private String destino(Aluno aluno) {
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
