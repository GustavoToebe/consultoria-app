import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';
import type { Configuracao, ConteudoTreino, ExercicioPlano, Serie } from '../api/tipos';
import { agrupar, descreverGrupo, descreverSeries } from './agrupamento';
import { localizar, uidsComProblema } from './caminhos';
import { carga, exercicio, grupo, rir, serie as serieDeTeste, sessao as sessaoDeTeste } from './exemplosDeTreino.apoioTeste';
import {
  adicionarSerie,
  alterarGrupo,
  alterarPercentuais,
  aplicarReceitaDePlano,
  cargaDoModo,
  comModalidade,
  comUidsNovos,
  corrigirReferencias,
  exercicioComUidsNovos,
  LIMITE_SERIES,
  modosDeCarga,
  mover,
  moverExercicio,
  moverGrupo,
  mudarQuantidade,
  normalizarTreino,
  novaSerie,
  novaSerieDeCardio,
  novaSessao,
  novoExercicio,
  remover,
  removerExercicio,
  removerGrupo,
  resumoDaSessao,
  rotuloDaSessao,
  sessaoComUidsNovos,
  sessaoSelecionadaDepois,
  seriesDaReceita,
  seriesParaReceita,
  substituir,
  tecnicaVazia,
  trocaApagaSeries,
  ultimaSerieDeTrabalhoAntes,
  unidadeDaModalidade,
} from './editorTreino';

let mockContador = 0;
jest.mock('./uid', () => ({ novoUid: () => `uid-${++mockContador}` }));

/** Metodologia padrão, sem o esforço da série de trabalho (os textos dos testes ficam sem " · 1 RIR"). */
const CONFIG: Configuracao = {
  ...CONFIGURACAO_PADRAO,
  tipos: CONFIGURACAO_PADRAO.tipos.map((t) => (t.codigo === 'WORKING' ? { ...t, esforcoPadrao: null, porModalidade: null } : t)),
};
const semFaixas: Configuracao = { ...CONFIG, tipos: CONFIG.tipos.map((t) => ({ ...t, repeticoes: null })) };
/** Back off que nasce "abaixo da referência" (15%), para testar a referência automática. */
const comBackOffDeReferencia: Configuracao = {
  ...CONFIG,
  tipos: CONFIG.tipos.map((t) => (t.codigo === 'BACK_OFF' ? { ...t, cargaPadrao: carga('ABAIXO_DA_REFERENCIA', 15) } : t)),
};

const serie = (uid: string, tipo: string | null, min: number | null, max: number | null, extra: Partial<Serie> = {}): Serie => serieDeTeste(uid, { tipo, repsMin: min, repsMax: max, carga: null, ...extra });
const fs = (uid: string, p: number, pMax: number | null = null) => serie(uid, 'FEEDER', 3, 3, { carga: carga('PERCENTUAL_WS', p, pMax) });
const ws = (uid: string) => serie(uid, 'WORKING', 3, 6, { carga: carga('CARGA_TRABALHO') });
const backOff = (uid: string) => serie(uid, 'BACK_OFF', 6, 8, { carga: carga('PERCENTUAL_WS', 85) });
const backOffDe = (uid: string, referencia: string | null) => serie(uid, 'BACK_OFF', 6, 8, { carga: carga('ABAIXO_DA_REFERENCIA', 15, null, referencia) });

const percentuais = (series: Serie[]) => series.map((s) => [s.carga?.percentualMin ?? null, s.carga?.percentualMax ?? null]);

beforeEach(() => {
  mockContador = 0;
});

describe('forma de carga no editor', () => {
  it('o % e a mesma carga dizem a base pelo nome da série de trabalho', () => {
    expect(modosDeCarga(CONFIG).find((m) => m.valor === 'PERCENTUAL_WS')?.rotulo).toBe('% da WS');
    expect(modosDeCarga(CONFIG).find((m) => m.valor === 'MESMA_CARGA')?.rotulo).toBe('Mesma carga da WS');
    expect(modosDeCarga(null).find((m) => m.valor === 'PERCENTUAL_WS')?.rotulo).toBe('% da série de trabalho');
  });

  it('o papel prioriza as opções sem proibir nenhuma', () => {
    expect(modosDeCarga(CONFIG, 'TRABALHO')[0].valor).toBe('CARGA_TRABALHO');
    expect(modosDeCarga(CONFIG, 'POS_TRABALHO')[0].valor).toBe('PERCENTUAL_WS');
    expect(modosDeCarga(CONFIG, 'AQUECIMENTO')[0].valor).toBe('NENHUMA');
    expect(modosDeCarga(CONFIG, 'OUTRO')).toHaveLength(6);
    expect(modosDeCarga(CONFIG, 'POS_TRABALHO').map((m) => m.valor).sort()).toEqual(modosDeCarga(CONFIG).map((m) => m.valor).sort());
  });

  it('cargaDoModo: sem carga é nulo; as outras formas nascem sem número', () => {
    expect(cargaDoModo('NENHUMA')).toBeNull();
    expect(cargaDoModo('PERCENTUAL_WS')).toEqual({ modo: 'PERCENTUAL_WS', percentualMin: null, percentualMax: null, referenciaUid: null });
  });
});

describe('agrupamento', () => {
  it('junta séries consecutivas iguais como no PDF', () => {
    const series = [fs('a', 50), fs('b', 70), fs('c', 85), ws('d'), backOff('e'), backOff('f')];
    expect(descreverSeries(series, CONFIG)).toEqual(['3x3 - FS 50/70/85% da WS', '1x3 a 6 - WS', '2x6 a 8 - Back off 85% da WS']);
    expect(agrupar(series).map((g) => g.inicio)).toEqual([0, 3, 4]);
  });

  it('série por tempo (sem repetições) fica sem faixa', () => {
    const tempo = serie('x', 'WARM_UP', null, null);
    expect(descreverGrupo(agrupar([tempo])[0], CONFIG)).toBe('1x - Aquecimento');
  });
});

