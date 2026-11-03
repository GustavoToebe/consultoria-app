package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.LimiteDoTreinadorDeTeste;
import br.com.treinos.api.LimiteDoTreinadorDeTeste.Membro;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Planilha completa com o limite por treinador (D3, D7): os alunos novos têm sempre o importador como responsável, então o
 * limite é o de quem importa. Os que não cabem ficam de fora, como no limite do plano (a planilha fictícia do teste traz 5
 * alunos ativos), contando o que o membro já tem e os que a própria confirmação grava. Só dados fictícios.
 */
@AutoConfigureMockMvc
class PlanilhaCompletaLimiteDoTreinadorIntegrationTest extends AbstractIntegrationTest {

    private static final String BASE = "/importacoes/planilha-completa/";
    private static final byte[] PLANILHA = PlanilhaDeTeste.xlsx(PlanilhaDeTeste.abasDoTreinador());

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode admin;
    private LimiteDoTreinadorDeTeste lim;
    private Membro membro;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        lim = new LimiteDoTreinadorDeTeste(api, admin, banco);
        membro = lim.membro();
    }

    private JsonNode enviar(JsonNode login, String acao, String hash) throws Exception {
        MockMultipartHttpServletRequestBuilder pedido = multipart(BASE + acao)
                .file(new MockMultipartFile("arquivo", "planilha.xlsx", "application/octet-stream", PLANILHA))
                .header("X-Treinos-Cliente", "nativo")
                .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login));
        if (hash != null) {
            pedido.param("hash", hash);
        }
        String texto = mvc.perform(pedido).andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        return json.readTree(texto);
    }

    @Test
    void membroImportadorComLimiteDeixaOsQueSobramDeFora() throws Exception {
        lim.limite(membro, 2);
        JsonNode previa = enviar(membro.login(), "previa", null);
        assertThat(previa.path("criacao").path("alunosNovos").asInt()).isEqualTo(2);
        assertThat(previa.toString()).doesNotContain(membro.nome()).doesNotContain(membro.id());
        assertThat(lim.ativosDe(membro)).isZero(); // a prévia não grava

        JsonNode feito = enviar(membro.login(), "confirmar", previa.path("hash").asString());
        assertThat(feito.path("importacaoId").asString()).isNotBlank();
        assertThat(lim.ativosDe(membro)).isEqualTo(2);
        assertThat(banco.queryForObject("select count(*) from aluno where importacao_id = ?::uuid", Long.class,
                feito.path("importacaoId").asString())).isEqualTo(2);
    }

    @Test
    void contaOQueOMembroJaTemMaisOsDaPropriaConfirmacao() throws Exception {
        lim.limite(membro, 3);
        lim.aluno(membro); // vaga para dois
        JsonNode previa = enviar(membro.login(), "previa", null);
        assertThat(previa.path("criacao").path("alunosNovos").asInt()).isEqualTo(2);

        enviar(membro.login(), "confirmar", previa.path("hash").asString());
        assertThat(lim.ativosDe(membro)).isEqualTo(3);
    }

    @Test
    void membroNoLimiteImportaNenhumAlunoNovoEOutroImportadorNaoEBarrado() throws Exception {
        lim.limite(membro, 1);
        lim.aluno(membro);
        JsonNode previa = enviar(membro.login(), "previa", null);
        assertThat(previa.path("criacao").path("alunosNovos").asInt()).isZero();
        assertThat(lim.ativosDe(membro)).isEqualTo(1);

        // O Administrador não tem limite: a mesma planilha entra inteira para ele.
        JsonNode doAdmin = enviar(admin, "previa", null);
        assertThat(doAdmin.path("criacao").path("alunosNovos").asInt()).isEqualTo(5);
    }

    @Test
    void semLimiteEntramTodos() throws Exception {
        JsonNode previa = enviar(membro.login(), "previa", null);
        assertThat(previa.path("criacao").path("alunosNovos").asInt()).isEqualTo(5);
        enviar(membro.login(), "confirmar", previa.path("hash").asString());
        assertThat(lim.ativosDe(membro)).isEqualTo(5);
    }
}
