import { expect, test } from '@playwright/test';

import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/** Itens de navegação são links de verdade na web: botão direito e Ctrl+clique abrem em nova guia. Só dados fictícios. */
const ID = 'f0000000-0000-4000-8000-000000000001';

async function abrirEditor(page: import('@playwright/test').Page) {
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR', 'MODELO_LER', 'MODELO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios': { corpo: [] },
    [`GET /receitas/${ID}`]: { corpo: { id: ID, tipo: 'SESSAO_TREINO', nome: 'Dia de treino', descricao: null, conteudo: { sessoes: [{ nome: 'Treino A' }] }, ordem: 0, pastaId: null, versao: 1 } },
    [`PUT /receitas/${ID}`]: (pedido, route) => json(route, { id: ID, tipo: 'SESSAO_TREINO', nome: 'Dia de treino', descricao: null, conteudo: pedido.corpo, ordem: 0, pastaId: null, versao: 2 }),
  });
  await page.goto(`/treinador/planejamento/modelo/${ID}`);
  return { errosDaPagina };
}

test('menu lateral: cada item é um link com href e o Ctrl+clique abre em outra guia', async ({ page, context }) => {
  const { errosDaPagina } = await abrirEditor(page);
  const biblioteca = page.getByRole('link', { name: 'Biblioteca', exact: true });
  await expect(biblioteca).toHaveAttribute('href', '/treinador/biblioteca');
  await expect(page.getByRole('link', { name: 'Alunos', exact: true })).toHaveAttribute('href', '/treinador/alunos');

  const nova = context.waitForEvent('page');
  await biblioteca.click({ modifiers: ['Control'] });
  const guia = await nova;
  await guia.waitForLoadState();
  expect(new URL(guia.url()).pathname).toBe('/treinador/biblioteca');
  // A guia de origem não saiu do lugar.
  expect(new URL(page.url()).pathname).toBe(`/treinador/planejamento/modelo/${ID}`);
  expect(errosDaPagina).toEqual([]);
});

test('menu lateral: o clique simples navega dentro do app e, com alteração pendente, pergunta antes', async ({ page }) => {
  const { errosDaPagina } = await abrirEditor(page);
  await page.getByRole('button', { name: 'Adicionar exercício' }).first().click();
  const folha = page.getByRole('dialog', { name: 'Escolher exercício' });
  await folha.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('Flexão diamante');
  await folha.getByRole('button', { name: /Usar só o nome Flexão diamante/ }).click();
  await expect(folha).toHaveCount(0);

  await page.getByRole('link', { name: 'Biblioteca', exact: true }).click();
  await expect(page.getByText('Sair sem salvar?')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(`/treinador/planejamento/modelo/${ID}`);
  await page.getByRole('button', { name: 'Sair sem salvar' }).click();
  await expect(page).toHaveURL(/\/treinador\/biblioteca/);
  expect(errosDaPagina).toEqual([]);
});
