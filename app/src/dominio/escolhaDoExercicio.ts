import type { Exercicio } from '../api/tipos';
import { SEM_FILTROS_DE_EXERCICIOS, type FiltrosDeExercicios } from './exerciciosDaBiblioteca';
import { semAcento } from './telas';

/**
 * Folha "Escolher exercício" do editor de treino (adicionar, trocar, cardio e alternativa): pré-filtro da troca, a linha do
 * exercício manual e a navegação pelo teclado (↑↓ na lista, a partir da busca). Funções puras.
 */

/** O grupo do exercício que está sendo trocado, lido da biblioteca pelo id; manual ou que saiu da biblioteca = nenhum. */
export function grupoDoAtual(atual: { exercicioId: string | null } | undefined, biblioteca: readonly Pick<Exercicio, 'id' | 'grupoMuscular'>[]): string | null {
  if (!atual?.exercicioId) return null;
  return biblioteca.find((e) => e.id === atual.exercicioId)?.grupoMuscular?.trim() || null;
}

/** Ao abrir: trocar vem filtrado pelo grupo do exercício atual (um chip que se tira); o resto abre sem filtro. */
export function filtrosAoAbrir(grupo: string | null): FiltrosDeExercicios {
  return grupo ? { ...SEM_FILTROS_DE_EXERCICIOS, grupos: new Set([grupo]) } : SEM_FILTROS_DE_EXERCICIOS;
}

/**
 * A última linha da lista com a busca preenchida: usar o texto como exercício (ou cardio) manual, fora da biblioteca.
 * Não existe na alternativa (é sempre da biblioteca) nem quando o texto já é o nome de um exercício da lista (seria o mesmo).
 */
export function linhaDoManual(busca: string, contexto: { alternativa: boolean; cardio: boolean; nomesDaLista: readonly string[] }):
  { nome: string; texto: string; rotulo: string } | null {
  const nome = busca.trim();
  if (!nome || contexto.alternativa) return null;
  const igual = semAcento(nome);
  if (contexto.nomesDaLista.some((n) => semAcento(n) === igual)) return null;
  const tipo = contexto.cardio ? 'cardio' : 'exercício';
  return { nome, texto: `Usar “${nome}” como ${tipo} manual`, rotulo: `Usar só o nome ${nome}, fora da biblioteca` };
}

/** ↑↓ na lista: anda um e dá a volta nas pontas; sem nenhuma ativa, ↓ vai à primeira e ↑ à última. -1 = lista vazia. */
export function linhaVizinha(atual: number, passo: 1 | -1, total: number): number {
  if (total <= 0) return -1;
  if (atual < 0 || atual >= total) return passo > 0 ? 0 : total - 1;
  return (atual + passo + total) % total;
}
