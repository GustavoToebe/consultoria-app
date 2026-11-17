import type { AlternativaDeExercicio, ConteudoTreino, ExercicioPlano } from '../api/tipos';

/**
 * "Trocar em todas as sessões deste plano" (editor, só o rascunho; Lote B, decisão 5a): todo exercício do plano cujo
 * principal é `principalId` passa a ter `nova` como principal. Se `nova` estava na lista de alternativas dele, o
 * principal antigo ocupa o lugar dela (a lista não cresce, então não estoura as 3); senão a lista fica como estava.
 * Uid, séries, unidade, modalidade e grupo ficam. Devolve o conteúdo novo e quantos exercícios mudaram.
 */
export function trocarEmTodasAsSessoes(
  conteudo: ConteudoTreino,
  principalId: string,
  nova: AlternativaDeExercicio,
): { conteudo: ConteudoTreino; trocados: number } {
  if (!principalId || nova.exercicioId === principalId) return { conteudo, trocados: 0 };
  let trocados = 0;
  const trocar = (e: ExercicioPlano): ExercicioPlano => {
    if (e.exercicioId !== principalId) return e;
    trocados++;
    const antigo: AlternativaDeExercicio = { exercicioId: principalId, nome: e.nome, videoUrl: e.videoUrl ?? null };
    const lista = (e.alternativas ?? []).map((a) => (a.exercicioId === nova.exercicioId ? antigo : a));
    return {
      ...e,
      exercicioId: nova.exercicioId,
      nome: nova.nome,
      videoUrl: nova.videoUrl ?? null,
      // Copiado da biblioteca na publicação: o do exercício antigo não vale para o novo.
      equipamento: null,
      ...(lista.length ? { alternativas: lista } : {}),
    };
  };
  const sessoes = (conteudo.sessoes ?? []).map((s) => ({ ...s, exercicios: (s.exercicios ?? []).map(trocar) }));
  return trocados ? { conteudo: { ...conteudo, sessoes }, trocados } : { conteudo, trocados };
}
