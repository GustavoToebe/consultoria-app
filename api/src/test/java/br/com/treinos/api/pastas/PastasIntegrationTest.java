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
