package br.com.treinos.api.pagamentos.provedor;

import br.com.treinos.api.pagamentos.FormaDePagamento;
import br.com.treinos.api.web.Fuso;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Adaptador do provedor {@code ASAAS} (Overtraining Pay) que cumpre {@link ProvedorDePagamento}.
 * HTTP puro via {@link AsaasCliente}; nunca acessa banco nem registra segredos em logs ou exceções.
 */
@Component
public class ProvedorAsaas implements ProvedorDePagamento {

    public static final String CODIGO = "ASAAS";

    private static final int MAXIMO_DO_AVISO = 16 * 1024;
    private static final Pattern UUID_CANONICO = Pattern.compile(
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
    private static final Pattern IDENTIFICADOR = Pattern.compile("^[A-Za-z0-9._-]{1,100}$");
    private static final Set<String> EVENTOS = Set.of(
            "PAYMENT_CREATED", "PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_OVERDUE",
            "PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_DELETED");

    private final AsaasCliente cliente;

    public ProvedorAsaas(AsaasCliente cliente) {
        this.cliente = cliente;
    }

    @Override
    public String codigo() {
        return CODIGO;
    }

    @Override
    public CapacidadesDoProvedor capacidades() {
        return new CapacidadesDoProvedor(true, false, true, 12, false, true, true, true, true);
    }

    @Override
    public CobrancaGerada gerarCobranca(CredencialDoProvedor credencial, PedidoDeCobranca pedido) {
        if (credencial == null || credencial.segredo() == null || credencial.segredo().isBlank()
                || credencial.conta() == null || credencial.conta().isBlank()
                || pedido == null || pedido.referencia() == null
                || pedido.valorCentavos() < AsaasCliente.VALOR_MINIMO_CENTAVOS
                || pedido.descricao() == null || pedido.descricao().isBlank()) {
            throw new IllegalArgumentException("Pedido de cobrança Asaas incompleto.");
        }
        LocalDate vencimento = pedido.vencimento() != null ? pedido.vencimento() : LocalDate.now(Fuso.BRASILIA);
        var criada = cliente.criarCobrancaPix(credencial.segredo(), new AsaasCliente.PedidoPixAsaas(
                credencial.conta(), pedido.valorCentavos(), vencimento, pedido.descricao(),
                pedido.referencia().toString(), null, List.of()));
        String link = criada.invoiceUrl() != null && !criada.invoiceUrl().isBlank()
                ? criada.invoiceUrl() : criada.pixCopiaECola();
        if (link == null || link.isBlank()) {
            throw new ProvedorIndisponivelException();
        }
        return new CobrancaGerada(criada.paymentId(), link, null);
    }

    @Override
    public ConsultaDeCobranca consultar(CredencialDoProvedor credencial, PedidoDeConsulta pedido) {
        if (credencial == null || credencial.segredo() == null || credencial.segredo().isBlank()
                || pedido == null || pedido.idExterno() == null || pedido.idExterno().isBlank()) {
            throw new IllegalArgumentException("Pedido de consulta Asaas incompleto.");
        }
        var c = cliente.consultarCobranca(credencial.segredo(), pedido.idExterno());
        SituacaoNormalizada situacao = mapearSituacao(c.status());
        if (situacao != SituacaoNormalizada.PAGA) {
            return new ConsultaDeCobranca(situacao, null, null, null, c.valorCentavos(), c.parcelas(),
                    normalizarForma(c.billingType()));
        }
        LocalDate pagoEm = c.pagoEm() != null ? c.pagoEm() : LocalDate.now(Fuso.BRASILIA);
        return new ConsultaDeCobranca(SituacaoNormalizada.PAGA, mapearForma(c.billingType()), pagoEm,
                c.valorCentavos(), c.valorCentavos(), c.parcelas(), normalizarForma(c.billingType()));
    }

    @Override
    public EventoDeWebhook lerWebhook(RequisicaoDeWebhook requisicao) {
        byte[] bytes = requisicao.corpo();
        if (bytes.length == 0 || bytes.length > MAXIMO_DO_AVISO) {
            throw new WebhookInvalidoException();
        }
        JsonNode raiz;
        try {
            raiz = cliente.json().readTree(bytes);
        } catch (RuntimeException e) {
            throw new WebhookInvalidoException();
        }
        if (raiz == null || !raiz.isObject()) {
            throw new WebhookInvalidoException();
        }
        String evento = texto(raiz, "event");
        if (evento == null || !EVENTOS.contains(evento)) {
            throw new WebhookInvalidoException();
        }
        JsonNode payment = raiz.path("payment");
        if (!payment.isObject()) {
            throw new WebhookInvalidoException();
        }
        String paymentId = texto(payment, "id");
        if (paymentId == null || !IDENTIFICADOR.matcher(paymentId).matches()) {
            throw new WebhookInvalidoException();
        }
        String referencia = texto(payment, "externalReference");
        if (referencia == null || !UUID_CANONICO.matcher(referencia).matches()) {
            throw new WebhookInvalidoException();
        }
        String eventoNormalizado = "PAYMENT_REFUNDED".equals(evento) ? EventoDeWebhook.ESTORNO
                : evento.toLowerCase(Locale.ROOT);
        String idEvento = paymentId + ":" + evento;
        return new EventoDeWebhook(idEvento, UUID.fromString(referencia), paymentId, null, eventoNormalizado);
    }

    private static SituacaoNormalizada mapearSituacao(String status) {
        if (status == null) {
            return SituacaoNormalizada.ABERTA;
        }
        return switch (status.toUpperCase(Locale.ROOT)) {
            case "RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH" -> SituacaoNormalizada.PAGA;
            case "REFUNDED", "REFUND_REQUESTED", "REFUND_IN_PROGRESS" -> SituacaoNormalizada.ESTORNADA;
            case "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL" -> SituacaoNormalizada.CONTESTADA;
            case "DELETED" -> SituacaoNormalizada.CANCELADA;
            default -> SituacaoNormalizada.ABERTA;
        };
    }

    private static FormaDePagamento mapearForma(String billingType) {
        if (billingType == null) {
            return null;
        }
        return switch (billingType.toUpperCase(Locale.ROOT)) {
            case "PIX" -> FormaDePagamento.PIX;
            case "CREDIT_CARD" -> FormaDePagamento.CARTAO;
            default -> null;
        };
    }

    private static String normalizarForma(String billingType) {
        if (billingType == null) {
            return null;
        }
        String limpa = billingType.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]", "");
        if (limpa.length() > 20) {
            limpa = limpa.substring(0, 20);
        }
        return limpa.isEmpty() ? null : limpa;
    }

    private static String texto(JsonNode no, String campo) {
        JsonNode valor = no.path(campo);
        return valor.isString() && !valor.asString().isBlank() ? valor.asString().strip() : null;
    }
}
