package br.com.treinos.api.pagamentos.provedor;

/** A cobrança criada no provedor: o id dele (guardado em {@code id_externo}) e o link para o aluno pagar. */
public record CobrancaGerada(String idExterno, String link) {
}
