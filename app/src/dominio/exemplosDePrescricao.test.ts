import type { TipoDeTecnica } from '../api/tipos';
import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';
import { agrupar } from './agrupamento';
import { novaSerie, tecnicaVazia } from './editorTreino';
import {
  assinaturaDoEsforco,
  esforcoAindaEhODoTipo,
  marcaConfere,
  origemAposConteudo,
  origemAoTrocarTipo,
  podeRestPauseNaUltima,
  restPauseNestaSerie,
  textoDaContagemDeSeries,
  textoDaRevisaoDoEsforco,
} from './exemplosDePrescricao';

const trabalho = () => novaSerie(CONFIGURACAO_PADRAO, 'WORKING');

describe('rest-pause na última série', () => {
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

describe('podeRestPauseNaUltima', () => {
  const semRest = { ...CONFIGURACAO_PADRAO, tecnicas: CONFIGURACAO_PADRAO.tecnicas.filter((t) => t.tipo !== 'REST_PAUSE') };
  const semNenhuma = { ...CONFIGURACAO_PADRAO, tecnicas: [] };
  const renomeada = {
    ...CONFIGURACAO_PADRAO,
    tecnicas: CONFIGURACAO_PADRAO.tecnicas.map((t) => (t.tipo === 'REST_PAUSE' ? { ...t, nome: 'Pausa ativa' } : t)),
  };
  const grupoDe = (tipo: string, n: number) => agrupar(Array.from({ length: n }, (_, i) => ({ ...novaSerie(CONFIGURACAO_PADRAO, tipo), uid: `s${i}` })))[0];

  it('vale no grupo de trabalho com duas ou mais séries', () => {
    expect(podeRestPauseNaUltima(grupoDe('WORKING', 2), CONFIGURACAO_PADRAO)).toBe(true);
    expect(podeRestPauseNaUltima(grupoDe('WORKING', 5), CONFIGURACAO_PADRAO)).toBe(true);
  });

  it('não vale com uma série só', () => {
    expect(podeRestPauseNaUltima(grupoDe('WORKING', 1), CONFIGURACAO_PADRAO)).toBe(false);
  });

  it('não vale fora do papel de trabalho', () => {
    expect(podeRestPauseNaUltima(grupoDe('FEEDER', 3), CONFIGURACAO_PADRAO)).toBe(false);
    expect(podeRestPauseNaUltima(grupoDe('WARM_UP', 3), CONFIGURACAO_PADRAO)).toBe(false);
  });

  it('não vale com a técnica fora da metodologia, e renomear a técnica não tira', () => {
    expect(podeRestPauseNaUltima(grupoDe('WORKING', 2), semRest)).toBe(false);
    expect(podeRestPauseNaUltima(grupoDe('WORKING', 2), semNenhuma)).toBe(false);
    expect(podeRestPauseNaUltima(grupoDe('WORKING', 2), renomeada)).toBe(true);
  });

  it('não vale em grupo com técnica (Rest-pause, Cluster, Drop-set ou descritiva)', () => {
    const tipos: TipoDeTecnica[] = ['REST_PAUSE', 'CLUSTER', 'DROP_SET', 'MYO_REPS', 'PARTIAL_REPS', 'FORCED_REPS', 'GVT'];
    for (const tipo of tipos) {
      const series = Array.from({ length: 2 }, (_, i) => ({ ...novaSerie(CONFIGURACAO_PADRAO, 'WORKING'), uid: `s${i}`, tecnica: tecnicaVazia(tipo) }));
      expect(podeRestPauseNaUltima(agrupar(series)[0], CONFIGURACAO_PADRAO)).toBe(false);
    }
  });

  it('vale de novo no grupo de série sem técnica, mesmo com outro grupo de técnica antes', () => {
    const comCluster = { ...novaSerie(CONFIGURACAO_PADRAO, 'WORKING'), uid: 'c', tecnica: tecnicaVazia('CLUSTER') };
    const simples = Array.from({ length: 2 }, (_, i) => ({ ...novaSerie(CONFIGURACAO_PADRAO, 'WORKING'), uid: `s${i}` }));
    const grupos = agrupar([comCluster, ...simples]);
    expect(podeRestPauseNaUltima(grupos[0], CONFIGURACAO_PADRAO)).toBe(false);
    expect(podeRestPauseNaUltima(grupos[1], CONFIGURACAO_PADRAO)).toBe(true);
  });

  it('a técnica fora da metodologia também não entra pelo restPauseNestaSerie', () => {
    const serie = trabalho();
    const grupo = agrupar([serie])[0];
    expect(restPauseNestaSerie([serie], grupo, semRest)[0].tecnica).toBeNull();
    expect(restPauseNestaSerie([serie], grupo, renomeada)[0].tecnica?.tipo).toBe('REST_PAUSE');
  });
});

test('técnica vazia de rest-pause continua com os campos do contrato', () => {
  expect(tecnicaVazia('REST_PAUSE').tipo).toBe('REST_PAUSE');
});
