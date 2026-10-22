package br.com.treinos.api.integracao;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.EmailDeTeste;
import br.com.treinos.api.receitas.ReceitaService;
import br.com.treinos.api.tenant.TenantContext;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integração com a Central ponta a ponta: filtro HMAC, provisionamento (criar, repetir, adotar, recusar), direitos,
 * bloqueio de acesso, sincronização e Minha conta contra uma Central de mentira que confere a assinatura.
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "treinos.integracao.ativa=true",
        "treinos.integracao.bloqueio-ativo=true",
        "treinos.integracao.chaves-entrada=entrada-a:" + IntegracaoCentralIntegrationTest.SEGREDO_ENTRADA_A
                + ",entrada-b:" + IntegracaoCentralIntegrationTest.SEGREDO_ENTRADA_B,
        "treinos.integracao.chave-saida-id=saida-1",
        "treinos.integracao.chave-saida-segredo=" + IntegracaoCentralIntegrationTest.SEGREDO_SAIDA,
        "treinos.integracao.produto=TREINOS"
})
class IntegracaoCentralIntegrationTest extends AbstractIntegrationTest {

    static final String SEGREDO_ENTRADA_A = "QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB";
    static final String SEGREDO_ENTRADA_B = "QkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJC";
    static final String SEGREDO_SAIDA = "Q0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0ND";

    private static final byte[] BYTES_A = Base64.getDecoder().decode(SEGREDO_ENTRADA_A);
    private static final byte[] BYTES_B = Base64.getDecoder().decode(SEGREDO_ENTRADA_B);
    private static final byte[] BYTES_SAIDA = Base64.getDecoder().decode(SEGREDO_SAIDA);

    /** Central de mentira: confere a assinatura de saída e devolve o que o teste armou. */
    static final class CentralFalsa {
        final HttpServer servidor;
        final AtomicReference<String> direitos = new AtomicReference<>("{\"itens\":[],\"total\":0}");
        final AtomicReference<Integer> statusMinhaConta = new AtomicReference<>(200);
        final AtomicReference<String> minhaConta = new AtomicReference<>("{}");
        final AtomicReference<Integer> statusLink = new AtomicReference<>(200);
        final AtomicReference<String> link = new AtomicReference<>("{}");
        final AtomicReference<String> ultimoMetodo = new AtomicReference<>();
        final AtomicReference<String> ultimoCaminho = new AtomicReference<>();
        final AtomicReference<Boolean> assinaturaValida = new AtomicReference<>();
        /** Lida no instante em que a chamada de Minha conta chega (conexões do banco em uso naquela hora). */
        final AtomicReference<Supplier<Integer>> sonda = new AtomicReference<>(() -> null);
        final AtomicReference<Integer> sondaNaChamada = new AtomicReference<>();

        CentralFalsa() {
            try {
                servidor = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            } catch (IOException e) {
                throw new IllegalStateException(e);
            }
            servidor.createContext("/", troca -> {
                String caminho = troca.getRequestURI().getRawPath()
                        + (troca.getRequestURI().getRawQuery() == null ? "" : "?" + troca.getRequestURI().getRawQuery());
                var h = troca.getRequestHeaders();
                String esperada = HmacAssinatura.assinar(BYTES_SAIDA, troca.getRequestMethod(), caminho,
                        h.getFirst(IntegracaoFiltro.TIMESTAMP), h.getFirst(IntegracaoFiltro.NONCE), new byte[0]);
                boolean valida = "saida-1".equals(h.getFirst(IntegracaoFiltro.CHAVE))
                        && esperada.equals(h.getFirst(IntegracaoFiltro.ASSINATURA));
                ultimoCaminho.set(caminho);
                ultimoMetodo.set(troca.getRequestMethod());
                assinaturaValida.set(valida);
                int codigo;
                String corpo;
                if (!valida) {
                    codigo = 401;
                    corpo = "{}";
                } else if (caminho.endsWith("/link-de-pagamento")) {
                    codigo = statusLink.get();
                    corpo = link.get();
                } else if (caminho.contains("/minha-conta")) {
                    sondaNaChamada.set(sonda.get().get());
                    codigo = statusMinhaConta.get();
                    corpo = minhaConta.get();
                } else {
                    codigo = 200;
                    corpo = direitos.get();
                }
                byte[] bytes = corpo.getBytes(StandardCharsets.UTF_8);
                troca.getResponseHeaders().add("Content-Type", "application/json");
                troca.sendResponseHeaders(codigo, bytes.length);
                troca.getResponseBody().write(bytes);
                troca.close();
            });
            servidor.start();
        }

        String url() {
            return "http://127.0.0.1:" + servidor.getAddress().getPort();
        }
    }

    static final CentralFalsa CENTRAL = new CentralFalsa();

