import { LARGURA_FAIXA_LARGA, LARGURA_FAIXA_NORMAL } from '../tema/tokens';
import { LARGURA_DOIS_VIDEOS } from './gradeDosVideos';

/**
 * Colunas da grade de planos (financeiro em tela larga, 23/11; `docs/planos/financeiro-em-tela-larga.md`), pela largura da
 * própria grade e a régua de faixas (`faixaDeLargura`), a mesma da aba Vídeos: 4 a partir de 1600 px, 3 de 1024 a 1600,
 * 2 de 600 a 1024 e 1 abaixo. O espaço extra vira coluna, nunca cartão esticado: com menos planos que o teto, as colunas
 * ficam (os cartões à esquerda). Com mais, o teto desce até a última linha não ter um cartão sozinho, quando der.
 */
export function colunasDosPlanos(largura: number, quantidade: number): number {
  const teto = largura >= LARGURA_FAIXA_LARGA ? 4 : largura >= LARGURA_FAIXA_NORMAL ? 3 : largura >= LARGURA_DOIS_VIDEOS ? 2 : 1;
  if (quantidade <= teto) return teto;
  for (let colunas = teto; colunas > 1; colunas -= 1) if (quantidade % colunas !== 1) return colunas;
  return teto;
}
