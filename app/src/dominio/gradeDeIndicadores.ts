/**
 * Colunas de uma grade de indicadores (Gustavo, 19/11 e 24/11): todas as linhas cheias, nunca cartão sozinho nem linha com
 * buraco. Vale o maior divisor do total, do próprio total para baixo, em que cada célula tem ao menos `minimo` px: 6 cartões
 * dão 6, 3 (3 + 3), 2 ou 1; 4 dão 4, 2 (2 + 2) ou 1; 3 dão 3 ou 1; 5 (e 7) não têm divisão sem sobra: todos numa linha ou
 * 1 coluna, nunca 3 + 2 nem 4 + 1. Mede a largura da própria grade (já sem o menu e sem a folga da `Tela`), não a da janela.
 * O texto ampliado (`fatorTexto`) aumenta o mínimo: a grade perde colunas antes de cortar o número.
 */

/**
 * Célula mínima padrão: "R$ 100.000,00" na variante `destaque` (30 px, Geist Mono, ~222 px) mais o recuo do cartão (borda
 * de 1, 16 à esquerda e 8 à direita; a faixa de 4 saiu no cartão pintado, 23/11, e a folga ficou). Com 12 de vão: 6 colunas a partir de 1560 px de grade (janela de ~1830 com o menu
 * aberto; 1920 dá ~1648), 3 a partir de 774 (janela de ~1050 com o menu aberto), 2 a partir de 512.
 */
export const MINIMO_DA_CELULA = 250;
export const VAO_DA_GRADE = 12;

export function colunasDaGradeDeIndicadores(
  largura: number,
  total: number,
  { minimo = MINIMO_DA_CELULA, vao = VAO_DA_GRADE, fatorTexto = 1 }: { minimo?: number; vao?: number; fatorTexto?: number } = {},
): number {
  if (!(largura > 0) || total <= 1) return 1;
  const celula = Math.round(minimo * fatorTexto);
  for (let colunas = total; colunas > 1; colunas--) {
    if (total % colunas !== 0) continue; // sobraria linha incompleta
    if ((largura - vao * (colunas - 1)) / colunas >= celula) return colunas;
  }
  return 1;
}
