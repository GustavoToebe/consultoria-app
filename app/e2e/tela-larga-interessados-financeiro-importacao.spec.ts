import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

import type { PlanoResponse } from '../src/api/financeiroTipos';
import type { IndicadoresInscricoes } from '../src/api/inscricoesTipos';
import { fixarHoje } from './aluno';
import { ALUNO, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { estadoFinanceiro, INADIMPLENTE, rotasDoFinanceiro, sessaoComFinanceiro } from './financeiro-falso';
import { resumoFalso, rotasDaTela } from './inscricoes-falsas';

/**
 * Tela larga: revisão (24/11) de Interessados, Financeiro e Importação (`docs/planos/tela-larga-revisao-interessados-financeiro-importacao.md`,
 * `docs/design-e-front.md` 4.10). Por geometria, com o menu aberto: os oito indicadores de Interessados numa linha só e as
 * quatro análises lado a lado na ultralarga; a coluna de apoio da Visão geral do Financeiro (não em 2560 nem em "Limitada");
 * a grade dos Planos que ganha colunas sem cartão sozinho; e as etapas da importação que param em 1400 px. Relógio fixo em
 * 19/10/2026; só dados fictícios, API simulada. `CAPTURAS_TELA_LARGA` aponta uma pasta para as capturas (opcional).
 */

const PASTA = process.env.CAPTURAS_TELA_LARGA;
async function capturar(page: Page, nome: string) {
  if (!PASTA) return;
  fs.mkdirSync(PASTA, { recursive: true });
  await page.screenshot({ path: path.join(PASTA, `${nome}.png`) });
}

async function caixa(alvo: Locator) {
  const c = await alvo.boundingBox();
  if (!c) throw new Error('elemento sem caixa');
  return c;
}

const semRolagemLateral = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

async function preparar(page: Page, largura: number, larguraConteudo: 'AUTOMATICA' | 'LIMITADA' = 'AUTOMATICA') {
  await page.setViewportSize({ width: largura, height: largura > 1920 ? 1440 : 1080 });
  await fixarHoje(page);
  await page.addInitScript(([id, l]) => {
    localStorage.removeItem('menu-lateral-recolhido');
    localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO', larguraConteudo: l }));
  }, [TREINADOR.id, larguraConteudo] as const);
}

// ---------- Interessados › Indicadores ----------
const INDICADORES: IndicadoresInscricoes = {
  de: '2026-09-20', ate: '2026-10-19', entradas: 42, pessoas: 39, aceites: 9, recusadas: 5, desistencias: 3, reaberturas: 2,
  aceitesDasEntradas: 7, conversao: 7 / 42, diasAteAceite: { mediana: 4, media: 5.5 },
  porMotivo: [{ motivo: 'PRECO', quantidade: 4 }, { motivo: 'SEM_RETORNO', quantidade: 3 }],
  porOrigem: [{ origem: 'INSTAGRAM', entradas: 25, aceites: 5 }, { origem: 'INDICACAO', entradas: 17, aceites: 4 }],
};
const ROTULOS = ['Entradas', 'Pessoas', 'Aceites', 'Conversão das entradas', 'Dias até o aceite (mediana)', 'Recusadas', 'Desistências', 'Reaberturas'];
const titulo = (page: Page, nome: string) => page.getByRole('heading', { name: nome, level: 2, exact: true });

async function abrirIndicadores(page: Page, largura: number) {
  await preparar(page, largura);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...rotasDaTela(),
    'GET /inscricoes': { corpo: { itens: [resumoFalso(1)], total: 1 } },
    'GET /inscricoes/indicadores': { corpo: INDICADORES },
  });
  await page.goto('/treinador/interessados?visao=indicadores');
  await expect(page.getByText('7 de 42 já viraram aluno')).toBeVisible();
  return api;
}

const cartoesDosIndicadores = (page: Page) =>
  Promise.all(ROTULOS.map((r) => caixa(page.getByLabel(new RegExp(`^${r.replace(/[()]/g, '\\$&')}: `)).first())));

