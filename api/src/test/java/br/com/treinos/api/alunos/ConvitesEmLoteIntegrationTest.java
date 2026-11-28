package br.com.treinos.api.alunos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Convite de acesso em lote ({@code POST /alunos/lote/convites}): mesma regra do individual, um resultado por aluno. Dados fictícios. */
@AutoConfigureMockMvc
class ConvitesEmLoteIntegrationTest extends AbstractIntegrationTest {

    private static final String ROTA = "/alunos/lote/convites";
    private static final String TELEFONE = "(45) 99999-8888";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    private ApiDeTeste api;
    private JsonNode treinador;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
    }

    private UUID aluno(String nome) throws Exception {
        return api.criarAluno(treinador, nome + " " + UUID.randomUUID());
    }

    private JsonNode gerar(List<UUID> ids) throws Exception {
        return api.post(ROTA, treinador, Map.of("alunoIds", ids), 200).path("resultados");
    }

    private static String codigo(JsonNode item) {
        String link = item.path("link").asString();
        assertThat(link).contains("/convite#codigo=");
        return link.substring(link.indexOf("#codigo=") + "#codigo=".length());
    }

    private int consultar(String codigo) throws Exception {
        return mvc.perform(post("/publico/convites/consultar").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("codigo", codigo)))).andReturn().getResponse().getStatus();
    }

    private String consultoria() {
        return treinador.path("marca").path("id").asString();
    }

    private int auditorias() {
        return banco.queryForObject("select count(*) from auditoria where acao = 'ALUNOS_CONVITES_GERADOS' and consultoria_id = ?::uuid",
                Integer.class, consultoria());
    }

    private String hashDoConvite(UUID aluno) {
        return banco.queryForObject("select convite_hash from aluno where id = ?", String.class, aluno);
    }

    @Test
    void geraLinksDistintosQueValemEAuditaUmaVezComNoStore() throws Exception {
        UUID a1 = UUID.fromString(api.post("/alunos", treinador, Map.of("nome", "Aluna lote " + UUID.randomUUID(), "telefone", TELEFONE), 200)
                .path("id").asString());
        UUID a2 = aluno("Aluno lote dois");
        UUID a3 = aluno("Aluno lote três");

        String corpo = json.writeValueAsString(Map.of("alunoIds", List.of(a1, a2, a3)));
        var resposta = mvc.perform(post(ROTA).header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(treinador))
                        .contentType(MediaType.APPLICATION_JSON).content(corpo))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, org.hamcrest.Matchers.containsString("no-store")))
                .andReturn();
        JsonNode itens = api.ler(resposta).path("resultados");

        assertThat(itens).hasSize(3);
        Set<String> codigos = new HashSet<>();
        List<UUID> ordem = List.of(a1, a2, a3);
        for (int i = 0; i < 3; i++) {
            JsonNode item = itens.get(i);
            assertThat(UUID.fromString(item.path("alunoId").asString())).isEqualTo(ordem.get(i));
            assertThat(item.path("situacao").asString()).isEqualTo("GERADO");
            assertThat(item.path("nome").asString()).isNotBlank();
            assertThat(item.path("validoAte").asString()).isNotBlank();
            String codigo = codigo(item);
            codigos.add(codigo);
            assertThat(consultar(codigo)).isEqualTo(200);
        }
        assertThat(codigos).hasSize(3);
        assertThat(itens.get(0).path("telefone").asString()).isEqualTo(TELEFONE);
        assertThat(itens.get(1).path("telefone").isNull()).isTrue();

        // O link do lote é aceito como o do individual e consumido.
        String primeiro = codigo(itens.get(0));
        api.post("/publico/convites/aceitar", null,
                Map.of("codigo", primeiro, "email", ApiDeTeste.emailUnico("lote"), "senha", ApiDeTeste.SENHA), 200);
        assertThat(consultar(primeiro)).isEqualTo(404);

        // Um evento por chamada, com resumo fixo, sem id, nome, telefone nem link.
        assertThat(auditorias()).isEqualTo(1);
        Map<String, Object> evento = banco.queryForMap("select resumo, entidade_id from auditoria "
                + "where acao = 'ALUNOS_CONVITES_GERADOS' and consultoria_id = ?::uuid", consultoria());
        assertThat(evento.get("entidade_id")).isNull();
        String resumo = (String) evento.get("resumo");
        assertThat(resumo).isEqualTo("Gerou convites de acesso de alunos em lote.");
        for (String c : codigos) assertThat(resumo).doesNotContain(c);
    }

    @Test
    void renovarInvalidaOLinkAntigoTambemODoIndividual() throws Exception {
        UUID a = aluno("Aluno renovar");
        String individual = api.post("/alunos/" + a + "/convite", treinador, null, 200).path("codigo").asString();
        String doLote = codigo(gerar(List.of(a)).get(0));
        assertThat(consultar(individual)).isEqualTo(404);
        assertThat(consultar(doLote)).isEqualTo(200);

        String novo = codigo(gerar(List.of(a)).get(0));
        assertThat(novo).isNotEqualTo(doLote);
        assertThat(consultar(doLote)).isEqualTo(404);
        assertThat(consultar(novo)).isEqualTo(200);
    }

    @Test
    void loteMistoNaOrdemDoPedidoSemDerrubarOsDemais() throws Exception {
        UUID livre = aluno("Aluno livre");
        UUID comAcesso = aluno("Aluno com acesso");
        api.convidarEEntrar(treinador, comAcesso);
        UUID inativo = aluno("Aluno inativo");
        api.patch("/alunos/" + inativo + "/situacao", treinador, Map.of("ativo", false), 200);
        String nomeAnon = "Aluno anonimizar " + UUID.randomUUID();
        UUID anonimizado = api.criarAluno(treinador, nomeAnon);
        api.patch("/alunos/" + anonimizado + "/situacao", treinador, Map.of("ativo", false), 200);
        api.post("/alunos/" + anonimizado + "/anonimizar", treinador, Map.of("nomeConfirmado", nomeAnon), 200);
        JsonNode outro = api.novoTreinador();
        UUID deOutra = api.criarAluno(outro, "Aluno de outra consultoria " + UUID.randomUUID());
        String hashDeOutra = hashDoIndividual(outro, deOutra);
        UUID inexistente = UUID.randomUUID();

        String hashComAcesso = hashDoConvite(comAcesso);
        List<UUID> pedido = List.of(deOutra, comAcesso, livre, inativo, anonimizado, inexistente);
        JsonNode itens = gerar(pedido);

        assertThat(itens).hasSize(pedido.size());
        for (int i = 0; i < pedido.size(); i++) assertThat(UUID.fromString(itens.get(i).path("alunoId").asString())).isEqualTo(pedido.get(i));
        assertThat(situacoes(itens)).containsExactly("NAO_ENCONTRADO", "JA_TEM_ACESSO", "GERADO", "INATIVO", "ANONIMIZADO",
                "NAO_ENCONTRADO");
        for (int i : List.of(0, 1, 3, 4, 5)) {
            assertThat(itens.get(i).path("link").isNull()).isTrue();
            assertThat(itens.get(i).path("validoAte").isNull()).isTrue();
        }
        // Outra consultoria não revela nada e não é tocada.
        assertThat(itens.get(0).path("nome").isNull()).isTrue();
        assertThat(itens.get(0).path("telefone").isNull()).isTrue();
        assertThat(hashDoConvite(deOutra)).isEqualTo(hashDeOutra);
        // Quem já tem acesso não ganha convite nem mexe no que havia.
        assertThat(hashDoConvite(comAcesso)).isEqualTo(hashComAcesso);
        assertThat(hashDoConvite(inativo)).isNull();
        assertThat(hashDoConvite(anonimizado)).isNull();
        assertThat(consultar(codigo(itens.get(2)))).isEqualTo(200);
    }

    @Test
    void semConviteGeradoNaoAudita() throws Exception {
        UUID inativo = aluno("Aluno só inativo");
        api.patch("/alunos/" + inativo + "/situacao", treinador, Map.of("ativo", false), 200);
        assertThat(situacoes(gerar(List.of(inativo, UUID.randomUUID())))).containsExactly("INATIVO", "NAO_ENCONTRADO");
        assertThat(auditorias()).isZero();
    }

    @Test
    void validacaoDoPedido() throws Exception {
        UUID a = aluno("Aluno validação");
        List<UUID> muitos = new ArrayList<>(List.of(a));
        for (int i = 0; i < 100; i++) muitos.add(UUID.randomUUID());
        assertThat(api.post(ROTA, treinador, Map.of("alunoIds", muitos), 400).path("message").asString())
                .isEqualTo("Escolha de 1 a 100 alunos.");
        api.post(ROTA, treinador, Map.of("alunoIds", List.of(a, a)), 400);
        api.post(ROTA, treinador, Map.of("alunoIds", List.of()), 400);
        api.post(ROTA, treinador, Map.of(), 400);
        var comNulo = new ArrayList<UUID>();
        comNulo.add(a);
        comNulo.add(null);
        api.post(ROTA, treinador, Map.of("alunoIds", comNulo), 400);
        assertThat(hashDoConvite(a)).isNull();
        assertThat(auditorias()).isZero();
    }

    @Test
    void semPermissaoDeConviteE403SemEfeito() throws Exception {
        UUID a = aluno("Aluno sem permissão");
        String perfil = api.post("/perfis", treinador, Map.of("nome", "Sem convite " + UUID.randomUUID(),
                "permissoes", Set.of("ALUNO_LER", "ALUNO_ALTERAR")), 200).path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador, Map.of("nome", "Membro sem convite",
                "email", ApiDeTeste.emailUnico("semconvite"), "perfilId", perfil), 200);
        JsonNode membro = api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
        api.post(ROTA, membro, Map.of("alunoIds", List.of(a)), 403);
        assertThat(hashDoConvite(a)).isNull();
        assertThat(auditorias()).isZero();
    }

    private String hashDoIndividual(JsonNode login, UUID aluno) throws Exception {
        api.post("/alunos/" + aluno + "/convite", login, null, 200);
        return hashDoConvite(aluno);
    }

    private static List<String> situacoes(JsonNode itens) {
        List<String> s = new ArrayList<>();
        itens.forEach(i -> s.add(i.path("situacao").asString()));
        return s;
    }
}
