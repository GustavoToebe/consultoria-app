package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.CorpoExcedidoException;
import br.com.plataforma.comum.web.UnauthorizedException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.pagamentos.provedor.AsaasCliente;
import br.com.treinos.api.pagamentos.provedor.ProvedorAsaas;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Recebe e autentica os webhooks do Asaas (Overtraining Pay).
 * <p>
 * Ordem: formato do {@code tokenCaminho} (404), teto de 16 KiB (413), consultoria do token (404), validação em tempo
 * constante do cabeçalho {@code asaas-access-token} contra o token atual e o anterior na janela de 24h (401), leitura
 * JSON (400). Nunca grava o corpo cru nem registra tokens ou dados do pagador em log.
 */
@Service
public class AvisoAsaasService {

    public static final int MAXIMO_DO_CORPO = AvisoInfinitePayService.MAXIMO_DO_CORPO;

    private static final String PREFIXO_TESTE = "TESTE:";
    private static final Pattern TOKEN = Pattern.compile("^[A-Za-z0-9_-]{20,64}$");
    private static final Pattern IDENTIFICADOR = Pattern.compile("^[A-Za-z0-9._-]{1,100}$");
    private static final Pattern UUID_CANONICO = Pattern.compile(
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    private static final Set<String> EVENTOS_PAGO = Set.of("PAYMENT_RECEIVED", "PAYMENT_CONFIRMED");
    private static final Set<String> EVENTOS_ESTORNO = AsaasCliente.EVENTOS_DE_ESTORNO;
    private static final Set<String> EVENTOS_CONHECIDOS = ProvedorAsaas.EVENTOS;

    record ChavesSubconta(String tokenAtual, String tokenAnterior, String apiKey, String cobrancaTesteId) {
        @Override
        public String toString() {
            return "[PROTEGIDO]";
        }
    }

    private final AvisoDePagamentoRepositorio avisos;
    private final SubcontaAsaasRepository subcontas;
    private final CifraDePagamento cifra;
    private final AsaasCliente asaasCliente;
    private final OvertrainingPayService overtrainingPayService;
    private final Auditoria auditoria;
    private final JsonMapper json;
    private final TransactionTemplate leitura;
    private final TransactionTemplate gravacao;

    public AvisoAsaasService(AvisoDePagamentoRepositorio avisos, SubcontaAsaasRepository subcontas,
                             CifraDePagamento cifra, AsaasCliente asaasCliente,
                             OvertrainingPayService overtrainingPayService, Auditoria auditoria,
                             JsonMapper json, PlatformTransactionManager transacoes) {
        this.avisos = avisos;
        this.subcontas = subcontas;
        this.cifra = cifra;
        this.asaasCliente = asaasCliente;
        this.overtrainingPayService = overtrainingPayService;
        this.auditoria = auditoria;
        this.json = json;
        this.leitura = new TransactionTemplate(transacoes);
        this.leitura.setReadOnly(true);
        this.gravacao = new TransactionTemplate(transacoes);
    }

    public void receber(String tokenCaminho, byte[] corpo, String accessToken) {
        if (tokenCaminho == null || !TOKEN.matcher(tokenCaminho).matches()) {
            throw naoEncontrado();
        }
        if (corpo.length > MAXIMO_DO_CORPO) {
            throw new CorpoExcedidoException();
        }
        UUID consultoria = avisos.consultoriaDoTokenDoAsaas(tokenCaminho)
                .orElseThrow(AvisoAsaasService::naoEncontrado);
        if (accessToken == null || accessToken.isBlank()) {
            throw naoAutenticado();
        }

        ChavesSubconta chaves = TenantContext.executarComo(consultoria, () -> leitura.execute(st -> lerChaves(consultoria)))
                .orElseThrow(AvisoAsaasService::naoEncontrado);
        if (!tokenConfere(accessToken, chaves)) {
            throw naoAutenticado();
        }

        JsonNode raiz;
        try {
            raiz = json.readTree(corpo);
        } catch (RuntimeException e) {
            throw invalido();
        }
        if (raiz == null || !raiz.isObject()) {
            throw invalido();
        }

        String evento = texto(raiz, "event");
        if (evento == null || !EVENTOS_CONHECIDOS.contains(evento)) {
            return;
        }
        JsonNode payment = raiz.path("payment");
        if (!payment.isObject()) {
            throw invalido();
        }
        String paymentId = texto(payment, "id");
        if (paymentId == null || !IDENTIFICADOR.matcher(paymentId).matches()) {
            throw invalido();
        }
        String referencia = texto(payment, "externalReference");

        boolean ehTeste = (referencia != null && referencia.startsWith(PREFIXO_TESTE))
                || (chaves.cobrancaTesteId() != null && chaves.cobrancaTesteId().equals(paymentId));
        if (ehTeste) {
            if (EVENTOS_PAGO.contains(evento) && chaves.apiKey() != null) {
                // Consulta GET /payments/{id} fora de transação antes de homologar a subconta.
                AsaasCliente.CobrancaConsultadaAsaas consultada = asaasCliente.consultarCobranca(chaves.apiKey(),
                        paymentId);
                if (CheckoutTransparenteAsaasService.estaPagaNoAsaas(consultada.status())) {
                    overtrainingPayService.confirmarCobrancaTesteSeAplicavel(consultoria, paymentId);
                }
            }
            return;
        }

        if (referencia == null || !UUID_CANONICO.matcher(referencia).matches()) {
            return;
        }

        String hash = AvisoInfinitePayService.sha256(corpo);
        if (EVENTOS_ESTORNO.contains(evento)) {
            TenantContext.executarComo(consultoria, () -> gravacao.execute(st -> {
                avisos.registrarEstorno(consultoria, ProvedorAsaas.CODIGO, referencia, paymentId, null, hash)
                        .ifPresent(estorno -> {
                            if (estorno.foiParaConferir()) {
                                auditoria.registrarDoSistema(consultoria, "PAGAMENTO_PARA_CONFERIR",
                                        "AVISO_DE_PAGAMENTO", estorno.id(),
                                        ConclusaoDoAvisoAsaas.RESUMO_ESTORNO_INFORMADO);
                            }
                        });
                return Boolean.TRUE;
            }));
        } else if (EVENTOS_PAGO.contains(evento)) {
            TenantContext.executarComo(consultoria, () -> gravacao.execute(st ->
                    avisos.registrar(consultoria, ProvedorAsaas.CODIGO, referencia, paymentId, null, hash, false)));
        }
    }

    private Optional<ChavesSubconta> lerChaves(UUID consultoria) {
        return subcontas.daConsultoria().map(s -> {
            String atual = cifra.decifrar(consultoria, s.getTokenWebhookCifrado());
            boolean anteriorVale = s.getTokenWebhookAnteriorCifrado() != null && s.getAnteriorValidoAte() != null
                    && s.getAnteriorValidoAte().isAfter(Instant.now());
            String anterior = anteriorVale ? cifra.decifrar(consultoria, s.getTokenWebhookAnteriorCifrado()) : null;
            String apiKey = s.getApiKeyCifrada() != null ? cifra.decifrar(consultoria, s.getApiKeyCifrada()) : null;
            return new ChavesSubconta(atual, anterior, apiKey, s.getCobrancaTesteId());
        });
    }

    /** Comparação em tempo constante contra o token atual e o anterior (sem curto-circuito). */
    static boolean tokenConfere(String recebido, ChavesSubconta chaves) {
        byte[] rec = recebido.getBytes(StandardCharsets.UTF_8);
        boolean atual = MessageDigest.isEqual(chaves.tokenAtual().getBytes(StandardCharsets.UTF_8), rec);
        boolean anterior = chaves.tokenAnterior() != null
                && MessageDigest.isEqual(chaves.tokenAnterior().getBytes(StandardCharsets.UTF_8), rec);
        return atual | anterior;
    }

    private static String texto(JsonNode no, String campo) {
        JsonNode v = no.path(campo);
        return v.isString() && !v.asString().isBlank() ? v.asString().strip() : null;
    }

    private static NaoEncontradoException naoEncontrado() {
        return new NaoEncontradoException("Não encontrado.");
    }

    private static UnauthorizedException naoAutenticado() {
        return new UnauthorizedException("Aviso não autenticado.", "AVISO_NAO_AUTENTICADO");
    }

    private static BadRequestException invalido() {
        return new BadRequestException("Aviso inválido.", "AVISO_INVALIDO");
    }
}
