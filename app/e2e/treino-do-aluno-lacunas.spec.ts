import { expect, test, type Page } from '@playwright/test';

import type { AnterioresDoPacote, PainelAluno, ProgressoPonto, RecordesDoPacote, SessoesConcluidasResponse } from '../src/api/tipos';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';
import { ALUNO, erroApi, json, sessao, simularApi, type RespostasApi } from './api-falsa';

/**
 * Lacunas da tela de treino do aluno (plano `docs/planos/treino-do-aluno-lacunas-cbum.md`): "Equipamentos para hoje"
 * na tela do dia (item 3, D3) e a folha "Histórico" do exercício (item 2, D2). Dados fictícios, relógio em 19/10/2026.
 */
const LISTA = '/aluno/sessao/sx?data=2026-10-19';
const EXERCICIO = '/aluno/sessao/sx/sxe1?data=2026-10-19';
const RECORDES: RecordesDoPacote = {
  ate: '2026-10-19',
  exercicios: { x1: { maiorCarga: 62.5, maiorVolume: 600, repeticoesPorCarga: [{ carga: 60, repeticoes: 10 }, { carga: 62.5, repeticoes: 6 }] } },
};
const ANTERIORES: AnterioresDoPacote = {
  ate: '2026-10-19',
  exercicios: { x1: { data: '2026-10-16', series: [{ tipo: 'WORKING', ordem: 1, carga: 60, repeticoes: 10, etapas: null }] } },
};
const PONTOS: ProgressoPonto[] = [
  { data: '2026-10-09', maiorCargaTrabalho: 57.5, repeticoes: 10 },
  { data: '2026-10-16', maiorCargaTrabalho: 60, repeticoes: 10 },
];

async function abrir(page: Page, opcoes: { equipamentos?: (string | null)[]; retorno?: boolean; progresso?: RespostasApi[string]; objetivoEOrientacoes?: { objetivo: string; orientacoes: string } } = {}) {
  await fixarHoje(page);
  const equipamentos = opcoes.equipamentos ?? [null, null];
  const sessoes = [sessaoFalsa('sx', 'Treino curto', 1, equipamentos.length)];
  sessoes[0]!.exercicios = sessoes[0]!.exercicios.map((e, i) => ({
    ...e, exercicioId: `x${i + 1}`, nome: i === 0 ? 'Supino de teste' : `Remada de teste ${i}`, equipamento: equipamentos[i] ?? null,
  }));
  const base = await sessaoDeAlunoComTreino(page, sessoes);
  const painel = (base['GET /aluno/painel'] as { corpo: PainelAluno }).corpo;
  const retorno = opcoes.retorno ?? true;
  return simularApi(page, {
    ...base,
    ...(retorno ? await sessao(page, ALUNO, { retornoHabilitado: true }) : {}),
    'GET /aluno/painel': {
      corpo: {
        ...painel,
        treino: painel.treino && opcoes.objetivoEOrientacoes ? { ...painel.treino, conteudo: { ...painel.treino.conteudo, ...opcoes.objetivoEOrientacoes } } : painel.treino,
        ultimasCargas: { x1: { carga: 60, repeticoes: 10, data: '2026-10-16' } },
        ...(retorno ? { recordes: RECORDES, anteriores: ANTERIORES } : {}),
      },
    },
    'GET /aluno/progresso': opcoes.progresso ?? { corpo: PONTOS },
    ...(retorno ? { 'GET /aluno/sessoes-concluidas': { corpo: { totalConcluidos: 0, sessoes: [] } satisfies SessoesConcluidasResponse } } : {}),
    'POST /aluno/execucoes/lote': (p, route) => {
      const lote = (p.corpo as { registros: { id: string }[] }).registros;
      return json(route, { resultados: lote.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) });
    },
  });
}

const abrirHistorico = (page: Page) => page.getByRole('button', { name: 'Histórico de Supino de teste', exact: true }).click();
const folha = (page: Page) => page.getByRole('dialog', { name: 'Histórico', exact: true });

for (const largura of [390, 1280]) {
  test(`equipamentos do dia sem repetir, e a seção some sem equipamento (${largura} px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 844 });
    const api = await abrir(page, { equipamentos: ['Banco reto de teste', 'Halteres de teste', 'banco reto de teste'] });
    await page.goto(LISTA);
    await expect(page.getByText('Equipamentos para hoje', { exact: true })).toBeVisible();
    await expect(page.getByText('Banco reto de teste · Halteres de teste', { exact: true })).toBeVisible();
    // O começar continua sem rolar em 390 × 844.
    await expect(page.getByRole('button', { name: 'Começar treino', exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`equipamentos-${largura}.png`), fullPage: true });
    expect(api.errosDaPagina).toEqual([]);
  });

  test(`histórico do exercício com internet: última vez, recordes e carga por data (${largura} px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await abrir(page);
    await page.goto(EXERCICIO);
    await abrirHistorico(page);
    await expect(folha(page).getByText('Última vez · 16/10/2026', { exact: true })).toBeVisible();
    await expect(folha(page).getByText('60 kg × 10', { exact: true })).toBeVisible();
    await expect(folha(page).getByText('Maior carga', { exact: true })).toBeVisible();
    await expect(folha(page).getByText('62,5 kg', { exact: true })).toBeVisible();
    await expect(folha(page).getByText('10 com 60 kg', { exact: true })).toBeVisible();
    await expect(folha(page).getByText('09/10/2026', { exact: true })).toBeVisible();
    expect(api.pedidos.some((p) => p.caminho === '/aluno/progresso' && p.busca.get('exercicioId') === 'x1')).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`historico-${largura}.png`), fullPage: true });
    expect(api.errosDaPagina).toEqual([]);
  });
}

