package br.com.treinos.api.lesoes;

import br.com.treinos.api.lesoes.LesaoDtos.LesaoRequest;
import br.com.treinos.api.lesoes.LesaoDtos.LesaoResponse;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Histórico de lesões do aluno, só para o treinador da consultoria. */
@RestController
public class LesaoController {

    private final LesaoService lesoes;

    public LesaoController(LesaoService lesoes) {
        this.lesoes = lesoes;
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_SENSIVEL_LER')")
    @GetMapping("/alunos/{alunoId}/lesoes")
    public List<LesaoResponse> listar(@PathVariable UUID alunoId) {
        return lesoes.listar(alunoId);
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_SENSIVEL_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_ALTERAR')")
    @PostMapping("/alunos/{alunoId}/lesoes")
    public LesaoResponse criar(@PathVariable UUID alunoId, @RequestBody @Valid LesaoRequest request,
                               @AuthenticationPrincipal UsuarioAutenticado eu) {
        return lesoes.criar(alunoId, request, eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_SENSIVEL_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_ALTERAR')")
    @PutMapping("/alunos/{alunoId}/lesoes/{id}")
    public LesaoResponse alterar(@PathVariable UUID alunoId, @PathVariable UUID id,
                                 @RequestBody @Valid LesaoRequest request) {
        return lesoes.alterar(alunoId, id, request);
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_SENSIVEL_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_ALTERAR')")
    @DeleteMapping("/alunos/{alunoId}/lesoes/{id}")
    public ResponseEntity<Void> excluir(@PathVariable UUID alunoId, @PathVariable UUID id) {
        lesoes.excluir(alunoId, id);
        return ResponseEntity.noContent().build();
    }
}
