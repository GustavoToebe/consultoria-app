import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import type { PainelAluno, RecordesDoPacote, RegistroSessaoConcluidaEnvio, SessoesConcluidasResponse } from '../src/api/tipos';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';
import { ALUNO, json, sessao, simularApi } from './api-falsa';

/**
 * "Bom trabalho!" e cartão para compartilhar (frente Engajamento, passo 0.4). Exercício fictício da biblioteca ("x1")
 * com três WS; relógio em segunda, 19/10/2026, 12:00. O servidor já tem 11 treinos concluídos (um deles em 05/10) e o
 * pacote diz que o melhor de antes é 60 kg × 10.
 */
const VERSAO = 't0000000-0000-4000-8000-000000000002';
const LISTA = '/aluno/sessao/sx?data=2026-10-19';
const EXERCICIO = '/aluno/sessao/sx/sxe1?data=2026-10-19';
const CONCLUIDO = '/aluno/sessao/sx/concluido?data=2026-10-19';
const RECORDES: RecordesDoPacote = {
  ate: '2026-10-19',
  exercicios: { x1: { maiorCarga: 60, maiorVolume: 600, repeticoesPorCarga: [{ carga: 60, repeticoes: 10 }] } },
};

async function abrir(page: Page, ligada = true) {
  await fixarHoje(page);
  const conclusoes: RegistroSessaoConcluidaEnvio[] = [];
  const sessoes = [sessaoFalsa('sx', 'Treino curto', 1, 1)];
  sessoes[0]!.exercicios[0] = { ...sessoes[0]!.exercicios[0]!, exercicioId: 'x1', nome: 'Supino de teste' };
  const base = await sessaoDeAlunoComTreino(page, sessoes);
  const painel = (base['GET /aluno/painel'] as { corpo: PainelAluno }).corpo;
  const api = await simularApi(page, {
    ...base,
    ...(ligada ? await sessao(page, ALUNO, { retornoHabilitado: true }) : {}),
    'GET /aluno/painel': { corpo: { ...painel, marca: { ...painel.marca, corPrimaria: '#C62828' }, ...(ligada ? { recordes: RECORDES } : {}) } },
    'POST /aluno/execucoes/lote': (p, route) => {
      const lote = (p.corpo as { registros: { id: string }[] }).registros;
      return json(route, { resultados: lote.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) });
    },
    ...(ligada
      ? {
          'GET /aluno/sessoes-concluidas': {
            corpo: {
              totalConcluidos: 11,
              sessoes: [{ planoVersaoId: VERSAO, sessaoUid: 'sa', data: '2026-10-05', concluida: true, resultado: 'COMPLETA', duracaoSegundos: 3000, comentario: null }],
            } satisfies SessoesConcluidasResponse,
          },
          'POST /aluno/sessoes-concluidas': (p, route) => {
            const lote = (p.corpo as { registros: RegistroSessaoConcluidaEnvio[] }).registros;
            conclusoes.push(...lote);
            return json(route, { resultados: lote.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) });
          },
        }
      : {}),
  });
  return { ...api, conclusoes };
}

const peso = (page: Page, n: number) => page.getByRole('textbox', { name: `Peso da série ${n}, em quilos`, exact: true });
const reps = (page: Page, n: number) => page.getByRole('textbox', { name: `Repetições da série ${n}`, exact: true });
const marcar = (page: Page, n: number) => page.getByRole('checkbox', { name: `Série ${n} feita`, exact: true }).click();
const folha = (page: Page) => page.getByRole('dialog', { name: 'Concluir treino' });
const cartao = (page: Page) => page.getByRole('img', { name: /^Cartão do treino/ });

