package br.com.treinos.api.cep;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Endereços do serviço de CEP conferidos na subida: https e com {cep}; o erro nunca repete o endereço. */
class CepPropertiesTest {

    @Test
    void vazioUsaOsPadroesHttps() {
        var p = new CepProperties(true, "", null);
        assertThat(p.urlPrincipal()).startsWith("https://").contains("{cep}");
        assertThat(p.urlReserva()).startsWith("https://").contains("{cep}");
    }

    @Test
    void httpForaDoLoopbackEhRecusadoSemRepetirOEndereco() {
        assertThatThrownBy(() -> new CepProperties(true, "http://cep.exemplo.test/segredo-123/{cep}", null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("treinos.cep.url-principal")
                .hasMessageContaining("https")
                .hasMessageNotContaining("segredo-123");
        assertThatThrownBy(() -> new CepProperties(true, null, "ftp://cep.exemplo.test/{cep}"))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("treinos.cep.url-reserva");
    }

    @Test
    void semCepNoModeloOuComEnderecoInvalidoEhRecusado() {
        assertThatThrownBy(() -> new CepProperties(true, "https://cep.exemplo.test/fixo", null))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("{cep}");
        assertThatThrownBy(() -> new CepProperties(true, "https://cep exemplo/{cep}", null))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("url-principal");
        assertThatThrownBy(() -> new CepProperties(true, "/so/caminho/{cep}", null)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void loopbackPodeSerHttpParaOsTestes() {
        var p = new CepProperties(true, "http://127.0.0.1:1234/{cep}", "http://localhost:1234/{cep}");
        assertThat(p.urlPrincipal()).startsWith("http://127.0.0.1");
    }
}
