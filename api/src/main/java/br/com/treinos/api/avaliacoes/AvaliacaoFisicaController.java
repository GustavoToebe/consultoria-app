package br.com.treinos.api.avaliacoes;

import br.com.treinos.api.avaliacoes.AvaliacaoFisicaDtos.AvaliacaoRequest;
import br.com.treinos.api.avaliacoes.AvaliacaoFisicaDtos.AvaliacaoResponse;
import br.com.treinos.api.security.UsuarioAutenticado;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Avaliação física do aluno, pela equipe. Mesmas permissões do peso ({@code ExecucoesTreinadorController}): ler com
 * {@code ALUNO_SENSIVEL_LER}; gravar, alterar e excluir com ela e {@code ALUNO_SENSIVEL_ALTERAR}. Aluno ou avaliação de
 * outra consultoria = 404.
 */
@RestController
public class AvaliacaoFisicaController {

    private final AvaliacaoFisicaService avaliacoes;

    public AvaliacaoFisicaController(AvaliacaoFisicaService avaliacoes) {
        this.avaliacoes = avaliacoes;
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_SENSIVEL_LER')")
    @GetMapping("/alunos/{alunoId}/avaliacoes-fisicas")
    public List<AvaliacaoResponse> listar(@PathVariable UUID alunoId) {
        return avaliacoes.listar(alunoId);
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_SENSIVEL_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_ALTERAR')")
    @PostMapping("/alunos/{alunoId}/avaliacoes-fisicas")
    public AvaliacaoResponse registrar(@PathVariable UUID alunoId, @RequestBody AvaliacaoRequest request,
                                       @AuthenticationPrincipal UsuarioAutenticado eu) {
        return avaliacoes.registrar(alunoId, request, eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_SENSIVEL_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_ALTERAR')")
    @PutMapping("/avaliacoes-fisicas/{id}")
    public AvaliacaoResponse alterar(@PathVariable UUID id, @RequestBody AvaliacaoRequest request,
                                     @AuthenticationPrincipal UsuarioAutenticado eu) {
        return avaliacoes.alterar(id, request, eu.usuarioId());
    }

    @PreAuthorize("hasAuthority('PERM_ALUNO_SENSIVEL_LER') and hasAuthority('PERM_ALUNO_SENSIVEL_ALTERAR')")
    @DeleteMapping("/avaliacoes-fisicas/{id}")
    public ResponseEntity<Void> excluir(@PathVariable UUID id, @RequestParam(required = false) Long versao) {
        avaliacoes.excluir(id, versao);
        return ResponseEntity.noContent().build();
    }
}
