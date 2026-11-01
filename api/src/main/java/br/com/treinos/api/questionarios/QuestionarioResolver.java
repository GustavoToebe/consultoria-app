package br.com.treinos.api.questionarios;

import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Descobre qual versão publicada do questionário de atualização vale: a escolhida na pasta, senão a do aluno, senão o
 * padrão da consultoria. Questionário arquivado, sem versão publicada ou de anamnese é ignorado. A consulta é sempre da consultoria da
 * sessão (@TenantId); id de outra consultoria nem aparece.
 */
@Component
public class QuestionarioResolver {

    /** Versão publicada pronta para uso: id, número, nome do questionário e o conteúdo (JSON). */
    public record Resolvida(UUID versaoId, int numero, String nome, String conteudo) { }

    private final QuestionarioRepository questionarios;
    private final QuestionarioVersaoRepository versoes;

    public QuestionarioResolver(QuestionarioRepository questionarios, QuestionarioVersaoRepository versoes) {
        this.questionarios = questionarios;
        this.versoes = versoes;
    }

    /** Pasta &gt; aluno &gt; padrão. Os dois primeiros podem ser nulos. */
    public Resolvida vigente(UUID daPasta, UUID doAluno) {
        for (UUID id : new UUID[] {daPasta, doAluno}) {
            if (id == null) {
                continue;
            }
            var usavel = questionarios.findById(id).filter(q -> q.getFinalidade() == Finalidade.ATUALIZACAO
                    && !q.isArquivado() && q.getVersaoPublicada() > 0);
            if (usavel.isPresent()) {
                return publicada(usavel.get());
            }
        }
        return padrao();
    }

    public Resolvida padrao() {
        return publicada(questionarios.findByPadraoTrueAndFinalidade(Finalidade.ATUALIZACAO).orElseThrow(naoEncontrado()));
    }

    /**
     * Perguntas da página "Quero ser aluno": a versão publicada do padrão de inscrição da consultoria (D8). Vazio quando
     * não há padrão de inscrição (a página mostra só os campos fixos).
     */
    public java.util.Optional<Resolvida> padraoDaInscricao() {
        return questionarios.findByPadraoTrueAndFinalidade(Finalidade.INSCRICAO).filter(Questionario::isUsavel)
                .map(this::publicada);
    }

    /** Versão já fixada numa atualização enviada (continua valendo mesmo se o questionário for arquivado). */
    public Resolvida fixa(UUID versaoId) {
        QuestionarioVersao v = versoes.findById(versaoId).orElseThrow(naoEncontrado());
        Questionario q = questionarios.findById(v.getQuestionarioId()).orElseThrow(naoEncontrado());
        return new Resolvida(v.getId(), v.getNumero(), q.getNome(), v.getConteudo());
    }

    /** Última versão publicada de um questionário usável (anamnese: a atribuição fixa esta versão). */
    public Resolvida publicada(Questionario q) {
        QuestionarioVersao v = versoes.findByQuestionarioIdAndNumero(q.getId(), q.getVersaoPublicada())
                .orElseThrow(naoEncontrado());
        return new Resolvida(v.getId(), v.getNumero(), q.getNome(), v.getConteudo());
    }

    private static java.util.function.Supplier<NaoEncontradoException> naoEncontrado() {
        return () -> new NaoEncontradoException("Questionário de atualização não encontrado.");
    }
}
