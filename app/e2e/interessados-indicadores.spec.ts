import { expect, test, type Page } from '@playwright/test';

import type { IndicadoresInscricoes } from '../src/api/inscricoesTipos';
import { erroApi, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { resumoFalso, rotasDaTela } from './inscricoes-falsas';

/**
 * Interessados (F14 e F15 de 12/11): trocar de visão não monta a tela de novo (o link de inscrição e os responsáveis são
 * lidos uma vez só), os oito indicadores em 4, 2 ou 1 coluna sem rolagem lateral, o glossário "Como contamos" em pares
 * termo e explicação, os "Limites dos dados" e a falha dos indicadores. Só dados fictícios.
 */

const INDICADORES: IndicadoresInscricoes = {
  de: '2026-09-30', ate: '2026-10-29', entradas: 12, pessoas: 11, aceites: 3, recusadas: 2, desistencias: 1, reaberturas: 1,
  aceitesDasEntradas: 2, conversao: 2 / 12, diasAteAceite: { mediana: 4, media: 5.5 },
  porMotivo: [],
  porOrigem: [{ origem: 'INSTAGRAM', entradas: 8, aceites: 2 }, { origem: 'INDICACAO', entradas: 4, aceites: 1 }],
};

async function abrir(page: Page, extra: RespostasApi = {}, caminho = '/treinador/interessados') {
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...rotasDaTela(),
    'GET /inscricoes': { corpo: { itens: [resumoFalso(1), resumoFalso(2)], total: 2 } },
    'GET /inscricoes/indicadores': { corpo: INDICADORES },
    ...extra,
  });
  await page.goto(caminho);
  await expect(page.getByRole('heading', { name: 'Interessados', level: 1 })).toBeVisible();
  return api;
}

