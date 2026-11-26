import { StyleSheet, Text } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import { CLARO, ESCURO } from '../tema/tokens';
import { AbasDasOpcoes, MarcadorDeOpcao } from './MarcadorDeOpcao';

/**
 * Círculo com a letra da opção e as abas das opções (25/11), a peça que o editor de dieta e a dieta do aluno dividem. O
 * contraste da letra sobre o preenchimento (`sobreAcao` em `acao`, ≥ 4,5:1 em todas as cores de ação e paletas) é
 * conferido em `tema/tokens.test.ts`; aqui, que a peça usa esse par. Dados fictícios.
 */
let mockCores = ESCURO;
jest.mock('../tema/TemaProvider', () => ({ useTema: () => ({ cores: mockCores, fatorTexto: 1, preferencias: { animacoes: false } }) }));
jest.mock('@rn-primitives/slot', () => jest.requireActual('../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('./useMovimentoReduzido', () => ({ useMovimentoReduzido: () => true }));
jest.mock('../components/ui/tabs', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { Pressable, View } = require('react-native');
  /* eslint-enable @typescript-eslint/no-require-imports */
  type MockFilhos = { children?: unknown };
  return {
    Tabs: ({ children }: MockFilhos) => React.createElement(View, null, children),
    TabsList: ({ children, accessibilityLabel }: MockFilhos & { accessibilityLabel: string }) => React.createElement(View, { accessibilityRole: 'tablist', accessibilityLabel }, children),
    TabsTrigger: ({ children, accessibilityLabel, accessibilityState, onLayout, style }: MockFilhos & { accessibilityLabel: string; accessibilityState: object; onLayout?: unknown; style?: unknown }) =>
      React.createElement(Pressable, { accessibilityRole: 'tab', accessibilityLabel, accessibilityState, onLayout, style }, children),
    TabsContent: ({ children }: MockFilhos) => React.createElement(View, { testID: 'painel' }, children),
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');

function montar(elemento: React.ReactElement) {
  let arvore: import('react-test-renderer').ReactTestRenderer | undefined;
  Renderer.act(() => { arvore = Renderer.create(elemento); });
  return arvore!;
}
const estiloDo = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style);
const circulo = (a: ReturnType<typeof montar>) => a.root.findAll((n) => n.props.testID === 'marcador-de-opcao' && typeof n.type === 'string');

describe('MarcadorDeOpcao', () => {
  for (const [nome, paleta] of [['escuro', ESCURO], ['claro', CLARO]] as const) {
    it(`selecionado: preenchido na cor de ação e a letra em sobreAcao (${nome})`, () => {
      mockCores = paleta;
      const a = montar(<MarcadorDeOpcao letra="A" selecionado />);
      const [c] = circulo(a);
      expect(estiloDo(c)).toMatchObject({ backgroundColor: paleta.acao, borderColor: paleta.acao });
      expect(estiloDo(a.root.findByType(Text)).color).toBe(paleta.sobreAcao);
      expect(c.props['aria-hidden']).toBe(true);
    });

    it(`não selecionado: só o contorno do campo e a letra no texto (${nome})`, () => {
      mockCores = paleta;
      const a = montar(<MarcadorDeOpcao letra="B" selecionado={false} />);
      expect(estiloDo(circulo(a)[0])).toMatchObject({ backgroundColor: 'transparent', borderColor: paleta.bordaCampo });
      expect(estiloDo(a.root.findByType(Text)).color).toBe(paleta.texto);
    });
  }
});

describe('AbasDasOpcoes', () => {
  const abas = [
    { valor: '0', letra: 'A', titulo: 'Opção A', rotuloAcessivel: 'Opção A' },
    { valor: '1', letra: 'B', titulo: 'Opção B', rotuloAcessivel: 'Opção B' },
  ];

  it('cada aba tem o nome "Opção X", o círculo da letra e a aberta em negrito com o círculo preenchido', () => {
    mockCores = ESCURO;
    const a = montar(<AbasDasOpcoes rotulo="Opções de Almoço" abas={abas} aberta="1" aoAbrir={() => undefined} />);
    const nomes = a.root.findAll((n) => n.props.accessibilityRole === 'tab' && typeof n.type === 'string').map((n) => n.props.accessibilityLabel);
    expect(nomes).toEqual(['Opção A', 'Opção B']);
    const preenchidos = circulo(a).map((c) => estiloDo(c).backgroundColor === ESCURO.acao);
    expect(preenchidos).toEqual([false, true]);
    const titulo = (t: string) => a.root.findAll((n) => n.type === Text && n.props.children === t)[0];
    expect(estiloDo(titulo('Opção B')).fontFamily).toBe('Geist_700Bold');
    expect(estiloDo(titulo('Opção A')).fontFamily).toBe('Geist_500Medium');
  });

  it('sem filhos não há painel (a dieta do aluno mostra os itens fora das abas); com filhos, o painel da aberta', () => {
    const sem = montar(<AbasDasOpcoes rotulo="Opções" abas={abas} aberta="0" aoAbrir={() => undefined} />);
    expect(sem.root.findAll((n) => n.props.testID === 'painel')).toHaveLength(0);
    const com = montar(<AbasDasOpcoes rotulo="Opções" abas={abas} aberta="0" aoAbrir={() => undefined}><Text>Itens</Text></AbasDasOpcoes>);
    expect(com.root.findAll((n) => n.props.testID === 'painel' && typeof n.type === 'string')).toHaveLength(1);
  });

  it('o ⋯ da aba aberta: fora da lista de abas, na ponta da aba aberta (que reserva o alvo de 44) e só depois de medida', () => {
    mockCores = ESCURO;
    const a = montar(<AbasDasOpcoes rotulo="Opções" abas={abas} aberta="1" aoAbrir={() => undefined} acaoDaAberta={<Text>⋯</Text>} />);
    const menu = () => a.root.findAll((n) => n.type === Text && n.props.children === '⋯');
    expect(menu()).toHaveLength(0);
    const [, aberta] = a.root.findAll((n) => n.props.accessibilityRole === 'tab' && typeof n.props.onLayout === 'function' && typeof n.type === 'string');
    expect(estiloDo(aberta).paddingRight).toBe(44);
    Renderer.act(() => aberta.props.onLayout({ nativeEvent: { layout: { x: 120, y: 0, width: 150, height: 46 } } }));
    expect(menu()).toHaveLength(1);
    const lista = a.root.findAll((n) => n.props.accessibilityRole === 'tablist' && typeof n.type === 'string')[0];
    expect(lista.findAll((n) => n.type === Text && n.props.children === '⋯')).toHaveLength(0);
    // 4 da folga do anel + 120 + 150 - 44.
    const caixa = a.root.findAll((n) => typeof n.type === 'string' && estiloDo(n)?.position === 'absolute' && n.findAll((f) => f.props.children === '⋯').length > 0)[0];
    expect(estiloDo(caixa)).toMatchObject({ left: 230, height: 46 });
    const [fechada] = a.root.findAll((n) => n.props.accessibilityRole === 'tab' && typeof n.props.onLayout === 'function' && typeof n.type === 'string');
    expect(estiloDo(fechada).paddingRight).not.toBe(44);
  });
});
