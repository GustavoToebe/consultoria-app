import { expect, test, type Page } from '@playwright/test';

import type { Exercicio } from '../src/api/tipos';
import { erroApi, json, paginaDeExerciciosFalsa, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso, type RespostasApi } from './api-falsa';

/**
 * Biblioteca › Exercícios › ⋯ › "Organizar grupos musculares" (27/11): a lista com as variações juntas, "Unir variações",
 * marcar dois quaisquer, o passo de confirmar com o nome e a prévia da API, o aviso e a recarga da aba; 403 e 422 com o
 * texto da API; vazio e erro da lista. Só dados fictícios.
 */
const exercicio = (n: number, nome: string, grupoMuscular: string | null): Exercicio => ({
  id: `e${String(n).padStart(7, '0')}-0000-4000-8000-000000000000`, nome, grupoMuscular, equipamento: null,
  modalidade: grupoMuscular ? 'LIVRE' : 'CARDIO', videoUrl: null, observacoes: null, origem: 'MANUAL', imagens: [], imagemPropriaEm: null,
});
const biblioteca = (): Exercicio[] => [
  exercicio(1, 'Elevação lateral', 'Ombro'), exercicio(2, 'Desenvolvimento', 'Ombro'),
  exercicio(3, 'Elevação frontal', 'Ombros'), exercicio(4, 'Crucifixo invertido', 'Ombros'), exercicio(5, 'Face pull', 'Ombros'),
  exercicio(6, 'Supino reto', 'Peito'), exercicio(7, 'Crucifixo', 'Peito'), exercicio(8, 'Remada baixa', 'Costas'),
  exercicio(9, 'Esteira', null),
];

interface Uniao { origem: string[]; destino: string }
const ehUniao = (c: unknown): c is Uniao => typeof c === 'object' && c !== null && 'origem' in c && 'destino' in c;
/** Quantos exercícios a união mudaria agora (a regra da API: grupo exato na origem e diferente do destino). */
const mudariam = (todos: Exercicio[], u: Uniao) => todos.filter((e) => e.grupoMuscular && u.origem.includes(e.grupoMuscular) && e.grupoMuscular !== u.destino);

async function abrir(page: Page, extra: RespostasApi = {}, opcoes: { todos?: Exercicio[]; permissoes?: string[] } = {}) {
  const todos = opcoes.todos ?? biblioteca();
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: opcoes.permissoes ?? [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios/pagina': paginaDeExerciciosFalsa(todos),
    'GET /exercicios': (_p, route) => json(route, todos),
    'POST /exercicios/grupos-musculares/unir/previa': (p, route) => json(route, { exerciciosAlterados: ehUniao(p.corpo) ? mudariam(todos, p.corpo).length : 0 }),
    'POST /exercicios/grupos-musculares/unir': (p, route) => {
      const u = p.corpo;
      if (!ehUniao(u)) return json(route, erroApi(422, 'Confira os grupos musculares.', 'GRUPOS_INVALIDOS').corpo, 422);
      const alterar = mudariam(todos, u);
      for (const e of alterar) e.grupoMuscular = u.destino;
      return json(route, { exerciciosAlterados: alterar.length });
    },
    ...extra,
  });
  await page.goto('/treinador/biblioteca');
  return { ...api, todos };
}

async function abrirAFolha(page: Page) {
  await page.getByRole('button', { name: 'Ações dos exercícios' }).click();
  await page.getByRole('button', { name: /^Organizar grupos musculares/ }).click();
  return page.getByRole('dialog', { name: 'Organizar grupos musculares' });
}

const ultimoCorpo = (pedidos: PedidoFalso[], caminho: string) => pedidos.filter((p) => p.caminho === caminho).at(-1)?.corpo;

