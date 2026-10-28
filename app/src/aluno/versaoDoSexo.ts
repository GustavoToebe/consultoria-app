import { useSyncExternalStore } from 'react';

/**
 * Número que muda quando o aluno salva um sexo diferente em "Meus dados". O ciclo (`useCicloDaAluna`) usa na chave e
 * consulta de novo: o servidor decide se o acompanhamento está disponível pelo sexo, e a sessão não guarda o sexo (o
 * `recarregarPerfil` não vale para aluno). Só em memória.
 */
let versao = 0;
const ouvintes = new Set<() => void>();

export function avisarQueOSexoMudou(): void {
  versao += 1;
  ouvintes.forEach((ouvir) => ouvir());
}

function assinar(ouvir: () => void): () => void {
  ouvintes.add(ouvir);
  return () => ouvintes.delete(ouvir);
}

export const useVersaoDoSexo = (): number => useSyncExternalStore(assinar, () => versao, () => versao);
