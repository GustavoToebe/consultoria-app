import {
  folhasParaFechar, nivelDoEstado, nivelParaAcertar, passosParaSairDeEntradasSobrando, passosParaSairDoEditor, planejarAcerto, podeRegistrarGuarda,
  somarVolta, voltaDepoisDoPopstate,
} from './historicoDasFolhas';

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

describe('guarda de edição no histórico', () => {
  it('a guarda só entra sem Folha aberta e uma de cada vez', () => {
    expect(podeRegistrarGuarda(0, false)).toBe(true);
    expect(podeRegistrarGuarda(1, false)).toBe(false);
    expect(podeRegistrarGuarda(0, true)).toBe(false);
  });

  it('sair do editor com a guarda retirada volta a entrada dela e a da tela', () => {
    expect(passosParaSairDoEditor(1)).toBe(2);
    // O navegador já estava na entrada da tela (voltou da guarda e ainda não reempilhou): só a da tela.
    expect(passosParaSairDoEditor(0)).toBe(1);
  });

  it('com a guarda como única aberta, o voltar para a entrada da tela pede para fechá-la (perguntar) e a reempilha', () => {
    expect(folhasParaFechar(1, 0)).toBe(1);
    expect(planejarAcerto(1, 0)).toEqual({ tipo: 'empilhar', niveis: [1] });
  });
});

describe('volta pedida que ainda não chegou (navegador lento)', () => {
  it('conta com a volta a caminho: a Folha fechada não pede uma segunda volta', () => {
    const pendente = somarVolta(null, 1, 1);
    expect(pendente).toEqual({ nivel: 1, passos: 1 });
    expect(nivelParaAcertar(1, pendente)).toBe(0);
    expect(planejarAcerto(0, 1, pendente)).toEqual({ tipo: 'nada' });
    // Sem contar com ela era o que acontecia: outra volta, uma entrada a mais (saía da tela).
    expect(planejarAcerto(0, 1)).toEqual({ tipo: 'voltar', passos: 1 });
  });

  it('Folha aberta enquanto a volta vem não empilha: a volta desfaria a entrada; o popstate acerta de novo', () => {
    expect(planejarAcerto(1, 1, { nivel: 1, passos: 1 })).toEqual({ tipo: 'nada' });
    expect(planejarAcerto(1, 0, null)).toEqual({ tipo: 'empilhar', niveis: [1] });
  });

  it('outra Folha fechada antes de a primeira volta chegar soma só o que falta', () => {
    const primeira = somarVolta(null, 2, 1);
    expect(planejarAcerto(0, 2, primeira)).toEqual({ tipo: 'voltar', passos: 1 });
    expect(somarVolta(primeira, 2, 1)).toEqual({ nivel: 2, passos: 2 });
    expect(planejarAcerto(0, 2, { nivel: 2, passos: 2 })).toEqual({ tipo: 'nada' });
  });

  it('o histórico já saiu do nível de quando a volta saiu: vale o nível de agora', () => {
    expect(nivelParaAcertar(0, { nivel: 1, passos: 1 })).toBe(0);
    expect(nivelParaAcertar(2, { nivel: 1, passos: 1 })).toBe(2);
    expect(somarVolta({ nivel: 1, passos: 1 }, 2, 1)).toEqual({ nivel: 2, passos: 1 });
  });

  it('cada popstate desconta o quanto o nível desceu; ao sair da tela ou chegar ao nível 0 a conta acaba', () => {
    expect(voltaDepoisDoPopstate({ nivel: 2, passos: 2 }, 1, true)).toEqual({ nivel: 1, passos: 1 });
    expect(voltaDepoisDoPopstate({ nivel: 1, passos: 1 }, 0, true)).toBeNull();
    expect(voltaDepoisDoPopstate({ nivel: 2, passos: 1 }, 1, true)).toBeNull();
    expect(voltaDepoisDoPopstate({ nivel: 1, passos: 2 }, 0, false)).toBeNull();
    expect(voltaDepoisDoPopstate(null, 0, true)).toBeNull();
  });
});
