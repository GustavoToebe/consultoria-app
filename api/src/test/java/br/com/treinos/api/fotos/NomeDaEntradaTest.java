package br.com.treinos.api.fotos;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Nome curto da pose no ZIP. Sem desenhar e sem arquivo. */
class NomeDaEntradaTest {

    @Test
    void poseViraNomeCurtoNaOrdemPedida() {
        assertThat(ComparacaoDeFotosService.nomeDaEntrada(1, "Foto de frente, braços colados ao corpo"))
                .isEqualTo("01-frente.jpg");
        assertThat(ComparacaoDeFotosService.nomeDaEntrada(2, "Foto de costas, braços colados ao corpo"))
                .isEqualTo("02-costas.jpg");
        assertThat(ComparacaoDeFotosService.nomeDaEntrada(3, "Foto de lado esquerdo, braços a 90°"))
                .isEqualTo("03-lado-esquerdo.jpg");
        assertThat(ComparacaoDeFotosService.nomeDaEntrada(4, "Foto de lado, braços levantados"))
                .isEqualTo("04-lado.jpg");
        assertThat(ComparacaoDeFotosService.nomeDaEntrada(5, "Foto de lado direito"))
                .isEqualTo("05-lado-direito.jpg");
    }

    @Test
    void livreEJejumFicamComONomeLongo() {
        assertThat(ComparacaoDeFotosService.poseDoTexto("Foto livre (não obrigatória)")).isNull();
        assertThat(ComparacaoDeFotosService.nomeDaEntrada(1, "Fotos em jejum")).isEqualTo("01-fotos-em-jejum.jpg");
        assertThat(ComparacaoDeFotosService.nomeDaEntrada(2, "Foto livre (não obrigatória)"))
                .isEqualTo("02-foto-livre-nao-obrigatoria.jpg");
    }
}
