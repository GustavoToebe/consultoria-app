package br.com.treinos.api.dieta;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.AlimentoRequest;
import br.com.treinos.api.dieta.ConteudoDieta.Item;
import br.com.treinos.api.dieta.ConteudoDieta.Opcao;
import br.com.treinos.api.dieta.ConteudoDieta.Refeicao;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Fator de correção e de cocção (lista de compras do aluno, reunião de 17/10): ficam na biblioteca da consultoria,
 * opcionais e conferidos no servidor; a publicação da dieta copia os valores do momento para a versão imutável, sem
 * mexer no rascunho. Alimentos e valores fictícios.
 */
@AutoConfigureMockMvc
class FatoresDosAlimentosIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;

    @Test
    void fatoresSaoOpcionaisEConferidosNaBiblioteca() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();

        JsonNode sem = api.post("/alimentos", treinador, alimento("Alimento sem fator", null, null), 200);
        assertThat(sem.get("fatorCorrecao").isNull()).isTrue();
        assertThat(sem.get("fatorCoccao").isNull()).isTrue();

        JsonNode com = api.post("/alimentos", treinador, alimento("Alimento com fator", "1.75", "2.5"), 200);
        assertThat(com.get("fatorCorrecao").decimalValue()).isEqualByComparingTo("1.75");
        assertThat(com.get("fatorCoccao").decimalValue()).isEqualByComparingTo("2.5");

        // Faixas da V011: FC de 1 a 20, FCc de 0,1 a 10, até duas casas. Fora disso, 422 com o campo.
        for (String[] ruim : List.of(new String[] {"0.99", null, "fatorCorrecao"}, new String[] {"20.01", null, "fatorCorrecao"},
                new String[] {"1.234", null, "fatorCorrecao"}, new String[] {null, "0.09", "fatorCoccao"},
                new String[] {null, "10.5", "fatorCoccao"})) {
            JsonNode erro = api.post("/alimentos", treinador, alimento("Alimento recusado", ruim[0], ruim[1]), 422);
            assertThat(erro.get("codigo").asString()).isEqualTo("ALIMENTO_INVALIDO");
            assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo(ruim[2]);
        }

        // Alterar pode tirar o fator (nulo = não informado, nunca 1).
        JsonNode alterado = api.put("/alimentos/" + com.get("id").asString(), treinador,
                alimento("Alimento com fator", null, "0.7"), 200);
        assertThat(alterado.get("fatorCorrecao").isNull()).isTrue();
        assertThat(alterado.get("fatorCoccao").decimalValue()).isEqualByComparingTo("0.7");
    }

    @Test
    void publicarCopiaOsFatoresDaBibliotecaParaAVersaoSemMexerNoRascunho() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        JsonNode outro = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício");
        JsonNode alunoLogado = api.convidarEEntrar(treinador, aluno);

        UUID comFatores = UUID.fromString(api.post("/alimentos", treinador,
                alimento("Cereal fictício cozido", "1.10", "2.50"), 200).get("id").asString());
        UUID semFatores = UUID.fromString(api.post("/alimentos", treinador,
                alimento("Fruta fictícia", null, null), 200).get("id").asString());
        UUID deOutraConsultoria = UUID.fromString(api.post("/alimentos", outro,
                alimento("Alimento de outra consultoria", "3.00", "3.00"), 200).get("id").asString());

        // O cliente manda fatores no item: não valem (a publicação regrava os dois).
        BigDecimal inventado = new BigDecimal("9.99");
        ConteudoDieta conteudo = new ConteudoDieta(null, null, null, List.of(new Refeicao(UUID.randomUUID(), "Almoço",
                "12:00", null, List.of(new Opcao(UUID.randomUUID(), "A", List.of(
                        item(comFatores, "Cereal fictício cozido", null, null),
                        item(semFatores, "Fruta fictícia", inventado, inventado),
                        item(deOutraConsultoria, "Alimento de outra consultoria", null, null),
                        item(null, "Item manual fictício", inventado, inventado)))))),
                List.of(), null, List.of());

        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", treinador, Map.of("titulo", "Dieta"), 200);
        String id = plano.get("plano").get("id").asString();
        JsonNode salvo = api.put("/planos-dieta/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Dieta", conteudo, plano.get("plano").get("versao").asLong()), 200);
        api.post("/planos-dieta/" + id + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);

        JsonNode itens = api.get("/aluno/dieta", alunoLogado, 200).get("dieta").get("conteudo").get("refeicoes").get(0)
                .get("opcoes").get(0).get("itens");
        assertThat(itens.get(0).get("fatorCorrecao").decimalValue()).isEqualByComparingTo("1.10");
        assertThat(itens.get(0).get("fatorCoccao").decimalValue()).isEqualByComparingTo("2.50");
        for (int i = 1; i < 4; i++) {
            assertThat(itens.get(i).get("fatorCorrecao").isNull()).as("item %d", i).isTrue();
            assertThat(itens.get(i).get("fatorCoccao").isNull()).as("item %d", i).isTrue();
        }

        // O rascunho fica como o treinador gravou.
        JsonNode rascunho = api.get("/planos-dieta/" + id, treinador, 200).get("rascunho").get("refeicoes").get(0)
                .get("opcoes").get(0).get("itens");
        assertThat(rascunho.get(0).get("fatorCorrecao").isNull()).isTrue();
        assertThat(rascunho.get(1).get("fatorCorrecao").decimalValue()).isEqualByComparingTo(inventado);

        // Mudar o fator na biblioteca não mexe na versão já publicada (imutável).
        api.put("/alimentos/" + comFatores, treinador, alimento("Cereal fictício cozido", "1.20", null), 200);
        JsonNode v1 = api.get("/planos-dieta/" + id + "/versoes/1", treinador, 200).get("conteudo").get("refeicoes")
                .get(0).get("opcoes").get(0).get("itens").get(0);
        assertThat(v1.get("fatorCorrecao").decimalValue()).isEqualByComparingTo("1.10");
        assertThat(v1.get("fatorCoccao").decimalValue()).isEqualByComparingTo("2.50");
    }

    private static AlimentoRequest alimento(String nome, String fatorCorrecao, String fatorCoccao) {
        return new AlimentoRequest(nome, new BigDecimal("100"), "g", new BigDecimal("100"), BigDecimal.ONE,
                BigDecimal.TEN, BigDecimal.ZERO, null, null, decimal(fatorCorrecao), decimal(fatorCoccao));
    }

    private static BigDecimal decimal(String texto) {
        return texto == null ? null : new BigDecimal(texto);
    }

    private static Item item(UUID alimentoId, String nome, BigDecimal fatorCorrecao, BigDecimal fatorCoccao) {
        return new Item(UUID.randomUUID(), alimentoId, nome, new BigDecimal("100"), "g", new BigDecimal("100"),
                BigDecimal.ONE, BigDecimal.TEN, BigDecimal.ZERO, alimentoId == null, fatorCorrecao, fatorCoccao);
    }
}
