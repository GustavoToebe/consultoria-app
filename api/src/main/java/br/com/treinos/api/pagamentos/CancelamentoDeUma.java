package br.com.treinos.api.pagamentos;

import br.com.treinos.api.auditoria.Auditoria;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * O cancelamento de uma cobrança, com a auditoria, numa transação. Bean à parte pelo mesmo motivo de {@link BaixaManualDeUma}: o
 * cancelamento individual ({@link CobrancaService#cancelar}) entra na transação dele e o lote ({@link CancelamentoEmLote}, sem
 * transação) chama este bean uma vez por item, cada um na sua.
 */
@Service
public class CancelamentoDeUma {

    private final BaixaDeCobranca baixa;
    private final Auditoria auditoria;

    CancelamentoDeUma(BaixaDeCobranca baixa, Auditoria auditoria) {
        this.baixa = baixa;
        this.auditoria = auditoria;
    }

    /** Já cancelada: nada muda e nada é auditado. Devolve se esta chamada cancelou. {@code motivo} nulo = sem motivo. */
    @Transactional
    public boolean cancelar(UUID cobrancaId, String motivo, Long versao) {
        var resultado = baixa.cancelar(cobrancaId, motivo, versao);
        if (resultado.mudou()) {
            auditoria.registrarEvento("COBRANCA_CANCELADA", "COBRANCA", cobrancaId, "Cancelou uma cobrança.");
        }
        return resultado.mudou();
    }
}
