import type { ReactNode } from 'react';

import { LARGURA_DA_FOLHA } from '../../../dominio/editorDoPdf';

/**
 * Web: a `PreviaDoDocumento` só reduz a folha (nunca passa da A4 real); acima de 1, a folha vai na A4 dentro deste
 * invólucro com o `zoom` do CSS (até `ZOOM_MAXIMO`, decidido em `folhaNaTela`). A árvore é a mesma em qualquer escala:
 * cruzar o 1 ao redimensionar não remonta a prévia.
 */
export function Ampliada({ escala, children }: { escala: number; children: ReactNode }) {
  const amplia = escala > 1;
  return <div style={{ zoom: amplia ? escala : 1, width: amplia ? LARGURA_DA_FOLHA : '100%' }}>{children}</div>;
}
