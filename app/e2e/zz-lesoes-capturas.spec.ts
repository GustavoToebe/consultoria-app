import { mkdirSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { abrirLesoes, CENAS } from './lesoes-falsas';

// Temporário: capturas dos cantos da tabela de lesões (prefixo `antes-` ou vazio, por CAPTURA_PREFIXO).
const PASTA = 'C:/Users/gusta/Documents/consultoria-app/capturas/24-11/ficha/tabela';
const PREFIXO = process.env.CAPTURA_PREFIXO ?? '';
test.use({ deviceScaleFactor: 3 });

for (const cena of ['ultima', 'meio'] as const) {
  for (const tema of ['ESCURO', 'CLARO'] as const) {
    test(`captura ${cena} ${tema}`, async ({ page }) => {
      mkdirSync(PASTA, { recursive: true });
      await abrirLesoes(page, cena === 'meio' ? 1920 : 1280, tema, CENAS[cena]);
      const tabela = page.getByRole('table', { name: 'Lesões' });
      await expect(tabela).toBeVisible();
      await tabela.scrollIntoViewIfNeeded();
      const c = (await tabela.boundingBox())!;
      const nome = `${PREFIXO}${cena}-${tema === 'ESCURO' ? 'escuro' : 'claro'}`;
      const L = 150; const A = 110;
      await page.screenshot({ path: `${PASTA}/${nome}.png`, clip: { x: c.x - 12, y: c.y + c.height - A + 12, width: L, height: A } });
      await page.screenshot({ path: `${PASTA}/${nome}-direita.png`, clip: { x: c.x + c.width - L + 12, y: c.y + c.height - A + 12, width: L, height: A } });
      await page.screenshot({ path: `${PASTA}/${nome}-tabela.png`, clip: { x: c.x - 12, y: c.y - 12, width: c.width + 24, height: c.height + 24 } });
    });
  }
}
