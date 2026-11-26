import { useRef } from 'react';
import { Text, View } from 'react-native';

import type { GrupoDoMenu } from '../dominio/gruposDoMenu';
import { IconeDoGrupo, SubmenuDoGrupo, useSubmenuDoTrilho } from './SubmenuDoTrilho';

jest.mock('lucide-react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: ViewRN } = require('react-native');
  const Icone = () => React.createElement(ViewRN);
  return { Activity: Icone, Briefcase: Icone, Layers: Icone, Settings: Icone };
});

jest.mock('../tema/TemaProvider', () => ({
  useTema: () => ({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cores: require('../tema/tokens').ESCURO,
    bordas: { bloco: 1 },
    marcaPeca: '#FACC15',
  }),
}));

jest.mock('./Texto', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Texto: ({ children, ...props }: { children?: unknown }) => require('react').createElement(require('react-native').Text, props, children),
}));

jest.mock('./usoWeb', () => ({
  useTeclado: () => undefined,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const RN = require('react-native');
jest.spyOn(RN, 'useWindowDimensions').mockImplementation(() => ({ width: 1280, height: 720, scale: 1, fontScale: 1 }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
type Arvore = import('react-test-renderer').ReactTestRenderer;
type Instancia = import('react-test-renderer').ReactTestInstance;

const GRUPOS: GrupoDoMenu[] = ['Negócio', 'Configurações'];
const POSICAO_DO_GRUPO: Record<GrupoDoMenu, { x: number; y: number; w: number; h: number }> = {
  Acompanhamento: { x: 12, y: 237, w: 48, h: 44 },
  Conteúdo: { x: 12, y: 285, w: 48, h: 44 },
  Negócio: { x: 12, y: 333, w: 48, h: 44 },
  Configurações: { x: 12, y: 600, w: 48, h: 44 },
};

function TrilhoDeTeste({ ativo = true }: { ativo?: boolean }) {
  const trilho = useRef<View | null>(null);
  const { doBotao, doSubmenu } = useSubmenuDoTrilho(trilho, ativo);
  return (
    <View ref={trilho} testID="trilho">
      {GRUPOS.map((grupo) => (
        <IconeDoGrupo
          key={grupo}
          grupo={grupo}
          atual={false}
          ponto={false}
          sinais={[]}
          botao={doBotao(grupo)}
        />
      ))}
      {doSubmenu ? (
        <SubmenuDoGrupo key={doSubmenu.grupo} submenu={doSubmenu}>
          <Text role="menuitem">{`Item de ${doSubmenu.grupo}`}</Text>
        </SubmenuDoGrupo>
      ) : null}
    </View>
  );
}

function botaoDoGrupo(arvore: Arvore, grupo: GrupoDoMenu): Instancia {
  return arvore.root.find((n) => n.props.accessibilityRole === 'button' && n.props.accessibilityLabel === grupo);
}

function menuAberto(arvore: Arvore): Instancia | null {
  const encontrados = arvore.root.findAll((n) => n.props.role === 'menu');
  return encontrados[0] ?? null;
}

function superficieDePonteiroDoSubmenu(arvore: Arvore): Instancia {
  const encontrados = arvore.root.findAll((n) => typeof n.props.onPointerEnter === 'function' && n.props.accessibilityRole !== 'button');
  if (encontrados.length === 0) throw new Error('Nó de ponteiro do submenu não encontrado');
  return encontrados[0];
}

function estiloResolvido(no: Instancia): Record<string, unknown> {
  const flat = (valor: unknown): Record<string, unknown> => {
    if (!valor) return {};
    if (Array.isArray(valor)) return valor.reduce<Record<string, unknown>>((acc, item) => ({ ...acc, ...flat(item) }), {});
    return typeof valor === 'object' ? (valor as Record<string, unknown>) : {};
  };
  return flat(no.props.style);
}

function configurarMedicaoDosBotoes(arvore: Arvore) {
  for (const grupo of GRUPOS) {
    const { x, y, w, h } = POSICAO_DO_GRUPO[grupo];
    const nos = arvore.root.findAll(
      (n) => n.props.accessibilityRole === 'button' && n.props.accessibilityLabel === grupo && n.instance !== null,
    );
    for (const no of nos) {
      const instancia = no.instance as {
        measureInWindow?: (cb: (mx: number, my: number, mw: number, mh: number) => void) => void;
        measureLayout?: (_ancestral: unknown, cb: (mx: number, my: number, mw: number, mh: number) => void) => void;
      };
      instancia.measureInWindow = (cb) => cb(x, y, w, h);
      instancia.measureLayout = (_ancestral, cb) => cb(x, y, w, h);
    }
  }
}

function montar(ativo = true): Arvore {
  let arvore: Arvore | undefined;
  Renderer.act(() => {
    arvore = Renderer.create(<TrilhoDeTeste ativo={ativo} />);
  });
  configurarMedicaoDosBotoes(arvore as Arvore);
  return arvore as Arvore;
}

function entrarNoBotao(botao: Instancia, x = 36, y = 355) {
  Renderer.act(() => {
    if (typeof botao.props.onPointerEnter === 'function') {
      botao.props.onPointerEnter({ nativeEvent: { pointerType: 'mouse', clientX: x, clientY: y } });
    } else if (typeof botao.props.onHoverIn === 'function') {
      botao.props.onHoverIn();
    }
  });
}

function sairDoBotao(botao: Instancia) {
  Renderer.act(() => {
    if (typeof botao.props.onPointerLeave === 'function') {
      botao.props.onPointerLeave({ nativeEvent: { pointerType: 'mouse' } });
    } else if (typeof botao.props.onHoverOut === 'function') {
      botao.props.onHoverOut();
    }
  });
}

function clicarNoBotao(botao: Instancia) {
  Renderer.act(() => {
    botao.props.onPress();
  });
}

function focarNoBotao(botao: Instancia) {
  Renderer.act(() => {
    botao.props.onFocus();
  });
}

function desfocarDoBotao(botao: Instancia, destino: unknown = null) {
  Renderer.act(() => {
    botao.props.onBlur({ nativeEvent: { relatedTarget: destino } });
  });
}

function entrarNoSubmenu(arvore: Arvore) {
  const alvo = superficieDePonteiroDoSubmenu(arvore);
  Renderer.act(() => {
    alvo.props.onPointerEnter({ nativeEvent: { pointerType: 'mouse' } });
  });
}

function sairDoSubmenu(arvore: Arvore) {
  const alvo = superficieDePonteiroDoSubmenu(arvore);
  Renderer.act(() => {
    alvo.props.onPointerLeave({ nativeEvent: { pointerType: 'mouse' } });
  });
}

function medirSubmenu(arvore: Arvore, altura: number) {
  const menu = menuAberto(arvore);
  if (!menu) throw new Error('Submenu não está aberto para medir');
  Renderer.act(() => {
    menu.props.onLayout({ nativeEvent: { layout: { width: 240, height: altura } } });
  });
}

function opacidadeDoSubmenu(arvore: Arvore): unknown {
  const menu = menuAberto(arvore);
  if (!menu) return undefined;
  const estiloMenu = estiloResolvido(menu);
  if (typeof estiloMenu.opacity === 'number') return estiloMenu.opacity;
  const superficie = superficieDePonteiroDoSubmenu(arvore);
  return estiloResolvido(superficie).opacity;
}

function topoRenderizadoDoSubmenu(arvore: Arvore): unknown {
  const menu = menuAberto(arvore);
  if (!menu) return undefined;
  const estiloMenu = estiloResolvido(menu);
  if (typeof estiloMenu.top === 'number') return estiloMenu.top;
  const superficie = superficieDePonteiroDoSubmenu(arvore);
  return estiloResolvido(superficie).top;
}

describe('SubmenuDoTrilho: useSubmenuDoTrilho, IconeDoGrupo e SubmenuDoGrupo', () => {
  const nodeOriginal = globalThis.Node;

  beforeAll(() => {
    if (typeof globalThis.Node === 'undefined') {
      (globalThis as { Node?: unknown }).Node = class NodeSimulado {};
    }
  });

  afterAll(() => {
    if (nodeOriginal === undefined) delete (globalThis as { Node?: unknown }).Node;
  });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('inicia fechado com aria-expanded={false} e sem role="menu"', () => {
    const arvore = montar();
    expect(botaoDoGrupo(arvore, 'Negócio').props['aria-expanded']).toBe(false);
    expect(botaoDoGrupo(arvore, 'Configurações').props['aria-expanded']).toBe(false);
    expect(menuAberto(arvore)).toBeNull();
  });

  it('abre por hover/pointer enter e permanece aberto quando o ponteiro entra no submenu antes de 200ms', () => {
    const arvore = montar();
    const negocio = botaoDoGrupo(arvore, 'Negócio');

    entrarNoBotao(negocio);
    expect(negocio.props['aria-expanded']).toBe(true);
    expect(menuAberto(arvore)?.props['aria-label']).toBe('Negócio');

    sairDoBotao(negocio);
    Renderer.act(() => { jest.advanceTimersByTime(100); });
    expect(menuAberto(arvore)?.props['aria-label']).toBe('Negócio');

    entrarNoSubmenu(arvore);
    Renderer.act(() => { jest.advanceTimersByTime(300); });
    expect(negocio.props['aria-expanded']).toBe(true);
    expect(menuAberto(arvore)?.props['aria-label']).toBe('Negócio');
  });

  it('fecha após 200ms quando aberto por passagem e o ponteiro sai tanto do botão quanto do submenu', () => {
    const arvore = montar();
    const negocio = botaoDoGrupo(arvore, 'Negócio');

    entrarNoBotao(negocio);
    sairDoBotao(negocio);
    entrarNoSubmenu(arvore);
    sairDoSubmenu(arvore);

    Renderer.act(() => { jest.advanceTimersByTime(199); });
    expect(menuAberto(arvore)?.props['aria-label']).toBe('Negócio');

    Renderer.act(() => { jest.advanceTimersByTime(1); });
    expect(negocio.props['aria-expanded']).toBe(false);
    expect(menuAberto(arvore)).toBeNull();
  });

  it('clique no ícone após hover garante abertura fixa e cliques repetidos com o mouse sobre o ícone mantêm aberto', () => {
    const arvore = montar();
    const negocio = botaoDoGrupo(arvore, 'Negócio');

    entrarNoBotao(negocio);
    clicarNoBotao(negocio);
    expect(negocio.props['aria-expanded']).toBe(true);
    expect(menuAberto(arvore)?.props['aria-label']).toBe('Negócio');

    // Segundo clique com o mouse ainda em cima do ícone não fecha o submenu.
    clicarNoBotao(negocio);
    expect(negocio.props['aria-expanded']).toBe(true);
    expect(menuAberto(arvore)?.props['aria-label']).toBe('Negócio');

    // Mesmo após tirar o mouse e passar 200ms, continua aberto por estar fixo.
    sairDoBotao(negocio);
    Renderer.act(() => { jest.advanceTimersByTime(300); });
    expect(negocio.props['aria-expanded']).toBe(true);
    expect(menuAberto(arvore)?.props['aria-label']).toBe('Negócio');
  });

  it('alterna entre grupos consecutivos (Negócio -> Configurações -> Negócio) atualizando grupo e altura de cada um', () => {
    const arvore = montar();
    const negocio = botaoDoGrupo(arvore, 'Negócio');
    const configuracoes = botaoDoGrupo(arvore, 'Configurações');

    entrarNoBotao(negocio);
    expect(negocio.props['aria-expanded']).toBe(true);
    expect(configuracoes.props['aria-expanded']).toBe(false);
    expect(menuAberto(arvore)?.props['aria-label']).toBe('Negócio');
    medirSubmenu(arvore, 174);
    expect(opacidadeDoSubmenu(arvore)).toBe(1);
    expect(topoRenderizadoDoSubmenu(arvore)).toBe(333);

    sairDoBotao(negocio);
    entrarNoBotao(configuracoes, 36, 610);
    expect(negocio.props['aria-expanded']).toBe(false);
    expect(configuracoes.props['aria-expanded']).toBe(true);
    expect(menuAberto(arvore)?.props['aria-label']).toBe('Configurações');
    // Mesmo medindo a mesma altura (174 px) ou outra (200 px), o submenu novo mede e sobe para caber na janela de 720 px.
    medirSubmenu(arvore, 200);
    expect(opacidadeDoSubmenu(arvore)).toBe(1);
    expect(topoRenderizadoDoSubmenu(arvore)).toBe(512);

    sairDoBotao(configuracoes);
    entrarNoBotao(negocio, 36, 355);
    expect(negocio.props['aria-expanded']).toBe(true);
    expect(configuracoes.props['aria-expanded']).toBe(false);
    expect(menuAberto(arvore)?.props['aria-label']).toBe('Negócio');
    medirSubmenu(arvore, 174);
    expect(opacidadeDoSubmenu(arvore)).toBe(1);
    expect(topoRenderizadoDoSubmenu(arvore)).toBe(333);
  });

  it('onBlur do botão não fecha submenu em passagem enquanto o ponteiro está sobre o botão ou sobre o submenu, fechando fora deles', () => {
    const arvore = montar();
    const negocio = botaoDoGrupo(arvore, 'Negócio');

    entrarNoBotao(negocio);
    focarNoBotao(negocio);
    // Ponteiro ainda sobre o botão: blur não fecha.
    desfocarDoBotao(negocio);
    expect(negocio.props['aria-expanded']).toBe(true);
    expect(menuAberto(arvore)?.props['aria-label']).toBe('Negócio');

    // Ponteiro sai do botão e entra no submenu: blur continua sem fechar.
    sairDoBotao(negocio);
    entrarNoSubmenu(arvore);
    desfocarDoBotao(negocio);
    expect(negocio.props['aria-expanded']).toBe(true);
    expect(menuAberto(arvore)?.props['aria-label']).toBe('Negócio');

    // Ponteiro fora do botão e fora do submenu: blur fecha imediatamente.
    sairDoSubmenu(arvore);
    desfocarDoBotao(negocio);
    expect(negocio.props['aria-expanded']).toBe(false);
    expect(menuAberto(arvore)).toBeNull();
  });

  it('desativa o submenu retornando fechado quando ativo = false e não reabre painel fantasma ao reativar', () => {
    const arvore = montar(true);
    const negocio = botaoDoGrupo(arvore, 'Negócio');

    entrarNoBotao(negocio);
    expect(negocio.props['aria-expanded']).toBe(true);
    expect(menuAberto(arvore)?.props['aria-label']).toBe('Negócio');

    Renderer.act(() => {
      arvore.update(<TrilhoDeTeste ativo={false} />);
    });
    expect(botaoDoGrupo(arvore, 'Negócio').props['aria-expanded']).toBe(false);
    expect(menuAberto(arvore)).toBeNull();

    Renderer.act(() => {
      jest.runAllTimers();
    });
    Renderer.act(() => {
      arvore.update(<TrilhoDeTeste ativo={true} />);
    });
    expect(botaoDoGrupo(arvore, 'Negócio').props['aria-expanded']).toBe(false);
    expect(menuAberto(arvore)).toBeNull();
  });
});
