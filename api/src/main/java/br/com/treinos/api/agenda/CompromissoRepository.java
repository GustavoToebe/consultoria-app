package br.com.treinos.api.agenda;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Toda leitura sai filtrada pela consultoria da sessão ({@code @TenantId} em {@link Compromisso} e em
 * {@link CompromissoAluno}). As consultas que juntam as duas tabelas levam a consultoria explícita, sem depender só do
 * filtro do tenant. A remoção por aluno (anonimização, "Excluir minha conta") está em {@link AgendaService#apagarDoAluno}.
 */
public interface CompromissoRepository extends JpaRepository<Compromisso, UUID> {

    /**
     * Compromissos que tocam o período [{@code de}, {@code ate}) (sobreposição, não só o início: o das 23:30 de 60 minutos
     * aparece também no dia seguinte), com o responsável pedido e algum participante numa das situações pedidas.
     */
    @Query("select c from Compromisso c where c.inicio < :ate and c.fim > :de "
            + "and (:responsavelId is null or c.responsavelId = :responsavelId) "
            + "and exists (select 1 from CompromissoAluno ca where ca.consultoriaId = c.consultoriaId "
            + "and ca.compromissoId = c.id and ca.situacao in :situacoes) "
            + "order by c.inicio, c.id")
    List<Compromisso> doPeriodo(Instant de, Instant ate, UUID responsavelId, Collection<SituacaoCompromisso> situacoes);

    /**
     * Quantos compromissos não cancelados do responsável se sobrepõem a [{@code inicio}, {@code fim}), menos o
     * {@code ignorar} (o próprio, ao remarcar). Encostar (um termina às 10:00, o outro começa às 10:00) não é conflito.
     */
    @Query("select count(c) from Compromisso c where c.responsavelId = :responsavelId and c.cancelado = false "
            + "and c.inicio < :fim and c.fim > :inicio and (:ignorar is null or c.id <> :ignorar)")
    long sobrepostos(UUID responsavelId, Instant inicio, Instant fim, UUID ignorar);

    /**
     * Os próximos do aluno (ainda não terminados) em que a situação DELE é uma das pedidas: cada linha é
     * {@code [Compromisso, SituacaoCompromisso do aluno]}.
     */
    @Query("select c, ca.situacao from Compromisso c join CompromissoAluno ca on ca.compromissoId = c.id "
            + "where c.consultoriaId = :consultoriaId and ca.consultoriaId = :consultoriaId and ca.alunoId = :alunoId "
            + "and c.fim > :agora and ca.situacao in :situacoes order by c.inicio, c.id")
    List<Object[]> proximosDoAluno(UUID consultoriaId, UUID alunoId, Instant agora, Collection<SituacaoCompromisso> situacoes);

    /** Todos os compromissos do aluno (exportação): cada linha é {@code [Compromisso, SituacaoCompromisso do aluno]}. */
    @Query("select c, ca.situacao from Compromisso c join CompromissoAluno ca on ca.compromissoId = c.id "
            + "where c.consultoriaId = :consultoriaId and ca.consultoriaId = :consultoriaId and ca.alunoId = :alunoId "
            + "order by c.inicio, c.id")
    List<Object[]> doAluno(UUID consultoriaId, UUID alunoId);

    /**
     * Dos {@code alunoIds}, os que têm outro compromisso não cancelado que se sobrepõe a [{@code inicio}, {@code fim}) e em
     * que eles mesmos não estão cancelados, menos o {@code ignorar}. Só o id do aluno: nada do outro compromisso.
     */
    @Query("select distinct ca.alunoId from CompromissoAluno ca join Compromisso c on c.id = ca.compromissoId "
            + "where c.consultoriaId = :consultoriaId and ca.consultoriaId = :consultoriaId and ca.alunoId in :alunoIds "
            + "and c.cancelado = false and ca.situacao <> br.com.treinos.api.agenda.SituacaoCompromisso.CANCELADO "
            + "and c.inicio < :fim and c.fim > :inicio and (:ignorar is null or c.id <> :ignorar)")
    List<UUID> alunosOcupados(UUID consultoriaId, Collection<UUID> alunoIds, Instant inicio, Instant fim, UUID ignorar);
}
