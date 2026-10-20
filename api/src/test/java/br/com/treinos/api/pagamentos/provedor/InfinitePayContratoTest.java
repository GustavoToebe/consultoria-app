package br.com.treinos.api.pagamentos.provedor;

import br.com.treinos.api.pagamentos.FormaDePagamento;
import br.com.treinos.api.pagamentos.InfinitePayProperties;
import br.com.treinos.api.pagamentos.provedor.InfinitePayFalsa.ModoDaConsulta;
import br.com.treinos.api.pagamentos.provedor.InfinitePayFalsa.ModoDoLink;
import br.com.treinos.api.pagamentos.provedor.InfinitePayFalsa.Requisicao;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.JsonNode;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;

/**
 * A InfinitePay cumpre o contrato dos provedores contra uma InfinitePay de mentira ({@link InfinitePayFalsa}, que confere
 * o que a API real exige). Dados fictícios; nenhuma chamada à rede.
 */
class InfinitePayContratoTest extends ProvedorContratoTest {

    private static final String CONTA = "treinador-fake";
    private static final String CHAVE = "chave-fake-do-teste-9876543210";
    private static final String TOKEN = "A".repeat(43);
    private static final UUID PEDIDO = UUID.fromString("0b6f3a52-4c1e-4f0b-9a77-3f2d6a1e8c10");
    private static final String AVISO = "https://api.teste.local/publico/pagamentos/infinitepay/" + TOKEN;

    private InfinitePayFalsa falsa;
    private InfinitePay provedor;

    @BeforeEach
    void subir() {
        falsa = new InfinitePayFalsa().esperaPreco(15_000L).esperaHandle(CONTA);
        provedor = provedorContra(falsa);
    }

    @AfterEach
    void conferir() {
        try {
            assertThat(falsa.violacoes()).as("a API real recusaria algum pedido").isEmpty();
        } finally {
            falsa.close();
        }
    }

    private static InfinitePay provedorContra(InfinitePayFalsa servidor) {
        return new InfinitePay(new InfinitePayCliente(new InfinitePayProperties(true, servidor.url(), "https://api.teste.local", false)));
    }

    // ---- ganchos do contrato ----

    @Override
    protected ProvedorDePagamento provedor() {
        return provedor;
    }

    @Override
    protected CredencialDoProvedor credencial() {
        return new CredencialDoProvedor(UUID.randomUUID(), CONTA, null);
    }

    @Override
    protected PedidoDeCobranca pedidoValido() {
        return pedido(15_000L, null, Instant.now().plus(30, ChronoUnit.DAYS), 0);
    }

    @Override
    protected RequisicaoDeWebhook webhookValido() {
        return webhook("{\"order_nsu\":\"" + PEDIDO + "\",\"transaction_nsu\":\"TX-123\",\"invoice_slug\":\"slug-abc\"}");
    }

    @Override
    protected RequisicaoDeWebhook webhookAdulterado() {
        return webhook("{\"order_nsu\":\"nao-e-um-uuid\",\"transaction_nsu\":\"TX-123\"}");
    }

    @Override
    protected PedidoDeConsulta consultaExistente() {
        return new PedidoDeConsulta(PEDIDO, "TX-123", "slug-abc");
    }

    private static PedidoDeCobranca pedido(long valor, String retorno, Instant validade, int parcelasSemJuros) {
        return new PedidoDeCobranca(UUID.randomUUID(), valor, LocalDate.now(Fuso.BRASILIA).plusDays(5),
                "Mensalidade: Plano fictício (10/2026)", Set.of(FormaDePagamento.PIX, FormaDePagamento.CARTAO), 1, retorno,
                AVISO, validade, parcelasSemJuros);
    }

    private static CredencialDoProvedor comChave() {
        return new CredencialDoProvedor(UUID.randomUUID(), CONTA, CHAVE);
    }

    private static Set<String> campos(JsonNode objeto) {
        Set<String> nomes = new java.util.TreeSet<>();
        objeto.propertyNames().forEach(nomes::add);
        return nomes;
    }

    private static RequisicaoDeWebhook webhook(String json) {
        return new RequisicaoDeWebhook(Map.of("content-type", "application/json"), json.getBytes(StandardCharsets.UTF_8));
    }

