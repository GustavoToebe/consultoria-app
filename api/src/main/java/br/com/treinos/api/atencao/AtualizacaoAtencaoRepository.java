package br.com.treinos.api.atencao;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** JPQL: o {@code @TenantId} recorta pela consultoria da sessão. */
public interface AtualizacaoAtencaoRepository extends JpaRepository<AtualizacaoAtencao, UUID> {

    @Query("select a from AtualizacaoAtencao a where a.atualizacaoId in :ids order by a.atualizacaoId, a.tipo, a.perguntaId")
    List<AtualizacaoAtencao> dasAtualizacoes(Collection<UUID> ids);

    /** Quantos pontos tem cada atualização (a lista do treinador, sem N+1); atualização sem ponto não aparece. */
    @Query("select a.atualizacaoId as atualizacaoId, count(a) as pontos from AtualizacaoAtencao a "
            + "where a.atualizacaoId in :ids group by a.atualizacaoId")
    List<Contagem> contagens(Collection<UUID> ids);

    /**
     * Anonimizar e "Excluir minha conta" (LGPD): a linha da atualização fica, então o cascade nunca roda. Consultoria explícita,
     * além do {@code @TenantId}, no delete em massa e no subselect.
     */
    @Modifying
    @Query("delete from AtualizacaoAtencao a where a.consultoriaId = :consultoriaId and a.atualizacaoId in "
            + "(select x.id from Atualizacao x where x.consultoriaId = :consultoriaId and x.alunoId = :alunoId)")
    int apagarDoAluno(UUID consultoriaId, UUID alunoId);

    interface Contagem {
        UUID getAtualizacaoId();

        long getPontos();
    }
}
