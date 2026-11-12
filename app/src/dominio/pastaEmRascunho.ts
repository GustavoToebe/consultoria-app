import type { PlanosDaPasta } from './publicarPasta';

/**
 * Pasta "só com rascunho" (guia de 11/11, pág. 33: o rascunho fala por si na lista): tem plano e nenhum deles foi
 * publicado, então o aluno ainda não vê nada dela. Só diz `true` com certeza: lista de um tipo que falhou, ainda não
 * chegou ou que a pessoa não pode ler (`null`) é desconhecida e dá `false`, nunca "rascunho". Pasta sem plano também é
 * `false` (não é rascunho de nada). Os planos vêm de `planosDaPasta` (a mobilidade fora do plano da consultoria é `[]`).
 */
export function pastaSoComRascunho(planos: PlanosDaPasta): boolean {
  const listas = [planos.treino, planos.dieta, planos.mobilidade];
  if (listas.some((l) => l === null)) return false;
  const todos = listas.flatMap((l) => l ?? []);
  return todos.length > 0 && todos.every((p) => p.versaoPublicada === 0);
}
