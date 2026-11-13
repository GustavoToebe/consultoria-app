import { expect, test, type Page } from '@playwright/test';

import type { Painel } from '../src/api/financeiroTipos';
import { AVISO_HISTORICO_PARCIAL } from '../src/dominio/financeiro';
import { fixarHoje } from './aluno';
import { erroApi, json, simularApi } from './api-falsa';
import { estadoFinanceiro, PAINEL_VAZIO, rotasDoFinanceiro, sessaoComFinanceiro } from './financeiro-falso';

/**
 * Início do treinador com o histórico financeiro parcial (13/11): a ressalva aparece uma vez só, no primeiro bloco de dinheiro
 * visível. Com o Financeiro oculto pelo "Editar" e o Recebido visível, ela vai para o Recebido; com os dois ocultos, nenhuma.
 * Também: "Recurso desativado" nos cartões e no bloco quando o financeiro responde 503, distinto de "Não carregou" e de zero.
 * Dados fictícios; relógio em 19/10/2026. Com `CAPTURAS=<pasta>` grava as imagens.
 */

const PAINEL_DO_INICIO = {
  atualizacoesParaRevisar: 0, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 0, alunosAtivos: 3,
  alunosSemRegistro: [], ultimasExecucoes: [], planosTerminando: [],
  pastasARenovar: 0, pastasParaRenovar: [], alunosSemPastaComPeriodo: 0, alunosSemRegistroTotal: 0, alunosSemAcesso: 0, alunosInativos: 0,
  sessoesConcluidas7Dias: 0,
};
const PARCIAL: Painel = {
  ...PAINEL_VAZIO,
  historicoFinanceiroParcial: true,
  // Zero de verdade nos três meses: o gráfico do Recebido mostra a marca "R$ 0", não barras.
  serie: ['2026-08', '2026-09', '2026-10'].map((mes) => ({
    mes, parcial: mes === '2026-10', recebidoCentavos: 0, previstoCentavos: 0, entradasAvulsasCentavos: 0, saidasAvulsasCentavos: 0, resultadoCentavos: 0,
  })),
};

const capturar = async (page: Page, nome: string) => {
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/${nome}.png`, fullPage: true });
};

async function abrirInicio(page: Page, extra: Parameters<typeof simularApi>[1] = {}, largura = 1280) {
  await page.setViewportSize({ width: largura, height: 1100 });
  await fixarHoje(page);
  const api = await simularApi(page, {
    ...(await sessaoComFinanceiro(page, ['FINANCEIRO_LER', 'FINANCEIRO_ALTERAR', 'ALUNO_LER', 'PAINEL_VER'])),
    ...rotasDoFinanceiro(estadoFinanceiro({ painel: PARCIAL })),
    'GET /painel': { corpo: PAINEL_DO_INICIO },
    ...extra,
  });
  await page.goto('/treinador');
  await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
  return api;
}

/** Abre o "Editar", desliga os blocos pedidos e salva. */
async function ocultar(page: Page, blocos: string[]) {
  await page.getByRole('button', { name: 'Editar os blocos do Início' }).click();
  for (const b of blocos) await page.getByRole('switch', { name: `${b} aparece no Início` }).click();
  await page.getByRole('button', { name: 'Salvar o Início' }).click();
  await expect(page.getByRole('button', { name: 'Salvar o Início' })).toHaveCount(0);
}

test('Financeiro oculto no "Editar" e Recebido visível: a ressalva aparece uma vez, no Recebido', async ({ page }) => {
  const { errosDaPagina } = await abrirInicio(page);
  // Padrão: os dois visíveis, a ressalva fica no Financeiro, uma vez.
  await expect(page.getByText(AVISO_HISTORICO_PARCIAL, { exact: true })).toHaveCount(1);
  await ocultar(page, ['Financeiro']);
  await expect(page.getByRole('heading', { name: 'Financeiro', level: 2 })).toHaveCount(0);
  const recebido = page.getByRole('heading', { name: 'Recebido e lançamentos', level: 2 });
  await expect(recebido).toBeVisible();
  await expect(page.getByText(AVISO_HISTORICO_PARCIAL, { exact: true })).toHaveCount(1);
  // O aviso está dentro do bloco do Recebido: o menor ancestral do título que contém o aviso tem só esse título de bloco.
  const dono = recebido.locator(`xpath=ancestor::*[.//text()[normalize-space()="${AVISO_HISTORICO_PARCIAL}"]][1]`);
  await expect(dono.getByRole('heading', { level: 2 })).toHaveCount(1);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await capturar(page, 'inicio-financeiro-oculto-ressalva-no-recebido-1280');
  expect(errosDaPagina).toEqual([]);
});

test('Financeiro e Recebido ocultos: nenhuma ressalva no Início', async ({ page }) => {
  const { errosDaPagina } = await abrirInicio(page);
  await ocultar(page, ['Financeiro', 'Recebido e lançamentos']);
  await expect(page.getByRole('heading', { name: 'Financeiro', level: 2 })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Recebido e lançamentos', level: 2 })).toHaveCount(0);
  await expect(page.getByText(AVISO_HISTORICO_PARCIAL, { exact: true })).toHaveCount(0);
  await expect(page.getByText(/limpeza anterior/)).toHaveCount(0);
  await capturar(page, 'inicio-financeiro-e-recebido-ocultos-1280');
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [1280, 390]) {
  test(`Recebido com zero de verdade: marca "R$ 0" no gráfico, uma por série e mês, sem barra preenchida (${largura})`, async ({ page }) => {
    const { errosDaPagina } = await abrirInicio(page, {}, largura);
    const grafico = page.getByRole('img', { name: /^Recebido \(bruto\) e .* por mês, de/ });
    await expect(grafico).toBeVisible();
    // Eixo (1) + recebido e lançamentos de cada um dos três meses zerados (6).
    await expect(grafico.locator('svg text', { hasText: /^R\$ 0$/ })).toHaveCount(7);
    await expect(grafico.locator('svg rect')).toHaveCount(0);
    await grafico.scrollIntoViewIfNeeded();
    await capturar(page, `inicio-recebido-zero-${largura}`);
    expect(errosDaPagina).toEqual([]);
  });
}

test('financeiro desligado na plataforma (503): os cartões do Início dizem "Recurso desativado", sem zero e sem "Não carregou"', async ({ page }) => {
  const desligado = (_p: unknown, route: Parameters<typeof json>[0]) => json(route, erroApi(503, 'Indisponível.', 'FINANCEIRO_INDISPONIVEL').corpo, 503);
  const { errosDaPagina } = await abrirInicio(page, {
    'GET /financeiro/inadimplentes': desligado, 'GET /financeiro/painel': desligado, 'GET /financeiro/cobrancas': desligado,
  });
  await expect(page.getByText('Recurso desativado', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Não carregou', { exact: true })).toHaveCount(0);
  await expect(page.getByText(AVISO_HISTORICO_PARCIAL, { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Recebido no mês, valor bruto: R$ 0')).toHaveCount(0);
  await capturar(page, 'inicio-recurso-desativado-1280');
  expect(errosDaPagina.filter((e) => !/503/.test(e))).toEqual([]);
});
