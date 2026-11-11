package br.com.treinos.api.comunidade;

import br.com.plataforma.comum.web.ApiError;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.DenunciaRequest;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Denúncia de post (C10): uma por post e usuário, motivo de lista fechada. O aluno nunca vê quem denunciou nem quantas há; a
 * equipe vê a contagem na lista e dispensa (apaga) as denúncias de um post. Denúncia de comentário está fora do escopo.
 */
@Service
public class DenunciasDoMuralService {

    /** Resumo fixo: nunca o motivo, o post nem quem denunciou. */
    static final String RESUMO_DISPENSADAS = "Dispensou as denúncias de uma publicação.";

    private final ComunidadeMuralPostRepository posts;
    private final ComunidadeMuralDenunciaRepository denuncias;
    private final Auditoria auditoria;

    public DenunciasDoMuralService(ComunidadeMuralPostRepository posts, ComunidadeMuralDenunciaRepository denuncias,
                                   Auditoria auditoria) {
        this.posts = posts;
        this.denuncias = denuncias;
        this.auditoria = auditoria;
    }

    /**
     * Idempotente: repetir não grava de novo nem avisa. Post inexistente, oculto ou de outra consultoria = 404; o próprio post e
     * motivo fora da lista = 422 {@code DENUNCIA_INVALIDA} no campo. Sem transação aberta aqui de propósito: a corrida de dois
     * toques simultâneos bate na chave única e é tratada como "já denunciou", sem derrubar uma transação do chamador.
     */
    public void denunciar(UsuarioAutenticado eu, UUID postId, DenunciaRequest r) {
        ComunidadeMuralPost post = posts.findById(postId).filter(p -> !p.isOculto())
                .orElseThrow(() -> new NaoEncontradoException("Post não encontrado."));
        MotivoDeDenuncia motivo = MotivoDeDenuncia.de(r.motivo() == null ? "" : r.motivo().trim()).orElse(null);
        if (motivo == null) {
            throw invalida("motivo", "Escolha um motivo da lista.");
        }
        if (post.getAutorId().equals(eu.usuarioId())) {
            throw invalida("motivo", "Você não pode denunciar a sua própria publicação.");
        }
        if (denuncias.existsByPostIdAndUsuarioId(postId, eu.usuarioId())) {
            return;
        }
        try {
            denuncias.saveAndFlush(new ComunidadeMuralDenuncia(postId, eu.usuarioId(), motivo));
        } catch (DataIntegrityViolationException jaDenunciou) {
            // shortcut: qualquer violação de integridade é tratada como a corrida da chave única; as FKs já foram conferidas acima.
        }
    }

    /** Apaga as denúncias do post (idempotente; sem denúncia não audita). Post de outra consultoria = 404. */
    @Transactional
    public void dispensar(UUID postId) {
        if (!posts.existsById(postId)) {
            throw new NaoEncontradoException("Post não encontrado.");
        }
        if (denuncias.apagarDoPost(postId) > 0) {
            auditoria.registrarEvento("COMUNIDADE_DENUNCIAS_DISPENSADAS", "COMUNIDADE_MURAL_POST", postId, RESUMO_DISPENSADAS);
        }
    }

    private static ValidacaoException invalida(String campo, String mensagem) {
        return new ValidacaoException("Confira a denúncia.", "DENUNCIA_INVALIDA", List.of(new ApiError.FieldError(campo, mensagem)));
    }
}
