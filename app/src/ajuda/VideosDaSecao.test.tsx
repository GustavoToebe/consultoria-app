/* eslint-disable @typescript-eslint/no-require-imports */
import type { ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { abrirLinkExterno } from '../ui/abrirLinkExterno';
import { VideosDaSecao } from './VideosDaSecao';

/** O bloco de vídeos com a fonte injetada: aparece só com link https, abre fora do app e avisa se não abriu. */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../ui/abrirLinkExterno', () => ({ abrirLinkExterno: jest.fn() }));
jest.mock('../ui/LinhaDeAcoes', () => ({ LinhaDeAcoes: ({ children }: { children?: ReactNode }) => children }));
jest.mock('../ui/Texto', () => ({
  Texto: ({ children }: { children?: ReactNode }) => require('react').createElement(require('react-native').Text, null, children),
}));
jest.mock('../ui/Estados', () => ({
  Alerta: ({ texto }: { texto?: string }) => require('react').createElement(require('react-native').Text, null, texto),
}));
jest.mock('../ui/Botao', () => ({
  Botao: ({ rotulo, rotuloAcessivel, aoTocar }: { rotulo: string; rotuloAcessivel?: string; aoTocar: () => void }) =>
    require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotuloAcessivel ?? rotulo, testID: rotulo, onPress: aoTocar }),
}));

const abrir = abrirLinkExterno as jest.Mock;
const botoes = (r: ReactTestRenderer) => r.root.findAll((n) => typeof n.props.testID === 'string' && typeof n.props.onPress === 'function');
const textos = (r: ReactTestRenderer) => r.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);

beforeEach(() => abrir.mockReset());

it('sem vídeo, ou só com link que não é https, não mostra nada', () => {
  for (const videos of [undefined, [], [{ titulo: 'Inseguro', url: 'http://videos.exemplo.test/a' }]]) {
    let r!: ReactTestRenderer;
    act(() => { r = create(<VideosDaSecao videos={videos} />); });
    expect(r.toJSON()).toBeNull();
  }
});

it('com vídeo https, mostra o botão e abre fora do app', async () => {
  abrir.mockResolvedValue(true);
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<VideosDaSecao videos={[
      { titulo: 'Cobranças em lote', url: 'https://videos.exemplo.test/lote', duracao: '3 min' },
      { titulo: 'Inseguro', url: 'http://videos.exemplo.test/b' },
    ]} />);
  });
  expect(textos(r)).toContain('Vídeo (abre fora do app)');
  const [botao, ...outros] = botoes(r);
  expect(outros).toHaveLength(0);
  expect(botao.props.testID).toBe('Cobranças em lote · 3 min');
  expect(botao.props.accessibilityLabel).toBe('Assistir: Cobranças em lote, 3 min. Abre fora do app.');
  await act(async () => { botao.props.onPress(); });
  expect(abrir).toHaveBeenCalledWith('https://videos.exemplo.test/lote');
  expect(textos(r)).not.toContain('Não foi possível abrir o vídeo. Tente de novo.');
});

it('avisa quando o link não abriu', async () => {
  abrir.mockResolvedValue(false);
  let r!: ReactTestRenderer;
  act(() => { r = create(<VideosDaSecao videos={[{ titulo: 'Aulão', url: 'https://videos.exemplo.test/x' }]} />); });
  await act(async () => { botoes(r)[0].props.onPress(); });
  expect(textos(r)).toContain('Não foi possível abrir o vídeo. Tente de novo.');
});
