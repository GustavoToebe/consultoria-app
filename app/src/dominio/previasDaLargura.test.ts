import { escolherNaPrevia, previasDaLargura } from './previasDaLargura';

describe('previasDaLargura (pela área de prévia)', () => {
  test('abaixo de 1500: uma prévia com o segmento, a da esquerda', () => {
    expect(previasDaLargura(0)).toEqual({ documentos: ['treino'], escolha: true });
    expect(previasDaLargura(1499)).toEqual({ documentos: ['treino'], escolha: true });
    expect(previasDaLargura(1499, ['mobilidade', 'dieta'])).toEqual({ documentos: ['mobilidade'], escolha: true });
  });
  test('de 1500 a 2399: duas prévias com o segmento, Treino e Dieta por padrão', () => {
    expect(previasDaLargura(1500)).toEqual({ documentos: ['treino', 'dieta'], escolha: true });
    expect(previasDaLargura(2399)).toEqual({ documentos: ['treino', 'dieta'], escolha: true });
    expect(previasDaLargura(2000, ['dieta', 'mobilidade'])).toEqual({ documentos: ['dieta', 'mobilidade'], escolha: true });
  });
  test('de 2400: as três, sem segmento, na ordem fixa (a escolha não muda nada)', () => {
    expect(previasDaLargura(2400)).toEqual({ documentos: ['treino', 'dieta', 'mobilidade'], escolha: false });
    expect(previasDaLargura(3440, ['mobilidade', 'treino'])).toEqual({ documentos: ['treino', 'dieta', 'mobilidade'], escolha: false });
  });
});

describe('escolherNaPrevia', () => {
  test('documento livre: só muda o lado escolhido', () => {
    expect(escolherNaPrevia(['treino', 'dieta'], 1, 'mobilidade')).toEqual(['treino', 'mobilidade']);
    expect(escolherNaPrevia(['treino', 'dieta'], 0, 'mobilidade')).toEqual(['mobilidade', 'dieta']);
  });
  test('o que o outro lado mostra: troca os dois, nunca o mesmo nos dois', () => {
    expect(escolherNaPrevia(['treino', 'dieta'], 0, 'dieta')).toEqual(['dieta', 'treino']);
    expect(escolherNaPrevia(['treino', 'dieta'], 1, 'treino')).toEqual(['dieta', 'treino']);
  });
  test('o que já está no lado: nada muda', () => {
    expect(escolherNaPrevia(['treino', 'dieta'], 0, 'treino')).toEqual(['treino', 'dieta']);
  });
  test('não altera a lista recebida', () => {
    const antes = ['treino', 'dieta'] as const;
    escolherNaPrevia(antes, 0, 'dieta');
    expect(antes).toEqual(['treino', 'dieta']);
  });
});
