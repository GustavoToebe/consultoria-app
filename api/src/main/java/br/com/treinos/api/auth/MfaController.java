package br.com.treinos.api.auth;

import br.com.plataforma.comum.auth.Mfa;
import br.com.plataforma.comum.seguranca.login.LimiteLoginException;
import br.com.treinos.api.auth.dto.LoginResponse;
import br.com.treinos.api.auth.dto.MfaDtos.Ativacao;
import br.com.treinos.api.auth.dto.MfaDtos.ConfirmacaoRequest;
import br.com.treinos.api.auth.dto.MfaDtos.Preparacao;
import br.com.treinos.api.auth.dto.MfaDtos.SenhaRequest;
import br.com.treinos.api.security.DestinoCliente;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Verificação em duas etapas do treinador (Perfil › Segurança). Todo POST confere a senha atual e passa pelo mesmo limite de
 * tentativas do login (IP e conta), senão o código de 6 dígitos poderia ser adivinhado por quem já tem a sessão.
 */
@RestController
@RequestMapping("/eu/mfa")
public class MfaController {

    private final MfaService mfa;
    private final SessaoHttp sessaoHttp;

    public MfaController(MfaService mfa, SessaoHttp sessaoHttp) {
        this.mfa = mfa;
        this.sessaoHttp = sessaoHttp;
    }

    @GetMapping
    @PreAuthorize("hasRole('TREINADOR')")
    public Mfa.Status status(@AuthenticationPrincipal UsuarioAutenticado eu, HttpServletResponse resposta) {
        resposta.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        return mfa.status(eu.usuarioId());
    }

    @PostMapping("/preparar")
    @PreAuthorize("hasRole('TREINADOR')")
    public Preparacao preparar(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestBody @Valid SenhaRequest corpo,
                               HttpServletRequest http, HttpServletResponse resposta) {
        limitar(eu, http, resposta);
        return mfa.preparar(eu.usuarioId(), corpo.senha());
    }

    @PostMapping("/ativar")
    @PreAuthorize("hasRole('TREINADOR')")
    public Ativacao ativar(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestBody @Valid ConfirmacaoRequest corpo,
                           HttpServletRequest http, HttpServletResponse resposta) {
        limitar(eu, http, resposta);
        MfaService.Ativacao ativacao = mfa.ativar(eu.usuarioId(), corpo.senha(), corpo.codigo(), http.getRemoteAddr());
        return new Ativacao(ativacao.codigosDeRecuperacao(), sessao(ativacao.sessao(), http, resposta));
    }

    @PostMapping("/desativar")
    @PreAuthorize("hasRole('TREINADOR')")
    public LoginResponse desativar(@AuthenticationPrincipal UsuarioAutenticado eu, @RequestBody @Valid ConfirmacaoRequest corpo,
                                   HttpServletRequest http, HttpServletResponse resposta) {
        limitar(eu, http, resposta);
        return sessao(mfa.desativar(eu.usuarioId(), corpo.senha(), corpo.codigo(), http.getRemoteAddr()), http, resposta);
    }

    private LoginResponse sessao(AuthService.Sessao sessao, HttpServletRequest http, HttpServletResponse resposta) {
        return sessaoHttp.responder(sessao, DestinoCliente.de(http), resposta);
    }

    private void limitar(UsuarioAutenticado eu, HttpServletRequest http, HttpServletResponse resposta) {
        resposta.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        try {
            mfa.limitar(eu.usuarioId(), http.getRemoteAddr());
        } catch (LimiteLoginException bloqueado) {
            resposta.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(bloqueado.segundos()));
            throw bloqueado;
        }
    }
}
