import { expect, test, type Page } from '@playwright/test';
import type { Receita, Serie } from '../src/api/tipos';
import { CONFIGURACAO_PADRAO } from '../src/dominio/metodologiaPadrao';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

// Clareza do editor de treino (reunião de 30/10): posição do exercício por extenso, mover exercício × mover grupo,
// percentuais por série e a folha de receitas de séries. Só dados fictícios; nada chega ao banco.
const ID_PLANO = 'm0000000-0000-4000-8000-000000000030';
const PASTA_FORCA = 'p0000000-0000-4000-8000-000000000031';

const semCarga = { modo: 'CARGA_TRABALHO' as const, percentualMin: null, percentualMax: null, referenciaUid: null };
const daWs = (percentualMin: number, percentualMax: number | null) => ({ modo: 'PERCENTUAL_WS' as const, percentualMin, percentualMax, referenciaUid: null });
const serie = (uid: string, tipo: string, extra: Partial<Serie> = {}): Serie => ({
  uid, tipo, repsMin: 3, repsMax: 3, carga: semCarga, esforco: null, descansoSegundos: null, tecnica: null, ...extra,
});

/** Três FS com percentuais diferentes por série e uma WS: "3x3 - FS 50% · 70% · 85% a 90% da WS". */
const seriesDoAgachamento: Serie[] = [
  serie('fs-1', 'FEEDER', { carga: daWs(50, null) }),
  serie('fs-2', 'FEEDER', { carga: daWs(70, null) }),
  serie('fs-3', 'FEEDER', { carga: daWs(85, 90) }),
  serie('ws-1', 'WORKING', { repsMin: 3, repsMax: 6, esforco: { rir: 1, rpe: null } }),
];

const receita = (id: string, nome: string, series: Serie[], extra: Partial<Receita> = {}): Receita => ({
  id, tipo: 'SERIES', nome, descricao: null, pastaId: null, ordem: 1, versao: 1, conteudo: { series }, ...extra,
});

const receitas: Receita[] = [
  receita('m0000000-0000-4000-8000-000000000032', 'Força com preparação', [
    serie('r1-fs', 'FEEDER', { repsMin: 5, repsMax: 5, carga: daWs(60, null) }),
    serie('r1-ws', 'WORKING', { repsMin: 4, repsMax: 6 }),
  ], { pastaId: PASTA_FORCA, descricao: 'Uma de preparação e uma de trabalho.' }),
  receita('m0000000-0000-4000-8000-000000000033', 'Volume fictício', [
    serie('r2-ws', 'WORKING', { repsMin: 8, repsMax: 10 }),
    serie('r2-bo1', 'BACK_OFF', { repsMin: 10, repsMax: 12, carga: { modo: 'ABAIXO_DA_REFERENCIA', percentualMin: 10, percentualMax: null, referenciaUid: 'r2-ws' } }),
    serie('r2-bo2', 'BACK_OFF', { repsMin: 10, repsMax: 12, carga: { modo: 'ABAIXO_DA_REFERENCIA', percentualMin: 10, percentualMax: null, referenciaUid: 'r2-ws' } }),
  ]),
];

async function planoComDoisExercicios(page: Page) {
  const plano: Receita = {
    id: ID_PLANO, tipo: 'PLANO_TREINO', nome: 'Semana fictícia', descricao: null, pastaId: null, ordem: 1, versao: 1,
    conteudo: {
      objetivo: null, orientacoes: null,
      metodologia: { id: null, nome: 'Metodologia fictícia', configuracao: structuredClone(CONFIGURACAO_PADRAO) },
      sessoes: [{
        uid: 'sessao-1', nome: 'Treino A', diaSemana: 1, tipo: 'TREINO', frequenciaSemanal: null, observacao: null, cardio: null, grupos: [],
        exercicios: [
          { uid: 'ex-1', exercicioId: null, nome: 'Agachamento fictício', modalidade: 'LIVRE', videoUrl: null, observacao: null, progressao: true, unidade: 'kg', grupoUid: null, series: seriesDoAgachamento },
          { uid: 'ex-2', exercicioId: null, nome: 'Remada fictícia', modalidade: 'LIVRE', videoUrl: null, observacao: null, progressao: true, unidade: 'kg', grupoUid: null, series: [serie('ws-r', 'WORKING', { repsMin: 8, repsMax: 12 })] },
        ],
      }],
    },
  };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /pastas-modelos': { corpo: [{ id: PASTA_FORCA, nome: 'Força', versao: 1 }] },
    'GET /exercicios': { corpo: [] },
    'GET /receitas': (p, route) => json(route, p.busca.get('tipo') === 'SERIES' ? receitas : []),
    [`GET /receitas/${ID_PLANO}`]: (_p, route) => json(route, plano),
    [`PUT /receitas/${ID_PLANO}/conteudo`]: (p, route) => { Object.assign(plano, p.corpo as Receita, { versao: plano.versao + 1 }); return json(route, plano); },
  });
  await page.goto(`/treinador/planejamento/modelo/${ID_PLANO}`);
  await expect(page.getByRole('button', { name: 'Salvar modelo', exact: true })).toBeVisible();
  return api;
}

