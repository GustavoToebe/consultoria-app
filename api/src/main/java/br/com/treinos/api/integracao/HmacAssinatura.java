package br.com.treinos.api.integracao;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * Assinatura HMAC-SHA256 do contrato de integração com a Central (seção 2.3):
 * {@code MÉTODO\nCAMINHO\nTIMESTAMP\nNONCE\nSHA256_HEX(CORPO)}, assinatura {@code v1=} + hex minúsculo.
 * O caminho vai como foi enviado na linha de requisição (com a query, percent-encoded), sem esquema nem host.
 */
public final class HmacAssinatura {

    public static final String PREFIXO = "v1=";

    private static final HexFormat HEX = HexFormat.of();

    private HmacAssinatura() { }

    public static String sha256Hex(byte[] corpo) {
        try {
            return HEX.formatHex(MessageDigest.getInstance("SHA-256").digest(corpo == null ? new byte[0] : corpo));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("SHA-256 indisponível", e);
        }
    }

    public static String assinar(byte[] segredo, String metodo, String caminho, String timestamp, String nonce,
                                 byte[] corpo) {
        return assinarComHash(segredo, metodo, caminho, timestamp, nonce, sha256Hex(corpo));
    }

    /** Variante para quem já calculou o hash do corpo (o filtro lê o corpo uma vez só). */
    public static String assinarComHash(byte[] segredo, String metodo, String caminho, String timestamp, String nonce,
                                        String corpoSha256Hex) {
        String texto = metodo + "\n" + caminho + "\n" + timestamp + "\n" + nonce + "\n" + corpoSha256Hex;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(segredo, "HmacSHA256"));
            return PREFIXO + HEX.formatHex(mac.doFinal(texto.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 indisponível", e);
        }
    }

    /** Comparação em tempo constante. */
    public static boolean confere(String esperada, String recebida) {
        if (esperada == null || recebida == null) {
            return false;
        }
        return MessageDigest.isEqual(esperada.getBytes(StandardCharsets.UTF_8), recebida.getBytes(StandardCharsets.UTF_8));
    }
}
