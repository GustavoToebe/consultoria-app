package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Migração assistida, fase 2: {@code POST /importacoes/planilha-completa/amostra} pela rota, com a planilha fictícia gerada no
 * teste (a chave é ligada pela suíte; o caso desligada está no {@code MigracaoAssistidaDesligadaIntegrationTest}). Só lê, o
 * {@code hash} serve à confirmação que já existe, e o perfil sem a permissão de uma parte não vê essa parte.
 */
@AutoConfigureMockMvc
class AmostraDaPlanilhaIntegrationTest extends AbstractIntegrationTest {

    private static final String BASE = "/importacoes/planilha-completa/";
    private static final byte[] PLANILHA = PlanilhaDeTeste.xlsx(PlanilhaDeTeste.abasDoTreinador());

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode treinador;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
    }

    private JsonNode enviar(JsonNode login, String acao, String inicio, String hash, int esperado) throws Exception {
        return enviar(login, acao, inicio, hash, esperado, PLANILHA);
    }

    private JsonNode enviar(JsonNode login, String acao, String inicio, String hash, int esperado, byte[] planilha)
            throws Exception {
        return enviar(login, acao, inicio, hash, esperado, planilha, null);
    }

    private JsonNode enviar(JsonNode login, String acao, String inicio, String hash, int esperado, byte[] planilha,
                            String ignorados) throws Exception {
        MockMultipartHttpServletRequestBuilder pedido = multipart(BASE + acao)
                .file(new MockMultipartFile("arquivo", "planilha.xlsx", "application/octet-stream", planilha))
                .header("X-Treinos-Cliente", "nativo")
                .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login));
        if (inicio != null) {
            pedido.param("inicio", inicio);
        }
        if (hash != null) {
            pedido.param("hash", hash);
        }
        if (ignorados != null) {
            pedido.param("alunosIgnorados", ignorados);
        }
        String texto = mvc.perform(pedido).andExpect(status().is(esperado)).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        return json.readTree(texto);
    }

    private JsonNode membroCom(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", treinador, Map.of("nome", "Perfil fictício " + UUID.randomUUID(),
                "permissoes", permissoes), 200).path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador, Map.of("nome", "Membro Fictício",
                "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null, Map.of("codigo", convite.path("codigo").asString(),
                "senha", ApiDeTeste.SENHA), 200);
    }

    @Test
    void mostraORevisavelSemGravarEOHashServeAConfirmacao() throws Exception {
        JsonNode previa = enviar(treinador, "previa", null, null, 200);
        JsonNode amostra = enviar(treinador, "amostra", null, null, 200);

        assertThat(amostra.path("hash").asString()).isEqualTo(previa.path("hash").asString());
        assertThat(amostra.path("total").asInt()).isEqualTo(5);
        assertThat(amostra.path("pasta").asString()).isEqualTo("Importada da planilha (rascunho)");
        JsonNode alunos = amostra.path("alunos");
        assertThat(alunos).hasSize(5);
        JsonNode um = alunos.get(0);
        assertThat(um.path("numero").asInt()).isEqualTo(1);
        assertThat(um.path("situacao").asString()).isEqualTo("NOVO");
        assertThat(um.path("nome").asString()).isEqualTo("Aluno Um");
        assertThat(um.path("email").asString()).isEqualTo("um@example.com");
        assertThat(um.path("pesos").asInt()).isPositive();
        assertThat(um.path("dieta").path("refeicoes")).isNotEmpty();
        assertThat(um.path("treino").path("sessoes")).isNotEmpty();
        int pesos = 0;
        for (JsonNode a : alunos) {
            pesos += a.path("pesos").asInt();
        }
        assertThat(pesos).isEqualTo(previa.path("criacao").path("pesos").asInt());

        // Só lê: nenhum aluno, nenhum registro de importação, nenhuma auditoria de importação.
        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isZero();
        assertThat(api.get("/importacoes", treinador, 200).path("total").asInt()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from auditoria where acao = 'IMPORTACAO_CONCLUIDA' and consultoria_id = "
                + "(select consultoria_id from usuario where id = ?::uuid)", Integer.class,
                treinador.path("usuario").path("id").asString())).isZero();

        // O hash da amostra é aceito pela confirmação que já existe, que grava em rascunho; o "Desfazer" existente apaga.
        JsonNode feito = enviar(treinador, "confirmar", null, amostra.path("hash").asString(), 200);
        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isEqualTo(5);
        String id = feito.path("importacaoId").asString();
        mvc.perform(post("/importacoes/" + id + "/desfazer").header("X-Treinos-Cliente", "nativo")
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(treinador)))
                .andExpect(status().isOk());
        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isZero();
    }

    @Test
    void inicioPassaAdiante() throws Exception {
        JsonNode resto = enviar(treinador, "amostra", "3", null, 200);
        assertThat(resto.path("inicio").asInt()).isEqualTo(3);
        assertThat(resto.path("total").asInt()).isEqualTo(5);
        assertThat(resto.path("alunos")).hasSize(2);
        assertThat(resto.path("alunos").get(0).path("numero").asInt()).isEqualTo(4);
        assertThat(enviar(treinador, "amostra", "50", null, 200).path("alunos")).isEmpty();
    }

    @Test
    void alunoExistenteQueSoRecebePesosApareceSemPlanoComONomeDoCadastro() throws Exception {
        String email = ApiDeTeste.emailUnico("so-pesos");
        String id = api.post("/alunos", treinador, Map.of("nome", "Cadastro Só Pesos Fictício", "email", email), 200)
                .path("id").asString();
        // Casa pelo e-mail; o nome escrito na planilha é outro, e o da amostra tem de ser o do cadastro.
        Map<String, List<List<Object>>> abas = new LinkedHashMap<>();
        abas.put("Alunos", List.of(PlanilhaDeTeste.CAB_ALUNOS,
                PlanilhaDeTeste.linha("AL1", "Nome Da Planilha Fictício", email, null, null, null, null, "Ativo", null)));
        abas.put("Histórico Pesos", List.of(PlanilhaDeTeste.CAB_PESOS,
                PlanilhaDeTeste.linha("P1", "AL1", "x", PlanilhaDeTeste.data("2026-01-05"), 1, 80.5, null, null),
                PlanilhaDeTeste.linha("P2", "AL1", "x", PlanilhaDeTeste.data("2026-01-12"), 2, 79.5, null, null)));
        byte[] planilha = PlanilhaDeTeste.xlsx(abas);

        JsonNode previa = enviar(treinador, "previa", null, null, 200, planilha);
        JsonNode amostra = enviar(treinador, "amostra", null, null, 200, planilha);

        assertThat(amostra.path("hash").asString()).isEqualTo(previa.path("hash").asString());
        assertThat(amostra.path("total").asInt()).isEqualTo(1);
        assertThat(amostra.path("alunos")).hasSize(1);
        JsonNode aluno = amostra.path("alunos").get(0);
        assertThat(aluno.path("numero").asInt()).isEqualTo(1);
        assertThat(aluno.path("situacao").asString()).isEqualTo("EXISTENTE");
        assertThat(aluno.path("nome").asString()).isEqualTo("Cadastro Só Pesos Fictício");
        assertThat(aluno.path("pesos").asInt()).isEqualTo(2);
        assertThat(aluno.path("ultimosPesos")).hasSize(2);
        assertThat(aluno.path("treino").isNull()).isTrue();
        assertThat(aluno.path("dieta").isNull()).isTrue();
        assertThat(aluno.path("ativo").isNull()).isTrue();
        assertThat(amostra.toString()).doesNotContain("Nome Da Planilha Fictício");
        // A confirmação grava os mesmos pesos no aluno que já existia (e nenhum aluno novo).
        assertThat(aluno.path("pesos").asInt()).isEqualTo(previa.path("criacao").path("pesos").asInt());
        enviar(treinador, "confirmar", null, amostra.path("hash").asString(), 200, planilha);
        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isEqualTo(1);
        assertThat(api.get("/alunos/" + id + "/pesos", treinador, 200)).hasSize(2);
    }

    @Test
    void alunoIgnoradoNaAmostraFicaForaDaConfirmacaoSemMudarOHash() throws Exception {
        JsonNode amostra = enviar(treinador, "amostra", null, null, 200);
        String hash = amostra.path("hash").asString();
        String nomeIgnorado = amostra.path("alunos").get(1).path("nome").asString();
        String nomeIgnorado2 = amostra.path("alunos").get(3).path("nome").asString();

        // Marcar ou desmarcar um aluno não muda o hash: a mesma prévia vale com e sem a lista.
        assertThat(enviar(treinador, "previa", null, null, 200).path("hash").asString()).isEqualTo(hash);
        JsonNode feito = enviar(treinador, "confirmar", null, hash, 200, PLANILHA, "2,4");

        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isEqualTo(3);
        assertThat(feito.path("criados").path("alunosNovos").asInt()).isEqualTo(3);
        String alunos = api.get("/alunos", treinador, 200).toString();
        assertThat(alunos).doesNotContain(nomeIgnorado).doesNotContain(nomeIgnorado2);
    }

    @Test
    void ignorarTodosOsAlunosOuUmNumeroQueNaoExisteERecusado() throws Exception {
        String hash = enviar(treinador, "amostra", null, null, 200).path("hash").asString();

        JsonNode todos = enviar(treinador, "confirmar", null, hash, 422, PLANILHA, "1,2,3,4,5");
        assertThat(todos.path("codigo").asString()).isEqualTo("NENHUM_ALUNO_MARCADO");
        assertThat(enviar(treinador, "confirmar", null, hash, 422, PLANILHA, "9").path("codigo").asString())
                .isEqualTo("ALUNO_IGNORADO_INVALIDO");
        enviar(treinador, "confirmar", null, hash, 422, PLANILHA, "0");
        // Nada foi gravado.
        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isZero();
    }

    @Test
    void semPermissaoDeUmaParteElaNaoApareceNaAmostra() throws Exception {
        JsonNode membro = membroCom(Set.of("ALUNO_LER", "ALUNO_ALTERAR"));
        JsonNode amostra = enviar(membro, "amostra", null, null, 200);

        assertThat(amostra.path("alunos")).hasSize(5);
        for (JsonNode a : amostra.path("alunos")) {
            assertThat(a.path("pesos").asInt()).isZero();
            assertThat(a.path("treino").isNull()).isTrue();
            assertThat(a.path("dieta").isNull()).isTrue();
        }
        for (String proibido : new String[] {"80.5", "Feijão fictício", "Remédio Fictício", "Remada fictícia", "Observação geral"}) {
            assertThat(amostra.toString()).as(proibido).doesNotContain(proibido);
        }
    }

    @Test
    void semAlunoAlterarARotaNemAbre() throws Exception {
        enviar(membroCom(Set.of("ALUNO_LER")), "amostra", null, null, 403);
    }
}
