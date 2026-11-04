import { expect, test } from '@playwright/test';

import { EXPLICACAO_DA_EXCLUSAO } from '../src/dominio/excluirConta';
import { erroApi, json, simularApi, type Resposta } from './api-falsa';
import { CODIGO, paginaPublica } from './inscricoes-falsas';

/*
 * Páginas públicas (sem login) de Privacidade, Termos de uso e Excluir conta, e o rodapé com os links no Entrar. O texto
 * dos documentos vem sempre da API (`GET /publico/termos`); aqui, texto fictício.
 */

const TERMOS = {
  versao: '2026-10-20',
  rascunho: true,
  documentos: [
    { id: 'TERMO_USO', titulo: 'Termo de uso', texto: '# Termo de uso\n\nTexto fictício do termo.\n\n## Uso\n\n- Item fictício do termo.' },
    { id: 'AVISO_PRIVACIDADE', titulo: 'Aviso de privacidade', texto: '# Aviso de privacidade\n\nTexto fictício do aviso.' },
  ],
};

/** `GET /publico/termos` que o teste troca no meio: `falha` = 500 ou queda de rede, `ok` = os termos. */
function termosTrocaveis(inicial: 'ok' | '500' | 'rede') {
  const estado = { valor: inicial };
  const rota: Resposta = (_p, route) => {
    if (estado.valor === 'rede') return route.abort('internetdisconnected');
    if (estado.valor === '500') {
      const { status, corpo } = erroApi(500, 'Erro interno.');
      return json(route, corpo, status);
    }
    return json(route, TERMOS);
  };
  return { estado, rota };
}

