/* eslint-disable @typescript-eslint/no-require-imports */
import type { ResumoDaSessaoPorContagem } from '../../dominio/inspetorDoTreino';
import type { PontoParaRevisar } from '../../dominio/pontosParaRevisar';
import { ResumoDaSessao } from './ResumoDaSessao';

/** Resumo da sessão (SERIE-ABERTA 0.5): coluna fixa com tudo aberto; faixa compacta com o detalhe recolhido; pontos clicáveis. */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@rn-primitives/slot', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/label', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/portal', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('../../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../../tema/tokens').ESCURO, variante: 'escuro', identificacao: require('../../tema/tokens').coresDeIdentificacao(require('../../tema/tokens').ESCURO, 'escuro'), bordas: { bloco: 2, item: 2 }, fatorTexto: 1 }),
}));
jest.mock('../../ui/Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const RN = require('react-native') as typeof import('react-native');
type Raiz = import('react-test-renderer').ReactTestRenderer;

const RESUMO: ResumoDaSessaoPorContagem = {
  exercicios: 7, series: 23, seriesDeTrabalho: 16,
  porTipo: [{ codigo: 'AQUECIMENTO', nome: 'Aquecimento', quantidade: 4 }, { codigo: 'WORKING', nome: 'WS', quantidade: 16 }],
  porGrupoMuscular: [{ grupo: 'Peito', seriesDeTrabalho: 3 }, { grupo: 'Quadríceps', seriesDeTrabalho: 2 }],
};
const ponto = (b: number): PontoParaRevisar => ({
  sessaoUid: 's', sessaoIndice: 0, exercicioUid: 'e1', exercicioNome: 'Agachamento livre', serieUid: `x${b}`, bloco: b,
  texto: `Agachamento livre · Série ${b + 1} sem descanso`, caminho: `sessoes[0].exercicios[0].series[${b}].descansoSegundos`,
});

function montar(props: Partial<Parameters<typeof ResumoDaSessao>[0]> = {}) {
  let raiz!: Raiz;
  Renderer.act(() => { raiz = Renderer.create(<ResumoDaSessao resumo={RESUMO} {...props} />); });
  const textos = () => raiz.root.findAllByType(RN.Text).map((t) => String(t.props.children));
  return { raiz, textos };
}

describe('ResumoDaSessao', () => {
  it('coluna: totais, séries por tipo e por grupo à vista; sem pontos, sem a caixa âmbar', () => {
    const { textos } = montar();
    expect(textos()).toEqual(expect.arrayContaining(['7 exercícios · 23 séries · 16 de trabalho', 'Séries por tipo', 'Aquecimento', 'Séries de trabalho por grupo', 'Peito']));
    expect(textos().some((t) => t.includes('para revisar'))).toBe(false);
  });

  it('pontos para revisar: tocar abre a série do ponto; acima de 5, "e mais N"', () => {
    const aoAbrirPonto = jest.fn();
    const pontos = [0, 1, 2, 3, 4, 5, 6].map(ponto);
    const { raiz, textos } = montar({ pontos, aoAbrirPonto });
    expect(textos()).toEqual(expect.arrayContaining(['7 pontos para revisar', 'e mais 2']));
    const botoes = raiz.root.findAll((x) => x.props.accessibilityRole === 'button' && typeof x.props.onPress === 'function' && String(x.props.accessibilityLabel).startsWith('Abrir:'));
    expect(botoes.map((b) => b.props.accessibilityLabel)).toHaveLength(5);
    Renderer.act(() => botoes[1].props.onPress());
    expect(aoAbrirPonto).toHaveBeenCalledWith(pontos[1]);
  });

  it('compacto: pontos à vista, sem os totais (estão no cabeçalho da sessão), o detalhe por tipo e grupo recolhido', () => {
    const { raiz, textos } = montar({ compacto: true, pontos: [ponto(4)] });
    expect(textos()).toEqual(expect.arrayContaining(['1 ponto para revisar', 'Séries por tipo e por grupo', '4 Aquec., 16 WS']));
    expect(textos()).not.toContain('7 exercícios · 23 séries · 16 de trabalho');
    expect(textos()).not.toContain('Peito');
    const abrir = raiz.root.find((x) => x.props.accessibilityLabel === 'Séries por tipo e por grupo' && typeof x.props.onPress === 'function');
    Renderer.act(() => abrir.props.onPress());
    expect(textos()).toContain('Peito');
  });

  it('sessão sem exercício não mostra nada', () => {
    const { raiz } = montar({ resumo: { ...RESUMO, exercicios: 0 } });
    expect(raiz.toJSON()).toBeNull();
  });
});
