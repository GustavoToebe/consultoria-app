import { folhasParaFechar, nivelDoEstado, passosParaSairDeEntradasSobrando, planejarAcerto } from './historicoDasFolhas';

describe('Folhas no histórico do navegador', () => {
  it('abrir uma Folha empilha uma entrada; abrir outra empilha mais uma', () => {
    expect(planejarAcerto(1, 0)).toEqual({ tipo: 'empilhar', niveis: [1] });
    expect(planejarAcerto(2, 1)).toEqual({ tipo: 'empilhar', niveis: [2] });
    expect(planejarAcerto(2, 0)).toEqual({ tipo: 'empilhar', niveis: [1, 2] });
  });

  it('fechar a Folha pelo X volta a entrada que ela ocupava', () => {
    expect(planejarAcerto(0, 1)).toEqual({ tipo: 'voltar', passos: 1 });
    expect(planejarAcerto(1, 2)).toEqual({ tipo: 'voltar', passos: 1 });
    expect(planejarAcerto(0, 2)).toEqual({ tipo: 'voltar', passos: 2 });
  });

  it('fechar uma Folha e abrir outra no mesmo toque não mexe no histórico', () => {
    expect(planejarAcerto(1, 1)).toEqual({ tipo: 'nada' });
    expect(planejarAcerto(0, 0)).toEqual({ tipo: 'nada' });
  });

  it('o voltar do navegador fecha só as Folhas que passaram do nível da entrada', () => {
    expect(folhasParaFechar(1, 0)).toBe(1);
    expect(folhasParaFechar(2, 1)).toBe(1);
    expect(folhasParaFechar(2, 0)).toBe(2);
    expect(folhasParaFechar(1, 1)).toBe(0);
    // Avançar para uma entrada de Folha que não está mais aberta não abre nada.
    expect(folhasParaFechar(0, 1)).toBe(0);
  });

  it('ao voltar de outra tela para uma que deixou entradas de Folha para trás, volta por cima delas', () => {
    expect(passosParaSairDeEntradasSobrando(1, 0, true)).toBe(1);
    expect(passosParaSairDeEntradasSobrando(2, 0, true)).toBe(2);
    // Mesma tela (avançar de dentro dela), nada sobrando ou Folha aberta: não mexe.
    expect(passosParaSairDeEntradasSobrando(1, 0, false)).toBe(0);
    expect(passosParaSairDeEntradasSobrando(0, 0, true)).toBe(0);
    expect(passosParaSairDeEntradasSobrando(1, 1, true)).toBe(0);
  });

  it('só entende o nível quando a marca é um inteiro positivo', () => {
    expect(nivelDoEstado({ id: 'a', folhaNivel: 2 })).toBe(2);
    expect(nivelDoEstado({ id: 'a' })).toBe(0);
    expect(nivelDoEstado(null)).toBe(0);
    expect(nivelDoEstado({ folhaNivel: '1' })).toBe(0);
    expect(nivelDoEstado({ folhaNivel: -1 })).toBe(0);
    expect(nivelDoEstado({ folhaNivel: 1.5 })).toBe(0);
  });
});
