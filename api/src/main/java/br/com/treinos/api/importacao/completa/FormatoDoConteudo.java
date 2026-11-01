package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.importacao.LeitorDePlanilha.Celula;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Formato do conteúdo de uma célula, só pela forma (nunca guarda o valor): e-mail, telefone, data, prescrição ("4x10"),
 * faixa de repetições ("8-12"), carga ("30 kg"), código ("ALU001") ou número.
 */
enum FormatoDoConteudo {
    EMAIL, TELEFONE, DATA, PRESCRICAO, FAIXA, CARGA, CODIGO, NUMERO, TEXTO, VAZIO;

    private static final Pattern P_EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern P_TELEFONE = Pattern.compile("^\\+?[\\d\\s().-]{8,20}$");
    private static final Pattern P_DATA = Pattern.compile(
            "^(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{2}|\\d{4})$|^\\d{4}-\\d{1,2}-\\d{1,2}(?:[t ][\\d:.]+z?)?$");
    private static final Pattern P_PRESCRICAO = Pattern.compile("^\\d{1,2}\\s*[x×]\\s*\\d{1,3}(?:\\s*(?:-|–|a|ate)\\s*\\d{1,3})?.*$");
    private static final Pattern P_FAIXA = Pattern.compile("^\\d{1,3}\\s*(?:-|–|a|ate)\\s*\\d{1,3}$");
    private static final Pattern P_CARGA = Pattern.compile("^\\d{1,3}(?:[.,]\\d{1,2})?\\s*kgs?$");
    private static final Pattern P_CODIGO = Pattern.compile("^[a-z]{1,8}[-_]?\\d{1,8}$");
    private static final Pattern P_NUMERO = Pattern.compile("^-?\\d+(?:[.,]\\d+)?$");

    /** Série do Excel que tem cara de data recente (de 1982 a 2064): só vale onde a coluna já é de data. */
    static boolean serialDeData(Celula c) {
        if (c == null || !c.numero()) {
            return false;
        }
        try {
            BigDecimal n = new BigDecimal(c.texto());
            return n.compareTo(new BigDecimal("30000")) >= 0 && n.compareTo(new BigDecimal("60000")) < 0;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    static FormatoDoConteudo de(Celula c) {
        if (c == null || c.erro()) {
            return c == null ? VAZIO : TEXTO;
        }
        if (c.numero()) {
            // Telefone gravado como número (45999998888): 10 a 13 dígitos sem casa decimal.
            String t = c.texto();
            return t.matches("\\d{10,13}") ? TELEFONE : NUMERO;
        }
        return de(c.texto());
    }

    static FormatoDoConteudo de(String texto) {
        String t = texto == null ? "" : Normalizacao.semAcento(texto).strip().toLowerCase(Locale.ROOT);
        if (t.isEmpty()) {
            return VAZIO;
        }
        if (P_EMAIL.matcher(t).matches()) {
            return EMAIL;
        }
        if (P_DATA.matcher(t).matches()) {
            return DATA;
        }
        if (P_PRESCRICAO.matcher(t).matches()) {
            return PRESCRICAO;
        }
        if (P_FAIXA.matcher(t).matches()) {
            return FAIXA;
        }
        if (P_CARGA.matcher(t).matches()) {
            return CARGA;
        }
        if (P_TELEFONE.matcher(t).matches() && digitos(t) >= 10 && digitos(t) <= 13) {
            return TELEFONE;
        }
        if (P_NUMERO.matcher(t).matches()) {
            return NUMERO;
        }
        if (P_CODIGO.matcher(t).matches()) {
            return CODIGO;
        }
        return TEXTO;
    }

    /** Conteúdo que é dado e não nome de coluna. */
    boolean dado() {
        return this != TEXTO && this != VAZIO;
    }

    private static int digitos(String t) {
        int n = 0;
        for (int i = 0; i < t.length(); i++) {
            if (Character.isDigit(t.charAt(i))) {
                n++;
            }
        }
        return n;
    }
}
