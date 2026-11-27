import { expect, test } from '@playwright/test';

import type { Exercicio } from '../src/api/tipos';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/** Folha no PC: arrastar pelo cabeçalho; e escolher vários exercícios do grupo no editor de treino. Só dados fictícios. */
const ID = 'f0000000-0000-4000-8000-000000000001';
function exercicio(n: number, nome: string, grupo: string): Exercicio {
  return {
    id: `e${String(n).padStart(7, '0')}-0000-4000-8000-000000000000`, nome, grupoMuscular: grupo, equipamento: null, modalidade: 'LIVRE', videoUrl: null,
    observacoes: null, origem: 'MANUAL', imagens: [], imagemPropriaEm: null,
  };
}
// Linhas da lista (listbox): o nome acessível começa pelo nome do exercício.
const opcao = (folha: import('@playwright/test').Locator, nome: string) => folha.getByRole('option', { name: new RegExp(`^${nome},`) });
const BIBLIOTECA = [exercicio(1, 'Supino reto', 'Peito'), exercicio(2, 'Crucifixo', 'Peito'), exercicio(3, 'Remada baixa', 'Costas')];

async function abrirEditor(page: import('@playwright/test').Page, biblioteca: Exercicio[] = BIBLIOTECA) {
  const salvos: unknown[] = [];
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR', 'MODELO_LER', 'MODELO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios': { corpo: biblioteca },
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
  await opcao(folha, 'Supino reto').click();
  await opcao(folha, 'Remada baixa').click();
  await expect(folha.getByRole('button', { name: 'Adicionar 2 exercícios' })).toBeEnabled();
  // Trocar de grupo (etapa "Filtros de exercícios" da mesma folha) tira da seleção o que não é do grupo novo, com aviso.
  await folha.getByRole('button', { name: /^Filtros, / }).click();
  const etapa = page.getByRole('dialog', { name: 'Filtros de exercícios' });
  await etapa.getByRole('checkbox', { name: 'Peito, 2 exercícios' }).click();
  await etapa.getByRole('button', { name: 'Mostrar 2 exercícios' }).click();
  await expect(opcao(folha, 'Remada baixa')).toHaveCount(0);
  await expect(folha.getByRole('status').filter({ hasText: '1 exercício marcado saiu da seleção porque não é do grupo Peito.' })).toBeVisible();
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
  await opcao(folha, 'Supino reto').click();
  await opcao(folha, 'Remada baixa').click();
  await folha.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('Flexão diamante');
  await folha.getByRole('option', { name: /Usar só o nome Flexão diamante/ }).click();
  await expect(folha).toHaveCount(0);
  for (const nome of ['Supino reto', 'Remada baixa', 'Flexão diamante']) await expect(page.getByText(nome).first()).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('escolher exercício: "Mostrar mais" de 80 em 80 (80, 160, 200), a busca volta a 80 e "Marcar" vale só para os exibidos', async ({ page }) => {
  const muitos = Array.from({ length: 200 }, (_, i) => exercicio(i + 1, `Exercício ${String(i + 1).padStart(3, '0')}`, 'Peito'));
  const { naoTratadas, errosDaPagina } = await abrirEditor(page, muitos);
  await page.getByRole('button', { name: 'Adicionar exercício' }).first().click();
  const folha = page.getByRole('dialog', { name: 'Escolher exercício' });
  const caixas = folha.getByRole('listbox').getByRole('option').filter({ hasNotText: 'como exercício manual' });
  await expect(caixas).toHaveCount(80);
  await expect(folha.getByText('Mostrando 80 de 200.')).toBeVisible();
  // Com a lista cortada, marcar leva só os 80 exibidos.
  await folha.getByRole('button', { name: 'Marcar os 80 exibidos' }).click();
  await expect(folha.getByRole('button', { name: 'Adicionar 80 exercícios' })).toBeEnabled();
  await folha.getByRole('button', { name: 'Mostrar mais' }).click();
  await expect(caixas).toHaveCount(160);
  await expect(folha.getByText('Mostrando 160 de 200.')).toBeVisible();
  await expect(folha.getByRole('button', { name: 'Adicionar 80 exercícios' })).toBeEnabled();
  await folha.getByRole('button', { name: 'Mostrar mais' }).click();
  await expect(caixas).toHaveCount(200);
  await expect(folha.getByRole('button', { name: 'Mostrar mais' })).toHaveCount(0);
  await expect(folha.getByText(/^Mostrando /)).toHaveCount(0);
  // Buscar mostra o resultado inteiro (9 itens) e, ao limpar a busca, a contagem recomeça em 80.
  const busca = folha.getByRole('textbox', { name: 'Buscar na biblioteca' });
  await busca.fill('Exercício 00');
  await expect(caixas).toHaveCount(9);
  await busca.fill('');
  await expect(caixas).toHaveCount(80);
  await expect(folha.getByText('Mostrando 80 de 200.')).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
