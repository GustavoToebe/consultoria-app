import { empilhaDados, larguraDoRotulo, linhaSemDivisoria, partesNumericas } from './listaDeDados';

// ficha: lista de dados (24/11)
describe('lista de dados', () => {
  test('a coluna do rótulo tem 200 px e cresce com o texto grande', () => {
    expect(larguraDoRotulo()).toBe(200);
    expect(larguraDoRotulo(1.25)).toBe(250);
  });

  test('empilha abaixo de rótulo + vão + valor mínimo, a lista inteira de uma vez', () => {
    expect(empilhaDados(0)).toBe(true);
    expect(empilhaDados(Number.NaN)).toBe(true);
    expect(empilhaDados(415)).toBe(true);
    expect(empilhaDados(416)).toBe(false);
    expect(empilhaDados(540)).toBe(false);
    // Texto grande: o mesmo cartão de 450 px passa a empilhar.
    expect(empilhaDados(450, 1.25)).toBe(true);
    expect(empilhaDados(520, 1.25)).toBe(false);
  });

  test('só a última linha do cartão fica sem divisória; a última de uma seção com outra depois tem', () => {
    // Duas seções (2 linhas + 1): posições 0, 1 | 2. A 1 fecha a primeira seção com fio; só a 2 fica sem.
    expect(linhaSemDivisoria(new Set([0, 1, 2]), 3)).toBe(2);
    // Uma seção só.
    expect(linhaSemDivisoria(new Set([0]), 1)).toBe(0);
    // A última posição devolveu `null` (a linha do ciclo sumiu): a anterior, a última que aparece, fica sem fio.
    expect(linhaSemDivisoria(new Set([0, 1]), 3)).toBe(1);
    // A seção de baixo inteira sumiu: a última da de cima vira a última do cartão.
    expect(linhaSemDivisoria(new Set([0, 1, 2]), 5)).toBe(2);
    // Uma linha do meio sumiu: não muda a última.
    expect(linhaSemDivisoria(new Set([0, 2]), 3)).toBe(2);
    // Antes de as linhas se anunciarem, vale a última posição; sem linha nenhuma, nenhuma.
    expect(linhaSemDivisoria(new Set(), 4)).toBe(3);
    expect(linhaSemDivisoria(new Set(), 0)).toBeNull();
  });

  test('só os números levam a fonte numérica', () => {
    expect(partesNumericas('15 dias')).toEqual([{ texto: '15', numerico: true }, { texto: ' dias', numerico: false }]);
    expect(partesNumericas('Padrão da consultoria (15 dias)')).toEqual([
      { texto: 'Padrão da consultoria (', numerico: false }, { texto: '15', numerico: true }, { texto: ' dias)', numerico: false },
    ]);
    expect(partesNumericas('17/10/2026')).toEqual([{ texto: '17/10/2026', numerico: true }]);
    expect(partesNumericas('123.456.789-09')).toEqual([{ texto: '123.456.789-09', numerico: true }]);
    expect(partesNumericas('(45) 99999-8888')).toEqual([
      { texto: '(', numerico: false }, { texto: '45', numerico: true }, { texto: ') ', numerico: false }, { texto: '99999-8888', numerico: true },
    ]);
    expect(partesNumericas('Ontem, 18:38')).toEqual([{ texto: 'Ontem, ', numerico: false }, { texto: '18:38', numerico: true }]);
    expect(partesNumericas('Sem grupo')).toEqual([{ texto: 'Sem grupo', numerico: false }]);
    expect(partesNumericas('')).toEqual([{ texto: '', numerico: false }]);
  });
});
