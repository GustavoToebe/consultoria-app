import type { GrupoAgrupado } from './gruposMusculares';
import type { EstadoDosVisiveis } from './selecaoMultiplaSuspensa';
import { semAcento } from './telas';

/**
 * Regras do painel "Filtros de exercícios" (Biblioteca › Exercícios e a folha "Escolher exercício"; pedido de 27/11): a
 * lista de grupos musculares agrupados (`agruparGruposParecidos`), em que cada linha marca todos os nomes reais do grupo, e
 * o arranjo do painel pela largura medida dele.
 */

/** A partir desta largura do painel (medida, não a da janela), Grupo muscular à esquerda e o resto à direita. */
export const LARGURA_DO_PAINEL_EM_COLUNAS = 700;

/** A partir desta largura da lista de grupos, duas colunas de linhas iguais; abaixo, uma. */
export const LARGURA_DA_LISTA_EM_DUAS_COLUNAS = 320;

/** "todos" com todos os nomes do grupo no filtro, "alguns" com parte deles (estado misto), "nenhum" sem nenhum. */
export function estadoDoGrupo(grupo: Pick<GrupoAgrupado, 'nomes'>, marcados: ReadonlySet<string>): EstadoDosVisiveis {
  const quantos = grupo.nomes.filter((n) => marcados.has(n)).length;
  if (quantos === 0) return 'nenhum';
  return quantos === grupo.nomes.length ? 'todos' : 'alguns';
}

/** Tocar a linha: marcada por inteiro, tira todos os nomes do grupo; vazia ou mista, põe todos. Os outros nomes ficam. */
export function alternarGrupo(grupo: Pick<GrupoAgrupado, 'nomes'>, marcados: ReadonlySet<string>): Set<string> {
  const novo = new Set(marcados);
  const tirar = estadoDoGrupo(grupo, marcados) === 'todos';
  for (const n of grupo.nomes) {
    if (tirar) novo.delete(n);
    else novo.add(n);
  }
  return novo;
}

/** Os grupos com algum nome marcado primeiro, cada bloco na ordem que já tinha (a alfabética do `agruparGruposParecidos`). */
export function comMarcadosNoTopo<T extends Pick<GrupoAgrupado, 'nomes'>>(grupos: readonly T[], marcados: ReadonlySet<string>): T[] {
  const marcado = (g: T) => estadoDoGrupo(g, marcados) !== 'nenhum';
  return [...grupos.filter(marcado), ...grupos.filter((g) => !marcado(g))];
}

/**
 * A busca da lista: sem acento nem caixa, no rótulo e em cada variação ("panturrilhas" acha a linha "Panturrilha"). Nunca
 * esconde um grupo marcado ou misto: dá para desmarcar sem apagar a busca.
 */
export function gruposDaBuscaAgrupada<T extends Pick<GrupoAgrupado, 'rotulo' | 'nomes'>>(grupos: readonly T[], busca: string, marcados: ReadonlySet<string>): T[] {
  const termo = semAcento(busca.trim());
  if (!termo) return [...grupos];
  return grupos.filter((g) => estadoDoGrupo(g, marcados) !== 'nenhum' || [g.rotulo, ...g.nomes].some((n) => semAcento(n).includes(termo)));
}

/** Duas colunas lidas de cima para baixo: a esquerda com a metade arredondada para cima (a ordem do Tab é a da leitura). */
export function emDuasColunas<T>(itens: readonly T[]): [T[], T[]] {
  const meio = Math.ceil(itens.length / 2);
  return [itens.slice(0, meio), itens.slice(meio)];
}

/**
 * As opções de modalidade com quantos exercícios da lista têm cada uma ("Máquina 12"). Sem a lista (ainda não chegou), as
 * opções voltam sem contagem e o chip mostra só o nome.
 */
export function comContagemDasModalidades<T extends { valor: string }>(
  opcoes: readonly T[], lista: readonly { modalidade: string }[] | null | undefined,
): (T & { contagem?: number })[] {
  if (!lista) return [...opcoes];
  const contagem = new Map<string, number>();
  for (const e of lista) contagem.set(e.modalidade, (contagem.get(e.modalidade) ?? 0) + 1);
  return opcoes.map((o) => ({ ...o, contagem: contagem.get(o.valor) ?? 0 }));
}