describe('série nova', () => {
  it('sem tipo, é a de trabalho da metodologia, com repetições, carga e esforço do tipo', () => {
    const s = novaSerie(CONFIGURACAO_PADRAO);
    expect(s).toMatchObject({ tipo: 'WORKING', repsMin: 3, repsMax: 6, carga: { modo: 'CARGA_TRABALHO' }, esforco: { rir: 1 }, tecnica: null, cardio: null });
    expect(s.uid).toBe('uid-1');
  });

  it('peso livre e máquina usam a variação da metodologia; outras modalidades, o padrão do tipo', () => {
    expect(novaSerie(CONFIGURACAO_PADRAO, 'WORKING', 'MAQUINA').esforco).toMatchObject({ rir: 0 });
    expect(novaSerie(CONFIGURACAO_PADRAO, 'WORKING', 'LIVRE').esforco).toMatchObject({ rir: 1 });
    expect(novaSerie(CONFIGURACAO_PADRAO, 'WORKING', 'CABO').esforco).toMatchObject({ rir: 1 });
    expect(novaSerie(CONFIGURACAO_PADRAO, 'TOP_SET', 'MAQUINA').carga).toMatchObject({ modo: 'ACIMA_DA_ANTERIOR', percentualMin: 5, percentualMax: 10 });
    expect(novaSerie(CONFIGURACAO_PADRAO, 'TOP_SET', 'LIVRE').carga).toMatchObject({ percentualMin: 1, percentualMax: 5 });
  });

  it('sem metodologia usa a padrão; faixa só se o tipo tiver', () => {
    expect(novaSerie(null)).toMatchObject({ tipo: 'WORKING', repsMin: 3, repsMax: 6 });
    expect(novaSerie(semFaixas)).toMatchObject({ tipo: 'WORKING', repsMin: null, repsMax: null });
  });

  it('preparação nasce com a regra de 1 série; aquecimento nasce sem carga', () => {
    expect(novaSerie(CONFIG, 'FEEDER').carga).toMatchObject({ modo: 'PERCENTUAL_WS', percentualMin: 85, percentualMax: null });
    expect(novaSerie(CONFIG, 'WARM_UP')).toMatchObject({ carga: null, repsMin: 10, repsMax: 15 });
  });

  it('tipo fora da metodologia nasce em carga de trabalho, sem inventar repetição', () => {
    expect(novaSerie(CONFIG, 'PIRAMIDE')).toMatchObject({ tipo: 'PIRAMIDE', repsMin: null, repsMax: null, carga: { modo: 'CARGA_TRABALHO' }, esforco: null });
  });

  it('o back off nasce apontando a última série de trabalho anterior', () => {
    const s = novaSerie(comBackOffDeReferencia, 'BACK_OFF', null, null, [ws('a'), ws('b'), fs('c', 85)]);
    expect(s.carga).toMatchObject({ modo: 'ABAIXO_DA_REFERENCIA', percentualMin: 15, referenciaUid: 'b' });
    // Sem série de trabalho antes, fica sem referência (a publicação cobra).
    expect(novaSerie(comBackOffDeReferencia, 'BACK_OFF', null, null, [fs('c', 85)]).carga?.referenciaUid).toBeNull();
  });

  it('a técnica nasce com o padrão da metodologia', () => {
    expect(novaSerie(CONFIG, 'WORKING', null, 'REST_PAUSE').tecnica).toMatchObject({ tipo: 'REST_PAUSE', pausaSegundos: 20, pausas: 1 });
    expect(novaSerie(CONFIG, 'WORKING', null, 'MYO_REPS').tecnica).toMatchObject({ tipo: 'MYO_REPS', pausaRespiracoes: 5 });
    expect(novaSerie(CONFIG, 'WORKING', null, 'PARTIAL_REPS').tecnica).toMatchObject({ regiao: 'LIVRE' });
  });

  it('exercício de cardio dá série de cardio, sem tipo, repetições, carga, esforço nem técnica', () => {
    expect(novaSerie(CONFIG, undefined, 'CARDIO')).toEqual({ ...novaSerieDeCardio(), uid: expect.any(String) });
    expect(novaSerieDeCardio()).toMatchObject({ tipo: null, repsMin: null, repsMax: null, carga: null, esforco: null, tecnica: null, cardio: { duracaoMin: null } });
  });

  it('tecnicaVazia tem os 13 campos', () => {
    expect(Object.keys(tecnicaVazia('CLUSTER')).sort()).toEqual(
      ['tipo', 'pausaSegundos', 'pausaRespiracoes', 'pausas', 'blocos', 'quedas', 'reducaoPercentual', 'repsPorQueda', 'miniSeries', 'repsPorMiniSerie', 'repsParciais', 'regiao', 'repsAssistidas'].sort(),
    );
  });
});

