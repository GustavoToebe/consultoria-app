import { espaco } from '../../tema/tokens';

/**
 * Grade de colunas iguais do formulário do alimento (19/11): os macros, a porção, a identificação e os fatores usam as
 * mesmas colunas, para as bordas esquerdas baterem de um cartão para o outro. Com 5 colunas a kcal vira a primeira
 * célula da linha dos macros; com 4 ou 2, ela sobe para a linha do título. A largura é medida (`onLayout`): o RN não tem
 * grade com célula de várias colunas, e com `flexGrow` a célula de duas colunas sai ~6 px fora da borda da coluna.
 */
export type ColunasDaGrade = 5 | 4 | 2;

export const VAO_DA_GRADE = espaco(2);

/**
 * Limites pela largura do conteúdo do cartão: ~640 e ~480 px de modal menos as margens da folha e do cartão (76 px no PC,
 * 68 no celular).
 */
const CINCO_A_PARTIR_DE = 564;
const QUATRO_A_PARTIR_DE = 404;

export function colunasDaGrade(largura: number): ColunasDaGrade {
  return largura >= CINCO_A_PARTIR_DE ? 5 : largura >= QUATRO_A_PARTIR_DE ? 4 : 2;
}

/**
 * Largura de uma célula que ocupa `ocupa` colunas (no máximo todas), com os vãos de dentro. Arredonda para baixo: a soma
 * nunca passa da linha (senão a última célula desceria por meio pixel).
 */
export function larguraDaCelula(largura: number, colunas: ColunasDaGrade, ocupa: number): number {
  const n = Math.min(ocupa, colunas);
  const coluna = (largura - (colunas - 1) * VAO_DA_GRADE) / colunas;
  return Math.max(0, Math.floor(n * coluna + (n - 1) * VAO_DA_GRADE));
}
