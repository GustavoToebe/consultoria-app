import type { ExercicioPlano, RecordesDoPacote, Serie } from '../api/tipos';
import { exercicio, serie, tecnica } from './exemplosDeTreino.apoioTeste';
import {
  acumular,
  conta,
  doDia,
  marcaDoRegistro,
  melhores,
  recordes,
  recordesDoExercicio,
  serieSimples,
  seriesComRecorde,
  textoDaContagem,
  textoDoRecorde,
  type EntradaDoExercicio,
  type Marca,
  type Recorde,
  type RegistroParaRecorde,
} from './recordesPessoais';

const m = (carga: number, repeticoes: number): Marca => ({ carga, repeticoes });
const tipos = (r: Recorde[]) => r.map((x) => x.tipo);

/** Os mesmos casos do `RecordesPessoaisTest` da API: os dois lados têm de dar o mesmo resultado. */
describe('regra dos recordes (espelho da API)', () => {
  it('melhores juntam maior carga, maior volume e repetições por carga, sem depender da ordem', () => {
    const a = melhores([m(60, 10), m(70, 5), m(60, 12), m(60.0, 8)])!;
    const b = melhores([m(60, 8), m(60, 12), m(70, 5), m(60, 10)])!;
    expect(a).toEqual({ maiorCarga: 70, maiorVolume: 720, repeticoesPorCarga: [{ carga: 60, repeticoes: 12 }, { carga: 70, repeticoes: 5 }] });
    expect(b).toEqual(a);
    expect(melhores([])).toBeNull();
  });

  it('os três tipos, e empate não é recorde', () => {
    const base = melhores([m(60, 10), m(70, 5)]);
    expect(tipos(recordes(base, m(72.5, 4)))).toEqual(['MAIOR_CARGA']);
    expect(tipos(recordes(base, m(60, 11)))).toEqual(['MAIS_REPETICOES', 'MAIOR_VOLUME']);
    expect(tipos(recordes(base, m(70, 6)))).toEqual(['MAIS_REPETICOES']);
    expect(tipos(recordes(base, m(50, 13)))).toEqual(['MAIOR_VOLUME']);
    expect(recordes(base, m(70, 5))).toEqual([]);
    expect(recordes(base, m(60, 10))).toEqual([]);
    expect(tipos(recordes(base, m(70, 9)))).toEqual(['MAIS_REPETICOES', 'MAIOR_VOLUME']);
    expect(tipos(recordes(base, m(75, 9)))).toEqual(['MAIOR_CARGA', 'MAIOR_VOLUME']);
  });

  it('o valor de cada recorde é o que bateu', () => {
    const r = recordes(melhores([m(60, 10)]), m(62.5, 10));
    expect(r).toEqual([
      { tipo: 'MAIOR_CARGA', carga: 62.5, repeticoes: 10, valor: 62.5 },
      { tipo: 'MAIOR_VOLUME', carga: 62.5, repeticoes: 10, valor: 625 },
    ]);
  });

  it('sem histórico não há recorde: o primeiro registro não conta', () => {
    expect(recordes(null, m(100, 10))).toEqual([]);
    expect(doDia(null, [m(50, 10), m(55, 10)])).toEqual([[], []]);
  });

  it('no dia, cada série compara com o histórico e as anteriores do mesmo dia', () => {
    const dia = doDia(melhores([m(60, 10)]), [m(65, 8), null, m(65, 8), m(67.5, 6), m(65, 9)]);
    expect(dia.map(tipos)).toEqual([['MAIOR_CARGA'], [], [], ['MAIOR_CARGA'], ['MAIS_REPETICOES']]);
  });

  it('conta só com carga e repetições maiores que zero', () => {
    expect(conta(20, 8)).toBe(true);
    expect(conta(0, 8)).toBe(false);
    expect(conta(20, 0)).toBe(false);
    expect(conta(null, 8)).toBe(false);
    expect(conta(20, null)).toBe(false);
    expect(conta(Number.NaN, 8)).toBe(false);
  });

  it('ponto flutuante não vira recorde: 0,1 × 3 empata com 0,3 do servidor', () => {
    const base = { maiorCarga: 1, maiorVolume: 0.3, repeticoesPorCarga: [{ carga: 0.1, repeticoes: 3 }] };
    expect(recordes(base, m(0.1, 3))).toEqual([]);
    expect(acumular(base, m(0.1, 3)).maiorVolume).toBe(0.3);
  });
});