test('trocar Lista, Kanban, Indicadores e Lista não busca o link de inscrição nem os responsáveis de novo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { pedidos, naoTratadas, errosDaPagina } = await abrir(page);
  await expect(page.getByText('Recebendo inscrições')).toBeVisible();
  const lidos = (caminho: string) => pedidos.filter((p) => p.metodo === 'GET' && p.caminho === caminho).length;
  await page.getByRole('tab', { name: 'Kanban' }).click();
  await expect(page.getByRole('tab', { name: 'Kanban' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Indicadores' }).click();
  await expect(page.getByText('Dias até o aceite (mediana)')).toBeVisible();
  await page.getByRole('tab', { name: 'Lista' }).click();
  await expect(page.getByRole('tab', { name: 'Lista' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Recebendo inscrições')).toBeVisible();
  await expect(page.getByLabel('Carregando o link de inscrição')).toHaveCount(0);
  expect(lidos('/inscricoes/configuracao')).toBe(1);
  expect(lidos('/responsaveis')).toBe(1);
  // A visão continua no endereço (o link de fora abre na visão certa).
  await page.getByRole('tab', { name: 'Kanban' }).click();
  await expect(page).toHaveURL(/visao=kanban/);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

/** Posição dos rótulos dos indicadores (o primeiro de cada texto: o glossário vem depois e repete os termos). */
async function posicoes(page: Page, rotulos: string[]) {
  const caixas = [];
  for (const r of rotulos) caixas.push((await page.getByText(r, { exact: true }).first().boundingBox())!);
  return caixas;
}

for (const [largura, colunas] of [[1920, 4], [1280, 4], [900, 2], [390, 1]] as const) {
  test(`indicadores em ${largura}px: ${colunas} por linha, sem rolagem lateral, glossário e limites`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { naoTratadas, errosDaPagina } = await abrir(page, {}, '/treinador/interessados?visao=indicadores');
    await expect(page.getByText('Dias até o aceite (mediana)')).toBeVisible();
    // Período e intervalo efetivo juntos.
    await expect(page.getByText('De 30/09/2026 a 29/10/2026')).toBeVisible();
    const ordem = ['Entradas', 'Pessoas', 'Aceites', 'Conversão das entradas', 'Dias até o aceite (mediana)', 'Recusadas', 'Desistências', 'Reaberturas'];
    const caixas = await posicoes(page, ordem);
    const naLinhaDaPrimeira = caixas.filter((c) => Math.abs(c.y - caixas[0].y) < 2).length;
    expect(naLinhaDaPrimeira).toBe(colunas);
    // Nunca três por linha: a segunda linha começa alinhada à primeira.
    expect(Math.abs(caixas[colunas % 8].x - caixas[0].x)).toBeLessThan(2);
    for (const c of caixas) expect(c.x + c.width).toBeLessThanOrEqual(largura);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    // Conversão com a conta ao lado da porcentagem; zero do período é zero, não "—".
    await expect(page.getByText('2 de 12 já viraram aluno')).toBeVisible();
    await expect(page.getByText('Nenhuma recusa ou desistência no período.')).toBeVisible();
    // Glossário: pares termo e explicação, sem passos numerados; duas colunas no PC, uma no celular.
    await expect(page.getByText('Como contamos', { exact: true })).toBeVisible();
    const entrada = (await page.getByText(/^Inscrições recebidas no período/).boundingBox())!;
    const pessoa = (await page.getByText(/^Pessoas diferentes entre essas entradas/).boundingBox())!;
    if (largura >= 1280) expect(Math.abs(entrada.y - pessoa.y)).toBeLessThan(2);
    else if (largura === 390) expect(pessoa.y).toBeGreaterThan(entrada.y + entrada.height - 1);
    await expect(page.getByText(/^\d+\.\s/)).toHaveCount(0);
    await expect(page.getByText('Limites dos dados', { exact: true })).toBeVisible();
    await expect(page.getByText(/apagadas pela retenção/)).toBeVisible();
    await expect(page.getByText(/quer dizer sem dado/)).toBeVisible();
    if (process.env.CAPTURAS) {
      await page.screenshot({ path: `${process.env.CAPTURAS}/interessados-indicadores-${largura}.png` });
      await page.getByText('Limites dos dados', { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${process.env.CAPTURAS}/interessados-glossario-${largura}.png` });
    }
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('indicadores com o texto extra grande em 1280px: duas por linha, nunca três', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tamanhoTexto: 'EXTRA' })), TREINADOR.id);
  await abrir(page, {}, '/treinador/interessados?visao=indicadores');
  await expect(page.getByText('Dias até o aceite (mediana)')).toBeVisible();
  const caixas = await posicoes(page, ['Entradas', 'Pessoas', 'Aceites']);
  expect(Math.abs(caixas[1].y - caixas[0].y)).toBeLessThan(2);
  expect(caixas[2].y).toBeGreaterThan(caixas[0].y + 10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/interessados-indicadores-1280-texto-extra.png` });
});

test('indicadores que falharam: mensagem com Tentar de novo, sem números inventados', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  let falhar = true;
  const { pedidos } = await abrir(page, {
    'GET /inscricoes/indicadores': (_p, route) => route.fulfill(falhar
      ? { status: 500, contentType: 'application/json', body: JSON.stringify(erroApi(500, 'Falha.').corpo) }
      : { contentType: 'application/json', body: JSON.stringify(INDICADORES) }),
  }, '/treinador/interessados?visao=indicadores');
  const tentar = page.getByRole('button', { name: 'Tentar de novo' });
  await expect(tentar).toBeVisible();
  await expect(page.getByText('Dias até o aceite (mediana)')).toHaveCount(0);
  falhar = false;
  const antes = pedidos.filter((p) => p.caminho === '/inscricoes/indicadores').length;
  await tentar.click();
  await expect.poll(() => pedidos.filter((p) => p.caminho === '/inscricoes/indicadores').length).toBeGreaterThan(antes);
  await expect(page.getByText('Dias até o aceite (mediana)')).toBeVisible();
});
