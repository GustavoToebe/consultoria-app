import type { FaixaDeLargura } from '../tema/tokens';
import { colunasPorCelula } from './colunasPorCelula';

/**
 * Conta do aluno na web (27/11, contêiner do treinador): as seções em colunas empilhadas (`ui/Alvenaria`, como Aparência e
 * preferências e Meus dados do treinador). Teto por faixa da `Tela`: 1 na compacta (celular e tablet), 2 na normal e 3 na
 * larga e na ultralarga; dentro dele, quantas colunas de pelo menos `CELULA_MINIMA_DA_CONTA` cabem, sem passar do número
 * de peças (nunca coluna vazia).
 */
const TETO: Record<FaixaDeLargura, number> = { compacta: 1, normal: 2, larga: 3, ultralarga: 3 };

/** Uma linha da seção ("Trocar senha", com o resumo) cabe em até duas linhas de texto a partir daqui. */
export const CELULA_MINIMA_DA_CONTA = 440;

export function colunasDaConta(largura: number, faixa: FaixaDeLargura, vao: number, pecas: number): number {
  return Math.max(1, Math.min(TETO[faixa], pecas, colunasPorCelula(largura, CELULA_MINIMA_DA_CONTA, vao, 3)));
}

/**
 * Coluna de cada peça (na ordem dada; dentro da coluna elas empilham nessa ordem) para as colunas terminarem o mais perto
 * possível da mesma altura: a distribuição com a menor coluna mais alta, contando `vao` entre as peças. A primeira peça (o
 * perfil) fica sempre no topo da primeira coluna. No empate vale a primeira encontrada, que põe as peças de cima mais à
 * esquerda. Busca completa com corte (a Conta tem até ~10 peças e 3 colunas: no máximo 3^9 caminhos, quase todos cortados).
 * Diferente da alvenaria comum (`colunasDaAlvenaria`), que põe cada peça na coluna mais baixa na hora e deixa buraco quando
 * uma peça alta chega no fim.
 */
export function colunasEquilibradas(alturas: readonly number[], colunas: number, vao: number): number[] {
  const n = alturas.length;
  if (colunas <= 1 || n === 0) return alturas.map(() => 0);
  const soma = Array<number>(colunas).fill(-vao);
  const atual = Array<number>(n).fill(0);
  let melhor: number[] = alturas.map((_, i) => Math.min(i, colunas - 1));
  let teto = Infinity;
  const buscar = (i: number, maior: number) => {
    if (maior >= teto) return;
    if (i === n) { teto = maior; melhor = [...atual]; return; }
    for (let c = 0; c < (i === 0 ? 1 : colunas); c++) {
      // Colunas ainda vazias são iguais entre si: tentar só a primeira delas evita repetir a mesma distribuição.
      if (c > 0 && soma[c] === -vao && soma[c - 1] === -vao) break;
      soma[c] += vao + alturas[i];
      atual[i] = c;
      buscar(i + 1, Math.max(maior, soma[c]));
      soma[c] -= vao + alturas[i];
    }
  };
  buscar(0, 0);
  return melhor;
}
