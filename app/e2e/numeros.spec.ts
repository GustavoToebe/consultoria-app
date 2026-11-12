import { expect, test, type Page } from '@playwright/test';

import type { NumerosDaConsultoria } from '../src/api/tipos';
import { PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Larguras de Números (plano larguras-das-telas, decisão 2): no PC largo "Mês a mês" e "Equipe hoje" ficam lado a lado,
 * as duas ainda como tabela; mais estreito, empilham; no celular viram cartões. Nada rola na horizontal. Contagens e
 * nomes de membros fictícios.
 */
const NUMEROS: NumerosDaConsultoria = {
  meses: ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'].map((mes, i) => ({
    mes, parcial: i === 5, alunosAtivos: 30 + i, atualizacoesNoPrazo: 20 + i, atualizacoesAtrasadas: i === 0 ? null : i,
  })),
  equipe: [
    { usuarioId: 'u1', nome: 'Ana Fictícia', alunosAtivos: 32, limiteDeAlunos: 30, atualizacoesAtrasadas: 2, atualizacoesParaRevisar: 5 },
    { usuarioId: 'u2', nome: 'Bia Exemplo', alunosAtivos: 4, limiteDeAlunos: null, atualizacoesAtrasadas: 0, atualizacoesParaRevisar: 1 },
  ],
  semResponsavel: { alunosAtivos: 3, atualizacoesAtrasadas: 0, atualizacoesParaRevisar: 1 },
};

const MESES = 'Alunos ativos e atualizações de cada mês';
const EQUIPE = 'Alunos e atualizações de cada membro da equipe';

async function abrir(page: Page, largura: number, altura: number, numeros: NumerosDaConsultoria = NUMEROS, tamanhoTexto?: string) {
  await page.setViewportSize({ width: largura, height: altura });
  if (tamanhoTexto) {
    await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tamanhoTexto: t })), [TREINADOR.id, tamanhoTexto]);
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

/** Nem a página nem as tabelas rolam ou cortam na horizontal, e nenhum título de coluna passa da própria célula. */
async function semRolagemHorizontal(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const rotulo of [MESES, EQUIPE]) {
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

// 1380 está rente à janela mais estreita em que ainda ficam lado a lado (menu aberto): cada tabela fica rente ao mínimo, o mesmo
// que sobra numa tela de 1440 com a barra de rolagem do Windows (aqui o Chromium sem janela esconde a barra).
for (const [largura, altura] of [[1440, 900], [1380, 780]] as const) test(`${largura} px: as duas tabelas lado a lado, ainda em colunas, com o selo dentro da célula`, async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, largura, altura);
  await expect(page.getByRole('table', { name: MESES })).toBeVisible();
  await expect(page.getByRole('table', { name: EQUIPE })).toBeVisible();
  const meses = await caixa(page, MESES);
  const equipe = await caixa(page, EQUIPE);
  expect(Math.abs(meses.y - equipe.y)).toBeLessThan(80);
  expect(equipe.x).toBeGreaterThan(meses.x + meses.width);
  const selo = await page.getByLabel(EQUIPE).getByText('Acima do limite').boundingBox();
  expect(selo!.x + selo!.width).toBeLessThanOrEqual(equipe.x + equipe.width);
  // O cartão da equipe termina junto com a tabela (recuo do cartão), sem esticar até a altura de "Mês a mês".
  const cartaoEquipe = await page.locator('div').filter({ has: page.getByText('Equipe hoje', { exact: true }) }).filter({ has: page.getByRole('table', { name: EQUIPE }) }).last().boundingBox();
  expect(cartaoEquipe!.y + cartaoEquipe!.height - (equipe.y + equipe.height)).toBeLessThan(48);
  await semRolagemHorizontal(page);
  await page.screenshot({ path: test.info().outputPath(`numeros-${largura}.png`), fullPage: true });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('1440 px sem a equipe: "Mês a mês" fica numa coluna, sem esticar', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1440, 900, { ...NUMEROS, equipe: null, semResponsavel: null });
  await expect(page.getByRole('table', { name: MESES })).toBeVisible();
  const meses = await caixa(page, MESES);
  const regras = await page.getByText('Como contamos').boundingBox();
  expect(meses.width).toBeLessThan(700);
  expect(regras!.y).toBeGreaterThan(meses.y + meses.height);
  await page.screenshot({ path: test.info().outputPath('numeros-1440-sem-equipe.png'), fullPage: true });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('1440 px com o texto extra: as tabelas pedem mais largura e empilham', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1440, 900, NUMEROS, 'EXTRA');
  await expect(page.getByRole('table', { name: MESES })).toBeVisible();
  await expect(page.getByRole('table', { name: EQUIPE })).toBeVisible();
  const meses = await caixa(page, MESES);
  const equipe = await caixa(page, EQUIPE);
  expect(equipe.y).toBeGreaterThan(meses.y + meses.height);
  await semRolagemHorizontal(page);
  await page.screenshot({ path: test.info().outputPath('numeros-1440-texto-extra.png') });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

for (const [largura, altura, modo] of [[1280, 720, 'table'], [1024, 768, 'table'], [390, 844, 'list']] as const) {
  test(`${largura} px: empilhadas (${modo === 'table' ? 'em colunas' : 'em cartões'})`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, largura, altura);
    await expect(page.getByRole(modo, { name: MESES })).toBeVisible();
    await expect(page.getByRole(modo, { name: EQUIPE })).toBeVisible();
    const meses = await caixa(page, MESES);
    const equipe = await caixa(page, EQUIPE);
    expect(equipe.y).toBeGreaterThan(meses.y + meses.height);
    await semRolagemHorizontal(page);
    await page.screenshot({ path: test.info().outputPath(`numeros-${largura}.png`), fullPage: true });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
