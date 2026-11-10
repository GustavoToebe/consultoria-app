/* eslint-disable @typescript-eslint/no-require-imports */
import type { ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { meuPerfilDaComunidade, salvarMeuPerfilDaComunidade } from '../api/comunidade';
import type { PreferenciasDoPerfil } from '../api/comunidadeTipos';
import { TEXTO_LIMITE_DO_PERFIL } from '../dominio/perfilDaComunidade';
import { CartaoMeuPerfil } from './CartaoMeuPerfil';

/** O cartão com as regras de verdade e as peças de UI trocadas por nós simples: corpo do PUT, limite de 4, aviso e erros. */
const mockAvisar = jest.fn();
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({ router: { setParams: jest.fn(), push: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock('../api/cliente', () => ({ ErroApi: require('@plataforma/web').ErroApi }));
jest.mock('../api/comunidade', () => ({ meuPerfilDaComunidade: jest.fn(), salvarMeuPerfilDaComunidade: jest.fn() }));
jest.mock('../api/rotas', () => ({ baixarFotoDePerfil: jest.fn() }));
jest.mock('../offline/AlunoProvider', () => ({ useAluno: () => ({ online: true }) }));
jest.mock('../sessao/SessaoProvider', () => ({ useSessao: () => ({ usuario: { nome: 'Aluno Fictício' } }) }));
jest.mock('../tema/TemaProvider', () => ({ useTema: () => ({ cores: require('../tema/tokens').CLARO, modo: 'CLARO' }) }));
jest.mock('./versaoDaFotoDePerfil', () => ({ useVersaoDaFotoDePerfil: () => 0 }));
jest.mock('../ui/Aviso', () => ({ useAviso: () => ({ avisar: mockAvisar }) }));
jest.mock('../ui/RolagemComTopo', () => ({ useRolagem: () => ({ rolarAte: jest.fn() }) }));
jest.mock('../ui/AlvoDeRolagem', () => ({ AlvoDeRolagem: ({ children }: { children?: ReactNode }) => children }));
jest.mock('../ui/FotoDePerfil', () => ({ FotoDePerfil: () => null }));
jest.mock('../ui/Cartao', () => ({
  Cartao: ({ titulo, children }: { titulo?: string; children?: ReactNode }) =>
    require('react').createElement(require('react-native').View, null, require('react').createElement(require('react-native').Text, null, titulo), children),
}));
jest.mock('../ui/Esqueleto', () => ({ Esqueleto: () => null }));
jest.mock('../ui/LinhaDeAcoes', () => ({ LinhaDeAcoes: ({ children }: { children?: ReactNode }) => children }));
jest.mock('../ui/GradeDeOpcoes', () => ({ GradeDeOpcoes: ({ children }: { children?: ReactNode }) => children }));
jest.mock('../ui/Texto', () => ({
  Texto: ({ children }: { children?: ReactNode }) => require('react').createElement(require('react-native').Text, null, children),
}));
jest.mock('../ui/Selo', () => ({ Selo: ({ texto }: { texto: string }) => require('react').createElement(require('react-native').Text, null, texto) }));
jest.mock('../ui/Estados', () => ({
  Alerta: ({ texto, children }: { texto?: string; children?: ReactNode }) =>
    require('react').createElement(require('react-native').View, null, require('react').createElement(require('react-native').Text, null, texto), children),
  Vazio: ({ texto }: { texto: string }) => require('react').createElement(require('react-native').Text, null, texto),
  MensagemErro: () => null,
}));
const mockPressionavel = (rotulo: string, onPress: () => void, extra: object = {}) =>
  require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotulo, onPress, ...extra });
jest.mock('../ui/Botao', () => ({
  Botao: ({ rotulo, aoTocar, desabilitado }: { rotulo: string; aoTocar: () => void; desabilitado?: boolean }) =>
    mockPressionavel(rotulo, () => { if (!desabilitado) aoTocar(); }, { accessibilityState: { disabled: !!desabilitado } }),
}));
jest.mock('../ui/Campos', () => ({
  Interruptor: ({ rotulo, valor, aoMudar }: { rotulo: string; valor: boolean; aoMudar: (v: boolean) => void }) =>
    mockPressionavel(rotulo, () => aoMudar(!valor), { accessibilityState: { checked: valor } }),
}));
jest.mock('../ui/CaixaSelecao', () => ({
  CaixaSelecao: ({ rotulo, marcado, aoMudar }: { rotulo: string; marcado: boolean; aoMudar: (v: boolean) => void }) =>
    mockPressionavel(rotulo, () => aoMudar(!marcado), { accessibilityState: { checked: marcado } }),
}));
jest.mock('../ui/OpcaoCartao', () => ({
  OpcaoCartao: ({ titulo, aoEscolher, selecionada }: { titulo: string; aoEscolher: () => void; selecionada: boolean }) =>
    mockPressionavel(titulo, aoEscolher, { accessibilityState: { checked: selecionada } }),
}));

const ErroApi = require('@plataforma/web').ErroApi as typeof import('@plataforma/web').ErroApi;
const ler = meuPerfilDaComunidade as jest.Mock;
const salvar = salvarMeuPerfilDaComunidade as jest.Mock;

const conquista = (tipo: string) => ({ id: `id-${tipo}`, tipo, titulo: `Conquista ${tipo}`, descricao: 'Fictícia', icone: 'award', conquistadaEm: '2026-11-01T12:00:00Z' });
const perfil = (p: Partial<PreferenciasDoPerfil> = {}): PreferenciasDoPerfil => ({
  perfilReservado: false, reservadoEfetivo: false, destaques: [], cor: 'AZUL', moldura: 'SIMPLES',
  opcoesDeDestaque: ['A', 'B', 'C', 'D', 'E'].map(conquista), ...p,
});

const textos = (r: ReactTestRenderer) =>
  r.root.findAll((n) => String(n.type) === 'Text').map((n) => [n.props.children].flat().join('')).filter(Boolean);
const alvo = (r: ReactTestRenderer, rotulo: string) => {
  const achado = r.root.findAll((n) => n.props.accessibilityLabel === rotulo && typeof n.props.onPress === 'function')[0];
  if (!achado) throw new Error(`Não achei “${rotulo}”.`);
  return achado;
};
const tocar = async (r: ReactTestRenderer, rotulo: string) => { await act(async () => { alvo(r, rotulo).props.onPress(); }); };
const montar = async (lido: PreferenciasDoPerfil) => {
  ler.mockResolvedValueOnce(lido);
  let r!: ReactTestRenderer;
  await act(async () => { r = create(<CartaoMeuPerfil />); });
  return r;
};

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => { ler.mockReset(); salvar.mockReset(); mockAvisar.mockReset(); });

it('reservado por padrão e sem escolha: trocar só a cor manda perfilReservado null e o resto como estava', async () => {
  const lido = perfil({ perfilReservado: null, reservadoEfetivo: true, destaques: ['B'], moldura: 'DUPLA' });
  const r = await montar(lido);
  expect(alvo(r, 'Reservar meu perfil').props.accessibilityState.checked).toBe(true);
  expect(textos(r).some((t) => t.includes('começa reservado'))).toBe(true);
  expect(textos(r)).not.toContain('Seus colegas podem ver seu perfil; você pode reservá-lo.');

  salvar.mockResolvedValueOnce({ ...lido, cor: 'ROSA' });
  await tocar(r, 'Rosa');
  await tocar(r, 'Salvar perfil');
  expect(salvar).toHaveBeenCalledWith({ perfilReservado: null, destaques: ['B'], cor: 'ROSA', moldura: 'DUPLA' });
  expect(mockAvisar).toHaveBeenCalledWith('Perfil salvo.', 'sucesso');
});

it('até 4 destaques na ordem marcada; o 5º é recusado, explicado e não entra no PUT', async () => {
  const r = await montar(perfil());
  expect(textos(r)).toContain('0 de 4');
  for (const t of ['C', 'A', 'D', 'B']) await tocar(r, `Conquista ${t}`);
  await tocar(r, 'Conquista E');
  expect(alvo(r, 'Conquista E').props.accessibilityState.checked).toBe(false);
  expect(textos(r)).toContain('4 de 4. Você já escolheu 4: desmarque um para trocar.');
  expect(salvar).not.toHaveBeenCalled();

  salvar.mockResolvedValueOnce(perfil({ destaques: ['C', 'A', 'D', 'B'] }));
  await tocar(r, 'Salvar perfil');
  expect(salvar).toHaveBeenCalledWith(expect.objectContaining({ destaques: ['C', 'A', 'D', 'B'], perfilReservado: false }));
});

it('aviso único: "Entendi" grava false com destaques, cor e moldura salvos e some', async () => {
  const lido = perfil({ perfilReservado: null, reservadoEfetivo: false, destaques: ['A'], cor: 'VERDE', moldura: 'GROSSA' });
  const r = await montar(lido);
  expect(textos(r)).toContain('Seus colegas podem ver seu perfil; você pode reservá-lo.');
  // Mexer na moldura antes não muda o corpo do "Entendi" (que usa o salvo) e continua na tela depois.
  await tocar(r, 'Tracejada');
  salvar.mockResolvedValueOnce({ ...lido, perfilReservado: false });
  await tocar(r, 'Entendi, manter visível');
  expect(salvar).toHaveBeenCalledWith({ perfilReservado: false, destaques: ['A'], cor: 'VERDE', moldura: 'GROSSA' });
  expect(textos(r)).not.toContain('Seus colegas podem ver seu perfil; você pode reservá-lo.');
  expect(alvo(r, 'Tracejada').props.accessibilityState.checked).toBe(true);
});

it('salvar sem mudança fica desabilitado; 422 aparece no grupo e 429 vira texto amigável', async () => {
  const r = await montar(perfil());
  expect(alvo(r, 'Salvar perfil').props.accessibilityState.disabled).toBe(true);

  await tocar(r, 'Conquista A');
  salvar.mockRejectedValueOnce(new ErroApi(422, 'PERFIL_INVALIDO', 'Confira o perfil.', [{ field: 'destaques', message: 'Só dá para destacar uma conquista que você já ganhou.' }]));
  await tocar(r, 'Salvar perfil');
  expect(textos(r)).toContain('Só dá para destacar uma conquista que você já ganhou.');
  expect(mockAvisar).not.toHaveBeenCalled();

  salvar.mockRejectedValueOnce(new ErroApi(429, 'LOGIN_LIMITADO', 'Muitas tentativas.'));
  await tocar(r, 'Salvar perfil');
  expect(mockAvisar).toHaveBeenCalledWith(TEXTO_LIMITE_DO_PERFIL, 'perigo');
  // As escolhas continuam na tela para tentar de novo.
  expect(alvo(r, 'Conquista A').props.accessibilityState.checked).toBe(true);
});
