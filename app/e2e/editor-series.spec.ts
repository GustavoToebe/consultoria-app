import { expect, test, type Page } from '@playwright/test';
import type { Receita, Serie } from '../src/api/tipos';
import { CONFIGURACAO_PADRAO } from '../src/dominio/metodologiaPadrao';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { linhaDaSerie } from './linhaDaSerie';

/** Abre um select da série ("Tipo da série", "Técnica da série", "Séries"…) e escolhe a opção. */
async function escolher(page: Page, rotulo: string, opcao: string) {
  await page.getByRole('button', { name: new RegExp(`^${rotulo}: .*\\. Escolher\\.$`) }).click();
  await page.getByRole('option', { name: opcao, exact: true }).click();
}

// Sem série nenhuma, os botões de 1 clique ("Adicionar FS", "Adicionar WS com Cluster") estão à vista. Com séries, o
// "+ Nova série" (a última linha da tabela, 27/11) já cria a WS e a abre; o tipo e a técnica se trocam nos selects dela.
async function novaSerie(page: Page, botao: string) {
  if (!(await linhaDaSerie(page, /^Série \d/).count())) {
    await page.getByRole('button', { name: botao, exact: true }).click();
    return;
  }
  await page.getByRole('button', { name: 'Nova série', exact: true }).click();
  const [, tipo, tecnica] = /^Adicionar (.+?)(?: com (.+))?$/.exec(botao)!;
  if (tipo !== 'WS') await escolher(page, 'Tipo da série', tipo);
  if (tecnica) await escolher(page, 'Técnica da série', tecnica);
}

