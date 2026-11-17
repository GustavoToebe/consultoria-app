import { useSyncExternalStore } from 'react';

/**
 * Número que muda quando o aluno salva ou remove o apelido (cartão Comunidade da Conta). O "Meu perfil" usa na chave da
 * leitura do nome e do apelido e refaz as prévias de "Como seu nome aparece para os colegas". Só em memória.
 */
let versao = 0;
const ouvintes = new Set<() => void>();

export function avisarQueOApelidoMudou(): void {
  versao += 1;
  ouvintes.forEach((ouvir) => ouvir());
}

function assinar(ouvir: () => void): () => void {
  ouvintes.add(ouvir);
  return () => ouvintes.delete(ouvir);
}

export const useVersaoDoApelido = (): number => useSyncExternalStore(assinar, () => versao, () => versao);
