import type { Serie } from '../api/tipos';
import { numeroParaTela } from './formatos';

/** Mesma prescrição: tipo, repetições, AMRAP, carga, esforço, técnica, cardio e alvo extra iguais (o % de cada série de preparação muda). */
export function mesmaPrescricao(a: Serie, b: Serie): boolean {
  return (
    (a.tipo ?? null) === (b.tipo ?? null) &&
    (a.repsMin ?? null) === (b.repsMin ?? null) &&
    (a.repsMax ?? null) === (b.repsMax ?? null) &&
    !!a.amrap === !!b.amrap &&
    (a.alvoExtra ?? null) === (b.alvoExtra ?? null) &&
    canonico(semModoNenhum(a)) === canonico(semModoNenhum(b)) &&
    canonico(a.esforco) === canonico(b.esforco) &&
    canonico(a.tecnica) === canonico(b.tecnica) &&
    canonico(a.cardio) === canonico(b.cardio)
  );
}

/** Texto estável de um objeto: chaves em ordem, ausente igual a nulo e carga/esforço vazios iguais a nenhum. */
function canonico(valor: unknown): string {
  const limpo = (v: unknown): unknown => {
    if (v === undefined || v === null) return null;
    if (Array.isArray(v)) return v.map(limpo);
    if (typeof v === 'object') {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .sort(([x], [y]) => x.localeCompare(y))
          .map(([k, x]) => [k, limpo(x)])
          .filter(([, x]) => x !== null),
      );
    }
    return v;
  };
  const resultado = limpo(valor);
  return JSON.stringify(resultado && typeof resultado === 'object' && Object.keys(resultado).length === 0 ? null : resultado);
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

/** Carga `NENHUMA` sem parâmetros é o mesmo que não ter carga. */
const semModoNenhum = (s: Serie) => (s.carga?.modo === 'NENHUMA' && s.carga.percentualMin == null && s.carga.percentualMax == null && !s.carga.referenciaUid ? null : s.carga);
