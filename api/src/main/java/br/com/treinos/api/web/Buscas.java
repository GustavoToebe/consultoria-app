package br.com.treinos.api.web;

import java.util.Locale;

/**
 * Padrão de {@code LIKE} a partir do texto digitado: minúsculas, {@code %} e {@code _} escapados (as consultas usam
 * {@code escape '\'}), para a busca não virar curinga. Vazio vira {@code %} (tudo).
 */
public final class Buscas {

    private Buscas() { }

    public static String padrao(String texto) {
        if (texto == null || texto.isBlank()) {
            return "%";
        }
        String limpo = texto.trim().toLowerCase(Locale.ROOT);
        if (limpo.length() > 100) {
            limpo = limpo.substring(0, 100);
        }
        return "%" + limpo.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    /** Texto opcional: vazio vira {@code null}, o resto vai sem espaços nas pontas. */
    public static String opcional(String texto) {
        return texto == null || texto.isBlank() ? null : texto.trim();
    }
}
