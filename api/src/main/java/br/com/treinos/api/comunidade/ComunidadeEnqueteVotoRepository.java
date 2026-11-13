package br.com.treinos.api.comunidade;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** JPQL e métodos derivados: o {@code @TenantId} vale em todos. */
public interface ComunidadeEnqueteVotoRepository extends JpaRepository<ComunidadeEnqueteVoto, UUID> {

    interface ContagemDaOpcao {
        UUID getOpcaoId();
        long getTotal();
    }

    interface ParticipantesDoPost {
        UUID getPostId();
        long getTotal();
    }

    /** Voto sem identidade extra: o que a amostra do mural precisa. */
    interface VotoRecente {
        UUID getPostId();
        UUID getOpcaoId();
        UUID getUsuarioId();
    }

    interface VotoDoUsuario {
        UUID getPostId();
        UUID getOpcaoId();
    }

    @Query("select v.opcaoId as opcaoId, count(v) as total from ComunidadeEnqueteVoto v where v.postId in :postIds group by v.opcaoId")
    List<ContagemDaOpcao> contagensDasOpcoes(Collection<UUID> postIds);

    @Query("select v.postId as postId, count(distinct v.usuarioId) as total from ComunidadeEnqueteVoto v "
            + "where v.postId in :postIds group by v.postId")
    List<ParticipantesDoPost> participantes(Collection<UUID> postIds);

    @Query("select v.postId as postId, v.opcaoId as opcaoId from ComunidadeEnqueteVoto v "
            + "where v.postId in :postIds and v.usuarioId = :usuarioId")
    List<VotoDoUsuario> doUsuario(Collection<UUID> postIds, UUID usuarioId);

    /** Os votos das enquetes da página, do mais novo ao mais antigo (a amostra pega os 3 primeiros de cada opção). */
    @Query("select v.postId as postId, v.opcaoId as opcaoId, v.usuarioId as usuarioId from ComunidadeEnqueteVoto v "
            + "where v.postId in :postIds order by v.votadoEm desc, v.id")
    List<VotoRecente> recentes(Collection<UUID> postIds);

    List<ComunidadeEnqueteVoto> findByPostIdAndUsuarioId(UUID postId, UUID usuarioId);

    Page<ComunidadeEnqueteVoto> findByPostIdOrderByVotadoEmDescIdAsc(UUID postId, Pageable pagina);

    Page<ComunidadeEnqueteVoto> findByPostIdAndOpcaoIdOrderByVotadoEmDescIdAsc(UUID postId, UUID opcaoId, Pageable pagina);

    List<ComunidadeEnqueteVoto> findTop5000ByUsuarioIdOrderByVotadoEmDesc(UUID usuarioId);
}
