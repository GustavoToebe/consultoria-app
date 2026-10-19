package br.com.treinos.api.questionarios;

/**
 * Campo do cadastro do aluno que uma pergunta da anamnese alimenta (fase C, 19/10). Só campos que já existem: o
 * registro de peso e o objetivo. Nome e e-mail nunca (o e-mail é o login); CPF, endereço, telefone e responsável ficam de
 * fora até o Gustavo decidir. Destino novo exige o mesmo valor em {@code DestinoNoPerfil} de {@code app/src/api/tipos.ts}
 * e nas regras de {@code app/src/dominio/questionario.ts}.
 */
public enum DestinoNoPerfil {
    /** Pergunta PESO → registro de peso (com a data de uma pergunta DATA ou a do envio). */
    PESO(TipoPergunta.PESO),
    /** Pergunta TEXTO → {@code aluno.objetivo} (dado sensível; resposta limitada a {@link LimitesQuestionario#OBJETIVO_TAMANHO}). */
    OBJETIVO(TipoPergunta.TEXTO);

    private final TipoPergunta tipo;

    DestinoNoPerfil(TipoPergunta tipo) {
        this.tipo = tipo;
    }

    /** O tipo de pergunta que pode alimentar este campo. */
    public boolean aceita(TipoPergunta tipo) {
        return this.tipo == tipo;
    }

    /**
     * Permissão de quem aplica ou descarta uma alteração proposta para este campo (além de {@code ANAMNESE_ALTERAR}): a
     * mesma de quem edita o campo na ficha. Peso e objetivo são dado sensível.
     */
    public String permissao() {
        return "ALUNO_SENSIVEL_ALTERAR";
    }
}
