package br.com.treinos.api.biblioteca;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface CatalogoExercicioRepository extends JpaRepository<CatalogoExercicio, UUID> {

    /**
     * {@code padrao} já vem sem acento ({@code Buscas.padraoSemAcento}); {@code semGrupos} não filtra por grupo (então
     * {@code grupos} leva um valor qualquer, porque {@code in ()} vazio não vale); modalidade nula não filtra.
     */
    @Query("select c from CatalogoExercicio c where c.nomeBusca like :padrao escape '\\' "
            + "and (:semGrupos = true or c.grupoMuscular in :grupos) "
            + "and (:modalidade is null or c.modalidade = :modalidade) order by c.nome")
    Page<CatalogoExercicio> buscar(String padrao, boolean semGrupos, Collection<String> grupos, String modalidade, Pageable pagina);

    @Query("select distinct c.grupoMuscular from CatalogoExercicio c where c.grupoMuscular is not null "
            + "order by c.grupoMuscular")
    List<String> grupos();
}