test('Interessados › Indicadores em 3440 px: oito números numa linha e as quatro análises lado a lado, sem texto corrido longo', async ({ page }) => {
  const { errosDaPagina } = await abrirIndicadores(page, 3440);
  await expect(async () => {
    const cartoes = await cartoesDosIndicadores(page);
    for (const c of cartoes) expect(Math.abs(c.y - cartoes[0].y)).toBeLessThan(2);
    const [perdas, origem, glossario, limites] = await Promise.all(['Perdas por motivo', 'Entradas por origem', 'Como contamos', 'Limites dos dados'].map((n) => caixa(titulo(page, n))));
    for (const t of [origem, glossario, limites]) expect(Math.abs(t.y - perdas.y)).toBeLessThan(2);
    expect(origem.x).toBeGreaterThan(perdas.x);
    expect(glossario.x).toBeGreaterThan(origem.x);
    expect(limites.x).toBeGreaterThan(glossario.x);
  }).toPass({ timeout: 10_000 });
  // A tabela de duas colunas não estica: cada análise tem um quarto da área, e ela segue em colunas.
  expect((await caixa(page.getByRole('table', { name: 'Perdas por motivo' }))).width).toBeLessThan(800);
  await expect(page.getByRole('table', { name: 'Perdas por motivo' }).getByRole('columnheader', { name: 'Motivo' })).toBeVisible();
  // Texto corrido dos limites em ~72 caracteres.
  const paragrafo = await caixa(page.getByText(/^As datas são as de Brasília/).first());
  expect(paragrafo.width).toBeLessThanOrEqual(720);
  await semRolagemLateral(page);
  await capturar(page, 'interessados-indicadores-3440');
  expect(errosDaPagina).toEqual([]);
});

test('Interessados › Indicadores em 1920 px: continua em duas linhas de quatro e o glossário em faixa inteira', async ({ page }) => {
  const { errosDaPagina } = await abrirIndicadores(page, 1920);
  await expect(async () => {
    const cartoes = await cartoesDosIndicadores(page);
    expect(cartoes.filter((c) => Math.abs(c.y - cartoes[0].y) < 2)).toHaveLength(4);
    const [perdas, origem, glossario] = await Promise.all(['Perdas por motivo', 'Entradas por origem', 'Como contamos'].map((n) => caixa(titulo(page, n))));
    expect(Math.abs(origem.y - perdas.y)).toBeLessThan(2);
    expect(glossario.y).toBeGreaterThan(perdas.y + 40);
  }).toPass({ timeout: 10_000 });
  await semRolagemLateral(page);
  expect(errosDaPagina).toEqual([]);
});

test('Interessados › Indicadores em 2560 px: oito números numa linha; as tabelas lado a lado e o glossário em faixa inteira', async ({ page }) => {
  const { errosDaPagina } = await abrirIndicadores(page, 2560);
  await expect(async () => {
    const cartoes = await cartoesDosIndicadores(page);
    for (const c of cartoes) expect(Math.abs(c.y - cartoes[0].y)).toBeLessThan(2);
    const [perdas, origem, glossario] = await Promise.all(['Perdas por motivo', 'Entradas por origem', 'Como contamos'].map((n) => caixa(titulo(page, n))));
    expect(Math.abs(origem.y - perdas.y)).toBeLessThan(2);
    expect(glossario.y).toBeGreaterThan(perdas.y + 40);
  }).toPass({ timeout: 10_000 });
  // A tabela segue em colunas (não vira cartões).
  await expect(page.getByRole('table', { name: 'Perdas por motivo' }).getByRole('columnheader', { name: 'Motivo' })).toBeVisible();
  await semRolagemLateral(page);
  expect(errosDaPagina).toEqual([]);
});

