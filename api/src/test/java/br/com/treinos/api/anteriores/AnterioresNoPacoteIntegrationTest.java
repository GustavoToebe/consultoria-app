package br.com.treinos.api.anteriores;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Coluna "Anterior" no pacote do aluno (Engajamento 0.3): a última vez de cada exercício do plano antes de hoje
 * (Brasília), série a série, com o código do tipo e a ordem dentro dele. A suíte liga {@code TREINOS_RETORNO_HABILITADO};
 * o pacote sem o campo com a chave desligada está em {@code RetornoDesligadoIntegrationTest}. Só dados fictícios.
 */
@AutoConfigureMockMvc
class AnterioresNoPacoteIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID alunoId;
    private JsonNode aluno;
    private ApiDeTeste.TreinoDeTeste treino;
    private String versaoId;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        alunoId = api.criarAluno(treinador, "Aluno Fictício Anterior");
        treino = ApiDeTeste.treino();
        api.publicarTreino(treinador, alunoId, treino.conteudo());
        aluno = api.convidarEEntrar(treinador, alunoId);
        versaoId = api.get("/aluno/painel", aluno, 200).get("treino").get("versaoId").asString();
    }

    @Test
    void semHistoricoOPacoteTrazOCorteENenhumExercicio() throws Exception {
        JsonNode anteriores = api.get("/aluno/painel", aluno, 200).get("anteriores");
        assertThat(anteriores.get("ate").asString()).isEqualTo(hoje.toString());
        assertThat(anteriores.get("exercicios").isEmpty()).isTrue();
    }

    @Test
    void ultimaVezAntesDeHojeSoComAsSeriesFeitas() throws Exception {
        enviar(List.of(
                registro(treino.wsUid(), hoje.minusDays(7), "50", 10, true),
                registro(treino.fsUid(), hoje.minusDays(3), "30", 3, true),
                registro(treino.wsUid(), hoje.minusDays(3), "60", 8, true),
                // Não entram: a não feita da última vez e a de hoje (o app já a conhece).
                registro(treino.backOffUid(), hoje.minusDays(3), "50", 6, false),
                registro(treino.wsUid(), hoje, "70", 5, true)));

        JsonNode a = api.get("/aluno/painel", aluno, 200).get("anteriores").get("exercicios").get(treino.exercicioId().toString());
        assertThat(a.get("data").asString()).isEqualTo(hoje.minusDays(3).toString());
        JsonNode series = a.get("series");
        assertThat(series).hasSize(2);
        assertThat(series.get(0).get("tipo").asString()).isEqualTo("FEEDER");
        assertThat(series.get(0).get("ordem").asInt()).isEqualTo(1);
        assertThat(series.get(1).get("tipo").asString()).isEqualTo("WORKING");
        assertThat(series.get(1).get("carga").decimalValue()).isEqualByComparingTo("60");
        assertThat(series.get(1).get("repeticoes").asInt()).isEqualTo(8);
    }

    @Test
    void outroAlunoNaoAparece() throws Exception {
        UUID outroId = api.criarAluno(treinador, "Outro Aluno Fictício Anterior");
        api.publicarTreino(treinador, outroId, treino.conteudo().comUidsNovos());
        JsonNode outro = api.convidarEEntrar(treinador, outroId);
        JsonNode painelOutro = api.get("/aluno/painel", outro, 200);
        JsonNode sessao = painelOutro.get("treino").get("conteudo").get("sessoes").get(0);
        JsonNode exercicio = sessao.get("exercicios").get(0);
        Map<String, Object> r = registro(UUID.fromString(exercicio.get("series").get(1).get("uid").asString()),
                hoje.minusDays(1), "150", 10, true);
        r.put("planoVersaoId", painelOutro.get("treino").get("versaoId").asString());
        r.put("sessaoUid", sessao.get("uid").asString());
        r.put("exercicioUid", exercicio.get("uid").asString());
        api.post("/aluno/execucoes/lote", outro, Map.of("registros", List.of(r)), 200);

        assertThat(api.get("/aluno/painel", aluno, 200).get("anteriores").get("exercicios").isEmpty()).isTrue();
    }

    private Map<String, Object> registro(UUID serieUid, LocalDate data, String carga, Integer reps, boolean concluida) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", UUID.randomUUID().toString());
        r.put("planoVersaoId", versaoId);
        r.put("sessaoUid", treino.sessaoUid().toString());
        r.put("exercicioUid", treino.exercicioUid().toString());
        r.put("serieUid", serieUid.toString());
        r.put("data", data.toString());
        r.put("carga", carga);
        r.put("repeticoes", reps);
        r.put("concluida", concluida);
        r.put("alteradoNoAparelhoEm", Instant.now().toString());
        return r;
    }

    private void enviar(List<Map<String, Object>> registros) throws Exception {
        JsonNode resposta = api.post("/aluno/execucoes/lote", aluno, Map.of("registros", registros), 200);
        assertThat(resposta.get("resultados").valueStream().map(x -> x.get("situacao").asString())).containsOnly("ACEITO");
    }
}
