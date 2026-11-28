/* eslint-disable @typescript-eslint/no-require-imports */
import type { Tecnica } from '../../api/tipos';
import { CamposDaTecnica } from './CamposDaTecnica';

/**
 * Os blocos do Cluster na série aberta (SERIE-ABERTA.md, seção 3), com o pai de verdade no meio: o `aoMudar` grava a
 * técnica num estado e ela volta como prop a cada render, como no editor (`aoAlterar({ tecnica })`). O defeito de 27/11
 * só aparecia assim: refazer o modo pelo formato da lista que voltava fazia "Blocos diferentes" com 5-5-5-5 virar "5×5"
 * ao somar um bloco, o campo pulava para "Blocos iguais" e os campos B1…B5 sumiam. Vermelho conferido trocando o eco do
 * `CampoDosBlocos` por `modoInicialDosBlocos(valor)` (o comportamento antigo): o caso "+ em Blocos diferentes" falha.
 */
jest.mock('../../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../../tema/tokens').ESCURO, bordas: { bloco: 2, item: 2 }, fatorTexto: 1, preferencias: { animacoes: false } }),
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@rn-primitives/switch', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/label', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/slot', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('../../ui/Calendario', () => ({ BotaoCalendario: () => null, Calendario: () => null }));
jest.mock('../../ui/EscolhaSuspensa', () => ({ EscolhaSuspensa: () => null }));
jest.mock('../../ui/Botao', () => ({
  Botao: ({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) =>
    require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotulo, onPress: aoTocar }),
}));
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

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const React = require('react') as typeof import('react');

type Raiz = import('react-test-renderer').ReactTestRenderer;

function montar(inicial: Tecnica) {
  const gravados: Tecnica[] = [];
  function Pai() {
    const [t, setT] = React.useState(inicial);
    return <CamposDaTecnica tecnica={t} aoMudar={(nova) => { gravados.push(nova); setT(nova); }} />;
  }
  let raiz!: Raiz;
  Renderer.act(() => { raiz = Renderer.create(<Pai />); });
  // O primeiro achado é o `Pressable` (o hospedeiro dele não tem `onPress`).
  const comNome = (nome: string) => raiz.root.findAll((x) => x.props.accessibilityLabel === nome && typeof x.props.onPress === 'function')[0];
  const tocar = (nome: string) => Renderer.act(() => comNome(nome).props.onPress());
  const campos = () => raiz.root.findAll((x) => typeof x.type === 'string' && typeof x.props.onChangeText === 'function' && /^Bloco \d+$/.test(x.props.accessibilityLabel ?? ''));
  const campo = (nome: string) => raiz.root.find((x) => typeof x.type === 'string' && typeof x.props.onChangeText === 'function' && x.props.accessibilityLabel === nome);
  const digitar = (nome: string, texto: string) => Renderer.act(() => campo(nome).props.onChangeText(texto));
  const textos = () => raiz.root.findAll((x) => typeof x.type === 'string' && typeof x.props.children === 'string').map((x) => x.props.children as string);
  const ultimo = () => gravados[gravados.length - 1];
  return { raiz, tocar, comNome, campos, campo, digitar, textos, ultimo, gravados };
}

const cluster = (parte: Partial<Tecnica> = {}): Tecnica => ({ tipo: 'CLUSTER', blocos: [5, 5, 5, 5], pausaSegundos: 15, pausaRespiracoes: null, ...parte });
const valores = (c: ReturnType<typeof montar>) => c.campos().map((x) => x.props.value as string);

