import { expect, test, type Page } from '@playwright/test';

import type { Painel } from '../src/api/financeiroTipos';
import { AVISO_EXPORTACAO_PARCIAL, AVISO_HISTORICO_PARCIAL } from '../src/dominio/financeiro';
import { fixarHoje } from './aluno';
import { erroApi, json, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { COBRANCA_ATRASADA, estadoFinanceiro, PAINEL_COM_DADOS, PAINEL_VAZIO, rotasDoFinanceiro, sessaoComFinanceiro, type EstadoFinanceiro } from './financeiro-falso';

/**
 * Financeiro: zero, nulo e ressalvas (`docs/planos/nulo-e-cobertura.md`, 13/11). Consulta válida e vazia mostra R$ 0,00 e
 * `recebido` 0 no mês é barra zerada (não "sem dado"); resultado nulo mostra "—" com o motivo escrito, nunca zero. Desde
 * 25/11 (pedido do Gustavo) as abas do Financeiro não mostram a ressalva do `historicoFinanceiroParcial` nem a frase dos
 * registros disponíveis; o Início também não (T-001, 25/11) e a folha de exportar traz a explicação da coluna do CSV.
 * Dados fictícios; relógio em 19/10/2026.
 * Com `CAPTURAS=<pasta>` grava as imagens (claro e escuro, 1280 e 390).
 */

const TEMAS = ['CLARO', 'ESCURO'] as const;
const LARGURAS = [1280, 390] as const;
const SEM_DADOS = 'Entradas ou saídas do mês não estão disponíveis.';
/** A frase geral que saiu das abas em 25/11. */
const NOTA_QUE_SAIU = /Os valores consideram os registros disponíveis/;

async function abrir(page: Page, painel: Painel, o: { rota?: string; tema?: (typeof TEMAS)[number]; largura?: number; estado?: Partial<EstadoFinanceiro>; extra?: RespostasApi } = {}) {
  await page.setViewportSize({ width: o.largura ?? 1280, height: 1000 });
  await fixarHoje(page);
  if (o.tema) await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, o.tema] as const);
  const api = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estadoFinanceiro({ painel, ...o.estado })), ...o.extra });
  await page.goto(o.rota ?? '/treinador/financeiro');
  return api;
}
const capturar = async (page: Page, nome: string) => {
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/${nome}.png`, fullPage: true });
};

test('consulta válida sem pagamentos: R$ 0,00 no recebido, sem a frase dos registros disponíveis', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, PAINEL_VAZIO);
  await expect(page.getByLabel('Recebido no período: R$ 0,00', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Recebido das cobranças: R$ 0,00')).toBeVisible();
  await expect(page.getByText('Recebido no período —')).toHaveCount(0);
  await expect(page.getByText(NOTA_QUE_SAIU)).toHaveCount(0);
  // O período e a explicação do "—" continuam.
  await expect(page.getByText(/Onde aparece “—”, o número não está disponível\.$/)).toBeVisible();
  // "Cobranças já geradas" segue visível nos cartões de previsto, a receber e atraso.
  await expect(page.getByText('considera as cobranças já geradas').first()).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('sem dado (nulo da API): "—" nos cartões, nunca R$ 0,00', async ({ page }) => {
  const nulo: Painel = {
    ...PAINEL_VAZIO,
    cartoes: { recebidoCentavos: null, aReceberCentavos: null, emAtraso: { valorCentavos: null, cobrancas: 0 }, receitaRecorrenteMensalCentavos: null, alunosPagantes: null, valorMedioPorAlunoCentavos: null },
  };
  const { errosDaPagina } = await abrir(page, nulo);
  await expect(page.getByLabel('Recebido no período: —')).toBeVisible();
  await expect(page.getByLabel('A receber: —')).toBeVisible();
  await expect(page.getByLabel('Recebido no período: R$ 0,00', { exact: false })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('série do mês: recebido 0 é barra zerada com "R$ 0,00"; sem dado (nulo) não vira zero (gráfico e tabela)', async ({ page }) => {
  const serie: Painel['serie'] = [
    { mes: '2026-08', parcial: false, recebidoCentavos: 0, previstoCentavos: null, entradasAvulsasCentavos: 0, saidasAvulsasCentavos: 0, resultadoCentavos: 0 },
    { mes: '2026-09', parcial: false, recebidoCentavos: null, previstoCentavos: null, entradasAvulsasCentavos: null, saidasAvulsasCentavos: null, resultadoCentavos: null },
    { mes: '2026-10', parcial: true, recebidoCentavos: 45_000, previstoCentavos: 45_000, entradasAvulsasCentavos: 0, saidasAvulsasCentavos: 0, resultadoCentavos: 45_000 },
  ];
  // Gráfico (1280): o texto do leitor de tela traz "recebido R$ 0,00" para 08/2026 e "recebido —" para 09/2026.
  const { errosDaPagina } = await abrir(page, { ...PAINEL_COM_DADOS, serie });
  const grafico = page.getByRole('img', { name: /^Recebido e previsto por mês/ });
  await expect(grafico).toBeVisible();
  const rotulo = (await grafico.getAttribute('aria-label')) ?? '';
  expect(rotulo).toMatch(/08\/2026: recebido R\$\s0,00\./);
  expect(rotulo).toMatch(/09\/2026: recebido —\./);
  // Tabela (390, abaixo da largura do gráfico; empilhada vira lista de cartões): a mesma regra em células.
  await page.setViewportSize({ width: 390, height: 1000 });
  const tabela = page.getByRole('list', { name: 'Recebido e previsto por mês' });
  await expect(tabela).toBeVisible();
  await expect(tabela.getByText('R$ 0,00', { exact: true }).first()).toBeVisible();
  await expect(tabela.getByText('—', { exact: true }).first()).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('resultado do mês nulo: "—" com o motivo escrito (nunca zero); resultado 0 de verdade segue "R$ 0,00"', async ({ page }) => {
  const nulo: Painel = { ...PAINEL_COM_DADOS, resultadoDoMes: { ...PAINEL_COM_DADOS.resultadoDoMes, entradasAvulsasCentavos: null, saidasAvulsasCentavos: null, resultadoCentavos: null } };
  const { errosDaPagina } = await abrir(page, nulo);
  const resultado = page.getByLabel(`Resultado: —. ${SEM_DADOS}`);
  await expect(resultado).toBeVisible();
  await expect(resultado.getByText(SEM_DADOS)).toBeVisible();
  await expect(page.getByLabel('Resultado: R$ 0,00')).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);

  // Com "Meus" os avulsos não entram: outro motivo.
  await page.getByRole('radiogroup', { name: 'Responsável' }).getByRole('radio', { name: 'Meus', exact: true }).click();
  await expect(page.getByText('Os lançamentos avulsos não entram no filtro "Meus".', { exact: true })).toBeVisible();
});

test('resultado 0 de verdade: "R$ 0,00", sem motivo de indisponível', async ({ page }) => {
  const zero: Painel = { ...PAINEL_COM_DADOS, resultadoDoMes: { ...PAINEL_COM_DADOS.resultadoDoMes, recebidoCentavos: 0, entradasAvulsasCentavos: 0, saidasAvulsasCentavos: 0, resultadoCentavos: 0 } };
  const { errosDaPagina } = await abrir(page, zero);
  await expect(page.getByLabel('Resultado: R$ 0,00')).toBeVisible();
  await expect(page.getByText(SEM_DADOS)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

for (const tema of TEMAS) for (const largura of LARGURAS) {
  const sufixo = `${tema.toLowerCase()}-${largura}`;

  test(`histórico parcial (true): a Visão geral e Lançamentos não mostram a ressalva nem a frase dos registros (${sufixo})`, async ({ page }) => {
    const parcial: Painel = { ...PAINEL_COM_DADOS, historicoFinanceiroParcial: true };
    const { errosDaPagina } = await abrir(page, parcial, { tema, largura });
    // Os valores continuam os mesmos; só os textos saíram.
    await expect(page.getByText('R$ 1.200,00', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/limpeza anterior/)).toHaveCount(0);
    await expect(page.getByText(NOTA_QUE_SAIU)).toHaveCount(0);
    await capturar(page, `financeiro-historico-parcial-${sufixo}`);

    // Aberta direto na aba Lançamentos (que lê o painel para o resultado do mês).
    await page.goto('/treinador/financeiro?aba=lancamentos');
    await expect(page.getByRole('heading', { name: /^Resultado do mês/ }).first()).toBeVisible();
    await expect(page.getByText(/limpeza anterior/)).toHaveCount(0);
    await expect(page.getByText(NOTA_QUE_SAIU)).toHaveCount(0);
    await capturar(page, `lancamentos-historico-parcial-${sufixo}`);
    expect(errosDaPagina).toEqual([]);
  });
}

const PAINEL_DO_INICIO = {
  atualizacoesParaRevisar: 0, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 0, alunosAtivos: 3,
  alunosSemRegistro: [], ultimasExecucoes: [], planosTerminando: [],
  pastasARenovar: 0, pastasParaRenovar: [], alunosSemPastaComPeriodo: 0, alunosSemRegistroTotal: 0, alunosSemAcesso: 0, alunosInativos: 0,
  sessoesConcluidas7Dias: 0,
};

for (const parcial of [false, true]) {
  test(`Início: bloco de dinheiro com consulta vazia mostra R$ 0 e a nota de cobranças já geradas, sem ressalva do histórico (parcial = ${parcial})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await fixarHoje(page);
    const painel: Painel = { ...PAINEL_VAZIO, historicoFinanceiroParcial: parcial };
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessaoComFinanceiro(page, ['FINANCEIRO_LER', 'FINANCEIRO_ALTERAR', 'ALUNO_LER', 'PAINEL_VER'])),
      ...rotasDoFinanceiro(estadoFinanceiro({ painel })),
      'GET /painel': { corpo: PAINEL_DO_INICIO },
    });
    await page.goto('/treinador');
    await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
    await expect(page.getByLabel('Recebido no mês, valor bruto: R$ 0')).toBeVisible();
    await expect(page.getByText('Vencidas e vencendo consideram só as cobranças já geradas.', { exact: false })).toBeVisible();
    // O histórico parcial não aparece no Início, nem com `historicoFinanceiroParcial: true` (25/11).
    await expect(page.getByText(AVISO_HISTORICO_PARCIAL, { exact: true })).toHaveCount(0);
    await expect(page.getByText(/limpeza anterior/)).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await capturar(page, `inicio-financeiro-${parcial ? 'parcial' : 'zero'}`);
    expect(errosDaPagina).toEqual([]);
  });
}

