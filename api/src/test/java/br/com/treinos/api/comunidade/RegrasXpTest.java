package br.com.treinos.api.comunidade;

import br.com.treinos.api.comunidade.RegrasXp.RecordeDoDia;
import br.com.treinos.api.comunidade.RegrasXp.SemanaDoPlano;
import br.com.treinos.api.comunidade.RegrasXp.SessaoDoDia;
import br.com.treinos.api.comunidade.RegrasXp.Xp;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regra pura do XP, sem banco. Lê as mesmas fixtures de {@code paridade-xp/} que {@code app/src/dominio/xp.test.ts}
 * (geradas por {@code scripts/xp/gerar-fixtures.mjs}): os dois lados têm de dar o mesmo resultado. Dados fictícios.
 */
class RegrasXpTest {

    private final JsonMapper json = JsonMapper.builder().build();

    private JsonNode fixture() throws IOException {
        try (InputStream in = getClass().getResourceAsStream("/paridade-xp/casos.json")) {
            assertThat(in).as("fixture paridade-xp/casos.json").isNotNull();
            return json.readTree(in);
        }
    }

    @Test
    void constantesIguaisAsDaFixture() throws IOException {
        JsonNode k = fixture().get("constantes");
        assertThat(RegrasXp.XP_TREINO_COMPLETO).isEqualTo(k.get("treinoCompleto").asInt());
        assertThat(RegrasXp.XP_TREINO_PARCIAL).isEqualTo(k.get("treinoParcial").asInt());
        assertThat(RegrasXp.XP_SEMANA_COMPLETA).isEqualTo(k.get("semanaCompleta").asInt());
        assertThat(RegrasXp.XP_CONQUISTA).isEqualTo(k.get("conquista").asInt());
        assertThat(RegrasXp.XP_RECORDE).isEqualTo(k.get("recorde").asInt());
        assertThat(RegrasXp.XP_POR_NIVEL).isEqualTo(k.get("porNivel").asInt());
    }

    @Test
    void nivelNasBordas() throws IOException {
        JsonNode niveis = fixture().get("niveis");
        assertThat(niveis.size()).isGreaterThan(5);
        for (JsonNode n : niveis) {
            assertThat(RegrasXp.nivel(n.get("xp").asLong())).as("xp " + n.get("xp").asLong()).isEqualTo(n.get("nivel").asInt());
        }
    }

    @Test
    void semanaCompletaExigeTreinoPrevistoEFeito() {
        assertThat(RegrasXp.semanaCompleta(0, 0)).isFalse();
        assertThat(RegrasXp.semanaCompleta(2, 3)).isFalse();
        assertThat(RegrasXp.semanaCompleta(3, 3)).isTrue();
        assertThat(RegrasXp.semanaCompleta(4, 3)).isTrue();
    }

    @TestFactory
    Stream<DynamicTest> casosDeParidade() throws IOException {
        JsonNode casos = fixture().get("casos");
        assertThat(casos.size()).isGreaterThan(20);
        return casos.valueStream().map(caso -> DynamicTest.dynamicTest(caso.get("nome").asString(), () -> {
            JsonNode e = caso.get("entrada");
            Xp r = RegrasXp.calcular(sessoes(e.get("sessoes")), semanas(e.get("semanas")),
                    e.get("conquistas").valueStream().map(JsonNode::asString).toList(), recordes(e.get("recordes")));
            JsonNode esperado = caso.get("esperado");
            assertThat(r).isEqualTo(new Xp(esperado.get("xp").asLong(), esperado.get("nivel").asInt(),
                    esperado.get("xpNoNivel").asInt(), esperado.get("faltam").asInt()));
        }));
    }

    private static List<SessaoDoDia> sessoes(JsonNode lista) {
        List<SessaoDoDia> r = new ArrayList<>();
        for (JsonNode s : lista) {
            r.add(new SessaoDoDia(LocalDate.parse(s.get("data").asString()), s.get("concluida").asBoolean(),
                    s.get("resultado").isNull() ? null : s.get("resultado").asString()));
        }
        return r;
    }

    private static List<SemanaDoPlano> semanas(JsonNode lista) {
        List<SemanaDoPlano> r = new ArrayList<>();
        for (JsonNode s : lista) {
            r.add(new SemanaDoPlano(LocalDate.parse(s.get("inicio").asString()), s.get("feitas").asInt(), s.get("total").asInt()));
        }
        return r;
    }

    private static List<RecordeDoDia> recordes(JsonNode lista) {
        List<RecordeDoDia> r = new ArrayList<>();
        for (JsonNode s : lista) {
            r.add(new RecordeDoDia(LocalDate.parse(s.get("data").asString()), s.get("exercicioId").asString()));
        }
        return r;
    }
}
