package br.com.treinos.api.security;

import jakarta.servlet.http.HttpServletRequest;

import java.util.Locale;

/**
 * Tipo de cliente, pelo header {@code X-Treinos-Cliente}. Web (padrão): refresh em cookie
 * HttpOnly com CSRF. Nativo (Android/iOS): refresh no corpo, guardado no SecureStore, sem cookie.
 */
public enum DestinoCliente {
    WEB,
    NATIVO;

    public static final String HEADER = "X-Treinos-Cliente";

    public static DestinoCliente de(HttpServletRequest request) {
        String valor = request.getHeader(HEADER);
        return valor != null && "nativo".equals(valor.trim().toLowerCase(Locale.ROOT)) ? NATIVO : WEB;
    }
}
