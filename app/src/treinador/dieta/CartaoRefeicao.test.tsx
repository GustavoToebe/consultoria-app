import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import type { ItemDieta, Refeicao } from '../../api/tipos';
import { corDaRefeicao } from '../../dominio/corDaSerie';
import { MODO_DE_PREPARO_MAXIMO } from '../../dominio/dieta';
import { MACROS, valoresPorExtenso } from '../../ui/ValoresDaDieta';
import { ESCURO } from '../../tema/tokens';
import { CartaoRefeicao, colunasDosValores, larguraDaTabela, larguraDoValor } from './CartaoRefeicao';

// Frase com número leva o número num Text aninhado (fonte mono só nele): o texto do nó é o das duas partes juntas.
const textoDoNo = (t: ReactTestInstance): string => t.children.map((c) => (typeof c === 'string' ? c : textoDoNo(c))).join('');

/**
 * Refeição aberta (04/11): "Observação" e "Modo de preparo" ficam num link "+ Observação ou modo de preparo
 * (opcional)" e abrem no toque, também com texto gravado (18/11). A unidade do alimento é uma lista suspensa ("Unidade"), não
 * mais os chips. As peças com primitivos nativos viram falsas que só repassam rótulo e toque. Dados fictícios.
 */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@rn-primitives/slot', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/label', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/portal', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('../../tema/TemaProvider', () => ({
  useTema: () => ({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cores: require('../../tema/tokens').ESCURO, bordas: { bloco: 2, item: 2 }, marca: '#E11D48', sobreMarca: '#FFFFFF', fatorTexto: 1, preferencias: { animacoes: false },
    identificacao: { CIANO: { cor: '#3CC3D6', fundo: '#000' }, AZUL: { cor: '#62A0F8', fundo: '#000' }, VIOLETA: { cor: '#CF8DEE', fundo: '#000' }, MAGENTA: { cor: '#F07AC8', fundo: '#000' }, INDIGO: { cor: '#A196F5', fundo: '#000' } },
  }),
}));
jest.mock('../../ui/Botao', () => ({
  // O tipo vai no `testID`: o "Adicionar alimento" é a ação de construção da opção (`acao`, 25/11).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Botao: ({ rotulo, aoTocar, tipo }: { rotulo: string; aoTocar: () => void; tipo?: string }) => require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotulo, onPress: aoTocar, testID: tipo }),
}));
const campoFalso = ({ rotulo }: { rotulo: string }) =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react').createElement(require('react-native').View, { accessibilityLabel: `campo ${rotulo}` });
jest.mock('../../ui/Campo', () => ({ Campo: campoFalso }));
jest.mock('../../ui/Campos', () => ({ CampoNumerico: campoFalso }));
jest.mock('../../ui/EscolhaSuspensa', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  EscolhaSuspensa: ({ rotulo, valor }: { rotulo: string; valor: string }) => require('react').createElement(require('react-native').View, { accessibilityLabel: `suspensa ${rotulo}: ${valor}` }),
}));
jest.mock('../../ui/Escolha', () => ({ Escolha: () => { throw new Error('a unidade não usa mais os chips'); } }));
// O menu ⋯ vira uma lista de botões "menu <ação>"; tocar fecha o menu e age, como a folha de verdade.
jest.mock('../FolhaDeAcoes', () => ({
  FolhaDeAcoes: ({ acoes, aoFechar }: { acoes: { rotulo: string; detalhe?: string; desabilitado?: boolean; aoTocar: () => void }[]; aoFechar: () => void }) =>
    /* eslint-disable @typescript-eslint/no-require-imports */
    require('react').createElement(require('react-native').View, null, acoes.map((x) => require('react').createElement(require('react-native').Pressable, {
      key: x.rotulo, accessibilityLabel: `menu ${x.rotulo}`, accessibilityHint: x.detalhe, accessibilityState: { disabled: !!x.desabilitado }, onPress: () => { aoFechar(); x.aoTocar(); },
    }))),
    /* eslint-enable @typescript-eslint/no-require-imports */
}));
// Opções em abas (19/11): as abas falsas guardam o "aoMudar" do Tabs num contexto e o toque na aba o chama; o painel é uma
// caixa simples. A confirmação vira um botão com o rótulo de confirmar, só quando visível.
jest.mock('../../components/ui/tabs', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { Pressable, View } = require('react-native');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const Contexto = React.createContext(() => undefined);
  type MockFilhos = { children?: unknown };
  return {
    Tabs: ({ children, onValueChange }: MockFilhos & { onValueChange: (v: string) => void }) => React.createElement(Contexto.Provider, { value: onValueChange }, children),
    TabsList: ({ children, accessibilityLabel }: MockFilhos & { accessibilityLabel: string }) => React.createElement(View, { accessibilityRole: 'tablist', accessibilityLabel }, children),
    TabsTrigger: function Aba({ children, value, accessibilityLabel, accessibilityState, onLayout }: MockFilhos & { value: string; accessibilityLabel: string; accessibilityState: object; onLayout?: unknown }) {
      const aoMudar = React.useContext(Contexto);
      return React.createElement(Pressable, { accessibilityRole: 'tab', accessibilityLabel, accessibilityState, onLayout, onPress: () => aoMudar(value) }, children);
    },
    TabsContent: ({ children }: MockFilhos) => React.createElement(View, null, children),
  };
});
jest.mock('../../ui/useMovimentoReduzido', () => ({ useMovimentoReduzido: () => true }));
// O expo-crypto falso não gera uid: a opção nova precisa de um para a aba e a chave.
jest.mock('../../dominio/uid', () => {
  let n = 0;
  return { ...jest.requireActual('../../dominio/uid'), novoUid: () => `novo-${++n}` };
});
jest.mock('../../ui/PainelConfirmacao', () => ({
  PainelConfirmacao: ({ visivel, rotuloConfirmar, aoConfirmar }: { visivel: boolean; rotuloConfirmar: string; aoConfirmar: () => void }) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (visivel ? require('react').createElement(require('react-native').Pressable, { accessibilityLabel: `confirmar ${rotuloConfirmar}`, onPress: aoConfirmar }) : null),
}));
// O arraste (gesto e Reanimated) tem e2e próprio (`e2e/arrastar.spec.ts`); aqui a caixa só passa o item adiante.
jest.mock('../../ui/ArrasteDaLista', () => ({
  LARGURA_DA_ALCA: 24,
  useArrasteDaLista: () => ({}),
  ItemArrastavel: ({ children }: { children: unknown }) => children,
  AlcaDeArraste: () => null,
}));
// O aviso (toast) só registra o que seria mostrado; o Desfazer é chamado à mão.
const mockAvisar = jest.fn();
jest.mock('../../ui/Aviso', () => ({ useAviso: () => ({ avisar: mockAvisar }) }));
jest.mock('../biblioteca/AbaAlimentos', () => ({ UNIDADES: [{ valor: 'g', rotulo: 'g' }, { valor: 'ml', rotulo: 'ml' }, { valor: 'un', rotulo: 'un' }] }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
type Arvore = import('react-test-renderer').ReactTestRenderer;

const EXTRAS = 'Observação ou modo de preparo (opcional)';

const item = (uid: string, nome: string): ItemDieta => ({ uid, alimentoId: null, nome, quantidade: 100, unidade: 'ml', kcal: 50, proteina: 1, carboidrato: 10, gordura: 0, manual: true });

function refeicao(extra: Partial<Refeicao> = {}): Refeicao {
  return {
    uid: 'r1', nome: 'Lanche fictício', horario: '15:00', observacao: null, modoDePreparo: null,
    opcoes: [{ uid: 'a', rotulo: 'A', itens: [item('i1', 'Suco fictício')] }, { uid: 'b', rotulo: 'B', itens: [item('i2', 'Leite fictício')] }],
    ...extra,
  };
}

type Extra = { posicao?: number; aberta?: boolean; aoTrocarAlimento?: (uid: string) => void; comProblema?: Set<string>; aoRemoverOpcao?: (i: number) => void };

/** O editor de verdade guarda a refeição; aqui o `useState` faz o papel dele (criar e excluir opção mudam a refeição). */
function ComEstado({ inicial, extra }: { inicial: Refeicao; extra: Extra }) {
  const [r, setR] = useState(inicial);
  return (
    <CartaoRefeicao refeicao={r} posicao={extra.posicao ?? 0} total={1} aberta={extra.aberta ?? true} comProblema={extra.comProblema ?? new Set()} alimentos={new Map()}
      aoMudar={setR} aoRemoverOpcao={(i) => { extra.aoRemoverOpcao?.(i); setR((a) => ({ ...a, opcoes: a.opcoes.filter((_, j) => j !== i) })); }}
      aoMover={() => undefined} aoRemover={() => undefined} aoEscolherAlimento={() => undefined} aoTrocarAlimento={extra.aoTrocarAlimento} />
  );
}

function montar(r: Refeicao, extra: Extra = {}): Arvore {
  let arvore: Arvore | undefined;
  Renderer.act(() => {
    arvore = Renderer.create(<ComEstado inicial={r} extra={extra} />);
  });
  return arvore as Arvore;
}
const comRotulo = (a: Arvore, rotulo: string) => a.root.findAll((n) => n.props.accessibilityLabel === rotulo && typeof n.type === 'string');
const temCampo = (a: Arvore, rotulo: string) => comRotulo(a, `campo ${rotulo}`).length > 0;
const botaoDosExtras = (a: Arvore) => a.root.findAll((n) => n.props.accessibilityLabel === EXTRAS && typeof n.props.onPress === 'function');
/** Toca o primeiro com esse nome e um `onPress`. */
const tocar = (a: Arvore, rotulo: string | RegExp) => {
  const alvo = a.root.findAll((n) => typeof n.props.onPress === 'function'
    && (typeof rotulo === 'string' ? n.props.accessibilityLabel === rotulo : rotulo.test(n.props.accessibilityLabel ?? '')))[0];
  if (!alvo) throw new Error(`nada para tocar: ${rotulo}`);
  Renderer.act(() => alvo.props.onPress());
};
const abas = (a: Arvore) => a.root.findAll((n) => n.props.accessibilityRole === 'tab' && typeof n.type === 'string').map((n) => n.props.accessibilityLabel as string);
const abaAberta = (a: Arvore) => a.root.findAll((n) => n.props.accessibilityRole === 'tab' && typeof n.type === 'string' && n.props.accessibilityState?.selected)
  .map((n) => n.props.accessibilityLabel as string);
/** A aba aberta é medida (como no aparelho): só então o ⋯ dela aparece, na ponta da aba. */
const medirAberta = (a: Arvore) => {
  const aba = a.root.findAll((n) => n.props.accessibilityRole === 'tab' && typeof n.props.onLayout === 'function' && n.props.accessibilityState?.selected)[0];
  Renderer.act(() => aba.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 160, height: 46 } } }));
};
const NOVA_OPCAO = 'Adicionar opção em 15:00 · Lanche fictício';

