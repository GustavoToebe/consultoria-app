/**
 * Regras puras da escolha única em lista suspensa com busca (`ui/EscolhaSuspensa`): o que o filtro deixa, onde o
 * destaque começa e como as setas o movem. Sem React.
 */
import { semAcento } from './telas';

export interface OpcaoSuspensa<T> {
  valor: T;
  rotulo: string;
  /** Linha pequena abaixo do rótulo (ex.: "Obrigatório", "Hoje na coluna “E-mail”"). */
  detalhe?: string;
}

/** Opções cujo rótulo ou detalhe contém o filtro, sem acento e sem diferença de maiúsculas; filtro vazio devolve todas. */
export function filtrarOpcoesSuspensas<T>(opcoes: readonly OpcaoSuspensa<T>[], filtro: string): OpcaoSuspensa<T>[] {
  const termo = semAcento(filtro.trim());
  if (!termo) return [...opcoes];
  return opcoes.filter((o) => semAcento(`${o.rotulo} ${o.detalhe ?? ''}`).includes(termo));
}

/** O destaque começa na opção escolhida, se ela estiver visível; senão na primeira (ou -1 sem opções). */
export function destaqueInicial<T>(visiveis: readonly OpcaoSuspensa<T>[], valor: T): number {
  if (visiveis.length === 0) return -1;
  const i = visiveis.findIndex((o) => o.valor === valor);
  return i >= 0 ? i : 0;
}

/** Seta para baixo/cima anda uma opção e para nas pontas; Home e End vão às pontas. Outras teclas não mexem. */
export function moverDestaque(atual: number, total: number, tecla: string): number {
  if (total <= 0) return -1;
  const i = Math.min(Math.max(atual, 0), total - 1);
  switch (tecla) {
    case 'ArrowDown': return atual < 0 ? 0 : Math.min(i + 1, total - 1);
    case 'ArrowUp': return atual < 0 ? total - 1 : Math.max(i - 1, 0);
    case 'Home': return 0;
    case 'End': return total - 1;
    default: return atual;
  }
}

/** Distância entre o botão e o painel aberto. */
export const VAO_DO_PAINEL = 4;

/**
 * Lado e altura da lista no PC: abre embaixo se o painel inteiro (busca + lista) cabe ali, ou se embaixo há pelo menos
 * tanto espaço quanto em cima; e a lista nunca passa do espaço do lado escolhido (antes, a ponta da lista saía da
 * janela e a última opção ficava fora do alcance do mouse). `embaixo` e `emCima` já descontam a folga da borda.
 */
export function posicaoDaLista(embaixo: number, emCima: number, alturaDaBusca: number, alturaDaLista: number, alturaMinima: number) {
  const cabe = (espaco: number) => espaco - VAO_DO_PAINEL - alturaDaBusca;
  const abreEmbaixo = cabe(embaixo) >= alturaDaLista || embaixo >= emCima;
  return { abreEmbaixo, alturaMaxima: Math.max(alturaMinima, Math.min(alturaDaLista, cabe(abreEmbaixo ? embaixo : emCima))) };
}
