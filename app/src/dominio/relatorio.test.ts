import type { DiaDeTreino, EtapaRegistrada, SerieFeita, Sessao } from '../api/tipos';
import { textoCarga } from '../pdf/pdfCargas';
import { dataCurta, diaDaSemanaIso } from './formatos';
import { cargasPorDivisao, filtrarPorSessoes, intervaloDeRegistros, opcoesDeProgresso, partesDaDivisao, totalDeRegistros, ultimoRegistroDaDivisao } from './relatorio';
import { marcasDoEixo } from './grafico';
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
  grupos: [],
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
    expect(podeRegistrarEm('2026-10-08', '2026-10-07')).toBe(true);
    expect(podeRegistrarEm('2026-12-07', '2026-10-07')).toBe(false);
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

describe('cargas por divisão com séries por etapa', () => {
  const etapa = (posicao: number, repeticoes: number | null, carga: number | null): EtapaRegistrada => ({ posicao, repeticoes, carga, situacao: 'FEITA' });
  const naoFeita = (posicao: number): EtapaRegistrada => ({ posicao, repeticoes: null, carga: null, situacao: 'NAO_REALIZADA' });
  const linhaDe = (...series: SerieFeita[]) =>
    cargasPorDivisao([dia('2026-10-07', 'Costas', 'c', [{ exercicioUid: 'e', exercicioId: 'remada', nome: 'Remada', series }])])[0].exercicios[0].linhas[0];

  it('carga comum: a carga, os blocos com o total do servidor e o volume do histórico', () => {
    const l = linhaDe(serie({ tipo: 'Cluster', carga: 40, repeticoes: 14, etapas: [etapa(1, 4, 40), etapa(2, 4, 40), etapa(3, 4, 40), etapa(4, 2, 40)] }));
    expect(l).toMatchObject({ carga: 40, cargaVariavel: false, etapas: '4+4+4+2 = 14', repeticoes: 14, series: 1, volume: { valor: 560, completo: true } });
  });

  it('carga variável: sem carga única (nunca a maior nem a última) e com os blocos', () => {
    const l = linhaDe(serie({ carga: null, repeticoes: 8, etapas: [etapa(1, 4, 40), etapa(2, 4, 42.5)] }));
    expect(l).toMatchObject({ carga: null, cargaVariavel: true, etapas: '4+4 = 8', repeticoes: 8, volume: { valor: 330, completo: true } });
  });

  it('parcial: a execução incompleta entra, sem total e escrita como parcial', () => {
    const l = linhaDe(serie({ carga: 40, repeticoes: null, concluida: false, etapas: [etapa(1, 4, 40), etapa(2, 4, 40)] }));
    expect(l).toMatchObject({ carga: 40, cargaVariavel: false, etapas: '4+4 (parcial)', repeticoes: null, series: 1 });
  });

  it('etapa feita sem carga: a carga fica "—" (não é variável) e os blocos aparecem', () => {
    const l = linhaDe(serie({ carga: null, repeticoes: 8, etapas: [etapa(1, 4, null), etapa(2, 4, null)] }));
    expect(l).toMatchObject({ carga: null, cargaVariavel: false, etapas: '4+4 = 8', semCarga: false });
  });

  it('etapa não feita fica na nota e fora da soma', () => {
    const l = linhaDe(serie({ carga: 40, repeticoes: 6, etapas: [etapa(1, 6, 40), naoFeita(2)] }));
    expect(l).toMatchObject({ carga: 40, etapas: '6 (1 etapa não feita)' });
  });

  it('série com todas as etapas "não feita" não conta como registrada', () => {
    const dias = [dia('2026-10-07', 'Costas', 'c', [{ exercicioUid: 'e', exercicioId: 'r', nome: 'Remada', series: [serie({ carga: null, repeticoes: null, concluida: true, etapas: [naoFeita(1), naoFeita(2)] })] }])];
    expect(cargasPorDivisao(dias)).toEqual([]);
  });

  it('a série de carga única do dia vale mais que a variável', () => {
    const l = linhaDe(serie({ carga: 75, repeticoes: 6 }), serie({ carga: null, repeticoes: 8, etapas: [etapa(1, 4, 40), etapa(2, 4, 42.5)] }));
    expect(l).toMatchObject({ carga: 75, repeticoes: 6, etapas: null, cargaVariavel: false, series: 2 });
  });

  it('exercício sem carga (barra fixa) com Rest-pause: em carga de trabalho mostra os blocos; em outro modo, não', () => {
    const rp = [etapa(1, 4, null), etapa(2, 4, null), etapa(3, 4, null), etapa(4, 2, null)];
    const deTrabalho = linhaDe(serie({ tipo: 'Rest-pause', unidade: 'nenhuma', carga: null, repeticoes: 14, etapas: rp }));
    expect(deTrabalho).toMatchObject({ carga: null, cargaVariavel: false, semCarga: true, etapas: '4+4+4+2 = 14', repeticoes: 14, volume: null });
    expect(textoCarga(deTrabalho)).toBe('Sem carga');
    const deOutroModo = linhaDe(serie({ trabalho: false, tipo: 'Rest-pause', unidade: 'nenhuma', carga: null, repeticoes: 14, etapas: rp }));
    expect(deOutroModo).toMatchObject({ carga: null, cargaVariavel: false, semCarga: true, etapas: null, repeticoes: null, volume: null });
    expect(textoCarga(deOutroModo)).toBe('Sem carga');
  });

  it('série sem etapas e registro antigo seguem como antes, com o volume do exercício', () => {
    const l = linhaDe(serie({ carga: 75, repeticoes: 6 }));
    expect(l).toMatchObject({ carga: 75, repeticoes: 6, etapas: null, cargaVariavel: false, volume: { valor: 450, completo: true } });
    expect(linhaDe(serie({ trabalho: false, carga: null, unidade: 'nenhuma', repeticoes: null }))).toMatchObject({ etapas: null, volume: null, semCarga: true });
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

describe('filtro por plano e eixo do gráfico', () => {
  const dia = (data: string, ...uids: string[]): DiaDeTreino => ({
    data,
    sessoes: uids.map((u) => ({ sessaoUid: u, sessao: u, planoVersaoId: 'v', exercicios: [] })),
  });
  it('mantém só as sessões do plano e descarta dias vazios', () => {
    const dias = [dia('2026-10-01', 'a', 'b'), dia('2026-10-02', 'b')];
    const r = filtrarPorSessoes(dias, new Set(['a']));
    expect(r).toHaveLength(1);
    expect(r[0].sessoes.map((x) => x.sessaoUid)).toEqual(['a']);
    expect(filtrarPorSessoes(dias, null)).toBe(dias);
  });
  it('marcas do eixo ficam dentro da faixa', () => {
    const m = marcasDoEixo(80.2, 82.6);
    expect(m.length).toBeGreaterThan(1);
    expect(Math.min(...m)).toBeGreaterThanOrEqual(80.2);
    expect(Math.max(...m)).toBeLessThanOrEqual(82.6);
  });
});

describe('intervalo dos registros', () => {
  it('na ficha usa os últimos N dias; dentro da pasta, exatamente o período da pasta', () => {
    expect(intervaloDeRegistros('2026-10-09', 14)).toEqual({ de: '2026-09-26', ate: '2026-10-09' });
    expect(intervaloDeRegistros('2026-10-09', 14, { inicio: '2026-10-05', fim: '2026-10-12' })).toEqual({ de: '2026-10-05', ate: '2026-10-12' });
  });
});

describe('progresso: grupo muscular e exercício', () => {
  const serie = (trabalho: boolean) => ({ trabalho } as unknown as SerieFeita);
  const ex = (id: string, nome: string, grupoMuscular: string | null, trabalho = true) =>
    ({ exercicioUid: id, exercicioId: id, nome, grupoMuscular, series: [serie(trabalho)] });
  const dias = [{ data: '2026-10-01', sessoes: [{ sessaoUid: 's', sessao: 'S', planoVersaoId: 'v', exercicios: [
    ex('e1', 'Remada', 'Costas'), ex('e2', 'Puxada', 'Costas'), ex('e3', 'Supino', 'Peito'),
    ex('e4', 'Prancha', null), ex('e5', 'Só aquecimento', 'Peito', false)] }] }] as unknown as DiaDeTreino[];
  it('lista os grupos (em ordem) e os exercícios com série de trabalho', () => {
    const o = opcoesDeProgresso(dias, null);
    expect(o.grupos).toEqual(['Costas', 'Peito', 'Sem grupo']);
    expect(o.exercicios.map(e => e.valor)).toEqual(['e1', 'e2', 'e3', 'e4']);
  });
  it('escolher um grupo mostra só os exercícios dele', () => {
    expect(opcoesDeProgresso(dias, 'Costas').exercicios.map(e => e.rotulo)).toEqual(['Remada', 'Puxada']);
    expect(opcoesDeProgresso(dias, 'Sem grupo').exercicios.map(e => e.rotulo)).toEqual(['Prancha']);
  });
});

describe('faixa da divisão', () => {
  it('separa o dia do nome sem mudar o texto do treinador', () => {
    expect(partesDaDivisao('Terça - Peito+Ombros')).toEqual({ dia: 'Terça', titulo: 'Peito+Ombros' });
    expect(partesDaDivisao('TERCA · Peito')).toEqual({ dia: 'Terça', titulo: 'Peito' });
    expect(partesDaDivisao('Segunda-feira: Costas')).toEqual({ dia: 'Segunda', titulo: 'Costas' });
    expect(partesDaDivisao('Treino A')).toEqual({ dia: null, titulo: 'Treino A' });
    expect(partesDaDivisao('Sábado')).toEqual({ dia: null, titulo: 'Sábado' });
  });

  it('último registro é a data mais recente entre os exercícios', () => {
    const linha = (data: string) => ({ data, carga: null, repeticoes: null, etapas: null, cargaVariavel: false, volume: null, semCarga: false, series: 1, observacoes: [] });
    const d = { chave: 'a', nome: 'A', exercicios: [
      { chave: 'x', nome: 'X', linhas: [linha('2026-10-01'), linha('2026-10-07')] },
      { chave: 'y', nome: 'Y', linhas: [linha('2026-10-05')] },
    ] } as unknown as Parameters<typeof ultimoRegistroDaDivisao>[0];
    expect(ultimoRegistroDaDivisao(d)).toBe('2026-10-07');
    expect(ultimoRegistroDaDivisao({ chave: 'b', nome: 'B', exercicios: [] })).toBeNull();
  });
});
