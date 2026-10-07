package br.com.treinos.api.web;

import java.util.Locale;

/** E-mail único global: comparado sempre depois de {@code trim()} e minúsculas (índice em {@code lower(email)}). */
public final class Emails {

    private Emails() { }

    public static String normalizar(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
