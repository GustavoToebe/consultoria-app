import { useState } from 'react';

/**
 * Verdadeiro só quando o item passou de não feito para feito com a tela aberta (guia de 11/11: ✓ neutro para o que já
 * estava feito, verde só no que a pessoa acabou de marcar). Ao abrir a tela de novo, o feito volta a ser neutro.
 */
export function useMarcadoAgora(feito: boolean): boolean {
  const [anterior, setAnterior] = useState(feito);
  const [agora, setAgora] = useState(false);
  if (anterior !== feito) {
    setAnterior(feito);
    setAgora(feito);
  }
  return agora && feito;
}
