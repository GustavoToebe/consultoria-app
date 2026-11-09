import { useEffect, useState } from 'react';

import type { Configuracao, ExercicioPlano, Serie, UltimaCarga } from '../api/tipos';
import { AVISO_SEM_CARGA } from '../dominio/avisoDaSerie';
import { carga, exercicio as exercicioDeTeste, serie as serieDeTeste } from '../dominio/exemplosDeTreino.apoioTeste';
import { telaParaKg, type UnidadeDeCarga } from '../dominio/unidadeDeCarga';
import type { RegistroLocal } from '../offline/repositorioLocal';
import { ContextoDaUnidadeDeCarga } from '../ui/unidadeDeCargaEmUso';
import { ExercicioAluno, type DadosSerie } from './ExercicioAluno';

/**
 * B1 (reunião de 30/10, Análise 4, N15 "Alterar a WS não parece atualizar o Back off"): o fluxo REAL do cartão da série,
 * estado por estado. Monta o `ExercicioAluno` de verdade dentro de um harness que faz o papel do `AlunoProvider`
 * (registros por série, base do dia), sem refatorar a tela. A fórmula da carga é a de `dominio/cargas.ts`, intocada.
 *
 * Plano do teste: WS (carga de trabalho), Back off 1 e Back off 2 (80% da WS), passo 0,5, base do dia 40.
 *
 * D1/D2 (02/11): a caixa do peso nunca vem preenchida pela sugestão; a sugestão é a dica ao lado do campo ("Sugestão:
 * 32 kg"), lida por `sugestao(n)`. O ✓ com a caixa vazia e com sugestão abre o painel "Fez com 40 kg?" (`escolher`).
 */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../ui/useMovimentoReduzido', () => ({ useMovimentoReduzido: () => true }));
jest.mock('../ui/vibrar', () => ({ vibrar: { leve: () => undefined, sucesso: () => undefined } }));
jest.mock('../ui/Aviso', () => ({ useAviso: () => ({ avisar: () => undefined }) }));
// Primitivos da biblioteca de componentes: o Jest não transforma o JSX deles e o teste só precisa que repassem os filhos.
jest.mock('@rn-primitives/label', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/switch', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/slot', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/portal', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/alert-dialog', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/tabs', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/toggle', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/toggle-group', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
// O `Botao` real vem de uma biblioteca de primitivos que o Jest não transforma; aqui só importa o toque.
jest.mock('../ui/Botao', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Botao: ({ rotuloAcessivel, rotulo, aoTocar }: { rotuloAcessivel?: string; rotulo: string; aoTocar: () => void }) => require('react-native').Pressable && require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotuloAcessivel ?? rotulo, onPress: aoTocar }),
}));
jest.mock('./SeloComExplicacao', () => ({ SeloComExplicacao: () => null }));
// O nome do tipo abre uma `Folha` (gestos nativos); aqui só importa o texto do título.
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
const DATA = '2026-10-30';

const ws = (uid: string): Serie => serieDeTeste(uid, { tipo: 'WORKING', repsMin: 3, repsMax: 6, carga: carga('CARGA_TRABALHO') });
const backOff = (uid: string, p = 80): Serie => serieDeTeste(uid, { tipo: 'BACK_OFF', repsMin: 6, repsMax: 8, carga: carga('PERCENTUAL_WS', p) });
const emPercentual = (uid: string, p = 100): Serie => serieDeTeste(uid, { tipo: 'FEEDER', repsMin: 3, repsMax: 3, carga: carga('PERCENTUAL_WS', p) });
const topSet = (uid: string): Serie => serieDeTeste(uid, { tipo: 'TOP_SET', repsMin: null, repsMax: null, carga: carga('PERCENTUAL_WS', 105) });
const nenhuma = (uid: string): Serie => serieDeTeste(uid, { tipo: 'WARM_UP', carga: carga('NENHUMA') });

const treino = (...series: Serie[]): ExercicioPlano => exercicioDeTeste('ex', { exercicioId: 'x', nome: 'Remada', modalidade: 'MAQUINA', series });

interface Controle {
  /** O que o aparelho guardou (o que o `AlunoProvider` entrega a `registroDe`). */
  registros: Map<string, RegistroLocal>;
  /** Todas as gravações, em ordem (o que iria para a fila de envio). */
  gravacoes: { serieUid: string; dados: DadosSerie }[];
  base: () => number | null;
  mudarVisivel: (visivel: boolean) => void;
  /**
   * No app a gravação é assíncrona (`aluno.registrar` espera o repositório e recarrega; `salvarCargaDeTrabalho` idem): o valor
   * novo chega à tela DEPOIS de a digitação ser entregue. Com `adiar`, o harness segura essas atualizações até `liberar()`.
   */
  adiar: boolean;
  fila: (() => void)[];
}

