import { expect, test, type Locator, type Page } from '@playwright/test';

import { abrirLesoes, CENAS } from './lesoes-falsas';

/**
 * ficha: tabela com linha tingida (24/11, `docs/planos/tabela-linha-tingida.md`). A `ui/Tabela` recorta pelo próprio raio,
 * a linha tingida (a lesão ativa) não leva borda própria (só o fundo; o fio entre duas linhas é o de baixo da de cima, sempre
 * a divisória, borda neutra desde 26/11) e o ⋯ fica na altura da primeira linha de texto. As ativas vêm sempre
 * primeiro: com recuperadas embaixo só nas colunas largas. A tabela (colunas) só cabe a partir de 760 px na própria lista: em 1280 e 1920 ela fica
 * embaixo das duas colunas da aba Dados (tela larga 24/11, pedido de 24/11 à noite) e em 390 vira cartões. Só dados fictícios, API simulada.
 */

const lado = (el: Locator, ...lados: ('Top' | 'Right' | 'Bottom' | 'Left')[]) =>
  el.evaluate((e, ls) => ls.map((l) => parseFloat(getComputedStyle(e)[`border${l}Width` as 'borderTopWidth'])), lados);
const corDoFio = (el: Locator) => el.evaluate((e) => getComputedStyle(e).borderBottomColor);

/**
 * Diferença vertical entre o centro do ⋯ e o da primeira linha de texto (o nome da região). Mede a primeira linha pela
 * altura de linha: na coluna de 1400 px (tela larga, 24/11) o nome pode quebrar em duas.
 */
async function desvioDoMais(page: Page, linha: Locator, regiao: string) {
  const nome = linha.getByText(regiao, { exact: true });
  const texto = (await nome.boundingBox())!;
  const altura = await nome.evaluate((e) => parseFloat(getComputedStyle(e).lineHeight) || e.getBoundingClientRect().height);
  const mais = (await page.getByRole('button', { name: `Mais ações da lesão em ${regiao}` }).boundingBox())!;
  return Math.abs(mais.y + mais.height / 2 - (texto.y + Math.min(altura, texto.height) / 2));
}

