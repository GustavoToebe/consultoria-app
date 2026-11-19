import { expect, test, type Page } from '@playwright/test';

import type { NumerosDaConsultoria } from '../src/api/tipos';
import { erroApi, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Números (plano larguras-das-telas, decisão 2; números (19/11)): indicadores no topo (4 por linha, 2 + 2 ou 1), mês em
 * MM/AAAA e duas colunas no PC largo, "Mês a mês" à esquerda e "Equipe hoje" com "Como contamos" (recolhido) logo
 * abaixo à direita; mais estreito empilham nessa ordem e no celular as tabelas viram cartões. Nada rola na horizontal.
 * Contagens e nomes de membros fictícios.
 */
const NUMEROS: NumerosDaConsultoria = {
  meses: ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'].map((mes, i) => ({
    mes, parcial: i === 5, alunosAtivos: 30 + i, atualizacoesNoPrazo: 20 + i, atualizacoesAtrasadas: i === 0 ? null : i,
  })),
  equipe: [
    { usuarioId: 'u1', nome: 'Ana Fictícia', alunosAtivos: 32, limiteDeAlunos: 30, atualizacoesAtrasadas: 2, atualizacoesParaRevisar: 5 },
    { usuarioId: 'u2', nome: 'Bia Exemplo', alunosAtivos: 4, limiteDeAlunos: null, atualizacoesAtrasadas: 0, atualizacoesParaRevisar: 1 },
    { usuarioId: 'u3', nome: 'Carolina Nome Muito Comprido de Exemplo da Silva Fictícia', alunosAtivos: 30, limiteDeAlunos: 30, atualizacoesAtrasadas: 0, atualizacoesParaRevisar: 0 },
  ],
  semResponsavel: { alunosAtivos: 3, atualizacoesAtrasadas: 0, atualizacoesParaRevisar: 1 },
};
const SEM_EQUIPE: NumerosDaConsultoria = { ...NUMEROS, equipe: null, semResponsavel: null };

const MESES = 'Alunos ativos e atualizações de cada mês';
const EQUIPE = 'Alunos e atualizações de cada membro da equipe';
const REGRAS = /^Como contamos/;

async function abrir(page: Page, largura: number, altura: number, opcoes: { numeros?: NumerosDaConsultoria; tamanhoTexto?: string; tema?: 'CLARO' | 'ESCURO' } = {}) {
  const { numeros = NUMEROS, tamanhoTexto, tema } = opcoes;
  await page.setViewportSize({ width: largura, height: altura });
  if (tamanhoTexto || tema) {
    const preferencias = { ...(tamanhoTexto ? { tamanhoTexto } : {}), ...(tema ? { tema } : {}) };
    await page.addInitScript(([id, p]) => localStorage.setItem(`treinos:${id}:preferencias`, p), [TREINADOR.id, JSON.stringify(preferencias)]);
  }
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'EQUIPE_LER'] })),
    'GET /numeros': { corpo: numeros },
    // O menu conta os interessados novos.
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
  });
  await page.goto('/treinador/numeros');
  await expect(page.getByRole('heading', { name: 'Números', level: 1 })).toBeVisible();
  await expect(page.getByText('Mês a mês', { exact: true })).toBeVisible();
  return { naoTratadas, errosDaPagina };
}

const caixa = async (page: Page, rotulo: string) => {
  const c = await page.getByLabel(rotulo).boundingBox();
  if (!c) throw new Error(`${rotulo} sem caixa`);
  return c;
};
const caixaDasRegras = async (page: Page) => {
  const c = await page.getByRole('button', { name: REGRAS }).boundingBox();
  if (!c) throw new Error('Como contamos sem caixa');
  return c;
};

/** Nem a página nem as tabelas rolam ou cortam na horizontal, e nenhum título de coluna passa da própria célula. */
async function semRolagemHorizontal(page: Page, rotulos = [MESES, EQUIPE]) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const rotulo of rotulos) {
    const tabela = page.getByLabel(rotulo);
    expect(await tabela.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
    // Pela caixa do próprio texto (Range): alinhado à direita, o que vaza sai pela esquerda e o scrollWidth não conta.
    // Compara vizinhos, que precisam de 4 px entre si: o espaço no fim de uma linha quebrada passa um pouco da célula,
    // mas não chega a isso.
    const encostados = await tabela.locator('[role="columnheader"]').evaluateAll((els) => {
      const caixas = els.map((celula) => {
        const faixa = document.createRange();
        faixa.selectNodeContents(celula);
        return { texto: celula.textContent, caixa: faixa.getBoundingClientRect() };
      }).filter((c) => c.caixa.width > 0);
      return caixas.slice(1).map((c, i) => [caixas[i], c]).filter(([a, b]) => a.caixa.right + 4 > b.caixa.left).map(([a, b]) => `${a.texto} | ${b.texto}`);
    });
    expect(encostados).toEqual([]);
  }
}

