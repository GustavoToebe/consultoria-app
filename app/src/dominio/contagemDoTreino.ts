import type { ConteudoTreino, Sessao } from '../api/tipos';

/**
 * Contagens dos contadores do editor de treino (reunião de 30/10): o plano inteiro e, separado, a sessão aberta. Só conta o
 * que está cadastrado; não é "volume semanal" (frequência, repetições e carga não entram).
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

/** "Plano inteiro: 6 sessões · 32 exercícios · 120 séries cadastradas". */
export function textoDoPlanoInteiro(c: ContagemDoPlano): string {
  return `Plano inteiro: ${contar(c.sessoes, 'sessão', 'sessões')} · ${contar(c.exercicios, 'exercício', 'exercícios')} · ${contar(c.series, 'série cadastrada', 'séries cadastradas')}`;
}

/** "Sessão aberta: 5 exercícios · 18 séries". */
export function textoDaSessaoAberta(c: ContagemDaSessao): string {
  return `Sessão aberta: ${contar(c.exercicios, 'exercício', 'exercícios')} · ${contar(c.series, 'série', 'séries')}`;
}
