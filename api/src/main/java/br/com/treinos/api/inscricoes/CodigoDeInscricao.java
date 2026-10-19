package br.com.treinos.api.inscricoes;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.regex.Pattern;

/**
 * Código público do link de inscrição: 18 bytes aleatórios (144 bits) em base64 url-safe sem preenchimento = 24
 * caracteres. Fica no caminho do link (não é segredo como o convite), mas não se adivinha: sem ele não se chega à
 * consultoria. O formato é conferido antes de qualquer consulta ao banco.
 */
final class CodigoDeInscricao {

    static final int TAMANHO = 24;
    private static final Pattern FORMATO = Pattern.compile("[A-Za-z0-9_-]{24}");
    private static final SecureRandom RANDOM = new SecureRandom();

    private CodigoDeInscricao() {
    }

    static String novo() {
        byte[] bytes = new byte[18];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static boolean valido(String codigo) {
        return codigo != null && FORMATO.matcher(codigo).matches();
    }
}
