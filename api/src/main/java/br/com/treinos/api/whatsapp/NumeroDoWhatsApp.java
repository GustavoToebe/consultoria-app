package br.com.treinos.api.whatsapp;

import java.util.Optional;

/**
 * O número como a Cloud API da Meta o quer: só dígitos, com o DDI. O telefone do cadastro vem formatado
 * ({@code (45) 99999-8888}); número brasileiro sem DDI ganha o 55. O que não parece um número brasileiro completo (DDD +
 * 8 ou 9 dígitos) não vira número: sem número, o aviso é cancelado, nunca enviado a um destino adivinhado. Dado pessoal: nunca em log.
 */
final class NumeroDoWhatsApp {

    private NumeroDoWhatsApp() {
    }

    static Optional<String> de(String telefone) {
        if (telefone == null) {
            return Optional.empty();
        }
        String digitos = telefone.replaceAll("\\D", "");
        if (digitos.startsWith("55") && (digitos.length() == 12 || digitos.length() == 13)) {
            return Optional.of(digitos);
        }
        if (digitos.length() == 10 || digitos.length() == 11) {
            return Optional.of("55" + digitos);
        }
        return Optional.empty();
    }
}
