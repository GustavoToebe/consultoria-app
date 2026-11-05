import { useState } from 'react';

import type { Carga, ExercicioPlano, Serie } from '../api/tipos';
import { carga, exercicio as exercicioDeTeste, serie as serieDeTeste } from '../dominio/exemplosDeTreino.apoioTeste';
import { TEXTO_CARGA_ILEGIVEL } from '../dominio/modoDeCarga';
import type { RegistroLocal } from '../offline/repositorioLocal';
import { ExercicioAluno, type DadosSerie } from './ExercicioAluno';

/**
 * Série com forma de carga que o app não conhece (treinador mais novo que o app instalado): o cartão real não oferece o
 * campo de peso, não sugere carga, mostra "Carga: atualize o app para ver" uma vez e o ✓ grava a série com a carga em
 * branco. Mesmo harness do `ExercicioAluno.cargas.test.tsx`, sem refatorar a tela.
 */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../ui/useMovimentoReduzido', () => ({ useMovimentoReduzido: () => true }));
jest.mock('../ui/vibrar', () => ({ vibrar: { leve: () => undefined, sucesso: () => undefined } }));
jest.mock('../ui/Aviso', () => ({ useAviso: () => ({ avisar: () => undefined }) }));
jest.mock('@rn-primitives/label', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/switch', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/slot', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/portal', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/alert-dialog', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/tabs', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/toggle', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/toggle-group', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('../ui/Botao', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Botao: ({ rotuloAcessivel, rotulo, aoTocar }: { rotuloAcessivel?: string; rotulo: string; aoTocar: () => void }) => require('react-native').Pressable && require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotuloAcessivel ?? rotulo, onPress: aoTocar }),
}));
jest.mock('./SeloComExplicacao', () => ({ SeloComExplicacao: () => null }));
jest.mock('./TipoDaSerieComExplicacao', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  TipoDaSerieComExplicacao: ({ nome }: { nome: string }) => require('react').createElement(require('react-native').Text, null, nome),
}));
jest.mock('../tema/TemaProvider', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useTema: () => ({ cores: require('../tema/tokens').ESCURO, identificacao: require('../tema/tokens').coresDeIdentificacao(require('../tema/tokens').ESCURO, true), bordas: { bloco: 2, item: 2 }, marca: '#E11D48', sobreMarca: '#FFFFFF', fatorTexto: 1, preferencias: { animacoes: false } }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');

const CONFIG = { arredondamentoKg: 0.5, tipoTrabalho: 'WS' };
const DATA = '2026-11-02';

/** Forma de carga que só existe em tempo de execução: o tipo `Carga['modo']` não a conhece. */
const desconhecida = { modo: 'MODO_QUE_NAO_EXISTE', percentualMin: 80, percentualMax: null, chaveNova: 1 } as unknown as Carga;
const ws = (uid: string): Serie => serieDeTeste(uid, { tipo: 'WORKING', repsMin: 3, repsMax: 6, carga: carga('CARGA_TRABALHO') });
const nova = (uid: string, extra: Partial<Serie> = {}): Serie => serieDeTeste(uid, { tipo: 'BACK_OFF', repsMin: 6, repsMax: 8, carga: desconhecida, ...extra });
const treino = (...series: Serie[]): ExercicioPlano => exercicioDeTeste('ex', { exercicioId: 'x', nome: 'Remada', modalidade: 'MAQUINA', series });

type Gravacao = { serieUid: string; dados: DadosSerie };

function Harness({ exercicio, gravacoes }: { exercicio: ExercicioPlano; gravacoes: Gravacao[] }) {
  const [registros, setRegistros] = useState<Map<string, RegistroLocal>>(new Map());
  return (
    <ExercicioAluno
      exercicio={exercicio}
      data={DATA}
      cargaDoDia={40}
      ultima={null}
      registroDe={(uid) => registros.get(uid)}
      config={CONFIG}
      aoMudarCargaDoDia={() => undefined}
      aoRegistrar={(serieUid, dados) => {
        gravacoes.push({ serieUid, dados });
        setRegistros((antes) => new Map(antes).set(serieUid, {
          id: `r-${serieUid}`,
          planoVersaoId: 'v1',
          sessaoUid: 's1',
          exercicioUid: 'ex',
          serieUid,
          exercicioId: 'x',
          trabalho: false,
          data: DATA,
          carga: dados.carga,
          repeticoes: dados.repeticoes,
          concluida: dados.concluida,
          observacao: null,
          etapas: dados.etapas ?? null,
          referenciaCarga: dados.referenciaCarga ?? null,
          referenciaOrigem: dados.referenciaOrigem ?? null,
          alteradoEm: '2026-11-02T12:00:00.000Z',
          situacao: 'LOCAL',
          motivo: null,
        }));
      }}
      chaveDaExecucao={(uid) => `v1|${uid}|${DATA}`}
    />
  );
}

type Arvore = import('react-test-renderer').ReactTestRenderer;
const montados: Arvore[] = [];
afterEach(async () => {
  await Renderer.act(async () => {
    montados.splice(0).forEach((m) => m.unmount());
  });
});

const juntar = (filhos: unknown): string => (Array.isArray(filhos) ? filhos.map(juntar).join('') : typeof filhos === 'string' || typeof filhos === 'number' ? String(filhos) : filhos && typeof filhos === 'object' && 'props' in filhos ? juntar((filhos as { props: { children?: unknown } }).props.children) : '');

async function montar(exercicio: ExercicioPlano) {
  const gravacoes: Gravacao[] = [];
  let arvore!: Arvore;
  await Renderer.act(async () => {
    arvore = Renderer.create(<Harness exercicio={exercicio} gravacoes={gravacoes} />);
    montados.push(arvore);
  });
  const com = (rotulo: string) => arvore.root.findAll((x) => x.props.accessibilityLabel === rotulo);
  /** Todo texto visível, em ordem (os `Text` aninhados viram uma frase só). */
  const textos = () => arvore.root.findAll((x) => (x.type as unknown) === 'Text' && (x.parent?.type as unknown) !== 'Text').map((n) => juntar(n.props.children));
  return {
    gravacoes,
    textos,
    temCampo: (rotulo: string) => com(rotulo).some((x) => typeof x.props.onChangeText === 'function'),
    marcar: (rotulo: string) => Renderer.act(async () => {
      const alvo = com(rotulo).find((x) => typeof x.props.onPress === 'function');
      if (!alvo) throw new Error(`Sem "${rotulo}" na tela`);
      alvo.props.onPress();
    }),
    /** Quantas vezes o texto da carga ilegível aparece na tela. */
    vezesDoTexto: () => textos().filter((x) => x.includes(TEXTO_CARGA_ILEGIVEL)).length,
  };
}

describe('série com forma de carga que o app não conhece', () => {
  it('sem campo de peso, sem sugestão, o texto uma vez; a série legível ao lado segue normal', async () => {
    const t = await montar(treino(ws('w'), nova('n')));
    expect(t.temCampo('Peso da série 1, em quilos')).toBe(true);
    expect(t.temCampo('Peso da série 2, em quilos')).toBe(false);
    expect(t.vezesDoTexto()).toBe(1);
    const depoisDaSerie2 = t.textos().slice(t.textos().indexOf('Série 2'));
    expect(depoisDaSerie2.some((x) => x.startsWith('Sugestão'))).toBe(false);
    expect(t.textos().some((x) => x.startsWith('Sugestão: 40 kg'))).toBe(true); // a série legível ao lado segue com a dica
  });

  it('o ✓ continua funcionando e grava a série com a carga em branco', async () => {
    const t = await montar(treino(nova('n')));
    expect(t.temCampo('Peso da série 1, em quilos')).toBe(false);
    await t.marcar('Série 1 feita');
    expect(t.gravacoes).toEqual([{ serieUid: 'n', dados: { carga: null, repeticoes: null, concluida: true } }]);
  });

  it('marcar e desmarcar nunca leva carga', async () => {
    const t = await montar(treino(nova('n')));
    await t.marcar('Série 1 feita');
    await t.marcar('Série 1 feita');
    expect(t.gravacoes).toHaveLength(2);
    expect(t.gravacoes.every((g) => g.dados.carga === null)).toBe(true);
    expect(t.gravacoes.map((g) => g.dados.concluida)).toEqual([true, false]);
  });

  it('a série legível anterior, já registrada, não passa a carga dela para a série ilegível', async () => {
    const t = await montar(treino(ws('w'), nova('n')));
    await t.marcar('Série 1 feita'); // campo vazio com sugestão: abre o painel (D2)
    await t.marcar('Sim, 40 kg, série 1');
    expect(t.gravacoes.at(-1)?.dados.carga).toBe(40);
    expect(t.temCampo('Peso da série 2, em quilos')).toBe(false);
    expect(t.textos().some((x) => x.startsWith('Repetir'))).toBe(false);
    await t.marcar('Série 2 feita');
    expect(t.gravacoes.at(-1)).toEqual({ serieUid: 'n', dados: { carga: null, repeticoes: null, concluida: true } });
  });

  it('série com etapas (Cluster): sem peso nas etapas, o texto uma vez, e marcar o bloco não leva carga', async () => {
    const cluster = nova('c', {
      tipo: 'WORKING',
      repsMin: 6,
      repsMax: 6,
      tecnica: { tipo: 'CLUSTER', blocos: [4, 2], pausaSegundos: 15, cargasDosBlocos: [{ modo: 'DA_SERIE', percentual: null }, { modo: 'PERCENTUAL_WS', percentual: 90 }] },
    });
    const t = await montar(treino(ws('w'), cluster));
    expect(t.temCampo('Peso, bloco 1 da série 2, em quilos')).toBe(false);
    expect(t.temCampo('Peso, bloco 2 da série 2, em quilos')).toBe(false);
    expect(t.temCampo('Repetições feitas, bloco 1 da série 2')).toBe(true);
    expect(t.vezesDoTexto()).toBe(1);
    await t.marcar('Bloco 1 feito, série 2');
    const gravada = t.gravacoes.at(-1)!;
    expect(gravada.serieUid).toBe('c');
    expect(gravada.dados.carga).toBeNull();
    expect(gravada.dados.referenciaCarga ?? null).toBeNull();
    expect((gravada.dados.etapas ?? []).length).toBeGreaterThan(0);
    expect((gravada.dados.etapas ?? []).every((e) => e.carga === null)).toBe(true);
  });
});
