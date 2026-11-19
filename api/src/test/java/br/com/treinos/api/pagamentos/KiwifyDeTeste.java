package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.pagamentos.provedor.KiwifyFalsa;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Base dos testes da Kiwify: liga a Kiwify (a suíte a deixa desligada) apontando para a Kiwify de mentira, com o conciliador
 * agendado desligado (os testes chamam {@code processarPendentes()} à mão). A propriedade dinâmica mora aqui, e não em cada
 * classe, para todas dividirem o mesmo contexto do Spring. Só dados fictícios. O banco é compartilhado e a rodada do conciliador é
 * global por provedor: cada teste cria a própria consultoria e deixa os avisos pendentes dela neutros no fim.
 */
abstract class KiwifyDeTeste extends AbstractIntegrationTest {

    protected static final KiwifyFalsa FALSA = KiwifyFalsa.compartilhada();
    protected static final String CAMINHO = "/publico/pagamentos/kiwify/";
    protected static final long VALOR = 15_000L;

    @DynamicPropertySource
    static void ligarAKiwify(DynamicPropertyRegistry registry) {
        registry.add("treinos.pagamentos.kiwify.habilitado", () -> "true");
        registry.add("treinos.pagamentos.kiwify.url-api", FALSA::url);
        registry.add("treinos.pagamentos.kiwify.conciliacao-ativa", () -> "false");
    }

    @Autowired protected MockMvc mvc;
    @Autowired protected JsonMapper json;
    @Autowired protected JdbcTemplate jdbc;
    @Autowired protected ConciliadorKiwify conciliador;
    @Autowired protected RotinaDeGeracaoDeCobrancas rotina;

    protected ApiDeTeste api;
    protected final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
    private final List<UUID> consultoriasDoTeste = new ArrayList<>();

    /** A conta de um treinador com a Kiwify configurada: {@code token} é o do webhook (a chave do HMAC), {@code caminho} o da URL. */
    protected record Conta(JsonNode login, UUID consultoria, String token, String caminho, String clientId) {
    }

    /** Um aluno com o e-mail da compra e a contratação num plano da Kiwify; {@code cobranca} é a mensalidade que nasce aberta. */
    protected record Assinante(Conta conta, UUID aluno, String email, String produto, String plano, UUID cobranca) {
    }

    @BeforeEach
    void prepararAFalsa() {
        FALSA.reiniciar();
        api = new ApiDeTeste(mvc, json);
    }

    @AfterEach
    void deixarNeutro() {
        for (UUID consultoria : consultoriasDoTeste) {
            jdbc.update("update aviso_de_pagamento set situacao = 'IGNORADO', reservado_por = null, reserva_ate = null "
                    + "where consultoria_id = ? and situacao = 'PENDENTE'", consultoria);
        }
        org.assertj.core.api.Assertions.assertThat(FALSA.violacoes()).as("a API real recusaria algum pedido").isEmpty();
    }

    // ---- contas e planos ----

    /** Um membro da equipe com só estas permissões (perfil próprio), já com sessão. */
    protected JsonNode membro(Conta dona, String nome, java.util.Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", dona.login(), Map.of("nome", "Perfil " + nome + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", dona.login(),
                Map.of("nome", nome, "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    protected Map<String, Object> credencial(String token, String clientId) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("tokenDoWebhook", token);
        corpo.put("clientId", clientId);
        corpo.put("clientSecret", "segredo-ficticio-" + UUID.randomUUID());
        corpo.put("accountId", "conta-ficticia-" + UUID.randomUUID());
        return corpo;
    }

    protected Conta novaConta() throws Exception {
        JsonNode login = api.novoTreinador();
        String token = "token-ficticio-webhook-" + UUID.randomUUID();
        String clientId = "cliente-ficticio-" + UUID.randomUUID().toString().substring(0, 8);
        JsonNode resposta = api.put("/financeiro/kiwify", login, withVersao(credencial(token, clientId), null), 200);
        UUID consultoria = consultoriaDe(login);
        consultoriasDoTeste.add(consultoria);
        String caminho = resposta.get("webhookUrl").asString();
        return new Conta(login, consultoria, token, caminho.substring(caminho.lastIndexOf('/') + 1), clientId);
    }

    protected Map<String, Object> withVersao(Map<String, Object> corpo, Long versao) {
        corpo.put("versao", versao);
        return corpo;
    }

    protected UUID consultoriaDe(JsonNode login) {
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.get("usuario").get("id").asString());
    }