for (const largura of [390, 1280]) {
  test(`FS por quantidade e técnica dentro da série WS persistidas (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    let modelo: Receita = { id: 'm0000000-0000-4000-8000-000000000003', tipo: 'SERIES', origem: 'CONSULTORIA', nome: 'Séries fictícias', descricao: null, pastaId: null, ordem: 1, versao: 1, conteudo: { series: [] } };
    const api = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] })),
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /receitas': { corpo: [{ ...modelo, tipo: 'METODOLOGIA', conteudo: CONFIGURACAO_PADRAO }] },
      [`GET /receitas/${modelo.id}`]: (_p, route) => json(route, modelo),
      [`PUT /receitas/${modelo.id}`]: (p, route) => { modelo = { ...modelo, ...p.corpo as Receita, versao: 2 }; return json(route, modelo); },
    });
    await page.goto(`/treinador/planejamento/modelo/${modelo.id}`);
    await expect(page.getByText('Nenhuma série ainda.', { exact: true })).toBeVisible();
    // Sem série, os botões de 1 clique já estão à vista: um por tipo e as técnicas sobre a WS.
    const adicionar = page.getByRole('group', { name: 'Adicionar série', exact: true });
    for (const nome of ['Adicionar FS', 'Adicionar WS', 'Adicionar Back off', 'Adicionar Aquecimento', 'Adicionar WS com Cluster']) {
      await expect(adicionar.getByRole('button', { name: nome, exact: true })).toBeVisible();
    }
    await novaSerie(page, 'Adicionar FS');
    await escolher(page, 'Séries', '3');
    const campo = (nome: string) => page.getByRole('textbox', { name: nome, exact: true });
    await expect(campo('Série 1 · Mínimo (%)')).toHaveValue('50');
    await expect(campo('Série 2 · Mínimo (%)')).toHaveValue('70');
    await expect(campo('Série 3 · Mínimo (%)')).toHaveValue('85');
    await expect(campo('Série 3 · Máximo (%)')).toHaveValue('90');
    // O nome acessível do bloco aberto diz o que se edita; ao lado (embaixo, no celular), a prévia com os cartões do aluno.
    await expect(page.getByRole('region', { name: 'Editando série 1, Preparação · FS', exact: true })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Prévia para o aluno' })).toContainText('FS');
    await novaSerie(page, 'Adicionar WS');
    // A técnica não é um tipo: a série é WS e o rest pause vai dentro dela. O "+ Nova série" soma uma WS ao grupo da WS e
    // "Aplicar Rest-pause só na última série" separa a última, com a técnica.
    await page.getByRole('button', { name: 'Nova série', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Só técnica', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Aplicar Rest-pause só na última série', exact: true }).click();
    await expect(linhaDaSerie(page, /^Série \d/)).toHaveCount(3);
    if (!(await linhaDaSerie(page, /^Série 3 · WS/, true).count())) await linhaDaSerie(page, /^Série 3 · WS/).click();
    await expect(page.getByRole('region', { name: /^Editando série \d, Trabalho · WS \+ Rest pause$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Técnica da série: Rest pause. Escolher.', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // O "mín" e o "máx" ficam dentro da caixa do número: com três dígitos o texto não passa da área dele (não é cortado).
    for (const [nome, cheio] of [['Reps mín.', '100'], ['Reps máx.', '100']]) {
      const original = await campo(nome).inputValue();
      await campo(nome).fill(cheio);
      expect(await campo(nome).evaluate((e) => e.scrollWidth <= e.clientWidth), `${nome} cortado`).toBe(true);
      await campo(nome).fill(original);
    }
    await page.screenshot({ path: testInfo.outputPath('series-prescritas.png'), fullPage: true });
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const series = (modelo.conteudo as { series: Serie[] }).series;
    expect(series.map((s) => s.tipo)).toEqual(['FEEDER', 'FEEDER', 'FEEDER', 'WORKING', 'WORKING']);
    expect(series.slice(0, 3).map((s) => [s.carga?.percentualMin, s.carga?.percentualMax])).toEqual([[50, null], [70, null], [85, 90]]);
    expect(series[3]).toMatchObject({ carga: { modo: 'CARGA_TRABALHO' }, esforco: { rir: 0 }, tecnica: null });
    expect(series[4]).toMatchObject({ tipo: 'WORKING', carga: { modo: 'CARGA_TRABALHO' }, tecnica: { tipo: 'REST_PAUSE', pausas: 1, pausaSegundos: 20 } });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}

for (const largura of [390, 1280]) {
  test(`Cluster com carga por bloco e Rest-pause com meta das retomadas, salvos e na prévia (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    let modelo: Receita = { id: 'm0000000-0000-4000-8000-000000000004', tipo: 'SERIES', origem: 'CONSULTORIA', nome: 'Etapas fictícias', descricao: null, pastaId: null, ordem: 1, versao: 1, conteudo: { series: [] } };
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
    await novaSerie(page, 'Adicionar WS com Cluster');
    // Blocos iguais (27/11): um campo só, as repetições; o + soma blocos (sem padrão, nasce com 2).
    await campo('Repetições em cada bloco').fill('4');
    await page.getByRole('button', { name: 'Adicionar um bloco', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar um bloco', exact: true }).click();
    await expect(page.getByText('4 blocos · 16 reps por série', { exact: true })).toBeVisible();
    await page.getByRole('switch', { name: 'Carga diferente por bloco' }).click();
    for (const bloco of [2, 3, 4]) {
      await page.getByRole('radiogroup', { name: `Bloco ${bloco} (4 reps)` }).getByRole('radio', { name: 'Percentual da carga de trabalho (WS)', exact: true }).click();
      await campo(`Percentual da WS, bloco ${bloco}`).fill('90');
    }
    // A prévia do aluno mostra o cluster (a carga de cada bloco vai no plano salvo, conferido no fim).
    await expect(page.getByRole('group', { name: 'Prévia para o aluno' })).toContainText('WS');
    await page.screenshot({ path: testInfo.outputPath('cluster-carga-por-bloco.png'), fullPage: true });

    // WS com Rest-pause de 2 pausas: retomada 1 com 2 a 3 reps; retomada 2 AMRAP a 85% da WS.
    await novaSerie(page, 'Adicionar WS com Rest pause');
    await campo('Quantas pausas').fill('2');
    await page.getByRole('switch', { name: 'Definir a meta das retomadas' }).click();
    const r1 = page.getByRole('radiogroup', { name: 'Retomada 1', exact: true });
    await r1.getByRole('radio', { name: 'Faixa', exact: true }).click();
    await campo('Retomada 1: reps mín.').fill('2');
    await campo('Retomada 1: reps máx.').fill('3');
    await page.getByRole('radiogroup', { name: 'Carga da retomada 2' }).getByRole('radio', { name: 'Percentual da carga de trabalho (WS)', exact: true }).click();
    await campo('Percentual da WS, retomada 2').fill('85');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('group', { name: 'Prévia para o aluno' })).toContainText('WS');
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
