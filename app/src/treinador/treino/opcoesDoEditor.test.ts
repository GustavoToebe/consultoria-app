import type { Configuracao, Problema, Serie } from '../../api/tipos';
import { novaSerie, novaSerieDeCardio } from '../../dominio/editorTreino';
import { CONFIGURACAO_PADRAO } from '../../dominio/metodologiaPadrao';
import {
  ajudaDaCarga,
  formaDoEsforco,
  OPCOES_DE_RIR,
  opcoesDeCombinacao,
  opcoesDeReferencia,
  opcoesDeTecnica,
  opcoesDeTipo,
  formaDasRepeticoes,
  formaVisivel,
  previaDaSerie,
  repeticoesNaForma,
  primeiroProblemaDeSerie,
  problemasDoExercicioSemSeries,
  problemasDoGrupoDeSeries,
  problemasPorSerie,
  referenciaDaCarga,
  rotulosDaFaixa,
  secoesDaSerie,
  subProblemas,
  tipoDaMetodologia,
} from './opcoesDoEditor';

const cfg = CONFIGURACAO_PADRAO;
// O uid vem fixo: no Jest o gerador de UUID do Expo não devolve valor.
let contador = 0;
const serie = (tipo: string, parcial: Partial<Serie> = {}): Serie => ({ ...novaSerie(cfg, tipo), uid: `serie-${++contador}`, ...parcial });
const p = (caminho: string, mensagem: string): Problema => ({ caminho, mensagem });

