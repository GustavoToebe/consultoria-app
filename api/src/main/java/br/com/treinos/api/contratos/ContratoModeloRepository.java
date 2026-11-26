package br.com.treinos.api.contratos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

/** Toda consulta sai filtrada pela consultoria da sessão ({@code @TenantId}). */
public interface ContratoModeloRepository extends JpaRepository<ContratoModelo, UUID> {

    /** Os ativos primeiro, cada grupo por nome. */
    @Query("select m from ContratoModelo m order by case when m.arquivadoEm is null then 0 else 1 end, lower(m.nome), m.id")
    List<ContratoModelo> todosEmOrdem();

    /** Nome em uso entre os ativos (sem diferença de caixa), fora o próprio modelo ({@code ignorar}). */
    @Query("select count(m) > 0 from ContratoModelo m where m.arquivadoEm is null and lower(m.nome) = lower(:nome) and m.id <> :ignorar")
    boolean nomeEmUso(String nome, UUID ignorar);
}
