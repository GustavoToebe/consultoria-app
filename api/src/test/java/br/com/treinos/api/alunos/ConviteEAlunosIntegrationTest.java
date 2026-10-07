package br.com.treinos.api.alunos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Seção 15.1, item 5 (convite), mais situação do aluno, peso e painel do treinador. */
@AutoConfigureMockMvc
class ConviteEAlunosIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID aluno;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, "Maria Fictícia Souza");
    }

    @Test
    void conviteMostraAMarcaEValeUmaVez() throws Exception {
        JsonNode convite = api.post("/alunos/" + aluno + "/convite", treinador, null, 200);
        String codigo = convite.get("codigo").asString();
        assertThat(codigo).hasSize(10).matches("[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}");
        assertThat(convite.get("link").asString()).endsWith("/convite?codigo=" + codigo);

        JsonNode publico = api.get("/publico/convites/" + codigo, null, 200);
        assertThat(publico.get("primeiroNomeAluno").asString()).isEqualTo("Maria");
        assertThat(publico.get("consultoria").get("id").asString())
                .isEqualTo(treinador.get("marca").get("id").asString());

        String email = ApiDeTeste.emailUnico("aluna");
        JsonNode login = api.post("/publico/convites/" + codigo.toLowerCase(java.util.Locale.ROOT) + "/aceitar", null,
                Map.of("email", email, "senha", ApiDeTeste.SENHA), 200);
        assertThat(login.get("usuario").get("papel").asString()).isEqualTo("ALUNO");
        assertThat(api.get("/alunos/" + aluno, treinador, 200).get("temAcesso").asBoolean()).isTrue();

        api.post("/publico/convites/" + codigo + "/aceitar", null,
                Map.of("email", ApiDeTeste.emailUnico("outra"), "senha", ApiDeTeste.SENHA), 404);
        api.get("/publico/convites/" + codigo, null, 404);
        // Aluno com acesso não recebe convite novo.
        assertThat(api.post("/alunos/" + aluno + "/convite", treinador, null, 409).get("codigo").asString())
                .isEqualTo("ALUNO_COM_ACESSO");
    }

    @Test
    void conviteExpiradoOuSubstituidoNaoVale() throws Exception {
        String primeiro = api.post("/alunos/" + aluno + "/convite", treinador, null, 200).get("codigo").asString();
        String segundo = api.post("/alunos/" + aluno + "/convite", treinador, null, 200).get("codigo").asString();
        api.get("/publico/convites/" + primeiro, null, 404);
        api.get("/publico/convites/" + segundo, null, 200);

        jdbc.update("update aluno set convite_expira_em = now() - interval '1 minute' where id = ?", aluno);
        api.get("/publico/convites/" + segundo, null, 404);
        api.post("/publico/convites/" + segundo + "/aceitar", null,
                Map.of("email", ApiDeTeste.emailUnico("tarde"), "senha", ApiDeTeste.SENHA), 404);
    }

    @Test
    void emailJaUsadoRecebe409() throws Exception {
        String emailDoTreinador = api.get("/eu", treinador, 200).get("usuario").get("email").asString();
        String codigo = api.post("/alunos/" + aluno + "/convite", treinador, null, 200).get("codigo").asString();
        JsonNode erro = api.post("/publico/convites/" + codigo + "/aceitar", null,
                Map.of("email", emailDoTreinador, "senha", ApiDeTeste.SENHA), 409);
        assertThat(erro.get("codigo").asString()).isEqualTo("EMAIL_EM_USO");
        // O convite continua valendo para o e-mail certo.
        api.post("/publico/convites/" + codigo + "/aceitar", null,
                Map.of("email", ApiDeTeste.emailUnico("certo"), "senha", ApiDeTeste.SENHA), 200);
    }

    @Test
    void inativarAlunoDerrubaASessaoEBloqueiaOLogin() throws Exception {
        JsonNode loginAluno = api.convidarEEntrar(treinador, aluno);
        api.get("/eu", loginAluno, 200);

        api.patch("/alunos/" + aluno + "/situacao", treinador, Map.of("ativo", false), 200);
        api.get("/eu", loginAluno, 401);
        api.post("/auth/refresh", null, Map.of("refreshToken", loginAluno.get("refreshToken").asString()), 401);
        assertThat(api.get("/alunos?situacao=INATIVO", treinador, 200).get("total").asLong()).isEqualTo(1);
        assertThat(api.get("/alunos", treinador, 200).get("total").asLong()).isZero();

        api.patch("/alunos/" + aluno + "/situacao", treinador, Map.of("ativo", true), 200);
        assertThat(api.get("/alunos", treinador, 200).get("itens").get(0).get("temAcesso").asBoolean()).isTrue();
    }

    @Test
    void alterarAlunoUsaLockOtimista() throws Exception {
        JsonNode detalhe = api.get("/alunos/" + aluno, treinador, 200);
        long versao = detalhe.get("versao").asLong();
        api.put("/alunos/" + aluno, treinador, Map.of("nome", "Nome Novo Fictício", "versao", versao), 200);
        JsonNode erro = api.put("/alunos/" + aluno, treinador, Map.of("nome", "Outra Aba", "versao", versao), 409);
        assertThat(erro.get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
    }

    @Test
    void pesoCalculaAVariacaoESubstituiNoMesmoDia() throws Exception {
        LocalDate hoje = LocalDate.now(br.com.treinos.api.web.Fuso.BRASILIA);
        api.post("/alunos/" + aluno + "/pesos", treinador, Map.of("data", hoje.minusDays(7).toString(), "pesoKg", 82.0), 200);
        api.post("/alunos/" + aluno + "/pesos", treinador, Map.of("data", hoje.toString(), "pesoKg", 81.4), 200);
        JsonNode pesos = api.post("/alunos/" + aluno + "/pesos", treinador,
                Map.of("data", hoje.toString(), "pesoKg", 81.1, "observacao", "Em jejum"), 200);
        assertThat(pesos).hasSize(2);
        assertThat(pesos.get(0).get("pesoKg").decimalValue()).isEqualByComparingTo("81.1");
        assertThat(pesos.get(0).get("variacao").decimalValue()).isEqualByComparingTo("-0.9");
        assertThat(pesos.get(1).get("variacao").isNull()).isTrue();

        api.post("/alunos/" + aluno + "/pesos", treinador, Map.of("data", hoje.plusDays(1).toString(), "pesoKg", 80), 400);
        api.delete("/alunos/" + aluno + "/pesos/" + pesos.get(0).get("id").asString(), treinador, 204);
        assertThat(api.get("/alunos/" + aluno + "/pesos", treinador, 200)).hasSize(1);
    }

    @Test
    void painelMostraAlunosSemRegistroEPlanosTerminando() throws Exception {
        JsonNode painel = api.get("/painel", treinador, 200);
        assertThat(painel.get("alunosAtivos").asLong()).isEqualTo(1);
        assertThat(painel.get("alunosSemRegistro7Dias").get(0).get("nome").asString()).isEqualTo("Maria Fictícia Souza");
        assertThat(painel.get("ultimasExecucoes")).isEmpty();
    }
}
