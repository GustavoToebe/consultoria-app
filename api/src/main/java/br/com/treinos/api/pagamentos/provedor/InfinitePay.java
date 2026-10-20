package br.com.treinos.api.pagamentos.provedor;

import br.com.treinos.api.pagamentos.FormaDePagamento;
import br.com.treinos.api.web.Fuso;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.net.URI;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Adaptador da InfinitePay (checkout por link). HTTP puro: sem banco, a credencial vem por parâmetro e o segredo nunca
 * aparece em log nem em erro. Um link por cobrança ({@code order_nsu} = id da cobrança), com Pix e cartão. Não envia dado
 * do aluno ({@code customer}, {@code address}): só valor, descrição, a Tag do treinador e as URLs.
 *
 * <p>O corpo do {@code /links} muda com a credencial. Com API Key vão as opções do link ({@code options}: pagamento único,
 * validade, Pix e cartão, parcelas sem juros) e o aviso como objeto {@code webhook} (eventos {@code paid} e {@code refunded}).
 * Sem chave vão só os campos básicos e o aviso como {@code webhook_url}: o link paga mais de uma vez e não vence.
 *
 * <p>O webhook da InfinitePay não tem assinatura: {@link #lerWebhook} só extrai os identificadores (formato estrito) e o nome
 * do evento, se for conhecido, e todo aviso vale como "consulte de novo" ({@link #consultar}, via {@code payment_check}).
 *
 * <p>A resposta do {@code /links} não é documentada com certeza: aceita {@code url} ou {@code link} (e {@code slug}).
 */
@Component
public class InfinitePay implements ProvedorDePagamento {

    public static final String CODIGO = "INFINITEPAY";

    private static final int MAXIMO_DO_AVISO = 16 * 1024;
    private static final Pattern UUID_CANONICO = Pattern.compile(
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
    private static final Pattern IDENTIFICADOR = Pattern.compile("^[A-Za-z0-9._-]{1,100}$");
    /** {@code link_url} cabe em 500 caracteres no banco. */
    private static final int MAXIMO_DA_URL = 500;
    /** Os eventos que o webhook diz ter (central de ajuda); qualquer outro nome é ignorado, sem erro. */
    private static final Set<String> EVENTOS = Set.of("created", "paid", "settled", "canceled", EventoDeWebhook.ESTORNO,
            "payment_failed");
    /** {@code forma_capturada} cabe em 20 caracteres no banco. */
    private static final int MAXIMO_DA_FORMA = 20;
    private static final int MAXIMO_DE_PARCELAS = 99;

    private final InfinitePayCliente cliente;

    InfinitePay(InfinitePayCliente cliente) {
        this.cliente = cliente;
    }

    @Override
    public String codigo() {
        return CODIGO;
    }

    @Override
    public CapacidadesDoProvedor capacidades() {
        return new CapacidadesDoProvedor(true, false, true, 12, false, true, false, true, true);
    }

    @Override
    public CobrancaGerada gerarCobranca(CredencialDoProvedor credencial, PedidoDeCobranca pedido) {
        if (pedido.valorCentavos() <= 0 || pedido.descricao() == null || pedido.descricao().isBlank()) {
            throw new IllegalArgumentException("Pedido de cobrança incompleto.");
        }
        boolean comChave = credencial.segredo() != null;
        if (comChave && (pedido.validade() == null || pedido.parcelasSemJuros() < 0 || pedido.parcelasSemJuros() > 12)) {
            throw new IllegalArgumentException("Pedido de cobrança incompleto.");
        }
        ObjectNode corpo = cliente.json().createObjectNode();
        corpo.put("handle", credencial.conta());
        ObjectNode item = corpo.putArray("items").addObject();
        item.put("quantity", 1);
        item.put("price", pedido.valorCentavos());
        item.put("description", pedido.descricao());
        corpo.put("order_nsu", pedido.referencia().toString());
        if (pedido.urlDeRetorno() != null && pedido.urlDeRetorno().startsWith("https://")) {
            corpo.put("redirect_url", pedido.urlDeRetorno());
        }
        if (comChave) {
            // Só quem tem chave pode pedir opções do link; sem ela o provedor aceita apenas o básico.
            ObjectNode opcoes = corpo.putObject("options");
            opcoes.put("single_payment", true);
            opcoes.put("valid_until", pedido.validade().truncatedTo(ChronoUnit.SECONDS).toString());
            ArrayNode metodos = opcoes.putArray("payment_methods_enabled");
            metodos.add("pix");
            metodos.add("credit_card");
            opcoes.put("assured_installments", pedido.parcelasSemJuros());
            if (pedido.urlDoAviso() != null) {
                ObjectNode aviso = corpo.putObject("webhook");
                aviso.put("url", pedido.urlDoAviso());
                ArrayNode eventos = aviso.putArray("events");
                eventos.add("paid");
                eventos.add(EventoDeWebhook.ESTORNO);
            }
        } else if (pedido.urlDoAviso() != null) {
            corpo.put("webhook_url", pedido.urlDoAviso());
        }

        JsonNode resposta = cliente.postar("/links", credencial.segredo(), corpo);
        String url = texto(resposta, "url");
        if (url == null) {
            url = texto(resposta, "link");
        }
        if (!urlValida(url)) {
            throw new ProvedorIndisponivelException();
        }
        String slug = texto(resposta, "slug");
        if (resposta.hasNonNull("slug") && (slug == null || !IDENTIFICADOR.matcher(slug).matches())) {
            throw new ProvedorIndisponivelException();
        }
        return new CobrancaGerada(pedido.referencia().toString(), url, slug);
    }

    /**
     * {@code payment_check}: PAGA se {@code success && paid}, ABERTA se {@code success} e não pago (para o conciliador,
     * transação já aplicada que deixa de vir paga é só um estorno informado, para o treinador conferir) e
     * {@link ProvedorIndisponivelException} se {@code success} não for true. A API não devolve a data do pagamento, então {@code pagoEm} é hoje em Brasília,
     * o dia em que a consulta viu o pagamento. O valor conferido é {@code amount} (o do link); {@code paid_amount} pode
     * ter juros de parcelamento.
     */
    @Override
    public ConsultaDeCobranca consultar(CredencialDoProvedor credencial, PedidoDeConsulta pedido) {
        if (pedido.referencia() == null || pedido.idExterno() == null || pedido.idExterno().isBlank()) {
            throw new IllegalArgumentException("Pedido de consulta incompleto.");
        }
        ObjectNode corpo = cliente.json().createObjectNode();
        corpo.put("handle", credencial.conta());
        corpo.put("order_nsu", pedido.referencia().toString());
        corpo.put("transaction_nsu", pedido.idExterno());
        if (pedido.slug() != null) {
            corpo.put("slug", pedido.slug());
        }
        JsonNode resposta = cliente.postar("/payment_check", credencial.segredo(), corpo);
        // Sem success=true a resposta não diz que a cobrança não foi paga, só que a consulta não deu certo: tratar como
        // "não paga" marcaria como estorno informado um pagamento que valeu (chave errada, erro do lado deles).
        if (!resposta.path("success").isBoolean() || !resposta.path("success").asBoolean(false)) {
            throw new ProvedorIndisponivelException();
        }
        boolean paga = resposta.path("paid").isBoolean() && resposta.path("paid").asBoolean(false);
        Long valor = centavos(resposta.path("amount"));
        if (!paga) {
            return new ConsultaDeCobranca(SituacaoNormalizada.ABERTA, null, null, null, valor, null, null);
        }
        String captura = texto(resposta, "capture_method");
        return new ConsultaDeCobranca(SituacaoNormalizada.PAGA, forma(captura), LocalDate.now(Fuso.BRASILIA),
                centavos(resposta.path("paid_amount")), valor, parcelas(resposta.path("installments")),
                formaCapturada(captura));
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
            // A mensagem do Jackson cita pedaços do corpo: não vira causa.
            throw new WebhookInvalidoException();
        }
        if (raiz == null || !raiz.isObject()) {
            throw new WebhookInvalidoException();
        }
        String pedido = texto(raiz, "order_nsu");
        if (pedido == null || !UUID_CANONICO.matcher(pedido).matches()) {
            throw new WebhookInvalidoException();
        }
        // Aviso de antes de haver transação (pedido criado, cancelado): não há o que consultar. Não é erro, senão a
        // InfinitePay reenviaria; o chamador responde 200 sem gravar. Presente e malformada continua inválida.
        String evento = evento(raiz);
        if (!raiz.hasNonNull("transaction_nsu")) {
            return new EventoDeWebhook(null, UUID.fromString(pedido), null, null, evento);
        }
        String transacao = texto(raiz, "transaction_nsu");
        if (transacao == null || !IDENTIFICADOR.matcher(transacao).matches()) {
            throw new WebhookInvalidoException();
        }
        String slug = texto(raiz, "invoice_slug");
        if (raiz.hasNonNull("invoice_slug") && (slug == null || !IDENTIFICADOR.matcher(slug).matches())) {
            throw new WebhookInvalidoException();
        }
        // O mesmo aviso repetido traz a mesma transação: ela é o id estável.
        return new EventoDeWebhook(transacao, UUID.fromString(pedido), transacao, slug, evento);
    }

    /** O nome do evento só se é um dos conhecidos: outro nome, outro tipo ou nome longo demais é ignorado, nunca erro. */
    private static String evento(JsonNode raiz) {
        String nome = texto(raiz, "event");
        return nome != null && EVENTOS.contains(nome) ? nome : null;
    }

    /** O texto do campo, ou nulo se falta, é nulo ou não é texto. */
    private static String texto(JsonNode no, String campo) {
        JsonNode valor = no.path(campo);
        return valor.isString() ? valor.asString() : null;
    }

    /** Só número inteiro: valor com casa decimal ou texto fica nulo, nunca é arredondado. */
    private static Long centavos(JsonNode valor) {
        return valor.isIntegralNumber() && valor.canConvertToLong() ? valor.longValue() : null;
    }

    /** Número de parcelas informado: inteiro de 1 a 99, senão nulo (é só informação, nunca decide nada). */
    private static Integer parcelas(JsonNode valor) {
        return valor.isIntegralNumber() && valor.canConvertToInt() && valor.intValue() >= 1
                && valor.intValue() <= MAXIMO_DE_PARCELAS ? valor.intValue() : null;
    }

    /** O meio como veio, em minúsculas e só com letras, dígitos, hífen e sublinhado, no tamanho da coluna; vazio vira nulo. */
    private static String formaCapturada(String captura) {
        if (captura == null) {
            return null;
        }
        String limpa = captura.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]", "");
        if (limpa.length() > MAXIMO_DA_FORMA) {
            limpa = limpa.substring(0, MAXIMO_DA_FORMA);
        }
        return limpa.isEmpty() ? null : limpa;
    }

    /** Pix e cartão de crédito; qualquer outro meio fica sem forma (a conferência trata), nunca chutado. */
    private static FormaDePagamento forma(String captura) {
        if ("pix".equals(captura)) {
            return FormaDePagamento.PIX;
        }
        if ("credit_card".equals(captura)) {
            return FormaDePagamento.CARTAO;
        }
        return null;
    }

    /** O link vai para o navegador do aluno: só https com host, no tamanho que o banco guarda. */
    private static boolean urlValida(String url) {
        if (url == null || url.length() > MAXIMO_DA_URL) {
            return false;
        }
        try {
            URI uri = URI.create(url);
            return "https".equals(uri.getScheme()) && uri.getHost() != null;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
