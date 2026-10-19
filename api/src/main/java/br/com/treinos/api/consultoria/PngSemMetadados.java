package br.com.treinos.api.consultoria;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * Regrava a logo PNG só com o que é preciso para desenhá-la. A logo é pública (com cache de um ano): texto (`tEXt`,
 * `iTXt`, `zTXt`), EXIF (`eXIf`, que pode trazer GPS e o aparelho), perfil de cor embutido, datas e qualquer chunk
 * desconhecido saem. Ficam `IHDR`, `PLTE`, `tRNS`, `sRGB`, `gAMA`, `IDAT` e `IEND`, nos bytes originais (o CRC de cada
 * um continua valendo). Recusa PNG truncado, sem `IHDR` no começo, sem `IEND` ou com chunk crítico desconhecido.
 * Como o JPEG ({@code JpegSemMetadados}), não decodifica a imagem: não há bomba de descompressão.
 */
public final class PngSemMetadados {

    private static final byte[] ASSINATURA = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};
    private static final Set<String> MANTIDOS = Set.of("IHDR", "PLTE", "tRNS", "sRGB", "gAMA", "IDAT", "IEND");

    private PngSemMetadados() {
    }

    public static byte[] limpar(byte[] png) {
        if (png.length < ASSINATURA.length + 12) {
            throw new IllegalArgumentException("PNG curto demais.");
        }
        for (int i = 0; i < ASSINATURA.length; i++) {
            if (png[i] != ASSINATURA[i]) {
                throw new IllegalArgumentException("Não é PNG.");
            }
        }
        ByteArrayOutputStream saida = new ByteArrayOutputStream(png.length);
        saida.write(png, 0, ASSINATURA.length);
        int pos = ASSINATURA.length;
        boolean primeiro = true;
        while (pos < png.length) {
            if (png.length - pos < 12) {
                throw new IllegalArgumentException("PNG truncado.");
            }
            long tamanho = ((png[pos] & 0xFFL) << 24) | ((png[pos + 1] & 0xFFL) << 16) | ((png[pos + 2] & 0xFFL) << 8) | (png[pos + 3] & 0xFFL);
            if (tamanho > png.length - pos - 12L) {
                throw new IllegalArgumentException("PNG truncado.");
            }
            String tipo = new String(png, pos + 4, 4, StandardCharsets.ISO_8859_1);
            int total = 12 + (int) tamanho;
            if (primeiro && !"IHDR".equals(tipo)) {
                throw new IllegalArgumentException("PNG sem IHDR no começo.");
            }
            primeiro = false;
            boolean critico = Character.isUpperCase(tipo.charAt(0));
            if (MANTIDOS.contains(tipo)) {
                saida.write(png, pos, total);
            } else if (critico) {
                throw new IllegalArgumentException("PNG com chunk crítico desconhecido.");
            }
            pos += total;
            if ("IEND".equals(tipo)) {
                return saida.toByteArray(); // o que vier depois do IEND não é imagem e não é guardado
            }
        }
        throw new IllegalArgumentException("PNG sem IEND.");
    }
}
