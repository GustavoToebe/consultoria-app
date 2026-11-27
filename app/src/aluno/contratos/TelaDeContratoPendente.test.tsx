/* eslint-disable @typescript-eslint/no-require-imports */
import type { ContratoDoAlunoResumo } from '../../api/contratos';
import { TelaDeContratoPendente } from './TelaDeContratoPendente';

/**
 * Tela de bloqueio do contrato (D3, D8, D21): as variantes pelos contratos da lista, a frase da pausa e a conferência do
 * perfil quando a lista não tem vencido. O e2e (`e2e/contrato-trava.spec.ts`) vê a tela de verdade.
 */
let mockContratos: { contratos: ContratoDoAlunoResumo[] | undefined; erro: unknown; recarregar: jest.Mock };
let mockSessao: { acessoPausado: boolean; contratoPendenteVencido: boolean; recarregarPerfil: jest.Mock };
let mockOnline = true;
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (h: string) => mockPush(h) } }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../../sessao/SessaoProvider', () => ({ useSessao: () => mockSessao }));
jest.mock('../../offline/AlunoProvider', () => ({ useAluno: () => ({ online: mockOnline, tentarDeNovo: () => Promise.resolve() }) }));
jest.mock('./ContratosDoAlunoProvider', () => ({ useContratosDoAluno: () => mockContratos }));
jest.mock('../useAvisoAoSair', () => ({ useAvisoAoSair: () => null }));
const texto = (t: string) => require('react').createElement(require('react-native').Text, null, t);
const passa = ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').View, null, children);
jest.mock('../../ui/Texto', () => ({ Texto: ({ children }: { children?: string }) => texto(children ?? '') }));
jest.mock('../../ui/Botao', () => ({
  Botao: ({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) =>
    require('react').createElement(require('react-native').Pressable, { onPress: aoTocar, accessibilityLabel: rotulo }, texto(`[${rotulo}]`)),
}));
jest.mock('../../ui/Tela', () => ({ Tela: passa }));
jest.mock('../../ui/LinhaDeAcoes', () => ({ LinhaDeAcoes: passa }));
jest.mock('../../ui/ConfirmarSaida', () => ({ ConfirmarSaida: () => null }));
jest.mock('../../ui/Esqueleto', () => ({ Esqueleto: () => texto('carregando') }));
jest.mock('../../ui/Estados', () => ({
  Alerta: ({ texto: t }: { texto: string }) => texto(t),
  MensagemErro: ({ texto: t }: { texto: string }) => texto(t),
  Vazio: ({ titulo }: { titulo: string }) => texto(titulo),
}));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const { Text } = require('react-native') as typeof import('react-native');

const contrato = (id: string, p: Partial<ContratoDoAlunoResumo> = {}): ContratoDoAlunoResumo => ({
  id, titulo: 'Prestação de serviço', origem: 'MODELO', signatario: 'ALUNO', situacao: 'PENDENTE', prazoAte: '2026-11-20T02:59:59Z',
  vencido: true, geradoEm: '2026-11-10T12:00:00Z', assinadoEm: null, ...p,
});

function renderizar() {
  let r!: import('react-test-renderer').ReactTestRenderer;
  Renderer.act(() => { r = Renderer.create(<TelaDeContratoPendente />); });
  const textos = r.root.findAllByType(Text).map((t) => String(t.props.children));
  return { r, textos };
}

beforeEach(() => {
  mockOnline = true;
  mockPush.mockClear();
  mockSessao = { acessoPausado: false, contratoPendenteVencido: true, recarregarPerfil: jest.fn(() => Promise.resolve()) };
  mockContratos = { contratos: [contrato('k1')], erro: undefined, recarregar: jest.fn() };
});

it('com contrato vencido do aluno: título, texto e o botão leva à assinatura dele', () => {
  const { r, textos } = renderizar();
  expect(textos).toContain('Assine o contrato para continuar');
  expect(textos).toContain('O prazo para assinar o contrato terminou. Assine para voltar a usar o app.');
  const [botao] = r.root.findAll((n) => n.props.accessibilityLabel === 'Assinar contrato' && typeof n.props.onPress === 'function');
  Renderer.act(() => botao.props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/aluno/contrato/k1');
  expect(textos).not.toContain('Seu acesso também está pausado por pagamento em atraso. Depois de assinar, você vê os detalhes.');
});

it('só o do responsável vencido: aguardando, sem botão de assinar (D8)', () => {
  mockContratos.contratos = [contrato('r1', { signatario: 'RESPONSAVEL' })];
  const { textos } = renderizar();
  expect(textos).toContain('Aguardando a assinatura do responsável');
  expect(textos).not.toContain('[Assinar contrato]');
  expect(textos).toContain('[Sair]');
});

it('com a pausa por atraso junto: a frase da pausa embaixo (D21)', () => {
  mockSessao.acessoPausado = true;
  expect(renderizar().textos).toContain('Seu acesso também está pausado por pagamento em atraso. Depois de assinar, você vê os detalhes.');
});

it('sem internet e sem lista: "Sem internet"', () => {
  mockOnline = false;
  mockContratos.contratos = undefined;
  expect(renderizar().textos).toContain('Sem internet');
});

it('lista sem vencido: recarrega o perfil uma vez (a marca está velha)', () => {
  mockContratos.contratos = [contrato('k1', { situacao: 'ASSINADO', vencido: false, assinadoEm: '2026-11-21T12:00:00Z' })];
  const { r, textos } = renderizar();
  expect(mockSessao.recarregarPerfil).toHaveBeenCalledTimes(1);
  expect(textos).toContain('Não encontramos o contrato para assinar. Tente de novo em instantes.');
  Renderer.act(() => r.update(<TelaDeContratoPendente />));
  expect(mockSessao.recarregarPerfil).toHaveBeenCalledTimes(1);
});
