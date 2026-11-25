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

      // O "+N": tooltip com as outras e nome acessível que as lista; o link da linha também as diz.
      const mais = page.getByLabel('Mais 2 tags: Presencial, Avançado', { exact: true });
      await expect(mais).toBeVisible();
      await expect(mais).toHaveAttribute('title', 'Presencial\nAvançado');
      await expect(quatro).toHaveAttribute('aria-label', /^Abrir Davi Modelo\. Cobrança vencida\. Tags: Online, Retorno e mais 2\. Mais 2 tags: Presencial, Avançado\./);
      await expect(page.getByLabel(/^Mais \d tags?: /)).toHaveCount(1);

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}
