package br.com.treinos.api.termos;

import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Termo de uso e aviso de privacidade: rotas de qualquer usuário logado (treinador ou aluno), como o {@code /eu}. */
@RestController
@RequestMapping("/termos")
public class TermosController {

    public record AceiteRequest(@NotBlank String versao) { }

    private final TermosService termos;

    public TermosController(TermosService termos) {
        this.termos = termos;
    }

    @PreAuthorize("hasAnyRole('TREINADOR', 'ALUNO')")
    @GetMapping
    public TermosService.Resposta consultar(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return termos.consultar(eu.usuarioId());
    }

    @PreAuthorize("hasAnyRole('TREINADOR', 'ALUNO')")
    @PostMapping("/aceite")
    public TermosService.Resposta aceitar(@AuthenticationPrincipal UsuarioAutenticado eu,
                                          @RequestBody @Valid AceiteRequest request) {
        return termos.aceitar(eu.usuarioId(), request.versao());
    }
}