describe('editor de treino', () => {
  it('FS de 3 para 2 reaplica a regra da consultoria (70 e 85 a 90)', () => {
    const series = [fs('a', 50), fs('b', 70), fs('c', 85, 90), ws('d')];
    const novas = mudarQuantidade(series, agrupar(series)[0], 2, CONFIG);
    expect(percentuais(novas)).toEqual([[70, null], [85, 90], [null, null]]);
    expect(novas.map((s) => s.uid)).toEqual(['a', 'b', 'd']);
  });

  it('FS de 2 para 3 cria série com uid novo e aplica 50/70/85 a 90', () => {
    const series = [fs('a', 70), fs('b', 85, 90), ws('d')];
    const novas = mudarQuantidade(series, agrupar(series)[0], 3, CONFIG);
    expect(percentuais(novas)).toEqual([[50, null], [70, null], [85, 90], [null, null]]);
    expect(novas[2].uid).toBe('uid-1');
    expect(novas[2].carga?.referenciaUid).toBeNull();
  });

  it('aumentar um grupo que não é de preparação só copia a última série', () => {
    const series = [ws('d')];
    const novas = mudarQuantidade(series, agrupar(series)[0], 2, CONFIG);
    expect(novas).toHaveLength(2);
    expect(novas[1]).toEqual({ ...ws('d'), uid: 'uid-1' });
  });

  it('mudar a faixa altera o grupo todo e não inventa repetição', () => {
    const series = [backOff('e'), backOff('f')];
    const novas = alterarGrupo(series, agrupar(series)[0], { repsMin: 8, repsMax: 10 }, CONFIG);
    expect(novas.map((s) => [s.repsMin, s.repsMax])).toEqual([[8, 10], [8, 10]]);
    expect(novas.map((s) => s.uid)).toEqual(['e', 'f']);
  });

  it('AMRAP tira as repetições, e informar repetições tira o AMRAP', () => {
    const series = [ws('a')];
    const amrap = alterarGrupo(series, agrupar(series)[0], { amrap: true }, CONFIG);
    expect(amrap[0]).toMatchObject({ amrap: true, repsMin: null, repsMax: null });
    const volta = alterarGrupo(amrap, agrupar(amrap)[0], { repsMin: 5, repsMax: 8 }, CONFIG);
    expect(volta[0]).toMatchObject({ amrap: null, repsMin: 5, repsMax: 8 });
    expect(alterarGrupo(amrap, agrupar(amrap)[0], { amrap: false }, CONFIG)[0].amrap).toBeNull();
  });

  it('trocar o tipo para o de preparação vira % da regra (e tira o esforço)', () => {
    const series = [ws('a'), ws('b')];
    const novas = alterarGrupo(series, agrupar(series)[0], { tipo: 'FEEDER' }, CONFIG);
    expect(novas.map((s) => s.tipo)).toEqual(['FEEDER', 'FEEDER']);
    expect(novas.map((s) => s.carga?.modo)).toEqual(['PERCENTUAL_WS', 'PERCENTUAL_WS']);
    expect(percentuais(novas)).toEqual([[70, null], [85, 90]]);
    expect(novas.map((s) => [s.repsMin, s.repsMax])).toEqual([[3, 3], [3, 3]]);
  });

  it('trocar o tipo preenche as repetições, a carga e o esforço do tipo novo; tipo sem faixa mantém as repetições', () => {
    const series = [{ ...ws('a'), esforco: rir(1) }];
    const grupoUnico = agrupar(series)[0];
    const backOffNovo = alterarGrupo(series, grupoUnico, { tipo: 'BACK_OFF' }, CONFIGURACAO_PADRAO)[0];
    expect(backOffNovo).toMatchObject({ tipo: 'BACK_OFF', repsMin: 6, repsMax: 8, esforco: null });
    expect(backOffNovo.carga).toMatchObject({ modo: 'PERCENTUAL_WS', percentualMin: 85 });
    const topo = alterarGrupo(series, grupoUnico, { tipo: 'TOP_SET' }, CONFIGURACAO_PADRAO)[0];
    expect(topo).toMatchObject({ tipo: 'TOP_SET', repsMin: 3, repsMax: 6 });
    expect(topo.carga).toMatchObject({ modo: 'ACIMA_DA_ANTERIOR', percentualMin: 1, percentualMax: 5 });
    // Tipo fora da metodologia: só muda o código.
    expect(alterarGrupo(series, grupoUnico, { tipo: 'PIRAMIDE' }, CONFIG)[0]).toMatchObject({ tipo: 'PIRAMIDE', repsMin: 3, repsMax: 6, carga: { modo: 'CARGA_TRABALHO' } });
  });

  it('a modalidade escolhe a variação do tipo ao trocar de tipo', () => {
    const series = [serie('a', 'WARM_UP', 10, 15)];
    expect(alterarGrupo(series, agrupar(series)[0], { tipo: 'WORKING' }, CONFIGURACAO_PADRAO, 'MAQUINA')[0].esforco).toMatchObject({ rir: 0 });
  });

  it('trocar a forma de carga parte do padrão do tipo quando ele é dessa forma', () => {
    const series = [backOff('a')];
    const trabalho = alterarGrupo(series, agrupar(series)[0], { modo: 'CARGA_TRABALHO' }, CONFIG);
    expect(trabalho[0].carga).toEqual({ modo: 'CARGA_TRABALHO', percentualMin: null, percentualMax: null, referenciaUid: null });
    const devolta = alterarGrupo(trabalho, agrupar(trabalho)[0], { modo: 'PERCENTUAL_WS' }, CONFIG);
    expect(devolta[0].carga).toMatchObject({ modo: 'PERCENTUAL_WS', percentualMin: 85 });
    const sem = alterarGrupo(series, agrupar(series)[0], { modo: 'NENHUMA' }, CONFIG);
    expect(sem[0].carga).toBeNull();
  });

  it('valores da carga do grupo e esforço (RIR ou RPE, nunca os dois)', () => {
    const series = [backOff('a'), backOff('b')];
    const g = agrupar(series)[0];
    const p = alterarGrupo(series, g, { carga: { percentualMin: 80, percentualMax: 90 } }, CONFIG);
    expect(percentuais(p)).toEqual([[80, 90], [80, 90]]);
    const e = alterarGrupo(series, g, { esforco: { rir: null, rpe: 8.5 } }, CONFIG);
    expect(e.map((s) => s.esforco)).toEqual([{ rir: null, rpe: 8.5 }, { rir: null, rpe: 8.5 }]);
    expect(alterarGrupo(e, agrupar(e)[0], { esforco: null }, CONFIG).map((s) => s.esforco)).toEqual([null, null]);
  });

  it('"abaixo da referência" sem referência passa a apontar a última série de trabalho anterior', () => {
    const series = [ws('a'), backOff('b'), backOff('c')];
    const novas = alterarGrupo(series, agrupar(series)[1], { modo: 'ABAIXO_DA_REFERENCIA' }, CONFIG);
    expect(novas.slice(1).map((s) => s.carga?.referenciaUid)).toEqual(['a', 'a']);
  });

  it('cluster mantém as repetições iguais à soma dos blocos', () => {
    const series = [ws('a')];
    const novas = alterarGrupo(series, agrupar(series)[0], { tecnica: { ...tecnicaVazia('CLUSTER'), blocos: [4, 2], pausaSegundos: 15 } }, CONFIG);
    expect(novas[0]).toMatchObject({ repsMin: 6, repsMax: 6, amrap: null });
  });

  it('prescrição de cardio e alvo extra', () => {
    const series = [novaSerieDeCardio()];
    const c = alterarGrupo(series, agrupar(series)[0], { cardio: { duracaoMin: 30, zona: 2 }, alvoExtra: 'Leve' }, CONFIG, 'CARDIO');
    expect(c[0]).toMatchObject({ cardio: { duracaoMin: 30, zona: 2, intervalos: null }, alvoExtra: 'Leve' });
    expect(alterarGrupo(c, agrupar(c)[0], { alvoExtra: '   ' }, CONFIG, 'CARDIO')[0].alvoExtra).toBeNull();
  });

  it('faixa de % de uma série só mantém a forma por % ou vira % da série de trabalho', () => {
    const series = [backOffDe('x', 'r'), ws('w')];
    const a = alterarPercentuais(series, 0, 10, 20);
    expect(a[0].carga).toMatchObject({ modo: 'ABAIXO_DA_REFERENCIA', percentualMin: 10, percentualMax: 20, referenciaUid: 'r' });
    const b = alterarPercentuais(series, 1, 70, null);
    expect(b[1].carga).toMatchObject({ modo: 'PERCENTUAL_WS', percentualMin: 70, percentualMax: null });
  });

  it('mover troca vizinhos e ignora os limites; substituir e remover não mexem nas outras posições', () => {
    expect(mover([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(mover([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(substituir([1, 2, 3], 1, 9)).toEqual([1, 9, 3]);
    expect(remover([1, 2, 3], 1)).toEqual([1, 3]);
  });
});

describe('referência do back off', () => {
  it('a última série de trabalho antes da posição', () => {
    const series = [ws('a'), fs('b', 85), ws('c'), backOff('d')];
    expect(ultimaSerieDeTrabalhoAntes(series, 4)).toBe('c');
    expect(ultimaSerieDeTrabalhoAntes(series, 2)).toBe('a');
    expect(ultimaSerieDeTrabalhoAntes(series, 0)).toBeNull();
  });

  it('referência válida não é tocada; ausente, perdida ou posterior é corrigida; a mesma lista quando nada muda', () => {
    const certa = [ws('a'), backOffDe('b', 'a')];
    expect(corrigirReferencias(certa)).toBe(certa);
    const perdida = corrigirReferencias([ws('a'), backOffDe('b', 'sumiu')]);
    expect(perdida[1].carga?.referenciaUid).toBe('a');
    const ausente = corrigirReferencias([ws('a'), backOffDe('b', null)]);
    expect(ausente[1].carga?.referenciaUid).toBe('a');
    const posterior = corrigirReferencias([backOffDe('b', 'c'), ws('c')]);
    expect(posterior[0].carga?.referenciaUid).toBeNull();
  });

  it('remover a série referenciada passa o back off para a série de trabalho que restou', () => {
    const series = [ws('a'), ws('b'), backOffDe('c', 'b')];
    const sem = removerGrupo(series, agrupar(series)[0]);
    expect(sem.map((s) => s.uid)).toEqual(['c']);
    expect(sem[0].carga?.referenciaUid).toBeNull();
    const umaSo = mudarQuantidade(series, agrupar(series)[0], 1, CONFIG);
    expect(umaSo.map((s) => s.uid)).toEqual(['a', 'c']);
    expect(umaSo[1].carga?.referenciaUid).toBe('a');
  });

  it('subir o back off para antes da série de trabalho tira a referência que ficou para trás', () => {
    const series = [ws('a'), backOffDe('b', 'a')];
    const subiu = moverGrupo(series, 1, -1);
    expect(subiu.map((s) => s.uid)).toEqual(['b', 'a']);
    expect(subiu[0].carga?.referenciaUid).toBeNull();
  });
});

describe('adicionar e reordenar séries (reunião de 17/10)', () => {
  it('FS adicionado depois da WS fica num grupo próprio, com a regra de 1 série, e sobe para antes dela', () => {
    const comFs = adicionarSerie([ws('a')], CONFIG, 'FEEDER');
    expect(descreverSeries(comFs, CONFIG)).toEqual(['1x3 a 6 - WS', '1x3 - FS 85% da WS']);
    const reordenado = moverGrupo(comFs, 1, -1);
    expect(descreverSeries(reordenado, CONFIG)).toEqual(['1x3 - FS 85% da WS', '1x3 a 6 - WS']);
    expect(reordenado.map((s) => s.uid)).toEqual([comFs[1].uid, 'a']);
  });

  it('série igual ao último grupo soma a ele pelo mesmo caminho do "+", com a regra de preparação', () => {
    const resultado = adicionarSerie([fs('a', 70), fs('b', 85, 90)], CONFIG, 'FEEDER');
    expect(descreverSeries(resultado, CONFIG)).toEqual(['3x3 - FS 50/70/85 a 90% da WS']);
    expect(resultado.slice(0, 2).map((s) => s.uid)).toEqual(['a', 'b']);
  });

  it('sem tipo, a série nova é a de trabalho', () => {
    expect(adicionarSerie([], CONFIG).map((s) => s.tipo)).toEqual(['WORKING']);
  });

  it('tipo fora da metodologia é aceito: a série nasce com ele', () => {
    const [nova] = adicionarSerie([], CONFIG, 'PIRAMIDE', null);
    expect(nova.tipo).toBe('PIRAMIDE');
  });

  it('exercício de cardio recebe série de cardio', () => {
    const [nova] = adicionarSerie([], CONFIG, undefined, null, 'CARDIO');
    expect(nova).toMatchObject({ tipo: null, cardio: expect.any(Object) });
  });

  it('o limite de séries vale para o exercício todo', () => {
    const muitas = Array.from({ length: LIMITE_SERIES - 1 }, (_, i) => ws(`w${i}`));
    const series = [fs('a', 85), ...muitas];
    expect(adicionarSerie(series, CONFIG, 'BACK_OFF')).toBe(series);
    expect(mudarQuantidade(series, agrupar(series)[0], 2, CONFIG)).toBe(series);
  });

  it('mover fora dos limites devolve a mesma lista', () => {
    const series = [fs('a', 85), ws('b')];
    expect(moverGrupo(series, 0, -1)).toBe(series);
    expect(moverGrupo(series, 1, 1)).toBe(series);
  });

  it('o descanso vale para todas as séries do grupo', () => {
    const series = [ws('a'), ws('b'), backOff('c')];
    const resultado = alterarGrupo(series, agrupar(series)[0], { descansoSegundos: 120 }, CONFIG);
    expect(resultado.map((s) => s.descansoSegundos)).toEqual([120, 120, null]);
  });
});

describe('receitas de séries e uids', () => {
  /** "WS + Top set + 2 Back off": a receita guarda o uid do Top set, porque os back off o referenciam. */
  const receita = () => ({
    series: [
      { tipo: 'WORKING', repsMin: 3, repsMax: 6, carga: { modo: 'CARGA_TRABALHO' }, esforco: { rir: 1 } },
      { uid: 'top', tipo: 'TOP_SET', carga: { modo: 'ACIMA_DA_ANTERIOR', percentualMin: 1, percentualMax: 5 } },
      { tipo: 'BACK_OFF', repsMin: 6, repsMax: 8, carga: { modo: 'ABAIXO_DA_REFERENCIA', percentualMin: 15, referenciaUid: 'top' } },
      { tipo: 'BACK_OFF', repsMin: 6, repsMax: 8, carga: { modo: 'ABAIXO_DA_REFERENCIA', percentualMin: 15, referenciaUid: 'top' } },
    ],
  });

  it('ganha uids novos e a referência acompanha o uid novo da série referenciada', () => {
    const series = seriesDaReceita(receita());
    expect(series.map((s) => s.uid)).toEqual(['uid-1', 'uid-2', 'uid-3', 'uid-4']);
    expect(series[2].carga?.referenciaUid).toBe('uid-2');
    expect(series[3].carga?.referenciaUid).toBe('uid-2');
    expect(series[0]).toMatchObject({ tipo: 'WORKING', amrap: null, tecnica: null, cardio: null, alvoExtra: null });
  });

  it('aplicar a mesma receita duas vezes não duplica uid nem mistura as referências', () => {
    const r = receita();
    const primeira = seriesDaReceita(r);
    const segunda = seriesDaReceita(r);
    const todos = [...primeira, ...segunda].map((s) => s.uid);
    expect(new Set(todos).size).toBe(8);
    expect(primeira[2].carga?.referenciaUid).toBe(primeira[1].uid);
    expect(segunda[2].carga?.referenciaUid).toBe(segunda[1].uid);
    // A receita original não foi alterada.
    expect(r.series[2].carga?.referenciaUid).toBe('top');
  });

  it('referência que não está na receita fica como está (o validador a aponta)', () => {
    const series = seriesDaReceita({ series: [{ tipo: 'BACK_OFF', carga: { modo: 'ABAIXO_DA_REFERENCIA', percentualMin: 15, referenciaUid: 'fora' } }] });
    expect(series[0].carga?.referenciaUid).toBe('fora');
  });

  it('volta sem uids ao salvar, menos os das séries que alguma outra referencia', () => {
    const series = seriesDaReceita(receita());
    const salva = seriesParaReceita(series).series;
    expect(salva.map((s) => 'uid' in s)).toEqual([false, true, false, false]);
    expect(salva[1].uid).toBe('uid-2');
    expect(salva[2].carga?.referenciaUid).toBe('uid-2');
    // Ciclo completo: salvar e aplicar de novo reaponta as referências.
    const reaplicada = seriesDaReceita(JSON.parse(JSON.stringify({ series: salva })));
    expect(reaplicada[2].carga?.referenciaUid).toBe(reaplicada[1].uid);
    expect(reaplicada[1].uid).not.toBe('uid-2');
  });

  it('receita antiga sem os campos novos vira série completa', () => {
    const series = seriesDaReceita({ series: [{ tipo: 'WORKING', repsMin: 3, repsMax: 6 }] });
    expect(series[0]).toEqual({
      uid: 'uid-1',
      tipo: 'WORKING',
      repsMin: 3,
      repsMax: 6,
      amrap: null,
      carga: null,
      esforco: null,
      descansoSegundos: null,
      tecnica: null,
      cardio: null,
      alvoExtra: null,
    });
    expect(seriesDaReceita(null)).toEqual([]);
  });

  it('série de cardio da receita leva só a prescrição de cardio', () => {
    const [c] = seriesDaReceita({ series: [{ tipo: 'WORKING', repsMin: 3, carga: { modo: 'CARGA_TRABALHO' }, cardio: { duracaoMin: 20 } }] });
    expect(c).toMatchObject({ tipo: null, repsMin: null, carga: null, esforco: null, tecnica: null, cardio: { duracaoMin: 20 } });
  });
});

describe('receita de semana e cópia com uids novos', () => {
  const conteudoComGrupos = (): ConteudoTreino => ({
    objetivo: 'Hipertrofia',
    orientacoes: null,
    sessoes: [
      sessaoDeTeste(
        's1',
        [
          exercicio('e1', { grupoUid: 'g1', series: [ws('a'), backOffDe('b', 'a')] }),
          exercicio('e2', { grupoUid: 'g1', series: [ws('c')] }),
          exercicio('e3', { series: [ws('d')] }),
        ],
        [grupo('g1', 'SUPERSET')],
      ),
    ],
  });

  it('receita de semana troca as sessões e mantém objetivo e orientações', () => {
    const atual = normalizarTreino({ objetivo: 'Secar', orientacoes: 'Notas', sessoes: [] });
    const novo = aplicarReceitaDePlano(atual, { sessoes: [{ nome: 'Treino A', diaSemana: 1, tipo: 'TREINO', exercicios: [] }] });
    expect(novo.objetivo).toBe('Secar');
    expect(novo.orientacoes).toBe('Notas');
    expect(novo.sessoes.map((s) => s.nome)).toEqual(['Treino A']);
    expect(novo.sessoes[0].uid).toMatch(/^uid-/);
    expect(novo.sessoes[0].grupos).toEqual([]);
  });

  it('os grupos, o grupoUid dos exercícios e a referência das séries acompanham os uids novos', () => {
    const copia = comUidsNovos(conteudoComGrupos());
    const [s] = copia.sessoes;
    expect(s.uid).not.toBe('s1');
    const novoGrupo = s.grupos[0];
    expect(novoGrupo.uid).not.toBe('g1');
    expect(novoGrupo.tecnica).toBe('SUPERSET');
    expect(s.exercicios.map((e) => e.grupoUid)).toEqual([novoGrupo.uid, novoGrupo.uid, null]);
    const [a, b] = s.exercicios[0].series;
    expect(a.uid).not.toBe('a');
    expect(b.carga?.referenciaUid).toBe(a.uid);
    // O original não muda.
    expect(conteudoComGrupos().sessoes[0].grupos[0].uid).toBe('g1');
  });

  it('aplicar a receita duas vezes não duplica nenhum uid', () => {
    const receita = conteudoComGrupos();
    const vazio = normalizarTreino({ sessoes: [] });
    const um = aplicarReceitaDePlano(vazio, receita);
    const dois = aplicarReceitaDePlano(um, receita);
    const uids = (c: ConteudoTreino) => c.sessoes.flatMap((x) => [x.uid, ...x.grupos.map((g) => g.uid), ...x.exercicios.flatMap((e) => [e.uid, ...e.series.map((y) => y.uid)])]);
    expect(new Set([...uids(um), ...uids(dois)]).size).toBe(uids(um).length * 2);
    expect(dois.sessoes[0].exercicios.map((e) => e.grupoUid)).toEqual([dois.sessoes[0].grupos[0].uid, dois.sessoes[0].grupos[0].uid, null]);
  });

  it('exercício copiado sozinho sai do grupo e ganha uids novos nas séries', () => {
    const original = exercicio('e1', { grupoUid: 'g1', series: [ws('a'), backOffDe('b', 'a')] });
    const copia = exercicioComUidsNovos(original);
    expect(copia.grupoUid).toBeNull();
    expect(copia.uid).not.toBe('e1');
    expect(copia.series[1].carga?.referenciaUid).toBe(copia.series[0].uid);
  });

  it('sessão copiada mantém os vínculos entre os novos uids', () => {
    const copia = sessaoComUidsNovos(conteudoComGrupos().sessoes[0]);
    expect(copia.exercicios[0].grupoUid).toBe(copia.grupos[0].uid);
  });

  it('receita com metodologia própria leva a metodologia junto', () => {
    const novo = aplicarReceitaDePlano(normalizarTreino({ sessoes: [] }), { metodologia: { id: 'm', nome: 'Mine', configuracao: CONFIG }, sessoes: [] });
    expect(novo.metodologia?.configuracao.tipos).toHaveLength(CONFIG.tipos.length);
  });
});

describe('normalizar o treino', () => {
  it('completa listas e campos que faltam e descarta os do formato antigo', () => {
    const c = normalizarTreino({
      sessoes: [
        {
          exercicios: [
            { nome: 'A', cadencia: '3-1-1-0', isometriaSegundos: 10, grupoUid: 'g', juntoComAnterior: true, combinacao: 'SUPERSERIE', series: [{ uid: 'x', tipo: 'WS', intensidade: { modo: 'CARGA_TRABALHO' } }] },
          ],
          grupos: [{ uid: 'g', tecnica: 'SUPERSET' }],
        },
      ],
    });
    const [e] = c.sessoes[0].exercicios;
    expect([e.cadencia, e.isometriaSegundos, e.grupoUid]).toEqual(['3-1-1-0', 10, 'g']);
    expect(e).not.toHaveProperty('juntoComAnterior');
    expect(e).not.toHaveProperty('combinacao');
    expect(e.series[0]).not.toHaveProperty('intensidade');
    expect(e.series[0]).toMatchObject({ uid: 'x', carga: null, esforco: null });
    expect(c.sessoes[0].grupos).toEqual([{ uid: 'g', tecnica: 'SUPERSET', descansoAposSegundos: null, voltas: null }]);
    expect(normalizarTreino(null).sessoes).toEqual([]);
  });

  it('a metodologia do plano é copiada em profundidade', () => {
    const origem = { metodologia: { id: 'm', nome: 'M', configuracao: CONFIG }, sessoes: [] };
    const c = normalizarTreino(origem);
    expect(c.metodologia?.configuracao).toEqual(CONFIG);
    expect(c.metodologia?.configuracao).not.toBe(CONFIG);
  });
});

describe('composições da pesquisa de técnicas (19/10)', () => {
  const cluster = { ...tecnicaVazia('CLUSTER'), blocos: [4, 4, 4], pausaSegundos: 20 };
  const comCluster = (series: Serie[]) => {
    const grupos = agrupar(series);
    return alterarGrupo(series, grupos[grupos.length - 1], { tecnica: cluster }, CONFIG);
  };
  const reabrir = (series: Serie[]) => normalizarTreino(JSON.parse(JSON.stringify({ sessoes: [{ exercicios: [{ series }] }] }))).sessoes[0].exercicios[0].series;
  const pelaReceita = (series: Serie[]) => seriesDaReceita(JSON.parse(JSON.stringify(seriesParaReceita(series))));

  it('WS simples, WS + cluster e duas séries cluster continuam diferentes ao salvar, reabrir e virar receita', () => {
    const simples = adicionarSerie([], CONFIG, 'WORKING');
    const wsMaisCluster = comCluster(adicionarSerie(simples, CONFIG, 'WORKING', 'CLUSTER'));
    const doisCluster = adicionarSerie(comCluster(adicionarSerie([], CONFIG, 'WORKING', 'CLUSTER')), CONFIG, 'WORKING', 'CLUSTER');

    const esperado = {
      simples: ['1x3 a 6 - WS'],
      wsMaisCluster: ['1x3 a 6 - WS', '1x12 (3×4) - WS + Cluster 20 s'],
      doisCluster: ['2x12 (3×4) - WS + Cluster 20 s'],
    };
    for (const [nome, series] of Object.entries({ simples, wsMaisCluster, doisCluster })) {
      const quer = esperado[nome as keyof typeof esperado];
      expect(descreverSeries(series, CONFIG)).toEqual(quer);
      expect(descreverSeries(reabrir(series), CONFIG)).toEqual(quer);
      expect(descreverSeries(pelaReceita(series), CONFIG)).toEqual(quer);
    }
  });

  it('série simples depois do cluster nasce num grupo próprio, sem herdar a técnica', () => {
    const wsMaisCluster = comCluster(adicionarSerie(adicionarSerie([], CONFIG, 'WORKING'), CONFIG, 'WORKING', 'CLUSTER'));
    expect(descreverSeries(adicionarSerie(wsMaisCluster, CONFIG, 'WORKING'), CONFIG)).toEqual(['1x3 a 6 - WS', '1x12 (3×4) - WS + Cluster 20 s', '1x3 a 6 - WS']);
  });

  it('trocar de 3 para 4 blocos muda só a técnica, sem virar séries', () => {
    const doisCluster = adicionarSerie(comCluster(adicionarSerie([], CONFIG, 'WORKING', 'CLUSTER')), CONFIG, 'WORKING', 'CLUSTER');
    const quatro = alterarGrupo(doisCluster, agrupar(doisCluster)[0], { tecnica: { ...cluster, blocos: [4, 4, 4, 4] } }, CONFIG);
    expect(quatro).toHaveLength(2);
    expect(quatro.map((s) => s.uid)).toEqual(doisCluster.map((s) => s.uid));
    expect(descreverSeries(quatro, CONFIG)).toEqual(['2x16 (4×4) - WS + Cluster 20 s']);
  });

  it('receita aplicada é cópia: mudar a origem depois não muda o exercício', () => {
    const origem = comCluster(adicionarSerie([], CONFIG, 'WORKING', 'CLUSTER'));
    const receita = seriesParaReceita(origem);
    const aplicada = seriesDaReceita(JSON.parse(JSON.stringify(receita)));
    receita.series[0].tecnica!.blocos![0] = 9;
    expect(descreverSeries(aplicada, CONFIG)).toEqual(['1x12 (3×4) - WS + Cluster 20 s']);
  });
});

describe('drop-set no editor (pesquisa de técnicas de 19/10)', () => {
  const drop = { ...tecnicaVazia('DROP_SET'), quedas: 2, reducaoPercentual: 20 };
  const comDrop = (series: Serie[]) => {
    const grupos = agrupar(series);
    return alterarGrupo(series, grupos[grupos.length - 1], { tecnica: drop }, CONFIG);
  };

  it('nasce com as quedas definidas na metodologia', () => {
    const [s] = adicionarSerie([], CONFIG, 'WORKING', 'DROP_SET');
    expect(s.tecnica).toEqual(expect.objectContaining({ tipo: 'DROP_SET', quedas: 1, reducaoPercentual: null, repsPorQueda: null }));
  });

  it('soma ao último grupo só com o mesmo tipo e o mesmo drop-set', () => {
    const wsMaisDrop = comDrop(adicionarSerie(adicionarSerie([], CONFIG, 'WORKING'), CONFIG, 'WORKING', 'DROP_SET'));
    expect(descreverSeries(wsMaisDrop, CONFIG)).toEqual(['1x3 a 6 - WS', '1x3 a 6 - WS + Drop-set 2× −20%']);
    expect(descreverSeries(adicionarSerie(wsMaisDrop, CONFIG, 'WORKING', 'DROP_SET'), CONFIG)).toEqual(['1x3 a 6 - WS', '2x3 a 6 - WS + Drop-set 2× −20%']);
    expect(descreverSeries(adicionarSerie(wsMaisDrop, CONFIG, 'WORKING', 'CLUSTER'), CONFIG)).toEqual(['1x3 a 6 - WS', '1x3 a 6 - WS + Drop-set 2× −20%', '1x3 a 6 - WS + Cluster 15 s']);
    expect(descreverSeries(adicionarSerie(wsMaisDrop, CONFIG, 'WORKING'), CONFIG)).toEqual(['1x3 a 6 - WS', '1x3 a 6 - WS + Drop-set 2× −20%', '1x3 a 6 - WS']);
  });

  it('continua igual ao reabrir e ao virar receita', () => {
    const series = comDrop(adicionarSerie([], CONFIG, 'WORKING', 'DROP_SET'));
    const reaberto = normalizarTreino(JSON.parse(JSON.stringify({ sessoes: [{ exercicios: [{ series }] }] }))).sessoes[0].exercicios[0].series;
    expect(descreverSeries(reaberto, CONFIG)).toEqual(['1x3 a 6 - WS + Drop-set 2× −20%']);
    expect(descreverSeries(seriesDaReceita(JSON.parse(JSON.stringify(seriesParaReceita(series)))), CONFIG)).toEqual(['1x3 a 6 - WS + Drop-set 2× −20%']);
  });
});

describe('caminhos do validador', () => {
  const conteudo = normalizarTreino({
    sessoes: [
      {
        uid: 's1',
        nome: 'Segunda - Costas',
        exercicios: [{ uid: 'e1', nome: 'Remada baixa', series: [{ uid: 'x1' }, { uid: 'x2' }] }],
      },
    ],
  });

  it('vira texto legível e lista os uids no caminho', () => {
    expect(localizar(conteudo, 'sessoes[0].exercicios[0].series[1].repsMax')).toEqual({
      texto: 'Segunda - Costas › Remada baixa › série 2',
      uids: ['s1', 'e1', 'x2'],
    });
    expect(localizar(conteudo, 'sessoes').texto).toBe('Sessões');
    expect(uidsComProblema(conteudo, ['sessoes[0].nome'])).toEqual(new Set(['s1']));
  });
});

describe('sessão selecionada do editor', () => {
  const sessao = (uid: string, nome = '', diaSemana: number | null = null, uidsEx: string[] = []) => sessaoDeTeste(uid, uidsEx.map((u) => exercicio(u)), [], { nome, diaSemana });
  const lista = [sessao('a'), sessao('b'), sessao('c')];

  it('ao remover a selecionada vai para a seguinte, ou para a anterior se era a última', () => {
    expect(sessaoSelecionadaDepois(lista, 'a', { tipo: 'remover', uid: 'a' })).toBe('b');
    expect(sessaoSelecionadaDepois(lista, 'b', { tipo: 'remover', uid: 'b' })).toBe('c');
    expect(sessaoSelecionadaDepois(lista, 'c', { tipo: 'remover', uid: 'c' })).toBe('b');
    expect(sessaoSelecionadaDepois([sessao('x')], 'x', { tipo: 'remover', uid: 'x' })).toBeNull();
  });

  it('remover outra sessão não muda a seleção', () => {
    expect(sessaoSelecionadaDepois(lista, 'b', { tipo: 'remover', uid: 'a' })).toBe('b');
  });

  it('ao desfazer mantém a seleção se o uid ainda existe, senão a primeira', () => {
    expect(sessaoSelecionadaDepois(lista, 'c', { tipo: 'conteudo' })).toBe('c');
    expect(sessaoSelecionadaDepois(lista, 'sumiu', { tipo: 'conteudo' })).toBe('a');
    expect(sessaoSelecionadaDepois([], 'a', { tipo: 'conteudo' })).toBeNull();
    expect(sessaoSelecionadaDepois(lista, null, { tipo: 'conteudo' })).toBe('a');
  });

  it('validar com erro abre a primeira sessão com problema, inclusive por exercício e por grupo', () => {
    const com = [sessao('a'), sessao('b', '', null, ['e1']), sessao('c', '', null, ['e2'])];
    expect(sessaoSelecionadaDepois(com, 'a', { tipo: 'erros', uidsComErro: new Set(['e2', 'e1']) })).toBe('b');
    expect(sessaoSelecionadaDepois(com, 'a', { tipo: 'erros', uidsComErro: new Set(['c']) })).toBe('c');
    expect(sessaoSelecionadaDepois(com, 'c', { tipo: 'erros', uidsComErro: new Set() })).toBe('c');
    const comGrupo = [sessao('a'), { ...sessao('b'), grupos: [grupo('g1')] }];
    expect(sessaoSelecionadaDepois(comGrupo, 'a', { tipo: 'erros', uidsComErro: new Set(['g1']) })).toBe('b');
  });

  it('rótulo do chip e resumo da sessão', () => {
    expect(rotuloDaSessao(sessao('a', 'Segunda - Costas', 1), 0)).toBe('Seg · Costas');
    expect(rotuloDaSessao(sessao('a', 'Terça', 2), 1)).toBe('Ter');
    expect(rotuloDaSessao(sessao('a', 'Pernas', null), 2)).toBe('Pernas');
    expect(rotuloDaSessao(sessao('a', '', null), 3)).toBe('Sessão 4');
    expect(resumoDaSessao(sessao('a', '', 1, ['e1']))).toBe('Segunda · Treino · 1 exercício');
    expect(resumoDaSessao(sessao('a'))).toBe('Sem dia fixo · Treino · 0 exercícios');
  });

  it('sessão e exercício novos nascem completos', () => {
    expect(novaSessao(2)).toMatchObject({ nome: 'Terça', diaSemana: 2, tipo: 'TREINO', exercicios: [], grupos: [] });
    expect(novoExercicio()).toMatchObject({ series: [], grupoUid: null, unidade: 'kg', progressao: true });
  });
});

describe('exercícios feitos juntos ao mover e remover', () => {
  const ex = (uid: string, grupoUid: string | null = null): ExercicioPlano => exercicio(uid, { grupoUid });

  it('mover pelo editor usa a mesma regra dos grupos: o solto passa por cima do grupo inteiro', () => {
    const s = { exercicios: [ex('A', 'g'), ex('B', 'g'), ex('C')], grupos: [grupo('g')] };
    expect(moverExercicio(s, 2, -1).exercicios.map((e) => e.uid)).toEqual(['C', 'A', 'B']);
    expect(moverExercicio(s, 0, -1)).toBe(s);
  });

  it('remover um membro desfaz o grupo que cai abaixo do mínimo', () => {
    const s = { exercicios: [ex('A', 'g'), ex('B', 'g'), ex('C')], grupos: [grupo('g')] };
    const r = removerExercicio(s, 0);
    expect(r.exercicios.map((e) => [e.uid, e.grupoUid])).toEqual([['B', null], ['C', null]]);
    expect(r.grupos).toEqual([]);
  });
});

describe('modalidade do exercício', () => {
  it('cardio, elástico e peso corporal não têm campo de carga', () => {
    expect(unidadeDaModalidade('CARDIO')).toBe('nenhuma');
    expect(unidadeDaModalidade('ELASTICO')).toBe('nenhuma');
    expect(unidadeDaModalidade('PESO_CORPORAL')).toBe('nenhuma');
    expect(unidadeDaModalidade('LIVRE')).toBe('kg');
    expect(unidadeDaModalidade(null)).toBe('kg');
  });

  it('entrar ou sair do cardio descarta as séries incompatíveis (e avisa antes); outras trocas mantêm', () => {
    const comSeries = exercicio('e', { modalidade: 'LIVRE', series: [ws('a')] });
    expect(trocaApagaSeries(comSeries, 'CARDIO')).toBe(true);
    expect(trocaApagaSeries(comSeries, 'MAQUINA')).toBe(false);
    expect(trocaApagaSeries(exercicio('v', { modalidade: 'LIVRE' }), 'CARDIO')).toBe(false);
    const cardio = comModalidade(comSeries, 'CARDIO');
    expect(cardio).toMatchObject({ modalidade: 'CARDIO', unidade: 'nenhuma', series: [] });
    const volta = comModalidade({ ...cardio, series: [novaSerieDeCardio()] }, 'LIVRE');
    expect(volta).toMatchObject({ modalidade: 'LIVRE', unidade: 'kg', series: [] });
    expect(comModalidade(comSeries, 'MAQUINA').series).toHaveLength(1);
  });
});
