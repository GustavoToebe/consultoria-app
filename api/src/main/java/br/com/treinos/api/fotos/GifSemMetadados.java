package br.com.treinos.api.fotos;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Regrava um GIF (também o animado) só com o que é preciso para desenhá-lo: cabeçalho, tabelas de cor, quadros e o
 * controle de cada quadro (tempo e transparência). As extensões de comentário ({@code FE}), de texto ({@code 01}) e de
 * aplicação ({@code FF}) saem, menos o {@code NETSCAPE2.0}, que só guarda quantas vezes o GIF repete (o loop); dele fica
 * apenas esse número. Extensão que não se conhece, bytes depois do final e qualquer outra coisa também saem. Como o
 * {@link JpegSemMetadados}, não decodifica a imagem (os dados LZW passam sem ser lidos): não há bomba de descompressão.
 * Recusa o que não é GIF pelos bytes (um PNG renomeado .gif), o GIF truncado ou sem final, sem nenhum quadro, ou com
 * tela ou quadro maiores que {@code ladoMaximo} px.
 */
public final class GifSemMetadados {

    private static final int MAX_QUADROS = 600;

    private GifSemMetadados() {
    }

    /** {@code true} se os bytes começam com a assinatura {@code GIF87a} ou {@code GIF89a}. */
    public static boolean ehGif(byte[] b) {
        if (b == null || b.length < 6) {
            return false;
        }
        String cabecalho = new String(b, 0, 6, StandardCharsets.ISO_8859_1);
        return "GIF87a".equals(cabecalho) || "GIF89a".equals(cabecalho);
    }

    public static byte[] limpar(byte[] gif, int ladoMaximo) {
        if (!ehGif(gif)) {
            throw new IllegalArgumentException("Não é GIF.");
        }
        if (gif.length < 13) {
            throw new IllegalArgumentException("GIF truncado.");
        }
        ByteArrayOutputStream saida = new ByteArrayOutputStream(gif.length);
        saida.write(gif, 0, 6);
        int largura = u16(gif, 6);
        int altura = u16(gif, 8);
        conferirLados(largura, altura, ladoMaximo);
        int embalagem = gif[10] & 0xFF;
        saida.write(gif, 6, 7);
        int pos = 13;
        if ((embalagem & 0x80) != 0) {
            int tabela = 3 * (1 << ((embalagem & 7) + 1));
            exigir(gif, pos, tabela);
            saida.write(gif, pos, tabela);
            pos += tabela;
        }
        int quadros = 0;
        while (true) {
            exigir(gif, pos, 1);
            int tipo = gif[pos++] & 0xFF;
            if (tipo == 0x3B) { // final: o que vier depois não é imagem e não é guardado
                if (quadros == 0) {
                    throw new IllegalArgumentException("GIF sem quadros.");
                }
                saida.write(0x3B);
                return saida.toByteArray();
            }
            if (tipo == 0x2C) {
                pos = quadro(gif, pos, saida, ladoMaximo);
                if (++quadros > MAX_QUADROS) {
                    throw new IllegalArgumentException("GIF com quadros demais.");
                }
            } else if (tipo == 0x21) {
                pos = extensao(gif, pos, saida);
            } else {
                throw new IllegalArgumentException("GIF com bloco inesperado.");
            }
        }
    }

    /** Descritor da imagem, tabela de cor local e dados LZW (sub-blocos), tudo como veio. Devolve a posição seguinte. */
    private static int quadro(byte[] gif, int pos, ByteArrayOutputStream saida, int ladoMaximo) {
        exigir(gif, pos, 9);
        conferirLados(u16(gif, pos + 4), u16(gif, pos + 6), ladoMaximo);
        int embalagem = gif[pos + 8] & 0xFF;
        saida.write(0x2C);
        saida.write(gif, pos, 9);
        pos += 9;
        if ((embalagem & 0x80) != 0) {
            int tabela = 3 * (1 << ((embalagem & 7) + 1));
            exigir(gif, pos, tabela);
            saida.write(gif, pos, tabela);
            pos += tabela;
        }
        exigir(gif, pos, 1);
        int minimoLzw = gif[pos] & 0xFF;
        if (minimoLzw < 1 || minimoLzw > 8) {
            throw new IllegalArgumentException("GIF com dados de imagem inválidos.");
        }
        saida.write(gif[pos++]);
        return copiarSubBlocos(gif, pos, saida);
    }

