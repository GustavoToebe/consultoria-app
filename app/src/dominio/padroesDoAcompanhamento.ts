import type { TextosDasFases } from '../api/tipos';
import type { FaseDoCiclo } from './cicloMenstrual';
import { somarDias } from './formatos';
import { periodoCurto } from './periodoCurto';

/**
 * Regras da tela Configurações › Padrões do acompanhamento (28/11): o prazo da nova atualização (1 a 365 dias, nulo = sem
 * padrão), os atalhos do prazo, o exemplo ao vivo do período e qual fase a prévia "Como a aluna vê" mostra.
 */

export const DIAS_MINIMO = 1;
export const DIAS_MAXIMO = 365;

/** Atalhos do prazo, em dias: semana, duas, três, quatro e o mês. */
export const ATALHOS_DOS_DIAS = [7, 14, 21, 28, 30] as const;

/** Nulo vale (sem padrão); fora disso, inteiro de 1 a 365, a faixa da API. */
export function prazoValido(dias: number | null): boolean {
  return dias === null || (Number.isInteger(dias) && dias >= DIAS_MINIMO && dias <= DIAS_MAXIMO);
}

/**
 * Exemplo do prazo, com o "hoje" de Brasília que a tela passa: "Uma pasta criada hoje vai de 28/11 a 11/12." (início hoje
 * e fim = início + dias − 1, a mesma conta de `periodo.periodoInicial` do "Nova pasta"; o ano só aparece quando não é o
 * corrente). Sem prazo, diz o que acontece; prazo fora da faixa não tem exemplo (o erro do campo já diz).
 */
export function exemploDoPrazo(hoje: string, dias: number | null): string | null {
  if (dias === null) return 'Sem padrão: você define o período em cada pasta.';
  if (!prazoValido(dias)) return null;
  return `Uma pasta criada hoje vai de ${periodoCurto({ inicio: hoje, fim: somarDias(hoje, dias - 1) }, hoje)}.`;
}

export type ChaveDaFase = keyof TextosDasFases;

/** As quatro fases na ordem do ciclo (a grade 2×2 lê Menstrual · Folicular / Ovulatória · Lútea). */
export const FASES_DOS_TEXTOS: readonly { chave: ChaveDaFase; fase: FaseDoCiclo; rotulo: string }[] = [
  { chave: 'menstrual', fase: 'MENSTRUAL', rotulo: 'Menstrual' },
  { chave: 'folicular', fase: 'FOLICULAR', rotulo: 'Folicular' },
  { chave: 'ovulatoria', fase: 'OVULATORIA', rotulo: 'Ovulatória' },
  { chave: 'lutea', fase: 'LUTEA', rotulo: 'Lútea' },
];

/** A fase da prévia: a do campo com o cursor; sem foco, a primeira com texto; sem nenhum texto, a Menstrual. */
export function faseDaPrevia(focada: ChaveDaFase | null, textos: TextosDasFases): ChaveDaFase {
  return focada ?? FASES_DOS_TEXTOS.find(({ chave }) => textos[chave])?.chave ?? 'menstrual';
}
