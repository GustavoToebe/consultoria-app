import type { PlanoResumo } from '../api/tipos';
import { gerarPdfDoPlano } from './gerarPdf';

const mockConsultoria = jest.fn();
const mockBuscarAluno = jest.fn();
const mockVersaoPlano = jest.fn();
const mockPesosDoAluno = jest.fn();
const mockLogoComoDataUri = jest.fn();
const mockImprimir = jest.fn();

jest.mock('../api/rotas', () => ({
  consultoria: (...a: unknown[]) => mockConsultoria(...a),
  aluno: (...a: unknown[]) => mockBuscarAluno(...a),
  versaoPlano: (...a: unknown[]) => mockVersaoPlano(...a),
  pesosDoAluno: (...a: unknown[]) => mockPesosDoAluno(...a),
  listarPlanos: jest.fn(),
}));
jest.mock('../pdf/logo', () => ({ logoComoDataUri: (...a: unknown[]) => mockLogoComoDataUri(...a) }));
jest.mock('../pdf/imprimir', () => ({ imprimir: (...a: unknown[]) => mockImprimir(...a) }));
jest.mock('../dominio/uid', () => ({ novoUid: () => 'uid' }));

const marca = { id: 'm', nome: 'Consultoria Teste', corPrimaria: '#C62828', fonteTitulo: 'METAL', temaPadrao: 'ESCURO', logoUrl: '/logo?v=1' };
const plano = (versaoPublicada: number): PlanoResumo => ({ id: 'p1', alunoId: 'a1', titulo: 'Plano', versaoPublicada, inicio: null, fim: null }) as unknown as PlanoResumo;

/** Promessa que o teste resolve na hora que quiser. */
function adiada<T>() {
  let resolver: (v: T) => void = () => undefined;
  const promessa = new Promise<T>((r) => { resolver = r; });
  return { promessa, resolver };
}
const vazias = () => new Promise<void>((r) => setImmediate(r));

beforeEach(() => {
  for (const f of [mockConsultoria, mockBuscarAluno, mockVersaoPlano, mockPesosDoAluno, mockLogoComoDataUri, mockImprimir]) f.mockReset();
  mockBuscarAluno.mockResolvedValue({ nome: 'Aluno Fictício' });
  mockVersaoPlano.mockResolvedValue({ numero: 3, titulo: 'Plano v3', inicio: null, fim: null, conteudo: { sessoes: [], objetivos: [] } });
  mockPesosDoAluno.mockResolvedValue([]);
  mockLogoComoDataUri.mockResolvedValue('data:image/png;base64,AAAA');
  mockImprimir.mockResolvedValue(undefined);
});

describe('gerarPdfDoPlano: chamadas em paralelo', () => {
  it('aluno, versão e pesos saem sem esperar a consultoria; a logo só depois dela', async () => {
    const c = adiada<{ marca: typeof marca }>();
    mockConsultoria.mockReturnValue(c.promessa);
    const feito = gerarPdfDoPlano('dieta', plano(3));
    await vazias();
    expect(mockBuscarAluno).toHaveBeenCalledWith('a1');
    expect(mockVersaoPlano).toHaveBeenCalledWith('dieta', 'p1', 3);
    expect(mockPesosDoAluno).toHaveBeenCalledWith('a1');
    expect(mockLogoComoDataUri).not.toHaveBeenCalled();
    c.resolver({ marca });
    await feito;
    expect(mockLogoComoDataUri).toHaveBeenCalledWith(marca);
    expect(mockImprimir).toHaveBeenCalledTimes(1);
  });

  it('treino e mobilidade não buscam os pesos', async () => {
    mockConsultoria.mockResolvedValue({ marca });
    await gerarPdfDoPlano('treino', plano(3));
    await gerarPdfDoPlano('mobilidade', plano(3));
    expect(mockPesosDoAluno).not.toHaveBeenCalled();
  });

  it('peso que falha não derruba o PDF da dieta', async () => {
    mockConsultoria.mockResolvedValue({ marca });
    mockPesosDoAluno.mockRejectedValue(new Error('500'));
    await expect(gerarPdfDoPlano('dieta', plano(3))).resolves.toBeUndefined();
    expect(mockImprimir).toHaveBeenCalledTimes(1);
  });
});

describe('gerarPdfDoPlano: rascunho × publicado (regra intacta)', () => {
  it('plano nunca publicado não pede versão e sai do rascunho', async () => {
    mockConsultoria.mockResolvedValue({ marca });
    await gerarPdfDoPlano('treino', plano(0), { objetivo: 'Do rascunho', sessoes: [] });
    expect(mockVersaoPlano).not.toHaveBeenCalled();
    const doc = mockImprimir.mock.calls[0][0] as { corpo: string };
    expect(doc.corpo).toContain('Do rascunho');
    expect(doc.corpo).toContain('RASCUNHO');
  });

  it('plano publicado usa a versão publicada, não o rascunho', async () => {
    mockConsultoria.mockResolvedValue({ marca });
    mockVersaoPlano.mockResolvedValue({ numero: 3, titulo: 'Plano v3', inicio: null, fim: null, conteudo: { objetivo: 'Da versão publicada', sessoes: [] } });
    await gerarPdfDoPlano('treino', plano(3), { objetivo: 'Do rascunho', sessoes: [] });
    const doc = mockImprimir.mock.calls[0][0] as { corpo: string };
    expect(doc.corpo).toContain('Da versão publicada');
    expect(doc.corpo).not.toContain('Do rascunho');
  });
});
