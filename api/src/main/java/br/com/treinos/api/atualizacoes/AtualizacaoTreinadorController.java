package br.com.treinos.api.atualizacoes;

import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
public class AtualizacaoTreinadorController {
    private final AtualizacaoService atualizacoes;
    public AtualizacaoTreinadorController(AtualizacaoService atualizacoes) { this.atualizacoes = atualizacoes; }

    @PreAuthorize("hasRole('TREINADOR')") @GetMapping("/atualizacoes")
    public List<AtualizacaoService.Detalhe> listar(@RequestParam(defaultValue = "PARA_REVISAR") String situacao) {
        return atualizacoes.listar(situacao);
    }
    @PreAuthorize("hasRole('TREINADOR')") @GetMapping("/alunos/{alunoId}/atualizacoes")
    public List<AtualizacaoService.Detalhe> doAluno(@PathVariable UUID alunoId) { return atualizacoes.doAluno(alunoId); }

    @PreAuthorize("hasRole('TREINADOR')") @GetMapping("/alunos/{alunoId}/atualizacao")
    public AtualizacaoService.Detalhe atualDoAluno(@PathVariable UUID alunoId) { return atualizacoes.atualDoAluno(alunoId); }

    @PreAuthorize("hasRole('TREINADOR')") @GetMapping("/atualizacoes/{id}")
    public AtualizacaoService.Detalhe detalhe(@PathVariable UUID id) { return atualizacoes.detalheTreinador(id); }

    @PreAuthorize("hasRole('TREINADOR')") @PutMapping("/atualizacoes/{id}/feedback")
    public AtualizacaoService.Detalhe responder(@PathVariable UUID id,
            @Valid @RequestBody AtualizacaoService.FeedbackRequest r,
            @AuthenticationPrincipal UsuarioAutenticado eu) {
        return atualizacoes.responder(id,r,eu.usuarioId());
    }
}
