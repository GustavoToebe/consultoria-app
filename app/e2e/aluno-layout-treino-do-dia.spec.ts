import { expect, test, type Locator, type Page } from '@playwright/test';

import { ALUNO, sessao, simularApi } from './api-falsa';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';

/**
 * Treino do dia na web (`docs/planos/orientacoes-de-design-26-11.md`, 1.3): da faixa `normal` em diante, o apoio à esquerda,
 * fixo ao rolar (o resumo com a frase da data numa só e a nota do salvamento no aparelho, o "Começar/Continuar" e as Outras
 * datas), e os exercícios na ordem, com "Última carga" e "N/3 séries" na mesma linha. Desde 27/11 o contêiner é o do
 * treinador (sem teto; a área toda): a lista se divide em colunas lidas de cima para baixo quando cabem duas ou três de 520
 * (`dominio/colunasDoTreinoDoDia`), sem faixa vazia à direita. O celular (e a faixa `compacta`) não muda. Só dados
 * fictícios. `E2E_CAPTURAS` (ou `CAPTURAS`) grava as capturas fora do repositório.
 */

const NOTA = 'Cada série marcada fica salva no aparelho na hora e é enviada quando houver internet.';
const SESSOES = [sessaoFalsa('sa', 'Peito e tríceps', 1, 5), sessaoFalsa('sb', 'Costas e bíceps', 3, 4)];
const HOJE = '/aluno/sessao/sa?data=2026-10-19';
const FUTURA = '/aluno/sessao/sb?data=2026-10-21';

type Opcoes = { tema?: 'ESCURO' | 'CLARO'; altura?: number; menuMinimizado?: boolean };

async function abrir(page: Page, largura: number, caminho = HOJE, opcoes: Opcoes = {}) {
  await page.setViewportSize({ width: largura, height: opcoes.altura ?? 1080 });
  await page.addInitScript(([id, t, minimizado]) => {
    try {
      if (minimizado) localStorage.setItem('menu-lateral-recolhido', '1'); else localStorage.removeItem('menu-lateral-recolhido');
      localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t }));
    } catch { /* sem armazenamento */ }
  }, [ALUNO.id, opcoes.tema ?? 'ESCURO', !!opcoes.menuMinimizado] as const);
  await fixarHoje(page);
  const api = await simularApi(page, {
    ...(await sessaoDeAlunoComTreino(page, SESSOES)),
    ...(await sessao(page, ALUNO, { retornoHabilitado: true })),
    'GET /aluno/sessoes-concluidas': { corpo: { totalConcluidos: 0, sessoes: [] } },
  });
  await page.goto(caminho);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  return api;
}

const caixa = async (l: Locator) => {
  await expect(l).toBeVisible();
  let b: Awaited<ReturnType<Locator['boundingBox']>> = null;
  await expect.poll(async () => (b = await l.boundingBox()) !== null).toBe(true);
  return b!;
};
const exercicios = (page: Page) => page.getByRole('link', { name: /^Abrir Exercício sae\d/ });
const apoio = (page: Page) => page.getByRole('complementary', { name: 'Resumo do treino' });
const semRolagemDeLado = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** A matriz da 0.5: 390, 1024 (menu aberto e minimizado), 1280, 1536, 1920, 2560 e 3440; claro também em 1280 e 1920. */
const MATRIZ: { largura: number; tema: 'ESCURO' | 'CLARO'; menuMinimizado?: boolean }[] = [
  { largura: 390, tema: 'ESCURO' }, { largura: 1024, tema: 'ESCURO' }, { largura: 1024, tema: 'ESCURO', menuMinimizado: true },
  { largura: 1280, tema: 'ESCURO' }, { largura: 1280, tema: 'CLARO' }, { largura: 1536, tema: 'ESCURO' }, { largura: 1920, tema: 'ESCURO' },
  { largura: 1920, tema: 'CLARO' }, { largura: 2560, tema: 'ESCURO' }, { largura: 3440, tema: 'ESCURO' }, { largura: 3440, tema: 'CLARO' },
];

