import type { Serie } from '../../api/tipos';
import { LIMITE_SERIES } from '../../dominio/editorTreino';
import { serie } from '../../dominio/exemplosDeTreino.apoioTeste';
import { EditorSeries } from './EditorSeries';

/**
 * "Nova série" com o exercício cheio: desabilitado ele perdia o tracejado da faixa e o motivo ficava escondido dentro da
 * rolagem das abas, então sai da faixa e vai para baixo dela. Mesmas peças falsas do `EditorSeries.abas.test.tsx`.
 */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@rn-primitives/label', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/switch', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/alert-dialog', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/tabs', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/slot', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/portal', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/toggle', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/toggle-group', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('../../tema/TemaProvider', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useTema: () => ({ cores: require('../../tema/tokens').ESCURO, bordas: { bloco: 2, item: 2 }, marca: '#E11D48', sobreMarca: '#FFFFFF', fatorTexto: 1, preferencias: { animacoes: false } }),
}));
jest.mock('../../ui/Botao', () => ({
  Botao: ({ rotuloAcessivel, rotulo, aoTocar, desabilitado, motivo }: { rotuloAcessivel?: string; rotulo: string; aoTocar: () => void; desabilitado?: boolean; motivo?: string }) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotuloAcessivel ?? rotulo, accessibilityHint: motivo, accessibilityState: { disabled: !!desabilitado }, onPress: aoTocar }),
}));
jest.mock('../../ui/Abas', () => ({
  Abas: ({ abas, ativa, aoMudar, depois }: { abas: { valor: string; rotulo: string }[]; ativa: string; aoMudar: (v: string) => void; depois?: unknown }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createElement } = require('react'); const { Pressable, View } = require('react-native');
    return createElement(View, { testID: 'faixa' }, ...abas.map((a) => createElement(Pressable, { key: a.valor, accessibilityRole: 'tab', accessibilityLabel: a.rotulo, accessibilityState: { selected: a.valor === ativa }, onPress: () => aoMudar(a.valor) })), depois);
  },
}));
jest.mock('../../ui/Escolha', () => ({
  Escolha: ({ rotulo, opcoes, aoMudar }: { rotulo: string; opcoes: { valor: unknown; rotulo: string }[]; aoMudar: (v: unknown) => void }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createElement } = require('react'); const { Pressable, View } = require('react-native');
    return createElement(View, null, ...opcoes.map((o) => createElement(Pressable, { key: String(o.valor), accessibilityLabel: `${rotulo}: ${o.rotulo}`, onPress: () => aoMudar(o.valor) })));
  },
}));
// O uid novo sai do expo-crypto, que no Jest não gera nada.
jest.mock('../../dominio/uid', () => {
  let n = 0;
  return { ...jest.requireActual('../../dominio/uid'), novoUid: () => `novo-${++n}` };
});
// Os campos da prescrição não entram nestes casos: só a aba aberta.
jest.mock('./CamposDaPrescricao', () => new Proxy({ __esModule: true }, { get: (alvo, chave) => (chave === '__esModule' ? true : chave === 'useCamposLadoALado' ? () => false : () => null) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
type Arvore = import('react-test-renderer').ReactTestRenderer;
type No = import('react-test-renderer').ReactTestInstance;

function montar(series: Serie[]): Arvore {
  let arvore: Arvore | undefined;
  Renderer.act(() => { arvore = Renderer.create(<EditorSeries series={series} config={null} modalidade={null} aoMudar={() => undefined} />); });
  return arvore as Arvore;
}
/** Os "Nova série" de verdade (o `Pressable` falso aparece mais de uma vez na árvore: fica o de mais fora). */
const novas = (raiz: No) => raiz.findAll((n) => n.props.accessibilityLabel === 'Nova série' && typeof n.props.onPress === 'function' && typeof n.type !== 'string');

describe('"Nova série" com o exercício cheio', () => {
  it('com espaço, fica no fim da faixa das abas e liberado', () => {
    const arvore = montar([serie('a1', { tipo: 'WORKING' }), serie('a2', { tipo: 'WORKING' })]);
    const faixa = arvore.root.findByProps({ testID: 'faixa' });
    expect(novas(faixa)).toHaveLength(1);
    expect(novas(faixa)[0].props.accessibilityState).toEqual({ disabled: false });
  });

  it(`com ${LIMITE_SERIES} séries, sai da faixa e fica abaixo dela, desabilitado e com o motivo`, () => {
    const cheio = Array.from({ length: LIMITE_SERIES }, (_, i) => serie(`s${i}`, { tipo: 'WORKING' }));
    const arvore = montar(cheio);
    expect(novas(arvore.root.findByProps({ testID: 'faixa' }))).toHaveLength(0);
    const [botao, ...resto] = novas(arvore.root);
    expect(resto).toHaveLength(0);
    expect(botao.props.accessibilityState).toEqual({ disabled: true });
    expect(botao.props.accessibilityHint).toBe(`O exercício já tem ${LIMITE_SERIES} séries, o máximo.`);
  });
});
