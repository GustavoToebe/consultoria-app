package br.com.treinos.api.treino;

import br.com.treinos.api.treino.ConteudoTreino.Carga;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * O {@code valorKg} da carga fixa sai do JSON só quando existe: o pacote salvo no aparelho é conferido chave a chave
 * ({@code formatoDoPacote} no app), e um app que ainda não o conhece não pode recusar o plano de sempre.
 */
class CargaJsonTest {

    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    void valorKgSoApareceNaCargaFixa() throws Exception {
        assertThat(json.writeValueAsString(Carga.de("CARGA_TRABALHO"))).doesNotContain("valorKg");
        assertThat(json.writeValueAsString(Carga.percentual("PERCENTUAL_WS", 85, 90))).doesNotContain("valorKg");

        Carga fixa = Carga.fixa(new BigDecimal("12"));
        String texto = json.writeValueAsString(fixa);
        assertThat(texto).contains("\"modo\":\"CARGA_FIXA\"").contains("\"valorKg\":12");
        assertThat(json.readValue(texto, Carga.class)).isEqualTo(fixa);
        // Carga sem a chave (plano de antes) continua sendo lida.
        assertThat(json.readValue("{\"modo\":\"CARGA_TRABALHO\"}", Carga.class)).isEqualTo(Carga.de("CARGA_TRABALHO"));
    }
}
