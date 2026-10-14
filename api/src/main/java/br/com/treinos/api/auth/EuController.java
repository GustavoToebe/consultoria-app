package br.com.treinos.api.auth;

import br.com.treinos.api.auth.dto.EuResponse;
import br.com.treinos.api.auth.dto.LoginResponse;
import br.com.treinos.api.auth.dto.TrocaSenhaRequest;
import br.com.treinos.api.security.DestinoCliente;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Rotas de qualquer usuário logado. */
@RestController
@RequestMapping("/eu")
public class EuController {

    private final AuthService authService;
    private final SessaoHttp sessaoHttp;
    private final br.com.treinos.api.equipe.EquipeService equipe;

    public EuController(AuthService authService, SessaoHttp sessaoHttp,br.com.treinos.api.equipe.EquipeService equipe) {
        this.equipe=equipe;
        this.authService = authService;
        this.sessaoHttp = sessaoHttp;
    }

    @PreAuthorize("hasAnyRole('TREINADOR', 'ALUNO')")
    @GetMapping
    public EuResponse eu(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return authService.eu(eu);
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @PutMapping
    public EuResponse alterar(@AuthenticationPrincipal UsuarioAutenticado eu,
                             @RequestBody @Valid br.com.treinos.api.equipe.EquipeDtos.MeuPerfilRequest r) {
        equipe.meuPerfil(eu.usuarioId(),r);return authService.eu(eu);
    }

    @PreAuthorize("hasAnyRole('TREINADOR', 'ALUNO')")
    @PutMapping("/senha")
    public LoginResponse trocarSenha(@AuthenticationPrincipal UsuarioAutenticado eu,
                                     @RequestBody @Valid TrocaSenhaRequest request,
                                     HttpServletRequest http, HttpServletResponse resposta) {
        DestinoCliente cliente = DestinoCliente.de(http);
        AuthService.Sessao sessao = authService.trocarSenha(eu, request.senhaAtual(), request.senhaNova(), http.getRemoteAddr());
        return sessaoHttp.responder(sessao, cliente, resposta);
    }
}
