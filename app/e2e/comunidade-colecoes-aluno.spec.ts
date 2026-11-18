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
async function tema(page: Page, t: 'CLARO' | 'ESCURO') {
  await page.addInitScript(([id, tm]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: tm, contraste: 'PADRAO' })), [ALUNO.id, t]);
}
/** Os cabeçalhos das coleções, na ordem da tela ("Base de força, recolhido"). */
const cabecalhos = (page: Page) => page.getByRole('button', { name: /, (aberto|recolhido)$/ });
const colecao = (page: Page, nome: string) => page.getByRole('button', { name: new RegExp(`^${nome}, (aberto|recolhido)$`) });
const titulos = (page: Page) => page.getByRole('heading', { level: 2 });

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
      await expect.poll(() => cabecalhos(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))))
        .toEqual(['Mobilidade, recolhido', 'Base de força, recolhido', 'Sem coleção, recolhido']);
      await expect(page.getByText('Coleção sem vídeo')).toHaveCount(0);
      await expect(page.getByText('3 vídeos', { exact: true })).toBeVisible();
      // Fechadas, nenhum vídeo aparece.
      await expect(titulos(page)).toHaveCount(0);
      await capturar(page, `colecoes-fechadas-${largura}-claro`);

      await colecao(page, 'Base de força').click();
      await expect(colecao(page, 'Base de força')).toHaveAttribute('aria-expanded', 'true');
      await expect(titulos(page)).toHaveText(['1. Agachamento livre', '2. Remada curvada', '3. Supino com pausa']);
      await colecao(page, 'Sem coleção').click();
      await expect(page.getByRole('heading', { level: 2, name: 'Recado da equipe', exact: true })).toBeVisible();
      await capturar(page, `colecoes-abertas-${largura}-claro`);
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('busca procura em todas, abre as coleções com resultado sem renumerar e limpar volta ao de antes', async ({ page }) => {
      await simularApi(page, { ...(await sessaoDeAluno(page)), ...comunidade() });
      await page.goto(VIDEOS);
      await page.getByLabel('Buscar nos vídeos').fill('supino');
      // O 3º vídeo da coleção continua "3.", com o nome da coleção no cabeçalho do grupo.
      await expect(page.getByRole('heading', { level: 2 })).toHaveText(['3. Supino com pausa']);
      await expect(cabecalhos(page)).toHaveCount(1);
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
      await page.getByRole('button', { name: 'Ver 0 comentário(s) do vídeo Remada curvada' }).click();
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
      await expect(titulos(page)).toHaveText(AULAS.map((a) => a.titulo));
      await expect(page.getByText('Sem coleção')).toHaveCount(0);
      await expect(cabecalhos(page)).toHaveCount(0);
      await capturar(page, `colecoes-erro-${largura}`);

      falhar = false;
      await page.getByRole('button', { name: 'Tentar de novo' }).click();
      await expect(cabecalhos(page)).toHaveCount(3);
    });

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
