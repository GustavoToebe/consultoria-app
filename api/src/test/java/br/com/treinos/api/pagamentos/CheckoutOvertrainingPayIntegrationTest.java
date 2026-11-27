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
 * Fluxo completo do checkout do aluno no Overtraining Pay (Asaas):
 * {@code GET /aluno/financeiro}, Pix dentro do app, fatura do Asaas (cartão na página dele, uma só cobrança por
 * {@code cobranca_aluno}), pedido de CPF quando ausente, baixa via webhook + {@link ConciliadorAsaas}, Contrato Fechado
 * (V098), valor divergente -> Para conferir, estorno -> ESTORNO_INFORMADO, split {@code ABATER_MENSALIDADE},
 * isolamento multi-tenant/aluno (404), anonimização LGPD, pausa por atraso x MANUAL e zero vazamento de CPF, chaves e
 * URL da fatura em logs e auditoria. Nenhuma rota recebe dado de cartão.
 */
@AutoConfigureMockMvc
class CheckoutOvertrainingPayIntegrationTest extends AbstractIntegrationTest {

    private static final String ROTA_CONFIG = "/financeiro/overtraining-pay";
    private static final String CHAVE_MATRIZ = "chave-matriz-checkout-onda2-teste";
    private static final String CPF_VALIDO = "52998224725";

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
    @Autowired private CancelamentoDeCobrancaAsaas cancelamentos;
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

        homologarELigarOvertrainingPay(admin);

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

