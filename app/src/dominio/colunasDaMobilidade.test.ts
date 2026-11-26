import { LINHA_DAS_TRES_COLUNAS, LINHA_DO_TOTAL_ULTRALARGO } from './colunasDaDieta';
import { colunasDaMobilidade, secaoEmEdicao, VAO_DAS_TRES_COLUNAS } from './colunasDaMobilidade';

const soma = (c: NonNullable<ReturnType<typeof colunasDaMobilidade>>) => c.lista + c.editor + c.previa + 2 * c.vao;

describe('colunasDaMobilidade', () => {
  test('abaixo da faixa larga (ou sem medida) não há prévia: as duas colunas de sempre', () => {
    for (const l of [null, undefined, 0, Number.NaN, -1, 1248, LINHA_DAS_TRES_COLUNAS - 1]) expect(colunasDaMobilidade(l)).toBeNull();
  });

  test('na larga a prévia tem 440 e na ultralarga 560, na mesma régua do total da dieta', () => {
    expect(colunasDaMobilidade(LINHA_DAS_TRES_COLUNAS)?.previa).toBe(440);
    expect(colunasDaMobilidade(LINHA_DO_TOTAL_ULTRALARGO - 1)?.previa).toBe(440);
    expect(colunasDaMobilidade(LINHA_DO_TOTAL_ULTRALARGO)?.previa).toBe(560);
  });

  test('1920 com o menu aberto (linha de 1648): lista de 280, o editor fica com o resto e o vão é o mínimo', () => {
    expect(colunasDaMobilidade(1648)).toEqual({ lista: 280, editor: 880, previa: 440, vao: VAO_DAS_TRES_COLUNAS });
  });

  test('o editor para em 1400, a lista cresce até 320 e a sobra vai igual aos dois vãos', () => {
    // 3440 com o menu aberto: área de 3200 menos o recuo de 48 dos dois lados.
    const c = colunasDaMobilidade(3104)!;
    expect(c.editor).toBe(1400);
    expect(c.lista).toBe(320);
    expect(c.vao).toBe(VAO_DAS_TRES_COLUNAS + (3104 - 560 - 48 - 1400 - 320) / 2);
  });

  test('as três colunas e os dois vãos somam a linha inteira', () => {
    for (const l of [LINHA_DAS_TRES_COLUNAS, 1648, 2000, 2288, LINHA_DO_TOTAL_ULTRALARGO, 2600, 3104, 5000]) expect(soma(colunasDaMobilidade(l)!)).toBeCloseTo(l, 5);
  });
});

describe('secaoEmEdicao', () => {
  const secoes = [{ uid: 'a' }, { uid: 'b' }];
  test('a escolhida, se existe; senão a primeira; sem seções, nenhuma', () => {
    expect(secaoEmEdicao(secoes, 'b')?.uid).toBe('b');
    expect(secaoEmEdicao(secoes, 'sumiu')?.uid).toBe('a');
    expect(secaoEmEdicao(secoes, null)?.uid).toBe('a');
    expect(secaoEmEdicao([], 'a')).toBeNull();
  });
});