describe('CartaoRefeicao: observação e modo de preparo', () => {
  it('vazios ficam recolhidos no link, abaixo de Nome e Horário', () => {
    const a = montar(refeicao());
    expect(temCampo(a, 'Nome')).toBe(true);
    expect(temCampo(a, 'Horário')).toBe(true);
    expect(botaoDosExtras(a)).toHaveLength(1);
    expect(temCampo(a, 'Observação (opcional)')).toBe(false);
    expect(temCampo(a, 'Modo de preparo (opcional)')).toBe(false);
  });

  it('o toque no link abre os dois campos e o link some', () => {
    const a = montar(refeicao());
    Renderer.act(() => botaoDosExtras(a)[0].props.onPress());
    expect(temCampo(a, 'Observação (opcional)')).toBe(true);
    expect(temCampo(a, 'Modo de preparo (opcional)')).toBe(true);
    expect(botaoDosExtras(a)).toHaveLength(0);
  });

  // Regra de 18/11: nasce fechado também com texto gravado; o toque abre.
  it('com modo de preparo gravado, os campos nascem recolhidos e abrem no toque', () => {
    const a = montar(refeicao({ modoDePreparo: 'Bata tudo no liquidificador.' }));
    expect(temCampo(a, 'Modo de preparo (opcional)')).toBe(false);
    expect(botaoDosExtras(a)).toHaveLength(1);
    Renderer.act(() => botaoDosExtras(a)[0].props.onPress());
    expect(temCampo(a, 'Modo de preparo (opcional)')).toBe(true);
  });

  it('com só a observação gravada, os campos também nascem recolhidos', () => {
    const a = montar(refeicao({ observacao: 'Pode trocar a fruta.' }));
    expect(temCampo(a, 'Observação (opcional)')).toBe(false);
    expect(botaoDosExtras(a)).toHaveLength(1);
  });

  it('modo de preparo acima do limite (erro apontado) abre os campos para o erro aparecer', () => {
    const a = montar(refeicao({ modoDePreparo: 'x'.repeat(MODO_DE_PREPARO_MAXIMO + 1) }));
    expect(temCampo(a, 'Modo de preparo (opcional)')).toBe(true);
    expect(botaoDosExtras(a)).toHaveLength(0);
  });
});

