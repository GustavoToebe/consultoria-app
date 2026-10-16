package br.com.treinos.api.fotos;

import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Imagens geradas na hora (quadrados coloridos). A conferência é nos bytes: o que sai não tem APP1/EXIF, comentário nem APP13. */
class JpegSemMetadadosTest {

    private static void assertCorParecida(Color obtida, Color esperada) {
        assertThat(Math.abs(obtida.getRed() - esperada.getRed())).isLessThan(24);
        assertThat(Math.abs(obtida.getGreen() - esperada.getGreen())).isLessThan(24);
        assertThat(Math.abs(obtida.getBlue() - esperada.getBlue())).isLessThan(24);
    }

    @Test
    void tiraExifComentarioEApp13MasMantemAImagem() {
        byte[] original = FotosDeTeste.jpeg(Color.RED);
        byte[] suja = FotosDeTeste.comMetadados(original);
        assertThat(FotosDeTeste.contem(suja, "Exif")).isTrue();
        assertThat(JpegSemMetadados.temMetadados(suja)).isTrue();

        byte[] limpa = JpegSemMetadados.limpar(suja);

        assertThat(FotosDeTeste.contem(limpa, "Exif")).isFalse();
        assertThat(FotosDeTeste.contem(limpa, FotosDeTeste.MARCA_EXIF)).isFalse();
        assertThat(FotosDeTeste.contem(limpa, "Photoshop")).isFalse();
        assertThat(JpegSemMetadados.temMetadados(limpa)).isFalse();
        // Os dados da imagem são os mesmos, byte a byte: nada foi recomprimido.
        assertThat(limpa).isEqualTo(JpegSemMetadados.limpar(original));
        assertCorParecida(FotosDeTeste.corDoPixelCentral(limpa), Color.RED);
    }

    @Test
    void jpegProgressivoTambemPassaEFicaLegivel() {
        byte[] progressivo = FotosDeTeste.jpeg(Color.BLUE, 96, true);
        byte[] limpa = JpegSemMetadados.limpar(FotosDeTeste.comMetadados(progressivo));
        assertThat(JpegSemMetadados.temMetadados(limpa)).isFalse();
        assertCorParecida(FotosDeTeste.corDoPixelCentral(limpa), Color.BLUE);
    }

    @Test
    void oQueVemDepoisDoFimDaImagemNaoEGuardado() {
        byte[] original = FotosDeTeste.jpeg(Color.GREEN);
        byte[] comRabo = Arrays.copyOf(original, original.length + 40);
        byte[] segredo = ("rabo-escondido-" + FotosDeTeste.MARCA_EXIF).getBytes(java.nio.charset.StandardCharsets.ISO_8859_1);
        System.arraycopy(segredo, 0, comRabo, original.length, Math.min(40, segredo.length));
        byte[] limpa = JpegSemMetadados.limpar(comRabo);
        assertThat(FotosDeTeste.contem(limpa, "rabo-escondido")).isFalse();
        assertThat(limpa).isEqualTo(JpegSemMetadados.limpar(original));
    }

    @Test
    void recusaOQueNaoEJpegInteiro() {
        byte[] jpeg = FotosDeTeste.jpeg(Color.RED);
        byte[] png = new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};
        assertThatThrownBy(() -> JpegSemMetadados.limpar(png)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> JpegSemMetadados.limpar(new byte[0])).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> JpegSemMetadados.limpar("<svg onload=alert(1)>".getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                .isInstanceOf(IllegalArgumentException.class);
        // Cortado no meio dos dados (sem EOI).
        assertThatThrownBy(() -> JpegSemMetadados.limpar(Arrays.copyOf(jpeg, jpeg.length / 2)))
                .isInstanceOf(IllegalArgumentException.class);
        // Só o cabeçalho, sem quadro nem varredura.
        assertThatThrownBy(() -> JpegSemMetadados.limpar(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xD9}))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void recusaImagemGrandeDemaisEmPixels() {
        byte[] jpeg = FotosDeTeste.jpeg(Color.RED, 64, false).clone();
        // Troca a largura e a altura do quadro (SOF0) por 5000 px: um JPEG pequeno que descomprimiria enorme.
        int sof = -1;
        for (int i = 0; i < jpeg.length - 1; i++) {
            if ((jpeg[i] & 0xFF) == 0xFF && (jpeg[i + 1] & 0xFF) == 0xC0) {
                sof = i;
                break;
            }
        }
        assertThat(sof).isPositive();
        jpeg[sof + 5] = (byte) (5000 >> 8);
        jpeg[sof + 6] = (byte) (5000 & 0xFF);
        jpeg[sof + 7] = (byte) (5000 >> 8);
        jpeg[sof + 8] = (byte) (5000 & 0xFF);
        assertThatThrownBy(() -> JpegSemMetadados.limpar(jpeg)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void marcadorDesconhecidoNaoPassa() {
        byte[] jpeg = FotosDeTeste.jpeg(Color.RED);
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        saida.write(jpeg, 0, 2);
        FotosDeTeste.segmento(saida, 0xC3, new byte[8]); // SOF3: sem perda, não suportado
        saida.write(jpeg, 2, jpeg.length - 2);
        assertThatThrownBy(() -> JpegSemMetadados.limpar(saida.toByteArray())).isInstanceOf(IllegalArgumentException.class);
    }
}
