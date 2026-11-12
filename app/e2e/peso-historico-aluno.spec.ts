import { expect, test, type Page } from '@playwright/test';

import type { RegistroPeso } from '../src/api/tipos';
import { ALUNO, simularApi, type RespostasApi } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/**
 * Peso no Histórico do aluno (C42): o mesmo cartão da ficha, só leitura, pela rota do próprio aluno; lista e gráfico
 * conforme a preferência `graficos`; sem meta nos itens, variação sem cor (a cor pela meta está em
 * `cor-da-variacao-do-peso.spec.ts`). Dados fictícios.
 */
const PESOS: RegistroPeso[] = [
  // Fora de ordem de propósito: o cartão ordena pela data.
  { id: 'p2', data: '2026-10-19', pesoKg: 81.2, variacao: 1.2, observacao: null },
  { id: 'p1', data: '2026-10-12', pesoKg: 80, variacao: null, observacao: null },
  { id: 'p3', data: '2026-10-26', pesoKg: 80.5, variacao: -0.7, observacao: null },
];

async function abrir(page: Page, pesos: RespostasApi[string]) {
  const api = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    'GET /aluno/pesos': pesos,
    'GET /aluno/fotos/linha-do-tempo': { corpo: [] },
    'GET /aluno/avaliacoes-fisicas': { corpo: [] },
  });
  await page.goto('/aluno/historico');
  return api;
}

for (const largura of [390, 1280]) {
  test(`aluno vê o próprio peso no Histórico, em lista e gráfico, só leitura e, sem meta, sem cor em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina } = await abrir(page, { corpo: PESOS });
    const lista = page.getByLabel('Registros de peso');
    // No celular a `Tabela` troca de papel (tabela → lista) depois de se medir e o navegador recria o elemento: só rola
    // depois de as linhas existirem, ou a rolagem pega o elemento antigo ("not attached to the DOM").
    await expect(lista.getByText('80,5 kg', { exact: true })).toBeVisible();
    await lista.scrollIntoViewIfNeeded();
    await expect(page.getByText('Seus registros de peso, do mais recente ao mais antigo.')).toBeVisible();
    await expect(page.getByLabel('Desceu 0,7 kg desde 19/10', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Subiu 1,2 kg desde 12/10', { exact: true })).toBeVisible();

    // Sem meta nos itens: seta e número na mesma cor do peso (a do texto), nunca verde ou vermelho.
    const corDoPeso = await lista.getByText('80,5 kg', { exact: true }).evaluate((e) => getComputedStyle(e).color);
    const corDaVariacao = await page.getByText('▼ −0,7 kg', { exact: true }).evaluate((e) => getComputedStyle(e).color);
    expect(corDaVariacao).toBe(corDoPeso);

    // Só leitura: nada de registrar, excluir ou da coluna de observação (só da equipe; a rota do aluno a devolve nula);
    // o ciclo do treinador não é consultado.
    await expect(page.getByRole('button', { name: 'Registrar peso' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Excluir peso/ })).toHaveCount(0);
    await expect(lista.getByText('Obs', { exact: true })).toHaveCount(0);
    expect(pedidos.filter((p) => p.caminho.startsWith('/alunos/'))).toEqual([]);
    // O peso não fica no armazenamento da web.
    const guardado = await page.evaluate(() => Object.keys(localStorage).map((k) => localStorage.getItem(k) ?? '').join('\n'));
    expect(guardado).not.toContain('80.5');

    // Gráfico: a aba aparece com duas datas ou mais (preferência `graficos` ligada por padrão).
    await page.getByRole('tab', { name: 'Gráfico' }).click();
    const grafico = page.getByRole('img', { name: 'Gráfico de peso com 3 registros', exact: true });
    await expect(grafico).toBeVisible();
    await expect(grafico.locator('circle')).toHaveCount(3);
    await expect(page.getByText('Último: 80,5 kg em 26/10')).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });

  test(`aluno sem internet: o cartão Peso diz "Sem conexão." e não guarda nada em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrir(page, (_pedido, route) => route.abort('internetdisconnected'));
    await expect(page.getByText('Seus registros de peso, do mais recente ao mais antigo.')).toBeVisible();
    await expect(page.getByText('Sem conexão.', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Nenhum registro de peso.')).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`aluno com gráficos desligados vê só a lista do peso e onde religar em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ graficos: false })), ALUNO.id);
    const { errosDaPagina } = await abrir(page, { corpo: PESOS });
    await expect(page.getByLabel('Registros de peso').getByText('80,5 kg', { exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Gráfico' })).toHaveCount(0);
    await expect(page.getByText('Os gráficos estão desligados em Conta › Aparência e preferências.').first()).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });
}
