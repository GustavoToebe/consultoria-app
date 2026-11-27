import { expect, test, type Page } from '@playwright/test';
import { fixarHoje, sessaoComCardio, sessaoComGrupo, sessaoComTopSetEBackOff, sessaoDeAlunoComTreino, fazerSerie } from './aluno';
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
    const peso = (n: number) => page.getByRole('textbox', { name: `Carga da série ${n}, em quilos`, exact: true });
    await page.getByRole('textbox', { name: 'Carga de trabalho de hoje, em quilos', exact: true }).fill('80');
    // O Top set não tem sugestão de carga; o Back off, 90% da WS, fica apagado dentro do campo (que segue vazio).
    await expect(peso(2)).toHaveAttribute('placeholder', '—');
    await expect(peso(3)).toHaveAttribute('placeholder', '72');
    await expect(peso(3)).toHaveValue('');
    await page.getByRole('textbox', { name: 'Repetições da série 1', exact: true }).fill('5');
    // Peso vazio com sugestão: o ✓ grava a sugestão (pedido de 25/11).
    await fazerSerie(page, 1);
    await expect.poll(() => api.enviados.find((r) => r.serieUid === 'ws')?.carga).toBe(80);
    await expect(peso(2)).toHaveValue('');
    await peso(2).fill('100');
    await page.getByRole('textbox', { name: 'Repetições da série 2', exact: true }).fill('3');
    await fazerSerie(page, 2);
    // O Top set registrado (100 kg) não vira a referência do Back off: ele segue partindo da WS (90% de 80).
    await expect(peso(3)).toHaveAttribute('placeholder', '72');
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
    // O cardio antigo (sem `modo`) segue contado em séries; só o novo conta em blocos (aluno-cardio-timer.spec.ts).
    await expect(page.getByText('Séries 0 de 2 feitas', { exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Carga da série|Repetições da série/ })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('cardio-aluno.png'), fullPage: true });
    await page.getByRole('checkbox', { name: 'Marcar cardio da série 1 como feito', exact: true }).click();
    await expect.poll(() => api.enviados.length).toBe(1);
    expect(api.enviados[0]).toMatchObject({ serieUid: 'esteira-s1', exercicioUid: 'esteira', carga: null, repeticoes: null, concluida: true });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}
