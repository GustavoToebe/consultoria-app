import type { ReactNode } from 'react';

/** Nativo: o WebView da prévia já ajusta a A4 (`viewport` de 794) à largura que recebe, para mais ou para menos. */
export function Ampliada({ children }: { escala: number; children: ReactNode }) {
  return children;
}
