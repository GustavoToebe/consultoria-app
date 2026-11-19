package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.Totais;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.Set;
import java.util.UUID;

/**
 * Os totais do topo da lista de cobranças, calculados no banco sobre o filtro inteiro (todas as páginas, os mesmos parâmetros da
 * lista). CANCELADA, ESTORNADA e RENEGOCIADA ficam fora de tudo, também do total; {@code pago} é só PAGA (igual ao recebido do painel: a
 * CONTESTADA entra no total, mas não no pago nem no em aberto); {@code emAberto} inclui a vencida; {@code vencido} é a ABERTA com
 * vencimento antes de hoje (Brasília). Roda dentro da transação somente leitura da lista.
 */
@Component
class TotaisDeCobrancas {

    /** Não é {@code NAO_COBREM_PERIODO}: a RENEGOCIADA cobre a competência, mas o valor dela está nas parcelas do acordo. */
    private static final Set<CobrancaAluno.Situacao> FORA = Set.of(CobrancaAluno.Situacao.CANCELADA,
            CobrancaAluno.Situacao.ESTORNADA, CobrancaAluno.Situacao.RENEGOCIADA);

    private final CobrancaAlunoRepository cobrancas;

    TotaisDeCobrancas(CobrancaAlunoRepository cobrancas) {
        this.cobrancas = cobrancas;
    }

    Totais calcular(boolean filtraSituacoes, Collection<CobrancaAluno.Situacao> situacoes, boolean soVencidas,
                    LocalDate hoje, LocalDate de, LocalDate ate, UUID alunoId, UUID responsavelId, UUID planoId,
                    String forma, boolean busca, String nome, Instant emissaoDe, Instant emissaoAte,
                    boolean filtraPagamento, LocalDate pagoDe, LocalDate pagoAte) {
        var t = cobrancas.totais(filtraSituacoes, situacoes, soVencidas, CobrancaAluno.Situacao.ABERTA,
                CobrancaAluno.Situacao.PAGA, FORA, hoje, de, ate, alunoId, responsavelId, planoId, forma, busca, nome,
                emissaoDe, emissaoAte, filtraPagamento, pagoDe, pagoAte);
        return new Totais(t.getTotal(), t.getPago(), t.getEmAberto(), t.getVencido());
    }
}
