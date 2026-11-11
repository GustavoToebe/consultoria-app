/* eslint-disable @typescript-eslint/no-require-imports */
import { ErroApi } from '@plataforma/web';
import type { ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { obterPerfilDaComunidade } from '../api/comunidade';
import type { PerfilDaComunidade } from '../api/comunidadeTipos';
import { FolhaPerfilDoColega } from './FolhaPerfilDoColega';

/** A folha com as regras de verdade e as peças de UI trocadas por nós simples: estados, reservado, offline e "Editar meu perfil". */
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
// Um nó por nome de ícone (sempre o mesmo), para o teste do ícone comparar pela identidade.
jest.mock('lucide-react-native', () => new Proxy({} as Record<string | symbol, unknown>, { get: (alvo, nome) => (alvo[nome] ??= () => null) }));
jest.mock('../api/comunidade', () => ({ obterPerfilDaComunidade: jest.fn(), baixarFotoDoColega: jest.fn() }));
jest.mock('../aluno/AvisoDoPerfil', () => ({ CHAVE_DO_MEU_PERFIL: 'meu-perfil' }));
jest.mock('../aluno/MapaDeTreinos', () => ({ MapaDeTreinos: () => require('react').createElement(require('react-native').Text, null, 'Mapa dos treinos') }));
jest.mock('../tema/TemaProvider', () => ({ useTema: () => ({ cores: require('../tema/tokens').CLARO, modo: 'CLARO' }) }));
jest.mock('../ui/unidadeDeCargaEmUso', () => ({ useUnidadeDeCarga: () => 'kg' }));
jest.mock('../ui/Folha', () => ({
  Folha: ({ visivel, children }: { visivel: boolean; children?: ReactNode }) =>
    (visivel ? require('react').createElement(require('react-native').View, null, children) : null),
}));
jest.mock('../ui/Botao', () => ({
  Botao: ({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) =>
    require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotulo, onPress: aoTocar }),
}));
jest.mock('../ui/Texto', () => ({
  Texto: ({ children }: { children?: ReactNode }) => require('react').createElement(require('react-native').Text, null, children),
}));
jest.mock('../ui/Selo', () => ({ Selo: ({ texto }: { texto: string }) => require('react').createElement(require('react-native').Text, null, texto) }));
jest.mock('../ui/Estados', () => {
  const { createElement } = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    Alerta: ({ texto, children }: { texto: string; children?: ReactNode }) => createElement(View, null, createElement(Text, null, texto), children),
    Vazio: ({ texto }: { texto: string }) => createElement(Text, null, texto),
    MensagemErro: ({ tentarDeNovo }: { tentarDeNovo?: () => void }) => createElement(Pressable, { accessibilityLabel: 'Tentar de novo', onPress: tentarDeNovo }),
  };
});
jest.mock('../ui/Esqueleto', () => ({ Esqueleto: () => require('react').createElement(require('react-native').Text, null, 'carregando') }));
jest.mock('../ui/LinhaDeAcoes', () => ({ LinhaDeAcoes: ({ children }: { children?: ReactNode }) => children }));
jest.mock('../ui/FotoDePerfil', () => ({ IniciaisDePerfil: () => null, FotoDePerfil: () => null }));
jest.mock('./FotoDoColega', () => ({ FotoDoColega: ({ temFoto }: { temFoto: boolean }) => require('react').createElement(require('react-native').Text, null, temFoto ? 'foto' : 'iniciais') }));

const obter = obterPerfilDaComunidade as jest.Mock;
const VISIVEL: PerfilDaComunidade = {
  autorId: 'u2', nome: 'Aluno Fictício', apelido: 'Fictí', ehVoce: false, reservado: false, treinosConcluidos: 8, nivel: 2,
  conquistas: [{ tipo: 'PRIMEIRO_TREINO', titulo: 'Primeiro treino', descricao: 'Concluiu o primeiro treino.', icone: 'award' }],
  destaques: [], cor: 'LARANJA', moldura: 'SIMPLES', temFoto: true,
  atividade: { diasTreinadosUltimos30: [], ultimasConquistas: [] }, recordes: [{ exercicio: 'Supino reto', carga: 60 }],
};
const RESERVADO: PerfilDaComunidade = { autorId: 'u2', nome: 'Aluno Fictício', apelido: null, ehVoce: false, reservado: true };

const folha = (autorId: string | null, online = true) => <FolhaPerfilDoColega autorId={autorId} online={online} aoFechar={() => undefined} />;
const textos = (r: ReactTestRenderer) =>
  r.root.findAll((n) => String(n.type) === 'Text').map((n) => [n.props.children].flat().join('')).filter(Boolean);
const botao = (r: ReactTestRenderer, rotulo: string) => r.root.findAll((n) => n.props.accessibilityLabel === rotulo && typeof n.props.onPress === 'function')[0];
const abrir = async (autorId: string | null, online = true) => {
  let r!: ReactTestRenderer;
  await act(async () => { r = create(folha(autorId, online)); });
  return r;
};

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => { obter.mockReset(); mockPush.mockReset(); });

