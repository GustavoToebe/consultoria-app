import { createContext, useContext } from 'react';

import { useTema } from '../tema/TemaProvider';

const Contexto = createContext<string | null>(null);

/** Posto pela `Navegacao` no PC: o conteúdo fica no `painel`, não no `fundo` (o menu é que fica no fundo). */
export const ProvedorDoFundoDaArea = Contexto.Provider;

/**
 * Cor de fundo da área onde a tela está: `painel` ao lado do menu lateral, `fundo` no resto (celular, aluno, telas
 * públicas). Quem pinta o fundo da tela ou casa uma cor com ele (o esmaecido das faixas que rolam) usa esta cor.
 */
export function useFundoDaArea(): string {
  const { cores } = useTema();
  return useContext(Contexto) ?? cores.fundo;
}
