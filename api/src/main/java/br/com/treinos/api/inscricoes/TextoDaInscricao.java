package br.com.treinos.api.inscricoes;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Versão do texto de apresentação e privacidade do link (achado B2 da análise de 29/10): o sha256 do texto, em
 * hexadecimal. A página pública recebe a versão do texto que mostrou e a devolve no envio; se a equipe trocou o texto
 * nesse meio-tempo, a ciência não vale para o texto novo e a pessoa lê de novo. O texto gravado como lido continua sendo
 * o do servidor, nunca um texto vindo do cliente.
 */
final class TextoDaInscricao {

    private TextoDaInscricao() { }

    /** {@code null} sem texto. */
    static String versao(String texto) {
        if (texto == null) return null;
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(texto.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível.", e);
        }
    }

    /** A versão enviada é a do texto atual (com texto); sem texto, qualquer valor serve. */
    static boolean confere(String textoAtual, String versaoEnviada) {
        return textoAtual == null || versao(textoAtual).equals(versaoEnviada);
    }
}
