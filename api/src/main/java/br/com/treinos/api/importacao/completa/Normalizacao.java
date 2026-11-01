package br.com.treinos.api.importacao.completa;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Formas comparáveis de texto da planilha, as mesmas dos scripts de importação ({@code alunos-lib.mjs}): sem acento, em
 * minúsculas e com os espaços arrumados. Nada aqui guarda nem registra o texto.
 */
final class Normalizacao {

    private static final Pattern MARCAS = Pattern.compile("\\p{M}+");
    private static final Pattern ESPACOS = Pattern.compile("\\s+");
    private static final Pattern NAO_ALFANUMERICO = Pattern.compile("[^a-z0-9]+");

    private Normalizacao() {
    }

    /** "Exercício" = "Exercicio". */
    static String semAcento(String texto) {
        if (texto == null) {
            return "";
        }
        return MARCAS.matcher(Normalizer.normalize(texto, Normalizer.Form.NFD)).replaceAll("");
    }

    /** Nome de pessoa comparável ({@code chaveDoNome} do script): sem acento, minúsculo, espaços colapsados. */
    static String chaveDoNome(String texto) {
        return ESPACOS.matcher(semAcento(texto).toLowerCase(Locale.ROOT)).replaceAll(" ").strip();
    }

    /** Palavras só com letras e números, sem acento e em minúsculas: "Peso (kg)" = [peso, kg]. */
    static List<String> palavras(String texto) {
        String limpo = NAO_ALFANUMERICO.matcher(semAcento(texto).toLowerCase(Locale.ROOT)).replaceAll(" ").strip();
        List<String> saida = new ArrayList<>();
        if (limpo.isEmpty()) {
            return saida;
        }
        for (String p : ESPACOS.split(limpo)) {
            saida.add(p);
        }
        return saida;
    }

    /**
     * O texto em minúsculas e sem acento, caractere a caractere (o mesmo tamanho do original), para casar padrões e
     * depois saber o que sobrou do texto original. Caractere que não se decompõe em uma letra só fica como está.
     */
    static String dobrar(String texto) {
        StringBuilder saida = new StringBuilder(texto.length());
        for (int i = 0; i < texto.length(); i++) {
            char c = texto.charAt(i);
            String base = semAcento(String.valueOf(c)).toLowerCase(Locale.ROOT);
            saida.append(base.length() == 1 ? base.charAt(0) : Character.toLowerCase(c));
        }
        return saida.toString();
    }
}
