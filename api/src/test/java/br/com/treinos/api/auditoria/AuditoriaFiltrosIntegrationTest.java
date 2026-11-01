package br.com.treinos.api.auditoria;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Filtros do lote 2 em {@code GET /auditoria}: {@code usuarioId} e {@code acao} repetíveis (OU dentro, E entre eles),
 * {@code usuarioId=sistema} para os eventos sem autor, recusas e outra consultoria. Dados fictícios.
 */
@AutoConfigureMockMvc
class AuditoriaFiltrosIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private Auditoria auditoria;
    @Autowired private PlatformTransactionManager transacoes;

    private ApiDeTeste api;
    private JsonNode admin;
    private JsonNode membro;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        String perfil = api.post("/perfis", admin, Map.of("nome", "Cadastro fictício",
                "permissoes", Set.of("ALUNO_LER", "ALUNO_ALTERAR")), 200).path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", "Membro fictício",
                "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        membro = api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private static String id(JsonNode login) {
        return login.path("usuario").path("id").asString();
    }

    private Set<String> pares(String consulta) throws Exception {
        Set<String> pares = new HashSet<>();
        api.get("/auditoria?" + consulta, admin, 200).path("itens").forEach(e ->
                pares.add(e.path("acao").asString() + "|" + (e.path("usuarioId").isNull() ? "sistema" : e.path("usuarioId").asString())));
        return pares;
    }

    @Test
    void pessoasEAcoesRepetiveisESistema() throws Exception {
        api.post("/alunos", admin, Map.of("nome", "Aluno do admin"), 200);
        api.post("/alunos", membro, Map.of("nome", "Aluno do membro"), 200);
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class, id(admin));
        new TransactionTemplate(transacoes).executeWithoutResult(s -> auditoria.registrarDoSistema(consultoria,
                "PAGAMENTO_ONLINE_CONFIRMADO", "COBRANCA", UUID.randomUUID(), "Confirmou um pagamento online."));

        assertThat(pares("acao=ALUNO_CRIADO")).containsExactlyInAnyOrder("ALUNO_CRIADO|" + id(admin), "ALUNO_CRIADO|" + id(membro));
        assertThat(pares("acao=ALUNO_CRIADO&usuarioId=" + id(membro))).containsExactly("ALUNO_CRIADO|" + id(membro));
        assertThat(pares("acao=ALUNO_CRIADO,PAGAMENTO_ONLINE_CONFIRMADO&usuarioId=" + id(membro) + "&usuarioId=sistema"))
                .containsExactlyInAnyOrder("ALUNO_CRIADO|" + id(membro), "PAGAMENTO_ONLINE_CONFIRMADO|sistema");
        assertThat(pares("usuarioId=sistema")).containsExactly("PAGAMENTO_ONLINE_CONFIRMADO|sistema");
        assertThat(pares("usuarioId=" + id(admin) + "&acao=PERFIL_CRIADO&acao=ALUNO_CRIADO"))
                .containsExactlyInAnyOrder("PERFIL_CRIADO|" + id(admin), "ALUNO_CRIADO|" + id(admin));
        assertThat(pares("usuarioId=" + id(membro) + "&acao=PERFIL_CRIADO")).isEmpty();
    }

    @Test
    void recusasEOutraConsultoria() throws Exception {
        JsonNode r = api.get("/auditoria?acao=drop_table", admin, 400);
        assertThat(r.path("codigo").asString()).isEqualTo("FILTRO_INVALIDO");
        assertThat(r.toString()).doesNotContain("drop");
        assertThat(api.get("/auditoria?usuarioId=fulano", admin, 400).path("codigo").asString()).isEqualTo("FILTRO_INVALIDO");
        StringBuilder muitas = new StringBuilder("acao=");
        for (int i = 0; i < 51; i++) muitas.append(i == 0 ? "" : ",").append("ACAO_").append(i);
        assertThat(api.get("/auditoria?" + muitas, admin, 400).path("codigo").asString()).isEqualTo("FILTRO_INVALIDO");
        api.get("/auditoria?usuarioId=" + UUID.randomUUID(), admin, 404);

        JsonNode outro = api.novoTreinador();
        api.get("/auditoria?usuarioId=" + id(admin), outro, 404);
        api.get("/auditoria?usuarioId=" + id(outro) + "&usuarioId=" + id(admin), outro, 404);
        assertThat(api.get("/auditoria?usuarioId=sistema", outro, 200).path("itens")).isEmpty();
        // Sem a permissão da rota, nada (o filtro não abre o que a rota não abria).
        api.get("/auditoria?acao=ALUNO_CRIADO", membro, 403);
    }
}
