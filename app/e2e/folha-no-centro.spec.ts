import { expect, test, type Locator, type Page } from '@playwright/test';

import type { Alimento } from '../src/api/tipos';
import type { ItemDaVitrine } from '../src/api/vitrineTipos';
import { PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { fixarHoje } from './aluno';
import { estadoFinanceiro, PAINEL_COM_DADOS, rotasDoFinanceiro, sessaoComFinanceiro } from './financeiro-falso';

/**
 * Folha "No centro" (PC) na altura do conteúdo (25/11): com `largura`, a folha não tem mais a altura fixa de 90% da janela;
 * cresce com o conteúdo até 90% e daí só o corpo rola, com o cabeçalho e o rodapé parados. Telas: Editar item da Vitrine
 * (seções em cartões) e Editar alimento. Capturas em `E2E_CAPTURAS` (fora do repositório). Só dados fictícios, API simulada.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const CAPTURAS = process.env.E2E_CAPTURAS;

const ITEM: ItemDaVitrine = {
  id: 'v0000000-0000-4000-8000-000000000001', nome: 'Planilha de força', descricao: 'Doze semanas de treino.', tipo: 'DIGITAL',
  precoCentavos: 9900, precoEspecialCentavos: 7900, precoVigenteCentavos: 7900, especialAte: '2030-11-30', cupom: 'FORCA10',
  linkUrl: 'https://loja.exemplo.invalid/planilha', ativo: true, naPaginaPublica: false, noMarketplace: false, categoriaId: null,
  categoriaNome: null, ordem: 0, versao: 1, temFoto: false, fotoAtualizadaEm: null,
};

const ALIMENTO: Alimento = {
  id: 'a1', nome: 'Aveia fictícia', baseQuantidade: 100, baseUnidade: 'g', kcal: 393, proteina: 14, carboidrato: 66.7, gordura: 8.5,
  gramasPorUnidade: null, fonte: 'TACO', origem: 'PROPRIO', fatorCorrecao: null, fatorCoccao: null, grupo: null,
};

type Tema = 'CLARO' | 'ESCURO';

async function preparar(page: Page, largura: number, altura: number, tema: Tema, permissoes: string[]) {
  await page.setViewportSize({ width: largura, height: altura });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
  return permissoes;
}

async function abrirItem(page: Page, largura: number, altura: number, tema: Tema = 'ESCURO') {
  const permissoes = await preparar(page, largura, altura, tema, [...PERMISSOES_TREINADOR, 'VITRINE_LER', 'VITRINE_ALTERAR']);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes, vitrineHabilitada: true })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /vitrine/itens': { corpo: [ITEM] },
    'GET /vitrine/categorias': { corpo: [] },
  });
  await page.goto('/treinador/vitrine');
  await page.getByRole('button', { name: `Editar ${ITEM.nome}` }).click();
  const folha = page.getByRole('dialog', { name: 'Editar item' });
  await expect(folha.getByLabel('Nome', { exact: true })).toHaveValue(ITEM.nome);
  return { ...api, folha };
}

async function abrirAlimento(page: Page, largura: number, altura: number, tema: Tema) {
  const permissoes = await preparar(page, largura, altura, tema, [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR']);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /alimentos': { corpo: [ALIMENTO] },
  });
  await page.goto('/treinador/biblioteca?aba=alimentos');
  await page.getByRole('button', { name: `Editar ${ALIMENTO.nome}` }).click();
  const folha = page.getByRole('dialog', { name: 'Editar alimento' });
  await expect(folha.getByLabel('Nome', { exact: true })).toHaveValue(ALIMENTO.nome);
  return { ...api, folha };
}

const caixa = async (l: Locator) => (await l.boundingBox())!;
const rodapeDa = (folha: Locator) => folha.locator('[data-rodape-da-folha="sim"]');
/** O elemento que rola dentro da folha (o corpo). */
const rolagem = (folha: Locator) => folha.evaluate((el) => {
  const alvo = [...el.querySelectorAll<HTMLElement>('div')].find((d) => /(auto|scroll)/.test(getComputedStyle(d).overflowY) && d.clientHeight > 0);
  return alvo ? { rola: alvo.scrollHeight > alvo.clientHeight + 1, topo: alvo.scrollTop } : null;
});

async function capturar(page: Page, nome: string) {
  // A folha fica por cima da tela: a captura é da janela, não da página inteira.
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/${nome}.png` });
}

test('conteúdo curto (1920 × 1800): a folha não preenche a janela e o rodapé vem logo depois do último cartão', async ({ page }) => {
  const { folha, naoTratadas, errosDaPagina } = await abrirItem(page, 1920, 1800);
  await expect(folha.getByRole('heading', { level: 3 })).toHaveText(['Item', 'Preço', 'Onde comprar', 'Visibilidade']);
  const f = await caixa(folha);
  expect(f.height).toBeLessThan(1800 * 0.8);
  // Centrada na vertical.
  expect(Math.abs(f.y - (1800 - (f.y + f.height)))).toBeLessThan(4);
  const ultimo = await caixa(folha.getByTestId('cartao').last());
  const rodape = await caixa(rodapeDa(folha));
  // Só o respiro do corpo (16 px) entre o último cartão e o rodapé, sem faixa vazia.
  expect(rodape.y - (ultimo.y + ultimo.height)).toBeLessThanOrEqual(24);
  expect((await rolagem(folha))?.rola).toBe(false);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('conteúdo longo (1280 × 650): no máximo ~90% da janela, só o corpo rola e o rodapé fica à vista', async ({ page }) => {
  const { folha } = await abrirItem(page, 1280, 650);
  const f = await caixa(folha);
  // 90% da área (a janela menos o respiro de 16 px do fundo em cima e embaixo).
  expect(f.height).toBeGreaterThan(650 * 0.8);
  expect(f.height).toBeLessThanOrEqual(650 * 0.9 + 1);
  expect(f.y + f.height).toBeLessThanOrEqual(650);
  const rodape = await caixa(rodapeDa(folha));
  expect(rodape.y + rodape.height).toBeLessThanOrEqual(f.y + f.height + 1);
  expect((await rolagem(folha))?.rola).toBe(true);
  const titulo = await caixa(folha.getByRole('heading', { level: 2, name: 'Editar item' }));
  await page.mouse.move(f.x + f.width / 2, f.y + f.height / 2);
  await page.mouse.wheel(0, 2000);
  await expect.poll(async () => (await rolagem(folha))?.topo ?? 0).toBeGreaterThan(0);
  await expect(folha.getByRole('switch', { name: /Item ativo/ })).toBeInViewport();
  // Cabeçalho e rodapé parados: só o miolo andou.
  expect((await caixa(folha.getByRole('heading', { level: 2, name: 'Editar item' }))).y).toBeCloseTo(titulo.y, 0);
  expect((await caixa(rodapeDa(folha))).y).toBeCloseTo(rodape.y, 0);
});

test('celular (390 px): a folha de baixo segue como antes, presa ao pé da tela', async ({ page }) => {
  const { folha } = await abrirItem(page, 390, 844);
  const f = await caixa(folha);
  expect(Math.round(f.width)).toBe(390);
  expect(Math.round(f.y + f.height)).toBe(844);
});

for (const tema of ['ESCURO', 'CLARO'] as const) {
  test(`capturas: Editar item e Editar alimento no centro (${tema.toLowerCase()})`, async ({ page }) => {
    test.skip(!CAPTURAS, 'Só com E2E_CAPTURAS.');
    const t = tema.toLowerCase();
    for (const [largura, altura] of [[1920, 1080], [3440, 1440], [1280, 800], [390, 844]] as const) {
      await abrirItem(page, largura, altura, tema);
      await capturar(page, `editar-item-${t}-${largura}x${altura}`);
    }
    // Calendário do "Até" aberto dentro do cartão: nada cortado pelo cartão.
    await abrirItem(page, 1920, 1080, tema);
    await page.getByRole('dialog', { name: 'Editar item' }).getByRole('button', { name: /calendário|Escolher data/i }).first().click().catch(() => undefined);
    await capturar(page, `editar-item-${t}-1920x1080-calendario`);
    for (const [largura, altura] of [[1920, 1080], [3440, 1440]] as const) {
      await abrirAlimento(page, largura, altura, tema);
      await capturar(page, `editar-alimento-${t}-${largura}x${altura}`);
    }
  });
}

/**
 * P4: o status do rodapé que aparece não move a ação. No PC a folha centralizada cresce só para cima (`ui/ancoraDoRodape`);
 * no celular a folha de baixo já cresce para cima. Novo lançamento ("Registrar e continuar incluindo" põe o recado no
 * rodapé e a folha fica aberta); a folha fica abaixo do teto de 90% para a conferência valer.
 */
for (const [largura, altura] of [[1280, 900], [390, 844]] as const) {
  test(`status que aparece no rodapé não move a ação em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: altura });
    await fixarHoje(page);
    const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estadoFinanceiro({ painel: PAINEL_COM_DADOS })) });
    await page.goto('/treinador/financeiro?aba=lancamentos');
    await page.getByRole('button', { name: 'Novo lançamento' }).click();
    const folha = page.getByRole('dialog', { name: 'Novo lançamento' });
    await folha.getByLabel('Descrição').fill('Venda de camiseta');
    await folha.getByLabel('Valor', { exact: true }).fill('350,00');
    const acao = folha.getByRole('button', { name: 'Registrar lançamento', exact: true });
    const antes = await caixa(acao);
    const folhaAntes = await caixa(folha);
    if (largura >= 768) expect(folhaAntes.height).toBeLessThan(altura * 0.9 - 40);
    await folha.getByRole('button', { name: 'Registrar e continuar incluindo' }).click();
    const recado = folha.getByText('Lançamento registrado: Venda de camiseta. Pode incluir o próximo.');
    await expect(recado).toBeVisible();
    const depois = await caixa(acao);
    expect(Math.abs(depois.y - antes.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(depois.x + depois.width - (antes.x + antes.width))).toBeLessThanOrEqual(1);
    // A folha cresceu (o recado ocupa espaço) e continua inteira na janela.
    const f = await caixa(folha);
    expect(f.height).toBeGreaterThan(folhaAntes.height);
    expect(f.y).toBeGreaterThanOrEqual(0);
    expect(f.y + f.height).toBeLessThanOrEqual(altura + 1);
    expect(errosDaPagina).toEqual([]);
  });
}
