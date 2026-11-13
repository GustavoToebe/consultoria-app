package br.com.treinos.api.comunidade;

import br.com.plataforma.comum.web.ApiError;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Reação do mural por código de lista fechada (D6): uma pessoa pode dar vários códigos no mesmo post, cada um idempotente
 * ({@code PUT} liga, {@code DELETE} desliga). A reação é só contagem: a API não devolve quem reagiu. Sem transação no
 * {@link #reagir} de propósito, como a denúncia: a corrida de dois toques simultâneos bate na chave única e é tratada como "já
 * reagiu" (só ela: outra violação de integridade sobe), sem derrubar uma transação de quem chama.
 */
@Service
public class ReacoesDoMuralService {

    private final ComunidadeMuralPostRepository posts;
    private final ComunidadeMuralReacaoRepository reacoes;

    public ReacoesDoMuralService(ComunidadeMuralPostRepository posts, ComunidadeMuralReacaoRepository reacoes) {
        this.posts = posts;
        this.reacoes = reacoes;
    }

    /** Liga o código para o usuário. Post de outra consultoria ou oculto = 404; código fora da lista = 422 {@code REACAO_INVALIDA}. */
    public void reagir(UUID postId, String codigo, UsuarioAutenticado eu) {
        CodigoDeReacao c = exigir(postId, codigo);
        if (reacoes.existsByPostIdAndUsuarioIdAndCodigo(postId, eu.usuarioId(), c.name())) {
            return;
        }
        try {
            reacoes.saveAndFlush(new ComunidadeMuralReacao(postId, eu.usuarioId(), c.name()));
        } catch (DataIntegrityViolationException corrida) {
            // Só a corrida na chave única vira "já reagiu"; qualquer outra violação (chave estrangeira etc.) é defeito e sobe.
            if (!violouIndiceUnico(corrida)) {
                throw corrida;
            }
        }
    }

    /** Chave única da reação por usuário, post e código (V065, refeita na V068; a coluna {@code emoji} virou {@code codigo} na V072). */
    static final String INDICE_UNICO = "uk_mural_reacao_usuario";

    /** Só olha o nome da restrição (nunca a mensagem do banco), como {@code AnamneseService.violouPendente}. */
    static boolean violouIndiceUnico(DataIntegrityViolationException e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof org.hibernate.exception.ConstraintViolationException c && INDICE_UNICO.equals(c.getConstraintName())) {
                return true;
            }
        }
        return false;
    }

    /** Desliga o código (idempotente: sem a reação não apaga nada). Mesmas recusas do {@link #reagir}. */
    public void desfazer(UUID postId, String codigo, UsuarioAutenticado eu) {
        CodigoDeReacao c = exigir(postId, codigo);
        reacoes.desfazer(postId, eu.usuarioId(), c.name());
    }

    private CodigoDeReacao exigir(UUID postId, String codigo) {
        // O post primeiro: de outra consultoria ou oculto é 404 mesmo com código inválido (nada vaza sobre o recurso).
        if (posts.findById(postId).filter(p -> !p.isOculto()).isEmpty()) {
            throw new NaoEncontradoException("Post não encontrado.");
        }
        return CodigoDeReacao.de(codigo).orElseThrow(() -> new ValidacaoException("Reação inválida.", "REACAO_INVALIDA",
                List.of(new ApiError.FieldError("codigo", "Escolha uma reação da lista."))));
    }

    /** Contagem por código dos posts da página, numa consulta; só entram os códigos com pelo menos uma reação. */
    @Transactional(readOnly = true)
    public Map<UUID, Map<String, Long>> contagens(Collection<UUID> postIds) {
        Map<UUID, EnumMap<CodigoDeReacao, Long>> porPost = new HashMap<>();
        if (!postIds.isEmpty()) {
            for (var c : reacoes.contagens(postIds)) {
                CodigoDeReacao codigo = CodigoDeReacao.de(c.getCodigo()).orElse(null);
                if (codigo != null) {
                    porPost.computeIfAbsent(c.getPostId(), k -> new EnumMap<>(CodigoDeReacao.class)).put(codigo, c.getTotal());
                }
            }
        }
        Map<UUID, Map<String, Long>> resposta = new HashMap<>();
        porPost.forEach((id, m) -> {
            Map<String, Long> ordenado = new LinkedHashMap<>();
            m.forEach((codigo, total) -> ordenado.put(codigo.name(), total));
            resposta.put(id, ordenado);
        });
        return resposta;
    }

    /** Códigos que o usuário deu em cada post da página, na ordem do enum, numa consulta. */
    @Transactional(readOnly = true)
    public Map<UUID, List<String>> minhas(Collection<UUID> postIds, UUID usuarioId) {
        Map<UUID, EnumMap<CodigoDeReacao, Boolean>> porPost = new HashMap<>();
        if (!postIds.isEmpty() && usuarioId != null) {
            for (var r : reacoes.doUsuario(postIds, usuarioId)) {
                CodigoDeReacao codigo = CodigoDeReacao.de(r.getCodigo()).orElse(null);
                if (codigo != null) {
                    porPost.computeIfAbsent(r.getPostId(), k -> new EnumMap<>(CodigoDeReacao.class)).put(codigo, Boolean.TRUE);
                }
            }
        }
        Map<UUID, List<String>> resposta = new HashMap<>();
        porPost.forEach((id, m) -> {
            List<String> codigos = new ArrayList<>();
            m.keySet().forEach(c -> codigos.add(c.name()));
            resposta.put(id, codigos);
        });
        return resposta;
    }
}
