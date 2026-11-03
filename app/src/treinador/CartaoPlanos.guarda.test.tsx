/* eslint-disable @typescript-eslint/no-require-imports */
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import type { PastaResumo, PlanoResumo } from '../api/tipos';
import { criarPlano, listarPlanos, listarReceitas, replicarPlano } from '../api/rotas';
import { router } from 'expo-router';
import { GuardaDeSaida, useGuardaDeSaida, useSaidaGuardada } from '../ui/GuardaDeSaida';
import { Folha } from '../ui/Folha';
import { CartaoPlanos } from './CartaoPlanos';

/**
 * No celular, "Criar e abrir" e "Replicar e abrir" fecham a Folha no mesmo instante em que a guarda pergunta.
 * A pergunta tem de aparecer na hora (na Folha de baixo), confirmar abre o editor uma vez e cancelar descarta,
 * inclusive no toque seguinte. Na web este arquivo não roda: o `Platform` fica em `android`.
 */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), replace: jest.fn() },
  useNavigation: () => ({ addListener: () => () => undefined }),
  usePathname: () => '/treinador/alunos/aluno-1',
}));
jest.mock('../api/rotas', () => ({
  listarPlanos: jest.fn(),
  listarReceitas: jest.fn(() => Promise.resolve([])),
  criarPlano: jest.fn(),
  replicarPlano: jest.fn(),
  excluirPlano: jest.fn(),
  versaoPlano: jest.fn(),
}));
jest.mock('../sessao/SessaoProvider', () => ({
  useSessao: () => ({ pode: () => true, temFuncionalidade: () => true, usuario: { id: 'u1', papel: 'TREINADOR', nome: 'Treinador' } }),
}));
jest.mock('../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../tema/tokens').ESCURO, bordas: { bloco: 2, item: 2 }, marca: '#E11D48', sobreMarca: '#FFFFFF', fatorTexto: 1, preferencias: { animacoes: false } }),
}));
jest.mock('../ui/Aviso', () => ({ useAviso: () => ({ avisar: jest.fn() }) }));
jest.mock('../ui/useAvisoDoPlano', () => ({ useAvisoDoPlano: () => () => false }));
jest.mock('../ui/Botao', () => ({
  Botao: ({ rotulo, rotuloAcessivel, aoTocar, desabilitado }: { rotulo: string; rotuloAcessivel?: string; aoTocar: () => void; desabilitado?: boolean }) =>
    require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotuloAcessivel ?? rotulo, onPress: () => { if (!desabilitado) aoTocar(); } }),
}));
jest.mock('../ui/IconeBotao', () => ({
  IconeBotao: ({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) =>
    require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotulo, onPress: aoTocar }),
}));
jest.mock('../ui/Cartao', () => ({
  Cartao: ({ children, acoes }: { children?: ReactNode; acoes?: ReactNode }) => require('react').createElement(require('react-native').View, null, acoes, children),
}));
jest.mock('../ui/Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));
jest.mock('../ui/Campo', () => ({ Campo: () => null }));
jest.mock('../ui/Campos', () => ({ CampoData: () => null }));
jest.mock('../ui/Escolha', () => ({ Escolha: () => null }));
jest.mock('../ui/Esqueleto', () => ({ Esqueleto: () => null }));
jest.mock('../ui/Estados', () => ({ MensagemErro: () => null, Vazio: () => null }));
jest.mock('../ui/Selo', () => ({ Selo: () => null }));
jest.mock('../ui/EntradaEmCascata', () => ({ EntradaEmCascata: ({ children }: { children?: unknown }) => children, usePrimeiraLista: () => false }));
jest.mock('../ui/FolhaPdfDieta', () => ({ FolhaPdfDieta: () => null }));
jest.mock('./CopiarParaAluno', () => ({ CopiarParaAluno: () => null }));
jest.mock('./gerarPdf', () => ({ gerarPdfDoPlano: jest.fn() }));
jest.mock('../ui/PainelConfirmacao', () => ({
  PainelConfirmacao: (p: { visivel: boolean; titulo: string; rotuloConfirmar: string; rotuloCancelar?: string; portal?: { nome: string }; aoConfirmar: () => void; aoCancelar: () => void }) => {
    if (!p.visivel) return null;
    const React = require('react') as typeof import('react');
    const { View, Pressable } = require('react-native') as typeof import('react-native');
    return React.createElement(View, { accessibilityLabel: p.titulo, testID: p.portal?.nome ?? 'raiz' },
      React.createElement(Pressable, { accessibilityLabel: p.rotuloConfirmar, onPress: p.aoConfirmar }),
      React.createElement(Pressable, { accessibilityLabel: p.rotuloCancelar ?? 'Cancelar', onPress: p.aoCancelar }));
  },
}));

jest.mock('../ui/Folha', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  const { useFolhaNoHistorico } = require('../ui/historicoDasFolhas') as typeof import('../ui/historicoDasFolhas');
  const portais = new Map<string, string>();
  (globalThis as { __portaisDaFolha?: Map<string, string> }).__portaisDaFolha = portais;
  function Folha({ visivel = true, titulo, aoFechar, children, rodape }: { visivel?: boolean; titulo: string; aoFechar: () => void; children?: ReactNode; rodape?: ReactNode }) {
    const nome = React.useId();
    portais.set(titulo, nome);
    useFolhaNoHistorico(aoFechar, { nome, elemento: null });
    if (!visivel) return null;
    return React.createElement(View, { accessibilityLabel: `folha:${titulo}` }, children, rodape);
  }
  return { Folha, usePortalDaFolha: () => undefined };
});

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const React = require('react') as typeof import('react');

