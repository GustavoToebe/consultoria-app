package br.com.treinos.api.avaliacoes;

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
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Avaliação física: CRUD da equipe, validação por campo, versão, isolamento (outra consultoria 404, aluno só o próprio),
 * permissões do peso, exportação, anonimização e "Excluir minha conta". Só dados fictícios.
 */
@AutoConfigureMockMvc
class AvaliacaoFisicaIntegrationTest extends AbstractIntegrationTest {

    private static final String NOME = "Aluno Avaliação Fictícia";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID aluno;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, NOME);
    }

    private static Map<String, Object> corpo(LocalDate data, Map<String, Object> medidas, String observacao, Long versao) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("data", data == null ? null : data.toString());
        c.put("medidas", medidas);
        c.put("observacao", observacao);
        if (versao != null) c.put("versao", versao);
        return c;
    }

    private JsonNode registrar(LocalDate data, Map<String, Object> medidas) throws Exception {
        return api.post("/alunos/" + aluno + "/avaliacoes-fisicas", treinador, corpo(data, medidas, null, null), 200);
    }

    private int contar(String sql, Object... args) {
        Integer n = jdbc.queryForObject(sql, Integer.class, args);
        return n == null ? 0 : n;
    }

    @Test
    void registraAlteraListaEExclui() throws Exception {
        api.post("/alunos/" + aluno + "/pesos", treinador, Map.of("data", hoje.minusDays(30).toString(), "pesoKg", 80.5), 200);
        JsonNode primeira = api.post("/alunos/" + aluno + "/avaliacoes-fisicas", treinador,
                corpo(hoje.minusDays(30), Map.of("cintura", 90, "bracoDireito", 35.5), " Medida fictícia ", null), 200);
        String id = primeira.get("id").asString();
        assertThat(primeira.get("medidas").get("cintura").decimalValue()).isEqualByComparingTo("90.0");
        assertThat(primeira.get("medidas").get("quadril").isNull()).isTrue();
        assertThat(primeira.get("observacao").asString()).isEqualTo("Medida fictícia");
        assertThat(primeira.get("pesoKg").decimalValue()).isEqualByComparingTo("80.5");
        long versao = primeira.get("versao").asLong();

        registrar(hoje, Map.of("cintura", 88.5));
        JsonNode lista = api.get("/alunos/" + aluno + "/avaliacoes-fisicas", treinador, 200);
        assertThat(lista).hasSize(2);
        assertThat(lista.get(0).get("data").asString()).isEqualTo(hoje.toString());
        assertThat(lista.get(0).get("pesoKg").isNull()).isTrue();

        JsonNode alterada = api.put("/avaliacoes-fisicas/" + id, treinador,
                corpo(hoje.minusDays(30), Map.of("cintura", 91, "quadril", 100), null, versao), 200);
        assertThat(alterada.get("medidas").get("quadril").decimalValue()).isEqualByComparingTo("100");
        assertThat(alterada.get("observacao").isNull()).isTrue();
        assertThat(alterada.get("versao").asLong()).isGreaterThan(versao);

        api.delete("/avaliacoes-fisicas/" + id, treinador, 204);
        assertThat(api.get("/alunos/" + aluno + "/avaliacoes-fisicas", treinador, 200)).hasSize(1);

        List<Map<String, Object>> auditoria = jdbc.queryForList(
                "select acao, resumo from auditoria where entidade = 'AVALIACAO_FISICA' and entidade_id = ?::uuid order by criado_em", id);
        assertThat(auditoria).extracting(l -> l.get("acao"))
                .containsExactlyInAnyOrder("AVALIACAO_FISICA_REGISTRADA", "AVALIACAO_FISICA_ALTERADA", "AVALIACAO_FISICA_EXCLUIDA");
        // Resumo fixo: nada de medida nem observação.
        assertThat(auditoria.toString()).doesNotContain("90").doesNotContain("Medida fictícia");
    }

    @Test
    void recusaDadosInvalidosComOCampoCerto() throws Exception {
        String rota = "/alunos/" + aluno + "/avaliacoes-fisicas";
        JsonNode semData = api.post(rota, treinador, corpo(null, Map.of("cintura", 80), null, null), 422);
        assertThat(semData.get("codigo").asString()).isEqualTo("AVALIACAO_INVALIDA");
        assertThat(semData.get("fieldErrors").get(0).get("field").asString()).isEqualTo("data");

        JsonNode futura = api.post(rota, treinador, corpo(hoje.plusDays(1), Map.of("cintura", 80), null, null), 422);
        assertThat(futura.get("fieldErrors").get(0).get("field").asString()).isEqualTo("data");

        JsonNode vazia = api.post(rota, treinador, corpo(hoje, Map.of(), null, null), 422);
        assertThat(vazia.get("fieldErrors").get(0).get("field").asString()).isEqualTo("medidas");

        JsonNode faixa = api.post(rota, treinador, corpo(hoje, Map.of("cintura", 4.9, "quadril", 301), null, null), 422);
        assertThat(faixa.get("fieldErrors")).extracting(e -> e.get("field").asString())
                .containsExactlyInAnyOrder("medidas.cintura", "medidas.quadril");
        // A mensagem não repete o valor (dado sensível).
        assertThat(faixa.get("fieldErrors").toString()).doesNotContain("4.9").doesNotContain("301");

        JsonNode casas = api.post(rota, treinador, corpo(hoje, Map.of("peitoral", 100.25), null, null), 422);
        assertThat(casas.get("fieldErrors").get(0).get("field").asString()).isEqualTo("medidas.peitoral");

        JsonNode obs = api.post(rota, treinador, corpo(hoje, Map.of("cintura", 80), "x".repeat(1001), null), 422);
        assertThat(obs.get("fieldErrors").get(0).get("field").asString()).isEqualTo("observacao");

        assertThat(api.get(rota, treinador, 200)).isEmpty();
    }

    @Test
    void umaAvaliacaoPorData() throws Exception {
        registrar(hoje, Map.of("cintura", 80));
        JsonNode repetida = api.post("/alunos/" + aluno + "/avaliacoes-fisicas", treinador,
                corpo(hoje, Map.of("cintura", 81), null, null), 422);
        assertThat(repetida.get("fieldErrors").get(0).get("field").asString()).isEqualTo("data");

        JsonNode outra = registrar(hoje.minusDays(7), Map.of("cintura", 82));
        api.put("/avaliacoes-fisicas/" + outra.get("id").asString(), treinador,
                corpo(hoje, Map.of("cintura", 82), null, outra.get("versao").asLong()), 422);
    }

    @Test
    void versaoAntigaOuAusenteDa409() throws Exception {
        JsonNode a = registrar(hoje, Map.of("cintura", 80));
        String id = a.get("id").asString();
        long versao = a.get("versao").asLong();
        api.put("/avaliacoes-fisicas/" + id, treinador, corpo(hoje, Map.of("cintura", 81), null, versao), 200);

        JsonNode velha = api.put("/avaliacoes-fisicas/" + id, treinador, corpo(hoje, Map.of("cintura", 82), null, versao), 409);
        assertThat(velha.get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        assertThat(api.put("/avaliacoes-fisicas/" + id, treinador, corpo(hoje, Map.of("cintura", 82), null, null), 409)
                .get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        api.delete("/avaliacoes-fisicas/" + id + "?versao=" + versao, treinador, 409);
        assertThat(api.get("/alunos/" + aluno + "/avaliacoes-fisicas", treinador, 200).get(0).get("medidas")
                .get("cintura").decimalValue()).isEqualByComparingTo("81");
    }

    @Test
    void outraConsultoriaNaoVeNemAltera() throws Exception {
        JsonNode a = registrar(hoje, Map.of("cintura", 80));
        String id = a.get("id").asString();
        JsonNode outro = api.novoTreinador();
        api.get("/alunos/" + aluno + "/avaliacoes-fisicas", outro, 404);
        api.post("/alunos/" + aluno + "/avaliacoes-fisicas", outro, corpo(hoje.minusDays(1), Map.of("cintura", 80), null, null), 404);
        api.put("/avaliacoes-fisicas/" + id, outro, corpo(hoje, Map.of("cintura", 1), null, a.get("versao").asLong()), 404);
        api.delete("/avaliacoes-fisicas/" + id, outro, 404);
        assertThat(api.get("/alunos/" + aluno + "/avaliacoes-fisicas", treinador, 200)).hasSize(1);
    }

    @Test
    void semPermissaoSensivelDa403() throws Exception {
        String id = registrar(hoje, Map.of("cintura", 80)).get("id").asString();
        UUID usuario = UUID.fromString(treinador.path("usuario").path("id").asString());
        // O Assistente não tem ALUNO_SENSIVEL_LER (as mesmas rotas do peso dão 403).
        jdbc.update("update usuario u set perfil_id=p.id from perfil p where u.id=? and p.consultoria_id=u.consultoria_id"
                + " and p.nome='Assistente'", usuario);
        try {
            api.get("/alunos/" + aluno + "/avaliacoes-fisicas", treinador, 403);
            api.post("/alunos/" + aluno + "/avaliacoes-fisicas", treinador, corpo(hoje.minusDays(1), Map.of("cintura", 80), null, null), 403);
            api.put("/avaliacoes-fisicas/" + id, treinador, corpo(hoje, Map.of("cintura", 81), null, 0L), 403);
            api.delete("/avaliacoes-fisicas/" + id, treinador, 403);
        } finally {
            jdbc.update("update usuario u set perfil_id=p.id from perfil p where u.id=? and p.consultoria_id=u.consultoria_id"
                    + " and p.nome='Administrador'", usuario);
        }
        assertThat(api.get("/alunos/" + aluno + "/avaliacoes-fisicas", treinador, 200)).hasSize(1);
    }

    @Test
    void alunoSoLeAsProprias() throws Exception {
        registrar(hoje, Map.of("cintura", 80));
        UUID colega = api.criarAluno(treinador, "Colega Fictício");
        api.post("/alunos/" + colega + "/avaliacoes-fisicas", treinador, corpo(hoje, Map.of("cintura", 70), null, null), 200);

        JsonNode loginDoAluno = api.convidarEEntrar(treinador, aluno);
        JsonNode minhas = api.get("/aluno/avaliacoes-fisicas", loginDoAluno, 200);
        assertThat(minhas).hasSize(1);
        assertThat(minhas.get(0).get("medidas").get("cintura").decimalValue()).isEqualByComparingTo("80");

        // Rotas da equipe: o aluno não tem permissão nenhuma, nem para as próprias.
        api.get("/alunos/" + aluno + "/avaliacoes-fisicas", loginDoAluno, 403);
        api.get("/alunos/" + colega + "/avaliacoes-fisicas", loginDoAluno, 403);
        api.post("/alunos/" + aluno + "/avaliacoes-fisicas", loginDoAluno, corpo(hoje.minusDays(1), Map.of("cintura", 80), null, null), 403);
        // E a rota do aluno não serve para a equipe.
        api.get("/aluno/avaliacoes-fisicas", treinador, 403);
    }

    @Test
    void exportacaoLevaAsAvaliacoes() throws Exception {
        registrar(hoje, Map.of("cintura", 80));
        var resposta = mvc.perform(MockMvcRequestBuilders.get("/alunos/" + aluno + "/exportacao")
                .header("Authorization", ApiDeTeste.bearer(treinador))).andReturn().getResponse();
        assertThat(resposta.getStatus()).isEqualTo(200);
        JsonNode dados = json.readTree(resposta.getContentAsString(StandardCharsets.UTF_8));
        assertThat(dados.get("avaliacoesFisicas").get("itens")).hasSize(1);
        assertThat(dados.get("secoesOmitidas").toString()).doesNotContain("avaliacoesFisicas");
    }

    @Test
    void anonimizarApagaERecusaAvaliacaoNova() throws Exception {
        registrar(hoje, Map.of("cintura", 80));
        api.patch("/alunos/" + aluno + "/situacao", treinador, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", treinador, Map.of("nomeConfirmado", NOME), 200);
        assertThat(contar("select count(*) from avaliacao_fisica where aluno_id = ?::uuid", aluno.toString())).isZero();

        JsonNode recusa = api.post("/alunos/" + aluno + "/avaliacoes-fisicas", treinador,
                corpo(hoje, Map.of("cintura", 80), null, null), 409);
        assertThat(recusa.get("codigo").asString()).isEqualTo("ALUNO_ANONIMIZADO");
    }

    @Test
    void excluirMinhaContaApagaAsAvaliacoes() throws Exception {
        registrar(hoje, Map.of("cintura", 80));
        JsonNode loginDoAluno = api.convidarEEntrar(treinador, aluno);
        api.post("/aluno/conta/excluir", loginDoAluno, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);
        assertThat(contar("select count(*) from avaliacao_fisica where aluno_id = ?::uuid", aluno.toString())).isZero();
    }
}
