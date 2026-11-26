import { expect, test, type Page } from '@playwright/test';

import { sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Teclado no radiogroup `Escolha` (26/11): Espaço (padrão ARIA) e Enter selecionam o rádio focado, sem rolar a página.
 * Tela real: Aparência e preferências, grupo Contraste. Só dados fictícios.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

async function abrir(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), TREINADOR.id);
  await simularApi(page, { ...(await sessao(page, TREINADOR)), 'GET /inscricoes': { corpo: { itens: [], total: 0 } } });
  await page.goto('/treinador/ajustes');
  await expect(page.getByRole('heading', { name: 'Aparência e preferências', level: 1 })).toBeVisible();
}

test('Espaço e Enter selecionam o rádio focado', async ({ page }) => {
  await abrir(page);
  const grupo = page.getByRole('radiogroup', { name: 'Contraste' });
  const padrao = grupo.getByRole('radio', { name: 'Padrão', exact: true });
  const alto = grupo.getByRole('radio', { name: 'Alto', exact: true });
  await expect(padrao).toHaveAttribute('aria-checked', 'true');

  await alto.focus();
  await page.keyboard.press('Space');
  await expect(alto).toHaveAttribute('aria-checked', 'true');
  await expect(padrao).toHaveAttribute('aria-checked', 'false');

  await padrao.focus();
  await page.keyboard.press('Enter');
  await expect(padrao).toHaveAttribute('aria-checked', 'true');
  await expect(alto).toHaveAttribute('aria-checked', 'false');

  // Opção já escolhida e não limpável: Espaço e Enter não mudam nada.
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await expect(padrao).toHaveAttribute('aria-checked', 'true');
});
