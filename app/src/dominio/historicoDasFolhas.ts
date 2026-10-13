/**
 * Regras puras de como as Folhas abertas entram no histórico do navegador (a parte que mexe no `window.history` fica em
 * `ui/historicoDasFolhas.ts`). Cada Folha aberta ocupa uma entrada a mais do histórico, marcada com `folhaNivel` (1, 2…),
 * para que o voltar do navegador feche a Folha em vez de sair da tela.
 */

export type Acerto =
  | { tipo: 'nada' }
  /** Empilha uma entrada por nível, na ordem. */
  | { tipo: 'empilhar'; niveis: number[] }
  /** Volta `passos` entradas (as que ficaram para trás de uma Folha que fechou). */
  | { tipo: 'voltar'; passos: number };

/** O que fazer para o histórico ficar com tantas entradas de Folha quanto Folhas abertas. */
export function planejarAcerto(abertas: number, nivelAtual: number): Acerto {
  if (abertas === nivelAtual) return { tipo: 'nada' };
  if (abertas > nivelAtual) return { tipo: 'empilhar', niveis: Array.from({ length: abertas - nivelAtual }, (_, i) => nivelAtual + i + 1) };
  return { tipo: 'voltar', passos: nivelAtual - abertas };
}

/** Quantas Folhas (do topo) fecham quando o navegador cai num nível menor que o de Folhas abertas. */
export function folhasParaFechar(abertas: number, nivelDaEntrada: number): number {
  return Math.max(0, abertas - nivelDaEntrada);
}

/**
 * Quantos passos voltar ao chegar numa tela que deixou entradas de Folha para trás: a Folha navegou para outra tela sem
 * fechar (ex.: "Criar e editar") e o voltar caiu na entrada que ela deixou (o expo-router reescreve o estado dela ao
 * voltar, então a marca `folhaNivel` já não serve para reconhecê-la). Só vale quando se veio de OUTRA tela e não há Folha
 * aberta; avançar de dentro da mesma tela (mesmo `id`) não conta, para o botão avançar não ficar preso.
 */
export function passosParaSairDeEntradasSobrando(sobrando: number, abertas: number, veioDeOutraTela: boolean): number {
  return veioDeOutraTela && abertas === 0 ? Math.max(0, sobrando) : 0;
}

/** Nível guardado numa entrada do histórico; entrada sem marca (ou estado estranho) é nível 0. */
export function nivelDoEstado(estado: unknown): number {
  const nivel = (estado as { folhaNivel?: unknown } | null)?.folhaNivel;
  return typeof nivel === 'number' && Number.isInteger(nivel) && nivel > 0 ? nivel : 0;
}
