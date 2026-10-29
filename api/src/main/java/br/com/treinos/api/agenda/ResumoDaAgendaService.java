package br.com.treinos.api.agenda;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.agenda.AgendaCalendarioDtos.DiaDoResumo;
import br.com.treinos.api.agenda.AgendaCalendarioDtos.ResumoDaAgenda;
import br.com.treinos.api.web.Fuso;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;

/**
 * Resumo do Ano (D15): contagem por dia dos compromissos com aluno e dos eventos do dono, até {@value #JANELA_MAXIMA_DIAS}
 * dias, sem título, nome nem observação. Os compromissos seguem o mesmo filtro da listagem ({@code responsavel} e
 * {@code situacao}); sem {@code situacao}, os cancelados não contam. Os eventos são só os do próprio dono e seguem o filtro
 * de agendas. Um compromisso ou evento que atravessa a meia-noite conta em cada dia que toca.
 */
@Service
public class ResumoDaAgendaService {

    /** Maior período do resumo, em dias (inclusive as pontas): um ano bissexto. */
    static final int JANELA_MAXIMA_DIAS = 366;

    private final CompromissoRepository compromissos;
    private final EventoAgendaService eventos;

    public ResumoDaAgendaService(CompromissoRepository compromissos, EventoAgendaService eventos) {
        this.compromissos = compromissos;
        this.eventos = eventos;
    }

    @Transactional(readOnly = true)
    public ResumoDaAgenda resumir(UUID dono, LocalDate de, LocalDate ate, UUID responsavel, Collection<String> situacoes,
                                  Collection<UUID> agendas) {
        if (ate.isBefore(de)) {
            throw new BadRequestException("A data final vem antes da inicial.", "PERIODO_INVALIDO");
        }
        if (ChronoUnit.DAYS.between(de, ate) + 1 > JANELA_MAXIMA_DIAS) {
            throw new BadRequestException("Escolha um período de até " + JANELA_MAXIMA_DIAS + " dias.", "PERIODO_INVALIDO");
        }
        Map<LocalDate, int[]> dias = new TreeMap<>();
        Set<SituacaoCompromisso> situacao = situacoes == null || situacoes.stream().allMatch(s -> s == null || s.isBlank())
                ? EnumSet.complementOf(EnumSet.of(SituacaoCompromisso.CANCELADO))
                : AgendaService.filtro(situacoes);
        for (Object[] h : compromissos.horariosDoPeriodo(de.atStartOfDay(Fuso.BRASILIA).toInstant(),
                ate.plusDays(1).atStartOfDay(Fuso.BRASILIA).toInstant(), responsavel, situacao)) {
            LocalDate primeiro = AgendaService.data((Instant) h[0]);
            LocalDate ultimo = AgendaService.data(((Instant) h[1]).minusNanos(1));
            for (LocalDate d = primeiro; !d.isAfter(ultimo); d = d.plusDays(1)) {
                if (!d.isBefore(de) && !d.isAfter(ate)) {
                    dias.computeIfAbsent(d, k -> new int[2])[0]++;
                }
            }
        }
        eventos.contagemPorDia(dono, de, ate, agendas).forEach((d, n) -> dias.computeIfAbsent(d, k -> new int[2])[1] = n);
        return new ResumoDaAgenda(dias.entrySet().stream()
                .map(e -> new DiaDoResumo(e.getKey(), e.getValue()[0], e.getValue()[1])).toList());
    }
}
