package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cobrança aberta e vencida (e outra vencida há muito) com o módulo de pagamentos ligado: o aluno continua lendo o treino, a
 * mobilidade e o financeiro e registrando o que treinou. O financeiro é só informação; nenhum acesso é negado por dívida
 * (a regra de arquitetura em {@code ArquiteturaTest} impede que algo fora de {@code pagamentos/} sequer leia a cobrança).
 */
@AutoConfigureMockMvc
class CobrancaVencidaNaoBloqueiaOAlunoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode treinador;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
    }

    @Test
    void vencidaHaPoucosDiasEVencidaHaMuitoTempoNaoTiramNadaDoAluno() throws Exception {
        for (int diasDeAtraso : new int[] {3, 400}) {
            UUID alunoId = api.criarAluno(treinador, "Aluno Fictício " + UUID.randomUUID());
            var treino = ApiDeTeste.treino();
            var mobilidade = ApiDeTeste.mobilidade();
            api.publicarTreino(treinador, alunoId, treino.conteudo());
            api.publicarMobilidade(treinador, alunoId, mobilidade.conteudo());
            JsonNode aluno = api.convidarEEntrar(treinador, alunoId);
            String cobrancaId = contratarEVencer(alunoId, diasDeAtraso);
            String versaoTreino = api.get("/aluno/painel", aluno, 200).get("treino").get("versaoId").asString();
            String versaoMobilidade = api.get("/aluno/mobilidade", aluno, 200).get("mobilidade").get("id").asString();

            // O financeiro mostra a dívida, sem esconder nada.
            JsonNode financeiro = api.get("/aluno/financeiro", aluno, 200);
            assertThat(financeiro.toString()).contains(cobrancaId);
            // Plano, pastas, progresso e histórico seguem abertos.
            api.get("/aluno/pastas", aluno, 200);
            api.get("/aluno/progresso?exercicioId=" + treino.exercicioId(), aluno, 200);
            api.get("/aluno/execucoes", aluno, 200);
            api.get("/aluno/dieta", aluno, 200);
            // Registrar o treino e marcar a mobilidade continua valendo.
            Map<String, Object> serie = new LinkedHashMap<>();
            serie.put("id", UUID.randomUUID().toString());
            serie.put("planoVersaoId", versaoTreino);
            serie.put("sessaoUid", treino.sessaoUid().toString());
            serie.put("exercicioUid", treino.exercicioUid().toString());
            serie.put("serieUid", treino.wsUid().toString());
            serie.put("data", hoje.toString());
            serie.put("carga", "30");
            serie.put("repeticoes", 6);
            serie.put("concluida", true);
            serie.put("alteradoNoAparelhoEm", Instant.now().toString());
            JsonNode lote = api.post("/aluno/execucoes/lote", aluno, Map.of("registros", List.of(serie)), 200);
            assertThat(lote.get("resultados").get(0).get("situacao").asString()).isEqualTo("ACEITO");

            Map<String, Object> marca = new LinkedHashMap<>();
            marca.put("id", UUID.randomUUID().toString());
            marca.put("planoVersaoId", versaoMobilidade);
            marca.put("secaoUid", mobilidade.secaoUid().toString());
            marca.put("itemUid", mobilidade.itemUid().toString());
            marca.put("data", hoje.toString());
            marca.put("feito", true);
            marca.put("alteradoNoAparelhoEm", Instant.now().toString());
            JsonNode marcas = api.post("/aluno/mobilidade/registros", aluno, Map.of("registros", List.of(marca)), 200);
            assertThat(marcas.get("resultados").get(0).get("situacao").asString()).isEqualTo("ACEITO");
            api.get("/aluno/mobilidade/registros", aluno, 200);
            api.get("/eu", aluno, 200);
        }
    }

    /** Aluno com um plano mensal contratado hoje; a cobrança aberta que nasce ganha o vencimento no passado. */
    private String contratarEVencer(UUID alunoId, int diasDeAtraso) throws Exception {
        JsonNode plano = api.post("/financeiro/planos", treinador,
                Map.of("nome", "Plano " + UUID.randomUUID(), "valorCentavos", 15_000, "periodicidade", "MENSAL"), 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("planoComercialId", plano.get("id").asString());
        corpo.put("inicio", hoje.toString());
        corpo.put("diaVencimento", hoje.getDayOfMonth());
        api.post("/alunos/" + alunoId + "/contratacoes", treinador, corpo, 200);
        String cobrancaId = null;
        for (JsonNode c : api.get("/alunos/" + alunoId + "/cobrancas", treinador, 200)) {
            if ("ABERTA".equals(c.get("situacao").asString())) {
                cobrancaId = c.get("id").asString();
            }
        }
        assertThat(cobrancaId).isNotNull();
        jdbc.update("update cobranca_aluno set vencimento = ? where id = ?::uuid", hoje.minusDays(diasDeAtraso), cobrancaId);
        return cobrancaId;
    }
}
