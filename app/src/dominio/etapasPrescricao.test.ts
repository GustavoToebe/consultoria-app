import type { CargaDaEtapa, Retomada } from '../api/tipos';
import { seriesDoPdf } from '../pdf/pdfTreino';
import { ajustarCargasDosBlocos, ajustarRetomadas, cargaDaEtapaNoModo, RETOMADA_PADRAO } from '../treinador/treino/opcoesDoEditor';
import { agrupar } from './agrupamento';
import { calcularCargasDoExercicio, referenciaDaSerie } from './cargas';
import { etapasDaSerie, metaDaRetomada, sugestaoDaEtapa, textoDaCargaDaEtapa } from './etapas';
import { carga, exercicio, serie, tecnica } from './exemplosDeTreino.apoioTeste';
import { CONFIGURACAO_PADRAO as config } from './metodologiaPadrao';
import { linhasDasEtapas, previaDoGrupo } from './resumoDaSerie';
import { validarExercicio } from './validacaoDoTreino';
import { problemasDaTecnica, temEtapaEmPercentual } from './validacaoDeSerie';

/** Lote C (docs/series-etapas.md): carga de cada bloco do Cluster, meta e carga de cada retomada do Rest-pause. */

const DA_SERIE: CargaDaEtapa = { modo: 'DA_SERIE', percentual: null };
const pct = (percentual: number | null): CargaDaEtapa => ({ modo: 'PERCENTUAL_WS', percentual });
const retomada = (extra: Partial<Retomada>): Retomada => ({ repsMin: null, repsMax: null, amrap: null, carga: DA_SERIE, ...extra });

const clusterPct = serie('c', {
  repsMin: 10, repsMax: 10, carga: carga('CARGA_TRABALHO'),
  tecnica: tecnica('CLUSTER', { blocos: [4, 4, 2], pausaSegundos: 15, cargasDosBlocos: [DA_SERIE, pct(90), pct(80)] }),
});
const restPauseMetas = serie('r', {
  repsMin: 6, repsMax: 8, carga: carga('CARGA_TRABALHO'),
  tecnica: tecnica('REST_PAUSE', { pausaSegundos: 20, pausas: 2, retomadas: [retomada({ repsMin: 2, repsMax: 3 }), retomada({ amrap: true, carga: pct(90) })] }),
});

describe('validação igual à do servidor (Tecnica.problemas)', () => {
  it('uma carga por bloco, percentual de 1 a 200, "da série" sem percentual', () => {
    expect(problemasDaTecnica(clusterPct.tecnica)).toEqual({});
    expect(problemasDaTecnica({ ...clusterPct.tecnica!, cargasDosBlocos: [DA_SERIE, pct(90)] })).toEqual({ cargasDosBlocos: 'Informe uma carga para cada bloco.' });
    expect(problemasDaTecnica({ ...clusterPct.tecnica!, cargasDosBlocos: [{ modo: 'DA_SERIE', percentual: 90 }, pct(null), pct(201)] })).toEqual({
      'cargasDosBlocos[0].percentual': 'Bloco 1: Carga da série não leva percentual.',
      'cargasDosBlocos[1].percentual': 'Bloco 2: Percentual da WS entre 1 e 200.',
      'cargasDosBlocos[2].percentual': 'Bloco 3: Percentual da WS entre 1 e 200.',
    });
  });

  it('uma retomada por pausa, meta escolhida (exata, faixa ou AMRAP) e carga obrigatória', () => {
    expect(problemasDaTecnica(restPauseMetas.tecnica)).toEqual({});
    expect(problemasDaTecnica({ ...restPauseMetas.tecnica!, pausas: 1 })).toEqual({ retomadas: 'Informe uma retomada para cada pausa.' });
    expect(problemasDaTecnica(tecnica('REST_PAUSE', { pausaSegundos: 20, pausas: 3, retomadas: [
      retomada({}), retomada({ repsMin: 3, repsMax: 2, carga: null }), retomada({ repsMin: 2, repsMax: 2, amrap: true, carga: pct(250) }),
    ] }))).toEqual({
      'retomadas[0].repsMin': 'Retomada 1: Informe as repetições (exatas ou faixa) ou AMRAP.',
      'retomadas[1].repsMax': 'Retomada 2: Repetição máxima menor que a mínima.',
      'retomadas[1].carga': 'Retomada 2: Informe a carga: da série ou percentual da WS.',
      'retomadas[2].amrap': 'Retomada 3: AMRAP não leva repetições mínima e máxima.',
      'retomadas[2].carga.percentual': 'Retomada 3: Percentual da WS entre 1 e 200.',
    });
  });

  it('não entram no padrão da metodologia; em outra técnica são ignorados', () => {
    expect(problemasDaTecnica(clusterPct.tecnica, false)).toHaveProperty('cargasDosBlocos');
    expect(problemasDaTecnica(restPauseMetas.tecnica, false)).toHaveProperty('retomadas');
    expect(problemasDaTecnica(tecnica('DROP_SET', { quedas: 1, cargasDosBlocos: [pct(500)] }))).toEqual({});
  });

  it('exercício sem carga: sem carga por bloco nem retomada em %', () => {
    const r = validarExercicio(exercicio('e', { unidade: 'nenhuma', series: [clusterPct, restPauseMetas, { ...restPauseMetas, uid: 'r2', tecnica: { ...restPauseMetas.tecnica!, retomadas: [retomada({ amrap: true }), retomada({ amrap: true })] } }] }), config);
    const caminhos = r.erros.map((e) => e.caminho);
    expect(caminhos).toContain('series[0].tecnica.cargasDosBlocos');
    expect(caminhos).toContain('series[1].tecnica.retomadas');
    expect(caminhos).not.toContain('series[2].tecnica.retomadas');
  });
});

