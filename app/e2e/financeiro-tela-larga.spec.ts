import { expect, test, type Locator, type Page } from '@playwright/test';

import type { CobrancaResponse, LancamentoResponse, PlanoResponse } from '../src/api/financeiroTipos';
import { fixarHoje } from './aluno';
import { simularApi, TREINADOR } from './api-falsa';
import { COBRANCA_ATRASADA, estadoFinanceiro, rotasDoFinanceiro, sessaoComFinanceiro, type EstadoFinanceiro } from './financeiro-falso';

/**
 * Financeiro em tela larga (23/11, `docs/planos/financeiro-em-tela-larga.md`): Cobranças e Lançamentos sem teto de largura
 * (o espaço vira colunas), o detalhe da cobrança fixo à direita (480 px) só na faixa `ultralarga` da área (2560 com o menu
 * recolhido: área de 2488 px) e a folha abaixo dela (2560 com o menu aberto é `larga`), e a grade de Planos de 1 a 4
 * colunas sem cartão sozinho na última linha. Relógio fixo em 19/10/2026; só dados fictícios, API simulada.
 */

const cobranca = (n: number, alunoNome: string, parcial: Partial<CobrancaResponse> = {}): CobrancaResponse => ({
  ...COBRANCA_ATRASADA, id: `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, alunoNome, criadoEm: '2026-09-28T12:00:00Z', ...parcial,
});
const COBRANCAS = [cobranca(1, 'Ana Teste'), cobranca(2, 'Bruno Teste', { vencimento: '2026-10-26', vencida: false, diasDeAtraso: null })];

const plano = (n: number, parcial: Partial<PlanoResponse> = {}): PlanoResponse => ({
  id: `f0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, nome: `Plano ${n}`, valorCentavos: 15_000 + n * 100, periodicidade: 'MENSAL',
  arquivado: false, criadoEm: '2026-10-01T12:00:00Z', versao: 0, tempoMinimoMeses: null, regraDeSaida: null, linkDePagamento: null,
  incluiTreino: true, incluiDieta: true, ...parcial,
});

