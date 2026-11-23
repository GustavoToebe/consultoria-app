import { expect, test, type Page } from '@playwright/test';

import type { AulaDaComunidade, PlaylistDaComunidade } from '../src/api/comunidadeTipos';
import { sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, type RespostasApi, simularApi } from './api-falsa';

/**
 * Vídeos do aluno agrupados por coleção (passo 10 de `docs/planos/comunidade-playlists.md`), com a API simulada nas rotas
 * reais (`GET /aluno/comunidade/aulas` e `/playlists`). Só dados fictícios. A resposta das aulas vem embaralhada e com buracos
 * na `ordem` (0, 2, 5): o número na tela é a posição na coleção, nunca `ordem + 1` nem a ordem da resposta.
 */
const COLECOES: PlaylistDaComunidade[] = [
  { id: 'pl-base', nome: 'Base de força', ordem: 1, totalAulas: 3 },
  { id: 'pl-mob', nome: 'Mobilidade', ordem: 0, totalAulas: 1 },
  // A API do aluno não manda coleção vazia (D16); se mandar, a tela também não a mostra.
  { id: 'pl-vazia', nome: 'Coleção sem vídeo', ordem: 2, totalAulas: 0 },
];
const aula = (id: string, titulo: string, playlistId: string | null, ordem: number): AulaDaComunidade => ({
  id, titulo, descricao: null, videoUrl: 'https://exemplo.test/video', capaId: null, playlistId, ordem, publicada: true,
  criadaEm: '2026-10-19T12:00:00-03:00', totalComentarios: 0,
});
const AULAS: AulaDaComunidade[] = [
  aula('v3', 'Supino com pausa', 'pl-base', 5),
  aula('s1', 'Recado da equipe', null, 0),
  aula('v1', 'Agachamento livre', 'pl-base', 0),
  aula('m1', 'Alongamento de quadril', 'pl-mob', 3),
  aula('v2', 'Remada curvada', 'pl-base', 2),
];

const comunidade = (extra: RespostasApi = {}): RespostasApi => ({
  'GET /aluno/comunidade/configuracao': { corpo: { alunosPublicam: true, podeAnexarFoto: false } },
  'GET /aluno/comunidade/mural': { corpo: { content: [], totalElements: 0 } },
  'GET /aluno/comunidade/conquistas': { corpo: [] },
  'GET /aluno/comunidade/ranking': { corpo: { posicao: 1, treinosConcluidos: 0, pontuacao: 0, participantes: 1, nivel: 1, xp: 0, xpNoNivel: 0, faltam: 100 } },
  'GET /aluno/comunidade/aulas': { corpo: AULAS },
  'GET /aluno/comunidade/playlists': { corpo: COLECOES },
  'GET /aluno/comunidade/aulas/{id}/comentarios': { corpo: { itens: [], total: 0 } },
  ...extra,
});