describe('etapas previstas com carga e meta', () => {
  it('Cluster: carga de cada bloco ("da série" vira nulo)', () => {
    const e = etapasDaSerie(clusterPct)!;
    expect(e.map((x) => x.carga)).toEqual([null, pct(90), pct(80)]);
    expect(e.map((x) => textoDaCargaDaEtapa(x.carga, 'WS'))).toEqual([null, '90% da WS', '80% da WS']);
  });

  it('Rest-pause: a etapa inicial é a série; cada retomada com a meta e a carga escritas', () => {
    const e = etapasDaSerie(restPauseMetas)!;
    expect(e.map((x) => `${x.rotulo}: ${x.meta}`)).toEqual(['Etapa inicial: 6 a 8 reps', 'Retomada 1: 2 a 3 reps', 'Retomada 2: AMRAP']);
    expect(e.map((x) => x.carga)).toEqual([null, null, pct(90)]);
    expect(metaDaRetomada(retomada({ repsMin: 2, repsMax: 2 }))).toBe('2 reps');
    expect(metaDaRetomada(null)).toBe('até a falha');
    expect(etapasDaSerie({ ...restPauseMetas, tecnica: { ...restPauseMetas.tecnica!, retomadas: [retomada({ repsMin: 2, repsMax: 2 }), RETOMADA_PADRAO] } })![1].repsExatas).toBe(2);
  });
});

describe('sugestão por etapa: mesma referência para todas, nunca % sobre %', () => {
  it('percentual da referência (congelada ou a de agora), arredondado pelo passo; "da série" segue a da série', () => {
    const [b1, b2, b3] = etapasDaSerie(clusterPct)!;
    expect(sugestaoDaEtapa(b1, 100, 100, 2.5)).toBe(100);
    expect(sugestaoDaEtapa(b2, 100, 100, 2.5)).toBe(90);
    expect(sugestaoDaEtapa(b3, 100, 100, 2.5)).toBe(80);
    // Referência 47 kg: 90% = 42,3 → 42,5; 80% = 37,6 → 37,5. Sem referência, não há sugestão (nunca inventa).
    expect(sugestaoDaEtapa(b2, 47, 47, 2.5)).toBe(42.5);
    expect(sugestaoDaEtapa(b3, 47, 47, 2.5)).toBe(37.5);
    expect(sugestaoDaEtapa(b2, null, null, 2.5)).toBeNull();
  });

  it('série sem referência externa própria (acima da anterior) usa a referência da WS quando há etapa em %', () => {
    const ws = serie('ws', { carga: carga('CARGA_TRABALHO') });
    const top = serie('top', { repsMin: 2, repsMax: 2, carga: carga('ACIMA_DA_ANTERIOR', 5), tecnica: tecnica('REST_PAUSE', { pausaSegundos: 20, retomadas: [retomada({ amrap: true, carga: pct(90) })] }) });
    expect(temEtapaEmPercentual(top.tecnica)).toBe(true);
    expect(referenciaDaSerie([ws, top], 1, 40, { ws: 42 })).toEqual({ valor: 42, origem: 'WS_ANTERIOR' });
    expect(referenciaDaSerie([ws, { ...top, tecnica: tecnica('REST_PAUSE', { pausaSegundos: 20 }) }], 1, 40, { ws: 42 })).toBeNull();
    const calc = calcularCargasDoExercicio(exercicio('e', { series: [ws, top] }), 40, { ws: 42 }, { arredondamentoKg: 2.5, tipoTrabalho: 'WS' });
    expect(calc[1].sugestao).toBe(45);
    expect(calc[1].referencia).toEqual({ valor: 42, origem: 'WS_ANTERIOR' });
  });
});

