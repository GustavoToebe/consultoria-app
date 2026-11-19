import { createContext, useContext, type ReactNode } from 'react';

/**
 * Se o editor está em duas colunas (lista + inspetor) ou três colunas (lista + inspetor + resumo/total ao lado, na
 * faixa `ultralarga` com preferência `AUTOMATICA`): a `TelaDoEditor` com `colunas` mede a própria largura e põe o
 * resultado aqui. Fora dela, ou sem `colunas` (questionário, modelo de uma refeição, os outros modelos), é sempre `false`.
 */
const Contexto = createContext(false);
const ContextoTres = createContext(false);

export const ProvedorDeColunas = Contexto.Provider;
export const ProvedorDeTresColunas = ContextoTres.Provider;

export function useDuasColunas(): boolean {
  return useContext(Contexto);
}

export function useTresColunas(): boolean {
  return useContext(ContextoTres);
}

/** Para quem monta a `TelaDoEditor` e precisa dos valores dentro dela (os hooks só funcionam abaixo do provedor). */
export function ComColunas({ children }: { children: (duas: boolean, tres: boolean) => ReactNode }) {
  return <>{children(useDuasColunas(), useTresColunas())}</>;
}
