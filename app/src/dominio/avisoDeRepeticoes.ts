import type { Configuracao, Serie } from '../api/tipos';
import { papelDe } from './metodologia';

/**
 * Aviso "passou de N repetições" (D11, 03/11): na série de trabalho simples, o aluno registrou mais repetições que o máximo
 * da meta. Só texto: nunca sugere, calcula ou escreve um valor em kg (os critérios de progressão esperam os dados dos 5
 * alunos). Vale para as séries de papel TRABALHO e POS_TRABALHO da metodologia (as mesmas do contador, D6), em qualquer modo de
 * carga; sem aviso em AMRAP (não há máximo), cardio, técnica (a meta é a soma das etapas), aquecimento, preparação e tipo que
 * a metodologia não conhece. Regra pura; funciona sem internet.
 */
export function avisoDeRepeticoes(serie: Serie, repeticoes: number | null, metodologia: Configuracao | null | undefined): string | null {
  if (repeticoes === null || serie.repsMax == null || serie.amrap || serie.cardio || serie.tecnica) return null;
  const papel = papelDe(metodologia, serie.tipo);
  if ((papel !== 'TRABALHO' && papel !== 'POS_TRABALHO') || repeticoes <= serie.repsMax) return null;
  return `Passou de ${serie.repsMax} ${serie.repsMax === 1 ? 'repetição' : 'repetições'}, o máximo da meta.`;
}
