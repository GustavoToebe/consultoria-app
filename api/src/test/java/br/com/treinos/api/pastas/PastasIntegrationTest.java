package br.com.treinos.api.pastas;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Pastas: período único para treino e dieta, vários planos por pasta, replicação e isolamento. */
@AutoConfigureMockMvc
class PastasIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID aluno;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, "Aluno Fictício");
    }

    private JsonNode novaPasta(String titulo, String inicio, String fim) throws Exception {
        return api.post("/alunos/" + aluno + "/pastas", treinador,
                Map.of("titulo", titulo, "inicio", inicio, "fim", fim), 200);
    }

    @Test
    void finalizarPastaGravaPesoEObservacaoNoRegistroDePeso() throws Exception {
        String pasta = novaPasta("Plano 17", "2026-09-01", "2026-09-30").get("id").asString();
        assertThat(api.get("/alunos/" + aluno + "/pastas", treinador, 200).get(0).get("concluidaEm").isNull()).isTrue();

        // Observação sem peso e peso no futuro são recusados e a pasta continua aberta.
        api.post("/pastas/" + pasta + "/finalizar", treinador, Map.of("observacao", "sem peso"), 400);
        api.post("/pastas/" + pasta + "/finalizar", treinador, Map.of("pesoKg", 80.5, "data", "2999-01-01"), 400);
        assertThat(api.get("/alunos/" + aluno + "/pastas", treinador, 200).get(0).get("concluidaEm").isNull()).isTrue();

        JsonNode finalizada = api.post("/pastas/" + pasta + "/finalizar", treinador,
                Map.of("pesoKg", 80.5, "data", "2026-09-30", "observacao", "Fim do ciclo"), 200);
        assertThat(finalizada.get("concluidaEm").isNull()).isFalse();
        JsonNode pesos = api.get("/alunos/" + aluno + "/pesos", treinador, 200);
        assertThat(pesos).hasSize(1);
        assertThat(pesos.get(0).get("pesoKg").decimalValue()).isEqualByComparingTo("80.5");
        assertThat(pesos.get(0).get("observacao").asString()).isEqualTo("Fim do ciclo");

        assertThat(api.post("/pastas/" + pasta + "/finalizar", treinador, Map.of(), 409).get("codigo").asString())
                .isEqualTo("PASTA_JA_FINALIZADA");
        api.post("/pastas/" + pasta + "/finalizar", api.novoTreinador(), Map.of(), 404);

        assertThat(api.post("/pastas/" + pasta + "/reabrir", treinador, null, 200).get("concluidaEm").isNull()).isTrue();
        // Sem peso, finaliza só a pasta e não mexe no registro de peso.
        api.post("/pastas/" + pasta + "/finalizar", treinador, Map.of(), 200);
        assertThat(api.get("/alunos/" + aluno + "/pesos", treinador, 200)).hasSize(1);
    }

    @Test
    void planosDaPastaNascemComOPeriodoDela() throws Exception {
        String pasta = novaPasta("Plano 16", "2026-10-05", "2026-10-20").get("id").asString();
        JsonNode treino = api.post("/alunos/" + aluno + "/planos-treino", treinador,
                Map.of("titulo", "Plano 16", "pastaId", pasta, "inicio", "2020-01-01", "fim", "2020-02-01"), 200);
        JsonNode dieta = api.post("/alunos/" + aluno + "/planos-dieta", treinador,
                Map.of("titulo", "Dieta 16", "pastaId", pasta), 200);
        // Mais de um treino na mesma pasta é permitido.
        api.post("/alunos/" + aluno + "/planos-treino", treinador, Map.of("titulo", "Plano 16.2", "pastaId", pasta), 200);

        assertThat(treino.get("plano").get("inicio").asString()).isEqualTo("2026-10-05");
        assertThat(treino.get("plano").get("fim").asString()).isEqualTo("2026-10-20");
        assertThat(dieta.get("plano").get("pastaId").asString()).isEqualTo(pasta);
        assertThat(dieta.get("plano").get("inicio").asString()).isEqualTo("2026-10-05");
        assertThat(api.get("/alunos/" + aluno + "/planos-treino", treinador, 200)).hasSize(2);
    }

    @Test
    void mudarOPeriodoDaPastaAcompanhaTreinoEDieta() throws Exception {
        String pasta = novaPasta("Plano 16", "2026-10-05", "2026-10-20").get("id").asString();
        String treino = api.post("/alunos/" + aluno + "/planos-treino", treinador,
                Map.of("titulo", "T", "pastaId", pasta), 200).get("plano").get("id").asString();
        String dieta = api.post("/alunos/" + aluno + "/planos-dieta", treinador,
                Map.of("titulo", "D", "pastaId", pasta), 200).get("plano").get("id").asString();

        api.put("/pastas/" + pasta, treinador, Map.of("titulo", "Plano 16", "inicio", "2026-10-12", "fim", "2026-10-27"), 200);

        assertThat(api.get("/planos-treino/" + treino, treinador, 200).get("plano").get("fim").asString())
                .isEqualTo("2026-10-27");
        assertThat(api.get("/planos-dieta/" + dieta, treinador, 200).get("plano").get("inicio").asString())
                .isEqualTo("2026-10-12");
    }

    @Test
    void replicarAPastaCopiaTreinosEDietasComOutroPeriodo() throws Exception {
        String pasta = novaPasta("Plano 16", "2026-10-05", "2026-10-20").get("id").asString();
        api.post("/alunos/" + aluno + "/planos-treino", treinador, Map.of("titulo", "Plano 16", "pastaId", pasta), 200);
        api.post("/alunos/" + aluno + "/planos-dieta", treinador, Map.of("titulo", "Dieta própria", "pastaId", pasta), 200);

        JsonNode nova = api.post("/pastas/" + pasta + "/replicar", treinador,
                Map.of("titulo", "Plano 17", "inicio", "2026-10-21", "fim", "2026-11-05"), 200);

        assertThat(nova.get("id").asString()).isNotEqualTo(pasta);
        assertThat(api.get("/alunos/" + aluno + "/pastas", treinador, 200)).hasSize(2);
        JsonNode treinos = api.get("/alunos/" + aluno + "/planos-treino", treinador, 200);
        assertThat(treinos).hasSize(2);
        boolean copiouTreino = false;
        for (JsonNode t : treinos) {
            if (nova.get("id").asString().equals(t.path("pastaId").asString(null))) {
                copiouTreino = true;
                assertThat(t.get("titulo").asString()).isEqualTo("Plano 17");
                assertThat(t.get("inicio").asString()).isEqualTo("2026-10-21");
            }
        }
        assertThat(copiouTreino).isTrue();
        JsonNode dietas = api.get("/alunos/" + aluno + "/planos-dieta", treinador, 200);
        assertThat(dietas).anyMatch(d -> "Dieta própria".equals(d.get("titulo").asString())
                && nova.get("id").asString().equals(d.path("pastaId").asString(null)));
    }

    @Test
    void mobilidadeAcompanhaPeriodoReplicacaoEExclusaoDaPasta() throws Exception {
        String pasta = novaPasta("Plano 16", "2026-10-05", "2026-10-20").get("id").asString();
        String mob = api.post("/alunos/" + aluno + "/planos-mobilidade", treinador,
                Map.of("titulo", "Mobilidade própria", "pastaId", pasta), 200).get("plano").get("id").asString();

        // Período: o rascunho da mobilidade acompanha a pasta.
        api.put("/pastas/" + pasta, treinador, Map.of("titulo", "Plano 16", "inicio", "2026-10-12", "fim", "2026-10-27"), 200);
        JsonNode mudou = api.get("/planos-mobilidade/" + mob, treinador, 200).get("plano");
        assertThat(mudou.get("inicio").asString()).isEqualTo("2026-10-12");
        assertThat(mudou.get("fim").asString()).isEqualTo("2026-10-27");

        // Replicar: cópia na pasta nova, com o período novo e o título próprio.
        JsonNode nova = api.post("/pastas/" + pasta + "/replicar", treinador,
                Map.of("titulo", "Plano 17", "inicio", "2026-10-28", "fim", "2026-11-12"), 200);
        JsonNode lista = api.get("/alunos/" + aluno + "/planos-mobilidade", treinador, 200);
        assertThat(lista).hasSize(2);
        assertThat(lista).anyMatch(m -> "Mobilidade própria".equals(m.get("titulo").asString())
                && nova.get("id").asString().equals(m.path("pastaId").asString(null))
                && "2026-10-28".equals(m.get("inicio").asString()));

        // Excluir a pasta arquiva a mobilidade dela e preserva a da outra pasta.
        api.delete("/pastas/" + pasta, treinador, 204);
        JsonNode resto = api.get("/alunos/" + aluno + "/planos-mobilidade", treinador, 200);
        assertThat(resto).hasSize(1);
        assertThat(resto.get(0).get("pastaId").asString()).isEqualTo(nova.get("id").asString());
    }

    @Test
    void salvarRascunhoDePlanoEmPastaMantemOPeriodoDaPastaMesmoComOutroOuSemPeriodo() throws Exception {
        String pasta = novaPasta("Plano 18", "2026-10-05", "2026-10-20").get("id").asString();
        for (String rota : new String[]{"planos-treino", "planos-dieta", "planos-mobilidade"}) {
            JsonNode criado = api.post("/alunos/" + aluno + "/" + rota, treinador,
                    Map.of("titulo", "Plano da pasta", "pastaId", pasta), 200);
            String id = criado.get("plano").get("id").asString();
            Map<String, Object> outroPeriodo = ApiDeTeste.rascunho("Plano da pasta", criado.get("rascunho"),
                    criado.get("plano").get("versao").asLong());
            outroPeriodo.put("inicio", "2030-01-01");
            outroPeriodo.put("fim", "2030-02-01");
            JsonNode salvo = api.put("/" + rota + "/" + id + "/rascunho", treinador, outroPeriodo, 200);
            assertThat(salvo.get("plano").get("inicio").asString()).as(rota).isEqualTo("2026-10-05");
            assertThat(salvo.get("plano").get("fim").asString()).as(rota).isEqualTo("2026-10-20");
            JsonNode semPeriodo = api.put("/" + rota + "/" + id + "/rascunho", treinador,
                    ApiDeTeste.rascunho("Plano da pasta", salvo.get("rascunho"), salvo.get("plano").get("versao").asLong()), 200);
            assertThat(semPeriodo.get("plano").get("inicio").asString()).as(rota).isEqualTo("2026-10-05");
            assertThat(semPeriodo.get("plano").get("fim").asString()).as(rota).isEqualTo("2026-10-20");
            assertThat(api.get("/" + rota + "/" + id, treinador, 200).get("plano").get("fim").asString())
                    .as(rota).isEqualTo("2026-10-20");
        }
    }

    @Test
    void salvarRascunhoDePlanoSemPastaContinuaAceitandoOPeriodoDoCorpo() throws Exception {
        JsonNode criado = api.post("/alunos/" + aluno + "/planos-treino", treinador, Map.of("titulo", "Plano solto"), 200);
        Map<String, Object> corpo = ApiDeTeste.rascunho("Plano solto", criado.get("rascunho"),
                criado.get("plano").get("versao").asLong());
        corpo.put("inicio", "2030-01-01");
        corpo.put("fim", "2030-02-01");
        JsonNode salvo = api.put("/planos-treino/" + criado.get("plano").get("id").asString() + "/rascunho", treinador, corpo, 200);
        assertThat(salvo.get("plano").get("inicio").asString()).isEqualTo("2030-01-01");
        assertThat(salvo.get("plano").get("fim").asString()).isEqualTo("2030-02-01");
    }

    @Test
    void periodoInvalidoEPastaDeOutraConsultoriaOuAlunoSaoRecusados() throws Exception {
        api.post("/alunos/" + aluno + "/pastas", treinador,
                Map.of("titulo", "X", "inicio", "2026-10-20", "fim", "2026-10-05"), 400);

        String pasta = novaPasta("Plano 16", "2026-10-05", "2026-10-20").get("id").asString();
        JsonNode outro = api.novoTreinador();
        UUID alunoDeOutro = api.criarAluno(outro, "Outro Aluno");
        api.put("/pastas/" + pasta, outro, Map.of("titulo", "Invasão"), 404);
        api.post("/alunos/" + alunoDeOutro + "/planos-treino", outro, Map.of("titulo", "T", "pastaId", pasta), 404);
        // Pasta do aluno A não aceita plano do aluno B da mesma consultoria.
        UUID outroAluno = api.criarAluno(treinador, "Segundo Aluno");
        api.post("/alunos/" + outroAluno + "/planos-treino", treinador, Map.of("titulo", "T", "pastaId", pasta), 404);
    }
}
