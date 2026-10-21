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

/**
 * O que fazer para o histórico ficar com tantas entradas de Folha quanto Folhas abertas. Com uma volta nossa ainda a
 * caminho (`pendente`), conta com ela (`nivelParaAcertar`) e não empilha nada: a volta, ao chegar, desfaria a entrada
 * nova; o `popstate` dela acerta de novo.
 */
export function planejarAcerto(abertas: number, nivelAtual: number, pendente: VoltaPendente | null = null): Acerto {
  const nivel = nivelParaAcertar(nivelAtual, pendente);
  if (abertas === nivel || (abertas > nivel && pendente)) return { tipo: 'nada' };
  if (abertas > nivel) return { tipo: 'empilhar', niveis: Array.from({ length: abertas - nivel }, (_, i) => nivel + i + 1) };
  return { tipo: 'voltar', passos: nivel - abertas };
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

/**
 * A guarda de um editor com alteração pendente ocupa uma entrada como uma Folha, mas tem de ficar por baixo delas: o
 * voltar fecha sempre a do topo, e a pergunta "Sair sem salvar?" só deve vir depois que as Folhas fecharam. Com Folha
 * aberta a guarda espera (e entra quando a última fechar); duas guardas ao mesmo tempo nunca.
 */
export function podeRegistrarGuarda(folhasAbertas: number, guardaRegistrada: boolean): boolean {
  return folhasAbertas === 0 && !guardaRegistrada;
}

/**
 * Passos para sair do editor de vez, com a guarda já retirada: a entrada da guarda (se o histórico está nela) e a da
 * própria tela. Só a entrada da tela, se o navegador já voltou da guarda.
 */
export function passosParaSairDoEditor(nivelAtual: number): number {
  return nivelAtual + 1;
}

/**
 * Voltas (`history.go(-n)`) que a gente pediu e cujo `popstate` ainda não chegou: o nível em que o histórico estava quando
 * a primeira saiu e quantos passos, somados, ainda vão acontecer. O navegador faz as voltas em fila, cada uma a partir da
 * entrada em que a anterior parou, então uma volta pedida de novo enquanto a primeira não chegou soma, não substitui.
 */
export interface VoltaPendente {
  nivel: number;
  passos: number;
}

/**
 * Nível a usar no acerto. Com uma volta ainda em curso (o histórico continua no nível de quando ela saiu), conta como se ela
 * já tivesse chegado: sem isso, o acerto que roda antes do `popstate` (o navegador demorou, ex.: máquina carregada) vê a
 * entrada da Folha que já fechou, pede outra volta e as duas juntas tiram a pessoa da tela (ou do app).
 */
export function nivelParaAcertar(nivelAtual: number, pendente: VoltaPendente | null): number {
  return pendente && nivelAtual === pendente.nivel ? Math.max(0, nivelAtual - pendente.passos) : nivelAtual;
}

/** Registra mais uma volta pedida: soma à que ainda não chegou (o histórico não saiu do lugar) ou começa uma nova. */
export function somarVolta(pendente: VoltaPendente | null, nivelAtual: number, passos: number): VoltaPendente {
  return pendente && nivelAtual === pendente.nivel ? { nivel: pendente.nivel, passos: pendente.passos + passos } : { nivel: nivelAtual, passos };
}

/**
 * O que sobra da volta pendente depois de um `popstate`: o quanto o nível desceu já aconteceu. Ao sair da tela (outro `id`)
 * ou chegar ao nível 0, a conta acaba (não há mais entradas de Folha desta tela por baixo).
 */
export function voltaDepoisDoPopstate(pendente: VoltaPendente | null, nivelNovo: number, mesmaTela: boolean): VoltaPendente | null {
  if (!pendente || !mesmaTela || nivelNovo === 0) return null;
  const restante = pendente.passos - Math.max(0, pendente.nivel - nivelNovo);
  return restante > 0 ? { nivel: nivelNovo, passos: restante } : null;
}

/** Nível guardado numa entrada do histórico; entrada sem marca (ou estado estranho) é nível 0. */
export function nivelDoEstado(estado: unknown): number {
  const nivel = (estado as { folhaNivel?: unknown } | null)?.folhaNivel;
  return typeof nivel === 'number' && Number.isInteger(nivel) && nivel > 0 ? nivel : 0;
}
