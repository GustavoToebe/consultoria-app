package br.com.treinos.api.agenda;

import br.com.treinos.api.agenda.AgendaDtos.CompromissoRequest;
import br.com.treinos.api.agenda.AgendaDtos.CompromissoResponse;
import br.com.treinos.api.agenda.AgendaDtos.SituacaoRequest;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Agenda presencial da consultoria da sessão. Ler com {@code AGENDA_LER}; marcar, remarcar e mudar a situação com
 * {@code AGENDA_ALTERAR}. Compromisso de outra consultoria = 404.
 */
@RestController
@RequestMapping("/agenda/compromissos")
public class AgendaController {

    private final AgendaService agenda;

    public AgendaController(AgendaService agenda) {
        this.agenda = agenda;
    }

    /** {@code de}/{@code ate}: dias de Brasília (até 62); {@code situacao} pode repetir; {@code responsavel}: um membro. */
    @PreAuthorize("hasAuthority('PERM_AGENDA_LER')")
    @GetMapping
    public List<CompromissoResponse> listar(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
            @RequestParam(required = false) UUID responsavel,
            @RequestParam(required = false) List<String> situacao) {
        return agenda.listar(de, ate, responsavel, situacao);
    }

    @PreAuthorize("hasAuthority('PERM_AGENDA_LER')")
    @GetMapping("/{id}")
    public CompromissoResponse detalhe(@PathVariable UUID id) {
        return agenda.detalhe(id);
    }

    @PreAuthorize("hasAuthority('PERM_AGENDA_ALTERAR')")
    @PostMapping
    public CompromissoResponse criar(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestBody @Valid CompromissoRequest request) {
        return agenda.criar(request, eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_AGENDA_ALTERAR')")
    @PutMapping("/{id}")
    public CompromissoResponse alterar(@PathVariable UUID id, @RequestBody @Valid CompromissoRequest request) {
        return agenda.alterar(id, request);
    }

    @PreAuthorize("hasAuthority('PERM_AGENDA_ALTERAR')")
    @PostMapping("/{id}/situacao")
    public CompromissoResponse situacao(@PathVariable UUID id, @RequestBody @Valid SituacaoRequest request) {
        return agenda.alterarSituacao(id, request.situacao(), request.versao());
    }
}