    // ---- identidade ----

    @Test
    void ehAInfinitePayComPixECartaoSemBoleto() {
        assertThat(provedor.codigo()).isEqualTo("INFINITEPAY");
        assertThat(provedor.capacidades())
                .isEqualTo(new CapacidadesDoProvedor(true, false, true, 12, false, true, false, true, true));
    }

    @Test
    void registroConheceAInfinitePayEDuplicidadeDerrubaASubida() {
        var registro = new ProvedoresDePagamento(List.of(new ProvedorManual(), provedor));
        assertThat(registro.conhece("INFINITEPAY")).isTrue();
        assertThat(registro.buscar("INFINITEPAY")).containsSame(provedor);
        assertThatThrownBy(() -> new ProvedoresDePagamento(List.of(provedor, provedorContra(falsa))))
                .isInstanceOf(IllegalStateException.class);
    }

    // ---- link ----

    @Test
    void linkSemChaveTemSoOBasicoEWebhookUrlSemOptionsNemWebhookObjeto() {
        falsa.exigeChave(false);
        UUID referencia = UUID.randomUUID();
        var pedido = new PedidoDeCobranca(referencia, 15_000L, LocalDate.now(Fuso.BRASILIA), "Mensalidade: Plano (10/2026)",
                Set.of(FormaDePagamento.PIX), 1, null, AVISO, null, 0);

        CobrancaGerada gerada = provedor.gerarCobranca(credencial(), pedido);

        Requisicao enviada = falsa.requisicoes().get(0);
        assertThat(enviada.chave()).isNull();
        JsonNode corpo = enviada.corpo();
        assertThat(campos(corpo)).containsExactly("handle", "items", "order_nsu", "webhook_url");
        assertThat(corpo.get("handle").asString()).isEqualTo(CONTA);
        assertThat(corpo.get("order_nsu").asString()).isEqualTo(referencia.toString());
        assertThat(corpo.get("items")).hasSize(1);
        assertThat(campos(corpo.get("items").get(0))).containsExactly("description", "price", "quantity");
        assertThat(corpo.get("items").get(0).get("price").longValue()).isEqualTo(15_000L);
        assertThat(corpo.get("items").get(0).get("quantity").intValue()).isEqualTo(1);
        assertThat(corpo.get("webhook_url").asString()).isEqualTo(AVISO);
        assertThat(corpo.has("options")).isFalse();
        assertThat(corpo.has("webhook")).isFalse();
        assertThat(corpo.has("customer")).isFalse();
        assertThat(corpo.has("address")).isFalse();
        assertThat(gerada.idExterno()).isEqualTo(referencia.toString());
        assertThat(gerada.link()).startsWith("https://");
    }

    @Test
    void linkSemChaveIgnoraValidadeEParcelasDoPedido() {
        falsa.exigeChave(false);

        provedor.gerarCobranca(credencial(), pedido(15_000L, null, Instant.now().plus(30, ChronoUnit.DAYS), 12));

        assertThat(campos(falsa.requisicoes().get(0).corpo())).containsExactly("handle", "items", "order_nsu", "webhook_url");
    }

    @Test
    void linkComChaveMandaCabecalhoOptionsEWebhookObjetoSemWebhookUrl() {
        falsa.exigeChave(true).esperaChave(CHAVE);
        Instant validade = Instant.now().plus(30, ChronoUnit.DAYS);

        provedor.gerarCobranca(comChave(), pedido(15_000L, "https://app.fake.test/aluno/conta", validade, 0));

        Requisicao enviada = falsa.requisicoes().get(0);
        assertThat(enviada.chave()).isEqualTo(CHAVE);
        JsonNode corpo = enviada.corpo();
        assertThat(campos(corpo)).containsExactly("handle", "items", "options", "order_nsu", "redirect_url", "webhook");
        assertThat(corpo.has("webhook_url")).isFalse();
        assertThat(corpo.has("customer")).isFalse();
        assertThat(corpo.has("address")).isFalse();
        assertThat(corpo.get("handle").asString()).isEqualTo(CONTA);
        JsonNode opcoes = corpo.get("options");
        assertThat(campos(opcoes)).containsExactly("assured_installments", "payment_methods_enabled", "single_payment",
                "valid_until");
        assertThat(opcoes.get("single_payment").asBoolean()).isTrue();
        assertThat(Instant.parse(opcoes.get("valid_until").asString())).isEqualTo(validade.truncatedTo(ChronoUnit.SECONDS));
        assertThat(opcoes.get("payment_methods_enabled").toString()).isEqualTo("[\"pix\",\"credit_card\"]");
        assertThat(opcoes.get("assured_installments").intValue()).isZero();
        JsonNode webhook = corpo.get("webhook");
        assertThat(campos(webhook)).containsExactly("events", "url");
        assertThat(webhook.get("url").asString()).isEqualTo(AVISO);
        assertThat(webhook.get("events").toString()).isEqualTo("[\"paid\",\"refunded\"]");
    }

