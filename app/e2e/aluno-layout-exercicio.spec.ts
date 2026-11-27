import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AnterioresDoPacote, PainelAluno, ProgressoPonto, RecordesDoPacote, Sessao } from '../src/api/tipos';
import { ALUNO, sessao, simularApi } from './api-falsa';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';

/**
 * Exercício do aluno na web larga (27/11, contêiner do treinador; `aluno/exercicio/colunasDoExercicio`): com espaço, o
 * exercício à esquerda fixo ao rolar (nome, meta com o Histórico e as seções Descanso, Vídeo embutido e "Como fazer" aberto,
 * 380/420/440 pela faixa) e a carga de trabalho com as séries numa coluna só, na ordem, ocupando o resto na faixa normal; da
 * larga em diante as séries param em 880 (ou menos, até 640) e o resto vira a coluna do próximo exercício e do histórico
 * aberto (em duas a partir de 752). A barra fixa (Anterior à esquerda, Próximo à direita) fica na largura das séries. Abaixo
 * de 972 px úteis (celular, 1024 com o menu aberto ou minimizado) nada muda. Só dados fictícios. `E2E_CAPTURAS` (ou
 * `CAPTURAS`, pasta fora do repositório) liga o teste das capturas.
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

const PONTOS: ProgressoPonto[] = [
  { data: '2026-09-28', maiorCargaTrabalho: 55, repeticoes: 10 },
  { data: '2026-10-05', maiorCargaTrabalho: 57.5, repeticoes: 9 },
  { data: '2026-10-12', maiorCargaTrabalho: 60, repeticoes: 8 },
];
/** A última vez e os recordes do exercício do meio (vêm no pacote, com "Concluir treino" ligado): o histórico com conteúdo real. */
const RECORDES: RecordesDoPacote = {
  ate: '2026-10-19',
  exercicios: { 'ex-meio': { maiorCarga: 62.5, maiorVolume: 600, repeticoesPorCarga: [{ carga: 60, repeticoes: 10 }, { carga: 62.5, repeticoes: 6 }] } },
};
const ANTERIORES: AnterioresDoPacote = {
  ate: '2026-10-19',
  exercicios: { 'ex-meio': { data: '2026-10-12', series: Array.from({ length: 6 }, (_, i) => ({ tipo: 'WORKING' as const, ordem: i + 1, carga: 60, repeticoes: 8, etapas: null })) } },
};
const PASTA = process.env.E2E_CAPTURAS ?? process.env.CAPTURAS;

const marcar = (page: Page) => page.getByRole('checkbox', { name: /^Marcar série \d como feita/ });
const apoio = (page: Page) => page.getByRole('complementary', { name: 'Sobre o exercício' });
const extras = (page: Page) => page.getByRole('complementary', { name: 'Próximo exercício e histórico' });
const semRolagemDeLado = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

interface Opcoes { tema?: 'ESCURO' | 'CLARO'; altura?: number; menuMinimizado?: boolean; comVideo?: boolean; exercicio?: string; titulo?: string; series?: number }

async function abrir(page: Page, largura: number, opcoes: Opcoes = {}) {
  const { tema = 'ESCURO', altura = 1080, menuMinimizado = false, comVideo = true, exercicio = 'meio', titulo = 'Remada curvada de teste', series = 6 } = opcoes;
  await page.setViewportSize({ width: largura, height: altura });
  await page.addInitScript(([id, t, min]) => {
    try {
      localStorage.setItem('menu-lateral-recolhido', min ? '1' : '0');
      localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t }));
    } catch { /* sem armazenamento */ }
  }, [ALUNO.id, tema, menuMinimizado] as const);
  await fixarHoje(page);
  const base = await sessaoDeAlunoComTreino(page, sessoes(comVideo));
  const painel = (base['GET /aluno/painel'] as { corpo: PainelAluno }).corpo;
  const api = await simularApi(page, {
    ...base,
    ...(await sessao(page, ALUNO, { retornoHabilitado: true })),
    'GET /aluno/painel': { corpo: { ...painel, recordes: RECORDES, anteriores: ANTERIORES } },
    'GET /aluno/sessoes-concluidas': { corpo: { totalConcluidos: 0, sessoes: [] } },
    'GET /aluno/exercicios/demonstracoes': { corpo: [] },
    'GET /aluno/progresso': { corpo: PONTOS },
  });
  await page.goto(`/aluno/sessao/lay/${exercicio}?data=2026-10-19`);
  await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
  await expect(marcar(page)).toHaveCount(series);
  return api;
}

