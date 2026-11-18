package br.com.treinos.api.comunidade;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * A {@code ordem} vale dentro da playlist (V088): as listas saem agrupadas por playlist (sem playlist por último) e, em cada grupo,
 * na ordem dela; quem consome filtra por {@code playlistId}.
 */
public interface ComunidadeAulaRepository extends JpaRepository<ComunidadeAula, UUID> {

    @Query("select a from ComunidadeAula a where a.publicada = true "
            + "order by a.playlistId asc nulls last, a.ordem asc, a.criadaEm desc, a.id asc")
    List<ComunidadeAula> publicadasEmOrdem();

    @Query("select a from ComunidadeAula a order by a.playlistId asc nulls last, a.ordem asc, a.criadaEm desc, a.id asc")
    List<ComunidadeAula> todasEmOrdem();

    long countByPlaylistId(UUID playlistId);

    /** Playlist atual de cada aulão do lote (leitura escalar, fora do contexto): só para saber quais travar antes de mexer. */
    @Query("select distinct a.playlistId from ComunidadeAula a where a.id in :ids and a.playlistId is not null")
    List<UUID> playlistsDosAuloes(Collection<UUID> ids);

    /** Posição do último aulão da playlist; -1 se está vazia (o novo vai para o fim: este valor + 1). */
    @Query("select coalesce(max(a.ordem), -1) from ComunidadeAula a where a.playlistId = :playlistId")
    int maiorOrdemDaPlaylist(UUID playlistId);

    /** Aulões por playlist (só as que têm algum), contando todos ou só os publicados, numa consulta só. */
    interface TotalDaPlaylist {
        UUID getPlaylistId();
        long getTotal();
    }

    @Query("select a.playlistId as playlistId, count(a) as total from ComunidadeAula a "
            + "where a.playlistId is not null and (:soPublicadas = false or a.publicada = true) group by a.playlistId")
    List<TotalDaPlaylist> totaisPorPlaylist(boolean soPublicadas);
}
