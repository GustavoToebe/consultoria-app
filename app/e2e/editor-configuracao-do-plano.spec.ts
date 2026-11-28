import { expect, test, type Page } from '@playwright/test';

import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { ALUNO_ID, BIBLIOTECA, PLANO_ID, planoDetalhe } from './editor-inspetor.dados';

/**
 * "Configuração do plano" do treino (proposta de 27/11, seção 0.2 do documento da série aberta): recolhida com o resumo,
 * o seletor da metodologia ("Nenhuma vinculada" ou o nome) que abre a folha "Vincular metodologia", Objetivo (40%) e
 * Orientações gerais (60%) lado a lado no PC, campos que crescem com o texto e empilhados no celular. Só dados fictícios.
 * Capturas só com `E2E_CAPTURAS` (fora do git), nos temas escuro e claro.
 */

type Detalhe = ReturnType<typeof planoDetalhe>;

async function abrirPlano(page: Page, largura: number, ajustar?: (d: Detalhe) => void) {
  await page.setViewportSize({ width: largura, height: 900 });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR'] })),
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /exercicios': { corpo: BIBLIOTECA },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    // A folha "Vincular metodologia" lista as receitas do tipo METODOLOGIA.
    'GET /receitas': { corpo: [] },
    [`GET /planos-treino/${PLANO_ID}`]: (_p, route) => {
      const d = planoDetalhe(false);
      ajustar?.(d);
      return json(route, d);
    },
  });
  await page.goto(`/treinador/treinos/${PLANO_ID}`);
  await expect(page.getByRole('button', { name: /^Editar sessão/ })).toBeVisible();
  return api;
}

const comTema = (page: Page, tema: 'ESCURO' | 'CLARO') =>
  page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);

