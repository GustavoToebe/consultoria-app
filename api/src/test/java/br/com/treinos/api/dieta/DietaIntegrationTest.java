package br.com.treinos.api.dieta;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.dieta.ConteudoDieta.Item;
import br.com.treinos.api.dieta.ConteudoDieta.Opcao;
import br.com.treinos.api.dieta.ConteudoDieta.Refeicao;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
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
    @Autowired
    private JdbcTemplate banco;

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
                "Texto livre", List.of(), null, new BigDecimal("3.5"));
        JsonNode salvo = api.put("/planos-dieta/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Dieta de teste", conteudo, plano.get("plano").get("versao").asLong()), 200);
        assertThat(api.post("/planos-dieta/" + id + "/validar", treinador, null, 200).get("erros")).isEmpty();
        api.post("/planos-dieta/" + id + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", false), 200);

        JsonNode dieta = api.get("/aluno/dieta", alunoLogado, 200).get("dieta");
        assertThat(dieta.get("numero").asInt()).isEqualTo(1);
        assertThat(dieta.get("conteudo").get("refeicoes").get(0).get("opcoes")).hasSize(2);
        assertThat(dieta.get("conteudo").get("suplementacao")).isEmpty();
        // A água por dia é só o número que o treinador escreveu, e chega igual ao aluno.
        assertThat(dieta.get("conteudo").get("aguaLitros").decimalValue()).isEqualByComparingTo("3.5");
    }

    @Test
    void aguaPorDiaForaDaFaixaOuComMaisDeUmaCasaNaoPublica() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício");
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", treinador, Map.of("titulo", "Dieta"), 200);
        String id = plano.get("plano").get("id").asString();
        long versao = plano.get("plano").get("versao").asLong();
        List<Refeicao> refeicoes = List.of(refeicao("Almoço", "12:00", List.of(
                new Opcao(UUID.randomUUID(), "A", List.of(item("Arroz branco cozido", "150", "191.7"))))));
        for (String agua : List.of("0.05", "21", "2.25")) {
            ConteudoDieta conteudo = new ConteudoDieta(null, null, null, refeicoes, List.of(), null, List.of(), null,
                    new BigDecimal(agua));
            versao = api.put("/planos-dieta/" + id + "/rascunho", treinador,
                    ApiDeTeste.rascunho("Dieta", conteudo, versao), 200).get("plano").get("versao").asLong();
            JsonNode v = api.post("/planos-dieta/" + id + "/validar", treinador, null, 200);
            assertThat(v.get("erros").valueStream().map(e -> e.get("caminho").asString())).containsExactly("aguaLitros");
        }
        ConteudoDieta certa = new ConteudoDieta(null, null, null, refeicoes, List.of(), null, List.of(), null,
                new BigDecimal("20"));
        api.put("/planos-dieta/" + id + "/rascunho", treinador, ApiDeTeste.rascunho("Dieta", certa, versao), 200);
        assertThat(api.post("/planos-dieta/" + id + "/validar", treinador, null, 200).get("erros")).isEmpty();
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

    @Test
    void linkDaSuplementacaoSoPassaHttpsEChegaAoAluno() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício");
        JsonNode alunoLogado = api.convidarEEntrar(treinador, aluno);
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", treinador, Map.of("titulo", "Dieta"), 200);
        String id = plano.get("plano").get("id").asString();
        List<Refeicao> refeicoes = List.of(refeicao("Almoço", "12:00", List.of(
                new Opcao(UUID.randomUUID(), "A", List.of(item("Arroz branco cozido", "150", "191.7"))))));

        ConteudoDieta ruim = new ConteudoDieta(null, null, null, refeicoes, List.of(), null, List.of(
                new ConteudoDieta.Suplemento(UUID.randomUUID(), "Item de teste A", null, null, null, "javascript:alert(1)"),
                new ConteudoDieta.Suplemento(UUID.randomUUID(), "Item de teste B", null, null, null, "http://exemplo.com/p"),
                new ConteudoDieta.Suplemento(UUID.randomUUID(), "Item de teste C", null, null, null, "https://exemplo.com/p"),
                new ConteudoDieta.Suplemento(UUID.randomUUID(), "Item de teste D", null, null, null, null),
                new ConteudoDieta.Suplemento(UUID.randomUUID(), "Item de teste E", null, null, null, "  ")));
        JsonNode salvo = api.put("/planos-dieta/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Dieta", ruim, plano.get("plano").get("versao").asLong()), 200);
        JsonNode v = api.post("/planos-dieta/" + id + "/validar", treinador, null, 200);
        assertThat(v.get("erros").valueStream().map(e -> e.get("caminho").asString()))
                .containsExactly("suplementacao[0].link", "suplementacao[1].link");

        ConteudoDieta bom = new ConteudoDieta(null, null, null, refeicoes, List.of(), null, List.of(
                new ConteudoDieta.Suplemento(UUID.randomUUID(), "Item de teste C", "1 dose", null, null,
                        "https://exemplo.com/p"),
                new ConteudoDieta.Suplemento(UUID.randomUUID(), "Item de teste D", null, null, null, null)));
        JsonNode corrigido = api.put("/planos-dieta/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Dieta", bom, salvo.get("plano").get("versao").asLong()), 200);
        assertThat(api.post("/planos-dieta/" + id + "/validar", treinador, null, 200).get("erros")).isEmpty();
        api.post("/planos-dieta/" + id + "/publicar", treinador,
                Map.of("versao", corrigido.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);

        JsonNode suplementacao = api.get("/aluno/dieta", alunoLogado, 200).get("dieta").get("conteudo").get("suplementacao");
        assertThat(suplementacao.get(0).get("link").asString()).isEqualTo("https://exemplo.com/p");
        assertThat(suplementacao.get(1).get("link").isNull()).isTrue();
    }

    @Test
    void modoDePreparoChegaAoAlunoVaiNaCopiaENoModeloENuncaNaAuditoria() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício");
        UUID outro = api.criarAluno(treinador, "Outro Aluno Fictício");
        JsonNode alunoLogado = api.convidarEEntrar(treinador, aluno);
        String marca = "Preparo-fictício-" + UUID.randomUUID();
        String preparo = marca + "\nCozinhe o arroz.\n\nMisture o frango desfiado.";
        Refeicao comPreparo = new Refeicao(UUID.randomUUID(), "Almoço", "12:00", null, List.of(
                new Opcao(UUID.randomUUID(), "A", List.of(item("Arroz branco cozido", "150", "191.7")))), preparo);
        ConteudoDieta conteudo = new ConteudoDieta(null, null, null, List.of(comPreparo), List.of(), null, List.of());

        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", treinador, Map.of("titulo", "Dieta"), 200);
        String id = plano.get("plano").get("id").asString();
        JsonNode salvo = api.put("/planos-dieta/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Dieta", conteudo, plano.get("plano").get("versao").asLong()), 200);
        assertThat(api.post("/planos-dieta/" + id + "/validar", treinador, null, 200).get("erros")).isEmpty();
        api.post("/planos-dieta/" + id + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);

        // O aluno lê o texto como foi escrito, com as quebras de linha.
        JsonNode doAluno = api.get("/aluno/dieta", alunoLogado, 200).get("dieta").get("conteudo");
        assertThat(doAluno.get("refeicoes").get(0).get("modoDePreparo").asString()).isEqualTo(preparo);

        // Copiar para outro aluno leva o campo.
        Map<String, Object> pedido = new LinkedHashMap<>();
        pedido.put("alunoId", outro);
        pedido.put("titulo", "Cópia fictícia");
        pedido.put("inicio", "2026-11-02");
        pedido.put("fim", "2026-11-29");
        JsonNode copia = api.post("/planos-dieta/" + id + "/copiar-para-aluno", treinador, pedido, 200);
        JsonNode rascunhoDaCopia = api.get("/planos-dieta/" + copia.get("planoId").asString(), treinador, 200).get("rascunho");
        assertThat(rascunhoDaCopia.get("refeicoes").get(0).get("modoDePreparo").asString()).isEqualTo(preparo);

        // A refeição pronta (modelo REFEICAO) guarda o campo.
        JsonNode modelo = api.post("/receitas", treinador, Map.of("tipo", "REFEICAO", "nome", "Refeição fictícia " + marca,
                "conteudo", conteudo), 200);
        JsonNode lido = api.get("/receitas/" + modelo.get("id").asString(), treinador, 200);
        assertThat(lido.get("conteudo").get("refeicoes").get(0).get("modoDePreparo").asString()).isEqualTo(preparo);

        // Mais de 2000 caracteres é recusado ao salvar, sem repetir o texto na resposta.
        Refeicao longa = new Refeicao(UUID.randomUUID(), "Jantar", null, null, List.of(), "x".repeat(2001));
        JsonNode recusa = api.put("/planos-dieta/" + id + "/rascunho", treinador, ApiDeTeste.rascunho("Dieta",
                new ConteudoDieta(null, null, null, List.of(longa), List.of(), null, List.of()),
                api.get("/planos-dieta/" + id, treinador, 200).get("plano").get("versao").asLong()), 400);
        assertThat(recusa.toString()).doesNotContain("x".repeat(100));

        assertThat(banco.queryForObject("select count(*) from auditoria where resumo like ?", Integer.class,
                "%" + marca + "%")).isZero();
    }

    private static Refeicao refeicao(String nome, String horario, List<Opcao> opcoes) {
        return new Refeicao(UUID.randomUUID(), nome, horario, null, opcoes);
    }

    private static Item item(String nome, String quantidade, String kcal) {
        return new Item(UUID.randomUUID(), UUID.randomUUID(), nome, new BigDecimal(quantidade), "g",
                new BigDecimal(kcal), BigDecimal.ONE, BigDecimal.TEN, BigDecimal.ZERO, false);
    }
}
