import { expect, test, type Page } from '@playwright/test';

import type { RegistroPeso } from '../src/api/tipos';
import { ALUNO, erroApi, simularApi, type RespostasApi } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/**
 * Peso no Histórico do aluno (C42; peso-visual C2): o mesmo cartão da ficha, só leitura, pela rota do próprio aluno;
 * resumo (último registro e desde o anterior) acima de Lista e Gráfico, conforme a preferência `graficos`; sem meta nos
 * itens, variação sem cor (a cor pela meta está em `cor-da-variacao-do-peso.spec.ts`; registrar e excluir, em
 * `peso-ficha.spec.ts`). Dados fictícios.
 */
const PESOS: RegistroPeso[] = [
  // Fora de ordem de propósito: o cartão ordena pela data.
  { id: 'p2', data: '2026-10-19', pesoKg: 81.2, variacao: 1.2, observacao: null },
  { id: 'p1', data: '2026-10-12', pesoKg: 80, variacao: null, observacao: null },
  { id: 'p3', data: '2026-10-26', pesoKg: 80.5, variacao: -0.7, observacao: null },
];

const semEstourar = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

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
  test(`aluno vê o resumo e o próprio peso no Histórico, em lista e gráfico, só leitura e, sem meta, sem cor em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina } = await abrir(page, { corpo: PESOS });
    const lista = page.getByLabel('Registros de peso');
    // No celular a `Tabela` troca de papel (tabela → lista) depois de se medir e o navegador recria o elemento: só rola
    // depois de as linhas existirem, ou a rolagem pega o elemento antigo ("not attached to the DOM").
    await expect(lista.getByText('80,5 kg', { exact: true })).toBeVisible();
    await lista.scrollIntoViewIfNeeded();
    await expect(page.getByText('Seus registros de peso, do mais recente ao mais antigo.')).toBeVisible();

    // Resumo: o último registro com a data dele (nunca "peso atual") e a diferença com a referência.
    await expect(page.getByLabel('Último registro: 80,5 kg em 26/10/2026', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Desde o registro anterior: desceu 0,7 kg, comparado a 81,2 kg em 19/10/2026', { exact: true })).toBeVisible();
    await expect(page.getByText('81,2 kg em 19/10/2026', { exact: true })).toBeVisible();
    await expect(page.getByText(/peso atual/i)).toHaveCount(0);
    // Sem meta: sem a frase das cores.
    await expect(page.getByText(/Cores pela meta|Verde: no caminho/)).toHaveCount(0);

    // Histórico: variação com "desde dd/mm", o mais recente marcado, sem legenda de setas.
    await expect(page.getByLabel('Desceu 0,7 kg desde 19/10', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Subiu 1,2 kg desde 12/10', { exact: true })).toBeVisible();
    await expect(lista.getByLabel('Sem registro anterior', { exact: true })).toBeVisible();
    await expect(lista.getByText('Mais recente', { exact: true })).toHaveCount(1);
    await expect(page.getByText('▲ subiu · ▼ desceu desde o registro anterior')).toHaveCount(0);

    // Sem meta nos itens: seta e número na cor do texto (a da data), nunca verde ou vermelho, na lista e no resumo. O
    // peso em si é medida e vai no azul de indicador (cores-de-destaque D12), diferente do texto e da variação.
    const corDoPeso = await lista.getByText('80,5 kg', { exact: true }).evaluate((e) => getComputedStyle(e).color);
    const corDaData = await lista.getByText('26/10/2026', { exact: true }).evaluate((e) => getComputedStyle(e).color);
    const corDaVariacao = await lista.getByText('▼ −0,7 kg', { exact: true }).evaluate((e) => getComputedStyle(e).color);
    const corNoResumo = await page.getByLabel(/^Desde o registro anterior/).getByText('▼ −0,7 kg', { exact: true }).evaluate((e) => getComputedStyle(e).color);
    expect(corDaVariacao).toBe(corDaData);
    expect(corNoResumo).toBe(corDaData);
    expect(corDoPeso).not.toBe(corDaData);

    // Só leitura: nada de registrar, excluir, coluna de ações ou de observação (só da equipe; a rota do aluno a devolve
    // nula); o ciclo do treinador não é consultado.
    await expect(page.getByRole('button', { name: 'Registrar peso' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Excluir peso/ })).toHaveCount(0);
    await expect(lista.getByText('Ações', { exact: true })).toHaveCount(0);
    await expect(lista.getByText(/^Obs/)).toHaveCount(0);
    expect(pedidos.filter((p) => p.caminho.startsWith('/alunos/'))).toEqual([]);
    // O peso não fica no armazenamento da web.
    const guardado = await page.evaluate(() => Object.keys(localStorage).map((k) => localStorage.getItem(k) ?? '').join('\n'));
    expect(guardado).not.toContain('80.5');
    await semEstourar(page);

    // Gráfico: linha reta, escala com as pontas escritas e dica com data, peso e a referência da diferença.
    await page.getByRole('tab', { name: 'Gráfico' }).click();
    const grafico = page.getByRole('img', { name: 'Gráfico de peso com 3 registros, de 12/10/2026 a 26/10/2026. Os valores estão na visão Lista.', exact: true });
    await expect(grafico).toBeVisible();
    await expect(grafico.locator('circle')).toHaveCount(3);
    await expect(page.getByText('Escala vertical: 79,5 a 81,5 kg · pontos = registros', { exact: true })).toBeVisible();
    // O resumo já diz o último: a linha "Último: …" do gráfico não se repete.
    await expect(page.getByText(/^Último: /)).toHaveCount(0);
    await page.getByRole('button', { name: '26/10: 80,5 kg', exact: true }).focus();
    await expect(page.getByText('26/10/2026 · 80,5 kg', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('▼ −0,7 kg desde 19/10', { exact: true }).first()).toBeVisible();
    await semEstourar(page);
    expect(errosDaPagina).toEqual([]);
  });

  test(`aluno sem internet: o cartão Peso diz "Sem conexão." e não guarda nada em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrir(page, (_pedido, route) => route.abort('internetdisconnected'));
    await expect(page.getByText('Seus registros de peso, do mais recente ao mais antigo.')).toBeVisible();
    await expect(page.getByText('Sem conexão.', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Nenhum registro de peso.')).toHaveCount(0);
    await expect(page.getByLabel(/^Último registro/)).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`aluno com gráficos desligados vê o resumo, só a lista do peso e onde religar em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ graficos: false })), ALUNO.id);
    const { errosDaPagina } = await abrir(page, { corpo: PESOS });
    await expect(page.getByLabel('Registros de peso').getByText('80,5 kg', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Último registro: 80,5 kg em 26/10/2026', { exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Gráfico' })).toHaveCount(0);
    await expect(page.getByText('Os gráficos estão desligados em Conta › Aparência e preferências.').first()).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });

  test(`sem registro: estado vazio compacto, sem resumo nem "0 kg", e o aluno não registra em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrir(page, { corpo: [] });
    await expect(page.getByText('Nenhum registro de peso.', { exact: true })).toBeVisible();
    await expect(page.getByLabel(/^Último registro/)).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Gráfico' })).toHaveCount(0);
    await expect(page.getByText(/^0(,0)? kg$/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Registrar peso' })).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`um registro (valor longo, texto ampliado): só o ponto e "Sem registro anterior", sem cortar em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tamanhoTexto: 'EXTRA' })), ALUNO.id);
    const { errosDaPagina } = await abrir(page, { corpo: [{ id: 'p1', data: '2026-10-12', pesoKg: 187.35, variacao: null, observacao: null }] });
    await expect(page.getByLabel('Último registro: 187,35 kg em 12/10/2026', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Desde o registro anterior: sem registro anterior', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Registros de peso').getByText('187,35 kg', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Registros de peso').getByText('Mais recente', { exact: true })).toHaveCount(0);
    await semEstourar(page);
    await page.getByRole('tab', { name: 'Gráfico' }).click();
    const grafico = page.getByRole('img', { name: 'Gráfico de peso com 1 registro, em 12/10/2026. O valor está na visão Lista.', exact: true });
    await expect(grafico).toBeVisible();
    await expect(grafico.locator('circle')).toHaveCount(1);
    await expect(page.getByText(/pelo menos duas datas/)).toHaveCount(0);
    await semEstourar(page);
    expect(errosDaPagina).toEqual([]);
  });

  test(`valores iguais: "0,0 kg · sem alteração" e linha horizontal em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrir(page, { corpo: [
      { id: 'p1', data: '2026-10-12', pesoKg: 80, variacao: null, observacao: null },
      { id: 'p2', data: '2026-10-19', pesoKg: 80, variacao: 0, observacao: null },
    ] });
    await expect(page.getByText('0,0 kg · sem alteração', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Sem alteração desde 12/10', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Gráfico' }).click();
    await expect(page.getByRole('img', { name: /^Gráfico de peso com 2 registros/ }).locator('circle')).toHaveCount(2);
    await expect(page.getByText('Escala vertical: 79,5 a 80,5 kg · pontos = registros', { exact: true })).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });

  test(`falha ao carregar: mensagem e "Tentar de novo", nunca 0 kg; tentar de novo traz o resumo em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    let vezes = 0;
    const { errosDaPagina } = await abrir(page, (_pedido, route) => {
      vezes += 1;
      const r = vezes === 1 ? erroApi(500, 'Erro interno') : { status: 200, corpo: PESOS };
      return route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.corpo) });
    });
    const tentar = page.getByRole('button', { name: 'Tentar de novo' });
    await expect(tentar.first()).toBeVisible();
    await expect(page.getByLabel(/^Último registro/)).toHaveCount(0);
    await expect(page.getByText(/^0(,0)? kg$/)).toHaveCount(0);
    await expect(page.getByText('Nenhum registro de peso.')).toHaveCount(0);
    await tentar.first().click();
    await expect(page.getByLabel('Último registro: 80,5 kg em 26/10/2026', { exact: true })).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });
}
