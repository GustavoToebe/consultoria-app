import { expect, test, type Page } from '@playwright/test';
import type { Configuracao, Receita, Serie } from '../src/api/tipos';
import { CONFIGURACAO_PADRAO } from '../src/dominio/metodologiaPadrao';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

// Só modelos e prescrições fictícios; nenhuma chamada chega ao banco.
const serieInicial: Serie = {
  uid: 'serie-inicial', tipo: 'WORKING', repsMin: 3, repsMax: 6, carga: { modo: 'CARGA_TRABALHO', percentualMin: null, percentualMax: null, referenciaUid: null },
  esforco: { rir: 1, rpe: null }, descansoSegundos: null, tecnica: null,
};

async function modelo(page: Page, tipo: Receita['tipo']) {
  let atual: Receita = { id: 'm0000000-0000-4000-8000-000000000001', tipo, nome: 'Modelo de teste', descricao: null, pastaId: null, ordem: 1, versao: 1,
    conteudo: tipo === 'METODOLOGIA' ? structuredClone(CONFIGURACAO_PADRAO) : { series: [serieInicial] } };
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

  test(`séries: técnica dentro da série WS, prévia e cluster 4+2 persistidos (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modelo(page, 'SERIES');
    await page.getByRole('button', { name: 'Adicionar série', exact: true }).click();
    // Não existe mais "Só técnica": a técnica é uma escolha à parte, sobre uma série de um tipo.
    await expect(page.getByRole('button', { name: 'Só técnica', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'WS', exact: true }).click();
    await page.getByRole('button', { name: 'Rest pause', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar série', exact: true }).click();
    await expect(page.getByText(/Série 2 · WS · 3 a 6 reps · carga de trabalho · 1 RIR · Rest pause 20 s/)).toBeVisible();
    await page.getByRole('button', { name: 'Cluster', exact: true }).click();
    await page.getByRole('textbox', { name: 'Blocos de repetições', exact: true }).fill('4+2');
    await expect(page.getByRole('textbox', { name: 'Reps mín.', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /1x6 \(4\+2\) - WS \+ Cluster 15 s/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('tela-editada.png'), fullPage: true });
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const series = (api.salvo().conteudo as { series: Serie[] }).series;
    expect(series[1]).toMatchObject({ tipo: 'WORKING', repsMin: 6, repsMax: 6, carga: { modo: 'CARGA_TRABALHO' }, tecnica: { tipo: 'CLUSTER', blocos: [4, 2] } });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`metodologia: RPE sem valor não trava e RPE inválido mostra o erro no campo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modelo(page, 'METODOLOGIA');
    const rpe = page.getByRole('textbox', { name: 'RPE (1 a 10, de meio em meio)', exact: true });
    const mensagem = 'RPE precisa ficar entre 1 e 10, de meio em meio.';
    const salvar = page.getByRole('button', { name: 'Salvar modelo', exact: true });
    await page.getByRole('button', { name: 'Aquecimento, recolhido', exact: true }).click();
    await page.getByRole('button', { name: 'RPE (esforço percebido)', exact: true }).click();
    // RPE escolhido e ainda sem valor equivale a "sem esforço": nenhum erro, nenhuma lista de problemas.
    await expect(rpe).toHaveValue('');
    await expect(page.getByText(mensagem)).toHaveCount(0);
    await expect(page.getByText(/problemas? para salvar/)).toHaveCount(0);
    // Valor fora da faixa: o erro específico aparece no campo e na lista, com o motivo no botão.
    await rpe.fill('11');
    await expect(page.getByText(mensagem).first()).toBeVisible();
    await expect(page.getByText('1 problema para salvar')).toBeVisible();
    await expect(page.getByRole('button', { name: /Ir para Tipo “Aquecimento” · Esforço padrão: RPE precisa ficar entre 1 e 10/ })).toBeVisible();
    await expect(salvar).toBeDisabled();
    // Apagar o valor volta a "sem esforço" e destrava; o corpo salvo leva esforço nulo, não um objeto vazio.
    await rpe.fill('');
    await expect(page.getByText(mensagem)).toHaveCount(0);
    await expect(salvar).toBeEnabled();
    await salvar.click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    expect((api.salvo().conteudo as Configuracao).tipos[0]).toMatchObject({ codigo: 'WARM_UP', esforcoPadrao: null });
    // Valor válido, de meio em meio, é gravado como digitado. Salvar recarrega o editor: o cartão volta recolhido e sem esforço.
    await page.getByRole('button', { name: 'Aquecimento, recolhido', exact: true }).click();
    await page.getByRole('button', { name: 'RPE (esforço percebido)', exact: true }).click();
    await rpe.fill('8,5');
    await salvar.click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(2);
    expect((api.salvo().conteudo as Configuracao).tipos[0].esforcoPadrao).toMatchObject({ rpe: 8.5, rir: null });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}
