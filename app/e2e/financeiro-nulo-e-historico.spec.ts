import { expect, test, type Page } from '@playwright/test';

import type { Painel } from '../src/api/financeiroTipos';
import { AVISO_HISTORICO_PARCIAL, NOTA_REGISTROS_DISPONIVEIS } from '../src/dominio/financeiro';
import { fixarHoje } from './aluno';
import { simularApi, TREINADOR } from './api-falsa';
import { estadoFinanceiro, PAINEL_COM_DADOS, PAINEL_VAZIO, rotasDoFinanceiro, sessaoComFinanceiro } from './financeiro-falso';

/**
 * Financeiro: zero, nulo e ressalvas (`docs/planos/nulo-e-cobertura.md`, 13/11). Consulta válida e vazia mostra R$ 0,00 e
 * `recebido` 0 no mês é barra zerada (não "sem dado"); resultado nulo mostra "—" com o motivo escrito, nunca zero; a frase
 * geral dos registros disponíveis aparece uma vez; `historicoFinanceiroParcial` mostra a ressalva informativa (neutra, uma vez
 * por tela) na Visão geral e em Lançamentos, e some com `false` ou ausente. Dados fictícios; relógio em 19/10/2026.
 * Com `CAPTURAS=<pasta>` grava as imagens (claro e escuro, 1280 e 390).
 */

const TEMAS = ['CLARO', 'ESCURO'] as const;
const LARGURAS = [1280, 390] as const;
const SEM_LANCAMENTOS = 'Sem lançamentos avulsos registrados neste mês, então o resultado não pode ser calculado.';

async function abrir(page: Page, painel: Painel, o: { rota?: string; tema?: (typeof TEMAS)[number]; largura?: number } = {}) {
  await page.setViewportSize({ width: o.largura ?? 1280, height: 1000 });
  await fixarHoje(page);
  if (o.tema) await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, o.tema] as const);
  const api = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estadoFinanceiro({ painel })) });
  await page.goto(o.rota ?? '/treinador/financeiro');
  return api;
}
const capturar = async (page: Page, nome: string) => {
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/${nome}.png`, fullPage: true });
};

test('consulta válida sem pagamentos: R$ 0,00 no recebido, e a frase dos registros disponíveis aparece uma vez', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, PAINEL_VAZIO);
  await expect(page.getByLabel('Recebido no período: R$ 0,00', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Recebido das cobranças: R$ 0,00')).toBeVisible();
  await expect(page.getByText('Recebido no período —')).toHaveCount(0);
  await expect(page.getByText(NOTA_REGISTROS_DISPONIVEIS)).toHaveCount(1);
  // "Cobranças já geradas" segue visível nos cartões de previsto, a receber e atraso.
  await expect(page.getByText('considera as cobranças já geradas').first()).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('série do mês: recebido 0 é barra zerada com "R$ 0,00"; sem dado (nulo) não vira zero (gráfico e tabela)', async ({ page }) => {
  const serie: Painel['serie'] = [
    { mes: '2026-08', parcial: false, recebidoCentavos: 0, previstoCentavos: null, entradasAvulsasCentavos: 0, saidasAvulsasCentavos: 0, resultadoCentavos: 0 },
    { mes: '2026-09', parcial: false, recebidoCentavos: null, previstoCentavos: null, entradasAvulsasCentavos: null, saidasAvulsasCentavos: null, resultadoCentavos: null },
    { mes: '2026-10', parcial: true, recebidoCentavos: 45_000, previstoCentavos: 45_000, entradasAvulsasCentavos: 0, saidasAvulsasCentavos: 0, resultadoCentavos: 45_000 },
  ];
  // Gráfico (1280): o texto do leitor de tela traz "recebido R$ 0,00" para agosto e "recebido —" para setembro.
  const { errosDaPagina } = await abrir(page, { ...PAINEL_COM_DADOS, serie });
  const grafico = page.getByRole('img', { name: /^Recebido e previsto por mês/ });
  await expect(grafico).toBeVisible();
  const rotulo = (await grafico.getAttribute('aria-label')) ?? '';
  expect(rotulo).toMatch(/ago[^:]*: recebido R\$ 0,00\./i);
  expect(rotulo).toMatch(/set[^:]*: recebido —\./i);
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
  const resultado = page.getByLabel(`Resultado: —. ${SEM_LANCAMENTOS}`);
  await expect(resultado).toBeVisible();
  await expect(resultado.getByText(SEM_LANCAMENTOS)).toBeVisible();
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
  await expect(page.getByText(SEM_LANCAMENTOS)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

for (const tema of TEMAS) for (const largura of LARGURAS) {
  const sufixo = `${tema.toLowerCase()}-${largura}`;

  test(`histórico parcial: a ressalva aparece na Visão geral e em Lançamentos, neutra e uma vez por tela (${sufixo})`, async ({ page }) => {
    const parcial: Painel = { ...PAINEL_COM_DADOS, historicoFinanceiroParcial: true };
    const { errosDaPagina } = await abrir(page, parcial, { tema, largura });
    await expect(page.getByText(AVISO_HISTORICO_PARCIAL, { exact: true })).toHaveCount(1);
    await expect(page.getByText(AVISO_HISTORICO_PARCIAL, { exact: true })).toBeVisible();
    // Informativo: nada de região de alerta e nenhum valor muda.
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('R$ 1.200,00', { exact: true }).first()).toBeVisible();
    await capturar(page, `financeiro-historico-parcial-${sufixo}`);

    // Aberta direto na aba Lançamentos (que lê o painel para o resultado do mês).
    await page.goto('/treinador/financeiro?aba=lancamentos');
    await expect(page.getByText(AVISO_HISTORICO_PARCIAL, { exact: true })).toHaveCount(1);
    await expect(page.getByText(NOTA_REGISTROS_DISPONIVEIS)).toHaveCount(1);
    await capturar(page, `lancamentos-historico-parcial-${sufixo}`);
    expect(errosDaPagina).toEqual([]);
  });
}

// O campo ausente (mocks antigos) é o `PAINEL_COM_DADOS` como está; `false` é o explícito.
for (const [nome, painel] of [['false', { ...PAINEL_COM_DADOS, historicoFinanceiroParcial: false }], ['ausente', PAINEL_COM_DADOS]] as const) {
  test(`histórico não parcial (${nome}): nenhuma ressalva, nem na Visão geral nem em Lançamentos`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, painel);
    await expect(page.getByText('Recebido no período')).toBeVisible();
    await expect(page.getByText(/limpeza anterior/)).toHaveCount(0);
    await page.goto('/treinador/financeiro?aba=lancamentos');
    await expect(page.getByText(NOTA_REGISTROS_DISPONIVEIS)).toBeVisible();
    await expect(page.getByText(/limpeza anterior/)).toHaveCount(0);
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
  test(`Início: bloco de dinheiro com consulta vazia mostra R$ 0 e a nota de cobranças já geradas; ressalva do histórico ${parcial ? 'aparece' : 'não aparece'}`, async ({ page }) => {
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
    await expect(page.getByText(/limpeza anterior/)).toHaveCount(parcial ? 2 : 0);
    await capturar(page, `inicio-financeiro-${parcial ? 'parcial' : 'zero'}`);
    expect(errosDaPagina).toEqual([]);
  });
}
