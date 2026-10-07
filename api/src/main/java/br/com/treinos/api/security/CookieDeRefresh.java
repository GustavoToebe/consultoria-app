package br.com.treinos.api.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * Cookie {@code TREINOS_REFRESH} do cliente web: HttpOnly, {@code SameSite=Strict} (a web é mesma origem que a API,
 * diferente da Central, que precisa de {@code None}) e {@code Path} configurável ({@code /api/auth} atrás do Caddy).
 * {@code Secure} só é desligado no ambiente local por IP da rede, onde não há HTTPS.
 */
@Component
public class CookieDeRefresh {

    public static final String NOME = "TREINOS_REFRESH";

    private final SecurityProperties properties;

    public CookieDeRefresh(SecurityProperties properties) {
        this.properties = properties;
    }

    public void gravar(HttpServletResponse response, String tokenBruto) {
        response.addHeader(HttpHeaders.SET_COOKIE,
                montar(tokenBruto, properties.refreshTokenTtl().toSeconds()).toString());
    }

    public void limpar(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, montar("", 0).toString());
    }

    public static boolean presente(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return false;
        }
        for (Cookie cookie : request.getCookies()) {
            if (NOME.equals(cookie.getName())) {
                return true;
            }
        }
        return false;
    }

    private ResponseCookie montar(String valor, long maxAgeSegundos) {
        return ResponseCookie.from(NOME, valor)
                .httpOnly(true)
                .secure(properties.refreshCookieSecure())
                .sameSite("Strict")
                .path(properties.refreshCookiePath())
                .maxAge(maxAgeSegundos)
                .build();
    }
}
