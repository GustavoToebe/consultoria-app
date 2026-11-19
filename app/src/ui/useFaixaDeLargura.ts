import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { faixaDeLargura, type FaixaDeLargura } from '../tema/tokens';

export interface MedidaDeLargura {
  largura: number;
  faixa: FaixaDeLargura;
  aoMedir: (evento: LayoutChangeEvent) => void;
}

/**
 * Mede a largura da área de conteúdo via `onLayout` (nunca `useWindowDimensions`, porque o menu lateral aberto ou
 * recolhido muda o espaço disponível). Antes da primeira medição, `largura` é 0 e `faixa` é `compacta`.
 */
export function useFaixaDeLargura(): MedidaDeLargura {
  const [largura, setLargura] = useState(0);
  const aoMedir = (evento: LayoutChangeEvent) => {
    const proxima = evento.nativeEvent.layout.width;
    setLargura((atual) => (atual === proxima ? atual : proxima));
  };
  return { largura, faixa: faixaDeLargura(largura), aoMedir };
}
