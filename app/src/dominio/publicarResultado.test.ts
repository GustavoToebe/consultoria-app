import { LIMITE_DO_TEXTO_PRONTO, textoDoResultado } from './publicarResultado';

describe('textoDoResultado', () => {
  it('diz o treino e o resultado', () => {
    expect(textoDoResultado({ treino: 'Treino A', resultado: 'COMPLETA', recordes: 0 })).toBe('Treino concluído: Treino A, fiz tudo.');
    expect(textoDoResultado({ treino: 'Treino B', resultado: 'PARCIAL', recordes: 0 })).toBe('Treino concluído: Treino B, fiz em parte.');
    expect(textoDoResultado({ treino: 'Treino C', resultado: null, recordes: 0 })).toBe('Treino concluído: Treino C.');
  });

  it('conta os recordes do dia no singular e no plural', () => {
    expect(textoDoResultado({ treino: 'Treino A', resultado: 'COMPLETA', recordes: 1 })).toBe('Treino concluído: Treino A, fiz tudo. Bati 1 recorde pessoal hoje!');
    expect(textoDoResultado({ treino: 'Treino A', resultado: 'COMPLETA', recordes: 3 })).toBe('Treino concluído: Treino A, fiz tudo. Bati 3 recordes pessoais hoje!');
  });

  it('corta o nome longo para caber em 280 e nunca leva carga', () => {
    const texto = textoDoResultado({ treino: 'Peito '.repeat(80), resultado: 'PARCIAL', recordes: 2 });
    expect(texto.length).toBeLessThanOrEqual(LIMITE_DO_TEXTO_PRONTO);
    expect(texto).toContain('…, fiz em parte. Bati 2 recordes pessoais hoje!');
    expect(texto).not.toMatch(/kg|lb/);
  });

  it('nome vazio vira "treino do dia"', () => {
    expect(textoDoResultado({ treino: '  ', resultado: 'COMPLETA', recordes: 0 })).toBe('Treino concluído: treino do dia, fiz tudo.');
  });
});
