import type { Serie } from '../api/tipos';
import { numeroParaTela } from './formatos';

/** Mesma prescrição: tipo, repetições, alvo, intensidade e técnica iguais (o % de cada série de aquecimento muda). */
export function mesmaPrescricao(a: Serie, b: Serie): boolean {
  return (
    a.tipo === b.tipo &&
    a.repsMin === b.repsMin &&
    a.repsMax === b.repsMax &&
    (a.alvoTexto ?? null) === (b.alvoTexto ?? null) &&
    JSON.stringify(a.intensidade ?? null) === JSON.stringify(b.intensidade ?? null) &&
    JSON.stringify(a.tecnica ?? null) === JSON.stringify(b.tecnica ?? null)
  );
}

export interface Repeticao {
  carga: number | null;
  repeticoes: number | null;
  /** "Repetir 40 kg × 6", "Repetir 12 reps". */
  rotulo: string;
}

/**
 * "Repetir a série anterior" só entre séries com a mesma prescrição e com algo registrado na anterior: copiar o
 * aquecimento para uma série de trabalho (bug da revisão de 19/10) marcava feita uma carga que não era a do plano.
 * O rótulo mostra os valores, para o aluno ver o que vai gravar.
 */
export function repeticaoDaAnterior(
  anterior: Serie | undefined,
  atual: Serie,
  registroAnterior: { carga: number | null; repeticoes: number | null } | undefined,
  semCarga: boolean,
): Repeticao | null {
  if (!anterior || !registroAnterior || !mesmaPrescricao(anterior, atual)) return null;
  const carga = semCarga ? null : registroAnterior.carga;
  const repeticoes = registroAnterior.repeticoes;
  if (carga === null && repeticoes === null) return null;
  const partes: string[] = [];
  if (carga !== null) partes.push(`${numeroParaTela(carga)} kg`);
  if (repeticoes !== null) partes.push(carga !== null ? `× ${repeticoes}` : `${repeticoes} ${repeticoes === 1 ? 'rep' : 'reps'}`);
  return { carga, repeticoes, rotulo: `Repetir ${partes.join(' ')}` };
}
