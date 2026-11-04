package br.com.treinos.api.push;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

/** Só leitura (exportação). Gravar e apagar: {@link PushRepositorio}. */
interface PushTokenRepository extends JpaRepository<PushToken, UUID> {

    /** Os aparelhos do usuário do aluno (o aluno sem acesso não tem nenhum). */
    @Query("select t from PushToken t where t.consultoriaId = :consultoriaId and t.usuarioId = "
            + "(select a.usuarioId from Aluno a where a.consultoriaId = :consultoriaId and a.id = :alunoId) order by t.criadoEm, t.id")
    List<PushToken> doAluno(UUID consultoriaId, UUID alunoId);
}
