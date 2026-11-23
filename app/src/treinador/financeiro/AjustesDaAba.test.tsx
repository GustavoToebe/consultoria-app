/* eslint-disable @typescript-eslint/no-require-imports */
import { StyleSheet } from 'react-native';

import { LARGURA_DUAS_COLUNAS } from '../../tema/tokens';
import { ColunasDeAjustes } from './AjustesDaAba';

jest.mock('expo-router', () => ({ Link: () => null, router: { push: jest.fn() } }));
jest.mock('../../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../../tema/tokens').ESCURO, bordas: { item: 1 }, fatorTexto: 1 }),
}));
jest.mock('../../components/ui/switch', () => ({ Switch: () => null }));
jest.mock('../../ui/Botao', () => ({ Botao: () => null }));
jest.mock('../../ui/GuardaDeSaida', () => ({ useSaidaGuardada: () => ({ pedirSaida: jest.fn() }) }));
jest.mock('../../ui/Texto', () => ({ Texto: () => null }));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');

function montar() {
  let raiz!: import('react-test-renderer').ReactTestRenderer;
  Renderer.act(() => {
    raiz = Renderer.create(<ColunasDeAjustes ajustes={null} apoio={null} />);
  });
  return raiz;
}

/** O contêiner das duas colunas: o único com `onLayout`. */
const contenedor = (raiz: import('react-test-renderer').ReactTestRenderer) =>
  raiz.root.find((n) => typeof n.props.onLayout === 'function' && typeof n.type === 'string');

const estilo = (raiz: import('react-test-renderer').ReactTestRenderer) => StyleSheet.flatten(contenedor(raiz).props.style) ?? {};

const medir = (raiz: import('react-test-renderer').ReactTestRenderer, width: number) =>
  Renderer.act(() => {
    contenedor(raiz).props.onLayout({ nativeEvent: { layout: { width, height: 400 } } });
  });

describe('ColunasDeAjustes', () => {
  it('fica invisível até a primeira medida, para não pintar uma coluna só e saltar para duas', () => {
    const raiz = montar();
    expect(estilo(raiz).opacity).toBe(0);
  });

  it('com a área larga mostra as duas colunas lado a lado, já visíveis', () => {
    const raiz = montar();
    medir(raiz, LARGURA_DUAS_COLUNAS);
    expect(estilo(raiz).opacity).toBeUndefined();
    expect(estilo(raiz).flexDirection).toBe('row');
  });

  it('com a área estreita fica numa coluna só, também visível', () => {
    const raiz = montar();
    medir(raiz, LARGURA_DUAS_COLUNAS - 1);
    expect(estilo(raiz).opacity).toBeUndefined();
    expect(estilo(raiz).flexDirection).toBeUndefined();
  });
});
