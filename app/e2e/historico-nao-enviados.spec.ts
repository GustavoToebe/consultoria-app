import { expect, test, type Locator, type Page } from '@playwright/test';

import type { RegistroEnvio } from '../src/api/tipos';
import { ALUNO, erroApi, json, simularApi, type PedidoFalso } from './api-falsa';
import { fazerSerie, fixarHoje, sessaoComTopSetEBackOff, sessaoDeAlunoComTreino } from './aluno';

/**
 * Histórico do aluno, cartão "Ainda não enviados" (pedido 15 da rodada de 28/11, item 7): a série marcada que não saiu do
 * aparelho aparece no Histórico com a data e o exercício. Sem internet (LOCAL) o cartão só informa; recusada pelo servidor
 * (FALHOU) ganha "Tentar enviar de novo", que reenvia e tira o cartão quando o servidor aceita. Na web larga o cartão fica
 * no topo de toda aba, logo abaixo das abas (`dominio/abasDoHistorico.NO_TOPO_DE_TODA_ABA`); no celular, na ordem da
 * coluna única (`ORDEM_NUMA_COLUNA`: depois das Atualizações, antes dos Registros). Só dados fictícios; relógio em
 * 19/10/2026 (`fixarHoje`).
 */

type Envio = 'sem-internet' | 'recusa' | 'aceita';
const ehLote = (p: PedidoFalso) => p.metodo === 'POST' && p.caminho.endsWith('/aluno/execucoes/lote');

