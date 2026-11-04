import { useState } from 'react';

import type { Serie } from '../../api/tipos';
import { agrupar } from '../../dominio/agrupamento';
import { serie } from '../../dominio/exemplosDeTreino.apoioTeste';
import { EditorSeries } from './EditorSeries';

/**
 * Abas das séries com a aba aberta controlada pelo editor (D8, D12): abre o grupo que contém o uid, trocar o tipo não
 * fecha a aba, "Nova série" abre a nova e, sem as props, o componente guarda a aba sozinho (receita do Planejamento).
 * As peças de `ui/` com primitivos nativos viram falsas que só repassam rótulo, estado e toque.
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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Botao: ({ rotuloAcessivel, rotulo, aoTocar }: { rotuloAcessivel?: string; rotulo: string; aoTocar: () => void }) => require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotuloAcessivel ?? rotulo, onPress: aoTocar }),
}));
jest.mock('../../ui/Abas', () => ({
  Abas: ({ abas, ativa, aoMudar, depois }: { abas: { valor: string; rotulo: string }[]; ativa: string; aoMudar: (v: string) => void; depois?: unknown }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createElement } = require('react'); const { Pressable, View } = require('react-native');
    return createElement(View, null, ...abas.map((a) => createElement(Pressable, { key: a.valor, accessibilityRole: 'tab', accessibilityLabel: a.rotulo, accessibilityState: { selected: a.valor === ativa }, onPress: () => aoMudar(a.valor) })), depois);
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

const SERIES: Serie[] = [serie('a1', { tipo: 'FEEDER' }), serie('a2', { tipo: 'FEEDER' }), serie('b1', { tipo: 'WORKING' })];

function abaSelecionada(arvore: Arvore): string | undefined {
  return arvore.root.findAll((n) => n.props.accessibilityRole === 'tab' && n.props.accessibilityState?.selected && typeof n.type !== 'string')[0]?.props.accessibilityLabel;
}
/** Rótulos das abas, na ordem (o `Pressable` falso aparece mais de uma vez na árvore). */
function rotulosDasAbas(arvore: Arvore): string[] {
  return [...new Set(arvore.root.findAll((n) => n.props.accessibilityRole === 'tab').map((n) => n.props.accessibilityLabel as string))];
}
function tocar(arvore: Arvore, rotulo: string) {
  const alvo = arvore.root.findAll((n) => n.props.accessibilityLabel === rotulo && typeof n.props.onPress === 'function')[0];
  if (!alvo) throw new Error(`sem "${rotulo}"`);
  Renderer.act(() => alvo.props.onPress());
}

/** O editor de treino em miniatura: guarda as séries e a aba aberta, como o `grupoAbertoPorExercicio`. */
function Controlado({ inicial, aoAbrir, comeco = SERIES }: { inicial: string | null; aoAbrir: jest.Mock; comeco?: Serie[] }) {
  const [series, setSeries] = useState(comeco);
  const [aberto, setAberto] = useState<string | null>(inicial);
  return <EditorSeries series={series} config={null} modalidade={null} aoMudar={setSeries} grupoAbertoUid={aberto}
    aoAbrirGrupo={(uid) => { aoAbrir(uid); setAberto(uid); }} />;
}

function montar(elemento: React.ReactElement): Arvore {
  let arvore: Arvore | undefined;
  Renderer.act(() => { arvore = Renderer.create(elemento); });
  return arvore as Arvore;
}

