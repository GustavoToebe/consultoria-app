package br.com.treinos.api.questionarios;

/**
 * Campo do cadastro do aluno que uma pergunta da anamnese alimenta (fase C, 19/10). Nome e e-mail nunca (o e-mail é o
 * login); responsável não existe aqui. Destino novo exige o mesmo valor em {@code DestinoNoPerfil} de
 * {@code app/src/api/tipos.ts} e nas regras de {@code app/src/dominio/questionario.ts}, e entrar no CHECK
 * {@code ck_anamnese_pendencia_destino} do banco (migration nova).
 */
public enum DestinoNoPerfil {
    /** Pergunta PESO → registro de peso (com a data de uma pergunta DATA ou a do envio). */
    PESO(TipoPergunta.PESO, "ALUNO_SENSIVEL_ALTERAR"),
    /** Pergunta TEXTO → {@code aluno.objetivo} (dado sensível; resposta limitada a {@link LimitesQuestionario#OBJETIVO_TAMANHO}). */
    OBJETIVO(TipoPergunta.TEXTO, "ALUNO_SENSIVEL_ALTERAR"),
    /** Pergunta TEXTO → {@code aluno.cpf} (resposta com CPF válido, até {@link LimitesQuestionario#CPF_TAMANHO}). */
    CPF(TipoPergunta.TEXTO, "ALUNO_SENSIVEL_ALTERAR"),
    /** Pergunta TELEFONE → {@code usuario.telefone} do aluno (só quem já criou o acesso tem onde guardar). */
    TELEFONE(TipoPergunta.TELEFONE, "ALUNO_ALTERAR"),
    /** Pergunta ENDERECO → as sete colunas de endereço de {@code aluno}. */
    ENDERECO(TipoPergunta.ENDERECO, "ALUNO_SENSIVEL_ALTERAR"),
    /** Pergunta ESCOLHA_UNICA → {@code aluno.sexo}. A opção traz {@code valorNoCadastro}. */
    SEXO(TipoPergunta.ESCOLHA_UNICA, "ALUNO_ALTERAR");

    private final TipoPergunta tipo;
    private final String permissao;

    DestinoNoPerfil(TipoPergunta tipo, String permissao) {
        this.tipo = tipo;
        this.permissao = permissao;
    }

    /** O tipo de pergunta que pode alimentar este campo. */
    public boolean aceita(TipoPergunta tipo) {
        return this.tipo == tipo;
    }

    /**
     * Permissão de quem aplica ou descarta uma alteração proposta para este campo (além de {@code ANAMNESE_ALTERAR}): a
     * mesma de quem edita o campo na ficha. O telefone e o sexo são da ficha ({@code ALUNO_ALTERAR}); peso,
     * objetivo, CPF e endereço são dado sensível ({@code ALUNO_SENSIVEL_ALTERAR}).
     */
    public String permissao() {
        return permissao;
    }
}
