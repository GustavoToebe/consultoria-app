import type { Exercicio } from '../api/tipos';
import { SEM_FILTROS_DE_EXERCICIOS, type FiltrosDeExercicios } from './exerciciosDaBiblioteca';

/**
 * Folha "Escolher exercício" do editor de treino (adicionar, trocar, cardio e alternativa): pré-filtro da troca, a linha do
 * exercício manual e a navegação pelo teclado (↑↓ na lista, a partir da busca). Funções puras.
 */

type DaBiblioteca = Pick<Exercicio, 'id' | 'grupoMuscular'> & Partial<Pick<Exercicio, 'tipoDeCardio'>>;
export interface PreFiltroDaTroca { grupo: string | null; tipoDeCardio: string | null }

/**
 * O que pré-filtra a troca, lido da biblioteca pelo id do exercício trocado: o grupo muscular e, no cardio, o tipo de
 * cardio, nunca o grupo (o cardio antigo do catálogo tem o grupo "Cardio" e o novo não tem grupo, D13: filtrar por ele
 * esconderia os cardios novos). Manual, que saiu da biblioteca ou sem o dado = nenhum.
 */
export function preFiltroDaTroca(atual: { exercicioId: string | null } | undefined, biblioteca: readonly DaBiblioteca[], cardio: boolean): PreFiltroDaTroca {
  const e = atual?.exercicioId ? biblioteca.find((x) => x.id === atual.exercicioId) : undefined;
  if (!e) return { grupo: null, tipoDeCardio: null };
  return cardio ? { grupo: null, tipoDeCardio: e.tipoDeCardio ?? null } : { grupo: e.grupoMuscular?.trim() || null, tipoDeCardio: null };
}

/** Ao abrir: trocar vem filtrado pelo grupo (ou pelo tipo de cardio) do exercício atual, um chip que se tira; o resto abre sem filtro. */
export function filtrosAoAbrir({ grupo, tipoDeCardio }: PreFiltroDaTroca): FiltrosDeExercicios {
  if (grupo) return { ...SEM_FILTROS_DE_EXERCICIOS, grupos: new Set([grupo]) };
  if (tipoDeCardio) return { ...SEM_FILTROS_DE_EXERCICIOS, tiposDeCardio: new Set([tipoDeCardio]) };
  return SEM_FILTROS_DE_EXERCICIOS;
}

/**
 * A linha com a busca preenchida que não achou nada na lista (`resultados` = quantos passaram na busca e nos filtros):
 * usar o texto como exercício (ou cardio) manual, fora da biblioteca. Com algum resultado não aparece (pedido do Gustavo:
 * só quando a busca não acha nada), nem na alternativa (é sempre da biblioteca).
 */
export function linhaDoManual(busca: string, contexto: { alternativa: boolean; cardio: boolean; resultados: number }):
  { nome: string; texto: string; rotulo: string } | null {
  const nome = busca.trim();
  if (!nome || contexto.alternativa || contexto.resultados > 0) return null;
  const tipo = contexto.cardio ? 'cardio' : 'exercício';
  return { nome, texto: `Usar “${nome}” como ${tipo} manual`, rotulo: `Usar só o nome ${nome}, fora da biblioteca` };
}

/** ↑↓ na lista: anda um e dá a volta nas pontas; sem nenhuma ativa, ↓ vai à primeira e ↑ à última. -1 = lista vazia. */
export function linhaVizinha(atual: number, passo: 1 | -1, total: number): number {
  if (total <= 0) return -1;
  if (atual < 0 || atual >= total) return passo > 0 ? 0 : total - 1;
  return (atual + passo + total) % total;
}