describe('Blocos do Cluster: + e − atualizam na hora (defeito de 27/11)', () => {
  it('+ em "Blocos diferentes" com 5-5-5-5: entra o B5 = 5, focado, e o modo, o resumo e o texto acompanham', () => {
    const c = montar(cluster());
    c.tocar('Distribuição dos blocos: Blocos diferentes');
    expect(valores(c)).toEqual(['5', '5', '5', '5']);
    c.tocar('Adicionar um bloco');
    expect(c.ultimo().blocos).toEqual([5, 5, 5, 5, 5]);
    // O modo não volta para "iguais" pelo formato da lista (era o defeito): os cinco campos ficam na tela.
    expect(valores(c)).toEqual(['5', '5', '5', '5', '5']);
    expect(c.comNome('Distribuição dos blocos: Blocos diferentes').props.accessibilityState.selected).toBe(true);
    expect(c.campo('Bloco 5').props.autoFocus).toBe(true);
    expect(c.textos()).toContain('5 blocos · 25 reps por série');
    expect(c.textos()).toContain('Digitar como texto (5-5-5-5-5)');
  });

  it('− tira o último e editar um bloco grava a lista; o resumo segue cada passo', () => {
    const c = montar(cluster({ blocos: [5, 5, 5, 5, 5] }));
    c.tocar('Distribuição dos blocos: Blocos diferentes');
    c.tocar('Remover um bloco');
    expect(c.ultimo().blocos).toEqual([5, 5, 5, 5]);
    expect(valores(c)).toEqual(['5', '5', '5', '5']);
    expect(c.textos()).toContain('4 blocos · 20 reps por série');
    c.digitar('Bloco 2', '3');
    expect(c.ultimo().blocos).toEqual([5, 3, 5, 5]);
    expect(valores(c)).toEqual(['5', '3', '5', '5']);
    expect(c.textos()).toContain('4 blocos · 18 reps por série');
    expect(c.textos()).toContain('Digitar como texto (5-3-5-5)');
    // Bloco novo nasce com as repetições do último.
    c.tocar('Adicionar um bloco');
    expect(c.ultimo().blocos).toEqual([5, 3, 5, 5, 5]);
  });

  it('em "Blocos iguais" o campo único vale para todos e o "× N blocos" acompanha + e −', () => {
    const c = montar(cluster());
    expect(c.textos()).toContain('× 4 blocos');
    c.digitar('Repetições em cada bloco', '3');
    expect(c.ultimo().blocos).toEqual([3, 3, 3, 3]);
    c.tocar('Adicionar um bloco');
    expect(c.ultimo().blocos).toEqual([3, 3, 3, 3, 3]);
    expect(c.textos()).toContain('× 5 blocos');
    expect(c.textos()).toContain('5 blocos · 15 reps por série');
    c.tocar('Remover um bloco');
    c.tocar('Remover um bloco');
    expect(c.ultimo().blocos).toEqual([3, 3, 3]);
    expect(c.textos()).toContain('× 3 blocos');
  });

  it('a carga de cada bloco acompanha a quantidade (o pai ajusta a lista pelo `ajustarCargasDosBlocos`)', () => {
    const c = montar(cluster({ blocos: [4, 4], cargasDosBlocos: [{ modo: 'DA_SERIE', percentual: null }, { modo: 'PERCENTUAL_WS', percentual: 90 }] }));
    c.tocar('Adicionar um bloco');
    expect(c.ultimo().blocos).toEqual([4, 4, 4]);
    expect(c.ultimo().cargasDosBlocos).toEqual([{ modo: 'DA_SERIE', percentual: null }, { modo: 'PERCENTUAL_WS', percentual: 90 }, { modo: 'DA_SERIE', percentual: null }]);
    c.tocar('Remover um bloco');
    expect(c.ultimo().cargasDosBlocos).toHaveLength(2);
  });

  it('nos limites o botão do lado trava: − com 2 blocos e + com 10', () => {
    const minimo = montar(cluster({ blocos: [4, 4] }));
    expect(minimo.comNome('Remover um bloco').props.disabled).toBe(true);
    const maximo = montar(cluster({ blocos: Array.from({ length: 10 }, () => 4) }));
    expect(maximo.comNome('Adicionar um bloco').props.disabled).toBe(true);
    expect(maximo.textos()).toContain('Máximo de 10 blocos.');
  });

  it('bloco com texto inválido não grava a lista anterior e trava o +', () => {
    const c = montar(cluster());
    c.tocar('Distribuição dos blocos: Blocos diferentes');
    c.digitar('Bloco 3', '1.5');
    expect(c.ultimo().blocos).toBeNull();
    expect(c.comNome('Adicionar um bloco').props.disabled).toBe(true);
    expect(c.textos()).toContain('Use só números inteiros.');
  });

  it('o texto digitado ("Digitar como texto") troca os campos, nos dois sentidos', () => {
    const c = montar(cluster());
    c.tocar('Digitar como texto (5-5-5-5)');
    c.digitar('Blocos de repetições', '4+2');
    expect(c.ultimo().blocos).toEqual([4, 2]);
    expect(valores(c)).toEqual(['4', '2']);
    c.tocar('Adicionar um bloco');
    expect(c.campo('Blocos de repetições').props.value).toBe('4-2-2');
  });
});

describe('Pausa entre blocos', () => {
  it('dois campos fixos: cada um grava só o seu valor, e a dica diz o que o aluno lê', () => {
    const c = montar(cluster());
    expect(c.campo('Pausa entre blocos (s)').props.value).toBe('15');
    expect(c.textos()).toContain('O aluno vê "15 s".');
    c.digitar('Pausa entre blocos em respirações', '3');
    expect(c.textos()).toContain('O aluno vê "15 s ou 3 respirações". Deixe as respirações em branco para usar só o tempo.');
    expect(c.ultimo()).toMatchObject({ pausaSegundos: 15, pausaRespiracoes: 3, blocos: [5, 5, 5, 5] });
    c.digitar('Pausa entre blocos (s)', '');
    expect(c.ultimo()).toMatchObject({ pausaSegundos: null, pausaRespiracoes: 3 });
    expect(c.textos()).toContain('O aluno vê "3 respirações".');
  });
});