    @DynamicPropertySource
    static void propriedadesDaCentral(DynamicPropertyRegistry registry) {
        registry.add("treinos.integracao.central-url", CENTRAL::url);
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private javax.sql.DataSource dataSource;
    @Autowired private JdbcTemplate jdbc;
    @MockitoSpyBean private ReceitaService receitas;
    @Autowired private SincronizacaoDireitosService sincronizacao;

    private ApiDeTeste api;

    @BeforeEach
    void preparar() {
        api = new ApiDeTeste(mvc, json);
        CENTRAL.statusMinhaConta.set(200);
        CENTRAL.direitos.set("{\"itens\":[],\"total\":0}");
    }

    // ---- chamadas assinadas ----

    private MvcResult chamar(String metodo, String caminho, Object corpo, String chave, byte[] segredo, String timestamp,
                             String nonce, UUID idempotencia) throws Exception {
        byte[] bytes = corpo == null ? new byte[0] : json.writeValueAsString(corpo).getBytes(StandardCharsets.UTF_8);
        String assinatura = HmacAssinatura.assinar(segredo, metodo, caminho, timestamp, nonce, bytes);
        return executar(metodo, caminho, bytes, chave, timestamp, nonce, assinatura, idempotencia);
    }

    private MvcResult executar(String metodo, String caminho, byte[] bytes, String chave, String timestamp, String nonce,
                               String assinatura, UUID idempotencia) throws Exception {
        MockHttpServletRequestBuilder req = MockMvcRequestBuilders.request(HttpMethod.valueOf(metodo), caminho);
        if (chave != null) {
            req.header(IntegracaoFiltro.CHAVE, chave);
        }
        req.header(IntegracaoFiltro.TIMESTAMP, timestamp).header(IntegracaoFiltro.NONCE, nonce)
                .header(IntegracaoFiltro.ASSINATURA, assinatura);
        if (idempotencia != null) {
            req.header("Idempotency-Key", idempotencia.toString());
        }
        if (bytes.length > 0) {
            req.contentType(MediaType.APPLICATION_JSON).content(bytes);
        }
        return mvc.perform(req).andReturn();
    }

    private MvcResult central(String metodo, String caminho, Object corpo, UUID idempotencia) throws Exception {
        return chamar(metodo, caminho, corpo, "entrada-a", BYTES_A, agora(), UUID.randomUUID().toString(), idempotencia);
    }

    private JsonNode central(String metodo, String caminho, Object corpo, UUID idempotencia, int esperado) throws Exception {
        MvcResult r = central(metodo, caminho, corpo, idempotencia);
        String texto = r.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(r.getResponse().getStatus()).as(texto).isEqualTo(esperado);
        return texto.isBlank() ? json.nullNode() : json.readTree(texto);
    }

    private static String agora() {
        return Long.toString(Instant.now().getEpochSecond());
    }

    private static Map<String, Object> direitos(UUID contratacao, UUID tenant, long versao, String situacao, boolean liberado) {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("contratacaoId", contratacao);
        d.put("produto", "TREINOS");
        d.put("tenantId", tenant);
        d.put("versao", versao);
        d.put("situacao", situacao);
        d.put("acessoLiberado", liberado);
        d.put("motivoBloqueio", liberado ? null : "Inadimplência");
        d.put("plano", Map.of("codigo", "pro", "nome", "Profissional"));
        d.put("limites", Map.of("alunos_ativos", 50));
        d.put("funcionalidades", List.of("pdf"));
        d.put("campoFuturo", "ignorado");
        return d;
    }

    private static Map<String, Object> pedido(UUID contratacao, String email, String slug) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("contratacaoId", contratacao);
        corpo.put("clienteId", UUID.randomUUID());
        corpo.put("instancia", Map.of("nome", "Consultoria " + slug, "slug", slug));
        corpo.put("administrador", Map.of("nome", "Admin Teste", "email", email));
        corpo.put("direitos", direitos(contratacao, null, 1, "ATIVA", true));
        return corpo;
    }

