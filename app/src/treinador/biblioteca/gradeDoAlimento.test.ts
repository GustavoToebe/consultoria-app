// Macros do alimento e cor da fibra (19/11): a grade de colunas iguais do formulário do alimento.
import { colunasDaGrade, larguraDaCelula, VAO_DA_GRADE } from './gradeDoAlimento';

it('5 colunas no modal largo, 4 no médio e 2 no estreito', () => {
  expect(colunasDaGrade(724)).toBe(5); // modal de 800 no PC
  expect(colunasDaGrade(564)).toBe(5);
  expect(colunasDaGrade(563)).toBe(4);
  expect(colunasDaGrade(404)).toBe(4);
  expect(colunasDaGrade(322)).toBe(2); // folha de baixo em 390 px
});

it('células de várias colunas começam e terminam nas bordas das colunas de uma só', () => {
  const w = 724;
  const uma = larguraDaCelula(w, 5, 1);
  expect(uma).toBe(132);
  // Quantidade (1) + Unidade (2) + Gramas (2) cabem na linha e a Unidade começa onde começa a Proteína.
  const linha = larguraDaCelula(w, 5, 1) + larguraDaCelula(w, 5, 2) + larguraDaCelula(w, 5, 2) + 2 * VAO_DA_GRADE;
  expect(linha).toBeLessThanOrEqual(w);
  expect(w - linha).toBeLessThan(3);
  expect(larguraDaCelula(w, 5, 2)).toBe(2 * uma + VAO_DA_GRADE);
  // Largura que não divide exato: arredonda para baixo e a linha ainda cabe.
  expect(larguraDaCelula(731, 5, 1) * 5 + 4 * VAO_DA_GRADE).toBeLessThanOrEqual(731);
});

it('não ocupa mais colunas do que a grade tem e nunca fica negativa', () => {
  expect(larguraDaCelula(322, 2, 5)).toBe(322);
  expect(larguraDaCelula(0, 2, 1)).toBe(0);
});
