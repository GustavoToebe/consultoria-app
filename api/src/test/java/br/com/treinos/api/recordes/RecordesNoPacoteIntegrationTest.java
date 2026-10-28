package br.com.treinos.api.recordes;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import br.com.treinos.api.treino.ConteudoTreino.Tecnica;
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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Recordes pessoais no pacote do aluno (Engajamento 0.2, P3 e P10): os melhores valores de cada exercício do plano, só
 * de séries simples feitas antes de hoje (Brasília). A suíte liga {@code TREINOS_RETORNO_HABILITADO}; o pacote sem a
 * lista com a chave desligada está em {@code RetornoDesligadoIntegrationTest}. Só dados fictícios.
 */
@AutoConfigureMockMvc
class RecordesNoPacoteIntegrationTest extends AbstractIntegrationTest {

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
        alunoId = api.criarAluno(treinador, "Aluno Fictício Recordes");
        treino = ApiDeTeste.treino();
        api.publicarTreino(treinador, alunoId, treino.conteudo());
        aluno = api.convidarEEntrar(treinador, alunoId);
        versaoId = api.get("/aluno/painel", aluno, 200).get("treino").get("versaoId").asString();
    }

    @Test
    void semHistoricoOPacoteTrazOCorteDeHojeEONenhumExercicio() throws Exception {
        JsonNode recordes = api.get("/aluno/painel", aluno, 200).get("recordes");
        assertThat(recordes.get("ate").asString()).isEqualTo(hoje.toString());
        assertThat(recordes.get("exercicios").isEmpty()).isTrue();
    }

    @Test
    void melhoresDeAntesDeHojeSoDeSeriesFeitasComCargaERepeticoes() throws Exception {
        enviar(List.of(
                registro(treino.wsUid(), hoje.minusDays(7), "60", 10, true),
                registro(treino.wsUid(), hoje.minusDays(3), "70", 5, true),
                registro(treino.backOffUid(), hoje.minusDays(3), "60", 12, true),
                // Não contam: não feita, sem repetições, carga zero e as de hoje (o app compara as do dia).
                registro(treino.fsUid(), hoje.minusDays(3), "200", 10, false),
                registro(treino.fsUid(), hoje.minusDays(2), "150", null, true),
                registro(treino.fsUid(), hoje.minusDays(1), "0", 30, true),
                registro(treino.wsUid(), hoje, "100", 10, true)));

        JsonNode recordes = api.get("/aluno/painel", aluno, 200).get("recordes");
        assertThat(recordes.get("ate").asString()).isEqualTo(hoje.toString());
        JsonNode m = recordes.get("exercicios").get(treino.exercicioId().toString());
        assertThat(m.get("maiorCarga").decimalValue()).isEqualByComparingTo("70");
        assertThat(m.get("maiorVolume").decimalValue()).isEqualByComparingTo("720");
        assertThat(m.get("repeticoesPorCarga")).hasSize(2);
        assertThat(m.get("repeticoesPorCarga").get(0).get("carga").decimalValue()).isEqualByComparingTo("60");
        assertThat(m.get("repeticoesPorCarga").get(0).get("repeticoes").asInt()).isEqualTo(12);
        assertThat(m.get("repeticoesPorCarga").get(1).get("carga").decimalValue()).isEqualByComparingTo("70");
        assertThat(m.get("repeticoesPorCarga").get(1).get("repeticoes").asInt()).isEqualTo(5);
    }

    @Test
    void serieComTecnicaNaoContaMesmoQueSejaAMaisPesada() throws Exception {
        // Versão nova com drop-set na WS: a série com técnica é registrada e nunca vira base de recorde.
        ExercicioPlano ex = treino.conteudo().sessoes().get(0).exercicios().get(0);
        List<ConteudoTreino.Serie> series = new ArrayList<>(ex.series());
        series.set(1, series.get(1).comTecnica(Tecnica.dropSet(1, 20, null, null)));
        ConteudoTreino comDrop = comSeries(treino.conteudo(), ex.comSeries(ex.uid(), series));
        api.publicarTreino(treinador, alunoId, comDrop);
        String versaoComDrop = api.get("/aluno/painel", aluno, 200).get("treino").get("versaoId").asString();
        assertThat(versaoComDrop).isNotEqualTo(versaoId);

        List<Map<String, Object>> lote = new ArrayList<>();
        lote.add(registro(treino.backOffUid(), hoje.minusDays(4), "40", 8, true));
        Map<String, Object> drop = registro(treino.wsUid(), hoje.minusDays(2), "90", 8, true);
        drop.put("planoVersaoId", versaoComDrop);
        lote.add(drop);
        enviar(lote);

        JsonNode m = api.get("/aluno/painel", aluno, 200).get("recordes").get("exercicios").get(treino.exercicioId().toString());
        assertThat(m.get("maiorCarga").decimalValue()).isEqualByComparingTo("40");
        assertThat(m.get("maiorVolume").decimalValue()).isEqualByComparingTo("320");
    }

    @Test
    void outroAlunoNaoEntraNosMelhores() throws Exception {
        UUID outroId = api.criarAluno(treinador, "Outro Aluno Fictício Recordes");
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

        enviar(List.of(registro(treino.wsUid(), hoje.minusDays(1), "50", 10, true)));
        JsonNode m = api.get("/aluno/painel", aluno, 200).get("recordes").get("exercicios").get(treino.exercicioId().toString());
        assertThat(m.get("maiorCarga").decimalValue()).isEqualByComparingTo("50");
    }

    private static ConteudoTreino comSeries(ConteudoTreino c, ExercicioPlano novo) {
        List<Sessao> sessoes = new ArrayList<>(c.sessoes());
        Sessao s = sessoes.get(0);
        sessoes.set(0, new Sessao(s.uid(), s.nome(), s.diaSemana(), s.tipo(), s.frequenciaSemanal(), s.observacao(), s.cardio(),
                List.of(novo), s.grupos()));
        return new ConteudoTreino(c.objetivo(), c.orientacoes(), sessoes, c.metodologia());
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
