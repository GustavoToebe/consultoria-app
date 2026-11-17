package br.com.treinos.api.comunidade;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * O funil único por post do mural. Todo serviço que recebe um {@code postId} (comentar, reagir, votar, ver votos, denunciar, foto,
 * capa, fixar, moderar) passa por {@link #exigirPostVisivel}: tenant (o {@code @TenantId} do {@code findById}), não oculto e pod.
 * A equipe vê todos os pods; o aluno só o mural geral e o do próprio pod, lido do banco a cada requisição (nunca do token nem do
 * corpo). Quem não pode ver recebe o MESMO 404 do post inexistente: nada distingue "não existe" de "é de outro grupo". Sem
 * usuário na requisição (ou papel desconhecido) falha fechado: só o geral.
 */
@Service
public class PostsVisiveisDoMural {

    private static final String PAPEL_DA_EQUIPE = "TREINADOR";

    private final ComunidadeMuralPostRepository posts;
    private final AlunoRepository alunos;

    public PostsVisiveisDoMural(ComunidadeMuralPostRepository posts, AlunoRepository alunos) {
        this.posts = posts;
        this.alunos = alunos;
    }

    public ComunidadeMuralPost exigirPostVisivel(UUID postId, UsuarioAutenticado eu) {
        return exigirPostVisivel(postId, eu, "Post não encontrado.");
    }

    /**
     * Quem chega por outro recurso (foto, capa) passa a mensagem dele: a recusa do funil sai idêntica à do recurso inexistente
     * (status, código e mensagem), senão a diferença diria que o post existe.
     */
    @Transactional(readOnly = true)
    public ComunidadeMuralPost exigirPostVisivel(UUID postId, UsuarioAutenticado eu, String mensagemDoNaoEncontrado) {
        return posts.findById(postId)
                .filter(p -> !p.isOculto())
                .filter(p -> p.getPodId() == null || equipe(eu) || p.getPodId().equals(podDoAluno(eu)))
                .orElseThrow(() -> new NaoEncontradoException(mensagemDoNaoEncontrado));
    }

    /** Equipe da consultoria (a consultoria já está no contexto do tenant); o resto só enxerga o que o pod permite. */
    static boolean equipe(UsuarioAutenticado eu) {
        return eu != null && PAPEL_DA_EQUIPE.equals(eu.papel());
    }

    /** O pod do aluno da sessão lido agora do banco; nulo = sem pod (ou não é aluno). */
    UUID podDoAluno(UsuarioAutenticado eu) {
        return eu == null || eu.alunoId() == null ? null : alunos.podDoAluno(eu.alunoId()).orElse(null);
    }
}
