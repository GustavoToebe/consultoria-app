import { expect, test, type Page } from '@playwright/test';

import { abrirEditor } from './editor-questionario.dados';

/**
 * Editor de questionário em tela larga (`docs/design-e-front.md` 4.10, "editor com índice e prévia ao vivo"). A medida
 * é a da área do editor (janela menos o menu de 240 px, o recuo e a barra de rolagem): 1440 de janela fica abaixo de
 * 1280 de área (só o editor), 1600 cai no índice + editor e 1920 nas três colunas. Só dados fictícios.
 */
const indice = (page: Page) => page.getByRole('navigation', { name: 'Seções do questionário' });
const previa = (page: Page) => page.getByRole('complementary', { name: 'Prévia ao vivo' });

for (const largura of [390, 768, 1440]) {
  test(`${largura} px: nada muda, só o editor com as abas Editar e Prévia`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrirEditor(page, { qual: 'anamnese', largura });
    await expect(page.getByRole('heading', { name: 'Anamnese', level: 1 })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Prévia' })).toBeVisible();
    await expect(indice(page)).toHaveCount(0);
    await expect(previa(page)).toHaveCount(0);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('1440 px: o editor começa à esquerda, junto do menu, e a barra tem a largura do conteúdo', async ({ page }) => {
  await abrirEditor(page, { qual: 'anamnese', largura: 1440 });
  const nome = (await page.getByLabel('Nome do questionário').boundingBox())!;
  const barra = (await page.locator('#barra-do-editor').boundingBox())!;
  // Menu de 240 + recuo de 16 (+ o recuo do cartão): nada de faixa vazia à esquerda.
  expect(nome.x).toBeLessThan(240 + 16 + 40);
  expect(barra.x).toBeLessThanOrEqual(241);
  expect(barra.x + barra.width).toBeGreaterThan(1440 - 40);
});

test('1600 px: índice à esquerda e as abas continuam; sem prévia ao lado', async ({ page }) => {
  await abrirEditor(page, { qual: 'anamnese', largura: 1600 });
  await expect(indice(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Prévia' })).toBeVisible();
  await expect(previa(page)).toHaveCount(0);
  await expect(indice(page).getByRole('button', { name: 'Histórico de saúde, 12 perguntas' })).toBeVisible();
});

test('1920 px: três colunas, abas somem; o índice rola e abre a seção, marca a atual e a prévia acompanha o que se digita', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrirEditor(page, { qual: 'anamnese', largura: 1920 });
  await expect(indice(page)).toBeVisible();
  await expect(previa(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Prévia' })).toHaveCount(0);
  await expect(indice(page).getByRole('button', { name: 'Instruções' })).toHaveAttribute('aria-current', 'location');

  const treino = indice(page).getByRole('button', { name: 'Treino, 10 perguntas' });
  await treino.click();
  await expect(page.getByRole('button', { name: /^Pergunta 1: Treina há quanto tempo\?/ })).toHaveAccessibleName(/, aberto$/);
  await expect(treino).toHaveAttribute('aria-current', 'location');
  // A seção fica logo abaixo da barra fixa e o foco vai para o título dela.
  const secao = (await page.locator('#questionario-secao-2').boundingBox())!;
  const barra = (await page.locator('#barra-do-editor').boundingBox())!;
  expect(Math.abs(secao.y - (barra.y + barra.height))).toBeLessThan(40);
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('#questionario-secao-2') !== null)).toBe(true);
  // A anamnese é em páginas: a prévia foi para a página da seção.
  await expect(previa(page).getByText('Parte 3 de 6')).toBeVisible();

  await page.getByLabel('Texto da pergunta').first().fill('Treina há quantos anos?');
  await expect(previa(page).getByText('Treina há quantos anos?')).toBeVisible();

  // Rolar a página (roda do mouse sobre o editor) muda a seção marcada; no fim, a última.
  await page.waitForTimeout(600);
  await page.mouse.move(980, 600);
  const rotina = indice(page).getByRole('button', { name: /^Rotina e sono,/ });
  await expect.poll(async () => {
    await page.mouse.wheel(0, 900);
    return rotina.getAttribute('aria-current');
  }, { timeout: 20_000 }).toBe('location');
  await expect(treino).not.toHaveAttribute('aria-current', 'location');
  await page.evaluate(() => {
    let el: HTMLElement | null = document.getElementById('barra-do-editor');
    while (el && !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) el = el.parentElement;
    el!.scrollTop = el!.scrollHeight;
  });
  await expect(indice(page).getByRole('button', { name: /^Objetivos,/ })).toHaveAttribute('aria-current', 'location');
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('1920 px, Inscrição: a prévia ao vivo mostra os campos fixos antes das perguntas, sem os escondidos', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrirEditor(page, { qual: 'inscricao', largura: 1920 });
  await expect(previa(page).getByLabel('WhatsApp com DDD')).toBeVisible();
  await expect(previa(page).getByText('Como conheceu a consultoria?')).toHaveCount(0);
  await expect(previa(page).getByText('Já treina?')).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('1920 px, teclado: Enter no item do índice abre a seção e leva o foco ao título dela', async ({ page }) => {
  await abrirEditor(page, { qual: 'anamnese', largura: 1920 });
  const item = indice(page).getByRole('button', { name: 'Rotina e sono, 9 perguntas' });
  await item.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /^Pergunta 1: Que horas costuma acordar\?/ })).toHaveAccessibleName(/, aberto$/);
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('#questionario-secao-3') !== null)).toBe(true);
});

test('1920 px, Atualização (prévia sem páginas): o índice leva a prévia até a primeira pergunta da seção, na rolagem da coluna', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrirEditor(page, { qual: 'atualizacao', largura: 1920 });
  await expect(page.getByRole('heading', { name: 'Questionário de atualização', level: 1 })).toBeVisible();
  await expect(previa(page)).toBeVisible();
  await indice(page).getByRole('button', { name: 'Objetivos, 6 perguntas' }).click();
  await expect(previa(page).getByText('Qual seu objetivo principal?')).toBeInViewport();
  // A coluna rolou por dentro: o cabeçalho da prévia saiu de vista, e a prévia continua inteira na janela.
  await expect(previa(page).getByText('Prévia', { exact: true })).not.toBeInViewport();
  const caixa = (await previa(page).boundingBox())!;
  expect(caixa.y).toBeGreaterThanOrEqual(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('1600 px: tocar no índice com a aba Prévia aberta volta para Editar e rola até a seção', async ({ page }) => {
  await abrirEditor(page, { qual: 'anamnese', largura: 1600 });
  await page.getByRole('tab', { name: 'Prévia' }).click();
  await indice(page).getByRole('button', { name: 'Alimentação, 10 perguntas' }).click();
  await expect(page.getByRole('tab', { name: 'Editar' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#questionario-secao-4')).toBeInViewport();
});
