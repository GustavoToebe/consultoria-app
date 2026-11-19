package br.com.treinos.api.tags;

import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;

/**
 * As cores que uma tag aceita: as de identificação do app ({@code CHAVES_DE_IDENTIFICACAO} em {@code tema/tokens.ts}); nunca a cor
 * da marca nem as de situação. O app guarda só o código e resolve a cor pelo tema. Espelhada no CHECK {@code ck_tag_aluno_cor} (V093).
 */
public enum CorDeTag {
    CIANO, AZUL, INDIGO, VIOLETA, MAGENTA;

    /** O código sem diferença de caixa; vazio se não é uma das cores. */
    static Optional<CorDeTag> ler(String codigo) {
        if (codigo == null) {
            return Optional.empty();
        }
        String limpo = codigo.strip().toUpperCase(Locale.ROOT);
        return Arrays.stream(values()).filter(c -> c.name().equals(limpo)).findFirst();
    }
}
