package br.com.treinos.api.alunos;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/** Toda consulta já sai filtrada pela consultoria da sessão ({@code @TenantId} em {@link Aluno}). */
public interface AlunoRepository extends JpaRepository<Aluno, UUID> {
}
