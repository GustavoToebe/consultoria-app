package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.FilaDeCancelamentoAsaas.Pendente;
import br.com.treinos.api.pagamentos.provedor.AsaasCliente;
import br.com.treinos.api.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.UUID;

/**
 * Worker da fila de cancelamento no Asaas: apaga ({@code DELETE /payments/{id}}, fora de transação) a cobrança que ficou órfã
 * para ninguém pagá-la. O treinador nunca espera nem falha por isso: a operação dele só grava o pedido na fila. 2xx ou 404 =
 * feito; outro 4xx (por exemplo, já paga) ou subconta sem chave = sem nova tentativa; 5xx e rede = tenta de novo, com espera
 * crescente, até {@link #MAXIMO_DE_TENTATIVAS}. Se a órfã for paga antes de ser apagada, o aviso cai em CONFERIR pelas regras de
 * sempre ({@code COBRANCA_CANCELADA}, {@code COBRANCA_JA_PAGA} ou {@code VALOR_DIFERENTE}). Nunca loga id, chave nem corpo.
 */
@Component
public class CancelamentoDeCobrancaAsaas {

    private static final Logger LOG = LoggerFactory.getLogger(CancelamentoDeCobrancaAsaas.class);

    static final int TAMANHO_DO_LOTE = 20;
    static final int RESERVA_EM_SEGUNDOS = 120;
    static final int MAXIMO_DE_TENTATIVAS = 12;
    private static final long ESPERA_MAXIMA = 3600;

    private final FilaDeCancelamentoAsaas fila;
    private final SubcontaAsaasRepository subcontas;
    private final CifraDePagamento cifra;
    private final AsaasCliente asaasCliente;
    private final TransactionTemplate transacao;
    private final TransactionTemplate leitura;

    CancelamentoDeCobrancaAsaas(FilaDeCancelamentoAsaas fila, SubcontaAsaasRepository subcontas, CifraDePagamento cifra,
                                AsaasCliente asaasCliente, PlatformTransactionManager transacoes) {
        this.fila = fila;
        this.subcontas = subcontas;
        this.cifra = cifra;
        this.asaasCliente = asaasCliente;
        this.transacao = new TransactionTemplate(transacoes);
        this.leitura = new TransactionTemplate(transacoes);
        this.leitura.setReadOnly(true);
    }

    /** Uma rodada: reserva o lote e tenta cada pedido. Devolve quantos reservou. */
    public int processarPendentes() {
        List<Pendente> lote = transacao.execute(st -> fila.reservar(TAMANHO_DO_LOTE, RESERVA_EM_SEGUNDOS));
        if (lote == null || lote.isEmpty()) {
            return 0;
        }
        for (Pendente pedido : lote) {
            try {
                processar(pedido);
            } catch (RuntimeException e) {
                LOG.warn("Cancelamento no Asaas não concluído ({}).", e.getClass().getSimpleName());
                reagendarOuDesistir(pedido);
            }
        }
        return lote.size();
    }

    private void processar(Pendente pedido) {
        String apiKey = apiKeyDa(pedido.consultoriaId());
        if (apiKey == null) {
            // Subconta removida ou trocada: a chave que enxergava a cobrança não existe mais.
            fila.falhou(pedido.id());
            return;
        }
        if (asaasCliente.excluirCobranca(apiKey, pedido.asaasCobrancaId())) {
            fila.concluir(pedido.id());
        } else {
            fila.falhou(pedido.id());
        }
    }

    private String apiKeyDa(UUID consultoriaId) {
        return TenantContext.executarComo(consultoriaId, () -> leitura.execute(st -> subcontas.daConsultoria()
                .filter(s -> s.getApiKeyCifrada() != null)
                .map(s -> cifra.decifrar(consultoriaId, s.getApiKeyCifrada()))
                .orElse(null)));
    }

    private void reagendarOuDesistir(Pendente pedido) {
        if (pedido.tentativas() + 1 >= MAXIMO_DE_TENTATIVAS) {
            fila.falhou(pedido.id());
        } else {
            fila.reagendar(pedido.id(), Math.min(60L << Math.min(pedido.tentativas(), 6), ESPERA_MAXIMA));
        }
    }
}
