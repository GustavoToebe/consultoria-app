/**
 * Blocos do cluster como o treinador escreve na planilha: "4+2" (blocos desiguais) ou "3×4" (3 blocos de 4). No plano
 * ficam como lista de repetições (`Tecnica.blocos`: `[4, 2]`, `[4, 4, 4]`); as repetições da série são a soma. Os
 * limites são os do servidor (`ConteudoTreino.Tecnica`): de 2 a 10 blocos, cada um com 1 a 50 repetições.
 */

export const MINIMO_DE_BLOCOS = 2;
export const MAXIMO_DE_BLOCOS = 10;
export const MAXIMO_REPS_POR_BLOCO = 50;

/**
 * Lê o texto digitado: "4+2" → `[4, 2]`; "3×4", "3x4" ou "3 x 4" → `[4, 4, 4]`; "6" → `[6]` (um bloco só, que
 * `blocosValidos` recusa). Vazio ou sem forma conhecida → `null`.
 */
export function lerBlocos(texto: string): number[] | null {
  const t = texto.replace(/\s+/g, '').replace(/[×X*]/g, 'x');
  if (!t) return null;
  const multiplicacao = /^(\d{1,2})x(\d{1,3})$/.exec(t);
  if (multiplicacao) {
    const quantidade = Number(multiplicacao[1]);
    const reps = Number(multiplicacao[2]);
    if (quantidade < 1) return null;
    return Array.from({ length: quantidade }, () => reps);
  }
  if (!/^\d{1,3}(\+\d{1,3})*$/.test(t)) return null;
  return t.split('+').map(Number);
}

/** Texto curto dos blocos: todos iguais → "3×4"; diferentes → "4+2"; sem blocos → vazio. */
export function textoDeBlocos(blocos: readonly number[] | null | undefined): string {
  if (!blocos || blocos.length === 0) return '';
  if (blocos.length >= 2 && blocos.every((b) => b === blocos[0])) return `${blocos.length}×${blocos[0]}`;
  return blocos.join('+');
}

/** Todos os blocos com o mesmo número de repetições, e pelo menos dois. */
export function blocosIguais(blocos: readonly number[] | null | undefined): boolean {
  return !!blocos && blocos.length >= 2 && blocos.every((b) => b === blocos[0]);
}

/** Repetições da série de um cluster: a soma dos blocos; `null` sem blocos. */
export function somaDosBlocos(blocos: readonly number[] | null | undefined): number | null {
  if (!blocos || blocos.length === 0) return null;
  return blocos.reduce((soma, b) => soma + b, 0);
}

/**
 * Leitura do cluster quando os blocos cabem no contrato. Sem blocos válidos, `null`:
 * a prévia não reaproveita um total antigo.
 */
export function resumoDosBlocos(blocos: readonly number[] | null | undefined): { repeticoes: number; blocos: number; pausas: number } | null {
  if (!blocosValidos(blocos)) return null;
  return { repeticoes: somaDosBlocos(blocos)!, blocos: blocos!.length, pausas: blocos!.length - 1 };
}

/** De 2 a 10 blocos, cada um com 1 a 50 repetições inteiras (os limites do servidor). */
export function blocosValidos(blocos: readonly number[] | null | undefined): boolean {
  return (
    !!blocos &&
    blocos.length >= MINIMO_DE_BLOCOS &&
    blocos.length <= MAXIMO_DE_BLOCOS &&
    blocos.every((b) => Number.isInteger(b) && b >= 1 && b <= MAXIMO_REPS_POR_BLOCO)
  );
}