function Harness({ exercicio, baseInicial, ultima, controle, ponte, metodologia, unidade = 'kg', arredondamentoKg = CONFIG.arredondamentoKg }: { metodologia?: Configuracao; unidade?: UnidadeDeCarga; arredondamentoKg?: number; exercicio: ExercicioPlano; baseInicial: number | null; ultima: UltimaCarga | null; controle: Controle; ponte: (p: { base: number | null; mudarVisivel: (visivel: boolean) => void }) => void }) {
  const [base, setBase] = useState<number | null>(baseInicial);
  const [, forcar] = useState(0);
  const [visivel, setVisivel] = useState(true);
  // A ponte para o teste ler a base e esconder/mostrar a tela (trocar de tela e voltar) só se arma depois da renderização.
  useEffect(() => {
    ponte({ base, mudarVisivel: setVisivel });
  }, [ponte, base]);
  if (!visivel) return null;
  const config = { ...CONFIG, arredondamentoKg };
  return (
    <ContextoDaUnidadeDeCarga.Provider value={unidade}>
    <ExercicioAluno
      exercicio={exercicio}
      data={DATA}
      cargaDoDia={base}
      ultima={ultima}
      registroDe={(uid) => controle.registros.get(uid)}
      config={metodologia ? { ...config, metodologia } : config}
      aoMudarCargaDoDia={(carga) => (controle.adiar ? controle.fila.push(() => setBase(carga)) : setBase(carga))}
      aoRegistrar={(serieUid, dados) => {
        controle.gravacoes.push({ serieUid, dados });
        const gravar = () => controle.registros.set(serieUid, {
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
          etapas: null,
          referenciaCarga: null,
          referenciaOrigem: null,
          alteradoEm: '2026-10-30T12:00:00.000Z',
          situacao: 'LOCAL',
          motivo: null,
        });
        if (controle.adiar) {
          controle.fila.push(() => {
            gravar();
            forcar((n) => n + 1);
          });
        } else {
          gravar();
          forcar((n) => n + 1);
        }
      }}
      chaveDaExecucao={(uid) => `v1|${uid}|${DATA}`}
    />
    </ContextoDaUnidadeDeCarga.Provider>
  );
}

type Arvore = import('react-test-renderer').ReactTestRenderer;
const montados: Arvore[] = [];
afterEach(async () => {
  await Renderer.act(async () => {
    montados.splice(0).forEach((m) => m.unmount());
  });
});

async function montar(exercicio: ExercicioPlano, baseInicial: number | null = 40, ultima: UltimaCarga | null = null, metodologia?: Configuracao, opcoes: { unidade?: UnidadeDeCarga; arredondamentoKg?: number } = {}) {
  const controle: Controle = { registros: new Map(), gravacoes: [], base: () => null, mudarVisivel: () => undefined, adiar: false, fila: [] };
  let arvore!: Arvore;
  await Renderer.act(async () => {
    arvore = Renderer.create(<Harness {...opcoes} metodologia={metodologia} exercicio={exercicio} baseInicial={baseInicial} ultima={ultima} controle={controle} ponte={(p) => { controle.base = () => p.base; controle.mudarVisivel = p.mudarVisivel; }} />);
    montados.push(arvore);
  });
  const achar = (rotulo: string, prop: 'onChangeText' | 'onPress') => {
    const n = arvore.root.findAll((x) => x.props.accessibilityLabel === rotulo && typeof x.props[prop] === 'function')[0];
    if (!n) throw new Error(`Sem "${rotulo}" na tela`);
    return n;
  };
  /** A dica da série `n`, lida no rótulo acessível "Dica da série N: <dica>. <origem>". */
  const dicaDa = (n: number) => {
    const prefixo = `Dica da série ${n}: `;
    const no = arvore.root.findAll((x) => typeof x.props.accessibilityLabel === 'string' && x.props.accessibilityLabel.startsWith(prefixo))[0];
    if (!no) return null;
    return { dica: (no.props.accessibilityLabel as string).slice(prefixo.length) };
  };
  return {
    controle,
    /** Texto que está na caixa do peso da série `n` (1, 2, ...). */
    peso: (n: number, em: 'quilos' | 'libras' = 'quilos') => (achar(`Peso da série ${n}, em ${em}`, 'onChangeText').props.value as string),
    digitarPeso: (n: number, texto: string) => Renderer.act(async () => achar(`Peso da série ${n}, em quilos`, 'onChangeText').props.onChangeText(texto)),
    digitarBase: (texto: string) => Renderer.act(async () => achar('Carga de trabalho do dia', 'onChangeText').props.onChangeText(texto)),
    digitarReps: (n: number, texto: string) => Renderer.act(async () => achar(`Repetições da série ${n}`, 'onChangeText').props.onChangeText(texto)),
    marcar: (n: number) => Renderer.act(async () => achar(`Série ${n} feita`, 'onPress').props.onPress()),
    /** Texto da dica ao lado do campo da série `n` (sem a origem), ou `null` sem dica. */
    dica: (n: number) => dicaDa(n)?.dica ?? null,
    /** A sugestão de peso da série `n` lida na dica ("Sugestão: 32 kg" → '32'); `null` = sem sugestão. */
    sugestao: (n: number) => dicaDa(n)?.dica.match(/Sugestão: ([\d,]+) kg/)?.[1] ?? null,
    /** O aviso do N6 está na tela? */
    avisoSemCarga: () => JSON.stringify(arvore.toJSON()).includes(AVISO_SEM_CARGA),
    /** O painel do ✓ da série `n` está aberto? */
    painel: (n: number) => arvore.root.findAll((x) => x.props.accessibilityLabel === `Sem carga, série ${n}`).length > 0,
    /** Toca uma opção do painel do ✓ da série `n` ("Sim, 40 kg", "Outra carga", "Sem carga"). */
    escolher: (n: number, rotulo: string) => Renderer.act(async () => achar(`${rotulo}, série ${n}`, 'onPress').props.onPress()),
    caixaDaBase: () => arvore.root.findAll((x) => typeof x.props.accessibilityLabel === 'string' && x.props.accessibilityLabel.startsWith('Carga de trabalho do dia') && typeof x.props.onChangeText === 'function')[0]!.props.value as string,
    /** Toca um botão −/+ pelo rótulo acessível ("Aumentar 5 lb em carga de trabalho", "Diminuir 5 lb em peso da série 1"). */
    tocarPasso: (rotulo: string) => Renderer.act(async () => achar(rotulo, 'onPress').props.onPress()),
    temBase: () => arvore.root.findAll((x) => x.props.accessibilityLabel === 'Carga de trabalho do dia').length > 0,
    remontar: async () => {
      await Renderer.act(async () => controle.mudarVisivel(false));
      await Renderer.act(async () => controle.mudarVisivel(true));
    },
    /** Passa a gravação a assíncrona (como no app). */
    adiar: () => {
      controle.adiar = true;
    },
    /** Entrega à tela o que a gravação assíncrona ainda segurava. */
    liberar: () => Renderer.act(async () => controle.fila.splice(0).forEach((f) => f())),
    /** Entrega só a gravação mais antiga ainda segurada (as gravações chegam uma a uma, na ordem). */
    liberarUm: () => Renderer.act(async () => controle.fila.shift()?.()),
    arvore,
  };
}

