import { Platform } from 'react-native';

import { registrarPushDoAparelho, removerPushDoAparelho } from '../aluno/push/pushNativo';
import { registrarPushDoTreinador, removerPushDoTreinadorAoSair } from '../treinador/push/pushDoTreinador';
import { SessaoProvider, useSessao } from './SessaoProvider';

/**
 * O "Sair" e a troca de senha do treinador diante do push de atenção (C7), com o SessaoProvider de verdade e o resto simulado:
 * o "Sair" apaga o token deste aparelho (sem bloquear, sem tocar no push do aluno) e a troca de senha (que apaga os tokens na
 * API) registra o deste aparelho de novo, só com push e regras ligados e as permissões de ler os pontos.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: jest.fn(() => jest.fn()) }));

const mockLogin = { accessToken: 'a', usuario: { id: 'treinador-1', papel: 'TREINADOR', nome: 'Treinador Fictício' } };
let mockEu: Record<string, unknown> = {};
jest.mock('../api/cliente', () => ({
  aoAcessoPausado: jest.fn(),
  aoContratoPendente: jest.fn(),
  aoCicloDesligado: jest.fn(),
  aoRetornoDesligado: jest.fn(),
  aoVitrineDesligada: jest.fn(),
  aoLojaDesligada: jest.fn(),
  aoMarketplaceDesligado: jest.fn(),
  aoEncerrar: jest.fn(),
  definirUsuarioDaSessao: jest.fn(),
  ErroApi: class ErroApi extends Error { semConexao = false; },
  guardarSessao: jest.fn(async () => undefined),
  limparSessaoLocal: jest.fn(async () => undefined),
  recusadaPorTrocaDeUsuario: jest.fn(() => false),
  renovarSessao: jest.fn(async () => mockLogin),
}));
jest.mock('../api/rotas', () => ({
  eu: jest.fn(async () => mockEu),
  trocarSenha: jest.fn(async () => mockLogin),
  sairDaApi: jest.fn(async () => undefined),
}));
jest.mock('../aluno/push/pushNativo', () => ({
  registrarPushDoAparelho: jest.fn(async () => undefined),
  removerPushDoAparelho: jest.fn(async () => undefined),
}));
jest.mock('../treinador/push/pushDoTreinador', () => ({
  registrarPushDoTreinador: jest.fn(async () => undefined),
  removerPushDoTreinadorAoSair: jest.fn(async () => undefined),
}));
jest.mock('../dominio/encerrarSessaoLocal', () => ({ apagarDadosDaSessaoLocal: jest.fn(async () => undefined) }));
jest.mock('../offline/filasRetidas', () => ({ varrerFilasRetidas: jest.fn(async () => undefined) }));
jest.mock('../offline/limparDadosDoAluno', () => ({ limparDadosDoAluno: jest.fn(async () => undefined) }));
jest.mock('../offline/arquivosTemporarios', () => ({ apagarArquivosTemporarios: jest.fn() }));
jest.mock('../pdf/logoEmMemoria', () => ({ limparLogosEmMemoria: jest.fn() }));
jest.mock('./armazenamentoSeguro', () => ({ lerRefresh: jest.fn(async () => 'refresh') }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');

type Sessao = ReturnType<typeof useSessao>;
const montados: import('react-test-renderer').ReactTestRenderer[] = [];
const LIGADO = { pushHabilitado: true, regrasAtencaoHabilitada: true, permissoes: ['ATUALIZACAO_LER', 'ALUNO_SENSIVEL_LER'] };

afterEach(async () => {
  await Renderer.act(async () => {
    montados.splice(0).forEach((m) => m.unmount());
  });
});

async function montar(eu: Record<string, unknown>): Promise<() => Sessao> {
  mockEu = { usuario: mockLogin.usuario, marca: { nome: 'Marca Fictícia' }, ...eu };
  let ultima!: Sessao;
  function Sonda() {
    ultima = useSessao();
    return null;
  }
  await Renderer.act(async () => {
    montados.push(Renderer.create(<SessaoProvider><Sonda /></SessaoProvider>));
  });
  expect(ultima.situacao).toBe('autenticado');
  return () => ultima;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  Platform.OS = 'android';
});

describe('Sair do treinador', () => {
  it('apaga o token deste aparelho antes de encerrar, mesmo com a chave desligada, sem tocar no do aluno', async () => {
    const sessao = await montar({ pushHabilitado: false });
    await Renderer.act(async () => sessao().sair());
    expect(removerPushDoTreinadorAoSair).toHaveBeenCalledTimes(1);
    expect(removerPushDoAparelho).not.toHaveBeenCalled();
    expect(sessao().situacao).toBe('anonimo');
  });

  it('falha ao apagar o token não bloqueia a saída', async () => {
    const sessao = await montar(LIGADO);
    jest.mocked(removerPushDoTreinadorAoSair).mockRejectedValueOnce(new Error('sem internet'));
    await Renderer.act(async () => sessao().sair());
    expect(sessao().situacao).toBe('anonimo');
  });
});

describe('trocar a própria senha (treinador)', () => {
  it('com push e regras ligados e as permissões, registra o token deste aparelho de novo', async () => {
    const sessao = await montar(LIGADO);
    await Renderer.act(async () => sessao().trocarSenha('antiga-123', 'nova-12345'));
    expect(registrarPushDoTreinador).toHaveBeenCalledTimes(1);
    expect(registrarPushDoAparelho).not.toHaveBeenCalled();
  });

  it('sem a chave do push, sem as regras, sem as permissões ou na web, não registra', async () => {
    for (const eu of [{ ...LIGADO, pushHabilitado: false }, { ...LIGADO, regrasAtencaoHabilitada: false }, { ...LIGADO, permissoes: ['ATUALIZACAO_LER'] }]) {
      const sessao = await montar(eu);
      await Renderer.act(async () => sessao().trocarSenha('antiga-123', 'nova-12345'));
    }
    Platform.OS = 'web';
    const sessao = await montar(LIGADO);
    await Renderer.act(async () => sessao().trocarSenha('antiga-123', 'nova-12345'));
    expect(registrarPushDoTreinador).not.toHaveBeenCalled();
  });

  it('falha ao registrar não derruba a troca de senha', async () => {
    const sessao = await montar(LIGADO);
    jest.mocked(registrarPushDoTreinador).mockRejectedValueOnce(new Error('sem internet'));
    await expect(Renderer.act(async () => sessao().trocarSenha('antiga-123', 'nova-12345'))).resolves.toBeUndefined();
  });
});
