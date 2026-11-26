import { fibraParcial, textoDaFibra, valoresPorExtenso } from './ValoresDaDieta';

jest.mock('../tema/TemaProvider', () => ({ useTema: () => ({}) }));
jest.mock('./Texto', () => ({ Texto: () => null }));
jest.mock('./Campos', () => ({ CampoNumerico: () => null }));

/** Fibra (V089, 18/11) nos valores da dieta: neutra, depois dos macros; "—" sem valor e "(parcial)" só com soma de uma parte. */
const macros = { kcal: 100, proteina: 1, carboidrato: 2, gordura: 3 };

describe('textoDaFibra', () => {
  it('sem a chave, não fala da fibra; nula é "—"; com valor, uma casa', () => {
    expect(textoDaFibra(macros)).toBeNull();
    expect(textoDaFibra({ ...macros, fibra: null })).toBe('Fibra —');
    expect(textoDaFibra({ ...macros, fibra: 2.75, fibraCompleta: true })).toBe('Fibra 2,8 g');
  });

  it('parcial só com valor e algum item sem fibra; "—" nunca é parcial', () => {
    expect(textoDaFibra({ ...macros, fibra: 12, fibraCompleta: false })).toBe('Fibra 12,0 g (parcial)');
    expect(fibraParcial({ ...macros, fibra: null, fibraCompleta: false })).toBe(false);
    expect(fibraParcial({ ...macros, fibra: 0, fibraCompleta: false })).toBe(true);
    // Alimento da biblioteca: sem `fibraCompleta`, nunca parcial.
    expect(fibraParcial({ ...macros, fibra: 1 })).toBe(false);
  });
});

describe('valoresPorExtenso com fibra', () => {
  it('lê a fibra depois dos macros; sem valor, "sem dado" (editor e aluno)', () => {
    expect(valoresPorExtenso({ ...macros, fibra: 1.5, fibraCompleta: false })).toBe('100 kcal, proteína 1,0 g, carboidrato 2,0 g, gordura 3,0 g, fibra 1,5 g, parcial');
    expect(valoresPorExtenso({ ...macros, fibra: null })).toBe('100 kcal, proteína 1,0 g, carboidrato 2,0 g, gordura 3,0 g, fibra sem dado');
  });
});
