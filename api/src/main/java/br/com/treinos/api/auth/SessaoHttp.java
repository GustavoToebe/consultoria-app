package br.com.treinos.api.auth;

import br.com.treinos.api.auth.dto.LoginResponse;
import br.com.treinos.api.security.CookieDeRefresh;
import br.com.treinos.api.security.DestinoCliente;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;

/**
 * Monta a resposta de qualquer rota que abre sessão (login, refresh, cadastro, convite aceito, troca de senha): o
 * cliente web recebe o refresh no cookie HttpOnly; o nativo, no corpo.
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
            cookie.gravar(resposta, sessao.refreshTokenBruto());
        }
        return new LoginResponse(sessao.accessToken(), sessao.expiresIn(), refreshNoCorpo, sessao.usuario(),
                sessao.marca());
    }
}
