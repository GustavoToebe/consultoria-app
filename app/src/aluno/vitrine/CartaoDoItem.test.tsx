/* eslint-disable @typescript-eslint/no-require-imports */
import type { ItemDaVitrineDoAluno } from '../../api/vitrineTipos';
import { CartaoDoItem } from './CartaoDoItem';

/** Regra das lojas (D6) na tela: no celular, item DIGITAL não mostra preço, cupom nem link; FISICO e a web mostram tudo. */
jest.mock('../../api/rotas', () => ({ baixarFotoDoItemDoAluno: jest.fn() }));
jest.mock('../../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../../tema/tokens').ESCURO, fatorTexto: 1 }),
}));
jest.mock('../../ui/Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));
jest.mock('./MiniaturaDoItem', () => ({ MiniaturaDoItem: () => null }));
jest.mock('../../ui/AcoesDoProduto', () => {
  const { createElement } = require('react') as typeof import('react');
  const { Text } = require('react-native') as typeof import('react-native');
  return {
    CupomDoProduto: ({ cupom }: { cupom: string }) => createElement(Text, null, `Cupom: ${cupom}`),
    VerProduto: () => createElement(Text, null, 'Ver produto'),
  };
});

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const React = require('react') as typeof import('react');
const { Platform } = require('react-native') as typeof import('react-native');

const ITEM: ItemDaVitrineDoAluno = {
  id: 'item-1', nome: 'Planilha de força', descricao: 'Doze semanas de treino.', tipo: 'DIGITAL',
  precoCentavos: 9900, precoVigenteCentavos: 9900, especialAte: null, cupom: 'FORCA10', linkUrl: 'https://loja.exemplo.com/planilha',
  temFoto: false, fotoAtualizadaEm: null,
};

function textos(item: ItemDaVitrineDoAluno, os: 'android' | 'ios' | 'web'): string {
  jest.replaceProperty(Platform, 'OS', os);
  let raiz!: import('react-test-renderer').ReactTestRenderer;
  Renderer.act(() => { raiz = Renderer.create(<CartaoDoItem item={item} />); });
  const { Text } = require('react-native') as typeof import('react-native');
  const tudo = raiz.root.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join(' | ');
  Renderer.act(() => raiz.unmount());
  return tudo;
}

afterEach(() => jest.restoreAllMocks());

describe('CartaoDoItem: o que cada plataforma mostra', () => {
  it.each(['android', 'ios'] as const)('item DIGITAL no %s: só nome e descrição, sem preço, cupom nem link', (os) => {
    const t = textos(ITEM, os);
    expect(t).toContain('Planilha de força');
    expect(t).toContain('Doze semanas de treino.');
    expect(t).not.toMatch(/R\$/);
    expect(t).not.toContain('Cupom');
    expect(t).not.toContain('Ver produto');
  });

  it('item FISICO no celular mostra tudo', () => {
    const t = textos({ ...ITEM, tipo: 'FISICO' }, 'android');
    expect(t).toMatch(/R\$\s?99,00/);
    expect(t).toContain('Cupom: FORCA10');
    expect(t).toContain('Ver produto');
  });

  it('item DIGITAL na web mostra tudo', () => {
    const t = textos(ITEM, 'web');
    expect(t).toMatch(/R\$\s?99,00/);
    expect(t).toContain('Cupom: FORCA10');
    expect(t).toContain('Ver produto');
  });

  it('sem preço é "—", nunca zero; sem cupom e sem link, nada', () => {
    const t = textos({ ...ITEM, tipo: 'FISICO', precoCentavos: null, precoVigenteCentavos: null, cupom: null, linkUrl: null }, 'web');
    expect(t).toContain('—');
    expect(t).not.toMatch(/R\$/);
    expect(t).not.toContain('Cupom');
    expect(t).not.toContain('Ver produto');
  });

  it('preço especial valendo: o vigente do servidor, o normal para riscar e a validade', () => {
    const t = textos({ ...ITEM, tipo: 'FISICO', precoVigenteCentavos: 7900, especialAte: '2099-11-30' }, 'android');
    expect(t).toMatch(/R\$\s?79,00/);
    expect(t).toMatch(/R\$\s?99,00/);
    expect(t).toContain('Preço especial até 30/11/2099');
  });
});
