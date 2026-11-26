import { expect, test, type Locator, type Page } from '@playwright/test';

import type { Sessao } from '../src/api/tipos';
import { ALUNO, simularApi } from './api-falsa';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';

/**
 * Exercício do aluno na web larga (`docs/planos/aluno-web-layout.md`, seção 4, e `orientacoes-de-design-26-11.md`, 1.4):
 * com espaço, duas colunas, o exercício à esquerda fixo ao rolar (nome, meta com o Histórico e as seções Descanso, Vídeo
 * embutido e "Como fazer" aberto) e, à direita, a carga de trabalho e as séries numa coluna só (até 720), na ordem, com a
 * barra fixa (Anterior à esquerda, Próximo à direita) na largura da coluna das séries. Abaixo de 992 px de área (celular,
 * 1024 com o menu aberto ou minimizado) nada muda. Só dados fictícios. `CAPTURAS` (pasta fora do repositório) liga o teste
 * das capturas.
 */

const CARGA = { modo: 'CARGA_TRABALHO' as const, percentualMin: null, percentualMax: null };

/** Três exercícios; o do meio tem vídeo, explicação, exercício da biblioteca (Histórico) e seis séries com descanso. */
function sessoes(comVideo: boolean): Sessao[] {
  const s = sessaoFalsa('lay', 'Treino de layout', 1, 3);
  s.exercicios[1] = {
    ...s.exercicios[1], uid: 'meio', exercicioId: 'ex-meio', nome: 'Remada curvada de teste',
    videoUrl: comVideo ? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' : null, observacao: 'Tronco firme e cotovelos junto ao corpo.',
    series: Array.from({ length: 6 }, (_, i) => ({ uid: `meio-s${i + 1}`, tipo: 'WORKING', repsMin: 8, repsMax: 10, carga: CARGA, esforco: null, descansoSegundos: 90 })),
  };
  return [s];
}

const marcar = (page: Page) => page.getByRole('checkbox', { name: /^Marcar série \d como feita/ });
const apoio = (page: Page) => page.getByRole('complementary', { name: 'Sobre o exercício' });
const semRolagemDeLado = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

interface Opcoes { tema?: 'ESCURO' | 'CLARO'; altura?: number; menuMinimizado?: boolean; comVideo?: boolean }

async function abrir(page: Page, largura: number, opcoes: Opcoes = {}) {
  const { tema = 'ESCURO', altura = 1080, menuMinimizado = false, comVideo = true } = opcoes;
  await page.setViewportSize({ width: largura, height: altura });
  await page.addInitScript(([id, t, min]) => {
    try {
      localStorage.setItem('menu-lateral-recolhido', min ? '1' : '0');
      localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t }));
    } catch { /* sem armazenamento */ }
  }, [ALUNO.id, tema, menuMinimizado] as const);
  await fixarHoje(page);
  const api = await simularApi(page, {
    ...(await sessaoDeAlunoComTreino(page, sessoes(comVideo))),
    'GET /aluno/exercicios/demonstracoes': { corpo: [] },
  });
  await page.goto('/aluno/sessao/lay/meio?data=2026-10-19');
  await expect(page.getByRole('heading', { level: 1, name: 'Remada curvada de teste' })).toBeVisible();
  await expect(marcar(page)).toHaveCount(6);
  return api;
}

const caixa = async (l: Locator) => {
  await expect(l).toBeVisible();
  let b: Awaited<ReturnType<Locator['boundingBox']>> = null;
  await expect.poll(async () => (b = await l.boundingBox()) !== null).toBe(true);
  return b!;
};

