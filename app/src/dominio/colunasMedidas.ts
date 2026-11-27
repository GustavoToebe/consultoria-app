/**
 * Colunas empilhadas pela altura MEDIDA de cada peça (27/11, Início e Dieta do aluno no computador): a coluna de cada peça
 * sai da distribuição em que o fim das colunas fica mais perto um do outro (menor diferença entre a coluna mais alta e a
 * mais baixa; no empate, a mais baixa no total; depois, a primeira encontrada). Diferente da `ui/Alvenaria`, que escolhe
 * por um peso estimado, e da `colunasEquilibradas` da Conta, que só prende a primeira peça: aqui cada peça pode ter regra.
 *
 * - Peça de altura 0 (o bloco que não tem o que mostrar) não conta: nem coluna, nem vão.
 * - `coluna`: coluna fixa (negativa conta do fim: -1 = a última; fora do intervalo, presa à borda).
 * - `abreAUltima`: entre as peças marcadas, a primeira com altura vai para a última coluna (as outras ficam livres). No
 *   Início, as pendências; sem elas, a Água. Se a última já tem peça de coluna fixa, ninguém é preso a ela.
 * - `emOrdem`: o topo da peça nunca fica acima do topo da anterior marcada (as refeições, na ordem do dia).
 * Busca completa (poucas peças: o Início tem 7 e 4 colunas, a Dieta ~12 e 2); acima de `LIMITE_DA_BUSCA` combinações,
 * cada peça vai para a coluna mais baixa na hora.
 */
export interface RegraDaPeca {
  coluna?: number;
  abreAUltima?: boolean;
  emOrdem?: boolean;
}

const LIMITE_DA_BUSCA = 300_000;

export function colunasMedidas(alturas: readonly number[], colunas: number, vao: number, regras: readonly (RegraDaPeca | undefined)[] = []): number[] {
  const n = alturas.length;
  const k = Math.max(1, Math.floor(colunas));
  if (k === 1 || n === 0) return alturas.map(() => 0);
  const prender = (c: number) => Math.min(k - 1, Math.max(0, c < 0 ? k + c : c));
  // A última coluna já aberta por uma peça de coluna fixa (duas colunas: a da Dieta) deixa as de `abreAUltima` livres.
  const ultimaFixa = alturas.some((a, i) => a > 0 && regras[i]?.coluna !== undefined && prender(regras[i]!.coluna!) === k - 1);
  const abre = ultimaFixa ? -1 : alturas.findIndex((a, i) => a > 0 && regras[i]?.abreAUltima);
  const fixa = alturas.map((_, i) => (i === abre ? k - 1 : regras[i]?.coluna === undefined ? null : prender(regras[i]!.coluna!)));
  const livres = alturas.filter((a, i) => a > 0 && fixa[i] === null).length;

  const base = Array<number>(k).fill(-vao);
  const atual = alturas.map((_, i) => fixa[i] ?? 0);
  // Coloca a peça i na coluna c; devolve o topo, ou nulo se fere a ordem.
  const colocar = (i: number, c: number, ultimoTopo: number): number | null => {
    const topo = base[c] + vao;
    return regras[i]?.emOrdem && topo < ultimoTopo ? null : topo;
  };

  if (Math.pow(k, livres) > LIMITE_DA_BUSCA) {
    // shortcut: alvenaria comum (sem garantia de equilíbrio) acima de ~300 mil combinações; trocar por busca com corte se uma tela tiver tantas peças.
    alturas.forEach((a, i) => {
      if (!(a > 0)) return;
      const c = fixa[i] ?? base.indexOf(Math.min(...base));
      base[c] += vao + a;
      atual[i] = c;
    });
    return atual;
  }

  let melhor: number[] | null = null;
  let melhorCusto: [number, number] = [Infinity, Infinity];
  const buscar = (i: number, ultimoTopo: number) => {
    if (i === n) {
      const maior = Math.max(...base);
      const custo: [number, number] = [maior - Math.min(...base), maior];
      if (custo[0] < melhorCusto[0] - 0.5 || (Math.abs(custo[0] - melhorCusto[0]) <= 0.5 && custo[1] < melhorCusto[1] - 0.5)) {
        melhorCusto = custo;
        melhor = [...atual];
      }
      return;
    }
    if (!(alturas[i] > 0)) { buscar(i + 1, ultimoTopo); return; }
    const opcoes = fixa[i] === null ? Array.from({ length: k }, (_, c) => c) : [fixa[i]!];
    for (const c of opcoes) {
      const topo = colocar(i, c, ultimoTopo);
      if (topo === null) continue;
      const antes = base[c];
      base[c] = topo + alturas[i];
      atual[i] = c;
      buscar(i + 1, regras[i]?.emOrdem ? topo : ultimoTopo);
      base[c] = antes;
    }
  };
  buscar(0, 0);
  return melhor ?? atual;
}

/**
 * Quantas colunas usar, de `maxima` para baixo até `minima`: a maior cuja melhor distribuição fecha em até `limite` px; se
 * nenhuma fecha, a de menor diferença (no empate, a maior). Com poucos blocos (o Início sem pendências nem compromissos) três
 * colunas deixam ~100 px sob o Hoje e duas fecham juntas.
 */
export function numeroDeColunasMedidas(alturas: readonly number[], maxima: number, minima: number, vao: number, regras: readonly (RegraDaPeca | undefined)[], limite: number): number {
  let melhor = { k: maxima, diferenca: Infinity };
  for (let k = maxima; k >= Math.max(1, minima); k--) {
    const diferenca = diferencaDasColunas(colunasMedidas(alturas, k, vao, regras), alturas, k, vao);
    if (diferenca <= limite) return k;
    if (diferenca < melhor.diferenca) melhor = { k, diferenca };
  }
  return melhor.k;
}

/** Topo de cada peça na sua coluna (peça de altura 0 não leva vão) e a altura da coluna mais alta. */
export function toposMedidos(coluna: readonly number[], alturas: readonly number[], colunas: number, vao: number): { topos: number[]; altura: number } {
  const base = Array<number>(Math.max(1, colunas)).fill(-vao);
  const topos = coluna.map((c, i) => {
    if (!(alturas[i] > 0)) return Math.max(0, base[c] + vao);
    const topo = base[c] + vao;
    base[c] = topo + alturas[i];
    return topo;
  });
  return { topos, altura: Math.max(0, ...base) };
}

/** Diferença entre o fim da coluna mais alta e o da mais baixa (só colunas com alguma peça). */
export function diferencaDasColunas(coluna: readonly number[], alturas: readonly number[], colunas: number, vao: number): number {
  const base = Array<number>(Math.max(1, colunas)).fill(-vao);
  coluna.forEach((c, i) => { if (alturas[i] > 0) base[c] += vao + alturas[i]; });
  const usadas = base.filter((b) => b > -vao);
  return usadas.length ? Math.max(...usadas) - Math.min(...usadas) : 0;
}