const semRolagemDeLado = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const largura of [390, 1280]) {
  test(`editor: posição do exercício, mover exercício × grupo e percentuais por série (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await planoComDoisExercicios(page);
    // Contadores: o plano inteiro e a sessão aberta, separados.
    await expect(page.getByText('Plano inteiro: 1 sessão · 2 exercícios · 5 séries cadastradas', { exact: true })).toBeVisible();
    await expect(page.getByText('Sessão aberta: 2 exercícios · 5 séries', { exact: true })).toBeVisible();
    // A posição por extenso, sem confundir com o número da série.
    await expect(page.getByText('Exercício 1 de 2 · Agachamento fictício', { exact: true })).toBeVisible();
    await expect(page.getByText('Exercício 2 de 2 · Remada fictícia', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Editar Agachamento fictício', exact: true }).click();
    // Mover o exercício e mover o grupo de séries têm nomes diferentes; o primeiro não sobe.
    await expect(page.getByRole('button', { name: 'Mover exercício para cima', exact: true }).first()).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Mover exercício para baixo', exact: true }).first()).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Mover grupo de séries para cima', exact: true }).first()).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Mover grupo de séries para baixo', exact: true }).first()).toBeEnabled();
    // A partir de 768 px os botões de mover dizem o quê; no celular ficam só com a seta (nome acessível igual).
    const comTexto = page.getByRole('button', { name: 'Mover exercício para baixo', exact: true }).first().getByText('Mover exercício', { exact: true });
    await expect(comTexto).toHaveCount(largura >= 768 ? 1 : 0);
    // O grupo: o tipo na 1ª linha e os percentuais de cada série na 2ª.
    await expect(page.getByRole('button', { name: 'Preparação · FS, recolhido', exact: true })).toBeVisible();
    await expect(page.getByText(/^3x3 - FS 50% · 70% · 85% a 90% da WS/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Preparação · FS, recolhido', exact: true }).click();
    // Faixa curta com o exercício no topo do grupo aberto.
    await expect(page.getByText('Exercício 1 · Agachamento fictício', { exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Série 3 · Mínimo (%)', exact: true })).toHaveValue('85');
    await expect(page.getByRole('textbox', { name: 'Série 3 · Máximo (%)', exact: true })).toHaveValue('90');
    expect(await semRolagemDeLado(page)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('editor-clareza.png'), fullPage: true });
    // Mover o grupo FS para baixo muda só a ordem das séries do exercício.
    await page.getByRole('button', { name: 'Mover grupo de séries para baixo', exact: true }).first().click();
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const corpo = api.pedidos.filter((p) => p.metodo === 'PUT').at(-1)!.corpo as { conteudo: { sessoes: { exercicios: { nome: string; series: Serie[] }[] }[] } };
    const [agachamento, remada] = corpo.conteudo.sessoes[0].exercicios;
    expect(agachamento.nome).toBe('Agachamento fictício');
    expect(agachamento.series.map((s) => s.uid)).toEqual(['ws-1', 'fs-1', 'fs-2', 'fs-3']);
    expect(remada.series.map((s) => s.uid)).toEqual(['ws-r']);
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`editor: receita de séries com busca, sequência, aviso, aplicar e desfazer (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await planoComDoisExercicios(page);
    await page.getByRole('button', { name: 'Editar Remada fictícia', exact: true }).click();
    await page.getByRole('button', { name: 'Usar receita', exact: true }).click();
    // Agrupadas por coleção, cada uma com a composição, a sequência e o aviso de que substitui as séries.
    await expect(page.getByRole('button', { name: 'Força, aberto', exact: true })).toBeVisible();
    await expect(page.getByText('FS ×1 · WS ×1', { exact: true })).toBeVisible();
    await expect(page.getByText('WS ×1 · Back off ×2', { exact: true })).toBeVisible();
    await expect(page.getByText('Sequência', { exact: true })).toHaveCount(2);
    await expect(page.getByText('Substitui as séries deste exercício', { exact: true })).toHaveCount(2);
    // Busca pela composição ("back off") e pelo nome, sem acento.
    const busca = page.getByRole('textbox', { name: 'Buscar receita', exact: true });
    await busca.fill('back off');
    await expect(page.getByText('Volume fictício', { exact: true })).toBeVisible();
    await expect(page.getByText('Força com preparação', { exact: true })).toHaveCount(0);
    await busca.fill('forca');
    await expect(page.getByText('Força com preparação', { exact: true })).toBeVisible();
    await expect(page.getByText('Volume fictício', { exact: true })).toHaveCount(0);
    await busca.fill('nada assim');
    await expect(page.getByText('Nenhuma receita com essa busca.', { exact: true })).toBeVisible();
    await busca.fill('back off');
    expect(await semRolagemDeLado(page)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('folha-receitas.png'), fullPage: true });
    await page.getByRole('button', { name: 'Aplicar receita Volume fictício', exact: true }).click();
    await expect(page.getByText('Substitui as séries deste exercício', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Receita “Volume fictício” aplicada.', { exact: true })).toBeVisible();
    await expect(page.getByText(/^1x8 a 10 - WS/).first()).toBeVisible();
    await expect(page.getByText(/^2x10 a 12 - Back off/).first()).toBeVisible();
    // Desfazer volta as séries de antes.
    await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
    await expect(page.getByText(/^2x10 a 12 - Back off/)).toHaveCount(0);
    await expect(page.getByText(/^1x8 a 12 - WS/).first()).toBeVisible();
    // Nada foi gravado: aplicar e desfazer só mexem no rascunho da tela.
    expect(api.pedidos.filter((p) => p.metodo === 'PUT')).toHaveLength(0);
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}
