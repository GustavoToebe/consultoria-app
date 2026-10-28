package br.com.treinos.api.sessoesconcluidas;

import br.com.treinos.api.retorno.ExigeRetorno;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluidaDtos.SessoesConcluidasResponse;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluidaDtos.Visto;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Sessões que um aluno concluiu, vistas pelo treinador, e o "Visto" (Engajamento 0.5, {@code REGISTRO_REAGIR}). Aluno de
 * outra consultoria = 404. O comentário do aluno é dado sensível e vem nulo sem {@code ALUNO_SENSIVEL_LER}.
 */
@ExigeRetorno
@RestController
@RequestMapping("/alunos/{alunoId}/sessoes-concluidas")
public class SessoesConcluidasTreinadorController {

    private final SessaoConcluidaService sessoes;

    public SessoesConcluidasTreinadorController(SessaoConcluidaService sessoes) {
        this.sessoes = sessoes;
    }

    @PreAuthorize("hasAuthority('PERM_REGISTRO_LER')")
    @GetMapping
    public SessoesConcluidasResponse sessoes(@PathVariable UUID alunoId,
                                             @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
                                             @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return sessoes.doAluno(alunoId, de, ate);
    }

    /** Marca "Visto" (idempotente). O {@code id} é o da sessão concluída na lista. */
    @PreAuthorize("hasAuthority('PERM_REGISTRO_REAGIR')")
    @PutMapping("/{id}/visto")
    public Visto marcarVisto(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID alunoId, @PathVariable UUID id) {
        return sessoes.marcarVisto(alunoId, id, eu.usuarioId());
    }

    /** Desfaz o "Visto". */
    @PreAuthorize("hasAuthority('PERM_REGISTRO_REAGIR')")
    @DeleteMapping("/{id}/visto")
    public ResponseEntity<Void> desmarcarVisto(@PathVariable UUID alunoId, @PathVariable UUID id) {
        sessoes.desmarcarVisto(alunoId, id);
        return ResponseEntity.noContent().build();
    }
}