describe('série simples e marca do registro', () => {
  it('técnica, cardio ou exercício sem carga não contam', () => {
    const e = exercicio('e');
    expect(serieSimples(e, serie('a'))).toBe(true);
    expect(serieSimples(e, serie('a', { tecnica: tecnica('DROP_SET', { quedas: 1 }) }))).toBe(false);
    expect(serieSimples(e, serie('a', { tecnica: tecnica('NEGATIVA') }))).toBe(false);
    expect(serieSimples(e, serie('a', { tecnica: tecnica('CLUSTER', { blocos: [3, 3] }) }))).toBe(false);
    expect(serieSimples(exercicio('e', { modalidade: 'CARDIO' }), serie('a'))).toBe(false);
    expect(serieSimples(exercicio('e', { unidade: 'nenhuma' }), serie('a'))).toBe(false);
  });

  it('registro só conta feito, sem etapas e com carga e repetições', () => {
    const r = { concluida: true, etapas: null, carga: 60, repeticoes: 10 };
    expect(marcaDoRegistro(r)).toEqual(m(60, 10));
    expect(marcaDoRegistro({ ...r, concluida: false })).toBeNull();
    expect(marcaDoRegistro({ ...r, etapas: [{}] })).toBeNull();
    expect(marcaDoRegistro({ ...r, etapas: [] })).toEqual(m(60, 10));
    expect(marcaDoRegistro({ ...r, repeticoes: null })).toBeNull();
    expect(marcaDoRegistro(undefined)).toBeNull();
  });
});

