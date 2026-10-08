import type { ConteudoTreino, Sessao } from '../api/tipos';
import { DIAS_SEMANA, TIPOS_SESSAO } from './editorTreino';

/** Sessão marcada para o dia da semana (1 = segunda). Sem sessão naquele dia → `null`. */
export function sessaoDoDia(conteudo: ConteudoTreino, dia: number): Sessao | null {
  return conteudo.sessoes.find((s) => s.diaSemana === dia) ?? null;
}

/** Sessões na ordem da semana; as sem dia fixo (acessórios) vão no fim. */
export function sessoesDaSemana(conteudo: ConteudoTreino): Sessao[] {
  return [...conteudo.sessoes].sort((a, b) => (a.diaSemana ?? 99) - (b.diaSemana ?? 99));
}

export function rotuloDoDia(s: Sessao): string {
  if (s.diaSemana) return DIAS_SEMANA[s.diaSemana - 1];
  if (s.frequenciaSemanal) return `${s.frequenciaSemanal}x na semana`;
  return 'Sem dia fixo';
}

export function rotuloDoTipo(s: Sessao): string {
  return TIPOS_SESSAO.find((t) => t.valor === s.tipo)?.rotulo ?? s.tipo;
}

/** Total de séries da sessão (para "3 de 18 séries feitas"). */
export function totalDeSeries(s: Sessao): number {
  return s.exercicios.reduce((n, e) => n + e.series.length, 0);
}