const lancamento = (n: number): LancamentoResponse => ({
  id: `d0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, data: '2026-10-1' + (n % 9), descricao: `Lançamento ${n}`, valorCentavos: 5_000,
  tipo: n % 2 ? 'ENTRADA' : 'SAIDA', categoria: 'Equipamentos', criadoEm: '2026-10-10T12:00:00Z', versao: 0,
});

async function abrir(page: Page, largura: number, estado: EstadoFinanceiro, aba: string, menuRecolhido = false) {
  await page.setViewportSize({ width: largura, height: 1080 });
  await fixarHoje(page);
  await page.addInitScript(([recolhido, id]) => {
    if (recolhido) localStorage.setItem('menu-lateral-recolhido', '1');
    localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' }));
  }, [menuRecolhido, TREINADOR.id] as const);
  const api = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto(`/treinador/financeiro?aba=${aba}`);
  return api;
}

/** As caixas dos botões do painel, na ordem pedida. */
const caixasDosBotoes = (painel: Locator, nomes: string[]) =>
  Promise.all(nomes.map(async (name) => (await painel.getByRole('button', { name, exact: true }).boundingBox())!));

/** A borda direita do conteúdo: a do cabeçalho de abas (que já ocupa a largura útil). */
async function bordaDoConteudo(page: Page) {
  const abas = (await page.getByRole('tablist').first().boundingBox())!;
  return abas.x + abas.width;
}

for (const largura of [1920, 2560]) {
  test(`${largura}px: a tabela de Cobranças ocupa a largura toda e, com o menu aberto, a cobrança abre na folha`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura, estadoFinanceiro({ cobrancas: COBRANCAS }), 'cobrancas');
    const tabela = page.getByRole('table', { name: 'Cobranças' });
    await expect(tabela).toBeVisible();
    const caixa = (await tabela.boundingBox())!;
    // Só o recuo do cartão separa a tabela da borda do conteúdo (antes parava em 2400 ou 1800 px).
    expect(caixa.x + caixa.width).toBeGreaterThan((await bordaDoConteudo(page)) - 48);
    await page.getByRole('button', { name: 'Abrir cobrança de Ana Teste' }).click();
    await expect(page.getByRole('dialog', { name: 'Cobrança de 10/2026' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Cobrança de 10/2026' })).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`${largura}px: Lançamentos sem teto e com as colunas distribuídas (Descrição 2, Data 1, Valor à direita)`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura, estadoFinanceiro({ lancamentos: [1, 2, 3].map(lancamento) }), 'lancamentos');
    const tabela = page.getByRole('table', { name: 'Lançamentos avulsos' });
    await expect(tabela).toBeVisible();
    const caixa = (await tabela.boundingBox())!;
    expect(caixa.x + caixa.width).toBeGreaterThan((await bordaDoConteudo(page)) - 48);
    const larguraDe = async (nome: string) => (await tabela.getByRole('columnheader', { name: nome }).boundingBox())!.width;
    const [descricao, data, tipo, categoria] = await Promise.all(['Descrição', 'Data', 'Tipo', 'Categoria'].map(larguraDe));
    expect(Math.abs(descricao / data - 2)).toBeLessThan(0.1);
    expect(Math.abs(tipo - data)).toBeLessThan(2);
    expect(Math.abs(categoria - data)).toBeLessThan(2);
    expect(errosDaPagina).toEqual([]);
  });
}

test('2560 px com o menu recolhido (ultralarga): o detalhe abre fixo à direita, com 480 px, e a tabela encolhe', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 2560, estadoFinanceiro({ cobrancas: COBRANCAS }), 'cobrancas', true);
  const tabela = page.getByRole('table', { name: 'Cobranças' });
  const antes = (await tabela.boundingBox())!.width;
  const linha = page.getByRole('button', { name: 'Abrir cobrança de Ana Teste' });
  await linha.click();
  const painel = page.getByRole('region', { name: 'Cobrança de 10/2026' });
  await expect(painel).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const caixa = (await painel.boundingBox())!;
  expect(Math.round(caixa.width)).toBe(480);
  const depois = (await tabela.boundingBox())!;
  expect(depois.width).toBeLessThan(antes - 400);
  expect(depois.x + depois.width).toBeLessThan(caixa.x);
  // O mesmo conteúdo da folha: nome como link, prazo e rodapé de ações dentro do painel.
  await expect(painel.getByRole('link', { name: 'Abrir ficha de Ana Teste' })).toBeVisible();
  await expect(painel.getByText('14 dias de atraso')).toBeVisible();
  // Rodapé em duas linhas fixas: "Registrar pagamento" em cima, na largura toda; "Cancelar cobrança" e "Renegociar" embaixo, meia largura cada.
  const [registrar, cancelar, renegociar] = await caixasDosBotoes(painel, ['Registrar pagamento', 'Cancelar cobrança', 'Renegociar']);
  expect(cancelar.y).toBeGreaterThan(registrar.y + registrar.height - 1);
  expect(Math.round(cancelar.y)).toBe(Math.round(renegociar.y));
  expect(cancelar.x).toBeLessThan(renegociar.x);
  expect(Math.abs(cancelar.width - renegociar.width)).toBeLessThan(2);
  // As duas metades vão da borda esquerda à direita da principal.
  expect(Math.abs(cancelar.x - registrar.x)).toBeLessThan(2);
  expect(Math.abs(renegociar.x + renegociar.width - (registrar.x + registrar.width))).toBeLessThan(2);
  expect(cancelar.width).toBeLessThan(registrar.width / 2);
  // O foco vai ao título do painel.
  await expect.poll(() => painel.evaluate((el) => (el.contains(document.activeElement) ? document.activeElement?.textContent : null))).toBe('Cobrança de 10/2026');

  // Abrir outra troca o conteúdo; a tabela continua usável ao lado.
  await page.getByRole('button', { name: 'Abrir cobrança de Bruno Teste' }).click();
  await expect(painel.getByRole('link', { name: 'Abrir ficha de Bruno Teste' })).toBeVisible();
  await expect(painel.getByText('Vence em 7 dias')).toBeVisible();

  // Fechar devolve a largura à tabela e o foco à linha que abriu.
  await painel.getByRole('button', { name: 'Fechar' }).click();
  await expect(painel).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Abrir cobrança de Bruno Teste' })).toBeFocused();
  expect(Math.round((await tabela.boundingBox())!.width)).toBe(Math.round(antes));

  // O Esc da confirmação aberta a partir do painel fecha só a confirmação; o Esc dentro do painel fecha o painel.
  await linha.click();
  await expect(painel).toBeVisible();
  await painel.getByRole('button', { name: 'Cancelar cobrança' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Cancelar esta cobrança?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(painel).toBeVisible();
  await painel.getByRole('button', { name: 'Fechar' }).focus();
  await page.keyboard.press('Escape');
  await expect(painel).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('2560 px com o menu recolhido: na cobrança paga o rodapé do painel segue as duas linhas (a última ação em cima, as outras lado a lado)', async ({ page }) => {
  const paga = cobranca(3, 'Dora Teste', {
    situacao: 'PAGA', vencimento: '2026-10-10', vencida: false, diasDeAtraso: null, pagoEm: '2026-10-15', forma: 'PIX_DIRETO', provedor: 'MANUAL',
    baixaPor: 'u1', baixaPorNome: 'Treinador Teste', versao: 1,
  });
  const { errosDaPagina } = await abrir(page, 2560, estadoFinanceiro({ cobrancas: [paga] }), 'cobrancas', true);
  await page.getByRole('button', { name: 'Abrir cobrança de Dora Teste' }).click();
  const painel = page.getByRole('region', { name: 'Cobrança de 10/2026' });
  await expect(painel).toBeVisible();
  const [contestar, estorno, desfazer] = await caixasDosBotoes(painel, ['Marcar contestação', 'Marcar estorno', 'Desfazer baixa']);
  expect(estorno.y).toBeGreaterThan(contestar.y + contestar.height - 1);
  expect(Math.round(estorno.y)).toBe(Math.round(desfazer.y));
  expect(Math.abs(estorno.x - contestar.x)).toBeLessThan(2);
  expect(Math.abs(desfazer.x + desfazer.width - (contestar.x + contestar.width))).toBeLessThan(2);
  expect(Math.abs(estorno.width - desfazer.width)).toBeLessThan(2);
  expect(errosDaPagina).toEqual([]);
});

test('Planos: grade de 1 a 4 colunas pela largura, sem cartão sozinho na última linha; arquivados com o selo', async ({ page }) => {
  const colunas = async () => new Set(await page.getByRole('button', { name: /^Abrir plano / }).evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().left)))).size;
  const estado = estadoFinanceiro({
    planos: [...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => plano(n, n === 2 ? { tempoMinimoMeses: 5, linkDePagamento: 'https://pagamento.exemplo.invalid/p' } : {})),
      plano(9, { arquivado: true, nome: 'Plano antigo' })],
  });
  const { errosDaPagina } = await abrir(page, 2560, estado, 'planos');
  await expect(page.getByRole('button', { name: 'Abrir plano Plano 1' })).toBeVisible();
  await expect.poll(colunas).toBe(4);
  const segundo = page.getByRole('button', { name: 'Abrir plano Plano 2' });
  await expect(segundo.getByText('Mínimo de 5 meses · Treino e dieta')).toBeVisible();
  await expect(segundo.getByText('Com link de pagamento')).toBeVisible();
  await expect(segundo.getByText('R$ 152,00')).toBeVisible();

  // Com os arquivados (9 planos, teto 4): 3 colunas, para a última linha não ficar com um cartão sozinho.
  await page.getByRole('switch', { name: 'Mostrar arquivados' }).click();
  const antigo = page.getByRole('button', { name: 'Abrir plano Plano antigo' });
  await expect(antigo.getByText('Arquivado', { exact: true })).toBeVisible();
  await expect.poll(colunas).toBe(3);

  // O cartão abre o plano, como a linha da tabela de antes.
  await antigo.click();
  await expect(page.getByRole('dialog', { name: 'Plano' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click();

  // 1280 com o menu aberto: ~970 px de grade (abaixo da faixa normal), teto 2; 9 planos ficam em 2.
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(colunas).toBe(2);
  await page.setViewportSize({ width: 390, height: 900 });
  await expect.poll(colunas).toBe(1);
  expect(errosDaPagina).toEqual([]);
});
