package br.com.treinos.api;

import java.util.concurrent.ThreadLocalRandom;

/**
 * CPF fictício para os testes: nove dígitos sorteados e os dois verificadores calculados (nunca um CPF de pessoa). O
 * formato é o que a API grava ({@code 123.456.789-09}).
 */
public final class Documentos {

    private Documentos() { }

    /** CPF válido, formatado, diferente a cada chamada (e nunca com os onze dígitos iguais). */
    public static String cpf() {
        ThreadLocalRandom r = ThreadLocalRandom.current();
        while (true) {
            StringBuilder base = new StringBuilder();
            for (int i = 0; i < 9; i++) {
                base.append(r.nextInt(10));
            }
            if (base.chars().distinct().count() == 1) {
                continue;
            }
            return comVerificadores(base.toString());
        }
    }

    /** Os nove primeiros dígitos mais os dois verificadores, formatado. */
    public static String comVerificadores(String nove) {
        String parcial = nove + dv(nove);
        String completo = parcial + dv(parcial);
        return completo.substring(0, 3) + "." + completo.substring(3, 6) + "." + completo.substring(6, 9) + "-" + completo.substring(9);
    }

    private static int dv(String digitos) {
        int soma = 0;
        for (int i = 0; i < digitos.length(); i++) {
            soma += (digitos.charAt(i) - '0') * (digitos.length() + 1 - i);
        }
        int resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    }

    /** Só os dígitos de um CPF formatado. */
    public static String semPontuacao(String cpf) {
        return cpf.replaceAll("\\D", "");
    }
}