test('sem equipamento no dia, a seção não aparece', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await abrir(page);
  await page.goto(LISTA);
  await expect(page.getByRole('button', { name: 'Começar treino', exact: true })).toBeVisible();
  await expect(page.getByText('Equipamentos para hoje')).toHaveCount(0);
  expect(api.errosDaPagina).toEqual([]);
});

test('histórico com erro da API: o que veio no pacote fica e a carga por data oferece tentar de novo', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const api = await abrir(page, { progresso: erroApi(500, 'Erro inesperado no servidor.') });
  await page.goto(EXERCICIO);
  await abrirHistorico(page);
  await expect(folha(page).getByText('Última vez · 16/10/2026', { exact: true })).toBeVisible();
  await expect(folha(page).getByRole('button', { name: /Tentar de novo/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('historico-erro-390.png'), fullPage: true });
  expect(api.errosDaPagina).toEqual([]);
});

test('histórico sem conexão: mostra o que veio no pacote e não chama a API', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const api = await abrir(page);
  await page.goto(EXERCICIO);
  await expect(page.getByRole('button', { name: 'Histórico de Supino de teste', exact: true })).toBeVisible();
  await page.context().setOffline(true);
  await abrirHistorico(page);
  await expect(folha(page).getByText(/^Sem conexão\. A carga por data/)).toBeVisible();
  await expect(folha(page).getByText('62,5 kg', { exact: true })).toBeVisible();
  expect(api.pedidos.some((p) => p.caminho === '/aluno/progresso')).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('historico-offline-390.png'), fullPage: true });
  await page.context().setOffline(false);
  expect(api.errosDaPagina).toEqual([]);
});

test('com "Concluir treino" desligado, os recordes somem e a última vez vem da última carga', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const api = await abrir(page, { retorno: false });
  await page.goto(EXERCICIO);
  await abrirHistorico(page);
  await expect(folha(page).getByText('Carga de trabalho: 60 kg × 10 em 16/10/2026', { exact: true })).toBeVisible();
  await expect(folha(page).getByText('Recordes', { exact: true })).toHaveCount(0);
  await expect(folha(page).getByText('Maior carga', { exact: true })).toHaveCount(0);
  expect(api.errosDaPagina).toEqual([]);
});

/** Orientações do treinador (Gustavo, 25/11): no formato da importação da planilha ("Coluna: texto"). Texto fictício. */
const ORIENTACOES = 'Leia antes do primeiro treino.\n\nFS: Série de força, pesada e curta.\n\nWS: Série de trabalho até perto da falha.\n\nCardio: 20 min leves depois do treino.';

for (const largura of [390, 1280]) {
  test(`orientações do treinador: recolhidas com o objetivo à vista; abrir mostra as seções, cada uma fechada (${largura} px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const respostas = await abrir(page, { objetivoEOrientacoes: { objetivo: 'Ganhar força (fictício)', orientacoes: ORIENTACOES } });
    await page.goto('/aluno/treino');
    const cartao = page.getByRole('button', { name: 'Orientações do treinador, recolhido' });
    await expect(cartao).toBeVisible();
    await expect(page.getByText('Objetivo: Ganhar força (fictício)', { exact: true })).toBeVisible();
    await expect(page.getByText('Leia antes do primeiro treino.', { exact: true })).toHaveCount(0);
    await cartao.click();
    await expect(page.getByRole('button', { name: 'Orientações do treinador, expandido' })).toBeVisible();
    await expect(page.getByText('Leia antes do primeiro treino.', { exact: true })).toBeVisible();
    for (const titulo of ['FS', 'WS', 'Cardio']) await expect(page.getByRole('button', { name: titulo, exact: true })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText('Série de força, pesada e curta.', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'FS', exact: true }).click();
    await expect(page.getByRole('button', { name: 'FS', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Série de força, pesada e curta.', { exact: true })).toBeVisible();
    await expect(page.getByText('Série de trabalho até perto da falha.', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`orientacoes-${largura}.png`), fullPage: true });
    expect(respostas.errosDaPagina).toEqual([]);
  });
}
