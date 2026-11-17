package br.com.treinos.api.inscricoes;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.questionarios.Finalidade;
import br.com.treinos.api.questionarios.Questionario;
import br.com.treinos.api.questionarios.QuestionarioRepository;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Link de indicação do próprio aluno (plano {@code indicacao-de-alunos}): sempre o aluno da sessão, nunca id no caminho. O link é
 * o do formulário de inscrição padrão, publicado e aberto, com {@code ?origem=indicacao} na query e o código do aluno no
 * <strong>fragmento</strong> ({@code #indicacao=}), que não vai ao log do proxy, ao histórico nem ao Referer. Só o link: nunca
 * contagem, nome nem situação de quem se inscreveu, e o código nunca vai a log nem à auditoria.
 */
@Service
public class IndicacaoDoAlunoService {

    /** {@code link} é a única coisa que a rota devolve. */
    public record Indicacao(String link) {
        /** O link leva o código do aluno: o {@code toString} não o repete. */
        @Override
        public String toString() {
            return "Indicacao[***]";
        }
    }

    private final AlunoRepository alunos;
    private final QuestionarioRepository questionarios;
    private final String appUrl;

    public IndicacaoDoAlunoService(AlunoRepository alunos, QuestionarioRepository questionarios,
                                   @Value("${treinos.app-url}") String appUrl) {
        this.alunos = alunos;
        this.questionarios = questionarios;
        this.appUrl = appUrl.endsWith("/") ? appUrl.substring(0, appUrl.length() - 1) : appUrl;
    }

    /** 409 {@code ALUNO_ANONIMIZADO}; 404 se a consultoria não tem o formulário de inscrição padrão com o link aberto. */
    @Transactional(readOnly = true)
    public Indicacao link(UsuarioAutenticado eu) {
        Aluno aluno = alunos.findById(AlunoAppService.alunoDaSessao(eu))
                .orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        if (aluno.isAnonimizado()) {
            throw new ConflictException("Esta conta foi encerrada.", "ALUNO_ANONIMIZADO");
        }
        Questionario q = questionarios.findByPadraoTrueAndFinalidade(Finalidade.INSCRICAO)
                .filter(Questionario::isLinkPublicoAberto)
                .orElseThrow(() -> new NaoEncontradoException("A consultoria não tem um link de inscrição aberto."));
        return new Indicacao(appUrl + "/inscricao/" + q.getCodigoPublico() + "?origem=indicacao#indicacao="
                + aluno.getCodigoIndicacao());
    }
}
