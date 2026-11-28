import { expect, test, type Page } from '@playwright/test';

import { abrirEditor, ANAMNESE } from './editor-questionario.dados';

/**
 * Editor de questionário em tela larga (`docs/design-e-front.md` 4.10, "editor com índice e prévia ao vivo"). A medida
 * é a da área do editor (janela menos o menu de 240 px, o recuo e a barra de rolagem): 1280 de janela fica abaixo de
 * 1000 de área (só o editor), 1536 (notebook a 125%) cai no índice + editor e 1920 e 3440 nas três colunas. Só dados fictícios.
 */
const indice = (page: Page) => page.getByRole('navigation', { name: 'Seções do questionário' });
const previa = (page: Page) => page.getByRole('complementary', { name: 'Prévia ao vivo' });

for (const largura of [390, 768, 1280]) {
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

test('1280 px: o editor começa à esquerda, junto do menu, e a barra tem a largura do conteúdo', async ({ page }) => {
  await abrirEditor(page, { qual: 'anamnese', largura: 1280 });
  const nome = (await page.getByLabel('Nome do questionário').boundingBox())!;
  const barra = (await page.locator('#barra-do-editor').boundingBox())!;
  // Menu de 240 + recuo de 16 (+ o recuo do cartão): nada de faixa vazia à esquerda.
  expect(nome.x).toBeLessThan(240 + 16 + 40);
  expect(barra.x).toBeLessThanOrEqual(241);
  expect(barra.x + barra.width).toBeGreaterThan(1280 - 40);
});

test('1536 px: índice à esquerda e as abas continuam; sem prévia ao lado', async ({ page }) => {
  await abrirEditor(page, { qual: 'anamnese', largura: 1536 });
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
  // A seção fica logo abaixo da barra fixa (a 8 px, partindo do topo da página, com a barra ainda não grudada) e o foco
  // vai para o título dela.
  const secao = (await page.locator('#questionario-secao-2').boundingBox())!;
  const barra = (await page.locator('#barra-do-editor').boundingBox())!;
  expect(Math.abs(secao.y - (barra.y + barra.height) - 8)).toBeLessThanOrEqual(2);
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
  await expect(previa(page).getByText('Prévia · como o aluno vê o rascunho', { exact: true })).not.toBeInViewport();
  const caixa = (await previa(page).boundingBox())!;
  expect(caixa.y).toBeGreaterThanOrEqual(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('1536 px: tocar no índice com a aba Prévia aberta volta para Editar e rola até a seção', async ({ page }) => {
  await abrirEditor(page, { qual: 'anamnese', largura: 1536 });
  await page.getByRole('tab', { name: 'Prévia' }).click();
  await indice(page).getByRole('button', { name: 'Alimentação, 10 perguntas' }).click();
  await expect(page.getByRole('tab', { name: 'Editar' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#questionario-secao-4')).toBeInViewport();
});

/**
 * Regra das colunas (28/11, `colunasComPrevia`): índice de 260 encostado à esquerda, vãos fixos de 24, editor até 1400 e
 * prévia de 440 a 720; o editor cresce primeiro, depois a prévia, e a sobra fica no fim da linha (nunca entre as colunas).
 */
async function medirColunas(page: Page) {
  const [i, p, c] = [(await indice(page).boundingBox())!, (await previa(page).boundingBox())!, (await page.locator('#barra-do-editor').locator('xpath=..').boundingBox())!];
  const editor = (await page.locator('#questionario-instrucoes').boundingBox())!;
  const [vao1, vao2] = [editor.x - (i.x + i.width), p.x - (editor.x + editor.width)];
  expect(Math.abs(i.x - c.x)).toBeLessThanOrEqual(1);
  expect(Math.round(i.width)).toBe(260);
  expect(Math.round(vao1)).toBe(24);
  expect(Math.round(vao2)).toBe(24);
  expect(p.width).toBeGreaterThanOrEqual(439);
  expect(p.width).toBeLessThanOrEqual(721);
  expect(editor.width).toBeLessThanOrEqual(1401);
  // A prévia só passa de 440 com o editor no máximo.
  if (p.width > 441) expect(Math.round(editor.width)).toBe(1400);
  return { i, editor, p, c };
}

for (const largura of [1920, 2560]) {
  test(`${largura} px: índice de 260 à esquerda, vãos de 24 e o editor cresce antes da prévia`, async ({ page }) => {
    await abrirEditor(page, { qual: 'anamnese', largura, altura: 1200 });
    await expect(previa(page)).toBeVisible();
    await medirColunas(page);
  });
}

test('3440 px: editor em 1400, prévia em 720 e a sobra no fim da linha, à direita da prévia', async ({ page }) => {
  await abrirEditor(page, { qual: 'anamnese', largura: 3440, altura: 1440 });
  await expect(previa(page)).toBeVisible();
  const { editor, p, c } = await medirColunas(page);
  expect(Math.round(editor.width)).toBe(1400);
  expect(Math.round(p.width)).toBe(720);
  expect(c.x + c.width - (p.x + p.width)).toBeGreaterThan(24);
});

test('1920 px: o índice traz o resumo, a situação e os problemas, e o link do problema leva até a pergunta', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrirEditor(page, { qual: 'anamnese', largura: 1920 });
  await expect(indice(page).getByTestId('resumo-do-questionario')).toHaveText(/^\d+ perguntas · \d+ seções · (\d+ obrigatórias?|nenhuma obrigatória)$/);
  await expect(indice(page).getByTestId('situacao-do-questionario')).toHaveText(/^(Publicado v\d+ · (rascunho com alterações|sem alterações)|Ainda não publicado)$/);
  await expect(indice(page).getByRole('link', { name: /pergunta sem texto/ })).toHaveCount(0);
  // Apagar o texto de uma pergunta vira problema ao vivo, com o link.
  await indice(page).getByRole('button', { name: 'Treino, 10 perguntas' }).click();
  await page.getByLabel('Texto da pergunta').first().fill('');
  const link = indice(page).getByRole('link', { name: '1 pergunta sem texto. Ir até o problema' });
  await expect(link).toBeVisible();
  await indice(page).getByRole('button', { name: 'Instruções' }).click();
  await link.click();
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[id^="questionario-pergunta-"]') !== null)).toBe(true);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('1920 px, Inscrição: "Seu contato" com os campos fixos antes das seções leva a prévia até eles', async ({ page }) => {
  // Rascunho longo (o da anamnese), para a última seção levar a prévia para longe dos campos fixos.
  const { naoTratadas, errosDaPagina } = await abrirEditor(page, { qual: 'inscricao', largura: 1920, rascunho: ANAMNESE });
  // O fixture esconde só a Origem: o cartão "Seu contato" tem Nome, WhatsApp, E-mail e Instagram.
  const contato = indice(page).getByRole('button', { name: 'Seu contato, 4 campos fixos' });
  await expect(contato).toBeVisible();
  // Antes, a última seção: a prévia rola para longe dos campos fixos, e "Seu contato" precisa trazê-los de volta.
  await indice(page).getByRole('button', { name: /, (\d+ perguntas?|Sem pergunta)$/ }).last().click();
  await expect(previa(page).getByLabel('WhatsApp com DDD')).not.toBeInViewport();
  await contato.click();
  await expect(previa(page).getByLabel('WhatsApp com DDD')).toBeInViewport();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
