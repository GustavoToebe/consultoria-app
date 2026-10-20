package br.com.treinos.api.pagamentos.provedor;

import java.util.UUID;

/**
 * Um aviso já lido. {@code idEvento} identifica o aviso (o mesmo aviso repetido tem o mesmo id, e a caixa de entrada
 * descarta a repetição); {@code referencia} é a cobrança nossa ({@code order_nsu}); {@code idExterno} é a transação no
 * provedor; {@code slug} é o do link (pode faltar). {@code evento} é o nome que o provedor deu ao aviso, só se for um dos
 * conhecidos (nulo se faltou ou se é outro): serve apenas para marcar um estorno informado para revisão. Ele nunca causa uma
 * baixa, só a impede (a marca de estorno manda o aviso para a conferência); quem decide a baixa é a consulta ao provedor. {@code idEvento} e {@code idExterno} são nulos no aviso que
 * chegou antes de haver transação: não há o que consultar ({@link #temTransacao()}).
 */
public record EventoDeWebhook(String idEvento, UUID referencia, String idExterno, String slug, String evento) {

    /** Nome do evento de estorno. */
    public static final String ESTORNO = "refunded";

    /** Há transação no provedor para consultar; sem ela o aviso é só reconhecido, nada se grava. */
    public boolean temTransacao() {
        return idExterno != null;
    }

    /** O provedor disse que a transação foi estornada (só informação: o dinheiro e a baixa não se mexem por isso). */
    public boolean estornoInformado() {
        return ESTORNO.equals(evento);
    }
}
