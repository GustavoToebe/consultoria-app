package br.com.treinos.api.dieta;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
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

/** Plano de dieta: mesmo ciclo do treino, com o validador próprio e a leitura pelo aluno. */
@AutoConfigureMockMvc
class DietaIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;

    @Test
    void dietaDaReceitaValidaPublicaEChegaAoAluno() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício");
        JsonNode alunoLogado = api.convidarEEntrar(treinador, aluno);
        assertThat(api.get("/aluno/dieta", alunoLogado, 200).get("dieta").isNull()).isTrue();

        String receita = api.get("/receitas?tipo=PLANO_DIETA", treinador, 200).get(0).get("id").asString();
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", treinador,
                Map.of("titulo", "Dieta de teste", "receitaId", receita), 200);
        String id = plano.get("plano").get("id").asString();
        assertThat(plano.get("rascunho").get("refeicoes")).hasSize(5);

        // Da receita, as opções vêm sem itens: erro em cada uma.
        JsonNode validacao = api.post("/planos-dieta/" + id + "/validar", treinador, null, 200);
        assertThat(validacao.get("erros")).hasSize(5);

        ConteudoDieta conteudo = new ConteudoDieta("Objetivo fictício", "2026-10-05", "Treinador Teste", List.of(
                refeicao("Café da manhã", "07:00", List.of(
                        new Opcao(UUID.randomUUID(), "A", List.of(item("Pão de forma branco", "50", "133"))),
                        new Opcao(UUID.randomUUID(), "B", List.of(item("Iogurte desnatado", "170", "61.2"))))),
                refeicao("Almoço", "12:00", List.of(new Opcao(UUID.randomUUID(), "A", List.of(
                        item("Arroz branco cozido", "150", "191.7"),
                        new Item(UUID.randomUUID(), null, "Legumes", new BigDecimal("100"), "g", new BigDecimal("45"),
                                null, null, null, true)))))),
                List.of(new ConteudoDieta.Orientacao("Hidratação", "3 a 4 litros de água")),
                "Texto livre", List.of());
        JsonNode salvo = api.put("/planos-dieta/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Dieta de teste", conteudo, plano.get("plano").get("versao").asLong()), 200);
        assertThat(api.post("/planos-dieta/" + id + "/validar", treinador, null, 200).get("erros")).isEmpty();
        api.post("/planos-dieta/" + id + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", false), 200);

        JsonNode dieta = api.get("/aluno/dieta", alunoLogado, 200).get("dieta");
        assertThat(dieta.get("numero").asInt()).isEqualTo(1);
        assertThat(dieta.get("conteudo").get("refeicoes").get(0).get("opcoes")).hasSize(2);
        assertThat(dieta.get("conteudo").get("suplementacao")).isEmpty();
    }

    @Test
    void validadorDaDietaApontaCadaProblema() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício");
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", treinador, Map.of("titulo", "Dieta"), 200);
        String id = plano.get("plano").get("id").asString();
        UUID repetido = UUID.randomUUID();
        ConteudoDieta ruim = new ConteudoDieta(null, null, null, List.of(
                new Refeicao(repetido, "Jantar", "25:00", null, List.of(new Opcao(UUID.randomUUID(), "A", List.of(
                        new Item(UUID.randomUUID(), null, "", BigDecimal.ZERO, "kg", null, null, null, null, true),
                        new Item(UUID.randomUUID(), null, "Negativo", BigDecimal.ONE, "g", new BigDecimal("-1"),
                                null, null, null, false))))),
                new Refeicao(repetido, "jantar", null, null, List.of())), List.of(), null, List.of());
        api.put("/planos-dieta/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Dieta", ruim, plano.get("plano").get("versao").asLong()), 200);
        JsonNode v = api.post("/planos-dieta/" + id + "/validar", treinador, null, 200);
        assertThat(v.get("erros").valueStream().map(e -> e.get("caminho").asString())).contains(
                "refeicoes[0].horario", "refeicoes[0].opcoes[0].itens[0].nome",
                "refeicoes[0].opcoes[0].itens[0].quantidade", "refeicoes[0].opcoes[0].itens[0].unidade",
                "refeicoes[0].opcoes[0].itens[0].kcal", "refeicoes[0].opcoes[0].itens[1]",
                "refeicoes[1].uid", "refeicoes[1].opcoes");
        // Nome repetido (ignorando maiúsculas) é aviso, não erro.
        assertThat(v.get("avisos").valueStream().map(e -> e.get("caminho").asString()))
                .containsExactly("refeicoes[1].nome");
    }

    private static Refeicao refeicao(String nome, String horario, List<Opcao> opcoes) {
        return new Refeicao(UUID.randomUUID(), nome, horario, null, opcoes);
    }

    private static Item item(String nome, String quantidade, String kcal) {
        return new Item(UUID.randomUUID(), UUID.randomUUID(), nome, new BigDecimal(quantidade), "g",
                new BigDecimal(kcal), BigDecimal.ONE, BigDecimal.TEN, BigDecimal.ZERO, false);
    }
}
