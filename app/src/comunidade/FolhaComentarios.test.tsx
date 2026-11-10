/* eslint-disable @typescript-eslint/no-require-imports */
import type { ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { comentarComoAluno, listarComentariosDoAluno } from '../api/comunidade';
import type { AlvoDosComentarios, ComentarioDoMural } from '../api/comunidadeTipos';
import { FolhaComentarios } from './FolhaComentarios';

/** A folha com a regra de verdade e as peças de UI trocadas por nós simples: páginas, envio, contador e o erro do "Carregar mais". */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../api/cliente', () => ({ ErroApi: require('@plataforma/web').ErroApi }));
jest.mock('../api/comunidade', () => ({
  listarComentariosDoAluno: jest.fn(),
  listarComentariosDaEquipe: jest.fn(),
  comentarComoAluno: jest.fn(),
  removerComentario: jest.fn(),
}));
jest.mock('../tema/TemaProvider', () => ({ useTema: () => ({ cores: require('../tema/tokens').CLARO }) }));
jest.mock('../ui/Folha', () => ({
  Folha: ({ visivel, children, rodape }: { visivel: boolean; children?: ReactNode; rodape?: ReactNode }) =>
    (visivel ? require('react').createElement(require('react-native').View, null, children, rodape) : null),
}));
jest.mock('../ui/Botao', () => ({
  Botao: ({ rotulo, aoTocar, desabilitado }: { rotulo: string; aoTocar: () => void; desabilitado?: boolean }) =>
    require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotulo, disabled: !!desabilitado, onPress: aoTocar }),
}));
jest.mock('../ui/Campo', () => ({
  Campo: ({ rotulo, valor, aoMudar }: { rotulo: string; valor: string; aoMudar: (t: string) => void }) =>
    require('react').createElement(require('react-native').TextInput, { accessibilityLabel: rotulo, value: valor, onChangeText: aoMudar }),
}));
jest.mock('../ui/Texto', () => ({
  Texto: ({ children }: { children?: ReactNode }) => require('react').createElement(require('react-native').Text, null, children),
}));
jest.mock('../ui/Estados', () => ({
  Alerta: () => null,
  Vazio: () => null,
  MensagemErro: ({ tentarDeNovo }: { tentarDeNovo?: () => void }) =>
    require('react').createElement(require('react-native').Pressable, { accessibilityLabel: 'Tentar de novo', onPress: tentarDeNovo }),
}));
jest.mock('../ui/Esqueleto', () => ({ Esqueleto: () => null }));
jest.mock('../ui/LinhaDeAcoes', () => ({ LinhaDeAcoes: ({ children }: { children?: ReactNode }) => children }));
jest.mock('../ui/PainelConfirmacao', () => ({ PainelConfirmacao: () => null }));
jest.mock('./AutorDoPost', () => ({ AutorDoPost: () => null }));
jest.mock('./FolhaPerfilDoColega', () => ({ FolhaPerfilDoColega: () => null }));

const comentario = (n: number): ComentarioDoMural => ({
  id: `c${n}`, autorId: 'u1', autorNome: 'Aluno Fictício', autorApelido: null, autorEhAluno: true, autorFotoUrl: null,
  texto: `Comentário de teste ${n}`, criadoEm: '2026-10-19T16:00:00Z',
});
const de = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => comentario(a + i));
const listar = listarComentariosDoAluno as jest.Mock;
const comentar = comentarComoAluno as jest.Mock;
const AULA: AlvoDosComentarios = { tipo: 'aula', id: 'a1' };

const folha = (alvo: AlvoDosComentarios | null) => (
  <FolhaComentarios alvo={alvo} modo={{ tipo: 'aluno', online: true }} aoFechar={() => undefined} aoAlterar={() => undefined} />
);
const textos = (r: ReactTestRenderer) =>
  r.root.findAll((n) => String(n.type) === 'Text').map((n) => [n.props.children].flat().join('')).filter(Boolean);
const botao = (r: ReactTestRenderer, rotulo: string) => r.root.findAll((n) => n.props.accessibilityLabel === rotulo && typeof n.props.onPress === 'function')[0];

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => { listar.mockReset(); comentar.mockReset(); });

it('carregar mais acrescenta a página seguinte sem repetir; o erro dele mantém a lista e some ao reabrir', async () => {
  listar.mockResolvedValueOnce({ itens: de(1, 30), total: 35 });
  let r!: ReactTestRenderer;
  await act(async () => { r = create(folha(AULA)); });
  expect(listar).toHaveBeenLastCalledWith(AULA, 0);
  expect(textos(r)).toContain('Mostrando 30 de 35 comentários.');

  listar.mockRejectedValueOnce(new Error('rede'));
  await act(async () => { botao(r, 'Carregar mais comentários').props.onPress(); });
  expect(botao(r, 'Tentar de novo')).toBeDefined();
  expect(textos(r)).toContain('Comentário de teste 30');

  // Reabrir o mesmo aulão: página 0 de novo e o botão no lugar do erro.
  listar.mockResolvedValueOnce({ itens: de(1, 30), total: 35 });
  await act(async () => { r.update(folha(null)); });
  await act(async () => { r.update(folha(AULA)); });
  expect(listar).toHaveBeenCalledTimes(3);
  expect(listar).toHaveBeenLastCalledWith(AULA, 0);
  expect(botao(r, 'Tentar de novo')).toBeUndefined();

  // A página 1 repete o 30 (alguém removeu um antes): entra uma vez só.
  listar.mockResolvedValueOnce({ itens: de(30, 35), total: 35 });
  await act(async () => { botao(r, 'Carregar mais comentários').props.onPress(); });
  expect(listar).toHaveBeenLastCalledWith(AULA, 1);
  expect(textos(r).filter((t) => t === 'Comentário de teste 30')).toHaveLength(1);
  expect(textos(r)).toContain('Comentário de teste 35');
  expect(botao(r, 'Carregar mais comentários')).toBeUndefined();
});

it('o contador avisa perto do limite e o comentário enviado entra sem buscar a lista de novo', async () => {
  listar.mockResolvedValueOnce({ itens: de(1, 2), total: 2 });
  let r!: ReactTestRenderer;
  await act(async () => { r = create(folha(AULA)); });
  const campo = () => r.root.findByProps({ accessibilityLabel: 'Seu comentário' });

  await act(async () => { campo().props.onChangeText('a'.repeat(270)); });
  expect(textos(r)).toContain('270/280 · faltam 10');
  await act(async () => { campo().props.onChangeText('a'.repeat(281)); });
  expect(textos(r)).toContain('281/280 · 1 a mais');
  expect(botao(r, 'Comentar').props.disabled).toBe(true);

  comentar.mockResolvedValueOnce({ ...comentario(3), texto: 'Bora!' });
  await act(async () => { campo().props.onChangeText('Bora!'); });
  await act(async () => { botao(r, 'Comentar').props.onPress(); });
  expect(comentar).toHaveBeenCalledWith(AULA, 'Bora!');
  expect(textos(r)).toContain('Bora!');
  expect(campo().props.value).toBe('');
  expect(listar).toHaveBeenCalledTimes(1);
});