describe('CartaoRefeicao: unidade do alimento', () => {
  it('cada alimento tem a quantidade e a unidade atual numa escolha suspensa (só os da opção aberta)', () => {
    const a = montar(refeicao());
    expect(comRotulo(a, 'campo Quantidade')).toHaveLength(1);
    expect(comRotulo(a, 'suspensa Unidade: ml')).toHaveLength(1);
  });
});

// Opções em abas (19/11): no lugar das colunas lado a lado.
describe('CartaoRefeicao: opções em abas', () => {
  const tres = () => refeicao({ opcoes: [
    { uid: 'a', rotulo: 'A', itens: [item('i1', 'Suco fictício'), item('i2', 'Pão fictício')] },
    { uid: 'b', rotulo: 'B', itens: [item('i3', 'Leite fictício')] },
    { uid: 'c', rotulo: 'C', itens: [] },
  ] });

  it('com uma opção só: a barra com "Opção A" e o "+ Nova opção", sem comparação, sem selo nem ⋯ (a única não se exclui)', () => {
    const a = montar(refeicao({ opcoes: [{ uid: 'a', rotulo: 'A', itens: [item('i1', 'Suco fictício')] }] }));
    expect(abas(a)).toEqual(['Opção A, 50 kcal']);
    expect(comRotulo(a, NOVA_OPCAO)).toHaveLength(1);
    medirAberta(a);
    expect(comRotulo(a, 'Mais ações da opção A')).toHaveLength(0);
    expect(a.root.findAll((n) => n.props['aria-label'] === 'Comparação das opções')).toHaveLength(0);
    // Nada no cabeçalho "Alimentos (N)": o único `acao` da área é o "Adicionar alimento"; o "Item manual" fica secundário.
    expect(comRotulo(a, 'Adicionar alimento')[0].props.testID).toBe('acao');
    expect(comRotulo(a, 'Item manual')[0].props.testID).toBe('secundario');
    expect(a.root.findAll((n) => n.props.testID === 'acao' && typeof n.type === 'string')).toHaveLength(1);
    expect(a.root.findAll((n) => n.props.children === 'Cada opção substitui a refeição inteira: o aluno escolhe uma.')).toHaveLength(0);
  });

  it('com várias, cada aba e cada linha da comparação têm o círculo com a letra, preenchido só na aberta; um "+ Nova opção"', () => {
    const a = montar(tres());
    expect(comRotulo(a, NOVA_OPCAO)).toHaveLength(1);
    expect(a.root.findAll((n) => n.props.testID === 'acao' && typeof n.type === 'string')).toHaveLength(1);
    const marcadores = a.root.findAll((n) => n.props.testID === 'marcador-de-opcao' && typeof n.type === 'string');
    // Três abas e três linhas da comparação.
    expect(marcadores).toHaveLength(6);
    const preenchido = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style).backgroundColor === ESCURO.acao;
    expect(marcadores.filter(preenchido)).toHaveLength(2);
    const letras = marcadores.map((n) => n.findAllByType(Text).map(textoDoNo).join(''));
    expect(letras).toEqual(['A', 'B', 'C', 'A', 'B', 'C']);
    tocar(a, /^Opção B,/);
    expect(a.root.findAll((n) => n.props.testID === 'marcador-de-opcao' && typeof n.type === 'string' && preenchido(n))
      .map((n) => n.findAllByType(Text).map(textoDoNo).join(''))).toEqual(['B', 'B']);
  });

  it('com três: uma aba por opção com a kcal, a primeira conta no total do dia, a vazia diz "vazia"; abre na A', () => {
    const a = montar(tres());
    expect(abas(a)).toEqual(['Opção A, 100 kcal, conta no total do dia', 'Opção B, 50 kcal', 'Opção C, vazia']);
    expect(abaAberta(a)).toEqual(['Opção A, 100 kcal, conta no total do dia']);
    expect(comRotulo(a, 'campo Item')).toHaveLength(2);
  });

  it('tocar na aba (ou na linha da comparação) abre a opção; só ela mostra os alimentos', () => {
    const a = montar(tres());
    tocar(a, 'Opção B, 50 kcal');
    expect(abaAberta(a)).toEqual(['Opção B, 50 kcal']);
    expect(comRotulo(a, 'campo Item')).toHaveLength(1);
    tocar(a, /^Opção C: vazia/);
    expect(abaAberta(a)).toEqual(['Opção C, vazia']);
    expect(comRotulo(a, 'campo Item')).toHaveLength(0);
    // Vazia não tem total (nunca "0 kcal").
    expect(a.root.findAll((n) => n.props['aria-label'] === 'Total da opção C')).toHaveLength(0);
  });

  it('"+ Nova opção" cria a próxima letra e ela abre selecionada; com uma só, a B nasce ao lado da A', () => {
    const a = montar(tres());
    tocar(a, NOVA_OPCAO);
    expect(abas(a)).toHaveLength(4);
    expect(abaAberta(a)).toEqual(['Opção D, vazia']);
    const uma = montar(refeicao({ opcoes: [{ uid: 'a', rotulo: 'A', itens: [item('i1', 'Suco fictício')] }] }));
    tocar(uma, NOVA_OPCAO);
    expect(abas(uma)).toEqual(['Opção A, 50 kcal, conta no total do dia', 'Opção B, vazia']);
    expect(abaAberta(uma)).toEqual(['Opção B, vazia']);
  });

  it('o ⋯ da aba aberta exclui: confirma só com itens; a aberta excluída abre a vizinha; com uma só, o ⋯ some e a barra fica', () => {
    const aoRemoverOpcao = jest.fn();
    const a = montar(tres(), { aoRemoverOpcao });
    tocar(a, 'Opção B, 50 kcal');
    medirAberta(a);
    tocar(a, 'Mais ações da opção B');
    tocar(a, 'menu Excluir opção');
    expect(aoRemoverOpcao).not.toHaveBeenCalled();
    tocar(a, 'confirmar Excluir opção');
    expect(aoRemoverOpcao).toHaveBeenCalledWith(1);
    expect(abaAberta(a)).toEqual(['Opção C, vazia']);
    // A C está vazia: sai sem perguntar.
    medirAberta(a);
    tocar(a, 'Mais ações da opção C');
    tocar(a, 'menu Excluir opção');
    expect(aoRemoverOpcao).toHaveBeenLastCalledWith(1);
    expect(abas(a)).toEqual(['Opção A, 100 kcal']);
    medirAberta(a);
    expect(comRotulo(a, 'Mais ações da opção A')).toHaveLength(0);
    expect(comRotulo(a, NOVA_OPCAO)).toHaveLength(1);
  });

  it('com seis opções, o "+ Nova opção" fica desabilitado e o motivo aparece', () => {
    const seis = refeicao({ opcoes: ['A', 'B', 'C', 'D', 'E', 'F'].map((rotulo) => ({ uid: rotulo.toLowerCase(), rotulo, itens: [] })) });
    const a = montar(seis);
    const [botao] = comRotulo(a, NOVA_OPCAO);
    expect(botao.props.accessibilityState).toMatchObject({ disabled: true });
    expect(a.root.findAll((n) => n.props.children === 'No máximo 6 opções por refeição.' && typeof n.type === 'string')).toHaveLength(1);
  });

  it('o total embaixo da tabela é o da aba aberta', () => {
    const a = montar(tres());
    expect(a.root.findAll((n) => n.props['aria-label'] === 'Total da opção A' && typeof n.type === 'string')).toHaveLength(1);
    tocar(a, 'Opção B, 50 kcal');
    expect(a.root.findAll((n) => n.props['aria-label'] === 'Total da opção B' && typeof n.type === 'string')).toHaveLength(1);
    expect(a.root.findAll((n) => n.props['aria-label'] === 'Total da opção A')).toHaveLength(0);
  });

  it('a opção com problema da validação abre sozinha e a aba avisa', () => {
    const a = montar(tres(), { comProblema: new Set(['r1', 'b', 'i3']) });
    expect(abaAberta(a)).toEqual(['Opção B, 50 kcal, com problema a corrigir']);
  });

  // Reordenar (26/11): a letra segue a posição e a aberta continua a mesma opção.
  it('"Tornar Opção A" no ⋯ da B: ela vira a A (conta no total), continua aberta, avisa com Desfazer, e o Desfazer volta tudo', () => {
    mockAvisar.mockClear();
    const a = montar(tres());
    tocar(a, 'Opção B, 50 kcal');
    medirAberta(a);
    tocar(a, 'Mais ações da opção B');
    tocar(a, 'menu Tornar Opção A');
    expect(abas(a)).toEqual(['Opção A, 50 kcal, conta no total do dia', 'Opção B, 100 kcal', 'Opção C, vazia']);
    expect(abaAberta(a)).toEqual(['Opção A, 50 kcal, conta no total do dia']);
    expect(mockAvisar).toHaveBeenCalledWith('Opção B agora é a Opção A e conta no total do dia.', 'neutro', expect.objectContaining({ rotulo: 'Desfazer' }));
    const desfazer = mockAvisar.mock.calls[0][2].aoTocar as () => void;
    Renderer.act(() => desfazer());
    expect(abas(a)).toEqual(['Opção A, 100 kcal, conta no total do dia', 'Opção B, 50 kcal', 'Opção C, vazia']);
    expect(abaAberta(a)).toEqual(['Opção B, 50 kcal']);
  });

  it('o ⋯ da primeira: "Mover para a esquerda" e "Tornar Opção A" apagados (com o motivo), "Mover para a direita" não', () => {
    const a = montar(tres());
    medirAberta(a);
    tocar(a, 'Mais ações da opção A');
    const apagado = (r: string) => comRotulo(a, `menu ${r}`)[0].props.accessibilityState.disabled;
    expect([apagado('Mover para a esquerda'), apagado('Tornar Opção A'), apagado('Mover para a direita'), apagado('Excluir opção')]).toEqual([true, true, false, false]);
  });

  it('mover sem mudar a primeira não avisa: a região viva diz a posição e a letra novas', () => {
    mockAvisar.mockClear();
    const a = montar(tres());
    tocar(a, 'Opção C, vazia');
    medirAberta(a);
    tocar(a, 'Mais ações da opção C');
    expect(comRotulo(a, 'menu Mover para a direita')[0].props.accessibilityState.disabled).toBe(true);
    tocar(a, 'menu Mover para a esquerda');
    expect(abas(a)).toEqual(['Opção A, 100 kcal, conta no total do dia', 'Opção B, vazia', 'Opção C, 50 kcal']);
    expect(abaAberta(a)).toEqual(['Opção B, vazia']);
    expect(mockAvisar).not.toHaveBeenCalled();
    const [regiao] = a.root.findAll((n) => n.props.role === 'status' && typeof n.type === 'string');
    expect(textoDoNo(regiao)).toBe('Opção C movida para a posição 2: agora é a Opção B.');
  });

  // Rótulo personalizado (a importação assistida grava "Opção Principal"): não vira letra ao reordenar.
  const mista = () => refeicao({ opcoes: [
    { uid: 'a', rotulo: 'A', itens: [item('i1', 'Suco fictício')] },
    { uid: 'p', rotulo: 'Opção Principal', itens: [item('i2', 'Leite fictício'), item('i3', 'Pão fictício')] },
    { uid: 'c', rotulo: 'C', itens: [] },
  ] });

  it('mistura (A, "Principal", C): as abas usam o rótulo personalizado sem prefixo dobrado; o ⋯ dele não fala em letra', () => {
    const a = montar(mista());
    expect(abas(a)).toEqual(['Opção A, 50 kcal, conta no total do dia', 'Opção Principal, 100 kcal', 'Opção C, vazia']);
    tocar(a, 'Opção Principal, 100 kcal');
    medirAberta(a);
    tocar(a, 'Mais ações da opção Principal');
    const detalhe = (r: string) => comRotulo(a, `menu ${r}`)[0].props.accessibilityHint as string;
    expect(detalhe('Mover para a esquerda')).toContain('Passa para a posição 1 e conta no total do dia.');
    expect(detalhe('Mover para a direita')).toContain('Passa para a posição 3.');
    expect(comRotulo(a, 'menu Tornar a primeira opção')).toHaveLength(1);
  });

  it('o personalizado vai para o primeiro lugar: mantém o rótulo, a A vira B, o aviso não fala em letra e o Desfazer volta tudo', () => {
    mockAvisar.mockClear();
    const a = montar(mista());
    tocar(a, 'Opção Principal, 100 kcal');
    medirAberta(a);
    tocar(a, 'Mais ações da opção Principal');
    tocar(a, 'menu Tornar a primeira opção');
    expect(abas(a)).toEqual(['Opção Principal, 100 kcal, conta no total do dia', 'Opção B, 50 kcal', 'Opção C, vazia']);
    expect(mockAvisar).toHaveBeenCalledWith('Principal agora conta no total do dia.', 'neutro', expect.objectContaining({ rotulo: 'Desfazer' }));
    Renderer.act(() => (mockAvisar.mock.calls[0][2].aoTocar as () => void)());
    expect(abas(a)).toEqual(['Opção A, 50 kcal, conta no total do dia', 'Opção Principal, 100 kcal', 'Opção C, vazia']);
  });

  it('a C vai para o meio: só as de rótulo padrão são reletradas e o personalizado fica onde estava no rótulo', () => {
    mockAvisar.mockClear();
    const a = montar(mista());
    tocar(a, 'Opção C, vazia');
    medirAberta(a);
    tocar(a, 'Mais ações da opção C');
    tocar(a, 'menu Mover para a esquerda');
    expect(abas(a)).toEqual(['Opção A, 50 kcal, conta no total do dia', 'Opção B, vazia', 'Opção Principal, 100 kcal']);
    const [regiao] = a.root.findAll((n) => n.props.role === 'status' && typeof n.type === 'string');
    expect(textoDoNo(regiao)).toBe('Opção C movida para a posição 2: agora é a Opção B.');
  });

  it('o total do dia (subtotal da primeira) segue a posição 1, seja qual for o rótulo', () => {
    const a = montar(refeicao({ opcoes: [
      { uid: 'p', rotulo: 'Opção Principal', itens: [item('i2', 'Leite fictício')] },
      { uid: 'b', rotulo: 'B', itens: [] },
    ] }));
    expect(a.root.findAll((n) => n.props['aria-label'] === 'Subtotal da refeição, opção Principal' && typeof n.type === 'string')).toHaveLength(1);
  });

  it('a exclusão da refeição é o botão de perigo "Excluir refeição" ao lado do ⋯, com o nome da refeição no nome acessível', () => {
    const aoRemover = jest.fn();
    let arvore: Arvore | undefined;
    Renderer.act(() => {
      arvore = Renderer.create(
        <CartaoRefeicao refeicao={refeicao()} posicao={0} total={2} aberta comProblema={new Set()} alimentos={new Map()}
          aoMudar={() => undefined} aoRemoverOpcao={() => undefined} aoMover={() => undefined} aoRemover={aoRemover}
          aoEscolherAlimento={() => undefined} />,
      );
    });
    const a = arvore as Arvore;
    // O `Botao` falso guarda o tipo no testID e o rótulo visível no rótulo (o nome acessível é conferido no e2e).
    expect(comRotulo(a, 'Excluir')).toHaveLength(0);
    expect(a.root.findAll((n) => n.props.testID === 'perigo' && n.props.accessibilityLabel === 'Excluir refeição' && typeof n.type === 'string')).toHaveLength(1);
    tocar(a, 'Excluir refeição');
    expect(aoRemover).toHaveBeenCalledTimes(1);
  });
});

