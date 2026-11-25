/**
 * Colunas de uma grade de indicadores (Gustavo, 19/11 e 24/11). Mede a largura da própria grade (já sem o menu e sem a
 * folga da `Tela`), não a da janela. O texto ampliado (`fatorTexto`) aumenta o mínimo: a grade perde colunas antes de
 * cortar o número.
 *
 * - Cabem todos numa linha: uma linha.
 * - Total com divisor (2, 3, 4, 6, 8, 9, 10, 12...): o maior divisor que cabe, todas as linhas cheias, senão 1 coluna.
 *   4 dão 4, 2 + 2 ou 1; 6 dão 6, 3 + 3, 2 + 2 + 2 ou 1; nunca 3 + 1 nem 5 + 1.
 * - Total sem divisor (primo a partir de 5: 5, 7, 11, 13): linhas de 4, 3 ou 2 (o maior que cabe, evitando sobrar um só
 *   na última linha) e a última linha, mais curta, ESTICA até a largura toda (`ui/Grade` com `ultimaLinha="esticar"`):
 *   5 dá 3 + 2; 7 dá 4 + 3; 11 dá 4 + 4 + 3. Sobra um só (esticado, a linha toda) quando nada melhor cabe: 7 entre 774 e
 *   1035 px (3 + 3 + 1) e qualquer um deles em 2 colunas (2 + 2 + 1). 1 coluna só se nem 2 couberem.
 */

/**
 * Célula mínima padrão: "R$ 100.000,00" na variante `destaque` (30 px, Geist Mono, ~222 px) mais o recuo do cartão (borda
 * de 1, 16 à esquerda e 8 à direita; a faixa de 4 saiu no cartão pintado, 23/11, e a folga ficou). Com 12 de vão: 6 colunas a partir de 1560 px de grade (janela de ~1830 com o menu
 * aberto; 1920 dá ~1648), 3 a partir de 774 (janela de ~1050 com o menu aberto), 2 a partir de 512.
 */
export const MINIMO_DA_CELULA = 250;
export const VAO_DA_GRADE = 12;

/** Largura das linhas de um total sem divisor, da preferida para a última saída. */
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
  const linhas = LINHAS_SEM_DIVISOR.filter((r) => r < total && cabe(r));
  return linhas.find((r) => total % r !== 1) ?? linhas[0] ?? 1;
}