it('perfil visível: nível, treinos, insígnias, recordes em kg e a foto pedida só com `temFoto`', async () => {
  obter.mockResolvedValueOnce(VISIVEL);
  const r = await abrir('u2');
  expect(obter).toHaveBeenCalledWith('u2');
  const t = textos(r);
  expect(t).toEqual(expect.arrayContaining(['Aluno Fictício', 'Nível 2', '8 treinos concluídos', 'Primeiro treino', 'Supino reto', 'foto']));
  expect(t.some((x) => /60\s*kg/.test(x))).toBe(true);
  expect(t).not.toContain('Você');
  expect(t).not.toContain('Mapa dos treinos');
  expect(botao(r, 'Editar meu perfil')).toBeUndefined();
});

it('reservado para outro aluno: só nome e o aviso, nada de nível, foto, insígnia ou recorde', async () => {
  obter.mockResolvedValueOnce(RESERVADO);
  const t = textos(await abrir('u2'));
  expect(t).toEqual(expect.arrayContaining(['Aluno Fictício', 'Este aluno reservou o perfil.']));
  for (const fora of ['foto', 'iniciais', 'Insígnias', 'Recordes de carga', 'Atividade recente']) expect(t).not.toContain(fora);
  expect(t.some((x) => x.startsWith('Nível'))).toBe(false);
});

it('o próprio aluno, mesmo reservado, vê tudo e o atalho leva ao cartão da Conta', async () => {
  obter.mockResolvedValueOnce({ ...VISIVEL, ehVoce: true, reservado: true });
  const fechar = jest.fn();
  let r!: ReactTestRenderer;
  await act(async () => { r = create(<FolhaPerfilDoColega autorId="u2" online aoFechar={fechar} />); });
  expect(textos(r)).toEqual(expect.arrayContaining(['Mapa dos treinos', 'Você', 'Nível 2', 'Seu perfil está reservado: os colegas veem só o seu nome e o apelido.']));
  await act(async () => { botao(r, 'Editar meu perfil').props.onPress(); });
  expect(fechar).toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/aluno/conta', params: { secao: 'meu-perfil' } });
});

it('404 é "Perfil não encontrado." sem tentar de novo; 429 tem o texto fixo e tenta de novo', async () => {
  obter.mockRejectedValueOnce(new ErroApi(404, 'Perfil não encontrado.', 'NAO_ENCONTRADO'));
  const r = await abrir('u2');
  expect(textos(r)).toContain('Perfil não encontrado.');
  expect(botao(r, 'Tentar de novo')).toBeUndefined();

  obter.mockRejectedValueOnce(new ErroApi(429, 'Muitas.', 'LIMITE'));
  await act(async () => { r.update(folha('u3')); });
  expect(textos(r)).toContain('Muitos perfis abertos em pouco tempo. Espere alguns minutos e tente de novo.');
  obter.mockResolvedValueOnce(VISIVEL);
  await act(async () => { botao(r, 'Tentar de novo').props.onPress(); });
  expect(textos(r)).toContain('Nível 2');
});

it('sem internet diz isso e não mostra o que já tinha lido; na volta lê de novo', async () => {
  obter.mockResolvedValueOnce(VISIVEL);
  const r = await abrir('u2');
  expect(textos(r)).toContain('Nível 2');

  await act(async () => { r.update(folha('u2', false)); });
  expect(textos(r)).toEqual(['Sem conexão. O perfil aparece quando o aparelho voltar a ter internet.']);

  let responder!: (p: PerfilDaComunidade) => void;
  obter.mockReturnValueOnce(new Promise((ok) => { responder = ok; }));
  await act(async () => { r.update(folha('u2', true)); });
  expect(obter).toHaveBeenCalledTimes(2);
  // Enquanto a leitura nova não chega, nada do perfil antigo.
  expect(textos(r)).toEqual(['carregando']);
  await act(async () => { responder({ ...VISIVEL, nivel: 3 }); });
  expect(textos(r)).toContain('Nível 3');
});

it('ícone pelos nomes que a API manda; desconhecido vira a medalha', () => {
  const { Award, CalendarCheck, CircleCheck, Crown, Dumbbell, Flame, Medal, Shield, Trophy } = require('lucide-react-native');
  const { iconeDaConquista } = require('./SecoesDoPerfilDoColega');
  const esperado: [string | null, unknown][] = [
    ['trophy-first', Trophy], ['flame-10', Flame], ['fire-month', Flame], ['medal-25', Medal], ['shield-50', Shield], ['crown-100', Crown],
    ['calendar-star', CalendarCheck], ['weight-record', Dumbbell], ['dumbbell', Dumbbell], ['check-circle', CircleCheck], ['outro', Award], [null, Award],
  ];
  for (const [nome, icone] of esperado) expect(iconeDaConquista(nome)).toBe(icone);
});
