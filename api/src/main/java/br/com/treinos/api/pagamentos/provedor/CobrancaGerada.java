package br.com.treinos.api.pagamentos.provedor;

/**
 * A cobrança criada no provedor: o id dele, o link para o aluno pagar e o {@code slug} do link (nulo quando o provedor não
 * devolve). Na InfinitePay o link ainda não tem transação: {@code idExterno} é o {@code order_nsu} (a referência), e a
 * transação só aparece no aviso e na consulta, então ele NÃO vai para {@code cobranca_aluno.id_externo}.
 */
public record CobrancaGerada(String idExterno, String link, String slug) {

    @Override
    public String toString() {
        return "CobrancaGerada[...]";
    }
}