describe('B1 · o Back off acompanha a WS? (cartão real, estado por estado)', () => {
  it('(1) WS digitada e NÃO confirmada (sem ✓): as séries seguintes seguem a BASE DO DIA, não o que está digitado na WS', async () => {
    const t = await montar(treino(ws('w'), backOff('b1'), backOff('b2')));
    expect([t.peso(1), t.peso(2), t.peso(3)]).toEqual(['', '', '']); // D1: a sugestão nunca vai para a caixa
    expect([t.sugestao(1), t.sugestao(2), t.sugestao(3)]).toEqual(['40', '32', '32']); // base 40 → 80% = 32
    await t.digitarPeso(1, '42');
    expect(t.peso(1)).toBe('42');
    expect([t.sugestao(2), t.sugestao(3)]).toEqual(['32', '32']); // continua na base: a WS ainda não foi registrada
    expect(t.controle.gravacoes).toEqual([]); // digitar sem ✓ não grava nada
  });

  it('(2) primeiro registro (✓ da WS com 42): o Back off passa a sair da WS registrada (80% de 42 = 33,6 → 33,5)', async () => {
    const t = await montar(treino(ws('w'), backOff('b1'), backOff('b2')));
    await t.digitarPeso(1, '42');
    await t.marcar(1);
    expect(t.controle.gravacoes.at(-1)).toMatchObject({ serieUid: 'w', dados: { carga: 42, concluida: true } });
    expect([t.sugestao(2), t.sugestao(3)]).toEqual(['33,5', '33,5']);
    expect([t.peso(2), t.peso(3)]).toEqual(['', '']);
  });

  it('(2b) ✓ da WS sem digitar nada: abre o painel; "Sim, 40 kg" grava a sugestão e o Back off sai dela', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')));
    await t.marcar(1);
    expect(t.controle.gravacoes).toEqual([]); // o ✓ com a caixa vazia não grava no escuro
    expect(t.painel(1)).toBe(true);
    await t.escolher(1, 'Sim, 40 kg');
    expect(t.controle.gravacoes).toEqual([{ serieUid: 'w', dados: { carga: 40, repeticoes: null, concluida: true } }]);
    expect(t.painel(1)).toBe(false);
    expect(t.peso(1)).toBe('40');
    expect(t.sugestao(2)).toBe('32');
  });

  it('(2c) painel: "Sem carga" grava a série feita sem carga, com as repetições digitadas; o Back off segue a base', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')));
    await t.digitarReps(1, '7');
    await t.marcar(1);
    await t.escolher(1, 'Sem carga');
    expect(t.controle.gravacoes).toEqual([{ serieUid: 'w', dados: { carga: null, repeticoes: 7, concluida: true } }]);
    expect(t.sugestao(2)).toBe('32');
  });

  it('(2d) painel: "Outra carga" não grava nada e fecha; digitar a carga também fecha; com carga o ✓ grava direto', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')));
    await t.marcar(1);
    await t.escolher(1, 'Outra carga');
    expect(t.controle.gravacoes).toEqual([]);
    expect(t.painel(1)).toBe(false);
    await t.marcar(1);
    expect(t.painel(1)).toBe(true);
    await t.digitarPeso(1, '45');
    expect(t.painel(1)).toBe(false);
    await t.marcar(1);
    expect(t.controle.gravacoes).toEqual([{ serieUid: 'w', dados: { carga: 45, repeticoes: null, concluida: true } }]);
  });

  it('(3) editar a carga da WS depois de registrada atualiza na hora o Back off que ainda não foi tocado', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')));
    await t.digitarPeso(1, '42');
    await t.marcar(1);
    expect(t.sugestao(2)).toBe('33,5');
    await t.digitarPeso(1, '50');
    expect(t.controle.gravacoes.at(-1)).toMatchObject({ serieUid: 'w', dados: { carga: 50, concluida: true } });
    expect(t.peso(1)).toBe('50');
    expect(t.sugestao(2)).toBe('40'); // 80% de 50
  });

  it('(3b) desmarcar o ✓ da WS mantém a carga na caixa, mas o Back off volta à base do dia (decisão de 31/10)', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')));
    await t.digitarPeso(1, '42');
    await t.marcar(1);
    expect(t.sugestao(2)).toBe('33,5');
    await t.marcar(1); // desmarca: o aluno disse que não fez, a carga dela sai da conta
    expect(t.controle.registros.get('w')).toMatchObject({ carga: 42, concluida: false });
    expect(t.peso(1)).toBe('42');
    expect(t.sugestao(2)).toBe('32');
    await t.marcar(1); // marca de novo (a caixa tem 42: grava direto) e volta a valer
    expect(t.sugestao(2)).toBe('33,5');
  });

  it('(3c) esvaziar a carga da WS registrada devolve o Back off à base do dia', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')));
    await t.digitarPeso(1, '42');
    await t.marcar(1);
    await t.digitarPeso(1, '');
    expect(t.sugestao(2)).toBe('32');
  });

  it('(4) a sugestão da próxima série acompanha a WS, inclusive quando ela muda de novo, sem gravar nada', async () => {
    const t = await montar(treino(ws('w'), backOff('b1'), backOff('b2')));
    await t.digitarPeso(1, '42');
    await t.marcar(1);
    await t.digitarPeso(1, '44');
    expect([t.sugestao(2), t.sugestao(3)]).toEqual(['35', '35']);
    expect(t.controle.registros.has('b1')).toBe(false); // acompanhar não grava nada
  });

  it('(5) a série que o aluno JÁ ajustou à mão preserva o valor; as intocadas seguem vazias, com a dica acompanhando', async () => {
    const t = await montar(treino(ws('w'), backOff('b1'), backOff('b2')));
    await t.digitarPeso(1, '42');
    await t.marcar(1);
    await t.digitarPeso(2, '30');
    await t.digitarPeso(1, '50');
    expect(t.peso(2)).toBe('30'); // manual: preservado
    expect(t.peso(3)).toBe('');
    expect(t.sugestao(3)).toBe('40'); // intocada: 80% de 50
  });

  it('(5b) o aluno que apaga o campo de uma série deixa-a vazia', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')));
    await t.digitarPeso(2, '');
    await t.digitarPeso(1, '50');
    expect(t.peso(2)).toBe('');
  });

  it('(6) série já feita nunca é reescrita nem desmarcada quando a WS ou a base mudam', async () => {
    const t = await montar(treino(ws('w'), backOff('b1'), backOff('b2')));
    await t.digitarPeso(1, '42');
    await t.marcar(1);
    await t.marcar(2);
    await t.escolher(2, 'Sim, 33,5 kg'); // back off 1 feito com 33,5
    expect(t.controle.registros.get('b1')).toMatchObject({ carga: 33.5, concluida: true });
    const antes = t.controle.gravacoes.length;
    await t.digitarPeso(1, '50');
    await t.digitarBase('60');
    expect(t.peso(2)).toBe('33,5');
    expect(t.controle.registros.get('b1')).toMatchObject({ carga: 33.5, concluida: true });
    expect(t.controle.gravacoes.slice(antes).map((g) => g.serieUid)).toEqual(['w']); // só a WS que o aluno editou foi gravada
    expect(t.sugestao(3)).toBe('40'); // a intocada segue a WS (80% de 50)
  });

  it('(7) mudar a base do dia: a WS NÃO registrada e o Back off sobre a base acompanham; com a WS registrada, só a base muda', async () => {
    const a = await montar(treino(ws('w'), backOff('b1')));
    await a.digitarBase('45');
    expect([a.sugestao(1), a.sugestao(2)]).toEqual(['45', '36']);

    const b = await montar(treino(ws('w'), backOff('b1')));
    await b.marcar(1);
    await b.escolher(1, 'Sim, 40 kg'); // WS registrada em 40
    await b.digitarBase('45');
    expect(b.controle.base()).toBe(45);
    expect(b.peso(1)).toBe('40'); // a WS registrada não se mexe
    expect(b.sugestao(2)).toBe('32'); // e o Back off que sai dela também não
  });

  it('(8) exercício SEM base nem histórico: nada é sugerido e a dica diz "Primeira vez"; a primeira carga vem do aluno', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')), null, null);
    expect([t.peso(1), t.peso(2)]).toEqual(['', '']);
    expect([t.sugestao(1), t.sugestao(2)]).toEqual([null, null]);
    expect(t.dica(1)).toBe('Primeira vez: escolha a carga');
    await t.digitarPeso(1, '42');
    await t.marcar(1); // sem sugestão o ✓ grava direto
    expect(t.controle.gravacoes.at(-1)).toMatchObject({ serieUid: 'w', dados: { carga: 42, concluida: true } });
    expect(t.sugestao(2)).toBe('33,5');
  });

  it('(8b) sem a base do dia mas com a última vez: a caixa da base fica vazia e as sugestões saem da última carga', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')), null, { carga: 36, repeticoes: 6, data: '2026-10-23' });
    expect(t.caixaDaBase()).toBe(''); // D1: a última vez é dica, nunca valor numa caixa
    expect([t.peso(1), t.peso(2)]).toEqual(['', '']);
    expect([t.sugestao(1), t.sugestao(2)]).toEqual(['36,5', '29']); // meta 3 a 6 batida em 6: +0,5 kg; 80% de 36 = 28,8 → 29
    expect(t.dica(1)).toContain('Sugestão: 36,5 kg × 3 reps (+0,5 kg) · Última vez: 36 kg × 6');
    expect(t.dica(2)).not.toContain('Última vez'); // a última vez é a da WS: só na série de trabalho
    // A origem diz de onde a conta partiu: a caixa da base está vazia, então não é "da base do dia".
    expect(t.dica(1)).toContain('meta batida na última vez (+0,5 kg pelo arredondamento da metodologia)');
    expect(t.dica(2)).toContain('80% da última vez');
    await t.digitarBase('40');
    expect(t.dica(2)).toContain('80% da base do dia');
  });

  it('(9) % da WS: a WS digitada sem ✓ não vale; registrada, vale como está (e o campo continua editável)', async () => {
    const t = await montar(treino(ws('w'), emPercentual('m')));
    await t.digitarPeso(1, '42');
    expect(t.sugestao(2)).toBe('40');
    await t.marcar(1);
    expect(t.sugestao(2)).toBe('42');
    await t.digitarPeso(2, '41');
    expect(t.peso(2)).toBe('41');
  });

  it('(9d) NENHUMA: a caixa começa vazia e não segue nada', async () => {
    const t = await montar(treino(nenhuma('a'), ws('w')));
    expect(t.peso(1)).toBe('');
    await t.digitarBase('45');
    expect(t.peso(1)).toBe('');
    expect(t.sugestao(1)).toBeNull();
  });

  it('(10) trocar de tela e voltar: o que estava digitado e sem ✓ se perde (volta vazio); o registrado e a base ficam', async () => {
    const t = await montar(treino(ws('w'), backOff('b1'), backOff('b2')));
    await t.digitarBase('44');
    await t.digitarPeso(1, '42'); // só digitado
    await t.digitarPeso(3, '30'); // só digitado
    await t.marcar(2);
    await t.escolher(2, 'Sim, 35 kg'); // back off 1 registrado (sugestão = 80% de 44 = 35,2 → 35)
    await t.remontar();
    expect(t.peso(1)).toBe(''); // o digitado sem ✓ se perdeu
    expect(t.sugestao(1)).toBe('44');
    expect(t.peso(2)).toBe('35'); // o registrado ficou
    expect(t.peso(3)).toBe('');
    expect(t.controle.base()).toBe(44);
  });

  it('o corpo gravado é exatamente o que o aluno digitou ou escolheu: nada mais é inventado', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')));
    await t.digitarPeso(1, '42');
    await t.marcar(1);
    await t.marcar(2);
    await t.escolher(2, 'Sim, 33,5 kg');
    expect(t.controle.gravacoes).toEqual([
      { serieUid: 'w', dados: { carga: 42, repeticoes: null, concluida: true } },
      { serieUid: 'b1', dados: { carga: 33.5, repeticoes: null, concluida: true } },
    ]);
  });
});

