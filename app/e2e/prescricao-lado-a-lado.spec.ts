import { expect, test, type Page } from '@playwright/test';

import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { ALUNO_ID, BIBLIOTECA, PLANO_ID, planoDetalhe } from './editor-inspetor.dados';

/**
 * Prescrição da série aberta (decisão A, 04/11): no PC, Repetições e Carga numa linha e Esforço e Descanso na de baixo,
 * no máximo duas por linha também nas telas bem largas; no celular, uma embaixo da outra. O "+ Nova série" fica inteiro
 * dentro da coluna.
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

const titulo = (page: Page, nome: string) => page.getByRole('heading', { level: 3, name: nome, exact: true });
const topo = async (page: Page, nome: string) => Math.round((await titulo(page, nome).boundingBox())!.y);
const esquerda = async (page: Page, nome: string) => Math.round((await titulo(page, nome).boundingBox())!.x);

for (const largura of [1280, 1440, 1920]) {
  test(`prescrição 2 + 2 no PC (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    await abrir(page);
    await expect(page.getByText(/^Editando: Série 1( ·|$)/)).toBeVisible();
    const [reps, carga, esforco, descanso] = await Promise.all(['Repetições', 'Carga', 'Esforço', 'Descanso'].map((n) => topo(page, n)));
    expect(carga).toBe(reps);
    expect(descanso).toBe(esforco);
    expect(esforco).toBeGreaterThan(reps);
    // Duas colunas: Esforço embaixo de Repetições e Descanso embaixo de Carga.
    expect(await esquerda(page, 'Esforço')).toBe(await esquerda(page, 'Repetições'));
    expect(await esquerda(page, 'Descanso')).toBe(await esquerda(page, 'Carga'));
    const nova = page.getByRole('button', { name: 'Nova série', exact: true }).first();
    await nova.scrollIntoViewIfNeeded();
    await expect(nova).toBeInViewport({ ratio: 1 });
    const caixaNova = (await nova.boundingBox())!;
    // "Receita de séries" marca a borda direita da coluna das séries.
    const receita = (await page.getByRole('button', { name: 'Usar uma receita de séries', exact: true }).boundingBox())!;
    expect(caixaNova.x + caixaNova.width).toBeLessThanOrEqual(receita.x + receita.width + 1);
  });
}

test('prescrição uma por linha no celular (390px)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await abrir(page);
  await page.getByRole('button', { name: 'Editar Supino reto com barra', exact: true }).click();
  await expect(page.getByText(/^Editando: Série 1( ·|$)/)).toBeVisible();
  const tops = await Promise.all(['Repetições', 'Carga', 'Esforço', 'Descanso'].map((n) => topo(page, n)));
  expect(new Set(tops).size).toBe(4);
  expect([...tops].sort((a, b) => a - b)).toEqual(tops);
  const nova = page.getByRole('button', { name: 'Nova série', exact: true }).first();
  await nova.scrollIntoViewIfNeeded();
  await expect(nova).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