    /** Plano mensal da Kiwify (produto novo se {@code produto} for nulo); devolve o JSON do plano. */
    protected JsonNode planoKiwify(Conta conta, String produto, long valor) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", "Plano Kiwify " + UUID.randomUUID());
        corpo.put("valorCentavos", valor);
        corpo.put("periodicidade", "MENSAL");
        corpo.put("kiwifyAssinatura", true);
        corpo.put("kiwifyProdutoId", produto);
        return api.post("/financeiro/planos", conta.login(), corpo, 200);
    }

    protected UUID alunoComEmail(Conta conta, String email) throws Exception {
        JsonNode aluno = api.post("/alunos", conta.login(), Map.of("nome", "Aluno Fictício " + UUID.randomUUID(), "email", email), 200);
        return UUID.fromString(aluno.get("id").asString());
    }

    protected void contratar(Conta conta, UUID aluno, JsonNode plano) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("planoComercialId", plano.get("id").asString());
        corpo.put("inicio", hoje.toString());
        corpo.put("diaVencimento", hoje.getDayOfMonth());
        api.post("/alunos/" + aluno + "/contratacoes", conta.login(), corpo, 200);
    }

    protected static String emailUnico() {
        return "comprador." + UUID.randomUUID() + "@exemplo.invalid";
    }

    protected Assinante novoAssinante(Conta conta) throws Exception {
        return novoAssinante(conta, emailUnico(), "prod-" + UUID.randomUUID(), VALOR);
    }

    protected Assinante novoAssinante(Conta conta, String email, String produto, long valor) throws Exception {
        JsonNode plano = planoKiwify(conta, produto, valor);
        UUID aluno = alunoComEmail(conta, email);
        contratar(conta, aluno, plano);
        UUID cobranca = UUID.fromString(cobrancasDe(conta, aluno, "ABERTA").get(0).get("id").asString());
        return new Assinante(conta, aluno, email, produto, plano.get("id").asString(), cobranca);
    }

    protected List<JsonNode> cobrancasDe(Conta conta, UUID aluno, String situacao) throws Exception {
        List<JsonNode> achadas = new ArrayList<>();
        for (JsonNode c : api.get("/alunos/" + aluno + "/cobrancas", conta.login(), 200)) {
            if (situacao == null || situacao.equals(c.get("situacao").asString())) {
                achadas.add(c);
            }
        }
        return achadas;
    }

    // ---- avisos assinados ----

    protected static String pedido() {
        return "ord-" + UUID.randomUUID();
    }

    /** O corpo de um aviso como a Kiwify manda (com dado do comprador que NUNCA pode ficar gravado). */
    protected static String corpo(String orderId, String evento, String marcador) {
        return "{\"order_id\":\"" + orderId + "\",\"order_status\":\"paid\",\"webhook_event_type\":\"" + evento
                + "\",\"payment_method\":\"credit_card\",\"subscription_id\":\"sub-" + UUID.randomUUID()
                + "\",\"Customer\":{\"full_name\":\"" + marcador + "\",\"email\":\"" + marcador + "@exemplo.invalid\"}}";
    }

    protected static String corpo(String orderId, String evento) {
        return corpo(orderId, evento, "MARCADOR-" + UUID.randomUUID());
    }

    /** HMAC-SHA1 do corpo cru com o token, em hexadecimal minúsculo (o que a Kiwify põe em {@code ?signature=}). */
    protected static String assinar(String token, String corpo) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(token.getBytes(StandardCharsets.UTF_8), "HmacSHA1"));
            return HexFormat.of().formatHex(mac.doFinal(corpo.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    protected MockHttpServletResponse avisarCom(String caminho, String assinatura, String corpo) throws Exception {
        String url = CAMINHO + caminho + (assinatura == null ? "" : "?signature=" + assinatura);
        return mvc.perform(MockMvcRequestBuilders.post(URI.create(url)).contentType("application/json").content(corpo))
                .andReturn().getResponse();
    }

    /** Manda o aviso assinado com o token certo da conta e confere o 200 sem corpo. */
    protected void avisar(Conta conta, String corpo) throws Exception {
        MockHttpServletResponse r = avisarCom(conta.caminho(), assinar(conta.token(), corpo), corpo);
        org.assertj.core.api.Assertions.assertThat(r.getStatus()).isEqualTo(200);
        org.assertj.core.api.Assertions.assertThat(r.getContentAsString()).isEmpty();
    }

    protected int rodar() {
        return conciliador.processarPendentes();
    }

    // ---- o que ficou no banco ----

    protected Map<String, Object> avisoNoBanco(Conta conta, String orderId, String evento) {
        return jdbc.queryForMap("select * from aviso_de_pagamento where consultoria_id = ? and provedor = 'KIWIFY' "
                + "and transacao = ?", conta.consultoria(), orderId + ":" + evento);
    }

    protected int totalDeAvisos(Conta conta) {
        Integer n = jdbc.queryForObject("select count(*) from aviso_de_pagamento where consultoria_id = ?", Integer.class,
                conta.consultoria());
        return n == null ? 0 : n;
    }

    protected Map<String, Object> cobrancaNoBanco(UUID cobranca) {
        return jdbc.queryForMap("select situacao, forma, provedor, id_externo, pago_em, baixa_por, versao from cobranca_aluno "
                + "where id = ?", cobranca);
    }

    protected int auditorias(Conta conta, String acao) {
        Integer n = jdbc.queryForObject("select count(*) from auditoria where consultoria_id = ? and acao = ?", Integer.class,
                conta.consultoria(), acao);
        return n == null ? 0 : n;
    }

    /** Faz a próxima tentativa do aviso vencer já (o teste não espera minutos). */
    protected void vencer(Conta conta, String orderId, String evento) {
        jdbc.update("update aviso_de_pagamento set proxima_tentativa = now() - interval '1 second' "
                + "where consultoria_id = ? and transacao = ?", conta.consultoria(), orderId + ":" + evento);
    }

    protected static int inteiro(Map<String, Object> linha, String coluna) {
        return ((Number) linha.get(coluna)).intValue();
    }
}
