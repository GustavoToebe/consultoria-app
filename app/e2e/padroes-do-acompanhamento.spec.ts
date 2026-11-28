import { expect, test, type Page } from '@playwright/test';

import type { ConsultoriaResponse } from '../src/api/tipos';
import { ESCURO } from '../src/tema/tokens';
import { erroApi, json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Configurações › Padrões do acompanhamento (28/11, duas colunas e exemplos ao vivo): Atualização e Peso à esquerda e o
 * ciclo à direita a partir de ~1200 px de área (uma coluna no celular); atalhos do prazo como botão comum (preenchem o campo) e o exemplo do
 * período no "hoje" de Brasília; o exemplo do peso pintado pela regra da cor da variação; a grade 2×2 das fases com a prévia
 * "Como a aluna vê" seguindo o campo em foco; o 422 no campo e o rodapé de salvar. Relógio fixo em 28/11/2026 e só dados
 * fictícios.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const ADMIN = { permissoes: [...PERMISSOES_TREINADOR, 'MARCA_ALTERAR'], perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true }, cicloHabilitado: true };
const VAZIA: ConsultoriaResponse = {
  marca: MARCA, versao: 3, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR',
  textosFasesCiclo: { menstrual: null, folicular: null, ovulatoria: null, lutea: null },
};
const CAMINHO = '/treinador/configuracoes/padroes-do-acompanhamento';

const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

async function abrir(page: Page, largura: number, altura: number, put: Parameters<typeof simularApi>[1] = {}) {
  await page.clock.setFixedTime(new Date('2026-11-28T12:00:00-03:00'));
  await page.setViewportSize({ width: largura, height: altura });
  await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), TREINADOR.id);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, ADMIN)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /consultoria': { corpo: VAZIA },
    'PUT /consultoria/marca': (p, route) => json(route, { ...VAZIA, ...(p.corpo as object), marca: MARCA, versao: 4 }),
    ...put,
  });
  await page.goto(CAMINHO);
  await expect(page.getByRole('heading', { level: 1, name: 'Padrões do acompanhamento' })).toBeVisible();
  return api;
}

const dias = (page: Page) => page.getByRole('textbox', { name: 'Nova atualização a cada (dias)' });
const abrirCiclo = (page: Page) => page.getByRole('button', { name: /^Ciclo menstrual: textos das fases/ }).first().click();
const corDoTexto = (page: Page, texto: string) => page.getByText(texto, { exact: true }).evaluate((e) => getComputedStyle(e).color);

