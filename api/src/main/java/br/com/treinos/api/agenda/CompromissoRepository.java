package br.com.treinos.api.agenda;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Toda leitura sai filtrada pela consultoria da sessão ({@code @TenantId} em {@link Compromisso}). O {@code delete} em
 * lote leva a consultoria explícita, sem depender do filtro do tenant.
 */
public interface CompromissoRepository extends JpaRepository<Compromisso, UUID> {

    /**
     * Compromissos que tocam o período [{@code de}, {@code ate}) (sobreposição, não só o início: o das 23:30 de 60 minutos
     * aparece também no dia seguinte), com o responsável e as situações pedidos.
     */
    @Query("select c from Compromisso c where c.inicio < :ate and c.fim > :de "
            + "and (:responsavelId is null or c.responsavelId = :responsavelId) and c.situacao in :situacoes "
            + "order by c.inicio, c.id")
    List<Compromisso> doPeriodo(Instant de, Instant ate, UUID responsavelId, Collection<SituacaoCompromisso> situacoes);

    /**
     * Quantos compromissos não cancelados do responsável se sobrepõem a [{@code inicio}, {@code fim}), menos o
     * {@code ignorar} (o próprio, ao remarcar). Encostar (um termina às 10:00, o outro começa às 10:00) não é conflito.
     */
    @Query("select count(c) from Compromisso c where c.responsavelId = :responsavelId "
            + "and c.situacao <> br.com.treinos.api.agenda.SituacaoCompromisso.CANCELADO "
            + "and c.inicio < :fim and c.fim > :inicio and (:ignorar is null or c.id <> :ignorar)")
    long sobrepostos(UUID responsavelId, Instant inicio, Instant fim, UUID ignorar);

    /** Os próximos do aluno (ainda não terminados), nas situações pedidas. */
    @Query("select c from Compromisso c where c.alunoId = :alunoId and c.fim > :agora and c.situacao in :situacoes "
            + "order by c.inicio, c.id")
    List<Compromisso> proximosDoAluno(UUID alunoId, Instant agora, Collection<SituacaoCompromisso> situacoes);

    List<Compromisso> findByAlunoIdOrderByInicioAsc(UUID alunoId);

    /** Anonimização e "Excluir minha conta": saem todos os compromissos do aluno. */
    @Modifying
    @Query("delete from Compromisso c where c.consultoriaId = :consultoriaId and c.alunoId = :alunoId")
    int apagarDoAluno(UUID consultoriaId, UUID alunoId);
}
