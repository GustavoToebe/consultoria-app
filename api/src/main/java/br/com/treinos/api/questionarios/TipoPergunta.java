package br.com.treinos.api.questionarios;

/** Tipos fechados de pergunta. Tipo novo exige o mesmo valor em {@code TipoPergunta} de {@code app/src/api/tipos.ts}. */
public enum TipoPergunta {
    DATA_AUTOMATICA, PESO, NOTA, TEXTO, TEXTO_LONGO, NOTAS_POR_DIA, FOTOS,
    ESCOLHA_UNICA, MULTIPLA_ESCOLHA, NUMERO, SIM_NAO;

    public boolean temOpcoes() {
        return this == ESCOLHA_UNICA || this == MULTIPLA_ESCOLHA;
    }
}