test('1920: duas colunas; atalho do prazo preenche e foca o campo, com o exemplo do período; vazio diz que não há padrão', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1920, 1080);
  const atualizacao = await page.getByRole('heading', { name: 'Atualização', exact: true }).boundingBox();
  const ciclo = await page.getByRole('button', { name: /^Ciclo menstrual: textos das fases/ }).first().boundingBox();
  expect(ciclo && atualizacao && ciclo.x > atualizacao.x + 500 && Math.abs(ciclo.y - atualizacao.y) < 40).toBe(true);
  await expect(page.getByText('Sem padrão: você define o período em cada pasta.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '14 dias', exact: true }).click();
  // Atalho que preenche o campo (regra 17): botão comum, sem estado de escolhido; o campo recebe o valor e o foco.
  await expect(page.getByRole('button', { name: '14 dias', exact: true })).not.toHaveAttribute('aria-pressed');
  await expect(dias(page)).toHaveValue('14');
  await expect(dias(page)).toBeFocused();
  await expect(page.getByText('Uma pasta criada hoje vai de 28/11 a 11/12.', { exact: true })).toBeVisible();
  // Teclado: o atalho é botão comum (Tab chega, Enter escolhe).
  await page.getByRole('button', { name: '30 dias', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Uma pasta criada hoje vai de 28/11 a 27/12.', { exact: true })).toBeVisible();
  // O ⓘ do título leva a frase que saiu da descrição.
  await expect(page.getByRole('button', { name: 'Sobre o prazo da atualização' })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('1280: fora de 1 a 365 e o que não é número travam o Salvar com o motivo; o 422 da API aparece no campo', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, 900, {
    'PUT /consultoria/marca': erroApi(422, 'Dados inválidos.', 'CONSULTORIA_INVALIDA', [{ field: 'diasAtualizacaoPadrao', message: 'Prazo fictício recusado.' }]),
  });
  await dias(page).fill('400');
  await expect(page.getByText('Use de 1 a 365 dias.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar padrões', exact: true })).toBeDisabled();
  await dias(page).fill('1a');
  await expect(page.getByText('Use só números inteiros.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '21 dias', exact: true }).click();
  await expect(dias(page)).toHaveValue('21');
  await expect(page.getByText('Use só números inteiros.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Salvar padrões', exact: true }).click();
  await expect(page.getByText('Prazo fictício recusado.', { exact: true })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('1920: o exemplo do peso segue a meta pela regra da cor da variação (verde e vermelho; neutro sem meta)', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1920, 1080);
  const meta = page.getByRole('radiogroup', { name: 'Meta do peso dos alunos' });
  expect(await corDoTexto(page, '▼ −0,6 kg')).toBe(rgb(ESCURO.sucesso));
  expect(await corDoTexto(page, '▲ +0,4 kg')).toBe(rgb(ESCURO.perigo));
  await meta.getByRole('radio', { name: 'Aumentar', exact: true }).click();
  expect(await corDoTexto(page, '▼ −0,6 kg')).toBe(rgb(ESCURO.perigo));
  expect(await corDoTexto(page, '▲ +0,4 kg')).toBe(rgb(ESCURO.sucesso));
  await meta.getByRole('radio', { name: 'Sem meta', exact: true }).click();
  expect(await corDoTexto(page, '▼ −0,6 kg')).toBe(rgb(ESCURO.texto));
  await expect(page.getByLabel('Desceu 0,6 kg, sem cor', { exact: true })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('1920: grade 2×2 das fases e a prévia da aluna seguindo o campo em foco; o texto vai no PUT', async ({ page }) => {
  const { pedidos, errosDaPagina } = await abrir(page, 1920, 1080);
  await abrirCiclo(page);
  const caixa = async (nome: string) => (await page.getByRole('textbox', { name: nome, exact: true }).boundingBox())!;
  const [menstrual, folicular, ovulatoria] = [await caixa('Menstrual'), await caixa('Folicular'), await caixa('Ovulatória')];
  expect(Math.abs(menstrual.y - folicular.y)).toBeLessThan(2);
  expect(folicular.x).toBeGreaterThan(menstrual.x + menstrual.width);
  expect(ovulatoria.y).toBeGreaterThan(menstrual.y + menstrual.height);
  expect(await page.getByText('O app não recomenda nada por conta própria: escreva só o que você orienta.', { exact: true }).isVisible()).toBe(true);
  const previa = page.getByTestId('previa-da-fase');
  await expect(previa.getByText('Fase menstrual', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Folicular', exact: true }).fill('Orientação fictícia da folicular.');
  await expect(previa.getByText('Fase folicular', { exact: true })).toBeVisible();
  await expect(previa.getByText('Orientação fictícia da folicular.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Lútea', exact: true }).focus();
  await expect(previa.getByText('Fase lútea', { exact: true })).toBeVisible();
  await expect(previa.getByText('Sem texto nesta fase: a aluna não vê orientação aqui.', { exact: true })).toBeVisible();
  // Sem foco: a primeira fase com texto.
  await page.getByRole('heading', { level: 1, name: 'Padrões do acompanhamento' }).click();
  await expect(previa.getByText('Fase folicular', { exact: true })).toBeVisible();
  await expect(page.getByText('33/1.000', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar padrões', exact: true }).click();
  await expect(page.getByText('Padrões do acompanhamento salvos.', { exact: true })).toBeVisible();
  expect(pedidos.find((p) => p.metodo === 'PUT' && p.caminho === '/consultoria/marca')?.corpo).toMatchObject({
    diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR', nome: MARCA.nome,
    textosFasesCiclo: { menstrual: null, folicular: 'Orientação fictícia da folicular.', ovulatoria: null, lutea: null },
  });
  expect(errosDaPagina).toEqual([]);
});

test('390: uma coluna sem rolagem lateral; as fases empilhadas; o rodapé de salvar só com alteração', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 390, 844);
  await expect(page.getByRole('button', { name: 'Salvar padrões', exact: true })).toHaveCount(0);
  const peso = await page.getByRole('heading', { name: 'Peso', exact: true }).boundingBox();
  const ciclo = await page.getByRole('button', { name: /^Ciclo menstrual: textos das fases/ }).first().boundingBox();
  expect(peso && ciclo && ciclo.y > peso.y).toBe(true);
  await abrirCiclo(page);
  const menstrual = (await page.getByRole('textbox', { name: 'Menstrual', exact: true }).boundingBox())!;
  const folicular = (await page.getByRole('textbox', { name: 'Folicular', exact: true }).boundingBox())!;
  expect(folicular.y).toBeGreaterThan(menstrual.y + menstrual.height);
  await page.getByRole('button', { name: '7 dias', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Salvar padrões', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // Cancelar volta ao salvo e o rodapé some.
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(dias(page)).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Salvar padrões', exact: true })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});
