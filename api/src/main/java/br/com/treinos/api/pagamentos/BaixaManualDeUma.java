package br.com.treinos.api.pagamentos;

import br.com.treinos.api.auditoria.Auditoria;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

/**
 * A baixa manual de uma cobrança, com a auditoria, numa transação. É um bean à parte de propósito: a baixa individual
 * ({@link CobrancaService#baixaManual}) entra na transação dela, e o lote ({@link BaixaEmLote}, sem transação) chama este bean
 * uma vez por item, cada uma na sua transação (chamar de dentro do mesmo bean viraria uma transação só e mataria a falha
 * parcial). Data e forma já vêm conferidas.
 */
@Service
public class BaixaManualDeUma {

    private final BaixaDeCobranca baixa;
    private final Auditoria auditoria;

    BaixaManualDeUma(BaixaDeCobranca baixa, Auditoria auditoria) {
        this.baixa = baixa;
        this.auditoria = auditoria;
    }

    /**
     * Já paga: nada muda e nada é auditado (idempotente). Versão velha numa aberta é 409 {@code CONFLITO_EDICAO}.
     * Devolve se esta chamada gravou a baixa ({@code false} = já estava paga, com a forma e a data de antes).
     */
    @Transactional
    public boolean baixar(UUID cobrancaId, LocalDate data, FormaDePagamento forma, String observacao, Long versao,
                       UUID usuarioId) {
        var resultado = baixa.baixar(cobrancaId, new BaixaDeCobranca.Baixa(CobrancaAluno.MANUAL, forma, data, usuarioId,
                observacao, versao));
        if (resultado.mudou()) {
            auditoria.registrarEvento("PAGAMENTO_MANUAL_REGISTRADO", "COBRANCA", cobrancaId,
                    "Registrou o pagamento de uma cobrança.");
        }
        return resultado.mudou();
    }
}
