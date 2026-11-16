/* eslint-disable @typescript-eslint/no-require-imports */
import type { ItemDaVitrineDoAluno } from '../../api/vitrineTipos';
import { CartaoVitrineDoInicio } from './CartaoVitrineDoInicio';

/** Regra das lojas (D6) no Início do aluno: no celular, item DIGITAL não mostra preço; FISICO e a web mostram. */
let mockItens: ItemDaVitrineDoAluno[] = [];
jest.mock('./useVitrineDoAluno', () => ({ useVitrineDoAluno: () => ({ dados: mockItens }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../api/rotas', () => ({ baixarFotoDoItemDoAluno: jest.fn() }));
jest.mock('../../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../../tema/tokens').ESCURO, fatorTexto: 1 }),
}));
jest.mock('../../ui/Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));
jest.mock('./MiniaturaDoItem', () => ({ MiniaturaDoItem: () => null }));
jest.mock('../../ui/Botao', () => ({ Botao: () => null }));
jest.mock('../../ui/Cartao', () => ({
  Cartao: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').View, null, children),
}));
jest.mock('../../ui/AcoesDoProduto', () => {
  const { createElement } = require('react') as typeof import('react');
  const { Text } = require('react-native') as typeof import('react-native');
  return {
    CupomDoProduto: ({ cupom }: { cupom: string }) => createElement(Text, null, `Cupom: ${cupom}`),
    VerProduto: () => createElement(Text, null, 'Ver produto'),
  };
});

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const { Platform } = require('react-native') as typeof import('react-native');

const ITEM: ItemDaVitrineDoAluno = {
  id: 'item-1', nome: 'Plano de teste', descricao: 'Descrição de teste.', tipo: 'DIGITAL',
  precoCentavos: 9990, precoVigenteCentavos: 9990, especialAte: null, cupom: null, linkUrl: null,
  temFoto: false, fotoAtualizadaEm: null,
};

function textos(item: ItemDaVitrineDoAluno, os: 'android' | 'ios' | 'web'): string {
  jest.replaceProperty(Platform, 'OS', os);
  mockItens = [item];
  let raiz!: import('react-test-renderer').ReactTestRenderer;
  Renderer.act(() => { raiz = Renderer.create(<CartaoVitrineDoInicio />); });
  const { Text } = require('react-native') as typeof import('react-native');
  const tudo = raiz.root.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join(' | ');
  Renderer.act(() => raiz.unmount());
  return tudo;
}

afterEach(() => {
  mockItens = [];
  jest.restoreAllMocks();
});

describe('CartaoVitrineDoInicio: o que cada plataforma mostra', () => {
  it.each(['android', 'ios'] as const)('item DIGITAL no %s: só nome e descrição, sem preço', (os) => {
    const t = textos(ITEM, os);
    expect(t).toContain('Plano de teste');
    expect(t).toContain('Descrição de teste.');
    expect(t).not.toMatch(/R\$/);
  });

  it('item DIGITAL na web mostra o preço', () => {
    const t = textos(ITEM, 'web');
    expect(t).toMatch(/R\$\s?99,90/);
  });

  it.each(['android', 'ios', 'web'] as const)('item FISICO no %s mostra o preço', (os) => {
    const t = textos({ ...ITEM, tipo: 'FISICO' }, os);
    expect(t).toMatch(/R\$\s?99,90/);
  });
});
