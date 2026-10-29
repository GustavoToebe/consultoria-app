import { useEffect } from 'react';

import type { AvisoDeCompromisso, CompromissoDoAluno } from '../../api/agendaTipos';
import { CompromissosDoAlunoProvider, useCompromissosDoAluno } from './CompromissosDoAlunoProvider';

/**
 * O provedor sobre o `useCarregar` de verdade, com a API, o aluno, o tema e a camada nativa dos lembretes simulados: o aviso
 * some na hora do toque e volta se o servidor não confirma; sem rede nada aparece e nenhum lembrete é mexido; os lembretes só
 * se reagendam com a preferência ligada e uma lista baixada.
 */
const mockAvisos = jest.fn<Promise<AvisoDeCompromisso[]>, []>();
const mockCompromissos = jest.fn<Promise<CompromissoDoAluno[]>, []>();
const mockVisto = jest.fn<Promise<void>, [string]>();
jest.mock('../../api/rotas', () => ({
  avisosDeCompromisso: () => mockAvisos(),
  compromissosDoAluno: () => mockCompromissos(),
  marcarAvisoDeCompromissoVisto: (id: string) => mockVisto(id),
}));
let mockOnline = true;
jest.mock('../../offline/AlunoProvider', () => ({ useAluno: () => ({ online: mockOnline, repositorio: { usuarioId: 'u1' } }) }));
let mockLigado = false;
jest.mock('../../tema/TemaProvider', () => ({ useTema: () => ({ preferencias: { lembretesCompromisso: mockLigado } }) }));
jest.mock('expo-router', () => ({ useFocusEffect: () => undefined }));
const mockReagendar = jest.fn<Promise<void>, [string, readonly CompromissoDoAluno[] | null]>(() => Promise.resolve());
const mockDesligar = jest.fn<Promise<void>, [string]>(() => Promise.resolve());
const mockIniciar = jest.fn();
jest.mock('./lembretes', () => ({
  iniciarLembretesDeCompromisso: (id: string) => mockIniciar(id),
  desligarLembretesDeCompromisso: (id: string) => mockDesligar(id),
  reagendarLembretesDeCompromisso: (id: string, lista: readonly CompromissoDoAluno[] | null) => mockReagendar(id, lista),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');

const AVISO = (id: string): AvisoDeCompromisso => ({ id, tipo: 'NOVO', inicio: '2030-11-05T12:00:00Z', responsavelNome: 'Ana Fictícia' });
const COMPROMISSO = (id: string): CompromissoDoAluno => ({
  id, inicio: '2030-11-05T12:00:00Z', fim: '2030-11-05T13:00:00Z', data: '2030-11-05', hora: '09:00', horaFim: '10:00',
  duracaoMinutos: 60, local: null, situacao: 'AGENDADO', responsavelNome: null,
});

type Retorno = ReturnType<typeof useCompromissosDoAluno>;
const montados: import('react-test-renderer').ReactTestRenderer[] = [];
afterEach(async () => {
  await Renderer.act(async () => { montados.splice(0).forEach((m) => m.unmount()); });
});

async function montar(): Promise<{ atual: () => Retorno; remontar: () => Promise<void> }> {
  const guardado: { valor?: Retorno } = {};
  function Sonda() {
    const valor = useCompromissosDoAluno();
    useEffect(() => { guardado.valor = valor; });
    return null;
  }
  const arvore = () => <CompromissosDoAlunoProvider><Sonda /></CompromissosDoAlunoProvider>;
  let renderizador!: import('react-test-renderer').ReactTestRenderer;
  await Renderer.act(async () => { renderizador = Renderer.create(arvore()); montados.push(renderizador); });
  return { atual: () => guardado.valor as Retorno, remontar: () => Renderer.act(async () => { renderizador.update(arvore()); }) };
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockOnline = true;
  mockLigado = false;
  mockAvisos.mockResolvedValue([AVISO('a1'), AVISO('a2')]);
  mockCompromissos.mockResolvedValue([COMPROMISSO('c1')]);
  mockVisto.mockResolvedValue(undefined);
});

describe('CompromissosDoAlunoProvider', () => {
  it('traz os avisos e os compromissos; tocar tira o aviso na hora e avisa o servidor', async () => {
    const { atual } = await montar();
    expect(atual().avisos.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(atual().compromissos?.map((c) => c.id)).toEqual(['c1']);
    await Renderer.act(async () => { atual().marcarVisto('a1'); });
    expect(mockVisto).toHaveBeenCalledWith('a1');
    expect(atual().avisos.map((a) => a.id)).toEqual(['a2']);
  });

  it('falha de rede ao marcar não trava: o aviso volta, porque no servidor ele segue não visto', async () => {
    mockVisto.mockRejectedValueOnce(new Error('sem conexão'));
    const { atual } = await montar();
    await Renderer.act(async () => { atual().marcarVisto('a1'); });
    expect(atual().avisos.map((a) => a.id)).toEqual(['a1', 'a2']);
  });

  it('sem conexão não busca: sem avisos, sem lista e sem tocar nos lembretes já agendados', async () => {
    mockOnline = false;
    mockLigado = true;
    const { atual } = await montar();
    expect(mockAvisos).not.toHaveBeenCalled();
    expect(atual().avisos).toEqual([]);
    expect(atual().compromissos).toBeUndefined();
    expect(mockReagendar).not.toHaveBeenCalled();
    expect(mockDesligar).not.toHaveBeenCalled();
  });

  it('erro da API some com o aviso, sem derrubar nada', async () => {
    mockAvisos.mockRejectedValue(new Error('500'));
    mockCompromissos.mockRejectedValue(new Error('500'));
    mockLigado = true;
    const { atual } = await montar();
    expect(atual().avisos).toEqual([]);
    expect(atual().compromissos).toBeUndefined();
    expect(mockReagendar).not.toHaveBeenCalled();
  });

  it('preferência desligada: nada é agendado nem cancelado ao abrir', async () => {
    await montar();
    expect(mockIniciar).toHaveBeenCalledWith('u1');
    expect(mockReagendar).not.toHaveBeenCalled();
    expect(mockDesligar).not.toHaveBeenCalled();
  });

  it('preferência ligada: reagenda com a lista baixada; ao desligar, cancela', async () => {
    mockLigado = true;
    const { remontar } = await montar();
    expect(mockReagendar).toHaveBeenCalledTimes(1);
    expect(mockReagendar.mock.calls[0][0]).toBe('u1');
    expect(mockReagendar.mock.calls[0][1]?.map((c) => c.id)).toEqual(['c1']);
    mockLigado = false;
    await remontar();
    expect(mockDesligar).toHaveBeenCalledWith('u1');
  });
});
