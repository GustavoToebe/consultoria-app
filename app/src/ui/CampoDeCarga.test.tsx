/* eslint-disable @typescript-eslint/no-require-imports */
import { CampoDeCarga } from './CampoDeCarga';
import { ContextoDaUnidadeDeCarga } from './unidadeDeCargaEmUso';
import type { UnidadeDeCarga } from '../dominio/unidadeDeCarga';

jest.mock('../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../tema/tokens').ESCURO, fatorTexto: 1 }),
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@rn-primitives/switch', () => jest.requireActual('../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/label', () => jest.requireActual('../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/slot', () => jest.requireActual('../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('./Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const React = require('react') as typeof import('react');

function montar(unidade: UnidadeDeCarga, valorKg: number | null, aoMudarKg: (kg: number | null) => void, rotulo = 'Peso da série 2') {
  const elemento = (v: number | null) => (
    <ContextoDaUnidadeDeCarga.Provider value={unidade}>
      <CampoDeCarga rotulo={rotulo} rotuloOculto valorKg={v} aoMudarKg={aoMudarKg} />
    </ContextoDaUnidadeDeCarga.Provider>
  );
  let raiz!: import('react-test-renderer').ReactTestRenderer;
  Renderer.act(() => {
    raiz = Renderer.create(elemento(valorKg));
  });
  const campo = () => raiz.root.find((x) => typeof x.props.onChangeText === 'function' && x.props.accessibilityLabel !== undefined);
  return {
    campo,
    texto: () => campo().props.value as string,
    rotulo: () => campo().props.accessibilityLabel as string,
    digitar: (texto: string) => Renderer.act(() => campo().props.onChangeText(texto)),
    recebe: (v: number | null) => Renderer.act(() => raiz.update(elemento(v))),
  };
}

describe('CampoDeCarga', () => {
  it('mostrar a carga na unidade e mudar o valor por fora nunca chama aoMudarKg (nada é regravado sem digitar)', () => {
    const aoMudarKg = jest.fn();
    const c = montar('lb', 60, aoMudarKg);
    expect(c.texto()).toBe('132,3');
    c.recebe(62.5);
    expect(c.texto()).toBe('137,8');
    c.recebe(null);
    expect(c.texto()).toBe('');
    c.recebe(45.35);
    expect(c.texto()).toBe('100');
    expect(aoMudarKg).not.toHaveBeenCalled();
  });

  it('digitar em libra grava kg: o que se vê (132,3 lb) volta ao mesmo kg (60), e 100 lb grava 45,35', () => {
    const aoMudarKg = jest.fn();
    const c = montar('lb', 60, aoMudarKg);
    c.digitar('132,3');
    expect(aoMudarKg).toHaveBeenLastCalledWith(60);
    c.digitar('100');
    expect(aoMudarKg).toHaveBeenLastCalledWith(45.35);
    c.digitar('');
    expect(aoMudarKg).toHaveBeenLastCalledWith(null);
    expect(aoMudarKg).toHaveBeenCalledTimes(3);
  });

  it('em kg o número é o mesmo, sem conversão', () => {
    const aoMudarKg = jest.fn();
    const c = montar('kg', 62.5, aoMudarKg);
    expect(c.texto()).toBe('62,5');
    c.digitar('62,25');
    expect(aoMudarKg).toHaveBeenLastCalledWith(62.25);
  });

  it('o rótulo acessível diz a unidade por extenso, também sem rotuloAcessivel próprio', () => {
    expect(montar('lb', null, jest.fn()).rotulo()).toBe('Peso da série 2, em libras');
    expect(montar('kg', null, jest.fn(), 'Carga de trabalho do dia').rotulo()).toBe('Carga de trabalho do dia, em quilos');
  });
});
