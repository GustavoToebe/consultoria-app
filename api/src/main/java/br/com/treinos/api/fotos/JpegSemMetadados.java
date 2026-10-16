package br.com.treinos.api.fotos;

import java.io.ByteArrayOutputStream;

/**
 * Reescreve um JPEG só com o que a imagem precisa para aparecer (tabelas, quadro e dados de varredura), sem nenhum
 * metadado: EXIF (APP1, onde ficam GPS, data e modelo do aparelho), XMP, IPTC (APP13), comentários, miniatura e perfis de
 * cor ficam de fora. O app já manda a foto reexportada sem EXIF; isto é a conferência do servidor, que nunca guarda os
 * bytes recebidos, só os reescritos. Os dados de varredura são copiados como vieram: não há decodificação nem
 * recompressão (a imagem não perde qualidade e nenhum decodificador de imagem roda sobre dado de fora).
 *
 * <p>Só JPEG de base ou progressivo (SOF0, SOF1, SOF2). Tudo o que não for reconhecido é recusado, não repassado.
 */
public final class JpegSemMetadados {

    /** Maior lado aceito, em pixels. O app reduz para ~1600; folga para outros clientes sem deixar uma imagem gigante passar. */
    static final int LADO_MAXIMO = 4096;

    private static final int SOI = 0xD8;
    private static final int EOI = 0xD9;
    private static final int SOS = 0xDA;

    private JpegSemMetadados() {
    }

    /** @throws IllegalArgumentException se não for um JPEG inteiro e aceito (a mensagem não repete nada do arquivo) */
    public static byte[] limpar(byte[] jpeg) {
        return limpar(jpeg, LADO_MAXIMO);
    }

    /** Igual a {@link #limpar(byte[])}, com outro maior lado aceito (a logo da consultoria usa 2048). */
    public static byte[] limpar(byte[] jpeg, int ladoMaximo) {
        if (jpeg == null || jpeg.length < 4 || (jpeg[0] & 0xFF) != 0xFF || (jpeg[1] & 0xFF) != SOI) {
            throw new IllegalArgumentException("não é JPEG");
        }
        ByteArrayOutputStream saida = new ByteArrayOutputStream(jpeg.length);
        saida.write(0xFF);
        saida.write(SOI);
        int pos = 2;
        boolean quadro = false;
        int varreduras = 0;
        while (true) {
            // Bytes 0xFF de enchimento podem preceder qualquer marcador.
            if (pos >= jpeg.length || (jpeg[pos] & 0xFF) != 0xFF) {
                throw new IllegalArgumentException("marcador esperado");
            }
            while (pos < jpeg.length && (jpeg[pos] & 0xFF) == 0xFF) {
                pos++;
            }
            if (pos >= jpeg.length) {
                throw new IllegalArgumentException("truncado");
            }
            int marcador = jpeg[pos++] & 0xFF;
            if (marcador == EOI) {
                if (!quadro || varreduras == 0) {
                    throw new IllegalArgumentException("sem imagem");
                }
                saida.write(0xFF);
                saida.write(EOI);
                // O que vier depois do EOI (lixo, segunda imagem, dado escondido) não é copiado.
                return saida.toByteArray();
            }
            if (marcador == SOI || marcador == 0x00 || marcador == 0x01 || (marcador >= 0xD0 && marcador <= 0xD7)) {
                throw new IllegalArgumentException("marcador inesperado");
            }
            if (pos + 2 > jpeg.length) {
                throw new IllegalArgumentException("truncado");
            }
            int tamanho = ((jpeg[pos] & 0xFF) << 8) | (jpeg[pos + 1] & 0xFF);
            if (tamanho < 2 || pos + tamanho > jpeg.length) {
                throw new IllegalArgumentException("segmento inválido");
            }
            int inicio = pos + 2;
            int fim = pos + tamanho;
            switch (classificar(marcador, jpeg, inicio, fim)) {
                case MANTER -> {
                    if (marcador >= 0xC0 && marcador <= 0xC2) {
                        if (quadro) {
                            throw new IllegalArgumentException("quadro repetido");
                        }
                        conferirQuadro(jpeg, inicio, fim, ladoMaximo);
                        quadro = true;
                    }
                    if (marcador == SOS && !quadro) {
                        throw new IllegalArgumentException("varredura sem quadro");
                    }
                    copiar(saida, marcador, jpeg, pos, fim);
                    pos = fim;
                    if (marcador == SOS) {
                        varreduras++;
                        int proximo = fimDosDados(jpeg, pos);
                        saida.write(jpeg, pos, proximo - pos);
                        pos = proximo;
                    }
                }
                case DESCARTAR -> pos = fim;
                case RECUSAR -> throw new IllegalArgumentException("marcador não suportado");
            }
        }
    }

