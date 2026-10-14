package br.com.treinos.api.auth;

import br.com.plataforma.comum.auth.CookieDeRefresh;
import br.com.treinos.api.auth.dto.LoginResponse;
import br.com.treinos.api.security.DestinoCliente;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Monta a resposta de qualquer rota que abre sessão (login, refresh, cadastro, convite aceito, troca de senha, MFA): o
 * cliente web recebe o refresh no cookie HttpOnly ({@code TREINOS_REFRESH}); o nativo, no corpo. O cookie (nome, caminho,
 * SameSite, validade) vem do módulo de autenticação da plataforma ({@code plataforma.auth.cookie}).
 */
@Component
public class SessaoHttp {

    private final CookieDeRefresh cookie;

    public SessaoHttp(CookieDeRefresh cookie) {
        this.cookie = cookie;
    }

    public LoginResponse responder(AuthService.Sessao sessao, DestinoCliente cliente, HttpServletResponse resposta) {
        String refreshNoCorpo = null;
        if (cliente == DestinoCliente.NATIVO) {
            refreshNoCorpo = sessao.refreshTokenBruto();
        } else {
            resposta.addHeader(HttpHeaders.SET_COOKIE, cookie.criar(sessao.refreshTokenBruto()).toString());
        }
        return new LoginResponse(sessao.accessToken(), sessao.expiresIn(), refreshNoCorpo, sessao.usuario(),
                sessao.marca());
    }

    /** O refresh do cliente: no corpo para o app nativo, no cookie para a web. */
    public Optional<String> refreshDoCliente(DestinoCliente cliente, String doCorpo, HttpServletRequest requisicao) {
        if (cliente == DestinoCliente.NATIVO) {
            return Optional.ofNullable(doCorpo).filter(token -> !token.isBlank());
        }
        return cookie.ler(requisicao);
    }

    public void limpar(DestinoCliente cliente, HttpServletResponse resposta) {
        if (cliente == DestinoCliente.WEB) {
            resposta.addHeader(HttpHeaders.SET_COOKIE, cookie.limpar().toString());
        }
    }
}
