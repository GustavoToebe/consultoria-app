import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';
import { agrupar, descreverSeries } from './agrupamento';
import { novaSerie, tecnicaVazia } from './editorTreino';
import {
  acrescentarExemplo,
  novaWsComRestPause,
  PAUSA_DO_EXEMPLO_CLUSTER,
  restPauseNestaSerie,
  textoDaContagemDeSeries,
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
    expect(nova.uid).toBe(serie.uid);
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

test('técnica vazia de rest-pause continua com os campos do contrato', () => {
  expect(tecnicaVazia('REST_PAUSE').tipo).toBe('REST_PAUSE');
});