describe('CartaoRefeicao: trocar alimento (C56)', () => {
  const biblioteca = (uid: string, nome: string): ItemDieta => ({ ...item(uid, nome), alimentoId: `al-${uid}`, manual: false });
  const comItens = (itens: ItemDieta[]) => refeicao({ opcoes: [{ uid: 'a', rotulo: 'A', itens }] });
  const trocar = (a: Arvore, nome: string) => a.root.findAll((n) => n.props.accessibilityLabel === `Trocar alimento: ${nome}` && typeof n.props.onPress === 'function');

  it('só o item da biblioteca tem "Trocar alimento", e o toque manda o uid dele', () => {
    const aoTrocarAlimento = jest.fn();
    const a = montar(comItens([biblioteca('i1', 'Pão fictício'), item('i2', 'Suco fictício')]), { aoTrocarAlimento });
    expect(trocar(a, 'Pão fictício')).toHaveLength(1);
    expect(trocar(a, 'Suco fictício')).toHaveLength(0);
    Renderer.act(() => trocar(a, 'Pão fictício')[0].props.onPress());
    expect(aoTrocarAlimento).toHaveBeenCalledWith('i1');
  });

  it('sem quem trate a troca, o botão não aparece', () => {
    expect(trocar(montar(comItens([biblioteca('i1', 'Pão fictício')])), 'Pão fictício')).toHaveLength(0);
  });
});

