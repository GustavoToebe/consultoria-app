package br.com.treinos.api.questionarios;

/** Tipos fechados de pergunta. Tipo novo exige o mesmo valor em {@code TipoPergunta} de {@code app/src/api/tipos.ts}. */
public enum TipoPergunta {
    DATA_AUTOMATICA, PESO, NOTA, TEXTO, TEXTO_LONGO, NOTAS_POR_DIA, FOTOS,
    ESCOLHA_UNICA, MULTIPLA_ESCOLHA, NUMERO, SIM_NAO,
    /** Data (AAAA-MM-DD); com {@code somentePassado}, hoje ou antes. */
    DATA,
    TELEFONE, EMAIL,
    /**
     * Endereço postal: objeto de textos {@code {cep, logradouro, numero, complemento, bairro, cidade, uf}}, todos opcionais.
     * Só na anamnese (o alvo é o endereço do cadastro do aluno).
     */
    ENDERECO,
    /** Linhas e colunas do treinador; uma coluna por linha. Obrigatória = todas as linhas. */
    GRADE,
    /** Texto longo e frase de declaração; a resposta é {@code true} (a versão respondida fica na anamnese/atualização). */
    ACEITE,
    /** Só texto e/ou imagem, sem resposta. */
    INFORMATIVO;

    public boolean temOpcoes() {
        return this == ESCOLHA_UNICA || this == MULTIPLA_ESCOLHA;
    }

    /** Tipos que nunca têm resposta do aluno. */
    public boolean semResposta() {
        return this == DATA_AUTOMATICA || this == INFORMATIVO;
    }

    /** Podem controlar a condição ({@code mostrarSe}) de uma pergunta ou seção seguinte. */
    public boolean controlaCondicao() {
        return this == ESCOLHA_UNICA || this == MULTIPLA_ESCOLHA || this == SIM_NAO;
    }
}
