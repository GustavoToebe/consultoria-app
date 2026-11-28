import { CartaoDaSerie } from '../../aluno/CartaoDaSerie';
import type { Serie } from '../../api/tipos';
import type { GrupoDeSeries } from '../../dominio/agrupamento';
import { tecnicaVazia } from '../../dominio/editorTreino';
import { serie } from '../../dominio/exemplosDeTreino.apoioTeste';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
import { PreviaDaSerie } from './PreviaDaSerie';

/**
 * Prévia da série aberta no editor (SERIE-ABERTA, seção 4): as peças reais do aluno em modo prévia. Mesmo harness de mocks
 * do `aluno/ExercicioAluno.previa.test.tsx`.
 */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../../ui/useMovimentoReduzido', () => ({ useMovimentoReduzido: () => true }));
jest.mock('../../ui/vibrar', () => ({ vibrar: { leve: () => undefined, sucesso: () => undefined } }));
jest.mock('../../ui/Aviso', () => ({ useAviso: () => ({ avisar: () => undefined }) }));
jest.mock('@rn-primitives/label', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/switch', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/slot', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/portal', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/alert-dialog', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/tabs', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/toggle', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/toggle-group', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('../../ui/Botao', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Botao: ({ rotuloAcessivel, rotulo, aoTocar, desabilitado }: { rotuloAcessivel?: string; rotulo: string; aoTocar: () => void; desabilitado?: boolean }) => require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotuloAcessivel ?? rotulo, accessibilityRole: 'button', accessibilityState: { disabled: !!desabilitado }, disabled: !!desabilitado, onPress: aoTocar }),
}));
jest.mock('../../aluno/SeloComExplicacao', () => ({ SeloComExplicacao: () => null }));
jest.mock('../../aluno/TipoDaSerieComExplicacao', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  TipoDaSerieComExplicacao: ({ nome }: { nome: string }) => require('react').createElement(require('react-native').Text, null, nome),
}));
jest.mock('../../tema/TemaProvider', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useTema: () => ({ cores: require('../../tema/tokens').ESCURO, variante: 'escuro', identificacao: require('../../tema/tokens').coresDeIdentificacao(require('../../tema/tokens').ESCURO, 'escuro'), bordas: { bloco: 2, item: 2 }, marca: '#E11D48', sobreMarca: '#FFFFFF', fatorTexto: 1, preferencias: { animacoes: false } }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
type Arvore = import('react-test-renderer').ReactTestRenderer;

let proximo = 0;
const comRir = (rir: number, extra: Partial<Serie> = {}) => serie(`s${proximo++}`, { esforco: { rir, rpe: null }, descansoSegundos: 60, ...extra });

const montados: Arvore[] = [];
const fetchOriginal = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn();
});
afterEach(async () => {
  await Renderer.act(async () => {
    montados.splice(0).forEach((m) => m.unmount());
  });
  global.fetch = fetchOriginal;
});

async function montar(grupo: GrupoDeSeries, series: Serie[]) {
  let arvore!: Arvore;
  await Renderer.act(async () => {
    arvore = Renderer.create(<PreviaDaSerie grupo={grupo} series={series} config={CONFIGURACAO_PADRAO} />);
    montados.push(arvore);
  });
  // Só os nós de texto do host (Text), com os pedaços de um template juntados ("Descanso depois da série: 1 min").
  type No = import('react-test-renderer').ReactTestInstance;
  const textoDe = (n: No | string): string => (typeof n === 'string' ? n : n.children.map(textoDe).join(''));
  const dentroDeTexto = (n: No) => { for (let p = n.parent; p; p = p.parent) if (String(p.type) === 'Text') return true; return false; };
  const textos = () => arvore.root.findAll((n) => String(n.type) === 'Text' && !dentroDeTexto(n)).map(textoDe);
  const marcas = () => arvore.root.findAll((n) => n.props.accessibilityRole === 'checkbox' && typeof n.props.onPress === 'function');
  return { arvore, textos, marcas };
}

describe('PreviaDaSerie', () => {
  it('série simples: um cartão por prescrição, nome do grupo, ✓ desabilitado sem efeito, borda só na primeira e sem rede', async () => {
    const series = [comRir(2), comRir(2), comRir(1), comRir(0)];
    const t = await montar({ inicio: 0, series }, series);

    const grupo = t.arvore.root.find((n) => n.props.role === 'group' && n.props['aria-label'] === 'Prévia para o aluno');
    const cartoes = grupo.findAllByType(CartaoDaSerie);
    expect(cartoes.map((c) => c.props.ativa)).toEqual([true, false, false]);
    expect(cartoes.map((c) => c.props.testID)).toEqual([`serie-${series[0].uid}`, `serie-${series[2].uid}`, `serie-${series[3].uid}`]);

    for (const m of t.marcas()) {
      expect(m.props.accessibilityState).toMatchObject({ disabled: true });
      await Renderer.act(async () => m.props.onPress());
    }
    expect(t.marcas().length).toBe(3);
    expect(t.textos()).toEqual(expect.arrayContaining(['Prévia para o aluno', 'Digite a carga para marcar a série.', 'Descanso de 60 s depois da série']));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('a numeração e o "de N" são do exercício, num grupo que não é o primeiro', async () => {
    const antes = [serie('a'), serie('b')];
    const doGrupo = [comRir(2), comRir(1), comRir(0), comRir(0)];
    const series = [...antes, ...doGrupo];
    const t = await montar({ inicio: 2, series: doGrupo }, series);
    expect(t.arvore.root.findAllByType(CartaoDaSerie).map((c) => c.props.testID)).toEqual(doGrupo.slice(0, 3).map((s) => `serie-${s.uid}`));
    // A peça do aluno numera pelo índice do exercício: o primeiro cartão do grupo é a "Série 3".
    expect(t.arvore.root.findAll((n) => String(n.props.accessibilityLabel).startsWith('Marcar série 3 como feita')).length).toBeGreaterThan(0);
  });

  it('legenda com séries ocultas: "Mostrando ... de N" com N = séries do exercício', async () => {
    const antes = [serie('a'), serie('b')];
    const doGrupo = [comRir(4), comRir(3), comRir(2), comRir(1)];
    const series = [...antes, ...doGrupo];
    const t = await montar({ inicio: 2, series: doGrupo }, series);
    expect(t.textos()).toContain('Mostrando as séries 3, 4 e 5 de 6. A série 6 aparece com RIR 1.');
  });

  it('cluster: um cartão por série, como o aluno de hoje, e os blocos sem efeito', async () => {
    const series = [serie('c1', { descansoSegundos: 60, tecnica: { ...tecnicaVazia('CLUSTER'), blocos: [3, 3], pausaSegundos: 20 } })];
    const t = await montar({ inicio: 0, series }, series);
    expect(t.arvore.root.findAllByType(CartaoDaSerie)).toHaveLength(1);
    // O descanso aparece uma vez só, na legenda.
    expect(t.textos().filter((l) => /descanso/i.test(l))).toEqual(['Descanso de 60 s depois da série']);
    const alvos = [...t.marcas(), ...t.arvore.root.findAll((n) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function')]
      .filter((n) => /feito|feita|Não fiz|Concluir/.test(String(n.props.accessibilityLabel)));
    expect(alvos.length).toBeGreaterThanOrEqual(3);
    for (const a of alvos) {
      expect(a.props.accessibilityState).toMatchObject({ disabled: true });
      await Renderer.act(async () => a.props.onPress());
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
