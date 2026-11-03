/* eslint-disable @typescript-eslint/no-require-imports */
import type { ReactNode } from 'react';
import { GuardaDeSaida, useGuardaDeSaida } from './GuardaDeSaida';
import { LinkTexto } from './LinkTexto';

/** No celular o `Link` não navega quando o toque chega com `preventDefault` e há alteração pendente. */
jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  const { Pressable } = require('react-native') as typeof import('react-native');
  return {
    router: { navigate: jest.fn(), push: jest.fn() },
    useNavigation: () => ({ addListener: () => () => undefined }),
    usePathname: () => '/treinador/alunos/aluno-1',
    Link: ({ children, onPress }: { children?: ReactNode; onPress?: (evento: { preventDefault?: () => void; ctrlKey?: boolean }) => void }) =>
      React.createElement(Pressable, { accessibilityRole: 'link', onPress }, children),
  };
});
jest.mock('../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../tema/tokens').ESCURO, fatorTexto: 1 }),
}));
jest.mock('./Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));
jest.mock('./Folha', () => ({ usePortalDaFolha: () => undefined, Folha: () => null }));
jest.mock('./PainelConfirmacao', () => ({
  PainelConfirmacao: (p: { visivel: boolean; titulo: string }) =>
    p.visivel ? require('react').createElement(require('react-native').Text, { accessibilityLabel: p.titulo }, p.titulo) : null,
}));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const React = require('react') as typeof import('react');

function Tela({ pendente }: { pendente: boolean }) {
  useGuardaDeSaida(pendente);
  return <LinkTexto href="/treinador/alunos" texto="Alunos" />;
}

function pressionar(pendente: boolean, clique: { preventDefault: jest.Mock; ctrlKey?: boolean }) {
  let raiz!: import('react-test-renderer').ReactTestRenderer;
  Renderer.act(() => {
    raiz = Renderer.create(
      <GuardaDeSaida>
        <Tela pendente={pendente} />
      </GuardaDeSaida>,
    );
  });
  const link = raiz.root.findByProps({ accessibilityRole: 'link' });
  Renderer.act(() => { link.props.onPress(clique); });
  return raiz;
}

beforeAll(() => {
  jest.replaceProperty((require('react-native') as typeof import('react-native')).Platform, 'OS', 'android');
});

describe('LinkTexto no celular', () => {
  it('com alteração pendente, o toque chama preventDefault e pergunta', () => {
    const preventDefault = jest.fn();
    const raiz = pressionar(true, { preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(raiz.root.findAll((n) => n.props.accessibilityLabel === 'Sair sem salvar?').length).toBeGreaterThan(0);
  });

  it('sem alteração pendente, o toque não chama preventDefault nem pergunta', () => {
    const preventDefault = jest.fn();
    const raiz = pressionar(false, { preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
    expect(raiz.root.findAll((n) => n.props.accessibilityLabel === 'Sair sem salvar?')).toHaveLength(0);
  });

  it('Ctrl+clique não chama preventDefault, mesmo com alteração pendente', () => {
    const preventDefault = jest.fn();
    const raiz = pressionar(true, { preventDefault, ctrlKey: true });
    expect(preventDefault).not.toHaveBeenCalled();
    expect(raiz.root.findAll((n) => n.props.accessibilityLabel === 'Sair sem salvar?')).toHaveLength(0);
  });

  it('toque na mesma tela chama preventDefault e não pergunta', () => {
    let raiz!: import('react-test-renderer').ReactTestRenderer;
    Renderer.act(() => {
      raiz = Renderer.create(
        <GuardaDeSaida>
          <Mesma />
        </GuardaDeSaida>,
      );
    });
    const preventDefault = jest.fn();
    Renderer.act(() => { raiz.root.findByProps({ accessibilityRole: 'link' }).props.onPress({ preventDefault }); });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(raiz.root.findAll((n) => n.props.accessibilityLabel === 'Sair sem salvar?')).toHaveLength(0);
  });
});

function Mesma() {
  useGuardaDeSaida(true);
  return <LinkTexto href="/treinador/alunos/aluno-1" texto="Esta ficha" />;
}
