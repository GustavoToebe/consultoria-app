package br.com.treinos.api.anamneses;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** JPQL e métodos derivados: o {@code @TenantId} vale em todos (pendência de outra consultoria não aparece). */
public interface AnamnesePendenciaRepository extends JpaRepository<AnamnesePendencia, UUID> {

    List<AnamnesePendencia> findByAnamneseIdOrderByCriadaEmAsc(UUID anamneseId);

    List<AnamnesePendencia> findByAnamneseIdInOrderByCriadaEmAsc(List<UUID> anamneseIds);

    /** Trava a linha: aplicar e descartar ao mesmo tempo esperam em fila e o segundo encontra a resolvida. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from AnamnesePendencia p where p.id = :id and p.anamneseId = :anamneseId")
    Optional<AnamnesePendencia> buscarParaAlterar(UUID id, UUID anamneseId);

    /** Contagem das abertas por anamnese, para a lista da ficha (uma consulta só). */
    @Query("select p.anamneseId, count(p) from AnamnesePendencia p where p.alunoId = :alunoId and p.situacao = "
            + "br.com.treinos.api.anamneses.AnamnesePendencia.Situacao.PENDENTE group by p.anamneseId")
    List<Object[]> abertasPorAnamnese(UUID alunoId);

    /** Anonimização do aluno: o valor proposto é dado dele e sai inteiro. */
    List<AnamnesePendencia> findByAlunoId(UUID alunoId);
}
