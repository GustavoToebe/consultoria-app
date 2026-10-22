import { expect, test, type Page } from '@playwright/test';
import { fixarHoje, sessaoComCardio, sessaoComGrupo, sessaoComTopSetEBackOff, sessaoDeAlunoComTreino } from './aluno';
import { json, simularApi } from './api-falsa';
import type { RegistroEnvio, Sessao } from '../src/api/tipos';

// Treino fictício do aluno, a API simulada e o relógio fixado em segunda, 19/10/2026.
async function abrir(page: Page, sessoes: Sessao[], caminho: string) {
  await fixarHoje(page);
  const enviados: RegistroEnvio[] = [];
  const api = await simularApi(page, {
    ...(await sessaoDeAlunoComTreino(page, sessoes)),
    'POST /aluno/execucoes/lote': (p, route) => {
      const lote = (p.corpo as { registros: RegistroEnvio[] }).registros;
      enviados.push(...lote);
      return json(route, { resultados: lote.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) });
    },
  });
  await page.goto(caminho);
  return { ...api, enviados };
}

for (const largura of [390, 1280]) {
  test(`aluno: Top set e Back off por referência mostram a carga calculada (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await abrir(page, sessaoComTopSetEBackOff(), '/aluno/sessao/topo/agacho?data=2026-10-19');
    const peso = (n: number) => page.getByRole('textbox', { name: `Peso da série ${n}, em quilos`, exact: true });
    await page.getByRole('textbox', { name: 'Carga de trabalho do dia', exact: true }).fill('80');
    // Sem a carga do Top set registrada, o Back off não tem de onde calcular.
    await expect(peso(3)).toHaveValue('');
    await page.getByRole('textbox', { name: 'Repetições da série 1', exact: true }).fill('5');
    await page.getByRole('checkbox', { name: 'Série 1 feita', exact: true }).click();
    // O Top set sobe 5% sobre a anterior (80 kg): 84 kg.
    await expect(peso(2)).toHaveValue('84');
    await peso(2).fill('100');
    await page.getByRole('textbox', { name: 'Repetições da série 2', exact: true }).fill('3');
    await page.getByRole('checkbox', { name: 'Série 2 feita', exact: true }).click();
    // Back off = 10% abaixo dos 100 kg do Top set.
    await expect(peso(3)).toHaveValue('90');
    await expect(page.getByText(/10% abaixo/).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('top-set-back-off.png'), fullPage: true });
    await expect.poll(() => api.enviados.find((r) => r.serieUid === 'top')?.carga).toBe(100);
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}

for (const largura of [390, 1280]) {
  test(`aluno: grupo mostra o cabeçalho e o descanso depois do grupo (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await abrir(page, sessaoComGrupo(), '/aluno/sessao/grupo?data=2026-10-19');
    await expect(page.getByRole('button', { name: 'Explicação de Superset', exact: true })).toBeVisible();
    await expect(page.getByText('2 exercícios, nesta ordem: Supino de teste → Remada de teste · descanso de 1 min 30 s depois de cada volta do grupo', { exact: true })).toBeVisible();
    // O descanso de 60 s por série só aparece no exercício solto; nos do grupo vale o descanso depois da volta.
    await expect(page.getByText('descanso 60 s', { exact: true })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('grupo-na-lista.png'), fullPage: true });
    await page.goto('/aluno/sessao/grupo/sup?data=2026-10-19');
    await expect(page.getByText('Exercício 1 de 2', { exact: false })).toBeVisible();
    await expect(page.getByText('Depois: Remada de teste', { exact: false })).toBeVisible();
    await expect(page.getByText(/Descanso 1 min/)).toHaveCount(0);
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`aluno: cardio só tem "feito", sem peso nem repetições (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await abrir(page, sessaoComCardio(), '/aluno/sessao/cardio/esteira?data=2026-10-19');
    await expect(page.getByText('Duração: 30 min', { exact: false })).toBeVisible();
    await expect(page.getByText('Zona: 2', { exact: false })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Peso da série|Repetições da série/ })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('cardio-aluno.png'), fullPage: true });
    await page.getByRole('checkbox', { name: 'Cardio da série 1 feito', exact: true }).click();
    await expect.poll(() => api.enviados.length).toBe(1);
    expect(api.enviados[0]).toMatchObject({ serieUid: 'esteira-s1', exercicioUid: 'esteira', carga: null, repeticoes: null, concluida: true });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}