describe('B1 · gravação ASSÍNCRONA (como no app): o que a caixa mostra entre a digitação e o fim da gravação', () => {
  // No app, `useSessaoDoDia.registrar` faz `void aluno.registrar(...)`, que espera o repositório e recarrega os registros,
  // e `salvarCargaDeTrabalho` faz `setCargas(await ...)`: o valor novo chega à tela DEPOIS da digitação. Estes testes
  // seguram essa chegada (`adiar`/`liberar`/`liberarUm`) e leem a caixa e a dica no meio.
  //
  // Corrigido (B1): antes, com valor já gravado, a caixa mostrava o gravado antigo até a gravação terminar e a tecla
  // seguinte era somada a ele. Agora a tela guarda o valor digitado como pendente (`dominio/valorPendente`).
  it('(3-assíncrono) editar a WS já registrada: a caixa mostra o que foi digitado; o Back off só acompanha quando a gravação chega', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')));
    await t.digitarPeso(1, '42');
    await t.marcar(1);
    t.adiar();
    await t.digitarPeso(1, '50');
    expect(t.peso(1)).toBe('50');
    expect(t.sugestao(2)).toBe('33,5'); // o Back off ainda não viu a WS nova (a conta usa só o gravado)
    expect(t.controle.gravacoes.at(-1)).toMatchObject({ serieUid: 'w', dados: { carga: 50, concluida: true } });
    await t.liberar();
    expect(t.peso(1)).toBe('50');
    expect(t.sugestao(2)).toBe('40');
  });

  it('(3-assíncrono-b) duas teclas seguidas antes de a gravação terminar: grava 50, nunca 420', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')));
    await t.digitarPeso(1, '42');
    await t.marcar(1);
    t.adiar();
    await t.digitarPeso(1, '5'); // 1ª tecla: o aluno apagou o "42" e digitou "5"
    expect(t.peso(1)).toBe('5');
    await t.digitarPeso(1, `${t.peso(1)}0`); // 2ª tecla: o teclado acrescenta ao que está na caixa
    expect(t.peso(1)).toBe('50');
    expect(t.controle.gravacoes.map((g) => g.dados.carga)).toEqual([42, 5, 50]);
    await t.liberar();
    expect(t.peso(1)).toBe('50');
    expect(t.controle.registros.get('w')?.carga).toBe(50);
    expect(t.controle.registros.get('w')?.concluida).toBe(true); // continua feita: digitar não desmarca
  });

  it('(3-assíncrono-c) "5" e "0" com as gravações chegando uma a uma: o eco do "5" não volta para a caixa', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')));
    await t.digitarPeso(1, '42');
    await t.marcar(1);
    t.adiar();
    await t.digitarPeso(1, '5');
    await t.digitarPeso(1, `${t.peso(1)}0`);
    await t.liberarUm(); // chega a gravação do "5"
    expect(t.peso(1)).toBe('50');
    expect(t.sugestao(2)).toBe('4'); // o Back off acompanha o gravado (80% de 5 = 4), como antes
    await t.liberarUm(); // chega a do "50"
    expect(t.peso(1)).toBe('50');
    expect(t.sugestao(2)).toBe('40');
    expect(t.controle.registros.get('w')?.carga).toBe(50);
  });

  it('(3-assíncrono-d) repetições digitadas com a carga ainda em voo: a gravação das reps leva a carga nova, não a antiga', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')));
    await t.digitarPeso(1, '42');
    await t.marcar(1);
    t.adiar();
    await t.digitarPeso(1, '50');
    await t.digitarReps(1, '6');
    expect(t.controle.gravacoes.at(-1)?.dados).toEqual({ carga: 50, repeticoes: 6, concluida: true });
    await t.liberar();
    expect(t.peso(1)).toBe('50');
    expect(t.controle.registros.get('w')).toMatchObject({ carga: 50, repeticoes: 6 });
  });

  it('(3-assíncrono-e) o registro muda por fora enquanto há um valor pendente: a caixa segue o de fora', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')));
    await t.digitarPeso(1, '42');
    await t.marcar(1);
    t.adiar();
    await t.digitarPeso(1, '50');
    expect(t.peso(1)).toBe('50');
    // Outra gravação (sincronização, outra tela) troca o registro para um valor que este campo nunca mandou.
    t.controle.fila.splice(0);
    const atual = t.controle.registros.get('w')!;
    t.controle.registros.set('w', { ...atual, carga: 47 });
    t.controle.adiar = false;
    await t.digitarBase('41'); // qualquer coisa que redesenhe a tela sem desmontar o cartão
    expect(t.peso(1)).toBe('47');
  });

  it('(7-assíncrono) mudar a base do dia: a caixa da base mostra o digitado; as sugestões mudam quando a gravação chega', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')));
    t.adiar();
    await t.digitarBase('45');
    expect(t.caixaDaBase()).toBe('45');
    expect([t.sugestao(1), t.sugestao(2)]).toEqual(['45', '36']); // N29: recalcula imediatamente a partir de baseNaCaixa
    await t.liberar();
    expect(t.controle.base()).toBe(45);
    expect(t.caixaDaBase()).toBe('45');
    expect([t.sugestao(1), t.sugestao(2)]).toEqual(['45', '36']);
  });

  it('(7-assíncrono-b) base "4" e "5" antes de a gravação chegar: a base fica 45, nunca 405', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')));
    t.adiar();
    await t.digitarBase('4');
    expect(t.caixaDaBase()).toBe('4');
    await t.digitarBase(`${t.caixaDaBase()}5`);
    expect(t.caixaDaBase()).toBe('45');
    await t.liberarUm();
    expect(t.caixaDaBase()).toBe('45');
    await t.liberarUm();
    expect(t.controle.base()).toBe(45);
    expect([t.sugestao(1), t.sugestao(2)]).toEqual(['45', '36']);
  });
});

