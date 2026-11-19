package br.com.treinos.api.pagamentos;

import br.com.treinos.api.alunos.Aluno;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

import java.util.List;
import java.util.UUID;

/**
 * A busca do aluno pelo e-mail da compra na Kiwify. Só ids (a entidade entra na sessão já travada, por {@link Travas}) e só
 * leitura; sai filtrada pela consultoria ({@code @TenantId}). O e-mail do aluno é o do cadastro ({@code aluno.email}) e, sem
 * ele, o de login do {@code Usuario}; a comparação é sem diferença de caixa. Aluno inativo ou anonimizado nunca casa.
 */
interface KiwifyBuscas extends Repository<Aluno, UUID> {

    /** Quem tem este e-mail (já em minúsculas); a conciliação pede 2 para saber se há mais de um. */
    @Query("select a.id from Aluno a left join Usuario u on u.id = a.usuarioId "
            + "where a.ativo = true and a.anonimizadoEm is null "
            + "and lower(coalesce(nullif(trim(a.email), ''), u.email)) = :email order by a.id")
    List<UUID> alunosAtivosDoEmail(String email, Pageable limite);
}
