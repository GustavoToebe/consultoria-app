package br.com.treinos.api.planos.liberacao;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Avisos de plano liberado. Leitura filtrada pelo {@code @TenantId}; o que escreve em lote leva consultoria e aluno explícitos. */
interface AvisoPlanoLiberadoRepository extends JpaRepository<AvisoPlanoLiberado, UUID> {

    boolean existsByConsultoriaIdAndAlunoIdAndVistoEmIsNull(UUID consultoriaId, UUID alunoId);

    /** Os não vistos do aluno, do mais novo ao mais antigo (no máximo 20). */
    List<AvisoPlanoLiberado> findTop20ByConsultoriaIdAndAlunoIdAndVistoEmIsNullOrderByCriadoEmDescIdDesc(UUID consultoriaId,
                                                                                                         UUID alunoId);

    /** Marca como visto só o que ainda não foi: o {@code visto_em} de um aviso já visto nunca muda (idempotente). */
    @Modifying(flushAutomatically = true)
    @Query("update AvisoPlanoLiberado a set a.vistoEm = :agora where a.consultoriaId = :consultoriaId "
            + "and a.alunoId = :alunoId and a.id = :id and a.vistoEm is null")
    int marcarVisto(UUID consultoriaId, UUID alunoId, UUID id, Instant agora);

    boolean existsByConsultoriaIdAndAlunoIdAndId(UUID consultoriaId, UUID alunoId, UUID id);

    /** Todos os avisos do aluno, do mais antigo ao mais novo (exportação). */
    List<AvisoPlanoLiberado> findByConsultoriaIdAndAlunoIdOrderByCriadoEmAscIdAsc(UUID consultoriaId, UUID alunoId);

    /** Anonimização e "Excluir minha conta": saem os avisos do aluno. */
    @Modifying
    @Query("delete from AvisoPlanoLiberado a where a.consultoriaId = :consultoriaId and a.alunoId = :alunoId")
    int apagarDoAluno(UUID consultoriaId, UUID alunoId);

    /** Limpeza: avisos criados antes de {@code limite}, vistos ou não (o texto é genérico, não vale depois de um mês). */
    @Modifying
    @Query("delete from AvisoPlanoLiberado a where a.consultoriaId = :consultoriaId and a.criadoEm < :limite")
    int apagarAntesDe(UUID consultoriaId, Instant limite);
}