describe('libras · os botões −/+ andam em libras sobre o número da tela (decisão do Gustavo, 04/11)', () => {
  it('em kg: o passo é o arredondamentoKg, no rótulo e na conta (nada mudou)', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')), 100, null, undefined, { arredondamentoKg: 2.5 });
    await t.tocarPasso('Aumentar 2,5 kg em carga de trabalho');
    expect(t.caixaDaBase()).toBe('102,5');
    await t.tocarPasso('Diminuir 2,5 kg em carga de trabalho');
    await t.tocarPasso('Diminuir 2,5 kg em carga de trabalho');
    expect(t.caixaDaBase()).toBe('97,5');
    await t.tocarPasso('Aumentar 2,5 kg em peso da série 1');
    expect(t.peso(1)).toBe('100'); // sem digitar, parte da sugestão da WS (a base, 97,5) + 2,5
  });

  it('em lb com passo de 2,5 kg: o rótulo diz 5 lb e 100 lb + 5 lb = 105 lb na tela, sem 105,5', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')), telaParaKg(100, 'lb'), null, undefined, { unidade: 'lb', arredondamentoKg: 2.5 });
    expect(t.caixaDaBase()).toBe('100');
    await t.tocarPasso('Aumentar 5 lb em carga de trabalho');
    expect(t.caixaDaBase()).toBe('105');
    expect(t.controle.base()).toBe(telaParaKg(105, 'lb')); // o guardado continua em kg
    await t.tocarPasso('Diminuir 5 lb em carga de trabalho');
    await t.tocarPasso('Diminuir 5 lb em carga de trabalho');
    expect(t.caixaDaBase()).toBe('95');
  });

  it('em lb, o −/+ da série parte do número da tela (a sugestão, se o campo está vazio) e grava kg só ao marcar', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')), telaParaKg(100, 'lb'), null, undefined, { unidade: 'lb', arredondamentoKg: 2.5 });
    expect(t.peso(1, 'libras')).toBe('');
    await t.tocarPasso('Aumentar 5 lb em peso da série 1');
    expect(t.peso(1, 'libras')).toBe('105');
    await t.tocarPasso('Aumentar 5 lb em peso da série 1');
    expect(t.peso(1, 'libras')).toBe('110');
    expect(t.controle.gravacoes).toEqual([]);
    await t.marcar(1);
    expect(t.controle.gravacoes.at(-1)).toMatchObject({ serieUid: 'w', dados: { carga: telaParaKg(110, 'lb'), concluida: true } });
  });

  it('em lb, passo de 0,5 kg vira 2,5 lb (o mínimo)', async () => {
    const t = await montar(treino(ws('w')), telaParaKg(100, 'lb'), null, undefined, { unidade: 'lb', arredondamentoKg: 0.5 });
    await t.tocarPasso('Aumentar 2,5 lb em carga de trabalho');
    expect(t.caixaDaBase()).toBe('102,5');
  });
});

