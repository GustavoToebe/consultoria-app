/** Instante de término, nunca um contador que perde segundos em segundo plano. */
export interface Descanso { terminaEm: number; duracaoMs: number }
export function iniciarDescanso(segundos: number, agora: number): Descanso {
 const duracaoMs = Math.max(0, segundos * 1000);
 return { terminaEm: agora + duracaoMs, duracaoMs };
}
export function restante(descanso: Descanso, agora: number): number { return Math.max(0, descanso.terminaEm - agora); }
export function terminado(descanso: Descanso, agora: number): boolean { return restante(descanso, agora) === 0; }
export function ajustarDescanso(descanso: Descanso, segundos: number, agora: number): Descanso {
 const novo = Math.max(0, restante(descanso, agora) + segundos * 1000);
 return { terminaEm: agora + novo, duracaoMs: Math.max(descanso.duracaoMs, novo) };
}