    /** Só para os testes e para a conferência: o JPEG tem algum segmento de metadados (APPn que não seja JFIF/Adobe, ou COM)? */
    static boolean temMetadados(byte[] jpeg) {
        int pos = 2;
        while (pos + 4 <= jpeg.length) {
            while (pos < jpeg.length && (jpeg[pos] & 0xFF) == 0xFF) {
                pos++;
            }
            int marcador = jpeg[pos++] & 0xFF;
            if (marcador == EOI) {
                return false;
            }
            int tamanho = ((jpeg[pos] & 0xFF) << 8) | (jpeg[pos + 1] & 0xFF);
            if (marcador == 0xFE) {
                return true;
            }
            if (marcador >= 0xE0 && marcador <= 0xEF
                    && classificar(marcador, jpeg, pos + 2, pos + tamanho) != Acao.MANTER) {
                return true;
            }
            pos += tamanho;
            if (marcador == SOS) {
                pos = fimDosDados(jpeg, pos);
            }
        }
        return false;
    }

    private enum Acao { MANTER, DESCARTAR, RECUSAR }

    private static Acao classificar(int marcador, byte[] b, int inicio, int fim) {
        return switch (marcador) {
            case 0xC0, 0xC1, 0xC2, 0xC4, 0xDB, 0xDD, SOS -> Acao.MANTER;
            // JFIF (versão e densidade) e Adobe (como ler as cores de CMYK/YCCK) não identificam nada; o resto dos APPn sai.
            case 0xE0 -> comecaCom(b, inicio, fim, "JFIF\0") ? Acao.MANTER : Acao.DESCARTAR;
            case 0xEE -> comecaCom(b, inicio, fim, "Adobe") ? Acao.MANTER : Acao.DESCARTAR;
            case 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xEB, 0xEC, 0xED, 0xEF, 0xFE -> Acao.DESCARTAR;
            default -> Acao.RECUSAR;
        };
    }

    private static boolean comecaCom(byte[] b, int inicio, int fim, String prefixo) {
        if (fim - inicio < prefixo.length()) {
            return false;
        }
        for (int i = 0; i < prefixo.length(); i++) {
            if ((b[inicio + i] & 0xFF) != prefixo.charAt(i)) {
                return false;
            }
        }
        return true;
    }

    private static void conferirQuadro(byte[] b, int inicio, int fim, int ladoMaximo) {
        if (fim - inicio < 6) {
            throw new IllegalArgumentException("quadro curto");
        }
        int precisao = b[inicio] & 0xFF;
        int altura = ((b[inicio + 1] & 0xFF) << 8) | (b[inicio + 2] & 0xFF);
        int largura = ((b[inicio + 3] & 0xFF) << 8) | (b[inicio + 4] & 0xFF);
        int componentes = b[inicio + 5] & 0xFF;
        if (precisao != 8 || altura == 0 || largura == 0 || altura > ladoMaximo || largura > ladoMaximo
                || (componentes != 1 && componentes != 3 && componentes != 4)) {
            throw new IllegalArgumentException("imagem fora do aceito");
        }
    }

    private static void copiar(ByteArrayOutputStream saida, int marcador, byte[] b, int inicioDoTamanho, int fim) {
        saida.write(0xFF);
        saida.write(marcador);
        saida.write(b, inicioDoTamanho, fim - inicioDoTamanho);
    }

    /**
     * Fim dos dados de uma varredura: o primeiro 0xFF seguido de algo que não seja 0x00 (byte "recheado"), um reinício
     * (RST0 a RST7) ou outro 0xFF de enchimento. Se o arquivo acabar antes, o JPEG está truncado.
     */
    private static int fimDosDados(byte[] b, int inicio) {
        int i = inicio;
        while (i + 1 < b.length) {
            if ((b[i] & 0xFF) == 0xFF) {
                int proximo = b[i + 1] & 0xFF;
                if (proximo != 0x00 && !(proximo >= 0xD0 && proximo <= 0xD7)) {
                    return i;
                }
                i += 2;
            } else {
                i++;
            }
        }
        throw new IllegalArgumentException("truncado");
    }
}
