import type { AlternativaDeExercicio, ExercicioPlano } from '../api/tipos';
import { MAXIMO_DE_ALTERNATIVAS } from './exercicioDoDia';

/**
 * Alternativas de um exercício no editor de treino (Lote B, `docs/planos/trocar-exercicio.md`): as regras que a tela
 * aplica antes da API (`ValidadorTreino`), para o treinador não montar o que a publicação recusa. "Mesmo tipo" é só
 * cardio × não cardio, como no servidor (a biblioteca não tem unidade). Sem a chave quando a lista fica vazia: a API a
 * omite e o editor não a devolve (`normalizarTreino`).
 */

const deCardio = (modalidade: string | null | undefined) => modalidade === 'CARDIO';

/** O exercício da biblioteca pode ser alternativa deste: mesmo tipo, nem o principal nem uma que já está na lista. */
export function podeSerAlternativa(principal: Pick<ExercicioPlano, 'exercicioId' | 'modalidade' | 'alternativas'>, e: { id: string; modalidade: string }): boolean {
  return deCardio(e.modalidade) === deCardio(principal.modalidade)
    && e.id !== principal.exercicioId
    && !(principal.alternativas ?? []).some((a) => a.exercicioId === e.id);
}

/** Por que não dá para adicionar mais uma; nulo = dá. */
export function motivoSemAdicionarAlternativa(principal: Pick<ExercicioPlano, 'alternativas'>): string | null {
  return (principal.alternativas?.length ?? 0) >= MAXIMO_DE_ALTERNATIVAS
    ? `Já tem ${MAXIMO_DE_ALTERNATIVAS} alternativas, o máximo. Remova uma para adicionar outra.`
    : null;
}

/** Com a lista nova (vazia = sem a chave). */
function comLista(e: ExercicioPlano, lista: AlternativaDeExercicio[]): ExercicioPlano {
  const { alternativas: _antiga, ...resto } = e;
  return lista.length ? { ...resto, alternativas: lista } : resto;
}

/** Acrescenta no fim; o que não pode ser alternativa (ou passa do limite) é ignorado. */
export function adicionarAlternativa(principal: ExercicioPlano, e: { id: string; nome: string; modalidade: string; videoUrl: string | null }): ExercicioPlano {
  if (!podeSerAlternativa(principal, e) || motivoSemAdicionarAlternativa(principal)) return principal;
  return comLista(principal, [...(principal.alternativas ?? []), { exercicioId: e.id, nome: e.nome, videoUrl: e.videoUrl ?? null }]);
}

export function removerAlternativa(principal: ExercicioPlano, indice: number): ExercicioPlano {
  return comLista(principal, (principal.alternativas ?? []).filter((_, i) => i !== indice));
}

/**
 * "Trocar" o exercício principal (pela biblioteca ou pelo nome): de ou para cardio as alternativas não servem mais
 * (outro tipo) e saem todas; senão sai só a que virou o principal (a API recusa a alternativa igual ao exercício).
 */
export function alternativasDepoisDaTroca(novo: ExercicioPlano, modalidadeAntiga: string | null): ExercicioPlano {
  if (!novo.alternativas?.length) return novo;
  if (deCardio(modalidadeAntiga) !== deCardio(novo.modalidade)) return comLista(novo, []);
  return comLista(novo, novo.alternativas.filter((a) => a.exercicioId !== novo.exercicioId));
}
