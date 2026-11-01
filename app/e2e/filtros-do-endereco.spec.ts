import { expect, test, type Page } from '@playwright/test';

import type { CobrancaResponse } from '../src/api/financeiroTipos';
import type { RetornoPendente } from '../src/api/inscricoesTipos';
import { json, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { fixarHoje } from './aluno';
import { COBRANCA_ATRASADA, estadoFinanceiro, PERMISSOES_FINANCEIRO, rotasDoFinanceiro, sessaoComFinanceiro } from './financeiro-falso';
import { contagensFalsas, idDe, resumoFalso, rotasDaTela } from './inscricoes-falsas';

/**
 * Filtros que chegam pelo endereço (os mini-cartões do painel do Início, 30/10): Interessados `?retornos=ATE_HOJE` e
 * `?visao=kanban&etapas=EM_CONTATO,EM_NEGOCIACAO`; Financeiro `?aba=cobrancas&situacao=VENCIDA` e
 * `?aba=cobrancas&situacao=ABERTA&vencimento=PROXIMOS_7_DIAS`. Cada um aparece marcado, soma com `?meus=true`, se limpa pela
 * tela e valor desconhecido é ignorado. Relógio em 19/10/2026; só dados fictícios.
 */

/** Pedidos da lista de inscrições feitos pela tela; o menu também pede `situacao=NOVA&meus=false` (o ponto de Interessados). */
const daTela = (p: { caminho: string; busca: URLSearchParams }) =>
  p.caminho === '/inscricoes' && !(p.busca.get('situacao') === 'NOVA' && p.busca.get('meus') === 'false' && p.busca.get('pagina') === '0' && !p.busca.has('tamanho'));

const opcao = (page: Page, grupo: string, rotulo: string) =>
  page.getByRole('radiogroup', { name: grupo }).getByRole('button', { name: rotulo, exact: true });

function retorno(n: number, data: string): RetornoPendente {
  return {
    id: `r-${n}`, descricao: `Retorno fictício ${n}`, data, responsavelId: null, responsavelNome: null, concluidoEm: null,
    concluidoPorNome: null, criadoEm: '2026-10-10T13:00:00Z', versao: 1, inscricaoId: idDe(n), inscricaoNome: `Pessoa Fictícia ${n}`,
    situacao: 'EM_CONTATO', atrasado: data < '2026-10-19',
  };
}

/** Um atrasado, um de hoje e um futuro, que o filtro tem de esconder. */
const RETORNOS = [retorno(1, '2026-10-15'), retorno(2, '2026-10-19'), retorno(3, '2026-10-25')];

async function abrirInteressados(page: Page, caminho: string, extra: RespostasApi = {}) {
  await fixarHoje(page);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...rotasDaTela(),
    'GET /inscricoes/retornos': { corpo: RETORNOS },
    'GET /inscricoes': (p, route) => {
      const s = p.busca.get('situacao');
      if (s === 'NOVA') return json(route, { itens: [resumoFalso(10)], total: 1 });
      if (s === 'EM_CONTATO') return json(route, { itens: [resumoFalso(11, { situacao: 'EM_CONTATO' })], total: 1 });
      if (s === 'EM_NEGOCIACAO') return json(route, { itens: [resumoFalso(12, { situacao: 'EM_NEGOCIACAO' })], total: 1 });
      return json(route, { itens: [resumoFalso(10)], total: 1 });
    },
    'GET /inscricoes/contagens': { corpo: contagensFalsas({ NOVA: 1, EM_CONTATO: 1, EM_NEGOCIACAO: 1 }, { retornosAtrasados: 1, retornosHoje: 1 }) },
    ...extra,
  });
  await page.goto(caminho);
  await expect(page.getByRole('heading', { name: 'Interessados', level: 1 })).toBeVisible();
  return api;
}

