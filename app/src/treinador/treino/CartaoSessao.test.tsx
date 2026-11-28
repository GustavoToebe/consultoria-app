/* eslint-disable @typescript-eslint/no-require-imports */
import type { Sessao } from '../../api/tipos';
import { exercicio, sessao } from '../../dominio/exemplosDeTreino.apoioTeste';
import { CartaoSessao } from './CartaoSessao';

/**
 * Cabeçalho da sessão (SERIE-ABERTA 0.4): nome e "Segunda · Treino · 7 exercícios · 23 séries · 16 de trabalho"; as ações
 * juntas ("Editar sessão", ← →, ⋯, "Excluir sessão"); "Editar sessão" abre e fecha os dados logo abaixo da faixa.
 */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../../tema/tokens').ESCURO, bordas: { bloco: 2, item: 2 }, marca: '#E11D48', fatorTexto: 1 }),
}));
jest.mock('../../ui/Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));
jest.mock('../../ui/Selo', () => ({
  Selo: ({ texto }: { texto: string }) => require('react').createElement(require('react-native').Text, null, texto),
}));
const toque = ({ rotuloAcessivel, rotulo, aoTocar }: { rotuloAcessivel?: string; rotulo: string; aoTocar: () => void }) =>
  require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotuloAcessivel ?? rotulo, onPress: aoTocar });
jest.mock('../../ui/Botao', () => ({ Botao: toque }));
jest.mock('../../ui/IconeBotao', () => ({ IconeBotao: toque }));
const campoFalso = ({ rotulo }: { rotulo: string }) => require('react').createElement(require('react-native').View, { accessibilityLabel: `campo ${rotulo}` });
jest.mock('../../ui/Campo', () => ({ Campo: campoFalso }));
jest.mock('../../ui/Campos', () => ({ CampoNumerico: campoFalso }));
jest.mock('../../ui/EscolhaEmFolha', () => ({ EscolhaEmFolha: campoFalso }));
jest.mock('../FolhaDeAcoes', () => ({ FolhaDeAcoes: () => null }));
jest.mock('../plano/BlocoAdicionar', () => ({ BlocoAdicionar: () => null, BotaoDoBloco: () => null }));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const RN = require('react-native') as typeof import('react-native');
type Raiz = import('react-test-renderer').ReactTestRenderer;

// PC: as ações ficam ao lado do título.
jest.spyOn(RN, 'useWindowDimensions').mockImplementation(() => ({ width: 1280, height: 900, scale: 1, fontScale: 1 }));

const textos = (raiz: Raiz) => raiz.root.findAll((x) => typeof x.type === 'string' && typeof x.props.children === 'string').map((x) => x.props.children as string);
const tocaveis = (raiz: Raiz) => raiz.root.findAll((x) => typeof x.type !== 'string' && typeof x.props.onPress === 'function' && x.parent?.props.onPress !== x.props.onPress);
const rotulos = (raiz: Raiz) => tocaveis(raiz).map((x) => x.props.accessibilityLabel as string);
const camposAbertos = (raiz: Raiz) => raiz.root.findAll((x) => x.props.accessibilityLabel === 'campo Nome da sessão' && typeof x.type === 'string').length > 0;
const editar = (raiz: Raiz) => tocaveis(raiz).filter((x) => /^Editar sessão/.test(x.props.accessibilityLabel ?? ''))[0];

const FULL_BODY = sessao('a', [exercicio('e1')], [], { nome: 'Full Body 1', diaSemana: 1 });

function montar(s: Sessao = FULL_BODY, props: Partial<Parameters<typeof CartaoSessao>[0]> = {}) {
  let raiz!: Raiz;
  Renderer.act(() => {
    raiz = Renderer.create(
      <CartaoSessao sessao={s} posicao={0} total={3} comProblema={false} aoMudar={() => undefined} aoMover={() => undefined}
        aoRemover={() => undefined} aoSalvarModelo={() => undefined} aoNovoExercicio={() => undefined} aoNovoCardio={() => undefined} {...props}>
        <RN.Text>exercícios</RN.Text>
      </CartaoSessao>,
    );
  });
  return raiz;
}

describe('CartaoSessao', () => {
  it('cabeçalho: o nome e, embaixo, dia · tipo com os totais da sessão', () => {
    const t = textos(montar(FULL_BODY, { totais: { exercicios: 7, series: 23, seriesDeTrabalho: 16 } }));
    expect(t).toContain('Full Body 1');
    expect(t).toContain('Segunda · Treino · 7 exercícios · 23 séries · 16 de trabalho');
  });

  it('sem os totais, só dia e tipo ("Sem dia fixo" sem dia)', () => {
    expect(textos(montar())).toContain('Segunda · Treino');
    expect(textos(montar(sessao('b', [], [], { nome: 'Extra' })))).toContain('Sem dia fixo · Treino');
  });

  it('ações juntas na ordem: Editar sessão, ← →, ⋯ e Excluir sessão', () => {
    expect(rotulos(montar())).toEqual([
      'Editar sessão', 'Mover sessão para antes', 'Mover sessão para depois', 'Mais ações da sessão Full Body 1', 'Excluir sessão: Full Body 1',
    ]);
  });

  it('modelo de sessão única: sem ← → nem Excluir, mas com Editar sessão', () => {
    expect(rotulos(montar(FULL_BODY, { total: 1, removivel: false, aoSalvarModelo: undefined }))).toEqual(['Editar sessão']);
  });

  it('"Editar sessão" abre e fecha os dados, com o estado de aberto para o leitor de tela', () => {
    const raiz = montar();
    expect(camposAbertos(raiz)).toBe(false);
    expect(editar(raiz).props['aria-expanded']).toBe(false);
    Renderer.act(() => editar(raiz).props.onPress());
    expect(camposAbertos(raiz)).toBe(true);
    expect(editar(raiz).props['aria-expanded']).toBe(true);
    Renderer.act(() => editar(raiz).props.onPress());
    expect(camposAbertos(raiz)).toBe(false);
  });

  it('sessão sem nome nasce com os dados abertos; com observação, o nome acessível avisa', () => {
    expect(camposAbertos(montar(sessao('c', [], [], { nome: '' })))).toBe(true);
    const comObs = montar(sessao('d', [], [], { nome: 'Costas', observacao: 'Foco na postura' }));
    expect(editar(comObs).props.accessibilityLabel).toBe('Editar sessão (com observação)');
    expect(textos(comObs)).toContain('Editar sessão');
  });
});
