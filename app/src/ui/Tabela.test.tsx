/* eslint-disable @typescript-eslint/no-require-imports */
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Tabela, type ColunaDaTabela } from './Tabela';

jest.mock('../tema/TemaProvider', () => ({ useTema: () => ({ cores: require('../tema/tokens').CLARO, bordas: { bloco: 1, item: 1 } }) }));
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
