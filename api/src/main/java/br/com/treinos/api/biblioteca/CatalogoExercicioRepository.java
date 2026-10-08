package br.com.treinos.api.biblioteca;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface CatalogoExercicioRepository extends JpaRepository<CatalogoExercicio, UUID> {

    /** {@code padrao} já vem sem acento ({@code Buscas.padraoSemAcento}); filtro nulo não filtra. */
    @Query("select c from CatalogoExercicio c where c.nomeBusca like :padrao escape '\\' "
            + "and (:grupo is null or c.grupoMuscular = :grupo) "
            + "and (:modalidade is null or c.modalidade = :modalidade) order by c.nome")
    Page<CatalogoExercicio> buscar(String padrao, String grupo, String modalidade, Pageable pagina);

    @Query("select distinct c.grupoMuscular from CatalogoExercicio c where c.grupoMuscular is not null "
            + "order by c.grupoMuscular")
    List<String> grupos();
}
