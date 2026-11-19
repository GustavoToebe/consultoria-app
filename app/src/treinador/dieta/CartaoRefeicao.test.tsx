import { useState } from 'react';
import { Text } from 'react-native';

import type { ItemDieta, Refeicao } from '../../api/tipos';
import { corDaRefeicao } from '../../dominio/corDaSerie';
import { MODO_DE_PREPARO_MAXIMO } from '../../dominio/dieta';
import { MACROS, valoresPorExtenso } from '../../ui/ValoresDaDieta';
import { CartaoRefeicao, larguraDaTabela } from './CartaoRefeicao';

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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Botao: ({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) => require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotulo, onPress: aoTocar }),
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
jest.mock('../FolhaDeAcoes', () => ({ FolhaDeAcoes: () => null }));
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
    TabsTrigger: function Aba({ children, value, accessibilityLabel, accessibilityState }: MockFilhos & { value: string; accessibilityLabel: string; accessibilityState: object }) {
      const aoMudar = React.useContext(Contexto);
      return React.createElement(Pressable, { accessibilityRole: 'tab', accessibilityLabel, accessibilityState, onPress: () => aoMudar(value) }, children);
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

  it('com uma opção só: sem abas nem comparação, só o "+ Opção"', () => {
    const a = montar(refeicao({ opcoes: [{ uid: 'a', rotulo: 'A', itens: [item('i1', 'Suco fictício')] }] }));
    expect(abas(a)).toEqual([]);
    expect(comRotulo(a, 'Opção')).toHaveLength(1);
    expect(a.root.findAll((n) => n.props['aria-label'] === 'Comparação das opções')).toHaveLength(0);
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

  it('"+ Opção" cria a opção e ela abre selecionada', () => {
    const a = montar(tres());
    tocar(a, 'Opção');
    expect(abas(a)).toHaveLength(4);
    expect(abaAberta(a)).toEqual(['Opção D, vazia']);
  });

  it('excluir pede confirmação só com itens; a aberta excluída abre a vizinha', () => {
    const aoRemoverOpcao = jest.fn();
    const a = montar(tres(), { aoRemoverOpcao });
    tocar(a, 'Opção B, 50 kcal');
    tocar(a, 'Excluir opção');
    expect(aoRemoverOpcao).not.toHaveBeenCalled();
    tocar(a, 'confirmar Excluir opção');
    expect(aoRemoverOpcao).toHaveBeenCalledWith(1);
    expect(abaAberta(a)).toEqual(['Opção C, vazia']);
    // A C está vazia: sai sem perguntar; com uma opção só, as abas somem.
    tocar(a, 'Excluir opção');
    expect(aoRemoverOpcao).toHaveBeenLastCalledWith(1);
    expect(abas(a)).toEqual([]);
  });

  it('a opção com problema da validação abre sozinha e a aba avisa', () => {
    const a = montar(tres(), { comProblema: new Set(['r1', 'b', 'i3']) });
    expect(abaAberta(a)).toEqual(['Opção B, 50 kcal, com problema a corrigir']);
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
    for (const titulo of ['#', 'Quantidade', 'Unidade', 'Kcal', 'P (g)', 'C (g)', 'G (g)', 'Fibras (g)']) expect(textos(a)).toContain(titulo);
    const cabecalho = a.root.findAll((n) => typeof n.type === 'string' && n.props['aria-hidden'] && n.findAll((f) => f.props.children === 'Alimento').length > 0);
    expect(cabecalho.length).toBeGreaterThan(0);
    // O item da biblioteca: número solto na coluna e uma frase só para o leitor.
    expect(textos(a)).toContain('1,0 g');
    expect(textos(a)).toContain('Pão fictício: 50 kcal, proteína 1,0 g, carboidrato 10,0 g, gordura 0,0 g, fibra sem dado');
    expect(textos(a)).toContain('Trocar alimento');
    // O total da opção embaixo das colunas: os números soltos, a frase só para o leitor.
    expect(textos(a)).toContain('100');
    expect(textos(a)).toContain('Total da opção A: 100 kcal, proteína 2,0 g, carboidrato 20,0 g, gordura 0,0 g, fibra sem dado');
  });

  it('larga, os campos mantêm os nomes de hoje (quantidade, unidade e os valores do item manual)', () => {
    const a = comLargura(montar(umaOpcao), 1200);
    expect(comRotulo(a, 'campo Quantidade')).toHaveLength(2);
    expect(comRotulo(a, 'suspensa Unidade: ml')).toHaveLength(2);
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
    const textos = a.root.findAllByType(Text).map((t) => t.props.children);
    expect(textos).toContain('Subtotal da refeição, opção A: 50 kcal, proteína 1,0 g, carboidrato 10,0 g, gordura 0,0 g, fibra sem dado');
    expect(textos).toContain('Total da opção A: 50 kcal, proteína 1,0 g, carboidrato 10,0 g, gordura 0,0 g, fibra sem dado');
    tocar(a, 'Opção B, 50 kcal');
    expect(a.root.findAllByType(Text).map((t) => t.props.children)).toContain('Total da opção B: 50 kcal, proteína 1,0 g, carboidrato 10,0 g, gordura 0,0 g, fibra sem dado');
  });
});

describe('CartaoRefeicao: fibra (V089, 18/11)', () => {
  it('o item manual tem o campo "Fibras (g)"; o da biblioteca não (a fibra vem calculada nos valores)', () => {
    const daBiblioteca: ItemDieta = { ...item('i3', 'Pão fictício'), alimentoId: 'al-i3', manual: false, fibra: 2.5 };
    const semFibra: ItemDieta = { ...daBiblioteca, uid: 'i4', alimentoId: 'al-i4', nome: 'Ovo fictício', fibra: null };
    const a = montar(refeicao({ opcoes: [{ uid: 'a', rotulo: 'A', itens: [item('i1', 'Suco fictício'), daBiblioteca, semFibra] }] }));
    expect(comRotulo(a, 'campo Fibras (g)')).toHaveLength(1);
    const textos = a.root.findAllByType(Text).map((t) => t.props.children);
    expect(textos).toContain('Fibra 2,5 g');
    expect(textos).toContain('Fibra —');
  });

  it('total com item sem fibra é parcial, no visível e no leitor', () => {
    const comFibra = { ...item('i1', 'Suco fictício'), fibra: 3 };
    const a = montar(refeicao({ opcoes: [{ uid: 'a', rotulo: 'A', itens: [comFibra, item('i2', 'Leite fictício')] }] }));
    const textos = a.root.findAllByType(Text).map((t) => t.props.children);
    expect(textos).toContain('Fibra 3,0 g (parcial)');
    expect(textos).toContain('Total da opção A: 100 kcal, proteína 2,0 g, carboidrato 20,0 g, gordura 0,0 g, fibra 3,0 g, parcial');
  });
});
