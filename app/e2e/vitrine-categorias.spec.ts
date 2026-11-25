import { expect, test, type Page } from '@playwright/test';

import type { CategoriaDaVitrine } from '../src/api/vitrineCategorias';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * "Organizar categorias" da Vitrine (`docs/planos/vitrine-categorias.md`): lista compacta (uma linha por categoria),
 * criar na linha (Enter cria; vazio dá erro no campo; 409 no campo; limite como aviso), renomear na linha (Enter salva,
 * Esc cancela), contagem, excluir com confirmação (os itens ficam sem categoria), ordem pelas setas (o caminho do
 * teclado do arrastar) com a lista completa e o estado vazio. Só dados fictícios.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const CAPTURAS = process.env.E2E_CAPTURAS;
const categoria = (n: number, nome: string, quantidade: number): CategoriaDaVitrine => ({ id: `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, nome, ordem: n - 1, quantidade });
const ROUPAS = categoria(1, 'Roupas', 12);
const LIVROS = categoria(2, 'Livros', 1);
const GUIAS = categoria(3, 'Guias', 0);

async function abrir(page: Page, { largura = 1280, tema = 'CLARO', categorias = [ROUPAS, LIVROS, GUIAS], extra = {} }: {
  largura?: number; tema?: 'CLARO' | 'ESCURO'; categorias?: CategoriaDaVitrine[]; extra?: RespostasApi;
} = {}) {
  let lista = categorias;
  await page.setViewportSize({ width: largura, height: 900 });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema]);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'VITRINE_LER', 'VITRINE_ALTERAR'], vitrineHabilitada: true })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /vitrine/itens': { corpo: [] },
    'GET /vitrine/categorias': (_, route) => json(route, lista),
    'POST /vitrine/categorias': (pedido, route) => {
      const nova = { ...categoria(lista.length + 10, (pedido.corpo as { nome: string }).nome, 0), ordem: lista.length };
      lista = [...lista, nova];
      return json(route, nova, 201);
    },
    'PUT /vitrine/categorias/ordem': (pedido, route) => {
      const { ids } = pedido.corpo as { ids: string[] };
      lista = ids.map((id) => lista.find((c) => c.id === id)!);
      return route.fulfill({ status: 204 });
    },
    'PUT /vitrine/categorias/{id}': (pedido, route) => {
      const { nome } = pedido.corpo as { nome: string };
      lista = lista.map((c) => (pedido.caminho.endsWith(c.id) ? { ...c, nome } : c));
      return json(route, lista.find((c) => pedido.caminho.endsWith(c.id)));
    },
    'DELETE /vitrine/categorias/{id}': (pedido, route) => { lista = lista.filter((c) => !pedido.caminho.endsWith(c.id)); return route.fulfill({ status: 204 }); },
    ...extra,
  });
  await page.goto('/treinador/vitrine');
  await page.getByRole('button', { name: 'Organizar categorias' }).click();
  return { ...api, folha: page.getByRole('dialog', { name: 'Organizar categorias' }) };
}

for (const largura of [390, 1280]) {
  test(`lista compacta com contagem, criar na linha e erro do campo vazio (${largura}px)`, async ({ page }) => {
    const { folha, pedidos, naoTratadas, errosDaPagina } = await abrir(page, { largura });
    await expect(folha.getByText('12 itens')).toBeVisible();
    await expect(folha.getByText('1 item', { exact: true })).toBeVisible();
    await expect(folha.getByText('Nenhum item')).toBeVisible();
    await folha.getByRole('button', { name: 'Criar categoria' }).click();
    await expect(folha.getByText('Informe o nome da categoria.')).toBeVisible();
    expect(pedidos.some((p) => p.metodo === 'POST' && p.caminho.startsWith('/vitrine'))).toBe(false);
    if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/vitrine-categorias-${largura}.png` });
    await folha.getByLabel('Nova categoria').fill('Acessórios');
    await folha.getByLabel('Nova categoria').press('Enter');
    await expect(folha.getByText('Acessórios', { exact: true })).toBeVisible();
    await expect(folha.getByLabel('Nova categoria')).toHaveValue('');
    expect(pedidos.find((p) => p.metodo === 'POST' && p.caminho.startsWith('/vitrine'))?.corpo).toEqual({ nome: 'Acessórios' });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('criar: o 409 de duplicada vai ao campo e o de limite vira aviso', async ({ page }) => {
  let limite = false;
  const { folha, naoTratadas, errosDaPagina } = await abrir(page, {
    extra: {
      'POST /vitrine/categorias': (_, route) => (limite
        ? json(route, erroApi(409, 'A vitrine tem no máximo 30 categorias.', 'VITRINE_CATEGORIAS_LIMITE').corpo, 409)
        : json(route, erroApi(409, 'Confira a categoria.', 'VITRINE_CATEGORIA_DUPLICADA', [{ field: 'nome', message: 'Já existe uma categoria com esse nome.' }]).corpo, 409)),
    },
  });
  await folha.getByLabel('Nova categoria').fill('Calçados');
  await folha.getByRole('button', { name: 'Criar categoria' }).click();
  await expect(folha.getByText('Já existe uma categoria com esse nome.')).toBeVisible();
  limite = true;
  await folha.getByLabel('Nova categoria').fill('Bolsas');
  await folha.getByRole('button', { name: 'Criar categoria' }).click();
  await expect(page.getByText('A vitrine tem no máximo 30 categorias.')).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('renomear na linha: Enter salva, Esc cancela só a linha', async ({ page }) => {
  const { folha, pedidos, naoTratadas, errosDaPagina } = await abrir(page);
  await folha.getByRole('button', { name: 'Renomear categoria Livros' }).click();
  const campo = folha.getByRole('textbox', { name: 'Nome da categoria Livros' });
  await expect(campo).toBeFocused();
  await expect(campo).toHaveValue('Livros');
  await page.keyboard.press('Escape');
  await expect(campo).toHaveCount(0);
  await expect(folha).toBeVisible();
  await expect(folha.getByRole('button', { name: 'Renomear categoria Livros' })).toBeFocused();
  await folha.getByRole('button', { name: 'Renomear categoria Livros' }).click();
  await folha.getByRole('textbox', { name: 'Nome da categoria Livros' }).fill('Livros e guias');
  await folha.getByRole('textbox', { name: 'Nome da categoria Livros' }).press('Enter');
  await expect(folha.getByText('Livros e guias', { exact: true })).toBeVisible();
  const put = pedidos.find((p) => p.metodo === 'PUT' && p.caminho === `/vitrine/categorias/${LIVROS.id}`);
  expect(put?.corpo).toEqual({ nome: 'Livros e guias' });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('excluir: o painel diz que os itens continuam, sem categoria', async ({ page }) => {
  const { folha, pedidos, naoTratadas, errosDaPagina } = await abrir(page);
  await folha.getByRole('button', { name: 'Excluir categoria Roupas' }).click();
  const painel = page.getByRole('alertdialog', { name: 'Excluir categoria “Roupas”?' });
  await expect(painel.getByText(/Os 12 itens continuam na vitrine, sem categoria\./)).toBeVisible();
  await painel.getByRole('button', { name: 'Excluir categoria' }).click();
  await expect(folha.getByText('Roupas', { exact: true })).toHaveCount(0);
  expect(pedidos.find((p) => p.metodo === 'DELETE')?.caminho).toBe(`/vitrine/categorias/${ROUPAS.id}`);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('ordem pelo teclado (setas da linha) manda a lista completa', async ({ page }) => {
  const { folha, pedidos, naoTratadas, errosDaPagina } = await abrir(page);
  await expect(folha.getByRole('button', { name: 'Mover Roupas para cima' })).toBeDisabled();
  await folha.getByRole('button', { name: 'Mover Roupas para baixo' }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => pedidos.find((p) => p.metodo === 'PUT' && p.caminho === '/vitrine/categorias/ordem')?.corpo)
    .toEqual({ ids: [LIVROS.id, ROUPAS.id, GUIAS.id] });
  await expect(folha.getByRole('button', { name: 'Mover Livros para cima' })).toBeDisabled();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('vazio: "Nenhuma categoria ainda."', async ({ page }) => {
  const { folha, naoTratadas, errosDaPagina } = await abrir(page, { categorias: [], largura: 390 });
  await expect(folha.getByText('Nenhuma categoria ainda.')).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
