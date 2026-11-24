import { expect, test, type Page } from '@playwright/test';

import type { VisaoGeralDoFinanceiro } from '../src/api/financeiroTipos';
import { ALUNO, simularApi, TREINADOR } from './api-falsa';
import { fixarHoje } from './aluno';
import { estadoFinanceiro, rotasDoFinanceiro, sessaoComFinanceiro } from './financeiro-falso';

/**
 * Visão geral › "Encerraram sem renovar" (23/11): parcela única ativa que passou do término há até 30 dias aparece num grupo
 * à parte, dentro do cartão "Renovações próximas", abaixo dos números, com a data do término num selo âmbar e a ficha do
 * aluno como destino. Sem ninguém, o grupo não existe. `CAPTURAS` aponta a pasta das capturas. Relógio em 19/10/2026; só
 * dados fictícios, API simulada.
 */

const COM_GRUPO: VisaoGeralDoFinanceiro = {
  renovacoesProximasCount: 1, renovacoesProximasCentavos: 30_000, projecaoAnualCentavos: 120_000,
  encerraramSemRenovarCount: 2,
  encerraramSemRenovar: [
    { contratacaoId: 'c1', alunoId: ALUNO.id, alunoNome: 'Aluno Fictício Um', terminoVigencia: '2026-10-16', valorCentavos: 70_000 },
    { contratacaoId: 'c2', alunoId: 'a2000000-0000-4000-8000-000000000002', alunoNome: 'Aluno Fictício Dois', terminoVigencia: '2026-09-25', valorCentavos: 45_000 },
  ],
};
const SEM_GRUPO: VisaoGeralDoFinanceiro = { ...COM_GRUPO, encerraramSemRenovarCount: 0, encerraramSemRenovar: [] };

async function abrir(page: Page, largura: number, tema: 'CLARO' | 'ESCURO', renovacoes: VisaoGeralDoFinanceiro) {
  await page.setViewportSize({ width: largura, height: 900 });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
  await fixarHoje(page);
  const estado = estadoFinanceiro({ renovacoes });
  const api = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro');
  await expect(page.getByText('Renovações próximas')).toBeVisible();
  return api;
}

for (const [largura, tema] of [[1280, 'CLARO'], [1280, 'ESCURO'], [390, 'CLARO'], [390, 'ESCURO']] as const) {
  test(`${largura}px (${tema.toLowerCase()}): o grupo "Encerraram sem renovar" fica abaixo das renovações, com a data do término em âmbar`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura, tema, COM_GRUPO);
    const grupo = page.getByTestId('encerraram-sem-renovar');
    await expect(grupo).toBeVisible();
    await expect(grupo.getByRole('heading', { name: 'Encerraram sem renovar' })).toBeVisible();
    await expect(grupo.getByText('2 planos', { exact: true })).toBeVisible();
    await expect(grupo.getByText('Encerrado em 16/10/2026', { exact: true })).toBeVisible();
    await expect(grupo.getByText('Encerrado em 25/09/2026', { exact: true })).toBeVisible();
    await expect(grupo.getByText('R$ 700,00', { exact: true })).toBeVisible();
    // Os dois grupos não se misturam: a contagem das renovações continua a dela, acima do grupo.
    const renovar = await page.getByText('1 plano', { exact: true }).first().boundingBox();
    expect(renovar!.y).toBeLessThan((await grupo.boundingBox())!.y);
    await expect(grupo.getByRole('link', { name: /Abrir ficha de Aluno Fictício Um/ })).toHaveAttribute('href', `/treinador/alunos/${ALUNO.id}?aba=ficha`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (process.env.CAPTURAS) {
      await page.getByTestId('linha-previsoes').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${process.env.CAPTURAS}/visao-geral-encerraram-${largura}-${tema.toLowerCase()}.png` });
    }
    expect(errosDaPagina).toEqual([]);
  });
}

test('sem ninguém que tenha encerrado, o grupo não aparece (nada de cartão vazio)', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, 'CLARO', SEM_GRUPO);
  await expect(page.getByText('Renovações próximas')).toBeVisible();
  await expect(page.getByTestId('encerraram-sem-renovar')).toHaveCount(0);
  await expect(page.getByText('Encerraram sem renovar')).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});