describe('A8/A9 · o cartão da série diz o que é meta, o que é hoje e de onde sai o peso (a conta não muda)', () => {
  /** Todo texto visível da tela, em ordem, para conferir as frases (os `Text` aninhados viram uma frase só). */
  const textos = (t: Awaited<ReturnType<typeof montar>>): string[] =>
    t.arvore.root.findAll((x) => (x.type as unknown) === 'Text' && (x.parent?.type as unknown) !== 'Text').map((n) => {
      const juntar = (filhos: unknown): string => (Array.isArray(filhos) ? filhos.map(juntar).join('') : typeof filhos === 'string' || typeof filhos === 'number' ? String(filhos) : filhos && typeof filhos === 'object' && 'props' in filhos ? juntar((filhos as { props: { children?: unknown } }).props.children) : '');
      return juntar(n.props.children);
    });

  it('a sugestão é dica ao lado do campo, com a origem: base do dia antes do ✓ da WS, WS registrada depois', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')));
    expect(textos(t)).toEqual(expect.arrayContaining(['Sugestão: 40 kg', 'carga da base do dia', 'Sugestão: 32 kg', '80% da base do dia']));
    await t.digitarPeso(1, '42');
    await t.marcar(1);
    expect(textos(t)).toEqual(expect.arrayContaining(['Sugestão: 33,5 kg', '80% da WS registrada nesta sessão']));
    expect(textos(t).some((x) => x.startsWith('Sugestão: 4'))).toBe(false); // série feita não mostra a dica
  });

  it('a WS ainda não marcada como feita avisa que as seguintes só acompanham depois de marcar; o Back off não avisa', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')));
    const aviso = 'As séries seguintes só usam este peso depois que você marcar a série como feita.';
    expect(textos(t).filter((x) => x === aviso)).toHaveLength(1);
    await t.marcar(1);
    await t.escolher(1, 'Sim, 40 kg');
    expect(textos(t)).not.toContain(aviso);
  });

  it('só a série registrada tem selo ("Feita"); "Hoje" e a meta (repetições grandes ao lado do peso) aparecem em cada série', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')));
    expect(textos(t)).not.toContain('Ainda não registrado');
    expect(textos(t)).not.toContain('Feita');
    expect(textos(t).filter((x) => x === 'Hoje')).toHaveLength(2);
    expect(textos(t)).toEqual(expect.arrayContaining(['3 a 6 reps', 'carga de trabalho'])); // D5: repetições e o resto da meta
    await t.digitarPeso(1, '40');
    await t.marcar(1);
    expect(textos(t).filter((x) => x === 'Feita')).toHaveLength(1);
  });

  it('observação do treinador aparece como "Observação desta série", nunca "Alvo extra"', async () => {
    const comObservacao = serieDeTeste('o', { tipo: 'WORKING', repsMin: 3, repsMax: 6, carga: carga('CARGA_TRABALHO'), alvoExtra: 'Segure 2 s embaixo' });
    const t = await montar(treino(comObservacao));
    expect(textos(t)).toContain('Observação desta série: Segure 2 s embaixo');
    expect(textos(t).some((x) => x.includes('Alvo extra'))).toBe(false);
  });

  it('a base do dia explica que é o ponto de partida e que a WS registrada passa a valer', async () => {
    const t = await montar(treino(ws('w'), backOff('b1')));
    expect(textos(t)).toContain('É o ponto de partida do dia. Depois que você registrar a WS nesta sessão (marcando a série como feita), as séries em "% da WS" passam a sair dela.');
  });
});

