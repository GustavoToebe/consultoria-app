import { expect, test, type Page } from '@playwright/test';

import type { AlunoDetalhe, RegistroPeso } from '../src/api/tipos';
import { ALUNO, json, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Peso na ficha da equipe (peso-visual C2): resumo, histórico com observação como detalhe e coluna Ações, excluir pelo
 * `PainelConfirmacao` (data e valor) atualizando resumo, gráfico e diferenças, e a visão escolhida mantida. O Histórico do
 * aluno (só leitura) está em `peso-historico-aluno.spec.ts`; a cor pela meta, em `cor-da-variacao-do-peso.spec.ts`.
 * Dados fictícios.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

const PESOS: RegistroPeso[] = [
  { id: 'p3', data: '2026-10-26', pesoKg: 80.5, variacao: -0.7, observacao: null },
  { id: 'p2', data: '2026-10-19', pesoKg: 81.2, variacao: 1.2, observacao: 'Depois do feriado' },
  { id: 'p1', data: '2026-10-12', pesoKg: 80, variacao: null, observacao: null },
];

const semEstourar = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

async function abrirFicha(page: Page, inicial: RegistroPeso[]) {
  let pesos = [...inicial];
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/pesos`]: (_p, route) => json(route, pesos),
    [`DELETE /alunos/${ALUNO_ID}/pesos/{id}`]: (p, route) => {
      const id = p.caminho.split('/').pop();
      // O servidor recalcula a variação do que fica (aqui, à mão): sem o p3, o p2 continua com +1,2 desde o p1.
      pesos = pesos.filter((r) => r.id !== id);
      return route.fulfill({ status: 204 });
    },
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=evolucao`);
  return api;
}

for (const largura of [390, 1280]) {
  test(`ficha: resumo, observação como detalhe, Ações e excluir pelo painel atualizam tudo em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina } = await abrirFicha(page, PESOS);
    const lista = page.getByLabel('Registros de peso');
    await expect(lista.getByText('80,5 kg', { exact: true })).toBeVisible();
    await lista.scrollIntoViewIfNeeded();
    await expect(page.getByLabel('Último registro: 80,5 kg em 26/10/2026', { exact: true })).toBeVisible();
    // Um "Registrar peso" só (o do cabeçalho do cartão).
    await expect(page.getByRole('button', { name: 'Registrar peso' })).toHaveCount(1);
    // A observação é detalhe do registro que a tem; nada de coluna "Obs" com "—".
    await expect(lista.getByText('Observação: Depois do feriado', { exact: true })).toBeVisible();
    await expect(lista.getByText('—', { exact: true })).toHaveCount(0);
    await expect(lista.getByText('Obs', { exact: true })).toHaveCount(0);
    if (largura >= 1280) await expect(lista.getByText('Ações', { exact: true })).toBeVisible();
    else await expect(page.getByRole('list', { name: 'Registros de peso' })).toBeVisible();

    // A lixeira tem alvo de 44 px nos dois modos.
    const lixeira = page.getByRole('button', { name: 'Excluir peso de 26/10/2026', exact: true });
    const caixa = await lixeira.boundingBox();
    expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
    await semEstourar(page);

    // Gráfico com 3 pontos; volta à Lista para excluir.
    await page.getByRole('tab', { name: 'Gráfico' }).click();
    await expect(page.getByRole('img', { name: /^Gráfico de peso com 3 registros/ }).locator('circle')).toHaveCount(3);
    await page.getByRole('tab', { name: 'Lista' }).click();

    // Excluir: o painel diz data e valor; cancelar não apaga nada.
    await page.getByRole('button', { name: 'Excluir peso de 26/10/2026', exact: true }).click();
    await expect(page.getByText('Excluir este registro de peso?', { exact: true })).toBeVisible();
    await expect(page.getByText('26/10/2026 · 80,5 kg', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    expect(pedidos.filter((p) => p.metodo === 'DELETE')).toEqual([]);
    await page.getByRole('button', { name: 'Excluir peso de 26/10/2026', exact: true }).click();
    await page.getByRole('button', { name: 'Excluir', exact: true }).click();

    // Depois: resumo, diferenças e gráfico saem da lista nova, e a visão Lista continua escolhida.
    await expect(page.getByLabel('Último registro: 81,2 kg em 19/10/2026', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Desde o registro anterior: subiu 1,2 kg, comparado a 80,0 kg em 12/10/2026', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Excluir peso de 26/10/2026', exact: true })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Lista' })).toHaveAttribute('aria-selected', 'true');
    expect(pedidos.filter((p) => p.metodo === 'DELETE').map((p) => p.caminho)).toEqual([`/alunos/${ALUNO_ID}/pesos/p3`]);
    await page.getByRole('tab', { name: 'Gráfico' }).click();
    await expect(page.getByRole('img', { name: /^Gráfico de peso com 2 registros/ }).locator('circle')).toHaveCount(2);
    await semEstourar(page);
    expect(errosDaPagina).toEqual([]);
  });

  test(`ficha sem registro: vazio compacto e um só "Registrar peso" em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrirFicha(page, []);
    await expect(page.getByText('Nenhum registro de peso.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Registrar peso' })).toHaveCount(1);
    await expect(page.getByLabel(/^Último registro/)).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Gráfico' })).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
}
