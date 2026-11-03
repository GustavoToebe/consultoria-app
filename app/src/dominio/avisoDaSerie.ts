/**
 * Avisos que a série do aluno mostra junto dos campos (auditoria 03/11, N6 e N7). Só texto e regra pura: nada aqui
 * muda o que é gravado nem o que a API conta no progresso (a API olha a carga: série sem kg não entra).
 */

export const AVISO_SEM_CARGA = 'Sem carga registrada: esta série não entra no progresso.';

/**
 * N6 (decisão do Gustavo, 03/11): série marcada com o kg vazio, em exercício com carga, não entra no progresso, e o aluno
 * é avisado junto da série. Reps vazias com o kg preenchido não têm aviso; exercício sem carga (peso do corpo, elástico)
 * ou de forma de carga desconhecida (`semCampoDePeso`) também não. `ehTrabalho` limita ao que o progresso conta
 * (aquecimento e as demais já ficam fora dele de qualquer jeito).
 */
export function avisoDeSerieSemCarga(s: { feita: boolean; carga: number | null; semCampoDePeso: boolean; ehTrabalho: boolean }): string | null {
  return s.feita && s.carga === null && !s.semCampoDePeso && s.ehTrabalho ? AVISO_SEM_CARGA : null;
}

/** N7: o motivo escrito junto do campo quando o texto digitado não é número (o ✓ fica travado até corrigir). */
export function textoDoNumeroInvalido(cargaInvalida: boolean, repsInvalidas: boolean): string | null {
  if (cargaInvalida && repsInvalidas) return 'Use só números no peso e nas repetições.';
  if (cargaInvalida) return 'Peso: use só números.';
  if (repsInvalidas) return 'Repetições: use só números.';
  return null;
}
