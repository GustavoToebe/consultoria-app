import { createContext, useContext } from 'react';

import type { FaixaDeLargura } from '../tema/tokens';

export interface AreaDaTela {
  /** Faixa da área ao lado do menu, antes do recuo lateral (a régua de 4.10: normal 1024, larga 1600, ultralarga 2400). */
  faixa: FaixaDeLargura;
  /** Largura útil do conteúdo da `Tela` (já sem o recuo e no teto da preferência "Largura do conteúdo"); 0 antes de medir. */
  largura: number;
}

export const AreaDaTelaContexto = createContext<AreaDaTela>({ faixa: 'compacta', largura: 0 });

/**
 * A área do conteúdo como a `Tela` a mede, para quem decide o layout dentro dela (treinador e aluno: o mesmo mecanismo).
 * Só vale num componente desenhado DENTRO de `<Tela>`: fora dela, `compacta` e 0.
 */
export const useAreaDaTela = () => useContext(AreaDaTelaContexto);
