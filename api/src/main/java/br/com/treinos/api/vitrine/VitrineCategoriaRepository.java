package br.com.treinos.api.vitrine;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

/** Categorias da consultoria da sessão ({@code @TenantId}: outra consultoria não aparece, nem por id). */
public interface VitrineCategoriaRepository extends JpaRepository<VitrineCategoria, UUID> {

    @Query("select c from VitrineCategoria c order by c.ordem, c.nomeNormalizado, c.id")
    List<VitrineCategoria> todas();

    boolean existsByNomeNormalizado(String nomeNormalizado);

    boolean existsByNomeNormalizadoAndIdNot(String nomeNormalizado, UUID id);

    @Query("select coalesce(max(c.ordem), -1) from VitrineCategoria c")
    int maiorOrdem();
}
