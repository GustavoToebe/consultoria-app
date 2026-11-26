package br.com.treinos.api.contratos;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.util.HexFormat;

/**
 * O texto do contrato como é gravado e como o hash o cobre (D22): NFC e quebras de linha {@code \n}. O app mostra e devolve o hash;
 * o comprovante o imprime. Regra pura.
 */
public final class TextoDoContrato {

    private TextoDoContrato() { }

    public static String normalizar(String texto) {
        return Normalizer.normalize(texto, Normalizer.Form.NFC).replace("\r\n", "\n").replace('\r', '\n');
    }

    /** sha256 em hexadecimal minúsculo dos bytes UTF-8 do texto já normalizado. */
    public static String sha256(String textoNormalizado) {
        return sha256(textoNormalizado.getBytes(StandardCharsets.UTF_8));
    }

    public static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível.", e);
        }
    }
}
