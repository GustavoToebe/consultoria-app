package br.com.treinos.api.auth;

import br.com.treinos.api.auth.dto.CadastroTreinadorRequest;
import br.com.treinos.api.auth.dto.LoginRequest;
import br.com.treinos.api.auth.dto.LoginResponse;
import br.com.treinos.api.auth.dto.RefreshRequest;
import br.com.treinos.api.security.CookieDeRefresh;
import br.com.treinos.api.security.DestinoCliente;
import br.com.treinos.api.web.NaoAutorizadoException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Rotas públicas de sessão (seção 9.1). Web recebe o refresh em cookie HttpOnly; nativo (header
 * {@code X-Treinos-Cliente: nativo}) recebe no corpo. O limite de tentativas roda antes do BCrypt.
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;
    private final CadastroTreinadorService cadastroTreinador;
    private final LimiteTentativas limite;
    private final CookieDeRefresh cookie;

    public AuthController(AuthService authService, CadastroTreinadorService cadastroTreinador,
                          LimiteTentativas limite, CookieDeRefresh cookie) {
        this.authService = authService;
        this.cadastroTreinador = cadastroTreinador;
        this.limite = limite;
        this.cookie = cookie;
    }

    @PostMapping("/login")
    public LoginResponse login(@RequestBody @Valid LoginRequest request, HttpServletRequest http,
                               HttpServletResponse resposta) {
        limite.login(http.getRemoteAddr(), request.email());
        DestinoCliente cliente = DestinoCliente.de(http);
        return responder(authService.entrar(request.email(), request.senha(), cliente), cliente, resposta);
    }

    @PostMapping("/cadastro-treinador")
    public LoginResponse cadastroTreinador(@RequestBody @Valid CadastroTreinadorRequest request,
                                           HttpServletRequest http, HttpServletResponse resposta) {
        limite.cadastro(http.getRemoteAddr());
        DestinoCliente cliente = DestinoCliente.de(http);
        return responder(cadastroTreinador.cadastrar(request, cliente), cliente, resposta);
    }

    @PostMapping("/refresh")
    public LoginResponse refresh(@RequestBody(required = false) @Valid RefreshRequest corpo,
                                 @CookieValue(name = CookieDeRefresh.NOME, required = false) String doCookie,
                                 HttpServletRequest http, HttpServletResponse resposta) {
        limite.refresh(http.getRemoteAddr());
        DestinoCliente cliente = DestinoCliente.de(http);
        String bruto = tokenDoCliente(cliente, corpo, doCookie);
        if (bruto == null || bruto.isBlank()) {
            throw new NaoAutorizadoException("Sessão inválida ou expirada. Entre de novo.", "SESSAO_EXPIRADA");
        }
        return responder(authService.renovar(bruto), cliente, resposta);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody(required = false) @Valid RefreshRequest corpo,
                                       @CookieValue(name = CookieDeRefresh.NOME, required = false) String doCookie,
                                       HttpServletRequest http, HttpServletResponse resposta) {
        DestinoCliente cliente = DestinoCliente.de(http);
        authService.sair(tokenDoCliente(cliente, corpo, doCookie));
        if (cliente == DestinoCliente.WEB) {
            cookie.limpar(resposta);
        }
        return ResponseEntity.noContent().build();
    }

    private static String tokenDoCliente(DestinoCliente cliente, RefreshRequest corpo, String doCookie) {
        if (cliente == DestinoCliente.NATIVO) {
            return corpo == null ? null : corpo.refreshToken();
        }
        return doCookie;
    }

    /** Também usado na troca de senha ({@code EuController}), que devolve uma sessão nova. */
    static LoginResponse responder(AuthService.Sessao sessao, DestinoCliente cliente, HttpServletResponse resposta,
                                   CookieDeRefresh cookie) {
        String refreshNoCorpo = null;
        if (cliente == DestinoCliente.NATIVO) {
            refreshNoCorpo = sessao.refreshTokenBruto();
        } else {
            cookie.gravar(resposta, sessao.refreshTokenBruto());
        }
        return new LoginResponse(sessao.accessToken(), sessao.expiresIn(), refreshNoCorpo, sessao.usuario(),
                sessao.marca());
    }

    private LoginResponse responder(AuthService.Sessao sessao, DestinoCliente cliente, HttpServletResponse resposta) {
        return responder(sessao, cliente, resposta, cookie);
    }
}
