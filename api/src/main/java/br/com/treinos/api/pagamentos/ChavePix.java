package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.web.Formatos;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Normalização e conferência da chave Pix por tipo, na forma que o BR Code manda: CPF e CNPJ só com os caracteres (sem pontuação),
 * telefone com {@code +55}, e-mail e chave aleatória em minúsculas. Classe pura: nunca lança, nunca devolve nem repete o valor
 * recebido em erro, e a chave é dado pessoal (nada de log nem mensagem).
 */
public final class ChavePix {

    public enum Tipo { CPF, CNPJ, EMAIL, TELEFONE, ALEATORIA }

    /** Cabe no campo 26/01 do BR Code (o campo 26 aceita 99 caracteres, 22 são do GUI) e na coluna {@code pix_chave}. */
    public static final int MAXIMO = 77;

    private static final Pattern SO_CPF = Pattern.compile("[0-9.\\-\\s]+");
    private static final Pattern SO_TELEFONE = Pattern.compile("[0-9 ()+\\-.]+");
    // O CNPJ alfanumérico vale desde julho de 2026: 12 caracteres [A-Z0-9] e 2 dígitos verificadores; o numérico é o mesmo caso.
    private static final Pattern CNPJ = Pattern.compile("[A-Z0-9]{12}[0-9]{2}");
    private static final Pattern EMAIL = Pattern.compile("[a-z0-9._%+'\\-]+@[a-z0-9\\-]+(\\.[a-z0-9\\-]+)+");
    private static final Pattern UUID = Pattern.compile(
            "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    private static final int[] PESO_CNPJ_1 = {5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};
    private static final int[] PESO_CNPJ_2 = {6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};

    private ChavePix() { }

    /** A chave no formato do BR Code, ou {@code null} se não vale para o tipo (nunca lança). */
    public static String normalizar(Tipo tipo, String bruto) {
        if (tipo == null || bruto == null || bruto.length() > 200) {
            return null;
        }
        String v = bruto.strip();
        String chave = switch (tipo) {
            case CPF -> cpf(v);
            case CNPJ -> cnpj(v);
            case TELEFONE -> telefone(v);
            case EMAIL, ALEATORIA -> v.toLowerCase(Locale.ROOT);
        };
        if (chave == null || chave.length() > MAXIMO) {
            return null;
        }
        boolean ok = switch (tipo) {
            case EMAIL -> EMAIL.matcher(chave).matches();
            case ALEATORIA -> UUID.matcher(chave).matches();
            default -> true;
        };
        return ok ? chave : null;
    }

    /** Só o fim da chave, para o treinador reconhecer qual é (a API nunca devolve a chave inteira). */
    public static String mascarar(Tipo tipo, String chave) {
        if (tipo == null || chave == null || chave.isEmpty()) {
            return null;
        }
        return switch (tipo) {
            case CPF -> "***.***.***-" + fim(chave, 2);
            case CNPJ -> "**.***.***/****-" + fim(chave, 2);
            case TELEFONE -> "+55 ** *****-" + fim(chave, 4);
            case EMAIL -> {
                int arroba = chave.indexOf('@');
                yield arroba < 1 ? "***" : chave.charAt(0) + "***" + chave.substring(arroba);
            }
            case ALEATORIA -> "****-" + fim(chave, 4);
        };
    }

    private static String fim(String s, int n) {
        return s.length() <= n ? s : s.substring(s.length() - n);
    }

    private static String cpf(String v) {
        if (!SO_CPF.matcher(v).matches()) {
            return null;
        }
        try {
            return Formatos.cpf(v).replaceAll("\\D", "");
        } catch (BadRequestException e) {
            return null;
        }
    }

    private static String telefone(String v) {
        if (!SO_TELEFONE.matcher(v).matches()) {
            return null;
        }
        try {
            Formatos.telefone(v);
        } catch (BadRequestException e) {
            return null;
        }
        String d = v.replaceAll("\\D", "");
        if ((d.length() == 12 || d.length() == 13) && d.startsWith("55")) {
            d = d.substring(2);
        }
        return "+55" + d;
    }

    private static String cnpj(String v) {
        String c = v.replaceAll("[.\\-/\\s]", "").toUpperCase(Locale.ROOT);
        if (!CNPJ.matcher(c).matches() || c.chars().allMatch(x -> x == c.charAt(0))) {
            return null;
        }
        boolean confere = dvCnpj(c, PESO_CNPJ_1) == c.charAt(12) - '0' && dvCnpj(c, PESO_CNPJ_2) == c.charAt(13) - '0';
        return confere ? c : null;
    }

    private static int dvCnpj(String c, int[] pesos) {
        int soma = 0;
        for (int i = 0; i < pesos.length; i++) {
            soma += (c.charAt(i) - '0') * pesos[i];
        }
        int resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    }
}
