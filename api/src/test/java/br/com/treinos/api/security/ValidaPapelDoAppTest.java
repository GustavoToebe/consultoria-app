package br.com.treinos.api.security;

import br.com.treinos.api.TreinosApiApplication;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ValidaPapelDoAppTest {

    private final ValidaPapelDoApp validador = new ValidaPapelDoApp();

    private void validar(String propriedade, String valor) {
        validador.postProcessEnvironment(new MockEnvironment().withProperty(propriedade, valor), null);
    }

    @Test
    void aceitaIdentificadorSimplesEVazio() {
        for (String propriedade : ValidaPapelDoApp.PROPRIEDADES) {
            for (String ok : new String[] {"consultoria_app", "_app", "App9", ""}) {
                assertThatCode(() -> validar(propriedade, ok)).as(propriedade + "=" + ok).doesNotThrowAnyException();
            }
        }
        assertThatCode(() -> validador.postProcessEnvironment(new MockEnvironment(), null)).doesNotThrowAnyException();
    }

    @Test
    void recusaOQueNaoEIdentificadorSemRepetirOValor() {
        for (String propriedade : ValidaPapelDoApp.PROPRIEDADES) {
            for (String ruim : new String[] {"1app", "app-x", "app x", "a'; DROP TABLE x; --", "app\n", "açai"}) {
                assertThatThrownBy(() -> validar(propriedade, ruim)).as(propriedade + "=" + ruim)
                        .isInstanceOf(IllegalStateException.class)
                        .hasMessageContaining("PLATAFORMA_PAPEL_APP")
                        .satisfies(e -> assertThat(e.getMessage()).doesNotContain("DROP"));
            }
        }
    }

    /** Registrado no spring.factories: a subida real cai antes de tocar no banco. */
    @Test
    void subidaRealCaiAntesDeMigrarQuandoOPapelENaoEIdentificador() {
        assertThatThrownBy(() -> new SpringApplicationBuilder(TreinosApiApplication.class)
                .web(WebApplicationType.NONE)
                .properties("PLATAFORMA_PAPEL_APP=app-invalido")
                .run().close())
                .hasStackTraceContaining("PLATAFORMA_PAPEL_APP inválida");
    }
}
