package br.com.treinos.api.pagamentos;

import jakarta.persistence.PostUpdate;
import org.springframework.stereotype.Component;

/**
 * Ouvinte de {@link CobrancaAluno}: a cobrança do Asaas que uma mudança deixou órfã (valor reajustado, renegociada,
 * cancelada, baixa que não é do Asaas ou troca do id) é gravada em {@link FilaDeCancelamentoAsaas} na mesma transação, no
 * flush. É um ouvinte, e não uma chamada em cada serviço, para nenhum caminho (cancelar uma ou em lote, inativar, encerrar,
 * renegociar, desfazer acordo, reajustar) ficar de fora. Só JDBC aqui (nada de JPA em callback); o DELETE no Asaas é do
 * {@link CancelamentoDeCobrancaAsaas}, fora de transação.
 */
@Component
public class OrfasDoAsaasNaFila {

    private final FilaDeCancelamentoAsaas fila;

    OrfasDoAsaasNaFila(FilaDeCancelamentoAsaas fila) {
        this.fila = fila;
    }

    @PostUpdate
    void depoisDeAtualizar(CobrancaAluno cobranca) {
        for (String asaasId : cobranca.retirarAsaasOrfas()) {
            fila.enfileirar(cobranca.getConsultoriaId(), cobranca.getId(), asaasId);
        }
    }
}
