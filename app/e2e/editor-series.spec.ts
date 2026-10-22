import { expect, test } from '@playwright/test';
import type { Receita, Serie } from '../src/api/tipos';
import { CONFIGURACAO_PADRAO } from '../src/dominio/metodologiaPadrao';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

for (const largura of [390, 1280]) {
  test(`FS por quantidade, técnica depois da WS e prévia persistidas (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    let modelo: Receita = { id: 'm0000000-0000-4000-8000-000000000003', tipo: 'SERIES', nome: 'Séries fictícias', descricao: null, pastaId: null, ordem: 1, versao: 1, conteudo: { series: [] } };
    const api = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] })),
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /receitas': { corpo: [{ ...modelo, tipo: 'METODOLOGIA', conteudo: CONFIGURACAO_PADRAO }] },
      [`GET /receitas/${modelo.id}`]: (_p, route) => json(route, modelo),
      [`PUT /receitas/${modelo.id}`]: (p, route) => { modelo = { ...modelo, ...p.corpo as Receita, versao: 2 }; return json(route, modelo); },
    });
    await page.goto(`/treinador/planejamento/modelo/${modelo.id}`);
    await page.getByRole('button', { name: 'Adicionar série', exact: true }).click();
    await page.getByRole('button', { name: 'FS', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await page.getByRole('button', { name: 'Uma série a mais', exact: true }).click();
    await page.getByRole('button', { name: 'Uma série a mais', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Série 1 mín. (%)', exact: true })).toHaveValue('50');
    await expect(page.getByRole('textbox', { name: 'Série 2 mín. (%)', exact: true })).toHaveValue('70');
    await expect(page.getByRole('textbox', { name: 'Série 3 mín. (%)', exact: true })).toHaveValue('85');
    await expect(page.getByRole('textbox', { name: 'Série 3 máx. (%)', exact: true })).toHaveValue('90');
    await page.getByRole('button', { name: /3x3 - FS.*aberto/ }).click();
    await page.getByRole('button', { name: 'Adicionar série', exact: true }).click();
    await page.getByRole('button', { name: 'WS', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await page.getByRole('button', { name: /1x3 a 6 - WS.*aberto/ }).click();
    await page.getByRole('button', { name: 'Adicionar série', exact: true }).click();
    await page.getByRole('button', { name: 'Só técnica', exact: true }).click();
    await page.getByRole('button', { name: 'Rest pause', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await expect(page.getByText(/Para o aluno:.*mesma carga da WS/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('series-prescritas.png'), fullPage: true });
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const series = (modelo.conteudo as { series: Serie[] }).series;
    expect(series.slice(0, 3).map((s) => [s.intensidade?.percentualMin, s.intensidade?.percentualMax])).toEqual([[50, null], [70, null], [85, 90]]);
    expect(series[4]).toMatchObject({ tipo: null, intensidade: { modo: 'MESMA_CARGA' }, tecnica: { tipo: 'REST_PAUSE', pausas: 1, pausaSegundos: 20 } });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}