// ---- 13/11 (decisões do Gustavo): CSV, "Recurso desativado" e zero nos gráficos; a ressalva saiu das abas em 25/11 ----

const PLANO = { id: 'b0000000-0000-4000-8000-000000000001', nome: 'Consultoria mensal', valorCentavos: 15_000, periodicidade: 'MENSAL' as const, arquivado: false, criadoEm: '2026-10-01T12:00:00Z', versao: 0, tempoMinimoMeses: null, regraDeSaida: null, linkDePagamento: null, incluiTreino: true, incluiDieta: true };
const PARCIAL: Painel = { ...PAINEL_COM_DADOS, historicoFinanceiroParcial: true };
const DADOS_DAS_ABAS = { planos: [PLANO], cobrancas: [COBRANCA_ATRASADA] };
const ABAS_COM_VALORES = [['visao', 'Recebido no período'], ['cobrancas', 'Aluna Atrasada'], ['planos', 'Consultoria mensal'], ['lancamentos', 'Resultado do mês']] as const;
const painelCom = (status: number, codigo: string | null) => (_p: unknown, route: Parameters<typeof json>[0]) => json(route, erroApi(status, 'Falha.', codigo).corpo, status);

for (const [aba, conteudo] of ABAS_COM_VALORES) {
  test(`histórico parcial: a aba ${aba} não mostra a ressalva, mesmo entrando direto por ?aba=`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, PARCIAL, { rota: `/treinador/financeiro?aba=${aba}`, estado: DADOS_DAS_ABAS });
    await expect(page.getByText(conteudo).first()).toBeVisible();
    await expect(page.getByText(AVISO_HISTORICO_PARCIAL, { exact: true })).toHaveCount(0);
    await expect(page.getByText(/limpeza anterior/)).toHaveCount(0);
    await expect(page.getByText(NOTA_QUE_SAIU)).toHaveCount(0);
    await capturar(page, `sem-ressalva-${aba}-1280`);
    expect(errosDaPagina).toEqual([]);
  });
}

