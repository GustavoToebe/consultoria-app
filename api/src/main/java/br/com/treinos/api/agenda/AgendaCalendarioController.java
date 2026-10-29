package br.com.treinos.api.agenda;

import br.com.treinos.api.agenda.AgendaCalendarioDtos.AgendaRequest;
import br.com.treinos.api.agenda.AgendaCalendarioDtos.AgendaResponse;
import br.com.treinos.api.agenda.AgendaCalendarioDtos.ContagemDaAgenda;
import br.com.treinos.api.agenda.AgendaCalendarioDtos.EventoRequest;
import br.com.treinos.api.agenda.AgendaCalendarioDtos.EventoResponse;
import br.com.treinos.api.agenda.AgendaCalendarioDtos.OcorrenciaDeEvento;
import br.com.treinos.api.agenda.AgendaCalendarioDtos.ResumoDaAgenda;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Calendário do membro da equipe: as agendas pessoais, os eventos sem aluno e o resumo do Ano. Ler com
 * {@code AGENDA_LER}; criar, alterar e apagar com {@code AGENDA_ALTERAR}. Agendas e eventos são só do dono (o que vem da
 * sessão): de outro membro ou de outra consultoria = 404.
 */
@RestController
@RequestMapping("/agenda")
public class AgendaCalendarioController {

    private final AgendaPessoalService agendas;
    private final EventoAgendaService eventos;
    private final ResumoDaAgendaService resumo;

    public AgendaCalendarioController(AgendaPessoalService agendas, EventoAgendaService eventos, ResumoDaAgendaService resumo) {
        this.agendas = agendas;
        this.eventos = eventos;
        this.resumo = resumo;
    }

    // ---- Agendas pessoais ----

    @PreAuthorize("hasAuthority('PERM_AGENDA_LER')")
    @GetMapping("/agendas")
    public List<AgendaResponse> listarAgendas(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return agendas.listar(eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_AGENDA_ALTERAR')")
    @PostMapping("/agendas")
    public AgendaResponse criarAgenda(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestBody @Valid AgendaRequest request) {
        return agendas.criar(eu.usuarioId(), request);
    }

    @PreAuthorize("hasAuthority('PERM_AGENDA_ALTERAR')")
    @PutMapping("/agendas/{id}")
    public AgendaResponse alterarAgenda(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                                        @RequestBody @Valid AgendaRequest request) {
        return agendas.alterar(eu.usuarioId(), id, request);
    }

    /** Quantos eventos a agenda tem: o número da confirmação de apagar (P4). */
    @PreAuthorize("hasAuthority('PERM_AGENDA_LER')")
    @GetMapping("/agendas/{id}/contagem")
    public ContagemDaAgenda contarAgenda(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id) {
        return agendas.contar(eu.usuarioId(), id);
    }

    /** Apaga a agenda e os eventos dela; {@code versao} é a da agenda lida. */
    @PreAuthorize("hasAuthority('PERM_AGENDA_ALTERAR')")
    @DeleteMapping("/agendas/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void apagarAgenda(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
                             @RequestParam Long versao) {
        agendas.apagar(eu.usuarioId(), id, versao);
    }

    // ---- Eventos ----

    /**
     * Ocorrências já expandidas dos meus eventos que tocam os dias [{@code de}, {@code ate}] (até 62 dias; padrão hoje e os
     * 6 seguintes), de todas as minhas agendas ou só das {@code agendas} pedidas.
     */
    @PreAuthorize("hasAuthority('PERM_AGENDA_LER')")
    @GetMapping("/eventos")
    public List<OcorrenciaDeEvento> listarEventos(
            @AuthenticationPrincipal UsuarioAutenticado eu,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
            @RequestParam(required = false) List<UUID> agendas) {
        return eventos.listar(eu.usuarioId(), de, ate, agendas);
    }

    /** O evento (a regra) e a ocorrência de {@code ocorrencia} (padrão: a primeira). */
    @PreAuthorize("hasAuthority('PERM_AGENDA_LER')")
    @GetMapping("/eventos/{id}")
    public EventoResponse detalheDoEvento(
            @AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ocorrencia) {
        return eventos.detalhe(eu.usuarioId(), id, ocorrencia);
    }

    @PreAuthorize("hasAuthority('PERM_AGENDA_ALTERAR')")
    @PostMapping("/eventos")
    public EventoResponse criarEvento(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestBody @Valid EventoRequest request) {
        return eventos.criar(eu.usuarioId(), request);
    }

    /**
     * {@code escopo} (padrão {@code ESTA}) e {@code ocorrencia} (o dia da regra) valem numa série; num evento avulso só
     * {@code ESTA}, que altera o evento todo.
     */
    @PreAuthorize("hasAuthority('PERM_AGENDA_ALTERAR')")
    @PutMapping("/eventos/{id}")
    public EventoResponse alterarEvento(
            @AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id, @RequestBody @Valid EventoRequest request,
            @RequestParam(defaultValue = "ESTA") EscopoDaSerie escopo,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ocorrencia) {
        return eventos.alterar(eu.usuarioId(), id, request, escopo, ocorrencia);
    }

    /** Exclui no mesmo escopo do PUT; {@code versao} é a do evento lido. */
    @PreAuthorize("hasAuthority('PERM_AGENDA_ALTERAR')")
    @DeleteMapping("/eventos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluirEvento(
            @AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id, @RequestParam Long versao,
            @RequestParam(defaultValue = "ESTA") EscopoDaSerie escopo,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ocorrencia) {
        eventos.excluir(eu.usuarioId(), id, versao, escopo, ocorrencia);
    }

    // ---- Resumo do Ano ----

    /**
     * Contagem por dia de compromissos e eventos, até 366 dias, sem texto. {@code responsavel} e {@code situacao} filtram os
     * compromissos como na listagem; {@code agendas} filtra os eventos.
     */
    @PreAuthorize("hasAuthority('PERM_AGENDA_LER')")
    @GetMapping("/resumo")
    public ResumoDaAgenda resumo(
            @AuthenticationPrincipal UsuarioAutenticado eu,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
            @RequestParam(required = false) UUID responsavel,
            @RequestParam(required = false) List<String> situacao,
            @RequestParam(required = false) List<UUID> agendas) {
        return resumo.resumir(eu.usuarioId(), de, ate, responsavel, situacao, agendas);
    }
}
