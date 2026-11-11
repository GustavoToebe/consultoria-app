import { expect, test, type Page } from '@playwright/test';

import type { ConsultoriaResponse } from '../src/api/tipos';
import { PALETAS } from '../src/tema/tokens';
import { json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Tela Marca, paletas (plano paletas-da-marca, passo 5): as 10 paletas em dois grupos (Escuras e Claras), a prévia na
 * paleta escolhida, o `temaPadrao` no PUT e a checagem da cor personalizada medida contra a paleta (decisão 4).
 * Os dois grupos são subgrupos (`group`) de um único `radiogroup` "Tema padrão da consultoria". Dados fictícios. A cor `#386CB8` passa no Escuro e no Claro e some no cartão do Oceano (`dominio/paletas.test.ts`).
 */
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
const ADMIN = { permissoes: [...PERMISSOES_TREINADOR, 'MARCA_ALTERAR'], perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true } };

async function abrirMarca(page: Page, largura: number, opcoes: { temaDoEditor?: 'CLARO' | 'ESCURO' } = {}) {
  await page.setViewportSize({ width: largura, height: 900 });
  if (opcoes.temaDoEditor) {
    await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, opcoes.temaDoEditor]);
  }
  const consultoria: ConsultoriaResponse = { marca: MARCA, versao: 3, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR' };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, ADMIN)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /consultoria': { corpo: consultoria },
    'PUT /consultoria/marca': (p, route) => json(route, { ...consultoria, marca: { ...MARCA, temaPadrao: (p.corpo as { temaPadrao: string }).temaPadrao }, versao: 4 }),
  });
  await page.goto('/treinador/marca');
  await expect(page.getByRole('group', { name: 'Escuras' })).toBeVisible();
  return api;
}

const paleta = (page: Page, grupo: 'Escuras' | 'Claras', nome: string) =>
  page.getByRole('group', { name: grupo }).getByRole('radio', { name: nome, exact: true });

for (const temaDoEditor of ['CLARO', 'ESCURO'] as const) {
  for (const largura of [390, 1280]) {
    test(`paletas em Escuras e Claras, prévia na escolhida e temaPadrao no PUT (${temaDoEditor.toLowerCase()}, ${largura}px)`, async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrirMarca(page, largura, { temaDoEditor });
      // Só as 10 que existem, no grupo do modo de cada uma, com o nome.
      for (const { nome, modo } of Object.values(PALETAS)) {
        await expect(paleta(page, modo === 'ESCURO' ? 'Escuras' : 'Claras', nome)).toHaveCount(1);
      }
      await expect(page.getByRole('radio', { name: 'Brisa' })).toHaveCount(0);
      await expect(paleta(page, 'Claras', 'Claro')).toHaveAttribute('aria-checked', 'true');
      const previa = page.getByTestId('previa-da-paleta');
      await expect(previa).toHaveCSS('background-color', rgb(PALETAS.CLARO.cores.fundo));

      const oceano = paleta(page, 'Escuras', 'Oceano');
      await oceano.click();
      await expect(oceano).toHaveAttribute('aria-checked', 'true');
      await expect(paleta(page, 'Claras', 'Claro')).toHaveAttribute('aria-checked', 'false');
      await expect(previa).toHaveCSS('background-color', rgb(PALETAS.OCEANO.cores.fundo));
      await expect(page.getByText('Paleta Oceano', { exact: true })).toBeVisible();

      // Um radiogroup só, com os dois subgrupos dentro dele.
      const todas = page.getByRole('radiogroup', { name: 'Tema padrão da consultoria' });
      await expect(todas.getByRole('group')).toHaveCount(2);
      await expect(todas.getByRole('radio')).toHaveCount(Object.keys(PALETAS).length);
      // Sem rolagem horizontal na página e nenhuma opção passa da largura da janela; todas têm alvo de 44 px.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      for (const radio of await page.getByRole('group', { name: /^(Escuras|Claras)$/ }).getByRole('radio').all()) {
        const caixa = await radio.boundingBox();
        expect(caixa).not.toBeNull();
        expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(largura);
        expect(caixa!.height).toBeGreaterThanOrEqual(44);
      }

      await page.getByRole('button', { name: 'Salvar marca', exact: true }).click();
      await expect(page.getByText('Marca salva. Os alunos veem a nova marca ao abrir o app.')).toBeVisible();
      const envio = pedidos.find((p) => p.metodo === 'PUT' && p.caminho === '/consultoria/marca');
      expect(envio?.corpo).toMatchObject({ temaPadrao: 'OCEANO', versao: 3 });
      expect(errosDaPagina).toEqual([]);
    });
  }
}

for (const largura of [390, 1280]) {
  test(`cor personalizada: o aviso segue a paleta escolhida em ${largura}px`, async ({ page }) => {
    const { errosDaPagina } = await abrirMarca(page, largura);
    await page.getByRole('radio', { name: /^Cor personalizada/ }).click();
    await page.getByRole('textbox', { name: 'Cor principal (#RRGGBB)' }).fill('#386CB8');
    const aviso = page.getByTestId('aviso-marca-apagada-na-paleta');
    await expect(aviso).toHaveCount(0);

    await paleta(page, 'Escuras', 'Oceano').click();
    await expect(aviso).toHaveText('Na paleta Oceano, ícones e o menu ativo ficam apagados.');
    await expect(page.getByTestId('aviso-marca-apagada')).toHaveText('Na paleta Oceano, ícones e o menu ativo ficam apagados.');
    // O aviso do cartão Cor fica fora da leitura (aria-hidden) e o da paleta é uma região viva: lido uma vez só.
    await expect(page.locator('[aria-hidden="true"]').getByTestId('aviso-marca-apagada')).toHaveCount(1);
    await expect(page.locator('[aria-live="polite"]').getByTestId('aviso-marca-apagada-na-paleta')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // Só avisa: o Salvar continua liberado.
    await expect(page.getByRole('button', { name: 'Salvar marca', exact: true })).toBeEnabled();

    await paleta(page, 'Escuras', 'Escuro').click();
    await expect(aviso).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
}

test('sem o perfil Administrador a Marca não abre: só o aviso de sem acesso, sem paletas', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessao(page, TREINADOR)), 'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } } });
  await page.goto('/treinador/marca');
  await expect(page.getByRole('heading', { name: 'Sem acesso a esta tela', level: 1 })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Escuras' })).toHaveCount(0);
  expect(pedidos.some((p) => p.caminho === '/consultoria')).toBe(false);
  expect(errosDaPagina).toEqual([]);
});
