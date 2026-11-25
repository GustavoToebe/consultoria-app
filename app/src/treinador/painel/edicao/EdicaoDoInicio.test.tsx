/* eslint-disable @typescript-eslint/no-require-imports */
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

import type { ItemDaEdicao } from './tipos';
import { EdicaoDoInicio, type PropsDaEdicao } from './EdicaoDoInicio';
import { itensDoMenu } from './MenuDoBloco';

/**
 * Modo de edição do Início (T-012B): as peças com primitivos viram falsas que só repassam nome, estado e toque. Dados
 * fictícios. O `inert` da web não roda aqui (sem DOM): o teste confere os outros três sinais do conteúdo.
 */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../../../ui/useMovimentoReduzido', () => ({ useMovimentoReduzido: () => false }));
jest.mock('@rn-primitives/portal', () => jest.requireActual('../../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('../../../tema/TemaProvider', () => ({
  useTema: () => ({
    cores: require('../../../tema/tokens').CLARO, bordas: { bloco: 1, item: 1 }, fatorTexto: 1,
    preferencias: { larguraConteudo: 'AUTOMATICA', movimento: 'PADRAO' },
  }),
}));
jest.mock('../../../ui/Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));
jest.mock('../../../ui/Botao', () => ({
  Botao: ({ rotulo, rotuloAcessivel, aoTocar }: { rotulo: string; rotuloAcessivel?: string; aoTocar: () => void }) =>
    require('react').createElement(require('react-native').Pressable, { accessibilityRole: 'button', accessibilityLabel: rotuloAcessivel ?? rotulo, onPress: aoTocar }),
}));
jest.mock('../../../components/ui/toggle-group', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  const Contexto = React.createContext(() => undefined);
  return {
    ToggleGroup: ({ children, onValueChange, accessibilityLabel }: { children?: unknown; onValueChange: (v: string) => void; accessibilityLabel: string }) =>
      React.createElement(Contexto.Provider, { value: onValueChange }, React.createElement(View, { accessibilityRole: 'radiogroup', accessibilityLabel }, children)),
    ToggleGroupItem: function Item({ value, accessibilityLabel, accessibilityState }: { value: string; accessibilityLabel: string; accessibilityState: object }) {
      const aoMudar = React.useContext(Contexto);
      return React.createElement(Pressable, { accessibilityRole: 'radio', accessibilityLabel, accessibilityState, onPress: () => aoMudar(value) });
    },
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const item = (id: ItemDaEdicao['id'], titulo: string, posicao: number | null, total: number, extra: Partial<ItemDaEdicao> = {}): ItemDaEdicao => ({
  id, titulo, descricao: `Frase de ${titulo}`, ligado: posicao !== null, posicao, total,
  podeSubir: posicao !== null && posicao > 1, podeDescer: posicao !== null && posicao < total, tamanho: 1, ...extra,
});

const ITENS: ItemDaEdicao[] = [
  item('atualizacoes', 'Atualizações', 1, 3),
  item('agenda', 'Agenda', 2, 3, { tamanho: 2 }),
  item('alunos', 'Alunos', 3, 3, {
    opcoes: [{ chave: 'dias', rotulo: 'Mostrar aniversários de', atual: 7, valores: [{ valor: 0, rotulo: 'Só hoje' }, { valor: 7, rotulo: '7 dias' }] }],
  }),
  item('financeiro', 'Financeiro', null, 3),
];

function montar(extra: Partial<PropsDaEdicao> = {}) {
  const props: PropsDaEdicao = {
    itens: ITENS, colunas: 4, renderConteudo: (id) => <Text>conteúdo {id}</Text>,
    aoMover: jest.fn(), aoMudarTamanho: jest.fn(), aoOcultar: jest.fn(), aoAdicionar: jest.fn(), aoMudarOpcao: jest.fn(), ...extra,
  };
  let r!: ReactTestRenderer;
  act(() => { r = create(<EdicaoDoInicio {...props} />); });
  return { r, props };
}

/** O ⋯ mede o próprio lugar ao abrir: a `View` falsa do Jest não mede, então a medida vem fixa. */
function abrirMenu(r: ReactTestRenderer, titulo: string) {
  const rotulo = `Mais ações de ${titulo}`;
  for (const n of r.root.findAll((x) => x.props.accessibilityLabel === rotulo && x.instance && typeof x.instance.measureInWindow === 'function')) {
    n.instance.measureInWindow = (f: (x: number, y: number, w: number, h: number) => void) => f(0, 0, 44, 44);
  }
  tocar(porRotulo(r, rotulo));
}

const porRotulo = (r: ReactTestRenderer, rotulo: string) => r.root.findAll((n) => n.props.accessibilityLabel === rotulo && typeof n.props.onPress === 'function')[0];
const tocar = (n: ReactTestInstance | undefined) => { if (!n) throw new Error('não achei'); act(() => n.props.onPress()); };
const textos = (r: ReactTestRenderer) => r.root.findAllByType(Text).map((t) => t.props.children).flat().join(' | ');
const regiaoViva = (r: ReactTestRenderer) => r.root.findAll((n) => n.props.role === 'status' && n.props['aria-live'] === 'polite')[0];

describe('EdicaoDoInicio', () => {
  it('P · M · G chama aoMudarTamanho com o tamanho tocado (e nada ao tocar no marcado)', () => {
    const { r, props } = montar();
    tocar(r.root.findAll((n) => n.props.accessibilityLabel === 'Tamanho de Agenda')[0].findAll((n) => n.props.accessibilityLabel === 'Grande' && n.props.onPress)[0]);
    expect(props.aoMudarTamanho).toHaveBeenCalledWith('agenda', 3);
    tocar(r.root.findAll((n) => n.props.accessibilityLabel === 'Tamanho de Agenda')[0].findAll((n) => n.props.accessibilityLabel === 'Médio' && n.props.onPress)[0]);
    expect(props.aoMudarTamanho).toHaveBeenCalledTimes(1);
  });

  it('em 1 coluna (celular) o segmento de tamanho some; em 2 só P e M', () => {
    expect(montar({ colunas: 1 }).r.root.findAll((n) => n.props.accessibilityRole === 'radiogroup')).toHaveLength(0);
    const dois = montar({ colunas: 2 }).r.root.findAll((n) => n.props.accessibilityLabel === 'Tamanho de Agenda')[0];
    expect(dois.findAll((n) => n.props.accessibilityRole === 'radio' && n.props.onPress).map((n) => n.props.accessibilityLabel)).toEqual(['Pequeno', 'Médio']);
  });

  it('Ocultar chama aoOcultar e anuncia para onde o bloco foi', () => {
    const { r, props } = montar();
    tocar(porRotulo(r, 'Ocultar Agenda'));
    expect(props.aoOcultar).toHaveBeenCalledWith('agenda');
    expect(textos(r)).toContain('Agenda saiu do Início. Está em Adicionar blocos.');
  });

  it('o menu ⋯ tem Subir e Descer, desabilitados nos extremos', () => {
    expect(itensDoMenu(ITENS[0]).filter((i) => i.tipo === 'mover').map((i) => [i.rotulo, i.tipo === 'mover' && i.desabilitado])).toEqual([['Subir', true], ['Descer', false]]);
    expect(itensDoMenu(ITENS[2]).filter((i) => i.tipo === 'mover').map((i) => [i.rotulo, i.tipo === 'mover' && i.desabilitado])).toEqual([['Subir', false], ['Descer', true]]);
    const { r } = montar();
    abrirMenu(r, 'Atualizações');
    const subir = r.root.findAll((n) => typeof n.type !== 'string' && n.props.role === 'menuitem' && n.props.accessibilityLabel === 'Subir')[0];
    expect(subir.props.disabled).toBe(true);
    expect(subir.props.accessibilityHint).toBe('Já é o primeiro.');
  });

  it('Descer pelo menu chama aoMover com o índice novo e anuncia "Agenda, posição 3 de 3" na região viva', () => {
    const { r, props } = montar();
    abrirMenu(r, 'Agenda');
    tocar(r.root.findAll((n) => typeof n.type !== 'string' && n.props.role === 'menuitem' && n.props.accessibilityLabel === 'Descer')[0]);
    expect(props.aoMover).toHaveBeenCalledWith('agenda', 2);
    expect(regiaoViva(r).findAllByType(Text).map((t) => t.props.children).join('')).toBe('Agenda, posição 3 de 3');
  });

  it('as opções do bloco vão no menu, com o atual marcado, e chamam aoMudarOpcao', () => {
    const { r, props } = montar();
    abrirMenu(r, 'Alunos');
    expect(r.root.findAll((n) => typeof n.type === 'string' && n.props.role === 'group' && n.props['aria-label'] === 'Mostrar aniversários de')).not.toHaveLength(0);
    const sete = r.root.findAll((n) => typeof n.type !== 'string' && n.props.role === 'menuitemradio' && n.props.accessibilityLabel === '7 dias')[0];
    expect(sete.props.accessibilityState).toEqual({ checked: true });
    tocar(r.root.findAll((n) => typeof n.type !== 'string' && n.props.role === 'menuitemradio' && n.props.accessibilityLabel === 'Só hoje')[0]);
    expect(props.aoMudarOpcao).toHaveBeenCalledWith('alunos', 'dias', 0);
  });

  it('o conteúdo de verdade fica esmaecido, sem toque e fora do leitor de tela', () => {
    const { r } = montar();
    const conteudos = r.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'conteudo-do-bloco');
    expect(conteudos).toHaveLength(3);
    for (const c of conteudos) {
      expect(c.props.pointerEvents).toBe('none');
      expect(c.props['aria-hidden']).toBe(true);
      expect(c.props.importantForAccessibility).toBe('no-hide-descendants');
    }
    expect(textos(r)).toContain('agenda');
  });

  it('"Adicionar blocos" lista nome, descrição e Adicionar dos ocultos; sem ocultos a faixa some', () => {
    const { r, props } = montar();
    expect(textos(r)).toContain('Adicionar blocos');
    expect(textos(r)).toContain('Frase de Financeiro');
    tocar(porRotulo(r, 'Adicionar Financeiro ao Início'));
    expect(props.aoAdicionar).toHaveBeenCalledWith('financeiro');
    expect(regiaoViva(r).findAllByType(Text).map((t) => t.props.children).join('')).toBe('Financeiro, posição 4 de 4');
    expect(textos(montar({ itens: ITENS.slice(0, 3) }).r)).not.toContain('Adicionar blocos');
  });

  it('sem nenhum bloco visível diz como voltar a ter', () => {
    const { r } = montar({ itens: [item('agenda', 'Agenda', null, 0)] });
    expect(textos(r)).toContain('Nenhum bloco no Início. Adicione um abaixo.');
  });
});
