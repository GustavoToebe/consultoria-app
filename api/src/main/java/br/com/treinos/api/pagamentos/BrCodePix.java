package br.com.treinos.api.pagamentos;

import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Pix "copia e cola" estático (BR Code EMV do Banco Central): GUI {@code br.gov.bcb.pix}, chave, valor da cobrança, país BR,
 * nome do recebedor (até 25), cidade (até 15), identificador curto da cobrança (campo 62/05) e CRC16/CCITT-FALSE. Montagem pura,
 * sem biblioteca, sem relógio e sem banco. A chave é dado pessoal: nunca vai a mensagem de erro nem a log.
 * <p>
 * O campo 01 (forma de iniciação) fica de fora, como no exemplo do manual: sem ele o código é reutilizável (estático).
 */
public final class BrCodePix {

    public static final int NOME_MAXIMO = 25;
    public static final int CIDADE_MAXIMO = 15;
    /** Cabe nos 13 caracteres do campo 54 ("9999999999.99"). */
    public static final long VALOR_MAXIMO_CENTAVOS = 999_999_999_999L;
    /** O TXID estático aceita 1 a 25 letras e dígitos; {@code ***} diz que não há identificador (como no manual). */
    private static final Pattern TXID = Pattern.compile("[A-Za-z0-9]{1,25}|\\*\\*\\*");

    private BrCodePix() { }

    /**
     * Monta o código. {@code valorCentavos} nulo omite o campo 54 (o pagador digita; só o exemplo do manual usa isso).
     * {@code chave} já vem no formato do BR Code ({@link ChavePix#normalizar}); nome e cidade são normalizados aqui.
     *
     * @throws IllegalArgumentException dado que não cabe no padrão, sempre com mensagem fixa (nunca o valor)
     */
    public static String montar(String chave, Long valorCentavos, String nome, String cidade, String txid) {
        if (chave == null || chave.isEmpty() || chave.length() > ChavePix.MAXIMO) {
            throw new IllegalArgumentException("Chave Pix fora do padrão.");
        }
        if (valorCentavos != null && (valorCentavos <= 0 || valorCentavos > VALOR_MAXIMO_CENTAVOS)) {
            throw new IllegalArgumentException("Valor fora do padrão.");
        }
        if (txid == null || !TXID.matcher(txid).matches()) {
            throw new IllegalArgumentException("Identificador fora do padrão.");
        }
        String n = texto(nome, NOME_MAXIMO);
        String c = texto(cidade, CIDADE_MAXIMO);
        if (n.isEmpty() || c.isEmpty()) {
            throw new IllegalArgumentException("Nome ou cidade fora do padrão.");
        }
        StringBuilder b = new StringBuilder("000201")
                .append(campo("26", campo("00", "br.gov.bcb.pix") + campo("01", chave)))
                .append("52040000")
                .append("5303986");
        if (valorCentavos != null) {
            b.append(campo("54", valor(valorCentavos)));
        }
        b.append("5802BR")
                .append(campo("59", n))
                .append(campo("60", c))
                .append(campo("62", campo("05", txid)))
                .append("6304");
        return b.append(crc16(b.toString())).toString();
    }

    /** O nome e a cidade do BR Code: maiúsculas, sem acento, só ASCII visível, espaços compactados, cortado no máximo. */
    public static String texto(String s, int maximo) {
        if (s == null) {
            return "";
        }
        String t = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toUpperCase(Locale.ROOT).replaceAll("[^\\x20-\\x7E]", "").replaceAll("\\s+", " ").strip();
        return t.length() <= maximo ? t : t.substring(0, maximo).strip();
    }

    /** CRC16/CCITT-FALSE (polinômio 0x1021, início 0xFFFF) em 4 hexadecimais maiúsculos. */
    public static String crc16(String texto) {
        int crc = 0xFFFF;
        for (byte b : texto.getBytes(StandardCharsets.US_ASCII)) {
            crc ^= (b & 0xFF) << 8;
            for (int i = 0; i < 8; i++) {
                crc = (crc & 0x8000) != 0 ? (crc << 1) ^ 0x1021 : crc << 1;
                crc &= 0xFFFF;
            }
        }
        return String.format(Locale.ROOT, "%04X", crc);
    }

    private static String valor(long centavos) {
        return (centavos / 100) + "." + String.format(Locale.ROOT, "%02d", centavos % 100);
    }

    private static String campo(String id, String valor) {
        return id + String.format(Locale.ROOT, "%02d", valor.length()) + valor;
    }
}
