package br.com.treinos.api.agenda;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Eventos sem aluno. Leitura filtrada pelo {@code @TenantId}; toda busca leva também o dono (a sessão): evento de outro
 * membro ou de outra consultoria nunca aparece (404 no serviço). Só JPQL: nenhuma consulta nativa.
 */
public interface EventoAgendaRepository extends JpaRepository<EventoAgenda, UUID> {

    Optional<EventoAgenda> findByIdAndDonoId(UUID id, UUID donoId);

    long countByDonoId(UUID donoId);

    long countByDonoIdAndAgendaId(UUID donoId, UUID agendaId);

    /**
     * Os eventos do dono que podem ter ocorrência em [{@code de}, {@code ate}]: o avulso dentro do período, a série que
     * já começou e ainda não acabou, e qualquer evento com uma ocorrência MOVIDA para dentro do período (inclusive a
     * série que já acabou). O {@code de}/{@code ate} são os dias da regra; o corte fino por horário é de quem chama.
     * {@code todas} = sem filtro de agenda (então {@code agendas} só precisa ser uma lista não vazia).
     */
    @Query("select e from EventoAgenda e where e.donoId = :donoId and (:todas = true or e.agendaId in :agendas) "
            + "and ((e.dataInicio <= :ate and ((e.recorrencia = br.com.treinos.api.agenda.TipoDeRecorrencia.NENHUMA "
            + "and e.dataInicio >= :de) or (e.recorrencia <> br.com.treinos.api.agenda.TipoDeRecorrencia.NENHUMA "
            + "and (e.repeteAte is null or e.repeteAte >= :de)))) "
            + "or e.id in (select x.eventoId from ExcecaoDeEvento x where x.dataNova between :de and :ate)) "
            + "order by e.dataInicio, e.id")
    List<EventoAgenda> candidatosDoPeriodo(UUID donoId, boolean todas, Collection<UUID> agendas, LocalDate de, LocalDate ate);
}
