package br.com.treinos.api.tags;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** Filtrado pela consultoria da sessão ({@code @TenantId}); as escritas em lote levam a consultoria explícita. */
public interface AlunoTagRepository extends JpaRepository<AlunoTag, AlunoTag.Chave> {

    /** Uma linha por tag do aluno, já com nome e cor, em ordem de nome: a ficha e a lista leem por aqui (em lote, sem N+1). */
    @Query("select new br.com.treinos.api.tags.TagDoAlunoLinha(l.alunoId, t.id, t.nome, t.cor) "
            + "from AlunoTag l join TagAluno t on t.id = l.tagId where l.alunoId in :alunoIds order by t.nomeNormalizado, t.id")
    List<TagDoAlunoLinha> linhasDosAlunos(Collection<UUID> alunoIds);

    @Query("select l.tagId from AlunoTag l where l.alunoId = :alunoId")
    List<UUID> tagIdsDoAluno(UUID alunoId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from AlunoTag l where l.consultoriaId = :consultoriaId and l.alunoId = :alunoId and l.tagId in :tagIds")
    int apagar(UUID consultoriaId, UUID alunoId, Collection<UUID> tagIds);

    /** Alunos por tag na consultoria da sessão (inclui inativos; anonimizado não tem ligação). */
    interface Contagem {
        UUID getTagId();
        long getAlunos();
    }

    @Query("select l.tagId as tagId, count(l) as alunos from AlunoTag l group by l.tagId")
    List<Contagem> contagens();

    @Query("select count(l) from AlunoTag l where l.tagId = :tagId")
    long contarDaTag(UUID tagId);
}
