package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.CorpoExcedidoException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.pagamentos.PagamentosDtos.RetornoDoPagamentoRequest;
import br.com.treinos.api.pagamentos.provedor.EventoDeWebhook;
import br.com.treinos.api.pagamentos.provedor.ProvedoresDePagamento;
import br.com.treinos.api.pagamentos.provedor.RequisicaoDeWebhook;
import br.com.treinos.api.pagamentos.provedor.WebhookInvalidoException;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * O aviso (webhook) da InfinitePay. Não é assinado e não traz tipo de evento confiável, então vale só como "consulte de
 * novo": aqui ele é lido, guardado na caixa de entrada e respondido com 200; quem confere o pagamento é o conciliador, que
 * pergunta à InfinitePay. Nenhuma chamada de rede, nenhum log do corpo, do token ou da Tag.
 *
 * <p>O retorno do navegador do aluno ({@link #registrarRetorno}) entra na mesma caixa e com o mesmo upsert: também só
 * diz "consulte de novo", e a baixa é do conciliador, depois do {@code payment_check}.
 *
 * <p>Sem limite por IP: a InfinitePay envia de vários endereços. O token (aleatório, no caminho), o teto de 16 KiB, o teto
 * de avisos por cobrança ({@link AvisoDePagamentoRepositorio#registrar}) e o upsert idempotente bastam. A gravação do
 * webhook roda em {@link TenantContext#executarComo} com a transação aberta dentro do bloco.
 */
@Service
public class AvisoInfinitePayService {

    /** Teto do corpo do aviso; o do pedido inteiro (1 MiB) continua valendo por cima. */
    public static final int MAXIMO_DO_CORPO = 16 * 1024;

    private static final Pattern TOKEN = Pattern.compile("^[A-Za-z0-9_-]{20,64}$");

    private final AvisoDePagamentoRepositorio avisos;
    private final ProvedoresDePagamento provedores;
    private final CobrancaAlunoRepository cobrancas;
    private final CredencialPagamentoRepository credenciais;
    private final Auditoria auditoria;
    private final TransactionTemplate gravacao;

    public AvisoInfinitePayService(AvisoDePagamentoRepositorio avisos, ProvedoresDePagamento provedores,
                                   CobrancaAlunoRepository cobrancas, CredencialPagamentoRepository credenciais,
                                   Auditoria auditoria, PlatformTransactionManager transacoes) {
        this.avisos = avisos;
        this.provedores = provedores;
        this.cobrancas = cobrancas;
        this.credenciais = credenciais;
        this.auditoria = auditoria;
        this.gravacao = new TransactionTemplate(transacoes);
    }

    /**
     * Ordem: formato do token (404), teto do corpo (413), token conhecido (404, nada gravado), leitura do corpo (400 com
     * mensagem fixa) e gravação. Aviso sem transação ainda é reconhecido sem gravar.
     */
    public void receber(String token, byte[] corpo) {
        if (token == null || !TOKEN.matcher(token).matches()) {
            throw naoEncontrado();
        }
        if (corpo.length > MAXIMO_DO_CORPO) {
            throw new CorpoExcedidoException();
        }
        UUID consultoria = avisos.consultoriaDoToken(RecebimentoOnlineService.PROVEDOR, token).orElseThrow(
                AvisoInfinitePayService::naoEncontrado);
        EventoDeWebhook evento;
        try {
            evento = provedores.buscar(RecebimentoOnlineService.PROVEDOR)
                    .orElseThrow(() -> new IllegalStateException("Provedor de pagamento não registrado."))
                    .lerWebhook(new RequisicaoDeWebhook(Map.of(), corpo));
        } catch (WebhookInvalidoException e) {
            throw new BadRequestException("Aviso inválido.", "AVISO_INVALIDO");
        }
        if (!evento.temTransacao()) {
            return;
        }
        String hash = sha256(corpo);
        TenantContext.executarComo(consultoria, () -> gravacao.execute(status -> {
            // Estorno informado: deixa a marca permanente no aviso e o manda para a conferência sem esperar a consulta, porque o
            // payment_check pode ainda dizer "pago". Não move dinheiro nem mexe na baixa; o treinador decide. Só audita quando
            // este evento mudou o aviso para CONFERIR (repetição, ou aviso que já estava lá, não gera outra linha).
            if (evento.estornoInformado()) {
                avisos.registrarEstorno(consultoria, RecebimentoOnlineService.PROVEDOR, evento.referencia().toString(),
                        evento.idExterno(), evento.slug(), hash).ifPresent(estorno -> {
                            if (estorno.foiParaConferir()) {
                                auditoria.registrarDoSistema(consultoria, "PAGAMENTO_PARA_CONFERIR", "AVISO_DE_PAGAMENTO",
                                        estorno.id(), ConclusaoDoAviso.RESUMO_ESTORNO_INFORMADO);
                            }
                        });
                return Boolean.TRUE;
            }
            avisos.registrar(consultoria, RecebimentoOnlineService.PROVEDOR, evento.referencia().toString(),
                    evento.idExterno(), evento.slug(), hash, false);
            return Boolean.TRUE;
        }));
    }

    /**
     * O aluno voltou do checkout e o app mandou o que leu da URL. A cobrança tem de ser dele (de outro aluno ou inexistente é
     * 404, sem gravar nada). Entra na caixa de entrada como um aviso comum e não dá baixa: o conciliador consulta a InfinitePay
     * depois. Nada do que veio do navegador é confiado além de "consulte esta transação": o {@code capture_method} só entra no
     * hash, e o slug só vale quando a cobrança não tem o do próprio link. Sem recebimento online configurado não há o que
     * consultar e nada é gravado (o treinador não ganharia nada além de uma conferência inútil).
     */
    public void registrarRetorno(UUID alunoId, RetornoDoPagamentoRequest r) {
        UUID cobrancaId = UUID.fromString(r.orderNsu());
        UUID consultoria = Objects.requireNonNull(TenantContext.get());
        gravacao.execute(status -> {
            CobrancaAluno cobranca = cobrancas.findById(cobrancaId).orElseThrow(Travas::cobrancaNaoEncontrada);
            if (!alunoId.equals(cobranca.getAlunoId())) {
                throw Travas.cobrancaNaoEncontrada();
            }
            if (credenciais.findByProvedor(RecebimentoOnlineService.PROVEDOR).isEmpty()) {
                return Boolean.FALSE;
            }
            String slug = cobranca.getLinkSlug() == null ? r.slug() : null;
            avisos.registrar(consultoria, RecebimentoOnlineService.PROVEDOR, cobrancaId.toString(), r.transactionNsu(), slug,
                    sha256(serializacaoDoRetorno(cobrancaId, r)), true);
            return Boolean.TRUE;
        });
    }

    /** Serialização fixa dos campos recebidos (ordem e rótulos constantes, ausente = vazio): só o hash dela é guardado. */
    private static byte[] serializacaoDoRetorno(UUID cobrancaId, RetornoDoPagamentoRequest r) {
        return ("retorno\norder_nsu=" + cobrancaId + "\ntransaction_nsu=" + r.transactionNsu() + "\nslug="
                + (r.slug() == null ? "" : r.slug()) + "\ncapture_method="
                + (r.captureMethod() == null ? "" : r.captureMethod())).getBytes(StandardCharsets.UTF_8);
    }

    /** O mesmo 404 para token fora do formato e token desconhecido: nada revela qual dos dois foi. */
    private static NaoEncontradoException naoEncontrado() {
        return new NaoEncontradoException("Não encontrado.");
    }

    /** Hex minúsculo, como o check da coluna exige. O corpo em si nunca é guardado. */
    static String sha256(byte[] corpo) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(corpo));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível.");
        }
    }
}