describe('esforço', () => {
  it('RIR e RPE nunca juntos: a forma sai do que está preenchido', () => {
    expect(formaDoEsforco(null)).toBe('NENHUM');
    expect(formaDoEsforco({ rir: null, rpe: null })).toBe('NENHUM');
    expect(formaDoEsforco({ rir: 2 })).toBe('RIR');
    expect(formaDoEsforco({ rir: 0 })).toBe('RIR');
    expect(formaDoEsforco({ rpe: 8.5 })).toBe('RPE');
  });
  it('o RIR vai de 0 a 5 e o 0 diz até a falha', () => {
    expect(OPCOES_DE_RIR.map((o) => o.valor)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(OPCOES_DE_RIR[0].rotulo).toBe('0 · até a falha');
  });
});

describe('tipos, técnicas e combinações pelo nome', () => {
  it('o chip mostra o nome do tipo e o valor é o código', () => {
    const opcoes = opcoesDeTipo(cfg, []);
    expect(opcoes.find((o) => o.valor === 'WORKING')).toEqual({ valor: 'WORKING', rotulo: 'WS', foraDaMetodologia: false });
    expect(opcoes.find((o) => o.valor === 'FEEDER')?.rotulo).toBe('FS');
  });
  it('código gravado que a metodologia não tem aparece depois, pelo código, uma vez só', () => {
    const opcoes = opcoesDeTipo(cfg, [{ tipo: 'ANTIGO' }, { tipo: 'ANTIGO' }, { tipo: 'WORKING' }, { tipo: null }]);
    expect(opcoes.filter((o) => o.foraDaMetodologia)).toEqual([{ valor: 'ANTIGO', rotulo: 'ANTIGO', foraDaMetodologia: true }]);
    expect(opcoes.at(-1)?.valor).toBe('ANTIGO');
  });
  it('sem metodologia não há tipo da metodologia', () => {
    expect(opcoesDeTipo(null, [])).toEqual([]);
    expect(tipoDaMetodologia(null, { tipo: 'X' })).toBe(true);
    expect(tipoDaMetodologia(cfg, { tipo: 'X' })).toBe(false);
    expect(tipoDaMetodologia(cfg, { tipo: 'WORKING' })).toBe(true);
    expect(tipoDaMetodologia(cfg, { tipo: null })).toBe(true);
  });
  it('"Nenhuma" e as seis técnicas, com o nome da metodologia', () => {
    const config: Configuracao = { ...cfg, tecnicas: cfg.tecnicas.map((t) => (t.tipo === 'CLUSTER' ? { ...t, nome: 'Muscle Round' } : t)) };
    const opcoes = opcoesDeTecnica(config);
    expect(opcoes).toHaveLength(7);
    expect(opcoes[0]).toEqual({ valor: 'NENHUMA', rotulo: 'Nenhuma' });
    expect(opcoes.find((o) => o.valor === 'CLUSTER')?.rotulo).toBe('Muscle Round');
    expect(opcoes.map((o) => o.valor)).toEqual(expect.arrayContaining(['REST_PAUSE', 'CLUSTER', 'DROP_SET', 'MYO_REPS', 'PARTIAL_REPS', 'FORCED_REPS']));
  });
  it('sete combinações', () => {
    expect(opcoesDeCombinacao(cfg)).toHaveLength(7);
  });
  it('a série de referência é uma das anteriores', () => {
    const series = [serie('FEEDER'), serie('WORKING'), serie('BACK_OFF')];
    const opcoes = opcoesDeReferencia(series, 2, cfg);
    expect(opcoes).toEqual([
      { valor: series[0].uid, rotulo: 'Série 1 · FS' },
      { valor: series[1].uid, rotulo: 'Série 2 · WS' },
    ]);
    expect(opcoesDeReferencia(series, 0, cfg)).toEqual([]);
    expect(opcoesDeReferencia(series, -3, cfg)).toEqual([]);
  });
});

describe('carga', () => {
  it('só as formas com percentual têm rótulos de faixa, e o % é sempre da série de trabalho', () => {
    expect(rotulosDaFaixa('PERCENTUAL_WS', cfg)).toMatchObject({ minimo: 'Mínimo', maximo: 'Máximo' });
    expect(rotulosDaFaixa('PERCENTUAL_WS', cfg)?.ajuda).toMatch(/carga da WS \(o tipo de trabalho\), nunca do 1RM/);
    expect(rotulosDaFaixa('ACIMA_DA_ANTERIOR', cfg)?.ajuda).toMatch(/nunca do 1RM/);
    expect(rotulosDaFaixa('ABAIXO_DA_REFERENCIA', cfg)?.ajuda).toMatch(/nunca do 1RM/);
    expect(rotulosDaFaixa('ACIMA_DA_ANTERIOR', cfg)).not.toBeNull();
    expect(rotulosDaFaixa('ABAIXO_DA_REFERENCIA', cfg)).not.toBeNull();
    expect(rotulosDaFaixa('CARGA_TRABALHO', cfg)).toBeNull();
    expect(rotulosDaFaixa('MESMA_CARGA', cfg)).toBeNull();
    expect(rotulosDaFaixa(null, cfg)).toBeNull();
  });
  it('ajuda curta das formas sem faixa', () => {
    expect(ajudaDaCarga('CARGA_TRABALHO', cfg)).toMatch(/WS/);
    expect(ajudaDaCarga('MESMA_CARGA', cfg)).toMatch(/última série de trabalho/);
    expect(ajudaDaCarga('NENHUMA', cfg)).toMatch(/não recebe sugestão/);
    expect(ajudaDaCarga('PERCENTUAL_WS', cfg)).toBeNull();
  });
});

describe('seções do editor', () => {
  it('cardio mostra só a prescrição de cardio', () => {
    expect(secoesDaSerie('CARDIO')).toEqual({ tipo: false, prescricao: false, carga: false, esforco: false, tecnica: false, alvoExtra: false, cardio: true });
  });
  it('as outras modalidades mostram tudo menos cardio', () => {
    for (const m of ['LIVRE', 'MAQUINA', 'ELASTICO', null]) {
      expect(secoesDaSerie(m)).toEqual({ tipo: true, prescricao: true, carga: true, esforco: true, tecnica: true, alvoExtra: true, cardio: false });
    }
  });
});

describe('prévia "Para o aluno"', () => {
  it('abre com o nome do tipo, nunca o código', () => {
    const series = [serie('WORKING', { repsMin: 3, repsMax: 6, carga: { modo: 'CARGA_TRABALHO', percentualMin: null, percentualMax: null, referenciaUid: null } })];
    const previa = previaDaSerie(series, 0, cfg);
    expect(previa.meta.startsWith('WS · ')).toBe(true);
    expect(previa.meta).not.toContain('WORKING');
    expect(previa.meta).toContain('3 a 6');
  });
  it('percentual diz de onde sai a carga', () => {
    const trabalho = serie('WORKING', { carga: { modo: 'CARGA_TRABALHO', percentualMin: null, percentualMax: null, referenciaUid: null } });
    const pct = serie('BACK_OFF', { carga: { modo: 'PERCENTUAL_WS', percentualMin: 85, percentualMax: null, referenciaUid: null } });
    expect(referenciaDaCarga([trabalho, pct], 1, cfg)).toBe('Referência: a carga registrada na série 1 (WS).');
    expect(referenciaDaCarga([pct], 0, cfg)).toBe('Referência: a carga de trabalho do dia, que o aluno informa.');
    expect(referenciaDaCarga([trabalho], 0, cfg)).toBeNull();
  });
  it('acima da anterior sem série anterior avisa; abaixo da referência pede a escolha', () => {
    const acima = serie('TOP_SET', { carga: { modo: 'ACIMA_DA_ANTERIOR', percentualMin: 5, percentualMax: null, referenciaUid: null } });
    expect(referenciaDaCarga([acima], 0, cfg)).toMatch(/Sem série anterior/);
    const abaixo = serie('BACK_OFF', { carga: { modo: 'ABAIXO_DA_REFERENCIA', percentualMin: 10, percentualMax: null, referenciaUid: null } });
    expect(referenciaDaCarga([acima, abaixo], 1, cfg)).toBe('Escolha a série de referência.');
    const apontada = { ...abaixo, carga: { ...abaixo.carga!, referenciaUid: acima.uid } };
    expect(referenciaDaCarga([acima, apontada], 1, cfg)).toBe('Referência: a carga registrada na série 1 (Top set).');
  });
  it('cardio e exercício sem carga não falam de referência', () => {
    expect(previaDaSerie([{ ...novaSerieDeCardio(), uid: 'cardio-1' }], 0, cfg).referencia).toBeNull();
    const pct = serie('BACK_OFF', { carga: { modo: 'PERCENTUAL_WS', percentualMin: 85, percentualMax: null, referenciaUid: null } });
    expect(previaDaSerie([pct], 0, cfg, true).referencia).toBeNull();
  });
});

describe('problemas da validação por série', () => {
  it('cada série recebe os problemas dela, com a chave relativa', () => {
    const erros = [p('series[0].tipo', 'Série sem tipo.'), p('series[1].carga.percentualMin', 'Percentual entre 1 e 200.'), p('series[1].carga.modo', 'Forma inválida.')];
    const avisos = [p('series[1].tipo', 'Tipo fora da metodologia.')];
    const r = problemasPorSerie(erros, avisos, 3);
    expect(r[0]).toEqual({ erros: { tipo: 'Série sem tipo.' }, avisos: {} });
    expect(r[1].erros).toEqual({ 'carga.percentualMin': 'Percentual entre 1 e 200.', 'carga.modo': 'Forma inválida.' });
    expect(r[1].avisos).toEqual({ tipo: 'Tipo fora da metodologia.' });
    expect(r[2]).toEqual({ erros: {}, avisos: {} });
  });
  it('ignora série que não existe e problema que não é de série', () => {
    const r = problemasPorSerie([p('series[7].tipo', 'x'), p('nome', 'y')], [], 2);
    expect(r).toEqual([{ erros: {}, avisos: {} }, { erros: {}, avisos: {} }]);
  });
  it('o que não é de série fica no exercício', () => {
    expect(problemasDoExercicioSemSeries([p('series', 'Exercício sem séries.'), p('series[0].tipo', 'x'), p('progressao', 'aviso')])).toEqual({ series: 'Exercício sem séries.', progressao: 'aviso' });
  });
  it('um grupo de séries iguais junta o primeiro problema de cada campo', () => {
    const porSerie = problemasPorSerie([p('series[1].tipo', 'a'), p('series[2].tipo', 'b'), p('series[2].repsMin', 'c')], [], 4);
    expect(problemasDoGrupoDeSeries(porSerie, 1, 2).erros).toEqual({ tipo: 'a', repsMin: 'c' });
    expect(problemasDoGrupoDeSeries(porSerie, 3, 5).erros).toEqual({});
  });
  it('o motivo do botão cita a série e o primeiro erro', () => {
    const porSerie = problemasPorSerie([p('series[1].carga.percentualMin', 'Percentual entre 1 e 200.')], [], 3);
    expect(primeiroProblemaDeSerie(porSerie)).toBe('Série 2: Percentual entre 1 e 200.');
    expect(primeiroProblemaDeSerie(problemasPorSerie([], [], 2))).toBeNull();
  });
  it('subProblemas tira o prefixo e ignora os outros campos', () => {
    expect(subProblemas({ 'tecnica.blocos': 'x', 'tecnica.pausas': 'y', tipo: 'z' }, 'tecnica')).toEqual({ blocos: 'x', pausas: 'y' });
    expect(subProblemas(undefined, 'tecnica')).toEqual({});
  });
});

describe('repetições: quantidade exata, faixa ou AMRAP (análise 2, A5)', () => {
  it('a forma sai do valor; vazio não decide', () => {
    expect(formaDasRepeticoes({ repsMin: 8, repsMax: 8, amrap: null })).toBe('EXATA');
    expect(formaDasRepeticoes({ repsMin: 6, repsMax: 8, amrap: null })).toBe('FAIXA');
    expect(formaDasRepeticoes({ repsMin: null, repsMax: 8, amrap: null })).toBe('FAIXA');
    expect(formaDasRepeticoes({ repsMin: null, repsMax: null, amrap: true })).toBe('AMRAP');
    expect(formaDasRepeticoes({ repsMin: null, repsMax: null, amrap: null })).toBeNull();
  });

  it('quem escolheu Faixa e digitou 8 a 8 continua em Faixa; vazio fica com a escolha', () => {
    expect(formaVisivel('FAIXA', { repsMin: 8, repsMax: 8 })).toBe('FAIXA');
    expect(formaVisivel('EXATA', { repsMin: 6, repsMax: 8 })).toBe('FAIXA');
    expect(formaVisivel('AMRAP', { repsMin: null, repsMax: null, amrap: null })).toBe('AMRAP');
  });

  it('trocar de forma não inventa número: exata = mínimo = máximo; AMRAP limpa', () => {
    expect(repeticoesNaForma('EXATA', { repsMin: 6, repsMax: 8 })).toEqual({ repsMin: 6, repsMax: 6, amrap: false });
    expect(repeticoesNaForma('EXATA', { repsMin: null, repsMax: 8 })).toEqual({ repsMin: 8, repsMax: 8, amrap: false });
    expect(repeticoesNaForma('FAIXA', { repsMin: 8, repsMax: 8 })).toEqual({ repsMin: 8, repsMax: 8, amrap: false });
    expect(repeticoesNaForma('AMRAP', { repsMin: 6, repsMax: 8 })).toEqual({ repsMin: null, repsMax: null, amrap: true });
  });
});
