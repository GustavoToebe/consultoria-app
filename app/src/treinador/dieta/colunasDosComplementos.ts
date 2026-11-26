import type { ViewStyle } from 'react-native';

/**
 * Colunas das tabelas dos Complementos (26/11), as mesmas na Suplementação e em Outros: a partir de 720 px medidos na
 * própria lista vira tabela (abaixo, cartões); Dose e Horário crescem em % até um teto, para não esticar na
 * ultralarga, e o espaço que sobra fica com o nome e a observação. O mínimo cabe o título "Dose prescrita" e um
 * "Pós-treino" perto dos 720.
 */
export const LARGURA_DA_TABELA = 720;

export const COLUNA_DA_DOSE: ViewStyle = { width: '12%', minWidth: 120, maxWidth: 240 };
export const COLUNA_DO_HORARIO: ViewStyle = { width: '10%', minWidth: 104, maxWidth: 200 };
/** Princípio ativo e prescrição de Outros: texto curto, mas mais longo que uma dose. */
export const COLUNA_DE_DETALHE: ViewStyle = { width: '16%', minWidth: 160, maxWidth: 320 };