describe('N6 · série marcada sem kg avisa que não entra no progresso (D3 e D6 da auditoria do aluno)', () => {
  const comTopSetDeTrabalho = { tipos: [{ codigo: 'TOP_SET', nome: 'Top set', papel: 'TRABALHO' }] } as unknown as Configuracao;
  const marcarSemKg = async (t: Awaited<ReturnType<typeof montar>>) => {
    await t.digitarReps(1, '5');
    await t.marcar(1); // sem base e sem sugestão, o ✓ grava direto com o kg vazio
    expect(t.controle.gravacoes.at(-1)).toMatchObject({ dados: { carga: null, repeticoes: 5, concluida: true } });
  };

  it('kg vazio num exercício com carga: o aviso aparece junto da série', async () => {
    const t = await montar(treino(ws('w')), null);
    expect(t.avisoSemCarga()).toBe(false);
    await marcarSemKg(t);
    expect(t.avisoSemCarga()).toBe(true);
  });

  it('Top set que a metodologia marca como TRABALHO também avisa; sem essa marca da metodologia, não', async () => {
    const a = await montar(treino(topSet('t')), null, null, comTopSetDeTrabalho);
    await marcarSemKg(a);
    expect(a.avisoSemCarga()).toBe(true);
    const b = await montar(treino(topSet('t')), null);
    await marcarSemKg(b);
    expect(b.avisoSemCarga()).toBe(false);
  });

  it('reps vazias e kg preenchido: sem aviso', async () => {
    const t = await montar(treino(ws('w')), null);
    await t.digitarPeso(1, '40');
    await t.marcar(1);
    expect(t.controle.gravacoes.at(-1)).toMatchObject({ dados: { carga: 40, repeticoes: null, concluida: true } });
    expect(t.avisoSemCarga()).toBe(false);
  });

  it('exercício sem carga (peso do corpo): sem aviso', async () => {
    const t = await montar({ ...treino(ws('w')), unidade: 'nenhuma' }, null);
    await t.digitarReps(1, '12');
    await t.marcar(1);
    expect(t.controle.gravacoes.at(-1)).toMatchObject({ dados: { carga: null, repeticoes: 12, concluida: true } });
    expect(t.avisoSemCarga()).toBe(false);
  });

  it('N29: ao digitar 50 na base do dia, recalcula imediatamente todas as séries (50%, 75%, 100%, 80%)', async () => {
    const ex = treino(
      serieDeTeste('s1', { tipo: 'WARM_UP', carga: carga('PERCENTUAL_WS', 50) }),
      serieDeTeste('s2', { tipo: 'FEEDER', carga: carga('PERCENTUAL_WS', 75) }),
      ws('s3'),
      backOff('s4', 80),
    );
    const t = await montar(ex, null);
    t.adiar();
    await t.digitarBase('50');
    expect(t.caixaDaBase()).toBe('50');
    expect([t.sugestao(1), t.sugestao(2), t.sugestao(3), t.sugestao(4)]).toEqual(['25', '37,5', '50', '40']);
  });

  it('N29: funciona na prévia chamando aoMudarCargaDoDia', async () => {
    const ex = treino(ws('s1'), backOff('s2', 80));
    let baseCapturada: number | null = null;
    let arvore!: Arvore;
    await Renderer.act(async () => {
      arvore = Renderer.create(
        <ExercicioAluno
          previa
          exercicio={ex}
          data={DATA}
          cargaDoDia={null}
          ultima={null}
          registroDe={() => undefined}
          config={CONFIG}
          aoMudarCargaDoDia={(kg) => { baseCapturada = kg; }}
          aoRegistrar={() => undefined}
          chaveDaExecucao={(uid) => `v1|${uid}|${DATA}`}
        />,
      );
    });
    const achar = arvore.root.findAll((x) => x.props.accessibilityLabel === 'Carga de trabalho do dia' && typeof x.props.onChangeText === 'function')[0];
    await Renderer.act(async () => {
      achar.props.onChangeText('50');
    });
    expect(baseCapturada).toBe(50);
  });
});
