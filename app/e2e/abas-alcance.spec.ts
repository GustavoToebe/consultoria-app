import { expect, test, type Locator } from '@playwright/test';

import { paginaDeExerciciosFalsa, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Abas que não cabem no celular (Biblioteca: "Copiar do catálogo pronto" fica cortada em 390 px): dá para rolar até a
 * última e vê-la inteira, e a borda esmaecida avisa que há mais. Só dados fictícios.
 */
const ESMAECIDO = 28;

/** Caixa da aba na rolagem horizontal que a contém, a rolagem e o esmaecido (filho `pointer-events: none` da área). */
function medir(aba: Locator) {
  return aba.evaluate((e, largura) => {
    let rolagem: HTMLElement | null = e.parentElement;
    while (rolagem && !['auto', 'scroll'].includes(getComputedStyle(rolagem).overflowX)) rolagem = rolagem.parentElement;
    const a = e.getBoundingClientRect();
    const r = rolagem!.getBoundingClientRect();
    const dicas = [...rolagem!.parentElement!.children].filter((c) => c !== rolagem && getComputedStyle(c).pointerEvents === 'none' && Math.round(c.getBoundingClientRect().width) === largura);
    return { esquerda: a.left - r.left, direita: r.right - a.right, rolou: rolagem!.scrollLeft, sobra: rolagem!.scrollWidth - rolagem!.clientWidth, dicas: dicas.length };
  }, ESMAECIDO);
}

for (const tema of ['CLARO', 'ESCURO'] as const) {
  test(`390px (${tema.toLowerCase()}): rola até a última aba e a vê inteira, com a pista de que há mais`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema]);
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'ERGOGENICO_LER'] })),
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /exercicios/pagina': paginaDeExerciciosFalsa([]),
      'GET /exercicios': { corpo: [] },
      'GET /catalogo/exercicios/grupos': { corpo: [] },
      'GET /catalogo/exercicios': { corpo: { itens: [], total: 0 } },
    });
    await page.goto('/treinador/biblioteca');
    const primeira = page.getByRole('tab', { name: 'Exercícios', exact: true });
    const ultima = page.getByRole('tab', { name: 'Copiar do catálogo pronto', exact: true });
    await expect(primeira).toHaveAttribute('aria-selected', 'true');

    // Aberta: a última passa da borda direita e a borda esmaecida da direita está lá.
    const inicio = await medir(ultima);
    expect(inicio.sobra).toBeGreaterThan(0);
    expect(inicio.direita).toBeLessThan(0);
    expect(inicio.dicas).toBe(1);

    // Rolando até o fim (arrasto no celular), a última cabe inteira e a pista da direita sai.
    await primeira.evaluate((e) => {
      let rolagem: HTMLElement | null = e.parentElement;
      while (rolagem && !['auto', 'scroll'].includes(getComputedStyle(rolagem).overflowX)) rolagem = rolagem.parentElement;
      rolagem!.scrollLeft = rolagem!.scrollWidth;
    });
    await expect.poll(async () => (await medir(ultima)).direita).toBeGreaterThanOrEqual(-0.5);
    const fim = await medir(ultima);
    expect(fim.esquerda).toBeGreaterThanOrEqual(0);
    expect(fim.dicas).toBe(1); // sobrou a da esquerda: a da direita saiu

    // O toque na última a seleciona (e ela continua inteira, fora do esmaecido).
    await ultima.click();
    await expect(ultima).toHaveAttribute('aria-selected', 'true');
    await expect.poll(async () => (await medir(ultima)).direita).toBeGreaterThanOrEqual(-0.5);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
