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

/** {@code GET /alunos/{id}/pastas/vigente}: a pasta do treino ativo, a mesma regra da atualização (uma só). */
@AutoConfigureMockMvc
class PastaVigenteIntegrationTest extends AbstractIntegrationTest {

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

    private String pasta(String titulo, Map<String, Object> periodo) throws Exception {
        Map<String, Object> corpo = new java.util.LinkedHashMap<>(periodo);
        corpo.put("titulo", titulo);
        return api.post("/alunos/" + aluno + "/pastas", treinador, corpo, 200).get("id").asString();
    }

    private void publicarTreinoNa(String pasta) throws Exception {
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", treinador,
                Map.of("titulo", "Treino fictício", "pastaId", pasta), 200);
        String id = plano.get("plano").get("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Treino fictício", ApiDeTeste.treino().conteudo(), plano.get("plano").get("versao").asLong()), 200);
        api.post("/planos-treino/" + id + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);
    }

    @Test
    void semPlanoAtivoNaoHaPastaVigente() throws Exception {
        pasta("Só uma pasta", Map.of("inicio", "2026-10-05", "fim", "2026-10-20"));
        JsonNode r = api.get("/alunos/" + aluno + "/pastas/vigente", treinador, 200);
        assertThat(r.get("pasta").isNull()).isTrue();
    }

    @Test
    void pastaDoTreinoAtivoEAVigente() throws Exception {
        String antiga = pasta("Antiga", Map.of("inicio", "2026-09-01", "fim", "2026-09-30"));
        String atual = pasta("Atual", Map.of("inicio", "2026-10-05", "fim", "2026-10-20"));
        publicarTreinoNa(atual);
        JsonNode r = api.get("/alunos/" + aluno + "/pastas/vigente", treinador, 200).get("pasta");
        assertThat(r.get("id").asString()).isEqualTo(atual).isNotEqualTo(antiga);
        assertThat(r.get("titulo").asString()).isEqualTo("Atual");
        assertThat(r.get("inicio").asString()).isEqualTo("2026-10-05");
        assertThat(r.get("fim").asString()).isEqualTo("2026-10-20");
    }

    @Test
    void pastaSemFimNaoEVigente() throws Exception {
        publicarTreinoNa(pasta("Sem fim", Map.of("inicio", "2026-10-05")));
        assertThat(api.get("/alunos/" + aluno + "/pastas/vigente", treinador, 200).get("pasta").isNull()).isTrue();
    }

    @Test
    void alunoDeOutraConsultoriaEhNaoEncontrado() throws Exception {
        api.get("/alunos/" + aluno + "/pastas/vigente", api.novoTreinador(), 404);
        api.get("/alunos/" + UUID.randomUUID() + "/pastas/vigente", treinador, 404);
    }
}