    private static int extensao(byte[] gif, int pos, ByteArrayOutputStream saida) {
        exigir(gif, pos, 1);
        int rotulo = gif[pos++] & 0xFF;
        if (rotulo == 0xF9) { // controle do quadro: tempo, transparência e descarte; reescrito do jeito estrito
            exigir(gif, pos, 6);
            if ((gif[pos] & 0xFF) != 4 || gif[pos + 5] != 0) {
                throw new IllegalArgumentException("GIF com controle de quadro inválido.");
            }
            saida.write(0x21);
            saida.write(0xF9);
            saida.write(gif, pos, 6);
            return pos + 6;
        }
        if (rotulo == 0xFF) {
            exigir(gif, pos, 1);
            int tamanho = gif[pos] & 0xFF;
            if (tamanho == 11) {
                exigir(gif, pos + 1, 11);
                String aplicacao = new String(gif, pos + 1, 11, StandardCharsets.ISO_8859_1);
                if ("NETSCAPE2.0".equals(aplicacao)) {
                    return netscape(gif, pos + 12, saida);
                }
            }
        }
        return pularSubBlocos(gif, pos); // comentário, texto, outra aplicação ou extensão desconhecida
    }

    /** Só o contador de repetições ({@code 03 01 lo hi}) fica; o resto da extensão (buffer e afins) sai. */
    private static int netscape(byte[] gif, int pos, ByteArrayOutputStream saida) {
        int[] repeticoes = null;
        while (true) {
            exigir(gif, pos, 1);
            int tamanho = gif[pos++] & 0xFF;
            if (tamanho == 0) {
                break;
            }
            exigir(gif, pos, tamanho);
            if (tamanho == 3 && gif[pos] == 1 && repeticoes == null) {
                repeticoes = new int[] {gif[pos + 1] & 0xFF, gif[pos + 2] & 0xFF};
            }
            pos += tamanho;
        }
        if (repeticoes != null) {
            byte[] bloco = {0x21, (byte) 0xFF, 11, 'N', 'E', 'T', 'S', 'C', 'A', 'P', 'E', '2', '.', '0', 3, 1,
                    (byte) repeticoes[0], (byte) repeticoes[1], 0};
            saida.write(bloco, 0, bloco.length);
        }
        return pos;
    }

    private static int copiarSubBlocos(byte[] gif, int pos, ByteArrayOutputStream saida) {
        while (true) {
            exigir(gif, pos, 1);
            int tamanho = gif[pos] & 0xFF;
            exigir(gif, pos, 1 + tamanho);
            saida.write(gif, pos, 1 + tamanho);
            pos += 1 + tamanho;
            if (tamanho == 0) {
                return pos;
            }
        }
    }

    private static int pularSubBlocos(byte[] gif, int pos) {
        while (true) {
            exigir(gif, pos, 1);
            int tamanho = gif[pos++] & 0xFF;
            if (tamanho == 0) {
                return pos;
            }
            exigir(gif, pos, tamanho);
            pos += tamanho;
        }
    }

    private static void conferirLados(int largura, int altura, int ladoMaximo) {
        if (largura < 1 || altura < 1 || largura > ladoMaximo || altura > ladoMaximo) {
            throw new IllegalArgumentException("GIF fora do tamanho aceito.");
        }
    }

    private static void exigir(byte[] gif, int pos, int quantos) {
        if (pos < 0 || quantos < 0 || pos + (long) quantos > gif.length) {
            throw new IllegalArgumentException("GIF truncado.");
        }
    }

    private static int u16(byte[] b, int i) {
        return (b[i] & 0xFF) | ((b[i + 1] & 0xFF) << 8);
    }
}
