import type { ProgressoPonto } from '../api/tipos';
import { dataCurta, numeroParaTela, SEM_DADO } from './formatos';
import { SEM_GRUPO } from './relatorio';

/**
 * Progresso por exercício: só reorganiza o que o aluno registrou. Sem porcentagem, recorde, tendência ou juízo de
 * melhora e piora; ausência de dado é "—", nunca zero.
 */

export interface PontoDoGrafico {
  data: string;
  carga: number;
}

export interface ResumoDoProgresso {
  /** Primeiro dia com carga; `null` quando só existe um (então só o "último" aparece). */
  primeiro: { data: string; carga: number } | null;
  ultimo: { data: string; carga: number; repeticoes: number | null } | null;
}

const porData = (a: ProgressoPonto, b: ProgressoPonto) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0);

/** Só as datas com carga registrada, da mais antiga para a mais recente. */
export function pontosDoGrafico(pontos: ProgressoPonto[]): PontoDoGrafico[] {
  return [...pontos]
    .sort(porData)
    .flatMap((p) => (p.maiorCargaTrabalho === null ? [] : [{ data: p.data, carga: p.maiorCargaTrabalho }]));
}

/** Primeiro e último dia com carga, mais as repetições do último. Sem carga em nenhum dia, os dois são `null`. */
export function resumoDoProgresso(pontos: ProgressoPonto[]): ResumoDoProgresso {
  const comCarga = [...pontos].sort(porData).filter((p) => p.maiorCargaTrabalho !== null);
  const ultimo = comCarga[comCarga.length - 1];
  if (!ultimo || ultimo.maiorCargaTrabalho === null) return { primeiro: null, ultimo: null };
  const primeiro = comCarga[0];
  return {
    primeiro: comCarga.length > 1 && primeiro.maiorCargaTrabalho !== null ? { data: primeiro.data, carga: primeiro.maiorCargaTrabalho } : null,
    ultimo: { data: ultimo.data, carga: ultimo.maiorCargaTrabalho, repeticoes: ultimo.repeticoes },
  };
}

/** "Primeiro: 40 kg em 04/09 · Último: 42,5 kg × 12 em 02/10"; com um registro só, apenas o "Último". */
export function textoDoResumo(r: ResumoDoProgresso): string | null {
  if (!r.ultimo) return null;
  const ultimo = `Último: ${numeroParaTela(r.ultimo.carga)} kg × ${r.ultimo.repeticoes ?? SEM_DADO} em ${dataCurta(r.ultimo.data)}`;
  if (!r.primeiro) return ultimo;
  return `Primeiro: ${numeroParaTela(r.primeiro.carga)} kg em ${dataCurta(r.primeiro.data)} · ${ultimo}`;
}

/** Linhas da tabela: da data mais recente para a mais antiga; `limite` corta no começo (as mais recentes). */
export function linhasDaTabela(pontos: ProgressoPonto[], limite: number | null): ProgressoPonto[] {
  const recentes = [...pontos].sort(porData).reverse();
  return limite === null ? recentes : recentes.slice(0, limite);
}

/** Grupos na ordem de `opcoesDeProgresso` (alfabética em pt-BR, "Sem grupo" por último); dentro deles, a ordem recebida. */
export function agruparPorGrupo<T extends { grupo: string }>(opcoes: T[]): { grupo: string; opcoes: T[] }[] {
  const mapa = new Map<string, T[]>();
  for (const o of opcoes) mapa.set(o.grupo, [...(mapa.get(o.grupo) ?? []), o]);
  return [...mapa.entries()]
    .sort(([a], [b]) => (a === SEM_GRUPO ? 1 : b === SEM_GRUPO ? -1 : a.localeCompare(b, 'pt-BR')))
    .map(([grupo, lista]) => ({ grupo, opcoes: lista }));
}
