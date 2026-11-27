import { arranjoDaLista, empilhaDados, larguraDoRotulo, linhaSemDivisoria } from './listaDeDados';

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

  test('arranjo sem ajuste é exatamente o de sempre', () => {
    for (const [largura, fator] of [[0, 1], [415, 1], [416, 1], [900, 1], [450, 1.25], [520, 1.25]] as const) {
      expect(arranjoDaLista(largura, fator)).toEqual({ empilhado: empilhaDados(largura, fator), rotulo: larguraDoRotulo(fator) });
    }
  });

  test('ajuste da leitura: empilha abaixo do limite e o rótulo é a fração da lista, até o teto', () => {
    const leitura = { empilharAbaixoDe: 720, rotulo: { fracao: 0.4, maximo: 320 } };
    expect(arranjoDaLista(0, 1, leitura)).toEqual({ empilhado: true, rotulo: 200 });
    expect(arranjoDaLista(719, 1, leitura).empilhado).toBe(true);
    expect(arranjoDaLista(720, 1, leitura)).toEqual({ empilhado: false, rotulo: 288 });
    expect(arranjoDaLista(1100, 1, leitura)).toEqual({ empilhado: false, rotulo: 320 });
    // Só o limite: a coluna do rótulo segue a de sempre.
    expect(arranjoDaLista(800, 1, { empilharAbaixoDe: 760 })).toEqual({ empilhado: false, rotulo: 200 });
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
});
