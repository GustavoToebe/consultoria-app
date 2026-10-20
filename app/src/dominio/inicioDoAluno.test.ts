import type { ConteudoDieta, ConteudoTreino, ExercicioPlano, Sessao, TipoSessao } from '../api/tipos';
import {
  aguaDoInicio,
  dataParaAbrir,
  dataPorExtenso,
  detalheDaDivisao,
  dietaNoInicio,
  ehDeHoje,
  estadoDoHoje,
  letraDaDivisao,
  primeiroNome,
  rotuloDaDivisao,
} from './inicioDoAluno';

const exercicio = (uid: string): ExercicioPlano => ({
  uid, exercicioId: null, nome: `Exercício ${uid}`, modalidade: null, videoUrl: null, observacao: null,
  progressao: false, unidade: 'kg', series: [],
});

const sessao = (uid: string, diaSemana: number | null, exercicios = 5, tipo: TipoSessao = 'TREINO', extra: Partial<Sessao> = {}): Sessao => ({
  uid, nome: `Sessão ${uid}`, diaSemana, tipo, frequenciaSemanal: null, observacao: null, cardio: null,
  exercicios: Array.from({ length: exercicios }, (_, i) => exercicio(`${uid}${i}`)), ...extra,
});

const treino = (...sessoes: Sessao[]): ConteudoTreino => ({ objetivo: null, orientacoes: null, sessoes });
const SEGUNDA = 1;

describe('cabeçalho', () => {
  it('data por extenso na data local', () => {
    expect(dataPorExtenso('2026-10-19')).toBe('Segunda-feira · 19 de outubro');
    expect(dataPorExtenso('2026-03-01')).toBe('Domingo · 1 de março');
    expect(dataPorExtenso('2026-12-26')).toBe('Sábado · 26 de dezembro');
  });

  it('primeiro nome; sem nome, nulo', () => {
    expect(primeiroNome('  Gustavo  Toebe ')).toBe('Gustavo');
    expect(primeiroNome('')).toBeNull();
    expect(primeiroNome(null)).toBeNull();
  });
});

describe('dieta no início', () => {
  const dieta = (extra: Partial<ConteudoDieta> = {}) => ({
    objetivo: null, dataInicio: null, profissional: null, refeicoes: Array.from({ length: 6 }, (_, i) => ({ uid: `r${i}`, nome: `R${i}`, horario: null, itens: [] })),
    aguaLitros: 3, ...extra,
  }) as unknown as ConteudoDieta;

  it('com dieta e água: refeições e "3,0 L"', () => {
    expect(dietaNoInicio({ conteudo: dieta(), erro: false })).toEqual({ tipo: 'ok', refeicoes: '6 refeições no seu plano', agua: '3,0 L' });
  });

  it('sem água, a coluna da água some (nunca zero nem meta)', () => {
    expect(dietaNoInicio({ conteudo: dieta({ aguaLitros: null }), erro: false })).toMatchObject({ tipo: 'ok', agua: null });
  });

  it('uma refeição no singular', () => {
    expect(dietaNoInicio({ conteudo: dieta({ refeicoes: [dieta().refeicoes[0]] }), erro: false })).toMatchObject({ refeicoes: '1 refeição no seu plano' });
  });

  it('dieta não publicada (nula)', () => {
    expect(dietaNoInicio({ conteudo: null, erro: false })).toEqual({ tipo: 'sem-dieta' });
  });

  it('falha ao carregar não vira "não publicada"', () => {
    expect(dietaNoInicio({ conteudo: undefined, erro: true })).toEqual({ tipo: 'erro' });
    expect(dietaNoInicio({ conteudo: undefined, erro: false })).toEqual({ tipo: 'carregando' });
  });

  it('água com uma casa e vírgula', () => {
    expect(aguaDoInicio(3)).toBe('3,0 L');
    expect(aguaDoInicio(2.5)).toBe('2,5 L');
    expect(aguaDoInicio(null)).toBeNull();
  });
});