test('histórico parcial: Cobranças e Planos em 390 sem a ressalva, e cada aba tocada busca o painel do mês uma vez só (a aba é uma tela nova no histórico)', async ({ page }) => {
  const { pedidos, errosDaPagina } = await abrir(page, PARCIAL, { rota: '/treinador/financeiro?aba=cobrancas', largura: 390, estado: DADOS_DAS_ABAS });
  await expect(page.getByText('Aluna Atrasada').first()).toBeVisible();
  await expect(page.getByText(/limpeza anterior/)).toHaveCount(0);
  await capturar(page, 'sem-ressalva-cobrancas-390');
  const antes = pedidos.filter((p) => p.caminho === '/financeiro/painel').length;
  await page.getByRole('tab', { name: 'Planos' }).click();
  await expect(page.getByText('Consultoria mensal').first()).toBeVisible();
  await expect(page.getByText(/limpeza anterior/)).toHaveCount(0);
  await capturar(page, 'sem-ressalva-planos-390');
  expect(pedidos.filter((p) => p.caminho === '/financeiro/painel').length).toBe(antes + 1);
  expect(errosDaPagina).toEqual([]);
});

for (const aba of ['cobrancas', 'planos'] as const) {
  test(`o painel falha (500): a aba ${aba} segue com a lista, sem ressalva e sem erro novo`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, PARCIAL, {
      rota: `/treinador/financeiro?aba=${aba}`, estado: DADOS_DAS_ABAS, extra: { 'GET /financeiro/painel': painelCom(500, null) },
    });
    await expect(page.getByText(aba === 'planos' ? 'Consultoria mensal' : 'Aluna Atrasada').first()).toBeVisible();
    await expect(page.getByText(AVISO_HISTORICO_PARCIAL, { exact: true })).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('Tentar de novo')).toHaveCount(0);
    // Só a rede do próprio 500 do painel pode aparecer no console.
    expect(errosDaPagina.filter((e) => !/500/.test(e))).toEqual([]);
  });
}

