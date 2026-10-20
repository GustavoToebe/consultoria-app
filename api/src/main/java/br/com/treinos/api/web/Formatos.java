package br.com.treinos.api.web;

import br.com.plataforma.comum.web.BadRequestException;

import java.util.Locale;
import java.util.Set;

/**
 * Formato único de telefone, CPF, CEP e UF do cadastro. {@code cpf}, {@code cep}, {@code uf} e {@code UFS} são cópia do
 * {@code web/Formatos} da Central ({@code central-api-back/src/main/java/br/com/central/api/web/Formatos.java}, mesmas
 * regras do Servirea); o {@code telefone} é o do Servirea. Cada método aceita o valor com ou sem pontuação (tudo que não
 * é dígito é descartado antes de conferir), devolve {@code null} para vazio e grava sempre no mesmo formato
 * ({@code 123.456.789-09}, {@code 85800-000}, {@code (45) 99999-8888}), para o mesmo documento digitado de dois jeitos ser
 * o mesmo texto (a unicidade do CPF compara esse texto). Valor inválido vira {@link BadRequestException} com mensagem fixa:
 * o valor enviado nunca é repetido no erro (é dado pessoal).
 */
public final class Formatos {

    /** As 27 siglas de estado. */
    public static final Set<String> UFS = Set.of(
            "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
            "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO");

    private Formatos() { }

    /** CPF com dígitos verificadores; recusa os onze dígitos iguais. */
    public static String cpf(String valor) {
        String d = digitos(valor);
        if (d == null) {
            return null;
        }
        if (d.length() != 11 || todosIguais(d) || !dvCpfConfere(d)) {
            throw new BadRequestException("CPF inválido.");
        }
        return d.substring(0, 3) + "." + d.substring(3, 6) + "." + d.substring(6, 9) + "-" + d.substring(9);
    }

    public static String cep(String valor) {
        String d = digitos(valor);
        if (d == null) {
            return null;
        }
        if (d.length() != 8) {
            throw new BadRequestException("CEP inválido.");
        }
        return d.substring(0, 5) + "-" + d.substring(5);
    }

    /** Sigla de um dos 27 estados, em maiúsculas. */
    public static String uf(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        String uf = valor.trim().toUpperCase(Locale.ROOT);
        if (!UFS.contains(uf)) {
            throw new BadRequestException("UF inválida.");
        }
        return uf;
    }

    /** Mesmo formato do Servirea: DDD, número e +55 opcional; sem ecoar o valor no erro. */
    public static String telefone(String valor) {
        if (valor == null || valor.isBlank()) return null;
        String d = valor.replaceAll("\\D", "");
        if ((d.length() == 12 || d.length() == 13) && d.startsWith("55")) d = d.substring(2);
        boolean ddd = d.length() >= 2 && d.charAt(0) != '0' && d.charAt(1) != '0';
        boolean fixo = d.length() == 10 && d.charAt(2) >= '2' && d.charAt(2) <= '8';
        boolean celular = d.length() == 11 && d.charAt(2) == '9';
        if (!ddd || !(fixo || celular)) throw new BadRequestException("Telefone inválido. Informe o DDD e o número.");
        int corte = d.length() - 4;
        return "(" + d.substring(0, 2) + ") " + d.substring(2, corte) + "-" + d.substring(corte);
    }

    private static String digitos(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        return valor.replaceAll("\\D", "");
    }

    private static boolean todosIguais(String s) {
        return s.chars().allMatch(c -> c == s.charAt(0));
    }

    private static boolean dvCpfConfere(String d) {
        return dvCpf(d, 9) == d.charAt(9) - '0' && dvCpf(d, 10) == d.charAt(10) - '0';
    }

    private static int dvCpf(String d, int tamanho) {
        int soma = 0;
        for (int i = 0; i < tamanho; i++) {
            soma += (d.charAt(i) - '0') * (tamanho + 1 - i);
        }
        int resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    }
}
