import type { ConteudoDieta, ExercicioPlano } from '../api/tipos';
import { contagem } from './contagens';
import { somar } from './dieta';
import { numeroParaTela, SEM_DADO } from './formatos';
import { refeicoesDoDia, variacaoDoDia } from './variacoesDaDieta';

/**
 * O que os cartões do Início do aluno na web larga mostram por dentro (27/11): os exercícios do treino de hoje no "Hoje" e
 * as refeições do dia na "Dieta de hoje". Só leitura do plano publicado: nada é calculado além da soma da opção A (a mesma
 * regra do total do dia) e ausência de dado é "—".
 */

/** O "Hoje" lista no máximo isto; o resto vira "+N exercícios" (a lista inteira está em "Ver meu treino"). */
export const MAXIMO_DE_EXERCICIOS_NO_HOJE = 5;

export interface ExercicioNoHoje {
  uid: string;
  nome: string;
  /** "3 séries" ou, no cardio, "Cardio" (a prescrição fica na lista do dia). */
  detalhe: string;
}

const ehCardio = (e: Pick<ExercicioPlano, 'modalidade' | 'series'>) => e.modalidade === 'CARDIO' || e.series.some((s) => !!s.cardio);

export function exerciciosNoHoje(exercicios: readonly ExercicioPlano[], maximo = MAXIMO_DE_EXERCICIOS_NO_HOJE): { itens: ExercicioNoHoje[]; mais: number } {
  const itens = exercicios.slice(0, maximo).map((e) => ({
    uid: e.uid,
    nome: e.nome.trim() || SEM_DADO,
    detalhe: ehCardio(e) ? 'Cardio' : contagem(e.series.length, 'série', 'séries'),
  }));
  return { itens, mais: Math.max(0, exercicios.length - itens.length) };
}

export const textoDosOutrosExercicios = (mais: number) => `+${contagem(mais, 'exercício', 'exercícios')}`;

export interface RefeicaoDeHoje {
  uid: string;
  nome: string;
  /** "07:30" como o treinador escreveu; nulo = sem horário. */
  horario: string | null;
  /** "420 kcal"; "— kcal" quando algum item não tem valor; nulo quando a opção A está vazia (nunca "0 kcal"). */
  kcal: string | null;
}

export type DietaDeHoje =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'sem-dieta' }
  /** Variação por dia sem dieta marcada para hoje (dia de descanso, publicável). */
  | { tipo: 'sem-refeicoes-hoje' }
  | { tipo: 'ok'; refeicoes: RefeicaoDeHoje[]; proxima: string | null; total: string | null; variacao: string | null };

/** Minutos desde a meia-noite de "7:30", "07h30", "12h" ou "12:00"; nulo para o que não é hora. */
export function minutosDoHorario(horario: string | null | undefined): number | null {
  const m = /^\s*(\d{1,2})\s*[:hH]\s*(\d{2})?/.exec(horario ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  return h <= 23 && min <= 59 ? h * 60 + min : null;
}

const kcalDe = (kcal: number | null) => `${kcal === null ? SEM_DADO : numeroParaTela(kcal, 0)} kcal`;

/**
 * Próxima refeição: a primeira, na ordem do plano, com horário a partir de agora (`agora` = "HH:MM" de Brasília). Sem
 * horário nenhuma é destacada (não se adivinha a ordem do dia); passadas todas as do dia, nenhuma.
 */
export function proximaRefeicao(refeicoes: readonly Pick<RefeicaoDeHoje, 'uid' | 'horario'>[], agora: string): string | null {
  const minutos = minutosDoHorario(agora);
  if (minutos === null) return null;
  return refeicoes.find((r) => {
    const m = minutosDoHorario(r.horario);
    return m !== null && m >= minutos;
  })?.uid ?? null;
}

/**
 * A "Dieta de hoje": as refeições do dia (`refeicoesDoDia`, a variação de hoje quando há), cada uma com o horário e a kcal
 * da opção A, a próxima e o total do dia (soma das opções A; "—" se algum item não tem kcal, nulo sem item nenhum).
 */
export function dietaDeHoje(entrada: { conteudo: ConteudoDieta | null | undefined; erro: boolean; dia: number; agora: string }): DietaDeHoje {
  const { conteudo, erro, dia, agora } = entrada;
  if (conteudo === undefined) return erro ? { tipo: 'erro' } : { tipo: 'carregando' };
  if (conteudo === null) return { tipo: 'sem-dieta' };
  const doDia = refeicoesDoDia(conteudo, dia);
  if (doDia.length === 0) return { tipo: conteudo.variacoes.length ? 'sem-refeicoes-hoje' : 'sem-dieta' };
  const refeicoes = doDia.map((r) => {
    const itens = r.opcoes[0]?.itens ?? [];
    return { uid: r.uid, nome: r.nome.trim() || SEM_DADO, horario: r.horario?.trim() || null, kcal: itens.length ? kcalDe(somar(itens).kcal) : null };
  });
  const itensDoDia = doDia.flatMap((r) => r.opcoes[0]?.itens ?? []);
  const variacao = conteudo.variacoes.length ? (variacaoDoDia(conteudo, dia)?.rotulo.trim() || 'Variação sem nome') : null;
  return {
    tipo: 'ok',
    refeicoes,
    proxima: proximaRefeicao(refeicoes, agora),
    total: itensDoDia.length ? kcalDe(somar(itensDoDia).kcal) : null,
    variacao,
  };
}
