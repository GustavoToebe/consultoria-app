import type { DiaDeTreino } from '../api/tipos';
import { hojeEmBrasilia } from './financeiro';
import {
  corDaLetra,
  fraseDoHistorico,
  intervaloDoPeriodo,
  letraDaDivisaoNoHistorico,
  letrasDasDivisoes,
  opcoesDePeriodo,
  partesDaData,
  pastaAnterior,
  periodoDesdeOPrimeiro,
  periodoValido,
  rotuloDoPeriodo,
  semanasDoHistorico,
  tituloDaSemana,
  treinosDaSemana,
} from './historicoDoAluno';

const pasta = (id: string, inicio: string | null, fim: string | null) => ({ id, inicio, fim });
const dia = (data: string, sessoes: string[] = ['Treino A']): DiaDeTreino => ({
  data,
  sessoes: sessoes.map((s, i) => ({ sessaoUid: `u${i}`, sessao: s, planoVersaoId: 'v', exercicios: [] })),
});

describe('período do histórico', () => {
  const atual = pasta('p3', '2026-10-01', '2026-10-31');
  const pastas = [pasta('p1', '2026-08-01', '2026-08-31'), pasta('p2', '2026-09-01', '2026-09-30'), atual, pasta('p4', null, null)];

  test('a pasta anterior é a de início mais recente antes da atual', () => {
    expect(pastaAnterior(pastas, atual)?.id).toBe('p2');
    expect(pastaAnterior(pastas, pastas[0])).toBeNull();
    expect(pastaAnterior(pastas, null)).toBeNull();
    expect(pastaAnterior(pastas, pasta('x', null, null))).toBeNull();
  });

  test('as opções só trazem a pasta que tem período; 30 dias sempre', () => {
    expect(opcoesDePeriodo(atual, pastas[1]).map((o) => o.rotulo)).toEqual(['Pasta em uso', 'Pasta anterior', 'Últimos 30 dias']);
    expect(opcoesDePeriodo(atual, null).map((o) => o.valor)).toEqual(['PASTA_ATUAL', 'ULTIMOS_30']);
    expect(opcoesDePeriodo(null, null).map((o) => o.valor)).toEqual(['ULTIMOS_30']);
  });

  test('a escolha que não existe mais volta ao padrão', () => {
    expect(periodoValido(null, atual, null)).toBe('PASTA_ATUAL');
    expect(periodoValido('PASTA_ANTERIOR', atual, null)).toBe('PASTA_ATUAL');
    expect(periodoValido('PASTA_ANTERIOR', null, null)).toBe('ULTIMOS_30');
    expect(periodoValido('ULTIMOS_30', atual, null)).toBe('ULTIMOS_30');
  });

  test('datas do período e o rótulo na faixa', () => {
    expect(intervaloDoPeriodo('PASTA_ATUAL', '2026-11-03', atual, pastas[1])).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
    expect(intervaloDoPeriodo('PASTA_ANTERIOR', '2026-11-03', atual, pastas[1])).toEqual({ de: '2026-09-01', ate: '2026-09-30' });
    expect(intervaloDoPeriodo('ULTIMOS_30', '2026-11-03', atual, null)).toEqual({ de: '2026-10-05', ate: '2026-11-03' });
    expect(rotuloDoPeriodo('PASTA_ATUAL', '2026-10-01', '2026-10-31')).toBe('Pasta em uso: 01/10 a 31/10');
    expect(rotuloDoPeriodo('ULTIMOS_30', '2026-10-05', '2026-11-03')).toBe('Últimos 30 dias: 05/10 a 03/11');
  });

  test('frase do que está mostrando, por visão', () => {
    expect(fraseDoHistorico('divisao', '2026-10-01', '2026-10-31')).toBe(
      'Mostrando a carga de trabalho de cada exercício por divisão, de 01/10 a 31/10. Carga e reps contam só as séries de trabalho.',
    );
    expect(fraseDoHistorico('dia', '2026-10-01', '2026-10-31')).toContain('agrupados por semana');
  });

  test('desde o primeiro registro', () => {
    expect(periodoDesdeOPrimeiro(['2026-05-02', '2026-03-12'])).toBe('Desde o primeiro registro (12/03/2026)');
    expect(periodoDesdeOPrimeiro([])).toBe('Desde o primeiro registro');
  });
});

const PERIODO_DE_OUTUBRO = { de: '2026-10-01', ate: '2026-10-31' };
/** Hoje depois do período: nenhum dia dele "ainda não chegou". */
const DEPOIS = '2026-11-20';

