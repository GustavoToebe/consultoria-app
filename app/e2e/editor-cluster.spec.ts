import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

import type { ConteudoTreino, PlanoDetalhe } from '../src/api/tipos';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { ALUNO_ID, BIBLIOTECA, PLANO_ID, planoDetalhe } from './editor-inspetor.dados';

/**
 * Cluster na série aberta (SERIE-ABERTA, seção 3; E-004): os botões − e + dos blocos atualizam na hora os campos, o resumo
 * e o "Digitar como texto", o bloco novo entra focado e com as repetições do último, e editar um bloco grava a lista. O
 * Crucifixo (1 série de WS com Cluster) começa em 4 blocos iguais de 5. Só dados fictícios. Capturas em `E2E_CAPTURAS`
 * (padrão: a pasta do teste); 1920 e 3440 só rodam com `E2E_CAPTURAS` definido.
 */

const capturas = process.env.E2E_CAPTURAS;
async function capturar(page: Page, nome: string, saida: string) {
  await page.screenshot({ path: capturas ? path.join(capturas, nome) : path.join(saida, nome), fullPage: false });
}

/** O plano do inspetor com o Crucifixo em 4 blocos iguais de 5 (20 reps). */
function planoComBlocosIguais(): PlanoDetalhe<ConteudoTreino> {
  const detalhe = planoDetalhe(false);
  const crucifixo = detalhe.rascunho.sessoes[0].exercicios.find((e) => e.uid === 'crucifixo')!;
  const [s] = crucifixo.series;
  crucifixo.series = [{ ...s, repsMin: 20, repsMax: 20, tecnica: { ...s.tecnica!, blocos: [5, 5, 5, 5] } }];
  return detalhe;
}

async function abrir(page: Page, tema: 'CLARO' | 'ESCURO', largura: number) {
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR'] })),
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /exercicios': { corpo: BIBLIOTECA },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /planos-treino/${PLANO_ID}`]: (_p, route) => json(route, planoComBlocosIguais()),
  });
  await page.goto(`/treinador/treinos/${PLANO_ID}`);
  await expect(page.getByText('Peito e tríceps', { exact: true }).first()).toBeVisible();
  // Em duas colunas o exercício se escolhe na lista; no celular o título do cartão abre.
  if (largura >= 960) await page.getByRole('button', { name: /^Exercício 3 de 7: Crucifixo na máquina/ }).click();
  else await page.getByRole('button', { name: 'Editar Crucifixo na máquina', exact: true }).click();
  // A 1ª série já abre com o exercício; tocar nela fecharia.
  const linha = page.getByRole('group', { name: 'Blocos do exercício' }).getByRole('button', { name: /^Série 1 · WS/ });
  if ((await linha.getAttribute('aria-expanded')) !== 'true') await linha.click();
  return api;
}

const semRolagemLateral = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function adicionarRemoverEEditar(page: Page, saida: string, sufixo: string) {
  const bloco = (n: number) => page.getByRole('textbox', { name: `Bloco ${n}`, exact: true });
  const resumo = (texto: string) => page.getByText(texto, { exact: true });

  // Blocos iguais: um campo só e a quantidade ao lado; o descanso do cluster é o da série inteira.
  await expect(page.getByRole('radio', { name: 'Blocos iguais', exact: true })).toBeChecked();
  await expect(page.getByText('× 4 blocos', { exact: true })).toBeVisible();
  await expect(resumo('4 blocos · 20 reps por série')).toBeVisible();
  await expect(page.getByText('É o tempo depois de cada série (os blocos têm a pausa própria).', { exact: true })).toBeVisible();
  await capturar(page, `cluster-iguais-${sufixo}.png`, saida);

  // Blocos diferentes: B1…B4 com as repetições de cada um.
  await page.getByRole('radio', { name: 'Blocos diferentes', exact: true }).click();
  await expect(bloco(4)).toHaveValue('5');
  await expect(bloco(5)).toHaveCount(0);

  // + : o Bloco 5 entra com as repetições do último, focado; o modo, o resumo e o texto acompanham na hora.
  await page.getByRole('button', { name: 'Adicionar um bloco', exact: true }).click();
  await expect(bloco(5)).toHaveValue('5');
  await expect(bloco(5)).toBeFocused();
  await expect(page.getByRole('radio', { name: 'Blocos diferentes', exact: true })).toBeChecked();
  await expect(resumo('5 blocos · 25 reps por série')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Digitar como texto (5-5-5-5-5)', exact: true })).toBeVisible();
  await capturar(page, `cluster-depois-do-mais-${sufixo}.png`, saida);

  // − : sai o último bloco.
  await page.getByRole('button', { name: 'Remover um bloco', exact: true }).click();
  await expect(bloco(5)).toHaveCount(0);
  await expect(resumo('4 blocos · 20 reps por série')).toBeVisible();

  // Editar o Bloco 2: o resumo e o texto seguem o valor digitado.
  await bloco(2).fill('3');
  await expect(resumo('4 blocos · 18 reps por série')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Digitar como texto (5-3-5-5)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Digitar como texto (5-3-5-5)', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Blocos de repetições', exact: true })).toHaveValue('5-3-5-5');
  await capturar(page, `cluster-editado-${sufixo}.png`, saida);
}

for (const largura of [1280, 1920, 3440]) {
  for (const tema of ['ESCURO', 'CLARO'] as const) {
    const sufixo = `${largura}-${tema.toLowerCase()}`;
    test(`cluster: + e − dos blocos e editar um bloco atualizam na hora (${sufixo})`, async ({ page }, testInfo) => {
      test.skip(largura !== 1280 && !capturas, 'Larguras de captura só com E2E_CAPTURAS.');
      await page.setViewportSize({ width: largura, height: largura === 3440 ? 1440 : 1100 });
      const api = await abrir(page, tema, largura);
      await adicionarRemoverEEditar(page, testInfo.outputPath(), sufixo);
      // A prévia do aluno acompanha a série aberta.
      await expect(page.getByRole('group', { name: 'Prévia para o aluno' })).toBeVisible();
      expect(await semRolagemLateral(page)).toBe(true);
      expect(api.errosDaPagina).toEqual([]);
    });
  }
}

for (const tema of ['ESCURO', 'CLARO'] as const) {
  test(`celular (390): o cluster cabe sem rolagem lateral e + e − funcionam (${tema.toLowerCase()})`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 900 });
    const api = await abrir(page, tema, 390);
    await adicionarRemoverEEditar(page, testInfo.outputPath(), `390-${tema.toLowerCase()}`);
    expect(await semRolagemLateral(page)).toBe(true);
    expect(api.errosDaPagina).toEqual([]);
  });
}
