package br.com.treinos.api.lesoes;

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

/** Histórico de lesões: CRUD do treinador, validação e isolamento entre consultorias. */
@AutoConfigureMockMvc
class LesoesIntegrationTest extends AbstractIntegrationTest {

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

    @Test
    void registraAlteraEExcluiLesao() throws Exception {
        JsonNode criada = api.post("/alunos/" + aluno + "/lesoes", treinador,
                Map.of("regiao", " Ombro direito ", "descricao", "Dor fictícia", "dataInicio", "2026-03-01",
                        "situacao", "ATIVA"), 200);
        String id = criada.get("id").asString();
        assertThat(criada.get("regiao").asString()).isEqualTo("Ombro direito");

        api.put("/alunos/" + aluno + "/lesoes/" + id, treinador,
                Map.of("regiao", "Ombro direito", "dataInicio", "2026-03-01", "dataFim", "2026-06-01",
                        "situacao", "RECUPERADA", "observacao", "Sem restrição"), 200);
        JsonNode lista = api.get("/alunos/" + aluno + "/lesoes", treinador, 200);
        assertThat(lista).hasSize(1);
        assertThat(lista.get(0).get("situacao").asString()).isEqualTo("RECUPERADA");

        api.delete("/alunos/" + aluno + "/lesoes/" + id, treinador, 204);
        assertThat(api.get("/alunos/" + aluno + "/lesoes", treinador, 200)).isEmpty();
    }

    @Test
    void recusaDadosInvalidos() throws Exception {
        api.post("/alunos/" + aluno + "/lesoes", treinador, Map.of("regiao", "", "situacao", "ATIVA"), 400);
        api.post("/alunos/" + aluno + "/lesoes", treinador, Map.of("regiao", "Joelho"), 400);
        api.post("/alunos/" + aluno + "/lesoes", treinador,
                Map.of("regiao", "Joelho", "dataInicio", "2026-05-01", "dataFim", "2026-04-01", "situacao", "ATIVA"), 400);
    }

    @Test
    void lesaoDeOutraConsultoriaNaoApareceNemSeAltera() throws Exception {
        String id = api.post("/alunos/" + aluno + "/lesoes", treinador,
                Map.of("regiao", "Joelho", "situacao", "ATIVA"), 200).get("id").asString();
        JsonNode outro = api.novoTreinador();
        api.get("/alunos/" + aluno + "/lesoes", outro, 404);
        api.put("/alunos/" + aluno + "/lesoes/" + id, outro, Map.of("regiao", "X", "situacao", "ATIVA"), 404);
        api.delete("/alunos/" + aluno + "/lesoes/" + id, outro, 404);
        assertThat(api.get("/alunos/" + aluno + "/lesoes", treinador, 200)).hasSize(1);
    }
}