describe('semana → dia', () => {
  test('agrupa de segunda a domingo, do mais recente ao mais antigo', () => {
    // 2026-10-05 é segunda; 2026-10-11, domingo.
    const semanas = semanasDoHistorico([dia('2026-10-07'), dia('2026-10-13'), dia('2026-10-11', ['Treino B']), dia('2026-10-05', [])], PERIODO_DE_OUTUBRO, DEPOIS);
    expect(semanas.map((s) => [s.inicio, s.fim])).toEqual([['2026-10-12', '2026-10-18'], ['2026-10-05', '2026-10-11']]);
    expect(semanas[1].dias.map((d) => d.data)).toEqual(['2026-10-11', '2026-10-07']);
    expect(semanas[1].marcas.map((m) => (m.dia ? m.dia.sessoes[0].sessao : null))).toEqual([null, null, 'Treino A', null, null, null, 'Treino B']);
    expect(tituloDaSemana(semanas[1])).toBe('Semana de 05/10 a 11/10');
    expect(treinosDaSemana(semanas[1])).toBe('2 treinos');
    expect(treinosDaSemana(semanas[0])).toBe('1 treino');
  });

  test('dia fora do período fica neutro e não conta (D1 e D5)', () => {
    // 2026-09-28 é segunda: a semana de 28/09 a 04/10 é cortada em 01/10.
    const semanas = semanasDoHistorico([dia('2026-09-30'), dia('2026-10-02'), dia('2026-10-03')], PERIODO_DE_OUTUBRO, DEPOIS);
    expect(semanas).toHaveLength(1);
    expect(semanas[0].dias.map((d) => d.data)).toEqual(['2026-10-03', '2026-10-02']);
    expect(semanas[0].marcas.map((m) => m.foraDoPeriodo)).toEqual([true, true, true, false, false, false, false]);
    expect(treinosDaSemana(semanas[0])).toBe('2 treinos');
    // O fim do período corta a ponta de cima: 2026-11-02 é segunda, e a semana só tem 02/11 a 03/11 dentro.
    const fim = semanasDoHistorico([dia('2026-11-03')], { de: '2026-10-05', ate: '2026-11-03' }, DEPOIS);
    expect(fim[0].marcas.map((m) => m.foraDoPeriodo)).toEqual([false, false, true, true, true, true, true]);
    // Semana inteira fora do período: não aparece.
    expect(semanasDoHistorico([dia('2026-09-15')], PERIODO_DE_OUTUBRO, DEPOIS)).toEqual([]);
  });

  test('dia depois de hoje dentro do período ainda não chegou: neutro, não é fora do período nem sem treino (D9)', () => {
    // Pasta de 01/10 a 31/10, hoje 15/10 (quinta). A semana de 12/10 a 18/10 tem 16, 17 e 18 ainda por vir.
    const [semana] = semanasDoHistorico([dia('2026-10-13')], PERIODO_DE_OUTUBRO, '2026-10-15');
    expect(semana.marcas.map((m) => m.aindaNaoChegou)).toEqual([false, false, false, false, true, true, true]);
    expect(semana.marcas.every((m) => !m.foraDoPeriodo)).toBe(true);
    expect(treinosDaSemana(semana)).toBe('1 treino');
    // A semana de 28/09 a 04/10, hoje 03/10 (sábado): antes do início é fora; o domingo ainda não chegou.
    const [inicio] = semanasDoHistorico([dia('2026-10-02')], PERIODO_DE_OUTUBRO, '2026-10-03');
    expect(inicio.marcas.map((m) => (m.foraDoPeriodo ? 'fora' : m.aindaNaoChegou ? 'futuro' : 'dentro'))).toEqual(['fora', 'fora', 'fora', 'dentro', 'dentro', 'dentro', 'futuro']);
    // Depois do fim da pasta é fora, mesmo sendo depois de hoje: 2026-10-26 é segunda e 01/11 é domingo.
    const [fim] = semanasDoHistorico([dia('2026-10-27')], { de: '2026-10-01', ate: '2026-10-30' }, '2026-10-28');
    expect(fim.marcas.map((m) => (m.foraDoPeriodo ? 'fora' : m.aindaNaoChegou ? 'futuro' : 'dentro'))).toEqual(['dentro', 'dentro', 'dentro', 'futuro', 'futuro', 'fora', 'fora']);
    // A busca cortada em hoje (últimos 30 dias, ate = hoje): o dia seguinte ainda não chegou, não está fora.
    const [cortada] = semanasDoHistorico([dia('2026-11-03')], { de: '2026-10-05', ate: '2026-11-03' }, '2026-11-03');
    expect(cortada.marcas.map((m) => (m.foraDoPeriodo ? 'fora' : m.aindaNaoChegou ? 'futuro' : 'dentro'))).toEqual(['dentro', 'dentro', 'futuro', 'futuro', 'futuro', 'futuro', 'futuro']);
  });

  test('dia com duas sessões conta 2 treinos e traz as duas', () => {
    const semanas = semanasDoHistorico([dia('2026-10-07', ['Treino A', 'Treino B']), dia('2026-10-08')], PERIODO_DE_OUTUBRO, DEPOIS);
    expect(treinosDaSemana(semanas[0])).toBe('3 treinos');
    expect(semanas[0].marcas[2].dia?.sessoes.map((s) => s.sessao)).toEqual(['Treino A', 'Treino B']);
    expect(treinosDaSemana(semanasDoHistorico([dia('2026-10-07', ['Treino A', 'Treino B'])], PERIODO_DE_OUTUBRO, DEPOIS)[0])).toBe('2 treinos');
  });

  test('sem dias, nenhuma semana', () => {
    expect(semanasDoHistorico([], PERIODO_DE_OUTUBRO, DEPOIS)).toEqual([]);
  });

  test('partes da data', () => {
    expect(partesDaData('2026-10-07')).toEqual({ sigla: 'QUA', dia: '07', mes: 'out', nomeDoDia: 'quarta' });
    expect(partesDaData('2026-10-11').sigla).toBe('DOM');
  });
});

