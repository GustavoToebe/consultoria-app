import { basesDasColunas, colunasDaPrescricao, linhasDaPrescricao, type CaixaDaPrescricao } from './colunasDaPrescricao';

const QUATRO: CaixaDaPrescricao[] = ['repeticoes', 'carga', 'esforco', 'descanso'];
// Grade de duas colunas: max(190, 200) + max(310, 190) + 12 = 522.
describe('colunasDaPrescricao', () => {
  it('nunca passa de duas por linha, mesmo com largura para as quatro (decisão A, 04/11)', () => {
    expect(colunasDaPrescricao(926, QUATRO)).toBe(2);
    expect(colunasDaPrescricao(2000, QUATRO)).toBe(2);
  });

  it('de duas em duas quando cada par cabe (inspetor de 1440 e 1280, lista empilhada em 1024)', () => {
    expect(colunasDaPrescricao(674, QUATRO)).toBe(2);
    expect(colunasDaPrescricao(634, QUATRO)).toBe(2);
    expect(colunasDaPrescricao(522, QUATRO)).toBe(2);
  });

  it('uma por linha quando um par não cabe (celular) ou sem medida', () => {
    expect(colunasDaPrescricao(521, QUATRO)).toBe(1);
    expect(colunasDaPrescricao(294, QUATRO)).toBe(1);
    expect(colunasDaPrescricao(null, QUATRO)).toBe(1);
  });

  it('o Cluster (sem Repetições) também fica em duas: Carga e Esforço, e o Descanso embaixo', () => {
    const cluster: CaixaDaPrescricao[] = ['carga', 'esforco', 'descanso'];
    expect(colunasDaPrescricao(2000, cluster)).toBe(2);
    expect(colunasDaPrescricao(522, cluster)).toBe(2);
    expect(colunasDaPrescricao(521, cluster)).toBe(1);
  });

  it('o texto maior aumenta os mínimos', () => {
    expect(colunasDaPrescricao(926, QUATRO, 1.3)).toBe(2);
    expect(colunasDaPrescricao(522, QUATRO, 1.3)).toBe(1);
  });

  it('uma caixa só é sempre uma coluna', () => {
    expect(colunasDaPrescricao(2000, ['descanso'])).toBe(1);
  });
});

describe('basesDasColunas', () => {
  it('cada coluna tem a base da maior caixa dela, para as linhas alinharem', () => {
    expect(basesDasColunas(QUATRO, 2)).toEqual([200, 310]);
    expect(basesDasColunas(['carga', 'esforco', 'descanso'], 2)).toEqual([310, 200]);
    expect(basesDasColunas(QUATRO, 1)).toEqual([310]);
  });
});

describe('linhasDaPrescricao', () => {
  it('quebra na ordem de leitura', () => {
    expect(linhasDaPrescricao(QUATRO, 2)).toEqual([['repeticoes', 'carga'], ['esforco', 'descanso']]);
    expect(linhasDaPrescricao(['carga', 'esforco', 'descanso'], 2)).toEqual([['carga', 'esforco'], ['descanso']]);
    expect(linhasDaPrescricao(QUATRO, 4)).toEqual([QUATRO]);
    expect(linhasDaPrescricao(QUATRO, 1)).toEqual(QUATRO.map((c) => [c]));
  });
});
