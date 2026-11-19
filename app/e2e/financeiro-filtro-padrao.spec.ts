import { expect, test, type Page } from '@playwright/test';

import type { CobrancaResponse } from '../src/api/financeiroTipos';
import { simularApi, TREINADOR } from './api-falsa';
import { fixarHoje } from './aluno';
import { COBRANCA_ATRASADA, estadoFinanceiro, rotasDoFinanceiro, sessaoComFinanceiro, type EstadoFinanceiro } from './financeiro-falso';

/**
 * Filtro padrão das cobranças (19/11): a aba abre em Situação: Ativas e Mês de vencimento: o mês atual (relógio em 19/10/2026,
 * então 10/2026), que vai à API como vencimento de 01/10 a 31/10; os chips tiram um de cada vez, "Limpar filtros" grava
 * `filtro=nenhum` e o recarregar e o voltar continuam sem filtro; o mês vazio oferece "Ver todos os meses"; quem
 * chega com filtro próprio fica com o dele. Também as capturas da tabela e dos Totais em 1920 e 1280, claro e escuro.
 * Só dados fictícios, API simulada.
 */

const cobranca = (id: string, alunoNome: string, parcial: Partial<CobrancaResponse>): CobrancaResponse => ({
  ...COBRANCA_ATRASADA, id: `c0000000-0000-4000-8000-${id.padStart(12, '0')}`, alunoNome, criadoEm: '2026-09-28T12:00:00Z', ...parcial,
});
const EM_DIA = { vencida: false, diasDeAtraso: null };

const VENCIDA = cobranca('1', 'Bruna Teste', {});
const PAGA = cobranca('2', 'Caio Teste', {
  ...EM_DIA, situacao: 'PAGA', vencimento: '2026-10-10', pagoEm: '2026-10-12', forma: 'PIX_DIRETO', provedor: 'MANUAL', versao: 1, valorCentavos: 20_000,
});
const CANCELADA = cobranca('3', 'Dora Teste', { ...EM_DIA, situacao: 'CANCELADA', vencimento: '2026-10-15' });
const NOVEMBRO = cobranca('4', 'Elis Teste', { ...EM_DIA, competencia: '2026-11-05', vencimento: '2026-11-05' });
// Avulsa (sem competência): entra pelo mês em que vence.
const AVULSA = cobranca('5', 'Fabiana Albuquerque de Souza Teste', {
  ...EM_DIA, tipo: 'AVULSA', competencia: null, contratacaoId: null, planoNome: null, descricao: 'Avaliação presencial', vencimento: '2026-10-25',
  valorCentavos: 12_500,
});

const todas = () => [VENCIDA, PAGA, CANCELADA, NOVEMBRO, AVULSA].map((c) => ({ ...c }));

async function abrir(page: Page, estado: EstadoFinanceiro, consulta = '') {
  await fixarHoje(page);
  const api = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto(`/treinador/financeiro?aba=cobrancas${consulta}`);
  return api;
}

const comTema = (page: Page, tema: 'CLARO' | 'ESCURO') =>
  page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);

const chip = (page: Page, texto: string) => page.getByRole('button', { name: `Tirar filtro: ${texto}` });
const ultimoPedido = (pedidos: { caminho: string; busca: URLSearchParams }[]) => pedidos.filter((p) => p.caminho === '/financeiro/cobrancas').at(-1);

