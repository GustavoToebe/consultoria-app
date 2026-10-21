package br.com.treinos.api.biblioteca;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** Já filtrado pela consultoria da sessão ({@code @TenantId}). */
public interface ExercicioImagemRepository extends JpaRepository<ExercicioImagem, UUID> {

    @Query("select new br.com.treinos.api.biblioteca.ExercicioImagemMarca(i.exercicioId, i.atualizadaEm) "
            + "from ExercicioImagem i where i.exercicioId in :ids")
    List<ExercicioImagemMarca> marcas(Collection<UUID> ids);
}
