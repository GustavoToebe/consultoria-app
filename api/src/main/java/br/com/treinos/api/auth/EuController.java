package br.com.treinos.api.auth;

import br.com.treinos.api.auth.dto.EuResponse;
import br.com.treinos.api.auth.dto.LoginResponse;
import br.com.treinos.api.auth.dto.TrocaSenhaRequest;
import br.com.treinos.api.push.ExigePush;
import br.com.treinos.api.push.PushDtos;
import br.com.treinos.api.push.PushService;
import br.com.treinos.api.security.DestinoCliente;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import br.com.plataforma.comum.seguranca.login.LimiteLoginException;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
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
    private final PushService push;

    public EuController(AuthService authService, SessaoHttp sessaoHttp,br.com.treinos.api.equipe.EquipeService equipe, PushService push) {
        this.equipe=equipe;
        this.push = push;
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
        resposta.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        try {
            authService.limitarTrocaDeSenha(eu.usuarioId(), http.getRemoteAddr());
        } catch (LimiteLoginException bloqueado) {
            resposta.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(bloqueado.segundos()));
            throw bloqueado;
        }
        AuthService.Sessao sessao = authService.trocarSenha(eu, request.senhaAtual(), request.senhaNova(), http.getRemoteAddr());
        return sessaoHttp.responder(sessao, cliente, resposta);
    }

    /**
     * Token de push do aparelho do membro da equipe (C7; o do aluno é {@code /aluno/push-token}): as mesmas regras, sempre o
     * usuário e a consultoria da sessão, token só no corpo, sem auditoria. Registrar exige {@code TREINOS_PUSH_HABILITADO} (503);
     * apagar não, para o "Sair" tirar o token que ficou. {@code DELETE} sem corpo apaga todos os do próprio usuário.
     */
    @ExigePush
    @PreAuthorize("hasRole('TREINADOR')")
    @PutMapping("/push-token")
    public ResponseEntity<Void> registrarPushToken(@AuthenticationPrincipal UsuarioAutenticado eu,
                                                   @RequestBody @Valid PushDtos.RegistrarRequest corpo) {
        push.registrar(eu.usuarioId(), corpo.token(), corpo.plataforma());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @DeleteMapping("/push-token")
    public ResponseEntity<Void> removerPushToken(@AuthenticationPrincipal UsuarioAutenticado eu,
                                                 @RequestBody(required = false) @Valid PushDtos.RemoverRequest corpo) {
        if (corpo == null) {
            push.removerTodos(eu.usuarioId());
        } else {
            push.remover(eu.usuarioId(), corpo.token());
        }
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    /** Preferência da conta do membro (R8): o aviso no celular quando a atualização de um aluno tem pontos de atenção. */
    @PreAuthorize("hasRole('TREINADOR')")
    @GetMapping("/preferencias-de-push")
    public PushDtos.PreferenciasDePush preferenciasDePush(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return new PushDtos.PreferenciasDePush(push.preferenciaDeAtencao(eu.usuarioId()));
    }

    @PreAuthorize("hasRole('TREINADOR')")
    @PutMapping("/preferencias-de-push")
    public PushDtos.PreferenciasDePush salvarPreferenciasDePush(@AuthenticationPrincipal UsuarioAutenticado eu,
                                                                @RequestBody @Valid PushDtos.PreferenciasDePush corpo) {
        return new PushDtos.PreferenciasDePush(push.alterarPreferenciaDeAtencao(eu.usuarioId(), corpo.atencao()));
    }
}
