package br.com.treinos.api.questionarios;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.UUID;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Escolher o questionário da pasta devolve o mesmo resumo da lista de pastas, com o "liberarEm" do plano agendado. Dados fictícios. */
@AutoConfigureMockMvc
class EscolherQuestionarioDaPastaIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    @Test
    void respostaTrazALiberacaoAgendadaDaPasta() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício Pasta");
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        LocalDate dia = hoje.plusDays(4);
        String comAgendado = api.post("/alunos/" + aluno + "/pastas", treinador,
                Map.of("titulo", "Com plano agendado", "inicio", hoje, "fim", hoje.plusDays(27)), 200).path("id").asString();
        String semAgendado = api.post("/alunos/" + aluno + "/pastas", treinador,
                Map.of("titulo", "Sem plano agendado", "inicio", hoje, "fim", hoje.plusDays(27)), 200).path("id").asString();

        JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", treinador,
                Map.of("titulo", "Plano agendado", "pastaId", comAgendado), 200);
        String id = plano.path("plano").path("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Plano agendado", ApiDeTeste.treino().conteudo(), plano.path("plano").path("versao").asLong()), 200);
        api.post("/planos-treino/" + id + "/publicar", treinador, Map.of("versao", salvo.path("plano").path("versao").asLong(),
                "confirmarAvisos", true, "liberarEm", dia.toString()), 200);

        String questionario = api.get("/questionarios/opcoes", treinador, 200).get(0).path("id").asString();
        JsonNode escolhida = api.put("/pastas/" + comAgendado + "/questionario", treinador, Map.of("questionarioId", questionario), 200);
        assertThat(escolhida.path("id").asString()).isEqualTo(comAgendado);
        assertThat(escolhida.path("questionarioId").asString()).isEqualTo(questionario);
        assertThat(escolhida.path("liberarEm").asString()).isEqualTo(dia.toString());

        // Pasta sem plano agendado segue sem data, e a lista de pastas concorda com a resposta.
        JsonNode outra = api.put("/pastas/" + semAgendado + "/questionario", treinador, Map.of("questionarioId", questionario), 200);
        assertThat(outra.path("liberarEm").isNull()).isTrue();
        JsonNode lista = api.get("/alunos/" + aluno + "/pastas", treinador, 200);
        for (JsonNode p : lista) {
            JsonNode resposta = p.path("id").asString().equals(comAgendado) ? escolhida : outra;
            assertThat(p.path("liberarEm")).isEqualTo(resposta.path("liberarEm"));
        }
    }
}
