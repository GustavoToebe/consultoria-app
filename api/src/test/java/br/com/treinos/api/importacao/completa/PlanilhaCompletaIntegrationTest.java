package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Análise da planilha completa pela rota: só leitura, a biblioteca da consultoria entra no casamento dos exercícios, a
 * resposta não leva dado de aluno e nada é gravado. Planilha fictícia gerada no teste.
 */
@AutoConfigureMockMvc
class PlanilhaCompletaIntegrationTest extends AbstractIntegrationTest {

    private static final String ROTA = "/importacoes/planilha-completa/analisar";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    private ApiDeTeste api;
    private JsonNode treinador;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
    }

    private MockMultipartHttpServletRequestBuilder pedido(JsonNode login, String nome, byte[] bytes) {
        var pedido = multipart(ROTA).file(new MockMultipartFile("arquivo", nome, "application/octet-stream", bytes));
        pedido.header("X-Treinos-Cliente", "nativo");
        if (login != null) {
            pedido.header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login));
        }
        return pedido;
    }

    private JsonNode analisar(JsonNode login, String nome, byte[] bytes, int esperado) throws Exception {
        String texto = mvc.perform(pedido(login, nome, bytes)).andExpect(status().is(esperado)).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        return texto.isBlank() ? json.nullNode() : json.readTree(texto);
    }

    @Test
    void analisaSemGravarECasaComABibliotecaDaConsultoria() throws Exception {
        api.post("/exercicios", treinador, Map.of("nome", "Supino reto com halteres", "modalidade", "LIVRE"), 200);
        byte[] planilha = PlanilhaDeTeste.xlsx(PlanilhaDeTeste.abasDoTreinador());

        JsonNode a = analisar(treinador, "planilha.xlsx", planilha, 200);

        assertThat(a.path("abas").size()).isEqualTo(9);
        assertThat(a.path("abas").get(0).path("tipo").asString()).isEqualTo("ALUNOS");
        assertThat(a.path("abas").get(6).path("tipo").asString()).isEqualTo("TREINO");
        assertThat(a.path("abas").get(8).path("tipo").asString()).isEqualTo("TABELA_DE_ALIMENTOS");
        assertThat(a.path("ligacoes").size()).isEqualTo(6);
        JsonNode resumo = a.path("resumo");
        assertThat(resumo.path("alunos").asInt()).isEqualTo(5);
        assertThat(resumo.path("exercicios").asInt()).isEqualTo(7);
        // Remada e Puxada pela lista da planilha; "Supino reto c/ hal." pela biblioteca da consultoria.
        assertThat(resumo.path("nomesDeExercicio").path("certo").asInt()).isEqualTo(3);
        assertThat(a.path("problemasPorTipo").path("LINHA_SEM_LIGACAO").asInt()).isEqualTo(3);

        // Quem pode gravar a dieta recebe os nomes da aba de suplementos (para decidir entre suplementação e
        // medicação); em nenhum outro lugar da resposta eles aparecem.
        assertThat(a.path("suplementos").toString()).contains("Remédio Fictício");
        JsonNode semSuplementos = a.deepCopy();
        ((tools.jackson.databind.node.ObjectNode) semSuplementos).remove("suplementos");
        String corpo = semSuplementos.toString();
        for (String proibido : new String[] {"Aluno Um", "um@example.com", "nao-e-email", "80.5", "Intra fictício",
                "Remédio Fictício", "Algo de terceiros"}) {
            assertThat(corpo).as(proibido).doesNotContain(proibido);
        }
        assertThat(api.get("/alunos", treinador, 200).path("total").asInt()).isZero();
        assertThat(api.get("/importacoes", treinador, 200).path("total").asInt()).isZero();
    }

    @Test
    void semPermissaoDeDietaOsNomesDosSuplementosNaoVoltam() throws Exception {
        String perfil = api.post("/perfis", treinador, Map.of("nome", "Perfil " + UUID.randomUUID(),
                "permissoes", java.util.Set.of("ALUNO_LER", "ALUNO_ALTERAR")), 200).path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador, Map.of("nome", "Membro fictício",
                "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        JsonNode membro = api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);

        JsonNode a = analisar(membro, "planilha.xlsx", PlanilhaDeTeste.xlsx(PlanilhaDeTeste.abasDoTreinador()), 200);
        assertThat(a.path("suplementos").isEmpty()).isTrue();
        assertThat(a.toString()).doesNotContain("Remédio Fictício");
    }

    @Test
    void bibliotecaDeOutraConsultoriaNaoEntraNoCasamento() throws Exception {
        JsonNode outro = api.novoTreinador();
        api.post("/exercicios", outro, Map.of("nome", "Supino reto com halteres", "modalidade", "LIVRE"), 200);
        JsonNode a = analisar(treinador, "planilha.xlsx", PlanilhaDeTeste.xlsx(PlanilhaDeTeste.abasDoTreinador()), 200);
        assertThat(a.path("resumo").path("nomesDeExercicio").path("certo").asInt()).isEqualTo(2);
    }

    @Test
    void arquivoInvalidoSemPermissaoESemLogin() throws Exception {
        JsonNode invalido = analisar(treinador, "planilha.xls", new byte[] {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0}, 422);
        assertThat(invalido.path("codigo").asString()).isEqualTo("ARQUIVO_INVALIDO");

        UUID aluno = api.criarAluno(treinador, "Aluno Fictício " + UUID.randomUUID());
        JsonNode loginDoAluno = api.convidarEEntrar(treinador, aluno);
        analisar(loginDoAluno, "planilha.xlsx", PlanilhaDeTeste.xlsx(PlanilhaDeTeste.abasDoTreinador()), 403);

        mvc.perform(pedido(null, "planilha.xlsx", PlanilhaDeTeste.xlsx(PlanilhaDeTeste.abasDoTreinador())))
                .andExpect(status().isUnauthorized());
    }
}
