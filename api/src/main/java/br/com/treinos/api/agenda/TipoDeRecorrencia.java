package br.com.treinos.api.agenda;

/**
 * Como um evento sem aluno se repete (D4). Diferente de {@link TipoDeRepeticao} (compromisso com aluno), aqui existe
 * {@code NENHUMA} (o evento avulso) e o fim pode ser "nunca": a API expande a regra na leitura, dentro da janela pedida.
 */
public enum TipoDeRecorrencia {
    NENHUMA,
    DIARIA,
    /** Nos dias da semana escolhidos, toda semana. */
    SEMANAL,
    /** No mesmo dia do mês; o mês que não tem o dia (31, 30, 29/02 fora de bissexto) é pulado. */
    MENSAL,
    /** No mesmo dia e mês; 29/02 só em ano bissexto. */
    ANUAL,
    /** Segunda a sexta (feriado não é considerado: fora do escopo do plano). */
    DIAS_UTEIS
}
