/**
 * Colunas de uma grade de indicadores (Gustavo, 19/11 e 24/11). Mede a largura da própria grade (já sem o menu e sem a
 * folga da `Tela`), não a da janela. O texto ampliado (`fatorTexto`) aumenta o mínimo: a grade perde colunas antes de
 * cortar o número.
 *
 * - Cabem todos numa linha: uma linha.
 * - Total com divisor (2, 3, 4, 6, 8, 9, 10, 12...): o maior divisor que cabe, todas as linhas cheias, senão 1 coluna.
 *   4 dão 4, 2 + 2 ou 1; 6 dão 6, 3 + 3, 2 + 2 + 2 ou 1; nunca 3 + 1 nem 5 + 1.
 * - Total sem divisor (primo a partir de 5: 5, 7, 11, 13): o maior número de colunas que cabe entre 4, 3 e 2 e as linhas
 *   EQUILIBRADAS (`linhasDaGrade`): diferem em no máximo 1 cartão e as de cima ficam com os que sobram. Cada linha com
 *   menos cartões que a mais cheia ESTICA até a largura toda (`ui/Grade` com `ultimaLinha="esticar"`), sem buraco à
 *   direita: 5 dá 3 + 2; 7 dá 4 + 3 (ou 3 + 2 + 2); 11 dá 4 + 4 + 3 (ou 3 + 3 + 3 + 2); 13 dá 4 + 3 + 3 + 3. Só sobra um
 *   cartão sozinho (esticado, a linha toda) em 2 colunas: 5 dá 2 + 2 + 1. 1 coluna só se nem 2 couberem.
 */

/**
 * Célula mínima padrão: "R$ 100.000,00" na variante `destaque` (30 px, Geist Mono, ~222 px) mais o recuo do cartão (borda
 * de 1, 16 à esquerda e 8 à direita; a faixa de 4 saiu no cartão pintado, 23/11, e a folga ficou). Com 12 de vão: 6 colunas a partir de 1560 px de grade (janela de ~1830 com o menu
 * aberto; 1920 dá ~1648), 3 a partir de 774 (janela de ~1050 com o menu aberto), 2 a partir de 512.
 */
export const MINIMO_DA_CELULA = 250;
export const VAO_DA_GRADE = 12;

/** Colunas de um total sem divisor, da preferida para a última saída. */
const LINHAS_SEM_DIVISOR = [4, 3, 2];

export function colunasDaGradeDeIndicadores(
  largura: number,
  total: number,
  { minimo = MINIMO_DA_CELULA, vao = VAO_DA_GRADE, fatorTexto = 1 }: { minimo?: number; vao?: number; fatorTexto?: number } = {},
): number {
  if (!(largura > 0) || total <= 1) return 1;
  const celula = Math.round(minimo * fatorTexto);
  const cabe = (colunas: number) => (largura - vao * (colunas - 1)) / colunas >= celula;
  if (cabe(total)) return total;
  let temDivisor = false;
  for (let colunas = total - 1; colunas > 1; colunas--) {
    if (total % colunas !== 0) continue; // sobraria linha incompleta
    temDivisor = true;
    if (cabe(colunas)) return colunas;
  }
  if (temDivisor || total < 5) return 1; // 2 e 3 seguem: todos numa linha ou 1 coluna (nunca 2 + 1)
  return LINHAS_SEM_DIVISOR.find((c) => c < total && cabe(c)) ?? 1;
}

/**
 * Cartões de cada linha para `total` cartões em até `colunas` por linha: `ceil(total / colunas)` linhas que diferem em no
 * máximo 1, as primeiras com os que sobram (7 em 3: 3, 2, 2; 5 em 2: 2, 2, 1). Com divisor exato, todas iguais.
 */
export function linhasDaGrade(total: number, colunas: number): number[] {
  if (!(total > 0)) return [];
  const c = Math.max(1, Math.min(Math.floor(colunas), total));
  const linhas = Math.ceil(total / c);
  const base = Math.floor(total / linhas);
  const maisUm = total % linhas;
  return Array.from({ length: linhas }, (_, i) => base + (i < maisUm ? 1 : 0));
}
