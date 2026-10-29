package br.com.treinos.api.agenda;

import br.com.treinos.api.agenda.AgendaDtos.AlunoOcupado;
import br.com.treinos.api.agenda.AgendaDtos.CancelamentoRequest;
import br.com.treinos.api.agenda.AgendaDtos.CompromissoRequest;
import br.com.treinos.api.agenda.AgendaDtos.CompromissoResponse;
import br.com.treinos.api.agenda.AgendaDtos.SituacaoDoAlunoRequest;
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
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/**
 * Agenda presencial da consultoria da sessão. Ler com {@code AGENDA_LER}; marcar, remarcar, cancelar e mudar a situação de
 * um aluno com {@code AGENDA_ALTERAR}. Compromisso, aluno ou responsável de outra consultoria = 404.
 */
@RestController
@RequestMapping("/agenda/compromissos")
public class AgendaController {

    private final AgendaService agenda;

    public AgendaController(AgendaService agenda) {
        this.agenda = agenda;
    }

    /**
     * {@code de}/{@code ate}: dias de Brasília (até 62); {@code situacao} pode repetir (compromissos em que algum aluno está
     * nela); {@code responsavel}: um membro.
     */
    @PreAuthorize("hasAuthority('PERM_AGENDA_LER')")
    @GetMapping
    public List<CompromissoResponse> listar(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
            @RequestParam(required = false) UUID responsavel,
            @RequestParam(required = false) List<String> situacao) {
        return agenda.listar(de, ate, responsavel, situacao);
    }

    /**
     * Quais dos alunos já têm outro compromisso que sobrepõe o horário (só aviso, não bloqueia). {@code ignorar}: o próprio
     * compromisso, ao remarcar. Devolve só id e nome.
     */
    @PreAuthorize("hasAuthority('PERM_AGENDA_LER')")
    @GetMapping("/alunos-ocupados")
    public List<AlunoOcupado> alunosOcupados(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate data,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime hora,
            @RequestParam int duracaoMinutos,
            @RequestParam List<UUID> alunoIds,
            @RequestParam(required = false) UUID ignorar) {
        return agenda.alunosOcupados(data, hora, duracaoMinutos, alunoIds, ignorar);
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

    /** Cancelar o compromisso inteiro ou reabri-lo ({@code {cancelado, versao}}). */
    @PreAuthorize("hasAuthority('PERM_AGENDA_ALTERAR')")
    @PostMapping("/{id}/situacao")
    public CompromissoResponse situacao(@PathVariable UUID id, @RequestBody @Valid CancelamentoRequest request) {
        return agenda.alterarCancelamento(id, request.cancelado(), request.versao());
    }

    /** A situação de um aluno no compromisso ({@code {situacao, versao}}). */
    @PreAuthorize("hasAuthority('PERM_AGENDA_ALTERAR')")
    @PostMapping("/{id}/alunos/{alunoId}/situacao")
    public CompromissoResponse situacaoDoAluno(@PathVariable UUID id, @PathVariable UUID alunoId,
                                               @RequestBody @Valid SituacaoDoAlunoRequest request) {
        return agenda.alterarSituacaoDoAluno(id, alunoId, request.situacao(), request.versao());
    }
}
