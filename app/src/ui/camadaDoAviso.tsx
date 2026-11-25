import type { ReactNode } from 'react';

/** No celular o aviso sem Folha aberta fica na raiz, como sempre (a camada própria por cima de tudo é só da web). */
export function CamadaDoAviso({ children }: { children: ReactNode }) {
  return children;
}