describe('EditorSeries com a aba controlada', () => {
  it('abre o grupo que contém o uid, mesmo sendo a 2ª série do grupo', () => {
    const arvore = montar(<Controlado inicial="b1" aoAbrir={jest.fn()} />);
    expect(abaSelecionada(arvore)).toMatch(/^Série 2/);
    const outra = montar(<Controlado inicial="a2" aoAbrir={jest.fn()} />);
    expect(abaSelecionada(outra)).toMatch(/^Série 1/);
  });

  it('uid nulo abre o primeiro grupo; tocar na aba avisa o editor com o uid da 1ª série dela', () => {
    const aoAbrir = jest.fn();
    const arvore = montar(<Controlado inicial={null} aoAbrir={aoAbrir} />);
    expect(abaSelecionada(arvore)).toMatch(/^Série 1/);
    tocar(arvore, rotulosDasAbas(arvore)[1]);
    expect(aoAbrir).toHaveBeenLastCalledWith('b1');
    expect(abaSelecionada(arvore)).toMatch(/^Série 2/);
  });

  it('trocar o tipo do grupo aberto não fecha a aba', () => {
    const aoAbrir = jest.fn();
    const arvore = montar(<Controlado inicial="b1" aoAbrir={aoAbrir} />);
    const opcoes = arvore.root.findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Tipo da série: ') && typeof n.props.onPress === 'function');
    const outra = opcoes.find((o) => !/Trabalho/.test(o.props.accessibilityLabel));
    if (!outra) throw new Error('sem outro tipo');
    Renderer.act(() => outra.props.onPress());
    expect(aoAbrir).not.toHaveBeenCalledWith(null);
    expect(abaSelecionada(arvore)).toMatch(/^Série 2/);
    // O uid aberto (b1) continua existindo: nada a avisar ao editor.
    expect(aoAbrir).not.toHaveBeenCalled();
  });

  it('"Nova série" e "Adicionar série" abrem a aba nova (o último grupo)', () => {
    const aoAbrir = jest.fn();
    const arvore = montar(<Controlado inicial="a1" aoAbrir={aoAbrir} />);
    tocar(arvore, 'Nova série');
    // O painel nasce com o tipo de trabalho: escolhe outro, para a série nova ser um grupo próprio.
    const preparo = arvore.root.findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Tipo da série: ') && typeof n.props.onPress === 'function');
    Renderer.act(() => preparo[0].props.onPress());
    tocar(arvore, 'Adicionar série');
    const editor = arvore.root.findByType(EditorSeries);
    const novas: Serie[] = editor.props.series;
    expect(novas.length).toBe(SERIES.length + 1);
    expect(aoAbrir).toHaveBeenLastCalledWith(agrupar(novas).at(-1)?.series[0].uid);
    expect(abaSelecionada(arvore)).toMatch(new RegExp(`^Série ${agrupar(novas).length}`));
  });

  it('sem nada guardado, mover o 1º grupo para baixo leva a aba junto', () => {
    const aoAbrir = jest.fn();
    const arvore = montar(<Controlado inicial={null} aoAbrir={aoAbrir} />);
    tocar(arvore, 'Mover grupo de séries para baixo');
    expect(aoAbrir).toHaveBeenLastCalledWith('a1');
    expect(abaSelecionada(arvore)).toMatch(/^Série 2/);
  });

  it('aberta pela 2ª série do grupo (o "ir ao primeiro"), tirar uma série completa não muda a aba', () => {
    const aoAbrir = jest.fn();
    const comeco = [serie('b1', { tipo: 'WORKING' }), serie('a1', { tipo: 'FEEDER' }), serie('a2', { tipo: 'FEEDER' })];
    const arvore = montar(<Controlado inicial="a2" comeco={comeco} aoAbrir={aoAbrir} />);
    expect(abaSelecionada(arvore)).toMatch(/^Série 2/);
    tocar(arvore, 'Uma série completa a menos');
    expect(aoAbrir).toHaveBeenLastCalledWith('a1');
    expect(abaSelecionada(arvore)).toMatch(/^Série 2/);
  });

  it('sem as props, guarda a aba sozinho (receita de séries do Planejamento)', () => {
    const arvore = montar(<EditorSeries series={SERIES} config={null} modalidade={null} aoMudar={() => undefined} />);
    expect(abaSelecionada(arvore)).toMatch(/^Série 1/);
    tocar(arvore, rotulosDasAbas(arvore)[1]);
    expect(abaSelecionada(arvore)).toMatch(/^Série 2/);
  });
});
