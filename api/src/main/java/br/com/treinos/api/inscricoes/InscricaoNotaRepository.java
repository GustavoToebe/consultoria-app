package br.com.treinos.api.inscricoes;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

/** Notas da consultoria da sessão ({@code @TenantId}). */
public interface InscricaoNotaRepository extends JpaRepository<InscricaoNota, UUID> {

    List<InscricaoNota> findByInscricaoIdOrderByCriadaEmAsc(UUID inscricaoId);

    @Modifying
    @Query("delete from InscricaoNota n where n.inscricaoId = :inscricaoId")
    int apagarDaInscricao(UUID inscricaoId);
}
