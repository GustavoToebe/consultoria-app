import { expect, test, type Page } from '@playwright/test';

import { PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * O ⓘ "Sobre esta tela" do cabeçalho de página (`ui/AjudaDoCabecalho`, pedido de 25/11): a descrição sai da tela e vai
 * para um balão que abre no mouse, no Tab e no clique; Esc e clique fora fecham; "Saiba mais" abre a seção da Ajuda
 * quando a tela tem artigo (`dominio/ajudaDaTela`). Em 390 e 1280 px. Só dados fictícios, API simulada.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const CONFIGURACOES = 'Sua conta, a consultoria, a equipe e o atendimento, num lugar só.';
const AJUSTES = 'Valem só neste aparelho e para a sua conta.';

async function abrir(page: Page, largura: number, caminho: string) {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 800 });
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'EQUIPE_LER', 'AUDITORIA_LER', 'MARCA_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
  });
  await page.goto(caminho);
  return { errosDaPagina };
}

const icone = (page: Page) => page.getByRole('button', { name: 'Sobre esta tela' });
const balao = (page: Page) => page.getByRole('dialog', { name: 'Sobre esta tela' });

/** O balão inteiro dentro da janela, com no máximo 320 px de largura. */
async function dentroDaJanela(page: Page, largura: number) {
  const c = await balao(page).boundingBox();
  expect(c).not.toBeNull();
  expect(c!.x).toBeGreaterThanOrEqual(0);
  expect(c!.x + c!.width).toBeLessThanOrEqual(largura);
  expect(c!.width).toBeLessThanOrEqual(320);
}

for (const largura of [1280, 390]) {
  test.describe(`${largura} px`, () => {
    test('a descrição sai da tela e vai para o ⓘ ao lado do título, com a mesma descrição acessível', async ({ page }) => {
      const { errosDaPagina } = await abrir(page, largura, '/treinador/configuracoes');
      const h1 = page.getByRole('heading', { level: 1, name: 'Configurações' });
      await expect(h1).toBeVisible();
      await expect(icone(page)).toBeVisible();
      await expect(page.getByText(CONFIGURACOES)).toBeHidden();
      await expect(icone(page)).toHaveAccessibleDescription(CONFIGURACOES);
      await expect(icone(page)).toHaveAttribute('aria-expanded', 'false');
      // Na mesma linha do título, logo depois dele; alvo de 44 px.
      const t = (await h1.boundingBox())!;
      const i = (await icone(page).boundingBox())!;
      expect(i.x).toBeGreaterThanOrEqual(t.x + t.width - 8);
      expect(i.y).toBeLessThan(t.y + t.height);
      expect(i.y + i.height).toBeGreaterThan(t.y);
      expect(Math.round(i.width)).toBe(44);
      expect(Math.round(i.height)).toBe(44);
      expect(errosDaPagina).toEqual([]);
    });

    test('clique abre e fecha; Esc fecha e devolve o foco; clique fora fecha', async ({ page }) => {
      await abrir(page, largura, '/treinador/configuracoes');
      await icone(page).click();
      await expect(balao(page)).toBeVisible();
      await expect(balao(page).getByText(CONFIGURACOES)).toBeVisible();
      await expect(icone(page)).toHaveAttribute('aria-expanded', 'true');
      await dentroDaJanela(page, largura);
      await icone(page).click();
      await expect(balao(page)).toBeHidden();

      await icone(page).click();
      await expect(balao(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(balao(page)).toBeHidden();
      await expect(icone(page)).toBeFocused();

      await icone(page).click();
      await expect(balao(page)).toBeVisible();
      // Um ponto vazio à direita do título, fora do balão.
      const t = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
      await page.mouse.click(largura - 30, t.y + 4);
      await expect(balao(page)).toBeHidden();
    });

    test('Tab abre, passa ao "Saiba mais" e o link abre a seção da Ajuda', async ({ page }) => {
      await abrir(page, largura, '/treinador/configuracoes');
      await expect(icone(page)).toBeVisible();
      // Foco do teclado: o Tab chega ao ⓘ vindo do elemento anterior.
      await icone(page).focus();
      await page.keyboard.press('Shift+Tab');
      await expect(balao(page)).toBeHidden();
      await page.keyboard.press('Tab');
      await expect(icone(page)).toBeFocused();
      await expect(balao(page)).toBeVisible();
      await page.keyboard.press('Tab');
      const link = balao(page).getByRole('link', { name: 'Saiba mais' });
      await expect(link).toBeFocused();
      await expect(balao(page)).toBeVisible();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/treinador\/ajuda\?secao=consultoria$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Ajuda' })).toBeVisible();
      // A seção pedida nasce aberta: o item Auditoria dela está à vista.
      await expect(page.getByText(/^Lista ações importantes, guardadas por um ano/)).toBeVisible();
    });

    test('tela sem artigo: só o texto, sem "Saiba mais"', async ({ page }) => {
      await abrir(page, largura, '/treinador/ajustes');
      await expect(page.getByText(AJUSTES)).toBeHidden();
      await icone(page).click();
      await expect(balao(page).getByText(AJUSTES)).toBeVisible();
      await expect(balao(page).getByRole('link')).toHaveCount(0);
      await dentroDaJanela(page, largura);
    });
  });
}

test('1280 px: o mouse abre, pode entrar no balão e, ao sair, fecha', async ({ page }) => {
  await abrir(page, 1280, '/treinador/configuracoes');
  await icone(page).hover();
  await expect(balao(page)).toBeVisible();
  await balao(page).getByRole('link', { name: 'Saiba mais' }).hover();
  await page.waitForTimeout(400);
  await expect(balao(page)).toBeVisible();
  await page.mouse.move(1200, 700);
  await expect(balao(page)).toBeHidden();
});

test('1280 px: com a Ajuda já aberta antes, o "Saiba mais" abre a seção pedida', async ({ page }) => {
  await abrir(page, 1280, '/treinador/ajuda');
  await expect(page.getByRole('heading', { level: 1, name: 'Ajuda' })).toBeVisible();
  await expect(page.getByText(/^Lista ações importantes, guardadas por um ano/)).toBeHidden();
  await page.getByRole('link', { name: 'Equipe', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Equipe' })).toBeVisible();
  await icone(page).click();
  await balao(page).getByRole('link', { name: 'Saiba mais' }).click();
  await expect(page).toHaveURL(/\/treinador\/ajuda\?secao=consultoria$/);
  await expect(page.getByText(/^Lista ações importantes, guardadas por um ano/)).toBeVisible();
});
