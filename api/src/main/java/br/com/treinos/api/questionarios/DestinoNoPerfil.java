package br.com.treinos.api.questionarios;

/**
 * Campo do cadastro do aluno que uma pergunta da anamnese ou formulário alimenta (C62 / N37).
 */
public enum DestinoNoPerfil {
    NOME(TipoPergunta.TEXTO, "ALUNO_ALTERAR"),
    TELEFONE(TipoPergunta.TELEFONE, "ALUNO_ALTERAR"),
    EMAIL(TipoPergunta.EMAIL, "ALUNO_ALTERAR"),
    SEXO(TipoPergunta.ESCOLHA_UNICA, "ALUNO_ALTERAR"),
    DATA_NASCIMENTO(TipoPergunta.DATA, "ALUNO_ALTERAR"),
    ALTURA(TipoPergunta.NUMERO, "ALUNO_SENSIVEL_ALTERAR"),
    PESO(TipoPergunta.PESO, "ALUNO_SENSIVEL_ALTERAR"),
    CPF(TipoPergunta.TEXTO, "ALUNO_SENSIVEL_ALTERAR"),
    ENDERECO(TipoPergunta.ENDERECO, "ALUNO_SENSIVEL_ALTERAR"),
    OBJETIVO(TipoPergunta.TEXTO, "ALUNO_SENSIVEL_ALTERAR"),
    OBSERVACOES(TipoPergunta.TEXTO_LONGO, "ALUNO_SENSIVEL_ALTERAR");

    private final TipoPergunta tipo;
    private final String permissao;

    DestinoNoPerfil(TipoPergunta tipo, String permissao) {
        this.tipo = tipo;
        this.permissao = permissao;
    }

    /** O tipo de pergunta que pode alimentar este campo. */
    public boolean aceita(TipoPergunta t) {
        if (this == OBSERVACOES) {
            return t == TipoPergunta.TEXTO || t == TipoPergunta.TEXTO_LONGO;
        }
        return this.tipo == t;
    }

    /**
     * Se o sistema grava este campo no cadastro (o envio cria pendência ou preenche, ver {@code PerfilDaAnamnese}). Nome,
     * e-mail, data de nascimento, altura e observações não têm onde gravar: a publicação recusa e o editor não os oferece.
     * As constantes ficam no enum porque versão publicada é imutável e ainda pode citá-las.
     */
    public boolean temEfeito() {
        return switch (this) {
            case TELEFONE, SEXO, PESO, CPF, ENDERECO, OBJETIVO -> true;
            case NOME, EMAIL, DATA_NASCIMENTO, ALTURA, OBSERVACOES -> false;
        };
    }

    /**
     * Permissão de quem aplica ou descarta uma alteração proposta para este campo.
     */
    public String permissao() {
        return permissao;
    }
}
