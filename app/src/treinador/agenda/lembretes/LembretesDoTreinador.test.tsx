import type { Compromisso } from '../../../api/agendaTipos';
import type { CompromissoParaLembrete } from '../../../dominio/lembretesCompromisso';
import { LembretesDoTreinador } from './LembretesDoTreinador';

/**
 * O gancho do treinador sobre o `useCarregar` de verdade, com a sessão, o tema, a API e a camada nativa simulados: só
 * agenda o que é dele como responsável, com a preferência ligada e `AGENDA_LER`; desligar apaga; sair apaga.
 */
const mockListar = jest.fn<Promise<Compromisso[]>, [{ responsavel?: string | null; situacoes?: readonly string[] }]>();
jest.mock('../../../api/rotas', () => ({ listarCompromissos: (f: { responsavel?: string | null }) => mockListar(f) }));
let mockPode = true;
let mockSair: ((id: string, motivo: 'sair' | 'recusada') => Promise<void>) | null = null;
jest.mock('../../../sessao/SessaoProvider', () => ({
  useSessao: () => ({
    usuario: { id: 'u1', papel: 'TREINADOR' },
    pode: () => mockPode,
    aoSair: (limpeza: typeof mockSair) => { mockSair = limpeza; return () => { mockSair = null; }; },
  }),
}));
let mockLigado = true;
jest.mock('../../../tema/TemaProvider', () => ({ useTema: () => ({ preferencias: { lembretesCompromisso: mockLigado } }) }));
jest.mock('expo-router', () => ({ usePathname: () => '/treinador/agenda' }));
const mockReagendar = jest.fn<Promise<void>, [string, readonly CompromissoParaLembrete[] | null]>(() => Promise.resolve());
const mockDesligar = jest.fn<Promise<void>, [string]>(() => Promise.resolve());
const mockEncerrar = jest.fn<Promise<void>, [string]>(() => Promise.resolve());
const mockIniciar = jest.fn();
jest.mock('../../../aluno/compromissos/lembretes', () => ({
  iniciarLembretesDeCompromisso: (id: string) => mockIniciar(id),
  desligarLembretesDeCompromisso: (id: string) => mockDesligar(id),
  encerrarLembretesDeCompromisso: (id: string) => mockEncerrar(id),
  reagendarLembretesDeCompromisso: (id: string, lista: readonly CompromissoParaLembrete[] | null) => mockReagendar(id, lista),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');

const equipe = (id: string, responsavelId: string): Compromisso => ({
  id, responsavelId, responsavelNome: null, inicio: '2030-11-05T12:00:00Z', fim: '2030-11-05T13:00:00Z', data: '2030-11-05', hora: '09:00',
  horaFim: '10:00', duracaoMinutos: 60, local: null, observacao: null, cancelado: false, versao: 0, serieId: null,
  ocorrenciaDaSerie: null, totalDaSerie: null, lembretesMinutos: [1440, 30],
  participantes: [{ id: 'a1', nome: 'Aluno Fictício', situacao: 'AGENDADO' }],
});

const montados: import('react-test-renderer').ReactTestRenderer[] = [];
afterEach(async () => { await Renderer.act(async () => { montados.splice(0).forEach((m) => m.unmount()); }); });
async function montar() {
  let r!: import('react-test-renderer').ReactTestRenderer;
  await Renderer.act(async () => { r = Renderer.create(<LembretesDoTreinador />); montados.push(r); });
  return { remontar: () => Renderer.act(async () => { r.update(<LembretesDoTreinador />); }) };
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockPode = true;
  mockLigado = true;
  mockSair = null;
  mockListar.mockResolvedValue([equipe('meu', 'u1'), equipe('de-outro', 'u2')]);
});

describe('LembretesDoTreinador', () => {
  it('busca os dele como responsável, só os agendados, e agenda só os dele', async () => {
    await montar();
    expect(mockIniciar).toHaveBeenCalledWith('u1');
    expect(mockListar).toHaveBeenCalledWith(expect.objectContaining({ responsavel: 'u1', situacoes: ['AGENDADO'] }));
    expect(mockReagendar).toHaveBeenCalledTimes(1);
    expect(mockReagendar.mock.calls[0][0]).toBe('u1');
    expect(mockReagendar.mock.calls[0][1]?.map((c) => [c.id, c.lembretesMinutos])).toEqual([['meu', [1440, 30]]]);
  });

  it('preferência desligada: não busca nem agenda; desligar depois de ligada apaga', async () => {
    mockLigado = false;
    const { remontar } = await montar();
    expect(mockListar).not.toHaveBeenCalled();
    expect(mockReagendar).not.toHaveBeenCalled();
    expect(mockDesligar).not.toHaveBeenCalled();
    mockLigado = true;
    await remontar();
    mockLigado = false;
    await remontar();
    expect(mockDesligar).toHaveBeenCalledWith('u1');
  });

  it('sem AGENDA_LER não busca nem agenda', async () => {
    mockPode = false;
    await montar();
    expect(mockListar).not.toHaveBeenCalled();
    expect(mockReagendar).not.toHaveBeenCalled();
  });

  it('erro da API não derruba nem mexe nos lembretes já agendados', async () => {
    mockListar.mockRejectedValue(new Error('500'));
    await montar();
    expect(mockReagendar).not.toHaveBeenCalled();
    expect(mockDesligar).not.toHaveBeenCalled();
  });

  it('sair da conta apaga os lembretes dele', async () => {
    await montar();
    expect(mockSair).not.toBeNull();
    await mockSair?.('u1', 'sair');
    expect(mockEncerrar).toHaveBeenCalledWith('u1');
  });
});