// Dieta em tabela (18/11): com a opção larga, um cabeçalho de colunas e os itens em faixas; estreita, o item empilhado.
describe('CartaoRefeicao: itens em tabela', () => {
  const biblioteca = (uid: string, nome: string): ItemDieta => ({ ...item(uid, nome), alimentoId: `al-${uid}`, manual: false });
  const umaOpcao = refeicao({ opcoes: [{ uid: 'a', rotulo: 'A', itens: [biblioteca('i1', 'Pão fictício'), item('i2', 'Suco fictício')] }] });
  const comLargura = (a: Arvore, width: number) => {
    const opcoes = a.root.findAll((n) => n.props.testID === 'opcoes-da-refeicao' && typeof n.type === 'string')[0];
    Renderer.act(() => opcoes.props.onLayout({ nativeEvent: { layout: { width, height: 0, x: 0, y: 0 } } }));
    return a;
  };
  const textos = (a: Arvore) => a.root.findAllByType(Text).map((t) => t.props.children);
  const temCabecalho = (a: Arvore) => textos(a).includes('Alimento');

  it('larga, mostra o cabeçalho uma vez, escondido do leitor, os valores da biblioteca como texto e o "Trocar alimento"', () => {
    const a = comLargura(montar(umaOpcao, { aoTrocarAlimento: () => undefined }), 1200);
    expect(textos(a).filter((t) => t === 'Alimento')).toHaveLength(1);
    // Quantidade e unidade num campo só (20/11): sem a coluna "Unidade".
    for (const titulo of ['#', 'Quantidade', 'Kcal', 'P (g)', 'C (g)', 'G (g)', 'Fibras (g)']) expect(textos(a)).toContain(titulo);
    expect(textos(a)).not.toContain('Unidade');
    const cabecalho = a.root.findAll((n) => typeof n.type === 'string' && n.props['aria-hidden'] && n.findAll((f) => f.props.children === 'Alimento').length > 0);
    expect(cabecalho.length).toBeGreaterThan(0);
    // O item da biblioteca: número solto na coluna, sem o "g" (está no título), e uma frase só para o leitor.
    expect(textos(a)).toContain('1,0');
    expect(textos(a)).not.toContain('1,0 g');
    expect(textos(a)).toContain('Pão fictício: 50 kcal, proteína 1,0 g, carboidrato 10,0 g, gordura 0,0 g, fibra sem dado');
    expect(textos(a)).toContain('Trocar alimento');
    // O total da opção embaixo das colunas: os números soltos, a frase só para o leitor.
    expect(textos(a)).toContain('100');
    expect(textos(a)).toContain('Total da opção A: 100 kcal, proteína 2,0 g, carboidrato 20,0 g, gordura 0,0 g, fibra sem dado');
  });

  it('larga, os campos mantêm os nomes de hoje (quantidade e os valores do item manual); a unidade fica dentro do campo', () => {
    const a = comLargura(montar(umaOpcao), 1200);
    expect(comRotulo(a, 'campo Quantidade')).toHaveLength(2);
    // A sigla da unidade é a `acao` do campo da quantidade (o `Campo` falso não a desenha; o e2e confere o botão).
    expect(comRotulo(a, 'suspensa Unidade: ml')).toHaveLength(0);
    for (const campo of ['Item', 'Kcal', 'P (g)', 'C (g)', 'G (g)']) expect(temCampo(a, campo)).toBe(true);
  });

  it('o limite sai das colunas: um pixel abaixo dele, volta ao item empilhado, sem cabeçalho', () => {
    const limite = larguraDaTabela();
    expect(temCabecalho(comLargura(montar(umaOpcao, { aoTrocarAlimento: () => undefined }), limite))).toBe(true);
    expect(temCabecalho(comLargura(montar(umaOpcao, { aoTrocarAlimento: () => undefined }), limite - 1))).toBe(false);
    expect(temCabecalho(montar(umaOpcao))).toBe(false);
  });
});

