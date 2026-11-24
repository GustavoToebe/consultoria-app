import { LARGURA_MAXIMA } from '../tema/tokens';

/** Coluna de apoio da Visão geral do financeiro: ao menos isto, para os campos das renovações caberem dois por linha. */
export const LARGURA_COLUNA_DE_APOIO = 480;
const VAO = 16;

/**
 * Tela larga (revisão de 24/11, `docs/design-e-front.md` 4.10): a Inadimplência, o mês a mês e as quebras param em
 * `LARGURA_MAXIMA` (1800); quando o contêiner da Visão geral tem espaço para uma coluna de apoio ao lado (3440 com o menu
 * aberto, 2560 com ele recolhido), renovações, próximos recebimentos, líquido e o resultado do mês sobem para ela, em vez
 * de sobrar uma faixa vazia de ~1300 px à direita. Medido pelo contêiner: com "Largura do conteúdo" Limitada (1800) não abre.
 */
export const visaoGeralComColunaDeApoio = (largura: number) => largura >= LARGURA_MAXIMA + VAO + LARGURA_COLUNA_DE_APOIO;
