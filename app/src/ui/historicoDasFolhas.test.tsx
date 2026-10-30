import type { PortalDaFolhaValor } from './Folha';

/**
 * O módulo que mexe no `window.history` de verdade, com um navegador de mentira em que o `popstate` de um `history.go`
 * chega depois de um atraso (como no Chromium ocupado) e as voltas pedidas são feitas em fila, cada uma a partir de onde
 * a anterior parou. O estado do módulo é global: cada teste carrega uma cópia nova (`jest.resetModules`).
 */
type Estado = Record<string, unknown> | null;

function criarNavegador(atrasoDoPopstate: number) {
  // A entrada da tela anterior e a da tela com a Folha (o `id` é o do expo-router).
  const entradas: Estado[] = [{ id: 'anterior' }, { id: 'tela' }];
  let atual = 1;
  const ouvintes: (() => void)[] = [];
  const history = {
    get state() { return entradas[atual]; },
    pushState(estado: Estado) { entradas.splice(atual + 1); entradas.push(estado); atual += 1; },
    replaceState(estado: Estado) { entradas[atual] = estado; },
    go(delta: number) {
      setTimeout(() => {
        const alvo = atual + delta;
        if (alvo < 0 || alvo >= entradas.length) return;
        atual = alvo;
        ouvintes.forEach((ouvir) => ouvir());
      }, atrasoDoPopstate);
    },
  };
  const janela = {
    history,
    addEventListener: (tipo: string, ouvir: () => void) => { if (tipo === 'popstate') ouvintes.push(ouvir); },
    removeEventListener: () => undefined,
  };
  return { janela, atual: () => entradas[atual] };
}

function carregar(atrasoDoPopstate: number) {
  // Módulos recém-carregados (`jest.resetModules` no `beforeEach`): o estado do histórico das Folhas é global.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  jest.replaceProperty((require('react-native') as typeof import('react-native')).Platform, 'OS', 'web');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof import('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const historico = require('./historicoDasFolhas') as typeof import('./historicoDasFolhas');
  // Depois dos `require`: carregar o react-native mexe no `window` global.
  const navegador = criarNavegador(atrasoDoPopstate);
  (globalThis as { window?: unknown }).window = navegador.janela;
  const fechou = jest.fn();
  function FolhaFalsa() {
    historico.useFolhaNoHistorico(fechou, {} as PortalDaFolhaValor);
    return null;
  }
  let raiz!: import('react-test-renderer').ReactTestRenderer;
  const passar = (ms: number) => Renderer.act(() => { jest.advanceTimersByTime(ms); });
  return {
    historico,
    navegador,
    fechou,
    passar,
    montar: (folhas: number) => {
      const filhos = Array.from({ length: folhas }, (_, i) => React.createElement(FolhaFalsa, { key: i }));
      Renderer.act(() => {
        if (raiz) raiz.update(React.createElement(React.Fragment, null, filhos));
        else raiz = Renderer.create(React.createElement(React.Fragment, null, filhos));
      });
    },
  };
}

const janelaOriginal = (globalThis as { window?: unknown }).window;

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  (globalThis as { window?: unknown }).window = janelaOriginal;
});