describe('estado do Hoje', () => {
  const base = { dia: SEGUNDA, carregando: false, erro: false };

  it('treino do dia, com o rótulo da divisão pela ordem da semana', () => {
    const a = sessao('a', 1);
    const b = sessao('b', 2);
    const e = estadoDoHoje({ ...base, conteudo: treino(b, a) });
    expect(e).toEqual({ tipo: 'treino', sessao: a, rotulo: 'TREINO A' });
    expect(estadoDoHoje({ ...base, dia: 2, conteudo: treino(a, b) })).toMatchObject({ tipo: 'treino', rotulo: 'TREINO B' });
  });

  it('descanso programado: sessão de descanso ou dia sem sessão', () => {
    const descanso = sessao('d', 1, 0, 'DESCANSO');
    expect(estadoDoHoje({ ...base, conteudo: treino(descanso, sessao('b', 2)) })).toEqual({ tipo: 'descanso', sessao: descanso });
    expect(estadoDoHoje({ ...base, conteudo: treino(sessao('b', 2)) })).toEqual({ tipo: 'descanso', sessao: null });
  });

  it('descanso ativo sem exercício é descanso (com o cardio); com exercício é treino', () => {
    const ativo = sessao('d', 1, 0, 'DESCANSO_ATIVO', { cardio: '30 min de caminhada' });
    expect(estadoDoHoje({ ...base, conteudo: treino(ativo, sessao('b', 2)) })).toEqual({ tipo: 'descanso', sessao: ativo });
    expect(estadoDoHoje({ ...base, conteudo: treino(sessao('d', 1, 2, 'DESCANSO_ATIVO'), sessao('b', 2)) })).toMatchObject({ tipo: 'treino' });
  });

  it('treino de hoje sem exercício', () => {
    const vazia = sessao('v', 1, 0);
    expect(estadoDoHoje({ ...base, conteudo: treino(vazia, sessao('b', 2)) })).toEqual({ tipo: 'sem-exercicios', sessao: vazia });
  });

  it('plano sem dia fixo: escolher a divisão, sem inventar dia', () => {
    expect(estadoDoHoje({ ...base, conteudo: treino(sessao('a', null), sessao('b', null)) })).toEqual({ tipo: 'sem-dia-fixo' });
  });

  it('um dia fixo entre sessões sem dia ainda é plano com dias', () => {
    expect(estadoDoHoje({ ...base, conteudo: treino(sessao('a', 1), sessao('x', null)) })).toMatchObject({ tipo: 'treino' });
    expect(estadoDoHoje({ ...base, dia: 3, conteudo: treino(sessao('a', 1), sessao('x', null)) })).toEqual({ tipo: 'descanso', sessao: null });
  });

  it('treino não publicado e plano sem sessão', () => {
    expect(estadoDoHoje({ ...base, conteudo: null })).toEqual({ tipo: 'preparando' });
    expect(estadoDoHoje({ ...base, conteudo: treino() })).toEqual({ tipo: 'preparando' });
  });

  it('falha ao carregar nunca vira "não publicado"; ainda lendo é carregando', () => {
    expect(estadoDoHoje({ ...base, conteudo: null, erro: true })).toEqual({ tipo: 'erro' });
    expect(estadoDoHoje({ ...base, conteudo: null, carregando: true })).toEqual({ tipo: 'carregando' });
    // Com plano salvo no aparelho, uma falha de rede não esconde o treino.
    expect(estadoDoHoje({ ...base, conteudo: treino(sessao('a', 1)), erro: true })).toMatchObject({ tipo: 'treino' });
  });

  it('letra e rótulo da divisão', () => {
    const a = sessao('a', 1);
    const b = sessao('b', 2);
    const acessorios = sessao('c', null, 3, 'ACESSORIOS');
    const plano = treino(acessorios, b, a);
    expect([a, b, acessorios].map((s) => letraDaDivisao(plano, s))).toEqual(['A', 'B', 'C']);
    expect(rotuloDaDivisao(plano, acessorios)).toBe('ACESSÓRIOS C');
  });
});

describe('divisões da semana', () => {
  it('detalhe com o dia e a contagem; sem dia fixo não inventa dia', () => {
    expect(detalheDaDivisao(sessao('a', 1, 5))).toBe('Segunda · 5 exercícios');
    expect(detalheDaDivisao(sessao('a', 3, 1))).toBe('Quarta · 1 exercício');
    expect(detalheDaDivisao(sessao('a', null, 4))).toBe('Sem dia fixo · 4 exercícios');
    expect(detalheDaDivisao(sessao('d', 7, 0, 'DESCANSO'))).toBe('Domingo · Descanso');
  });

  it('"Hoje" só na divisão do dia', () => {
    expect(ehDeHoje(sessao('a', 1), 1)).toBe(true);
    expect(ehDeHoje(sessao('b', 2), 1)).toBe(false);
    expect(ehDeHoje(sessao('c', null), 1)).toBe(false);
  });

  // 2026-10-19 é segunda-feira.
  it('abre hoje se é o dia dela; senão a próxima vez; sem dia fixo, hoje', () => {
    expect(dataParaAbrir(sessao('a', 1), '2026-10-05', '2026-11-01', '2026-10-19')).toBe('2026-10-19');
    expect(dataParaAbrir(sessao('b', 3), '2026-10-05', '2026-11-01', '2026-10-19')).toBe('2026-10-21');
    expect(dataParaAbrir(sessao('b', 2), '2026-10-05', null, '2026-10-19')).toBe('2026-10-20');
    expect(dataParaAbrir(sessao('x', null), '2026-10-05', '2026-11-01', '2026-10-19')).toBe('2026-10-19');
  });

  it('a próxima vez passa do fim do período: a última dentro dele', () => {
    expect(dataParaAbrir(sessao('b', 3), '2026-10-05', '2026-10-20', '2026-10-19')).toBe('2026-10-14');
  });

  it('sem nenhuma vez dentro do período, hoje', () => {
    expect(dataParaAbrir(sessao('b', 3), '2026-10-19', '2026-10-20', '2026-10-19')).toBe('2026-10-19');
  });
});