    private static String slugUnico() {
        return "t" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private JsonNode provisionar(UUID contratacao, String email) throws Exception {
        return central("POST", "/integracao/v1/instancias", pedido(contratacao, email, slugUnico()), contratacao, 201);
    }

    private static String codigoDoConvite(JsonNode resposta) {
        String link = resposta.path("administrador").path("convite").path("link").asString();
        return link.substring(link.indexOf('#') + 1);
    }

    private void assertCodigo(MvcResult r, int status, String codigo) throws Exception {
        assertThat(r.getResponse().getStatus()).isEqualTo(status);
        assertThat(json.readTree(r.getResponse().getContentAsString(StandardCharsets.UTF_8)).path("codigo").asString())
                .isEqualTo(codigo);
    }

    // ---- filtro HMAC ----

    @Test
    void recusaChamadasSemAssinaturaValida() throws Exception {
        String ts = agora();
        String nonce = UUID.randomUUID().toString();
        String caminho = "/integracao/v1/saude";
        String boa = HmacAssinatura.assinar(BYTES_A, "GET", caminho, ts, nonce, new byte[0]);
        byte[] vazio = new byte[0];

        assertThat(executar("GET", caminho, vazio, null, ts, nonce, boa, null).getResponse().getStatus()).isEqualTo(401);
        assertCodigo(executar("GET", caminho, vazio, "desconhecida", ts, nonce, boa, null), 401, "CHAVE_DESCONHECIDA");
        assertCodigo(executar("GET", caminho, vazio, "entrada-a", ts, nonce, "v1=" + "0".repeat(64), null),
                401, "ASSINATURA_INVALIDA");
        // Assinada com o segredo da outra chave.
        assertCodigo(executar("GET", caminho, vazio, "entrada-a", ts, nonce,
                HmacAssinatura.assinar(BYTES_B, "GET", caminho, ts, nonce, vazio), null), 401, "ASSINATURA_INVALIDA");
        String velho = Long.toString(Instant.now().getEpochSecond() - 301);
        assertCodigo(executar("GET", caminho, vazio, "entrada-a", velho, nonce,
                HmacAssinatura.assinar(BYTES_A, "GET", caminho, velho, nonce, vazio), null), 401, "TIMESTAMP_FORA_DA_JANELA");
    }

    @Test
    void aceitaAsDuasChavesEBarraNonceRepetido() throws Exception {
        String nonce = UUID.randomUUID().toString();
        MvcResult ok = chamar("GET", "/integracao/v1/saude", null, "entrada-b", BYTES_B, agora(), nonce, null);
        assertThat(ok.getResponse().getStatus()).isEqualTo(200);
        assertThat(json.readTree(ok.getResponse().getContentAsString()).path("produto").asString()).isEqualTo("TREINOS");
        assertCodigo(chamar("GET", "/integracao/v1/saude", null, "entrada-b", BYTES_B, agora(), nonce, null), 401, "NONCE_REPETIDO");
    }

    @Test
    void assinaturaDoCaminhoIncluiAQuery() throws Exception {
        String ts = agora();
        String nonce = UUID.randomUUID().toString();
        String assinadaSemQuery = HmacAssinatura.assinar(BYTES_A, "GET", "/integracao/v1/recursos", ts, nonce, new byte[0]);
        assertCodigo(executar("GET", "/integracao/v1/recursos?x=1", new byte[0], "entrada-a", ts, nonce, assinadaSemQuery, null),
                401, "ASSINATURA_INVALIDA");
        assertThat(central("GET", "/integracao/v1/recursos?x=1", null, null, 200).isArray()).isTrue();
    }

    @Test
    void jwtDeUsuarioNaoAbreAIntegracao() throws Exception {
        var login = api.novoTreinador();
        mvc.perform(MockMvcRequestBuilders.get("/integracao/v1/saude").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login)))
                .andExpect(status().isUnauthorized());
    }

    // ---- provisionamento ----

    @Test
    void provisionaConsultoriaNovaComConviteECriaOPrimeiroAdministrador() throws Exception {
        UUID contratacao = UUID.randomUUID();
        String email = ApiDeTeste.emailUnico("admin");
        JsonNode resposta = provisionar(contratacao, email);

        assertThat(resposta.path("administrador").path("situacao").asString()).isEqualTo("CONVIDADO");
        assertThat(resposta.path("versaoDireitosAplicada").asLong()).isEqualTo(1);
        assertThat(resposta.path("administrador").path("convite").path("link").asString()).contains("/convite-equipe#");
        UUID tenant = UUID.fromString(resposta.path("tenantId").asString());

        JsonNode instancia = central("GET", "/integracao/v1/instancias/" + tenant, null, null, 200);
        assertThat(instancia.path("contratacaoId").asString()).isEqualTo(contratacao.toString());
        assertThat(instancia.path("acessoEfetivo").asBoolean()).isTrue();

        JsonNode login = api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", codigoDoConvite(resposta), "senha", ApiDeTeste.SENHA), 200);
        assertThat(jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.path("usuario").path("id").asString())).isEqualTo(tenant);
        api.get("/eu", login, 200);
    }

    @Test
    void repeticaoComAMesmaChaveDevolve200SemOConviteEOutroCorpoDa409() throws Exception {
        UUID contratacao = UUID.randomUUID();
        Map<String, Object> corpo = pedido(contratacao, ApiDeTeste.emailUnico("admin"), slugUnico());
        MvcResult primeira = central("POST", "/integracao/v1/instancias", corpo, contratacao);
        assertThat(primeira.getResponse().getStatus()).isEqualTo(201);

        MvcResult repetida = central("POST", "/integracao/v1/instancias", corpo, contratacao);
        assertThat(repetida.getResponse().getStatus()).isEqualTo(200);
        assertThat(repetida.getResponse().getHeader("Idempotency-Replayed")).isEqualTo("true");
        JsonNode r1 = json.readTree(primeira.getResponse().getContentAsString());
        JsonNode r2 = json.readTree(repetida.getResponse().getContentAsString());
        assertThat(r2.path("tenantId").asString()).isEqualTo(r1.path("tenantId").asString());
        assertThat(r2.path("administrador").has("convite")).isFalse();

        Map<String, Object> outro = new LinkedHashMap<>(corpo);
        outro.put("instancia", Map.of("nome", "Outra", "slug", slugUnico()));
        assertThat(central("POST", "/integracao/v1/instancias", outro, contratacao).getResponse().getStatus()).isEqualTo(409);
    }

    @Test
    void chaveDeIdempotenciaPrecisaSerADaContratacao() throws Exception {
        UUID contratacao = UUID.randomUUID();
        assertThat(central("POST", "/integracao/v1/instancias", pedido(contratacao, ApiDeTeste.emailUnico("admin"), slugUnico()),
                UUID.randomUUID()).getResponse().getStatus()).isEqualTo(400);
    }

    @Test
    void adotaAConsultoriaDoAdministradorQueJaExiste() throws Exception {
        String email = ApiDeTeste.emailUnico("existente");
        var login = api.cadastrarTreinador(email);
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.path("usuario").path("id").asString());
        UUID contratacao = UUID.randomUUID();

        JsonNode resposta = central("POST", "/integracao/v1/instancias", pedido(contratacao, email.toUpperCase(java.util.Locale.ROOT), slugUnico()),
                contratacao, 201);
        assertThat(resposta.path("tenantId").asString()).isEqualTo(consultoria.toString());
        assertThat(resposta.path("administrador").path("situacao").asString()).isEqualTo("VINCULADO");
        assertThat(resposta.path("administrador").has("convite")).isFalse();

        // Outra contratação para a mesma consultoria é recusada; ela continua entrando normalmente.
        UUID outra = UUID.randomUUID();
        assertCodigo(central("POST", "/integracao/v1/instancias", pedido(outra, email, slugUnico()), outra),
                409, "CONSULTORIA_JA_VINCULADA");
        api.get("/eu", login, 200);
    }

    @Test
    void recusaSlugEmUsoEEmailQueNaoEAdministrador() throws Exception {
        String slug = slugUnico();
        UUID a = UUID.randomUUID();
        central("POST", "/integracao/v1/instancias", pedido(a, ApiDeTeste.emailUnico("a"), slug), a, 201);
        UUID b = UUID.randomUUID();
        assertCodigo(central("POST", "/integracao/v1/instancias", pedido(b, ApiDeTeste.emailUnico("b"), slug), b), 422, "SLUG_EM_USO");

        // Aluno nunca é administrador de consultoria: o e-mail dele não é adotado nem ganha consultoria nova.
        var treinador = api.novoTreinador();
        var loginAluno = api.convidarEEntrar(treinador, api.criarAluno(treinador, "Aluno Teste"));
        String emailAluno = loginAluno.path("usuario").path("email").asString();
        UUID c = UUID.randomUUID();
        String slugRecusado = slugUnico();
        assertCodigo(central("POST", "/integracao/v1/instancias", pedido(c, emailAluno, slugRecusado), c),
                422, "ADMINISTRADOR_INVALIDO");
        // Filtra pelo slug deste pedido: não depende de quantas consultorias os outros testes já criaram.
        assertThat(jdbc.queryForObject("select count(*) from consultoria where slug = ?", Long.class, slugRecusado)).isZero();
    }

    @Test
    void consultoriaCriadaPelaCentralNasceComAsReceitasPadraoEARepeticaoNaoDuplica() throws Exception {
        UUID contratacao = UUID.randomUUID();
        Map<String, Object> corpo = pedido(contratacao, ApiDeTeste.emailUnico("admin"), slugUnico());
        JsonNode resposta = central("POST", "/integracao/v1/instancias", corpo, contratacao, 201);
        UUID tenant = UUID.fromString(resposta.path("tenantId").asString());
        Long modelos = jdbc.queryForObject("select count(*) from receita where consultoria_id = ?", Long.class, tenant);
        assertThat(jdbc.queryForObject("select count(*) from receita where consultoria_id = ? and tipo = 'METODOLOGIA'",
                Long.class, tenant)).isEqualTo(1L);
        // Mesma Idempotency-Key e mesmo corpo: devolve a resposta gravada, sem criar as receitas de novo.
        central("POST", "/integracao/v1/instancias", corpo, contratacao, 200);
        assertThat(jdbc.queryForObject("select count(*) from receita where consultoria_id = ?", Long.class, tenant))
                .isEqualTo(modelos);
    }

    @Test
    void falhaAoCriarAsReceitasPadraoNaoPerdeOConviteEOPrimeiroAcessoDoAdministradorCorrige() throws Exception {
        doThrow(new IllegalStateException("falha simulada")).when(receitas).garantirPadrao();
        JsonNode resposta;
        UUID tenant;
        try {
            UUID contratacao = UUID.randomUUID();
            resposta = central("POST", "/integracao/v1/instancias",
                    pedido(contratacao, ApiDeTeste.emailUnico("admin"), slugUnico()), contratacao, 201);
            tenant = UUID.fromString(resposta.path("tenantId").asString());
            assertThat(codigoDoConvite(resposta)).isNotBlank();
            assertThat(jdbc.queryForObject("select count(*) from receita where consultoria_id = ?", Long.class, tenant))
                    .isZero();
        } finally {
            reset(receitas);
        }
        // O administrador aceita o convite do sistema: as receitas padrão passam a existir, uma vez cada.
        api.post("/publico/convites-equipe/aceitar", null, Map.of("codigo", codigoDoConvite(resposta), "senha", ApiDeTeste.SENHA), 200);
        Long modelos = jdbc.queryForObject("select count(*) from receita where consultoria_id = ?", Long.class, tenant);
        assertThat(modelos).isEqualTo(14L);
        assertThat(jdbc.queryForObject("select count(*) from receita where consultoria_id = ? and tipo = 'METODOLOGIA'",
                Long.class, tenant)).isEqualTo(1L);
        // Garantir de novo não duplica nem recria o que já existe.
        TenantContext.executarComo(tenant, () -> {
            receitas.garantirPadrao();
            return null;
        });
        assertThat(jdbc.queryForObject("select count(*) from receita where consultoria_id = ?", Long.class, tenant))
                .isEqualTo(modelos);
    }

    @Test
    void reemiteOConviteEOAnteriorDeixaDeValer() throws Exception {
        UUID contratacao = UUID.randomUUID();
        JsonNode resposta = provisionar(contratacao, ApiDeTeste.emailUnico("admin"));
        UUID tenant = UUID.fromString(resposta.path("tenantId").asString());
        String codigoAntigo = codigoDoConvite(resposta);

        JsonNode novo = central("POST", "/integracao/v1/instancias/" + tenant + "/convite-administrador", null, null, 201);
        String link = novo.path("link").asString();
        String codigoNovo = link.substring(link.indexOf('#') + 1);
        assertThat(codigoNovo).isNotEqualTo(codigoAntigo);

        api.post("/publico/convites-equipe/aceitar", null, Map.of("codigo", codigoAntigo, "senha", ApiDeTeste.SENHA), 404);
        api.post("/publico/convites-equipe/aceitar", null, Map.of("codigo", codigoNovo, "senha", ApiDeTeste.SENHA), 200);
        // Já tem acesso: não há mais o que reemitir.
        assertThat(central("POST", "/integracao/v1/instancias/" + tenant + "/convite-administrador", null, null)
                .getResponse().getStatus()).isEqualTo(409);
    }

    // ---- convite do administrador por e-mail ----

    @Test
    void conviteDaConsultoriaNovaVaiPorEmailUmaVezSoEORespostaNaoMuda() throws Exception {
        UUID contratacao = UUID.randomUUID();
        String email = ApiDeTeste.emailUnico("admin-email");
        Map<String, Object> corpo = pedido(contratacao, email.toUpperCase(java.util.Locale.ROOT), slugUnico());
        JsonNode resposta = central("POST", "/integracao/v1/instancias", corpo, contratacao, 201);

        // Contrato v1 intacto: o link continua na primeira resposta e é o mesmo do e-mail.
        String link = resposta.path("administrador").path("convite").path("link").asString();
        assertThat(link).contains("/convite-equipe#");
        await().atMost(Duration.ofSeconds(15)).until(() -> !EmailDeTeste.para(email).isEmpty());
        var mensagem = EmailDeTeste.para(email).get(0);
        assertThat(mensagem.texto()).contains(link).doesNotContain("Admin Teste");

        // A Central repete o pedido (1 min, 5 min...): a repetição não manda outro e-mail.
        assertThat(central("POST", "/integracao/v1/instancias", corpo, contratacao).getResponse().getStatus()).isEqualTo(200);
        await().during(Duration.ofMillis(700)).atMost(Duration.ofSeconds(5))
                .until(() -> EmailDeTeste.para(email).size() == 1);

        // O código do e-mail aceita o convite.
        api.post("/publico/convites-equipe/aceitar", null, Map.of("codigo", codigoDoConvite(resposta), "senha", ApiDeTeste.SENHA), 200);
    }

    @Test
    void adocaoDeConsultoriaExistenteNaoMandaConvitePorEmail() throws Exception {
        String email = ApiDeTeste.emailUnico("adocao-email");
        api.cadastrarTreinador(email);
        UUID contratacao = UUID.randomUUID();

        central("POST", "/integracao/v1/instancias", pedido(contratacao, email, slugUnico()), contratacao, 201);

        await().during(Duration.ofMillis(700)).atMost(Duration.ofSeconds(5)).until(() -> EmailDeTeste.para(email).isEmpty());
    }

    @Test
    void reemissaoDoConviteVaiPorEmailComOLinkNovo() throws Exception {
        UUID contratacao = UUID.randomUUID();
        String email = ApiDeTeste.emailUnico("reemite-email");
        JsonNode resposta = provisionar(contratacao, email);
        UUID tenant = UUID.fromString(resposta.path("tenantId").asString());
        await().atMost(Duration.ofSeconds(15)).until(() -> EmailDeTeste.para(email).size() == 1);

        JsonNode novo = central("POST", "/integracao/v1/instancias/" + tenant + "/convite-administrador", null, null, 201);

        await().atMost(Duration.ofSeconds(15)).until(() -> EmailDeTeste.para(email).size() == 2);
        assertThat(EmailDeTeste.para(email).get(1).texto()).contains(novo.path("link").asString());
        assertThat(List.copyOf(novo.propertyNames())).containsExactlyInAnyOrder("link", "expiraEm");
    }

    @Test
    void falhaDoProvedorDeEmailNaoDesfazOProvisionamento() throws Exception {
        EmailDeTeste.FALHAR.set(true);
        try {
            UUID contratacao = UUID.randomUUID();
            String email = ApiDeTeste.emailUnico("falha-email");

            JsonNode resposta = provisionar(contratacao, email);

            assertThat(resposta.path("administrador").path("convite").path("link").asString()).contains("/convite-equipe#");
            assertThat(EmailDeTeste.para(email)).isEmpty();
            // Convite válido mesmo sem o e-mail: o administrador entra pelo link da resposta.
            api.post("/publico/convites-equipe/aceitar", null, Map.of("codigo", codigoDoConvite(resposta), "senha", ApiDeTeste.SENHA), 200);
        } finally {
            EmailDeTeste.FALHAR.set(false);
        }
    }

    @Test
    void instanciaDesconhecidaDa404() throws Exception {
        assertThat(central("GET", "/integracao/v1/instancias/" + UUID.randomUUID(), null, null).getResponse().getStatus())
                .isEqualTo(404);
    }

    // ---- direitos ----

    @Test
    void direitosSoAplicamVersaoMaiorEVersaoMenorApenasConfirma() throws Exception {
        UUID contratacao = UUID.randomUUID();
        UUID tenant = UUID.fromString(provisionar(contratacao, ApiDeTeste.emailUnico("admin")).path("tenantId").asString());
        String caminho = "/integracao/v1/instancias/" + tenant + "/direitos";

        JsonNode nova = central("PUT", caminho, direitos(contratacao, tenant, 3, "INADIMPLENTE", true), null, 200);
        assertThat(nova.path("aplicado").asBoolean()).isTrue();
        assertThat(nova.path("versaoAtual").asLong()).isEqualTo(3);

        jdbc.update("update direitos_locais set confirmado_em = now() - interval '2 hours' where consultoria_id = ?", tenant);
        JsonNode velha = central("PUT", caminho, direitos(contratacao, tenant, 2, "ATIVA", true), null, 200);
        assertThat(velha.path("aplicado").asBoolean()).isFalse();
        assertThat(velha.path("versaoAtual").asLong()).isEqualTo(3);
        assertThat(jdbc.queryForObject("select situacao from direitos_locais where consultoria_id = ?", String.class, tenant))
                .isEqualTo("INADIMPLENTE");
        assertThat(jdbc.queryForObject("select confirmado_em > now() - interval '1 minute' from direitos_locais "
                + "where consultoria_id = ?", Boolean.class, tenant)).isTrue();
    }

    @Test
    void direitosDeOutraContratacaoProdutoOuInstanciaSaoRecusados() throws Exception {
        UUID contratacao = UUID.randomUUID();
        UUID tenant = UUID.fromString(provisionar(contratacao, ApiDeTeste.emailUnico("admin")).path("tenantId").asString());
        String caminho = "/integracao/v1/instancias/" + tenant + "/direitos";

        assertThat(central("PUT", caminho, direitos(UUID.randomUUID(), tenant, 9, "ATIVA", true), null).getResponse().getStatus())
                .isEqualTo(409);
        Map<String, Object> outroProduto = direitos(contratacao, tenant, 9, "ATIVA", true);
        outroProduto.put("produto", "SERVIREA");
        assertThat(central("PUT", caminho, outroProduto, null).getResponse().getStatus()).isEqualTo(400);
        assertThat(central("PUT", "/integracao/v1/instancias/" + UUID.randomUUID() + "/direitos",
                direitos(contratacao, null, 9, "ATIVA", true), null).getResponse().getStatus()).isEqualTo(404);
        Map<String, Object> semPlano = direitos(contratacao, tenant, 9, "ATIVA", true);
        semPlano.remove("plano");
        assertThat(central("PUT", caminho, semPlano, null).getResponse().getStatus()).isEqualTo(400);
    }

    // ---- bloqueio de acesso ----

    @Test
    void consultoriaSuspensaNaoEntraNemContinuaNaSessao() throws Exception {
        UUID contratacao = UUID.randomUUID();
        String email = ApiDeTeste.emailUnico("admin");
        JsonNode resposta = provisionar(contratacao, email);
        UUID tenant = UUID.fromString(resposta.path("tenantId").asString());
        JsonNode login = api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", codigoDoConvite(resposta), "senha", ApiDeTeste.SENHA), 200);
        api.get("/eu", login, 200);

        central("PUT", "/integracao/v1/instancias/" + tenant + "/direitos", direitos(contratacao, tenant, 2, "BLOQUEADA", false),
                null, 200);

        api.get("/eu", login, 401);
        JsonNode recusado = api.post("/auth/login", null, Map.of("email", email, "senha", ApiDeTeste.SENHA), 403);
        assertThat(recusado.path("codigo").asString()).isEqualTo("ACESSO_BLOQUEADO");
        assertThat(recusado.path("message").asString()).contains("suspenso");

        // Reativada pela Central: volta sem tocar em nada local.
        central("PUT", "/integracao/v1/instancias/" + tenant + "/direitos", direitos(contratacao, tenant, 3, "ATIVA", true),
                null, 200);
        api.post("/auth/login", null, Map.of("email", email, "senha", ApiDeTeste.SENHA), 200);
    }

    @Test
    void semConfirmacaoAlemDaToleranciaBloqueiaESincronizacaoReabre() throws Exception {
        UUID contratacao = UUID.randomUUID();
        String email = ApiDeTeste.emailUnico("admin");
        JsonNode resposta = provisionar(contratacao, email);
        UUID tenant = UUID.fromString(resposta.path("tenantId").asString());
        api.post("/publico/convites-equipe/aceitar", null, Map.of("codigo", codigoDoConvite(resposta), "senha", ApiDeTeste.SENHA), 200);

        jdbc.update("update direitos_locais set confirmado_em = ? where consultoria_id = ?",
                Timestamp.from(Instant.now().minus(73, ChronoUnit.HOURS)), tenant);
        JsonNode recusado = api.post("/auth/login", null, Map.of("email", email, "senha", ApiDeTeste.SENHA), 403);
        assertThat(recusado.path("message").asString()).contains("confirmar o plano");

        // A Central volta e confirma a mesma versão: o acesso reabre.
        CENTRAL.direitos.set(json.writeValueAsString(Map.of("total", 1, "itens",
                List.of(direitos(contratacao, tenant, 1, "ATIVA", true)))));
        var resumo = sincronizacao.executar();
        assertThat(resumo.completa()).isTrue();
        assertThat(resumo.confirmados()).isEqualTo(1);
        api.post("/auth/login", null, Map.of("email", email, "senha", ApiDeTeste.SENHA), 200);
    }

    @Test
    void consultoriaSemLinhaDeDireitosNuncaEBloqueada() throws Exception {
        api.get("/eu", api.novoTreinador(), 200);
    }

    // ---- sincronização ----

    @Test
    void sincronizacaoAplicaVersaoMaiorAssinaAChamadaEIgnoraDesconhecidos() throws Exception {
        UUID contratacao = UUID.randomUUID();
        UUID tenant = UUID.fromString(provisionar(contratacao, ApiDeTeste.emailUnico("admin")).path("tenantId").asString());
        CENTRAL.direitos.set(json.writeValueAsString(Map.of("total", 2, "itens", List.of(
                direitos(contratacao, tenant, 5, "ATIVA", true),
                direitos(UUID.randomUUID(), UUID.randomUUID(), 1, "ATIVA", true)))));

        var resumo = sincronizacao.executar();

        assertThat(resumo.completa()).isTrue();
        assertThat(resumo.aplicados()).isEqualTo(1);
        assertThat(resumo.ignorados()).isEqualTo(1);
        assertThat(CENTRAL.assinaturaValida.get()).isTrue();
        assertThat(CENTRAL.ultimoCaminho.get()).isEqualTo("/integracao/v1/produtos/TREINOS/direitos?pagina=0&tamanho=100");
        assertThat(jdbc.queryForObject("select versao from direitos_locais where consultoria_id = ?", Long.class, tenant))
                .isEqualTo(5);
        assertThat(sincronizacao.pendente()).isFalse();
    }

    @Test
    void sincronizacaoQueFalhaFicaPendenteENaoAlteraNada() throws Exception {
        UUID contratacao = UUID.randomUUID();
        UUID tenant = UUID.fromString(provisionar(contratacao, ApiDeTeste.emailUnico("admin")).path("tenantId").asString());
        CENTRAL.direitos.set("isto não é json");

        var resumo = sincronizacao.executar();

        assertThat(resumo.completa()).isFalse();
        assertThat(sincronizacao.pendente()).isTrue();
        assertThat(jdbc.queryForObject("select versao from direitos_locais where consultoria_id = ?", Long.class, tenant))
                .isEqualTo(1);
        CENTRAL.direitos.set("{\"itens\":[],\"total\":0}");
        assertThat(sincronizacao.executar().completa()).isTrue();
        assertThat(sincronizacao.pendente()).isFalse();
    }

    @Test
    void sincronizacaoComFormatoForaDoContratoNaoContaComoSucesso() throws Exception {
        CENTRAL.direitos.set("{\"content\":[],\"totalElements\":0}");
        assertThat(sincronizacao.executar().completa()).isFalse();
        assertThat(sincronizacao.pendente()).isTrue();
        CENTRAL.direitos.set("{\"itens\":[],\"total\":0}");
        assertThat(sincronizacao.executar().completa()).isTrue();
    }

    // ---- Minha conta ----

    private JsonNode loginDoAdministrador() throws Exception {
        JsonNode resposta = provisionar(UUID.randomUUID(), ApiDeTeste.emailUnico("admin"));
        return api.post("/publico/convites-equipe/aceitar", null, Map.of("codigo", codigoDoConvite(resposta), "senha", ApiDeTeste.SENHA), 200);
    }

    @Test
    void minhaContaVemDaCentralComAssinaturaEIdDaConsultoria() throws Exception {
        JsonNode login = loginDoAdministrador();
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.path("usuario").path("id").asString());
        CENTRAL.minhaConta.set("""
                {"cliente":{"nome":"Cliente Real","documento":"12.345.678/0001-90",
                  "endereco":{"logradouro":"Rua A","numero":"1","complemento":null,"bairro":"Centro","cidade":"Curitiba","uf":"PR","cep":"80000-000"},
                  "contatos":[{"nome":"Fulana","email":"f@exemplo.com","telefone":"(41) 99999-0000","principal":true}]},
                 "contratacao":{"planoNome":"Profissional","periodicidade":"MENSAL","valor":199.90,"diaVencimento":10,
                  "inicio":"2026-01-10","vigenteAte":null,"situacaoComercial":"ATIVA","nomeInstancia":"Consultoria X",
                  "adicionais":[{"nome":"Aluno extra","quantidade":5}]},
                 "cobrancas":[],"campoFuturo":"x"}""");

        JsonNode conta = api.get("/minha-conta", login, 200);

        assertThat(conta.path("previa").asBoolean()).isFalse();
        assertThat(conta.path("cliente").path("nome").asString()).isEqualTo("Cliente Real");
        assertThat(conta.path("cliente").path("contatos")).hasSize(1);
        assertThat(conta.path("contratacao").path("adicionais").path(0).path("nome").asString()).isEqualTo("Aluno extra");
        assertThat(CENTRAL.assinaturaValida.get()).isTrue();
        assertThat(CENTRAL.ultimoCaminho.get())
                .isEqualTo("/integracao/v1/produtos/TREINOS/instancias/" + consultoria + "/minha-conta");
    }

    @Test
    void minhaContaChamaACentralSemSegurarConexaoDoBanco() throws Exception {
        JsonNode login = loginDoAdministrador();
        var pool = dataSource.unwrap(HikariDataSource.class).getHikariPoolMXBean();
        CENTRAL.minhaConta.set("{}");
        CENTRAL.sonda.set(pool::getActiveConnections);
        // Uma transação aberta na requisição dá 1 em todas as chamadas; um agendador (limpeza de nonces) pode dar 1 por acaso.
        int menor = Integer.MAX_VALUE;
        try {
            for (int i = 0; i < 3; i++) {
                CENTRAL.sondaNaChamada.set(null);
                api.get("/minha-conta", login, 200);
                menor = Math.min(menor, CENTRAL.sondaNaChamada.get());
            }
        } finally {
            CENTRAL.sonda.set(() -> null);
        }
        assertThat(menor).as("conexões em uso durante o HTTP à Central").isZero();
    }

    @Test
    void minhaContaInexistenteVira404ECentralComErroVira502() throws Exception {
        JsonNode login = loginDoAdministrador();
        CENTRAL.statusMinhaConta.set(404);
        assertThat(api.get("/minha-conta", login, 404).path("codigo").asString()).isEqualTo("CONTA_NAO_ENCONTRADA");

        CENTRAL.statusMinhaConta.set(500);
        assertThat(api.get("/minha-conta", login, 502).path("codigo").asString()).isEqualTo("CENTRAL_INDISPONIVEL");

        CENTRAL.statusMinhaConta.set(200);
        CENTRAL.minhaConta.set("não é json");
        assertThat(api.get("/minha-conta", login, 502).path("codigo").asString()).isEqualTo("CENTRAL_INDISPONIVEL");
    }

    @Test
    void pagarPedeOLinkAssinadoNaCentralESoAceitaOMercadoPago() throws Exception {
        JsonNode login = loginDoAdministrador();
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.path("usuario").path("id").asString());
        UUID cobranca = UUID.randomUUID();
        String rota = "/minha-conta/cobrancas/" + cobranca + "/pagar";
        String url = "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=teste";
        CENTRAL.statusLink.set(200);
        CENTRAL.link.set("{\"url\":\"" + url + "\"}");

        assertThat(api.post(rota, login, null, 200).path("url").asString()).isEqualTo(url);
        assertThat(CENTRAL.assinaturaValida.get()).isTrue();
        assertThat(CENTRAL.ultimoMetodo.get()).isEqualTo("POST");
        assertThat(CENTRAL.ultimoCaminho.get()).isEqualTo(
                "/integracao/v1/produtos/TREINOS/instancias/" + consultoria + "/cobrancas/" + cobranca + "/link-de-pagamento");

        CENTRAL.link.set("{\"url\":\"https://outro-site.example/pagar\"}");
        assertThat(api.post(rota, login, null, 502).path("codigo").asString()).isEqualTo("CENTRAL_INDISPONIVEL");

        CENTRAL.statusLink.set(404);
        api.post(rota, login, null, 404);
        CENTRAL.statusLink.set(409);
        assertThat(api.post(rota, login, null, 409).path("codigo").asString()).isEqualTo("COBRANCA_NAO_ABERTA");
        CENTRAL.statusLink.set(503);
        assertThat(api.post(rota, login, null, 503).path("codigo").asString()).isEqualTo("PAGAMENTO_INDISPONIVEL");
        CENTRAL.statusLink.set(500);
        assertThat(api.post(rota, login, null, 502).path("codigo").asString()).isEqualTo("CENTRAL_INDISPONIVEL");
    }
}
