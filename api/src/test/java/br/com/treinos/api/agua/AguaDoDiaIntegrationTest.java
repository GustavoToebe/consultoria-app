package br.com.treinos.api.agua;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Água do dia marcada pelo aluno: idempotência, o último a chegar vence, dias aceitos, isolamento, permissões da equipe,
 * exportação e anonimização. Dados fictícios.
 */
@AutoConfigureMockMvc
class AguaDoDiaIntegrationTest extends AbstractIntegrationTest {

    private static final String NOME = "Aluno Água Fictício";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID alunoId;
    private JsonNode aluno;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        alunoId = api.criarAluno(treinador, NOME);
        aluno = api.convidarEEntrar(treinador, alunoId);
    }

    @Test
    void marcarEReenviarNaoDuplicaEOGetDevolveOsMililitros() throws Exception {
        var lote = List.of(registro(UUID.randomUUID(), hoje, 750, Instant.now()));

        assertThat(situacoes(enviar(lote))).containsExactly("ACEITO");
        // A fila do aparelho repete até confirmar: o reenvio não duplica nem muda nada.
        assertThat(situacoes(enviar(lote))).containsExactly("IGNORADO_ANTIGO");
        assertThat(contar()).isEqualTo(1);

        JsonNode lidos = api.get("/aluno/agua", aluno, 200);
        assertThat(lidos).hasSize(1);
        assertThat(lidos.get(0).get("data").asString()).isEqualTo(hoje.toString());
        assertThat(lidos.get(0).get("aguaMl").asInt()).isEqualTo(750);
        assertThat(lidos.get(0).has("id")).isFalse();
    }

    @Test
    void tirarUmCopoEOMesmoRegistroEOUltimoAChegarVence() throws Exception {
        UUID id = UUID.randomUUID();
        Instant primeiro = Instant.now().minusSeconds(60);

        enviar(List.of(registro(id, hoje, 1000, primeiro)));
        assertThat(situacoes(enviar(List.of(registro(id, hoje, 750, primeiro.plusSeconds(30)))))).containsExactly("ACEITO");
        assertThat(contar()).isEqualTo(1);
        assertThat(api.get("/aluno/agua", aluno, 200).get(0).get("aguaMl").asInt()).isEqualTo(750);

        // Zero é zero (o aluno tirou todos os copos), não some.
        enviar(List.of(registro(id, hoje, 0, primeiro.plusSeconds(40))));
        assertThat(api.get("/aluno/agua", aluno, 200).get(0).get("aguaMl").asInt()).isZero();

        // Um envio mais antigo que chega atrasado não volta o valor.
        assertThat(situacoes(enviar(List.of(registro(id, hoje, 2000, primeiro.plusSeconds(10))))))
                .containsExactly("IGNORADO_ANTIGO");
        assertThat(api.get("/aluno/agua", aluno, 200).get(0).get("aguaMl").asInt()).isZero();

        // Outro id para o mesmo dia (outro aparelho) cai na mesma linha pela chave.
        assertThat(situacoes(enviar(List.of(registro(UUID.randomUUID(), hoje, 500, Instant.now()))))).containsExactly("ACEITO");
        assertThat(contar()).isEqualTo(1);
        assertThat(api.get("/aluno/agua", aluno, 200).get(0).get("aguaMl").asInt()).isEqualTo(500);
    }

    @Test
    void diaFuturoDiaAntigoValorForaEIncompletoSaoRecusadosSemDerrubarOLote() throws Exception {
        Map<String, Object> semAgua = registro(UUID.randomUUID(), hoje.minusDays(2), 250, Instant.now());
        semAgua.remove("aguaMl");
        JsonNode resposta = enviar(List.of(
                registro(UUID.randomUUID(), hoje, 250, Instant.now()),
                registro(UUID.randomUUID(), hoje.plusDays(1), 250, Instant.now()),
                registro(UUID.randomUUID(), hoje.minusDays(61), 250, Instant.now()),
                registro(UUID.randomUUID(), hoje.minusDays(3), 20_250, Instant.now()),
                registro(UUID.randomUUID(), hoje.minusDays(4), -250, Instant.now()),
                registro(UUID.randomUUID(), hoje.minusDays(5), 250, Instant.now().plusSeconds(3 * 86400L)),
                semAgua));

        assertThat(situacoes(resposta)).containsExactly("ACEITO", "RECUSADO", "RECUSADO", "RECUSADO", "RECUSADO", "RECUSADO", "RECUSADO");
        assertThat(resposta.get("resultados").get(1).get("motivo").asString()).contains("ainda não chegou");
        assertThat(resposta.get("resultados").get(2).get("motivo").asString()).contains("60 dias");
        assertThat(resposta.get("resultados").get(6).get("motivo").asString()).isEqualTo("Registro incompleto.");
        assertThat(contar()).isEqualTo(1);

        // O limite de 60 dias para trás ainda vale.
        assertThat(situacoes(enviar(List.of(registro(UUID.randomUUID(), hoje.minusDays(60), 250, Instant.now())))))
                .containsExactly("ACEITO");
    }

    @Test
    void idDeOutroAlunoERecusadoECadaUmSoVeOProprio() throws Exception {
        UUID outroAlunoId = api.criarAluno(treinador, "Outro Aluno Água Fictício");
        JsonNode outro = api.convidarEEntrar(treinador, outroAlunoId);
        UUID idDoOutro = UUID.randomUUID();
        assertThat(situacoes(api.post("/aluno/agua", outro,
                Map.of("registros", List.of(registro(idDoOutro, hoje, 1000, Instant.now().minusSeconds(20)))), 200)))
                .containsExactly("ACEITO");

        // O aluno A reaproveita o id de B com o próprio dia: recusado, o registro de B não muda.
        JsonNode colisao = enviar(List.of(registro(idDoOutro, hoje, 250, Instant.now())));
        assertThat(situacoes(colisao)).containsExactly("RECUSADO");
        assertThat(colisao.get("resultados").get(0).get("motivo").asString()).contains("já usado");

        assertThat(api.get("/aluno/agua", aluno, 200)).isEmpty();
        assertThat(api.get("/aluno/agua", outro, 200).get(0).get("aguaMl").asInt()).isEqualTo(1000);
    }

    @Test
    void treinadorLeComAPermissaoSensivelEOutraConsultoriaRecebe404() throws Exception {
        enviar(List.of(registro(UUID.randomUUID(), hoje, 1500, Instant.now())));

        JsonNode lidos = api.get("/alunos/" + alunoId + "/agua", treinador, 200);
        assertThat(lidos).hasSize(1);
        assertThat(lidos.get(0).get("aguaMl").asInt()).isEqualTo(1500);

        api.get("/alunos/" + alunoId + "/agua", api.novoTreinador(), 404);
        api.get("/alunos/" + alunoId + "/agua", null, 401);

        UUID usuario = UUID.fromString(treinador.path("usuario").path("id").asString());
        // O Assistente lê registros, mas não tem ALUNO_SENSIVEL_LER: a água é dado de dieta.
        jdbc.update("update usuario u set perfil_id=p.id from perfil p where u.id=? and p.consultoria_id=u.consultoria_id"
                + " and p.nome='Assistente'", usuario);
        try {
            api.get("/alunos/" + alunoId + "/agua", treinador, 403);
        } finally {
            jdbc.update("update usuario u set perfil_id=p.id from perfil p where u.id=? and p.consultoria_id=u.consultoria_id"
                    + " and p.nome='Administrador'", usuario);
        }
    }

    @Test
    void periodoDaLeitura() throws Exception {
        enviar(List.of(
                registro(UUID.randomUUID(), hoje, 250, Instant.now()),
                registro(UUID.randomUUID(), hoje.minusDays(30), 500, Instant.now())));

        // Sem parâmetros: os últimos 7 dias.
        assertThat(api.get("/aluno/agua", aluno, 200)).hasSize(1);
        assertThat(api.get("/aluno/agua?de=" + hoje.minusDays(40) + "&ate=" + hoje, aluno, 200)).hasSize(2);
        api.get("/aluno/agua?de=" + hoje.minusDays(400) + "&ate=" + hoje, aluno, 400);
        api.get("/aluno/agua?de=" + hoje + "&ate=" + hoje.minusDays(1), aluno, 400);
    }

    @Test
    void loteGrandeERotasDoAlunoSoParaOAluno() throws Exception {
        List<Map<String, Object>> grande = new ArrayList<>();
        for (int i = 0; i < 301; i++) {
            grande.add(registro(UUID.randomUUID(), hoje, 250, Instant.now()));
        }
        api.post("/aluno/agua", aluno, Map.of("registros", grande), 400);
        assertThat(contar()).isZero();

        api.post("/aluno/agua", treinador, Map.of("registros", List.of()), 403);
        api.get("/aluno/agua", treinador, 403);
        api.post("/aluno/agua", null, Map.of("registros", List.of()), 401);
        // A rota da equipe não serve para o aluno, nem para a própria água.
        api.get("/alunos/" + alunoId + "/agua", aluno, 403);
    }

    @Test
    void exportacaoLevaAAgua() throws Exception {
        enviar(List.of(registro(UUID.randomUUID(), hoje, 1250, Instant.now())));
        var resposta = mvc.perform(MockMvcRequestBuilders.get("/alunos/" + alunoId + "/exportacao")
                .header("Authorization", ApiDeTeste.bearer(treinador))).andReturn().getResponse();
        assertThat(resposta.getStatus()).isEqualTo(200);
        JsonNode dados = json.readTree(resposta.getContentAsString(StandardCharsets.UTF_8));
        assertThat(dados.get("agua").get("itens")).hasSize(1);
        assertThat(dados.get("agua").get("itens").get(0).get("aguaMl").asInt()).isEqualTo(1250);
        assertThat(dados.get("secoesOmitidas").toString()).doesNotContain("agua");
    }

    @Test
    void anonimizarApagaAAgua() throws Exception {
        enviar(List.of(registro(UUID.randomUUID(), hoje, 1250, Instant.now())));
        api.patch("/alunos/" + alunoId + "/situacao", treinador, Map.of("ativo", false), 200);
        api.post("/alunos/" + alunoId + "/anonimizar", treinador, Map.of("nomeConfirmado", NOME), 200);
        assertThat(contar()).isZero();
    }

    @Test
    void excluirMinhaContaApagaAAgua() throws Exception {
        enviar(List.of(registro(UUID.randomUUID(), hoje, 1250, Instant.now())));
        api.post("/aluno/conta/excluir", aluno, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);
        assertThat(contar()).isZero();
    }

    private static Map<String, Object> registro(UUID id, LocalDate data, int aguaMl, Instant quando) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", id.toString());
        r.put("data", data.toString());
        r.put("aguaMl", aguaMl);
        r.put("alteradoNoAparelhoEm", quando.toString());
        return r;
    }

    private JsonNode enviar(List<Map<String, Object>> registros) throws Exception {
        return api.post("/aluno/agua", aluno, Map.of("registros", registros), 200);
    }

    private static List<String> situacoes(JsonNode resposta) {
        return resposta.get("resultados").valueStream().map(r -> r.get("situacao").asString()).toList();
    }

    private int contar() {
        Integer n = jdbc.queryForObject("select count(*) from agua_do_dia where aluno_id = ?", Integer.class, alunoId);
        return n == null ? 0 : n;
    }
}