async function registrarEAbrirHistorico(page: Page, largura: number, tema: 'CLARO' | 'ESCURO', envio: { modo: Envio }) {
  await page.setViewportSize({ width: largura, height: 1000 });
  await page.addInitScript(({ id, tema }) => {
    try { localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema })); } catch { /* sem armazenamento */ }
  }, { id: ALUNO.id, tema });
  await fixarHoje(page);
  const api = await simularApi(page, {
    ...(await sessaoDeAlunoComTreino(page, sessaoComTopSetEBackOff())),
    // O modo muda no meio do teste (recusa e depois aceita): a resposta lê o valor na hora do pedido.
    'POST /aluno/execucoes/lote': (p, route) => {
      if (envio.modo === 'sem-internet') return route.abort('internetdisconnected');
      const situacao = envio.modo === 'recusa' ? 'RECUSADO' : 'ACEITO';
      return json(route, { resultados: (p.corpo as { registros: RegistroEnvio[] }).registros.map((r) => ({ id: r.id, situacao, motivo: situacao === 'RECUSADO' ? 'Recusado (fictício).' : null })) });
    },
    'GET /aluno/execucoes': { corpo: [] },
    'GET /aluno/progresso': { corpo: [] },
    'GET /aluno/pesos': { corpo: [] },
    'GET /aluno/fotos/linha-do-tempo': { corpo: [] },
    'GET /aluno/avaliacoes-fisicas': { corpo: [] },
    'GET /aluno/atualizacoes': { corpo: [] },
    'GET /aluno/atualizacao': erroApi(404, 'Nenhuma atualização.', 'NAO_ENCONTRADO'),
    'GET /aluno/sessoes-concluidas': { corpo: { totalConcluidos: 0, sessoes: [] } },
  });
  await page.goto('/aluno/sessao/topo/agacho?data=2026-10-19');
  await page.getByRole('textbox', { name: 'Carga da série 1, em quilos', exact: true }).fill('80');
  await page.getByRole('textbox', { name: 'Repetições da série 1', exact: true }).fill('5');
  await fazerSerie(page, 1);
  // A fila fica no aparelho (localStorage na web) e sobrevive à troca de página.
  if (envio.modo === 'sem-internet') await expect(page.getByText(/aguardando envio|salvo\(s\) no aparelho/)).toBeVisible({ timeout: 15_000 });
  // Recusa: espera a resposta do lote chegar (a série vira FALHOU) antes de trocar de página, para não cortar o envio no meio.
  else await expect.poll(() => api.pedidos.filter(ehLote).length, { timeout: 15_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(300);
  await page.goto('/aluno/historico');
  await expect(page.getByRole('heading', { level: 1, name: 'Histórico' })).toBeVisible();
  return api;
}

const titulo = (page: Page, nome: string) => page.getByRole('heading', { name: nome, exact: true });
const linhaDoRegistro = (page: Page) => page.getByText(/^19\/10\/2026 · Agachamento de teste$/);
const caixa = async (l: Locator) => {
  await expect(l).toBeVisible();
  let b: Awaited<ReturnType<Locator['boundingBox']>> = null;
  await expect.poll(async () => (b = await l.boundingBox()) !== null).toBe(true);
  return b!;
};
const semRolagemDeLado = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('390, escuro: sem internet o cartão mostra a série guardada, sem "Tentar enviar de novo", na ordem da coluna única', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await registrarEAbrirHistorico(page, 390, 'ESCURO', { modo: 'sem-internet' });
  const cartao = await caixa(titulo(page, 'Ainda não enviados'));
  await expect(page.getByText('Salvos neste aparelho. Vão para o seu treinador quando houver internet.', { exact: true })).toBeVisible();
  await expect(linhaDoRegistro(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tentar enviar de novo' })).toHaveCount(0);
  const atualizacoes = await caixa(titulo(page, 'Atualizações'));
  const registros = await caixa(titulo(page, 'Registros e cargas'));
  expect(cartao.y).toBeGreaterThan(atualizacoes.y);
  expect(cartao.y).toBeLessThan(registros.y);
  expect(await semRolagemDeLado(page)).toBe(true);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

for (const tema of ['ESCURO', 'CLARO'] as const) {
  test(`1280, ${tema.toLowerCase()}: sem internet o cartão fica logo abaixo das abas, em todas elas`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await registrarEAbrirHistorico(page, 1280, tema, { modo: 'sem-internet' });
    const abas = await caixa(page.getByRole('tablist').first());
    const cartao = await caixa(titulo(page, 'Ainda não enviados'));
    expect(cartao.y).toBeGreaterThan(abas.y);
    expect(cartao.y).toBeLessThan((await caixa(titulo(page, 'Registros e cargas'))).y);
    await expect(linhaDoRegistro(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tentar enviar de novo' })).toHaveCount(0);
    for (const aba of ['Corpo', 'Atualizações']) {
      await page.getByRole('tab', { name: aba, exact: true }).click();
      await expect(page.getByRole('tab', { name: aba, exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(titulo(page, 'Ainda não enviados')).toBeVisible();
      await expect(linhaDoRegistro(page)).toBeVisible();
    }
    expect(await semRolagemDeLado(page)).toBe(true);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

for (const largura of [390, 1280]) {
  test(`${largura}: recusada pelo servidor, "Tentar enviar de novo" reenvia e o cartão some quando o servidor aceita`, async ({ page }) => {
    const envio: { modo: Envio } = { modo: 'recusa' };
    const { naoTratadas, errosDaPagina, pedidos } = await registrarEAbrirHistorico(page, largura, 'ESCURO', envio);
    await expect(titulo(page, 'Ainda não enviados')).toBeVisible();
    await expect(linhaDoRegistro(page)).toBeVisible();
    const tentar = page.getByRole('button', { name: 'Tentar enviar de novo' });
    await expect(tentar).toBeVisible();
    const antes = pedidos.filter(ehLote).length;
    envio.modo = 'aceita';
    await tentar.click();
    await expect(titulo(page, 'Ainda não enviados')).toHaveCount(0, { timeout: 15_000 });
    await expect(linhaDoRegistro(page)).toHaveCount(0);
    expect(pedidos.filter(ehLote).length).toBeGreaterThan(antes);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