describe('valoresPorExtenso', () => {
  it('lê kcal e os três macros na ordem da tela, com unidade, e "sem dado" no que falta (nunca o traço)', () => {
    expect(valoresPorExtenso({ kcal: 233.4, proteina: 10.24, carboidrato: 34.8, gordura: null })).toBe('233 kcal, proteína 10,2 g, carboidrato 34,8 g, gordura sem dado');
    expect(valoresPorExtenso({ kcal: null, proteina: 0, carboidrato: 1, gordura: 2 })).toBe('kcal sem dado, proteína 0,0 g, carboidrato 1,0 g, gordura 2,0 g');
  });
});

describe('CartaoRefeicao: subtotal e cor (C66, C63)', () => {
  const grupo = (a: Arvore, rotulo: string) => a.root.findAll((n) => n.props['aria-label'] === rotulo && typeof n.type === 'string');
  const cartao = (a: Arvore) => a.root.findAll((n) => n.props.testID === 'cartao' && typeof n.type === 'string')[0];

  it('o subtotal da opção A aparece aberta e fechada; com uma opção, é o da refeição', () => {
    expect(grupo(montar(refeicao()), 'Subtotal da refeição, opção A')).toHaveLength(1);
    expect(grupo(montar(refeicao(), { aberta: false }), 'Subtotal da refeição, opção A')).toHaveLength(1);
    const uma = refeicao({ opcoes: [{ uid: 'a', rotulo: 'A', itens: [item('i1', 'Suco fictício')] }] });
    expect(grupo(montar(uma), 'Subtotal da refeição')).toHaveLength(1);
  });

  it('a barra lateral segue a posição da refeição (1ª magenta, 2ª índigo)', () => {
    const borda = (posicao: number) => {
      const estilo = cartao(montar(refeicao(), { posicao })).props.style;
      return Object.assign({}, ...(Array.isArray(estilo) ? estilo.flat(5) : [estilo]).filter(Boolean));
    };
    expect(borda(0)).toMatchObject({ borderLeftWidth: 6, borderLeftColor: '#F07AC8' });
    expect(borda(1)).toMatchObject({ borderLeftWidth: 6, borderLeftColor: '#A196F5' });
  });

  it('a cor da 1ª e da 2ª refeição nunca é a de um macro (P, C ou G)', () => {
    const doMacro = new Set<string>(MACROS.map((m) => m.cor));
    expect(doMacro.has(corDaRefeicao(0))).toBe(false);
    expect(doMacro.has(corDaRefeicao(1))).toBe(false);
    expect(corDaRefeicao(0)).not.toBe(MACROS.find((m) => m.curto === 'P')?.cor);
  });

  it('o subtotal e o total da opção têm uma frase só para o leitor, com rótulo e valores por extenso', () => {
    const a = montar(refeicao());
    const textos = a.root.findAllByType(Text).map(textoDoNo);
    expect(textos).toContain('Subtotal da refeição, opção A: 50 kcal, proteína 1,0 g, carboidrato 10,0 g, gordura 0,0 g, fibra sem dado');
    expect(textos).toContain('Total da opção A: 50 kcal, proteína 1,0 g, carboidrato 10,0 g, gordura 0,0 g, fibra sem dado');
    tocar(a, 'Opção B, 50 kcal');
    expect(a.root.findAllByType(Text).map((t) => t.props.children)).toContain('Total da opção B: 50 kcal, proteína 1,0 g, carboidrato 10,0 g, gordura 0,0 g, fibra sem dado');
  });
});