test('capturas: treino do dia na matriz de larguras e temas', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const pasta = process.env.E2E_CAPTURAS ?? process.env.CAPTURAS ?? testInfo.outputPath();
  for (const { largura, tema, menuMinimizado } of MATRIZ) {
    await abrir(page, largura, HOJE, { tema, menuMinimizado });
    await expect(exercicios(page)).toHaveCount(5);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${pasta}/treino-do-dia-${largura}${menuMinimizado ? '-minimizado' : ''}-${tema.toLowerCase()}.png`, fullPage: true });
  }
  // Data futura (a frase da data) e 1280 × 720 rolado até o fim (o apoio fixo ao rolar).
  await abrir(page, 1920, FUTURA);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${pasta}/treino-do-dia-1920-futura.png`, fullPage: true });
  await abrir(page, 1280, HOJE, { altura: 720 });
  await page.mouse.move(900, 400);
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${pasta}/treino-do-dia-1280x720-rolado.png` });
});

/** Colunas da lista de 5 exercícios por janela, com o menu aberto. */
const COLUNAS: Record<number, number> = { 1280: 1, 1536: 1, 1920: 2, 2560: 3, 3440: 3 };

for (const largura of [1280, 1536, 1920, 2560, 3440]) {
  test(`${largura}: resumo à esquerda, exercícios na ordem em ${COLUNAS[largura]} coluna(s), carga e séries na mesma linha`, async ({ page }) => {
    const { errosDaPagina, naoTratadas } = await abrir(page, largura);
    await expect(exercicios(page)).toHaveCount(5);
    const lateral = await caixa(apoio(page));
    await expect(apoio(page).getByRole('button', { name: 'Começar treino', exact: true })).toBeVisible();
    // A nota do salvamento no aparelho mora no cartão do resumo, uma vez só.
    await expect(page.getByText(NOTA, { exact: true })).toHaveCount(1);
    await expect(apoio(page).getByText(NOTA, { exact: true })).toBeVisible();
    // Colunas lidas de cima para baixo, na ordem 1 a 5, à direita do apoio: na ordem do DOM, cada cartão fica abaixo do
    // anterior ou abre a coluna seguinte, no topo.
    await expect.poll(async () => new Set((await Promise.all((await exercicios(page).all()).map(caixa))).map((c) => Math.round(c.x))).size).toBe(COLUNAS[largura]);
    const cartoes = await Promise.all((await exercicios(page).all()).map(caixa));
    for (let i = 1; i < cartoes.length; i++) {
      const mesmaColuna = Math.round(cartoes[i]!.x) === Math.round(cartoes[i - 1]!.x);
      if (mesmaColuna) expect(cartoes[i]!.y).toBeGreaterThan(cartoes[i - 1]!.y);
      else {
        expect(cartoes[i]!.x).toBeGreaterThan(cartoes[i - 1]!.x);
        expect(Math.abs(cartoes[i]!.y - cartoes[0]!.y)).toBeLessThanOrEqual(1);
      }
    }
    expect(cartoes[0]!.x).toBeGreaterThan(lateral.x + lateral.width);
    // Sem faixa vazia: a última coluna termina na borda do conteúdo (o recuo da tela, até 48, e a barra de rolagem); nenhum cartão
    // passa de 880 da faixa larga em diante.
    const ultimo = cartoes[cartoes.length - 1]!;
    const janela = await page.evaluate(() => document.documentElement.clientWidth);
    expect(ultimo.x + ultimo.width).toBeGreaterThanOrEqual(janela - 48 - 20);
    for (const c of cartoes) expect(c.width).toBeLessThanOrEqual(largura >= 1920 ? 880 : 1200);
    // "Última carga: —" e "0/3 séries" na mesma linha do primeiro cartão.
    const primeiro = exercicios(page).first();
    const carga = await caixa(primeiro.getByText(/^Última carga:/));
    const series = await caixa(primeiro.getByText('0/3 séries', { exact: true }));
    expect(Math.abs(carga.y + carga.height / 2 - (series.y + series.height / 2))).toBeLessThan(4);
    // O rodapé não estica.
    expect((await caixa(page.getByRole('button', { name: 'Concluir treino' }).last())).width).toBeLessThan(400);
    expect(await semRolagemDeLado(page)).toBe(true);
    expect(errosDaPagina).toEqual([]);
    expect(naoTratadas).toEqual([]);
  });
}

test('1280 × 720: rolando até o fim, o apoio continua à vista com o "Começar treino"', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, HOJE, { altura: 720 });
  await expect(exercicios(page)).toHaveCount(5);
  await page.mouse.move(900, 400);
  await page.mouse.wheel(0, 3000);
  await expect(page.getByRole('button', { name: 'Concluir treino' }).last()).toBeInViewport();
  await expect(apoio(page).getByRole('button', { name: 'Começar treino', exact: true })).toBeInViewport();
  expect(errosDaPagina).toEqual([]);
});

test('1920: data futura junta as duas frases da data numa só', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1920, FUTURA);
  await expect(apoio(page).getByText('Você está registrando o treino de 21/10/2026 e poderá concluí-lo a partir desse dia.', { exact: true })).toBeVisible();
  await expect(page.getByText(/Você poderá concluir este treino/)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

for (const { largura, menuMinimizado } of [{ largura: 390 }, { largura: 1024 }, { largura: 1024, menuMinimizado: true }]) {
  test(`${largura}${menuMinimizado ? ' (menu minimizado)' : ''}: celular e faixa compacta como antes (sem apoio, a nota depois dos exercícios e as duas frases da data)`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura, HOJE, { menuMinimizado });
    await expect(exercicios(page)).toHaveCount(5);
    await expect(apoio(page)).toHaveCount(0);
    const nota = await caixa(page.getByText(NOTA, { exact: true }));
    expect(nota.y).toBeGreaterThan((await caixa(exercicios(page).last())).y);
    await page.goto(FUTURA);
    await expect(page.getByText('Você poderá concluir este treino a partir de 21/10/2026.', { exact: true })).toBeVisible();
    expect(await semRolagemDeLado(page)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });
}

test('1920: sessão que saiu do plano mostra o vazio com "Ver meu treino"', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1920, '/aluno/sessao/nao-existe?data=2026-10-19');
  await expect(page.getByText('Esta sessão não está mais no seu plano. Volte para ver o treino atual.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver meu treino' })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});