const PASTA: PastaResumo = {
  id: 'pasta-1', alunoId: 'aluno-1', titulo: 'Ciclo 1', inicio: '2026-01-01', fim: '2026-01-31', concluidaEm: null,
};
const PLANO: PlanoResumo = {
  id: 'plano-1', alunoId: 'aluno-1', pastaId: 'pasta-1', titulo: 'Plano A', inicio: '2026-01-01', fim: '2026-01-31',
  ativo: true, versaoPublicada: 2, publicadoEm: '2026-01-02T00:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 1,
};

function Sujo() {
  useGuardaDeSaida(true);
  return null;
}

function OutroToque() {
  const { confirmar } = useSaidaGuardada();
  return <Pressable accessibilityLabel="Ir para outro lugar" onPress={() => confirmar(() => router.push('/treinador'))} />;
}

function portais() {
  return (globalThis as { __portaisDaFolha?: Map<string, string> }).__portaisDaFolha ?? new Map<string, string>();
}

function tocar(raiz: import('react-test-renderer').ReactTestRenderer, rotulo: string) {
  const alvo = raiz.root.findAll((n) => typeof n.props.accessibilityLabel === 'string'
    && (n.props.accessibilityLabel as string).startsWith(rotulo)
    && typeof n.props.onPress === 'function').at(-1);
  if (!alvo) throw new Error(`Não achei “${rotulo}”.`);
  return alvo.props.onPress as () => void;
}

async function montar(planos: PlanoResumo[]) {
  (listarPlanos as jest.Mock).mockResolvedValue(planos);
  (listarReceitas as jest.Mock).mockResolvedValue([]);
  let raiz!: import('react-test-renderer').ReactTestRenderer;
  await Renderer.act(async () => {
    raiz = Renderer.create(
      <GuardaDeSaida>
        <Sujo />
        <Folha visivel titulo="Pasta do ciclo" aoFechar={() => undefined}>
          <CartaoPlanos tipo="treino" alunoId="aluno-1" pasta={PASTA} />
        </Folha>
        <OutroToque />
      </GuardaDeSaida>,
    );
  });
  await Renderer.act(async () => { await Promise.resolve(); });
  return raiz;
}

function pergunta(raiz: import('react-test-renderer').ReactTestRenderer) {
  return raiz.root.findAll((n) => n.props.accessibilityLabel === 'Sair sem salvar?').at(-1);
}

