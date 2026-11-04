import { createContext, useContext, type ReactNode } from 'react';

/**
 * Se o editor está em duas colunas (lista + inspetor): a `TelaDoEditor` com `colunas` mede a própria largura e põe o
 * resultado aqui. Fora dela, ou sem `colunas` (questionário, modelo de uma refeição, os outros modelos), é sempre `false`.
 */
const Contexto = createContext(false);

export const ProvedorDeColunas = Contexto.Provider;

export function useDuasColunas(): boolean {
  return useContext(Contexto);
}

/** Para quem monta a `TelaDoEditor` e precisa do valor dentro dela (o hook só funciona abaixo do provedor). */
export function ComColunas({ children }: { children: (duas: boolean) => ReactNode }) {
  return <>{children(useDuasColunas())}</>;
}
