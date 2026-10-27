/**
 * Instante de término, nunca um contador que perde segundos em segundo plano. `rotulo` diferencia a pausa entre etapas
 * ("Pausa entre blocos") do descanso depois da série; sem ele, "Descanso".
 */
export interface Descanso { terminaEm: number; duracaoMs: number; rotulo?: string; origem?: string }
/**
 * `origem` diz de onde a pausa nasceu (a etapa marcada, ver `origemDaPausa`); sem ela o cronômetro é do aluno ou do
 * descanso da série e só "Pular" o encerra.
 */
export function iniciarDescanso(segundos: number, agora: number, rotulo?: string, origem?: string): Descanso {
 const duracaoMs = Math.max(0, segundos * 1000);
 return { terminaEm: agora + duracaoMs, duracaoMs, ...(rotulo ? { rotulo } : {}), ...(origem ? { origem } : {}) };
}
/**
 * Ordem dos pedidos de cronômetro. Quem só começa depois de uma gravação (o descanso da série) reserva a vez antes; se
 * outro cronômetro começou nesse meio-tempo (uma pausa de etapa mais nova), a reserva perdeu e o início é descartado.
 * Cancelar e "Pular" não contam: só começar um cronômetro invalida as reservas abertas.
 */
export function criarPedidosDeDescanso() {
 let ultimo = 0;
 return {
  reservar: (): number => ++ultimo,
  /** `true` se o início vale; sem reserva sempre vale (e invalida as reservas abertas). */
  admitir: (reserva?: number): boolean => {
   if (reserva !== undefined) return reserva === ultimo;
   ultimo += 1;
   return true;
  },
 };
}
/**
 * O cronômetro que passa a valer ao iniciar `novo`. Início automático (marcar a etapa) de uma origem que já está ativa
 * mantém o atual: um segundo toque, antes de o registro recarregar, não reinicia a pausa. Pedido explícito (o botão
 * "Pausa") e origem diferente sempre substituem.
 */
export function descansoAoIniciar(atual: Descanso | null, novo: Descanso, automatica: boolean): Descanso {
 return automatica && novo.origem !== undefined && atual?.origem === novo.origem ? atual : novo;
}
/** Encerra o cronômetro só se ele nasceu desta origem; o de outra origem, o manual e o descanso da série ficam. */
export function semDescansoDe(atual: Descanso | null, origem: string): Descanso | null {
 return atual && atual.origem === origem ? null : atual;
}
export function restante(descanso: Descanso, agora: number): number { return Math.max(0, descanso.terminaEm - agora); }
export function terminado(descanso: Descanso, agora: number): boolean { return restante(descanso, agora) === 0; }
export function ajustarDescanso(descanso: Descanso, segundos: number, agora: number): Descanso {
 const novo = Math.max(0, restante(descanso, agora) + segundos * 1000);
 return { ...descanso, terminaEm: agora + novo, duracaoMs: Math.max(descanso.duracaoMs, novo) };
}
/** Tempos prontos da folha de descanso, em segundos. */
export const DESCANSOS_PRONTOS = [30, 45, 60, 90, 120, 150, 180, 240, 300];
/** Maior tempo aceito no campo livre: 59 min 59 s. */
export const DESCANSO_MAXIMO = 59 * 60 + 59;
/** Minutos e segundos digitados (só dígitos) em segundos; vazio ou zero → null. Acima do máximo, trava no máximo. */
export function segundosDigitados(minutos: string, segundos: string): number | null {
 const total = (Number(minutos.replace(/\D/g, '')) || 0) * 60 + (Number(segundos.replace(/\D/g, '')) || 0);
 return total > 0 ? Math.min(total, DESCANSO_MAXIMO) : null;
}
/** 30 → "30 s", 60 → "1 min", 90 → "1 min 30 s". */
export function rotuloDescanso(segundos: number): string {
 const min = Math.floor(segundos / 60), seg = segundos % 60;
 if (min === 0) return `${seg} s`;
 return seg === 0 ? `${min} min` : `${min} min ${seg} s`;
}
