package br.com.treinos.api.agenda;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** Participantes dos compromissos. Leitura filtrada pelo {@code @TenantId}; o que apaga em lote leva a consultoria explícita. */
public interface CompromissoAlunoRepository extends JpaRepository<CompromissoAluno, UUID> {

    List<CompromissoAluno> findByCompromissoId(UUID compromissoId);

    List<CompromissoAluno> findByCompromissoIdIn(Collection<UUID> compromissoIds);

    /** As participações do aluno (anonimização e "Excluir minha conta"). */
    List<CompromissoAluno> findByConsultoriaIdAndAlunoId(UUID consultoriaId, UUID alunoId);

    /** Quantos participantes cada compromisso tem: cada linha é {@code [compromissoId, quantidade]}. */
    @Query("select ca.compromissoId, count(ca) from CompromissoAluno ca where ca.consultoriaId = :consultoriaId "
            + "and ca.compromissoId in :compromissoIds group by ca.compromissoId")
    List<Object[]> contarPorCompromisso(UUID consultoriaId, Collection<UUID> compromissoIds);

    @Modifying
    @Query("delete from CompromissoAluno ca where ca.consultoriaId = :consultoriaId and ca.alunoId = :alunoId")
    int apagarDoAluno(UUID consultoriaId, UUID alunoId);
}
