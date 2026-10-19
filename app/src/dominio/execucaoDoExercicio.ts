import type { ExercicioPlano } from '../api/tipos';

/**
 * Execução do exercício (pesquisa de técnicas de 19/10): cadência e isometria valem para o exercício todo e são só o
 * que o treinador escreveu. Mesmas regras do `ValidadorTreino`: cadência em 4 partes separadas por hífen, cada uma de
 * 0 a 9 segundos ou X (explosivo), na ordem descida-pausa embaixo-subida-pausa em cima; isometria de 1 a 120 s.
 */

export const CADENCIA = /^[0-9X](-[0-9X]){3}$/;
export const ISOMETRIA_MINIMA = 1;
export const ISOMETRIA_MAXIMA = 120;

/** Como o treinador digita: espaços saem e "x" vira "X". Vazio vira nulo (sem cadência). */
export function normalizarCadencia(texto: string): string | null {
  const limpo = texto.replace(/\s+/g, '').toUpperCase();
  return limpo ? limpo : null;
}

export function cadenciaValida(cadencia: string | null | undefined): boolean {
  return !cadencia || CADENCIA.test(cadencia);
}

export function erroDaCadencia(cadencia: string | null | undefined): string | undefined {
  return cadenciaValida(cadencia) ? undefined : 'Use 4 partes separadas por hífen, de 0 a 9 ou X (ex.: 3-1-1-0).';
}

export function erroDaIsometria(segundos: number | null | undefined): string | undefined {
  if (segundos == null) return undefined;
  return segundos >= ISOMETRIA_MINIMA && segundos <= ISOMETRIA_MAXIMA ? undefined : `De ${ISOMETRIA_MINIMA} a ${ISOMETRIA_MAXIMA} s.`;
}

const PARTES = ['descendo', 'parado embaixo', 'subindo', 'em cima'];

/** "3-1-1-0: 3 s descendo, 1 s parado embaixo, 1 s subindo, 0 s em cima." X = "o mais rápido que puder". */
export function textoCadenciaPorExtenso(cadencia: string | null | undefined): string {
  if (!cadencia || !CADENCIA.test(cadencia)) return '';
  const partes = cadencia.split('-').map((v, i) => (v === 'X' ? `${PARTES[i]} o mais rápido que puder` : `${v} s ${PARTES[i]}`));
  return `Cadência ${cadencia}: ${partes.join(', ')}.`;
}

export function textoIsometriaPorExtenso(segundos: number | null | undefined): string {
  return segundos ? `Isometria: segure ${segundos} s.` : '';
}

/** Texto curto para o PDF e o resumo do editor: "Cadência 3-1-1-0 · Isometria 10 s". */
export function textoExecucao(e: Pick<ExercicioPlano, 'cadencia' | 'isometriaSegundos'>): string {
  const partes: string[] = [];
  if (e.cadencia) partes.push(`Cadência ${e.cadencia}`);
  if (e.isometriaSegundos) partes.push(`Isometria ${e.isometriaSegundos} s`);
  return partes.join(' · ');
}

/** Linhas para o aluno ler antes das séries (vazio quando o treinador não escreveu nada). */
export function textosDeExecucao(e: Pick<ExercicioPlano, 'cadencia' | 'isometriaSegundos'>): string[] {
  return [textoCadenciaPorExtenso(e.cadencia), textoIsometriaPorExtenso(e.isometriaSegundos)].filter(Boolean);
}
