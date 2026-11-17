import { expect, test } from '@playwright/test';

import { simularApi } from './api-falsa';

/**
 * Link com segredo no fragmento (`#token=`, `#codigo=`): a tela o lê e o tira do endereço (histórico, captura de tela,
 * link copiado). O `replaceState` sozinho não bastava: o expo-router regravava o fragmento logo depois, então o teste
 * espera o router assentar antes de conferir. Valores fictícios.
 */
const LINKS = [
  { nome: 'redefinir senha', caminho: '/redefinir-senha', fragmento: '#token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG' },
  { nome: 'convite do aluno', caminho: '/convite', fragmento: '#codigo=ABCDEFGHJK23456789' },
  { nome: 'convite da equipe', caminho: '/convite-equipe', fragmento: '#codigo=ABCDEFGHJK23456789' },
];

for (const { nome, caminho, fragmento } of LINKS) {
  test(`${nome}: o fragmento com o segredo não fica no endereço`, async ({ page }) => {
    await simularApi(page, {});
    await page.goto(`${caminho}${fragmento}`);
    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect.poll(() => new URL(page.url()).hash).toBe('');
    // O router regravava o fragmento depois do efeito da tela: confere de novo com ele já assentado.
    await page.waitForTimeout(1500);
    expect(new URL(page.url()).hash).toBe('');
    expect(new URL(page.url()).pathname).toBe(caminho);
  });
}
