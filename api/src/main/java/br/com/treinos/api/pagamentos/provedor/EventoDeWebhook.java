package br.com.treinos.api.pagamentos.provedor;

/**
 * Um aviso já lido. {@code idEvento} identifica o aviso (o mesmo aviso repetido tem o mesmo id, e a caixa de entrada da
 * Fase 2 descarta a repetição); {@code idExterno} diz de qual cobrança é; {@code situacao} é só uma dica: quem decide é a
 * consulta ao provedor.
 */
public record EventoDeWebhook(String idEvento, String idExterno, SituacaoNormalizada situacao) {
}