describe('texto para o treinador, o PDF e o aluno', () => {
  it('linhas de cada etapa e a referência dos percentuais', () => {
    expect(linhasDasEtapas(clusterPct, config)).toEqual([
      'Bloco 1: carga da série', 'Bloco 2: 90% da WS', 'Bloco 3: 80% da WS',
      'Percentuais da carga de trabalho do dia, fixada ao registrar a primeira etapa.',
    ]);
    expect(linhasDasEtapas(restPauseMetas, config)).toEqual([
      'Retomada 1: 2 a 3 reps, carga da série', 'Retomada 2: AMRAP, 90% da WS',
      'Percentuais da carga de trabalho do dia, fixada ao registrar a primeira etapa.',
    ]);
    const mesma = { ...clusterPct, carga: carga('MESMA_CARGA') };
    expect(linhasDasEtapas(mesma, config).at(-1)).toBe('Percentuais da última WS registrada antes no exercício (sem ela, da carga de trabalho do dia), fixada ao registrar a primeira etapa.');
    expect(linhasDasEtapas(serie('x', { tecnica: tecnica('CLUSTER', { blocos: [4, 4], pausaSegundos: 15 }) }), config)).toEqual([]);
  });

  it('a prévia do editor e o PDF trazem as linhas; exercício sem carga, não', () => {
    const [g] = agrupar([clusterPct]);
    expect(previaDoGrupo(g, [clusterPct], config, {}).linhas).toContain('Bloco 2: 90% da WS');
    expect(previaDoGrupo(g, [clusterPct], config, { semCarga: true }).linhas).not.toContain('Bloco 2: 90% da WS');
    expect(seriesDoPdf({ series: [restPauseMetas] }, config)[0].detalhes).toContain('Retomada 2: AMRAP, 90% da WS');
  });

  it('séries com cargas por bloco diferentes não se juntam no mesmo grupo do editor', () => {
    const outra = { ...clusterPct, uid: 'c2', tecnica: { ...clusterPct.tecnica!, cargasDosBlocos: [DA_SERIE, pct(85), pct(80)] } };
    expect(agrupar([clusterPct, outra])).toHaveLength(2);
    expect(agrupar([clusterPct, { ...clusterPct, uid: 'c3' }])).toHaveLength(1);
  });
});

describe('editor: listas acompanham blocos e pausas', () => {
  it('bloco novo herda a carga da série; bloco que sai leva a dele; desligado continua nulo', () => {
    expect(ajustarCargasDosBlocos([DA_SERIE, pct(90)], [4, 4, 2])).toEqual([DA_SERIE, pct(90), DA_SERIE]);
    expect(ajustarCargasDosBlocos([DA_SERIE, pct(90), pct(80)], [5, 5])).toEqual([DA_SERIE, pct(90)]);
    expect(ajustarCargasDosBlocos(null, [4, 4])).toBeNull();
  });

  it('uma retomada por pausa (vazio = 1), a nova até a falha com a carga da série', () => {
    expect(ajustarRetomadas([retomada({ repsMin: 2, repsMax: 2 })], 2)).toEqual([retomada({ repsMin: 2, repsMax: 2 }), RETOMADA_PADRAO]);
    expect(ajustarRetomadas([retomada({ amrap: true }), RETOMADA_PADRAO], null)).toHaveLength(1);
    expect(ajustarRetomadas(null, 3)).toBeNull();
  });

  it('trocar para % não inventa número; voltar para "da série" limpa', () => {
    expect(cargaDaEtapaNoModo('PERCENTUAL_WS', DA_SERIE)).toEqual(pct(null));
    expect(cargaDaEtapaNoModo('PERCENTUAL_WS', pct(90))).toEqual(pct(90));
    expect(cargaDaEtapaNoModo('DA_SERIE', pct(90))).toEqual(DA_SERIE);
  });
});
