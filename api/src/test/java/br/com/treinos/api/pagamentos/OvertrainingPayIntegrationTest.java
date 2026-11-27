package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Fluxo completo da Onda 1 do Overtraining Pay (Asaas): onboarding PF/PJ, cifragem AES-GCM, mascaramento, ausência de
 * vazamento em logs/auditoria, sincronização KYC, cobrança de teste R$ 5,00, homologação para ATIVA, bloqueio de ativação
 * em Formas de Recebimento antes de ATIVA, isolamento multi-tenant e remoção segura.
 */
@AutoConfigureMockMvc
class OvertrainingPayIntegrationTest extends AbstractIntegrationTest {

    private static final String ROTA = "/financeiro/overtraining-pay";
    private static final String CHAVE_MATRIZ = "chave-matriz-super-secreta-teste-asaas";
    private static final String CPF_REAL = "12345678901";
    private static final String CNPJ_REAL = "12345678000199";

    private static final AsaasFalsa ASAAS = new AsaasFalsa();

    @DynamicPropertySource
    static void configurarAsaas(DynamicPropertyRegistry r) {
        r.add("treinos.pagamentos.asaas.habilitado", () -> "true");
        r.add("treinos.pagamentos.asaas.url-base", ASAAS::url);
        r.add("treinos.pagamentos.asaas.api-key-matriz", () -> CHAVE_MATRIZ);
        r.add("treinos.pagamentos.asaas.url-publica", () -> "https://api.teste.local");
        r.add("treinos.pagamentos.asaas.wallet-matriz", () -> "wal_matriz_teste");
        r.add("treinos.pagamentos.asaas.wallet-socio", () -> "wal_socio_teste");
        r.add("treinos.pagamentos.asaas.conciliacao-ativa", () -> "false");
    }

    @AfterAll
    static void fecharAsaas() {
        ASAAS.close();
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private ListAppender<ILoggingEvent> log;

    @BeforeEach
    void preparar() throws Exception {
        ASAAS.reiniciar();
        ASAAS.esperaApiKeyMatriz(CHAVE_MATRIZ);
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        log = new ListAppender<>();
        log.start();
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).addAppender(log);
    }

