import type { DiaDeTreino } from '../api/tipos';
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

describe('semana → dia', () => {
  test('agrupa de segunda a domingo, do mais recente ao mais antigo', () => {
    // 2026-10-05 é segunda; 2026-10-11, domingo.
    const semanas = semanasDoHistorico([dia('2026-10-07'), dia('2026-10-13'), dia('2026-10-11', ['Treino B']), dia('2026-10-05', [])]);
    expect(semanas.map((s) => [s.inicio, s.fim])).toEqual([['2026-10-12', '2026-10-18'], ['2026-10-05', '2026-10-11']]);
    expect(semanas[1].dias.map((d) => d.data)).toEqual(['2026-10-11', '2026-10-07']);
    expect(semanas[1].marcas.map((m) => (m.dia ? m.dia.sessoes[0].sessao : null))).toEqual([null, null, 'Treino A', null, null, null, 'Treino B']);
    expect(tituloDaSemana(semanas[1])).toBe('Semana de 05/10 a 11/10');
    expect(treinosDaSemana(semanas[1])).toBe('2 treinos');
    expect(treinosDaSemana(semanas[0])).toBe('1 treino');
  });

  test('sem dias, nenhuma semana', () => {
    expect(semanasDoHistorico([])).toEqual([]);
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
    // Segundo nome com a mesma letra não a repete.
    expect(letras.get('treino b')).toBe('D');
  });

  test('nome repetido conta uma vez', () => {
    expect(letrasDasDivisoes(['Peito', 'peito ', 'Costas']).size).toBe(2);
  });

  test('cores: A azul, B magenta, C ciano, em ciclo', () => {
    expect(['A', 'B', 'C', 'D', 'E', 'F'].map(corDaLetra)).toEqual(['AZUL', 'MAGENTA', 'CIANO', 'VIOLETA', 'INDIGO', 'AZUL']);
  });
});
