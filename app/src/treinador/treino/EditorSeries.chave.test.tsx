/* eslint-disable @typescript-eslint/no-require-imports */
import type { Serie, Tecnica } from '../../api/tipos';
import { serie } from '../../dominio/exemplosDeTreino.apoioTeste';
import { EditorSeries } from './EditorSeries';

/**
 * Blindagem do + e − dos blocos do Cluster (S10): a série aberta não pode remontar quando o grupo dela muda de primeira
 * série. Caso real: Série 1 com 4×5 e Série 2 com 5×5, a 2ª aberta em "Blocos diferentes"; "Remover um bloco" deixa as
 * duas iguais, elas viram um grupo só e a primeira série do grupo passa a ser a 1ª. Com a chave do editor pela primeira
 * série do grupo (`g.series[0].uid`), o editor remontava: o campo dos blocos nascia de novo em "Blocos iguais" e os campos
 * B1…B4 sumiam. Vermelho conferido com essa chave antiga; verde com a chave pela série aberta. Pai de verdade, peças reais
 * do formulário; só a prévia do aluno e os seletores suspensos ficam de fora.
 */
jest.mock('../../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../../tema/tokens').ESCURO, bordas: { bloco: 2, item: 2 }, marca: '#E11D48', sobreMarca: '#FFFFFF', fatorTexto: 1, preferencias: { animacoes: false } }),
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@rn-primitives/label', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/switch', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/slot', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/portal', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/alert-dialog', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
// O painel da troca RIR · RPE (`CargaERirDaSerie`) fica fechado aqui; o overlay falso pediria o Reanimated.
jest.mock('../../ui/PainelConfirmacao', () => ({ PainelConfirmacao: () => null }));
jest.mock('@rn-primitives/tabs', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/toggle', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/toggle-group', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('../../ui/Calendario', () => ({ BotaoCalendario: () => null, Calendario: () => null }));
jest.mock('../../ui/Botao', () => ({
  Botao: ({ rotuloAcessivel, rotulo, aoTocar }: { rotuloAcessivel?: string; rotulo: string; aoTocar: () => void }) =>
    require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotuloAcessivel ?? rotulo, onPress: aoTocar }),
}));
jest.mock('../../ui/EscolhaSuspensa', () => ({ EscolhaSuspensa: () => null }));
jest.mock('../../ui/Escolha', () => ({
  Escolha: ({ descricao, opcoes, valor, aoMudar }: { descricao: string; opcoes: { valor: unknown; rotulo: string }[]; valor: unknown; aoMudar: (v: unknown) => void }) => {
    const { createElement } = require('react'); const { Pressable, View } = require('react-native');
    return createElement(View, null, ...opcoes.map((o) => createElement(Pressable, {
      key: String(o.valor), accessibilityLabel: `${descricao}: ${o.rotulo}`, accessibilityState: { selected: o.valor === valor }, onPress: () => aoMudar(o.valor),
    })));
  },
}));
jest.mock('../../ui/Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));
jest.mock('./PreviaDaSerie', () => ({ PreviaDaSerie: () => null }));
// A tabela só desenha as linhas (tocar abre) e o detalhe da aberta.
jest.mock('./TabelaDeBlocos', () => ({
  LARGURA_DAS_COLUNAS: 560,
  TabelaDeBlocos: ({ linhas, ativa, aoMudar, detalhe }: { linhas: { valor: string; rotulo: string }[]; ativa: string | null; aoMudar: (v: string | null) => void; detalhe?: unknown }) => {
    const { createElement } = require('react'); const { Pressable, View } = require('react-native');
    return createElement(View, null, ...linhas.map((l) => createElement(Pressable, { key: l.valor, accessibilityRole: 'tab', accessibilityLabel: l.rotulo, onPress: () => aoMudar(l.valor === ativa ? null : l.valor) })), createElement(View, { key: 'detalhe' }, detalhe));
  },
}));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const React = require('react') as typeof import('react');
type Raiz = import('react-test-renderer').ReactTestRenderer;

const cluster = (blocos: number[]): Partial<Serie> => {
  const tecnica: Tecnica = { tipo: 'CLUSTER', blocos, pausaSegundos: 15, pausaRespiracoes: null };
  const reps = blocos.reduce((a, b) => a + b, 0);
  return { tecnica, repsMin: reps, repsMax: reps };
};

function montar(inicial: Serie[]) {
  let atuais = inicial;
  function Pai() {
    const [series, setSeries] = React.useState(inicial);
    return <EditorSeries series={series} config={null} cardio={false} aoMudar={(novas) => { atuais = novas; setSeries(novas); }} />;
  }
  let raiz!: Raiz;
  Renderer.act(() => { raiz = Renderer.create(<Pai />); });
  const comNome = (nome: string) => raiz.root.findAll((x) => x.props.accessibilityLabel === nome && typeof x.props.onPress === 'function')[0];
  const tocar = (nome: string) => Renderer.act(() => comNome(nome).props.onPress());
  const blocos = () => raiz.root.findAll((x) => typeof x.type === 'string' && typeof x.props.onChangeText === 'function' && /^Bloco \d+$/.test(x.props.accessibilityLabel ?? ''))
    .map((x) => x.props.value as string);
  const textos = () => raiz.root.findAll((x) => typeof x.type === 'string' && typeof x.props.children === 'string').map((x) => x.props.children as string);
  return { tocar, comNome, blocos, textos, series: () => atuais };
}

describe('EditorSeries: a série aberta não remonta quando o grupo dela muda (S10)', () => {
  it('"Remover um bloco" que junta a série aberta ao grupo de cima mantém "Blocos diferentes" e os campos', () => {
    const t = montar([serie('s1', cluster([5, 5, 5, 5])), serie('s2', cluster([5, 5, 5, 5, 5]))]);
    t.tocar('Série 2 · WS');
    t.tocar('Distribuição dos blocos: Blocos diferentes');
    expect(t.blocos()).toEqual(['5', '5', '5', '5', '5']);
    t.tocar('Remover um bloco');
    // As duas séries ficaram iguais e viraram um grupo só (a 1ª é a primeira dele).
    expect(t.series().map((s) => s.tecnica?.blocos)).toEqual([[5, 5, 5, 5], [5, 5, 5, 5]]);
    expect(t.comNome('Série 1 · WS')).toBeDefined();
    expect(t.comNome('Série 2 · WS')).toBeUndefined();
    // O editor é o mesmo: o modo e os campos ficam; o resumo acompanha.
    expect(t.comNome('Distribuição dos blocos: Blocos diferentes').props.accessibilityState.selected).toBe(true);
    expect(t.blocos()).toEqual(['5', '5', '5', '5']);
    expect(t.textos()).toContain('4 blocos · 20 reps por série');
    // E continua o mesmo na mudança seguinte (o uid guardado é o da série aberta, não o da 1ª do grupo).
    t.tocar('Adicionar um bloco');
    expect(t.series().map((s) => s.tecnica?.blocos)).toEqual([[5, 5, 5, 5, 5], [5, 5, 5, 5, 5]]);
    expect(t.comNome('Distribuição dos blocos: Blocos diferentes').props.accessibilityState.selected).toBe(true);
    expect(t.blocos()).toEqual(['5', '5', '5', '5', '5']);
  });
});
