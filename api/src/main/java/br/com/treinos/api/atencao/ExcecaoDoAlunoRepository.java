package br.com.treinos.api.atencao;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** JPQL: o {@code @TenantId} recorta pela consultoria da sessão. */
public interface ExcecaoDoAlunoRepository extends JpaRepository<ExcecaoDoAluno, UUID> {

    List<ExcecaoDoAluno> findByAlunoId(UUID alunoId);

    Optional<ExcecaoDoAluno> findByAlunoIdAndRegraId(UUID alunoId, UUID regraId);

    /** "N alunos com exceção" por regra (só a contagem); regra sem exceção não aparece. */
    @Query("select e.regraId as regraId, count(e) as alunos from ExcecaoDoAluno e group by e.regraId")
    List<Contagem> contagens();

    /** Anonimizar e "Excluir minha conta": a linha do aluno fica, então o cascade nunca roda. Consultoria explícita no delete em massa. */
    @Modifying
    @Query("delete from ExcecaoDoAluno e where e.consultoriaId = :consultoriaId and e.alunoId = :alunoId")
    int apagarDoAluno(UUID consultoriaId, UUID alunoId);

    interface Contagem {
        UUID getRegraId();

        long getAlunos();
    }
}
