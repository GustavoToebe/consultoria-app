import type { Locator, Page } from '@playwright/test';

/**
 * Linha de um bloco de séries no editor de treino: aba no PC (tabela com colunas) e botão de sanfona quando a coluna das
 * séries é estreita (390), com o detalhe logo abaixo. `escolhida` filtra pela aba selecionada ou pela linha aberta.
 * Os seletores "Série 1 · RIR: …. Escolher." do detalhe começam igual e ficam de fora.
 */
export function linhaDaSerie(page: Page, nome: RegExp, escolhida?: boolean): Locator {
  const n = new RegExp(`${nome.source}(?!.*Escolher\\.$)`, nome.flags);
  const aba = page.getByRole('tab', escolhida === undefined ? { name: n } : { name: n, selected: escolhida });
  const botao = page.getByRole('button', escolhida === undefined ? { name: n } : { name: n, expanded: escolhida });
  return aba.or(botao);
}
