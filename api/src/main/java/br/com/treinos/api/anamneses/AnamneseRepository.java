package br.com.treinos.api.anamneses;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** JPQL e métodos derivados: o {@code @TenantId} vale em todos (anamnese de outra consultoria não aparece). */
public interface AnamneseRepository extends JpaRepository<Anamnese, UUID> {

    List<Anamnese> findByAlunoIdOrderByAtribuidaEmDesc(UUID alunoId);

    boolean existsByAlunoIdAndSituacao(UUID alunoId, Anamnese.Situacao situacao);

    /** Trava a linha: envio repetido (clique duplo) e dispensa ao mesmo tempo esperam em fila. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Anamnese a where a.id = :id")
    Optional<Anamnese> buscarParaAlterar(UUID id);

    /** Versões que o aluno responde ou respondeu (para conferir as imagens que ele pode ver). */
    @Query("select a.questionarioVersaoId from Anamnese a where a.alunoId = :alunoId")
    List<UUID> versoesDoAluno(UUID alunoId);
}
