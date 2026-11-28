/** Lista das seções do editor de mobilidade: a de sempre (280). As larguras das três colunas vêm de `colunasComPrevia` (`colunasDoEditor`). */
export const LARGURA_DA_LISTA = 280;

/**
 * A seção em edição (a do inspetor) e o alvo da prévia: a escolhida, se ainda existe; senão a primeira (a escolhida saiu,
 * o modelo foi trocado); `null` sem seções.
 */
export function secaoEmEdicao<S extends { uid: string }>(secoes: readonly S[], escolhidaUid: string | null): S | null {
  return secoes.find((s) => s.uid === escolhidaUid) ?? secoes[0] ?? null;
}