/** Topo (y) de cada cartão de indicador, pelo rótulo acessível "rótulo: valor". */
const topos = async (page: Page, rotulos: RegExp[]) => Promise.all(rotulos.map(async (r) => (await page.getByLabel(r).first().boundingBox())!.y));
const INDICADORES = [/^Alunos ativos hoje: /, /^No prazo no mês atual: /, /^Atrasadas: /, /^Para revisar: /];

// números (19/11): o que mudou na tela, numa largura de PC comum.
test('indicadores, mês em MM/AAAA, "Sem responsável" alinhado e "Como contamos" fechado até abrir', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280, 900);
  // Mês atual (11/2026): 35 ativos, 25 no prazo de 30, 5 atrasadas; para revisar 5 + 1 + 0 + 1.
  await expect(page.getByLabel('Alunos ativos hoje: 35')).toBeVisible();
  await expect(page.getByLabel('No prazo no mês atual: 83,3%. 25 de 30 atualizações')).toBeVisible();
  await expect(page.getByLabel('Atrasadas: 5. No mês atual')).toBeVisible();
  await expect(page.getByLabel('Para revisar: 7. Hoje, somando a equipe')).toBeVisible();
  // 4 por linha em 1280.
  const y = await topos(page, INDICADORES);
  expect(Math.max(...y) - Math.min(...y)).toBeLessThan(2);
  const tabela = page.getByLabel(MESES);
  await expect(tabela.getByText('11/2026', { exact: true })).toBeVisible();
  await expect(tabela.getByText('06/2026', { exact: true })).toBeVisible();
  await expect(tabela.getByText('até hoje')).toHaveCount(1);
  await expect(tabela.getByText(/nov\/2026/)).toHaveCount(0);
  await expect(page.getByLabel(EQUIPE).getByText('3 / —', { exact: true })).toBeVisible();
  // O nome longo fica numa linha só, com o nome inteiro na dica.
  const nome = page.getByLabel(EQUIPE).getByText(/^Carolina Nome Muito/);
  expect(await nome.evaluate((e) => e.getBoundingClientRect().height)).toBeLessThan(30);
  await expect(page.locator('[title^="Carolina Nome Muito Comprido"]')).toHaveCount(1);
  // "Como contamos" é texto de consulta: nasce fechado e abre pelo botão (aria-expanded).
  const regras = page.getByRole('button', { name: REGRAS });
  await expect(regras).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText(/^Alunos ativos no fim do mês/)).toHaveCount(0);
  await regras.click();
  await expect(regras).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText(/^Alunos ativos no fim do mês/)).toBeVisible();
  await expect(page.getByText(/^Na equipe, atrasadas/)).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('indicadores sem dado e com zero: "—" com o motivo, zero sem tom, e sem a equipe "Para revisar" some', async ({ page }) => {
  const meses = NUMEROS.meses.map((m) => (m.parcial ? { ...m, atualizacoesNoPrazo: 0, atualizacoesAtrasadas: 0, alunosAtivos: null } : m));
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280, 900, { numeros: { ...SEM_EQUIPE, meses } });
  await expect(page.getByLabel('Alunos ativos hoje: —', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Alunos ativos hoje: —', { exact: true }).getByText('Sem dados')).toBeVisible();
  await expect(page.getByLabel('No prazo no mês atual: —. Nenhuma atualização no mês')).toBeVisible();
  await expect(page.getByLabel('Atrasadas: 0. No mês atual')).toBeVisible();
  await expect(page.getByLabel(/^Para revisar: /)).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('numeros-1280-sem-dado.png') });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('erro da API: a mensagem com "Tentar de novo" e nenhum indicador', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const { naoTratadas } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'EQUIPE_LER'] })),
    'GET /numeros': erroApi(500, 'Não foi possível carregar os números.'),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
  });
  await page.goto('/treinador/numeros');
  await expect(page.getByText('Não foi possível carregar os números.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Tentar de novo/ })).toBeVisible();
  await expect(page.getByLabel(/^Alunos ativos hoje: /)).toHaveCount(0);
  await expect(page.getByRole('button', { name: REGRAS })).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('numeros-1280-erro.png') });
  expect(naoTratadas).toEqual([]);
});

test('sem meses: o vazio explica e não há indicador nem tabela', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await (async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const r = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR })),
      'GET /numeros': { corpo: { meses: [], equipe: null, semResponsavel: null } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    });
    await page.goto('/treinador/numeros');
    return r;
  })();
  await expect(page.getByText('Sem números ainda')).toBeVisible();
  await expect(page.getByLabel(/^Alunos ativos hoje: /)).toHaveCount(0);
  await expect(page.getByLabel(MESES)).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

