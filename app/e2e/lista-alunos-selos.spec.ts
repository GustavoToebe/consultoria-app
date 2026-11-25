import { expect, test, type Locator, type Page } from '@playwright/test';

import { abrirListaDeAlunos, SEM_SELO, SITUACAO_E_QUATRO_TAGS, SITUACAO_E_UMA_TAG, SO_SITUACAO } from './lista-alunos-selos-falsos';

/**
 * Selos da lista de alunos (pedido de 24/11): embaixo do nome, o selo de situação e as tags ficam na MESMA linha, o selo
 * primeiro; no máximo 2 tags e "+N" com tooltip (`title`) e nome acessível listando as outras; o selo diz o que venceu
 * ("Cobrança vencida", a fonte é `GET /financeiro/alunos-em-atraso`). Só dados fictícios, API simulada.
 */
const linkDe = (page: Page, nome: string) => page.getByRole('link', { name: new RegExp(`^Abrir ${nome}`) });
const topo = async (l: Locator) => (await l.boundingBox())?.y ?? Number.NaN;
const esquerda = async (l: Locator) => (await l.boundingBox())?.x ?? Number.NaN;
/** Ordem de leitura: cada um na mesma linha do anterior e à direita dele, ou numa linha de baixo (a quebra). */
async function emOrdemDeLeitura(...itens: Locator[]) {
  for (let i = 1; i < itens.length; i += 1) {
    const [ya, yb, xa, xb] = [await topo(itens[i - 1]), await topo(itens[i]), await esquerda(itens[i - 1]), await esquerda(itens[i])];
    expect(Math.abs(ya - yb) < 8 ? xa < xb : yb > ya, `item ${i} depois do ${i - 1}`).toBe(true);
  }
}