    @Test
    void linkComChaveLevaAsParcelasSemJurosDoPedido() {
        falsa.exigeChave(true);
        Instant validade = Instant.now().plus(30, ChronoUnit.DAYS);

        provedor.gerarCobranca(comChave(), pedido(15_000L, null, validade, 0));
        provedor.gerarCobranca(comChave(), pedido(15_000L, null, validade, 12));

        List<Requisicao> enviadas = falsa.requisicoes("/links");
        assertThat(enviadas.get(0).corpo().get("options").get("assured_installments").intValue()).isZero();
        assertThat(enviadas.get(1).corpo().get("options").get("assured_installments").intValue()).isEqualTo(12);
        assertThat(enviadas.get(0).corpo().has("redirect_url")).isFalse();
    }

    @Test
    void linkComChaveSemValidadeOuComParcelasForaDoIntervaloNaoChegaARede() {
        Instant validade = Instant.now().plus(30, ChronoUnit.DAYS);

        assertThatThrownBy(() -> provedor.gerarCobranca(comChave(), pedido(15_000L, null, null, 0)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> provedor.gerarCobranca(comChave(), pedido(15_000L, null, validade, 13)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> provedor.gerarCobranca(comChave(), pedido(15_000L, null, validade, -1)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(falsa.requisicoes()).isEmpty();
    }

    @Test
    void soMandaRedirectSeForHttps() {
        provedor.gerarCobranca(credencial(), pedido(15_000L, "http://app.fake.test/aluno/conta", null, 0));
        provedor.gerarCobranca(credencial(), pedido(15_000L, "https://app.fake.test/aluno/conta", null, 0));

        List<Requisicao> enviadas = falsa.requisicoes("/links");
        assertThat(enviadas.get(0).corpo().has("redirect_url")).isFalse();
        assertThat(enviadas.get(1).corpo().get("redirect_url").asString()).isEqualTo("https://app.fake.test/aluno/conta");
    }

    @Test
    void aceitaAsDuasFormasDeRespostaDoLinks() {
        falsa.linkResponde(ModoDoLink.URL);
        CobrancaGerada comUrl = provedor.gerarCobranca(credencial(), pedidoValido());
        assertThat(comUrl.link()).startsWith("https://checkout.falsa.test/pagar/");
        assertThat(comUrl.slug()).isNull();

        falsa.linkResponde(ModoDoLink.LINK_E_SLUG);
        CobrancaGerada comSlug = provedor.gerarCobranca(credencial(), pedidoValido());
        assertThat(comSlug.link()).startsWith("https://checkout.falsa.test/pagar/");
        assertThat(comSlug.slug()).isNotBlank();
        assertThat(comSlug.link()).endsWith(comSlug.slug());
    }

    @Test
    void respostaDoLinksSemUrlComUrlHttpOuComSlugEstranhoDa503() {
        for (ModoDoLink modo : List.of(ModoDoLink.SEM_URL, ModoDoLink.URL_HTTP, ModoDoLink.SLUG_INVALIDO)) {
            falsa.linkResponde(modo);
            assertThat(catchThrowable(() -> provedor.gerarCobranca(credencial(), pedidoValido())))
                    .as(modo.name()).isInstanceOf(ProvedorIndisponivelException.class);
        }
    }

    @Test
    void falhasDoLinksViram503SemVazarCorpoNemChaveNemConta() {
        for (ModoDoLink modo : List.of(ModoDoLink.HTTP_500, ModoDoLink.JSON_INVALIDO, ModoDoLink.CORPO_GRANDE)) {
            falsa.linkResponde(modo);
            Throwable erro = catchThrowable(
                    () -> provedor.gerarCobranca(new CredencialDoProvedor(UUID.randomUUID(), CONTA, CHAVE), pedidoValido()));
            semVazamento(erro, modo.name());
        }
    }

    @Test
    void servidorForaDoArViraIndisponivel() {
        falsa.close();

        semVazamento(catchThrowable(() -> provedor.gerarCobranca(new CredencialDoProvedor(UUID.randomUUID(), CONTA, CHAVE), pedidoValido())),
                "sem conexão");
    }

    private static void semVazamento(Throwable erro, String cenario) {
        assertThat(erro).as(cenario).isInstanceOf(ProvedorIndisponivelException.class);
        assertThat(erro.getCause()).as(cenario).isNull();
        assertThat(erro.getMessage()).as(cenario).isEqualTo("O provedor de pagamento não respondeu agora. Tente de novo em instantes.");
        assertThat(erro.toString()).as(cenario).doesNotContain("SEGREDO").doesNotContain(CHAVE).doesNotContain(CONTA)
                .doesNotContain("checkout.falsa");
    }

    @Test
    void pedidoIncompletoNaoChegaARede() {
        var semValor = new PedidoDeCobranca(UUID.randomUUID(), 0, LocalDate.now(Fuso.BRASILIA), "Mensalidade", Set.of(), 1,
                null, null, null, 0);
        var semDescricao = new PedidoDeCobranca(UUID.randomUUID(), 100, LocalDate.now(Fuso.BRASILIA), " ", Set.of(), 1,
                null, null, null, 0);

        assertThatThrownBy(() -> provedor.gerarCobranca(credencial(), semValor)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> provedor.gerarCobranca(credencial(), semDescricao)).isInstanceOf(IllegalArgumentException.class);
        assertThat(falsa.requisicoes()).isEmpty();
    }

    // ---- consulta ----

    @Test
    void consultaPagaNoPixTrazValorFormaEHoje() {
        falsa.consultaResponde(ModoDaConsulta.PAGO_PIX).exigeChave(false);

        ConsultaDeCobranca c = provedor.consultar(credencial(), consultaExistente());

        assertThat(c.situacao()).isEqualTo(SituacaoNormalizada.PAGA);
        assertThat(c.forma()).isEqualTo(FormaDePagamento.PIX);
        assertThat(c.valorCentavos()).isEqualTo(15_000L);
        assertThat(c.pagoEm()).isEqualTo(LocalDate.now(Fuso.BRASILIA));
        JsonNode corpo = falsa.requisicoes("/payment_check").get(0).corpo();
        assertThat(corpo.get("order_nsu").asString()).isEqualTo(PEDIDO.toString());
        assertThat(corpo.get("transaction_nsu").asString()).isEqualTo("TX-123");
        assertThat(corpo.get("slug").asString()).isEqualTo("slug-abc");
        assertThat(corpo.get("handle").asString()).isEqualTo(CONTA);
    }

    @Test
    void consultaNoCartaoConfereOValorDoLinkENaoOPagoComJuros() {
        falsa.consultaResponde(ModoDaConsulta.PAGO_CARTAO).exigeChave(true).esperaChave(CHAVE);

        ConsultaDeCobranca c = provedor.consultar(new CredencialDoProvedor(UUID.randomUUID(), CONTA, CHAVE), consultaExistente());

        assertThat(c.forma()).isEqualTo(FormaDePagamento.CARTAO);
        assertThat(c.valorCentavos()).isEqualTo(15_000L);
        assertThat(c.valorPagoCentavos()).isEqualTo(15_250L);
        assertThat(c.parcelas()).isEqualTo(3);
        assertThat(c.formaCapturada()).isEqualTo("credit_card");
    }

    @Test
    void consultaPagaNoPixTrazParcelaUmEAFormaComoVeio() {
        ConsultaDeCobranca c = provedor.consultar(credencial(), consultaExistente());

        assertThat(c.parcelas()).isEqualTo(1);
        assertThat(c.formaCapturada()).isEqualTo("pix");
    }

    @Test
    void formaCapturadaVemLimpaECurtaEParcelaInvalidaFicaNula() {
        falsa.consultaResponde(ModoDaConsulta.METODO_SUJO);

        ConsultaDeCobranca c = provedor.consultar(credencial(), consultaExistente());

        assertThat(c.forma()).isNull();
        assertThat(c.formaCapturada()).isEqualTo("pix20xtra-muito-long").hasSize(20);
        assertThat(c.parcelas()).isNull();
    }

    @Test
    void consultaSemSlugNaoMandaOCampo() {
        provedor.consultar(credencial(), new PedidoDeConsulta(PEDIDO, "TX-123", null));

        assertThat(falsa.requisicoes("/payment_check").get(0).corpo().has("slug")).isFalse();
    }

    @Test
    void consultaNaoPagaFicaAbertaSemFormaNemData() {
        falsa.consultaResponde(ModoDaConsulta.NAO_PAGO);

        ConsultaDeCobranca c = provedor.consultar(credencial(), consultaExistente());

        assertThat(c.situacao()).isEqualTo(SituacaoNormalizada.ABERTA);
        assertThat(c.forma()).isNull();
        assertThat(c.pagoEm()).isNull();
        assertThat(c.valorPagoCentavos()).isNull();
        assertThat(c.parcelas()).isNull();
        assertThat(c.formaCapturada()).isNull();
    }

    @Test
    void metodoDeCapturaDesconhecidoFicaSemFormaENuncaEChutado() {
        falsa.consultaResponde(ModoDaConsulta.METODO_DESCONHECIDO);

        ConsultaDeCobranca c = provedor.consultar(credencial(), consultaExistente());

        assertThat(c.situacao()).isEqualTo(SituacaoNormalizada.PAGA);
        assertThat(c.forma()).isNull();
        assertThat(c.formaCapturada()).isEqualTo("boleto");
    }

    @Test
    void consultaSemSuccessVerdadeiroNaoViraNaoPagaEDa503() {
        // Uma resposta ambígua não pode virar "não paga": o conciliador a trataria como estorno informado de uma baixa válida.
        for (ModoDaConsulta modo : List.of(ModoDaConsulta.SEM_SUCESSO, ModoDaConsulta.SEM_CAMPO_SUCESSO)) {
            falsa.consultaResponde(modo);
            Throwable erro = catchThrowable(() -> provedor.consultar(credencial(), consultaExistente()));
            semVazamento(erro, modo.name());
        }
    }

    @Test
    void falhasDaConsultaViram503SemVazarNada() {
        for (ModoDaConsulta modo : List.of(ModoDaConsulta.HTTP_500, ModoDaConsulta.JSON_INVALIDO, ModoDaConsulta.CORPO_GRANDE)) {
            falsa.consultaResponde(modo);
            Throwable erro = catchThrowable(
                    () -> provedor.consultar(new CredencialDoProvedor(UUID.randomUUID(), CONTA, CHAVE), consultaExistente()));
            semVazamento(erro, modo.name());
        }
    }

    @Test
    void consultaIncompletaNaoChegaARede() {
        assertThatThrownBy(() -> provedor.consultar(credencial(), new PedidoDeConsulta(PEDIDO, " ", null)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(falsa.requisicoes()).isEmpty();
    }

    // ---- guarda da transação ----

    @Test
    void clienteDentroDeUmaTransacaoLancaSemChamarARede() {
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            Throwable gerar = catchThrowable(
                    () -> provedor.gerarCobranca(new CredencialDoProvedor(UUID.randomUUID(), CONTA, CHAVE), pedidoValido()));
            Throwable consultar = catchThrowable(
                    () -> provedor.consultar(new CredencialDoProvedor(UUID.randomUUID(), CONTA, CHAVE), consultaExistente()));

            assertThat(gerar).isInstanceOf(IllegalStateException.class);
            assertThat(consultar).isInstanceOf(IllegalStateException.class);
            assertThat(gerar.getMessage() + consultar.getMessage()).doesNotContain(CONTA).doesNotContain(CHAVE);
        } finally {
            TransactionSynchronizationManager.setActualTransactionActive(false);
        }
        assertThat(falsa.requisicoes()).isEmpty();
    }

    // ---- toString ----

    @Test
    void credencialPedidoEResultadoNaoImprimemSegredoContaNemUrlDoAviso() {
        UUID consultoria = UUID.randomUUID();
        var credencial = new CredencialDoProvedor(consultoria, CONTA, CHAVE);
        var pedido = pedidoValido();

        assertThat(credencial.toString()).contains(consultoria.toString()).doesNotContain(CHAVE).doesNotContain(CONTA);
        assertThat(pedido.toString()).doesNotContain(TOKEN).doesNotContain("api.teste.local");
        assertThat(provedor.gerarCobranca(credencial, pedido).toString()).doesNotContain("checkout");
    }

    // ---- webhook ----

    @Test
    void leSoOsIdentificadoresEIgnoraOResto() {
        String corpo = "{\"invoice_slug\":\"slug-abc\",\"amount\":15000,\"paid_amount\":15250,\"installments\":3,"
                + "\"capture_method\":\"credit_card\",\"transaction_nsu\":\"TX-123\",\"order_nsu\":\"" + PEDIDO + "\","
                + "\"receipt_url\":\"https://recibo.falso.test/segredo\",\"items\":[{\"description\":\"X\",\"price\":1}],"
                + "\"card\":{\"number\":\"4111111111111111\"}}";

        EventoDeWebhook evento = provedor.lerWebhook(webhook(corpo));

        assertThat(evento).isEqualTo(new EventoDeWebhook("TX-123", PEDIDO, "TX-123", "slug-abc", null));
        assertThat(evento.toString()).doesNotContain("4111").doesNotContain("recibo");
    }

    @Test
    void guardaOEventoSoSeForUmDosConhecidosEIgnoraOResto() {
        for (String nome : List.of("created", "paid", "settled", "canceled", "refunded", "payment_failed")) {
            EventoDeWebhook evento = provedor.lerWebhook(webhook(
                    "{\"order_nsu\":\"" + PEDIDO + "\",\"transaction_nsu\":\"TX-1\",\"event\":\"" + nome + "\"}"));
            assertThat(evento.evento()).as(nome).isEqualTo(nome);
        }
        // Desconhecido, com outra caixa, longo, vazio ou de outro tipo: ignorado, sem erro.
        for (String evento : List.of("\"chargeback\"", "\"REFUNDED\"", "\"" + "x".repeat(5_000) + "\"", "\"\"", "42", "null",
                "{\"a\":1}", "[\"refunded\"]")) {
            EventoDeWebhook lido = provedor.lerWebhook(webhook(
                    "{\"order_nsu\":\"" + PEDIDO + "\",\"transaction_nsu\":\"TX-1\",\"event\":" + evento + "}"));
            assertThat(lido.evento()).as(evento).isNull();
            assertThat(lido.temTransacao()).isTrue();
        }
        assertThat(provedor.lerWebhook(webhook("{\"order_nsu\":\"" + PEDIDO + "\",\"transaction_nsu\":\"TX-1\","
                + "\"event\":\"refunded\"}")).estornoInformado()).isTrue();
        assertThat(provedor.lerWebhook(webhookValido()).estornoInformado()).isFalse();
    }

    @Test
    void slugEOpcionalNoAviso() {
        EventoDeWebhook evento = provedor.lerWebhook(webhook("{\"order_nsu\":\"" + PEDIDO + "\",\"transaction_nsu\":\"TX-9\"}"));

        assertThat(evento.slug()).isNull();
        assertThat(provedor.lerWebhook(webhook("{\"order_nsu\":\"" + PEDIDO + "\",\"transaction_nsu\":\"TX-9\",\"invoice_slug\":null}"))
                .slug()).isNull();
    }

    @Test
    void avisoValidoSemTransacaoVoltaSemTransacaoENaoELancado() {
        for (String corpo : List.of("{\"order_nsu\":\"" + PEDIDO + "\"}",
                "{\"order_nsu\":\"" + PEDIDO + "\",\"transaction_nsu\":null}",
                "{\"order_nsu\":\"" + PEDIDO + "\",\"invoice_slug\":\"slug-abc\",\"amount\":15000}")) {
            EventoDeWebhook evento = provedor.lerWebhook(webhook(corpo));

            assertThat(evento.temTransacao()).as(corpo).isFalse();
            assertThat(evento.idExterno()).as(corpo).isNull();
            assertThat(evento.referencia()).as(corpo).isEqualTo(PEDIDO);
        }
        assertThat(provedor.lerWebhook(webhookValido()).temTransacao()).isTrue();
    }

    @Test
    void avisoForaDoFormatoELancadoComMensagemFixaSemOConteudo() {
        String longo = "x".repeat(101);
        List<String> invalidos = List.of(
                "",
                "isto nao e json",
                "[]",
                "\"texto\"",
                "{}",
                "{\"transaction_nsu\":\"TX-1\"}",
                "{\"order_nsu\":\"nao-e-uuid\"}",
                "{\"order_nsu\":\"nao-e-uuid\",\"transaction_nsu\":\"TX-1\"}",
                "{\"order_nsu\":\"1-1-1-1-1\",\"transaction_nsu\":\"TX-1\"}",
                "{\"order_nsu\":12345,\"transaction_nsu\":\"TX-1\"}",
                "{\"order_nsu\":\"" + PEDIDO + "\",\"transaction_nsu\":\"\"}",
                "{\"order_nsu\":\"" + PEDIDO + "\",\"transaction_nsu\":\"com espaço\"}",
                "{\"order_nsu\":\"" + PEDIDO + "\",\"transaction_nsu\":\"../etc\"}",
                "{\"order_nsu\":\"" + PEDIDO + "\",\"transaction_nsu\":\"" + longo + "\"}",
                "{\"order_nsu\":\"" + PEDIDO + "\",\"transaction_nsu\":42}",
                "{\"order_nsu\":\"" + PEDIDO + "\",\"transaction_nsu\":\"TX-1\",\"invoice_slug\":\"com espaço\"}",
                "{\"order_nsu\":\"" + PEDIDO + "\",\"transaction_nsu\":\"TX-1\",\"invoice_slug\":\"" + longo + "\"}",
                "{\"order_nsu\":\"" + PEDIDO + "\",\"transaction_nsu\":\"TX-1\",\"invoice_slug\":{\"a\":1}}");
        for (String corpo : invalidos) {
            assertThatThrownBy(() -> provedor.lerWebhook(webhook(corpo)))
                    .as(corpo).isInstanceOf(WebhookInvalidoException.class).hasMessage("Aviso do provedor inválido.");
        }
    }

    @Test
    void avisoMaiorQue16KiBELancado() {
        String enchimento = "a".repeat(16 * 1024);
        String corpo = "{\"order_nsu\":\"" + PEDIDO + "\",\"transaction_nsu\":\"TX-1\",\"receipt_url\":\"" + enchimento + "\"}";

        assertThat(corpo.getBytes(StandardCharsets.UTF_8).length).isGreaterThan(16 * 1024);
        assertThatThrownBy(() -> provedor.lerWebhook(webhook(corpo))).isInstanceOf(WebhookInvalidoException.class);
        assertThatThrownBy(() -> provedor.lerWebhook(new RequisicaoDeWebhook(Map.of(), new byte[16 * 1024 + 1])))
                .isInstanceOf(WebhookInvalidoException.class);
    }

    @Test
    void camposExtrasDoAvisoNaoVazamParaAExcecao() {
        String corpo = "{\"order_nsu\":\"nao-e-uuid\",\"transaction_nsu\":\"TX-1\",\"receipt_url\":\"https://RECIBO-SECRETO.falso.test\","
                + "\"items\":[{\"description\":\"ITEM-SECRETO\"}],\"card\":\"CARTAO-SECRETO\"}";

        Throwable erro = catchThrowable(() -> provedor.lerWebhook(webhook(corpo)));

        assertThat(erro).isInstanceOf(WebhookInvalidoException.class);
        assertThat(erro.toString()).doesNotContain("SECRETO").doesNotContain("nao-e-uuid");
        assertThat(erro.getCause()).isNull();
        assertThat(erro.getSuppressed()).isEmpty();
    }
}
