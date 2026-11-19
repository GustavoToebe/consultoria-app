import { expect, test, type Page } from '@playwright/test';

import { PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Modal da importação (18/11, `docs/planos/importacao-modal.md`): "Nova importação" abre a escolha entre a manual e a
 * assistida (rádio em cartões, nenhum marcado), Continuar desativado até escolher e cada opção na sua rota; Esc e clique
 * fora fecham, o foco volta ao botão; setas trocam a opção e Enter continua. API falsa, dados fictícios. Com
 * `CAPTURAS_IMPORTACAO_MODAL` (pasta fora do repositório) guarda as capturas da tela e do modal.
 */
const CAPTURAS = process.env.CAPTURAS_IMPORTACAO_MODAL;

async function abrir(page: Page, largura: number, { preferencias, permissoes = PERMISSOES_TREINADOR }: { preferencias?: object; permissoes?: string[] } = {}) {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
  if (preferencias) await page.addInitScript(([id, p]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(p)), [TREINADOR.id, preferencias] as const);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /importacoes': { corpo: { itens: [], total: 0, pagina: 0 } },
  });
  await page.goto('/treinador/importacao');
  await expect(page.getByRole('heading', { name: 'Importação', level: 1 })).toBeVisible();
  return api;
}

const modal = (page: Page) => page.getByRole('dialog', { name: 'Nova importação' });
const opcao = (page: Page, nome: 'manual' | 'assistida') => modal(page).getByRole('radio', { name: new RegExp(`^Importação ${nome}`) });

for (const largura of [390, 1280]) {
  test(`tela com dois botões; o modal escolhe a rota e o voltar fecha em ${largura}px`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, largura);
    // Na tela ficam só os dois botões; o atalho de colar treino e a linha da assistida estão no modal.
    await expect(page.getByRole('button', { name: 'Modelos de planilha' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Colar treino de PDF / Docs' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Importação assistida/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'Nova importação' }).click();
    await expect(modal(page).getByText('Escolha como quer importar')).toBeVisible();
    const grupo = modal(page).getByRole('radiogroup', { name: 'Como importar' });
    await expect(grupo.getByRole('radio')).toHaveCount(2);
    await expect(opcao(page, 'manual')).toHaveAttribute('aria-checked', 'false');
    await expect(opcao(page, 'assistida')).toHaveAttribute('aria-checked', 'false');
    const continuar = modal(page).getByRole('button', { name: 'Continuar' });
    await expect(continuar).toBeDisabled();
    await expect(modal(page).getByText('Escolha uma das opções para continuar.')).toBeVisible();
    // Sem MODELO_LER/MODELO_ALTERAR o atalho de colar treino não aparece.
    await expect(modal(page).getByRole('link', { name: 'Colar treino de PDF / Docs' })).toHaveCount(0);
    // Cancelar fecha sem navegar.
    await modal(page).getByRole('button', { name: 'Cancelar' }).click();
    await expect(modal(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/treinador\/importacao$/);

    await page.getByRole('button', { name: 'Nova importação' }).click();
    await opcao(page, 'assistida').click();
    await expect(opcao(page, 'assistida')).toHaveAttribute('aria-checked', 'true');
    await expect(continuar).toBeEnabled();
    await continuar.click();
    await expect(page).toHaveURL(/\/treinador\/importacao\/assistida$/);
    await expect(page.getByRole('heading', { name: 'Importação assistida', level: 1 })).toBeVisible();
    // Um voltar só: a entrada do modal no histórico não sobra.
    await page.goBack();
    await expect(page).toHaveURL(/\/treinador\/importacao$/);
    await expect(page.getByRole('button', { name: 'Nova importação' })).toBeVisible();
    await expect(modal(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Nova importação' }).click();
    await opcao(page, 'manual').click();
    await modal(page).getByRole('button', { name: 'Continuar' }).click();
    await expect(page).toHaveURL(/\/treinador\/importacao\/nova$/);
    await expect(page.getByRole('heading', { name: 'Nova importação', level: 1 })).toBeVisible();

    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`Esc e clique fora fecham, e o foco volta ao botão, em ${largura}px`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura);
    const botao = page.getByRole('button', { name: 'Nova importação' });
    await botao.click();
    await expect(modal(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal(page)).toHaveCount(0);
    await expect(botao).toBeFocused();

    await botao.click();
    await expect(modal(page)).toBeVisible();
    // Fora do painel: o canto de cima (no celular a folha sobe de baixo e deixa o topo livre).
    await page.mouse.click(8, 8);
    await expect(modal(page)).toHaveCount(0);
    await expect(botao).toBeFocused();
    expect(errosDaPagina).toEqual([]);
  });
}

test('teclado: setas trocam a opção (o foco vai junto) e Enter continua, em 1280px', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] });
  await page.getByRole('button', { name: 'Nova importação' }).click();
  // No PC o foco entra no primeiro cartão, sem marcar nada.
  await expect(opcao(page, 'manual')).toBeFocused();
  await expect(opcao(page, 'manual')).toHaveAttribute('aria-checked', 'false');
  // Enter sem escolha não sai do modal.
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/treinador\/importacao$/);
  await expect(modal(page)).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(opcao(page, 'assistida')).toBeFocused();
  await expect(opcao(page, 'assistida')).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(opcao(page, 'manual')).toBeFocused();
  await expect(opcao(page, 'manual')).toHaveAttribute('aria-checked', 'true');
  await expect(opcao(page, 'assistida')).toHaveAttribute('aria-checked', 'false');
  // Roving tabindex: o Tab sai do grupo para o atalho de colar treino, depois o rodapé.
  await page.keyboard.press('Tab');
  await expect(modal(page).getByRole('link', { name: 'Colar treino de PDF / Docs' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(opcao(page, 'manual')).toBeFocused();
  await page.keyboard.press('End');
  await expect(opcao(page, 'assistida')).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Home');
  await expect(opcao(page, 'manual')).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/treinador\/importacao\/nova$/);
  expect(errosDaPagina).toEqual([]);
});

// Capturas (fora do repositório): a tela e o modal sem escolha e com cada escolha, claro, escuro e Areia, e texto Extra.
const TEMAS = [
  { nome: 'claro', preferencias: { tema: 'CLARO' } },
  { nome: 'escuro', preferencias: { tema: 'ESCURO' } },
  { nome: 'areia', preferencias: { tema: 'AREIA' } },
  { nome: 'claro-extra', preferencias: { tema: 'CLARO', tamanhoTexto: 'EXTRA' } },
];
for (const { nome, preferencias } of TEMAS) {
  for (const largura of [390, 1280]) {
    test(`capturas ${nome} em ${largura}px`, async ({ page }) => {
      test.skip(!CAPTURAS, 'Sem CAPTURAS_IMPORTACAO_MODAL');
      const { errosDaPagina } = await abrir(page, largura, { preferencias, permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] });
      const caminho = (o: string) => `${CAPTURAS}/${nome}-${largura}-${o}.png`;
      await page.screenshot({ path: caminho('1-tela') });
      await page.getByRole('button', { name: 'Nova importação' }).click();
      await expect(opcao(page, 'manual')).toBeVisible();
      await page.screenshot({ path: caminho('2-sem-escolha') });
      await opcao(page, 'manual').click();
      await page.mouse.move(0, 0);
      await page.screenshot({ path: caminho('3-manual') });
      await opcao(page, 'assistida').click();
      await page.mouse.move(0, 0);
      await page.screenshot({ path: caminho('4-assistida') });
      expect(errosDaPagina).toEqual([]);
    });
  }
}
