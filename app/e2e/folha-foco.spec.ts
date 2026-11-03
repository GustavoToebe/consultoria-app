import { expect, test, type Page } from '@playwright/test';

import { PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Folha pelo teclado (C3 da auditoria de 03/11): um diálogo só, com o nome do título; o foco entra na folha ao abrir e
 * volta a quem a abriu ao fechar (Esc ou o X). A folha "Escolher exercício" do editor de modelo serve de exemplo, porque
 * a peça é a mesma em todas as telas. API simulada no próprio teste; só dados fictícios.
 */
const ID = 'f0000000-0000-4000-8000-000000000002';

async function abrirEditor(page: Page, largura: number) {
  await page.setViewportSize({ width: largura, height: 800 });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'MODELO_LER', 'MODELO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios': { corpo: [] },
    [`GET /receitas/${ID}`]: { corpo: { id: ID, tipo: 'SESSAO_TREINO', nome: 'Dia de treino', descricao: null, conteudo: { sessoes: [{ nome: 'Treino A' }] }, ordem: 0, pastaId: null, versao: 1 } },
  });
  await page.goto(`/treinador/planejamento/modelo/${ID}`);
  return api;
}

const focoDentro = (page: Page) => page.getByRole('dialog').evaluate((el) => el.contains(document.activeElement));

for (const [onde, largura] of [['PC', 1280], ['celular', 390]] as const) {
  test(`folha no ${onde}: um diálogo, foco dentro ao abrir e de volta a quem abriu ao fechar`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrirEditor(page, largura);
    const abrir = page.getByRole('button', { name: 'Adicionar exercício' }).first();
    await abrir.focus();
    await page.keyboard.press('Enter');
    const folha = page.getByRole('dialog', { name: 'Escolher exercício' });
    await expect(folha).toBeVisible();
    // Um só `role=dialog` no documento (antes eram dois aninhados: o do Modal, sem nome, e o do painel).
    await expect(page.locator('[role="dialog"]')).toHaveCount(1);
    await expect(folha).toHaveAttribute('aria-modal', 'true');
    await expect.poll(() => focoDentro(page)).toBe(true);
    // No celular o foco vai ao X (focar o campo abriria o teclado por cima da lista).
    if (onde === 'celular') await expect(folha.getByRole('button', { name: 'Fechar' })).toBeFocused();
    // O Tab dá a volta dentro do painel, nos dois sentidos: nunca para no fundo escurecido nem sai para a tela.
    for (const tecla of ['Shift+Tab', 'Shift+Tab', 'Shift+Tab', 'Tab', 'Tab', 'Tab', 'Tab']) {
      await page.keyboard.press(tecla);
      expect(await focoDentro(page)).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(folha).toHaveCount(0);
    await expect(abrir).toBeFocused();

    // De novo, fechando pelo X com o teclado.
    await page.keyboard.press('Enter');
    await expect(folha).toBeVisible();
    await folha.getByRole('button', { name: 'Fechar' }).focus();
    await page.keyboard.press('Enter');
    await expect(folha).toHaveCount(0);
    await expect(abrir).toBeFocused();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
