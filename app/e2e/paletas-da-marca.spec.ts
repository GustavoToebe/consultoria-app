import { expect, test, type Page } from '@playwright/test';

import type { Tema } from '../src/api/tipos';
import { PALETAS } from '../src/tema/tokens';
import { json, MARCA, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Paletas da marca (plano paletas-da-marca, passo 4): o `temaPadrao` da consultoria chega pelo login e pelo `/eu`, e o
 * treinador, que tem o tema "Da consultoria" por padrão, vê o app na paleta. Mede o contêiner raiz do app (`raiz-do-tema`,
 * em `app/_layout.tsx`, que pinta `cores.fundo`) e o `color-scheme` do documento: a amostra "Padrão da consultoria" das
 * Preferências pinta a mesma cor e não prova nada. A escolha da pessoa (Areia) vence a paleta da consultoria. Dados fictícios.
 */
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

async function abrirComPaleta(page: Page, temaPadrao: Tema, preferencia?: 'AREIA') {
  const marca = { ...MARCA, temaPadrao };
  const base = await sessao(page, TREINADOR, { marca });
  const login = base['POST /auth/refresh'];
  if (preferencia) {
    await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, preferencia]);
  }
  await simularApi(page, {
    ...base,
    'POST /auth/refresh': (_p, route) => json(route, { ...(login as { corpo: object }).corpo, marca }),
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/treinador/ajustes');
  await expect(page.getByText('Padrão da consultoria').first()).toBeVisible();
}

const fundoDaRaiz = (page: Page) => page.getByTestId('raiz-do-tema').evaluate((e) => getComputedStyle(e).backgroundColor);
const esquema = (page: Page) => page.evaluate(() => document.documentElement.style.colorScheme);

for (const [codigo, esperado] of [['AMEIXA', 'dark'], ['LAVANDA', 'light'], ['AREIA', 'light']] as const) {
  test(`paleta ${codigo} da consultoria: a raiz do app pinta o fundo dela e o esquema é ${esperado}`, async ({ page }) => {
    await abrirComPaleta(page, codigo);
    await expect.poll(() => fundoDaRaiz(page)).toBe(rgb(PALETAS[codigo].cores.fundo));
    await expect.poll(() => esquema(page)).toBe(esperado);
  });
}

test('a escolha da pessoa (Areia) vence a paleta escura da consultoria', async ({ page }) => {
  await abrirComPaleta(page, 'AMEIXA', 'AREIA');
  await expect.poll(() => fundoDaRaiz(page)).toBe(rgb(PALETAS.AREIA.cores.fundo));
  await expect.poll(() => esquema(page)).toBe('light');
});
