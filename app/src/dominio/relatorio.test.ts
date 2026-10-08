import type { DiaDeTreino, SerieFeita, Sessao } from '../api/tipos';
import { dataCurta, diaDaSemanaIso } from './formatos';
import { cargasPorDivisao, totalDeRegistros } from './relatorio';
import { datasDaSessao, nomeComDia, podeRegistrarEm } from './semana';

const serie = (extra: Partial<SerieFeita>): SerieFeita => ({
  id: Math.random().toString(36),
  serieUid: 's',
  tipo: 'WS',
  trabalho: true,
  carga: 30,
  unidade: 'kg',
  repeticoes: 6,
  concluida: true,
  observacao: null,
  ...extra,
});

const dia = (data: string, sessao: string, sessaoUid: string, exercicios: DiaDeTreino['sessoes'][0]['exercicios']): DiaDeTreino => ({
  data,
  sessoes: [{ sessaoUid, sessao, planoVersaoId: 'v', exercicios }],
});

const sessao = (uid: string, nome: string, diaSemana: number | null): Sessao => ({
  uid,
  nome,
  diaSemana,
  tipo: 'TREINO',
  frequenciaSemanal: null,
  observacao: null,
  cardio: null,
  exercicios: [],
});

describe('datas da semana', () => {
  it('dia da semana de uma data ISO (07/10/2026 é quarta)', () => {
    expect(diaDaSemanaIso('2026-10-07')).toBe(3);
    expect(diaDaSemanaIso('2026-10-11')).toBe(7);
    expect(dataCurta('2026-10-07')).toBe('07/10');
  });

  it('datas da sessão dentro do período do plano', () => {
    const quarta = sessao('q', 'Pernas', 3);
    expect(datasDaSessao(quarta, '2026-10-05', '2026-10-20', '2026-10-07')).toEqual(['2026-10-07', '2026-10-14']);
    expect(datasDaSessao(sessao('s', 'Costas', 1), '2026-10-05', '2026-10-20', '2026-10-07')).toEqual([
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
    ]);
  });

  it('sessão sem dia fixo não tem datas; período longo vira janela em volta de hoje', () => {
    expect(datasDaSessao(sessao('a', 'Acessórios', null), '2026-10-05', '2026-10-20', '2026-10-07')).toEqual([]);
    const datas = datasDaSessao(sessao('s', 'Costas', 1), '2026-01-05', '2026-12-28', '2026-10-07', 6);
    expect(datas).toHaveLength(6);
    expect(datas).toContain('2026-10-05');
    expect(datas).toContain('2026-10-12');
  });

  it('registra hoje e no passado (até 60 dias), nunca no futuro', () => {
    expect(podeRegistrarEm('2026-10-07', '2026-10-07')).toBe(true);
    expect(podeRegistrarEm('2026-10-05', '2026-10-07')).toBe(true);
    expect(podeRegistrarEm('2026-10-08', '2026-10-07')).toBe(false);
    expect(podeRegistrarEm('2026-07-01', '2026-10-07')).toBe(false);
  });
});

describe('cargas por divisão', () => {
  const dias: DiaDeTreino[] = [
    dia('2026-10-07', 'Pernas', 'p', [
      {
        exercicioUid: 'e1',
        exercicioId: 'mesa',
        nome: 'Mesa flexora',
        series: [serie({ tipo: 'FS', trabalho: false, carga: 45 }), serie({ carga: 90, observacao: 'Falhei na última' })],
      },
    ]),
    dia('2026-10-05', 'Costas', 'c', [
      { exercicioUid: 'e2', exercicioId: 'remada', nome: 'Remada baixa', series: [serie({ carga: 75 })] },
    ]),
    dia('2026-10-12', 'Costas', 'c', [
      { exercicioUid: 'e2', exercicioId: 'remada', nome: 'Remada baixa', series: [serie({ carga: 77.5, repeticoes: 5 })] },
      { exercicioUid: 'e3', exercicioId: null, nome: 'Prancha', series: [serie({ trabalho: false, carga: null, unidade: 'nenhuma', repeticoes: null })] },
      { exercicioUid: 'e4', exercicioId: 'x', nome: 'Não feito', series: [serie({ concluida: false })] },
    ]),
  ];

  it('agrupa por divisão na ordem da semana, com a carga de trabalho de cada dia', () => {
    const r = cargasPorDivisao(dias);
    expect(r.map((d) => d.nome)).toEqual(['Costas', 'Pernas']);
    expect(r[0].exercicios.map((e) => e.nome)).toEqual(['Remada baixa', 'Prancha']);
    expect(r[0].exercicios[0].linhas.map((l) => [l.data, l.carga, l.repeticoes])).toEqual([
      ['2026-10-05', 75, 6],
      ['2026-10-12', 77.5, 5],
    ]);
    expect(r[1].exercicios[0].linhas[0]).toMatchObject({ carga: 90, series: 2, observacoes: ['Falhei na última'] });
    expect(totalDeRegistros(r)).toBe(4);
  });

  it('sem série de trabalho a carga fica vazia (nunca presumida)', () => {
    const prancha = cargasPorDivisao(dias)[0].exercicios[1].linhas[0];
    expect(prancha).toMatchObject({ carga: null, repeticoes: null, semCarga: true, series: 1 });
  });

  it('com o plano, a divisão leva o dia ("Quarta - Pernas")', () => {
    const plano = new Map([['p', sessao('p', 'Pernas', 3)], ['c', sessao('c', 'Costas', 1)]]);
    expect(cargasPorDivisao(dias, plano).map((d) => d.nome)).toEqual(['Segunda - Costas', 'Quarta - Pernas']);
  });
});

describe('nome com o dia', () => {
  it('não repete o dia quando o nome já começa com ele', () => {
    expect(nomeComDia(sessao('a', 'Quarta - Pernas', 3))).toBe('Quarta - Pernas');
    expect(nomeComDia(sessao('a', 'Terca - Peito', 2))).toBe('Terca - Peito');
    expect(nomeComDia(sessao('a', 'Pernas', 3))).toBe('Quarta · Pernas');
    expect(nomeComDia(sessao('a', 'Acessórios', null))).toBe('Acessórios');
  });
});
