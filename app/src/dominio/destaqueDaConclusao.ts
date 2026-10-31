/**
 * "Revisar e concluir treino" (B5 da reunião de 30/10): com todas as séries marcadas, o botão de concluir muda de texto
 * e passa a ser a ação principal do exercício. Nada é automático: o toque ainda abre a Folha para revisar o resultado,
 * a duração e o comentário; concluir em parte e Reabrir continuam como estavam. Com a chave `retornoHabilitado`
 * desligada não há conclusão no app e nada muda.
 */
export const ROTULO_CONCLUIR = 'Concluir treino';
export const ROTULO_REVISAR_E_CONCLUIR = 'Revisar e concluir treino';

/** Todas as séries previstas estão marcadas (sessão sem série prevista nunca está "toda marcada"). */
export function todasMarcadas(total: number, feitas: number): boolean {
  return total > 0 && feitas >= total;
}

/** Texto do botão que abre a Folha de concluir. */
export function rotuloDoConcluir(total: number, feitas: number): string {
  return todasMarcadas(total, feitas) ? ROTULO_REVISAR_E_CONCLUIR : ROTULO_CONCLUIR;
}

/**
 * O "Concluir" vira o primário da tela do exercício, à frente do "Próximo": só com a chave ligada, todas as séries
 * marcadas, numa data em que o treino pode ser concluído e ainda não concluído (concluído, o lugar é da linha
 * "Treino concluído" e o "Próximo" volta a ser o primário).
 */
export function concluirEmDestaque(p: { retornoHabilitado: boolean; total: number; feitas: number; podeConcluir: boolean; concluida: boolean }): boolean {
  return p.retornoHabilitado && p.podeConcluir && !p.concluida && todasMarcadas(p.total, p.feitas);
}
