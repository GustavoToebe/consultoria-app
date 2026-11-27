/* eslint-disable @typescript-eslint/no-require-imports */
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Tabela, type ColunaDaTabela } from './Tabela';

jest.mock('../tema/TemaProvider', () => ({ useTema: () => ({ cores: require('../tema/tokens').CLARO, bordas: { bloco: 1, item: 1 }, variante: 'claro' }) }));
jest.mock('./Texto', () => ({ Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children) }));

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });

interface Item {
  id: string;
  nome: string;
  valor: string;
}

const COLUNAS: ColunaDaTabela<Item>[] = [
  { chave: 'nome', titulo: 'Nome', principal: true, render: (i) => i.nome },
  { chave: 'valor', titulo: 'Valor', alinhar: 'direita', render: (i) => i.valor },
];

const LINHAS: Item[] = [{ id: '1', nome: 'Plano A', valor: 'R$ 100,00' }];

it('exibe todas as colunas e aplica larguraMaxima no modo tabela em faixa larga/ultralarga', () => {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<Tabela rotulo="Planos" colunas={COLUNAS} linhas={LINHAS} chave={(i) => i.id} larguraMaxima={1200} />);
  });
  const raiz = r.root.find((n) => n.props.role === 'table');
  act(() => {
    raiz.props.onLayout({ nativeEvent: { layout: { width: 2800 } } });
  });
  const cabecalhos = r.root.findAll((n) => String(n.type) === 'View' && n.props.role === 'columnheader');
  expect(cabecalhos).toHaveLength(2);
  expect(StyleSheet.flatten(raiz.props.style)).toMatchObject({ maxWidth: 1200 });
});

it('não limita larguraMaxima quando empilhada no celular', () => {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<Tabela rotulo="Planos" colunas={COLUNAS} linhas={LINHAS} chave={(i) => i.id} larguraMaxima={1200} />);
  });
  const raiz = r.root.find((n) => typeof n.props.onLayout === 'function');
  act(() => {
    raiz.props.onLayout({ nativeEvent: { layout: { width: 360 } } });
  });
  expect(StyleSheet.flatten(raiz.props.style)?.maxWidth).toBeUndefined();
});

// ficha: tabela com linha tingida (24/11)
describe('linha tingida', () => {
  const TRES: Item[] = [{ id: '1', nome: 'A', valor: '1' }, { id: '2', nome: 'B', valor: '2' }, { id: '3', nome: 'C', valor: '3' }];
  

  function larga(tingida: (i: Item) => boolean) {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<Tabela rotulo="T" colunas={COLUNAS} linhas={TRES} chave={(i) => i.id} tingida={tingida} />);
    });
    act(() => { r.root.find((n) => n.props.role === 'table').props.onLayout({ nativeEvent: { layout: { width: 900 } } }); });
    // `Toque` sem `aoTocarLinha` é a própria linha (role="row", fora o cabeçalho).
    const linhas = r.root.findAll((n) => String(n.type) === 'View' && n.props.role === 'row').slice(1);
    return { r, estilos: linhas.map((l) => StyleSheet.flatten(l.props.style)) };
  }

  it('pinta só o fundo da linha tingida e nunca dá borda própria (lateral, de cima ou a de baixo da última)', () => {
    const { estilos } = larga((i) => i.id === '3');
    expect(estilos[2].backgroundColor).toBeDefined();
    expect(estilos[0].backgroundColor).toBeUndefined();
    for (const e of estilos) {
      expect(e.borderLeftWidth ?? e.borderWidth ?? 0).toBe(0);
      expect(e.borderRightWidth ?? e.borderWidth ?? 0).toBe(0);
      expect(e.borderTopWidth ?? 0).toBe(0);
    }
    expect(estilos[2].borderBottomWidth).toBeUndefined();
  });

  it('o fio entre uma linha e a seguinte é sempre a divisória, tingida ou não (borda neutra, 26/11)', () => {
    const { estilos } = larga((i) => i.id === '2');
    expect(estilos[0].borderBottomWidth).toBe(1);
    expect(estilos[1].borderBottomWidth).toBe(1);
    expect(estilos[0].borderColor).toBe(estilos[1].borderColor);
    const { estilos: neutras } = larga(() => false);
    expect(neutras[0].borderColor).toBe(estilos[0].borderColor);
    expect(neutras[0].borderColor).toBe(neutras[1].borderColor);
  });
});