const caixa = async (l: Locator) => {
  await expect(l).toBeVisible();
  let b: Awaited<ReturnType<Locator['boundingBox']>> = null;
  await expect.poll(async () => (b = await l.boundingBox()) !== null).toBe(true);
  return b!;
};

test('capturas: a matriz da 0.5, escuro e claro em 1280, 1920 e 3440, sem vídeo, sem histórico e com o descanso contando', async ({ page }) => {
  test.skip(!PASTA, 'Só com E2E_CAPTURAS (pasta fora do repositório).');
  test.setTimeout(300_000);
  const pasta = PASTA!;
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
    { nome: '3440-escuro', largura: 3440, altura: 1440 },
    { nome: '3440-claro', largura: 3440, altura: 1440, tema: 'CLARO' },
    { nome: '3440-sem-historico', largura: 3440, altura: 1440, exercicio: 'laye1', titulo: 'Exercício laye1', series: 3 },
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

/** A largura da coluna do exercício pela faixa da área e se a 3ª coluna (próximo e histórico) abre, por janela com o menu aberto. */
const CASOS = [
  { largura: 1280, apoio: 380, terceira: false },
  { largura: 1536, apoio: 380, terceira: false },
  { largura: 1920, apoio: 420, terceira: true },
  { largura: 2560, apoio: 420, terceira: true },
  { largura: 3440, apoio: 440, terceira: true },
];

for (const { largura, apoio: larguraDoApoio, terceira } of CASOS) {
  test(`${largura}: exercício à esquerda, séries numa coluna só${terceira ? ', próximo e histórico à direita' : ' até a borda'} e a barra na largura das séries`, async ({ page }) => {
    const { errosDaPagina, naoTratadas } = await abrir(page, largura);
    // O primeiro desenho é o empilhado (sem medida ainda): espera as colunas assentarem.
    await expect.poll(async () => Math.round((await caixa(apoio(page))).width)).toBe(larguraDoApoio);
    const lateral = await caixa(apoio(page));
    // O exercício: nome, Histórico e as seções Descanso, Vídeo (embutido) e Como fazer (aberto), sem os botões que abriam folha.
    await expect(apoio(page).getByRole('heading', { level: 1, name: 'Remada curvada de teste' })).toBeVisible();
    // Com o histórico aberto na 3ª coluna, o botão que abria a folha sai.
    await expect(apoio(page).getByRole('button', { name: 'Histórico de Remada curvada de teste' })).toHaveCount(terceira ? 0 : 1);
    for (const secao of ['Descanso', 'Vídeo', 'Como fazer']) await expect(apoio(page).getByRole('heading', { name: secao, exact: true })).toBeVisible();
    await expect(apoio(page).getByRole('button', { name: /^Descanso 1:30/ })).toBeVisible();
    await expect(apoio(page).getByRole('button', { name: 'Assistir aqui: Remada curvada de teste' })).toBeVisible();
    await expect(apoio(page).getByRole('button', { name: 'Abrir no YouTube: Remada curvada de teste' })).toBeVisible();
    await expect(apoio(page).getByText('Tronco firme e cotovelos junto ao corpo.')).toBeVisible();
    await expect(apoio(page).getByText('Foco em controle, não em carga.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Como fazer Remada curvada de teste' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Vídeo de Remada curvada de teste' })).toHaveCount(0);
    // As séries: uma coluna, na ordem, à direita do exercício.
    const series = await Promise.all((await marcar(page).all()).map(caixa));
    expect(new Set(series.map((s) => Math.round(s.x))).size).toBe(1);
    for (let i = 1; i < series.length; i++) expect(series[i].y).toBeGreaterThan(series[i - 1].y);
    const coluna = await caixa(page.getByRole('heading', { name: /^Séries 0 de 6 feitas/ }));
    expect(coluna.x).toBeGreaterThanOrEqual(lateral.x + lateral.width + 31);
    const carga = await caixa(page.getByRole('textbox', { name: 'Carga de trabalho de hoje, em quilos', exact: true }));
    expect(carga.x).toBeGreaterThan(lateral.x + lateral.width);
    const cartao = await caixa(page.getByTestId('coluna-das-series'));
    // O topo da rota se alinha ao bloco: a borda direita dele é a do conteúdo (sem faixa vazia à direita).
    const progresso = await caixa(page.getByRole('progressbar', { name: /^Exercícios completos/ }));
    const direitaDoBloco = progresso.x + progresso.width;
    if (terceira) {
      // Séries até 880; o próximo (o cartão da lista do dia) e o histórico aberto ocupam o resto, até a borda.
      expect(cartao.width).toBeLessThanOrEqual(880 + 1);
      expect(cartao.width).toBeGreaterThanOrEqual(640 - 1);
      await expect.poll(async () => (await extras(page).count())).toBe(1);
      const terceiraColuna = await caixa(extras(page));
      expect(terceiraColuna.x).toBeGreaterThanOrEqual(cartao.x + cartao.width + 31);
      expect(Math.abs(terceiraColuna.x + terceiraColuna.width - direitaDoBloco)).toBeLessThanOrEqual(2);
      await expect(extras(page).getByRole('heading', { name: 'Próximo exercício', exact: true })).toBeVisible();
      const cartaoDoProximo = await caixa(extras(page).getByRole('link', { name: /^Abrir Exercício laye3/ }));
      // O cartão do próximo não quebra em várias linhas (o cartão inteiro baixo).
      expect(cartaoDoProximo.height).toBeLessThan(140);
      await expect(extras(page).getByRole('heading', { name: 'Histórico', exact: true })).toBeVisible();
      await expect(extras(page).getByText('12/10/2026', { exact: true })).toBeVisible();
      await expect(extras(page).getByRole('heading', { name: 'Carga por data', exact: true })).toHaveCount(terceiraColuna.width >= 752 ? 1 : 0);
    } else {
      await expect(extras(page)).toHaveCount(0);
      expect(Math.abs(cartao.x + cartao.width - direitaDoBloco)).toBeLessThanOrEqual(2);
    }
    // Barra fixa: Anterior à esquerda e Próximo à direita, na largura da coluna das séries (a folga cobre a barra de rolagem).
    const anterior = await caixa(page.getByRole('button', { name: /^Anterior: / }));
    const proximo = await caixa(page.getByRole('button', { name: /^Próximo: / }));
    const direitaDasSeries = cartao.x + cartao.width;
    await expect.poll(async () => Math.abs((await caixa(page.getByRole('button', { name: /^Anterior: / }))).x - cartao.x)).toBeLessThanOrEqual(1);
    expect(proximo.x).toBeGreaterThan(anterior.x + anterior.width);
    expect(Math.abs(proximo.x + proximo.width - direitaDasSeries)).toBeLessThanOrEqual(1);
    // O exercício começa na altura das séries (sem o deslocamento do topo grudado) e o topo da rota se alinha ao bloco.
    expect(Math.abs(lateral.y - cartao.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(progresso.x - lateral.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(anterior.y - proximo.y)).toBeLessThanOrEqual(2);
    // Um Anterior só (o do fim da coluna foi para a barra); a Lista do dia continua no fim da coluna.
    await expect(page.getByRole('button', { name: /^Anterior: / })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Lista do dia' })).toHaveCount(1);
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
  expect(Math.abs(pular.x + pular.width - (cartao.x + cartao.width))).toBeLessThanOrEqual(1);
});

test('3440: exercício sem histórico (livre) leva só o próximo, na largura da coluna do exercício, e as séries ficam com o resto', async ({ page }) => {
  const { errosDaPagina, naoTratadas } = await abrir(page, 3440, { altura: 1440, exercicio: 'laye1', titulo: 'Exercício laye1', series: 3 });
  await expect.poll(async () => Math.round((await caixa(extras(page))).width)).toBe(440);
  await expect(extras(page).getByRole('link', { name: /^Abrir Remada curvada de teste/ })).toBeVisible();
  await expect(extras(page).getByRole('heading', { name: 'Histórico', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Histórico de / })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
  expect(naoTratadas).toEqual([]);
});

test('1920: o último exercício, livre, não tem próximo nem histórico: duas colunas, as séries até a borda', async ({ page }) => {
  const { errosDaPagina, naoTratadas } = await abrir(page, 1920, { exercicio: 'laye3', titulo: 'Exercício laye3', series: 3 });
  await expect(apoio(page)).toBeVisible();
  await expect(extras(page)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
  expect(naoTratadas).toEqual([]);
});

test('3440 × 1440: rolando até o fim das séries, o exercício e a 3ª coluna continuam à vista', async ({ page }) => {
  await abrir(page, 3440, { altura: 1440 });
  await expect(extras(page)).toBeVisible();
  const lista = page.getByRole('button', { name: 'Lista do dia' });
  const serie = await caixa(marcar(page).first());
  await page.mouse.move(serie.x, serie.y);
  await page.mouse.wheel(0, 20_000);
  await expect(lista).toBeInViewport();
  await expect(extras(page).getByRole('heading', { name: 'Próximo exercício', exact: true })).toBeInViewport();
  await expect(apoio(page).getByRole('heading', { level: 1, name: 'Remada curvada de teste' })).toBeInViewport();
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
