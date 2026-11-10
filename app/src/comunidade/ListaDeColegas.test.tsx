/* eslint-disable @typescript-eslint/no-require-imports */
import { ErroApi } from '@plataforma/web';
import type { ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { listarColegasDaComunidade } from '../api/comunidade';
import type { ColegaDaLista } from '../api/comunidadeTipos';
import { ListaDeColegas } from './ListaDeColegas';

/** A lista com a paginação de verdade e as peças de UI trocadas por nós simples. */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../api/comunidade', () => ({ listarColegasDaComunidade: jest.fn(), baixarFotoDoColega: jest.fn() }));
jest.mock('../tema/TemaProvider', () => ({ useTema: () => ({ cores: require('../tema/tokens').CLARO }) }));
jest.mock('../ui/Cartao', () => ({ Cartao: ({ children }: { children?: ReactNode }) => require('react').createElement(require('react-native').View, null, children) }));
jest.mock('../ui/Botao', () => ({
  Botao: ({ rotulo, rotuloAcessivel, aoTocar }: { rotulo: string; rotuloAcessivel?: string; aoTocar: () => void }) =>
    require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotuloAcessivel ?? rotulo, onPress: aoTocar }),
}));
jest.mock('../ui/LinhaDaLista', () => {
  const { createElement } = require('react');
  const { Text, View } = require('react-native');
  return {
    ListaDeLinhas: ({ children }: { children?: ReactNode }) => createElement(View, null, children),
    LinhaDaLista: ({ titulo, descricao, metadados, acoes }: { titulo: string; descricao?: string; metadados?: string; acoes?: ReactNode }) =>
      createElement(View, null, createElement(Text, null, titulo), descricao ? createElement(Text, null, descricao) : null, createElement(Text, null, metadados), acoes),
  };
});
jest.mock('../ui/Estados', () => {
  const { createElement } = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    Alerta: ({ texto, children }: { texto: string; children?: ReactNode }) => createElement(View, null, createElement(Text, null, texto), children),
    Vazio: ({ texto }: { texto: string }) => createElement(Text, null, texto),
    MensagemErro: ({ tentarDeNovo }: { tentarDeNovo?: () => void }) => createElement(Pressable, { accessibilityLabel: 'Tentar de novo', onPress: tentarDeNovo }),
  };
});
jest.mock('../ui/Esqueleto', () => ({ Esqueleto: () => null }));
jest.mock('../ui/LinhaDeAcoes', () => ({ LinhaDeAcoes: ({ children }: { children?: ReactNode }) => children }));
jest.mock('./FotoDoColega', () => ({ FotoDoColega: () => null }));

const listar = listarColegasDaComunidade as jest.Mock;
const colega = (i: number): ColegaDaLista => ({ autorId: `u${i}`, nome: `Colega ${i}`, apelido: i === 1 ? 'Um' : null, nivel: 2, temFoto: false });
const de = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => colega(a + i));
const textos = (r: ReactTestRenderer) =>
  r.root.findAll((n) => String(n.type) === 'Text').map((n) => [n.props.children].flat().join('')).filter(Boolean);
const botao = (r: ReactTestRenderer, rotulo: string) => r.root.findAll((n) => n.props.accessibilityLabel === rotulo && typeof n.props.onPress === 'function')[0];

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => listar.mockReset());

it('"Ver mais" traz a página seguinte, sem repetir e sem nunca escrever o total; a linha abre o perfil', async () => {
  listar.mockResolvedValueOnce({ itens: de(1, 30), total: 32 });
  const abrir = jest.fn();
  let r!: ReactTestRenderer;
  await act(async () => { r = create(<ListaDeColegas aoAbrir={abrir} />); });
  expect(listar).toHaveBeenLastCalledWith(0);
  expect(textos(r)).toEqual(expect.arrayContaining(['Colega 1', '«Um» · Nível 2', 'Colega 2']));
  expect(textos(r)).toContain('Nível 2');
  expect(textos(r).some((t) => /32/.test(t))).toBe(false);

  listar.mockResolvedValueOnce({ itens: de(30, 32), total: 32 });
  await act(async () => { botao(r, 'Ver mais colegas').props.onPress(); });
  expect(listar).toHaveBeenLastCalledWith(1);
  expect(textos(r).filter((t) => t === 'Colega 30')).toHaveLength(1);
  expect(textos(r)).toContain('Colega 32');
  expect(botao(r, 'Ver mais colegas')).toBeUndefined();

  await act(async () => { botao(r, 'Ver perfil de Colega 31').props.onPress(); });
  expect(abrir).toHaveBeenCalledWith('u31');
});

it('vazio tem o texto próprio; erro do "Ver mais" mantém a lista e tenta de novo', async () => {
  listar.mockResolvedValueOnce({ itens: [], total: 0 });
  let r!: ReactTestRenderer;
  await act(async () => { r = create(<ListaDeColegas aoAbrir={() => undefined} />); });
  expect(textos(r)).toEqual(['Ainda não há colegas com perfil visível.']);

  listar.mockResolvedValueOnce({ itens: de(1, 30), total: 31 });
  await act(async () => { r.unmount(); r = create(<ListaDeColegas key="2" aoAbrir={() => undefined} />); });
  listar.mockRejectedValueOnce(new ErroApi(429, 'Muitas.', 'LIMITE'));
  await act(async () => { botao(r, 'Ver mais colegas').props.onPress(); });
  expect(textos(r)).toContain('Muitos perfis abertos em pouco tempo. Espere alguns minutos e tente de novo.');
  expect(textos(r)).toContain('Colega 30');
  listar.mockResolvedValueOnce({ itens: [colega(31)], total: 31 });
  await act(async () => { botao(r, 'Tentar de novo').props.onPress(); });
  expect(textos(r)).toContain('Colega 31');
});

it('erro da primeira leitura oferece "Tentar de novo"', async () => {
  listar.mockRejectedValueOnce(new ErroApi(503, 'Fora.', 'FORA'));
  let r!: ReactTestRenderer;
  await act(async () => { r = create(<ListaDeColegas aoAbrir={() => undefined} />); });
  listar.mockResolvedValueOnce({ itens: de(1, 2), total: 2 });
  await act(async () => { botao(r, 'Tentar de novo').props.onPress(); });
  expect(textos(r)).toContain('Colega 2');
});
