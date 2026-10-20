package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.pagamentos.provedor.InfinitePayFalsa;
import br.com.treinos.api.pagamentos.provedor.InfinitePayFalsa.ModoDaConsulta;
import br.com.treinos.api.pagamentos.provedor.InfinitePayFalsa.Requisicao;
import br.com.treinos.api.web.Fuso;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Webhook e conciliador da InfinitePay ponta a ponta, contra a InfinitePay de mentira (nenhuma chamada real, só dados
 * fictícios). O aviso não é assinado: o que se prova aqui é que ele só grava um gatilho, que a baixa nasce da consulta
 * conferida (valor, cobrança, conta, link) e que cada caminho de dúvida termina em "para conferir", nunca em baixa errada.
 * O conciliador agendado fica desligado no teste e {@code processarPendentes()} é chamado à mão. O banco é compartilhado e
 * a rodada é global: cada teste cria a própria consultoria e deixa seus avisos pendentes neutros no fim.
 */
@AutoConfigureMockMvc
class InfinitePayWebhookIntegrationTest extends AbstractIntegrationTest {

    private static final InfinitePayFalsa FALSA = new InfinitePayFalsa();
    private static final String TAG = "treinador-fake";
    private static final String CHAVE = "chave-fake-do-teste-9876543210";
    private static final String CAMINHO = "/publico/pagamentos/infinitepay/";
    private static final long VALOR = 15_000L;
    private static final int LIMITE = 16 * 1024;

    @DynamicPropertySource
    static void apontarParaAFalsa(DynamicPropertyRegistry registry) {
        registry.add("treinos.pagamentos.infinitepay.api-url", FALSA::url);
    }

    @AfterAll
    static void desligarAFalsa() {
        FALSA.close();
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @MockitoSpyBean private JdbcTemplate jdbc;
    @Autowired private ConciliadorInfinitePay conciliador;

    private ApiDeTeste api;
    private ListAppender<ILoggingEvent> log;
    private final List<UUID> consultoriasDoTeste = new ArrayList<>();
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    private record Conta(JsonNode login, UUID consultoria, String tag, String token) {
    }

    private record CobrancaDeTeste(Conta conta, UUID aluno, String id) {
    }

    @BeforeEach
    void preparar() {
        FALSA.reiniciar();
        api = new ApiDeTeste(mvc, json);
        log = new ListAppender<>();
        log.start();
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).addAppender(log);
    }