describe('Folha no histórico do navegador (web)', () => {
  it('fechar a Folha volta só a entrada dela', () => {
    const { navegador, montar, passar } = carregar(5);
    montar(1);
    passar(0);
    expect(navegador.atual()).toEqual({ id: 'tela', folhaNivel: 1 });
    montar(0);
    passar(2_000);
    expect(navegador.atual()).toEqual({ id: 'tela' });
  });

  it('com o navegador lento (o popstate chega depois do tempo de espera), fechar a Folha não volta uma tela a mais', () => {
    const { navegador, montar, passar } = carregar(1_000);
    montar(1);
    passar(0);
    montar(0);
    passar(5_000);
    // Antes, a espera se soltava em 400 ms, o acerto via a entrada da Folha ainda lá e pedia outra volta: as duas juntas
    // tiravam a pessoa da tela (no e2e, para o about:blank).
    expect(navegador.atual()).toEqual({ id: 'tela' });
  });

  it('Folha aberta enquanto a volta lenta não chegou ganha a entrada dela depois que a volta chega', () => {
    const { navegador, fechou, montar, passar } = carregar(1_000);
    montar(1);
    passar(0);
    montar(0);
    passar(500);
    montar(1);
    passar(0);
    // A volta ainda vai chegar: empilhar agora faria ela desfazer a entrada nova.
    expect(navegador.atual()).toEqual({ id: 'tela', folhaNivel: 1 });
    passar(5_000);
    expect(navegador.atual()).toEqual({ id: 'tela', folhaNivel: 1 });
    // Nenhuma volta a mais chegou depois para fechar a Folha nova sem a pessoa pedir.
    expect(fechou).not.toHaveBeenCalled();
    // E o voltar seguinte fecha a Folha sem sair da tela.
    montar(0);
    passar(5_000);
    expect(navegador.atual()).toEqual({ id: 'tela' });
  });
});

describe('depoisDeFecharAsFolhas (navegar com o resultado de uma escolha feita na Folha)', () => {
  it('com a Folha fechando, só roda depois que a entrada dela voltou', () => {
    const { historico, navegador, montar, passar } = carregar(50);
    montar(1);
    passar(0);
    montar(0);
    const depois = jest.fn();
    historico.depoisDeFecharAsFolhas(depois);
    expect(depois).not.toHaveBeenCalled();
    passar(0);
    expect(depois).not.toHaveBeenCalled(); // a volta já foi pedida, o popstate ainda não chegou
    passar(100);
    expect(navegador.atual()).toEqual({ id: 'tela' });
    expect(depois).toHaveBeenCalledTimes(1);
    passar(5_000);
    expect(depois).toHaveBeenCalledTimes(1);
  });

  it('sem Folha aberta nem volta a caminho, roda na hora', () => {
    const { historico } = carregar(5);
    const depois = jest.fn();
    historico.depoisDeFecharAsFolhas(depois);
    expect(depois).toHaveBeenCalledTimes(1);
  });

  it('fora da web não espera nada, mesmo com Folha aberta', () => {
    const { historico, montar, passar } = carregar(5);
    montar(1);
    passar(0);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    jest.replaceProperty((require('react-native') as typeof import('react-native')).Platform, 'OS', 'ios');
    const depois = jest.fn();
    historico.depoisDeFecharAsFolhas(depois);
    expect(depois).toHaveBeenCalledTimes(1);
  });
});

describe('depoisDeFecharAsFolhas com o navegador lento (o popstate passa das esperas de 400 ms e de 1 s)', () => {
  it('a escolha gravada no endereço fica: `depois` só corre quando a entrada da Folha já voltou', () => {
    const { historico, navegador, montar, passar } = carregar(1_500);
    montar(1);
    passar(0);
    montar(0);
    // O que a Agenda faz: grava o filtro no endereço (um `router.replace`, que no navegador é `replaceState`).
    const depois = jest.fn(() => { (globalThis as unknown as { window: Window }).window.history.replaceState({ id: 'tela', filtro: 'meus' }, ''); });
    historico.depoisDeFecharAsFolhas(depois);
    passar(1_200);
    // Antes, a espera de 400 ms (e a de 1 s) soltava `depois` aqui, em cima da entrada da Folha, e o popstate atrasado o desfazia.
    expect(depois).not.toHaveBeenCalled();
    passar(5_000);
    expect(depois).toHaveBeenCalledTimes(1);
    expect(navegador.atual()).toEqual({ id: 'tela', filtro: 'meus' });
  });

  it('se o popstate nunca vier, `depois` corre na espera máxima (nada fica preso)', () => {
    const { historico, montar, passar } = carregar(600_000);
    montar(1);
    passar(0);
    montar(0);
    const depois = jest.fn();
    historico.depoisDeFecharAsFolhas(depois);
    passar(4_000);
    expect(depois).not.toHaveBeenCalled();
    passar(2_000);
    expect(depois).toHaveBeenCalledTimes(1);
  });
});