for (const largura of [390, 1280]) {
  test(`abre em Ativas e 10/2026 (${largura}px); os chips tiram um a um, Limpar grava filtro=nenhum e o recarregar e o voltar continuam sem filtro`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, estadoFinanceiro({ cobrancas: todas() }));
    await expect(chip(page, 'Situação: Ativas')).toBeVisible();
    await expect(chip(page, 'Mês de vencimento: 10/2026')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filtros, 2 ligados' })).toBeVisible();
    await expect(page.getByText('Bruna Teste', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Fabiana Albuquerque de Souza Teste', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Dora Teste', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Elis Teste', { exact: true })).toHaveCount(0);
    const padrao = ultimoPedido(pedidos);
    expect(padrao?.busca.getAll('situacao')).toEqual(['ABERTA', 'PAGA', 'CONTESTADA']);
    expect([padrao?.busca.get('de'), padrao?.busca.get('ate')]).toEqual(['2026-10-01', '2026-10-31']);
    // O padrão não escreve no endereço.
    await expect(page).toHaveURL(/\/treinador\/financeiro\?aba=cobrancas$/);
    await page.reload();
    await expect(chip(page, 'Mês de vencimento: 10/2026')).toBeVisible();

    // O ✕ do mês de vencimento tira só ele: o mês seguinte aparece, a situação fica no endereço.
    await chip(page, 'Mês de vencimento: 10/2026').click();
    await expect(page.getByText('Elis Teste', { exact: true }).first()).toBeVisible();
    await expect(chip(page, 'Situação: Ativas')).toBeVisible();
    await expect(page).toHaveURL(/situacao=ABERTA%2CPAGA%2CCONTESTADA|situacao=ABERTA,PAGA,CONTESTADA/);
    expect(ultimoPedido(pedidos)?.busca.get('de')).toBeNull();

    // Limpar filtros: tudo à vista e a marca no endereço; recarregar não traz o padrão de volta.
    await page.getByRole('button', { name: 'Limpar filtros aplicados' }).click();
    await expect(page).toHaveURL(/filtro=nenhum/);
    await expect(page.getByText('Dora Teste', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filtros, nenhum ligado' })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Dora Teste', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Tirar filtro/ })).toHaveCount(0);
    expect(ultimoPedido(pedidos)?.busca.getAll('situacao')).toEqual([]);

    // Outra aba e o voltar do navegador: continua sem filtro.
    await page.getByRole('tab', { name: 'Planos' }).click();
    await expect(page).toHaveURL(/aba=planos/);
    await page.goBack();
    await expect(page).toHaveURL(/filtro=nenhum/);
    await expect(page.getByText('Dora Teste', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Tirar filtro/ })).toHaveCount(0);
    // Só as do financeiro: o `GET /inscricoes` do menu não é desta tela.
    expect(naoTratadas.filter((r) => r.includes('/financeiro'))).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`mês sem cobrança ativa (${largura}px): "Nenhuma cobrança ativa em 10/2026" e "Ver todas as competências" tira só o mês de vencimento`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { naoTratadas, errosDaPagina } = await abrir(page, estadoFinanceiro({ cobrancas: [{ ...NOVEMBRO }, { ...CANCELADA }] }));
    await expect(page.getByText('Nenhuma cobrança ativa em 10/2026', { exact: true })).toBeVisible();
    await expect(page.getByText('Totais', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`vazio-${largura}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Ver todos os meses' }).click();
    await expect(page.getByText('Elis Teste', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Dora Teste', { exact: true })).toHaveCount(0);
    await expect(chip(page, 'Situação: Ativas')).toBeVisible();
    await expect(chip(page, 'Mês de vencimento: 10/2026')).toHaveCount(0);
    // Só as do financeiro: o `GET /inscricoes` do menu não é desta tela.
    expect(naoTratadas.filter((r) => r.includes('/financeiro'))).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('quem chega com filtro próprio fica com o dele: Vencidas do Início e o aluno da ficha, sem o mês de vencimento', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { pedidos, errosDaPagina } = await abrir(page, estadoFinanceiro({ cobrancas: todas() }), '&situacao=VENCIDA');
  await expect(chip(page, 'Situação: Vencidas')).toBeVisible();
  await expect(chip(page, 'Mês de vencimento: 10/2026')).toHaveCount(0);
  expect(ultimoPedido(pedidos)?.busca.get('de')).toBeNull();
  await page.goto(`/treinador/financeiro?aba=cobrancas&alunoId=${NOVEMBRO.alunoId}`);
  await expect(page.getByRole('button', { name: 'Ver cobranças de todos os alunos' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Tirar filtro/ })).toHaveCount(0);
  // "Ver cobranças de todos os alunos" tira o aluno e não traz o padrão de volta.
  await page.getByRole('button', { name: 'Ver cobranças de todos os alunos' }).click();
  await expect(page).toHaveURL(/filtro=nenhum/);
  await expect(page.getByRole('button', { name: /Tirar filtro/ })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('no painel, Mês de vencimento e Vencimento não valem juntos: escolher os próximos 7 dias tira o mês de vencimento', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { pedidos, errosDaPagina } = await abrir(page, estadoFinanceiro({ cobrancas: todas() }));
  await page.getByRole('button', { name: 'Filtros, 2 ligados' }).click();
  const painel = page.getByRole('dialog', { name: 'Filtros de cobranças' });
  await expect(painel.getByRole('button', { name: 'Mês de vencimento: 10/2026. Escolher.' })).toBeVisible();
  await painel.getByRole('radiogroup', { name: 'Vencimento' }).getByRole('radio', { name: 'Próximos 7 dias' }).click();
  await expect(painel.getByRole('button', { name: 'Mês de vencimento: Qualquer. Escolher.' })).toBeVisible();
  await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(chip(page, 'Vencimento: de hoje até 26/10/2026')).toBeVisible();
  await expect(chip(page, 'Mês de vencimento: 10/2026')).toHaveCount(0);
  expect([ultimoPedido(pedidos)?.busca.get('de'), ultimoPedido(pedidos)?.busca.get('ate')]).toEqual(['2026-10-19', '2026-10-26']);
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [1920, 1280]) {
  for (const tema of ['CLARO', 'ESCURO'] as const) {
    test(`capturas em ${largura}px (${tema.toLowerCase()}): colunas distribuídas, totais com a cor das pílulas, Vencido zerado neutro`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: largura, height: 1000 });
      await comTema(page, tema);
      const estado = estadoFinanceiro({ cobrancas: todas() });
      const { errosDaPagina } = await abrir(page, estado);
      await expect(page.getByRole('columnheader', { name: 'Competência' })).toBeVisible();
      // Cabeçalho e linhas com as mesmas bordas: a coluna Valor começa no mesmo x nas duas.
      const cabecalho = (await page.getByRole('columnheader', { name: 'Valor' }).boundingBox())!;
      const celula = (await page.getByRole('cell').filter({ hasText: 'R$ 150,00' }).first().boundingBox())!;
      expect(Math.abs(cabecalho.x - celula.x)).toBeLessThanOrEqual(1);
      const nome = page.getByText('Fabiana Albuquerque de Souza Teste', { exact: true }).first();
      expect(await nome.evaluate((e) => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`padrao-${largura}-${tema.toLowerCase()}.png`), fullPage: true });

      await page.getByRole('button', { name: 'Limpar filtros aplicados' }).click();
      await expect(page.getByText('Dora Teste', { exact: true }).first()).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`sem-filtro-${largura}-${tema.toLowerCase()}.png`), fullPage: true });

      // Sem vencida: o Vencido fica em R$ 0,00, sem tom.
      estado.cobrancas = [{ ...PAGA }, { ...AVULSA }];
      await page.reload();
      await expect(page.getByLabel(/^Vencido: R\$\s0,00/)).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`vencido-zero-${largura}-${tema.toLowerCase()}.png`), fullPage: true });

      // Mês sem cobrança ativa, com a ação à vista.
      estado.cobrancas = [{ ...NOVEMBRO }];
      await page.goto('/treinador/financeiro?aba=cobrancas');
      const verTodas = page.getByRole('button', { name: 'Ver todos os meses' });
      await verTodas.scrollIntoViewIfNeeded();
      await expect(verTodas).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`vazio-${largura}-${tema.toLowerCase()}.png`), fullPage: true });
      expect(errosDaPagina).toEqual([]);
    });
  }
}
