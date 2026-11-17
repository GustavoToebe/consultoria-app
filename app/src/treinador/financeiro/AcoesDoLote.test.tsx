/* eslint-disable @typescript-eslint/no-require-imports */
import type { CobrancaResponse } from '../../api/financeiroTipos';
import { resumoDaAcaoEmLote } from '../../dominio/acoesEmLote';
import { AcoesDoLote, FolhaDoResultadoDaAcao } from './AcoesDoLote';

/**
 * As ações do lote: o segundo toque que chega antes de redesenhar não manda outro pedido (trava por `useRef`), a cópia
 * recusada pelo navegador (`setStringAsync` resolve `false` na web) nunca vira "copiado" e "Tentar de novo" só reenvia os
 * links que falharam. Peças de `ui/` trocadas por versões mínimas que só expõem o toque; só dados fictícios.
 */
jest.mock('../../api/rotas', () => ({ cancelarCobrancasEmLote: jest.fn(), gerarLinksEmLote: jest.fn(), exportarCobrancasSelecionadas: jest.fn() }));
const mockAvisar = jest.fn();
jest.mock('../../ui/Aviso', () => ({ useAviso: () => ({ avisar: mockAvisar }) }));
const mockCopiar = jest.fn();
jest.mock('expo-clipboard', () => ({ setStringAsync: (t: string) => mockCopiar(t) }));
jest.mock('./baixarCsv', () => ({ baixarCsv: jest.fn(() => Promise.resolve()) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

const h = (...a: unknown[]) => (require('react').createElement as (...x: unknown[]) => unknown)(...a);
const Toque = ({ rotulo, aoTocar }: { rotulo: string; aoTocar?: () => void }) =>
  h(require('react-native').Pressable, { accessibilityLabel: rotulo, onPress: aoTocar }, h(require('react-native').Text, null, rotulo));
const passa = ({ children }: { children?: unknown }) => h(require('react-native').View, null, children);
jest.mock('../../ui/Botao', () => ({ Botao: Toque }));
jest.mock('../../ui/IconeBotao', () => ({ IconeBotao: Toque }));
jest.mock('../FolhaDeAcoes', () => ({
  FolhaDeAcoes: ({ acoes }: { acoes: (false | { rotulo: string; aoTocar: () => void })[] }) =>
    h(require('react-native').View, null, ...acoes.filter(Boolean).map((a) => a && h(Toque, { key: a.rotulo, rotulo: a.rotulo, aoTocar: a.aoTocar }))),
}));
jest.mock('../../ui/PainelConfirmacao', () => ({
  PainelConfirmacao: ({ visivel, rotuloConfirmar, aoConfirmar, children }: { visivel: boolean; rotuloConfirmar: string; aoConfirmar: () => void; children?: unknown }) =>
    (visivel ? h(require('react-native').View, null, h(Toque, { rotulo: rotuloConfirmar, aoTocar: aoConfirmar }), children) : null),
}));
jest.mock('../../ui/Folha', () => ({ Folha: ({ children, rodape }: { children?: unknown; rodape?: unknown }) => h(require('react-native').View, null, children, rodape) }));
jest.mock('../../ui/Campo', () => ({ Campo: () => null }));
jest.mock('../../ui/Divisor', () => ({ Divisor: () => null }));
jest.mock('../../ui/LinhaDeAcoes', () => ({ LinhaDeAcoes: passa }));
jest.mock('../../ui/Estados', () => ({
  Alerta: ({ texto }: { texto: string }) => h(require('react-native').Text, null, texto),
  MensagemErro: ({ texto }: { texto: string }) => h(require('react-native').Text, null, texto),
}));
jest.mock('../../ui/Texto', () => ({ Texto: ({ children }: { children?: unknown }) => h(require('react-native').Text, null, children) }));
jest.mock('./FolhaDoLote', () => ({ MarcaDoResultado: () => null }));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const { Text } = require('react-native') as typeof import('react-native');
const mockRotas = require('../../api/rotas') as Record<'cancelarCobrancasEmLote' | 'gerarLinksEmLote' | 'exportarCobrancasSelecionadas', jest.Mock>;

const cobranca = (n: number): CobrancaResponse => ({
  id: `c-${n}`, versao: 2, alunoId: `a-${n}`, alunoNome: `Aluno Teste ${n}`, valorCentavos: 15_000, vencimento: '2026-10-05',
  competencia: '2026-10-05', situacao: 'ABERTA', vencida: true, diasDeAtraso: 3, tipo: 'MENSALIDADE',
} as CobrancaResponse);
const LOTE = [cobranca(1), cobranca(2)];

function montar(elemento: unknown) {
  let raiz!: import('react-test-renderer').ReactTestRenderer;
  Renderer.act(() => { raiz = Renderer.create(elemento as never); });
  const tocar = (rotulo: string) => raiz.root.find((x) => x.props.accessibilityLabel === rotulo && typeof x.props.onPress === 'function').props.onPress as () => void;
  const textos = () => raiz.root.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join(' | ');
  return { raiz, tocar, textos };
}

const nunca = () => new Promise<never>(() => undefined);

beforeEach(() => {
  jest.clearAllMocks();
  mockRotas.cancelarCobrancasEmLote.mockImplementation(nunca);
  mockRotas.gerarLinksEmLote.mockImplementation(nunca);
  mockRotas.exportarCobrancasSelecionadas.mockImplementation(nunca);
});

describe('AcoesDoLote: toque duplo antes de redesenhar manda um pedido só', () => {
  const abrir = () => {
    const t = montar(<AcoesDoLote lote={LOTE} comLink aoCancelar={jest.fn()} aoResultado={jest.fn()} />);
    Renderer.act(() => t.tocar('Mais ações')());
    return t;
  };

  it('gerar links', () => {
    const { tocar } = abrir();
    const gerar = tocar('Gerar links de pagamento');
    Renderer.act(() => { gerar(); gerar(); });
    expect(mockRotas.gerarLinksEmLote).toHaveBeenCalledTimes(1);
  });

  it('exportar', () => {
    const { tocar } = abrir();
    const exportar = tocar('Exportar selecionadas');
    Renderer.act(() => { exportar(); exportar(); });
    expect(mockRotas.exportarCobrancasSelecionadas).toHaveBeenCalledTimes(1);
  });

  it('cancelar (na confirmação)', () => {
    const { tocar } = abrir();
    Renderer.act(() => tocar('Cancelar cobranças')());
    const confirmar = tocar('Cancelar 2 cobranças');
    Renderer.act(() => { confirmar(); confirmar(); });
    expect(mockRotas.cancelarCobrancasEmLote).toHaveBeenCalledTimes(1);
  });

  it('depois da resposta a trava solta: dá para gerar de novo', async () => {
    mockRotas.gerarLinksEmLote.mockResolvedValue({ resultados: [] });
    const { tocar } = abrir();
    await Renderer.act(async () => { tocar('Gerar links de pagamento')(); });
    await Renderer.act(async () => { tocar('Gerar links de pagamento')(); });
    expect(mockRotas.gerarLinksEmLote).toHaveBeenCalledTimes(2);
  });
});

describe('FolhaDoResultadoDaAcao', () => {
  const LINK = 'https://pagamento.exemplo.invalid/abc';
  const parcial = resumoDaAcaoEmLote('LINK', ['c-1', 'c-2'], [
    { cobrancaId: 'c-1', ok: true, codigo: null, url: `${LINK}-1` },
    { cobrancaId: 'c-2', ok: false, codigo: 'PROVEDOR_INDISPONIVEL' },
  ]);

  it.each([
    ['resolve false (web)', () => Promise.resolve(false)],
    ['rejeita (celular)', () => Promise.reject(new Error('negado'))],
  ])('cópia recusada que %s: nunca "copiado", manda copiar à mão o link que está na tela', async (_nome, resposta) => {
    mockCopiar.mockImplementation(resposta);
    const { tocar } = montar(<FolhaDoResultadoDaAcao acao="LINK" resumo={parcial} enviadas={LOTE} aoFechar={jest.fn()} />);
    await Renderer.act(async () => { tocar('Copiar link de Aluno Teste 1')(); });
    expect(mockAvisar).toHaveBeenCalledTimes(1);
    expect(mockAvisar).toHaveBeenCalledWith('Não foi possível copiar sozinho. Selecione o link na lista e copie à mão.', 'neutro');
  });

  it('cópia aceita: "Link copiado."', async () => {
    mockCopiar.mockResolvedValue(true);
    const { tocar } = montar(<FolhaDoResultadoDaAcao acao="LINK" resumo={parcial} enviadas={LOTE} aoFechar={jest.fn()} />);
    await Renderer.act(async () => { tocar('Copiar link de Aluno Teste 1')(); });
    expect(mockAvisar).toHaveBeenCalledWith('Link copiado.', 'sucesso');
  });

  it('"Tentar de novo" reenvia só a que falhou e junta o resultado ao que já tinha dado certo', async () => {
    mockRotas.gerarLinksEmLote.mockResolvedValue({ resultados: [{ cobrancaId: 'c-2', ok: true, codigo: null, url: `${LINK}-2` }] });
    const { tocar, textos } = montar(<FolhaDoResultadoDaAcao acao="LINK" resumo={parcial} enviadas={LOTE} aoFechar={jest.fn()} />);
    expect(textos()).toContain('1 de 2 links gerados.');
    const deNovo = tocar('Tentar de novo a que falhou');
    await Renderer.act(async () => { deNovo(); deNovo(); });
    expect(mockRotas.gerarLinksEmLote).toHaveBeenCalledTimes(1);
    expect(mockRotas.gerarLinksEmLote).toHaveBeenCalledWith({ cobrancaIds: ['c-2'] });
    expect(textos()).toContain('2 links gerados.');
    expect(textos()).toContain(`${LINK}-1`);
    expect(textos()).toContain(`${LINK}-2`);
    expect(textos()).not.toContain('Tentar de novo');
  });

  it('falha que outra tentativa não muda (não está mais em aberto) não oferece "Tentar de novo"', () => {
    const definitiva = resumoDaAcaoEmLote('LINK', ['c-1'], [{ cobrancaId: 'c-1', ok: false, codigo: 'COBRANCA_NAO_ABERTA' }]);
    const { textos } = montar(<FolhaDoResultadoDaAcao acao="LINK" resumo={definitiva} enviadas={LOTE} aoFechar={jest.fn()} />);
    expect(textos()).not.toContain('Tentar de novo');
  });
});