// ---------- Financeiro › Visão geral e Planos ----------
const plano = (n: number): PlanoResponse => ({
  id: `f0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, nome: `Plano ${n}`, valorCentavos: 15_000 + n * 100, periodicidade: 'MENSAL',
  arquivado: false, criadoEm: '2026-10-01T12:00:00Z', versao: 0, tempoMinimoMeses: null, regraDeSaida: null, linkDePagamento: null, incluiTreino: true, incluiDieta: true,
});
const RENOVACOES = {
  renovacoesProximasCount: 1, renovacoesProximasCentavos: 30_000, projecaoAnualCentavos: 120_000, encerraramSemRenovarCount: 1,
  encerraramSemRenovar: [{ contratacaoId: 'c1', alunoId: ALUNO.id, alunoNome: 'Aluno Fictício Um', terminoVigencia: '2026-10-16', valorCentavos: 70_000 }],
};

async function abrirFinanceiro(page: Page, largura: number, aba: string, planos = 8, larguraConteudo: 'AUTOMATICA' | 'LIMITADA' = 'AUTOMATICA') {
  await preparar(page, largura, larguraConteudo);
  const estado = estadoFinanceiro({ inadimplentes: [INADIMPLENTE], renovacoes: RENOVACOES, planos: Array.from({ length: planos }, (_, i) => plano(i + 1)) });
  const api = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto(`/treinador/financeiro?aba=${aba}`);
  return api;
}

test('Financeiro › Visão geral em 3440 px: renovações, próximos, líquido e resultado do mês numa coluna de apoio ao lado da inadimplência', async ({ page }) => {
  const { errosDaPagina } = await abrirFinanceiro(page, 3440, 'visao');
  await expect(page.getByTestId('visao-com-coluna-de-apoio')).toBeVisible();
  const tabela = await caixa(page.getByRole('table', { name: 'Cobranças vencidas em aberto' }));
  expect(tabela.width).toBeLessThanOrEqual(1800);
  const renovacoes = await caixa(titulo(page, 'Renovações próximas'));
  const proximos = await caixa(titulo(page, 'Próximos recebimentos'));
  const colunaDeApoio = await caixa(page.getByTestId('linha-previsoes'));
  expect(renovacoes.x).toBeGreaterThan(tabela.x + tabela.width);
  // Empilhados na coluna (não lado a lado) e alinhados à direita com os indicadores do topo.
  expect(Math.abs(proximos.x - renovacoes.x)).toBeLessThan(2);
  expect(proximos.y).toBeGreaterThan(renovacoes.y);
  const topo = await caixa(page.getByText('Valor médio por aluno').first());
  expect(colunaDeApoio.x + colunaDeApoio.width).toBeGreaterThan(topo.x);
  await semRolagemLateral(page);
  await capturar(page, 'financeiro-visao-3440');
  expect(errosDaPagina).toEqual([]);
});

for (const [largura, modo] of [[2560, 'AUTOMATICA'], [3440, 'LIMITADA']] as const) {
  test(`Financeiro › Visão geral em ${largura} px (${modo.toLowerCase()}): sem espaço para a coluna de apoio, fica em uma coluna`, async ({ page }) => {
    const { errosDaPagina } = await abrirFinanceiro(page, largura, 'visao', 8, modo);
    await expect(titulo(page, 'Renovações próximas')).toBeVisible();
    await expect(page.getByTestId('visao-com-coluna-de-apoio')).toHaveCount(0);
    const tabela = await caixa(page.getByRole('table', { name: 'Cobranças vencidas em aberto' }));
    expect((await caixa(titulo(page, 'Renovações próximas'))).y).toBeGreaterThan(tabela.y + tabela.height);
    await semRolagemLateral(page);
    expect(errosDaPagina).toEqual([]);
  });
}

const colunasDosPlanos = (page: Page) => page.getByRole('button', { name: /^Abrir plano / }).evaluateAll((els) =>
  new Set(els.map((el) => Math.round(el.getBoundingClientRect().left))).size);

for (const [largura, planos, colunas] of [[3440, 8, 6], [3440, 7, 5], [1920, 8, 3]] as const) {
  test(`Financeiro › Planos em ${largura} px com ${planos} planos: ${colunas} colunas, sem cartão sozinho`, async ({ page }) => {
    const { errosDaPagina } = await abrirFinanceiro(page, largura, 'planos', planos);
    await expect(page.getByRole('button', { name: 'Abrir plano Plano 1' })).toBeVisible();
    await expect.poll(() => colunasDosPlanos(page)).toBe(colunas);
    const cartao = await caixa(page.getByRole('button', { name: 'Abrir plano Plano 1' }));
    expect(cartao.width).toBeLessThanOrEqual(640);
    await semRolagemLateral(page);
    expect(errosDaPagina).toEqual([]);
  });
}

// ---------- Importação ----------
const ANALISE = {
  abas: [
    { indice: 0, nome: 'Alunos', tipo: 'ALUNOS', linhaDoCabecalho: 1, linhas: 3, campos: { CODIGO: 0, ALUNO: 1 }, avisos: [], formato: 'TABELA', blocos: [], tipoSalvo: null },
  ],
  ligacoes: [],
  resumo: {
    alunos: 3, alunosInativos: 0, pesos: 0, pesosIniciais: 0, pesosIniciaisNoHistorico: 0, treinos: 0, exercicios: 0, refeicoes: 0, itensDeDieta: 0,
    suplementos: 0, exerciciosNaLista: 0, nomesDeExercicio: { certo: 0, provavel: 1, nenhum: 0 }, nomesDeAlimento: { certo: 0, provavel: 0, nenhum: 0 },
    prescricoes: 0, prescricoesNaoEntendidas: 0, prescricoesComSobra: 0, faixasRecuperadasDeData: 0,
  },
  problemas: [], problemasAlem: 0, problemasPorTipo: {},
  exercicios: [{ nome: 'Supino reto c/ hal.', nivel: 'PROVAVEL', sugestao: 'Supino reto com halteres', origem: 'BIBLIOTECA', nota: 0.7, ocorrencias: 3, respostaSalva: null, idSalvo: null }],
  alimentos: [], suplementos: [], respostasSalvas: 0,
};

async function abrirImportacao(page: Page, largura: number) {
  await preparar(page, largura);
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER'] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /importacoes': { corpo: { itens: [], total: 0, pagina: 0 } },
    'GET /exercicios': { corpo: [{ id: 'e1', nome: 'Supino reto com halteres', grupoMuscular: 'Peito' }] },
    'POST /importacoes/planilha-completa/analisar': (_p, route) => json(route, ANALISE),
    'GET /importacoes/assistidas/sessoes': { corpo: [] },
  });
}

/** Teto das etapas, medido a partir da borda esquerda do conteúdo (a do título da página). */
const TETO = 1400 + 2;

test('Importação › planilha completa em 3440 px: etapas, cartões e rodapé param em 1400 px à esquerda; a busca não estica', async ({ page }) => {
  const { errosDaPagina } = await abrirImportacao(page, 3440);
  await page.goto('/treinador/importacao/planilha-completa');
  const h1 = await caixa(page.getByRole('heading', { name: 'Planilha completa', level: 1 }));
  await page.getByLabel('Arquivo da planilha').setInputFiles({ name: 'planilha.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('PK ficticio') });
  await page.getByRole('button', { name: 'Continuar' }).click();
  const seletor = page.getByRole('button', { name: /^Tipo da aba “Alunos”/ });
  await expect(seletor).toBeVisible();
  const s = await caixa(seletor);
  expect(s.x + s.width - h1.x).toBeLessThanOrEqual(TETO);
  const continuar = await caixa(page.getByRole('button', { name: 'Continuar' }));
  expect(continuar.x + continuar.width - h1.x).toBeLessThanOrEqual(TETO);
  const etapa = await caixa(page.getByLabel(/^Etapa 2 de 5/));
  expect(etapa.width).toBeLessThanOrEqual(TETO);
  await page.getByRole('button', { name: 'Continuar' }).click();
  const busca = await caixa(page.getByLabel('Buscar em exercícios'));
  expect(busca.width).toBeLessThanOrEqual(640);
  await semRolagemLateral(page);
  await capturar(page, 'importacao-planilha-nomes-3440');
  expect(errosDaPagina).toEqual([]);
});

test('Importação › nova importação e assistida em 3440 px: o conteúdo para em 1400 px à esquerda', async ({ page }) => {
  const { errosDaPagina } = await abrirImportacao(page, 3440);
  await page.goto('/treinador/importacao/nova');
  const h1 = await caixa(page.getByRole('heading', { level: 1 }));
  const planilha = await caixa(page.getByRole('link', { name: /Planilha completa \(alunos, pesos, treinos e dietas\)/ }));
  expect(planilha.x).toBeLessThan(h1.x + 2);
  expect(planilha.x + planilha.width - h1.x).toBeLessThanOrEqual(TETO);
  const cancelar = await caixa(page.getByRole('button', { name: 'Cancelar' }));
  expect(cancelar.x + cancelar.width - h1.x).toBeLessThanOrEqual(TETO);

  await page.goto('/treinador/importacao/assistida');
  await expect(page.getByText('Enviar arquivos ou texto').first()).toBeVisible();
  const h1b = await caixa(page.getByRole('heading', { name: 'Importação assistida', level: 1 }));
  const colar = await caixa(page.getByRole('button', { name: 'Colar texto' }));
  expect(colar.x - h1b.x).toBeLessThan(TETO);
  // A descrição do cartão quebra dentro dos 1400 px (antes corria numa linha de ~1700 px).
  const descricao = await caixa(page.getByText(/^Envie PDFs de treino/).first());
  expect(descricao.x + descricao.width - h1b.x).toBeLessThanOrEqual(TETO);
  await semRolagemLateral(page);
  expect(errosDaPagina).toEqual([]);
});
