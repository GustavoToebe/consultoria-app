package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.PagamentosDtos.ParcelaDaPreviaDaRenegociacao;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * A conta da renegociação (D14), sem banco nem relógio: o total já vem pronto (soma lida no servidor + acréscimo − desconto) e aqui ele
 * vira {@code n} parcelas iguais com a sobra dos centavos na ÚLTIMA. A parcela {@code k} vence em {@code primeiro + (k-1)} meses
 * contados sempre a partir do primeiro (nunca encadeando, para 31/01 não virar 28/02 e depois 28/03), com o dia limitado ao último do
 * mês: 29, 30 e 31 vencem no último dia do mês curto, como em {@link CalendarioDeCobranca}.
 */
final class ContaDaRenegociacao {

    private ContaDaRenegociacao() {
    }

    /** Pré-condição de quem chama: {@code 1 <= n} e {@code total >= n} (cada parcela fica com 1 centavo ou mais). */
    static List<ParcelaDaPreviaDaRenegociacao> parcelas(long total, int n, LocalDate primeiro) {
        long base = total / n;
        List<ParcelaDaPreviaDaRenegociacao> parcelas = new ArrayList<>(n);
        for (int k = 1; k <= n; k++) {
            long valor = k == n ? total - base * (n - 1L) : base;
            parcelas.add(new ParcelaDaPreviaDaRenegociacao(k, primeiro.plusMonths(k - 1L), valor, descricao(k, n)));
        }
        return parcelas;
    }

    /** Texto fixo do servidor: nunca o que o treinador digitou. */
    static String descricao(int k, int n) {
        return n > 1 ? "Renegociação (Parcela " + k + "/" + n + ")" : "Renegociação";
    }
}