for (const largura of [390, 1280]) {
  test.describe(`páginas públicas (${largura}px)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
    });

    test('privacidade e termos de uso abrem sem login com o texto da API', async ({ page }, testInfo) => {
      const { naoTratadas, errosDaPagina } = await simularApi(page, { 'GET /publico/termos': { corpo: TERMOS } });
      await page.goto('/privacidade');
      await expect(page.getByRole('heading', { level: 1, name: 'Privacidade' })).toBeVisible();
      await expect(page.getByText('Texto fictício do aviso.')).toBeVisible();
      await expect(page.getByText('Versão de 20/10/2026.')).toBeVisible();
      await expect(page.getByText('Rascunho em revisão')).toBeVisible();
      // Só o documento da página: o termo de uso não aparece aqui.
      await expect(page.getByText('Texto fictício do termo.')).toBeHidden();
      await expect(page.getByRole('link', { name: 'Privacidade', exact: true })).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`privacidade-${largura}.png`), fullPage: true });

      await page.getByRole('link', { name: 'Termos de uso', exact: true }).click();
      await expect(page).toHaveURL(/\/termos-de-uso$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Termos de uso' })).toBeVisible();
      await expect(page.getByText('Texto fictício do termo.')).toBeVisible();
      await expect(page.getByText('Item fictício do termo.')).toBeVisible();
      await expect(page.getByText('Texto fictício do aviso.')).toBeHidden();
      await expect(page.getByRole('link', { name: 'Entrar', exact: true })).toHaveAttribute('href', '/entrar');
      await expect(page.getByRole('link', { name: 'Excluir conta', exact: true })).toHaveAttribute('href', '/excluir-conta');
      await page.screenshot({ path: testInfo.outputPath(`termos-de-uso-${largura}.png`), fullPage: true });

      await page.emulateMedia({ colorScheme: 'dark' });
      await page.screenshot({ path: testInfo.outputPath(`termos-de-uso-escuro-${largura}.png`), fullPage: true });
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('excluir conta abre sem login, explica o caminho e não chama a API de exclusão', async ({ page }, testInfo) => {
      const { naoTratadas, errosDaPagina, pedidos } = await simularApi(page);
      await page.goto('/excluir-conta');
      await expect(page.getByRole('heading', { level: 1, name: 'Excluir sua conta' })).toBeVisible();
      await expect(page.getByText('Conta › Excluir minha conta')).toBeVisible();
      await expect(page.getByText(EXPLICACAO_DA_EXCLUSAO)).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Se você é treinador' })).toBeVisible();
      await expect(page.getByRole('button')).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Privacidade', exact: true })).toHaveAttribute('href', '/privacidade');
      await expect(page.getByRole('link', { name: 'Termos de uso', exact: true })).toHaveAttribute('href', '/termos-de-uso');
      await expect(page.getByRole('link', { name: 'Entrar', exact: true })).toHaveAttribute('href', '/entrar');
      await page.screenshot({ path: testInfo.outputPath(`excluir-conta-${largura}.png`), fullPage: true });
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.screenshot({ path: testInfo.outputPath(`excluir-conta-escuro-${largura}.png`), fullPage: true });
      expect(pedidos.filter((p) => p.caminho.includes('excluir'))).toEqual([]);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('no Entrar, os links do rodapé levam a Privacidade e a Termos de uso', async ({ page }, testInfo) => {
      const { naoTratadas, errosDaPagina } = await simularApi(page, { 'GET /publico/termos': { corpo: TERMOS } });
      await page.goto('/entrar');
      const privacidade = page.getByRole('link', { name: 'Privacidade', exact: true });
      await expect(privacidade).toHaveAttribute('href', '/privacidade');
      await expect(page.getByRole('link', { name: 'Termos de uso', exact: true })).toHaveAttribute('href', '/termos-de-uso');
      // O Entrar não leva o link de excluir a conta.
      await expect(page.getByRole('link', { name: 'Excluir conta', exact: true })).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`entrar-rodape-${largura}.png`), fullPage: true });

      await privacidade.click();
      await expect(page.getByRole('heading', { level: 1, name: 'Privacidade' })).toBeVisible();
      await expect(page.getByText('Texto fictício do aviso.')).toBeVisible();
      await page.getByRole('link', { name: 'Entrar', exact: true }).click();
      await page.getByRole('link', { name: 'Termos de uso', exact: true }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Termos de uso' })).toBeVisible();
      await expect(page.getByText('Texto fictício do termo.')).toBeVisible();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('na inscrição pública, o rodapé leva a Privacidade e a Termos de uso', async ({ page }, testInfo) => {
      const { naoTratadas, errosDaPagina } = await simularApi(page, { [`GET /publico/inscricoes/${CODIGO}`]: { corpo: paginaPublica() } });
      await page.goto(`/inscricao/${CODIGO}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Quero ser aluno' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Privacidade', exact: true })).toHaveAttribute('href', '/privacidade');
      await expect(page.getByRole('link', { name: 'Termos de uso', exact: true })).toHaveAttribute('href', '/termos-de-uso');
      await page.getByRole('link', { name: 'Termos de uso', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`inscricao-rodape-${largura}.png`) });
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    for (const falha of ['500', 'rede'] as const) {
      test(`termos com erro (${falha}) mostram "Tentar de novo", que busca de novo e mostra o texto`, async ({ page }, testInfo) => {
        const termos = termosTrocaveis(falha);
        const { naoTratadas, errosDaPagina } = await simularApi(page, { 'GET /publico/termos': termos.rota });
        await page.goto('/privacidade');
        await expect(page.getByRole('heading', { level: 1, name: 'Privacidade' })).toBeVisible();
        const tentar = page.getByRole('button', { name: 'Tentar de novo' });
        await expect(tentar).toBeVisible();
        await expect(page.getByRole('alert')).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath(`privacidade-erro-${falha}-${largura}.png`), fullPage: true });

        termos.estado.valor = 'ok';
        await tentar.click();
        await expect(page.getByText('Texto fictício do aviso.')).toBeVisible();
        await expect(tentar).toHaveCount(0);
        expect(naoTratadas).toEqual([]);
        expect(errosDaPagina).toEqual([]);
      });
    }
  });
}
