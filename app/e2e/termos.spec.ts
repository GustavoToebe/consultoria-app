import { expect, test } from '@playwright/test';

import { erroApi } from './api-falsa';
import { abrirAceiteDoAluno, abrirTermosDaEquipe, COLCHETE_DE_MODELO, TERMOS } from './termos-falsos';

/*
 * Termos e privacidade (28/11): a página da equipe (abas, texto em largura de leitura, "Nesta página" fixo no PC, versão com a
 * data do aceite, "Baixar PDF", o selo de rascunho e as notas para o advogado só para a equipe) e o aceite do aluno (contato da
 * consultoria preenchido, nenhum aviso de rascunho, nota interna ou colchete de modelo). Os textos são os `.md` reais da API
 * (`termos-falsos.ts`); o contato é fictício.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

// 1920: o índice cabe ao lado do texto na coluna de Configurações; 1280: a coluna é estreita para ele (a tela decide pela
// largura medida, sem assertiva aqui); 390: rota inteira, sem índice.
for (const largura of [390, 1280, 1920]) {
  test.describe(`termos da equipe (${largura}px)`, () => {
    test('abas, versão com o aceite, PDF, selo da equipe e o contato montado', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrirTermosDaEquipe(page, largura, 'CLARO');
      await expect(page.getByRole('heading', { level: 1, name: 'Termos e privacidade' })).toBeVisible();
      await expect(page.getByText('Versão de 26/10/2026 · aceita por você em 28/11/2026')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Baixar PDF' })).toBeEnabled();
      await expect(page.getByText('Rascunho em revisão')).toBeVisible();
      // A nota interna do advogado aparece só para a equipe, junto do selo, fora do texto.
      await expect(page.getByText('Notas para a revisão do advogado')).toBeVisible();
      await expect(page.getByText('base legal da transferência internacional')).toBeVisible();

      await expect(page.getByRole('tab', { name: 'Termo de uso' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { level: 3, name: '1. O que é este aplicativo' })).toBeVisible();
      await expect(page.getByText('(45) 99999-8888')).toBeVisible();
      await expect(page.getByText(/PREENCHER|REVISAR COM ADVOGADO|RASCUNHO \[|\{\{/)).toHaveCount(0);

      const indice = page.getByRole('navigation', { name: 'Nesta página' });
      if (largura < 768) {
        await expect(indice).toHaveCount(0);
      } else if (largura >= 1920) {
        await expect(indice).toBeVisible();
        await expect(indice.getByRole('button')).toHaveCount(8);
        await expect(indice.getByRole('button', { name: '1. O que é este aplicativo' })).toHaveAttribute('aria-current', 'location');
        // Rolar sem tocar no índice também move a marca (a leitura da rolagem acha os h3 pelo `id`).
        await page.getByRole('heading', { level: 3, name: '4. Uso adequado' }).evaluate((h) => h.scrollIntoView({ block: 'start' }));
        await expect(indice.getByRole('button', { name: '4. Uso adequado' })).toHaveAttribute('aria-current', 'location');
        await expect(indice).toBeInViewport();
        await indice.getByRole('button', { name: '8. Contato' }).click();
        await expect(page.getByRole('heading', { level: 3, name: '8. Contato' })).toBeInViewport();
        await expect(indice.getByRole('button', { name: '8. Contato' })).toHaveAttribute('aria-current', 'location');
        // Parado ao rolar: o índice continua à vista com o fim do texto.
        await expect(indice).toBeInViewport();
      }

      await page.getByRole('tab', { name: 'Aviso de privacidade' }).click();
      await expect(page.getByRole('heading', { level: 3, name: '1. Quem cuida dos seus dados' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 3, name: '8. Contato' })).toHaveCount(0);
      if (largura >= 1920) await expect(indice.getByRole('button')).toHaveCount(10);
      // O contato de privacidade (seção 1) é o da consultoria, nunca o colchete do encarregado.
      await expect(page.getByText('(45) 99999-8888')).toBeVisible();
      expect(COLCHETE_DE_MODELO.test(await page.locator('body').innerText())).toBe(false);

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('erro da API mostra a mensagem e o "Tentar de novo" recupera', async ({ page }) => {
      let falhar = true;
      const { errosDaPagina } = await abrirTermosDaEquipe(page, largura, 'ESCURO', {
        'GET /termos': (_p, route) => {
          if (!falhar) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TERMOS) });
          const { status, corpo } = erroApi(500, 'Erro interno.');
          return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corpo) });
        },
      });
      await expect(page.getByRole('heading', { level: 1, name: 'Termos e privacidade' })).toBeVisible();
      const tentar = page.getByRole('button', { name: 'Tentar de novo' });
      await expect(tentar).toBeVisible();
      await expect(page.getByRole('button', { name: 'Baixar PDF' })).toHaveCount(0);
      falhar = false;
      await tentar.click();
      await expect(page.getByRole('heading', { level: 3, name: '1. O que é este aplicativo' })).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });

    test('texto sem seções: nada de índice vazio e nenhum colchete', async ({ page }) => {
      const vazio = { ...TERMOS, documentos: TERMOS.documentos.map((d) => ({ ...d, texto: 'Texto fictício sem seções.' })) };
      const { errosDaPagina } = await abrirTermosDaEquipe(page, largura, 'CLARO', { 'GET /termos': { corpo: vazio } });
      await expect(page.getByText('Texto fictício sem seções.')).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Nesta página' })).toHaveCount(0);
      expect(errosDaPagina).toEqual([]);
    });
  });

  if (largura === 1920) continue;
  test.describe(`aceite do aluno (${largura}px)`, () => {
    test('mostra o contato preenchido, nenhum aviso de rascunho e aceita a versão lida', async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrirAceiteDoAluno(page, largura, 'CLARO');
      await expect(page.getByRole('heading', { level: 1, name: 'Termo de uso e privacidade' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'Termo de uso' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'Aviso de privacidade' })).toBeVisible();
      // O contato aparece nos dois documentos (seção 8 do termo e o contato de privacidade do aviso).
      await expect(page.getByText('(45) 99999-8888')).toHaveCount(2);
      await expect(page.getByText('contato@exemplo.test')).toHaveCount(2);
      await expect(page.getByText(/Rascunho|RASCUNHO|PREENCHER|REVISAR/)).toHaveCount(0);
      await expect(page.getByText('Notas para a revisão do advogado')).toHaveCount(0);
      await expect(page.getByText(/base legal da transferência/)).toHaveCount(0);
      expect(COLCHETE_DE_MODELO.test(await page.locator('body').innerText())).toBe(false);
      await page.getByRole('button', { name: 'Li e aceito' }).click();
      await expect.poll(() => pedidos.filter((p) => p.metodo === 'POST' && p.caminho === '/termos/aceite').map((p) => p.corpo)).toEqual([{ versao: TERMOS.versao }]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}