const VIDEOS = '/aluno/comunidade?aba=auloes';
const CAPTURAS = process.env.CAPTURAS_DIR;
async function capturar(page: Page, nome: string) {
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/${nome}.png`, fullPage: true });
}
/** JPEG fictício desenhado na página (a capa simulada), como em `comunidade.spec.ts`. */
async function jpegFicticio(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#5a7d9a';
    ctx.fillRect(0, 0, 64, 64);
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
  });
  return Buffer.from(base64, 'base64');
}
async function tema(page: Page, t: 'CLARO' | 'ESCURO') {
  await page.addInitScript(([id, tm]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: tm, contraste: 'PADRAO' })), [ALUNO.id, t]);
}
/**
 * Cabeçalho de coleção (23/11): os cabeçalhos são botões dentro do h2, com o nome "Coleção 2: Base de força, 3 vídeos" (ou
 * "Sem coleção, 1 vídeo") e o estado só no `aria-expanded`.
 */
const cabecalhos = (page: Page) => page.getByRole('button', { name: /^(Coleção \d+: .+|Sem coleção), \d+ vídeos?$/ });
const colecao = (page: Page, nome: string) => page.getByRole('button', { name: new RegExp(`^(Coleção \\d+: ${nome}|${nome}), \\d+ vídeos?$`) });
/** Os títulos dos vídeos: h3 dentro da coleção (h2); na grade sem agrupar, h2. */
const titulos = (page: Page) => page.getByRole('heading', { level: 3 });
/** O selo da posição na capa ("Posição 3"). */
const posicoes = (page: Page) => page.getByLabel(/^Posição \d+$/);

for (const largura of [390, 1280]) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test('coleções na ordem do treinador, "Sem coleção" por último, nascem fechadas e numeram pela posição', async ({ page }) => {
      await tema(page, 'CLARO');
      const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...comunidade() });
      await page.goto(VIDEOS);
      await expect(page.getByRole('heading', { level: 1, name: 'Comunidade' })).toBeVisible();
      await expect(colecao(page, 'Mobilidade')).toBeVisible();
      await expect(cabecalhos(page)).toHaveText([/Mobilidade/, /Base de força/, /Sem coleção/]);
      // cabeçalho de coleção (23/11): "Coleção N" pela ordem que o aluno vê (a vazia não aparece nem conta), fechadas.
      await expect.poll(() => cabecalhos(page).evaluateAll((els) => els.map((e) => [e.getAttribute('aria-label'), e.getAttribute('aria-expanded')])))
        .toEqual([['Coleção 1: Mobilidade, 1 vídeo', 'false'], ['Coleção 2: Base de força, 3 vídeos', 'false'], ['Sem coleção, 1 vídeo', 'false']]);
      await expect(page.getByRole('heading', { level: 2, name: 'Coleção 2: Base de força, 3 vídeos', exact: true })).toBeVisible();
      await expect(page.getByText('Coleção 2', { exact: true })).toHaveText('COLEÇÃO 2', { useInnerText: true });
      await expect(colecao(page, 'Sem coleção')).toHaveText(/^SEM COLEÇÃO\s*1 vídeo$/, { useInnerText: true });
      await expect(page.getByTestId('fio-entre-colecoes')).toHaveCount(2);
      await expect(page.getByText('Coleção sem vídeo')).toHaveCount(0);
      await expect(page.getByText('3 vídeos', { exact: true })).toBeVisible();
      // Fechadas, nenhum vídeo aparece.
      await expect(titulos(page)).toHaveCount(0);
      await capturar(page, `colecoes-fechadas-${largura}-claro`);

      await colecao(page, 'Base de força').click();
      await expect(colecao(page, 'Base de força')).toHaveAttribute('aria-expanded', 'true');
      // Cartão do D2 (D6, 20/11): o título sem número; a posição fica no selo da capa.
      await expect(titulos(page)).toHaveText(['Agachamento livre', 'Remada curvada', 'Supino com pausa']);
      await expect(posicoes(page)).toHaveText(['1', '2', '3']);
      await colecao(page, 'Sem coleção').click();
      // cabeçalho de coleção (23/11): o vídeo é h3 dentro da coleção (h2).
      await expect(page.getByRole('heading', { level: 3, name: 'Recado da equipe', exact: true })).toBeVisible();
      // "Sem coleção" não tem número.
      await expect(posicoes(page)).toHaveCount(3);
      await capturar(page, `colecoes-abertas-${largura}-claro`);
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('busca procura em todas, abre as coleções com resultado sem renumerar e limpar volta ao de antes', async ({ page }) => {
      await simularApi(page, { ...(await sessaoDeAluno(page)), ...comunidade() });
      await page.goto(VIDEOS);
      await page.getByLabel('Buscar nos vídeos').fill('supino');
      // O 3º vídeo da coleção continua "3.", com o nome da coleção no cabeçalho do grupo.
      await expect(titulos(page)).toHaveText(['Supino com pausa']);
      await expect(posicoes(page)).toHaveText(['3']);
      await expect(cabecalhos(page)).toHaveCount(1);
      // cabeçalho de coleção (23/11): a busca também não renumera a coleção; sem a primeira seção, nenhum fio.
      await expect(colecao(page, 'Base de força')).toHaveAttribute('aria-label', 'Coleção 2: Base de força, 1 vídeo');
      await expect(page.getByTestId('fio-entre-colecoes')).toHaveCount(0);
      await expect(colecao(page, 'Base de força')).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByText('1 vídeo', { exact: true })).toBeVisible();
      await capturar(page, `colecoes-busca-${largura}`);

      await page.getByLabel('Buscar nos vídeos').fill('nada parecido');
      await expect(page.getByText('Nenhum vídeo encontrado com essa busca.')).toBeVisible();
      await page.getByRole('button', { name: 'Limpar busca' }).click();
      await expect(cabecalhos(page)).toHaveCount(3);
      await expect(colecao(page, 'Base de força')).toHaveAttribute('aria-expanded', 'false');
      await expect(titulos(page)).toHaveCount(0);
    });

    test('o voltar do navegador fecha a coleção (e antes a folha dos comentários) sem sair da Comunidade', async ({ page }) => {
      await simularApi(page, { ...(await sessaoDeAluno(page)), ...comunidade() });
      await page.goto(VIDEOS);
      await colecao(page, 'Base de força').click();
      await expect(titulos(page)).toHaveCount(3);
      await page.getByRole('button', { name: 'Ver comentários do vídeo Remada curvada: Nenhum comentário' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      await page.goBack();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(colecao(page, 'Base de força')).toHaveAttribute('aria-expanded', 'true');

      await page.goBack();
      await expect(colecao(page, 'Base de força')).toHaveAttribute('aria-expanded', 'false');
      await expect(titulos(page)).toHaveCount(0);
      await expect(page).toHaveURL(/\/aluno\/comunidade\?aba=auloes/);
      await expect(page.getByRole('heading', { level: 1, name: 'Comunidade' })).toBeVisible();
    });

    // O `setAba` do pai fecha a coleção (o passo do histórico volta) e só então grava a aba.
    test('trocar de aba com a coleção aberta vai para a outra aba no primeiro toque', async ({ page }) => {
      await simularApi(page, { ...(await sessaoDeAluno(page)), ...comunidade() });
      await page.goto(VIDEOS);
      await colecao(page, 'Mobilidade').click();
      await expect(colecao(page, 'Mobilidade')).toHaveAttribute('aria-expanded', 'true');
      await page.getByRole('tab', { name: 'Mural' }).click();
      await expect(page).toHaveURL(/aba=mural/);
      await page.waitForTimeout(800);
      await expect(page).toHaveURL(/aba=mural/);
      await expect(cabecalhos(page)).toHaveCount(0);
    });

    test('GET das coleções falhando: aviso com "Tentar de novo" e os vídeos sem agrupar nem numerar', async ({ page }) => {
      let falhar = true;
      await simularApi(page, {
        ...(await sessaoDeAluno(page)),
        ...comunidade({
          'GET /aluno/comunidade/playlists': (_p, route) => {
            const e = falhar ? erroApi(500, 'Erro interno.') : { status: 200, corpo: COLECOES };
            return route.fulfill({ status: e.status, contentType: 'application/json', body: JSON.stringify(e.corpo) });
          },
        }),
      });
      await page.goto(VIDEOS);
      await expect(page.getByText('Não foi possível carregar as coleções. Os vídeos aparecem abaixo, sem agrupar.')).toBeVisible();
      // Na ordem da API, sem número e sem "Sem coleção" (agrupar sem as coleções poria tudo lá).
      // cabeçalho de coleção (23/11): sem agrupar não há cabeçalho, e o vídeo volta a ser h2.
      await expect(page.getByRole('heading', { level: 2 })).toHaveText(AULAS.map((a) => a.titulo));
      await expect(posicoes(page)).toHaveCount(0);
      await expect(page.getByText('Sem coleção')).toHaveCount(0);
      await expect(cabecalhos(page)).toHaveCount(0);
      await capturar(page, `colecoes-erro-${largura}`);

      falhar = false;
      await page.getByRole('button', { name: 'Tentar de novo' }).click();
      await expect(cabecalhos(page)).toHaveCount(3);
    });

    // D6 (20/11): o cartão do D2 sem ⋯ nem alça, com o botão visível "Abrir no YouTube" ou "Abrir vídeo", que abre fora do
    // app sem token; a capa vem pela rota do aluno e o player só monta depois do toque em "Assistir". O YouTube e o outro site
    // são interceptados, nunca os reais.
    for (const t of ['CLARO', 'ESCURO'] as const) {
      test(`cartões do vídeo: YouTube com "Abrir no YouTube", outro site com "Abrir vídeo" (${t.toLowerCase()})`, async ({ page, context }) => {
        await context.route('https://www.youtube-nocookie.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>player de teste</p>' }));
        await context.route('https://www.youtube.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>YouTube de teste</p>' }));
        await context.route('https://video.exemplo.invalid/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>Outro site de teste</p>' }));
        await tema(page, t);
        const youtube: AulaDaComunidade = {
          ...aula('y1', 'Técnica do agachamento com pausa longa no fundo e subida controlada', 'pl-base', 0),
          descricao: 'Pausa de dois segundos no fundo.', videoUrl: 'https://www.youtube.com/watch?v=abcDEF12345', capaId: 'capa-1', totalComentarios: 2,
        };
        const outroSite: AulaDaComunidade = {
          ...aula('o1', 'Remada no outro site', 'pl-base', 1), descricao: 'Remada no outro site', videoUrl: 'https://video.exemplo.invalid/aula', totalComentarios: 1,
        };
        let jpeg: Buffer = Buffer.alloc(0);
        const api = await simularApi(page, {
          ...(await sessaoDeAluno(page)),
          ...comunidade({
            'GET /aluno/comunidade/aulas': { corpo: [youtube, outroSite, aula('m1', 'Alongamento de quadril', 'pl-mob', 0), aula('s1', 'Recado da equipe', null, 0)] },
            'GET /aluno/comunidade/playlists': { corpo: [{ ...COLECOES[0], totalAulas: 2 }, COLECOES[1]] },
            'GET /aluno/comunidade/capas/{id}': (_p, route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: jpeg }),
          }),
        });
        jpeg = await jpegFicticio(page);
        await page.goto(VIDEOS);
        await colecao(page, 'Base de força').click();
        await expect(titulos(page)).toHaveText([youtube.titulo, outroSite.titulo]);
        await expect(posicoes(page)).toHaveText(['1', '2']);
        // A descrição aparece (a que repete o título some: `descricaoDoCartao`, testada no jest).
        await expect(page.getByText('Pausa de dois segundos no fundo.')).toBeVisible();
        await expect(page.getByText('2 comentários', { exact: true })).toBeVisible();
        await expect(page.getByText('1 comentário', { exact: true })).toBeVisible();
        // Sem gestão no aluno: nem ⋯ nem alça.
        await expect(page.getByRole('button', { name: /^Ações do vídeo/ })).toHaveCount(0);
        await expect(page.getByRole('button', { name: /arrastar|Mover/i })).toHaveCount(0);
        // Capa pela rota do aluno; nada do YouTube carrega antes do toque.
        await expect.poll(() => api.pedidos.some((p) => p.caminho === '/aluno/comunidade/capas/capa-1')).toBe(true);
        await expect(page.locator('img[src^="blob:"]')).toHaveCount(1);
        await expect(page.locator('iframe')).toHaveCount(0);
        // 1 coluna no celular, 2 no PC (a tela do aluno tem 720 px).
        const xs = await Promise.all((await page.getByRole('button', { name: /^Ver comentários do vídeo/ }).all()).map((b) => b.boundingBox()));
        expect(new Set(xs.map((c) => Math.round(c!.x))).size).toBe(largura >= 1024 ? 2 : 1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
        await capturar(page, `cartoes-${largura}-${t.toLowerCase()}`);

        const noYoutube = page.getByRole('button', { name: `Abrir no YouTube: ${youtube.titulo}` });
        await expect(noYoutube).toHaveText('Abrir no YouTube');
        const [popup] = await Promise.all([page.waitForEvent('popup'), noYoutube.click()]);
        await popup.waitForURL('https://www.youtube.com/watch?v=abcDEF12345');
        expect(await popup.evaluate(() => window.opener)).toBeNull();
        await popup.close();

        const foraDoApp = page.getByRole('button', { name: `Abrir vídeo fora do app: ${outroSite.titulo}` });
        await expect(foraDoApp).toHaveText('Abrir vídeo');
        const [outro] = await Promise.all([page.waitForEvent('popup'), foraDoApp.click()]);
        await outro.waitForURL('https://video.exemplo.invalid/aula');
        expect(await outro.evaluate(() => window.opener)).toBeNull();
        await outro.close();

        // Erros da página conferidos antes do player: o script de preparação do e2e (api-falsa) roda também dentro do iframe de
        // teste, que não pode ler `localStorage`; esse SecurityError é do teste, não do app.
        expect(api.errosDaPagina).toEqual([]);
        await page.getByRole('button', { name: `Assistir: ${youtube.titulo}` }).click();
        await expect(page.locator('iframe')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/abcDEF12345');
        expect(api.naoTratadas).toEqual([]);
      });
    }

    test('escuro: coleção aberta', async ({ page }) => {
      await tema(page, 'ESCURO');
      await simularApi(page, { ...(await sessaoDeAluno(page)), ...comunidade() });
      await page.goto(VIDEOS);
      await colecao(page, 'Base de força').click();
      await expect(titulos(page)).toHaveCount(3);
      await capturar(page, `colecoes-abertas-${largura}-escuro`);
    });
  });
}
