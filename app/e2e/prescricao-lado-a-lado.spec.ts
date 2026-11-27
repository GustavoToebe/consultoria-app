import { expect, test, type Page } from '@playwright/test';

import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { ALUNO_ID, BIBLIOTECA, PLANO_ID, planoDetalhe } from './editor-inspetor.dados';

/**
 * Prescrição da série aberta (redesenho das séries, 05/11; série aberta de 27/11): Séries, Repetições e Descanso numa linha
 * só da faixa Estrutura no PC; no celular a linha quebra e nada passa da borda. O "+ Nova série" fica inteiro na coluna.
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
  await expect(page.getByText('Peito e tríceps', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Editar sessão/ })).toBeVisible();
}

/** As três partes da linha da Estrutura: o contador de séries, as repetições (o Máx. fecha a faixa) e o descanso. */
async function linhaDaEstrutura(page: Page) {
  const caixa = async (b: ReturnType<Page['getByRole']>) => (await b.first().boundingBox())!;
  return {
    series: await caixa(page.getByRole('button', { name: /^Séries: .*. Escolher.$/ })),
    maximo: await caixa(page.getByRole('textbox', { name: 'Reps máx.', exact: true })),
    descanso: await caixa(page.getByRole('button', { name: /^Descanso: .*. Escolher.$/ })),
  };
}

for (const largura of [1280, 1440, 1920]) {
  test(`Estrutura no PC: Séries, Repetições e Descanso numa linha (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    await abrir(page);
    // Séries no padrão da dieta (19/11): o título "Editando: Série N · tipo" saiu; vale o nome acessível do bloco aberto.
    await expect(page.getByRole('region', { name: /^Editando série 1(,|$)/ })).toBeVisible();
    const { series, maximo, descanso } = await linhaDaEstrutura(page);
    // 27/11: os três lado a lado, nesta ordem, alinhados pelo topo (as repetições têm a escolha Faixa | Exata | AMRAP em
    // cima dos números, numa área de largura fixa).
    expect(Math.abs(series.y - descanso.y)).toBeLessThan(2);
    expect(maximo.x).toBeGreaterThan(series.x + series.width);
    expect(descanso.x).toBeGreaterThan(maximo.x + maximo.width);
    // A grade 2 + 2 saiu: nada de seções Esforço nem Carga de cada série.
    for (const antiga of ['Esforço', 'Carga de cada série', 'Repetições']) {
      await expect(page.getByRole('heading', { level: 3, name: antiga, exact: true })).toHaveCount(0);
    }
    const nova = page.getByRole('button', { name: 'Nova série', exact: true }).first();
    await nova.scrollIntoViewIfNeeded();
    await expect(nova).toBeInViewport({ ratio: 1 });
    const caixaNova = (await nova.boundingBox())!;
    // "Salvar como receita" (o último botão do cabeçalho das séries, 27/11) marca a borda direita da coluna das séries.
    const receita = (await page.getByRole('button', { name: 'Salvar como receita de séries', exact: true }).boundingBox())!;
    expect(caixaNova.x + caixaNova.width).toBeLessThanOrEqual(receita.x + receita.width + 1);
  });
}

// Largura (04/11): a Observação da sessão vai ao lado do Nome em 1440 e 1920.
for (const largura of [1280, 1440, 1920]) {
  test(`largura do treino: sessão e inspetor (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    await abrir(page);
    await expect(page.getByRole('region', { name: /^Editando série 1(,|$)/ })).toBeVisible();
    const caixa = async (nome: RegExp | string) => (await page.getByText(nome, { exact: nome instanceof RegExp ? undefined : true }).first().boundingBox())!;
    // 10/11: nome, dia, tipo e observação da sessão moram no recolhido "Editar sessão", observação embaixo do nome.
    await page.getByRole('button', { name: /^Editar sessão/ }).click();
    const nome = (await page.getByRole('textbox', { name: 'Nome da sessão' }).boundingBox())!;
    const observacao = await caixa('Observação da sessão (opcional)');
    expect(observacao.y).toBeGreaterThan(nome.y + nome.height);
    await page.getByRole('button', { name: /^Nome de exibição e instruções/ }).click();
    const exibicao = (await page.getByRole('textbox', { name: 'Nome de exibição' }).boundingBox())!;
    const series = (await page.getByRole('region', { name: /^Editando série 1(,|$)/ }).boundingBox())!;
    // Uma coluna só em qualquer largura: as séries ficam abaixo dos dados do exercício, sem coluna vazia ao lado.
    expect(series.y).toBeGreaterThan(exibicao.y + exibicao.height);
  });
}

test('Estrutura quebra a linha no celular, sem passar da borda (390px)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await abrir(page);
  await page.getByRole('button', { name: 'Editar Supino reto com barra', exact: true }).click();
  await expect(page.getByRole('region', { name: /^Editando série 1(,|$)/ })).toBeVisible();
  const { series, maximo, descanso } = await linhaDaEstrutura(page);
  // As faixas seguem uma embaixo da outra e o descanso desce para a linha seguinte.
  expect(descanso.y).toBeGreaterThan(series.y);
  for (const r of [series, maximo, descanso]) expect(r.x + r.width).toBeLessThanOrEqual(390);
  // O par mín/máx quebra junto: o "máx" fica ao lado do "mín", não sozinho na linha de baixo.
  const minimo = (await page.getByRole('textbox', { name: 'Reps mín.', exact: true }).first().boundingBox())!;
  expect(Math.abs(maximo.y - minimo.y)).toBeLessThan(2);
  expect(maximo.x).toBeGreaterThan(minimo.x + minimo.width);
  const nova = page.getByRole('button', { name: 'Nova série', exact: true }).first();
  await nova.scrollIntoViewIfNeeded();
  await expect(nova).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
