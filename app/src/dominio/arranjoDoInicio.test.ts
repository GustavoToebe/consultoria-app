import { faixasDaTelaDoInicio, pilhasDoInicio, type SituacaoDoInicio } from './arranjoDoInicio';

const TUDO: SituacaoDoInicio = { retorno: true, vitrine: true };
const pecas = (s: SituacaoDoInicio) => pilhasDoInicio(s).map((p) => [p.faixas, p.pecas]);

describe('pilhasDoInicio', () => {
  it('com o retorno: o dia numa faixa (Hoje primeiro) e o progresso em duas: semana e nível lado a lado, o mapa e, sob ele, compromissos e vitrine', () => {
    const esperado = [[1, ['hoje', 'dieta', 'agua', 'pendencias']], [2, ['semanaENivel', 'mapa', 'compromissosEVitrine']]];
    expect(pecas(TUDO)).toEqual(esperado);
    // A vitrine não muda o arranjo: o bloco dela some sozinho sem itens, sem nada trocar de pilha.
    expect(pecas({ ...TUDO, vitrine: false })).toEqual(esperado);
  });

  it('sem o retorno: pilhas de uma faixa, Hoje primeiro; a vitrine abre a terceira', () => {
    const sem = { ...TUDO, retorno: false };
    expect(pecas(sem)).toEqual([[1, ['hoje', 'dieta', 'agua']], [1, ['pendencias', 'compromissos', 'semana']], [1, ['vitrine']]]);
    expect(pecas({ ...sem, vitrine: false })).toEqual([[1, ['hoje', 'dieta', 'agua']], [1, ['pendencias', 'compromissos', 'semana']]]);
  });

  it('o Hoje é sempre a primeira peça, cada bloco aparece uma vez e a soma das faixas bate com o teto da tela', () => {
    for (const retorno of [true, false]) for (const vitrine of [true, false]) {
      const s = { retorno, vitrine };
      const pilhas = pilhasDoInicio(s);
      expect(pilhas[0].pecas[0]).toBe('hoje');
      expect(pilhas.reduce((t, p) => t + p.faixas, 0)).toBe(faixasDaTelaDoInicio(s));
      const todas = pilhas.flatMap((p) => p.pecas).flatMap((p) => (p === 'semanaENivel' ? ['semana', 'nivel'] : p === 'compromissosEVitrine' ? ['compromissos', 'vitrine'] : [p]));
      expect(new Set(todas).size).toBe(todas.length);
      for (const b of ['hoje', 'dieta', 'agua', 'pendencias', 'compromissos', 'semana'] as const) expect(todas).toContain(b);
      if (vitrine) expect(todas).toContain('vitrine');
      if (retorno) expect(todas).toEqual(expect.arrayContaining(['mapa', 'nivel']));
    }
  });
});

describe('faixasDaTelaDoInicio', () => {
  it('três com o mapa (retorno) ou com a vitrine; senão duas', () => {
    expect(faixasDaTelaDoInicio({ retorno: true, vitrine: false })).toBe(3);
    expect(faixasDaTelaDoInicio({ retorno: false, vitrine: true })).toBe(3);
    expect(faixasDaTelaDoInicio({ retorno: false, vitrine: false })).toBe(2);
  });
});