for (const largura of [390, 1280]) {
  test(`organizar grupos: variações juntas, unir com prévia, aviso e recarga (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, naoTratadas, errosDaPagina } = await abrir(page);
    await expect(page.getByText('Supino reto', { exact: true })).toBeVisible();
    const folha = await abrirAFolha(page);

    // Ombro e Ombros numa linha só (5 exercícios, 2 variações), em ordem alfabética; o cardio sem grupo fica de fora.
    const caixas = folha.getByRole('checkbox');
    await expect(caixas).toHaveCount(3);
    await expect(caixas.nth(0)).toHaveAccessibleName('Costas, 1 exercício');
    await expect(caixas.nth(1)).toHaveAccessibleName('Ombro, 5 exercícios · 2 variações');
    await expect(caixas.nth(2)).toHaveAccessibleName('Peito, 2 exercícios');
    await expect(folha.getByRole('button', { name: 'Variações de Ombro', exact: true })).toBeVisible();
    // Nada marcado: "Unir" apagado, com o motivo colado nele.
    await expect(folha.getByRole('button', { name: 'Unir grupos marcados' })).toBeDisabled();
    await expect(folha.getByText('Marque dois ou mais grupos para unir.')).toBeVisible();

    // Marcar dois quaisquer (um pelo teclado: Enter na caixa, como as outras `CaixaDaLinha`) libera o "Unir"; o passo
    // sugere o nome mais curto.
    await caixas.nth(0).focus();
    await page.keyboard.press('Enter');
    await folha.getByText('Peito', { exact: true }).click();
    await expect(caixas.nth(0)).toBeChecked();
    await expect(caixas.nth(2)).toBeChecked();
    await expect(folha.getByText('2 grupos marcados')).toBeVisible();
    await folha.getByRole('button', { name: 'Unir grupos marcados' }).click();
    const passo = page.getByRole('dialog', { name: 'Unir grupos musculares' });
    await expect(passo.getByRole('textbox', { name: 'Nome do grupo' })).toHaveValue('Peito');
    await expect(passo.getByText('1 exercício muda')).toBeVisible();
    // Voltar mantém a seleção.
    await passo.getByRole('button', { name: 'Voltar' }).click();
    await expect(caixas.nth(0)).toBeChecked();
    await caixas.nth(0).click();
    await caixas.nth(2).click();

    // "Unir variações" vai direto ao passo, com o rótulo do agrupado e a prévia da API.
    await folha.getByRole('button', { name: 'Unir variações de Ombro' }).click();
    const nome = passo.getByRole('textbox', { name: 'Nome do grupo' });
    await expect(nome).toHaveValue('Ombro');
    await expect(passo.getByText('3 exercícios mudam')).toBeVisible();
    expect(ultimoCorpo(pedidos, '/exercicios/grupos-musculares/unir/previa')).toEqual({ origem: ['Ombro', 'Ombros'], destino: 'Ombro' });
    // Outro nome, outra prévia; vazio, erro no campo ao tocar em "Unir grupos".
    await nome.fill('Ombros');
    await expect(passo.getByText('2 exercícios mudam')).toBeVisible();
    await nome.fill('   ');
    await passo.getByRole('button', { name: 'Unir grupos', exact: true }).click();
    await expect(passo.getByText('Informe o nome do grupo.')).toBeVisible();
    await nome.fill('Ombro');
    await expect(passo.getByText('3 exercícios mudam')).toBeVisible();

    // Enter no campo confirma; o aviso diz quantos mudaram e a folha volta à lista já atualizada.
    const paginasAntes = pedidos.filter((p) => p.caminho === '/exercicios/pagina').length;
    await nome.press('Enter');
    await expect(page.getByText('Grupos unidos: 3 exercícios renomeados.')).toBeVisible();
    expect(ultimoCorpo(pedidos, '/exercicios/grupos-musculares/unir')).toEqual({ origem: ['Ombro', 'Ombros'], destino: 'Ombro' });
    await expect(folha.getByRole('checkbox', { name: 'Ombro, 5 exercícios', exact: true })).toBeVisible();
    await expect(folha.getByRole('button', { name: /^Unir variações/ })).toHaveCount(0);
    // A aba também refez a página (e as contagens dos filtros, que vêm da mesma lista inteira).
    await expect.poll(() => pedidos.filter((p) => p.caminho === '/exercicios/pagina').length).toBeGreaterThan(paginasAntes);

    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('organizar grupos: 403 e 422 da API com o texto dela', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // A rota do unir responde o erro da vez: 403 (alerta) e depois 422 com o campo `destino`.
  let resposta = erroApi(403, 'Você não tem permissão para alterar a biblioteca.', 'PERMISSAO_NEGADA');
  const { naoTratadas, errosDaPagina } = await abrir(page, {
    'POST /exercicios/grupos-musculares/unir': (_p, route) => json(route, resposta.corpo, resposta.status),
  });
  const folha = await abrirAFolha(page);
  await folha.getByRole('button', { name: 'Unir variações de Ombro' }).click();
  const passo = page.getByRole('dialog', { name: 'Unir grupos musculares' });
  await expect(passo.getByText('3 exercícios mudam')).toBeVisible();
  await passo.getByRole('button', { name: 'Unir grupos', exact: true }).click();
  await expect(passo.getByText('Você não tem permissão para alterar a biblioteca.')).toBeVisible();

  resposta = erroApi(422, 'Confira os grupos musculares.', 'GRUPOS_INVALIDOS', [{ field: 'destino', message: 'Informe o novo nome do grupo, com até 60 caracteres.' }]);
  await passo.getByRole('button', { name: 'Unir grupos', exact: true }).click();
  await expect(passo.getByText('Informe o novo nome do grupo, com até 60 caracteres.')).toBeVisible();
  await expect(passo.getByRole('textbox', { name: 'Nome do grupo' })).toBeFocused();
  // Nada mudou: o X volta à lista, que continua com as variações.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Organizar grupos musculares' }).getByRole('button', { name: 'Unir variações de Ombro' })).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('organizar grupos: sem BIBLIOTECA_ALTERAR o ⋯ não aparece', async ({ page }) => {
  await abrir(page, {}, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER'] });
  await expect(page.getByText('Supino reto', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ações dos exercícios' })).toHaveCount(0);
});

for (const largura of [390, 1280]) {
  test(`organizar grupos: biblioteca vazia e erro da lista com "Tentar de novo" (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    let falhar = true;
    const { naoTratadas, errosDaPagina } = await abrir(page, {
      'GET /exercicios': (_p, route) => (falhar ? json(route, erroApi(500, 'Não foi possível carregar os exercícios.').corpo, 500) : json(route, [])),
    }, { todos: [] });
    await expect(page.getByText('Biblioteca de exercícios vazia')).toBeVisible();
    const folha = await abrirAFolha(page);
    await expect(folha.getByText('Não foi possível carregar os exercícios.')).toBeVisible();
    falhar = false;
    await folha.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(folha.getByText('Nenhum exercício na biblioteca')).toBeVisible();
    await expect(folha.getByRole('button', { name: 'Unir grupos marcados' })).toHaveCount(0);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

// Capturas da folha (sem e com seleção) e do passo de confirmar, só com `E2E_CAPTURAS` (fora do git).
const comTema = (page: Page, tema: 'ESCURO' | 'CLARO') =>
  page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);

for (const largura of [390, 1280]) {
  for (const tema of ['ESCURO', 'CLARO'] as const) {
    test(`capturas de "Organizar grupos musculares" (${largura}, ${tema.toLowerCase()})`, async ({ page }) => {
      const pasta = process.env.E2E_CAPTURAS;
      test.skip(!pasta, 'só com E2E_CAPTURAS');
      await page.setViewportSize({ width: largura, height: 900 });
      await comTema(page, tema);
      await abrir(page);
      const folha = await abrirAFolha(page);
      await expect(folha.getByRole('checkbox')).toHaveCount(3);
      const nome = (estado: string) => `${pasta}/grupos-musculares-${estado}-${largura}-${tema.toLowerCase()}.png`;
      await page.screenshot({ path: nome('lista') });
      await folha.getByRole('checkbox').nth(0).click();
      await folha.getByRole('checkbox').nth(2).click();
      await folha.getByRole('button', { name: 'Variações de Ombro', exact: true }).hover();
      await page.screenshot({ path: nome('com-selecao') });
      await folha.getByRole('button', { name: 'Unir variações de Ombro' }).click();
      await expect(page.getByRole('dialog', { name: 'Unir grupos musculares' }).getByText('3 exercícios mudam')).toBeVisible();
      await page.screenshot({ path: nome('confirmar') });
    });
  }
}
