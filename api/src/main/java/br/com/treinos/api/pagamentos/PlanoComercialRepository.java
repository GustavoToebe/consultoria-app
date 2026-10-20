package br.com.treinos.api.pagamentos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

/** Toda consulta sai filtrada pela consultoria da sessão ({@code @TenantId}). */
public interface PlanoComercialRepository extends JpaRepository<PlanoComercial, UUID> {

    @Query("select p from PlanoComercial p where (:incluirArquivados = true or p.arquivadoEm is null) "
            + "order by lower(p.nome), p.id")
    List<PlanoComercial> listar(boolean incluirArquivados);

    /** Nome repetido entre os não arquivados (sem diferença de maiúsculas); {@code ignorar} é o próprio plano na edição. */
    @Query("select count(p) > 0 from PlanoComercial p where lower(p.nome) = lower(:nome) and p.arquivadoEm is null "
            + "and (:ignorar is null or p.id <> :ignorar)")
    boolean nomeEmUso(String nome, UUID ignorar);
}
