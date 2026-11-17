import type { Locator } from '@playwright/test';

/**
 * O que transborda a própria caixa dentro de `alvo` (palavra sem quebra passaria por baixo dos botões ou seria cortada pelo
 * cartão), como "largura visível < largura do conteúdo: começo do texto"; vazio = nada transborda. Fica de fora o que rola
 * de lado de propósito, o que corta com reticências e o texto só do leitor (1 px).
 */
export const transbordos = (alvo: Locator) => alvo.evaluate((raiz) =>
  [raiz, ...Array.from(raiz.querySelectorAll('div'))].flatMap((el) => {
    const e = getComputedStyle(el);
    if (el.clientWidth <= 1 || ['auto', 'scroll'].includes(e.overflowX) || e.textOverflow === 'ellipsis') return [];
    return el.scrollWidth > el.clientWidth + 1 ? [`${el.clientWidth} < ${el.scrollWidth}: ${(el.textContent ?? '').slice(0, 40)}`] : [];
  }));