for (const largura of [390, 1280]) {
  test.describe(`${largura} px`, () => {
    test('situação e tags na mesma linha (o selo primeiro), máximo de 2 tags e "+N"; o selo diz "Cobrança vencida"', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrirListaDeAlunos(page, largura);
      await page.goto('/treinador/alunos');
      await expect(linkDe(page, SEM_SELO)).toBeVisible();

      // O substantivo: nunca "Vencida" sozinho.
      await expect(page.getByText('Vencida', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Cobrança vencida', { exact: true })).toHaveCount(3);

      // Sem selo e sem tag: nada embaixo do nome; só situação: um selo e nenhuma tag.
      await expect(linkDe(page, SEM_SELO).getByText(/Cobrança vencida|Online|\+\d/)).toHaveCount(0);
      await expect(linkDe(page, SO_SITUACAO)).toHaveAttribute('aria-label', /^Abrir Bruno Exemplo\. Cobrança vencida\./);
      await expect(linkDe(page, SO_SITUACAO).getByText('Cobrança vencida', { exact: true })).toBeVisible();

      // Situação + 1 tag: lado a lado (mesmo topo) quando cabem, o selo antes da tag.
      const uma = linkDe(page, SITUACAO_E_UMA_TAG);
      const seloUma = uma.getByText('Cobrança vencida', { exact: true });
      const tagUma = uma.getByText('Online', { exact: true });
      await expect(tagUma).toBeVisible();
      await emOrdemDeLeitura(seloUma, tagUma);
      // No celular a coluna do nome é estreita (lápis e seta ao lado): "Cobrança vencida" + "Online" não cabem e a tag quebra.
      if (largura >= 1024) expect(Math.abs(await topo(seloUma) - await topo(tagUma))).toBeLessThan(8);

      // Situação + 4 tags: o selo e a primeira tag lado a lado quando cabem; só 2 tags e "+2" (nunca as 4).
      const quatro = linkDe(page, SITUACAO_E_QUATRO_TAGS);
      const seloQuatro = quatro.getByText('Cobrança vencida', { exact: true });
      const primeira = quatro.getByText('Online', { exact: true });
      const segunda = quatro.getByText('Retorno', { exact: true });
      await expect(primeira).toBeVisible();
      await expect(segunda).toBeVisible();
      await expect(quatro.getByText('Presencial', { exact: true })).toHaveCount(0);
      await expect(quatro.getByText('Avançado', { exact: true })).toHaveCount(0);
      if (largura >= 1024) expect(Math.abs(await topo(seloQuatro) - await topo(primeira))).toBeLessThan(8);
      // Em ordem: selo, tags e "+2"; o que não cabe quebra para a linha de baixo, e nunca fica um por linha de propósito.
      const mais2 = quatro.getByText('+2', { exact: true });
      await emOrdemDeLeitura(seloQuatro, primeira, segunda, mais2);

      // O "+N": botão com o nome que lista as outras (e o tooltip do mouse como reforço); o link da linha diz só
      // "e mais 2", sem repetir as escondidas (quem as diz é o botão, logo depois).
      const mais = page.getByLabel('Mais 2 tags: Presencial, Avançado', { exact: true });
      await expect(mais).toBeVisible();
      await expect(mais).toHaveAttribute('title', 'Presencial\nAvançado');
      await expect(quatro).toHaveAttribute('aria-label', /^Abrir Davi Modelo\. Cobrança vencida\. Tags: Online, Retorno e mais 2\. Treino de outubro\./);
      await expect(quatro).not.toHaveAttribute('aria-label', /Presencial/);
      await expect(page.getByLabel(/^Mais \d tags?: /)).toHaveCount(1);

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('o "+N" é um botão: Tab chega, Enter e Espaço abrem as outras tags, Esc fecha e devolve o foco; clicar não navega e a linha abre a ficha', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrirListaDeAlunos(page, largura);
      await page.goto('/treinador/alunos');
      const link = linkDe(page, SITUACAO_E_QUATRO_TAGS);
      await expect(link).toBeVisible();
      const mais = page.getByRole('button', { name: 'Mais 2 tags: Presencial, Avançado', exact: true });
      await expect(mais).toBeVisible();
      await expect(mais).toHaveAttribute('aria-expanded', 'false');
      await expect(mais).toHaveAttribute('aria-haspopup', 'dialog');
      // Fora do link no DOM (nada interativo dentro do `<a>`), com alvo de 44 px por cima do desenho "+2".
      expect(await mais.evaluate((el) => !!el.closest('a'))).toBe(false);
      expect(await link.locator('button, [role="button"]').count()).toBe(0);
      const alvo = (await mais.boundingBox())!;
      const desenho = (await link.getByText('+2', { exact: true }).boundingBox())!;
      expect(alvo.width).toBeGreaterThanOrEqual(44);
      expect(alvo.height).toBeGreaterThanOrEqual(44);
      const [cx, cy] = [desenho.x + desenho.width / 2, desenho.y + desenho.height / 2];
      expect(cx > alvo.x && cx < alvo.x + alvo.width && cy > alvo.y && cy < alvo.y + alvo.height, 'o alvo cobre o desenho').toBe(true);

      // Teclado: do link da linha, o Tab chega ao "+N" (depois do lápis, que vem antes no DOM).
      await link.focus();
      for (let i = 0; i < 3 && !(await mais.evaluate((el) => el === document.activeElement)); i += 1) await page.keyboard.press('Tab');
      await expect(mais).toBeFocused();
      const lista = page.getByRole('dialog', { name: 'Outras tags de Davi Modelo' });
      await page.keyboard.press('Enter');
      await expect(lista).toBeVisible();
      await expect(lista.getByText('Presencial', { exact: true })).toBeVisible();
      await expect(lista.getByText('Avançado', { exact: true })).toBeVisible();
      await expect(lista.getByText('Online', { exact: true })).toHaveCount(0);
      await expect(mais).toHaveAttribute('aria-expanded', 'true');
      await expect(page).toHaveURL(/\/treinador\/alunos$/);
      await page.keyboard.press('Escape');
      await expect(lista).toHaveCount(0);
      await expect(mais).toBeFocused();
      await page.keyboard.press('Space');
      await expect(lista).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(lista).toHaveCount(0);
      await expect(mais).toBeFocused();

      // Clique: abre sem navegar; clicar de novo no "+N" (cai no fundo da lista) fecha; clicar fora também.
      await mais.click();
      await expect(lista).toBeVisible();
      await expect(page).toHaveURL(/\/treinador\/alunos$/);
      // O clique pode ter rolado a página: a posição do "+2" é lida de novo.
      const agora = (await link.getByText('+2', { exact: true }).boundingBox())!;
      await page.mouse.click(agora.x + agora.width / 2, agora.y + agora.height / 2);
      await expect(lista).toHaveCount(0);
      await mais.click();
      await expect(lista).toBeVisible();
      await page.mouse.click(5, 5);
      await expect(lista).toHaveCount(0);
      await expect(page).toHaveURL(/\/treinador\/alunos$/);

      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
      // O resto da linha continua sendo o link: clicar no nome abre a ficha.
      await link.getByText(SITUACAO_E_QUATRO_TAGS, { exact: true }).click();
      await expect(page).toHaveURL(/\/treinador\/alunos\/a0000000-0000-4000-8000-000000000004/);
    });
  });
}

test.describe('390 px, toque', () => {
  test.use({ hasTouch: true });
  test('tocar no "+N" abre as outras tags sem abrir a ficha; tocar fora fecha', async ({ page }) => {
    await abrirListaDeAlunos(page, 390);
    await page.goto('/treinador/alunos');
    const mais = page.getByRole('button', { name: 'Mais 2 tags: Presencial, Avançado', exact: true });
    await expect(mais).toBeVisible();
    await mais.tap();
    const lista = page.getByRole('dialog', { name: 'Outras tags de Davi Modelo' });
    await expect(lista).toBeVisible();
    await expect(page).toHaveURL(/\/treinador\/alunos$/);
    await page.touchscreen.tap(5, 5);
    await expect(lista).toHaveCount(0);
    await expect(page).toHaveURL(/\/treinador\/alunos$/);
  });
});
