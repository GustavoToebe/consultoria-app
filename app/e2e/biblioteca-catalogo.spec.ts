import { expect, test, type Page } from '@playwright/test';

import type { CatalogoExercicio, Exercicio } from '../src/api/tipos';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { pngDeCor } from './imagens-falsas';

/**
 * Biblioteca › Importar do catálogo e Exercícios: filtro de vários grupos (`grupo` repetido na consulta), foto que
 * preenche a miniatura e abre grande ao tocar (sem marcar o item). Só dados fictícios.
 */
const AZUL = pngDeCor(16, [30, 90, 200]);

function exercicio(n: number, nome: string, grupo: string): CatalogoExercicio {
  return { id: `c000000${n}-0000-4000-8000-000000000000`, nome, grupoMuscular: grupo, equipamento: null, modalidade: 'LIVRE', instrucoes: null, fonte: null, imagens: [`Foto_${n}/0.jpg`, `Foto_${n}/1.jpg`] };
}
const CATALOGO = [exercicio(1, 'Supino reto', 'Peito'), exercicio(2, 'Remada baixa', 'Costas'), exercicio(3, 'Agachamento', 'Quadríceps'), exercicio(4, 'Tríceps testa', 'Tríceps')];
const GRUPOS = ['Costas', 'Peito', 'Quadríceps', 'Tríceps'];

/** As fotos do catálogo são do site (`/catalogo/exercicios/...`), não da API (`/api/catalogo/...`). */
async function servirFotos(page: Page) {
  await page.route((url) => url.pathname.startsWith('/catalogo/exercicios/'), (route) => route.fulfill({ status: 200, contentType: 'image/png', body: AZUL }));
}

test('catálogo: marcar vários grupos filtra por "ou", Marcar todos age só no que o filtro deixa e Esc fecha', async ({ page }) => {
  await servirFotos(page);
  const consultas: string[] = [];
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios': { corpo: [] },
    'GET /catalogo/exercicios/grupos': { corpo: GRUPOS },
    'GET /catalogo/exercicios': (pedido, route) => {
      consultas.push(pedido.busca.getAll('grupo').join('|'));
      const grupos = pedido.busca.getAll('grupo');
      const itens = CATALOGO.filter((e) => grupos.length === 0 || grupos.includes(e.grupoMuscular ?? ''));
      return json(route, { itens, total: itens.length });
    },
  });
  await page.goto('/treinador/biblioteca?aba=catalogo');
  await expect(page.getByText('Supino reto', { exact: true })).toBeVisible();
  await expect(page.getByText('Tríceps testa', { exact: true })).toBeVisible();

  const campo = page.getByRole('button', { name: 'Grupo: Todos. Escolher.' });
  await campo.click();
  const painel = page.getByRole('dialog', { name: 'Grupo' });
  await expect(painel).toBeVisible();
  await painel.getByRole('checkbox', { name: 'Peito' }).click();
  await painel.getByRole('checkbox', { name: 'Costas' }).click();
  // Marcar não fecha a lista; a consulta leva os dois grupos, repetidos (um `grupo` por valor).
  await expect(painel).toBeVisible();
  await expect.poll(() => consultas.at(-1)).toBe('Costas|Peito');
  await expect(page.getByText('Agachamento', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Supino reto', { exact: true })).toBeVisible();
  await expect(page.getByText('Remada baixa', { exact: true })).toBeVisible();

  // "Marcar todos" com filtro digitado marca só os visíveis (sem acento: "triceps" acha "Tríceps").
  await painel.getByRole('textbox', { name: 'Filtro' }).fill('triceps');
  await expect(painel.getByRole('checkbox', { name: 'Peito' })).toHaveCount(0);
  await painel.getByRole('checkbox', { name: 'Marcar todos os visíveis' }).click();
  await expect.poll(() => consultas.at(-1)).toBe('Costas|Peito|Tríceps');
  await painel.getByRole('textbox', { name: 'Filtro' }).fill('');
  await painel.getByRole('button', { name: 'Limpar Grupo' }).click();
  await expect.poll(() => consultas.at(-1)).toBe('');

  await painel.getByRole('checkbox', { name: 'Peito' }).click();
  await page.keyboard.press('Escape');
  await expect(painel).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Grupo: Peito. Escolher.' })).toBeVisible();

  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('catálogo: a foto preenche a miniatura e, ao tocar, abre grande sem marcar o item', async ({ page }) => {
  await servirFotos(page);
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios': { corpo: [] },
    'GET /catalogo/exercicios/grupos': { corpo: GRUPOS },
    'GET /catalogo/exercicios': { corpo: { itens: [CATALOGO[0]], total: 1 } },
  });
  await page.goto('/treinador/biblioteca?aba=catalogo');
  const foto = page.getByRole('button', { name: /Demonstração: Supino reto\. Tocar para ampliar/ });
  await expect(foto).toBeVisible();
  await expect(foto.locator('img').first()).toHaveCSS('object-fit', 'cover');

  await foto.click();
  const grande = page.getByRole('dialog', { name: 'Demonstração: Supino reto' });
  await expect(grande).toBeVisible();
  await expect(grande.locator('img').first()).toHaveCSS('object-fit', 'contain');
  // Tocar na foto só amplia: o item não foi marcado.
  await page.keyboard.press('Escape');
  await expect(grande).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Importar selecionados (0)' })).toBeVisible();

  // Tocar no nome marca.
  await page.getByText('Supino reto', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Importar selecionados (1)' })).toBeVisible();

  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('exercícios da biblioteca: filtro de vários grupos no cliente', async ({ page }) => {
  await servirFotos(page);
  const doTreinador = (n: number, nome: string, grupo: string): Exercicio => ({
    id: `e000000${n}-0000-4000-8000-000000000000`, nome, grupoMuscular: grupo, equipamento: null, modalidade: 'LIVRE', videoUrl: null,
    observacoes: null, origem: 'MANUAL', imagens: [], imagemPropriaEm: null,
  });
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios': { corpo: [doTreinador(1, 'Supino', 'Peito'), doTreinador(2, 'Remada', 'Costas'), doTreinador(3, 'Agacho', 'Pernas')] },
  });
  await page.goto('/treinador/biblioteca');
  await expect(page.getByText('Agacho', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Grupo muscular: Todos os grupos. Escolher.' }).click();
  const painel = page.getByRole('dialog', { name: 'Grupo muscular' });
  await painel.getByRole('checkbox', { name: 'Peito' }).click();
  await painel.getByRole('checkbox', { name: 'Costas' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Supino', { exact: true })).toBeVisible();
  await expect(page.getByText('Remada', { exact: true })).toBeVisible();
  await expect(page.getByText('Agacho', { exact: true })).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
