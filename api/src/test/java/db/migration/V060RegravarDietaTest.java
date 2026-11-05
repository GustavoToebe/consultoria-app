package db.migration;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.HashMap;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class V060RegravarDietaTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Test
    void marcaSoOItemDeAlimentoENaoTocaSuplementoNemErgogenico() {
        String dieta = """
                {"refeicoes":[{"nome":"Almoço","opcoes":[{"itens":[
                  {"nome":"Arroz branco cozido","unidade":"g","quantidade":100,"kcal":128}]}]}],
                 "suplementacao":[{"nome":"Creatina","porcao":"3 g"}],
                 "ergogenicos":[{"nome":"Cafeína","observacao":"antes do treino"}]}
                """;

        JsonNode saida = JSON.readTree(V060__fatores_estimados_nativos.regravar(dieta, UUID.randomUUID(), new HashMap<>()));

        JsonNode item = saida.at("/refeicoes/0/opcoes/0/itens/0");
        assertThat(item.has("fatorCorrecao")).isTrue();
        assertThat(item.has("fatorCoccao")).isTrue();
        assertThat(saida.at("/refeicoes/0").has("fatorCorrecao")).isFalse();
        assertThat(saida.at("/suplementacao/0").has("fatorCorrecao")).isFalse();
        assertThat(saida.at("/ergogenicos/0").has("fatorCoccao")).isFalse();
    }

    @Test
    void textoVazioOuQueNaoEObjetoNaoMuda() {
        assertThat(V060__fatores_estimados_nativos.regravar(null, UUID.randomUUID(), new HashMap<>())).isNull();
        assertThat(V060__fatores_estimados_nativos.regravar("[]", UUID.randomUUID(), new HashMap<>())).isNull();
    }
}
