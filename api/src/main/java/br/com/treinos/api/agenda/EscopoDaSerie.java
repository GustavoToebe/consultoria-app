package br.com.treinos.api.agenda;

/**
 * Até onde uma edição ou um cancelamento vale numa série de compromissos (D4).
 */
public enum EscopoDaSerie {
    /** Só a ocorrência escolhida (o comportamento de um compromisso avulso). */
    ESTA,
    /** As ocorrências da série que começam a partir da escolhida e ainda não terminaram. */
    SEGUINTES,
    /** Todas as ocorrências da série que ainda não começaram. */
    TODAS
}
