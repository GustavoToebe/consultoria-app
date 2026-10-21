package br.com.treinos.api.fotos;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** GIFs de mentira montados à mão (1x1, ou com o tamanho só no cabeçalho): nenhuma imagem de pessoa. */
class GifSemMetadadosTest {

    static final String COMENTARIO = "COMENTARIO-FICTICIO-GPS-23.55S";
    static final String TEXTO = "TEXTO-SIMPLES-FICTICIO";
    static final String XMP = "XMP-FICTICIO-AUTOR";

    /** Quadro 1x1 válido (dados LZW de um pixel), com o controle de quadro à frente. */
    private static void quadro(ByteArrayOutputStream s, int atrasoCentesimos) {
        s.write(new byte[] {0x21, (byte) 0xF9, 0x04, 0x00, (byte) atrasoCentesimos, 0x00, 0x00, 0x00}, 0, 8);
        s.write(new byte[] {0x2C, 0, 0, 0, 0, 1, 0, 1, 0, 0}, 0, 10);
        s.write(new byte[] {0x02, 0x02, 0x44, 0x01, 0x00}, 0, 5);
    }

    private static void subBlocos(ByteArrayOutputStream s, String texto) {
        byte[] b = texto.getBytes(StandardCharsets.ISO_8859_1);
        s.write(b.length);
        s.write(b, 0, b.length);
        s.write(0);
    }

    private static void netscape(ByteArrayOutputStream s, int repeticoes) {
        s.write(new byte[] {0x21, (byte) 0xFF, 11}, 0, 3);
        s.write("NETSCAPE2.0".getBytes(StandardCharsets.ISO_8859_1), 0, 11);
        s.write(new byte[] {3, 1, (byte) (repeticoes & 0xFF), (byte) (repeticoes >> 8), 0}, 0, 5);
    }

    private static void aplicacao(ByteArrayOutputStream s, String id11, String dados) {
        s.write(new byte[] {0x21, (byte) 0xFF, 11}, 0, 3);
        s.write(id11.getBytes(StandardCharsets.ISO_8859_1), 0, 11);
        subBlocos(s, dados);
    }

    /** Cabeçalho + tela; 2 cores na tabela global. Daí o chamador acrescenta blocos e o final. */
    private static ByteArrayOutputStream cabecalho(int largura, int altura) {
        ByteArrayOutputStream s = new ByteArrayOutputStream();
        s.write("GIF89a".getBytes(StandardCharsets.ISO_8859_1), 0, 6);
        s.write(new byte[] {(byte) (largura & 0xFF), (byte) (largura >> 8), (byte) (altura & 0xFF), (byte) (altura >> 8),
                (byte) 0x80, 0, 0}, 0, 7);
        s.write(new byte[] {0, 0, 0, (byte) 0xFF, (byte) 0xFF, (byte) 0xFF}, 0, 6);
        return s;
    }

    private static byte[] sujo(int quadros) {
        ByteArrayOutputStream s = cabecalho(1, 1);
        netscape(s, 0);
        s.write(new byte[] {0x21, (byte) 0xFE}, 0, 2);
        subBlocos(s, COMENTARIO);
        aplicacao(s, "XMP DataXMP", XMP);
        s.write(new byte[] {0x21, 0x01, 12, 0, 0, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0}, 0, 15); // texto simples (cabeçalho de 12 bytes)
        subBlocos(s, TEXTO);
        for (int i = 0; i < quadros; i++) {
            quadro(s, 10 + i);
        }
        s.write(0x3B);
        s.write("LIXO-DEPOIS-DO-FINAL".getBytes(StandardCharsets.ISO_8859_1), 0, 20);
        return s.toByteArray();
    }

    private static boolean contem(byte[] gif, String texto) {
        return contem(gif, texto.getBytes(StandardCharsets.ISO_8859_1));
    }

    private static boolean contem(byte[] gif, byte[] trecho) {
        for (int i = 0; i + trecho.length <= gif.length; i++) {
            if (Arrays.equals(Arrays.copyOfRange(gif, i, i + trecho.length), trecho)) {
                return true;
            }
        }
        return false;
    }