describe('recordesDoExercicio (na tela do aluno, sem internet)', () => {
  const HOJE = '2026-10-28';
  const s1 = serie('s1');
  const s2 = serie('s2');
  const s3 = serie('s3', { tecnica: tecnica('DROP_SET', { quedas: 1 }) });
  const supino: ExercicioPlano = exercicio('e1', { exercicioId: 'x1', nome: 'Supino', series: [s1, s2, s3] });
  const doPacote = (exercicios: RecordesDoPacote['exercicios'] = { x1: melhores([m(60, 10), m(70, 5)])! }): RecordesDoPacote => ({ ate: HOJE, exercicios });
  const reg = (serieUid: string, carga: number | null, repeticoes: number | null, extra: Partial<RegistroParaRecorde> = {}): RegistroParaRecorde => ({
    planoVersaoId: 'v1',
    exercicioUid: 'e1',
    serieUid,
    exercicioId: 'x1',
    data: HOJE,
    carga,
    repeticoes,
    concluida: true,
    etapas: null,
    ...extra,
  });
  const naVersao = (planoVersaoId: string, serieUid: string): { exercicio: ExercicioPlano; serie: Serie } | null => {
    if (planoVersaoId !== 'v1') return null;
    const s = supino.series.find((x) => x.uid === serieUid);
    return s ? { exercicio: supino, serie: s } : null;
  };
  const entrada = (extra: Partial<EntradaDoExercicio>): EntradaDoExercicio => ({
    recordes: doPacote(),
    exercicio: supino,
    versaoId: 'v1',
    data: HOJE,
    registros: [],
    serieDaVersao: naVersao,
    ...extra,
  });

  it('medalha nas séries que batem o histórico, na ordem do plano; série com técnica nunca', () => {
    const r = recordesDoExercicio(entrada({ registros: [reg('s1', 72.5, 5), reg('s2', 72.5, 6), reg('s3', 100, 10)] }));
    expect(Object.keys(r)).toEqual(['s1', 's2']);
    expect(tipos(r.s1!)).toEqual(['MAIOR_CARGA']);
    expect(tipos(r.s2!)).toEqual(['MAIS_REPETICOES']);
  });

  it('a marcação que acabou de acontecer vale no lugar do registro da série', () => {
    const r = recordesDoExercicio(entrada({ registros: [reg('s1', 60, 8)], marcacao: { serieUid: 's1', carga: 75, repeticoes: 5, concluida: true } }));
    expect(tipos(r.s1!)).toEqual(['MAIOR_CARGA']);
    expect(recordesDoExercicio(entrada({ registros: [reg('s1', 75, 5)], marcacao: { serieUid: 's1', carga: 75, repeticoes: 5, concluida: false } }))).toEqual({});
  });

  it('o que o app conhece depois do corte entra na base: ontem já bateu 80, hoje 75 não é recorde', () => {
    const ontem = { ...doPacote(), ate: '2026-10-27' };
    const registros = [reg('s1', 80, 5, { data: '2026-10-27' }), reg('s1', 75, 5)];
    expect(recordesDoExercicio(entrada({ recordes: ontem, registros }))).toEqual({});
    // O mesmo exercício em outra linha do dia (ou de outra versão) conta como anterior: na dúvida, não comemora.
    const outraLinha = [reg('s9', 90, 5, { exercicioUid: 'e7' }), reg('s1', 85, 5)];
    expect(recordesDoExercicio(entrada({ registros: outraLinha }))).toEqual({});
    const outraVersao = [reg('s1', 90, 5, { planoVersaoId: 'v0' }), reg('s1', 85, 5)];
    expect(recordesDoExercicio(entrada({ registros: outraVersao }))).toEqual({});
  });

  it('registro com técnica na versão em uso não entra na base', () => {
    // Ontem (depois do corte) o drop-set de 100 kg foi feito: não é base, então 72,5 kg hoje ainda é a maior carga.
    const registros = [reg('s3', 100, 10, { data: '2026-10-27' }), reg('s1', 72.5, 5)];
    expect(tipos(recordesDoExercicio(entrada({ recordes: { ...doPacote(), ate: '2026-10-27' }, registros })).s1!)).toEqual(['MAIOR_CARGA']);
  });

  it('sem histórico do exercício (primeiro dia), sem pacote, sem exercício da biblioteca ou antes do corte: nada', () => {
    const registros = [reg('s1', 100, 10)];
    expect(recordesDoExercicio(entrada({ recordes: doPacote({}), registros }))).toEqual({});
    expect(recordesDoExercicio(entrada({ recordes: undefined, registros }))).toEqual({});
    expect(recordesDoExercicio(entrada({ exercicio: { ...supino, exercicioId: null }, registros }))).toEqual({});
    expect(recordesDoExercicio(entrada({ data: '2026-10-27', registros: [reg('s1', 100, 10, { data: '2026-10-27' })] }))).toEqual({});
  });

  it('registro de outro exercício da biblioteca não mexe na base', () => {
    const registros = [reg('s9', 200, 10, { exercicioId: 'x2', exercicioUid: 'e2' }), reg('s1', 72.5, 5)];
    expect(tipos(recordesDoExercicio(entrada({ registros })).s1!)).toEqual(['MAIOR_CARGA']);
  });
});

describe('textos', () => {
  it('aviso de cada tipo e a contagem do dia', () => {
    expect(textoDoRecorde({ tipo: 'MAIOR_CARGA', carga: 70, repeticoes: 5, valor: 70 })).toBe('Maior carga · 70 kg');
    expect(textoDoRecorde({ tipo: 'MAIOR_CARGA', carga: 72.5, repeticoes: 5, valor: 72.5 })).toBe('Maior carga · 72,5 kg');
    expect(textoDoRecorde({ tipo: 'MAIS_REPETICOES', carga: 60, repeticoes: 12, valor: 12 })).toBe('Mais repetições · 12 com 60 kg');
    expect(textoDoRecorde({ tipo: 'MAIOR_VOLUME', carga: 70, repeticoes: 10, valor: 700 })).toBe('Maior volume · 700 kg');
    expect(seriesComRecorde([{ a: [], b: [] }, {}, { c: [] }])).toBe(3);
    expect(textoDaContagem(0)).toBe('');
    expect(textoDaContagem(1)).toBe('1 recorde pessoal');
    expect(textoDaContagem(3)).toBe('3 recordes pessoais');
  });
});
