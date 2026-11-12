import type { DiaDeTreino } from '../api/tipos';
import { dataCurta, somarDias } from './formatos';
import { textoDosDiasDeMobilidade, type ContagemDaMobilidade } from './mobilidadeFeita';
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
  /** Data do último treino com série concluída dentro do que foi consultado (semana e pasta); nulo se nenhum. */
  ultimo: string | null;
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
    ultimo: ultimoDiaComRegistro(dias),
    pasta: plano.pasta ? { ...plano.pasta, treinos: treinosComRegistro(dias, plano.pasta.de, plano.pasta.ate) } : null,
  };
}

/** Última data com pelo menos uma série concluída (os dias podem vir em qualquer ordem). */
export function ultimoDiaComRegistro(dias: DiaDeTreino[]): string | null {
  let ultimo: string | null = null;
  for (const dia of dias) {
    const feito = dia.sessoes.some((s) => s.exercicios.some((e) => e.series.some((x) => x.concluida)));
    if (feito && (ultimo === null || dia.data > ultimo)) ultimo = dia.data;
  }
  return ultimo;
}

/** Uma linha do resumo: os dois números, ou uma frase no lugar deles. `naPasta` nulo = sem a coluna da pasta. */
export type LinhaDoResumo = { rotulo: string; semana: string; naPasta: string | null } | { rotulo: string; aviso: string };

export interface ResumoDaFrequencia {
  /** "Pasta <título> (dd/mm a dd/mm)", dito uma vez para as duas linhas; sem pasta vigente, "Nenhuma pasta vigente.". */
  pasta: string;
  /** Sem pasta vigente a coluna "Na pasta" some. */
  comColunaDaPasta: boolean;
  linhas: LinhaDoResumo[];
}

/**
 * Cartão "Frequência e mobilidade" da ficha. `mobilidade`: `'oculta'` sem a permissão (ou com a busca dela em erro, que a
 * tela mostra à parte), `null` sem plano de mobilidade publicado na pasta. Sem pasta vigente não há mobilidade a contar:
 * a linha some e o cartão diz isso uma vez. A pasta da mobilidade conta o mesmo período da frequência: sem período
 * contável (sem início ou começando no futuro), as duas células da pasta são "—".
 */
export function resumoDaFrequencia(
  f: Frequencia, vigente: { titulo: string } | null, mobilidade: ContagemDaMobilidade | null | 'oculta',
): ResumoDaFrequencia {
  const p = f.pasta;
  const pasta = !vigente ? 'Nenhuma pasta vigente.'
    : p ? `Pasta ${p.titulo} (${dataCurta(p.de)} a ${dataCurta(p.ate)}${p.limitada ? ', últimos 12 meses' : ''})`
      : `Pasta ${vigente.titulo}`;
  const linhas: LinhaDoResumo[] = [{ rotulo: 'Treinos', semana: textoDaContagem(f.semana), naPasta: vigente ? textoDaContagem(p ? p.treinos : null) : null }];
  if (!vigente || mobilidade === 'oculta') return { pasta, comColunaDaPasta: !!vigente, linhas };
  if (mobilidade === null) linhas.push({ rotulo: 'Mobilidade', aviso: 'A pasta vigente não tem mobilidade publicada.' });
  else {
    linhas.push({ rotulo: 'Mobilidade', semana: textoDosDiasDeMobilidade(mobilidade.naSemana), naPasta: textoDosDiasDeMobilidade(p ? mobilidade.naPasta : null) });
  }
  return { pasta, comColunaDaPasta: true, linhas };
}

/** "—" sem período contável; zero é "Nenhum registro"; senão "1 treino", "16 treinos" (o número sozinho não diz de quê). */
export function textoDaContagem(n: number | null): string {
  if (n === null) return '—';
  if (n === 0) return 'Nenhum registro';
  return `${n} ${n === 1 ? 'treino' : 'treinos'}`;
}
