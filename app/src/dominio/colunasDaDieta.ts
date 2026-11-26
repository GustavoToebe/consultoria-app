import { espaco, LARGURA_FAIXA_LARGA, LARGURA_FAIXA_ULTRALARGA } from '../tema/tokens';
import { respiroLateralDaTela } from './larguraDoConteudo';

/** Coluna do "Total do dia" ao lado da refeição: ~400 px na faixa `larga`, ~460 na `ultralarga` (Gustavo, 25/11). */
export const LARGURA_TOTAL_NA_LARGA = 400;
export const LARGURA_TOTAL_NA_ULTRALARGA = 460;

// A linha das colunas mede a área menos o recuo lateral dos dois lados (16 px até a `larga`, 48 na `ultralarga`):
// estes limites são as faixas de 4.10 (1600 e 2400 de área) vistos de dentro do recuo.
export const LINHA_DAS_TRES_COLUNAS = LARGURA_FAIXA_LARGA - 2 * (respiroLateralDaTela('larga') ?? espaco(2));
export const LINHA_DO_TOTAL_ULTRALARGO = LARGURA_FAIXA_ULTRALARGA - 2 * (respiroLateralDaTela('ultralarga') ?? espaco(2));

/**
 * Editor de dieta em duas colunas (lista | refeição): pela largura medida da linha das colunas, a largura da 3ª coluna,
 * a do Total do dia (fixa ao rolar, à direita), ou `null` para o Total ficar em faixa cheia acima (abaixo da `larga`,
 * ou antes da primeira medida). A refeição fica com o resto, sem teto: as três preenchem a largura do conteúdo, que já
 * respeita a "Largura do conteúdo" (em Limitada a linha para em 1800 e o total fica em 400).
 */
export function larguraDoTotalNaColuna(linha: number | null | undefined): number | null {
  if (typeof linha !== 'number' || !(linha >= LINHA_DAS_TRES_COLUNAS)) return null;
  return linha >= LINHA_DO_TOTAL_ULTRALARGO ? LARGURA_TOTAL_NA_ULTRALARGA : LARGURA_TOTAL_NA_LARGA;
}
