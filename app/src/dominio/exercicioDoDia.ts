import type { ExercicioPlano } from '../api/tipos';

/**
 * "Trocar só hoje" (Lote B, plano `docs/planos/trocar-exercicio.md`, opção A: a troca mora na própria série).
 *
 * O exercício do dia é o do plano com `exercicioId`, `nome` e `videoUrl` da alternativa; `uid`, séries, unidade,
 * modalidade e grupo continuam os do principal (a alternativa herda a prescrição). Como o resto do app lê o exercício
 * da biblioteca por `exercicioId`, recordes, "Anterior" e a última carga do dia trocado saem sozinhos do histórico da
 * alternativa (sem histórico, "—"): nada do principal é emprestado.
 *
 * Sem tabela: depois da primeira série marcada a troca é lida dos registros (o `exercicioId` gravado na série, também
 * os que vieram do servidor); antes dela, só vale o que a tela ainda guarda em `escolhida`.
 */

/** Até 3 alternativas por exercício (a API recusa mais). */
export const MAXIMO_DE_ALTERNATIVAS = 3;

/** O pedaço de um registro (aparelho ou servidor) que a regra usa. */
export interface RegistroDoDia {
  planoVersaoId: string;
  exercicioUid: string;
  exercicioId: string | null;
  data: string;
  concluida: boolean;
}

export interface ContextoDoDia {
  versaoId: string;
  data: string;
  registros: readonly RegistroDoDia[];
  /** Alternativa que o aluno escolheu e ainda não tem série marcada; só vale sem série concluída no dia. */
  escolhida?: string | null;
}

/** Séries marcadas hoje neste exercício do plano (qualquer `exercicioId`): são elas que fixam o exercício do dia. */
function concluidasDoDia(principal: Pick<ExercicioPlano, 'uid'>, ctx: ContextoDoDia): RegistroDoDia[] {
  return ctx.registros.filter((r) => r.concluida && r.planoVersaoId === ctx.versaoId && r.exercicioUid === principal.uid && r.data === ctx.data);
}

/**
 * O exercício que vale na data: o principal, ou ele com os dados da alternativa. Série concluída decide (a primeira
 * que cita uma alternativa da lista; só com séries do principal, vale o principal); sem série concluída, vale `escolhida`.
 * Id que não é do principal nem de uma alternativa da lista é ignorado.
 */
export function exercicioDoDia(principal: ExercicioPlano, ctx: ContextoDoDia): ExercicioPlano {
  const alternativas = principal.alternativas ?? [];
  if (!alternativas.length) return principal;
  const feitas = concluidasDoDia(principal, ctx);
  const id = feitas.length
    ? feitas.find((r) => r.exercicioId != null && alternativas.some((a) => a.exercicioId === r.exercicioId))?.exercicioId
    : ctx.escolhida;
  const alternativa = alternativas.find((a) => a.exercicioId === id);
  if (!alternativa || alternativa.exercicioId === principal.exercicioId) return principal;
  // O equipamento é o do exercício principal (copiado da biblioteca na publicação): não vale para a alternativa.
  return { ...principal, exercicioId: alternativa.exercicioId, nome: alternativa.nome, videoUrl: alternativa.videoUrl ?? null, equipamento: null };
}

/** O dia está com uma alternativa no lugar do principal? */
export function foiTrocado(principal: Pick<ExercicioPlano, 'exercicioId'>, doDia: Pick<ExercicioPlano, 'exercicioId'>): boolean {
  return doDia.exercicioId !== principal.exercicioId;
}

/**
 * Chave da carga de trabalho do dia (`exercicioUid|data`, a do repositório local); `null` no dia trocado. A base digitada
 * é do principal: não vale para a alternativa e a da alternativa não pode virar a sugestão do principal. Sem chave, não
 * se lê nem se grava, e a sugestão da alternativa parte da última carga dela (por `exercicioId`) ou fica sem base.
 */
export function chaveDaBaseDoDia(principal: Pick<ExercicioPlano, 'exercicioId'>, doDia: Pick<ExercicioPlano, 'uid' | 'exercicioId'>, data: string): string | null {
  return foiTrocado(principal, doDia) ? null : `${doDia.uid}|${data}`;
}

/** Trocar (ou desfazer a troca) só antes de marcar a primeira série do exercício no dia, e só com alternativa. */
export function podeTrocarNoDia(principal: ExercicioPlano, ctx: ContextoDoDia): boolean {
  return (principal.alternativas?.length ?? 0) > 0 && concluidasDoDia(principal, ctx).length === 0;
}