beforeAll(() => {
  jest.replaceProperty((require('react-native') as typeof import('react-native')).Platform, 'OS', 'android');
});

afterEach(() => {
  (router.push as jest.Mock).mockClear();
  portais().clear();
});

describe('guarda dentro da Folha no celular', () => {
  it('Criar e abrir pergunta na Folha de baixo; cancelar descarta, inclusive no toque seguinte', async () => {
    (criarPlano as jest.Mock).mockResolvedValue({ plano: { id: 'plano-novo' } });
    const raiz = await montar([]);
    await Renderer.act(async () => { tocar(raiz, 'Novo treino')(); });
    await Renderer.act(async () => { await Promise.resolve(); });
    await Renderer.act(async () => { tocar(raiz, 'Criar e abrir')(); await Promise.resolve(); });
    const dialogo = pergunta(raiz);
    expect(dialogo).toBeTruthy();
    expect(dialogo?.props.testID).toBe(portais().get('Pasta do ciclo'));
    expect(dialogo?.props.testID).not.toBe(portais().get('Novo treino em “Ciclo 1”'));
    expect(router.push).not.toHaveBeenCalled();
    await Renderer.act(async () => { tocar(raiz, 'Continuar editando')(); });
    expect(pergunta(raiz)).toBeUndefined();
    expect(router.push).not.toHaveBeenCalled();
    await Renderer.act(async () => { tocar(raiz, 'Ir para outro lugar')(); });
    expect(pergunta(raiz)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    await Renderer.act(async () => { tocar(raiz, 'Sair sem salvar')(); });
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/treinador');
  });

  it('Criar e abrir, ao confirmar, abre o editor uma vez', async () => {
    (criarPlano as jest.Mock).mockResolvedValue({ plano: { id: 'plano-novo' } });
    const raiz = await montar([]);
    await Renderer.act(async () => { tocar(raiz, 'Novo treino')(); });
    await Renderer.act(async () => { await Promise.resolve(); });
    await Renderer.act(async () => { tocar(raiz, 'Criar e abrir')(); await Promise.resolve(); });
    await Renderer.act(async () => { tocar(raiz, 'Sair sem salvar')(); });
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/treinador/treinos/plano-novo');
  });

  it('Replicar e abrir pergunta na hora e, ao confirmar, abre o editor uma vez', async () => {
    (replicarPlano as jest.Mock).mockResolvedValue({ plano: { id: 'plano-replicado' } });
    const raiz = await montar([PLANO]);
    await Renderer.act(async () => { tocar(raiz, 'Mais ações de Plano A')(); });
    await Renderer.act(async () => { tocar(raiz, 'Duplicar nesta pasta')(); });
    await Renderer.act(async () => { tocar(raiz, 'Replicar e abrir')(); await Promise.resolve(); });
    const dialogo = pergunta(raiz);
    expect(dialogo).toBeTruthy();
    expect(dialogo?.props.testID).toBe(portais().get('Pasta do ciclo'));
    expect(router.push).not.toHaveBeenCalled();
    await Renderer.act(async () => { tocar(raiz, 'Sair sem salvar')(); });
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/treinador/treinos/plano-replicado');
  });

  it('Replicar e abrir, ao cancelar, descarta também no toque seguinte', async () => {
    (replicarPlano as jest.Mock).mockResolvedValue({ plano: { id: 'plano-replicado' } });
    const raiz = await montar([PLANO]);
    await Renderer.act(async () => { tocar(raiz, 'Mais ações de Plano A')(); });
    await Renderer.act(async () => { tocar(raiz, 'Duplicar nesta pasta')(); });
    await Renderer.act(async () => { tocar(raiz, 'Replicar e abrir')(); await Promise.resolve(); });
    expect(pergunta(raiz)).toBeTruthy();
    await Renderer.act(async () => { tocar(raiz, 'Continuar editando')(); });
    expect(pergunta(raiz)).toBeUndefined();
    expect(router.push).not.toHaveBeenCalled();
    await Renderer.act(async () => { tocar(raiz, 'Ir para outro lugar')(); });
    expect(pergunta(raiz)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });
});
