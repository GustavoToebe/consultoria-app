import { dicaDeCarga, partesDaDica, textoDaUltimaCarga, TEXTO_PRIMEIRA_VEZ } from './dicaDeCarga';

describe('dica de carga (D1)', () => {
  it('sugestão e última vez juntas', () => {
    expect(dicaDeCarga({ sugestaoKg: 60, ultima: { carga: 60, repeticoes: 7 }, semCampoDePeso: false })).toBe('Sugestão: 60 kg · Última vez: 60 kg × 7');
    expect(dicaDeCarga({ sugestaoKg: 42.5, ultima: { carga: 40, repeticoes: 8 }, semCampoDePeso: false })).toBe('Sugestão: 42,5 kg · Última vez: 40 kg × 8');
  });

  it('só uma das partes quando falta a outra', () => {
    expect(dicaDeCarga({ sugestaoKg: 60, ultima: null, semCampoDePeso: false })).toBe('Sugestão: 60 kg');
    expect(dicaDeCarga({ sugestaoKg: null, ultima: { carga: 55, repeticoes: 6 }, semCampoDePeso: false })).toBe('Última vez: 55 kg × 6');
  });

  it('sem sugestão nem última vez: primeira vez', () => {
    expect(dicaDeCarga({ sugestaoKg: null, ultima: null, semCampoDePeso: false })).toBe(TEXTO_PRIMEIRA_VEZ);
    expect(TEXTO_PRIMEIRA_VEZ).toBe('Primeira vez: escolha a carga');
    // Última vez sem carga nem repetições não diz nada: também é a primeira vez.
    expect(dicaDeCarga({ sugestaoKg: null, ultima: { carga: null, repeticoes: null }, semCampoDePeso: false })).toBe(TEXTO_PRIMEIRA_VEZ);
  });

  it('sem campo de peso (sem carga ou cardio) não há dica', () => {
    expect(dicaDeCarga({ sugestaoKg: 60, ultima: { carga: 60, repeticoes: 7 }, semCampoDePeso: true })).toBeNull();
  });

  it('texto da última vez: carga sem repetições, repetições sem carga e etapas', () => {
    expect(textoDaUltimaCarga({ carga: 60, repeticoes: null })).toBe('60 kg');
    expect(textoDaUltimaCarga({ carga: null, repeticoes: 12 })).toBe('12 reps');
    expect(textoDaUltimaCarga({ carga: null, repeticoes: 1 })).toBe('1 rep');
    expect(textoDaUltimaCarga(null)).toBeNull();
    const etapas = [
      { posicao: 1, repeticoes: 4, carga: 40, situacao: 'FEITA' as const },
      { posicao: 2, repeticoes: 4, carga: 40, situacao: 'FEITA' as const },
    ];
    expect(textoDaUltimaCarga({ carga: 40, repeticoes: 8, etapas })).toBe('40 kg × 4+4');
  });

  it('série de trabalho: sugere carga e repetições, com o passo quando a carga sobe', () => {
    expect(dicaDeCarga({ sugestaoKg: 77.5, sugestaoReps: 5, incrementoKg: 2.5, passoKg: 2.5, ultima: { carga: 75, repeticoes: 5 }, semCampoDePeso: false }))
      .toBe('Sugestão: 77,5 kg × 5 reps (+2,5 kg) · Última vez: 75 kg × 5');
    expect(dicaDeCarga({ sugestaoKg: 75, sugestaoReps: 6, incrementoKg: 0, ultima: { carga: 75, repeticoes: 5 }, semCampoDePeso: false }))
      .toBe('Sugestão: 75 kg × 6 reps · Última vez: 75 kg × 5');
  });

  it('partes da dica: sugestão e "Primeira vez" em destaque; o resto em peso normal', () => {
    expect(partesDaDica('Sugestão: 60 kg · Última vez: 60 kg × 7')).toEqual({ destaque: 'Sugestão: 60 kg', resto: 'Última vez: 60 kg × 7' });
    expect(partesDaDica('Sugestão: 60 kg')).toEqual({ destaque: 'Sugestão: 60 kg', resto: null });
    expect(partesDaDica(TEXTO_PRIMEIRA_VEZ)).toEqual({ destaque: TEXTO_PRIMEIRA_VEZ, resto: null });
    expect(partesDaDica('Última vez: 60 kg × 7')).toEqual({ destaque: null, resto: 'Última vez: 60 kg × 7' });
    expect(partesDaDica('Registre a carga da série de referência (Top set) para ver o peso sugerido.').destaque).toBeNull();
  });
});
