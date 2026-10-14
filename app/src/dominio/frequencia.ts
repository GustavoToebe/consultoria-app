import type { DiaDeTreino } from '../api/tipos';
import { somarDias } from './formatos';
import { periodoDaSemana } from './progressoSemana';

/** A API recusa consulta de execuções com mais de 366 dias entre as datas. */
const DIAS_MAXIMOS_DA_CONSULTA = 364;

export interface PastaDaFrequencia {
  titulo: string;
  inicio: string | null;
  fim: string | null;
}

export interface PeriodoContado {
  de: string;
  ate: string;
}

export interface PlanoDaFrequencia {
  semana: PeriodoContado;
  /** Nulo: sem pasta vigente, sem período ou com início no futuro (nada a contar ainda). */
  pasta: (PeriodoContado & { titulo: string; limitada: boolean }) | null;
  /** O que pedir à API: cobre a semana e a pasta de uma vez. */
  consulta: PeriodoContado;
}

export interface Frequencia {
  semana: number;
  /** Nulo: sem pasta contável (aparece como "—"). */
  pasta: { titulo: string; de: string; ate: string; limitada: boolean; treinos: number } | null;
}

/**
 * Períodos contados na ficha: a semana corrente (segunda a hoje) e a pasta vigente (do início até o menor entre o fim e
 * hoje; uma pasta com mais de um ano conta só os últimos 365 dias, que é o que a API entrega).
 */
export function planejarFrequencia(hoje: string, pasta: PastaDaFrequencia | null): PlanoDaFrequencia {
  const inicioDaSemana = periodoDaSemana(hoje).inicio;
  const semana = { de: inicioDaSemana, ate: hoje };
  if (!pasta?.inicio || !pasta.fim || pasta.inicio > hoje) return { semana, pasta: null, consulta: semana };
  const ate = pasta.fim < hoje ? pasta.fim : hoje;
  const maisAntigo = somarDias(hoje, -DIAS_MAXIMOS_DA_CONSULTA);
  const de = pasta.inicio < maisAntigo ? maisAntigo : pasta.inicio;
  return {
    semana,
    pasta: { de, ate, titulo: pasta.titulo, limitada: de !== pasta.inicio },
    consulta: { de: de < inicioDaSemana ? de : inicioDaSemana, ate: hoje },
  };
}

/**
 * Quantos treinos têm registro no período: cada par (data, sessão) com pelo menos uma série concluída conta uma vez.
 * Só contagem: sem meta, previsto ou porcentagem.
 */
export function treinosComRegistro(dias: DiaDeTreino[], de: string, ate: string): number {
  const feitos = new Set<string>();
  for (const dia of dias) {
    if (dia.data < de || dia.data > ate) continue;
    for (const sessao of dia.sessoes) {
      if (sessao.exercicios.some((e) => e.series.some((s) => s.concluida))) feitos.add(`${dia.data}|${sessao.sessaoUid}`);
    }
  }
  return feitos.size;
}

export function frequenciaDe(dias: DiaDeTreino[], plano: PlanoDaFrequencia): Frequencia {
  return {
    semana: treinosComRegistro(dias, plano.semana.de, plano.semana.ate),
    pasta: plano.pasta ? { ...plano.pasta, treinos: treinosComRegistro(dias, plano.pasta.de, plano.pasta.ate) } : null,
  };
}

/** "—" sem período contável; zero é "Nenhum registro"; senão o número. */
export function textoDaContagem(n: number | null): string {
  if (n === null) return '—';
  return n === 0 ? 'Nenhum registro' : String(n);
}
