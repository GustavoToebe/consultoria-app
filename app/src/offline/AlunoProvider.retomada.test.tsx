import { useState, type ReactNode } from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';

import type { LoteResponse, RegistroSessaoConcluidaEnvio, SessoesConcluidasResponse } from '../api/tipos';
import { hojeDoCiclo } from '../dominio/cicloMenstrual';
import { somarDias } from '../dominio/formatos';
import { AlunoProvider, useAluno } from './AlunoProvider';
import { emMemoria } from './armazenamento';
import { RepositorioChaveValor, type DadosSessaoConcluida, type RepositorioLocal } from './repositorioLocal';

/**
 * Retomada de "Concluir treino" SEM remontar o provedor (revisão de 28/10 do passo 0.1): a sessão abre com a chave
 * desligada (o 503 `RETORNO_INDISPONIVEL` ou o perfil salvo) e depois o /eu a liga. O e2e não prova isto porque recarrega
 * a página. No ramo `virouLigada` do `AlunoProvider`: a conclusão LOCAL sai com o MESMO id, a que estava FALHOU volta a
 * aparecer e a que saiu da janela de 60 dias é descartada sem envio. API, sessão, rede e lembretes simulados; o
 * repositório é o de verdade (chave-valor em memória).
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let mockRetorno = false;
// Funções estáveis, como as do SessaoProvider de verdade: uma função nova a cada render refaria a abertura do provedor
// (o `baixarPacote` depende do `atualizarMarca`) em laço.
const mockSessaoFixa = { offline: false, atualizarMarca: () => undefined, aoSair: () => () => undefined };
jest.mock('../sessao/SessaoProvider', () => ({
  useSessao: () => ({ ...mockSessaoFixa, retornoHabilitado: mockRetorno }),
}));

const mockAceitaTudo = async (registros: { id: string }[]): Promise<LoteResponse> => ({
  resultados: registros.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })),
});
const mockEnviarConclusoes = jest.fn<Promise<LoteResponse>, [RegistroSessaoConcluidaEnvio[]]>();
const mockConclusoesDoServidor = jest.fn<Promise<SessoesConcluidasResponse>, [string, string]>();
jest.mock('../api/rotas', () => ({
  enviarRegistros: (r: { id: string }[]) => mockAceitaTudo(r),
  enviarRegistrosMobilidade: (r: { id: string }[]) => mockAceitaTudo(r),
  enviarSessoesConcluidas: (r: RegistroSessaoConcluidaEnvio[]) => mockEnviarConclusoes(r),
  sessoesConcluidasDoAluno: (de: string, ate: string) => mockConclusoesDoServidor(de, ate),
  // O pacote e o resto não importam aqui: falham como "sem pacote" e a tela seguiria com o salvo.
  painelAluno: () => Promise.reject(new Error('sem pacote no teste')),
  historicoAluno: () => Promise.resolve([]),
  demonstracoesDoAluno: () => Promise.resolve([]),
  mobilidadeAluno: () => Promise.reject(new Error('sem mobilidade no teste')),
  planosDaPastaAluno: () => Promise.reject(new Error('não usado')),
  registrosMobilidadeDoAluno: () => Promise.resolve([]),
}));
jest.mock('../aluno/atualizacao/lembretes', () => ({
  iniciarLembretesAtualizacao: () => undefined,
  reagendarLembretesAtualizacao: () => Promise.resolve(),
}));
jest.mock('./limparDadosDoAluno', () => ({ limparDadosDoAluno: () => Promise.resolve() }));
jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: { addEventListener: () => () => undefined } }));
jest.mock('../ui/vibrar', () => ({ vibrar: { leve: () => undefined, sucesso: () => undefined } }));

let mockRepositorio: RepositorioLocal;
const mockAbrirRepositorio = jest.fn(() => mockRepositorio);
jest.mock('./abrirRepositorio', () => ({ abrirRepositorio: () => mockAbrirRepositorio() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');

type Valor = ReturnType<typeof useAluno>;

const HOJE = hojeDoCiclo();
let ids = 0;

function treino(sessaoUid: string, data: string): DadosSessaoConcluida {
  return { planoVersaoId: 'v1', sessaoUid, data, concluida: true, resultado: 'COMPLETA', duracaoSegundos: 3600, comentario: 'bom' };
}

/** Deixa as promessas e os `setTimeout(0)` do provedor rodarem dentro do `act`. */
async function assentar(vezes = 8) {
  for (let i = 0; i < vezes; i++) {
    await Renderer.act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
}

let ultimo!: Valor;
const guardar = (valor: Valor) => {
  ultimo = valor;
};
let montagensDaSonda = 0;
function Sonda({ aoRender }: { aoRender: (valor: Valor) => void }) {
  aoRender(useAluno());
  return null;
}
/** Conta montagens: o inicializador do `useState` só roda quando o componente nasce. */
function ContaMontagem({ children }: { children: ReactNode }) {
  useState(() => ++montagensDaSonda);
  return <>{children}</>;
}

const arvore = () => (
  <AlunoProvider usuarioId="u1">
    <ContaMontagem>
      <Sonda aoRender={guardar} />
    </ContaMontagem>
  </AlunoProvider>
);

let montado: ReactTestRenderer | null = null;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mockRetorno = false;
  montagensDaSonda = 0;
  mockEnviarConclusoes.mockReset().mockImplementation(mockAceitaTudo);
  mockConclusoesDoServidor.mockReset().mockResolvedValue({ sessoes: [], totalConcluidos: 0 });
  mockAbrirRepositorio.mockClear();
  mockRepositorio = new RepositorioChaveValor(emMemoria(), 'u1', () => `id-${++ids}`);
});

