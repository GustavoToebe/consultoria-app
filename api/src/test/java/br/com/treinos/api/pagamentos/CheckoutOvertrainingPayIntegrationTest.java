package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.conta.ContaLocalRepositorio;
import br.com.treinos.api.conta.DireitosLocais;
import br.com.treinos.api.pagamentos.provedor.ProvedorAsaas;
import br.com.treinos.api.web.Fuso;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Fluxo completo da Onda 2 do Overtraining Pay (Asaas):
 * {@code GET /aluno/financeiro}, Pix, Cartão (1..12x), pedido de CPF quando ausente, baixa via webhook +
 * {@link ConciliadorAsaas}, Contrato Fechado (V098), valor divergente -> Para conferir, estorno -> ESTORNO_INFORMADO,
 * split {@code ABATER_MENSALIDADE}, isolamento multi-tenant/aluno (404), anonimização LGPD e zero vazamento de
 * PAN/CVV/CPF/chaves em logs e auditoria.
 */
@AutoConfigureMockMvc
class CheckoutOvertrainingPayIntegrationTest extends AbstractIntegrationTest {

    private static final String ROTA_CONFIG = "/financeiro/overtraining-pay";
    private static final String CHAVE_MATRIZ = "chave-matriz-checkout-onda2-teste";
    private static final String CPF_VALIDO = "52998224725";
    private static final String PAN_CARTAO = "5123456789012346";
    private static final String CVV_CARTAO = "847";

    private static final AsaasFalsa ASAAS = new AsaasFalsa();

    @DynamicPropertySource
    static void configurarAsaas(DynamicPropertyRegistry r) {
        r.add("treinos.pagamentos.asaas.habilitado", () -> "true");
        r.add("treinos.pagamentos.asaas.url-base", ASAAS::url);
        r.add("treinos.pagamentos.asaas.api-key-matriz", () -> CHAVE_MATRIZ);
        r.add("treinos.pagamentos.asaas.url-publica", () -> "https://api.teste.local");
        r.add("treinos.pagamentos.asaas.wallet-matriz", () -> "wal_matriz_onda2");
        r.add("treinos.pagamentos.asaas.wallet-socio", () -> "wal_socio_onda2");
        r.add("treinos.pagamentos.asaas.percentual-socio-bps", () -> "3500");
        r.add("treinos.pagamentos.asaas.conciliacao-ativa", () -> "false");
    }

