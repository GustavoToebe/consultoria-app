package br.com.treinos.api.execucao;

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

/**
 * Troca de plano no app do aluno: lista as pastas com plano publicado (status vem de {@code concluidaEm}), devolve
 * treino e dieta da pasta escolhida e nunca mostra rascunho nem pasta de outro aluno.
 */
@AutoConfigureMockMvc
class AlunoPastasIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID alunoId;
    private JsonNode aluno;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        alunoId = api.criarAluno(treinador, "Aluno Fictício");
        aluno = api.convidarEEntrar(treinador, alunoId);
    }

    private String novaPasta(UUID doAluno, String titulo) throws Exception {
        return api.post("/alunos/" + doAluno + "/pastas", treinador,
                Map.of("titulo", titulo, "inicio", "2026-10-15", "fim", "2026-10-29"), 200).get("id").asString();
    }

    private void publicarTreinoNaPasta(UUID doAluno, String pasta, String titulo) throws Exception {
        JsonNode plano = api.post("/alunos/" + doAluno + "/planos-treino", treinador,
                Map.of("titulo", titulo, "pastaId", pasta), 200);
        String id = plano.get("plano").get("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho(titulo, ApiDeTeste.treino().conteudo(), plano.get("plano").get("versao").asLong()), 200);
        api.post("/planos-treino/" + id + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);
    }

    @Test
    void listaSoPastasComPlanoPublicadoEMostraOStatus() throws Exception {
        String antiga = novaPasta(alunoId, "Plano 1");
        publicarTreinoNaPasta(alunoId, antiga, "Treino 1");
        String atual = novaPasta(alunoId, "Plano 2");
        publicarTreinoNaPasta(alunoId, atual, "Treino 2");
        // Dieta só em rascunho na pasta atual e pasta só com rascunho: nada disso chega ao aluno.
        api.post("/alunos/" + alunoId + "/planos-dieta", treinador, Map.of("titulo", "Dieta 2", "pastaId", atual), 200);
        String soRascunho = novaPasta(alunoId, "Plano 3");
        api.post("/alunos/" + alunoId + "/planos-treino", treinador, Map.of("titulo", "Treino 3", "pastaId", soRascunho), 200);
        api.post("/pastas/" + antiga + "/finalizar", treinador, Map.of(), 200);

        JsonNode pastas = api.get("/aluno/pastas", aluno, 200);
        assertThat(pastas).hasSize(2);
        // Ativa primeiro; concluída depois.
        assertThat(pastas.get(0).get("id").asString()).isEqualTo(atual);
        assertThat(pastas.get(0).get("concluidaEm").isNull()).isTrue();
        assertThat(pastas.get(0).get("atual").asBoolean()).isTrue();
        assertThat(pastas.get(0).get("temTreino").asBoolean()).isTrue();
        assertThat(pastas.get(0).get("temDieta").asBoolean()).isFalse();
        assertThat(pastas.get(1).get("id").asString()).isEqualTo(antiga);
        assertThat(pastas.get(1).get("concluidaEm").isNull()).isFalse();
        assertThat(pastas.get(1).get("atual").asBoolean()).isFalse();

        JsonNode daAntiga = api.get("/aluno/pastas/" + antiga, aluno, 200);
        assertThat(daAntiga.get("treino").get("titulo").asString()).isEqualTo("Treino 1");
        assertThat(daAntiga.get("dieta").isNull()).isTrue();
        assertThat(api.get("/aluno/pastas/" + atual, aluno, 200).get("dieta").isNull()).isTrue();
        api.get("/aluno/pastas/" + soRascunho, aluno, 404);
    }

    @Test
    void pastaDeOutroAlunoOuDeOutraConsultoriaNaoAparece() throws Exception {
        UUID outroAluno = api.criarAluno(treinador, "Outro Aluno Fictício");
        String doOutro = novaPasta(outroAluno, "Plano do outro");
        publicarTreinoNaPasta(outroAluno, doOutro, "Treino do outro");

        JsonNode outroTreinador = api.novoTreinador();
        UUID alunoDeFora = api.criarAluno(outroTreinador, "Aluno de fora");
        String deFora = api.post("/alunos/" + alunoDeFora + "/pastas", outroTreinador,
                Map.of("titulo", "Plano de fora", "inicio", "2026-10-15", "fim", "2026-10-29"), 200).get("id").asString();

        assertThat(api.get("/aluno/pastas", aluno, 200)).isEmpty();
        api.get("/aluno/pastas/" + doOutro, aluno, 404);
        api.get("/aluno/pastas/" + deFora, aluno, 404);
        api.get("/aluno/pastas/" + UUID.randomUUID(), aluno, 404);
        // Treinador não usa a rota do aluno.
        api.get("/aluno/pastas", treinador, 403);
    }
}