    private static int quadrosLidos(byte[] gif) throws IOException {
        ImageReader leitor = ImageIO.getImageReadersByFormatName("gif").next();
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(gif))) {
            leitor.setInput(in);
            return leitor.getNumImages(true);
        } finally {
            leitor.dispose();
        }
    }

    @Test
    void tiraComentarioTextoAplicacaoELixoEMantemSoOLoopEOsQuadros() throws IOException {
        byte[] suja = sujo(3);
        assertThat(contem(suja, COMENTARIO)).isTrue();
        assertThat(contem(suja, XMP)).isTrue();

        byte[] limpa = GifSemMetadados.limpar(suja, 800);

        assertThat(contem(limpa, COMENTARIO)).isFalse();
        assertThat(contem(limpa, TEXTO)).isFalse();
        assertThat(contem(limpa, XMP)).isFalse();
        assertThat(contem(limpa, "XMP Data")).isFalse();
        assertThat(contem(limpa, "LIXO-DEPOIS")).isFalse();
        assertThat(contem(limpa, "NETSCAPE2.0")).isTrue();
        assertThat(limpa[limpa.length - 1]).isEqualTo((byte) 0x3B);
        assertThat(limpa.length).isLessThan(suja.length);
        // Continua um GIF que o decodificador lê, ainda animado, com os mesmos três quadros.
        assertThat(quadrosLidos(limpa)).isEqualTo(3);
        BufferedImage primeiro = ImageIO.read(new ByteArrayInputStream(limpa));
        assertThat(primeiro.getWidth()).isEqualTo(1);
    }

    @Test
    void guardaOTempoDeCadaQuadroEORepeticaoDoLoop() {
        ByteArrayOutputStream s = cabecalho(1, 1);
        netscape(s, 5);
        quadro(s, 7);
        quadro(s, 33);
        s.write(0x3B);

        byte[] limpa = GifSemMetadados.limpar(s.toByteArray(), 800);

        assertThat(limpa).isEqualTo(s.toByteArray()); // GIF já limpo passa idêntico
        assertThat(contem(limpa, new byte[] {3, 1, 5, 0, 0})).isTrue();
        assertThat(contem(limpa, new byte[] {0x21, (byte) 0xF9, 0x04, 0x00, 33, 0x00})).isTrue();
    }

    @Test
    void semExtensoesNadaMudaELimparDeNovoDaOMesmo() {
        ByteArrayOutputStream s = cabecalho(1, 1);
        quadro(s, 0);
        s.write(0x3B);
        byte[] original = s.toByteArray();

        byte[] uma = GifSemMetadados.limpar(original, 800);

        assertThat(uma).isEqualTo(original);
        assertThat(GifSemMetadados.limpar(sujo(2), 800)).isEqualTo(GifSemMetadados.limpar(GifSemMetadados.limpar(sujo(2), 800), 800));
    }

    @Test
    void gifTruncadoESemFinalSaoRecusados() {
        byte[] inteiro = GifSemMetadados.limpar(sujo(2), 800);
        // Sem o byte final.
        assertThatThrownBy(() -> GifSemMetadados.limpar(Arrays.copyOf(inteiro, inteiro.length - 1), 800))
                .isInstanceOf(IllegalArgumentException.class);
        // Cortado no meio dos dados de um quadro.
        assertThatThrownBy(() -> GifSemMetadados.limpar(Arrays.copyOf(inteiro, inteiro.length - 9), 800))
                .isInstanceOf(IllegalArgumentException.class);
        // Só o cabeçalho.
        assertThatThrownBy(() -> GifSemMetadados.limpar(Arrays.copyOf(inteiro, 8), 800))
                .isInstanceOf(IllegalArgumentException.class);
        // Sem nenhum quadro.
        ByteArrayOutputStream vazio = cabecalho(1, 1);
        vazio.write(0x3B);
        assertThatThrownBy(() -> GifSemMetadados.limpar(vazio.toByteArray(), 800)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void pngRenomeadoGifNaoPassaPorqueOTipoVemDosBytes() throws IOException {
        BufferedImage imagem = new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB);
        imagem.getGraphics().setColor(Color.RED);
        ByteArrayOutputStream png = new ByteArrayOutputStream();
        ImageIO.write(imagem, "png", png);

        assertThat(GifSemMetadados.ehGif(png.toByteArray())).isFalse();
        assertThatThrownBy(() -> GifSemMetadados.limpar(png.toByteArray(), 800)).isInstanceOf(IllegalArgumentException.class);
        assertThat(GifSemMetadados.ehGif("GIF8".getBytes(StandardCharsets.ISO_8859_1))).isFalse();
        assertThat(GifSemMetadados.ehGif(null)).isFalse();
    }

    @Test
    void telaOuQuadroMaioresQueOLimiteSaoRecusados() {
        ByteArrayOutputStream grande = cabecalho(801, 10);
        quadro(grande, 0);
        grande.write(0x3B);
        assertThatThrownBy(() -> GifSemMetadados.limpar(grande.toByteArray(), 800)).isInstanceOf(IllegalArgumentException.class);
        assertThat(GifSemMetadados.limpar(grande.toByteArray(), 801)).isNotEmpty();

        // Tela de 800, mas o quadro declara 900 de largura.
        ByteArrayOutputStream quadroGrande = cabecalho(800, 10);
        quadroGrande.write(new byte[] {0x2C, 0, 0, 0, 0, (byte) (900 & 0xFF), (byte) (900 >> 8), 1, 0, 0}, 0, 10);
        quadroGrande.write(new byte[] {0x02, 0x02, 0x44, 0x01, 0x00, 0x3B}, 0, 6);
        assertThatThrownBy(() -> GifSemMetadados.limpar(quadroGrande.toByteArray(), 800)).isInstanceOf(IllegalArgumentException.class);

        ByteArrayOutputStream semTamanho = cabecalho(0, 0);
        quadro(semTamanho, 0);
        semTamanho.write(0x3B);
        assertThatThrownBy(() -> GifSemMetadados.limpar(semTamanho.toByteArray(), 800)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void blocoDesconhecidoEControleDeQuadroTortoSaoRecusados() {
        ByteArrayOutputStream desconhecido = cabecalho(1, 1);
        desconhecido.write(0x42);
        assertThatThrownBy(() -> GifSemMetadados.limpar(desconhecido.toByteArray(), 800)).isInstanceOf(IllegalArgumentException.class);

        ByteArrayOutputStream controle = cabecalho(1, 1);
        controle.write(new byte[] {0x21, (byte) 0xF9, 0x09, 0, 0, 0, 0, 0}, 0, 8);
        assertThatThrownBy(() -> GifSemMetadados.limpar(controle.toByteArray(), 800)).isInstanceOf(IllegalArgumentException.class);
    }
}
