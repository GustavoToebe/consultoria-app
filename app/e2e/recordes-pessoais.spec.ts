import { expect, test, type Page } from '@playwright/test';

import type { PainelAluno, RecordesDoPacote, SessoesConcluidasResponse } from '../src/api/tipos';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';
import { ALUNO, json, sessao, simularApi } from './api-falsa';

/**
 * Recordes pessoais (frente Engajamento, passo 0.2): o pacote traz os melhores de antes de hoje e o app decide, na hora
 * em que a série é marcada, se é recorde. Exercício fictício da biblioteca ("x1") com três séries simples, relógio em
 * segunda, 19/10/2026. Antes: 60 kg × 10 (600 de volume).
 */
const LISTA = '/aluno/sessao/sx?data=2026-10-19';
const EXERCICIO = '/aluno/sessao/sx/sxe1?data=2026-10-19';
const RECORDES: RecordesDoPacote = {
  ate: '2026-10-19',
  exercicios: { x1: { maiorCarga: 60, maiorVolume: 600, repeticoesPorCarga: [{ carga: 60, repeticoes: 10 }] } },
};

async function abrir(page: Page, ligada: boolean) {
  await fixarHoje(page);
  const sessoes = [sessaoFalsa('sx', 'Treino curto', 1, 1)];
  sessoes[0]!.exercicios[0] = { ...sessoes[0]!.exercicios[0]!, exercicioId: 'x1', nome: 'Supino de teste' };
  const base = await sessaoDeAlunoComTreino(page, sessoes);
  const painel = (base['GET /aluno/painel'] as { corpo: PainelAluno }).corpo;
  return simularApi(page, {
    ...base,
    ...(ligada ? await sessao(page, ALUNO, { retornoHabilitado: true }) : {}),
    'GET /aluno/painel': { corpo: { ...painel, ultimasCargas: { x1: { carga: 60, repeticoes: 10, data: '2026-10-16' } }, ...(ligada ? { recordes: RECORDES } : {}) } },
    'POST /aluno/execucoes/lote': (p, route) => {
      const lote = (p.corpo as { registros: { id: string }[] }).registros;
      return json(route, { resultados: lote.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) });
    },
    ...(ligada ? { 'GET /aluno/sessoes-concluidas': { corpo: { totalConcluidos: 0, sessoes: [] } satisfies SessoesConcluidasResponse } } : {}),
  });
}

const peso = (page: Page, n: number) => page.getByRole('textbox', { name: `Peso da série ${n}, em quilos`, exact: true });
const reps = (page: Page, n: number) => page.getByRole('textbox', { name: `Repetições da série ${n}`, exact: true });
const marcar = (page: Page, n: number) => page.getByRole('checkbox', { name: `Série ${n} feita`, exact: true }).click();
const aviso = (page: Page) => page.getByRole('status').filter({ hasText: 'Recorde pessoal' });

for (const largura of [390, 1280]) {
  test(`chave ligada (${largura} px): aviso no topo ao marcar, medalha na série e contagem no resumo`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await abrir(page, true);
    await page.goto(EXERCICIO);

    // Série 1: 62,5 kg × 10 bate a maior carga e o maior volume.
    await peso(page, 1).fill('62,5');
    await reps(page, 1).fill('10');
    await marcar(page, 1);
    await expect(aviso(page)).toBeVisible();
    await expect(aviso(page)).toContainText('Supino de teste');
    await expect(aviso(page)).toContainText('Maior carga · 62,5 kg');
    await expect(aviso(page)).toContainText('Maior volume · 625 kg');
    await expect(page.getByLabel(/Série 1, recorde pessoal: Maior carga · 62,5 kg/)).toBeVisible();
    await page.getByRole('button', { name: 'Fechar aviso de recorde' }).click();
    await expect(aviso(page)).toHaveCount(0);

    // Série 2: 60 kg × 9 não bate nada (nem a série 1 de hoje): sem aviso e sem medalha.
    await peso(page, 2).fill('60');
    await reps(page, 2).fill('9');
    await marcar(page, 2);
    await expect(page.getByRole('checkbox', { name: 'Série 2 feita', exact: true })).toBeChecked();
    await expect(aviso(page)).toHaveCount(0);
    await expect(page.getByText('Série 2', { exact: true })).toBeVisible();
    await expect(page.getByText(/2 de 3 séries feitas neste treino\. 1 recorde pessoal\./)).toBeVisible();

    await page.goto(LISTA);
    await expect(page.getByText('1 recorde pessoal neste treino', { exact: true })).toBeVisible();
    expect(api.errosDaPagina).toEqual([]);
  });
}

test('sem internet o aviso aparece do mesmo jeito (decisão no aparelho, P10)', async ({ page }) => {
  await abrir(page, true);
  await page.goto(EXERCICIO);
  await expect(peso(page, 1)).toBeVisible();
  await page.context().setOffline(true);
  await peso(page, 1).fill('65');
  await reps(page, 1).fill('5');
  await marcar(page, 1);
  await expect(aviso(page)).toContainText('Maior carga · 65 kg');
  await page.context().setOffline(false);
});

test('chave desligada: o pacote não traz a lista e nada de recorde aparece', async ({ page }) => {
  const api = await abrir(page, false);
  await page.goto(EXERCICIO);
  await peso(page, 1).fill('80');
  await reps(page, 1).fill('10');
  await marcar(page, 1);
  await expect(page.getByRole('checkbox', { name: 'Série 1 feita', exact: true })).toBeChecked();
  await expect(aviso(page)).toHaveCount(0);
  await expect(page.getByText('Recorde', { exact: true })).toHaveCount(0);
  await page.goto(LISTA);
  await expect(page.getByText(/recorde pessoal/)).toHaveCount(0);
  expect(api.errosDaPagina).toEqual([]);
});
