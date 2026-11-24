import { dividirEmColunas, quantasColunasNaLista } from './listaEmColunas';

// tela larga: revisão (24/11)
describe('quantasColunasNaLista', () => {
  it('em 1280 com o menu aberto (lista de ~970 px) fica em uma coluna', () => {
    expect(quantasColunasNaLista(970, 560, 24)).toBe(1);
    expect(quantasColunasNaLista(970, 720, 24)).toBe(1);
  });

  it('ganha colunas com o espaço e para no teto de 3', () => {
    expect(quantasColunasNaLista(1600, 560, 24)).toBe(2);
    expect(quantasColunasNaLista(2250, 560, 24)).toBe(3);
    expect(quantasColunasNaLista(3060, 560, 24)).toBe(3);
  });

  it('o mínimo maior (linha com três botões) pede mais espaço por coluna', () => {
    expect(quantasColunasNaLista(1600, 720, 24)).toBe(2);
    expect(quantasColunasNaLista(1730, 720, 24)).toBe(2);
    expect(quantasColunasNaLista(2250, 720, 24)).toBe(3);
  });

  it('antes da primeira medida (0 px) ou com medida inválida, uma coluna', () => {
    expect(quantasColunasNaLista(0, 560, 24)).toBe(1);
    expect(quantasColunasNaLista(Number.NaN, 560, 24)).toBe(1);
  });
});

describe('dividirEmColunas', () => {
  const itens = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  it('lê de cima para baixo: a coluna 1 inteira, depois a 2, na ordem da lista', () => {
    expect(dividirEmColunas(itens(6), 3)).toEqual([[1, 2], [3, 4], [5, 6]]);
    expect(dividirEmColunas(itens(30), 3).flat()).toEqual(itens(30));
  });

  it('equilibra as colunas (diferença de no máximo um item, as maiores primeiro)', () => {
    expect(dividirEmColunas(itens(7), 3)).toEqual([[1, 2, 3], [4, 5], [6, 7]]);
    expect(dividirEmColunas(itens(4), 3)).toEqual([[1, 2], [3], [4]]);
  });

  it('nunca deixa coluna vazia: com menos itens que colunas, um item por coluna', () => {
    expect(dividirEmColunas(itens(1), 3)).toEqual([[1]]);
    expect(dividirEmColunas(itens(2), 3)).toEqual([[1], [2]]);
    expect(dividirEmColunas([], 3)).toEqual([]);
  });

  it('uma coluna devolve a lista inteira', () => {
    expect(dividirEmColunas(itens(5), 1)).toEqual([itens(5)]);
  });
});
