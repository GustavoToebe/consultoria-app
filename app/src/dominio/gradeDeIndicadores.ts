/**
 * Colunas de uma grade de indicadores (Gustavo, 19/11): colunas iguais que dividem o total, sem cartão sozinho na última
 * linha (nunca 5 + 1). Vale a primeira quebra, da mais larga para a mais estreita, em que cada célula tem ao menos
 * `minimo` px: 6 cartões dão 6, 3 (3 + 3), 2 ou 1; 4 dão 4, 2 (2 + 2) ou 1; 5 dão 5, 3 (3 + 2) ou 1. Total que não divide
 * aceita a última linha com um a menos (3 + 2), nunca com um só. Mede a largura da própria grade (já sem o menu e sem a
 * folga da `Tela`), não a da janela. O texto ampliado (`fatorTexto`) aumenta o mínimo: a grade perde colunas antes de
 * cortar o número.
 */

/**
 * Célula mínima padrão: "R$ 100.000,00" na variante `destaque` (30 px, Geist Mono, ~222 px) mais o recuo do cartão (faixa
 * de 4, 16 à esquerda e 8 à direita). Com 12 de vão: 6 colunas a partir de 1560 px de grade (janela de ~1830 com o menu
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
  for (let linhas = 1; linhas <= total; linhas++) {
    const colunas = Math.ceil(total / linhas);
    if (colunas === 1) return 1;
    if (total % colunas === 1) continue; // sobraria um cartão sozinho
    if (total % colunas !== 0 && total % colunas !== colunas - 1) continue; // última linha desequilibrada (8 em 5 + 3)
    if ((largura - vao * (colunas - 1)) / colunas >= celula) return colunas;
  }
  return 1;
}
