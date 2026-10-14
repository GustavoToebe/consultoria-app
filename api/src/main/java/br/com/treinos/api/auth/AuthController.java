package br.com.treinos.api.auth;

import br.com.plataforma.comum.seguranca.login.LimiteLoginException;
import br.com.plataforma.comum.web.UnauthorizedException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.auth.dto.CadastroTreinadorRequest;
import br.com.treinos.api.auth.dto.LoginRequest;
import br.com.treinos.api.auth.dto.LoginResponse;
import br.com.treinos.api.auth.dto.RefreshRequest;
import br.com.treinos.api.security.DestinoCliente;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Rotas públicas de sessão. Web recebe o refresh em cookie HttpOnly; nativo (header
 * {@code X-Treinos-Cliente: nativo}) recebe no corpo. O limite de tentativas do login é do módulo de autenticação (roda
 * antes do BCrypt); cadastro e refresh têm o limite por IP do app ({@link LimiteTentativas}).
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;
    private final CadastroTreinadorService cadastroTreinador;
    private final LimiteTentativas limite;
    private final SessaoHttp sessaoHttp;
    private final Auditoria auditoria;

    public AuthController(AuthService authService, CadastroTreinadorService cadastroTreinador,
                          LimiteTentativas limite, SessaoHttp sessaoHttp, Auditoria auditoria) {
        this.auditoria = auditoria;
        this.authService = authService;
        this.cadastroTreinador = cadastroTreinador;
        this.limite = limite;
        this.sessaoHttp = sessaoHttp;
    }

    @PostMapping("/login")
    public LoginResponse login(@RequestBody @Valid LoginRequest request, HttpServletRequest http,
                               HttpServletResponse resposta) {
        DestinoCliente cliente = DestinoCliente.de(http);
        AuthService.Sessao sessao;
        try {
            sessao = authService.entrar(request.email(), request.senha(), request.codigoMfa(), http.getRemoteAddr());
        } catch (LimiteLoginException bloqueado) {
            // Só a tentativa que cruza o limite vira auditoria; as demais da janela só recebem o 429.
            if (bloqueado.primeiroBloqueio()) {
                auditoria.bloqueioLogin(request.email());
            }
            resposta.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(bloqueado.segundos()));
            throw bloqueado;
        }
        return sessaoHttp.responder(sessao, cliente, resposta);
    }

    @PostMapping("/cadastro-treinador")
    public LoginResponse cadastroTreinador(@RequestBody @Valid CadastroTreinadorRequest request,
                                           HttpServletRequest http, HttpServletResponse resposta) {
        limite.cadastro(http.getRemoteAddr());
        DestinoCliente cliente = DestinoCliente.de(http);
        return sessaoHttp.responder(cadastroTreinador.cadastrar(request), cliente, resposta);
    }

    @PostMapping("/refresh")
    public LoginResponse refresh(@RequestBody(required = false) @Valid RefreshRequest corpo,
                                 HttpServletRequest http, HttpServletResponse resposta) {
        limite.refresh(http.getRemoteAddr());
        DestinoCliente cliente = DestinoCliente.de(http);
        String bruto = sessaoHttp.refreshDoCliente(cliente, corpo == null ? null : corpo.refreshToken(), http)
                .orElseThrow(() -> new UnauthorizedException("Sessão inválida ou expirada. Entre de novo.", "SESSAO_EXPIRADA"));
        return sessaoHttp.responder(authService.renovar(bruto, http.getRemoteAddr()), cliente, resposta);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody(required = false) @Valid RefreshRequest corpo,
                                       HttpServletRequest http, HttpServletResponse resposta) {
        DestinoCliente cliente = DestinoCliente.de(http);
        authService.sair(sessaoHttp.refreshDoCliente(cliente, corpo == null ? null : corpo.refreshToken(), http).orElse(null));
        sessaoHttp.limpar(cliente, resposta);
        return ResponseEntity.noContent().build();
    }
}