// números (19/11): duas colunas sem buraco no PC largo, nos dois temas.
for (const [largura, altura, tema] of [[1920, 1080, 'ESCURO'], [1920, 1080, 'CLARO'], [1600, 900, 'CLARO']] as const) {
  test(`${largura} px (${tema}): "Mês a mês" à esquerda, "Equipe hoje" e "Como contamos" logo abaixo à direita`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, largura, altura, { tema });
    await expect(page.getByRole('table', { name: MESES })).toBeVisible();
    await expect(page.getByRole('table', { name: EQUIPE })).toBeVisible();
    const meses = await caixa(page, MESES);
    const equipe = await caixa(page, EQUIPE);
    expect(Math.abs(meses.y - equipe.y)).toBeLessThan(80);
    expect(equipe.x).toBeGreaterThan(meses.x + meses.width);
    const selo = await page.getByLabel(EQUIPE).getByText('Acima do limite').boundingBox();
    expect(selo!.x + selo!.width).toBeLessThanOrEqual(equipe.x + equipe.width);
    // "Como contamos" logo abaixo da equipe, na mesma coluna: só o recuo do cartão e o vão da página entre os dois.
    const regras = await caixaDasRegras(page);
    expect(regras.y).toBeGreaterThan(equipe.y + equipe.height);
    expect(regras.y - (equipe.y + equipe.height)).toBeLessThan(80);
    expect(regras.x).toBeGreaterThan(meses.x + meses.width);
    // Os 4 indicadores numa linha.
    const y = await topos(page, INDICADORES);
    expect(Math.max(...y) - Math.min(...y)).toBeLessThan(2);
    await semRolagemHorizontal(page);
    await page.screenshot({ path: test.info().outputPath(`numeros-${largura}-${tema.toLowerCase()}.png`), fullPage: true });
    // Aberto, o texto fica na coluna da direita, sem empurrar "Mês a mês".
    await page.getByRole('button', { name: REGRAS }).click();
    await expect(page.getByText(/^Na equipe, atrasadas/)).toBeVisible();
    expect((await caixa(page, MESES)).x).toBe(meses.x);
    await page.screenshot({ path: test.info().outputPath(`numeros-${largura}-${tema.toLowerCase()}-regras-abertas.png`), fullPage: true });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('1920 px sem a equipe: "Como contamos" à direita de "Mês a mês", e 3 indicadores', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1920, 1080, { numeros: SEM_EQUIPE });
  const meses = await caixa(page, MESES);
  const regras = await caixaDasRegras(page);
  expect(regras.x).toBeGreaterThan(meses.x + meses.width);
  expect(Math.abs(regras.y - meses.y)).toBeLessThan(120);
  await expect(page.getByLabel(/^Para revisar: /)).toHaveCount(0);
  const y = await topos(page, INDICADORES.slice(0, 3));
  expect(Math.max(...y) - Math.min(...y)).toBeLessThan(2);
  await semRolagemHorizontal(page, [MESES]);
  await page.screenshot({ path: test.info().outputPath('numeros-1920-sem-equipe.png'), fullPage: true });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('1920 px com o texto extra: as tabelas pedem mais largura e empilham', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1920, 1080, { tamanhoTexto: 'EXTRA' });
  await expect(page.getByRole('table', { name: MESES })).toBeVisible();
  await expect(page.getByRole('table', { name: EQUIPE })).toBeVisible();
  const meses = await caixa(page, MESES);
  const equipe = await caixa(page, EQUIPE);
  expect(equipe.y).toBeGreaterThan(meses.y + meses.height);
  await semRolagemHorizontal(page);
  await page.screenshot({ path: test.info().outputPath('numeros-1920-texto-extra.png') });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

// números (19/11): empilhado, a ordem é Mês a mês, Equipe hoje, Como contamos.
for (const [largura, altura, modo, tema] of [[1440, 900, 'table', 'CLARO'], [1280, 720, 'table', 'ESCURO'], [1280, 720, 'table', 'CLARO'], [1024, 768, 'table', 'CLARO'], [390, 844, 'list', 'CLARO'], [390, 844, 'list', 'ESCURO']] as const) {
  test(`${largura} px (${tema}): empilhadas (${modo === 'table' ? 'em colunas' : 'em cartões'})`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, largura, altura, { tema });
    await expect(page.getByRole(modo, { name: MESES })).toBeVisible();
    await expect(page.getByRole(modo, { name: EQUIPE })).toBeVisible();
    const meses = await caixa(page, MESES);
    const equipe = await caixa(page, EQUIPE);
    const regras = await caixaDasRegras(page);
    expect(equipe.y).toBeGreaterThan(meses.y + meses.height);
    expect(regras.y).toBeGreaterThan(equipe.y + equipe.height);
    await semRolagemHorizontal(page);
    // Na tabela o nome longo fica numa linha (reticências e dica); no cartão do celular, inteiro, em mais de uma linha.
    const alturaDoNome = await page.getByLabel(EQUIPE).getByText(/^Carolina Nome Muito/).evaluate((e) => e.getBoundingClientRect().height);
    if (modo === 'list') expect(alturaDoNome).toBeGreaterThan(30);
    else expect(alturaDoNome).toBeLessThan(30);
    await page.screenshot({ path: test.info().outputPath(`numeros-${largura}-${tema.toLowerCase()}.png`), fullPage: true });
    // A tela rola por dentro: a segunda captura mostra a equipe e "Como contamos" no fim.
    await page.getByRole('button', { name: REGRAS }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath(`numeros-${largura}-${tema.toLowerCase()}-fim.png`) });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
