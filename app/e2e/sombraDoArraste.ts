import { expect, type Locator, type Page } from '@playwright/test';

type Caixa = { x: number; y: number; w: number; h: number };

/**
 * Confere a cópia do arraste (a "sombra", `ui/arrasteNaWeb`) contra a linha de origem (26/11: ela saía deslocada para
 * cima e para o lado). Segura a alça, passa dos 4 px que começam o arraste e mede: a cópia tem o tamanho da linha e
 * está onde a linha estaria se andasse o mesmo que o ponteiro desde o ponto de pega (±1 px). Depois anda `passo` e a
 * cópia anda exatamente o mesmo. A origem é a caixa que a camada deixou invisível (opacidade 0). Solta com Esc (nada
 * muda). O ponteiro fica longe das bordas (a rolagem automática começa a 48 px delas).
 */
export async function conferirSombra(page: Page, alca: Locator, inicio: { x: number; y: number }, passo: { x: number; y: number }) {
  await alca.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await page.waitForTimeout(300);
  const a = (await alca.boundingBox())!;
  const x0 = a.x + a.width / 2;
  const y0 = a.y + a.height / 2;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 + 1, y0 + 1);
  await page.mouse.move(x0 + inicio.x, y0 + inicio.y);
  const copia = page.locator('[data-copia-do-arraste]');
  await expect(copia).toHaveCount(1);
  const caixa = (l: Locator) => l.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const origem = await alca.evaluate((el) => {
    let p: HTMLElement | null = el as HTMLElement;
    while (p && p.style.opacity !== '0') p = p.parentElement;
    const r = p!.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  const perto = (c: Caixa, esperado: Caixa) => {
    for (const k of ['x', 'y', 'w', 'h'] as const) expect(Math.abs(c[k] - esperado[k]), `${k}: ${c[k]} × ${esperado[k]}`).toBeLessThanOrEqual(1);
  };
  const primeira = await caixa(copia);
  perto(primeira, { ...origem, x: origem.x + inicio.x, y: origem.y + inicio.y });
  await page.mouse.move(x0 + inicio.x + passo.x, y0 + inicio.y + passo.y, { steps: 4 });
  perto(await caixa(copia), { ...primeira, x: primeira.x + passo.x, y: primeira.y + passo.y });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(copia).toHaveCount(0);
}
