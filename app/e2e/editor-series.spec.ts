import { expect, test } from '@playwright/test';
import type { Receita, Serie } from '../src/api/tipos';
import { CONFIGURACAO_PADRAO } from '../src/dominio/metodologiaPadrao';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

for (const largura of [390, 1280]) {
  test(`FS por quantidade e técnica dentro da série WS persistidas (${largura}px)`, async ({ page }, testInfo) => {
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
    await expect(page.getByText('Nenhuma série ainda.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Adicionar série', exact: true }).click();
    // O bloco "Nova série" toma o lugar dos botões de baixo: só um "Adicionar série" na tela.
    await expect(page.getByText('Nova série', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adicionar série', exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: 'FS', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar série', exact: true }).click();
    await page.getByRole('button', { name: 'Uma série completa a mais', exact: true }).click();
    await page.getByRole('button', { name: 'Uma série completa a mais', exact: true }).click();
    const campo = (nome: string) => page.getByRole('textbox', { name: nome, exact: true });
    await expect(campo('Série 1 · % da WS mín. (%)')).toHaveValue('50');
    await expect(campo('Série 2 · % da WS mín. (%)')).toHaveValue('70');
    await expect(campo('Série 3 · % da WS mín. (%)')).toHaveValue('85');
    await expect(campo('Série 3 · % da WS máx. (opcional) (%)')).toHaveValue('90');
    await page.getByRole('button', { name: /3x3 - FS.*aberto/ }).click();
    await page.getByRole('button', { name: 'Adicionar série', exact: true }).click();
    await page.getByRole('button', { name: 'WS', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar série', exact: true }).click();
    await page.getByRole('button', { name: /1x3 a 6 - WS.*aberto/ }).click();
    // A técnica não é um tipo: a série é WS e o rest pause vai dentro dela.
    await page.getByRole('button', { name: 'Adicionar série', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Só técnica', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'WS', exact: true }).click();
    await page.getByRole('button', { name: 'Rest pause', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar série', exact: true }).click();
    await expect(page.getByRole('button', { name: /1x3 a 6 - WS \+ Rest pause.*aberto/ })).toBeVisible();
    await expect(page.getByText('1 série completa · 3 a 6 reps + 1 retomada · pausa de 20 s', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('series-prescritas.png'), fullPage: true });
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const series = (modelo.conteudo as { series: Serie[] }).series;
    expect(series.map((s) => s.tipo)).toEqual(['FEEDER', 'FEEDER', 'FEEDER', 'WORKING', 'WORKING']);
    expect(series.slice(0, 3).map((s) => [s.carga?.percentualMin, s.carga?.percentualMax])).toEqual([[50, null], [70, null], [85, 90]]);
    expect(series[3]).toMatchObject({ carga: { modo: 'CARGA_TRABALHO' }, esforco: { rir: 1 }, tecnica: null });
    expect(series[4]).toMatchObject({ tipo: 'WORKING', carga: { modo: 'CARGA_TRABALHO' }, tecnica: { tipo: 'REST_PAUSE', pausas: 1, pausaSegundos: 20 } });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}

for (const largura of [390, 1280]) {
  test(`Cluster com carga por bloco e Rest-pause com meta das retomadas, salvos e na prévia (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    let modelo: Receita = { id: 'm0000000-0000-4000-8000-000000000004', tipo: 'SERIES', nome: 'Etapas fictícias', descricao: null, pastaId: null, ordem: 1, versao: 1, conteudo: { series: [] } };
    const api = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] })),
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /receitas': { corpo: [{ ...modelo, tipo: 'METODOLOGIA', conteudo: CONFIGURACAO_PADRAO }] },
      [`GET /receitas/${modelo.id}`]: (_p, route) => json(route, modelo),
      [`PUT /receitas/${modelo.id}`]: (p, route) => { modelo = { ...modelo, ...p.corpo as Receita, versao: 2 }; return json(route, modelo); },
    });
    await page.goto(`/treinador/planejamento/modelo/${modelo.id}`);
    const campo = (nome: string) => page.getByRole('textbox', { name: nome, exact: true });

    // WS com Cluster 4 blocos de 4: bloco 1 com a carga da série e os outros a 90% da WS.
    await page.getByRole('button', { name: 'Adicionar série', exact: true }).click();
    await page.getByRole('button', { name: 'WS', exact: true }).click();
    await page.getByRole('button', { name: 'Cluster', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar série', exact: true }).click();
    await campo('Quantos blocos').fill('4');
    await campo('Repetições em cada bloco').fill('4');
    await page.getByRole('switch', { name: 'Personalizar carga por bloco' }).click();
    for (const bloco of [2, 3, 4]) {
      await page.getByRole('radiogroup', { name: `Bloco ${bloco} (4 reps)` }).getByRole('button', { name: '% da WS', exact: true }).click();
      await campo(`Bloco ${bloco} (4 reps): % da WS`).fill('90');
    }
    await expect(page.getByText('Bloco 2: 90% da WS', { exact: true })).toBeVisible();
    await expect(page.getByText('Percentuais da carga de trabalho do dia, fixada ao registrar a primeira etapa.', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('cluster-carga-por-bloco.png'), fullPage: true });
    await page.getByRole('button', { name: /1x16 \(4×4\) - WS com Cluster.*aberto/ }).click();

    // WS com Rest-pause de 2 pausas: retomada 1 com 2 a 3 reps; retomada 2 AMRAP a 85% da WS.
    await page.getByRole('button', { name: 'Adicionar série', exact: true }).click();
    await page.getByRole('button', { name: 'WS', exact: true }).click();
    await page.getByRole('button', { name: 'Rest pause', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar série', exact: true }).click();
    await campo('Quantas pausas').fill('2');
    await page.getByRole('switch', { name: 'Definir a meta das retomadas' }).click();
    const r1 = page.getByRole('radiogroup', { name: 'Retomada 1', exact: true });
    await r1.getByRole('button', { name: 'Faixa', exact: true }).click();
    await campo('Retomada 1: reps mín.').fill('2');
    await campo('Retomada 1: reps máx.').fill('3');
    await page.getByRole('radiogroup', { name: 'Carga da retomada 2' }).getByRole('button', { name: '% da WS', exact: true }).click();
    await campo('Carga da retomada 2: % da WS').fill('85');
    await expect(page.getByText('Retomada 1: 2 a 3 reps, carga da série', { exact: true })).toBeVisible();
    await expect(page.getByText('Retomada 2: AMRAP, 85% da WS', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('rest-pause-retomadas.png'), fullPage: true });

    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const series = (modelo.conteudo as { series: Serie[] }).series;
    expect(series[0].tecnica).toMatchObject({
      tipo: 'CLUSTER', blocos: [4, 4, 4, 4],
      cargasDosBlocos: [{ modo: 'DA_SERIE', percentual: null }, ...[1, 2, 3].map(() => ({ modo: 'PERCENTUAL_WS', percentual: 90 }))],
    });
    expect(series[1].tecnica).toMatchObject({
      tipo: 'REST_PAUSE', pausas: 2,
      retomadas: [
        { repsMin: 2, repsMax: 3, amrap: false, carga: { modo: 'DA_SERIE', percentual: null } },
        { repsMin: null, repsMax: null, amrap: true, carga: { modo: 'PERCENTUAL_WS', percentual: 85 } },
      ],
    });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}
