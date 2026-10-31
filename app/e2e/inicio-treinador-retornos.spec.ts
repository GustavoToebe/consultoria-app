import { expect, test } from '@playwright/test';

import type { PainelTreinador } from '../src/api/tipos';
import { PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Início do treinador: retornos combinados com interessados (atrasados e de hoje) no cartão Retornos do bloco
 * Interessados, que acende em vermelho com algum atrasado, entra no "Próximo passo" e abre Interessados com o mesmo
 * "Todos / Meus" (painel novo de 31/10; antes era um contador próprio). Dados fictícios.
 */
const PAINEL: PainelTreinador = {
  atualizacoesParaRevisar: 0, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 0, alunosAtivos: 3,
  alunosSemRegistro: [], ultimasExecucoes: [], planosTerminando: [],
  pastasARenovar: 0, pastasParaRenovar: [], alunosSemPastaComPeriodo: 0, alunosSemRegistroTotal: 0, alunosSemAcesso: 0, alunosInativos: 0,
  sessoesConcluidas7Dias: 0,
};

const contagens = (atrasados: number, hoje: number, novas = 0) => ({
  corpo: { porSituacao: { NOVA: novas }, abertas: novas, todas: novas, retornosAtrasados: atrasados, retornosHoje: hoje },
});

for (const largura of [390, 1280]) {
  test(`retornos atrasados acendem o contador e viram o próximo passo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR })),
      'GET /painel': { corpo: PAINEL },
      'GET /inscricoes/contagens': contagens(2, 1, 1),
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /inscricoes/retornos': { corpo: [] },
      'GET /inscricoes/configuracao': { corpo: null },
      'GET /responsaveis': { corpo: [] },
    });
    await page.goto('/treinador');
    const contador = page.getByRole('link', { name: 'Retornos a interessados atrasados ou de hoje: 3, 2 atrasados e 1 de hoje' });
    await expect(contador).toBeVisible();
    await expect(contador.getByText('2 atrasados · 1 para hoje')).toBeVisible();
    // O cartão abre Interessados já filtrado nos retornos até hoje, com o "Meus" do bloco.
    await expect(contador).toHaveAttribute('href', /\/treinador\/interessados\?.*retornos=ATE_HOJE/);
    // O retorno vencido passa na frente do interessado novo.
    await expect(page.getByText('2 retornos a interessados estão atrasados.')).toBeVisible();
    // O filtro "Meus" (padrão de quem não tem acesso total) vai junto nas contagens e no endereço de Interessados.
    expect(pedidos.some((p) => p.caminho === '/inscricoes/contagens' && p.busca.get('meus') === 'true')).toBe(true);

    await page.getByRole('button', { name: 'Ver retornos' }).click();
    await expect(page).toHaveURL(/\/treinador\/interessados\?meus=true$/);
    expect(naoTratadas.filter((r) => !r.startsWith('GET /inscricoes/'))).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('sem retornos o contador fica apagado e o próximo passo segue para os interessados novos', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR })),
    'GET /painel': { corpo: PAINEL },
    'GET /inscricoes/contagens': contagens(0, 0, 2),
  });
  await page.goto('/treinador');
  await expect(page.getByRole('link', { name: 'Retornos a interessados atrasados ou de hoje: 0' })).toBeVisible();
  await expect(page.getByText('2 interessados novos esperam contato.')).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('só retornos de hoje: âmbar, e o próximo passo fala de hoje', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR })),
    'GET /painel': { corpo: PAINEL },
    'GET /inscricoes/contagens': contagens(0, 1),
  });
  await page.goto('/treinador');
  await expect(page.getByRole('link', { name: 'Retornos a interessados atrasados ou de hoje: 1, 1 de hoje' })).toBeVisible();
  await expect(page.getByText('1 retorno a interessado está marcado para hoje.')).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('sem INSCRICAO_LER não há contador de retornos nem consulta da fila', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { pedidos, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR.filter((p) => !p.startsWith('INSCRICAO_')) })),
    'GET /painel': { corpo: PAINEL },
  });
  await page.goto('/treinador');
  await expect(page.getByText('Tudo em dia por aqui.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: /Retornos a interessados/ })).toHaveCount(0);
  expect(pedidos.some((p) => p.caminho.startsWith('/inscricoes'))).toBe(false);
  expect(errosDaPagina).toEqual([]);
});
