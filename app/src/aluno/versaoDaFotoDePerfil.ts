import { useSyncExternalStore } from 'react';

/**
 * Número que muda quando o aluno troca ou apaga a foto de perfil: o início e a Conta usam na chave da imagem e baixam
 * de novo. Só em memória (a foto em si nunca fica guardada no aparelho).
 */
let versao = 0;
const ouvintes = new Set<() => void>();

export function avisarQueAFotoMudou(): void {
  versao += 1;
  ouvintes.forEach((ouvir) => ouvir());
}

function assinar(ouvir: () => void): () => void {
  ouvintes.add(ouvir);
  return () => ouvintes.delete(ouvir);
}

export const useVersaoDaFotoDePerfil = (): number => useSyncExternalStore(assinar, () => versao, () => versao);
