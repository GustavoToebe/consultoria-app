/**
 * Ordem sugerida para renovar o ciclo do aluno (reunião de 30/10, Análise 4): só orientação, sem botão nem automação.
 * Fica no ⓘ da Folha da pasta (bloco F, decisão do Gustavo de 26/11), não mais num cartão. A Ajuda reaproveita as constantes.
 */
export const TITULO_ORDEM_DA_RENOVACAO = 'Ordem sugerida para renovar o ciclo';

export const PASSOS_DA_RENOVACAO: readonly string[] = [
  'Ler a atualização.',
  'Renovar a pasta.',
  'Revisar os rascunhos.',
  'Publicar cada plano.',
  'Dar o retorno ao aluno.',
  'Finalizar a pasta anterior.',
];

export const NOTAS_DA_RENOVACAO: readonly string[] = [
  'Finalizar não publica nada.',
  'Publicar não abre um ciclo novo: para um novo período, renove a pasta.',
];

/** O texto do ⓘ da Folha da pasta: o título, os passos numerados (um por linha) e as notas. */
export const TEXTO_DA_ORDEM_DA_RENOVACAO = [
  `${TITULO_ORDEM_DA_RENOVACAO}:`,
  ...PASSOS_DA_RENOVACAO.map((passo, i) => `${i + 1}. ${passo}`),
  '',
  ...NOTAS_DA_RENOVACAO,
].join('\n');