    @AfterAll
    static void fecharAsaas() {
        ASAAS.close();
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private CifraDePagamento cifra;
    @Autowired private ConciliadorAsaas conciliador;
    @Autowired private ContaLocalRepositorio contasLocais;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID consultoria;
    private String tokenCaminho;
    private String tokenWebhook;
    private ListAppender<ILoggingEvent> log;

    @BeforeEach
    void preparar() throws Exception {
        ASAAS.reiniciar();
        ASAAS.esperaApiKeyMatriz(CHAVE_MATRIZ);
        ASAAS.statusKyc("APPROVED", "APPROVED", null);
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                admin.get("usuario").get("id").asString());

        homologarELigarOvertrainingPay(admin, 6, "TREINADOR");

        Map<String, Object> linha = jdbc.queryForMap(
                "select token_caminho, token_webhook_cifrado from subconta_asaas where consultoria_id = ?", consultoria);
        tokenCaminho = (String) linha.get("token_caminho");
        tokenWebhook = cifra.decifrar(consultoria, (String) linha.get("token_webhook_cifrado"));

        log = new ListAppender<>();
        log.start();
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).addAppender(log);
    }

    @AfterEach
    void limparLog() {
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).detachAppender(log);
    }

    private void homologarELigarOvertrainingPay(JsonNode treinador, int maxParcelas, String juros) throws Exception {
        Map<String, Object> sub = new LinkedHashMap<>();
        sub.put("tipoPessoa", "PF");
        sub.put("documento", "12345678901");
        sub.put("nomeTitular", "Treinador Onda2");
        sub.put("emailFinanceiro", "onda2@teste.local");
        sub.put("telefone", "41999991111");
        sub.put("cep", "80010000");
        sub.put("enderecoResumo", "Av Paulista, 1000 - Bela Vista");
        sub.put("rendaMensalCentavos", 1500000L);
        sub.put("bancoCodigo", "341");
        sub.put("bancoNome", "Itaú");
        sub.put("agencia", "1234");
        sub.put("conta", "12345-6");
        sub.put("tipoConta", "CORRENTE");
        sub.put("repasseAutomatico", true);
        sub.put("maxParcelas", maxParcelas);
        sub.put("jurosParcelamento", juros);
        api.put(ROTA_CONFIG, treinador, sub, 200);

        JsonNode teste = api.post(ROTA_CONFIG + "/cobranca-teste", treinador, Map.of(), 200);
        String cobrancaTesteId = teste.get("cobrancaTesteId").asString();
        ASAAS.marcarPago(cobrancaTesteId);
        api.get(ROTA_CONFIG + "/cobranca-teste/" + cobrancaTesteId, treinador, 200);

        Map<String, Object> formasReq = new LinkedHashMap<>();
        formasReq.put("infinitePay", true);
        formasReq.put("overtrainingPay", true);
        formasReq.put("linkProprio", false);
        formasReq.put("pix", false);
        formasReq.put("manual", true);
        api.put("/financeiro/formas-de-recebimento", treinador, formasReq, 200);
    }

    private UUID criarCobrancaAvulsa(JsonNode treinador, UUID alunoId, long valorCentavos, LocalDate vencimento)
            throws Exception {
        Map<String, Object> req = new LinkedHashMap<>();
        req.put("pedidoId", UUID.randomUUID());
        req.put("alunoIds", List.of(alunoId));
        req.put("descricao", "Avaliação Física");
        req.put("valorCentavos", valorCentavos);
        req.put("primeiroVencimento", vencimento.toString());
        req.put("parcelas", 1);
        api.post("/financeiro/cobrancas-avulsas", treinador, req, 201);
        return jdbc.queryForObject(
                "select id from cobranca_aluno where aluno_id = ? order by criado_em desc limit 1",
                UUID.class, alunoId);
    }

    private void enviarWebhook(String event, String paymentId, String externalRef) throws Exception {
        String corpo = "{\"event\":\"" + event + "\",\"payment\":{\"id\":\"" + paymentId
                + "\",\"externalReference\":\"" + externalRef + "\"}}";
        mvc.perform(MockMvcRequestBuilders.post("/publico/pagamentos/asaas/" + tokenCaminho)
                        .header(AvisoAsaasController.HEADER_TOKEN, tokenWebhook)
                        .contentType("application/json")
                        .content(corpo))
                .andExpect(status().isOk());
    }

    private static Map<String, Object> payloadCartao(String cpfPagador, int parcelas) {
        Map<String, Object> cartao = new LinkedHashMap<>();
        cartao.put("nomeImpresso", "ALUNO TESTE");
        cartao.put("numero", PAN_CARTAO);
        cartao.put("mesValidade", "12");
        cartao.put("anoValidade", "2030");
        cartao.put("cvv", CVV_CARTAO);

        Map<String, Object> titular = new LinkedHashMap<>();
        titular.put("nome", "Aluno Teste");
        titular.put("cpfCnpj", CPF_VALIDO);
        titular.put("cep", "80010000");

        Map<String, Object> body = new LinkedHashMap<>();
        if (cpfPagador != null) {
            body.put("cpfPagador", cpfPagador);
        }
        body.put("parcelas", parcelas);
        body.put("cartao", cartao);
        body.put("titular", titular);
        return body;
    }

    private void nadaVazou(String... segredos) {
        String auditoria = jdbc.queryForObject(
                "select coalesce(string_agg(coalesce(acao,'') || ' ' || coalesce(resumo,'') || ' ' || coalesce(entidade,''), ' '), '') "
                        + "from auditoria where consultoria_id = ?", String.class, consultoria);
        String logado = String.join("\n", log.list.stream().map(ILoggingEvent::getFormattedMessage).toList());
        for (String segredo : segredos) {
            assertThat(auditoria).as("auditoria não vaza " + segredo).doesNotContain(segredo);
            assertThat(logado).as("log não vaza " + segredo).doesNotContain(segredo);
        }
    }

    @Test
    void fluxoCompletoPixCartaoCpfSplitAbaterMensalidadeIsolamentoELgpd() throws Exception {
        // Configura split ABATER_MENSALIDADE (10% até saldo restante de R$ 15,00 = 1500 centavos)
        contasLocais.gravarDireitos(new DireitosLocais(consultoria, UUID.randomUUID(), 1L, "ATIVA", true, null, null,
                "PRO", "Pro", Map.of(), List.of(), Instant.now(), "ABATER_MENSALIDADE", 1000, 1500L, 19900L, null));

        UUID alunoId = api.criarAluno(admin, "Aluno Onda2");
        JsonNode alunoLogin = api.convidarEEntrar(admin, alunoId);
        UUID cobrancaPixId = criarCobrancaAvulsa(admin, alunoId, 20000L, LocalDate.now(Fuso.BRASILIA).plusDays(5));
        UUID cobrancaCartaoId = criarCobrancaAvulsa(admin, alunoId, 30000L, LocalDate.now(Fuso.BRASILIA).plusDays(10));

        // 1. GET /aluno/financeiro expõe campos do Overtraining Pay e cpfPagadorCadastrado=false
        JsonNode fin = api.get("/aluno/financeiro", alunoLogin, 200);
        assertThat(fin.get("overtrainingPayDisponivel").asBoolean()).isTrue();
        assertThat(fin.get("overtrainingPayMaxParcelas").asInt()).isEqualTo(6);
        assertThat(fin.get("overtrainingPayJuros").asString()).isEqualTo("TREINADOR");
        assertThat(fin.get("cpfPagadorCadastrado").asBoolean()).isFalse();

        // 2. Sem CPF cadastrado nem informado -> 422 no campo cpfPagador
        JsonNode erroCpf = api.post("/aluno/financeiro/cobrancas/" + cobrancaPixId + "/overtraining-pay/pix",
                alunoLogin, Map.of(), 422);
        assertThat(erroCpf.get("codigo").asString()).isEqualTo("CPF_OBRIGATORIO");

        // 3. Gera Pix informando cpfPagador válido -> 200 com QR Code e copia e cola + split ABATER_MENSALIDADE
        JsonNode pix = api.post("/aluno/financeiro/cobrancas/" + cobrancaPixId + "/overtraining-pay/pix",
                alunoLogin, Map.of("cpfPagador", CPF_VALIDO), 200);
        String pixPaymentId = pix.get("asaasCobrancaId").asString();
        assertThat(pix.get("cobrancaId").asString()).isEqualTo(cobrancaPixId.toString());
        assertThat(pix.get("valorCentavos").asLong()).isEqualTo(20000L);
        assertThat(pix.get("qrCodeBase64").asString()).isNotBlank();
        assertThat(pix.get("codigoCopiaECola").asString()).contains("br.gov.bcb.pix");

        // Verifica que split enviado ao Asaas respeitou teto de 1500 centavos (9.75 matriz + 5.25 sócio)
        AsaasFalsa.Requisicao reqPix = ASAAS.requisicoes("/payments").getLast();
        JsonNode splitArray = reqPix.corpo().path("split");
        assertThat(splitArray.isArray()).isTrue();
        assertThat(splitArray.size()).isEqualTo(2);
        assertThat(splitArray.get(0).path("walletId").asString()).isEqualTo("wal_matriz_onda2");
        assertThat(splitArray.get(0).path("fixedValue").decimalValue()).isEqualByComparingTo("9.75");
        assertThat(splitArray.get(1).path("walletId").asString()).isEqualTo("wal_socio_onda2");
        assertThat(splitArray.get(1).path("fixedValue").decimalValue()).isEqualByComparingTo("5.25");

        // Situação ainda ABERTA
        JsonNode sitAntes = api.get("/aluno/financeiro/cobrancas/" + cobrancaPixId + "/situacao", alunoLogin, 200);
        assertThat(sitAntes.get("situacao").asString()).isEqualTo("ABERTA");

        // 4. Webhook PAYMENT_RECEIVED + ConciliadorAsaas dá baixa automática e preenche valor_liquido_centavos
        ASAAS.marcarPago(pixPaymentId);
        enviarWebhook("PAYMENT_RECEIVED", pixPaymentId, cobrancaPixId.toString());
        assertThat(conciliador.processarPendentes()).isGreaterThanOrEqualTo(1);

        JsonNode sitDepois = api.get("/aluno/financeiro/cobrancas/" + cobrancaPixId + "/situacao", alunoLogin, 200);
        assertThat(sitDepois.get("situacao").asString()).isEqualTo("PAGA");
        assertThat(sitDepois.get("pagoEm").isNull()).isFalse();
        Map<String, Object> rowPix = jdbc.queryForMap(
                "select provedor, forma, id_externo, asaas_cobranca_id, valor_liquido_centavos from cobranca_aluno where id = ?",
                cobrancaPixId);
        assertThat(rowPix.get("provedor")).isEqualTo(ProvedorAsaas.CODIGO);
        assertThat(rowPix.get("forma")).isEqualTo("PIX");
        assertThat(rowPix.get("id_externo")).isEqualTo(pixPaymentId);
        assertThat(rowPix.get("asaas_cobranca_id")).isEqualTo(pixPaymentId);
        assertThat(((Number) rowPix.get("valor_liquido_centavos")).longValue()).isEqualTo(19901L);

        // 5. Cartão: parcelas acima de maxParcelas (6) dá 422; dentro do limite (3x) confirma e dá baixa imediata!
        api.post("/aluno/financeiro/cobrancas/" + cobrancaCartaoId + "/overtraining-pay/cartao",
                alunoLogin, payloadCartao(null, 7), 422);

        JsonNode cartaoResp = api.post("/aluno/financeiro/cobrancas/" + cobrancaCartaoId + "/overtraining-pay/cartao",
                alunoLogin, payloadCartao(null, 3), 200);
        assertThat(cartaoResp.get("situacao").asString()).isEqualTo("PAGA");
        assertThat(cartaoResp.get("pagoEm").isNull()).isFalse();

        // 6. Isolamento: outro aluno da mesma consultoria e aluno de outra consultoria tomam 404
        UUID outroAlunoId = api.criarAluno(admin, "Outro Aluno");
        JsonNode outroAlunoLogin = api.convidarEEntrar(admin, outroAlunoId);
        api.get("/aluno/financeiro/cobrancas/" + cobrancaPixId + "/situacao", outroAlunoLogin, 404);
        api.post("/aluno/financeiro/cobrancas/" + cobrancaPixId + "/overtraining-pay/pix", outroAlunoLogin,
                Map.of("cpfPagador", CPF_VALIDO), 404);

        JsonNode outroTreinador = api.novoTreinador();
        UUID alunoOutraConsultoria = api.criarAluno(outroTreinador, "Aluno Outra");
        JsonNode loginOutraConsultoria = api.convidarEEntrar(outroTreinador, alunoOutraConsultoria);
        api.get("/aluno/financeiro/cobrancas/" + cobrancaPixId + "/situacao", loginOutraConsultoria, 404);

        // 7. LGPD: anonimizar aluno remove cliente_asaas_aluno preservando cobranças pagas!
        assertThat(jdbc.queryForObject("select count(*) from cliente_asaas_aluno where aluno_id = ?",
                Integer.class, alunoId)).isEqualTo(1);
        api.patch("/alunos/" + alunoId + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + alunoId + "/anonimizar", admin, Map.of("nomeConfirmado", "Aluno Onda2"), 200);
        assertThat(jdbc.queryForObject("select count(*) from cliente_asaas_aluno where aluno_id = ?",
                Integer.class, alunoId)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from cobranca_aluno where aluno_id = ? and situacao = 'PAGA'",
                Integer.class, alunoId)).isEqualTo(2);

        // 8. Zero vazamento de PAN, CVV, CPF ou chaves nos logs e auditoria
        nadaVazou(PAN_CARTAO, CVV_CARTAO, CPF_VALIDO, CHAVE_MATRIZ, tokenWebhook, "$aact_fake");
        assertThat(ASAAS.violacoes()).isEmpty();
    }

    @Test
    void contratoFechadoVencidoValorDivergenteParaConferirEEstornoInformado() throws Exception {
        UUID alunoId = api.criarAluno(admin, "Aluno Contrato");
        JsonNode alunoLogin = api.convidarEEntrar(admin, alunoId);

        // Cria plano comercial e contratação em Contrato Fechado (V098) com 1 parcela vencida e 1 a vencer
        JsonNode plano = api.post("/financeiro/planos", admin, Map.of(
                "nome", "Consultoria Trimestral",
                "valorCentavos", 60000L,
                "periodicidade", "TRIMESTRAL"), 200);
        UUID planoId = UUID.fromString(plano.get("id").asString());

        Map<String, Object> contratar = new LinkedHashMap<>();
        contratar.put("planoComercialId", planoId);
        contratar.put("inicio", LocalDate.now(Fuso.BRASILIA).minusDays(20).toString());
        contratar.put("modoCobranca", "PARCELADO_FIXO");
        contratar.put("valorTotalCentavos", 60000L);
        contratar.put("parcelas", List.of(
                Map.of("vencimento", LocalDate.now(Fuso.BRASILIA).minusDays(5).toString(), "valorCentavos", 30000L),
                Map.of("vencimento", LocalDate.now(Fuso.BRASILIA).plusDays(25).toString(), "valorCentavos", 30000L)));
        api.post("/alunos/" + alunoId + "/contratacoes", admin, contratar, 200);

        List<UUID> parcelas = jdbc.queryForList(
                "select id from cobranca_aluno where aluno_id = ? order by vencimento asc", UUID.class, alunoId);
        assertThat(parcelas).hasSize(2);
        UUID parcelaVencidaId = parcelas.get(0);
        UUID parcelaFuturaId = parcelas.get(1);

        // 1. Parcela vencida de Contrato Fechado aceita Pix Overtraining Pay e baixa via webhook + conciliador
        JsonNode pixVencida = api.post("/aluno/financeiro/cobrancas/" + parcelaVencidaId + "/overtraining-pay/pix",
                alunoLogin, Map.of("cpfPagador", CPF_VALIDO), 200);
        String payVencidaId = pixVencida.get("asaasCobrancaId").asString();
        ASAAS.marcarPago(payVencidaId);
        enviarWebhook("PAYMENT_RECEIVED", payVencidaId, parcelaVencidaId.toString());
        assertThat(conciliador.processarPendentes()).isGreaterThanOrEqualTo(1);
        assertThat(jdbc.queryForObject("select situacao from cobranca_aluno where id = ?",
                String.class, parcelaVencidaId)).isEqualTo("PAGA");

        // 2. Estorno informado (PAYMENT_REFUNDED) NÃO apaga histórico pago: vai para CONFERIR/ESTORNO_INFORMADO
        enviarWebhook("PAYMENT_REFUNDED", payVencidaId, parcelaVencidaId.toString());
        assertThat(jdbc.queryForObject("select situacao from cobranca_aluno where id = ?",
                String.class, parcelaVencidaId)).isEqualTo("PAGA");
        Map<String, Object> avisoEstorno = jdbc.queryForMap(
                "select situacao, motivo from aviso_de_pagamento where consultoria_id = ? and transacao = ?",
                consultoria, payVencidaId);
        assertThat(avisoEstorno.get("situacao")).isEqualTo("CONFERIR");
        assertThat(avisoEstorno.get("motivo")).isEqualTo(AvisoDePagamentoRepositorio.ESTORNO_INFORMADO);

        // 3. Valor divergente no Asaas vai para Para conferir (VALOR_DIFERENTE) e NUNCA dá baixa sozinho!
        JsonNode pixDivergente = api.post("/aluno/financeiro/cobrancas/" + parcelaFuturaId + "/overtraining-pay/pix",
                alunoLogin, Map.of(), 200);
        String payDivergenteId = pixDivergente.get("asaasCobrancaId").asString();
        ASAAS.alterarValor(payDivergenteId, new BigDecimal("250.00")); // cobrança é 300.00
        ASAAS.marcarPago(payDivergenteId);
        enviarWebhook("PAYMENT_RECEIVED", payDivergenteId, parcelaFuturaId.toString());
        assertThat(conciliador.processarPendentes()).isGreaterThanOrEqualTo(1);

        assertThat(jdbc.queryForObject("select situacao from cobranca_aluno where id = ?",
                String.class, parcelaFuturaId)).isEqualTo("ABERTA");
        Map<String, Object> avisoDivergente = jdbc.queryForMap(
                "select situacao, motivo from aviso_de_pagamento where consultoria_id = ? and transacao = ?",
                consultoria, payDivergenteId);
        assertThat(avisoDivergente.get("situacao")).isEqualTo("CONFERIR");
        assertThat(avisoDivergente.get("motivo")).isEqualTo("VALOR_DIFERENTE");
        assertThat(ASAAS.violacoes()).isEmpty();
    }

    @Test
    void alunoPausadoPorAtrasoPagaNoCheckoutTransparenteEReativaAutomaticamente() throws Exception {
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

        // Cenário 1: aluno pausado com duas vencidas — paga 1ª via Pix/webhook (segue pausado) e 2ª via Cartão (reativa)
        UUID alunoId = api.criarAluno(admin, "Aluno Pausado Pay");
        JsonNode alunoLogin = api.convidarEEntrar(admin, alunoId);
        UUID cobrancaPixId = criarCobrancaAvulsa(admin, alunoId, 15000L, hoje.minusDays(10));
        UUID cobrancaCartaoId = criarCobrancaAvulsa(admin, alunoId, 20000L, hoje.minusDays(5));

        api.post("/alunos/" + alunoId + "/pausar-acesso", admin, null, 200);
        assertThat(api.get("/eu", alunoLogin, 200).get("acessoPausado").asBoolean()).isTrue();
        assertThat(api.get("/aluno/painel", alunoLogin, 403).get("codigo").asString())
                .isEqualTo("ACESSO_PAUSADO_POR_ATRASO");

        // Whitelist libera /overtraining-pay/pix e /situacao para aluno pausado
        JsonNode pix = api.post("/aluno/financeiro/cobrancas/" + cobrancaPixId + "/overtraining-pay/pix",
                alunoLogin, Map.of("cpfPagador", CPF_VALIDO), 200);
        String pixPaymentId = pix.get("asaasCobrancaId").asString();
        assertThat(api.get("/aluno/financeiro/cobrancas/" + cobrancaPixId + "/situacao", alunoLogin, 200)
                .get("situacao").asString()).isEqualTo("ABERTA");

        ASAAS.marcarPago(pixPaymentId);
        enviarWebhook("PAYMENT_RECEIVED", pixPaymentId, cobrancaPixId.toString());
        assertThat(conciliador.processarPendentes()).isGreaterThanOrEqualTo(1);
        assertThat(api.get("/aluno/financeiro/cobrancas/" + cobrancaPixId + "/situacao", alunoLogin, 200)
                .get("situacao").asString()).isEqualTo("PAGA");

        // Ainda tem uma cobrança vencida em aberto -> continua pausado
        assertThat(api.get("/eu", alunoLogin, 200).get("acessoPausado").asBoolean()).isTrue();
        assertThat(api.get("/aluno/painel", alunoLogin, 403).get("codigo").asString())
                .isEqualTo("ACESSO_PAUSADO_POR_ATRASO");

        // Whitelist libera /overtraining-pay/cartao -> quita última vencida e reativa automaticamente na hora
        JsonNode cartao = api.post("/aluno/financeiro/cobrancas/" + cobrancaCartaoId + "/overtraining-pay/cartao",
                alunoLogin, payloadCartao(null, 2), 200);
        assertThat(cartao.get("situacao").asString()).isEqualTo("PAGA");
        assertThat(api.get("/eu", alunoLogin, 200).get("acessoPausado").asBoolean()).isFalse();
        api.get("/aluno/painel", alunoLogin, 200);
        assertThat(jdbc.queryForObject(
                "select count(*) from auditoria where consultoria_id = ? and acao = 'ALUNO_ACESSO_REATIVADO_AUTOMATICAMENTE' "
                        + "and entidade_id = ? and usuario_id is null",
                Integer.class, consultoria, alunoId)).isEqualTo(1);

        // Cenário 2: aluno pausado com uma vencida — quitação por webhook Pix Asaas reativa automaticamente
        UUID alunoWebhookId = api.criarAluno(admin, "Aluno Pausado Pix");
        JsonNode alunoWebhookLogin = api.convidarEEntrar(admin, alunoWebhookId);
        UUID cobrancaUnicaId = criarCobrancaAvulsa(admin, alunoWebhookId, 18000L, hoje.minusDays(7));
        api.post("/alunos/" + alunoWebhookId + "/pausar-acesso", admin, null, 200);
        assertThat(api.get("/aluno/painel", alunoWebhookLogin, 403).get("codigo").asString())
                .isEqualTo("ACESSO_PAUSADO_POR_ATRASO");

        JsonNode pixUnico = api.post("/aluno/financeiro/cobrancas/" + cobrancaUnicaId + "/overtraining-pay/pix",
                alunoWebhookLogin, Map.of("cpfPagador", CPF_VALIDO), 200);
        String pixUnicoId = pixUnico.get("asaasCobrancaId").asString();
        ASAAS.marcarPago(pixUnicoId);
        enviarWebhook("PAYMENT_RECEIVED", pixUnicoId, cobrancaUnicaId.toString());
        assertThat(conciliador.processarPendentes()).isGreaterThanOrEqualTo(1);

        assertThat(api.get("/eu", alunoWebhookLogin, 200).get("acessoPausado").asBoolean()).isFalse();
        api.get("/aluno/painel", alunoWebhookLogin, 200);
        assertThat(jdbc.queryForObject(
                "select count(*) from auditoria where consultoria_id = ? and acao = 'ALUNO_ACESSO_REATIVADO_AUTOMATICAMENTE' "
                        + "and entidade_id = ? and usuario_id is null",
                Integer.class, consultoria, alunoWebhookId)).isEqualTo(1);
    }
}
