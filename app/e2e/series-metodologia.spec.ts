import { expect, test, type Page } from '@playwright/test';
import type { Configuracao, Receita, Serie } from '../src/api/tipos';
import { CONFIGURACAO_PADRAO } from '../src/dominio/metodologiaPadrao';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

// Só modelos e prescrições fictícios; nenhuma chamada chega ao banco.
async function modelo(page: Page, tipo: Receita['tipo']) {
  let atual: Receita = { id: 'm0000000-0000-4000-8000-000000000001', tipo, nome: 'Modelo de teste', descricao: null, pastaId: null, ordem: 1, versao: 1,
    conteudo: tipo === 'METODOLOGIA' ? structuredClone(CONFIGURACAO_PADRAO) : { series: [{ tipo: 'WS', repsMin: 3, repsMax: 6, intensidade: { modo: 'CARGA_TRABALHO', rir: 1 }, descansoSegundos: null, tecnica: null }] } };
  const { pedidos, errosDaPagina, naoTratadas } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /receitas/${atual.id}`]: (_p, route) => json(route, atual),
    'GET /receitas': { corpo: [{ ...atual, tipo: 'METODOLOGIA', conteudo: CONFIGURACAO_PADRAO }] },
    [`PUT /receitas/${atual.id}`]: (p, route) => { atual = { ...atual, ...p.corpo as Receita, versao: atual.versao + 1 }; return json(route, atual); },
  });
  await page.goto(`/treinador/planejamento/modelo/${atual.id}`);
  await expect(page.getByRole('button', { name: 'Salvar modelo', exact: true })).toBeVisible();
  return { pedidos, errosDaPagina, naoTratadas, salvo: () => atual };
}

for (const largura of [390, 1280]) {
  test(`metodologia: editar regra em faixa e padrão da técnica (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modelo(page, 'METODOLOGIA');
    await page.getByRole('button', { name: 'FS, recolhido', exact: true }).click();
    await expect(page.getByText('Regra de percentuais por quantidade', { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: '1ª mín. (%)', exact: true }).first().fill('80');
    await page.getByRole('textbox', { name: '1ª máx. (%)', exact: true }).first().fill('90');
    await page.getByRole('button', { name: 'Rest pause, recolhido', exact: true }).click();
    await page.getByRole('textbox', { name: 'Pausa (s)', exact: true }).fill('25');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('tela-editada.png'), fullPage: true });
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const salvo = api.salvo().conteudo as Configuracao;
    expect(salvo.tipos[1].regraPercentuais!['1']).toEqual([{ min: 80, max: 90 }]);
    expect(salvo.tecnicas[0].padrao).toMatchObject({ pausaSegundos: 25, pausas: 1 });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
  test(`séries: técnica sem tipo, prévia e cluster 4+2 persistidos (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modelo(page, 'SERIES');
    await page.getByRole('button', { name: 'Adicionar série', exact: true }).click();
    await page.getByRole('button', { name: 'Só técnica', exact: true }).click();
    await page.getByRole('button', { name: 'Rest pause', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await expect(page.getByText(/Para o aluno:.*mesma carga da WS/)).toBeVisible();
    await page.getByRole('button', { name: 'Cluster', exact: true }).click();
    await page.getByRole('textbox', { name: 'Blocos de repetições', exact: true }).fill('4+2');
    await expect(page.getByRole('textbox', { name: 'Reps mín.', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /1x6 \(4\+2\) - Cluster 15 s/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('tela-editada.png'), fullPage: true });
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const series = (api.salvo().conteudo as { series: Serie[] }).series;
    expect(series[1]).toMatchObject({ tipo: null, repsMin: 6, repsMax: 6, intensidade: { modo: 'MESMA_CARGA' }, tecnica: { tipo: 'CLUSTER', blocos: [4, 2] } });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}