    @AfterEach
    void limparLog() {
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).detachAppender(log);
    }

    private UUID consultoriaDe(JsonNode login) {
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.get("usuario").get("id").asString());
    }

    private static Map<String, Object> payloadPf(Long versao) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("tipoPessoa", "PF");
        m.put("documento", CPF_REAL);
        m.put("nomeTitular", "Treinador Teste PF");
        m.put("emailFinanceiro", "financeiro.pf@teste.local");
        m.put("telefone", "41999991234");
        m.put("cep", "80010000");
        m.put("endereco", "Rua XV de Novembro");
        m.put("numeroEndereco", "100");
        m.put("bairro", "Centro");
        m.put("rendaMensalCentavos", 1500000L);
        m.put("bancoCodigo", "341");
        m.put("bancoNome", "Itaú Unibanco");
        m.put("agencia", "1234");
        m.put("conta", "12345-6");
        m.put("tipoConta", "CORRENTE");
        m.put("repasseAutomatico", true);
        if (versao != null) {
            m.put("versao", versao);
        }
        return m;
    }

    private static Map<String, Object> payloadPj(Long versao) {
        Map<String, Object> m = payloadPf(versao);
        m.put("tipoPessoa", "PJ");
        m.put("documento", CNPJ_REAL);
        m.put("nomeTitular", "Consultoria Esportiva Ltda");
        m.put("emailFinanceiro", "financeiro.pj@teste.local");
        m.put("tipoEmpresa", "LIMITED");
        return m;
    }

    private void nadaVazou(UUID consultoria, String... segredos) {
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
    void euExpoeOvertrainingPayHabilitadoEGetSemConfiguracaoRetornaNaoConfigurada() throws Exception {
        JsonNode eu = api.get("/eu", admin, 200);
        assertThat(eu.get("overtrainingPayHabilitado").asBoolean()).isTrue();

        JsonNode resp = api.get(ROTA, admin, 200);
        assertThat(resp.get("situacao").asString()).isEqualTo("NAO_CONFIGURADA");
        assertThat(resp.get("etapas").get("dadosCadastrados").asBoolean()).isFalse();
        assertThat(resp.get("etapas").get("documentosAprovados").asBoolean()).isFalse();
        assertThat(resp.get("etapas").get("testeHomologado").asBoolean()).isFalse();
        assertThat(resp.get("etapas").get("ativa").asBoolean()).isFalse();
        assertThat(ASAAS.violacoes()).isEmpty();
    }

    @Test
    void fluxoCompletoPfCifragemMascaramentoKycTesteHomologacaoEFormasDeRecebimento() throws Exception {
        UUID consultoria = consultoriaDe(admin);

        // 1. Cria subconta PF -> nasce DOCUMENTOS_PENDENTES com onboardingUrl
        JsonNode criada = api.put(ROTA, admin, payloadPf(null), 200);
        assertThat(criada.get("situacao").asString()).isEqualTo("DOCUMENTOS_PENDENTES");
        assertThat(criada.get("documentoMascarado").asString()).isEqualTo("***.456.789-**");
        assertThat(criada.get("agenciaMascarada").asString()).isEqualTo("**34");
        assertThat(criada.get("contaMascarada").asString()).isEqualTo("****5-6");
        assertThat(criada.get("onboardingUrl").asString()).contains("onboarding");
        assertThat(criada.toString()).doesNotContain(CPF_REAL).doesNotContain(CHAVE_MATRIZ).doesNotContain("$aact_fake");

        // Confere colunas cifradas no banco (formato v1:<chave>:...)
        Map<String, Object> linha = jdbc.queryForMap("select * from subconta_asaas where consultoria_id = ?", consultoria);
        assertThat((String) linha.get("api_key_cifrada")).startsWith("v1:teste:");
        assertThat((String) linha.get("token_webhook_cifrado")).startsWith("v1:teste:");
        assertThat((String) linha.get("documento_cifrado")).startsWith("v1:teste:");
        assertThat((String) linha.get("documento_cifrado")).doesNotContain(CPF_REAL);

        // 2. Enquanto não estiver ATIVA, Formas de Recebimento bloqueia ligar overtrainingPay=true (422)
        Map<String, Object> formasReq = new LinkedHashMap<>();
        formasReq.put("infinitePay", true);
        formasReq.put("overtrainingPay", true);
        formasReq.put("linkProprio", false);
        formasReq.put("pix", false);
        formasReq.put("manual", true);
        JsonNode erroFormas = api.put("/financeiro/formas-de-recebimento", admin, formasReq, 422);
        assertThat(erroFormas.get("codigo").asString()).isEqualTo("FORMAS_INVALIDAS");

        // 3. Cobrança de teste antes de PRONTA_PARA_TESTE dá 409
        api.post(ROTA + "/cobranca-teste", admin, Map.of(), 409);

        // 4. Sincroniza status após aprovação KYC -> PRONTA_PARA_TESTE
        ASAAS.statusKyc("APPROVED", "APPROVED", null);
        JsonNode pronta = api.post(ROTA + "/sincronizar-status", admin, Map.of(), 200);
        assertThat(pronta.get("situacao").asString()).isEqualTo("PRONTA_PARA_TESTE");
        assertThat(pronta.get("etapas").get("documentosAprovados").asBoolean()).isTrue();
        assertThat(pronta.get("etapas").get("ativa").asBoolean()).isFalse();

        // 5. Gera cobrança de teste Pix de R$ 5,00 (500 centavos)
        JsonNode teste = api.post(ROTA + "/cobranca-teste", admin, Map.of(), 200);
        String cobrancaTesteId = teste.get("cobrancaTesteId").asString();
        assertThat(cobrancaTesteId).startsWith("pay_fake_");
        assertThat(teste.get("situacao").asString()).isEqualTo("CRIADA");
        assertThat(teste.get("valorCentavos").asLong()).isEqualTo(500L);
        assertThat(teste.get("qrCodeBase64").asString()).isNotBlank();
        assertThat(teste.get("pixCopiaECola").asString()).contains("br.gov.bcb.pix");

        // 6. Consulta ainda CRIADA
        JsonNode consultaAntes = api.get(ROTA + "/cobranca-teste/" + cobrancaTesteId, admin, 200);
        assertThat(consultaAntes.get("situacao").asString()).isEqualTo("CRIADA");

        // 7. Pagamento confirmado no Asaas -> consulta promove subconta para ATIVA e homologadaEm
        ASAAS.marcarPago(cobrancaTesteId);
        JsonNode consultaDepois = api.get(ROTA + "/cobranca-teste/" + cobrancaTesteId, admin, 200);
        assertThat(consultaDepois.get("situacao").asString()).isEqualTo("HOMOLOGADA");

        JsonNode ativa = api.get(ROTA, admin, 200);
        assertThat(ativa.get("situacao").asString()).isEqualTo("ATIVA");
        assertThat(ativa.get("etapas").get("testeHomologado").asBoolean()).isTrue();
        assertThat(ativa.get("etapas").get("ativa").asBoolean()).isTrue();
        assertThat(ativa.get("homologadaEm").isNull()).isFalse();

        // 8. Agora Formas de Recebimento permite ligar overtrainingPay=true!
        JsonNode formasOk = api.put("/financeiro/formas-de-recebimento", admin, formasReq, 200);
        assertThat(formasOk.get("overtrainingPay").asBoolean()).isTrue();

        // 9. Isolamento multi-tenant: outra consultoria vê NAO_CONFIGURADA e toma 404 na cobrança de teste da primeira
        JsonNode outra = api.novoTreinador();
        JsonNode outraResp = api.get(ROTA, outra, 200);
        assertThat(outraResp.get("situacao").asString()).isEqualTo("NAO_CONFIGURADA");
        api.get(ROTA + "/cobranca-teste/" + cobrancaTesteId, outra, 404);

        // 10. Remoção desliga overtraining_pay em forma_de_recebimento e apaga chaves cifradas locais
        api.delete(ROTA, admin, 204);
        JsonNode aposRemover = api.get(ROTA, admin, 200);
        assertThat(aposRemover.get("situacao").asString()).isEqualTo("NAO_CONFIGURADA");
        JsonNode formasAposRemover = api.get("/financeiro/formas-de-recebimento", admin, 200);
        assertThat(formasAposRemover.get("overtrainingPay").asBoolean()).isFalse();
        assertThat(jdbc.queryForObject("select count(*) from subconta_asaas where consultoria_id = ?", Integer.class,
                consultoria)).isZero();

        // Verifica auditorias e ausência total de vazamentos
        assertThat(jdbc.queryForObject(
                "select count(*) from auditoria where consultoria_id = ? and acao = 'OVERTRAINING_PAY_CONFIGURADO'",
                Integer.class, consultoria)).isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "select count(*) from auditoria where consultoria_id = ? and acao = 'OVERTRAINING_PAY_TESTE_GERADO'",
                Integer.class, consultoria)).isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "select count(*) from auditoria where consultoria_id = ? and acao = 'OVERTRAINING_PAY_HOMOLOGADO'",
                Integer.class, consultoria)).isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "select count(*) from auditoria where consultoria_id = ? and acao = 'OVERTRAINING_PAY_REMOVIDO'",
                Integer.class, consultoria)).isEqualTo(1);
        nadaVazou(consultoria, CPF_REAL, CHAVE_MATRIZ, "$aact_fake");
        assertThat(ASAAS.violacoes()).isEmpty();
    }

    @Test
    void criaSubcontaPjERotacionaWebhookComJanelaDe24Horas() throws Exception {
        UUID consultoria = consultoriaDe(admin);

        JsonNode criada = api.put(ROTA, admin, payloadPj(null), 200);
        assertThat(criada.get("tipoPessoa").asString()).isEqualTo("PJ");
        assertThat(criada.get("documentoMascarado").asString()).isEqualTo("**.*45.678/0001-**");
        long versao = criada.get("versao").asLong();

        Map<String, Object> atualizacao = payloadPj(versao);
        atualizacao.put("rotacionarWebhook", true);
        JsonNode atualizada = api.put(ROTA, admin, atualizacao, 200);
        // Parcelas e juros saíram do contrato (o parcelamento é decidido na página do Asaas).
        assertThat(criada.has("maxParcelas")).isFalse();
        assertThat(criada.has("jurosParcelamento")).isFalse();
        assertThat(atualizada.has("maxParcelas")).isFalse();
        assertThat(atualizada.has("jurosParcelamento")).isFalse();
        assertThat(api.get(ROTA, admin, 200).has("maxParcelas")).isFalse();

        Map<String, Object> linha = jdbc.queryForMap("select * from subconta_asaas where consultoria_id = ?", consultoria);
        assertThat((String) linha.get("token_webhook_anterior_cifrado")).startsWith("v1:teste:");
        assertThat(linha.get("anterior_valido_ate")).isNotNull();
        nadaVazou(consultoria, CNPJ_REAL, CHAVE_MATRIZ, "$aact_fake");
        assertThat(ASAAS.violacoes()).isEmpty();
    }
}
