import { expect, test } from '@playwright/test';

import type { Exercicio } from '../src/api/tipos';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/** Folha no PC: arrastar pelo cabeçalho; e escolher vários exercícios do grupo no editor de treino. Só dados fictícios. */
const ID = 'f0000000-0000-4000-8000-000000000001';
function exercicio(n: number, nome: string, grupo: string): Exercicio {
  return {
    id: `e000000${n}-0000-4000-8000-000000000000`, nome, grupoMuscular: grupo, equipamento: null, modalidade: 'LIVRE', videoUrl: null,
    observacoes: null, origem: 'MANUAL', imagens: [], imagemPropriaEm: null,
  };
}
const BIBLIOTECA = [exercicio(1, 'Supino reto', 'Peito'), exercicio(2, 'Crucifixo', 'Peito'), exercicio(3, 'Remada baixa', 'Costas')];

async function abrirEditor(page: import('@playwright/test').Page) {
  const salvos: unknown[] = [];
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR', 'MODELO_LER', 'MODELO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios': { corpo: BIBLIOTECA },
    [`GET /receitas/${ID}`]: { corpo: { id: ID, tipo: 'SESSAO_TREINO', nome: 'Dia de treino', descricao: null, conteudo: { sessoes: [{ nome: 'Treino A' }] }, ordem: 0, pastaId: null, versao: 1 } },
    [`PUT /receitas/${ID}`]: (pedido, route) => { salvos.push(pedido.corpo); return json(route, { id: ID, tipo: 'SESSAO_TREINO', nome: 'Dia de treino', descricao: null, conteudo: pedido.corpo, ordem: 0, pastaId: null, versao: 2 }); },
  });
  await page.goto(`/treinador/planejamento/modelo/${ID}`);
  return { naoTratadas, errosDaPagina, salvos };
}

test('folha no PC: arrastar pelo cabeçalho move o painel e o X continua fechando', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrirEditor(page);
  await page.getByRole('button', { name: 'Adicionar exercício' }).first().click();
  const folha = page.getByRole('dialog', { name: 'Escolher exercício' });
  await expect(folha).toBeVisible();
  const antes = (await folha.boundingBox())!;
  const titulo = folha.getByText('Escolher exercício', { exact: true });
  const t = (await titulo.boundingBox())!;
  await page.mouse.move(t.x + 20, t.y + 8);
  await page.mouse.down();
  await page.mouse.move(t.x + 120, t.y + 70, { steps: 8 });
  await page.mouse.up();
  const depois = (await folha.boundingBox())!;
  expect(Math.round(depois.x - antes.x)).toBeGreaterThan(80);
  expect(Math.round(depois.y - antes.y)).toBeGreaterThan(50);
  // Arrastar para bem longe não deixa o cabeçalho sair da janela.
  await page.mouse.move(t.x + 120, t.y + 78);
  await page.mouse.down();
  await page.mouse.move(5000, 5000, { steps: 5 });
  await page.mouse.up();
  const longe = (await folha.boundingBox())!;
  const janela = page.viewportSize()!;
  expect(longe.x).toBeLessThan(janela.width - 40);
  expect(longe.y).toBeLessThan(janela.height - 30);
  // Arrastar começando no X não fecha a folha, mas tocar nele fecha.
  const x = (await folha.getByRole('button', { name: 'Fechar' }).boundingBox())!;
  await page.mouse.move(x.x + x.width / 2, x.y + x.height / 2);
  await page.mouse.down();
  await page.mouse.move(x.x + x.width / 2 - 100, x.y + x.height / 2 + 40, { steps: 6 });
  await page.mouse.up();
  await expect(folha).toBeVisible();
  await folha.getByRole('button', { name: 'Fechar' }).click();
  await expect(folha).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('escolher exercício: marca vários do grupo escolhido e adiciona de uma vez', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrirEditor(page);
  await page.getByRole('button', { name: 'Adicionar exercício' }).first().click();
  const folha = page.getByRole('dialog', { name: 'Escolher exercício' });
  await expect(folha.getByRole('button', { name: 'Adicionar exercício' })).toBeDisabled();
  await folha.getByRole('checkbox', { name: 'Supino reto' }).click();
  await folha.getByRole('checkbox', { name: 'Remada baixa' }).click();
  await expect(folha.getByRole('button', { name: 'Adicionar 2 exercícios' })).toBeEnabled();
  // Trocar de grupo tira da seleção o que não é do grupo novo.
  await folha.getByRole('button', { name: 'Peito' }).click();
  await expect(folha.getByRole('checkbox', { name: 'Remada baixa' })).toHaveCount(0);
  await expect(folha.getByRole('button', { name: 'Adicionar exercício' })).toBeEnabled();
  await folha.getByRole('button', { name: /Marcar todos os 2 da lista/ }).click();
  await folha.getByRole('button', { name: 'Adicionar 2 exercícios' }).click();
  await expect(folha).toHaveCount(0);
  await expect(page.getByText('Supino reto').first()).toBeVisible();
  await expect(page.getByText('Crucifixo').first()).toBeVisible();
  await expect(page.getByText('Remada baixa')).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('escolher exercício: o manual leva junto os já marcados', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrirEditor(page);
  await page.getByRole('button', { name: 'Adicionar exercício' }).first().click();
  const folha = page.getByRole('dialog', { name: 'Escolher exercício' });
  await folha.getByRole('checkbox', { name: 'Supino reto' }).click();
  await folha.getByRole('checkbox', { name: 'Remada baixa' }).click();
  await folha.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('Flexão diamante');
  await folha.getByRole('button', { name: /Usar só o nome Flexão diamante/ }).click();
  await expect(folha).toHaveCount(0);
  for (const nome of ['Supino reto', 'Remada baixa', 'Flexão diamante']) await expect(page.getByText(nome).first()).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
