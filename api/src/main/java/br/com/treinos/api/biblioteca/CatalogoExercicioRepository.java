package br.com.treinos.api.biblioteca;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface CatalogoExercicioRepository extends JpaRepository<CatalogoExercicio, UUID> {

    @Query("select c from CatalogoExercicio c where lower(c.nome) like :padrao escape '\\' "
            + "or lower(c.grupoMuscular) like :padrao escape '\\' order by c.grupoMuscular, c.nome")
    List<CatalogoExercicio> buscar(String padrao);
}
