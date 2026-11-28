import type { ConteudoTreino, Sessao } from '../api/tipos';
import type { ResumoDaSessaoPorContagem } from './inspetorDoTreino';

/**
 * Contagens do editor de treino (proposta de 27/11): o plano inteiro na linha das Sessões e os totais da sessão aberta no
 * cabeçalho dela. Só conta o que está cadastrado; não é "volume semanal" (frequência, repetições e carga não entram).
 */

export interface ContagemDoPlano {
  sessoes: number;
  exercicios: number;
  series: number;
}

export interface ContagemDaSessao {
  exercicios: number;
  series: number;
}

export function contarSessao(sessao: Pick<Sessao, 'exercicios'>): ContagemDaSessao {
  const exercicios = sessao.exercicios ?? [];
  return { exercicios: exercicios.length, series: exercicios.reduce((n, e) => n + (e.series?.length ?? 0), 0) };
}

export function contarPlano(conteudo: Pick<ConteudoTreino, 'sessoes'>): ContagemDoPlano {
  const sessoes = conteudo.sessoes ?? [];
  return sessoes.reduce<ContagemDoPlano>((total, s) => {
    const c = contarSessao(s);
    return { sessoes: total.sessoes + 1, exercicios: total.exercicios + c.exercicios, series: total.series + c.series };
  }, { sessoes: 0, exercicios: 0, series: 0 });
}

const contar = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Título das Sessões: "7 sessões · 27 exercícios · 81 séries". */
export function textoDosTotaisDoPlano(c: ContagemDoPlano): string {
  return `${contar(c.sessoes, 'sessão', 'sessões')} · ${contar(c.exercicios, 'exercício', 'exercícios')} · ${contar(c.series, 'série', 'séries')}`;
}

/** Cabeçalho da sessão: "7 exercícios · 23 séries · 16 de trabalho". */
export function textoDosTotaisDaSessao(r: Pick<ResumoDaSessaoPorContagem, 'exercicios' | 'series' | 'seriesDeTrabalho'>): string {
  return `${contar(r.exercicios, 'exercício', 'exercícios')} · ${contar(r.series, 'série', 'séries')} · ${r.seriesDeTrabalho} de trabalho`;
}
