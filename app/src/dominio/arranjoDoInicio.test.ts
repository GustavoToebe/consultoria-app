import { faixasDaTelaDoInicio, pilhasDoInicio, type SituacaoDoInicio } from './arranjoDoInicio';

const TUDO: SituacaoDoInicio = { treino: true, retorno: true, online: true, vitrine: true };
const pecas = (s: SituacaoDoInicio) => pilhasDoInicio(s).map((p) => [p.faixas, p.pecas]);

describe('pilhasDoInicio', () => {
  it('com o retorno: o dia numa faixa (Hoje primeiro) e o progresso em duas: semana e nível lado a lado, o mapa e, sob ele, compromissos e vitrine', () => {
    expect(pecas(TUDO)).toEqual([
      [1, ['hoje', 'dieta', 'agua', 'pendencias']],
      [2, ['semanaENivel', 'mapa', 'compromissosEVitrine']],
    ]);
  });

  it('sem internet (sem o nível) ou sem treino (sem a semana): o que sobra vai logo depois do Hoje, e o mapa fica sozinho', () => {
    expect(pecas({ ...TUDO, online: false })).toEqual([[1, ['hoje', 'semana', 'dieta', 'agua', 'pendencias']], [2, ['mapa', 'compromissosEVitrine']]]);
    expect(pecas({ ...TUDO, treino: false })).toEqual([[1, ['hoje', 'nivel', 'dieta', 'agua', 'pendencias']], [2, ['mapa', 'compromissosEVitrine']]]);
    expect(pecas({ ...TUDO, treino: false, online: false })).toEqual([[1, ['hoje', 'dieta', 'agua', 'pendencias']], [2, ['mapa', 'compromissosEVitrine']]]);
  });

  it('sem o retorno: pilhas de uma faixa, Hoje primeiro; a vitrine abre a terceira', () => {
    const sem = { ...TUDO, retorno: false };
    expect(pecas(sem)).toEqual([[1, ['hoje', 'dieta', 'agua']], [1, ['pendencias', 'compromissos', 'semana']], [1, ['vitrine']]]);
    expect(pecas({ ...sem, vitrine: false })).toEqual([[1, ['hoje', 'dieta', 'agua']], [1, ['pendencias', 'compromissos', 'semana']]]);
  });

  it('o Hoje é sempre a primeira peça da primeira pilha, e a soma das faixas bate com o teto da tela', () => {
    for (const treino of [true, false]) for (const retorno of [true, false]) for (const online of [true, false]) for (const vitrine of [true, false]) {
      const s = { treino, retorno, online, vitrine };
      const pilhas = pilhasDoInicio(s);
      expect(pilhas[0].pecas[0]).toBe('hoje');
      expect(pilhas.reduce((t, p) => t + p.faixas, 0)).toBe(faixasDaTelaDoInicio(s));
      // Cada bloco aparece uma vez só, e todos os que a situação mostra estão lá.
      const todas = pilhas.flatMap((p) => p.pecas).flatMap((p) => (p === 'semanaENivel' ? ['semana', 'nivel'] : p === 'compromissosEVitrine' ? ['compromissos', 'vitrine'] : [p]));
      expect(new Set(todas).size).toBe(todas.length);
      for (const b of ['hoje', 'dieta', 'agua', 'pendencias', 'compromissos', ...(treino ? ['semana'] : [])]) expect(todas).toContain(b);
      if (vitrine) expect(todas).toContain('vitrine');
      if (retorno) expect(todas).toEqual(expect.arrayContaining(['mapa', ...(online ? ['nivel'] : [])]));
    }
  });
});

describe('faixasDaTelaDoInicio', () => {
  it('três com o mapa (retorno, mesmo sem internet) ou com a vitrine; senão duas', () => {
    expect(faixasDaTelaDoInicio({ ...TUDO, online: false, vitrine: false })).toBe(3);
    expect(faixasDaTelaDoInicio({ ...TUDO, retorno: false })).toBe(3);
    expect(faixasDaTelaDoInicio({ ...TUDO, retorno: false, vitrine: false })).toBe(2);
  });
});
