import { semAcento } from './telas';

export interface OpcaoDaSelecao {
  valor: string;
  rotulo: string;
}

/** Quantos chips o campo fechado mostra antes do "+N". */
export const CHIPS_VISIVEIS = 2;

/** Opções cujo rótulo contém o filtro (sem acento e sem diferença de maiúsculas); filtro vazio devolve todas. */
export function filtrarOpcoes(opcoes: readonly OpcaoDaSelecao[], filtro: string): OpcaoDaSelecao[] {
  const termo = semAcento(filtro);
  return termo ? opcoes.filter((o) => semAcento(o.rotulo).includes(termo)) : [...opcoes];
}

export type EstadoDosVisiveis = 'nenhum' | 'alguns' | 'todos';

/** Estado da caixa "Marcar todos": só olha as opções visíveis (as que o filtro deixou). */
export function estadoDosVisiveis(visiveis: readonly OpcaoDaSelecao[], marcados: ReadonlySet<string>): EstadoDosVisiveis {
  const quantos = visiveis.filter((o) => marcados.has(o.valor)).length;
  if (quantos === 0) return 'nenhum';
  return quantos === visiveis.length ? 'todos' : 'alguns';
}

/**
 * "Marcar todos": com todos os visíveis marcados desmarca só eles; senão marca todos os visíveis. O que o filtro
 * esconde não muda.
 */
export function alternarVisiveis(visiveis: readonly OpcaoDaSelecao[], marcados: ReadonlySet<string>): Set<string> {
  const novo = new Set(marcados);
  const desmarcar = visiveis.length > 0 && estadoDosVisiveis(visiveis, marcados) === 'todos';
  for (const o of visiveis) {
    if (desmarcar) novo.delete(o.valor);
    else novo.add(o.valor);
  }
  return novo;
}

/** Tira dos marcados o que já não está nas opções (grupo que sumiu da lista não pode filtrar sem aparecer). */
export function marcadosExistentes(opcoes: readonly OpcaoDaSelecao[], marcados: ReadonlySet<string>): Set<string> {
  const existentes = new Set(opcoes.map((o) => o.valor));
  return new Set([...marcados].filter((v) => existentes.has(v)));
}

/** Marcados na ordem da lista: os `CHIPS_VISIVEIS` primeiros viram chips e o resto, "+N". */
export function resumoDosMarcados(opcoes: readonly OpcaoDaSelecao[], marcados: ReadonlySet<string>, maximo = CHIPS_VISIVEIS) {
  const rotulos = opcoes.filter((o) => marcados.has(o.valor)).map((o) => o.rotulo);
  return { chips: rotulos.slice(0, maximo), restantes: Math.max(0, rotulos.length - maximo) };
}

/** Texto para o leitor de tela e para o botão: "Todos", "Peito" ou "Peito, Costas e mais 2". */
export function textoDosMarcados(opcoes: readonly OpcaoDaSelecao[], marcados: ReadonlySet<string>, rotuloDeTodos = 'Todos'): string {
  const { chips, restantes } = resumoDosMarcados(opcoes, marcados);
  if (chips.length === 0) return rotuloDeTodos;
  return restantes > 0 ? `${chips.join(', ')} e mais ${restantes}` : chips.join(', ');
}
