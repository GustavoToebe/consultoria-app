package br.com.treinos.api.pagamentos;

/** Uma cobrança com os nomes que as listas mostram (aluno, plano comercial e quem deu a baixa). */
public record LinhaDeCobranca(CobrancaAluno cobranca, String alunoNome, String planoNome, String baixaPorNome) {
}
