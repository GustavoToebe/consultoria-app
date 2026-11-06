import { expect, test, type Page } from '@playwright/test';

import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { ALUNO_ID, BIBLIOTECA, PLANO_ID, planoDetalhe } from './editor-inspetor.dados';

/**
 * Prescrição da série aberta (redesenho das séries, 05/11, com a largura da revisão dos editores, 04/11): Séries, Repetições
 * e Descanso numa linha só da faixa Estrutura a partir de 1440; em 1280 as Séries ficam em cima e Repetições e Descanso
 * descem juntos, lado a lado; no celular a linha quebra e nada passa da borda. O "+ Nova série" fica inteiro na coluna.
 */

async function abrir(page: Page) {
  await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR'] })),
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /exercicios': { corpo: BIBLIOTECA },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /planos-treino/${PLANO_ID}`]: (_p, route) => json(route, planoDetalhe(false)),
  });
  await page.goto(`/treinador/treinos/${PLANO_ID}`);
  await expect(page.getByRole('textbox', { name: 'Nome da sessão' })).toHaveValue('Peito e tríceps');
}

/** As três partes da linha da Estrutura: o contador de séries, as repetições (o Máx. fecha a faixa) e o descanso. */
async function linhaDaEstrutura(page: Page) {
  const caixa = async (b: ReturnType<Page['getByRole']>) => (await b.first().boundingBox())!;
  return {
    series: await caixa(page.getByRole('button', { name: 'Uma série completa a mais', exact: true })),
    maximo: await caixa(page.getByRole('textbox', { name: 'Reps máx.', exact: true })),
    descanso: await caixa(page.getByRole('textbox', { name: 'Descanso depois da série, em segundos', exact: true })),
  };
}

for (const largura of [1280, 1440, 1920]) {
  test(`Estrutura no PC: ${largura >= 1440 ? 'Séries, Repetições e Descanso numa linha' : 'Repetições e Descanso juntos'} (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    await abrir(page);
    await expect(page.getByText(/^Editando: Série 1( ·|$)/)).toBeVisible();
    const { series, maximo, descanso } = await linhaDaEstrutura(page);
    // Repetições e Descanso sempre na mesma linha, nesta ordem; a partir de 1440 as Séries também (centros alinhados: os
    // controles têm alturas diferentes).
    const centro = (r: { y: number; height: number }) => r.y + r.height / 2;
    expect(Math.abs(centro(maximo) - centro(descanso))).toBeLessThan(2);
    expect(descanso.x).toBeGreaterThan(maximo.x + maximo.width);
    if (largura >= 1440) {
      expect(Math.abs(centro(series) - centro(maximo))).toBeLessThan(12);
      expect(maximo.x).toBeGreaterThan(series.x + series.width);
    } else expect(maximo.y).toBeGreaterThan(series.y + series.height);
    // A grade 2 + 2 saiu: nada de seções Esforço nem Carga de cada série.
    for (const antiga of ['Esforço', 'Carga de cada série', 'Repetições']) {
      await expect(page.getByRole('heading', { level: 3, name: antiga, exact: true })).toHaveCount(0);
    }
    const nova = page.getByRole('button', { name: 'Nova série', exact: true }).first();
    await nova.scrollIntoViewIfNeeded();
    await expect(nova).toBeInViewport({ ratio: 1 });
    const caixaNova = (await nova.boundingBox())!;
    // "Receita de séries" marca a borda direita da coluna das séries.
    const receita = (await page.getByRole('button', { name: 'Usar uma receita de séries', exact: true }).boundingBox())!;
    expect(caixaNova.x + caixaNova.width).toBeLessThanOrEqual(receita.x + receita.width + 1);
  });
}

// Largura (04/11): em 1920 o inspetor divide em dados | séries; a Observação da sessão vai ao lado do Nome em 1440 e 1920.
for (const largura of [1280, 1440, 1920]) {
  test(`largura do treino: sessão e inspetor (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    await abrir(page);
    await expect(page.getByText(/^Editando: Série 1( ·|$)/)).toBeVisible();
    const caixa = async (nome: RegExp | string) => (await page.getByText(nome, { exact: nome instanceof RegExp ? undefined : true }).first().boundingBox())!;
    const nome = (await page.getByRole('textbox', { name: 'Nome da sessão' }).boundingBox())!;
    const observacao = await caixa('Observação');
    if (largura >= 1440) expect(observacao.x).toBeGreaterThan(nome.x + nome.width);
    else expect(observacao.y).toBeGreaterThan(nome.y + nome.height);
    const exibicao = (await page.getByRole('textbox', { name: 'Nome de exibição' }).boundingBox())!;
    const series = await caixa(/^Editando: Série 1/);
    if (largura === 1920) {
      expect(series.x).toBeGreaterThan(exibicao.x + exibicao.width);
      expect(exibicao.width).toBeLessThanOrEqual(400);
    } else expect(series.y).toBeGreaterThan(exibicao.y + exibicao.height);
  });
}

test('Estrutura quebra a linha no celular, sem passar da borda (390px)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await abrir(page);
  await page.getByRole('button', { name: 'Editar Supino reto com barra', exact: true }).click();
  await expect(page.getByText(/^Editando: Série 1( ·|$)/)).toBeVisible();
  const { series, maximo, descanso } = await linhaDaEstrutura(page);
  // As faixas seguem uma embaixo da outra e o descanso desce para a linha seguinte.
  expect(descanso.y).toBeGreaterThan(series.y);
  for (const r of [series, maximo, descanso]) expect(r.x + r.width).toBeLessThanOrEqual(390);
  const nova = page.getByRole('button', { name: 'Nova série', exact: true }).first();
  await nova.scrollIntoViewIfNeeded();
  await expect(nova).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
