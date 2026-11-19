import { expect, test, type Page } from '@playwright/test';

import type { AulaDaComunidade } from '../src/api/comunidadeTipos';
import { PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Barra de rolagem que piscava em Comunidade › Vídeos (e em qualquer tela de `Tela`/`RolagemComTopo` com altura que depende da
 * largura, como a capa 16:9): perto do limite de altura a barra clássica aparece e tira ~15 px de largura, a capa fica mais baixa,
 * o conteúdo passa a caber, a barra some, a capa cresce e o ciclo recomeça. `scrollbar-gutter: stable` (só na web) reserva a
 * faixa da barra, e a largura útil deixa de depender de ela existir. O teste procura a altura da janela em que o conteúdo mal
 * passa e conta quantas vezes a largura útil da rolagem muda num intervalo de tempo.
 */
test.use({
  // Barra clássica de verdade: o headless esconde as barras por padrão e o problema não apareceria.
  launchOptions: { executablePath: process.env.PW_CHROMIUM, ignoreDefaultArgs: ['--hide-scrollbars'] },
});

const AULA: AulaDaComunidade = {
  id: 'a1', titulo: 'Vídeo de técnica', descricao: 'Pauta do vídeo de teste.', videoUrl: 'https://exemplo.test/video', capaId: null,
  playlistId: null, ordem: 0, publicada: true, criadaEm: '2026-10-19T12:00:00-03:00', totalComentarios: 0,
};
const AULAS = Array.from({ length: 6 }, (_, i) => ({ ...AULA, id: `a${i + 1}`, titulo: `Vídeo ${i + 1}` }));

async function abrir(page: Page) {
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'COMUNIDADE_MODERAR'] })),
    'GET /comunidade/configuracao': { corpo: { alunosPublicam: true, alunosAnexamFotos: false } },
    'GET /comunidade/mural': { corpo: { content: [], totalElements: 0 } },
    'GET /comunidade/aulas': { corpo: AULAS },
    'GET /comunidade/playlists': { corpo: [] },
    'GET /comunidade/pods': { corpo: [] },
  });
  await page.goto('/treinador/comunidade');
  await page.getByRole('tab', { name: 'Vídeos' }).click();
  await expect(page.getByRole('button', { name: 'Abrir vídeo: Vídeo 6' })).toBeVisible();
  return api;
}

/** Marca o elemento que rola (o `overflow-y: auto` mais próximo acima do título da tela) para os `evaluate` seguintes. */
const marcarRolagem = (page: Page) => page.evaluate(() => {
  let no: HTMLElement | null = document.querySelector('h1');
  while (no && !/auto|scroll/.test(getComputedStyle(no).overflowY)) no = no.parentElement;
  if (!no) throw new Error('rolagem não encontrada');
  no.setAttribute('data-teste-rolagem', '1');
});

/** Quantas vezes a largura útil da rolagem muda em `ms` milissegundos (uma amostra por quadro). */
const mudancasDeLargura = (page: Page, ms = 500) => page.evaluate((duracao) => new Promise<{ n: number; larguras: number[] }>((resolve) => {
  const alvo = document.querySelector<HTMLElement>('[data-teste-rolagem]')!;
  let ultima = alvo.clientWidth;
  const larguras = [ultima];
  let n = 0;
  const inicio = performance.now();
  const passo = () => {
    if (alvo.clientWidth !== ultima) { n += 1; ultima = alvo.clientWidth; larguras.push(ultima); }
    if (performance.now() - inicio < duracao) requestAnimationFrame(passo);
    else resolve({ n, larguras });
  };
  requestAnimationFrame(passo);
}), ms);

const estouraAAltura = (page: Page) => page.evaluate(() => {
  const alvo = document.querySelector<HTMLElement>('[data-teste-rolagem]')!;
  return alvo.scrollHeight > alvo.clientHeight;
});

// 800: uma coluna de vídeos com o menu em trilho; 1280: duas colunas. Abaixo de 768 a faixa não é reservada (aparelho de toque).
for (const largura of [1280, 800]) {
  test(`Comunidade › Vídeos: a largura útil não oscila em nenhuma altura de janela (${largura} px)`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: largura, height: 4000 });
    const api = await abrir(page);
    await marcarRolagem(page);

    // Janela alta: nada rola. Desce de 40 em 40 até o conteúdo passar da janela: o limite está logo acima.
    let altura = 4000;
    while (!(await estouraAAltura(page)) && altura > 300) {
      altura -= 40;
      await page.setViewportSize({ width: largura, height: altura });
      await page.waitForTimeout(80);
    }
    expect(altura, 'não achei o limite de altura do conteúdo').toBeGreaterThan(300);

    // Varre a faixa do limite de 1 em 1 px (a faixa que oscila tem poucos pixels) e conta as trocas de largura.
    const piores: string[] = [];
    const vistas = new Set<number>();
    for (let h = altura + 60; h >= altura - 10; h -= 1) {
      await page.setViewportSize({ width: largura, height: h });
      const { n, larguras } = await mudancasDeLargura(page);
      larguras.forEach((l) => vistas.add(l));
      if (n > 2) piores.push(`${h} px: ${n} trocas`);
    }
    expect(piores, 'alturas em que a largura útil oscila').toEqual([]);
    // A faixa da barra está reservada: a largura útil é uma só, com ou sem barra.
    expect([...vistas], 'larguras úteis vistas na varredura').toHaveLength(1);
    expect(api.errosDaPagina).toEqual([]);
  });
}
