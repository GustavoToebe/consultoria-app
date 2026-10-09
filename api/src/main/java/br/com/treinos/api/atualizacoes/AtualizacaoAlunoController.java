package br.com.treinos.api.atualizacoes;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
public class AtualizacaoAlunoController {
    private final AtualizacaoService atualizacoes;
    public AtualizacaoAlunoController(AtualizacaoService atualizacoes) { this.atualizacoes = atualizacoes; }
    @PreAuthorize("hasRole('ALUNO')") @GetMapping("/aluno/atualizacao")
    public AtualizacaoService.Detalhe atual(@AuthenticationPrincipal UsuarioAutenticado eu) { return atualizacoes.atual(eu); }
    @PreAuthorize("hasRole('ALUNO')") @PostMapping("/aluno/atualizacao/enviar")
    public AtualizacaoService.Detalhe enviar(@AuthenticationPrincipal UsuarioAutenticado eu, @Valid @RequestBody AtualizacaoService.EnviarRequest r) { return atualizacoes.enviar(eu,r); }
    @PreAuthorize("hasRole('ALUNO')") @PostMapping("/aluno/atualizacao/atraso")
    public AtualizacaoService.Detalhe atraso(@AuthenticationPrincipal UsuarioAutenticado eu, @Valid @RequestBody AtualizacaoService.AtrasoRequest r) { return atualizacoes.avisarAtraso(eu,r); }
    @PreAuthorize("hasRole('ALUNO')") @GetMapping("/aluno/atualizacoes")
    public List<AtualizacaoService.Detalhe> historico(@AuthenticationPrincipal UsuarioAutenticado eu) { return atualizacoes.historico(eu); }
    @PreAuthorize("hasRole('ALUNO')") @GetMapping("/aluno/atualizacoes/{id}")
    public AtualizacaoService.Detalhe detalhe(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id) { return atualizacoes.detalheAluno(eu,id); }
    @PreAuthorize("hasRole('ALUNO')") @PostMapping("/aluno/atualizacoes/{id}/feedback-visto")
    public ResponseEntity<Void> visto(@AuthenticationPrincipal UsuarioAutenticado eu, @PathVariable UUID id) { atualizacoes.feedbackVisto(eu,id); return ResponseEntity.noContent().build(); }
}
