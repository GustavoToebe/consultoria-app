package br.com.treinos.api.comunidade;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Todos os métodos saem filtrados pela consultoria da sessão ({@code @TenantId}): playlist de outra consultoria não existe. */
public interface ComunidadePlaylistRepository extends JpaRepository<ComunidadePlaylist, UUID> {

    List<ComunidadePlaylist> findAllByOrderByOrdemAscNomeAscIdAsc();

    /** Trava a linha da playlist até o fim da transação: serializa quem põe, reordena ou apaga aulões nela. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from ComunidadePlaylist p where p.id = :id")
    Optional<ComunidadePlaylist> travar(UUID id);

    /** Trava várias, sempre na ordem do id (duas reordenações simultâneas não se cruzam em deadlock). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from ComunidadePlaylist p where p.id in :ids order by p.id")
    List<ComunidadePlaylist> travarTodas(Collection<UUID> ids);

    @Query("select coalesce(max(p.ordem), -1) from ComunidadePlaylist p")
    int maiorOrdem();
}
