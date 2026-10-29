package br.com.treinos.api.agenda;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Avisos de compromisso (D12). Leitura filtrada pelo {@code @TenantId}; tudo que escreve em lote leva a consultoria e o
 * aluno explícitos, sem depender só do filtro (o aluno da sessão nunca vem do cliente).
 */
public interface AvisoCompromissoRepository extends JpaRepository<AvisoCompromisso, UUID> {

    /** Anonimização e "Excluir minha conta": saem os avisos do aluno. */
    @Modifying
    @Query("delete from AvisoCompromisso a where a.consultoriaId = :consultoriaId and a.alunoId = :alunoId")
    int apagarDoAluno(UUID consultoriaId, UUID alunoId);

    /** Aviso novo substitui o anterior ainda não visto do mesmo compromisso e aluno; o visto fica. */
    @Modifying(flushAutomatically = true)
    @Query("delete from AvisoCompromisso a where a.consultoriaId = :consultoriaId and a.alunoId = :alunoId "
            + "and a.compromissoId in :compromissoIds and a.vistoEm is null")
    int apagarNaoVistos(UUID consultoriaId, UUID alunoId, Collection<UUID> compromissoIds);

    /** Inativação do aluno (D12/D18): saem TODOS os avisos ainda não vistos dele, de qualquer compromisso; o visto fica. */
    @Modifying(flushAutomatically = true)
    @Query("delete from AvisoCompromisso a where a.consultoriaId = :consultoriaId and a.alunoId = :alunoId "
            + "and a.vistoEm is null")
    int apagarTodosNaoVistosDoAluno(UUID consultoriaId, UUID alunoId);

    /** Os não vistos do aluno, do mais novo ao mais antigo (no máximo 20). */
    List<AvisoCompromisso> findTop20ByConsultoriaIdAndAlunoIdAndVistoEmIsNullOrderByCriadoEmDescIdDesc(UUID consultoriaId,
                                                                                                    UUID alunoId);

    /** Marca como visto só o que ainda não foi: o {@code visto_em} de um aviso já visto nunca muda (idempotente, sem corrida). */
    @Modifying(flushAutomatically = true)
    @Query("update AvisoCompromisso a set a.vistoEm = :agora where a.consultoriaId = :consultoriaId "
            + "and a.alunoId = :alunoId and a.id = :id and a.vistoEm is null")
    int marcarVisto(UUID consultoriaId, UUID alunoId, UUID id, Instant agora);

    boolean existsByConsultoriaIdAndAlunoIdAndId(UUID consultoriaId, UUID alunoId, UUID id);

    /** Todos os avisos do aluno, do mais antigo ao mais novo (exportação). */
    List<AvisoCompromisso> findByConsultoriaIdAndAlunoIdOrderByCriadoEmAscIdAsc(UUID consultoriaId, UUID alunoId);

    /** Limpeza: avisos vistos antes de {@code limite}. */
    @Modifying
    @Query("delete from AvisoCompromisso a where a.consultoriaId = :consultoriaId and a.vistoEm < :limite")
    int apagarVistosAntes(UUID consultoriaId, Instant limite);

    /** Limpeza: avisos não vistos de compromissos que terminaram antes de {@code limite}. */
    @Modifying
    @Query("delete from AvisoCompromisso a where a.consultoriaId = :consultoriaId and a.vistoEm is null "
            + "and a.compromissoId in (select c.id from Compromisso c where c.consultoriaId = :consultoriaId "
            + "and c.fim < :limite)")
    int apagarNaoVistosDeCompromissosEncerradosAntes(UUID consultoriaId, Instant limite);
}
