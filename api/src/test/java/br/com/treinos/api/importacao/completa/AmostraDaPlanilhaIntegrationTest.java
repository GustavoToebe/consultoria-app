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
        MockMultipartHttpServletRequestBuilder pedido = multipart(BASE + acao)
                .file(new MockMultipartFile("arquivo", "planilha.xlsx", "application/octet-stream", PLANILHA))
                .header("X-Treinos-Cliente", "nativo")
                .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login));
        if (inicio != null) {
            pedido.param("inicio", inicio);
        }
        if (hash != null) {
            pedido.param("hash", hash);
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
