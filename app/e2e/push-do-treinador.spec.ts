import { expect, test } from '@playwright/test';

import { PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Push de atenção do treinador na web (C7 de `docs/planos/regras-de-atencao.md`): mesmo com o push e as regras ligados, a web
 * não registra token (nem ao abrir nem na tela de preferências), não oferece "Receber neste celular" e o "Sair" não chama
 * `/eu/push-token`. O registro, a permissão e o toque na notificação só existem no celular (jest e aparelho real).
 */
test('web: nada de token do push ao abrir, nas preferências nem ao sair', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, {
      permissoes: [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER', 'ALUNO_SENSIVEL_LER'], regrasAtencaoHabilitada: true, pushHabilitado: true,
    })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /eu/preferencias-de-push': { corpo: { atencao: true } },
    'POST /auth/logout': { status: 204 },
  });
  await page.goto('/treinador/ajustes');
  await expect(page.getByRole('switch', { name: 'Avisar quando a atualização de um aluno tiver pontos de atenção' })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Receber neste celular' })).toHaveCount(0);

  await page.getByRole('menubar').getByRole('button', { name: /^Conta de / }).click();
  await page.getByRole('menu', { name: 'Conta' }).getByRole('menuitem', { name: 'Sair' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page).toHaveURL(/\/treinador\/entrar$/);
  expect(api.pedidos.filter((p) => p.caminho === '/eu/push-token')).toEqual([]);
  expect(api.errosDaPagina).toEqual([]);
});
