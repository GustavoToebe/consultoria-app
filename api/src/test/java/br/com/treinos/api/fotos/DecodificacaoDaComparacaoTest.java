package br.com.treinos.api.fotos;

import br.com.treinos.api.fotos.ComparacaoDeFotosService.Alvo;
import br.com.treinos.api.web.ValidacaoException;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Decodificação das fotos da comparação, sem Spring e sem bucket: só quadrados coloridos. */
class DecodificacaoDaComparacaoTest {

    @Test
    void fotoMuitoMaiorQueOQuadroEDecodificadaReduzidaMasAindaCobreOLugar() {
        byte[] jpeg = FotosDeTeste.jpeg(Color.BLUE, 4000, false);
        var stories = LayoutDaComparacao.montar(LayoutDaComparacao.Formato.STORIES, 1, false, 0, 0).fotos().get(0);

        BufferedImage imagem = ComparacaoDeFotosService.decodificar(jpeg, List.of(new Alvo(stories.largura(), stories.altura())));

        assertThat(imagem.getWidth()).isLessThan(4000);
        assertThat(imagem.getHeight()).isLessThan(4000);
        // O recorte que cobre o lugar continua com pelo menos o tamanho dele: nada é ampliado depois.
        assertThat(imagem.getHeight()).isGreaterThanOrEqualTo(stories.altura());
        assertThat(imagem.getWidth() * stories.altura() / (double) imagem.getHeight()).isGreaterThanOrEqualTo(stories.largura());
    }

    @Test
    void jpegProgressivoTambemEDecodificadoReduzido() {
        byte[] jpeg = FotosDeTeste.jpeg(Color.ORANGE, 4000, true);
        var stories = LayoutDaComparacao.montar(LayoutDaComparacao.Formato.STORIES, 1, false, 0, 0).fotos().get(0);

        BufferedImage imagem = ComparacaoDeFotosService.decodificar(jpeg, List.of(new Alvo(stories.largura(), stories.altura())));

        assertThat(imagem.getWidth()).isLessThan(4000);
        assertThat(imagem.getHeight()).isGreaterThanOrEqualTo(stories.altura());
        assertThat(imagem.getWidth()).isGreaterThanOrEqualTo(stories.largura());
    }

    @Test
    void oMaiorAlvoDecideEFotoPequenaFicaComoEstava() {
        byte[] grande = FotosDeTeste.jpeg(Color.GREEN, 3000, false);
        BufferedImage pequeno = ComparacaoDeFotosService.decodificar(grande, List.of(new Alvo(200, 200)));
        BufferedImage dois = ComparacaoDeFotosService.decodificar(grande, List.of(new Alvo(200, 200), new Alvo(1500, 1500)));
        assertThat(pequeno.getWidth()).isLessThan(dois.getWidth());
        assertThat(dois.getWidth()).isGreaterThanOrEqualTo(1500);

        byte[] miudo = FotosDeTeste.jpeg(Color.RED, 64, false);
        BufferedImage inteira = ComparacaoDeFotosService.decodificar(miudo, List.of(new Alvo(540, 1920)));
        assertThat(inteira.getWidth()).isEqualTo(64);
        assertThat(inteira.getHeight()).isEqualTo(64);
    }

    @Test
    void bytesQueNaoSaoImagemViramImagemInvalida() {
        assertThatThrownBy(() -> ComparacaoDeFotosService.decodificar(new byte[] {1, 2, 3, 4}, List.of(new Alvo(100, 100))))
                .isInstanceOf(ValidacaoException.class);
    }

    @Test
    void imageIoNaoGravaArquivoTemporarioParaOStream() throws Exception {
        // Dado de aluno não vai para o disco: o cache do ImageIO (padrão do JDK) cria arquivo temporário.
        Class.forName(ComparacaoDeFotosService.class.getName(), true, getClass().getClassLoader());
        assertThat(ImageIO.getUseCache()).isFalse();
    }
}