test('Exportar CSV: explica a coluna historico_financeiro_parcial só com o campo true e o arquivo baixa sem alteração', async ({ page }) => {
  const csv = 'aluno;valor\nFulano;10,00\n';
  const { pedidos, errosDaPagina } = await abrir(page, PARCIAL, {
    extra: { 'GET /financeiro/exportacao': (_p, route) => route.fulfill({ status: 200, contentType: 'text/csv', body: csv }) },
  });
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const folha = page.getByRole('dialog', { name: 'Exportar CSV' });
  await expect(folha.getByText(AVISO_EXPORTACAO_PARCIAL, { exact: true })).toBeVisible();
  await expect(folha.getByRole('alert')).toHaveCount(0);
  expect(pedidos.some((p) => p.caminho === '/financeiro/exportacao')).toBe(false);
  await capturar(page, 'exportar-csv-explicacao');
  const [baixado] = await Promise.all([page.waitForEvent('download'), folha.getByRole('button', { name: 'Baixar CSV' }).click()]);
  const conteudo = (await (await import('node:fs/promises')).readFile((await baixado.path())!, 'utf8')).replace(/^﻿/, '');
  expect(conteudo).toBe(csv);
  expect(errosDaPagina).toEqual([]);
});

for (const [nome, painel] of [['false', { ...PAINEL_COM_DADOS, historicoFinanceiroParcial: false }], ['ausente', PAINEL_COM_DADOS]] as const) {
  test(`Exportar CSV (${nome}): sem explicação`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, painel);
    await page.getByRole('button', { name: 'Exportar CSV' }).click();
    await expect(page.getByRole('dialog', { name: 'Exportar CSV' })).toBeVisible();
    await expect(page.getByText(/historico_financeiro_parcial/)).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
}

for (const aba of ['visao', 'cobrancas', 'planos', 'lancamentos'] as const) {
  test(`503 FINANCEIRO_INDISPONIVEL na aba ${aba}: "Recurso desativado", sem "Tentar de novo" e sem zero`, async ({ page }) => {
    const indisponivel = painelCom(503, 'FINANCEIRO_INDISPONIVEL');
    const { errosDaPagina } = await abrir(page, PAINEL_COM_DADOS, {
      rota: `/treinador/financeiro?aba=${aba}`,
      extra: {
        'GET /financeiro/painel': indisponivel, 'GET /financeiro/cobrancas': indisponivel, 'GET /financeiro/planos': indisponivel,
        'GET /financeiro/lancamentos': indisponivel, 'GET /financeiro/inadimplentes': indisponivel, 'GET /financeiro/visao-geral': indisponivel,
      },
    });
    await expect(page.getByText('Recurso desativado', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('R$ 0,00')).toHaveCount(0);
    await capturar(page, `recurso-desativado-${aba}`);
    expect(errosDaPagina.filter((e) => !/503/.test(e))).toEqual([]);
  });
}

const SERIE_COM_ZERO: Painel['serie'] = [
  { mes: '2026-08', parcial: false, recebidoCentavos: 0, previstoCentavos: 0, entradasAvulsasCentavos: 0, saidasAvulsasCentavos: 0, resultadoCentavos: 0 },
  { mes: '2026-09', parcial: false, recebidoCentavos: null, previstoCentavos: null, entradasAvulsasCentavos: null, saidasAvulsasCentavos: null, resultadoCentavos: null },
  { mes: '2026-10', parcial: true, recebidoCentavos: 45_000, previstoCentavos: 45_000, entradasAvulsasCentavos: 0, saidasAvulsasCentavos: 0, resultadoCentavos: 45_000 },
];

for (const tema of TEMAS) {
  test(`gráfico da Visão geral: zero é traço fino com "R$ 0" (realizado e previsto), nulo segue sem marca (${tema.toLowerCase()})`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, { ...PAINEL_COM_DADOS, serie: SERIE_COM_ZERO }, { tema });
    const grafico = page.getByRole('img', { name: /^Recebido e previsto por mês/ });
    await expect(grafico).toBeVisible();
    // "R$ 0" do eixo (linha de base) + um por série zerada de agosto; setembro (nulo) não ganha marca.
    await expect(grafico.locator('svg text', { hasText: /^R\$ 0$/ })).toHaveCount(3);
    await capturar(page, `grafico-zero-visao-geral-${tema.toLowerCase()}-1280`);
    expect(errosDaPagina).toEqual([]);
  });
}
