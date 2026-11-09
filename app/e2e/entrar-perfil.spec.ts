import { expect, test, type Page } from '@playwright/test';

import { simularApi } from './api-falsa';

/**
 * Entrar: a escolha "Sou aluno"/"Sou treinador" só muda o texto e o link de criar conta (o papel vem do login).
 * `/aluno/entrar` sem sessão cai no Entrar comum. API simulada, sem conta real.
 */
const CAPTURAS = process.env.CAPTURAS_DIR;
async function capturar(page: Page, nome: string) {
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/${nome}.png`, fullPage: true });
}

for (const largura of [390, 1280]) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test('a escolha troca o subtítulo e só o treinador vê o criar conta', async ({ page }) => {
      const api = await simularApi(page, {
        'GET /publico/configuracao': { corpo: { verificacaoHumana: false, siteKey: '', cadastroAberto: true } },
      });
      await page.goto('/entrar');
      await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
      const grupo = page.getByRole('radiogroup', { name: 'Quem está entrando' });
      await expect(grupo.getByRole('radio', { name: 'Sou aluno' })).toBeChecked();
      await expect(page.getByText('Entre com o e-mail e a senha que seu treinador enviou.')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Sou treinador, criar conta' })).toHaveCount(0);
      await capturar(page, `entrar-aluno-${largura}`);

      await grupo.getByRole('radio', { name: 'Sou treinador' }).click();
      await expect(page.getByText('Treinos, dietas e a gestão da sua consultoria.')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Sou treinador, criar conta' })).toBeVisible();
      await capturar(page, `entrar-treinador-${largura}`);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('/aluno/entrar sem sessão cai no Entrar comum', async ({ page }) => {
      await simularApi(page);
      await page.goto('/aluno/entrar');
      await expect(page).toHaveURL(/\/entrar(\?|$)/);
      await expect(page.getByRole('radiogroup', { name: 'Quem está entrando' })).toBeVisible();
    });
  });
}
