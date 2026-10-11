package br.com.treinos.api.conta;

import java.time.Instant;
import java.util.List;

/**
 * Consumo do plano (campos do {@code ConsumoPlano} do Servirea). {@code limite} nulo = "Sem limite configurado": nunca
 * vira zero inventado.
 */
public record ConsumoPlanoDto(String planoNome, Long versaoDireitos, Instant direitosConfirmadosEm, Instant consultadoEm,
                              List<Item> itens) {

    public record Item(String codigo, String nome, long usado, Long limite, Long disponivel, String unidade,
                       EstadoDoConsumo estado) {
    }
}
