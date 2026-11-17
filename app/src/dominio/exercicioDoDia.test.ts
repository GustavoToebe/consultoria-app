import type { ExercicioPlano } from '../api/tipos';
import { chaveDaBaseDoDia, exercicioDoDia, foiTrocado, podeTrocarNoDia, type RegistroDoDia } from './exercicioDoDia';
import { exercicio, serie } from './exemplosDeTreino.apoioTeste';
import { recordesDoExercicio } from './recordesPessoais';
import { ultimaVez } from './seriesAnteriores';

const DATA = '2026-11-16';
const principal: ExercicioPlano = exercicio('e1', {
  exercicioId: 'agacha',
  nome: 'Agachamento',
  videoUrl: 'https://exemplo.com/agacha',
  equipamento: 'Barra',
  series: [serie('s1'), serie('s2')],
  alternativas: [
    { exercicioId: 'leg', nome: 'Leg press', videoUrl: 'https://exemplo.com/leg' },
    { exercicioId: 'hack', nome: 'Hack', videoUrl: null },
  ],
});

const reg = (extra: Partial<RegistroDoDia> = {}): RegistroDoDia => ({
  planoVersaoId: 'v1',
  exercicioUid: 'e1',
  exercicioId: 'agacha',
  data: DATA,
  concluida: true,
  ...extra,
});
const ctx = (registros: RegistroDoDia[] = [], escolhida?: string | null) => ({ versaoId: 'v1', data: DATA, registros, escolhida });

describe('exercicioDoDia', () => {
  it('sem troca devolve o próprio exercício', () => {
    expect(exercicioDoDia(principal, ctx())).toBe(principal);
    expect(exercicioDoDia(exercicio('x'), ctx([], 'leg'))).toEqual(exercicio('x'));
  });

  it('com a alternativa escolhida (ainda sem série) troca id, nome e vídeo; uid e séries ficam; o equipamento sai', () => {
    const dia = exercicioDoDia(principal, ctx([], 'leg'));
    expect(dia).toMatchObject({ uid: 'e1', exercicioId: 'leg', nome: 'Leg press', videoUrl: 'https://exemplo.com/leg', equipamento: null });
    expect(dia.series).toBe(principal.series);
    expect(foiTrocado(principal, dia)).toBe(true);
    expect(exercicioDoDia(principal, ctx([], 'hack')).videoUrl).toBeNull();
  });

  it('id escolhido que não é de uma alternativa é ignorado', () => {
    expect(exercicioDoDia(principal, ctx([], 'supino'))).toBe(principal);
    expect(foiTrocado(principal, exercicioDoDia(principal, ctx([], null)))).toBe(false);
  });

  it('série concluída com o exercicioId da alternativa fixa a troca (também a que veio do servidor), mesmo sem escolha', () => {
    const dia = exercicioDoDia(principal, ctx([reg({ exercicioId: 'leg' })]));
    expect(dia.exercicioId).toBe('leg');
    expect(dia.nome).toBe('Leg press');
  });

  it('série concluída decide sobre a escolha: só com séries do principal, a escolha não troca', () => {
    expect(exercicioDoDia(principal, ctx([reg()], 'leg'))).toBe(principal);
    expect(exercicioDoDia(principal, ctx([reg({ exercicioId: 'leg' })], 'hack')).exercicioId).toBe('leg');
  });

  it('série desmarcada, de outro dia, de outra versão ou de outro exercício não fixa nada', () => {
    const fora = [
      reg({ exercicioId: 'leg', concluida: false }),
      reg({ exercicioId: 'leg', data: '2026-11-15' }),
      reg({ exercicioId: 'leg', planoVersaoId: 'v0' }),
      reg({ exercicioId: 'leg', exercicioUid: 'e2' }),
    ];
    expect(exercicioDoDia(principal, ctx(fora))).toBe(principal);
    expect(exercicioDoDia(principal, ctx(fora, 'hack')).exercicioId).toBe('hack');
  });

  it('série concluída com id que não é do principal nem de alternativa é ignorada', () => {
    expect(exercicioDoDia(principal, ctx([reg({ exercicioId: 'supino' })]))).toBe(principal);
  });
});

