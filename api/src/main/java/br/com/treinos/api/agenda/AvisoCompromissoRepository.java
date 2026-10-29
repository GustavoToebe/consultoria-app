package br.com.treinos.api.agenda;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.UUID;

/** Mínimo do passo 1 (V042): a geração e as rotas do aluno entram no passo 3. O delete leva a consultoria explícita. */
public interface AvisoCompromissoRepository extends JpaRepository<AvisoCompromisso, UUID> {

    /** Anonimização e "Excluir minha conta": saem os avisos do aluno. */
    @Modifying
    @Query("delete from AvisoCompromisso a where a.consultoriaId = :consultoriaId and a.alunoId = :alunoId")
    int apagarDoAluno(UUID consultoriaId, UUID alunoId);
}
