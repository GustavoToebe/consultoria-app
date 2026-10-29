package br.com.treinos.api.agenda;

/**
 * Como a série de um compromisso com aluno se repete (D4). Sem "nunca": o fim da série é sempre obrigatório. Não existe
 * "mensal pelo dia da semana" nem "a cada N semanas" (fora do escopo do plano).
 */
public enum TipoDeRepeticao {
    DIARIA,
    /** Nos {@code diasDaSemana} escolhidos, toda semana. */
    SEMANAL,
    /** No mesmo dia do mês; o mês que não tem o dia (31, 30, 29/02 fora de bissexto) é pulado. */
    MENSAL,
    /** No mesmo dia e mês; 29/02 só em ano bissexto. */
    ANUAL,
    /** Segunda a sexta (feriado não é considerado: feriados ficam fora do escopo do plano). */
    DIAS_UTEIS
}
