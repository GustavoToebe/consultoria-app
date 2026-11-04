import { colunasDaPrescricao, linhasDaPrescricao, type CaixaDaPrescricao } from './colunasDaPrescricao';

const QUATRO: CaixaDaPrescricao[] = ['repeticoes', 'carga', 'esforco', 'descanso'];
// Soma dos mínimos: 190 + 310 + 200 + 190 + 3 × 12 = 926. Pares: 190 + 310 + 12 = 512 e 200 + 190 + 12 = 402.
describe('colunasDaPrescricao', () => {
  it('põe as quatro numa linha só quando a soma dos mínimos cabe', () => {
    expect(colunasDaPrescricao(926, QUATRO)).toBe(4);
    expect(colunasDaPrescricao(925, QUATRO)).toBe(2);
  });

  it('de duas em duas quando cada par cabe (inspetor de 1440 e 1280, lista empilhada em 1024)', () => {
    expect(colunasDaPrescricao(674, QUATRO)).toBe(2);
    expect(colunasDaPrescricao(634, QUATRO)).toBe(2);
    expect(colunasDaPrescricao(522, QUATRO)).toBe(2);
    expect(colunasDaPrescricao(512, QUATRO)).toBe(2);
  });

  it('uma por linha quando um par não cabe (celular) ou sem medida', () => {
    expect(colunasDaPrescricao(511, QUATRO)).toBe(1);
    expect(colunasDaPrescricao(294, QUATRO)).toBe(1);
    expect(colunasDaPrescricao(null, QUATRO)).toBe(1);
  });

  it('o Cluster (sem Repetições) cabe numa linha com menos largura', () => {
    const cluster: CaixaDaPrescricao[] = ['carga', 'esforco', 'descanso'];
    expect(colunasDaPrescricao(724, cluster)).toBe(3);
    expect(colunasDaPrescricao(723, cluster)).toBe(2);
  });

  it('o texto maior aumenta os mínimos', () => {
    expect(colunasDaPrescricao(926, QUATRO, 1.3)).toBe(2);
    expect(colunasDaPrescricao(522, QUATRO, 1.3)).toBe(1);
  });

  it('uma caixa só é sempre uma coluna', () => {
    expect(colunasDaPrescricao(2000, ['descanso'])).toBe(1);
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
