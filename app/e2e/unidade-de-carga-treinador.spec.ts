import { expect, test, type Page } from '@playwright/test';
import type { Receita, Serie } from '../src/api/tipos';
import { CONFIGURACAO_PADRAO } from '../src/dominio/metodologiaPadrao';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

// Libras, fase 2: a escolha de unidade é do treinador (neste aparelho) e vale para o que ele digita e lê. Dados fictícios.
const ID_PLANO = 'm0000000-0000-4000-8000-000000000030';
const ws = (uid: string): Serie => ({
  uid, tipo: 'WORKING', repsMin: 12, repsMax: 12, carga: { modo: 'CARGA_TRABALHO', percentualMin: null, percentualMax: null, referenciaUid: null },
  esforco: { rir: 1, rpe: null }, descansoSegundos: null, tecnica: null,
});

async function planoEmLibra(page: Page, preferencia: 'kg' | 'lb' | null, { chave = true, ir = true }: { chave?: boolean; ir?: boolean } = {}) {
  const plano: Receita = {
    id: ID_PLANO, tipo: 'PLANO_TREINO', nome: 'Semana fictícia', descricao: null, pastaId: null, ordem: 1, versao: 1,
    conteudo: {
      objetivo: null, orientacoes: null,
      metodologia: { id: null, nome: 'Metodologia fictícia', configuracao: structuredClone(CONFIGURACAO_PADRAO) },
      sessoes: [{
        uid: 'sessao-1', nome: 'Treino A', diaSemana: 1, tipo: 'TREINO', frequenciaSemanal: null, observacao: null, cardio: null, grupos: [],
        exercicios: [{ uid: 'ex-1', exercicioId: null, nome: 'Supino fictício', modalidade: 'LIVRE', videoUrl: null, observacao: null, progressao: true, unidade: 'kg', grupoUid: null, series: [ws('s0'), ws('s1'), ws('s2')] }],
      }],
    },
  };
  if (preferencia) await page.addInitScript(([id, pref]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ unidadeDeCarga: pref })), [TREINADOR.id, preferencia]);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'], unidadeDeCargaHabilitada: chave })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /pastas-modelos': { corpo: [] },
    'GET /exercicios': { corpo: [] },
    'GET /receitas': (_p, route) => json(route, []),
    [`GET /receitas/${ID_PLANO}`]: (_p, route) => json(route, plano),
    [`PUT /receitas/${ID_PLANO}/conteudo`]: (p, route) => { Object.assign(plano, p.corpo as Receita, { versao: plano.versao + 1 }); return json(route, plano); },
  });
  if (ir) await irAoModelo(page);
  return { ...api, salvo: () => plano };
}

async function irAoModelo(page: Page) {
  await page.goto(`/treinador/planejamento/modelo/${ID_PLANO}`);
  await expect(page.getByRole('button', { name: 'Salvar modelo', exact: true })).toBeVisible();
}

async function abrirExercicio(page: Page, largura: number) {
  if (largura >= 960) await page.getByRole('button', { name: /^Exercício 1 de 1: Supino fictício/ }).click();
  else await page.getByRole('button', { name: 'Editar Supino fictício', exact: true }).click();
}

for (const largura of [390, 1280]) {
  test(`treinador em lb: carga fixa digitada em libras, plano guardado em kg (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await planoEmLibra(page, 'lb');
    await abrirExercicio(page, largura);
    await page.getByRole('button', { name: 'Outras formas de carga', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Carga fixa (kg)', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Carga fixa (lb)', exact: true }).click();
    const campo = page.getByRole('textbox', { name: 'Peso da carga fixa, em libras', exact: true });
    await campo.fill('0');
    await expect(page.getByText('Carga fixa: maior que zero e até 2204,6 lb.', { exact: true }).first()).toBeVisible();
    await campo.fill('100,57');
    await expect(campo).toHaveValue('100,5');
    await campo.fill('100');
    await expect(page.getByText('Carga fixa: maior que zero e até 2204,6 lb.', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/100 lb/).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await campo.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('carga-fixa-em-libras.png') });
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    // O plano guarda kg: 100 lb = 45,35 kg.
    const salvas = (api.salvo().conteudo as unknown as { sessoes: { exercicios: { series: Serie[] }[] }[] }).sessoes[0].exercicios[0].series;
    expect(salvas.map((s) => s.carga)).toEqual([0, 1, 2].map(() => expect.objectContaining({ modo: 'CARGA_FIXA', valorKg: 45.35 })));
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`treinador em kg com a chave ligada segue em kg (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await planoEmLibra(page, 'kg');
    await abrirExercicio(page, largura);
    await page.getByRole('button', { name: 'Outras formas de carga', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Carga fixa (lb)', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Carga fixa (kg)', exact: true })).toBeVisible();
    expect(api.errosDaPagina).toEqual([]);
  });
}

// O caminho de verdade: a escolha é feita em Ajustes (nada gravado de antes) e só aparece com a chave da plataforma ligada.
test('treinador escolhe lb em Ajustes e o editor passa a falar libras', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await planoEmLibra(page, null, { ir: false });
  await page.goto('/treinador/ajustes');
  const opcao = (rotulo: string) => page.getByRole('radiogroup', { name: 'Unidade da carga' }).getByRole('button', { name: rotulo, exact: true });
  await expect(page.getByText('Unidade da carga', { exact: true })).toBeVisible();
  await opcao('Libras (lb)').click();
  await irAoModelo(page);
  await abrirExercicio(page, 1280);
  await page.getByRole('button', { name: 'Outras formas de carga', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Carga fixa (lb)', exact: true })).toBeVisible();
});

test('chave desligada: o treinador nem vê a escolha e segue em kg, mesmo com lb salvo de antes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await planoEmLibra(page, 'lb', { chave: false, ir: false });
  await page.goto('/treinador/ajustes');
  await expect(page.getByText('Tema', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Unidade da carga', { exact: true })).toHaveCount(0);
  await irAoModelo(page);
  await abrirExercicio(page, 1280);
  await page.getByRole('button', { name: 'Outras formas de carga', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Carga fixa (kg)', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Carga fixa (lb)', exact: true })).toHaveCount(0);
});
