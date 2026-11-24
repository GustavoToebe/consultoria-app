import { colunasDosIndicadores } from './grade';

/**
 * Tela larga (revisão de 24/11, `docs/design-e-front.md` 4.10): os oito indicadores de Interessados viram uma linha de
 * oito quando cada cartão ainda tem ~220 px (a grade de ~1840 px, que só existe na faixa ultralarga ou com o menu
 * recolhido em 2560); abaixo disso, a regra de sempre (4, 2 ou 1, nunca 3). Cresce com o texto ampliado.
 */
export function colunasDosOitoIndicadores(largura: number, fatorTexto = 1): 1 | 2 | 4 | 8 {
  if (largura >= Math.round(1840 * fatorTexto)) return 8;
  return colunasDosIndicadores(largura, fatorTexto);
}

/**
 * Perdas por motivo, Entradas por origem, Como contamos e Limites dos dados numa linha só (quatro colunas de ~600 px, com
 * 16 px entre elas: a tabela ainda fica em colunas, acima dos 520 da `Tabela`, e o glossário em duas) quando a área passa
 * de 2448 px (3440 com o menu aberto); abaixo disso, as duas tabelas lado a lado e os textos em faixa inteira. Assim a
 * tabela de duas ou três colunas não estica até 1500 px na ultralarga.
 */
export const LARGURA_ANALISES_EM_UMA_LINHA = 4 * 600 + 3 * 16;
export const analisesEmUmaLinha = (largura: number) => largura >= LARGURA_ANALISES_EM_UMA_LINHA;

/**
 * Colunas do glossário "Como contamos" pela largura do próprio cartão, como o "Como calculamos" do Financeiro: 4 a partir
 * de 2000, 3 a partir de 1200, 2 a partir de 544 (cada explicação com ~260 px) e 1 abaixo. Mais colunas = linhas curtas.
 */
export function colunasDoGlossario(largura: number): 1 | 2 | 3 | 4 {
  if (largura >= 2000) return 4;
  if (largura >= 1200) return 3;
  if (largura >= 2 * 260 + 24) return 2;
  return 1;
}