describe('podeTrocarNoDia', () => {
  it('só com alternativa e antes da primeira série concluída do exercício no dia', () => {
    expect(podeTrocarNoDia(principal, ctx())).toBe(true);
    expect(podeTrocarNoDia(exercicio('e1'), ctx())).toBe(false);
    expect(podeTrocarNoDia(principal, ctx([reg()]))).toBe(false);
    expect(podeTrocarNoDia(principal, ctx([reg({ exercicioId: 'leg' })]))).toBe(false);
    // desmarcar volta a liberar; outro dia e outro exercício nunca travam.
    expect(podeTrocarNoDia(principal, ctx([reg({ concluida: false }), reg({ data: '2026-11-15' }), reg({ exercicioUid: 'e2' })]))).toBe(true);
  });
});

describe('chave da carga de trabalho do dia (R3)', () => {
  it('é uid|data no dia normal e nula no dia trocado: a base não vai nem vem entre principal e alternativa', () => {
    expect(chaveDaBaseDoDia(principal, principal, DATA)).toBe(`e1|${DATA}`);
    expect(chaveDaBaseDoDia(principal, exercicioDoDia(principal, ctx([], 'leg')), DATA)).toBeNull();
    expect(chaveDaBaseDoDia(principal, exercicioDoDia(principal, ctx([reg({ exercicioId: 'leg' })])), DATA)).toBeNull();
  });
});

describe('recordes e "Anterior" do dia trocado saem do histórico da alternativa (R1, R3)', () => {
  const dia = exercicioDoDia(principal, ctx([], 'leg'));
  const versao = (planoVersaoId: string, serieUid: string) => (planoVersaoId === 'v1' ? { exercicio: principal, serie: principal.series.find((s) => s.uid === serieUid)! } : null);
  const melhores = (carga: number) => ({ maiorCarga: carga, maiorVolume: carga * 8, repeticoesPorCarga: [{ carga, repeticoes: 8 }] });

  it('200 kg no leg press não é recorde do agachamento nem mexe na base dele', () => {
    const recordes = { ate: DATA, exercicios: { agacha: melhores(100) } };
    const marcacao = { serieUid: 's1', carga: 200, repeticoes: 8, concluida: true };
    // Sem histórico da alternativa: o primeiro registro dela não conta como recorde.
    expect(recordesDoExercicio({ recordes, exercicio: dia, versaoId: 'v1', data: DATA, registros: [], serieDaVersao: versao, marcacao })).toEqual({});
    // No principal, a mesma carga seria recorde: a base dele continua a dele.
    expect(Object.keys(recordesDoExercicio({ recordes, exercicio: principal, versaoId: 'v1', data: DATA, registros: [], serieDaVersao: versao, marcacao }))).toEqual(['s1']);
    // Com histórico da alternativa (200 kg), 210 kg é recorde da alternativa.
    const comHistorico = { ate: DATA, exercicios: { agacha: melhores(100), leg: melhores(200) } };
    expect(Object.keys(recordesDoExercicio({ recordes: comHistorico, exercicio: dia, versaoId: 'v1', data: DATA, registros: [], serieDaVersao: versao, marcacao: { ...marcacao, carga: 210 } }))).toEqual(['s1']);
  });

  it('"Anterior" da alternativa vem só dela: sem histórico, nada; o do principal não aparece', () => {
    const anteriores = { ate: DATA, exercicios: { agacha: { data: '2026-11-10', series: [{ tipo: 'WORKING', ordem: 1, carga: 100, repeticoes: 8, etapas: null }] } } };
    const entrada = { anteriores, versaoId: 'v1', data: DATA, registros: [], exerciciosDaVersao: [principal] };
    expect(ultimaVez({ ...entrada, exercicio: dia })).toBeNull();
    expect(ultimaVez({ ...entrada, exercicio: principal })?.data).toBe('2026-11-10');
    // Registro do aparelho de outro dia, feito no leg press, é a última vez da alternativa e não do principal.
    const registros = [{ ...reg({ exercicioId: 'leg', data: '2026-11-12' }), serieUid: 's1', carga: 180, repeticoes: 10, etapas: null }];
    expect(ultimaVez({ ...entrada, registros, exercicio: dia })?.series[0]).toMatchObject({ carga: 180, repeticoes: 10 });
    expect(ultimaVez({ ...entrada, registros, exercicio: principal })?.data).toBe('2026-11-10');
  });
});
