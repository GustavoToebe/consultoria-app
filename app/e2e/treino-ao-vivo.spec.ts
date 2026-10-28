import { expect, test, type Page } from '@playwright/test';

import type { AnterioresDoPacote, PainelAluno, SessoesConcluidasResponse } from '../src/api/tipos';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';
import { ALUNO, json, sessao, simularApi } from './api-falsa';

/**
 * Treino ao vivo (frente Engajamento, passo 0.3): a faixa com duração, volume e séries feitas, e a coluna "Anterior"
 * de cada série, vinda do pacote (sem internet). Exercício fictício da biblioteca ("x1") com três WS; relógio em
 * segunda, 19/10/2026, 12:00. Da última vez (16/10): 60 kg × 10 e 62,5 kg × 8 (a terceira WS não foi feita).
 */
const LISTA = '/aluno/sessao/sx?data=2026-10-19';
const EXERCICIO = '/aluno/sessao/sx/sxe1?data=2026-10-19';
const ANTERIORES: AnterioresDoPacote = {
  ate: '2026-10-19',
  exercicios: {
    x1: {
      data: '2026-10-16',
      series: [
        { tipo: 'WORKING', ordem: 1, carga: 60, repeticoes: 10, etapas: null },
        { tipo: 'WORKING', ordem: 2, carga: 62.5, repeticoes: 8, etapas: null },
      ],
    },
  },
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
    'GET /aluno/painel': { corpo: { ...painel, ultimasCargas: { x1: { carga: 62.5, repeticoes: 8, data: '2026-10-16' } }, ...(ligada ? { anteriores: ANTERIORES } : {}) } },
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
const anterior = (page: Page, n: number, texto: string) => page.getByLabel(`Série ${n} da última vez: ${texto}`, { exact: true });

for (const largura of [390, 1280]) {
  test(`chave ligada (${largura} px): coluna "Anterior" do pacote e faixa com duração, volume e séries`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await abrir(page, true);
    await page.goto(EXERCICIO);

    await expect(page.getByText('Anterior: o que você fez em 16/10.', { exact: true })).toBeVisible();
    await expect(anterior(page, 1, '60 kg × 10')).toBeVisible();
    await expect(anterior(page, 2, '62,5 kg × 8')).toBeVisible();
    // A terceira WS não foi feita da última vez: a linha fica, com "—".
    await expect(anterior(page, 3, 'sem registro')).toBeVisible();

    await expect(page.getByLabel('Duração do treino: sem duração', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Volume: sem carga registrada', { exact: true })).toBeVisible();
    await expect(page.getByLabel('0 de 3 séries feitas', { exact: true })).toBeVisible();

    await peso(page, 1).fill('60');
    await reps(page, 1).fill('10');
    await marcar(page, 1);
    await expect(page.getByLabel('Volume: 600 kg', { exact: true })).toBeVisible();
    await expect(page.getByLabel('1 de 3 séries feitas', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Duração do treino: menos de 1 minuto', { exact: true })).toBeVisible();

    // O relógio anda a partir da primeira série marcada.
    await page.clock.setFixedTime(new Date('2026-10-19T12:05:30-03:00'));
    await expect(page.getByLabel('Duração do treino: 5 minutos', { exact: true })).toBeVisible();
    await expect(page.getByText('5:30', { exact: true })).toBeVisible();

    await peso(page, 2).fill('62,5');
    await reps(page, 2).fill('8');
    await marcar(page, 2);
    await expect(page.getByText('1.100 kg', { exact: true })).toBeVisible();

    // Na lista do dia a mesma faixa, no lugar do "N de M séries feitas".
    await page.goto(LISTA);
    await expect(page.getByLabel('2 de 3 séries feitas', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Volume: 1.100 kg', { exact: true })).toBeVisible();
    expect(api.errosDaPagina).toEqual([]);
  });
}

test('a coluna "Anterior" aparece sem internet (vem no pacote)', async ({ page }) => {
  await abrir(page, true);
  await page.goto(LISTA);
  await expect(page.getByLabel('0 de 3 séries feitas', { exact: true })).toBeVisible();
  await page.context().setOffline(true);
  await page.getByRole('link', { name: /Supino de teste/ }).first().click();
  await expect(anterior(page, 1, '60 kg × 10')).toBeVisible();
  await page.context().setOffline(false);
});

test('chave desligada: sem faixa e sem coluna "Anterior"', async ({ page }) => {
  const api = await abrir(page, false);
  await page.goto(EXERCICIO);
  await expect(peso(page, 1)).toBeVisible();
  await expect(page.getByText('Anterior', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Duração', { exact: true })).toHaveCount(0);
  await page.goto(LISTA);
  await expect(page.getByText('0 de 3 séries feitas', { exact: true })).toBeVisible();
  await expect(page.getByText('Duração', { exact: true })).toHaveCount(0);
  expect(api.errosDaPagina).toEqual([]);
});