    @AfterEach
    void conferirEDeixarNeutro() {
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).detachAppender(log);
        // A rodada é global: o que este teste deixou pendente não pode ser consultado pelos outros.
        for (UUID consultoria : consultoriasDoTeste) {
            jdbc.update("update aviso_de_pagamento set situacao = 'IGNORADO', reservado_por = null, reserva_ate = null "
                    + "where consultoria_id = ? and situacao = 'PENDENTE'", consultoria);
        }
        assertThat(FALSA.violacoes()).as("a API real recusaria algum pedido").isEmpty();
    }

    // ---- ajudantes: contas, cobranças e avisos ----

    private Conta novaConta(String tag, String chave) throws Exception {
        JsonNode login = api.novoTreinador();
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("infiniteTag", "$" + tag.toUpperCase(Locale.ROOT));
        if (chave != null) {
            corpo.put("apiKey", chave);
        }
        api.put("/financeiro/recebimento-online", login, corpo, 200);
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.get("usuario").get("id").asString());
        String token = jdbc.queryForObject("select token_aviso from credencial_pagamento where consultoria_id = ?",
                String.class, consultoria);
        consultoriasDoTeste.add(consultoria);
        return new Conta(login, consultoria, tag, token);
    }

    private Conta novaConta() throws Exception {
        return novaConta(TAG, null);
    }

    /** Aluno novo com um plano mensal de {@code valor}, contratado hoje: devolve a cobrança aberta que nasce. */
    private CobrancaDeTeste novaCobranca(Conta conta, long valor) throws Exception {
        UUID aluno = api.criarAluno(conta.login(), "Aluno Fictício " + UUID.randomUUID());
        JsonNode plano = api.post("/financeiro/planos", conta.login(),
                Map.of("nome", "Plano " + UUID.randomUUID(), "valorCentavos", valor, "periodicidade", "MENSAL"), 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("planoComercialId", plano.get("id").asString());
        corpo.put("inicio", hoje.toString());
        corpo.put("diaVencimento", hoje.getDayOfMonth());
        api.post("/alunos/" + aluno + "/contratacoes", conta.login(), corpo, 200);
        return new CobrancaDeTeste(conta, aluno, cobrancasDe(conta, aluno, "ABERTA").get(0).get("id").asString());
    }

    private CobrancaDeTeste novaCobranca(Conta conta) throws Exception {
        return novaCobranca(conta, VALOR);
    }

    private List<JsonNode> cobrancasDe(Conta conta, UUID aluno, String situacao) throws Exception {
        List<JsonNode> achadas = new ArrayList<>();
        for (JsonNode c : api.get("/alunos/" + aluno + "/cobrancas", conta.login(), 200)) {
            if (situacao == null || situacao.equals(c.get("situacao").asString())) {
                achadas.add(c);
            }
        }
        return achadas;
    }

    private JsonNode cobrancaApi(CobrancaDeTeste c) throws Exception {
        for (JsonNode n : cobrancasDe(c.conta(), c.aluno(), null)) {
            if (c.id().equals(n.get("id").asString())) {
                return n;
            }
        }
        throw new AssertionError("Sem a cobrança.");
    }

    private void baixaManual(CobrancaDeTeste c) throws Exception {
        api.post("/cobrancas/" + c.id() + "/baixa-manual", c.conta().login(),
                Map.of("data", hoje.toString(), "forma", "DINHEIRO", "versao", cobrancaApi(c).get("versao").asLong()), 200);
    }

    private static String transacao() {
        return "TX-" + UUID.randomUUID();
    }

    private static String aviso(String cobrancaId, String transacao, String slug) {
        return "{\"order_nsu\":\"" + cobrancaId + "\",\"transaction_nsu\":\"" + transacao + "\""
                + (slug == null ? "" : ",\"invoice_slug\":\"" + slug + "\"")
                + ",\"amount\":15000,\"paid_amount\":15000,\"capture_method\":\"pix\",\"receipt_url\":\"https://recibo.falso.test/x\"}";
    }

    /** O mesmo aviso, com o campo {@code event} que a InfinitePay manda no webhook do link com chave. */
    private static String avisoComEvento(String cobrancaId, String transacao, String evento) {
        return aviso(cobrancaId, transacao, "slug-abc").replaceFirst("^\\{", "{\"event\":\"" + evento + "\",");
    }

    private MockHttpServletResponse avisar(String token, String corpo) throws Exception {
        return mvc.perform(MockMvcRequestBuilders.post(CAMINHO + token).contentType("application/json").content(corpo))
                .andReturn().getResponse();
    }

    /** Manda o aviso da cobrança com o token da consultoria dela e confere o 200 sem corpo. */
    private void avisar(CobrancaDeTeste c, String transacao) throws Exception {
        MockHttpServletResponse r = avisar(c.conta().token(), aviso(c.id(), transacao, "slug-abc"));
        assertThat(r.getStatus()).isEqualTo(200);
        assertThat(r.getContentAsString()).isEmpty();
    }

    private int rodar() {
        return conciliador.processarPendentes();
    }

    // ---- ajudantes: o que ficou no banco ----

    private Map<String, Object> avisoNoBanco(Conta conta, String transacao) {
        return jdbc.queryForMap("select * from aviso_de_pagamento where consultoria_id = ? and transacao = ?",
                conta.consultoria(), transacao);
    }

    private int totalDeAvisos(Conta conta) {
        Integer n = jdbc.queryForObject("select count(*) from aviso_de_pagamento where consultoria_id = ?", Integer.class,
                conta.consultoria());
        return n == null ? 0 : n;
    }

    private static int inteiro(Map<String, Object> linha, String coluna) {
        return ((Number) linha.get(coluna)).intValue();
    }

    private Map<String, Object> cobrancaNoBanco(CobrancaDeTeste c) {
        return jdbc.queryForMap("select situacao, forma, provedor, id_externo, pago_em, baixa_por, versao from cobranca_aluno "
                + "where id = ?::uuid", c.id());
    }

    private int auditorias(Conta conta, String acao) {
        Integer n = jdbc.queryForObject("select count(*) from auditoria where consultoria_id = ? and acao = ?", Integer.class,
                conta.consultoria(), acao);
        return n == null ? 0 : n;
    }

    private List<Requisicao> consultas(CobrancaDeTeste c) {
        return FALSA.requisicoes("/payment_check").stream()
                .filter(r -> c.id().equals(r.corpo().path("order_nsu").asString())).toList();
    }

    /** Faz a próxima tentativa vencer já (o teste não espera minutos). */
    private void vencer(Conta conta, String transacao) {
        jdbc.update("update aviso_de_pagamento set proxima_tentativa = now() - interval '1 second' "
                + "where consultoria_id = ? and transacao = ?", conta.consultoria(), transacao);
    }

    private double segundosAteATentativa(Conta conta, String transacao) {
        return jdbc.queryForObject("select extract(epoch from (proxima_tentativa - now())) from aviso_de_pagamento "
                + "where consultoria_id = ? and transacao = ?", Double.class, conta.consultoria(), transacao);
    }

    private void semNoLog(String... proibidos) {
        for (ILoggingEvent evento : List.copyOf(log.list)) {
            String texto = evento.getFormattedMessage()
                    + (evento.getThrowableProxy() == null ? "" : evento.getThrowableProxy().getMessage());
            for (String proibido : proibidos) {
                assertThat(texto).as("log: " + evento.getLoggerName()).doesNotContain(proibido);
            }
        }
    }

    private static String sha256(String texto) throws NoSuchAlgorithmException {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(texto.getBytes(StandardCharsets.UTF_8)));
    }

    private static void dormir(long milissegundos) {
        try {
            Thread.sleep(milissegundos);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /** Um aviso que vira "para conferir" por valor diferente; devolve a transação. */
    private String paraConferirPorValor(CobrancaDeTeste c) throws Exception {
        FALSA.valorDaConsulta(VALOR - 1_000);
        String transacao = transacao();
        avisar(c, transacao);
        rodar();
        FALSA.valorDaConsulta(VALOR);
        assertThat(avisoNoBanco(c.conta(), transacao).get("situacao")).isEqualTo("CONFERIR");
        return transacao;
    }

    // ---- o webhook: só grava um gatilho ----

    @Test
    void gravaOAvisoAntesDeQualquerConsultaEResponde200SemCorpo() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();
        String corpo = aviso(cobranca.id(), transacao, "slug-abc");

        MockHttpServletResponse resposta = avisar(conta.token(), corpo);

        assertThat(resposta.getStatus()).isEqualTo(200);
        assertThat(resposta.getContentAsString()).isEmpty();
        assertThat(resposta.getHeader("Cache-Control")).contains("no-store");
        assertThat(FALSA.requisicoes()).as("o webhook não chama a InfinitePay").isEmpty();
        Map<String, Object> linha = avisoNoBanco(conta, transacao);
        assertThat(linha.get("situacao")).isEqualTo("PENDENTE");
        assertThat(inteiro(linha, "revisao")).isEqualTo(1);
        assertThat(inteiro(linha, "tentativas")).isZero();
        assertThat(linha.get("referencia")).isEqualTo(cobranca.id());
        assertThat(linha.get("slug")).isEqualTo("slug-abc");
        assertThat(linha.get("hash_corpo")).isEqualTo(sha256(corpo));
        assertThat(linha.get("reservado_por")).isNull();
        assertThat(linha.get("cobranca_id")).isNull();
        assertThat(linha.get("motivo")).isNull();
        assertThat(segundosAteATentativa(conta, transacao)).isLessThanOrEqualTo(1.0);
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("ABERTA");
        semNoLog(conta.token(), transacao);
    }

    @Test
    void oCorpoNuncaFicaGuardadoSoOHashEOsIdentificadores() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();
        String marcador = "MARCADOR-" + UUID.randomUUID();
        String corpo = "{\"order_nsu\":\"" + cobranca.id() + "\",\"transaction_nsu\":\"" + transacao + "\","
                + "\"receipt_url\":\"https://recibo.falso.test/" + marcador + "\",\"customer\":{\"name\":\"" + marcador + "\"},"
                + "\"card\":{\"number\":\"4111111111111111\"}}";

        assertThat(avisar(conta.token(), corpo).getStatus()).isEqualTo(200);
        rodar();

        String tudo = jdbc.queryForObject("select string_agg(cast(row_to_json(a) as text), ' ') from aviso_de_pagamento a "
                + "where consultoria_id = ?", String.class, conta.consultoria());
        assertThat(tudo).doesNotContain(marcador).doesNotContain("4111").doesNotContain("recibo");
        assertThat(avisoNoBanco(conta, transacao).get("hash_corpo")).isEqualTo(sha256(corpo));
        String auditado = jdbc.queryForObject("select string_agg(acao || ' ' || coalesce(entidade, '') || ' ' || resumo, ' ') "
                + "from auditoria where consultoria_id = ?", String.class, conta.consultoria());
        assertThat(auditado).doesNotContain(marcador).doesNotContain("4111").doesNotContain(conta.token());
        semNoLog(marcador, "4111", conta.token(), transacao);
    }

    @Test
    void tokenDesconhecidoOuForaDoFormatoDa404SemGravarNada() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String corpo = aviso(cobranca.id(), transacao(), null);
        Integer antes = jdbc.queryForObject("select count(*) from aviso_de_pagamento", Integer.class);
        List<String> tokens = List.of("C".repeat(43), "curto", "D".repeat(19), "E".repeat(65), "!" + "G".repeat(42),
                conta.token() + "x" + conta.token());

        for (String token : tokens) {
            assertThat(avisar(token, corpo).getStatus()).as(token).isEqualTo(404);
        }

        assertThat(totalDeAvisos(conta)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from aviso_de_pagamento", Integer.class)).isEqualTo(antes);
        assertThat(FALSA.requisicoes()).isEmpty();
        semNoLog(tokens.toArray(new String[0]));
    }

    @Test
    void corpoMaiorQue16KiBDa413SemGravarEOExatoDe16KiBPassa() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();
        String inicio = "{\"order_nsu\":\"" + cobranca.id() + "\",\"transaction_nsu\":\"" + transacao + "\",\"x\":\"";
        String fim = "\"}";
        int enchimento = LIMITE - inicio.length() - fim.length();

        String grande = inicio + "a".repeat(enchimento + 1) + fim;
        MockHttpServletResponse recusada = avisar(conta.token(), grande);
        assertThat(grande.getBytes(StandardCharsets.UTF_8)).hasSize(LIMITE + 1);
        assertThat(recusada.getStatus()).isEqualTo(413);
        assertThat(json.readTree(recusada.getContentAsString()).path("codigo").asString()).isEqualTo("CORPO_EXCEDIDO");
        assertThat(totalDeAvisos(conta)).isZero();

        String exato = inicio + "a".repeat(enchimento) + fim;
        assertThat(exato.getBytes(StandardCharsets.UTF_8)).hasSize(LIMITE);
        assertThat(avisar(conta.token(), exato).getStatus()).isEqualTo(200);
        assertThat(totalDeAvisos(conta)).isEqualTo(1);
        semNoLog(conta.token(), transacao);
    }

    @Test
    void jsonInvalidoOuPedidoQueNaoEUuidDa400SemGravarENemRepeteOCorpo() throws Exception {
        Conta conta = novaConta();
        String marcador = "MARCADOR-" + UUID.randomUUID();
        List<String> invalidos = List.of("", "isto nao e json " + marcador, "[]", "\"" + marcador + "\"", "{}",
                "{\"order_nsu\":\"" + marcador + "\",\"transaction_nsu\":\"TX-1\"}",
                "{\"order_nsu\":\"" + UUID.randomUUID() + "\",\"transaction_nsu\":\"com espaço " + marcador + "\"}");

        for (String corpo : invalidos) {
            MockHttpServletResponse r = avisar(conta.token(), corpo);
            assertThat(r.getStatus()).as(corpo).isEqualTo(400);
            JsonNode erro = json.readTree(r.getContentAsString());
            assertThat(erro.path("codigo").asString()).isEqualTo("AVISO_INVALIDO");
            assertThat(erro.path("mensagem").asString("Aviso inválido.")).isEqualTo("Aviso inválido.");
            assertThat(r.getContentAsString()).doesNotContain(marcador);
        }

        assertThat(totalDeAvisos(conta)).isZero();
        semNoLog(marcador, conta.token());
    }

    @Test
    void avisoSemTransacaoDa200SemGravar() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);

        for (String corpo : List.of("{\"order_nsu\":\"" + cobranca.id() + "\"}",
                "{\"order_nsu\":\"" + cobranca.id() + "\",\"transaction_nsu\":null,\"invoice_slug\":\"slug-abc\"}")) {
            assertThat(avisar(conta.token(), corpo).getStatus()).as(corpo).isEqualTo(200);
        }

        assertThat(totalDeAvisos(conta)).isZero();
        assertThat(FALSA.requisicoes()).isEmpty();
    }

    @Test
    void aceitaQualquerContentTypeEOCorpoSoViraUmaLinha() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();

        // A InfinitePay não promete o Content-Type: recusar com 415 faria ela reenviar o mesmo aviso.
        MockHttpServletResponse r = mvc.perform(MockMvcRequestBuilders.post(CAMINHO + conta.token())
                .contentType("text/plain").content(aviso(cobranca.id(), transacao, null))).andReturn().getResponse();

        assertThat(r.getStatus()).isEqualTo(200);
        assertThat(avisoNoBanco(conta, transacao).get("slug")).isNull();
    }

    @Test
    void omesmoAvisoDuasVezesViraUmaLinhaComRevisaoDois() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();

        avisar(cobranca, transacao);
        avisar(cobranca, transacao);

        assertThat(totalDeAvisos(conta)).isEqualTo(1);
        Map<String, Object> linha = avisoNoBanco(conta, transacao);
        assertThat(inteiro(linha, "revisao")).isEqualTo(2);
        assertThat(linha.get("situacao")).isEqualTo("PENDENTE");

        // Resolvido, o aviso repetido volta a ser consultado (é assim que se descobre um estorno).
        rodar();
        assertThat(avisoNoBanco(conta, transacao).get("situacao")).isEqualTo("APLICADO");
        avisar(cobranca, transacao);
        Map<String, Object> rearmado = avisoNoBanco(conta, transacao);
        assertThat(totalDeAvisos(conta)).isEqualTo(1);
        assertThat(inteiro(rearmado, "revisao")).isEqualTo(3);
        assertThat(rearmado.get("situacao")).isEqualTo("PENDENTE");
        assertThat(inteiro(rearmado, "tentativas")).isZero();
        assertThat(rearmado.get("motivo")).isNull();
    }

    @Test
    void tokenDeUmaConsultoriaComPedidoDeOutraVaiParaConferirSemTocarNaCobrancaAlheia() throws Exception {
        Conta a = novaConta("treinador-a", null);
        Conta b = novaConta("treinador-b", null);
        CobrancaDeTeste daB = novaCobranca(b);
        jdbc.update("update cobranca_aluno set link_slug = 'slug-da-b' where id = ?::uuid", daB.id());
        String transacao = transacao();

        // O token é da A, mas o order_nsu é uma cobrança da B.
        assertThat(avisar(a.token(), aviso(daB.id(), transacao, null)).getStatus()).isEqualTo(200);
        rodar();

        Map<String, Object> linha = avisoNoBanco(a, transacao);
        assertThat(linha.get("situacao")).isEqualTo("CONFERIR");
        assertThat(linha.get("motivo")).isEqualTo("COBRANCA_NAO_ENCONTRADA");
        assertThat(linha.get("cobranca_id")).isNull();
        assertThat(((Number) linha.get("valor_pago_centavos")).longValue()).isEqualTo(VALOR);
        assertThat(totalDeAvisos(b)).isZero();
        assertThat(cobrancaNoBanco(daB).get("situacao")).isEqualTo("ABERTA");
        assertThat(auditorias(a, "PAGAMENTO_PARA_CONFERIR")).isEqualTo(1);
        assertThat(auditorias(b, "PAGAMENTO_PARA_CONFERIR")).isZero();
        // A consulta saiu com a conta da A, a do token.
        assertThat(consultas(daB)).hasSize(1);
        assertThat(consultas(daB).get(0).corpo().path("handle").asString()).isEqualTo("treinador-a");
        // E o slug do link da B (de outra consultoria) não é lido para montar a consulta da A.
        assertThat(consultas(daB).get(0).corpo().path("slug").asString("")).isNotEqualTo("slug-da-b");
    }

    @Test
    void osRegistrosDaConclusaoNaoImprimemSegredoNemConta() {
        UUID consultoria = UUID.randomUUID();
        var preparo = new ConclusaoDoAviso.Preparo(
                new br.com.treinos.api.pagamentos.provedor.CredencialDoProvedor(consultoria, TAG, CHAVE), "slug-x");

        assertThat(preparo.toString()).doesNotContain(CHAVE).doesNotContain(TAG);
        assertThat(preparo.credencial().toString()).doesNotContain(CHAVE).doesNotContain(TAG);
    }

    // ---- a baixa ----

    @Test
    void fluxoFelizNoPixBaixaGeraAProximaEAuditaComoSistema() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();
        FALSA.exigeChave(false).esperaHandle(TAG);

        avisar(cobranca, transacao);
        rodar();

        Map<String, Object> pago = cobrancaNoBanco(cobranca);
        assertThat(pago.get("situacao")).isEqualTo("PAGA");
        assertThat(pago.get("forma")).isEqualTo("PIX");
        assertThat(pago.get("provedor")).isEqualTo("INFINITEPAY");
        assertThat(pago.get("id_externo")).isEqualTo(transacao);
        assertThat(pago.get("pago_em").toString()).isEqualTo(hoje.toString());
        assertThat(pago.get("baixa_por")).isNull();
        Map<String, Object> aviso = avisoNoBanco(conta, transacao);
        assertThat(aviso.get("situacao")).isEqualTo("APLICADO");
        assertThat(aviso.get("motivo")).isNull();
        assertThat(aviso.get("reservado_por")).isNull();
        assertThat(aviso.get("cobranca_id").toString()).isEqualTo(cobranca.id());
        assertThat(((Number) aviso.get("valor_pago_centavos")).longValue()).isEqualTo(VALOR);
        assertThat(aviso.get("forma_capturada")).isEqualTo("pix");
        assertThat(inteiro(aviso, "parcelas")).isEqualTo(1);
        assertThat(((Number) aviso.get("valor_bruto_pago_centavos")).longValue()).isEqualTo(VALOR);
        // A próxima cobrança nasce, como em toda baixa.
        assertThat(cobrancasDe(conta, cobranca.aluno(), "ABERTA")).hasSize(1);
        assertThat(cobrancasDe(conta, cobranca.aluno(), "ABERTA").get(0).get("id").asString()).isNotEqualTo(cobranca.id());

        List<Requisicao> consultas = consultas(cobranca);
        assertThat(consultas).hasSize(1);
        JsonNode pedido = consultas.get(0).corpo();
        assertThat(pedido.get("transaction_nsu").asString()).isEqualTo(transacao);
        assertThat(pedido.get("slug").asString()).isEqualTo("slug-abc");
        assertThat(pedido.get("handle").asString()).isEqualTo(TAG);
        assertThat(consultas.get(0).chave()).isNull();

        // O evento do sistema aparece na auditoria da consultoria, sem autor de pessoa.
        JsonNode eventos = api.get("/auditoria?acao=PAGAMENTO_ONLINE_CONFIRMADO", conta.login(), 200).get("itens");
        JsonNode evento = null;
        for (JsonNode e : eventos) {
            if (cobranca.id().equals(e.get("entidadeId").asString())) {
                evento = e;
            }
        }
        assertThat(evento).isNotNull();
        assertThat(evento.get("nomeUsuario").asString()).isEqualTo("Sistema");
        assertThat(evento.get("entidade").asString()).isEqualTo("COBRANCA");
        assertThat(evento.get("resumo").asString())
                .isEqualTo("Baixa automática de um pagamento online confirmado pela InfinitePay.");
        assertThat(auditorias(conta, "PAGAMENTO_ONLINE_CONFIRMADO")).isEqualTo(1);
        semNoLog(conta.token(), transacao, TAG);
    }

    @Test
    void fluxoFelizNoCartaoConfereOValorDoLinkENaoOPagoComJuros() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();
        FALSA.consultaResponde(ModoDaConsulta.PAGO_CARTAO);

        avisar(cobranca, transacao);
        rodar();

        Map<String, Object> pago = cobrancaNoBanco(cobranca);
        assertThat(pago.get("situacao")).isEqualTo("PAGA");
        assertThat(pago.get("forma")).isEqualTo("CARTAO");
        assertThat(avisoNoBanco(conta, transacao).get("situacao")).isEqualTo("APLICADO");
        Map<String, Object> aviso = avisoNoBanco(conta, transacao);
        assertThat(((Number) aviso.get("valor_pago_centavos")).longValue()).as("amount: o valor do link").isEqualTo(VALOR);
        // O que o cliente pagou a mais (juros do parcelamento) fica só como informação; nada de "líquido" é calculado.
        assertThat(aviso.get("forma_capturada")).isEqualTo("credit_card");
        assertThat(inteiro(aviso, "parcelas")).isEqualTo(3);
        assertThat(((Number) aviso.get("valor_bruto_pago_centavos")).longValue()).isEqualTo(VALOR + 250);
        assertThat(cobrancaApi(cobranca).get("valorCentavos").asLong()).isEqualTo(VALOR);
        assertThat(cobrancaApi(cobranca).toString()).doesNotContain("iquido").doesNotContain("bruto");
    }

    @Test
    void reprocessarOMesmoAvisoNaoBaixaDuasVezes() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();
        avisar(cobranca, transacao);
        rodar();
        int cobrancasDepoisDaBaixa = cobrancasDe(conta, cobranca.aluno(), null).size();
        Object versao = cobrancaNoBanco(cobranca).get("versao");

        avisar(cobranca, transacao);
        rodar();
        avisar(cobranca, transacao);
        rodar();

        assertThat(cobrancasDe(conta, cobranca.aluno(), null)).hasSize(cobrancasDepoisDaBaixa);
        assertThat(cobrancaNoBanco(cobranca).get("versao")).isEqualTo(versao);
        assertThat(auditorias(conta, "PAGAMENTO_ONLINE_CONFIRMADO")).isEqualTo(1);
        assertThat(avisoNoBanco(conta, transacao).get("situacao")).isEqualTo("APLICADO");
        assertThat(inteiro(avisoNoBanco(conta, transacao), "revisao")).isEqualTo(3);
    }

    @Test
    void doisProcessamentosAoMesmoTempoBaixamUmaVezSo() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();
        avisar(cobranca, transacao);
        // A consulta demora: a segunda rodada começa com a primeira ainda dentro dela, com o aviso reservado.
        FALSA.aoReceberConsulta(() -> dormir(500));
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch largada = new CountDownLatch(1);
        try {
            List<Future<Integer>> rodadas = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                rodadas.add(pool.submit(() -> {
                    largada.await();
                    return conciliador.processarPendentes();
                }));
            }
            largada.countDown();
            int reservados = 0;
            for (Future<Integer> rodada : rodadas) {
                reservados += rodada.get(30, TimeUnit.SECONDS);
            }
            assertThat(reservados).isGreaterThanOrEqualTo(1);
        } finally {
            pool.shutdownNow();
        }

        assertThat(consultas(cobranca)).hasSize(1);
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("PAGA");
        assertThat(auditorias(conta, "PAGAMENTO_ONLINE_CONFIRMADO")).isEqualTo(1);
        assertThat(cobrancasDe(conta, cobranca.aluno(), "ABERTA")).hasSize(1);
        assertThat(avisoNoBanco(conta, transacao).get("situacao")).isEqualTo("APLICADO");
    }

    @Test
    void valorDiferenteDoDaCobrancaOuDoLinkVaiParaConferirSemBaixar() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        FALSA.valorDaConsulta(VALOR - 1);
        String transacao = transacao();

        avisar(cobranca, transacao);
        rodar();

        Map<String, Object> linha = avisoNoBanco(conta, transacao);
        assertThat(linha.get("situacao")).isEqualTo("CONFERIR");
        assertThat(linha.get("motivo")).isEqualTo("VALOR_DIFERENTE");
        assertThat(((Number) linha.get("valor_pago_centavos")).longValue()).isEqualTo(VALOR - 1);
        assertThat(linha.get("forma_capturada")).as("o CONFERIR também guarda o que o provedor informou").isEqualTo("pix");
        assertThat(inteiro(linha, "parcelas")).isEqualTo(1);
        assertThat(((Number) linha.get("valor_bruto_pago_centavos")).longValue()).isEqualTo(VALOR - 1);
        assertThat(linha.get("cobranca_id").toString()).isEqualTo(cobranca.id());
        assertThat(linha.get("reservado_por")).isNull();
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("ABERTA");
        assertThat(auditorias(conta, "PAGAMENTO_PARA_CONFERIR")).isEqualTo(1);
        assertThat(auditorias(conta, "PAGAMENTO_ONLINE_CONFIRMADO")).isZero();

        // O link foi gerado com outro valor que o da cobrança: o amount não bate com o do link.
        CobrancaDeTeste comLink = novaCobranca(conta);
        jdbc.update("update cobranca_aluno set link_valor_centavos = 12000 where id = ?::uuid", comLink.id());
        FALSA.valorDaConsulta(VALOR);
        String outra = transacao();
        avisar(comLink, outra);
        rodar();

        assertThat(avisoNoBanco(conta, outra).get("motivo")).isEqualTo("VALOR_DIFERENTE");
        assertThat(cobrancaNoBanco(comLink).get("situacao")).isEqualTo("ABERTA");
    }

    @Test
    void formaDesconhecidaVaiParaConferir() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        FALSA.consultaResponde(ModoDaConsulta.METODO_DESCONHECIDO);
        String transacao = transacao();

        avisar(cobranca, transacao);
        rodar();

        assertThat(avisoNoBanco(conta, transacao).get("situacao")).isEqualTo("CONFERIR");
        assertThat(avisoNoBanco(conta, transacao).get("motivo")).isEqualTo("FORMA_DESCONHECIDA");
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("ABERTA");
    }

    @Test
    void slugDoAvisoQueNaoEODoLinkVaiParaConferirEOIgualBaixa() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste diferente = novaCobranca(conta);
        jdbc.update("update cobranca_aluno set link_slug = 'slug-do-link' where id = ?::uuid", diferente.id());
        String transacao = transacao();

        avisar(diferente, transacao);
        rodar();

        assertThat(avisoNoBanco(conta, transacao).get("motivo")).isEqualTo("LINK_DIFERENTE");
        assertThat(cobrancaNoBanco(diferente).get("situacao")).isEqualTo("ABERTA");

        CobrancaDeTeste igual = novaCobranca(conta);
        jdbc.update("update cobranca_aluno set link_slug = 'slug-abc' where id = ?::uuid", igual.id());
        avisar(igual, transacao());
        rodar();

        assertThat(cobrancaNoBanco(igual).get("situacao")).isEqualTo("PAGA");
    }

    @Test
    void semSlugNoAvisoAConsultaUsaOSlugDoLinkDaCobranca() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        jdbc.update("update cobranca_aluno set link_slug = 'slug-do-link' where id = ?::uuid", cobranca.id());
        String transacao = transacao();

        assertThat(avisar(conta.token(), aviso(cobranca.id(), transacao, null)).getStatus()).isEqualTo(200);
        rodar();

        assertThat(consultas(cobranca).get(0).corpo().path("slug").asString()).isEqualTo("slug-do-link");
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("PAGA");
    }

    @Test
    void cobrancaCanceladaIncluindoAlunoQueSaiuVaiParaConferirENaoRessuscita() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cancelada = novaCobranca(conta);
        api.post("/cobrancas/" + cancelada.id() + "/cancelar", conta.login(),
                Map.of("motivo", "Cancelada de propósito", "versao", cobrancaApi(cancelada).get("versao").asLong()), 200);
        String transacao = transacao();

        avisar(cancelada, transacao);
        rodar();

        assertThat(avisoNoBanco(conta, transacao).get("situacao")).isEqualTo("CONFERIR");
        assertThat(avisoNoBanco(conta, transacao).get("motivo")).isEqualTo("COBRANCA_CANCELADA");
        assertThat(cobrancaNoBanco(cancelada).get("situacao")).isEqualTo("CANCELADA");

        // O aluno saiu depois de gerar o link: a cobrança aberta dele foi cancelada pela saída.
        CobrancaDeTeste doQueSaiu = novaCobranca(conta);
        api.patch("/alunos/" + doQueSaiu.aluno() + "/situacao", conta.login(), Map.of("ativo", false), 200);
        String outra = transacao();
        avisar(doQueSaiu, outra);
        rodar();

        assertThat(avisoNoBanco(conta, outra).get("motivo")).isEqualTo("COBRANCA_CANCELADA");
        assertThat(cobrancaNoBanco(doQueSaiu).get("situacao")).isEqualTo("CANCELADA");
    }

    @Test
    void baixaManualDepoisPagamentoOnlineVaiParaConferirESemMexerNaBaixa() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        baixaManual(cobranca);
        String transacao = transacao();

        avisar(cobranca, transacao);
        rodar();

        Map<String, Object> linha = avisoNoBanco(conta, transacao);
        assertThat(linha.get("situacao")).isEqualTo("CONFERIR");
        assertThat(linha.get("motivo")).isEqualTo("COBRANCA_JA_PAGA");
        assertThat(linha.get("cobranca_id").toString()).isEqualTo(cobranca.id());
        Map<String, Object> cobrancaDepois = cobrancaNoBanco(cobranca);
        assertThat(cobrancaDepois.get("situacao")).isEqualTo("PAGA");
        assertThat(cobrancaDepois.get("provedor")).isEqualTo("MANUAL");
        assertThat(cobrancaDepois.get("id_externo")).isNull();
        assertThat(auditorias(conta, "PAGAMENTO_ONLINE_CONFIRMADO")).isZero();
    }

    @Test
    void cobrancaJaPagaPelaMesmaTransacaoFicaAplicadaSemMudarNada() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();
        jdbc.update("update cobranca_aluno set situacao = 'PAGA', provedor = 'INFINITEPAY', id_externo = ?, forma = 'PIX', "
                + "pago_em = current_date where id = ?::uuid", transacao, cobranca.id());
        Object versao = cobrancaNoBanco(cobranca).get("versao");

        avisar(cobranca, transacao);
        rodar();

        assertThat(avisoNoBanco(conta, transacao).get("situacao")).isEqualTo("APLICADO");
        assertThat(cobrancaNoBanco(cobranca).get("versao")).isEqualTo(versao);
        assertThat(auditorias(conta, "PAGAMENTO_ONLINE_CONFIRMADO")).isZero();
        assertThat(auditorias(conta, "PAGAMENTO_PARA_CONFERIR")).isZero();
    }

    @Test
    void cobrancaQueMudaDuranteAConsultaEReleidaSobTravaEVaiParaConferir() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();
        avisar(cobranca, transacao);
        // Enquanto a InfinitePay responde, a cobrança é cancelada no banco: a conclusão não pode usar o que leu antes.
        FALSA.aoReceberConsulta(() -> jdbc.update("update cobranca_aluno set situacao = 'CANCELADA' where id = ?::uuid",
                cobranca.id()));

        rodar();

        assertThat(avisoNoBanco(conta, transacao).get("motivo")).isEqualTo("COBRANCA_CANCELADA");
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("CANCELADA");
        assertThat(auditorias(conta, "PAGAMENTO_ONLINE_CONFIRMADO")).isZero();
    }

    @Test
    void avisoRearmadoDuranteAConsultaSoDevolveAReservaEEConsultadoDeNovo() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();
        avisar(cobranca, transacao);
        AtomicBoolean uma = new AtomicBoolean();
        FALSA.aoReceberConsulta(() -> {
            if (uma.compareAndSet(false, true)) {
                try {
                    avisar(cobranca, transacao);
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
            }
        });

        rodar();

        Map<String, Object> linha = avisoNoBanco(conta, transacao);
        assertThat(linha.get("situacao")).isEqualTo("PENDENTE");
        assertThat(inteiro(linha, "revisao")).isEqualTo(2);
        assertThat(linha.get("reservado_por")).as("a reserva volta, o aviso não fica preso").isNull();
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("ABERTA");

        rodar();

        assertThat(consultas(cobranca)).hasSize(2);
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("PAGA");
        assertThat(auditorias(conta, "PAGAMENTO_ONLINE_CONFIRMADO")).isEqualTo(1);
        assertThat(avisoNoBanco(conta, transacao).get("situacao")).isEqualTo("APLICADO");
    }

    // ---- ainda não pago, falha e estorno ----

    @Test
    void naoPagoVoltaEm1Em5E15MinutosEDepoisFicaIgnoradoERearmaSePagarem() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        FALSA.consultaResponde(ModoDaConsulta.NAO_PAGO);
        String transacao = transacao();
        avisar(cobranca, transacao);

        long[] esperas = {60, 300, 900};
        for (int tentativa = 0; tentativa < esperas.length; tentativa++) {
            rodar();
            Map<String, Object> linha = avisoNoBanco(conta, transacao);
            assertThat(linha.get("situacao")).isEqualTo("PENDENTE");
            assertThat(inteiro(linha, "tentativas")).isEqualTo(tentativa + 1);
            assertThat(linha.get("reservado_por")).isNull();
            assertThat(segundosAteATentativa(conta, transacao)).isBetween(esperas[tentativa] - 30.0, esperas[tentativa] + 1.0);
            // Ainda não venceu: outra rodada não consulta de novo.
            int consultasAntes = consultas(cobranca).size();
            rodar();
            assertThat(consultas(cobranca)).hasSize(consultasAntes);
            vencer(conta, transacao);
        }
        rodar();

        assertThat(avisoNoBanco(conta, transacao).get("situacao")).isEqualTo("IGNORADO");
        assertThat(consultas(cobranca)).hasSize(4);
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("ABERTA");

        // Se pagarem depois, a InfinitePay avisa de novo e o aviso ignorado volta a valer.
        FALSA.consultaResponde(ModoDaConsulta.PAGO_PIX);
        avisar(cobranca, transacao);
        assertThat(avisoNoBanco(conta, transacao).get("situacao")).isEqualTo("PENDENTE");
        rodar();

        assertThat(avisoNoBanco(conta, transacao).get("situacao")).isEqualTo("APLICADO");
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("PAGA");
    }

    @Test
    void falhaDeHttpEsperaProgressivaEnaDecimaSegundaVaiParaConferir() throws Exception {
        Conta conta = novaConta(TAG, CHAVE);
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();
        avisar(cobranca, transacao);

        ModoDaConsulta[] falhas = {ModoDaConsulta.HTTP_500, ModoDaConsulta.JSON_INVALIDO, ModoDaConsulta.SEM_SUCESSO,
                ModoDaConsulta.SEM_CAMPO_SUCESSO};
        for (int i = 0; i < falhas.length; i++) {
            FALSA.consultaResponde(falhas[i]);
            rodar();
            Map<String, Object> linha = avisoNoBanco(conta, transacao);
            assertThat(linha.get("situacao")).as(falhas[i].name()).isEqualTo("PENDENTE");
            assertThat(inteiro(linha, "tentativas")).isEqualTo(i + 1);
            long esperada = 60L << i;
            assertThat(segundosAteATentativa(conta, transacao)).as(falhas[i].name())
                    .isBetween(esperada - 30.0, esperada + 1.0);
            vencer(conta, transacao);
        }
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("ABERTA");

        // O teto da espera é 1 hora.
        FALSA.consultaResponde(ModoDaConsulta.HTTP_500);
        jdbc.update("update aviso_de_pagamento set tentativas = 10 where consultoria_id = ? and transacao = ?",
                conta.consultoria(), transacao);
        rodar();
        assertThat(inteiro(avisoNoBanco(conta, transacao), "tentativas")).isEqualTo(11);
        assertThat(segundosAteATentativa(conta, transacao)).isBetween(3_570.0, 3_601.0);
        vencer(conta, transacao);

        // A 12ª falha deixa de tentar e pede conferência.
        rodar();

        Map<String, Object> linha = avisoNoBanco(conta, transacao);
        assertThat(linha.get("situacao")).isEqualTo("CONFERIR");
        assertThat(linha.get("motivo")).isEqualTo("CONSULTA_FALHOU");
        assertThat(linha.get("cobranca_id").toString()).isEqualTo(cobranca.id());
        assertThat(linha.get("valor_pago_centavos")).isNull();
        assertThat(auditorias(conta, "PAGAMENTO_PARA_CONFERIR")).isEqualTo(1);
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("ABERTA");
        // Nada do corpo da resposta de erro nem da chave vai para o log.
        semNoLog("SEGREDO", CHAVE, TAG, conta.token(), transacao);
    }

    @Test
    void semCredencialOuComCifraQueNaoDecifraVaiParaConferirSemChamarAInfinitePay() throws Exception {
        Conta semCredencial = novaConta();
        CobrancaDeTeste primeira = novaCobranca(semCredencial);
        String transacao = transacao();
        avisar(primeira, transacao);
        api.delete("/financeiro/recebimento-online", semCredencial.login(), 204);

        Conta cifraRuim = novaConta(TAG, CHAVE);
        CobrancaDeTeste segunda = novaCobranca(cifraRuim);
        String outra = transacao();
        avisar(segunda, outra);
        jdbc.update("update credencial_pagamento set segredo_cifrado = 'v1:desconhecida:AAAAAAAAAAAAAAAA:BBBB' "
                + "where consultoria_id = ?", cifraRuim.consultoria());

        try {
            rodar();
        } finally {
            // A subida da API recusa cifra de chave desconhecida: o banco compartilhado não pode ficar com ela.
            jdbc.update("delete from credencial_pagamento where consultoria_id = ?", cifraRuim.consultoria());
        }

        assertThat(avisoNoBanco(semCredencial, transacao).get("motivo")).isEqualTo("CONSULTA_FALHOU");
        assertThat(avisoNoBanco(semCredencial, transacao).get("situacao")).isEqualTo("CONFERIR");
        assertThat(avisoNoBanco(cifraRuim, outra).get("motivo")).isEqualTo("CONSULTA_FALHOU");
        assertThat(avisoNoBanco(cifraRuim, outra).get("situacao")).isEqualTo("CONFERIR");
        assertThat(FALSA.requisicoes()).isEmpty();
        assertThat(cobrancaNoBanco(primeira).get("situacao")).isEqualTo("ABERTA");
        assertThat(cobrancaNoBanco(segunda).get("situacao")).isEqualTo("ABERTA");
    }

    @Test
    void estornoVistoNaConsultaVaiParaConferirSemMexerNaCobrancaMesmoComOAlunoInativado() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();
        avisar(cobranca, transacao);
        rodar();
        Map<String, Object> paga = cobrancaNoBanco(cobranca);
        assertThat(paga.get("situacao")).isEqualTo("PAGA");
        api.patch("/alunos/" + cobranca.aluno() + "/situacao", conta.login(), Map.of("ativo", false), 200);
        FALSA.consultaResponde(ModoDaConsulta.NAO_PAGO);

        avisar(cobranca, transacao);
        rodar();

        // Nada é estornado sozinho: a cobrança segue PAGA, igual, e o treinador é chamado a conferir.
        Map<String, Object> depois = cobrancaNoBanco(cobranca);
        assertThat(depois.get("situacao")).isEqualTo("PAGA");
        assertThat(depois.get("pago_em")).isEqualTo(paga.get("pago_em"));
        assertThat(depois.get("versao")).isEqualTo(paga.get("versao"));
        assertThat(depois.get("id_externo")).isEqualTo(transacao);
        Map<String, Object> aviso = avisoNoBanco(conta, transacao);
        assertThat(aviso.get("situacao")).isEqualTo("CONFERIR");
        assertThat(aviso.get("motivo")).isEqualTo("ESTORNO_INFORMADO");
        assertThat(aviso.get("cobranca_id").toString()).isEqualTo(cobranca.id());
        assertThat(((Number) aviso.get("valor_pago_centavos")).longValue()).isEqualTo(VALOR);
        assertThat(auditorias(conta, "PAGAMENTO_ESTORNADO")).isZero();
        assertThat(auditorias(conta, "PAGAMENTO_PARA_CONFERIR")).isEqualTo(1);
        assertThat(jdbc.queryForObject("select resumo from auditoria where consultoria_id = ? and acao = 'PAGAMENTO_PARA_CONFERIR'",
                String.class, conta.consultoria()))
                .isEqualTo("Estorno de um pagamento online informado pela InfinitePay; nenhuma baixa foi alterada e ficou para conferir.");
        JsonNode lista = api.get("/financeiro/conferencias", conta.login(), 200).get("itens");
        assertThat(lista).hasSize(1);
        assertThat(lista.get(0).get("motivo").asString()).isEqualTo("ESTORNO_INFORMADO");
        assertThat(lista.get(0).get("cobrancaId").asString()).isEqualTo(cobranca.id());

        // Aviso repetido: não reabre nem audita de novo; conferido, também não.
        avisar(cobranca, transacao);
        rodar();
        assertThat(avisoNoBanco(conta, transacao).get("situacao")).isEqualTo("CONFERIR");
        assertThat(auditorias(conta, "PAGAMENTO_PARA_CONFERIR")).isEqualTo(1);
        api.post("/financeiro/conferencias/" + aviso.get("id") + "/conferido", conta.login(), null, 204);
        avisar(cobranca, transacao);
        rodar();
        assertThat(avisoNoBanco(conta, transacao).get("situacao")).isEqualTo("CONFERIDO");
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("PAGA");
    }

    @Test
    void eventoRefundedDeTransacaoAplicadaVaiDiretoParaConferirSemConsultar() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();
        avisar(cobranca, transacao);
        rodar();
        int consultasAntes = consultas(cobranca).size();
        Map<String, Object> baixa = cobrancaNoBanco(cobranca);
        Object versao = baixa.get("versao");
        assertThat(avisoNoBanco(conta, transacao).get("estorno_avisado_em")).as("nunca avisado").isNull();

        MockHttpServletResponse r = avisar(conta.token(), avisoComEvento(cobranca.id(), transacao, "refunded"));

        assertThat(r.getStatus()).isEqualTo(200);
        Map<String, Object> aviso = avisoNoBanco(conta, transacao);
        assertThat(aviso.get("estorno_avisado_em")).as("a marca nasce").isNotNull();
        assertThat(aviso.get("situacao")).isEqualTo("CONFERIR");
        assertThat(aviso.get("motivo")).isEqualTo("ESTORNO_INFORMADO");
        assertThat(aviso.get("cobranca_id").toString()).isEqualTo(cobranca.id());
        assertThat(((Number) aviso.get("valor_pago_centavos")).longValue()).isEqualTo(VALOR);
        assertThat(aviso.get("reservado_por")).isNull();
        assertThat(consultas(cobranca)).as("sem nova consulta").hasSize(consultasAntes);
        // (b) A baixa que já existia segue exatamente como estava.
        Map<String, Object> cobrancaDepois = cobrancaNoBanco(cobranca);
        assertThat(cobrancaDepois).isEqualTo(baixa);
        assertThat(cobrancaDepois.get("situacao")).isEqualTo("PAGA");
        assertThat(cobrancaDepois.get("versao")).isEqualTo(versao);
        assertThat(auditorias(conta, "PAGAMENTO_PARA_CONFERIR")).isEqualTo(1);
        assertThat(auditorias(conta, "PAGAMENTO_ESTORNADO")).isZero();

        // Repetir o refunded (ou mandar o paid de novo) não reabre, não conta mais uma, não audita de novo e não mexe na marca.
        int revisao = inteiro(aviso, "revisao");
        assertThat(avisar(conta.token(), avisoComEvento(cobranca.id(), transacao, "refunded")).getStatus()).isEqualTo(200);
        assertThat(avisar(conta.token(), avisoComEvento(cobranca.id(), transacao, "paid")).getStatus()).isEqualTo(200);
        Map<String, Object> mesmo = avisoNoBanco(conta, transacao);
        assertThat(mesmo.get("situacao")).isEqualTo("CONFERIR");
        assertThat(inteiro(mesmo, "revisao")).isEqualTo(revisao);
        assertThat(mesmo.get("estorno_avisado_em")).isEqualTo(aviso.get("estorno_avisado_em"));
        assertThat(auditorias(conta, "PAGAMENTO_PARA_CONFERIR")).isEqualTo(1);
    }

    @Test
    void refundedDeTransacaoQueNuncaFoiVistaNasceComAMarcaEOConciliadorMandaParaConferirSemBaixa() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();
        FALSA.consultaResponde(ModoDaConsulta.NAO_PAGO);

        assertThat(avisar(conta.token(), avisoComEvento(cobranca.id(), transacao, "refunded")).getStatus()).isEqualTo(200);

        // O aviso nasce PENDENTE já com a marca (ainda não há o que reabrir nem conferir): o conciliador a vê e fecha.
        Map<String, Object> aviso = avisoNoBanco(conta, transacao);
        assertThat(aviso.get("situacao")).isEqualTo("PENDENTE");
        assertThat(aviso.get("estorno_avisado_em")).isNotNull();
        assertThat(auditorias(conta, "PAGAMENTO_PARA_CONFERIR")).isZero();

        rodar();

        Map<String, Object> depois = avisoNoBanco(conta, transacao);
        assertThat(depois.get("situacao")).isEqualTo("CONFERIR");
        assertThat(depois.get("motivo")).isEqualTo("ESTORNO_INFORMADO");
        assertThat(depois.get("cobranca_id").toString()).isEqualTo(cobranca.id());
        assertThat(depois.get("estorno_avisado_em")).isEqualTo(aviso.get("estorno_avisado_em"));
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("ABERTA");
        assertThat(auditorias(conta, "PAGAMENTO_PARA_CONFERIR")).isEqualTo(1);
        assertThat(auditorias(conta, "PAGAMENTO_ONLINE_CONFIRMADO")).isZero();
    }

    @Test
    void marcaDeEstornoVenceUmPaymentCheckQueAindaDizPagoENuncaDaBaixa() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();
        Map<String, Object> aberta = cobrancaNoBanco(cobranca);
        // O refunded é o primeiro aviso da transação; depois chega o paid (rearma o PENDENTE com a marca) e a consulta diz pago.
        assertThat(avisar(conta.token(), avisoComEvento(cobranca.id(), transacao, "refunded")).getStatus()).isEqualTo(200);
        Object marca = avisoNoBanco(conta, transacao).get("estorno_avisado_em");
        avisar(cobranca, transacao);
        Map<String, Object> rearmado = avisoNoBanco(conta, transacao);
        assertThat(rearmado.get("situacao")).isEqualTo("PENDENTE");
        assertThat(inteiro(rearmado, "revisao")).isEqualTo(2);
        assertThat(rearmado.get("estorno_avisado_em")).as("o paid não zera a marca").isEqualTo(marca);

        rodar();

        Map<String, Object> aviso = avisoNoBanco(conta, transacao);
        assertThat(consultas(cobranca)).as("a consulta serve só para preencher os dados").hasSize(1);
        assertThat(aviso.get("situacao")).isEqualTo("CONFERIR");
        assertThat(aviso.get("motivo")).isEqualTo("ESTORNO_INFORMADO");
        assertThat(aviso.get("cobranca_id").toString()).isEqualTo(cobranca.id());
        assertThat(((Number) aviso.get("valor_pago_centavos")).longValue()).isEqualTo(VALOR);
        assertThat(aviso.get("forma_capturada")).isNotNull();
        assertThat(aviso.get("estorno_avisado_em")).isEqualTo(marca);
        assertThat(aviso.get("reservado_por")).isNull();
        assertThat(cobrancaNoBanco(cobranca)).as("a cobrança segue aberta e sem baixa").isEqualTo(aberta);
        assertThat(auditorias(conta, "PAGAMENTO_ONLINE_CONFIRMADO")).isZero();
        assertThat(auditorias(conta, "PAGAMENTO_PARA_CONFERIR")).isEqualTo(1);
    }

    @Test
    void marcaDeEstornoNaoEsperaConsultaQueFalha() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();
        FALSA.consultaResponde(ModoDaConsulta.HTTP_500);
        assertThat(avisar(conta.token(), avisoComEvento(cobranca.id(), transacao, "refunded")).getStatus()).isEqualTo(200);

        rodar();

        Map<String, Object> aviso = avisoNoBanco(conta, transacao);
        assertThat(aviso.get("situacao")).isEqualTo("CONFERIR");
        assertThat(aviso.get("motivo")).isEqualTo("ESTORNO_INFORMADO");
        assertThat(inteiro(aviso, "tentativas")).isZero();
        assertThat(aviso.get("valor_pago_centavos")).isNull();
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("ABERTA");
    }

    @Test
    void refundedQueChegaDuranteAConsultaDoPaidGanhaDaBaixa() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();
        avisar(cobranca, transacao);
        Map<String, Object> aberta = cobrancaNoBanco(cobranca);
        AtomicBoolean uma = new AtomicBoolean();
        FALSA.aoReceberConsulta(() -> {
            if (uma.compareAndSet(false, true)) {
                try {
                    avisar(conta.token(), avisoComEvento(cobranca.id(), transacao, "refunded"));
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
            }
        });

        rodar();

        // A consulta (paga) foi lida antes do refunded, mas a baixa não acontece: o aviso já foi para a conferência.
        Map<String, Object> aviso = avisoNoBanco(conta, transacao);
        assertThat(aviso.get("situacao")).isEqualTo("CONFERIR");
        assertThat(aviso.get("motivo")).isEqualTo("ESTORNO_INFORMADO");
        assertThat(aviso.get("estorno_avisado_em")).isNotNull();
        assertThat(aviso.get("reservado_por")).isNull();
        assertThat(cobrancaNoBanco(cobranca)).isEqualTo(aberta);
        assertThat(auditorias(conta, "PAGAMENTO_ONLINE_CONFIRMADO")).isZero();
        assertThat(auditorias(conta, "PAGAMENTO_PARA_CONFERIR")).isEqualTo(1);
    }

    @Test
    void refundedAntesDaConciliacaoDoPaidVaiParaConferirSemConsultarENenhumAvisoPosteriorTiraAMarca() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        JsonNode aluno = loginDoAluno(cobranca);
        String transacao = transacao();
        Map<String, Object> aberta = cobrancaNoBanco(cobranca);
        avisar(cobranca, transacao);
        assertThat(avisoNoBanco(conta, transacao).get("situacao")).isEqualTo("PENDENTE");

        assertThat(avisar(conta.token(), avisoComEvento(cobranca.id(), transacao, "refunded")).getStatus()).isEqualTo(200);

        // (a) O aviso do paid ainda estava PENDENTE: o refunded o leva já para a conferência, e o paid_check nem é feito.
        Map<String, Object> aviso = avisoNoBanco(conta, transacao);
        assertThat(aviso.get("situacao")).isEqualTo("CONFERIR");
        assertThat(aviso.get("motivo")).isEqualTo("ESTORNO_INFORMADO");
        assertThat(aviso.get("estorno_avisado_em")).isNotNull();
        assertThat(auditorias(conta, "PAGAMENTO_PARA_CONFERIR")).isEqualTo(1);

        // (c) Paid repetido e retorno do navegador: a marca fica, o aviso não volta a PENDENTE e nada é consultado nem baixado.
        avisar(cobranca, transacao);
        avisar(cobranca, transacao);
        api.post(RETORNO, aluno, retorno(cobranca.id(), transacao, "slug-abc", "pix"), 204);
        rodar();

        Map<String, Object> depois = avisoNoBanco(conta, transacao);
        assertThat(depois.get("situacao")).isEqualTo("CONFERIR");
        assertThat(depois.get("motivo")).isEqualTo("ESTORNO_INFORMADO");
        assertThat(depois.get("estorno_avisado_em")).isEqualTo(aviso.get("estorno_avisado_em"));
        assertThat(inteiro(depois, "revisao")).isEqualTo(inteiro(aviso, "revisao"));
        assertThat(consultas(cobranca)).isEmpty();
        assertThat(cobrancaNoBanco(cobranca)).isEqualTo(aberta);
        assertThat(auditorias(conta, "PAGAMENTO_ONLINE_CONFIRMADO")).isZero();
        assertThat(auditorias(conta, "PAGAMENTO_PARA_CONFERIR")).isEqualTo(1);
    }

    @Test
    void refundedSemTransacaoDa200SemGravarNada() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();
        avisar(cobranca, transacao);

        String semTransacao = "{\"event\":\"refunded\",\"order_nsu\":\"" + cobranca.id() + "\",\"invoice_slug\":\"slug-abc\"}";
        assertThat(avisar(conta.token(), semTransacao).getStatus()).isEqualTo(200);

        assertThat(totalDeAvisos(conta)).isEqualTo(1);
        Map<String, Object> aviso = avisoNoBanco(conta, transacao);
        assertThat(aviso.get("situacao")).isEqualTo("PENDENTE");
        assertThat(aviso.get("estorno_avisado_em")).isNull();
    }

    @Test
    void refundedDeAvisoJaParaConferirPorOutroMotivoMantemOMotivoEGravaAMarca() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = paraConferirPorValor(cobranca);
        Map<String, Object> antes = avisoNoBanco(conta, transacao);
        assertThat(antes.get("motivo")).isEqualTo("VALOR_DIFERENTE");
        assertThat(antes.get("estorno_avisado_em")).isNull();

        assertThat(avisar(conta.token(), avisoComEvento(cobranca.id(), transacao, "refunded")).getStatus()).isEqualTo(200);

        Map<String, Object> depois = avisoNoBanco(conta, transacao);
        assertThat(depois.get("situacao")).isEqualTo("CONFERIR");
        assertThat(depois.get("motivo")).as("o motivo que o treinador já via fica").isEqualTo("VALOR_DIFERENTE");
        assertThat(depois.get("estorno_avisado_em")).as("a marca fica gravada").isNotNull();
        assertThat(inteiro(depois, "revisao")).isEqualTo(inteiro(antes, "revisao"));
        assertThat(auditorias(conta, "PAGAMENTO_PARA_CONFERIR")).as("só a conferência por valor").isEqualTo(1);
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("ABERTA");
    }

    @Test
    void refundedReabreOConferidoSoQuandoAMarcaNasceAgora() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = paraConferirPorValor(cobranca);
        String id = avisoNoBanco(conta, transacao).get("id").toString();
        api.post("/financeiro/conferencias/" + id + "/conferido", conta.login(), null, 204);
        assertThat(avisoNoBanco(conta, transacao).get("situacao")).isEqualTo("CONFERIDO");

        // (f) Estorno novo é fato novo: o conferido volta para a fila, com o motivo do estorno.
        assertThat(avisar(conta.token(), avisoComEvento(cobranca.id(), transacao, "refunded")).getStatus()).isEqualTo(200);

        Map<String, Object> reaberto = avisoNoBanco(conta, transacao);
        assertThat(reaberto.get("situacao")).isEqualTo("CONFERIR");
        assertThat(reaberto.get("motivo")).isEqualTo("ESTORNO_INFORMADO");
        assertThat(reaberto.get("estorno_avisado_em")).isNotNull();
        assertThat(reaberto.get("conferido_por")).isNull();
        assertThat(reaberto.get("conferido_em")).isNull();
        assertThat(reaberto.get("reservado_por")).isNull();
        assertThat(auditorias(conta, "PAGAMENTO_PARA_CONFERIR")).isEqualTo(2);
        assertThat(api.get("/financeiro/conferencias", conta.login(), 200).get("itens")).hasSize(1);

        // Conferido de novo, o mesmo refunded repetido não reabre.
        api.post("/financeiro/conferencias/" + id + "/conferido", conta.login(), null, 204);
        assertThat(avisar(conta.token(), avisoComEvento(cobranca.id(), transacao, "refunded")).getStatus()).isEqualTo(200);

        Map<String, Object> conferido = avisoNoBanco(conta, transacao);
        assertThat(conferido.get("situacao")).isEqualTo("CONFERIDO");
        assertThat(conferido.get("estorno_avisado_em")).isEqualTo(reaberto.get("estorno_avisado_em"));
        assertThat(auditorias(conta, "PAGAMENTO_PARA_CONFERIR")).isEqualTo(2);
        assertThat(api.get("/financeiro/conferencias", conta.login(), 200).get("itens")).isEmpty();
    }

    @Test
    void refundedTambemReabreAvisoIgnoradoEGuardaOQueJaSabia() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();
        inserirAviso(conta, transacao, "IGNORADO", 0);

        assertThat(avisar(conta.token(), avisoComEvento(cobranca.id(), transacao, "refunded")).getStatus()).isEqualTo(200);

        Map<String, Object> aviso = avisoNoBanco(conta, transacao);
        assertThat(aviso.get("situacao")).isEqualTo("CONFERIR");
        assertThat(aviso.get("motivo")).isEqualTo("ESTORNO_INFORMADO");
        assertThat(aviso.get("estorno_avisado_em")).isNotNull();
        assertThat(auditorias(conta, "PAGAMENTO_PARA_CONFERIR")).isEqualTo(1);
    }

    @Test
    void refundedRespeitaOTetoDeVinteTransacoesDistintas() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String primeira = null;
        for (int i = 0; i < 20; i++) {
            String transacao = transacao();
            primeira = primeira == null ? transacao : primeira;
            assertThat(avisar(conta.token(), avisoComEvento(cobranca.id(), transacao, "refunded")).getStatus()).isEqualTo(200);
        }
        assertThat(totalDeAvisos(conta)).isEqualTo(20);

        String vinteEUma = transacao();
        assertThat(avisar(conta.token(), avisoComEvento(cobranca.id(), vinteEUma, "refunded")).getStatus()).isEqualTo(200);
        assertThat(totalDeAvisos(conta)).isEqualTo(20);
        assertThat(jdbc.queryForObject("select count(*) from aviso_de_pagamento where consultoria_id = ? and transacao = ?",
                Integer.class, conta.consultoria(), vinteEUma)).isZero();

        // Repetir uma que já existe nunca gasta o teto.
        assertThat(avisar(conta.token(), avisoComEvento(cobranca.id(), primeira, "refunded")).getStatus()).isEqualTo(200);
        assertThat(totalDeAvisos(conta)).isEqualTo(20);
    }

    @Test
    void eventoDesconhecidoNaoDaErroEViraUmAvisoComum() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();

        MockHttpServletResponse r = avisar(conta.token(), avisoComEvento(cobranca.id(), transacao, "algo_novo_da_infinitepay"));

        assertThat(r.getStatus()).isEqualTo(200);
        assertThat(avisoNoBanco(conta, transacao).get("situacao")).isEqualTo("PENDENTE");
        rodar();
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("PAGA");
    }

    @Test
    void pagamentoEmDobroComOutraTransacaoVaiParaConferirComValorEDataSemQuitarNada() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String primeira = transacao();
        avisar(cobranca, primeira);
        rodar();
        Map<String, Object> paga = cobrancaNoBanco(cobranca);
        int cobrancasDepois = cobrancasDe(conta, cobranca.aluno(), null).size();
        String segunda = transacao();

        avisar(cobranca, segunda);
        rodar();

        Map<String, Object> linha = avisoNoBanco(conta, segunda);
        assertThat(linha.get("situacao")).isEqualTo("CONFERIR");
        assertThat(linha.get("motivo")).isEqualTo("COBRANCA_JA_PAGA");
        assertThat(linha.get("cobranca_id").toString()).isEqualTo(cobranca.id());
        assertThat(((Number) linha.get("valor_pago_centavos")).longValue()).isEqualTo(VALOR);
        Map<String, Object> depois = cobrancaNoBanco(cobranca);
        assertThat(depois.get("situacao")).isEqualTo("PAGA");
        assertThat(depois.get("id_externo")).as("a baixa continua sendo da primeira transação").isEqualTo(primeira);
        assertThat(depois.get("versao")).isEqualTo(paga.get("versao"));
        assertThat(cobrancasDe(conta, cobranca.aluno(), null)).hasSize(cobrancasDepois);
        assertThat(auditorias(conta, "PAGAMENTO_ONLINE_CONFIRMADO")).isEqualTo(1);
        // O treinador vê o valor pago e quando chegou, para devolver ao aluno.
        JsonNode item = api.get("/financeiro/conferencias", conta.login(), 200).get("itens").get(0);
        assertThat(item.get("motivo").asString()).isEqualTo("COBRANCA_JA_PAGA");
        assertThat(item.get("valorPagoCentavos").asLong()).isEqualTo(VALOR);
        assertThat(java.time.Instant.parse(item.get("recebidoEm").asString())).isNotNull();
    }

    @Test
    void transacaoJaAplicadaNaoQuitaOutraCobrancaQuandoOAvisoVemComOutroPedido() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste a = novaCobranca(conta);
        CobrancaDeTeste b = novaCobranca(conta);
        String transacao = transacao();
        avisar(a, transacao);
        rodar();
        assertThat(cobrancaNoBanco(a).get("situacao")).isEqualTo("PAGA");

        // O mesmo transaction_nsu citando a outra cobrança: a caixa é única por transação e a referência não troca.
        avisar(b, transacao);
        rodar();

        assertThat(cobrancaNoBanco(b).get("situacao")).isEqualTo("ABERTA");
        assertThat(cobrancaNoBanco(b).get("id_externo")).isNull();
        assertThat(cobrancaNoBanco(a).get("id_externo")).isEqualTo(transacao);
        assertThat(totalDeAvisos(conta)).isEqualTo(1);
        assertThat(avisoNoBanco(conta, transacao).get("referencia")).isEqualTo(a.id());
        assertThat(auditorias(conta, "PAGAMENTO_ONLINE_CONFIRMADO")).isEqualTo(1);
    }

    @Test
    void avisoForjadoComTokenValidoDeTransacaoQueNaoExisteOuNaoFoiPagaNaoDaBaixa() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        FALSA.consultaResponde(ModoDaConsulta.NAO_PAGO);

        // O corpo diz que está tudo pago, mas só a consulta à InfinitePay vale.
        assertThat(avisar(conta.token(), aviso(cobranca.id(), "TX-FORJADA-" + UUID.randomUUID(), "slug-abc")).getStatus())
                .isEqualTo(200);
        rodar();

        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("ABERTA");
        assertThat(cobrancaNoBanco(cobranca).get("id_externo")).isNull();
        assertThat(consultas(cobranca)).hasSize(1);
        assertThat(auditorias(conta, "PAGAMENTO_ONLINE_CONFIRMADO")).isZero();

        // Consulta que diz "success" falso (transação inexistente): também nada.
        FALSA.consultaResponde(ModoDaConsulta.SEM_SUCESSO);
        String outra = transacao();
        avisar(cobranca, outra);
        rodar();
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("ABERTA");
        assertThat(avisoNoBanco(conta, outra).get("situacao")).isEqualTo("PENDENTE");
    }

    // ---- teto de avisos por cobrança ----

    @Test
    void acimaDe20TransacoesDistintasPorCobrancaOWebhookDa200SemGravarMasRepetirNuncaGastaOTeto() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        CobrancaDeTeste outra = novaCobranca(conta);
        List<String> transacoes = new ArrayList<>();
        for (int i = 0; i < AvisoDePagamentoRepositorio.MAXIMO_DE_AVISOS; i++) {
            transacoes.add(transacao());
            avisar(cobranca, transacoes.get(i));
        }
        assertThat(totalDeAvisos(conta)).isEqualTo(AvisoDePagamentoRepositorio.MAXIMO_DE_AVISOS);

        // A 21ª transação distinta não grava.
        String vinteEUma = transacao();
        assertThat(avisar(conta.token(), aviso(cobranca.id(), vinteEUma, "slug-abc")).getStatus()).isEqualTo(200);
        assertThat(totalDeAvisos(conta)).isEqualTo(AvisoDePagamentoRepositorio.MAXIMO_DE_AVISOS);
        assertThat(jdbc.queryForObject("select count(*) from aviso_de_pagamento where consultoria_id = ? and transacao = ?",
                Integer.class, conta.consultoria(), vinteEUma)).isZero();

        // Repetir uma transação que já existe continua rearmando, quantas vezes for, mesmo no teto.
        String repetida = transacoes.get(0);
        for (int i = 0; i < 30; i++) {
            assertThat(avisar(conta.token(), aviso(cobranca.id(), repetida, "slug-abc")).getStatus()).isEqualTo(200);
        }
        assertThat(inteiro(avisoNoBanco(conta, repetida), "revisao")).isEqualTo(31);
        assertThat(avisoNoBanco(conta, repetida).get("situacao")).isEqualTo("PENDENTE");
        assertThat(totalDeAvisos(conta)).isEqualTo(AvisoDePagamentoRepositorio.MAXIMO_DE_AVISOS);

        // O teto é por cobrança: a outra segue normal.
        avisar(outra, transacao());
        assertThat(totalDeAvisos(conta)).isEqualTo(AvisoDePagamentoRepositorio.MAXIMO_DE_AVISOS + 1);
    }

    // ---- retorno do navegador do aluno ----

    private static final String RETORNO = "/aluno/financeiro/retorno-pagamento";

    private JsonNode loginDoAluno(CobrancaDeTeste c) throws Exception {
        return api.convidarEEntrar(c.conta().login(), c.aluno());
    }

    private static Map<String, Object> retorno(String orderNsu, String transactionNsu, String slug, String captureMethod) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        if (orderNsu != null) {
            corpo.put("orderNsu", orderNsu);
        }
        if (transactionNsu != null) {
            corpo.put("transactionNsu", transactionNsu);
        }
        if (slug != null) {
            corpo.put("slug", slug);
        }
        if (captureMethod != null) {
            corpo.put("captureMethod", captureMethod);
        }
        return corpo;
    }

    @Test
    void retornoDoProprioAlunoGravaNaCaixaSemBaixarEOConciliadorBaixaDepoisDaConsulta() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        JsonNode aluno = loginDoAluno(cobranca);
        String transacao = transacao();

        api.post(RETORNO, aluno, retorno(cobranca.id(), transacao, "slug-abc", "pix"), 204);

        // Só um gatilho: nada de baixa nem de consulta até o conciliador rodar.
        Map<String, Object> linha = avisoNoBanco(conta, transacao);
        assertThat(linha.get("situacao")).isEqualTo("PENDENTE");
        assertThat(linha.get("referencia")).isEqualTo(cobranca.id());
        assertThat(linha.get("slug")).isEqualTo("slug-abc");
        assertThat(inteiro(linha, "revisao")).isEqualTo(1);
        assertThat(linha.get("hash_corpo")).isEqualTo(sha256("retorno\norder_nsu=" + cobranca.id() + "\ntransaction_nsu=" + transacao
                + "\nslug=slug-abc\ncapture_method=pix"));
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("ABERTA");
        assertThat(consultas(cobranca)).isEmpty();
        assertThat(auditorias(conta, "PAGAMENTO_ONLINE_CONFIRMADO")).isZero();

        rodar();

        assertThat(consultas(cobranca)).hasSize(1);
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("PAGA");
        assertThat(cobrancaNoBanco(cobranca).get("id_externo")).isEqualTo(transacao);
        assertThat(avisoNoBanco(conta, transacao).get("situacao")).isEqualTo("APLICADO");

        // Repetir o retorno usa o mesmo upsert do webhook: uma linha só, revisão sobe.
        api.post(RETORNO, aluno, retorno(cobranca.id(), transacao, "slug-abc", "pix"), 204);
        assertThat(totalDeAvisos(conta)).isEqualTo(1);
        assertThat(inteiro(avisoNoBanco(conta, transacao), "revisao")).isEqualTo(2);
    }

    @Test
    void retornoQueDizPagoMasAConsultaNaoConfirmaNaoDaBaixa() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        JsonNode aluno = loginDoAluno(cobranca);
        FALSA.consultaResponde(ModoDaConsulta.NAO_PAGO);
        String transacao = transacao();

        api.post(RETORNO, aluno, retorno(cobranca.id(), transacao, null, null), 204);
        rodar();

        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("ABERTA");
        assertThat(avisoNoBanco(conta, transacao).get("situacao")).isEqualTo("PENDENTE");
        assertThat(auditorias(conta, "PAGAMENTO_ONLINE_CONFIRMADO")).isZero();
    }

    @Test
    void retornoComSlugDoNavegadorNaoSobrepoeOSlugDoLinkDaCobranca() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        jdbc.update("update cobranca_aluno set link_slug = 'slug-do-link' where id = ?::uuid", cobranca.id());
        JsonNode aluno = loginDoAluno(cobranca);
        String transacao = transacao();

        api.post(RETORNO, aluno, retorno(cobranca.id(), transacao, "slug-do-navegador", null), 204);

        assertThat(avisoNoBanco(conta, transacao).get("slug")).isNull();
        rodar();
        assertThat(consultas(cobranca).get(0).corpo().path("slug").asString()).isEqualTo("slug-do-link");
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("PAGA");
    }

    @Test
    void retornoComSlugDiferenteDepoisDoWebhookNaoAlteraOSlugDoAviso() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        JsonNode aluno = loginDoAluno(cobranca);
        String transacao = transacao();

        avisar(cobranca, transacao);
        assertThat(avisoNoBanco(conta, transacao).get("slug")).isEqualTo("slug-abc");
        api.post(RETORNO, aluno, retorno(cobranca.id(), transacao, "slug-do-navegador", null), 204);

        Map<String, Object> linha = avisoNoBanco(conta, transacao);
        assertThat(linha.get("slug")).isEqualTo("slug-abc");
        assertThat(inteiro(linha, "revisao")).isEqualTo(2);

        // O contrário: o webhook continua podendo atualizar o slug que o retorno tinha deixado.
        String outra = transacao();
        api.post(RETORNO, aluno, retorno(cobranca.id(), outra, "slug-do-navegador", null), 204);
        assertThat(avisoNoBanco(conta, outra).get("slug")).isEqualTo("slug-do-navegador");
        avisar(cobranca, outra);
        assertThat(avisoNoBanco(conta, outra).get("slug")).isEqualTo("slug-abc");
    }

    @Test
    void retornoDeCobrancaDeOutroAlunoOuDeOutraConsultoriaOuInexistenteDa404SemGravar() throws Exception {
        Conta a = novaConta("treinador-a", null);
        Conta b = novaConta("treinador-b", null);
        CobrancaDeTeste doAluno = novaCobranca(a);
        CobrancaDeTeste doColega = novaCobranca(a);
        CobrancaDeTeste daOutraConsultoria = novaCobranca(b);
        JsonNode aluno = loginDoAluno(doAluno);

        for (String alvo : new String[] {doColega.id(), daOutraConsultoria.id(), UUID.randomUUID().toString()}) {
            api.post(RETORNO, aluno, retorno(alvo, transacao(), null, null), 404);
        }

        assertThat(totalDeAvisos(a)).isZero();
        assertThat(totalDeAvisos(b)).isZero();
        assertThat(FALSA.requisicoes()).isEmpty();
    }

    @Test
    void retornoComCorpoInvalidoOuSemTransacaoNaoGravaNada() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        JsonNode aluno = loginDoAluno(cobranca);

        api.post(RETORNO, aluno, retorno(cobranca.id(), null, null, null), 400);
        api.post(RETORNO, aluno, retorno(cobranca.id(), "", null, null), 400);
        api.post(RETORNO, aluno, retorno(null, transacao(), null, null), 400);
        api.post(RETORNO, aluno, retorno("nao-e-uuid", transacao(), null, null), 400);
        api.post(RETORNO, aluno, retorno(cobranca.id(), "com espaço", null, null), 400);
        api.post(RETORNO, aluno, retorno(cobranca.id(), "x".repeat(101), null, null), 400);
        api.post(RETORNO, aluno, retorno(cobranca.id(), transacao(), "slug com espaço", null), 400);
        api.post(RETORNO, aluno, retorno(cobranca.id(), transacao(), null, "pix 2.0 / muito longo demais para ser metodo"), 400);

        assertThat(totalDeAvisos(conta)).isZero();
    }

    @Test
    void retornoExigeSessaoDeAlunoEAFuncionalidadeLigada() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        Map<String, Object> corpo = retorno(cobranca.id(), transacao(), null, null);

        api.post(RETORNO, null, corpo, 401);
        api.post(RETORNO, conta.login(), corpo, 403);

        assertThat(totalDeAvisos(conta)).isZero();
    }

    @Test
    void retornoSemRecebimentoOnlineConfiguradoDa204SemGravar() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        JsonNode aluno = loginDoAluno(cobranca);
        api.delete("/financeiro/recebimento-online", conta.login(), 204);

        api.post(RETORNO, aluno, retorno(cobranca.id(), transacao(), null, null), 204);

        assertThat(totalDeAvisos(conta)).isZero();
    }

    @Test
    void retornoAcimaDoTetoDe20AvisosDa204SemGravar() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        JsonNode aluno = loginDoAluno(cobranca);
        for (int i = 0; i < AvisoDePagamentoRepositorio.MAXIMO_DE_AVISOS; i++) {
            api.post(RETORNO, aluno, retorno(cobranca.id(), transacao(), null, null), 204);
        }
        assertThat(totalDeAvisos(conta)).isEqualTo(AvisoDePagamentoRepositorio.MAXIMO_DE_AVISOS);

        String vinteEUma = transacao();
        api.post(RETORNO, aluno, retorno(cobranca.id(), vinteEUma, null, null), 204);

        assertThat(totalDeAvisos(conta)).isEqualTo(AvisoDePagamentoRepositorio.MAXIMO_DE_AVISOS);
        assertThat(jdbc.queryForObject("select count(*) from aviso_de_pagamento where consultoria_id = ? and transacao = ?",
                Integer.class, conta.consultoria(), vinteEUma)).isZero();
        // E o webhook da mesma cobrança também respeita o mesmo teto.
        assertThat(avisar(conta.token(), aviso(cobranca.id(), transacao(), "slug-abc")).getStatus()).isEqualTo(200);
        assertThat(totalDeAvisos(conta)).isEqualTo(AvisoDePagamentoRepositorio.MAXIMO_DE_AVISOS);
    }

    @Test
    void naoPagoDeTransacaoNuncaAplicadaNaoAlteraNada() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste aberta = novaCobranca(conta);
        CobrancaDeTeste pagaNaMao = novaCobranca(conta);
        baixaManual(pagaNaMao);
        Object versaoDaAberta = cobrancaNoBanco(aberta).get("versao");
        Object versaoDaPaga = cobrancaNoBanco(pagaNaMao).get("versao");
        FALSA.consultaResponde(ModoDaConsulta.NAO_PAGO);
        String primeira = transacao();
        String segunda = transacao();

        avisar(aberta, primeira);
        avisar(pagaNaMao, segunda);
        rodar();

        assertThat(cobrancaNoBanco(aberta).get("versao")).isEqualTo(versaoDaAberta);
        assertThat(cobrancaNoBanco(aberta).get("situacao")).isEqualTo("ABERTA");
        assertThat(cobrancaNoBanco(pagaNaMao).get("versao")).isEqualTo(versaoDaPaga);
        assertThat(cobrancaNoBanco(pagaNaMao).get("situacao")).as("a baixa manual não é desfeita por um aviso").isEqualTo("PAGA");
        assertThat(avisoNoBanco(conta, primeira).get("situacao")).isEqualTo("PENDENTE");
        assertThat(avisoNoBanco(conta, segunda).get("situacao")).isEqualTo("PENDENTE");
        assertThat(auditorias(conta, "PAGAMENTO_ESTORNADO")).isZero();
        assertThat(auditorias(conta, "PAGAMENTO_PARA_CONFERIR")).isZero();
    }

    @Test
    void oConciliadorAgendadoNaoFazNadaComAConciliacaoDesligada() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = transacao();
        avisar(cobranca, transacao);

        conciliador.conciliarAgora();

        assertThat(avisoNoBanco(conta, transacao).get("situacao")).isEqualTo("PENDENTE");
        assertThat(FALSA.requisicoes()).isEmpty();
    }

    // ---- credenciais ----

    @Test
    void cabecalhoDaChaveSoVaiComChaveEAContaSempreEDaConsultoriaCerta() throws Exception {
        Conta comChave = novaConta("treinador-com-chave", CHAVE);
        Conta semChave = novaConta("treinador-sem-chave", null);
        CobrancaDeTeste daComChave = novaCobranca(comChave);
        CobrancaDeTeste daSemChave = novaCobranca(semChave);
        avisar(daComChave, transacao());
        avisar(daSemChave, transacao());

        rodar();

        List<Requisicao> a = consultas(daComChave);
        List<Requisicao> b = consultas(daSemChave);
        assertThat(a).hasSize(1);
        assertThat(b).hasSize(1);
        assertThat(a.get(0).chave()).isEqualTo(CHAVE);
        assertThat(a.get(0).corpo().path("handle").asString()).isEqualTo("treinador-com-chave");
        assertThat(b.get(0).chave()).isNull();
        assertThat(b.get(0).corpo().path("handle").asString()).isEqualTo("treinador-sem-chave");
        assertThat(cobrancaNoBanco(daComChave).get("situacao")).isEqualTo("PAGA");
        assertThat(cobrancaNoBanco(daSemChave).get("situacao")).isEqualTo("PAGA");
    }

    @Test
    void oSegredoNuncaApareceEmLogAuditoriaNemAviso() throws Exception {
        Conta conta = novaConta(TAG, CHAVE);
        CobrancaDeTeste cobranca = novaCobranca(conta);
        FALSA.exigeChave(true).esperaChave(CHAVE);
        String conferir = transacao();
        FALSA.valorDaConsulta(1);
        avisar(cobranca, conferir);
        rodar();
        FALSA.valorDaConsulta(VALOR);
        CobrancaDeTeste outra = novaCobranca(conta);
        avisar(outra, transacao());
        rodar();

        String avisos = jdbc.queryForObject("select string_agg(cast(row_to_json(a) as text), ' ') from aviso_de_pagamento a "
                + "where consultoria_id = ?", String.class, conta.consultoria());
        String auditado = jdbc.queryForObject("select string_agg(acao || ' ' || coalesce(entidade, '') || ' ' || resumo, ' ') "
                + "from auditoria where consultoria_id = ?", String.class, conta.consultoria());
        assertThat(avisos).doesNotContain(CHAVE).doesNotContain("v1:").doesNotContain(TAG);
        assertThat(auditado).doesNotContain(CHAVE).doesNotContain("v1:").doesNotContain(TAG);
        assertThat(api.get("/financeiro/conferencias", conta.login(), 200).toString()).doesNotContain(CHAVE).doesNotContain(TAG);
        semNoLog(CHAVE, TAG, conta.token(), "v1:");
        assertThat(consultas(cobranca).get(0).chave()).isEqualTo(CHAVE);
    }

    // ---- para conferir ----

    @Test
    void listaSoOsParaConferirDaConsultoriaAtualComNomesEValoresEUmaConsultaSo() throws Exception {
        Conta a = novaConta("treinador-a", null);
        Conta b = novaConta("treinador-b", null);
        CobrancaDeTeste primeira = novaCobranca(a);
        CobrancaDeTeste segunda = novaCobranca(a);
        CobrancaDeTeste aplicada = novaCobranca(a);
        CobrancaDeTeste daB = novaCobranca(b);
        String t1 = paraConferirPorValor(primeira);
        String t2 = paraConferirPorValor(segunda);
        paraConferirPorValor(daB);
        avisar(aplicada, transacao());
        rodar();
        assertThat(cobrancaNoBanco(aplicada).get("situacao")).isEqualTo("PAGA");
        String idDoAviso1 = avisoNoBanco(a, t1).get("id").toString();
        String idDoAviso2 = avisoNoBanco(a, t2).get("id").toString();

        Mockito.clearInvocations(jdbc);
        var resposta = mvc.perform(MockMvcRequestBuilders.get("/financeiro/conferencias")
                .header("X-Treinos-Cliente", "nativo")
                .header("Authorization", ApiDeTeste.bearer(a.login()))).andReturn().getResponse();
        // O JdbcTemplate repassa a si mesmo (query com RowMapper chama query com extrator): só a chamada de fora conta.
        long consultasDaFila = Mockito.mockingDetails(jdbc).getInvocations().stream()
                .filter(i -> i.getArguments().length > 1 && i.getArguments()[0] instanceof String sql
                        && sql.contains("aviso_de_pagamento") && i.getArguments()[1] instanceof RowMapper).count();

        assertThat(resposta.getStatus()).isEqualTo(200);
        assertThat(resposta.getHeader("Cache-Control")).contains("no-store");
        assertThat(consultasDaFila).as("uma consulta só, sem N+1").isEqualTo(1);
        JsonNode itens = json.readTree(resposta.getContentAsString()).get("itens");
        assertThat(itens).hasSize(2);
        // Mais recente primeiro.
        assertThat(itens.get(0).get("id").asString()).isEqualTo(idDoAviso2);
        assertThat(itens.get(1).get("id").asString()).isEqualTo(idDoAviso1);
        JsonNode item = itens.get(0);
        assertThat(item.get("alunoId").asString()).isEqualTo(segunda.aluno().toString());
        assertThat(item.get("alunoNome").asString()).startsWith("Aluno Fictício ");
        assertThat(item.get("cobrancaId").asString()).isEqualTo(segunda.id());
        assertThat(item.get("competencia").asString()).isEqualTo(cobrancaApi(segunda).get("competencia").asString());
        assertThat(item.get("valorCobrancaCentavos").asLong()).isEqualTo(VALOR);
        assertThat(item.get("valorPagoCentavos").asLong()).isEqualTo(VALOR - 1_000);
        assertThat(item.get("motivo").asString()).isEqualTo("VALOR_DIFERENTE");
        assertThat(item.get("recebidoEm").asString()).isNotBlank();
        assertThat(resposta.getContentAsString()).doesNotContain(t1).doesNotContain(a.token());
        // A outra consultoria vê só o dela.
        assertThat(api.get("/financeiro/conferencias", b.login(), 200).get("itens")).hasSize(1);
    }

    @Test
    void jsonDasConferenciasTemExatamenteOsCamposQueOAppLe() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        paraConferirPorValor(cobranca);
        jdbc.update("insert into aviso_de_pagamento (id, consultoria_id, provedor, referencia, transacao, hash_corpo, "
                + "recebido_em, situacao, motivo, valor_pago_centavos) values (gen_random_uuid(), ?, 'INFINITEPAY', "
                + "gen_random_uuid()::text, 'TX-JSON-ORFA', repeat('a', 64), now() - interval '1 hour', 'CONFERIR', "
                + "'COBRANCA_NAO_ENCONTRADA', 9000)", conta.consultoria());

        JsonNode itens = api.get("/financeiro/conferencias", conta.login(), 200).get("itens");

        // Contrato com o app (financeiroTipos.ts, ConferenciaDePagamento): estes nove campos, sempre presentes (nulos como null).
        assertThat(itens).hasSize(2);
        for (JsonNode item : itens) {
            assertThat(item.propertyNames()).containsExactlyInAnyOrder("id", "alunoId", "alunoNome", "cobrancaId", "competencia",
                    "valorCobrancaCentavos", "valorPagoCentavos", "motivo", "recebidoEm");
            // Instant ISO-8601 em UTC (o app faz new Date(...)), nunca número.
            assertThat(item.get("recebidoEm").isString()).isTrue();
            assertThat(java.time.Instant.parse(item.get("recebidoEm").asString())).isNotNull();
        }
        JsonNode comCobranca = itens.get(0);
        assertThat(comCobranca.get("motivo").asString()).isEqualTo("VALOR_DIFERENTE");
        assertThat(comCobranca.get("alunoId").asString()).isEqualTo(cobranca.aluno().toString());
        // competencia é LocalDate ISO (aaaa-mm-dd), não aaaa-mm.
        assertThat(comCobranca.get("competencia").asString()).matches("\\d{4}-\\d{2}-\\d{2}");
        assertThat(comCobranca.get("valorCobrancaCentavos").isNumber()).isTrue();
        assertThat(comCobranca.get("valorPagoCentavos").isNumber()).isTrue();
        JsonNode orfa = itens.get(1);
        assertThat(orfa.get("motivo").asString()).isEqualTo("COBRANCA_NAO_ENCONTRADA");
        // Sem cobrança nesta consultoria: aluno, cobrança, competência e valor da cobrança vêm null; o valor pago é o do aviso.
        for (String campo : new String[] {"alunoId", "alunoNome", "cobrancaId", "competencia", "valorCobrancaCentavos"}) {
            assertThat(orfa.get(campo).isNull()).as(campo).isTrue();
        }
        assertThat(orfa.get("valorPagoCentavos").asLong()).isEqualTo(9000L);
    }

    @Test
    void listaTemTetoDe200() throws Exception {
        Conta conta = novaConta();
        jdbc.update("insert into aviso_de_pagamento (id, consultoria_id, provedor, referencia, transacao, hash_corpo, "
                + "recebido_em, situacao, motivo) select gen_random_uuid(), ?, 'INFINITEPAY', gen_random_uuid()::text, "
                + "'TX-TETO-' || g, repeat('a', 64), now() - g * interval '1 second', 'CONFERIR', 'CONSULTA_FALHOU' "
                + "from generate_series(1, 205) g", conta.consultoria());

        JsonNode itens = api.get("/financeiro/conferencias", conta.login(), 200).get("itens");

        assertThat(itens).hasSize(200);
        assertThat(itens.get(0).get("alunoNome").isNull()).as("sem cobrança, sem aluno").isTrue();
    }

    @Test
    void conferidoMarcaIdempotenteAudita_ENuncaDaBaixa() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = paraConferirPorValor(cobranca);
        String id = avisoNoBanco(conta, transacao).get("id").toString();
        String usuario = conta.login().get("usuario").get("id").asString();

        api.post("/financeiro/conferencias/" + id + "/conferido", conta.login(), null, 204);

        Map<String, Object> linha = avisoNoBanco(conta, transacao);
        assertThat(linha.get("situacao")).isEqualTo("CONFERIDO");
        assertThat(linha.get("conferido_por").toString()).isEqualTo(usuario);
        assertThat(linha.get("conferido_em")).isNotNull();
        assertThat(api.get("/financeiro/conferencias", conta.login(), 200).get("itens")).isEmpty();
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).as("conferir nunca dá baixa").isEqualTo("ABERTA");
        assertThat(auditorias(conta, "PAGAMENTO_CONFERIDO")).isEqualTo(1);
        assertThat(jdbc.queryForObject("select usuario_id from auditoria where consultoria_id = ? and acao = 'PAGAMENTO_CONFERIDO'",
                String.class, conta.consultoria())).isEqualTo(usuario);
        assertThat(jdbc.queryForObject("select resumo from auditoria where consultoria_id = ? and acao = 'PAGAMENTO_CONFERIDO'",
                String.class, conta.consultoria())).isEqualTo("Marcou um pagamento online como conferido.");

        // De novo: 204, sem auditar outra vez.
        api.post("/financeiro/conferencias/" + id + "/conferido", conta.login(), null, 204);
        assertThat(auditorias(conta, "PAGAMENTO_CONFERIDO")).isEqualTo(1);
    }

    @Test
    void avisoRepetidoDepoisDeConferirOuConferidoNaoReabre() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = paraConferirPorValor(cobranca);
        Map<String, Object> antes = avisoNoBanco(conta, transacao);

        avisar(cobranca, transacao);
        rodar();

        Map<String, Object> mesmo = avisoNoBanco(conta, transacao);
        assertThat(mesmo.get("situacao")).isEqualTo("CONFERIR");
        assertThat(inteiro(mesmo, "revisao")).isEqualTo(inteiro(antes, "revisao"));
        assertThat(totalDeAvisos(conta)).isEqualTo(1);

        api.post("/financeiro/conferencias/" + mesmo.get("id") + "/conferido", conta.login(), null, 204);
        FALSA.valorDaConsulta(VALOR);
        avisar(cobranca, transacao);
        rodar();

        Map<String, Object> conferido = avisoNoBanco(conta, transacao);
        assertThat(conferido.get("situacao")).isEqualTo("CONFERIDO");
        assertThat(inteiro(conferido, "revisao")).isEqualTo(inteiro(antes, "revisao"));
        assertThat(cobrancaNoBanco(cobranca).get("situacao")).isEqualTo("ABERTA");
        assertThat(api.get("/financeiro/conferencias", conta.login(), 200).get("itens")).isEmpty();
    }

    @Test
    void conferidoEmAvisoAlheioOuInexistenteDa404EEmAvisoNaoConferivelDa409() throws Exception {
        Conta a = novaConta("treinador-a", null);
        Conta b = novaConta("treinador-b", null);
        CobrancaDeTeste cobranca = novaCobranca(a);
        String transacao = paraConferirPorValor(cobranca);
        String id = avisoNoBanco(a, transacao).get("id").toString();

        api.post("/financeiro/conferencias/" + id + "/conferido", b.login(), null, 404);
        api.post("/financeiro/conferencias/" + UUID.randomUUID() + "/conferido", a.login(), null, 404);
        assertThat(avisoNoBanco(a, transacao).get("situacao")).isEqualTo("CONFERIR");
        assertThat(auditorias(a, "PAGAMENTO_CONFERIDO")).isZero();

        // Pendente e aplicado não são "para conferir".
        CobrancaDeTeste pendente = novaCobranca(a);
        String pendenteTx = transacao();
        avisar(pendente, pendenteTx);
        String pendenteId = avisoNoBanco(a, pendenteTx).get("id").toString();
        assertThat(api.post("/financeiro/conferencias/" + pendenteId + "/conferido", a.login(), null, 409)
                .get("codigo").asString()).isEqualTo("AVISO_NAO_CONFERIVEL");
        rodar();
        assertThat(avisoNoBanco(a, pendenteTx).get("situacao")).isEqualTo("APLICADO");
        assertThat(api.post("/financeiro/conferencias/" + pendenteId + "/conferido", a.login(), null, 409)
                .get("codigo").asString()).isEqualTo("AVISO_NAO_CONFERIVEL");
        assertThat(avisoNoBanco(a, pendenteTx).get("situacao")).isEqualTo("APLICADO");
    }

    @Test
    void permissoesDasConferencias() throws Exception {
        Conta conta = novaConta();
        CobrancaDeTeste cobranca = novaCobranca(conta);
        String transacao = paraConferirPorValor(cobranca);
        String id = avisoNoBanco(conta, transacao).get("id").toString();
        JsonNode semFinanceiro = membro(conta, "Sem financeiro", Set.of("ALUNO_LER"));
        JsonNode leitor = membro(conta, "Leitor financeiro", Set.of("FINANCEIRO_LER", "ALUNO_LER"));
        JsonNode aluno = api.convidarEEntrar(conta.login(), cobranca.aluno());

        // As autoridades vêm do banco a cada pedido: sem ALUNO_LER, o leitor perde a lista (ela cruza com o aluno).
        String perfilDoLeitor = jdbc.queryForObject("select perfil_id::text from usuario where id = ?::uuid", String.class,
                leitor.get("usuario").get("id").asString());
        jdbc.update("delete from perfil_permissao where perfil_id = ?::uuid and codigo = 'ALUNO_LER'", perfilDoLeitor);
        api.get("/financeiro/conferencias", leitor, 403);
        jdbc.update("insert into perfil_permissao(perfil_id, codigo) values (?::uuid, 'ALUNO_LER')", perfilDoLeitor);

        api.get("/financeiro/conferencias", semFinanceiro, 403);
        api.post("/financeiro/conferencias/" + id + "/conferido", semFinanceiro, null, 403);
        assertThat(api.get("/financeiro/conferencias", leitor, 200).get("itens")).hasSize(1);
        api.post("/financeiro/conferencias/" + id + "/conferido", leitor, null, 403);
        api.get("/financeiro/conferencias", aluno, 403);
        api.post("/financeiro/conferencias/" + id + "/conferido", aluno, null, 403);
        api.get("/financeiro/conferencias", null, 401);
        api.post("/financeiro/conferencias/" + id + "/conferido", null, null, 401);
        assertThat(avisoNoBanco(conta, transacao).get("situacao")).isEqualTo("CONFERIR");
    }

    private JsonNode membro(Conta conta, String nome, Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", conta.login(),
                Map.of("nome", "Perfil " + nome + UUID.randomUUID(), "permissoes", permissoes), 200).get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", conta.login(),
                Map.of("nome", nome, "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    // ---- retenção e LGPD ----

    @Test
    void limpezaApagaOResolvidoAntigoEGuardaOResto() throws Exception {
        Conta conta = novaConta();
        Map<String, String> situacaoPorTransacao = new LinkedHashMap<>();
        situacaoPorTransacao.put("TX-VELHO-APLICADO", "APLICADO");
        situacaoPorTransacao.put("TX-VELHO-IGNORADO", "IGNORADO");
        situacaoPorTransacao.put("TX-VELHO-CONFERIDO", "CONFERIDO");
        situacaoPorTransacao.put("TX-VELHO-CONFERIR", "CONFERIR");
        situacaoPorTransacao.put("TX-VELHO-PENDENTE", "PENDENTE");
        situacaoPorTransacao.forEach((transacao, situacao) -> inserirAviso(conta, transacao, situacao, 181));
        inserirAviso(conta, "TX-NOVO-APLICADO", "APLICADO", 179);

        int apagados = conciliador.limparAvisosAntigos();

        assertThat(apagados).isGreaterThanOrEqualTo(3);
        assertThat(totalDeAvisos(conta)).isEqualTo(3);
        assertThat(avisoNoBanco(conta, "TX-VELHO-CONFERIR").get("situacao")).isEqualTo("CONFERIR");
        assertThat(avisoNoBanco(conta, "TX-VELHO-PENDENTE").get("situacao")).isEqualTo("PENDENTE");
        assertThat(avisoNoBanco(conta, "TX-NOVO-APLICADO").get("situacao")).isEqualTo("APLICADO");
    }

    private void inserirAviso(Conta conta, String transacao, String situacao, int diasAtras) {
        jdbc.update("insert into aviso_de_pagamento (id, consultoria_id, provedor, referencia, transacao, hash_corpo, "
                + "recebido_em, situacao, proxima_tentativa) values (gen_random_uuid(), ?, 'INFINITEPAY', "
                + "gen_random_uuid()::text, ?, repeat('a', 64), now() - make_interval(days => ?), ?, now() + interval '1 day')",
                conta.consultoria(), transacao, diasAtras, situacao);
    }

    @Test
    void anonimizarOAlunoApagaOSlugDoAvisoEMantemSoIdentificadores() throws Exception {
        Conta conta = novaConta();
        String nome = "Joana Fictícia do Aviso " + UUID.randomUUID();
        UUID aluno = api.criarAluno(conta.login(), nome);
        JsonNode plano = api.post("/financeiro/planos", conta.login(),
                Map.of("nome", "Plano " + UUID.randomUUID(), "valorCentavos", VALOR, "periodicidade", "MENSAL"), 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("planoComercialId", plano.get("id").asString());
        corpo.put("inicio", hoje.toString());
        corpo.put("diaVencimento", hoje.getDayOfMonth());
        api.post("/alunos/" + aluno + "/contratacoes", conta.login(), corpo, 200);
        CobrancaDeTeste cobranca = new CobrancaDeTeste(conta, aluno, cobrancasDe(conta, aluno, "ABERTA").get(0).get("id").asString());
        String transacao = transacao();
        avisar(cobranca, transacao);
        CobrancaDeTeste doOutro = novaCobranca(conta);
        String transacaoDoOutro = transacao();
        avisar(doOutro, transacaoDoOutro);
        assertThat(avisoNoBanco(conta, transacao).get("slug")).isEqualTo("slug-abc");

        api.patch("/alunos/" + aluno + "/situacao", conta.login(), Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", conta.login(), Map.of("nomeConfirmado", nome), 200);

        Map<String, Object> linha = avisoNoBanco(conta, transacao);
        assertThat(linha.get("slug")).as("o slug é o do link do pagador").isNull();
        assertThat(linha.get("transacao")).isEqualTo(transacao);
        assertThat(linha.get("referencia")).isEqualTo(cobranca.id());
        assertThat(linha.get("hash_corpo")).isEqualTo(sha256(aviso(cobranca.id(), transacao, "slug-abc")));
        assertThat(avisoNoBanco(conta, transacaoDoOutro).get("slug")).as("o aviso de outro aluno não é tocado").isEqualTo("slug-abc");
    }
}
