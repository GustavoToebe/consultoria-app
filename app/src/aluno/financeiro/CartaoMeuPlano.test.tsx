/* eslint-disable @typescript-eslint/no-require-imports */
import type { CobrancaDoAluno, FinanceiroDoAluno } from '../../api/financeiroTipos';
import { TEXTO_COMBINE_COM_O_TREINADOR } from '../../dominio/financeiro';
import { CartaoMeuPlano } from './CartaoMeuPlano';
import { FinanceiroDoAlunoProvider } from './FinanceiroDoAlunoProvider';

/**
 * D7 na tela do aluno (o e2e só roda a web): no celular com a chave da loja desligada, nenhuma ação de pagamento (nem Pix) e
 * nenhuma frase de pagamento; ligada, as ações das formas que se aplicam; só Manual, o "combine com o seu treinador".
 */
let mockDados: FinanceiroDoAluno;
let mockChaves = { pagarNoIos: false, pagarNoAndroid: false };
jest.mock('../../api/rotas', () => ({
  financeiroDoAluno: () => Promise.resolve(mockDados),
  linkDePagamentoDoAluno: jest.fn(),
  codigoPixDoAluno: jest.fn(),
}));
jest.mock('../../sessao/SessaoProvider', () => ({
  useSessao: () => ({ pagamentosHabilitados: true, usuario: { id: 'aluno-teste' }, ...mockChaves }),
}));
jest.mock('../../offline/AlunoProvider', () => ({ useAluno: () => ({ online: true }) }));
jest.mock('expo-router', () => ({ useFocusEffect: () => undefined }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('./InterruptorDeLembretes', () => ({ InterruptorDeLembretes: () => null }));
jest.mock('./FolhaCheckoutTransparente', () => ({ FolhaCheckoutTransparente: () => null }));
jest.mock('../../ui/abrirPagamento', () => ({ abrirPagamento: jest.fn() }));
jest.mock('../../ui/Aviso', () => ({ useAviso: () => ({ avisar: jest.fn() }) }));
jest.mock('../../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../../tema/tokens').ESCURO, fatorTexto: 1 }),
}));
jest.mock('../../ui/Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));
jest.mock('../../ui/Botao', () => ({
  Botao: ({ rotulo }: { rotulo: string }) => require('react').createElement(require('react-native').Text, null, `[${rotulo}]`),
}));
const passa = ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').View, null, children);
jest.mock('../conta/SecaoDaConta', () => ({ BlocoDaConta: passa }));
jest.mock('../../ui/LinhaDeAcoes', () => ({ LinhaDeAcoes: passa }));
jest.mock('../../ui/CamposEmLinha', () => ({ CamposEmLinha: passa }));
jest.mock('../../ui/CampoLeitura', () => ({ CampoLeitura: () => null }));
jest.mock('../../ui/Selo', () => ({ Selo: () => null }));
jest.mock('../../ui/Esqueleto', () => ({ Esqueleto: () => null }));
jest.mock('../../ui/Estados', () => ({ MensagemErro: ({ texto }: { texto: string }) => require('react').createElement(require('react-native').Text, null, texto) }));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const { Platform, Text } = require('react-native') as typeof import('react-native');

// Datas e valores fictícios; a mensalidade vence no futuro (o "vencida" vem da API).
const MENSALIDADE: CobrancaDoAluno = {
  id: 'c-1', competencia: '2026-11-05', vencimento: '2026-11-05', valorCentavos: 15_000, situacao: 'ABERTA', vencida: false,
  forma: null, pagoEm: null, tipo: 'MENSALIDADE', descricao: null,
};
const AVULSA: CobrancaDoAluno = { ...MENSALIDADE, id: 'c-2', competencia: null, tipo: 'AVULSA', descricao: 'Avaliação extra' };

const financeiro = (extra: Partial<FinanceiroDoAluno> = {}): FinanceiroDoAluno => ({
  plano: {
    contratacaoId: 'k-1', planoNome: 'Consultoria mensal', valorCentavos: 15_000, periodicidade: 'MENSAL', situacao: 'ATIVA',
    proximoVencimento: '2026-11-05', linkDePagamento: 'https://pagamento.exemplo.invalid/plano',
  },
  abertas: [MENSALIDADE], historico: [], pagamentoOnline: true, formasDePagamento: ['INFINITEPAY', 'LINK_PROPRIO', 'PIX', 'MANUAL'], ...extra,
});

async function textos(os: 'android' | 'ios' | 'web'): Promise<string> {
  jest.replaceProperty(Platform, 'OS', os);
  let raiz!: import('react-test-renderer').ReactTestRenderer;
  await Renderer.act(async () => {
    raiz = Renderer.create(<FinanceiroDoAlunoProvider><CartaoMeuPlano /></FinanceiroDoAlunoProvider>);
  });
  await Renderer.act(async () => { await Promise.resolve(); });
  const tudo = raiz.root.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join(' | ');
  Renderer.act(() => raiz.unmount());
  return tudo;
}

afterEach(() => {
  mockChaves = { pagarNoIos: false, pagarNoAndroid: false };
  jest.restoreAllMocks();
});

describe('CartaoMeuPlano: ações de pagamento por plataforma (D7)', () => {
  it.each(['android', 'ios'] as const)('%s com a chave da loja desligada: nenhuma ação e nenhuma frase de pagamento, só a informação', async (os) => {
    mockDados = financeiro();
    const t = await textos(os);
    expect(t).not.toMatch(/\[Pagar|\[Copiar código Pix/);
    expect(t).not.toContain(TEXTO_COMBINE_COM_O_TREINADOR);
    expect(t).toMatch(/Mensalidade de R\$\s?150,00, vence em 05\/11/);
  });

  it('android com a chave ligada: as três ações, com os dois "Pagar" nomeados', async () => {
    mockDados = financeiro();
    mockChaves = { pagarNoIos: false, pagarNoAndroid: true };
    const t = await textos('android');
    expect(t).toContain('[Pagar pela InfinitePay]');
    expect(t).toContain('[Pagar pelo link do treinador]');
    expect(t).toContain('[Copiar código Pix]');
  });

  it('a chave do outro sistema não libera: iOS com só a do Android ligada fica sem ação', async () => {
    mockDados = financeiro();
    mockChaves = { pagarNoIos: false, pagarNoAndroid: true };
    expect(await textos('ios')).not.toMatch(/\[Pagar|\[Copiar/);
  });

  it('web com só o Manual: nenhuma ação e o "combine com o seu treinador"', async () => {
    mockDados = financeiro({ pagamentoOnline: false, formasDePagamento: ['MANUAL'] });
    const t = await textos('web');
    expect(t).not.toMatch(/\[Pagar|\[Copiar/);
    expect(t).toContain(TEXTO_COMBINE_COM_O_TREINADOR);
  });

  it('web, cobrança avulsa: o link do plano não vale (só mensalidade); o Pix e a InfinitePay valem, com um "Pagar" só', async () => {
    mockDados = financeiro({ abertas: [AVULSA] });
    const t = await textos('web');
    expect(t).toContain('[Pagar]');
    expect(t).toContain('[Copiar código Pix]');
    expect(t).not.toContain('link do treinador');
  });

  it('web, mensalidade e avulsa no mesmo cartão: a InfinitePay tem o mesmo nome nas duas, nunca "Pagar" numa e o nome na outra', async () => {
    mockDados = financeiro({ abertas: [MENSALIDADE, AVULSA] });
    const t = await textos('web');
    expect(t.match(/\[Pagar pela InfinitePay\]/g)).toHaveLength(2);
    expect(t).not.toContain('[Pagar]');
    expect(t.match(/\[Pagar pelo link do treinador\]/g)).toHaveLength(1);
  });
});

describe('CartaoMeuPlano: mensalidade cobrada pela Kiwify (D18)', () => {
  const KIWIFY: CobrancaDoAluno = { ...MENSALIDADE, id: 'c-3', cobrancaAutomatica: 'KIWIFY' };

  it.each([
    ['android', { pagarNoIos: false, pagarNoAndroid: true }],
    ['ios', { pagarNoIos: true, pagarNoAndroid: false }],
    ['web', { pagarNoIos: false, pagarNoAndroid: false }],
  ] as const)('%s (chaves %o): só "Cobrança automática pela Kiwify", sem ação, forma nem frase de pagamento', async (os, chaves) => {
    mockDados = financeiro({ abertas: [KIWIFY] });
    mockChaves = { ...chaves };
    const t = await textos(os);
    expect(t).toContain('Cobrança automática pela Kiwify');
    expect(t).not.toMatch(/\[Pagar|\[Copiar código Pix/);
    expect(t).not.toContain(TEXTO_COMBINE_COM_O_TREINADOR);
    expect(t).not.toMatch(/Mensalidade de R\$/);
  });

  it.each([
    ['android', { pagarNoIos: true, pagarNoAndroid: false }],
    ['ios', { pagarNoIos: false, pagarNoAndroid: true }],
    ['ios', { pagarNoIos: false, pagarNoAndroid: false }],
  ] as const)('D16, %s (chaves %o): celular com a chave desligada só informa a cobrança, sem Kiwify nem forma de pagamento', async (os, chaves) => {
    mockDados = financeiro({ abertas: [KIWIFY, { ...KIWIFY, id: 'c-4', situacao: 'PAGA', pagoEm: '2026-10-19', forma: 'KIWIFY' }] });
    mockChaves = { ...chaves };
    const t = await textos(os);
    expect(t).not.toMatch(/Kiwify|automática/i);
    expect(t).not.toMatch(/\[Pagar|\[Copiar código Pix/);
    expect(t).not.toContain(TEXTO_COMBINE_COM_O_TREINADOR);
    expect(t).toMatch(/Mensalidade de R\$ .*, vence em/);
    expect(t).toContain('Paga em 19/10');
  });

  it('web, Kiwify ao lado de uma avulsa: a avulsa mantém as ações dela e a Kiwify continua sem nenhuma', async () => {
    mockDados = financeiro({ abertas: [KIWIFY, AVULSA] });
    const t = await textos('web');
    expect(t.match(/\[Pagar\]/g)).toHaveLength(1);
    expect(t.match(/\[Copiar código Pix\]/g)).toHaveLength(1);
    expect(t).toContain('Cobrança automática pela Kiwify');
  });
});

describe('CartaoMeuPlano: Overtraining Pay (checkout transparente no app)', () => {
  it('web com Overtraining Pay disponível: mostra "Pagar agora" para abrir checkout no app', async () => {
    mockDados = {
      ...financeiro({ pagamentoOnline: false, formasDePagamento: ['MANUAL'] }),
      overtrainingPayDisponivel: true,
      overtrainingPayMaxParcelas: 12,
      overtrainingPayJuros: 'ALUNO',
      cpfPagadorCadastrado: false,
    } as FinanceiroDoAluno;
    const t = await textos('web');
    expect(t).toContain('[Pagar agora]');
    expect(t).not.toContain(TEXTO_COMBINE_COM_O_TREINADOR);
  });

  it('celular com chave desligada: mesmo com Overtraining Pay disponível, não exibe botão de pagamento', async () => {
    mockDados = {
      ...financeiro({ pagamentoOnline: false, formasDePagamento: ['MANUAL'] }),
      overtrainingPayDisponivel: true,
    } as FinanceiroDoAluno;
    const t = await textos('ios');
    expect(t).not.toMatch(/\[Pagar/);
  });
});
