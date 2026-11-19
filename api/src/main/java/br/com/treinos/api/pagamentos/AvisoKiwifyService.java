package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.CorpoExcedidoException;
import br.com.plataforma.comum.web.UnauthorizedException;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * O aviso (webhook) da Kiwify. É assinado: a Kiwify acrescenta {@code ?signature=} com o HMAC-SHA1 (hex minúsculo, 40
 * caracteres) do corpo CRU, usando como chave o token do webhook (que nunca viaja). Aqui o aviso é verificado, lido, guardado
 * na caixa de entrada e respondido com 200; quem confere a venda e dá a baixa é o conciliador, que pergunta à Kiwify. O aviso
 * sozinho NUNCA dá baixa. Nenhuma chamada de rede, nenhum log do corpo, do token, da assinatura nem do e-mail do comprador.
 *
 * <p>Ordem: formato do token (404), teto do corpo (413), token do caminho conhecido (404, nada gravado), assinatura (401, nada
 * gravado: ausente, fora do formato ou errada), leitura do corpo (400 {@code AVISO_INVALIDO}), sem {@code order_id} ou evento
 * que não interessa (200 sem gravar) e gravação. A comparação é em tempo constante ({@link MessageDigest#isEqual}), sobre o
 * token atual E o anterior enquanto vale (a Kiwify reenvia, até um dia depois da troca, entregas que falharam antes dela). A
 * assinatura não tem data nem id de entrega, então não protege de replay: a idempotência é por {@code order_id} + evento, e o
 * conciliador sempre consulta a venda antes de qualquer baixa.
 */
@Service
public class AvisoKiwifyService {

    /** Teto do corpo do aviso; o do pedido inteiro (1 MiB) continua valendo por cima. */
    public static final int MAXIMO_DO_CORPO = AvisoInfinitePayService.MAXIMO_DO_CORPO;

    /** Os {@code webhook_event_type} que a conciliação trata; qualquer outro (recusada, Pix gerado, atraso...) é 200 sem gravar. */
    static final String APROVADA = "order_approved";
    static final String RENOVADA = "subscription_renewed";
    static final String REEMBOLSADA = "order_refunded";
    static final String CHARGEBACK = "chargeback";
    static final String CANCELADA = "subscription_canceled";
    static final Set<String> EVENTOS = Set.of(APROVADA, RENOVADA, REEMBOLSADA, CHARGEBACK, CANCELADA);

    private static final Pattern TOKEN = Pattern.compile("^[A-Za-z0-9_-]{20,64}$");
    private static final Pattern ASSINATURA = Pattern.compile("^[0-9a-f]{40}$");
    private static final Pattern IDENTIFICADOR = Pattern.compile("^[A-Za-z0-9._-]{1,100}$");
    /** A transação do aviso é {@code order_id + ":" + evento} (o mais longo, "subscription_canceled", tem 21) em varchar(100): 100 - 22. */
    private static final Pattern ORDER_ID = Pattern.compile("^[A-Za-z0-9._-]{1,78}$");

    /** Os tokens do webhook que ainda valem (decifrados só em memória, só para esta conferência). */
    record Chaves(String atual, String anterior) {

        @Override
        public String toString() {
            return "Chaves[...]";
        }
    }

    private final AvisoDePagamentoRepositorio avisos;
    private final CredencialKiwifyRepository credenciais;
    private final CifraDePagamento cifra;
    private final JsonMapper json;
    private final TransactionTemplate leitura;
    private final TransactionTemplate gravacao;

    public AvisoKiwifyService(AvisoDePagamentoRepositorio avisos, CredencialKiwifyRepository credenciais, CifraDePagamento cifra,
                              JsonMapper json, PlatformTransactionManager transacoes) {
        this.avisos = avisos;
        this.credenciais = credenciais;
        this.cifra = cifra;
        this.json = json;
        this.leitura = new TransactionTemplate(transacoes);
        this.leitura.setReadOnly(true);
        this.gravacao = new TransactionTemplate(transacoes);
    }

    public void receber(String token, byte[] corpo, String assinatura) {
        if (token == null || !TOKEN.matcher(token).matches()) {
            throw naoEncontrado();
        }
        if (corpo.length > MAXIMO_DO_CORPO) {
            throw new CorpoExcedidoException();
        }
        UUID consultoria = avisos.consultoriaDoTokenDaKiwify(token).orElseThrow(AvisoKiwifyService::naoEncontrado);
        if (assinatura == null || !ASSINATURA.matcher(assinatura).matches()) {
            throw naoAssinado();
        }
        Chaves chaves = TenantContext.executarComo(consultoria, () -> leitura.execute(status -> chaves(consultoria)))
                .orElseThrow(AvisoKiwifyService::naoEncontrado);
        if (!assinaturaConfere(corpo, assinatura, chaves)) {
            throw naoAssinado();
        }
        JsonNode raiz;
        try {
            raiz = json.readTree(corpo);
        } catch (RuntimeException e) {
            // A mensagem do Jackson cita pedaços do corpo: não vira causa.
            throw invalido();
        }
        if (raiz == null || !raiz.isObject()) {
            throw invalido();
        }
        JsonNode pedido = raiz.path("order_id");
        if (pedido.isMissingNode() || pedido.isNull()) {
            return;
        }
        String orderId = pedido.isString() ? pedido.asString().strip() : null;
        if (orderId == null || !ORDER_ID.matcher(orderId).matches()) {
            throw invalido();
        }
        String evento = raiz.path("webhook_event_type").isString() ? raiz.path("webhook_event_type").asString() : null;
        if (evento == null || !EVENTOS.contains(evento)) {
            return;
        }
        String assinaturaId = raiz.path("subscription_id").isString() ? raiz.path("subscription_id").asString().strip() : null;
        if (assinaturaId != null && !IDENTIFICADOR.matcher(assinaturaId).matches()) {
            assinaturaId = null;
        }
        String hash = AvisoInfinitePayService.sha256(corpo);
        String assinaturaGravada = assinaturaId;
        TenantContext.executarComo(consultoria, () -> gravacao.execute(status ->
                avisos.registrarDaKiwify(consultoria, orderId, evento, assinaturaGravada, hash)));
    }

    /** O token atual e, enquanto vale, o anterior, decifrados. Vazio se a credencial foi removida no meio. */
    private Optional<Chaves> chaves(UUID consultoria) {
        return credenciais.daConsultoria().map(c -> {
            String atual = cifra.decifrar(consultoria, c.getTokenWebhookCifrado());
            boolean anteriorVale = c.getTokenWebhookAnteriorCifrado() != null && c.getAnteriorValidoAte() != null
                    && c.getAnteriorValidoAte().isAfter(Instant.now());
            return new Chaves(atual, anteriorVale ? cifra.decifrar(consultoria, c.getTokenWebhookAnteriorCifrado()) : null);
        });
    }

    /**
     * HMAC-SHA1 do corpo cru com cada token válido, em hex minúsculo, comparado em tempo constante com o recebido. As duas
     * comparações sempre rodam (sem curto-circuito), para o tempo não dizer qual token bateu.
     */
    static boolean assinaturaConfere(byte[] corpo, String recebida, Chaves chaves) {
        byte[] recebido = recebida.getBytes(StandardCharsets.US_ASCII);
        boolean atual = MessageDigest.isEqual(hmacHex(chaves.atual(), corpo), recebido);
        boolean anterior = chaves.anterior() != null && MessageDigest.isEqual(hmacHex(chaves.anterior(), corpo), recebido);
        return atual | anterior;
    }

    static byte[] hmacHex(String token, byte[] corpo) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(token.getBytes(StandardCharsets.UTF_8), "HmacSHA1"));
            return HexFormat.of().formatHex(mac.doFinal(corpo)).getBytes(StandardCharsets.US_ASCII);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HMAC-SHA1 indisponível.");
        }
    }

    /** O mesmo 404 para token fora do formato e token desconhecido: nada revela qual dos dois foi. */
    private static NaoEncontradoException naoEncontrado() {
        return new NaoEncontradoException("Não encontrado.");
    }

    /** Mensagem fixa: nunca diz se faltou, veio torta ou não bateu. */
    private static UnauthorizedException naoAssinado() {
        return new UnauthorizedException("Aviso não autenticado.", "AVISO_NAO_AUTENTICADO");
    }

    private static BadRequestException invalido() {
        return new BadRequestException("Aviso inválido.", "AVISO_INVALIDO");
    }
}
