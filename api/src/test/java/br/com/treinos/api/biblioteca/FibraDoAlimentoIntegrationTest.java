package br.com.treinos.api.biblioteca;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.dieta.ConteudoDieta;
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

/**
 * Fibra do alimento (plano {@code fibra-do-alimento}): opcional, nula = "—" (nunca zero por ausência), mesma faixa dos
 * macros (0 a 99999, 2 casas) com 422 {@code ALIMENTO_INVALIDO} no campo sem repetir o valor, fora da conta da kcal,
 * copiada do catálogo ao importar e levada pelo item da dieta por todos os caminhos que reconstroem o record. A planilha
 * está em {@code ImportacaoIntegrationTest} e a migration em {@code FibraDoAlimentoMigrationTest}. Dados fictícios.
 */
@AutoConfigureMockMvc
class FibraDoAlimentoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private static Map<String, Object> alimento(String nome, Object fibra) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", nome);
        corpo.put("baseQuantidade", 100);
        corpo.put("baseUnidade", "g");
        corpo.put("proteina", 1);
        corpo.put("carboidrato", 10);
        corpo.put("gordura", 0);
        if (fibra != null) corpo.put("fibra", fibra);
        return corpo;
    }

    @Test
    void criarEEditarComESemFibraNuncaGravaZeroPorAusenciaENaoMexeNaKcal() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();

        JsonNode com = api.post("/alimentos", login, alimento("Com fibra fictício", 2.5), 200);
        assertThat(com.path("fibra").decimalValue()).isEqualByComparingTo("2.5");
        JsonNode sem = api.post("/alimentos", login, alimento("Sem fibra fictício", null), 200);
        assertThat(sem.path("fibra").isNull()).isTrue();
        // 1 × 4 + 10 × 4 + 0 × 9, com ou sem fibra: a fibra não entra na conta.
        assertThat(com.path("kcal").decimalValue()).isEqualByComparingTo("44.00");
        assertThat(sem.path("kcal").decimalValue()).isEqualByComparingTo("44.00");
        // Zero digitado é valor; vazio é ausência.
        JsonNode zero = api.post("/alimentos", login, alimento("Zero fibra fictício", 0), 200);
        assertThat(zero.path("fibra").decimalValue()).isEqualByComparingTo("0");

        // O teto da faixa (99999) vale.
        api.post("/alimentos", login, alimento("Teto fibra fictício", new BigDecimal("99999")), 200);

        String id = sem.path("id").asString();
        JsonNode editado = api.put("/alimentos/" + id, login, alimento("Sem fibra fictício", 3.25), 200);
        assertThat(editado.path("fibra").decimalValue()).isEqualByComparingTo("3.25");
        assertThat(editado.path("kcal").decimalValue()).isEqualByComparingTo("44.00");
        assertThat(fibraGravada(id)).isEqualByComparingTo("3.25");
        // Editar sem fibra tira a fibra (o formulário sempre manda o que está na tela): vira nulo, nunca zero.
        JsonNode tirada = api.put("/alimentos/" + id, login, alimento("Sem fibra fictício", null), 200);
        assertThat(tirada.path("fibra").isNull()).isTrue();
        assertThat(fibraGravada(id)).isNull();

        JsonNode lista = api.get("/alimentos", login, 200);
        assertThat(lista.valueStream().filter(a -> a.path("nome").asString().equals("Com fibra fictício")).findFirst()
                .orElseThrow().path("fibra").decimalValue()).isEqualByComparingTo("2.5");
    }

    @Test
    void fibraForaDaFaixaOuComMaisDeDuasCasasDa422NoCampoSemRepetirOValor() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        Map<String, String> recusas = Map.of("-0.5", "-0.5", "100000", "100000", "1.234", "1.234", "99999.01", "99999.01");
        for (var recusa : recusas.entrySet()) {
            JsonNode erro = api.post("/alimentos", login, alimento("Fibra recusada " + recusa.getKey(),
                    new BigDecimal(recusa.getKey())), 422);
            assertThat(erro.path("codigo").asString()).isEqualTo("ALIMENTO_INVALIDO");
            assertThat(erro.path("fieldErrors").get(0).path("field").asString()).isEqualTo("fibra");
            assertThat(erro.toString()).doesNotContain(recusa.getValue());
        }
        // Na edição vale o mesmo, e o alimento não muda.
        String id = api.post("/alimentos", login, alimento("Fibra editada fictícia", 4), 200).path("id").asString();
        JsonNode erro = api.put("/alimentos/" + id, login, alimento("Fibra editada fictícia", 123456), 422);
        assertThat(erro.path("fieldErrors").get(0).path("field").asString()).isEqualTo("fibra");
        assertThat(erro.toString()).doesNotContain("123456");
        assertThat(fibraGravada(id)).isEqualByComparingTo("4");
    }

    @Test
    void alimentoDeOutraConsultoriaNaoMudaE404() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var dono = api.novoTreinador();
        var outro = api.novoTreinador();
        String id = api.post("/alimentos", dono, alimento("Fibra do dono fictícia", 5), 200).path("id").asString();
        api.put("/alimentos/" + id, outro, alimento("Fibra do dono fictícia", 9), 404);
        assertThat(fibraGravada(id)).isEqualByComparingTo("5");
        assertThat(api.get("/alimentos", outro, 200).valueStream().map(a -> a.path("id").asString())).doesNotContain(id);
    }

    @Test
    void importarDoCatalogoCopiaAFibraEOQueNaoTemFibraFicaNulo() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        // Arroz integral (fibra 2,75), um Tr (gravado 0, marcado em tracos) e um sem análise (nulo), todos da TACO.
        UUID arroz = catalogo("1");
        UUID traco = catalogo("215");
        UUID semAnalise = catalogo("280");
        assertThat(jdbc.queryForObject("select tracos from catalogo_alimento where id = ?::uuid", String.class, traco))
                .contains("fibra");

        JsonNode resposta = api.get("/catalogo/alimentos?busca=Abobrinha&limite=50", login, 200).get("itens")
                .valueStream().filter(a -> a.path("nome").asString().equals("Abobrinha, italiana, crua")).findFirst()
                .orElseThrow();
        assertThat(resposta.path("fibra").decimalValue()).isEqualByComparingTo(jdbc.queryForObject(
                "select fibra from catalogo_alimento where nome = 'Abobrinha, italiana, crua'", BigDecimal.class));

        api.post("/alimentos/importar-catalogo", login,
                Map.of("ids", List.of(arroz.toString(), traco.toString(), semAnalise.toString())), 200);
        Map<String, JsonNode> porNome = new LinkedHashMap<>();
        api.get("/alimentos", login, 200).forEach(a -> porNome.put(a.path("nome").asString(), a));
        assertThat(porNome.get(nomeDoCatalogo(arroz)).path("fibra").decimalValue()).isEqualByComparingTo("2.75");
        assertThat(porNome.get(nomeDoCatalogo(traco)).path("fibra").decimalValue()).isEqualByComparingTo("0");
        assertThat(porNome.get(nomeDoCatalogo(semAnalise)).path("fibra").isNull()).isTrue();
    }

    @Test
    void dietaPublicadaMantemAFibraDoItemEVersaoAntigaSemOCampoLeNula() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var treinador = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício");
        var alunoLogado = api.convidarEEntrar(treinador, aluno);

        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", treinador, Map.of("titulo", "Dieta"), 200);
        String id = plano.path("plano").path("id").asString();
        JsonNode salvo = api.put("/planos-dieta/" + id + "/rascunho", treinador, ApiDeTeste.rascunho("Dieta",
                conteudo(new BigDecimal("7.5")), plano.path("plano").path("versao").asLong()), 200);
        api.post("/planos-dieta/" + id + "/publicar", treinador,
                Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);

        JsonNode itens = api.get("/aluno/dieta", alunoLogado, 200).path("dieta").path("conteudo").path("refeicoes").get(0)
                .path("opcoes").get(0).path("itens");
        assertThat(itens.get(0).path("fibra").decimalValue()).isEqualByComparingTo("7.5");
        assertThat(itens.get(1).path("fibra").isNull()).isTrue(); // item sem fibra: nulo, nunca zero

        // Versão publicada antes da fibra existir: o JSON gravado não tem a chave (tirada direto da linha da versão deste
        // plano) e a leitura devolve nulo, sem erro.
        UUID outroAluno = api.criarAluno(treinador, "Outro Aluno Fictício");
        var outroLogado = api.convidarEEntrar(treinador, outroAluno);
        JsonNode planoAntigo = api.post("/alunos/" + outroAluno + "/planos-dieta", treinador, Map.of("titulo", "Dieta"), 200);
        String idAntigo = planoAntigo.path("plano").path("id").asString();
        JsonNode salvoAntigo = api.put("/planos-dieta/" + idAntigo + "/rascunho", treinador, ApiDeTeste.rascunho("Dieta",
                conteudo(new BigDecimal("7.5")), planoAntigo.path("plano").path("versao").asLong()), 200);
        api.post("/planos-dieta/" + idAntigo + "/publicar", treinador,
                Map.of("versao", salvoAntigo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);
        assertThat(jdbc.update("update plano_dieta_versao set conteudo = conteudo #- '{refeicoes,0,opcoes,0,itens,0,fibra}' "
                + "where plano_id = ?::uuid", idAntigo)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select conteudo::text from plano_dieta_versao where plano_id = ?::uuid", String.class,
                idAntigo)).doesNotContain("7.5");
        JsonNode antigos = api.get("/aluno/dieta", outroLogado, 200).path("dieta").path("conteudo").path("refeicoes").get(0)
                .path("opcoes").get(0).path("itens");
        assertThat(antigos.get(0).path("fibra").isNull()).isTrue();
    }

    @Test
    void copiarReplicarESalvarComoModeloLevamAFibraDoItem() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        UUID aluno = api.criarAluno(login, "Aluno Fictício");
        UUID outro = api.criarAluno(login, "Outro Aluno Fictício");
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", login, Map.of("titulo", "Dieta"), 200);
        String id = plano.path("plano").path("id").asString();
        JsonNode salvo = api.put("/planos-dieta/" + id + "/rascunho", login, ApiDeTeste.rascunho("Dieta",
                conteudo(new BigDecimal("7.5")), plano.path("plano").path("versao").asLong()), 200);
        api.post("/planos-dieta/" + id + "/publicar", login,
                Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);

        JsonNode copia = api.post("/planos-dieta/" + id + "/copiar-para-aluno", login,
                Map.of("alunoId", outro, "titulo", "Cópia", "inicio", "2026-11-02", "fim", "2026-11-29"), 200);
        assertFibra(api.get("/planos-dieta/" + copia.path("planoId").asString(), login, 200).path("rascunho"), "7.5");

        JsonNode replica = api.post("/planos-dieta/" + id + "/replicar", login, Map.of("titulo", "Replica"), 200);
        assertFibra(replica.path("rascunho"), "7.5");

        String modelo = api.post("/planos-dieta/" + id + "/salvar-como-receita", login, Map.of("nome", "Modelo fibra"), 200)
                .path("id").asString();
        assertFibra(api.get("/receitas/" + modelo, login, 200).path("conteudo"), "7.5");
    }

    @Test
    void fibraDoItemForaDaFaixaNaoPublicaESemRepetirOValor() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        var login = api.novoTreinador();
        UUID aluno = api.criarAluno(login, "Aluno Fictício");
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-dieta", login, Map.of("titulo", "Dieta"), 200);
        String id = plano.path("plano").path("id").asString();
        JsonNode salvo = api.put("/planos-dieta/" + id + "/rascunho", login, ApiDeTeste.rascunho("Dieta",
                conteudo(new BigDecimal("123456")), plano.path("plano").path("versao").asLong()), 200);
        JsonNode erro = api.post("/planos-dieta/" + id + "/publicar", login,
                Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 422);
        assertThat(erro.path("codigo").asString()).isEqualTo("PLANO_INVALIDO");
        assertThat(erro.toString()).doesNotContain("123456");
    }

    @Test
    void todoMetodoQueReconstroiOItemLevaAFibra() {
        Item item = new Item(UUID.randomUUID(), null, "Item fictício", BigDecimal.TEN, "g", BigDecimal.ONE, BigDecimal.ONE,
                BigDecimal.ONE, BigDecimal.ONE, true, null, null, null, new BigDecimal("4.2"));
        assertThat(item.comDadosDaBiblioteca(BigDecimal.ONE, BigDecimal.ONE, "Grupo").fibra()).isEqualByComparingTo("4.2");
        ConteudoDieta base = new ConteudoDieta("Objetivo", null, null, List.of(new Refeicao(UUID.randomUUID(), "Almoço",
                "12:00", null, List.of(new Opcao(UUID.randomUUID(), "A", List.of(item))))), List.of(), null, List.of());
        assertThat(primeiroItem(base.comUidsNovos()).fibra()).isEqualByComparingTo("4.2");
        assertThat(primeiroItem(base.comItens(i -> i)).fibra()).isEqualByComparingTo("4.2");
        assertThat(primeiroItem(base.semErgogenicos()).fibra()).isEqualByComparingTo("4.2");
        // O construtor de 10 argumentos (rascunho, seed, testes) não traz fibra: nula, nunca zero.
        assertThat(new Item(UUID.randomUUID(), null, "Sem fibra", BigDecimal.TEN, "g", null, null, null, null, true).fibra())
                .isNull();
    }

    private static Item primeiroItem(ConteudoDieta c) {
        return c.refeicoes().get(0).opcoes().get(0).itens().get(0);
    }

    /** Um item da biblioteca com {@code fibra} e um manual sem ela. */
    private static ConteudoDieta conteudo(BigDecimal fibra) {
        Item calculado = new Item(UUID.randomUUID(), null, "Aveia fictícia", new BigDecimal("100"), "g",
                new BigDecimal("380"), new BigDecimal("13"), new BigDecimal("67"), new BigDecimal("7"), true, null, null,
                null, fibra);
        Item manual = new Item(UUID.randomUUID(), null, "Item manual fictício", new BigDecimal("100"), "g",
                new BigDecimal("100"), BigDecimal.ONE, BigDecimal.TEN, BigDecimal.ZERO, true);
        return new ConteudoDieta(null, null, null, List.of(new Refeicao(UUID.randomUUID(), "Almoço", "12:00", null,
                List.of(new Opcao(UUID.randomUUID(), "A", List.of(calculado, manual))))), List.of(), null, List.of());
    }

    private static void assertFibra(JsonNode conteudo, String esperada) {
        JsonNode itens = conteudo.path("refeicoes").get(0).path("opcoes").get(0).path("itens");
        assertThat(itens.get(0).path("fibra").decimalValue()).isEqualByComparingTo(esperada);
        assertThat(itens.get(1).path("fibra").isNull()).isTrue();
    }

    private UUID catalogo(String codigo) {
        return jdbc.queryForObject("select id from catalogo_alimento where codigo_fonte = ? and fonte like 'TACO%'",
                UUID.class, codigo);
    }

    private String nomeDoCatalogo(UUID id) {
        return jdbc.queryForObject("select nome from catalogo_alimento where id = ?::uuid", String.class, id);
    }

    private BigDecimal fibraGravada(String id) {
        return jdbc.queryForObject("select fibra from alimento where id = ?::uuid", BigDecimal.class, id);
    }
}
