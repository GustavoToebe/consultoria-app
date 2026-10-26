import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';
import { agrupar, descreverSeries } from './agrupamento';
import { novaSerie, tecnicaVazia } from './editorTreino';
import {
  acrescentarExemplo,
  assinaturaDoEsforco,
  esforcoAindaEhODoTipo,
  marcaConfere,
  motivoDoExemploCluster,
  motivoDoRestPause,
  novaWsComRestPause,
  origemAposConteudo,
  origemAoTrocarTipo,
  PAUSA_DO_EXEMPLO_CLUSTER,
  restPauseNestaSerie,
  textoDaContagemDeSeries,
  textoDaRevisaoDoEsforco,
} from './exemplosDePrescricao';

const trabalho = () => novaSerie(CONFIGURACAO_PADRAO, 'WORKING');

describe('exemplos de montagem', () => {
  it('FS, WS e Cluster entram como três séries, só a última com a técnica', () => {
    const series = acrescentarExemplo([], CONFIGURACAO_PADRAO, 'fs-ws-cluster');
    expect(descreverSeries(series, CONFIGURACAO_PADRAO)).toEqual([
      '1x10 a 15 - FS 85% da WS',
      '1x6 a 8 - WS · 1 RIR',
      '1x16 (4×4) - WS com Cluster 15 s · 1 RIR',
    ]);
    expect(series[2].tecnica).toMatchObject({ tipo: 'CLUSTER', blocos: [4, 4, 4, 4], pausaSegundos: PAUSA_DO_EXEMPLO_CLUSTER });
    expect(series[0].tecnica).toBeNull();
    expect(series[1].tecnica).toBeNull();
    expect(series.map((s) => s.uid).sort()).toEqual([...new Set(series.map((s) => s.uid))].sort());
  });

  it('FS e Cluster não exigem uma WS simples antes', () => {
    const series = acrescentarExemplo([], CONFIGURACAO_PADRAO, 'fs-cluster');
    expect(series.map((s) => s.tecnica?.tipo ?? null)).toEqual([null, 'CLUSTER']);
    expect(series[1]).toMatchObject({ repsMin: 16, repsMax: 16, carga: { modo: 'CARGA_TRABALHO' } });
  });

  it('o exemplo soma ao que já existe e não mexe no esforço da WS', () => {
    const antes = trabalho();
    const series = acrescentarExemplo([antes], CONFIGURACAO_PADRAO, 'fs-cluster');
    expect(series[0]).toBe(antes);
    expect(series).toHaveLength(3);
    expect(series[2].esforco).toEqual({ rir: 1, rpe: null });
    expect(series[2].descansoSegundos).toBeNull();
  });

  it('sem vaga para o exemplo inteiro, a lista fica igual', () => {
    const series = Array.from({ length: 29 }, (_, i) => ({ ...trabalho(), uid: `s${i}` }));
    expect(acrescentarExemplo(series, CONFIGURACAO_PADRAO, 'fs-cluster')).toEqual(series);
  });
});

describe('rest-pause nas duas montagens', () => {
  it('nesta série aplica a técnica e conserva esforço e descanso', () => {
    const serie = { ...trabalho(), descansoSegundos: 90, esforco: { rir: 2, rpe: null } };
    const grupo = agrupar([serie])[0];
    const [nova] = restPauseNestaSerie([serie], grupo, CONFIGURACAO_PADRAO);
    expect(nova.tecnica?.tipo).toBe('REST_PAUSE');
    expect(nova.esforco).toEqual({ rir: 2, rpe: null });
    expect(nova.descansoSegundos).toBe(90);
    expect(nova.carga).toEqual(serie.carga);
    expect(nova.uid).toBe(serie.uid);
  });

  it('num cartão de duas ou três WS iguais, só a última recebe Rest-pause', () => {
    const montar = (n: number) => Array.from({ length: n }, (_, i) => ({ ...trabalho(), uid: `s${i}`, esforco: { rir: 1, rpe: null } }));
    for (const n of [2, 3]) {
      const series = montar(n);
      const grupo = agrupar(series)[0];
      expect(grupo.series).toHaveLength(n);
      const depois = restPauseNestaSerie(series, grupo, CONFIGURACAO_PADRAO);
      depois.forEach((s, i) => {
        expect(s.uid).toBe(series[i].uid);
        expect(s.esforco).toEqual(series[i].esforco);
        expect(s.tecnica?.tipo ?? null).toBe(i === n - 1 ? 'REST_PAUSE' : null);
      });
    }
  });

  it('uma WS nova com Rest-pause deixa a anterior sem técnica', () => {
    const antes = trabalho();
    const series = novaWsComRestPause([antes], CONFIGURACAO_PADRAO);
    expect(series).toHaveLength(2);
    expect(series[0].tecnica).toBeNull();
    expect(series[1].tecnica?.tipo).toBe('REST_PAUSE');
    expect(series[1].tipo).toBe('WORKING');
    expect(descreverSeries(series, CONFIGURACAO_PADRAO)[1]).toContain('WS + Rest pause');
  });

  it('não aplica Rest-pause numa série que não é de trabalho', () => {
    const fs = novaSerie(CONFIGURACAO_PADRAO, 'FEEDER');
    const grupo = agrupar([fs])[0];
    expect(restPauseNestaSerie([fs], grupo, CONFIGURACAO_PADRAO)[0].tecnica).toBeNull();
  });
});

describe('contagem', () => {
  it('diz quantas séries o exercício fica', () => {
    expect(textoDaContagemDeSeries(0)).toBe('Este exercício fica com 0 séries.');
    expect(textoDaContagemDeSeries(1)).toBe('Este exercício fica com 1 série.');
    expect(textoDaContagemDeSeries(3)).toBe('Este exercício fica com 3 séries.');
  });
});