    private void homologarELigarOvertrainingPay(JsonNode treinador) throws Exception {
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

    private static String urlDaFatura(JsonNode resposta) {
        return resposta.get("url").asString();
    }

    private int postsEmPayments() {
        return (int) ASAAS.requisicoes("/payments").stream().filter(r -> "POST".equals(r.metodo())).count();
    }

    private String motivoDaPausaNoEu(JsonNode login) throws Exception {
        JsonNode m = api.get("/eu", login, 200).path("aluno").path("acessoDesativadoMotivo");
        return m.isNull() || m.isMissingNode() ? null : m.asString();
    }

    private int eventos(String acao, UUID alunoId) {
        return jdbc.queryForObject(
                "select count(*) from auditoria where consultoria_id = ? and acao = ? and entidade_id = ?",
                Integer.class, consultoria, acao, alunoId);
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
    void fluxoCompletoPixFaturaCpfSplitAbaterMensalidadeIsolamentoELgpd() throws Exception {
        // Split TAXA_PLATAFORMA de 10% (ABATER_MENSALIDADE não retém nada enquanto não houver a retenção gravada, B2)
        contasLocais.gravarDireitos(new DireitosLocais(consultoria, UUID.randomUUID(), 1L, "ATIVA", true, null, null,
                "PRO", "Pro", Map.of(), List.of(), Instant.now(), "TAXA_PLATAFORMA", 1000, 0L, 19900L, null));

        UUID alunoId = api.criarAluno(admin, "Aluno Onda2");
        JsonNode alunoLogin = api.convidarEEntrar(admin, alunoId);
        UUID cobrancaPixId = criarCobrancaAvulsa(admin, alunoId, 20000L, LocalDate.now(Fuso.BRASILIA).plusDays(5));
        UUID cobrancaCartaoId = criarCobrancaAvulsa(admin, alunoId, 30000L, LocalDate.now(Fuso.BRASILIA).plusDays(10));

        // 0. Sem CPF cadastrado a fatura também pede o do pagador, e nenhuma cobrança nasce no Asaas
        int postsDaHomologacao = postsEmPayments();
        api.post("/aluno/financeiro/cobrancas/" + cobrancaCartaoId + "/overtraining-pay/fatura", alunoLogin, null, 422);
        assertThat(postsEmPayments()).isEqualTo(postsDaHomologacao);

        // 1. GET /aluno/financeiro expõe campos do Overtraining Pay e cpfPagadorCadastrado=false
        JsonNode fin = api.get("/aluno/financeiro", alunoLogin, 200);
        assertThat(fin.get("overtrainingPayDisponivel").asBoolean()).isTrue();
        // Parcelas e juros saíram do contrato do aluno (o parcelamento é decidido na página do Asaas).
        assertThat(fin.has("overtrainingPayMaxParcelas")).isFalse();
        assertThat(fin.has("overtrainingPayJuros")).isFalse();
        assertThat(fin.get("cpfPagadorCadastrado").asBoolean()).isFalse();

        // 2. Sem CPF cadastrado nem informado -> 422 no campo cpfPagador
        JsonNode erroCpf = api.post("/aluno/financeiro/cobrancas/" + cobrancaPixId + "/overtraining-pay/pix",
                alunoLogin, Map.of(), 422);
        assertThat(erroCpf.get("codigo").asString()).isEqualTo("CPF_OBRIGATORIO");

        // 3. Gera Pix informando cpfPagador válido -> 200 com QR Code e copia e cola + split de 10% (matriz 65% e sócio 35%)
        JsonNode pix = api.post("/aluno/financeiro/cobrancas/" + cobrancaPixId + "/overtraining-pay/pix",
                alunoLogin, Map.of("cpfPagador", CPF_VALIDO), 200);
        String pixPaymentId = pix.get("asaasCobrancaId").asString();
        assertThat(pix.get("cobrancaId").asString()).isEqualTo(cobrancaPixId.toString());
        assertThat(pix.get("valorCentavos").asLong()).isEqualTo(20000L);
        assertThat(pix.get("qrCodeBase64").asString()).isNotBlank();
        assertThat(pix.get("codigoCopiaECola").asString()).contains("br.gov.bcb.pix");

        // Split enviado ao Asaas: 10% de R$ 200,00 = R$ 20,00 (13.00 matriz + 7.00 sócio)
        AsaasFalsa.Requisicao reqPix = ASAAS.requisicoes("/payments").getLast();
        JsonNode splitArray = reqPix.corpo().path("split");
        assertThat(splitArray.isArray()).isTrue();
        assertThat(splitArray.size()).isEqualTo(2);
        assertThat(splitArray.get(0).path("walletId").asString()).isEqualTo("wal_matriz_onda2");
        assertThat(splitArray.get(0).path("fixedValue").decimalValue()).isEqualByComparingTo("13.00");
        assertThat(splitArray.get(1).path("walletId").asString()).isEqualTo("wal_socio_onda2");
        assertThat(splitArray.get(1).path("fixedValue").decimalValue()).isEqualByComparingTo("7.00");

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

        // 5. Fatura do Asaas (cartão na página dele): cria UMA cobrança UNDEFINED, sem dado de cartão; o corpo não
        //    escolhe valor nem carteira e o split sai do servidor, igual ao do Pix
        int postsAntes = postsEmPayments();
        Map<String, Object> corpoMalicioso = new LinkedHashMap<>();
        corpoMalicioso.put("valorCentavos", 1);
        corpoMalicioso.put("walletId", "wal_do_atacante");
        corpoMalicioso.put("cartao", Map.of("numero", "5123456789012346", "cvv", "847"));
        JsonNode fatura = api.post("/aluno/financeiro/cobrancas/" + cobrancaCartaoId + "/overtraining-pay/fatura",
                alunoLogin, corpoMalicioso, 200);
        String urlFatura = urlDaFatura(fatura);
        assertThat(postsEmPayments()).isEqualTo(postsAntes + 1);
        AsaasFalsa.Requisicao reqFatura = ASAAS.requisicoes("/payments").getLast();
        assertThat(reqFatura.corpo().path("billingType").asString()).isEqualTo("UNDEFINED");
        assertThat(reqFatura.corpo().path("value").decimalValue()).isEqualByComparingTo("300.00");
        assertThat(reqFatura.corpo().has("creditCard")).isFalse();
        assertThat(reqFatura.corpo().toString()).doesNotContain("wal_do_atacante").doesNotContain("5123456789012346");
        assertThat(reqFatura.corpo().path("externalReference").asString()).isEqualTo(cobrancaCartaoId.toString());
        String fPaymentId = jdbc.queryForObject("select asaas_cobranca_id from cobranca_aluno where id = ?",
                String.class, cobrancaCartaoId);
        assertThat(urlFatura).isEqualTo("https://sandbox.asaas.com/i/" + fPaymentId);
        assertThat(reqFatura.corpo().path("split").isArray()).isTrue();

        // Idempotente: outra chamada devolve a mesma fatura sem criar outra cobrança; o Pix depois dela é da mesma cobrança
        JsonNode faturaDeNovo = api.post("/aluno/financeiro/cobrancas/" + cobrancaCartaoId + "/overtraining-pay/fatura",
                alunoLogin, null, 200);
        assertThat(urlDaFatura(faturaDeNovo)).isEqualTo(urlFatura);
        JsonNode pixDaFatura = api.post("/aluno/financeiro/cobrancas/" + cobrancaCartaoId + "/overtraining-pay/pix",
                alunoLogin, Map.of(), 200);
        assertThat(pixDaFatura.get("asaasCobrancaId").asString()).isEqualTo(fPaymentId);
        assertThat(pixDaFatura.get("codigoCopiaECola").asString()).contains("br.gov.bcb.pix");
        assertThat(postsEmPayments()).isEqualTo(postsAntes + 1);

        // Pago com cartão na página do Asaas: webhook + conciliador dão a baixa com a forma CARTAO
        ASAAS.marcarPagoNoCartao(fPaymentId);
        enviarWebhook("PAYMENT_RECEIVED", fPaymentId, cobrancaCartaoId.toString());
        assertThat(conciliador.processarPendentes()).isGreaterThanOrEqualTo(1);
        Map<String, Object> rowCartao = jdbc.queryForMap(
                "select situacao, provedor, forma, id_externo from cobranca_aluno where id = ?", cobrancaCartaoId);
        assertThat(rowCartao.get("situacao")).isEqualTo("PAGA");
        assertThat(rowCartao.get("provedor")).isEqualTo(ProvedorAsaas.CODIGO);
        assertThat(rowCartao.get("forma")).isEqualTo("CARTAO");
        assertThat(rowCartao.get("id_externo")).isEqualTo(fPaymentId);

        // Cobrança já paga: nada de fatura nova (409) e a rota de cartão do app não existe mais
        api.post("/aluno/financeiro/cobrancas/" + cobrancaCartaoId + "/overtraining-pay/fatura", alunoLogin, null, 409);
        api.post("/aluno/financeiro/cobrancas/" + cobrancaCartaoId + "/overtraining-pay/cartao", alunoLogin,
                Map.of("parcelas", 1), 404);

        // 6. Isolamento: outro aluno da mesma consultoria e aluno de outra consultoria tomam 404
        UUID outroAlunoId = api.criarAluno(admin, "Outro Aluno");
        JsonNode outroAlunoLogin = api.convidarEEntrar(admin, outroAlunoId);
        api.get("/aluno/financeiro/cobrancas/" + cobrancaPixId + "/situacao", outroAlunoLogin, 404);
        api.post("/aluno/financeiro/cobrancas/" + cobrancaPixId + "/overtraining-pay/pix", outroAlunoLogin,
                Map.of("cpfPagador", CPF_VALIDO), 404);
        api.post("/aluno/financeiro/cobrancas/" + cobrancaPixId + "/overtraining-pay/fatura", outroAlunoLogin,
                Map.of("cpfPagador", CPF_VALIDO), 404);

        JsonNode outroTreinador = api.novoTreinador();
        UUID alunoOutraConsultoria = api.criarAluno(outroTreinador, "Aluno Outra");
        JsonNode loginOutraConsultoria = api.convidarEEntrar(outroTreinador, alunoOutraConsultoria);
        api.get("/aluno/financeiro/cobrancas/" + cobrancaPixId + "/situacao", loginOutraConsultoria, 404);
        api.post("/aluno/financeiro/cobrancas/" + cobrancaPixId + "/overtraining-pay/fatura", loginOutraConsultoria,
                null, 404);

        // 7. LGPD: anonimizar aluno remove cliente_asaas_aluno preservando cobranças pagas!
        assertThat(jdbc.queryForObject("select count(*) from cliente_asaas_aluno where aluno_id = ?",
                Integer.class, alunoId)).isEqualTo(1);
        api.patch("/alunos/" + alunoId + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + alunoId + "/anonimizar", admin, Map.of("nomeConfirmado", "Aluno Onda2"), 200);
        assertThat(jdbc.queryForObject("select count(*) from cliente_asaas_aluno where aluno_id = ?",
                Integer.class, alunoId)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from cobranca_aluno where aluno_id = ? and situacao = 'PAGA'",
                Integer.class, alunoId)).isEqualTo(2);

        // 8. Zero vazamento de CPF, chaves ou URL da fatura nos logs e auditoria
        nadaVazou(CPF_VALIDO, CHAVE_MATRIZ, tokenWebhook, "$aact_fake", urlFatura);
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
    void alunoPausadoPorAtrasoPagaPeloPixEPelaFaturaEReativaAutomaticamente() throws Exception {
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

        // Cenário 1: aluno pausado com duas vencidas: paga a 1ª pelo Pix (segue pausado) e a 2ª pela fatura (reativa)
        UUID alunoId = api.criarAluno(admin, "Aluno Pausado Pay");
        JsonNode alunoLogin = api.convidarEEntrar(admin, alunoId);
        UUID cobrancaPixId = criarCobrancaAvulsa(admin, alunoId, 15000L, hoje.minusDays(10));
        UUID cobrancaFaturaId = criarCobrancaAvulsa(admin, alunoId, 20000L, hoje.minusDays(5));

        api.post("/alunos/" + alunoId + "/pausar-acesso", admin, null, 200);
        assertThat(motivoDaPausaNoEu(alunoLogin)).isEqualTo("ATRASO");
        assertThat(api.get("/aluno/painel", alunoLogin, 403).get("codigo").asString())
                .isEqualTo("ACESSO_PAUSADO_POR_ATRASO");

        // Lista fechada libera /overtraining-pay/pix e /situacao para o aluno pausado
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
        assertThat(motivoDaPausaNoEu(alunoLogin)).isEqualTo("ATRASO");
        assertThat(api.get("/aluno/painel", alunoLogin, 403).get("codigo").asString())
                .isEqualTo("ACESSO_PAUSADO_POR_ATRASO");

        // Lista fechada libera /overtraining-pay/fatura -> cartão na página do Asaas quita a última vencida e reativa
        JsonNode fatura = api.post("/aluno/financeiro/cobrancas/" + cobrancaFaturaId + "/overtraining-pay/fatura",
                alunoLogin, null, 200);
        assertThat(urlDaFatura(fatura)).startsWith("https://sandbox.asaas.com/i/");
        String faturaPaymentId = jdbc.queryForObject("select asaas_cobranca_id from cobranca_aluno where id = ?",
                String.class, cobrancaFaturaId);
        ASAAS.marcarPagoNoCartao(faturaPaymentId);
        enviarWebhook("PAYMENT_RECEIVED", faturaPaymentId, cobrancaFaturaId.toString());
        assertThat(conciliador.processarPendentes()).isGreaterThanOrEqualTo(1);

        assertThat(jdbc.queryForObject("select forma from cobranca_aluno where id = ?", String.class, cobrancaFaturaId))
                .isEqualTo("CARTAO");
        assertThat(motivoDaPausaNoEu(alunoLogin)).isNull();
        api.get("/aluno/painel", alunoLogin, 200);
        assertThat(jdbc.queryForObject(
                "select count(*) from auditoria where consultoria_id = ? and acao = 'ALUNO_ACESSO_REATIVADO_AUTOMATICAMENTE' "
                        + "and entidade_id = ? and usuario_id is null",
                Integer.class, consultoria, alunoId)).isEqualTo(1);

        // Cenário 2: aluno pausado com uma vencida: quitação por webhook Pix Asaas reativa automaticamente
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

        assertThat(motivoDaPausaNoEu(alunoWebhookLogin)).isNull();
        api.get("/aluno/painel", alunoWebhookLogin, 200);
        assertThat(eventos("ALUNO_ACESSO_REATIVADO_AUTOMATICAMENTE", alunoWebhookId)).isEqualTo(1);
    }

    /** A baixa do Asaas passa por {@code BaixaDeCobranca.baixarDoProvedor}: só o ATRASO é reativado; o MANUAL fica como está. */
    @Test
    void baixaPeloAsaasReativaSoOAtrasoENuncaOManual() throws Exception {
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

        // ATRASO com a última vencida quitada pelo Asaas: reativa (motivo e data saem, usuário segue ativo)
        UUID alunoAtrasoId = api.criarAluno(admin, "Aluno Asaas Atraso");
        JsonNode atrasoLogin = api.convidarEEntrar(admin, alunoAtrasoId);
        UUID cobrancaAtrasoId = criarCobrancaAvulsa(admin, alunoAtrasoId, 15000L, hoje.minusDays(8));
        api.post("/alunos/" + alunoAtrasoId + "/pausar-acesso", admin, null, 200);
        api.post("/aluno/financeiro/cobrancas/" + cobrancaAtrasoId + "/overtraining-pay/fatura", atrasoLogin,
                Map.of("cpfPagador", CPF_VALIDO), 200);
        String pagamentoAtraso = jdbc.queryForObject("select asaas_cobranca_id from cobranca_aluno where id = ?",
                String.class, cobrancaAtrasoId);
        ASAAS.marcarPagoNoCartao(pagamentoAtraso);
        enviarWebhook("PAYMENT_RECEIVED", pagamentoAtraso, cobrancaAtrasoId.toString());
        assertThat(conciliador.processarPendentes()).isGreaterThanOrEqualTo(1);

        assertThat(motivoNoBanco(alunoAtrasoId)).isNull();
        assertThat(jdbc.queryForObject("select acesso_desativado_em from aluno where id = ?", Object.class,
                alunoAtrasoId)).isNull();
        assertThat(eventos("ALUNO_ACESSO_REATIVADO_AUTOMATICAMENTE", alunoAtrasoId)).isEqualTo(1);

        // MANUAL com a vencida quitada pelo Asaas: a cobrança é baixada, mas o acesso não é reativado nem alterado
        UUID alunoManualId = api.criarAluno(admin, "Aluno Asaas Manual");
        JsonNode manualLogin = api.convidarEEntrar(admin, alunoManualId);
        UUID cobrancaManualId = criarCobrancaAvulsa(admin, alunoManualId, 15000L, hoje.minusDays(8));
        api.post("/aluno/financeiro/cobrancas/" + cobrancaManualId + "/overtraining-pay/fatura", manualLogin,
                Map.of("cpfPagador", CPF_VALIDO), 200);
        String pagamentoManual = jdbc.queryForObject("select asaas_cobranca_id from cobranca_aluno where id = ?",
                String.class, cobrancaManualId);
        // desativar derruba as sessões do aluno: a fatura já foi gerada antes
        api.post("/alunos/" + alunoManualId + "/acesso/desativar", admin, Map.of("motivo", "MANUAL"), 200);
        Object emAntes = jdbc.queryForObject("select acesso_desativado_em from aluno where id = ?", Object.class,
                alunoManualId);

        ASAAS.marcarPagoNoCartao(pagamentoManual);
        enviarWebhook("PAYMENT_RECEIVED", pagamentoManual, cobrancaManualId.toString());
        assertThat(conciliador.processarPendentes()).isGreaterThanOrEqualTo(1);

        assertThat(jdbc.queryForObject("select situacao from cobranca_aluno where id = ?", String.class,
                cobrancaManualId)).isEqualTo("PAGA");
        assertThat(motivoNoBanco(alunoManualId)).isEqualTo("MANUAL");
        assertThat(jdbc.queryForObject("select acesso_desativado_em from aluno where id = ?", Object.class,
                alunoManualId)).isEqualTo(emAntes);
        assertThat(jdbc.queryForObject(
                "select u.ativo from usuario u join aluno a on a.usuario_id = u.id where a.id = ?", Boolean.class,
                alunoManualId)).isFalse();
        assertThat(eventos("ALUNO_ACESSO_REATIVADO_AUTOMATICAMENTE", alunoManualId)).isZero();
        assertThat(ASAAS.violacoes()).isEmpty();
    }

    private String motivoNoBanco(UUID alunoId) {
        return jdbc.queryForObject("select acesso_desativado_motivo from aluno where id = ?", String.class, alunoId);
    }

    // ---- rodada "antes de ligar": cobrança órfã, boleto, estorno parcial, chargeback, limpeza da subconta ----

    private String gerarPix(JsonNode alunoLogin, UUID cobrancaId) throws Exception {
        return api.post("/aluno/financeiro/cobrancas/" + cobrancaId + "/overtraining-pay/pix", alunoLogin,
                Map.of("cpfPagador", CPF_VALIDO), 200).get("asaasCobrancaId").asString();
    }

    private String asaasIdNoBanco(UUID cobrancaId) {
        return jdbc.queryForObject("select asaas_cobranca_id from cobranca_aluno where id = ?", String.class, cobrancaId);
    }

    private int naFila(String asaasId) {
        return jdbc.queryForObject("select count(*) from cancelamento_asaas_pendente where consultoria_id = ? "
                + "and asaas_cobranca_id = ?", Integer.class, consultoria, asaasId);
    }

    private long versaoDaCobranca(UUID cobrancaId) {
        return jdbc.queryForObject("select versao from cobranca_aluno where id = ?", Long.class, cobrancaId);
    }

    private JsonNode contratarMensal(UUID alunoId, long valorCentavos) throws Exception {
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        JsonNode plano = api.post("/financeiro/planos", admin, Map.of("nome", "Plano órfã " + UUID.randomUUID(),
                "valorCentavos", valorCentavos, "periodicidade", "MENSAL"), 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("planoComercialId", plano.get("id").asString());
        corpo.put("inicio", hoje.toString());
        corpo.put("diaVencimento", hoje.getDayOfMonth());
        return api.post("/alunos/" + alunoId + "/contratacoes", admin, corpo, 200);
    }

    @Test
    void reajusteDoValorCancelaNoAsaasACobrancaAnteriorSemHttpNaTransacao() throws Exception {
        UUID alunoId = api.criarAluno(admin, "Aluno Reajuste Asaas");
        JsonNode alunoLogin = api.convidarEEntrar(admin, alunoId);
        JsonNode contratacao = contratarMensal(alunoId, 10000L);
        UUID cobrancaId = jdbc.queryForObject("select id from cobranca_aluno where aluno_id = ? and tipo = 'MENSALIDADE' "
                + "and situacao = 'ABERTA' order by vencimento limit 1", UUID.class, alunoId);
        String primeira = gerarPix(alunoLogin, cobrancaId);

        Map<String, Object> alteracao = new LinkedHashMap<>();
        alteracao.put("valorCentavos", 13000L);
        alteracao.put("motivoValor", "Acerto fictício");
        alteracao.put("diaVencimento", LocalDate.now(Fuso.BRASILIA).getDayOfMonth());
        alteracao.put("versao", contratacao.get("versao").asLong());
        api.put("/contratacoes/" + contratacao.get("id").asString(), admin, alteracao, 200);

        // A operação do treinador só gravou o pedido: nada saiu para o Asaas e o id velho já não está na cobrança.
        assertThat(asaasIdNoBanco(cobrancaId)).isNull();
        assertThat(naFila(primeira)).isEqualTo(1);
        assertThat(ASAAS.statusDoPagamento(primeira)).isEqualTo("PENDING");

        assertThat(cancelamentos.processarPendentes()).isEqualTo(1);
        assertThat(ASAAS.statusDoPagamento(primeira)).isEqualTo("DELETED");
        assertThat(naFila(primeira)).isZero();

        // O Pix seguinte nasce com o valor novo, em outra cobrança do Asaas.
        String segunda = gerarPix(alunoLogin, cobrancaId);
        assertThat(segunda).isNotEqualTo(primeira);
        assertThat(ASAAS.requisicoes("/payments").getLast().corpo().path("value").decimalValue())
                .isEqualByComparingTo("130.00");
        assertThat(ASAAS.violacoes()).isEmpty();
    }

    @Test
    void cancelarERenegociarCancelamNoAsaasACobrancaDaOriginal() throws Exception {
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        UUID alunoId = api.criarAluno(admin, "Aluno Cancela Asaas");
        JsonNode alunoLogin = api.convidarEEntrar(admin, alunoId);
        UUID paraCancelar = criarCobrancaAvulsa(admin, alunoId, 20000L, hoje.plusDays(5));
        UUID paraRenegociar = criarCobrancaAvulsa(admin, alunoId, 30000L, hoje.plusDays(6));
        String payCancelada = gerarPix(alunoLogin, paraCancelar);
        String payRenegociada = gerarPix(alunoLogin, paraRenegociar);

        api.post("/cobrancas/" + paraCancelar + "/cancelar", admin,
                Map.of("motivo", "Teste fictício", "versao", versaoDaCobranca(paraCancelar)), 200);
        Map<String, Object> renegociar = new LinkedHashMap<>();
        renegociar.put("itens", List.of(Map.of("cobrancaId", paraRenegociar.toString(),
                "versao", versaoDaCobranca(paraRenegociar))));
        renegociar.put("acrescimoCentavos", 0);
        renegociar.put("descontoCentavos", 0);
        renegociar.put("parcelas", 2);
        renegociar.put("primeiroVencimento", hoje.plusDays(10).toString());
        renegociar.put("pedidoId", UUID.randomUUID().toString());
        renegociar.put("motivo", "Motivo fictício do acordo");
        api.post("/cobrancas/renegociar", admin, renegociar, 201);

        assertThat(asaasIdNoBanco(paraCancelar)).isNull();
        assertThat(asaasIdNoBanco(paraRenegociar)).isNull();
        assertThat(naFila(payCancelada)).isEqualTo(1);
        assertThat(naFila(payRenegociada)).isEqualTo(1);

        assertThat(cancelamentos.processarPendentes()).isEqualTo(2);
        assertThat(ASAAS.statusDoPagamento(payCancelada)).isEqualTo("DELETED");
        assertThat(ASAAS.statusDoPagamento(payRenegociada)).isEqualTo("DELETED");
        assertThat(ASAAS.violacoes()).isEmpty();
    }

    @Test
    void baixaManualTambemApagaACobrancaPagavelNoAsaas() throws Exception {
        UUID alunoId = api.criarAluno(admin, "Aluno Baixa Manual Asaas");
        JsonNode alunoLogin = api.convidarEEntrar(admin, alunoId);
        UUID cobrancaId = criarCobrancaAvulsa(admin, alunoId, 20000L, LocalDate.now(Fuso.BRASILIA).plusDays(5));
        String pay = gerarPix(alunoLogin, cobrancaId);

        api.post("/cobrancas/" + cobrancaId + "/baixa-manual", admin, Map.of("data",
                LocalDate.now(Fuso.BRASILIA).toString(), "forma", "DINHEIRO", "versao", versaoDaCobranca(cobrancaId)), 200);

        assertThat(naFila(pay)).isEqualTo(1);
        cancelamentos.processarPendentes();
        assertThat(ASAAS.statusDoPagamento(pay)).isEqualTo("DELETED");
    }

    @Test
    void corridaPixXFaturaEmDuasAbasDeixaUmaSoCobrancaPagavel() throws Exception {
        UUID alunoId = api.criarAluno(admin, "Aluno Corrida Asaas");
        JsonNode alunoLogin = api.convidarEEntrar(admin, alunoId);
        UUID cobrancaId = criarCobrancaAvulsa(admin, alunoId, 20000L, LocalDate.now(Fuso.BRASILIA).plusDays(5));

        int postsAntes = postsEmPayments();
        // A "outra aba" cria a cobrança dela e grava o id na linha no meio do POST /payments desta aba.
        String[] vencedora = new String[1];
        ASAAS.aoCriarPagamento(ref -> {
            vencedora[0] = ASAAS.criarPagamentoPreExistente("UNDEFINED", new BigDecimal("200.00"), ref, "PENDING");
            jdbc.update("update cobranca_aluno set asaas_cobranca_id = ? where id = ?::uuid", vencedora[0], ref);
        });
        JsonNode fatura = api.post("/aluno/financeiro/cobrancas/" + cobrancaId + "/overtraining-pay/fatura", alunoLogin,
                Map.of("cpfPagador", CPF_VALIDO), 200);

        // Vale a cobrança da vencedora; a criada por esta aba foi apagada na hora (fora de transação), sem ir à fila.
        assertThat(asaasIdNoBanco(cobrancaId)).isEqualTo(vencedora[0]);
        assertThat(urlDaFatura(fatura)).isEqualTo("https://sandbox.asaas.com/i/" + vencedora[0]);
        assertThat(postsEmPayments()).isEqualTo(postsAntes + 1);
        String perdedora = ASAAS.requisicoes().stream().filter(r -> "DELETE".equals(r.metodo()))
                .map(r -> r.caminho().substring("/payments/".length())).findFirst().orElseThrow();
        assertThat(perdedora).isNotEqualTo(vencedora[0]);
        assertThat(ASAAS.statusDoPagamento(perdedora)).isEqualTo("DELETED");
        assertThat(ASAAS.statusDoPagamento(vencedora[0])).isEqualTo("PENDING");
        assertThat(naFila(perdedora)).isZero();
        assertThat(ASAAS.violacoes()).isEmpty();
    }

    @Test
    void falhaNoCancelamentoNaoDerrubaOTreinadorFicaNaFilaEPagamentoDaOrfaVaiParaConferir() throws Exception {
        UUID alunoId = api.criarAluno(admin, "Aluno Falha Cancela Asaas");
        JsonNode alunoLogin = api.convidarEEntrar(admin, alunoId);
        UUID cobrancaId = criarCobrancaAvulsa(admin, alunoId, 20000L, LocalDate.now(Fuso.BRASILIA).plusDays(5));
        String orfa = gerarPix(alunoLogin, cobrancaId);

        // O treinador cancela (200) e o Asaas está fora do ar quando o worker tenta apagar.
        api.post("/cobrancas/" + cobrancaId + "/cancelar", admin,
                Map.of("motivo", "Teste fictício", "versao", versaoDaCobranca(cobrancaId)), 200);
        ASAAS.falharProximasExclusoes(1);
        cancelamentos.processarPendentes();
        assertThat(ASAAS.statusDoPagamento(orfa)).isEqualTo("PENDING");
        Map<String, Object> pedido = jdbc.queryForMap("select situacao, tentativas from cancelamento_asaas_pendente "
                + "where consultoria_id = ? and asaas_cobranca_id = ?", consultoria, orfa);
        assertThat(pedido.get("situacao")).isEqualTo("PENDENTE");
        assertThat(((Number) pedido.get("tentativas")).intValue()).isEqualTo(1);

        // Antes da nova tentativa a órfã é paga: a baixa nunca é aplicada; o aviso vai para CONFERIR.
        ASAAS.marcarPago(orfa);
        enviarWebhook("PAYMENT_RECEIVED", orfa, cobrancaId.toString());
        assertThat(conciliador.processarPendentes()).isGreaterThanOrEqualTo(1);
        assertThat(jdbc.queryForObject("select situacao from cobranca_aluno where id = ?", String.class, cobrancaId))
                .isEqualTo("CANCELADA");
        Map<String, Object> aviso = jdbc.queryForMap(
                "select situacao, motivo from aviso_de_pagamento where consultoria_id = ? and transacao = ?", consultoria, orfa);
        assertThat(aviso.get("situacao")).isEqualTo("CONFERIR");
        assertThat(aviso.get("motivo")).isEqualTo("COBRANCA_CANCELADA");
        nadaVazou(orfa, CHAVE_MATRIZ, "$aact_fake");
    }

    @Test
    void recusadoPeloAsaasOPedidoDesisteSemNovaTentativa() throws Exception {
        UUID alunoId = api.criarAluno(admin, "Aluno Recusa Asaas");
        JsonNode alunoLogin = api.convidarEEntrar(admin, alunoId);
        UUID cobrancaId = criarCobrancaAvulsa(admin, alunoId, 20000L, LocalDate.now(Fuso.BRASILIA).plusDays(5));
        String orfa = gerarPix(alunoLogin, cobrancaId);
        api.post("/cobrancas/" + cobrancaId + "/cancelar", admin,
                Map.of("motivo", "Teste fictício", "versao", versaoDaCobranca(cobrancaId)), 200);
        ASAAS.marcarPago(orfa); // o Asaas recusa apagar cobrança recebida (400)

        cancelamentos.processarPendentes();

        assertThat(jdbc.queryForObject("select situacao from cancelamento_asaas_pendente where consultoria_id = ? "
                + "and asaas_cobranca_id = ?", String.class, consultoria, orfa)).isEqualTo("FALHOU");
        assertThat(cancelamentos.processarPendentes()).isZero();
    }

    @Test
    void boletoPagoNaPaginaDaFaturaDaBaixaComFormaBoleto() throws Exception {
        UUID alunoId = api.criarAluno(admin, "Aluno Boleto Asaas");
        JsonNode alunoLogin = api.convidarEEntrar(admin, alunoId);
        UUID cobrancaId = criarCobrancaAvulsa(admin, alunoId, 20000L, LocalDate.now(Fuso.BRASILIA).plusDays(5));
        api.post("/aluno/financeiro/cobrancas/" + cobrancaId + "/overtraining-pay/fatura", alunoLogin,
                Map.of("cpfPagador", CPF_VALIDO), 200);
        String pay = asaasIdNoBanco(cobrancaId);

        ASAAS.marcarPagoNoBoleto(pay);
        enviarWebhook("PAYMENT_RECEIVED", pay, cobrancaId.toString());
        assertThat(conciliador.processarPendentes()).isGreaterThanOrEqualTo(1);

        Map<String, Object> linha = jdbc.queryForMap("select situacao, forma, provedor from cobranca_aluno where id = ?",
                cobrancaId);
        assertThat(linha.get("situacao")).isEqualTo("PAGA");
        assertThat(linha.get("forma")).isEqualTo("BOLETO");
        assertThat(linha.get("provedor")).isEqualTo(ProvedorAsaas.CODIGO);
        assertThat(jdbc.queryForObject("select situacao from aviso_de_pagamento where consultoria_id = ? and transacao = ?",
                String.class, consultoria, pay)).isEqualTo("APLICADO");
    }

    @Test
    void estornoParcialEChargebackViramConferirSemMexerNaBaixa() throws Exception {
        // O webhook da subconta foi criado já assinando os eventos novos.
        String eventosAssinados = ASAAS.requisicoes("/webhooks").getFirst().corpo().path("events").toString();
        assertThat(eventosAssinados).contains("PAYMENT_PARTIALLY_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED",
                "PAYMENT_CHARGEBACK_DISPUTE", "PAYMENT_AWAITING_CHARGEBACK_REVERSAL");

        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        UUID alunoId = api.criarAluno(admin, "Aluno Estorno Parcial Asaas");
        JsonNode alunoLogin = api.convidarEEntrar(admin, alunoId);
        for (String evento : List.of("PAYMENT_PARTIALLY_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED",
                "PAYMENT_CHARGEBACK_DISPUTE", "PAYMENT_AWAITING_CHARGEBACK_REVERSAL")) {
            UUID cobrancaId = criarCobrancaAvulsa(admin, alunoId, 20000L, hoje.plusDays(5));
            String pay = gerarPix(alunoLogin, cobrancaId);
            ASAAS.marcarPago(pay);
            enviarWebhook("PAYMENT_RECEIVED", pay, cobrancaId.toString());
            assertThat(conciliador.processarPendentes()).isGreaterThanOrEqualTo(1);
            Map<String, Object> antes = jdbc.queryForMap(
                    "select situacao, forma, pago_em, id_externo, provedor from cobranca_aluno where id = ?", cobrancaId);
            assertThat(antes.get("situacao")).isEqualTo("PAGA");

            // O estorno parcial não muda o status da cobrança no Asaas (segue RECEIVED): o evento basta.
            enviarWebhook(evento, pay, cobrancaId.toString());

            assertThat(jdbc.queryForMap(
                    "select situacao, forma, pago_em, id_externo, provedor from cobranca_aluno where id = ?", cobrancaId))
                    .isEqualTo(antes);
            Map<String, Object> aviso = jdbc.queryForMap(
                    "select situacao, motivo from aviso_de_pagamento where consultoria_id = ? and transacao = ?",
                    consultoria, pay);
            assertThat(aviso.get("situacao")).as(evento).isEqualTo("CONFERIR");
            assertThat(aviso.get("motivo")).as(evento).isEqualTo(AvisoDePagamentoRepositorio.ESTORNO_INFORMADO);
        }
    }

    @Test
    void removerASubcontaLimpaOAsaasCobrancaIdDasAbertasENaoDasPagas() throws Exception {
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        UUID alunoId = api.criarAluno(admin, "Aluno Remove Subconta Asaas");
        JsonNode alunoLogin = api.convidarEEntrar(admin, alunoId);
        UUID aberta = criarCobrancaAvulsa(admin, alunoId, 20000L, hoje.plusDays(5));
        UUID paga = criarCobrancaAvulsa(admin, alunoId, 30000L, hoje.plusDays(6));
        gerarPix(alunoLogin, aberta);
        String payPaga = gerarPix(alunoLogin, paga);
        ASAAS.marcarPago(payPaga);
        enviarWebhook("PAYMENT_RECEIVED", payPaga, paga.toString());
        assertThat(conciliador.processarPendentes()).isGreaterThanOrEqualTo(1);
        assertThat(asaasIdNoBanco(aberta)).isNotNull();

        api.delete(ROTA_CONFIG, admin, 204);

        assertThat(asaasIdNoBanco(aberta)).isNull();
        assertThat(asaasIdNoBanco(paga)).isEqualTo(payPaga);
        assertThat(jdbc.queryForObject("select count(*) from subconta_asaas where consultoria_id = ?", Integer.class,
                consultoria)).isZero();
    }
}
