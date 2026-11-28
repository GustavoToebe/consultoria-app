/* eslint-disable @typescript-eslint/no-require-imports */
import { exercicio, sessao } from '../../dominio/exemplosDeTreino.apoioTeste';
import { SeletorDeSessoes } from './SeletorDeSessoes';

/**
 * Abas das Sessões (SERIE-ABERTA 0.3): dia curto + nome + contagem; o descanso sem contagem; a ativa marcada para o
 * leitor de tela; "precisa corrigir" no nome acessível da sessão com erro; "+ Sessão" no fim.
 */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../../tema/tokens').ESCURO, fatorTexto: 1 }),
}));
jest.mock('../../ui/Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));
jest.mock('../../ui/FaixaDeChips', () => ({
  FaixaDeChips: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').View, null, children),
}));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
type Raiz = import('react-test-renderer').ReactTestRenderer;
type No = import('react-test-renderer').ReactTestInstance;

// A contagem é número: entra como texto.
const textosDe = (no: No) => no.findAll((x) => typeof x.type === 'string' && ['string', 'number'].includes(typeof x.props.children)).map((x) => String(x.props.children));
const tocaveis = (raiz: Raiz) => raiz.root.findAll((x) => typeof x.type !== 'string' && typeof x.props.onPress === 'function' && x.parent?.props.onPress !== x.props.onPress);
const abas = (raiz: Raiz) => tocaveis(raiz).filter((x) => x.props.accessibilityRole === 'tab');

const exercicios = (n: number) => Array.from({ length: n }, (_, i) => exercicio(`e${i}`));
const SESSOES = [
  sessao('seg', exercicios(7), [], { nome: 'Full Body 1', diaSemana: 1 }),
  sessao('qua', [], [], { nome: 'Quarta', diaSemana: 3, tipo: 'DESCANSO' }),
  sessao('livre', exercicios(1), [], { nome: 'Extra', diaSemana: null }),
];

function montar(props: Partial<Parameters<typeof SeletorDeSessoes>[0]> = {}) {
  let raiz!: Raiz;
  Renderer.act(() => {
    raiz = Renderer.create(
      <SeletorDeSessoes sessoes={SESSOES} selecionada="seg" comProblema={new Set()} aoSelecionar={() => undefined} aoAdicionar={() => undefined} {...props} />,
    );
  });
  return raiz;
}

describe('SeletorDeSessoes', () => {
  it('aba de treino: dia curto, nome e quantos exercícios; a ativa vai como selecionada', () => {
    const [seg] = abas(montar());
    expect(textosDe(seg)).toEqual(['Seg', 'Full Body 1', '7']);
    expect(seg.props['aria-selected']).toBe(true);
    expect(seg.props.accessibilityLabel).toBe('Seg · Full Body 1, 7 exercícios');
  });

  it('descanso: o tipo no lugar do nome padrão e sem a contagem', () => {
    const [, qua] = abas(montar());
    expect(textosDe(qua)).toEqual(['Qua', 'Descanso']);
    expect(qua.props['aria-selected']).toBe(false);
  });

  it('sem dia fixo: só o nome e a contagem', () => {
    expect(textosDe(abas(montar())[2])).toEqual(['Extra', '1']);
  });

  it('sessão com erro: "precisa corrigir" no nome acessível', () => {
    const [seg, qua] = abas(montar({ comProblema: new Set(['seg']) }));
    expect(seg.props.accessibilityLabel).toMatch(/, precisa corrigir$/);
    expect(qua.props.accessibilityLabel).not.toMatch(/precisa corrigir/);
  });

  it('tocar escolhe a sessão; "+ Sessão" adiciona', () => {
    const aoSelecionar = jest.fn();
    const aoAdicionar = jest.fn();
    const raiz = montar({ aoSelecionar, aoAdicionar });
    Renderer.act(() => abas(raiz)[1].props.onPress());
    expect(aoSelecionar).toHaveBeenCalledWith('qua');
    Renderer.act(() => raiz.root.findByProps({ accessibilityLabel: 'Adicionar sessão' }).props.onPress());
    expect(aoAdicionar).toHaveBeenCalled();
  });
});
