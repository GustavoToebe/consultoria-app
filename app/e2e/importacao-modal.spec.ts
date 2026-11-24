import { expect, test, type Page } from '@playwright/test';

import { LARGURA_FOLHA_LARGA } from '../src/tema/tokens';
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
    // A tela da assistida lista as importações em aberto ao abrir.
    'GET /importacoes/assistidas/sessoes': { corpo: [] },
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

// tamanho das folhas (24/11): a escolha usa a folha média, a mesma do resultado da planilha completa (uma constante só,
// `LARGURA_FOLHA_LARGA`), na altura do conteúdo; os dois cartões lado a lado e da mesma altura no PC, empilhados no celular.
for (const largura of [390, 1280]) {
  test(`folha média igual à do resultado da planilha completa e cartões da mesma altura em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
    const id = 'i0000000-0000-4000-8000-000000000098';
    const item = { id, destino: 'planilha-completa', nomeArquivo: '.xlsx', criadoEm: '2026-10-31T15:00:00Z', linhas: 4, novos: 4, atualizados: 0, ignorados: 0, comErro: 0, situacao: 'CONCLUIDA' };
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /importacoes': { corpo: { itens: [item], total: 1, pagina: 0 } },
      [`GET /importacoes/${id}`]: { corpo: { ...item, configuracao: {}, erros: [] } },
    });
    await page.goto('/treinador/importacao');
    await page.getByRole('button', { name: 'Nova importação' }).click();
    await expect(opcao(page, 'manual')).toBeVisible();
    const nova = (await modal(page).boundingBox())!;
    // O cartão é o pai do rádio (o da assistida também leva o atalho de colar treino, abaixo do rádio).
    const [manual, assistida] = await Promise.all([opcao(page, 'manual'), opcao(page, 'assistida')].map(async (o) => (await o.locator('xpath=..').boundingBox())!));
    const grupo = (await modal(page).getByRole('radiogroup', { name: 'Como importar' }).boundingBox())!;
    if (largura === 1280) {
      expect(Math.round(nova.width)).toBe(LARGURA_FOLHA_LARGA);
      // Na altura do conteúdo, sem faixa vazia até o rodapé.
      expect(nova.height).toBeLessThan(560);
      expect(Math.abs(manual.y - assistida.y)).toBeLessThan(1);
      expect(Math.abs(manual.height - assistida.height)).toBeLessThan(1);
      expect(assistida.x).toBeGreaterThan(manual.x + manual.width);
      // Juntos ocupam a largura do grupo, que é a do conteúdo da folha.
      expect(Math.abs(manual.x - grupo.x)).toBeLessThan(2);
      expect(Math.abs((assistida.x + assistida.width) - (grupo.x + grupo.width))).toBeLessThan(2);
      expect(grupo.width).toBeGreaterThan(LARGURA_FOLHA_LARGA - 40);
    } else {
      expect(Math.round(nova.width)).toBe(390);
      expect(assistida.y).toBeGreaterThan(manual.y + manual.height - 1);
      expect(Math.abs(manual.width - assistida.width)).toBeLessThan(1);
    }
    await page.keyboard.press('Escape');
    await expect(modal(page)).toHaveCount(0);
    await page.getByRole('button', { name: /^Abrir a importação de Planilha completa/ }).click();
    const resultado = page.getByRole('dialog', { name: 'Importação de Planilha completa' });
    await expect(resultado.getByText('Registros criados')).toBeVisible();
    expect(Math.round((await resultado.boundingBox())!.width)).toBe(Math.round(nova.width));
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
