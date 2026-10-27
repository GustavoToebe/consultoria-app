package br.com.treinos.api.execucao;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.Carga;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import br.com.treinos.api.treino.ConteudoTreino.Tecnica;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
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
 * Registro por etapa (docs/series-etapas.md): blocos do Cluster e etapa inicial + retomadas do Rest-pause ficam dentro da
 * série registrada. O total e a carga da série são do servidor; envio sem etapas nunca apaga as etapas; posição fora da
 * versão, etapa repetida ou concluída com pendência são recusadas sem derrubar o lote. Números fictícios.
 */
@AutoConfigureMockMvc
class ExecucaoPorEtapasIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode treinador;
    private JsonNode aluno;
    private UUID alunoId;
    private String versaoId;
    private final UUID sessao = UUID.randomUUID();
    private final UUID exercicio = UUID.randomUUID();
    private final UUID exercicioId = UUID.randomUUID();
    private final UUID ws = UUID.randomUUID();
    private final UUID cluster = UUID.randomUUID();
    private final UUID clusterPercentual = UUID.randomUUID();
    private final UUID restPause = UUID.randomUUID();
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        alunoId = api.criarAluno(treinador, "Aluno Fictício Etapas");
        List<Serie> series = List.of(
                Serie.de(ws, "WORKING", 3, 6, Carga.de("CARGA_TRABALHO")),
                Serie.de(cluster, "WORKING", 16, 16, Carga.de("CARGA_TRABALHO")).comTecnica(Tecnica.cluster(List.of(4, 4, 4, 4), 15, null)),
                Serie.de(clusterPercentual, "WORKING", 6, 6, Carga.percentual("PERCENTUAL_WS", 100, null))
                        .comTecnica(Tecnica.cluster(List.of(3, 3), 15, null)),
                Serie.de(restPause, "WORKING", 6, 8, Carga.de("CARGA_TRABALHO")).comTecnica(Tecnica.restPause(20, null, 2)));
        ExercicioPlano ex = new ExercicioPlano(exercicio, exercicioId, "Supino fictício", "LIVRE", null, null, true, "kg", series);
        ConteudoTreino conteudo = new ConteudoTreino(null, null,
                List.of(new Sessao(sessao, "Segunda - Peito", 1, "TREINO", null, null, null, List.of(ex))));
        api.publicarTreino(treinador, alunoId, conteudo);
        aluno = api.convidarEEntrar(treinador, alunoId);
        versaoId = api.get("/aluno/painel", aluno, 200).get("treino").get("versaoId").asString();
    }

    @Test
    void cluster4x4Realizado4442GuardaAsQuatroEtapasEOTotal14SemMudarAMeta() throws Exception {
        UUID id = UUID.randomUUID();
        Map<String, Object> r = registro(id, cluster, Instant.now(), true,
                etapa(1, 4, "40", "FEITA"), etapa(2, 4, "40", "FEITA"), etapa(3, 4, "40", "FEITA"), etapa(4, 2, "40", "FEITA"));
        // O total e a carga que o cliente manda são ignorados: o servidor calcula.
        r.put("repeticoes", 16);
        r.put("carga", "99");
        r.put("referenciaCarga", "40");
        r.put("referenciaOrigem", "BASE_DO_DIA");
        assertThat(situacoes(enviar(r))).containsExactly("ACEITO");

        Map<String, Object> linha = jdbc.queryForMap("select repeticoes, carga, referencia_carga, referencia_origem from execucao_serie where id = ?", id);
        assertThat(linha.get("repeticoes")).isEqualTo(14);
        assertThat(new java.math.BigDecimal(linha.get("carga").toString())).isEqualByComparingTo("40");
        assertThat(linha.get("referencia_origem")).isEqualTo("BASE_DO_DIA");

        JsonNode serie = serieNoHistorico(cluster);
        assertThat(serie.get("repeticoes").asInt()).isEqualTo(14);
        assertThat(serie.get("etapas")).hasSize(4);
        assertThat(serie.get("etapas").get(3).get("repeticoes").asInt()).isEqualTo(2);
        assertThat(serie.get("referenciaCarga").decimalValue()).isEqualByComparingTo("40");
        // A meta publicada continua 16.
        JsonNode prescrita = api.get("/aluno/painel", aluno, 200).at("/treino/conteudo/sessoes/0/exercicios/0/series/1");
        assertThat(prescrita.get("repsMin").asInt()).isEqualTo(16);
    }

    @Test
    void parcialFicaSemTotalEConcluidaComPendenciaERecusada() throws Exception {
        UUID id = UUID.randomUUID();
        Instant quando = Instant.now();
        assertThat(situacoes(enviar(registro(id, cluster, quando, false, etapa(1, 4, "40", "FEITA"), etapa(2, 3, "40", "FEITA")))))
                .containsExactly("ACEITO");
        JsonNode serie = serieNoHistorico(cluster);
        assertThat(serie.get("repeticoes").isNull()).isTrue();
        assertThat(serie.get("concluida").asBoolean()).isFalse();
        assertThat(serie.get("etapas")).hasSize(2);

        JsonNode resposta = enviar(registro(id, cluster, quando.plusSeconds(5), true, etapa(1, 4, "40", "FEITA")));
        assertThat(situacoes(resposta)).containsExactly("RECUSADO");
        assertThat(resposta.at("/resultados/0/motivo").asString()).contains("pendentes");

        // Etapa não realizada é explícita, sem números: conclui a série com o que foi feito.
        assertThat(situacoes(enviar(registro(id, cluster, quando.plusSeconds(10), true, etapa(1, 4, "40", "FEITA"),
                etapa(2, 3, "40", "FEITA"), etapa(3, 0, "40", "FEITA"), etapa(4, null, null, "NAO_REALIZADA"))))).containsExactly("ACEITO");
        serie = serieNoHistorico(cluster);
        assertThat(serie.get("repeticoes").asInt()).isEqualTo(7);
        assertThat(serie.get("concluida").asBoolean()).isTrue();
        assertThat(serie.get("etapas").get(3).get("situacao").asString()).isEqualTo("NAO_REALIZADA");
    }

    @Test
    void reenvioIdenticoNaoDuplicaEMaisNovoTrocaAListaInteira() throws Exception {
        UUID id = UUID.randomUUID();
        Instant quando = Instant.now();
        Map<String, Object> r = registro(id, cluster, quando, false, etapa(1, 4, "40", "FEITA"), etapa(2, 4, "40", "FEITA"));
        assertThat(situacoes(enviar(r))).containsExactly("ACEITO");
        assertThat(situacoes(enviar(r))).containsExactly("IGNORADO_ANTIGO");
        // Mais antigo (outro aparelho, rede lenta) não apaga o detalhe mais novo.
        assertThat(situacoes(enviar(registro(id, cluster, quando.minusSeconds(30), false, etapa(1, 1, "10", "FEITA")))))
                .containsExactly("IGNORADO_ANTIGO");
        assertThat(serieNoHistorico(cluster).get("etapas")).hasSize(2);
        // Mais novo troca a lista inteira (desfazer uma marcação tira a etapa), sem fundir as duas.
        assertThat(situacoes(enviar(registro(id, cluster, quando.plusSeconds(30), false, etapa(1, 5, "42", "FEITA")))))
                .containsExactly("ACEITO");
        JsonNode serie = serieNoHistorico(cluster);
        assertThat(serie.get("etapas")).hasSize(1);
        assertThat(serie.get("etapas").get(0).get("repeticoes").asInt()).isEqualTo(5);
        Integer linhas = jdbc.queryForObject("select count(*) from execucao_serie where aluno_id = ?", Integer.class, alunoId);
        assertThat(linhas).isEqualTo(1);
    }

    @Test
    void etapasForaDoContratoSaoRecusadasSemDerrubarOLote() throws Exception {
        Instant agora = Instant.now();
        Map<String, Object> semEtapas = registro(UUID.randomUUID(), cluster, agora, true);
        semEtapas.remove("etapas");
        Map<String, Object> foraDaSerie = registro(UUID.randomUUID(), cluster, agora, false, etapa(5, 4, "40", "FEITA"));
        Map<String, Object> repetida = registro(UUID.randomUUID(), cluster, agora, false, etapa(1, 4, "40", "FEITA"), etapa(1, 4, "40", "FEITA"));
        Map<String, Object> naoRealizadaComReps = registro(UUID.randomUUID(), cluster, agora, false, etapa(1, 4, null, "NAO_REALIZADA"));
        Map<String, Object> situacaoEstranha = registro(UUID.randomUUID(), cluster, agora, false, etapa(1, 4, "40", "TALVEZ"));
        Map<String, Object> etapasEmSerieSimples = registro(UUID.randomUUID(), ws, agora, true, etapa(1, 6, "40", "FEITA"));
        Map<String, Object> referenciaSemOrigem = registro(UUID.randomUUID(), cluster, agora, false, etapa(1, 4, "40", "FEITA"));
        referenciaSemOrigem.put("referenciaCarga", "40");
        Map<String, Object> repsDemais = registro(UUID.randomUUID(), cluster, agora, false, etapa(1, 501, "40", "FEITA"));
        Map<String, Object> bom = registro(UUID.randomUUID(), restPause, agora, true,
                etapa(1, 8, "50", "FEITA"), etapa(2, 3, "50", "FEITA"), etapa(3, 2, "50", "FEITA"));

        JsonNode resposta = enviar(semEtapas, foraDaSerie, repetida, naoRealizadaComReps, situacaoEstranha, etapasEmSerieSimples,
                referenciaSemOrigem, repsDemais, bom);
        assertThat(situacoes(resposta)).containsExactly("RECUSADO", "RECUSADO", "RECUSADO", "RECUSADO", "RECUSADO", "RECUSADO",
                "RECUSADO", "RECUSADO", "ACEITO");
        // Rest-pause com 2 pausas = 3 etapas de esforço na mesma série.
        assertThat(serieNoHistorico(restPause).get("repeticoes").asInt()).isEqualTo(13);
    }

    @Test
    void cargasDiferentesFicamSemCargaComumEForaDoProgresso() throws Exception {
        UUID id = UUID.randomUUID();
        enviar(registro(id, cluster, Instant.now(), true, etapa(1, 4, "40", "FEITA"), etapa(2, 4, "35", "FEITA"),
                etapa(3, 4, "35", "FEITA"), etapa(4, 4, "35", "FEITA")));
        JsonNode serie = serieNoHistorico(cluster);
        assertThat(serie.get("carga").isNull()).isTrue();
        assertThat(serie.get("repeticoes").asInt()).isEqualTo(16);
        assertThat(api.get("/alunos/" + alunoId + "/progresso?exercicioId=" + exercicioId, treinador, 200)).isEmpty();
    }

    /**
     * Pedido do Gustavo (27/10): a WS com técnica em percentual conta no progresso (papel TRABALHO na metodologia da
     * versão), mas não vira a base sugerida do próximo treino (última carga = só carga de trabalho).
     */
    @Test
    void wsComTecnicaEmPercentualEntraNoProgressoMasNaoViraBase() throws Exception {
        enviar(registro(UUID.randomUUID(), clusterPercentual, Instant.now(), true, etapa(1, 3, "60", "FEITA"), etapa(2, 3, "60", "FEITA")));
        JsonNode progresso = api.get("/alunos/" + alunoId + "/progresso?exercicioId=" + exercicioId, treinador, 200);
        assertThat(progresso).hasSize(1);
        assertThat(progresso.get(0).get("maiorCargaTrabalho").decimalValue()).isEqualByComparingTo("60");
        assertThat(api.get("/aluno/painel", aluno, 200).get("ultimasCargas").has(exercicioId.toString())).isFalse();
    }

    @Test
    void outroAlunoNaoGravaEtapaNaVersaoAlheia() throws Exception {
        UUID outroId = api.criarAluno(treinador, "Outro Aluno Fictício Etapas");
        api.publicarTreino(treinador, outroId, ApiDeTeste.treino().conteudo());
        JsonNode outro = api.convidarEEntrar(treinador, outroId);
        Map<String, Object> r = registro(UUID.randomUUID(), cluster, Instant.now(), false, etapa(1, 4, "40", "FEITA"));
        JsonNode resposta = api.post("/aluno/execucoes/lote", outro, Map.of("registros", List.of(r)), 200);
        assertThat(situacoes(resposta)).containsExactly("RECUSADO");
        Integer linhas = jdbc.queryForObject("select count(*) from execucao_serie where aluno_id = ?", Integer.class, alunoId);
        assertThat(linhas).isZero();
    }

    private JsonNode serieNoHistorico(UUID serieUid) throws Exception {
        JsonNode historico = api.get("/alunos/" + alunoId + "/execucoes", treinador, 200);
        for (JsonNode s : historico.get(0).get("sessoes").get(0).get("exercicios").get(0).get("series")) {
            if (s.get("serieUid").asString().equals(serieUid.toString())) {
                return s;
            }
        }
        throw new AssertionError("Série não está no histórico.");
    }

    private static Map<String, Object> etapa(int posicao, Integer reps, String carga, String situacao) {
        Map<String, Object> e = new LinkedHashMap<>();
        e.put("posicao", posicao);
        e.put("repeticoes", reps);
        e.put("carga", carga);
        e.put("situacao", situacao);
        return e;
    }

    @SafeVarargs
    private Map<String, Object> registro(UUID id, UUID serieUid, Instant quando, boolean concluida, Map<String, Object>... etapas) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", id.toString());
        r.put("planoVersaoId", versaoId);
        r.put("sessaoUid", sessao.toString());
        r.put("exercicioUid", exercicio.toString());
        r.put("serieUid", serieUid.toString());
        r.put("data", hoje.toString());
        r.put("carga", null);
        r.put("repeticoes", null);
        r.put("concluida", concluida);
        r.put("alteradoNoAparelhoEm", quando.toString());
        r.put("etapas", new ArrayList<>(List.of(etapas)));
        return r;
    }

    @SafeVarargs
    private JsonNode enviar(Map<String, Object>... registros) throws Exception {
        return api.post("/aluno/execucoes/lote", aluno, Map.of("registros", List.of(registros)), 200);
    }

    private static List<String> situacoes(JsonNode resposta) {
        return resposta.get("resultados").valueStream().map(r -> r.get("situacao").asString()).toList();
    }
}
