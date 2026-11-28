/* eslint-disable @typescript-eslint/no-require-imports */
import { CircleAlert, CircleCheck } from 'lucide-react-native';

import type { ExercicioPlano } from '../../api/tipos';
import { exercicio, serie } from '../../dominio/exemplosDeTreino.apoioTeste';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
import { ItemDaListaDeExercicios, ListaDeExercicios, seloDoItem } from './ListaDeExercicios';

/** Lista de exercícios (SERIE-ABERTA 0.5 e 0.6): título com a contagem, linha do exercício e o selo "Falta o descanso". */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../../tema/TemaProvider', () => ({ useTema: () => ({ cores: require('../../tema/tokens').ESCURO, fatorTexto: 1 }) }));
jest.mock('../../ui/Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));
jest.mock('./CartaoSessao', () => ({ AdicionarProximoExercicio: () => null }));
// O item visual é do editor (peça compartilhada): aqui só importam as props que a lista monta.
jest.mock('../plano/ItemDaListaDoEditor', () => ({
  ItemDaListaDoEditor: (p: { rotulo: string }) => require('react').createElement(require('react-native').View, { testID: 'item', ...p }),
}));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const RN = require('react-native') as typeof import('react-native');

function propsDoItem(e: ExercicioPlano, extra: Partial<Parameters<typeof ItemDaListaDeExercicios>[0]> = {}) {
  let raiz!: import('react-test-renderer').ReactTestRenderer;
  Renderer.act(() => {
    raiz = Renderer.create(<ItemDaListaDeExercicios exercicio={e} posicao={0} total={7} config={CONFIGURACAO_PADRAO} escolhido={false} comProblema={false} aoEscolher={() => undefined} {...extra} />);
  });
  return raiz.root.findByProps({ testID: 'item' }).props as { selo?: { texto: string; tipo: string }; linha: string; rotulo: string; Icone?: unknown };
}

const comDescanso = (uid: string) => serie(uid, { descansoSegundos: 90 });

describe('seloDoItem', () => {
  const pronto = { tipo: 'sucesso' as const, texto: 'Pronto', Icone: CircleCheck };
  it('só a pendência ganha selo; problema e carga vêm antes do descanso', () => {
    expect(seloDoItem(pronto, false)).toBeUndefined();
    expect(seloDoItem(pronto, true)).toEqual({ tipo: 'atencao', texto: 'Falta o descanso' });
    const problema = { tipo: 'perigo' as const, texto: '1 problema a corrigir', Icone: CircleAlert };
    expect(seloDoItem(problema, true)).toBe(problema);
  });
});

describe('ItemDaListaDeExercicios', () => {
  it('série sem descanso no exercício solto: selo âmbar "Falta o descanso", também no rótulo', () => {
    const p = propsDoItem(exercicio('a', { nome: 'Agachamento livre', series: [comDescanso('s1'), serie('s2')] }));
    expect(p.selo).toEqual({ tipo: 'atencao', texto: 'Falta o descanso' });
    expect(p.rotulo).toBe(`Exercício 1 de 7: Agachamento livre, Falta o descanso. ${p.linha}`);
  });

  it('todas com descanso: sem selo e a linha nova do exercício', () => {
    const p = propsDoItem(exercicio('a', { nome: 'Supino', series: [comDescanso('s1'), comDescanso('s2'), comDescanso('s3')] }));
    expect(p.selo).toBeUndefined();
    expect(p.linha).toBe('3 séries · 3 WS · 90 s');
  });

  it('cardio leva o ícone antes do título e o resumo "Cardio · …"; musculação, sem ícone', () => {
    const cardio = propsDoItem(exercicio('c', { nome: 'Esteira', modalidade: 'CARDIO', unidade: 'nenhuma', series: [serie('b1', { cardio: { duracaoMin: 20, distanciaKm: null, ritmo: null, zona: 2, intervalos: null } })] }));
    expect(cardio.Icone).toEqual(expect.any(Function));
    expect(cardio.linha).toMatch(/^Cardio · /);
    expect(propsDoItem(exercicio('a', { nome: 'Supino', series: [comDescanso('s1')] })).Icone).toBeUndefined();
  });

  it('membro de grupo com descanso só do grupo não acusa; sem a prop, o membro de grupo também não', () => {
    const e = exercicio('a', { grupoUid: 'g', series: [serie('s1')] });
    expect(propsDoItem(e, { descansoPorSerie: false }).selo).toBeUndefined();
    expect(propsDoItem(e).selo).toBeUndefined();
    expect(propsDoItem(e, { descansoPorSerie: true }).selo?.texto).toBe('Falta o descanso');
  });
});

describe('ListaDeExercicios', () => {
  it('título "Exercícios · N" com o total; sem total, sem título', () => {
    const adicionar = { aoNovoExercicio: () => undefined, aoNovoCardio: () => undefined, aoCriarGrupo: () => undefined, motivoSemGrupo: null };
    let raiz!: import('react-test-renderer').ReactTestRenderer;
    Renderer.act(() => { raiz = Renderer.create(<ListaDeExercicios adicionar={adicionar} total={7}><RN.Text>item</RN.Text></ListaDeExercicios>); });
    expect(raiz.root.findAllByType(RN.Text).map((t) => t.props.children)).toEqual(['Exercícios · 7', 'item']);
    Renderer.act(() => { raiz.update(<ListaDeExercicios adicionar={adicionar}><RN.Text>item</RN.Text></ListaDeExercicios>); });
    expect(raiz.root.findAllByType(RN.Text).map((t) => t.props.children)).toEqual(['item']);
  });
});