describe('letra e cor da divisão', () => {
  test('pela ordem, A, B, C', () => {
    const letras = letrasDasDivisoes(['Segunda - Peito', 'Quarta - Costas', 'Sexta - Pernas']);
    expect([...letras.values()]).toEqual(['A', 'B', 'C']);
    expect(letraDaDivisaoNoHistorico(letras, 'quarta - costas')).toBe('B');
    expect(letraDaDivisaoNoHistorico(letras, 'Outra')).toBeNull();
  });

  test('a letra que o nome já diz vale, e as outras pegam as livres', () => {
    const letras = letrasDasDivisoes(['Segunda - Treino B - Costas', 'Pernas', 'A - Peito', 'Treino B']);
    expect(letras.get('segunda - treino b - costas')).toBe('B');
    expect(letras.get('a - peito')).toBe('A');
    expect(letras.get('pernas')).toBe('C');
    // A repetida não perde a letra do nome: ganha número, na ordem em que aparece (D2).
    expect(letras.get('treino b')).toBe('B2');
  });

  test('"A", "A2", "A3" e a cor é a da primeira letra', () => {
    const letras = letrasDasDivisoes(['Treino A - Peito', 'Treino A - Costas', 'Treino B', 'Treino A - Pernas']);
    expect([...letras.values()]).toEqual(['A', 'A2', 'B', 'A3']);
    expect(corDaLetra('A2')).toBe(corDaLetra('A'));
    expect(corDaLetra('B3')).toBe(corDaLetra('B'));
  });

  test('divisão sem letra pega a próxima letra que nenhum nome diz, mesmo se o nome vem depois', () => {
    const letras = letrasDasDivisoes(['Pernas', 'Treino A - Peito', 'Treino A - Costas', 'Treino C', 'Ombros']);
    expect(letras.get('pernas')).toBe('B');
    expect(letras.get('treino a - peito')).toBe('A');
    expect(letras.get('treino a - costas')).toBe('A2');
    expect(letras.get('treino c')).toBe('C');
    expect(letras.get('ombros')).toBe('D');
  });

  test('mesmo nome com espaços e maiúsculas é a mesma divisão, sem número', () => {
    const letras = letrasDasDivisoes(['Treino A - Peito', '  treino a - PEITO ', 'Treino A - Costas']);
    expect(letras.size).toBe(2);
    expect(letraDaDivisaoNoHistorico(letras, ' TREINO A - peito')).toBe('A');
    expect(letraDaDivisaoNoHistorico(letras, 'treino a - costas')).toBe('A2');
  });

  test('nome repetido conta uma vez', () => {
    expect(letrasDasDivisoes(['Peito', 'peito ', 'Costas']).size).toBe(2);
  });

  test('cores: A azul, B magenta, C ciano, em ciclo', () => {
    expect(['A', 'B', 'C', 'D', 'E', 'F'].map(corDaLetra)).toEqual(['AZUL', 'MAGENTA', 'CIANO', 'VIOLETA', 'INDIGO', 'AZUL']);
  });
});

describe('"hoje" de Brasília (D4)', () => {
  // 01:30 UTC de 04/11 ainda é 22:30 de 03/11 em Brasília, qualquer que seja o fuso da máquina.
  const instante = new Date('2026-11-04T01:30:00Z');

  test('o dia é o de Brasília e os últimos 30 dias terminam nele', () => {
    const hoje = hojeEmBrasilia(instante);
    expect(hoje).toBe('2026-11-03');
    expect(intervaloDoPeriodo('ULTIMOS_30', hoje, null, null)).toEqual({ de: '2026-10-05', ate: '2026-11-03' });
  });
});