test('capturas: a matriz da 0.5, escuro e claro em 1280 e 1920, sem vídeo e com o descanso contando', async ({ page }) => {
  test.skip(!process.env.CAPTURAS, 'Só com CAPTURAS (pasta fora do repositório).');
  test.setTimeout(240_000);
  const pasta = process.env.CAPTURAS!;
  const casos: ({ nome: string; largura: number } & Opcoes)[] = [
    { nome: '390', largura: 390, altura: 844 },
    { nome: '1024-menu-aberto', largura: 1024, altura: 768 },
    { nome: '1024-menu-minimizado', largura: 1024, altura: 768, menuMinimizado: true },
    { nome: '1280-escuro', largura: 1280, altura: 720 },
    { nome: '1280-claro', largura: 1280, altura: 720, tema: 'CLARO' },
    { nome: '1536', largura: 1536, altura: 864 },
    { nome: '1920-escuro', largura: 1920 },
    { nome: '1920-claro', largura: 1920, tema: 'CLARO' },
    { nome: '2560', largura: 2560, altura: 1440 },
    { nome: '3440', largura: 3440, altura: 1440 },
  ];
  for (const c of casos) {
    await abrir(page, c.largura, c);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${pasta}/exercicio-${c.nome}.png` });
  }
  await abrir(page, 1920, { comVideo: false });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${pasta}/exercicio-1920-sem-video.png` });
  await abrir(page, 1920);
  await page.getByRole('button', { name: /^Descanso 1:30/ }).click();
  await page.getByRole('button', { name: /^Descanso do plano/ }).click();
  await expect(page.getByRole('button', { name: 'Pular descanso' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${pasta}/exercicio-1920-descanso-contando.png` });
});

for (const largura of [1280, 1536, 1920, 2560, 3440]) {
  test(`${largura}: exercício à esquerda, séries numa coluna só à direita e a barra na largura das séries`, async ({ page }) => {
    const { errosDaPagina, naoTratadas } = await abrir(page, largura);
    // O primeiro desenho é o empilhado (sem medida ainda): espera as colunas assentarem.
    await expect.poll(async () => Math.round((await caixa(apoio(page))).width)).toBe(400);
    const lateral = await caixa(apoio(page));
    // O exercício: nome, Histórico e as seções Descanso, Vídeo (embutido) e Como fazer (aberto), sem os botões que abriam folha.
    await expect(apoio(page).getByRole('heading', { level: 1, name: 'Remada curvada de teste' })).toBeVisible();
    await expect(apoio(page).getByRole('button', { name: 'Histórico de Remada curvada de teste' })).toBeVisible();
    for (const secao of ['Descanso', 'Vídeo', 'Como fazer']) await expect(apoio(page).getByRole('heading', { name: secao, exact: true })).toBeVisible();
    await expect(apoio(page).getByRole('button', { name: /^Descanso 1:30/ })).toBeVisible();
    await expect(apoio(page).getByRole('button', { name: 'Assistir aqui: Remada curvada de teste' })).toBeVisible();
    await expect(apoio(page).getByRole('button', { name: 'Abrir no YouTube: Remada curvada de teste' })).toBeVisible();
    await expect(apoio(page).getByText('Tronco firme e cotovelos junto ao corpo.')).toBeVisible();
    await expect(apoio(page).getByText('Foco em controle, não em carga.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Como fazer Remada curvada de teste' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Vídeo de Remada curvada de teste' })).toHaveCount(0);
    // As séries: uma coluna, na ordem, à direita do exercício, até 720.
    const series = await Promise.all((await marcar(page).all()).map(caixa));
    expect(new Set(series.map((s) => Math.round(s.x))).size).toBe(1);
    for (let i = 1; i < series.length; i++) expect(series[i].y).toBeGreaterThan(series[i - 1].y);
    const coluna = await caixa(page.getByRole('heading', { name: /^Séries 0 de 6 feitas/ }));
    expect(coluna.x).toBeGreaterThanOrEqual(lateral.x + lateral.width + 31);
    expect(series[0].x + series[0].width - coluna.x).toBeLessThanOrEqual(720 + 1);
    const carga = await caixa(page.getByRole('textbox', { name: 'Carga de trabalho de hoje, em quilos', exact: true }));
    expect(carga.x).toBeGreaterThan(lateral.x + lateral.width);
    // Barra fixa: Anterior à esquerda e Próximo à direita, na largura da coluna das séries (a folga cobre a barra de rolagem).
    const anterior = await caixa(page.getByRole('button', { name: /^Anterior: / }));
    const proximo = await caixa(page.getByRole('button', { name: /^Próximo: / }));
    const cartao = await caixa(page.getByTestId('coluna-das-series'));
    const direitaDasSeries = cartao.x + Math.min(720, cartao.width);
    await expect.poll(async () => Math.abs((await caixa(page.getByRole('button', { name: /^Anterior: / }))).x - cartao.x)).toBeLessThanOrEqual(1);
    expect(proximo.x).toBeGreaterThan(anterior.x + anterior.width);
    expect(proximo.x + proximo.width - anterior.x).toBeLessThanOrEqual(720 + 1);
    expect(Math.abs(proximo.x + proximo.width - direitaDasSeries)).toBeLessThanOrEqual(1);
    // O exercício começa na altura das séries (sem o deslocamento do topo grudado) e o topo da rota se alinha ao bloco.
    expect(Math.abs(lateral.y - cartao.y)).toBeLessThanOrEqual(2);
    const progresso = await caixa(page.getByRole('progressbar', { name: /^Exercícios completos/ }));
    expect(Math.abs(progresso.x - lateral.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(anterior.y - proximo.y)).toBeLessThanOrEqual(2);
    // Um Anterior só (o do fim da coluna foi para a barra); a Lista do dia continua no fim da coluna.
    await expect(page.getByRole('button', { name: /^Anterior: / })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Lista do dia' })).toHaveCount(1);
    // A composição respeita o teto de 1312 do aluno.
    expect(series[0].x + series[0].width - lateral.x).toBeLessThanOrEqual(1312 + 1);
    expect(await semRolagemDeLado(page)).toBe(true);
    expect(errosDaPagina).toEqual([]);
    expect(naoTratadas).toEqual([]);
  });
}

test('1920: com o descanso contando, o cronômetro fica na coluna das séries', async ({ page }) => {
  await abrir(page, 1920);
  await page.getByRole('button', { name: /^Descanso 1:30/ }).click();
  await page.getByRole('button', { name: /^Descanso do plano/ }).click();
  const pular = await caixa(page.getByRole('button', { name: 'Pular descanso' }));
  const menos = await caixa(page.getByRole('button', { name: 'Diminuir 15 segundos' }));
  const cartao = await caixa(page.getByTestId('coluna-das-series'));
  expect(Math.abs(menos.x - cartao.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(pular.x + pular.width - (cartao.x + Math.min(720, cartao.width)))).toBeLessThanOrEqual(1);
});

test('1280 × 720: o exercício fica fixo ao rolar pelas séries', async ({ page }) => {
  await abrir(page, 1280, { altura: 720 });
  const quinta = marcar(page).nth(4);
  await quinta.scrollIntoViewIfNeeded();
  await expect(quinta).toBeInViewport();
  await expect(apoio(page).getByRole('heading', { level: 1, name: 'Remada curvada de teste' })).toBeInViewport();
  await expect(apoio(page).getByRole('button', { name: /^Descanso 1:30/ })).toBeInViewport();
});

for (const [largura, altura] of [[1280, 720], [1366, 640]]) {
  test(`${largura} × ${altura}: no fim das séries o nome e o Descanso continuam à vista`, async ({ page }) => {
    await abrir(page, largura, { altura });
    // Rola até o fim de verdade (a roda sobre as séries), não só até o botão aparecer.
    const lista = page.getByRole('button', { name: 'Lista do dia' });
    const serie = await caixa(marcar(page).first());
    await page.mouse.move(serie.x, serie.y);
    await page.mouse.wheel(0, 20_000);
    await expect(lista).toBeInViewport({ ratio: 1 });
    await expect(apoio(page).getByRole('heading', { level: 1, name: 'Remada curvada de teste' })).toBeInViewport({ ratio: 1 });
    await expect(apoio(page).getByRole('button', { name: /^Descanso 1:30/ })).toBeInViewport({ ratio: 1 });
    // A coluna não passa da área que rola: o fim dela (o texto do Como fazer) se alcança rolando a própria coluna.
    const ultimo = apoio(page).getByText('Foco em controle, não em carga.');
    await ultimo.scrollIntoViewIfNeeded();
    await expect(ultimo).toBeInViewport({ ratio: 1 });
  });
}

for (const caso of [{ largura: 390, menu: '' }, { largura: 1024, menu: 'aberto' }, { largura: 1024, menu: 'minimizado' }]) {
  test(`${caso.largura}${caso.menu ? `, menu ${caso.menu}` : ''}: o desenho de sempre, sem coluna de apoio`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, caso.largura, { menuMinimizado: caso.menu === 'minimizado' });
    await expect(apoio(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Vídeo de Remada curvada de teste' })).toBeVisible();
    await page.getByRole('button', { name: 'Como fazer Remada curvada de teste' }).click();
    await expect(page.getByRole('dialog').getByText('Tronco firme e cotovelos junto ao corpo.')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const series = await Promise.all((await marcar(page).all()).map(caixa));
    expect(new Set(series.map((s) => Math.round(s.x))).size).toBe(1);
    await expect(page.getByRole('button', { name: /^Anterior: / })).toHaveCount(1);
    expect(await semRolagemDeLado(page)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });
}