test('o aviso de esforço do Cluster usa o nome do tipo e não afirma origem sem ela', () => {
  expect(textoDaRevisaoDoEsforco(true, 'WS')).toBe('Este esforço veio do padrão da WS. Revise a prescrição ao usar Cluster.');
  expect(textoDaRevisaoDoEsforco(true, 'Trabalho pesado')).toBe('Este esforço veio do padrão da Trabalho pesado. Revise a prescrição ao usar Cluster.');
  expect(textoDaRevisaoDoEsforco(true, '  ')).toBe('Este esforço veio do padrão deste tipo. Revise a prescrição ao usar Cluster.');
  expect(textoDaRevisaoDoEsforco(false, 'WS')).toBe('Revise o esforço desta série ao usar Cluster.');
});

test('a marca do esforço cai quando o valor muda, mesmo no mesmo uid', () => {
  const marca = assinaturaDoEsforco({ rir: 1, rpe: null });
  expect(esforcoAindaEhODoTipo(marca, { rir: 1, rpe: null })).toBe(true);
  expect(esforcoAindaEhODoTipo(marca, { rir: 2, rpe: null })).toBe(false);
  expect(esforcoAindaEhODoTipo(undefined, { rir: 1, rpe: null })).toBe(false);
});

test('recarga A → B → A e troca externa de tipo não recriam a origem', () => {
  const preenchida = new Map([['s', { assinatura: assinaturaDoEsforco({ rir: 1, rpe: null }), tipo: 'WORKING' }]]);
  const comRir2 = origemAposConteudo(preenchida, [{ uid: 's', tipo: 'WORKING', esforco: { rir: 2, rpe: null } }]);
  expect(comRir2.size).toBe(0);
  const deVolta = origemAposConteudo(comRir2, [{ uid: 's', tipo: 'WORKING', esforco: { rir: 1, rpe: null } }]);
  expect(marcaConfere(deVolta.get('s'), { tipo: 'WORKING', esforco: { rir: 1, rpe: null } })).toBe(false);
  const tipoTrocado = origemAposConteudo(preenchida, [{ uid: 's', tipo: 'LEGADO', esforco: { rir: 1, rpe: null } }]);
  expect(tipoTrocado.size).toBe(0);
  expect(origemAoTrocarTipo([{ uid: 's', tipo: 'LEGADO', esforco: { rir: 2, rpe: null } }], null)).toBeNull();
  const doPadrao = origemAoTrocarTipo([{ uid: 's', tipo: 'WORKING', esforco: { rir: 1, rpe: null } }], { rir: 1, rpe: null });
  expect(marcaConfere(doPadrao?.get('s'), { tipo: 'WORKING', esforco: { rir: 1, rpe: null } })).toBe(true);
});

test('atalho de Cluster ou Rest-pause não entra se a técnica saiu da metodologia', () => {
  const semCluster = { ...CONFIGURACAO_PADRAO, tecnicas: CONFIGURACAO_PADRAO.tecnicas.filter((t) => t.tipo !== 'CLUSTER') };
  const semRest = { ...CONFIGURACAO_PADRAO, tecnicas: CONFIGURACAO_PADRAO.tecnicas.filter((t) => t.tipo !== 'REST_PAUSE') };
  const semNenhuma = { ...CONFIGURACAO_PADRAO, tecnicas: [] };
  const renomeada = {
    ...CONFIGURACAO_PADRAO,
    tecnicas: CONFIGURACAO_PADRAO.tecnicas.map((t) => (t.tipo === 'REST_PAUSE' ? { ...t, nome: 'Pausa ativa' } : t)),
  };
  expect(motivoDoExemploCluster({ config: semCluster, series: 0, exemplo: 'fs-cluster' })).toBe('Cluster não está na metodologia.');
  expect(acrescentarExemplo([], semCluster, 'fs-cluster')).toEqual([]);
  expect(acrescentarExemplo([], semNenhuma, 'fs-ws-cluster')).toEqual([]);
  expect(motivoDoExemploCluster({ config: CONFIGURACAO_PADRAO, series: 0, exemplo: 'fs-cluster' })).toBeUndefined();
  expect(motivoDoRestPause({ config: semRest, cartoesDeTrabalhoAbertos: 1 })).toBe('Rest-pause não está na metodologia.');
  expect(motivoDoRestPause({ config: semNenhuma, cartoesDeTrabalhoAbertos: 1 })).toBe('Rest-pause não está na metodologia.');
  expect(motivoDoRestPause({ config: CONFIGURACAO_PADRAO, cartoesDeTrabalhoAbertos: 0 })).toBe('Abra a série de trabalho.');
  expect(motivoDoRestPause({ config: CONFIGURACAO_PADRAO, cartoesDeTrabalhoAbertos: 2 })).toMatch(/outros cartões/);
  expect(motivoDoRestPause({ config: renomeada, cartoesDeTrabalhoAbertos: 1 })).toBeUndefined();
  const serie = trabalho();
  const grupo = agrupar([serie])[0];
  expect(restPauseNestaSerie([serie], grupo, semRest)[0].tecnica).toBeNull();
  expect(restPauseNestaSerie([serie], grupo, renomeada)[0].tecnica?.tipo).toBe('REST_PAUSE');
  expect(novaWsComRestPause([serie], semRest)).toEqual([serie]);
});

test('técnica vazia de rest-pause continua com os campos do contrato', () => {
  expect(tecnicaVazia('REST_PAUSE').tipo).toBe('REST_PAUSE');
});
