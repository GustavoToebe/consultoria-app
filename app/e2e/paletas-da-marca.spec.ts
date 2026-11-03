import { expect, test, type Page } from '@playwright/test';

import type { Tema } from '../src/api/tipos';
import { PALETAS } from '../src/tema/tokens';
import { MARCA, json, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Paletas da marca (plano paletas-da-marca, passo 4): o `temaPadrao` da consultoria chega pelo login e pelo `/eu`, e o
 * treinador, que tem o tema "Da consultoria" por padrão, vê o app na paleta (cor de fundo). A tela Marca
 * (escolher a paleta) é do passo 5. Dados fictícios.
 */
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

async function abrirComPaleta(page: Page, temaPadrao: Tema) {
  const marca = { ...MARCA, temaPadrao };
  const base = await sessao(page, TREINADOR, { marca });
  const login = base['POST /auth/refresh'];
  const api = await simularApi(page, {
    ...base,
    'POST /auth/refresh': (_p, route) => json(route, { ...(login as { corpo: object }).corpo, marca }),
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/treinador/ajustes');
  await expect(page.getByText('Padrão da consultoria').first()).toBeVisible();
  return api;
}

const temFundo = (page: Page, cor: string) =>
  page.evaluate((c) => [...document.querySelectorAll('div')].some((e) => getComputedStyle(e).backgroundColor === c), cor);

for (const [codigo, esperado] of [['AMEIXA', 'ESCURO'], ['LAVANDA', 'CLARO'], ['AREIA', 'CLARO']] as const) {
  test(`paleta ${codigo} da consultoria: o app abre no fundo dela, em modo ${esperado.toLowerCase()}`, async ({ page }) => {
    await abrirComPaleta(page, codigo);
    const { cores, modo } = PALETAS[codigo];
    expect(modo).toBe(esperado);
    await expect.poll(() => temFundo(page, rgb(cores.fundo))).toBe(true);
  });
}