describe('grade dos valores do item manual (25/11)', () => {
  it('cinco numa linha quando cabem; senão 3 + 2; no limite, 2', () => {
    expect(colunasDosValores(392)).toBe(5);
    expect(colunasDosValores(391)).toBe(3);
    expect(colunasDosValores(232)).toBe(3);
    expect(colunasDosValores(231)).toBe(2);
  });
  it('as células têm a mesma largura (arredondada para baixo) e param em 120 px', () => {
    expect(larguraDoValor(392, 5)).toBe(72);
    expect(larguraDoValor(250, 3)).toBe(78);
    expect(larguraDoValor(1200, 5)).toBe(120);
    expect(larguraDoValor(0, 2)).toBe(0);
  });
});

describe('CartaoRefeicao: fibra (V089, 18/11)', () => {
  it('o item manual tem o campo "Fibras (g)"; o da biblioteca não (a fibra vem calculada nos valores)', () => {
    const daBiblioteca: ItemDieta = { ...item('i3', 'Pão fictício'), alimentoId: 'al-i3', manual: false, fibra: 2.5 };
    const semFibra: ItemDieta = { ...daBiblioteca, uid: 'i4', alimentoId: 'al-i4', nome: 'Ovo fictício', fibra: null };
    const a = montar(refeicao({ opcoes: [{ uid: 'a', rotulo: 'A', itens: [item('i1', 'Suco fictício'), daBiblioteca, semFibra] }] }));
    expect(comRotulo(a, 'campo Fibras (g)')).toHaveLength(1);
    const textos = a.root.findAllByType(Text).map(textoDoNo);
    expect(textos).toContain('Fibra 2,5 g');
    expect(textos).toContain('Fibra —');
  });

  it('total com item sem fibra é parcial, no visível e no leitor', () => {
    const comFibra = { ...item('i1', 'Suco fictício'), fibra: 3 };
    const a = montar(refeicao({ opcoes: [{ uid: 'a', rotulo: 'A', itens: [comFibra, item('i2', 'Leite fictício')] }] }));
    const textos = a.root.findAllByType(Text).map(textoDoNo);
    expect(textos).toContain('Fibra 3,0 g (parcial)');
    expect(textos).toContain('Total da opção A: 100 kcal, proteína 2,0 g, carboidrato 20,0 g, gordura 0,0 g, fibra 3,0 g, parcial');
  });
});