for (const largura of [390, 1280]) {
  test(`concluir abre o "Bom trabalho!" com número, resumo, recorde e o cartão para baixar (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await abrir(page);
    await page.goto(EXERCICIO);

    await peso(page, 1).fill('62,5');
    await reps(page, 1).fill('10');
    await marcar(page, 1);
    await page.getByRole('button', { name: 'Fechar aviso de recorde' }).click();
    for (const n of [2, 3]) {
      await peso(page, n).fill('50');
      await reps(page, n).fill('8');
      await marcar(page, n);
    }
    await page.clock.setFixedTime(new Date('2026-10-19T12:45:00-03:00'));
    await page.getByRole('button', { name: 'Concluir treino', exact: true }).last().click();
    await folha(page).getByRole('button', { name: 'Concluir treino', exact: true }).click();

    await expect(page).toHaveURL(/\/aluno\/sessao\/sx\/concluido\?data=2026-10-19$/);
    await expect(page.getByRole('heading', { name: 'Bom trabalho!' })).toBeVisible();
    await expect(page.getByText('Este é o seu 12º treino.', { exact: true })).toBeVisible();
    await expect(page.getByText('Fiz tudo · 45 min', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Volume: 1.425 kg', { exact: true })).toBeVisible();
    await expect(page.getByText('Supino de teste: Maior carga · 62,5 kg', { exact: true })).toBeVisible();
    await expect(page.getByText('Supino de teste: Maior volume · 625 kg', { exact: true })).toBeVisible();

    // Cartão: número, treino, dias do mês (05/10 do servidor e hoje); o volume só entra se o aluno ligar.
    await expect(cartao(page)).toHaveAttribute('aria-label', 'Cartão do treino: 12º treino, Segunda · Treino curto · 19/10. 2 dias treinados em outubro.');
    await page.getByRole('switch', { name: 'Mostrar o volume no cartão' }).click();
    await expect(cartao(page)).toHaveAttribute('aria-label', /2 dias treinados em outubro\. Volume: 1\.425 kg\.$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const baixando = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar imagem' }).click();
    const arquivo = await baixando;
    expect(arquivo.suggestedFilename()).toBe('treino-2026-10-19.png');
    const bytes = readFileSync((await arquivo.path())!);
    // PNG de verdade (assinatura) e 1080 × 1920 (cabeçalho IHDR).
    expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(bytes.readUInt32BE(16)).toBe(1080);
    expect(bytes.readUInt32BE(20)).toBe(1920);

    await expect.poll(() => api.conclusoes.length, { timeout: 15_000 }).toBe(1);
    expect(api.naoTratadas).toEqual([]);
    expect(api.errosDaPagina).toEqual([]);
  });
}

test('"Ver resumo" no treino concluído leva de volta ao "Bom trabalho!"', async ({ page }) => {
  const api = await abrir(page);
  await page.goto(LISTA);
  await page.getByRole('button', { name: 'Concluir treino', exact: true }).first().click();
  await folha(page).getByRole('textbox', { name: 'Duração em minutos', exact: true }).fill('40');
  await folha(page).getByRole('button', { name: 'Concluir treino', exact: true }).click();
  await expect(page).toHaveURL(/\/concluido\?data=2026-10-19$/);
  // Sem série marcada: sem recorde e sem volume.
  await expect(page.getByText(/Maior carga/)).toHaveCount(0);
  await expect(page.getByLabel('Volume: sem carga registrada', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/aluno\/sessao\/sx\?data=2026-10-19$/);
  await page.getByRole('button', { name: 'Ver o resumo do treino' }).first().click();
  await expect(page).toHaveURL(/\/concluido\?data=2026-10-19$/);
  await expect(page.getByText('Fiz em parte · 40 min', { exact: true })).toBeVisible();
  expect(api.errosDaPagina).toEqual([]);
});

test('sem treino concluído (ou com a chave desligada) a tela só manda de volta', async ({ page }) => {
  await abrir(page, false);
  await page.goto(CONCLUIDO);
  await expect(page.getByText('Este treino não está concluído. Volte à lista do dia para concluir.')).toBeVisible();
  await expect(cartao(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Voltar à lista do dia' }).click();
  await expect(page).toHaveURL(/\/aluno\/sessao\/sx\?data=2026-10-19$/);
});