test('1920px: ativa como última linha da tabela, sem borda própria, ⋯ na altura da primeira linha de texto', async ({ page }) => {
  const { errosDaPagina } = await abrirLesoes(page, 1920, 'CLARO', CENAS.ultima);
  const caixa = page.getByRole('table', { name: 'Lesões' });
  await expect(caixa).toBeVisible();
  const linha = (regiao: string) => page.getByRole('row').filter({ hasText: regiao });
  const ultima = linha('Cotovelo esquerdo');
  expect(await ultima.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  // A caixa recorta o fundo pelo próprio raio e é a única dona da borda lateral e da de baixo.
  expect(await caixa.evaluate((e) => { const c = getComputedStyle(e); return [c.overflow, parseFloat(c.borderTopLeftRadius) > 0]; })).toEqual(['hidden', true]);
  expect((await lado(caixa, 'Left'))[0]).toBeGreaterThan(0);
  expect(await lado(ultima, 'Top', 'Right', 'Bottom', 'Left')).toEqual([0, 0, 0, 0]);
  expect(await lado(linha('Ombro direito'), 'Right', 'Left')).toEqual([0, 0]);
  // O fio entre as duas ativas é um só (o de baixo da primeira) e é a divisória (borda neutra, 26/11).
  expect((await lado(linha('Ombro direito'), 'Bottom'))[0]).toBe(1);
  expect(await desvioDoMais(page, ultima, 'Cotovelo esquerdo')).toBeLessThanOrEqual(4);
  expect(errosDaPagina).toEqual([]);
});

test('1920px: ativa no meio (ativa, ativa, recuperadas): um fio por divisão, sempre a divisória (borda neutra)', async ({ page }) => {
  const { errosDaPagina } = await abrirLesoes(page, 1920, 'ESCURO', CENAS.meio);
  await expect(page.getByRole('table', { name: 'Lesões' })).toBeVisible();
  const linha = (regiao: string) => page.getByRole('row').filter({ hasText: regiao });
  for (const r of ['Ombro direito', 'Cotovelo esquerdo', 'Joelho esquerdo', 'Punho direito']) {
    expect(await lado(linha(r), 'Top', 'Right', 'Left')).toEqual([0, 0, 0]);
  }
  expect(await lado(linha('Ombro direito'), 'Bottom')).toEqual([1]);
  expect(await lado(linha('Cotovelo esquerdo'), 'Bottom')).toEqual([1]);
  expect(await lado(linha('Joelho esquerdo'), 'Bottom')).toEqual([1]);
  expect(await lado(linha('Punho direito'), 'Bottom')).toEqual([0]);
  // Desde 26/11 a borda do pintado é neutra: todos os fios têm a cor da divisória, ao redor da ativa e entre as recuperadas.
  expect(await corDoFio(linha('Ombro direito'))).toBe(await corDoFio(linha('Cotovelo esquerdo')));
  expect(await corDoFio(linha('Joelho esquerdo'))).toBe(await corDoFio(linha('Ombro direito')));
  expect(await linha('Joelho esquerdo').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  expect(await desvioDoMais(page, linha('Ombro direito'), 'Ombro direito')).toBeLessThanOrEqual(4);
  expect(errosDaPagina).toEqual([]);
});

test('390px: a ativa é um cartão com a borda inteira tingida e o ⋯ na altura do nome', async ({ page }) => {
  const { errosDaPagina } = await abrirLesoes(page, 390, 'CLARO', CENAS.ultima);
  const lista = page.getByRole('list', { name: 'Lesões' });
  await expect(lista).toBeVisible();
  const cartao = lista.locator('xpath=./div').filter({ hasText: 'Cotovelo esquerdo' });
  expect(await lado(cartao, 'Top', 'Right', 'Bottom', 'Left')).toEqual([1, 1, 1, 1]);
  expect(await cartao.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  expect(await desvioDoMais(page, cartao, 'Cotovelo esquerdo')).toBeLessThanOrEqual(4);
  expect(errosDaPagina).toEqual([]);
});

// ficha: folha de lesão (24/11), parte da tabela do Histórico: colunas Região, O que é, Período e Situação, e os
// "Cuidados no treino" com rótulo logo abaixo do "O que é" (a observação da lesão).
test('1920px: colunas Região, O que é, Período e Situação; "Cuidados no treino" abaixo do "O que é"', async ({ page }) => {
  const { errosDaPagina } = await abrirLesoes(page, 1920, 'CLARO', CENAS.ultima);
  const caixa = page.getByRole('table', { name: 'Lesões' });
  await expect(caixa).toBeVisible();
  await expect(caixa.getByRole('columnheader').filter({ hasText: /\S/ })).toHaveText(['Região', 'O que é', 'Período', 'Situação']);
  const linha = page.getByRole('row').filter({ hasText: 'Ombro direito' });
  const oQueE = (await linha.getByText('Tendinite', { exact: true }).boundingBox())!;
  const cuidados = (await linha.getByLabel('Cuidados no treino: Evitar desenvolvimento acima da cabeça.').boundingBox())!;
  expect(cuidados.y).toBeGreaterThan(oQueE.y + oQueE.height - 1);
  expect(Math.abs(cuidados.x - oQueE.x)).toBeLessThan(2);
  await expect(linha.getByText('Cuidados no treino:')).toBeVisible();
  await expect(page.getByText('Observação:')).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('390px: o cartão da lesão traz "O que é" e os "Cuidados no treino"', async ({ page }) => {
  const { errosDaPagina } = await abrirLesoes(page, 390, 'CLARO', CENAS.ultima);
  const cartao = page.getByRole('list', { name: 'Lesões' }).locator('xpath=./div').filter({ hasText: 'Ombro direito' });
  await expect(cartao.getByText('O que é', { exact: true })).toBeVisible();
  await expect(cartao.getByText('Cuidados no treino:')).toBeVisible();
  await expect(cartao.getByText('Descrição', { exact: true })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});
