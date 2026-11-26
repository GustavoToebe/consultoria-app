import { colunasPorCelula } from '../../../dominio/colunasPorCelula';
import { LARGURA_FAIXA_NORMAL, LARGURA_MENU_EXPANDIDO, LARGURA_MENU_LATERAL } from '../../../tema/tokens';

/**
 * Regras da galeria de modelos dos PDFs (seção 3.1 de `docs/planos/orientacoes-de-design-26-11.md`). Puras, testadas em
 * `regras.test.ts`.
 */

/** Célula do cartão do modelo: nunca mais estreita que 220 (miniatura ilegível) nem mais larga que 320. */
export const CELULA_MINIMA = 220;
export const CELULA_MAXIMA = 320;

/**
 * Cartões por linha: o maior divisor de 6 que cabe (6, 3, 2 ou 1; nunca 4 + 2), como `mesesPorLinhaDoAno`.
 * shortcut: `dominio/configuracaoPdf.colunasDaGaleria` (1 a 3, célula de 200) não segue a 3.1 e não é deste dono; troque-a por esta quando o dono dela puder.
 */
export function colunasDaGaleria(largura: number, vao: number): number {
  const cabem = colunasPorCelula(largura, CELULA_MINIMA, vao, 6);
  return [6, 3, 2].find((n) => n <= cabem) ?? 1;
}

/** Teto da grade com `colunas` células de no máximo `CELULA_MAXIMA`: a sobra da linha vira margem, nunca cartão esticado. */
export function larguraMaximaDaGaleria(colunas: number, vao: number): number {
  return colunas * CELULA_MAXIMA + (colunas - 1) * vao;
}

/** Menu do treinador na web (o de `ui/Navegacao`): aberto 240 a partir de 1024 de janela, trilho de 88 entre 768 e 1023. */
const MENU_ABERTO = 240;
const MENU_TRILHO = 88;

/**
 * Escolher um modelo abre o editor (`editor`) ou só confirma e grava aqui (`confirmar`, D-F2/D24). O editor pede a faixa
 * `normal` (≥ 1024 px de área ao lado do menu). Em Configurações a `Tela` mede só a coluna da direita, então vale também a
 * janela menos o menu aberto.
 * shortcut: o estado "minimizado" do menu não chega ao conteúdo, então a estimativa supõe o menu aberto (1100 a 1263 px de janela com o menu minimizado, em Configurações, confirmam em vez de abrir o editor); troque se o menu expuser a largura.
 */
export function modoDaEscolha({ web, janela, faixaDaTela }: { web: boolean; janela: number; faixaDaTela: string }): 'editor' | 'confirmar' {
  if (!web) return 'confirmar';
  if (faixaDaTela !== 'compacta') return 'editor';
  const menu = janela >= LARGURA_MENU_EXPANDIDO ? MENU_ABERTO : janela >= LARGURA_MENU_LATERAL ? MENU_TRILHO : 0;
  return janela - menu >= LARGURA_FAIXA_NORMAL ? 'editor' : 'confirmar';
}

/** Endereço do editor. Sem `modelo` abre a configuração gravada (o modelo em uso com as personalizações). */
export function enderecoDoEditor(modelo?: string): string {
  return modelo ? `/treinador/documentos/personalizar?modelo=${encodeURIComponent(modelo)}` : '/treinador/documentos/personalizar';
}