const abrirConfiguracao = (page: Page) => page.getByRole('button', { name: 'Configuração do plano, recolhido', exact: true }).click();
const objetivo = (page: Page) => page.getByRole('textbox', { name: 'Objetivo (opcional)' });
const orientacoes = (page: Page) => page.getByRole('textbox', { name: 'Orientações gerais (opcional)' });
const seletor = (page: Page) => page.getByRole('button', { name: /^Metodologia: / });
const semRolagemLateral = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const largura of [390, 1280]) {
  test(`recolhida com o resumo; aberta, o seletor mostra o nome e abre a folha "Vincular metodologia" (${largura}px)`, async ({ page }) => {
    const api = await abrirPlano(page, largura);
    await expect(page.getByText('Sem objetivo · Metodologia: Metodologia de teste', { exact: true })).toBeVisible();
    await expect(objetivo(page)).toHaveCount(0);
    await abrirConfiguracao(page);
    await expect(page.getByRole('button', { name: 'Configuração do plano, expandido', exact: true })).toBeVisible();
    // O seletor: rótulo dentro, o nome como valor; sai o "Metodologia: X" solto, o botão "Trocar" e o texto longo.
    await expect(seletor(page)).toHaveAccessibleName('Metodologia: Metodologia de teste. Trocar.');
    await expect(seletor(page)).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(seletor(page).getByText('Metodologia de teste', { exact: true })).toBeVisible();
    await expect(page.getByText('Orienta as novas séries; as que já existem continuam editáveis.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Trocar', exact: true })).toHaveCount(0);
    await expect(page.getByText(/^Uma cópia das regras acompanha/)).toHaveCount(0);
    expect((await seletor(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);

    await seletor(page).click();
    await expect(page.getByRole('dialog', { name: 'Vincular metodologia' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Vincular metodologia' })).toHaveCount(0);
    // O foco volta ao seletor que abriu a folha.
    await expect(seletor(page)).toBeFocused();
    expect(await semRolagemLateral(page)).toBe(true);
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}

test('sem metodologia: o resumo diz "Sem metodologia" e o seletor "Nenhuma vinculada", que também abre a folha (1280px)', async ({ page }) => {
  const api = await abrirPlano(page, 1280, (d) => { d.rascunho.metodologia = null; });
  await expect(page.getByText('Sem objetivo · Sem metodologia', { exact: true })).toBeVisible();
  await abrirConfiguracao(page);
  await expect(seletor(page)).toHaveAccessibleName('Metodologia: Nenhuma vinculada. Vincular.');
  await expect(page.getByRole('button', { name: 'Vincular', exact: true })).toHaveCount(0);
  await seletor(page).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Vincular metodologia' })).toBeVisible();
  expect(api.errosDaPagina).toEqual([]);
  expect(api.naoTratadas).toEqual([]);
});

test('PC: Objetivo (~40%) e Orientações gerais (~60%) lado a lado, alinhados no topo, e os campos crescem com o texto (1600px)', async ({ page }) => {
  // Em 1600 o bloco mede ~1300 px, longe do limite de 900 (em 1280, com o menu aberto, mede ~950: lado a lado por pouco).
  const api = await abrirPlano(page, 1600);
  await abrirConfiguracao(page);
  const [o, g] = [(await objetivo(page).boundingBox())!, (await orientacoes(page).boundingBox())!];
  expect(Math.abs(o.y - g.y)).toBeLessThanOrEqual(1);
  expect(o.x).toBeLessThan(g.x);
  const proporcao = o.width / (o.width + g.width);
  expect(proporcao).toBeGreaterThan(0.37);
  expect(proporcao).toBeLessThan(0.43);
  // O Objetivo nasce com uma linha (44 px), mais baixo que as Orientações (duas).
  expect(o.height).toBeLessThan(g.height);
  expect(o.height).toBeGreaterThanOrEqual(44);

  await orientacoes(page).fill(Array.from({ length: 6 }, (_, i) => `Orientação fictícia ${i + 1}`).join('\n'));
  await expect.poll(async () => (await orientacoes(page).boundingBox())!.height).toBeGreaterThan(g.height + 40);
  // Sem a alça de redimensionar.
  expect(await orientacoes(page).evaluate((e) => getComputedStyle(e).resize)).toBe('none');
  // O Objetivo não estica junto (alinhado no topo).
  expect((await objetivo(page).boundingBox())!.height).toBe(o.height);

  // O objetivo é uma linha: a quebra vira espaço e o resumo da faixa mostra o texto.
  await objetivo(page).fill('Força fictícia\ncom técnica');
  await expect(page.getByText('Objetivo: Força fictícia com técnica · Metodologia: Metodologia de teste', { exact: true })).toBeVisible();
  expect(api.errosDaPagina).toEqual([]);
  expect(api.naoTratadas).toEqual([]);
});

test('celular: o seletor e a dica quebram, e Objetivo e Orientações empilham na largura toda (390px)', async ({ page }) => {
  const api = await abrirPlano(page, 390);
  await abrirConfiguracao(page);
  const [o, g] = [(await objetivo(page).boundingBox())!, (await orientacoes(page).boundingBox())!];
  expect(g.y).toBeGreaterThan(o.y + o.height);
  expect(Math.abs(o.width - g.width)).toBeLessThanOrEqual(1);
  const dica = (await page.getByText('Orienta as novas séries; as que já existem continuam editáveis.', { exact: true }).boundingBox())!;
  expect(dica.y).toBeGreaterThanOrEqual((await seletor(page).boundingBox())!.y + 44);
  expect(await semRolagemLateral(page)).toBe(true);
  expect(api.errosDaPagina).toEqual([]);
  expect(api.naoTratadas).toEqual([]);
});

for (const largura of [390, 1280, 1920]) {
  for (const tema of ['ESCURO', 'CLARO'] as const) {
    test(`capturas da configuração aberta (${largura}, ${tema.toLowerCase()})`, async ({ page }) => {
      const pasta = process.env.E2E_CAPTURAS;
      test.skip(!pasta, 'só com E2E_CAPTURAS');
      await comTema(page, tema);
      await abrirPlano(page, largura, (d) => { d.rascunho.metodologia = null; });
      const cartao = page.getByTestId('cartao').filter({ has: page.getByRole('button', { name: /^Configuração do plano, / }) }).last();
      await cartao.screenshot({ path: `${pasta}/config-plano-recolhida-${largura}-${tema.toLowerCase()}.png` });
      await abrirConfiguracao(page);
      await orientacoes(page).fill('Beba água durante o treino.\nAnote como se sentiu ao fim de cada sessão.');
      await page.waitForTimeout(300);
      await cartao.screenshot({ path: `${pasta}/config-plano-aberta-${largura}-${tema.toLowerCase()}.png` });
    });
  }
}
