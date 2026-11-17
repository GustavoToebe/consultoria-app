package br.com.treinos.api.comunidade;

/**
 * Como o nome do aluno aparece para os OUTROS alunos (V085; plano {@code nome-no-mural}). Nulo no cadastro = {@link #PADRAO}.
 * A equipe sempre vê o nome completo e o apelido. O app espelha a lista: mudou uma, mude a outra.
 */
public enum ExibicaoDoNome {
    NOME, NOME_COMPLETO, APELIDO, NOME_E_APELIDO;

    public static final ExibicaoDoNome PADRAO = NOME;

    /** Nulo ou fora da lista (maiúsculas exatas) = {@code null}; quem valida decide o erro. */
    public static ExibicaoDoNome ler(String texto) {
        for (ExibicaoDoNome e : values()) {
            if (e.name().equals(texto)) {
                return e;
            }
        }
        return null;
    }
}
