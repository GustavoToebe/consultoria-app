package br.com.treinos.api.pagamentos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

/** Leitura filtrada pela consultoria da sessão ({@code @TenantId}). */
public interface LembreteDeCobrancaRepository extends JpaRepository<LembreteDeCobranca, UUID> {

    List<LembreteDeCobranca> findByCobrancaIdOrderByDataPrevistaAscTipoAsc(UUID cobrancaId);

    @Query("select l from LembreteDeCobranca l where l.cobrancaId in (select c.id from CobrancaAluno c where c.alunoId = :aluno) "
            + "order by l.dataPrevista desc, l.tipo")
    List<LembreteDeCobranca> doAluno(@Param("aluno") UUID alunoId);
}