for (const largura of [390, 1280]) {
  test.describe(`${largura}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
    });

    test('Interessados ?retornos=ATE_HOJE: só os atrasados e os de hoje, marcado, com Meus; limpar volta à lista', async ({ page }) => {
      const { pedidos, naoTratadas, errosDaPagina } = await abrirInteressados(page, '/treinador/interessados?retornos=ATE_HOJE&meus=true');
      await expect(page.getByText('Retornos atrasados ou de hoje')).toBeVisible();
      await expect(page.getByText('Pessoa Fictícia 1', { exact: true })).toBeVisible();
      await expect(page.getByText('Pessoa Fictícia 2', { exact: true })).toBeVisible();
      await expect(page.getByText('Pessoa Fictícia 3', { exact: true })).toHaveCount(0);
      await expect(opcao(page, 'Responsável', 'Meus')).toHaveAttribute('aria-checked', 'true');
      expect(pedidos.filter((p) => p.caminho === '/inscricoes/retornos').every((p) => p.busca.get('meus') === 'true')).toBe(true);
      // A tabela das inscrições não é buscada enquanto o filtro dos retornos vale.
      expect(pedidos.some(daTela)).toBe(false);

      await page.getByRole('button', { name: 'Limpar filtro: Retornos atrasados ou de hoje' }).click();
      await expect(page).toHaveURL(/\/treinador\/interessados\?meus=true$/);
      await expect(page.getByText('Retornos atrasados ou de hoje')).toHaveCount(0);
      await expect(page.getByText('Pessoa Fictícia 3', { exact: true })).toBeVisible();
      await expect(page.getByText('Pessoa Fictícia 10', { exact: true })).toBeVisible();
      expect(pedidos.some((p) => daTela(p) && p.busca.get('meus') === 'true')).toBe(true);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Interessados ?retornos=ATE_HOJE sem nenhum para hoje: estado vazio com o filtro marcado', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrirInteressados(page, '/treinador/interessados?retornos=ATE_HOJE', {
        'GET /inscricoes/retornos': { corpo: [retorno(3, '2026-10-25')] },
      });
      await expect(page.getByText('Nenhum retorno para hoje')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Limpar filtro: Retornos atrasados ou de hoje' })).toBeVisible();
      await expect(page.getByText('Pessoa Fictícia 3', { exact: true })).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Interessados ?visao=kanban&etapas=EM_CONTATO,EM_NEGOCIACAO: só as duas colunas, marcado; limpar mostra Novas', async ({ page }) => {
      const { pedidos, naoTratadas, errosDaPagina } = await abrirInteressados(page, '/treinador/interessados?visao=kanban&etapas=EM_CONTATO,EM_NEGOCIACAO');
      await expect(page.getByText('Em contato ou em negociação')).toBeVisible();
      await expect(page.getByText('Pessoa Fictícia 11', { exact: true })).toBeVisible();
      if (largura >= 1280) await expect(page.getByText('Pessoa Fictícia 12', { exact: true })).toBeVisible();
      else {
        // No celular é uma coluna por vez: começa na primeira do filtro e a escolha só oferece as duas.
        await expect(opcao(page, 'Coluna', 'Em contato · 1')).toHaveAttribute('aria-checked', 'true');
        await expect(opcao(page, 'Coluna', 'Novas · 1')).toHaveCount(0);
        await opcao(page, 'Coluna', 'Em negociação · 1').click();
        await expect(page.getByText('Pessoa Fictícia 12', { exact: true })).toBeVisible();
      }
      await expect(page.getByText('Pessoa Fictícia 10', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Mostrar encerradas')).toHaveCount(0);
      expect(pedidos.some((p) => daTela(p) && p.busca.get('situacao') === 'NOVA')).toBe(false);

      await page.getByRole('button', { name: 'Limpar filtro: Em contato ou em negociação' }).click();
      await expect(page).toHaveURL(/\/treinador\/interessados\?visao=kanban$/);
      await expect(page.getByText('Mostrar encerradas')).toBeVisible();
      if (largura >= 1280) await expect(page.getByText('Pessoa Fictícia 10', { exact: true })).toBeVisible();
      else await expect(opcao(page, 'Coluna', 'Novas · 1')).toBeVisible();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}

test('Interessados com valores desconhecidos no endereço: a tela abre sem filtro e sem erro', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { naoTratadas, errosDaPagina } = await abrirInteressados(page, '/treinador/interessados?retornos=SEMPRE');
  await expect(page.getByText('Pessoa Fictícia 10', { exact: true })).toBeVisible();
  await expect(page.getByText('Pessoa Fictícia 3', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Limpar filtro/ })).toHaveCount(0);

  await page.goto('/treinador/interessados?visao=kanban&etapas=QUALQUER,ACEITA');
  await expect(page.getByText('Mostrar encerradas')).toBeVisible();
  await expect(page.getByText('Pessoa Fictícia 10', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Limpar filtro/ })).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

// ---- Financeiro ----

const VENCENDO: CobrancaResponse = {
  ...COBRANCA_ATRASADA, id: 'c0000000-0000-4000-8000-0000000000a1', alunoNome: 'Aluno Vencendo', vencimento: '2026-10-22', vencida: false, diasDeAtraso: 0,
};
const DEPOIS: CobrancaResponse = {
  ...COBRANCA_ATRASADA, id: 'c0000000-0000-4000-8000-0000000000a2', alunoNome: 'Aluno Depois', vencimento: '2026-10-29', vencida: false, diasDeAtraso: 0,
};
const PAGA: CobrancaResponse = {
  ...COBRANCA_ATRASADA, id: 'c0000000-0000-4000-8000-0000000000a3', alunoNome: 'Aluna Paga', vencimento: '2026-10-20', vencida: false, diasDeAtraso: 0,
  situacao: 'PAGA', pagoEm: '2026-10-18', forma: 'PIX',
};

/** A lista de cobranças como a API: situação (VENCIDA = aberta e vencida) e vencimento entre `de` e `ate`. */
async function abrirFinanceiro(page: Page, caminho: string) {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ cobrancas: [COBRANCA_ATRASADA, VENCENDO, DEPOIS, PAGA] });
  const api = await simularApi(page, {
    ...(await sessaoComFinanceiro(page, PERMISSOES_FINANCEIRO, false)),
    ...rotasDoFinanceiro(estado),
    // O ponto de Interessados no menu (a sessão do treinador tem INSCRICAO_LER).
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /financeiro/cobrancas': (p, route) => {
      const situacoes = p.busca.getAll('situacao');
      const de = p.busca.get('de') ?? '0000-01-01';
      const ate = p.busca.get('ate') ?? '9999-12-31';
      const itens = estado.cobrancas.filter((c) => (!situacoes.length || situacoes.some((situacao) => (situacao === 'VENCIDA' ? c.situacao === 'ABERTA' && c.vencida : c.situacao === situacao)))
        && c.vencimento >= de && c.vencimento <= ate);
      return json(route, { itens, total: itens.length, pagina: 0 });
    },
  });
  await page.goto(caminho);
  await expect(page.getByRole('heading', { name: 'Financeiro', level: 1 })).toBeVisible();
  return api;
}

test('Financeiro ?situacao=VENCIDA com meus=true: só as vencidas, "Vencidas" e "Meus" marcados', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { pedidos, naoTratadas, errosDaPagina } = await abrirFinanceiro(page, '/treinador/financeiro?aba=cobrancas&situacao=VENCIDA&meus=true');
  await expect(page.getByText('Aluna Atrasada', { exact: true })).toBeVisible();
  await expect(page.getByText('Aluno Vencendo', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Aluna Paga', { exact: true })).toHaveCount(0);
  // Os filtros do endereço aparecem como chips no "Filtrado por" e marcados no painel de filtros.
  await expect(page.getByRole('button', { name: 'Tirar filtro: Situação: Vencidas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tirar filtro: Responsável: Meus' })).toBeVisible();
  await page.getByRole('button', { name: /^Filtros, / }).click();
  await expect(page.getByRole('button', { name: 'Situação: Vencidas. Escolher.' })).toBeVisible();
  await expect(opcao(page, 'Responsável', 'Meus')).toHaveAttribute('aria-checked', 'true');
  const ultimo = pedidos.filter((p) => p.caminho === '/financeiro/cobrancas').at(-1);
  expect(ultimo?.busca.getAll('situacao')).toEqual(['VENCIDA']);
  expect(ultimo?.busca.get('meus')).toBe('true');

  // A situação vinda do endereço se troca pela própria escolha da tela (várias de uma vez: Vencidas e Pagas).
  await page.getByRole('button', { name: 'Situação: Vencidas. Escolher.' }).click();
  await page.getByRole('dialog', { name: 'Situação' }).getByRole('checkbox', { name: 'Pagas' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Aluna Paga', { exact: true })).toBeVisible();
  await expect(page.getByText('Aluna Atrasada', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/situacao=VENCIDA%2CPAGA|situacao=VENCIDA,PAGA/);
  expect(pedidos.filter((p) => p.caminho === '/financeiro/cobrancas').at(-1)?.busca.getAll('situacao')).toEqual(['VENCIDA', 'PAGA']);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [390, 1280]) {
  test(`Financeiro ?situacao=ABERTA&vencimento=PROXIMOS_7_DIAS em ${largura}px: só as abertas que vencem até 26/10; limpar tira a janela`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, naoTratadas, errosDaPagina } = await abrirFinanceiro(page, '/treinador/financeiro?aba=cobrancas&situacao=ABERTA&vencimento=PROXIMOS_7_DIAS');
    const chipDaJanela = page.getByRole('button', { name: 'Tirar filtro: Vencimento: de hoje até 26/10/2026' });
    await expect(chipDaJanela).toBeVisible();
    await expect(page.getByText('Aluno Vencendo', { exact: true })).toBeVisible();
    await expect(page.getByText('Aluno Depois', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Aluna Atrasada', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Aluna Paga', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Tirar filtro: Situação: Em aberto' })).toBeVisible();
    const comJanela = pedidos.filter((p) => p.caminho === '/financeiro/cobrancas').at(-1);
    expect([comJanela?.busca.get('situacao'), comJanela?.busca.get('de'), comJanela?.busca.get('ate')]).toEqual(['ABERTA', '2026-10-19', '2026-10-26']);

    // O ✕ do chip tira só a janela; a situação fica.
    await chipDaJanela.click();
    await expect(page).toHaveURL(/\/treinador\/financeiro\?aba=cobrancas&situacao=ABERTA$/);
    await expect(page.getByText('Aluno Depois', { exact: true })).toBeVisible();
    await expect(page.getByText('Aluna Atrasada', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tirar filtro: Situação: Em aberto' })).toBeVisible();
    await expect(chipDaJanela).toHaveCount(0);
    const semJanela = pedidos.filter((p) => p.caminho === '/financeiro/cobrancas').at(-1);
    expect(semJanela?.busca.get('de')).toBeNull();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('Financeiro com valores desconhecidos no endereço: Todas, sem janela e sem erro', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { pedidos, naoTratadas, errosDaPagina } = await abrirFinanceiro(page, '/treinador/financeiro?aba=cobrancas&situacao=QUALQUER&vencimento=ONTEM&meus=talvez');
  await expect(page.getByText('Aluna Paga', { exact: true })).toBeVisible();
  await expect(page.getByText('Aluno Depois', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Tirar filtro/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Limpar filtro/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Filtros, nenhum ligado' }).click();
  await expect(page.getByRole('button', { name: 'Situação: Todas. Escolher.' })).toBeVisible();
  await expect(opcao(page, 'Responsável', 'Todos')).toHaveAttribute('aria-checked', 'true');
  const ultimo = pedidos.filter((p) => p.caminho === '/financeiro/cobrancas').at(-1);
  expect([ultimo?.busca.get('situacao'), ultimo?.busca.get('de'), ultimo?.busca.get('meus')]).toEqual([null, null, null]);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [390, 1280]) {
  test(`Financeiro ?aba=lancamentos&de=&ate= em ${largura}px: o período vai ao pedido e o ✕ do chip tira`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, naoTratadas, errosDaPagina } = await abrirFinanceiro(page, '/treinador/financeiro?aba=lancamentos&de=2026-10-01&ate=2026-10-31');
    const chip = page.getByRole('button', { name: 'Tirar filtro: Data: 01/10/2026 a 31/10/2026' });
    await expect(chip).toBeVisible();
    const comPeriodo = pedidos.filter((p) => p.caminho === '/financeiro/lancamentos').at(-1);
    expect([comPeriodo?.busca.get('de'), comPeriodo?.busca.get('ate')]).toEqual(['2026-10-01', '2026-10-31']);

    await chip.click();
    await expect(page).toHaveURL(/\/treinador\/financeiro\?aba=lancamentos$/);
    await expect.poll(() => pedidos.filter((p) => p.caminho === '/financeiro/lancamentos').at(-1)?.busca.get('de')).toBeNull();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
