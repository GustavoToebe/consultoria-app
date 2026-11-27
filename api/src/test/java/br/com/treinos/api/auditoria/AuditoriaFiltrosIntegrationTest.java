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

    private static String lista(String nome, int de, int ate) {
        StringBuilder s = new StringBuilder();
        for (int i = de; i < ate; i++) s.append(s.isEmpty() ? "" : "&").append(nome).append("=ACAO_").append(i);
        return s.toString();
    }

    @Test
    void acaoExcetoExcluiECombinaETetoDeAcaoEDe100() throws Exception {
        api.post("/alunos", admin, Map.of("nome", "Aluno do admin"), 200);
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class, id(admin));
        new TransactionTemplate(transacoes).executeWithoutResult(s -> auditoria.registrarDoSistema(consultoria,
                "LOGIN_BLOQUEADO", "USUARIO", UUID.randomUUID(), "Login bloqueado por excesso de tentativas."));
        int total = api.get("/auditoria", admin, 200).path("total").asInt();
        int logins = jdbc.queryForObject("select count(*) from auditoria where consultoria_id = ? and acao in ('LOGIN_SUCESSO','LOGIN_BLOQUEADO')",
                Integer.class, consultoria);
        assertThat(logins).isGreaterThanOrEqualTo(2);

        JsonNode sem = api.get("/auditoria?acaoExceto=LOGIN_SUCESSO&acaoExceto=LOGIN_BLOQUEADO", admin, 200);
        assertThat(sem.path("total").asInt()).isEqualTo(total - logins).isPositive();
        assertThat(sem.path("itens")).hasSize(total - logins);
        sem.path("itens").forEach(e -> assertThat(e.path("acao").asString()).doesNotStartWith("LOGIN_"));
        // Lista separada por vírgula, vazia e combinação com os outros filtros.
        assertThat(api.get("/auditoria?acaoExceto=LOGIN_SUCESSO,LOGIN_BLOQUEADO", admin, 200).path("total").asInt()).isEqualTo(total - logins);
        assertThat(api.get("/auditoria?acaoExceto=", admin, 200).path("total").asInt()).isEqualTo(total);
        assertThat(pares("acao=ALUNO_CRIADO&acaoExceto=ALUNO_CRIADO")).isEmpty();
        assertThat(pares("acao=ALUNO_CRIADO,LOGIN_SUCESSO&acaoExceto=LOGIN_SUCESSO&usuarioId=" + id(admin))).containsExactly("ALUNO_CRIADO|" + id(admin));
        String hoje = java.time.LocalDate.now(br.com.treinos.api.web.Fuso.BRASILIA).toString();
        assertThat(pares("acaoExceto=LOGIN_SUCESSO&usuarioId=sistema&de=" + hoje + "&ate=" + hoje)).containsExactly("LOGIN_BLOQUEADO|sistema");

        // Teto de acao neste endpoint: 62 passa, 100 passa, 101 recusa; acaoExceto segue com 50.
        assertThat(pares(lista("acao", 0, 61) + "&acao=ALUNO_CRIADO")).containsExactly("ALUNO_CRIADO|" + id(admin));
        api.get("/auditoria?" + lista("acao", 0, 99) + "&acao=ALUNO_CRIADO", admin, 200);
        assertThat(api.get("/auditoria?" + lista("acao", 0, 101), admin, 400).path("codigo").asString()).isEqualTo("FILTRO_INVALIDO");
        api.get("/auditoria?" + lista("acaoExceto", 0, 50), admin, 200);
        assertThat(api.get("/auditoria?" + lista("acaoExceto", 0, 51), admin, 400).path("codigo").asString()).isEqualTo("FILTRO_INVALIDO");
        JsonNode invalido = api.get("/auditoria?acaoExceto=drop_table", admin, 400);
        assertThat(invalido.path("codigo").asString()).isEqualTo("FILTRO_INVALIDO");
        assertThat(invalido.toString()).doesNotContain("drop");
    }

    private String perfilDe(JsonNode login) {
        return jdbc.queryForObject("select p.nome from perfil p join usuario u on u.perfil_id = p.id and u.consultoria_id = p.consultoria_id where u.id = ?::uuid",
                String.class, id(login));
    }

    @Test
    void eventoTrazOPerfilDoAutorNuloParaOSistemaESemVazar() throws Exception {
        api.post("/alunos", admin, Map.of("nome", "Aluno do admin"), 200);
        api.post("/alunos", membro, Map.of("nome", "Aluno do membro"), 200);
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class, id(admin));
        new TransactionTemplate(transacoes).executeWithoutResult(s -> auditoria.registrarDoSistema(consultoria,
                "PAGAMENTO_ONLINE_CONFIRMADO", "COBRANCA", UUID.randomUUID(), "Confirmou um pagamento online."));

        Map<String, String> perfis = new java.util.HashMap<>();
        api.get("/auditoria?acao=ALUNO_CRIADO&acao=PAGAMENTO_ONLINE_CONFIRMADO", admin, 200).path("itens").forEach(e ->
                perfis.put(e.path("usuarioId").isNull() ? "sistema" : e.path("usuarioId").asString(),
                        e.path("usuarioPerfil").isNull() ? null : e.path("usuarioPerfil").asString()));
        assertThat(perfis).containsOnlyKeys(id(admin), id(membro), "sistema");
        assertThat(perfis.get(id(admin))).isEqualTo(perfilDe(admin)).isNotBlank();
        assertThat(perfis.get(id(membro))).isEqualTo("Cadastro fictício");
        assertThat(perfis.get("sistema")).isNull();

        // Outra consultoria só vê os próprios autores e o próprio perfil; nada do perfil criado aqui.
        JsonNode outro = api.novoTreinador();
        JsonNode lista = api.get("/auditoria", outro, 200).path("itens");
        assertThat(lista).isNotEmpty();
        lista.forEach(e -> {
            assertThat(e.path("usuarioId").asString()).isEqualTo(id(outro));
            assertThat(e.path("usuarioPerfil").asString()).isEqualTo(perfilDe(outro));
        });
        assertThat(lista.toString()).doesNotContain("Cadastro fictício");
    }

    @Test
    void recusasEOutraConsultoria() throws Exception {
        JsonNode r = api.get("/auditoria?acao=drop_table", admin, 400);
        assertThat(r.path("codigo").asString()).isEqualTo("FILTRO_INVALIDO");
        assertThat(r.toString()).doesNotContain("drop");
        assertThat(api.get("/auditoria?usuarioId=fulano", admin, 400).path("codigo").asString()).isEqualTo("FILTRO_INVALIDO");
        StringBuilder muitas = new StringBuilder("acao=");
        for (int i = 0; i < 101; i++) muitas.append(i == 0 ? "" : ",").append("ACAO_").append(i);
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
