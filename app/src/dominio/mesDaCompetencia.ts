import { SEM_DADO } from './formatos';

/**
 * Mês e competência do Financeiro e dos Números em MM/AAAA (Gustavo, 19/11: "11/2026", não "nov/2026"), sempre com
 * `Texto numerico` na tela. Módulo folha: não importa `numeros.ts` nem `financeiro.ts`, que dependem dele.
 * Agenda, histórico do aluno, mapa de treinos e Minha conta têm o próprio nome do mês e não usam isto.
 */

/** Ano e mês de `AAAA-MM` ou `AAAA-MM-DD`; `null` fora do formato ou com mês fora de 01 a 12. */
function anoEMes(mes: string | null | undefined): { ano: string; mes: string } | null {
  const m = /^(\d{4})-(\d{2})(?:$|-)/.exec(mes ?? '');
  if (!m) return null;
  const n = Number(m[2]);
  return n >= 1 && n <= 12 ? { ano: m[1], mes: m[2] } : null;
}

/** `2026-11` ou `2026-11-05` → `11/2026`; fora do formato → "—". */
export function rotuloDoMesNumerico(mes: string | null | undefined): string {
  const a = anoEMes(mes);
  return a ? `${a.mes}/${a.ano}` : SEM_DADO;
}

/** Eixo de gráfico sem espaço: `2026-11` → `11/26`; fora do formato → "—". */
export function rotuloCurtoDoMes(mes: string | null | undefined): string {
  const a = anoEMes(mes);
  return a ? `${a.mes}/${a.ano.slice(2)}` : SEM_DADO;
}