afterEach(async () => {
  await Renderer.act(async () => {
    montado?.unmount();
    montado = null;
  });
});

describe('AlunoProvider: chave "Concluir treino" que volta sem remontar', () => {
  it('a LOCAL sai com o mesmo id, a FALHOU volta a aparecer e a de fora da janela de 60 dias some sem envio', async () => {
    const local = await mockRepositorio.registrarSessaoConcluida(treino('s1', HOJE));
    const foraDaJanela = await mockRepositorio.registrarSessaoConcluida(treino('velha', somarDias(HOJE, -61)));
    const falhou = await mockRepositorio.registrarSessaoConcluida(treino('falhou', somarDias(HOJE, -2)));
    await mockRepositorio.aplicarResultadosSessoesConcluidas([falhou], [{ id: falhou.id, situacao: 'RECUSADO', motivo: 'Recusado.' }]);

    await Renderer.act(async () => {
      montado = Renderer.create(arvore());
    });
    await assentar();

    // Chave desligada: nada de conclusão é enviado nem consultado, e a fila não aparece para o aluno.
    expect(mockEnviarConclusoes).not.toHaveBeenCalled();
    expect(mockConclusoesDoServidor).not.toHaveBeenCalled();
    expect(ultimo.falhasDeConclusao).toEqual([]);
    expect(ultimo.sessoesConcluidasNoAparelho).toEqual([]);
    expect(ultimo.sessaoConcluidaDe('v1', 's1', HOJE)).toBeNull();
    // Nem a de fora da janela saiu: com a chave desligada o aparelho não mexe na fila.
    expect((await mockRepositorio.listarSessoesConcluidas()).map((r) => [r.id, r.situacao])).toEqual([
      [local.id, 'LOCAL'],
      [foraDaJanela.id, 'LOCAL'],
      [falhou.id, 'FALHOU'],
    ]);

    // O /eu liga a chave: o MESMO provedor (sem remontar) recebe retornoHabilitado = true.
    mockRetorno = true;
    await Renderer.act(async () => {
      montado!.update(arvore());
    });
    await assentar();

    expect(montagensDaSonda).toBe(1);
    expect(mockAbrirRepositorio).toHaveBeenCalledTimes(1);
    // Envio com o mesmo id; a de fora da janela não foi enviada; a FALHOU espera "Tentar de novo".
    const enviados = mockEnviarConclusoes.mock.calls.flatMap(([lote]) => lote.map((r) => r.id));
    expect(enviados).toEqual([local.id]);
    expect(mockConclusoesDoServidor).toHaveBeenCalled();
    expect((await mockRepositorio.listarSessoesConcluidas()).map((r) => [r.id, r.situacao])).toEqual([
      [local.id, 'ENVIADO'],
      [falhou.id, 'FALHOU'],
    ]);
    // O que o aluno vê volta: a falha escondida reaparece e o treino de hoje está concluído.
    expect(ultimo.falhasDeConclusao.map((r) => r.id)).toEqual([falhou.id]);
    expect(ultimo.sessoesConcluidasNoAparelho.map((r) => r.id)).toEqual([local.id, falhou.id]);
    expect(ultimo.sessaoConcluidaDe('v1', 's1', HOJE)?.concluida).toBe(true);
    expect(ultimo.pendentes).toBe(0);
  });

  it('chave que volta e cai de novo no 503 RETORNO_INDISPONIVEL: a conclusão continua LOCAL, com o mesmo id', async () => {
    const local = await mockRepositorio.registrarSessaoConcluida(treino('s1', HOJE));
    const { ErroApi } = jest.requireActual<typeof import('../api/cliente')>('../api/cliente');
    mockEnviarConclusoes.mockRejectedValue(new ErroApi(503, 'RETORNO_INDISPONIVEL', 'Indisponível.'));

    await Renderer.act(async () => {
      montado = Renderer.create(arvore());
    });
    await assentar();
    mockRetorno = true;
    await Renderer.act(async () => {
      montado!.update(arvore());
    });
    await assentar();

    expect(montagensDaSonda).toBe(1);
    expect(mockEnviarConclusoes.mock.calls.flatMap(([lote]) => lote.map((r) => r.id))[0]).toBe(local.id);
    expect((await mockRepositorio.listarSessoesConcluidas()).map((r) => [r.id, r.situacao])).toEqual([[local.id, 'LOCAL']]);
  });
});
