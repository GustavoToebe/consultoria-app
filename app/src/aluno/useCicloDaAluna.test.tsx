import { ErroApi } from '@plataforma/web';

import type { CicloDaAluna } from '../api/tipos';
import { useCicloDaAluna } from './useCicloDaAluna';

/**
 * O hook sobre o `useCarregar` de verdade, com a API, a sessão e o provedor do aluno simulados. O que se confere: o 503 de
 * "módulo desligado" nunca chega à tela como erro, e outros erros continuam chegando.
 */
const mockCicloDaAluna = jest.fn<Promise<CicloDaAluna>, []>();
jest.mock('../api/rotas', () => ({ cicloDaAluna: () => mockCicloDaAluna() }));
let mockOnline = true;
jest.mock('../offline/AlunoProvider', () => ({ useAluno: () => ({ online: mockOnline }) }));
let mockCicloHabilitado = true;
jest.mock('../sessao/SessaoProvider', () => ({ useSessao: () => ({ cicloHabilitado: mockCicloHabilitado }) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');

type Retorno = ReturnType<typeof useCicloDaAluna>;

async function montar(): Promise<{ atual: () => Retorno; recarregar: () => Promise<void> }> {
  let ultimo!: Retorno;
  function Sonda() {
    ultimo = useCicloDaAluna();
    return null;
  }
  await Renderer.act(async () => {
    Renderer.create(<Sonda />);
  });
  return {
    atual: () => ultimo,
    recarregar: async () => {
      await Renderer.act(async () => {
        ultimo.recarregar();
      });
    },
  };
}

const DADOS: CicloDaAluna = { disponivel: true, ativo: false, consentimentoVersaoAtual: 1, duracaoHabitual: null, mostrarFases: true, registros: [], dias: [], textosDasFases: null };

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mockCicloDaAluna.mockReset();
  mockOnline = true;
  mockCicloHabilitado = true;
});

describe('useCicloDaAluna', () => {
  it('503 CICLO_INDISPONIVEL_NO_APP não vira erro de tela', async () => {
    mockCicloDaAluna.mockRejectedValue(new ErroApi(503, 'CICLO_INDISPONIVEL_NO_APP', 'O acompanhamento do ciclo não está disponível.'));
    const hook = await montar();
    expect(mockCicloDaAluna).toHaveBeenCalledTimes(1);
    expect(hook.atual().erro).toBeUndefined();
    expect(hook.atual().dados).toBeUndefined();
  });

  it('outro erro continua aparecendo', async () => {
    const erro = new ErroApi(500, 'ERRO_INTERNO', 'O servidor teve um problema.');
    mockCicloDaAluna.mockRejectedValue(erro);
    const hook = await montar();
    expect(hook.atual().erro).toBe(erro);
  });

  it('409 CICLO_INDISPONIVEL (sexo) não é o módulo desligado', async () => {
    const erro = new ErroApi(409, 'CICLO_INDISPONIVEL', 'O acompanhamento do ciclo não está disponível.');
    mockCicloDaAluna.mockRejectedValue(erro);
    const hook = await montar();
    expect(hook.atual().erro).toBe(erro);
  });

  it('com a chave desligada nada é consultado', async () => {
    mockCicloHabilitado = false;
    const hook = await montar();
    expect(mockCicloDaAluna).not.toHaveBeenCalled();
    expect(hook.atual()).toMatchObject({ habilitado: false, dados: undefined, erro: undefined });
  });

  it('carregou: devolve os dados', async () => {
    mockCicloDaAluna.mockResolvedValue(DADOS);
    const hook = await montar();
    expect(hook.atual()).toMatchObject({ habilitado: true, online: true, dados: DADOS, erro: undefined });
  });
});
