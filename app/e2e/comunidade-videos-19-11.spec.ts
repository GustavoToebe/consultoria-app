import { expect, test, type Page, type Route } from '@playwright/test';

import type { AulaDaComunidade, PlaylistDaComunidade } from '../src/api/comunidadeTipos';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso, type RespostasApi } from './api-falsa';

/**
 * Aba Vídeos do treinador em grade (D2 e D3 de 19/11, `docs/planos/comunidade-19-11.md`): uma seção por coleção com o
 * cabeçalho (nome, "N vídeos", "Adicionar vídeo", ⋯), a grade de 4, 3, 2 ou 1 coluna pela área ao lado do menu, o cartão
 * (capa com play e posição, título, descrição, comentários e ⋯), "Sem coleção" e "+ Nova coleção" no fim, e as coleções
 * criadas, renomeadas, ordenadas e excluídas na própria aba, sem folha. API simulada, só dados fictícios.
 */
const CAPTURAS = process.env.CAPTURAS_DIR;
async function capturar(page: Page, nome: string) {
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/${nome}.png`, fullPage: true });
}
async function tema(page: Page, t: string) {
  await page.addInitScript(([id, tm]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: tm, contraste: 'PADRAO' })), [TREINADOR.id, t]);
}

const AULA: AulaDaComunidade = {
  id: 'a1', titulo: 'Vídeo de técnica', descricao: 'Pauta do vídeo de teste.', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', capaId: null,
  playlistId: 'p1', ordem: 0, publicada: true, criadaEm: '2026-10-19T12:00:00-03:00', totalComentarios: 0,
};
const TECNICA: PlaylistDaComunidade = { id: 'p1', nome: 'Técnica', ordem: 0, totalAulas: 0 };
const ALIMENTACAO: PlaylistDaComunidade = { id: 'p2', nome: 'Alimentação', ordem: 1, totalAulas: 0 };
const MOBILIDADE: PlaylistDaComunidade = { id: 'p3', nome: 'Mobilidade', ordem: 2, totalAulas: 0 };

/** Técnica com 3 (um rascunho), Alimentação com 1 (descrição igual ao título) e um sem coleção; Mobilidade vazia. */
const AULAS: AulaDaComunidade[] = [
  { ...AULA, id: 'a1', titulo: 'Vídeo de técnica', playlistId: 'p1', ordem: 0, totalComentarios: 1 },
  { ...AULA, id: 'a2', titulo: 'Vídeo de execução com um título bem comprido para cortar em duas linhas no cartão da grade', descricao: 'Amplitude e cadência.', playlistId: 'p1', ordem: 1, totalComentarios: 12 },
  { ...AULA, id: 'a3', titulo: 'Vídeo de rascunho', descricao: null, playlistId: 'p1', ordem: 2, publicada: false },
  { ...AULA, id: 'a4', titulo: 'Proteína no café', descricao: '  proteína   NO café ', videoUrl: 'https://exemplo.test/video', playlistId: 'p2', ordem: 0 },
  { ...AULA, id: 'a5', titulo: 'Boas-vindas', descricao: 'Como o time funciona.', playlistId: null, ordem: 0 },
];

/** Coleções e vídeos com estado, como a API (V088): ordem pede a lista inteira; excluir solta os vídeos ("Sem coleção", ordem 0). */
function comEstado(playlists: PlaylistDaComunidade[], aulas: AulaDaComunidade[]) {
  const estado = { playlists: playlists.map((p) => ({ ...p })), aulas: aulas.map((a) => ({ ...a })), criadas: 0 };
  const erro = (route: Route, status: number, codigo: string) => { const e = erroApi(status, 'Recusado.', codigo); return json(route, e.corpo, e.status); };
  const mesmos = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join();
  const emUso = (nome: string, menos?: string) => estado.playlists.some((x) => x.id !== menos && x.nome.toLowerCase() === nome.toLowerCase());
  const rotas: RespostasApi = {
    'GET /comunidade/playlists': (_p, route) => json(route, estado.playlists.map((p) => ({ ...p, totalAulas: estado.aulas.filter((a) => a.playlistId === p.id).length }))),
    'GET /comunidade/aulas': (_p, route) => json(route, estado.aulas),
    'POST /comunidade/playlists': (p, route) => {
      const { nome } = p.corpo as { nome: string };
      if (emUso(nome)) return erro(route, 409, 'PLAYLIST_NOME_EM_USO');
      const nova = { id: `n${++estado.criadas}`, nome, ordem: estado.playlists.length, totalAulas: 0 };
      estado.playlists.push(nova);
      return json(route, nova);
    },
    'PUT /comunidade/playlists/ordem': (p, route) => {
      const { ids } = p.corpo as { ids: string[] };
      if (!mesmos(ids, estado.playlists.map((x) => x.id))) return erro(route, 409, 'CONFLITO_EDICAO');
      estado.playlists = estado.playlists.map((x) => ({ ...x, ordem: ids.indexOf(x.id) }));
      return route.fulfill({ status: 204 });
    },
    'PUT /comunidade/playlists/{id}': (p, route) => {
      const id = p.caminho.split('/')[3];
      const { nome } = p.corpo as { nome: string };
      if (emUso(nome, id)) return erro(route, 409, 'PLAYLIST_NOME_EM_USO');
      estado.playlists = estado.playlists.map((x) => (x.id === id ? { ...x, nome } : x));
      return json(route, estado.playlists.find((x) => x.id === id));
    },
    'DELETE /comunidade/playlists/{id}': (p, route) => {
      const id = p.caminho.split('/')[3];
      estado.playlists = estado.playlists.filter((x) => x.id !== id);
      estado.aulas = estado.aulas.map((a) => (a.playlistId === id ? { ...a, playlistId: null, ordem: 0 } : a));
      return route.fulfill({ status: 204 });
    },
    'PUT /comunidade/playlists/{id}/aulas/ordem': (p, route) => {
      const id = p.caminho.split('/')[3];
      const { ids } = p.corpo as { ids: string[] };
      if (!mesmos(ids, estado.aulas.filter((a) => a.playlistId === id).map((a) => a.id))) return erro(route, 409, 'CONFLITO_EDICAO');
      estado.aulas = estado.aulas.map((a) => (ids.includes(a.id) ? { ...a, ordem: ids.indexOf(a.id) } : a));
      return route.fulfill({ status: 204 });
    },
    'PUT /comunidade/aulas/playlist': (p, route) => {
      const { aulaIds, playlistId } = p.corpo as { aulaIds: string[]; playlistId: string | null };
      for (const id of aulaIds) {
        const fim = Math.max(-1, ...estado.aulas.filter((a) => playlistId !== null && a.playlistId === playlistId).map((a) => a.ordem)) + 1;
        estado.aulas = estado.aulas.map((a) => (a.id === id ? { ...a, playlistId, ordem: playlistId ? fim : 0 } : a));
      }
      return route.fulfill({ status: 204 });
    },
  };
  return { estado, rotas };
}

const MODERAR = [...PERMISSOES_TREINADOR, 'TREINO_LER', 'COMUNIDADE_MODERAR'];
const BASE: RespostasApi = { 'GET /comunidade/pods': { corpo: [] }, 'GET /comunidade/configuracao': { corpo: { alunosPublicam: true, alunosAnexamFotos: false } } };
async function abrir(page: Page, rotas: RespostasApi, { t = 'CLARO', permissoes = MODERAR }: { t?: string; permissoes?: string[] } = {}) {
  await tema(page, t);
  const api = await simularApi(page, { ...(await sessao(page, TREINADOR, { permissoes })), ...BASE, ...rotas });
  await page.goto('/treinador/comunidade');
  return api;
}
const pedidos = (api: { pedidos: PedidoFalso[] }, metodo: string, caminho: string) => api.pedidos.filter((p) => p.metodo === metodo && p.caminho === caminho);
const secoes = (page: Page) => page.getByRole('heading', { level: 2 }).allInnerTexts();
const semRolagemHorizontal = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const acoesDoVideo = (page: Page) => page.getByRole('dialog', { name: 'Ações do vídeo' });

/** Colunas da grade da primeira seção: quantos cartões ficam na mesma altura que o primeiro. */
async function colunasDaPrimeiraGrade(page: Page) {
  const caixas = await page.getByRole('heading', { level: 3 }).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
  return caixas.filter((y) => Math.abs(y - caixas[0]) < 2).length;
}

for (const [largura, altura, colunas] of [[390, 900, 1], [1280, 900, 3], [1920, 1080, 4]] as const) {
  test.describe(`vídeos em grade (19/11) em ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: altura } });

    for (const [nome, t] of [['claro', 'CLARO'], ['escuro', 'ESCURO'], ['areia', 'AREIA']] as const) {
      test(`seções na ordem do treinador, "Sem coleção" e "+ Nova coleção" no fim; ${colunas} coluna(s), tema ${nome}`, async ({ page }) => {
        const { rotas } = comEstado([ALIMENTACAO, MOBILIDADE, TECNICA], [...AULAS,
          ...[6, 7, 8].map((n) => ({ ...AULA, id: `a${n}`, titulo: `Vídeo extra ${n}`, playlistId: 'p1', ordem: n }))]);
        const api = await abrir(page, rotas, { t });
        await expect(page.getByRole('heading', { level: 2, name: 'Técnica' })).toBeVisible();
        expect(await secoes(page)).toEqual(['Técnica', 'Alimentação', 'Mobilidade', 'Sem coleção']);
        await expect(page.getByText('O aluno vê as coleções nesta ordem, com os vídeos numerados. Coleção sem vídeo publicado não aparece para ele.')).toBeVisible();
        // O botão "Coleções" do topo saiu (D3); só o "Novo vídeo" fica no cabeçalho.
        await expect(page.getByRole('button', { name: 'Coleções', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Novo vídeo' })).toBeVisible();
        await expect(page.getByText('6 vídeos', { exact: true })).toBeVisible();
        await expect.poll(() => colunasDaPrimeiraGrade(page)).toBe(colunas);
        // Cartão: play com o título, posição no canto, comentários em texto comum; o "Abrir no YouTube" saiu do cartão.
        await expect(page.getByRole('button', { name: 'Assistir: Vídeo de técnica' })).toBeVisible();
        await expect(page.getByLabel('Posição 1').first()).toBeVisible();
        await expect(page.getByRole('button', { name: 'Ver comentários do vídeo Vídeo de técnica: 1 comentário' })).toBeVisible();
        await expect(page.getByRole('button', { name: /Ver comentários do vídeo Vídeo de execução.*: 12 comentários$/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /^Abrir no YouTube/ })).toHaveCount(0);
        await expect(page.getByText('Não publicado', { exact: true })).toBeVisible();
        // Descrição igual ao título (sem caixa e espaços) não aparece; título longo inteiro na dica e no nome.
        await expect(page.getByText(/proteína\s+NO café/)).toHaveCount(0);
        const longo = page.getByRole('heading', { level: 3, name: /^Vídeo de execução com um título bem comprido/ });
        await expect(longo).toHaveText(AULAS[1].titulo);
        await expect(page.locator(`[title="${AULAS[1].titulo}"]`)).toHaveCount(1);
        // Coleção vazia: o texto e o "Adicionar vídeo" no lugar de um cartão; "Sem coleção" sem ⋯ nem "Adicionar".
        await expect(page.getByText('Nenhum vídeo nesta coleção', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Adicionar vídeo à coleção Mobilidade' })).toHaveCount(1);
        await expect(page.getByRole('button', { name: /Ações da coleção Sem coleção/ })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Nova coleção' })).toBeVisible();
        expect(await semRolagemHorizontal(page)).toBe(true);
        await capturar(page, `videos-grade-${largura}-${nome}`);
        // O fim da aba: "Sem coleção" e "+ Nova coleção" (a rolagem é da `Tela`, não do documento: a captura é da janela).
        await page.getByRole('button', { name: 'Nova coleção' }).scrollIntoViewIfNeeded();
        if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/videos-grade-fim-${largura}-${nome}.png` });
        expect(api.errosDaPagina).toEqual([]);
      });
    }

    for (const [nomeTema, t] of [['claro', 'CLARO'], ['escuro', 'ESCURO']] as const) {
      test(`um vídeo só fica à esquerda, com a largura de uma coluna; em 1280, duas coleções de 1 vídeo cabem sem rolar (${nomeTema})`, async ({ page }) => {
        // Sem descrição: cada linha de descrição soma 24 px ao cartão (a medida vai na anotação do teste).
        const { rotas } = comEstado([TECNICA, ALIMENTACAO], [{ ...AULAS[0], descricao: null }, AULAS[3]]);
        await abrir(page, rotas, { t });
        const ultimo = page.getByRole('button', { name: /^Ver comentários do vídeo Proteína no café/ });
        await expect(ultimo).toBeVisible();
        const titulo = (await page.getByRole('heading', { level: 1, name: 'Comunidade' }).boundingBox())!;
        const novo = (await page.getByRole('button', { name: 'Novo vídeo' }).boundingBox())!;
        const capa = (await page.getByRole('button', { name: 'Assistir: Vídeo de técnica' }).boundingBox())!;
        const area = novo.x + novo.width - titulo.x;
        expect(capa.x - titulo.x).toBeLessThanOrEqual(4);
        if (colunas > 1) expect(capa.width).toBeLessThanOrEqual(area / colunas + 2);
        if (largura >= 1280) {
          const fim = (await ultimo.boundingBox())!;
          test.info().annotations.push({ type: 'fim do segundo cartão', description: `${Math.round(fim.y + fim.height)} px de ${altura}` });
          expect(fim.y + fim.height).toBeLessThanOrEqual(altura);
        }
        await capturar(page, `videos-um-por-colecao-${largura}-${nomeTema}`);
      });

      test(`⋯ do vídeo: Abrir no YouTube, Mover para baixo (PUT com a coleção inteira) e Mover para outra coleção (${nomeTema})`, async ({ page, context }) => {
        await context.route('https://www.youtube.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>YouTube de teste</p>' }));
        const { estado, rotas } = comEstado([TECNICA, ALIMENTACAO], AULAS);
        const api = await abrir(page, rotas, { t });
        await page.getByRole('button', { name: 'Ações do vídeo Vídeo de técnica' }).click();
        const menu = acoesDoVideo(page);
        for (const n of ['Abrir no YouTube', 'Editar vídeo', 'Mover para baixo', 'Mover para outra coleção', 'Excluir vídeo']) {
          await expect(menu.getByRole('button', { name: new RegExp(`^${n}`) })).toBeVisible();
        }
        // Primeiro da coleção: não sobe.
        await expect(menu.getByRole('button', { name: /^Mover para cima/ })).toHaveCount(0);
        await capturar(page, `videos-menu-do-video-${largura}-${nomeTema}`);
        const [popup] = await Promise.all([page.waitForEvent('popup'), menu.getByRole('button', { name: /^Abrir no YouTube/ }).click()]);
        expect(popup.url()).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        await popup.close();

        await page.getByRole('button', { name: 'Ações do vídeo Vídeo de técnica' }).click();
        await acoesDoVideo(page).getByRole('button', { name: /^Mover para baixo/ }).click();
        await expect.poll(() => pedidos(api, 'PUT', '/comunidade/playlists/p1/aulas/ordem').length).toBe(1);
        expect(pedidos(api, 'PUT', '/comunidade/playlists/p1/aulas/ordem')[0].corpo).toEqual({ ids: ['a2', 'a1', 'a3'] });
        // O cartão andou e o foco volta ao ⋯ dele.
        await expect(page.getByRole('button', { name: 'Ações do vídeo Vídeo de técnica' })).toBeFocused();
        const titulos = await page.getByRole('heading', { level: 3 }).allInnerTexts();
        expect(titulos.slice(0, 2)).toEqual([AULAS[1].titulo, 'Vídeo de técnica']);

        await page.getByRole('button', { name: 'Ações do vídeo Vídeo de técnica' }).click();
        await acoesDoVideo(page).getByRole('button', { name: /^Mover para outra coleção/ }).click();
        const destino = page.getByRole('dialog', { name: 'Mover “Vídeo de técnica”' });
        await expect(destino.getByRole('button', { name: /^Técnica/ })).toHaveCount(0);
        await destino.getByRole('button', { name: /^Alimentação/ }).click();
        await expect.poll(() => pedidos(api, 'PUT', '/comunidade/aulas/playlist').length).toBe(1);
        expect(pedidos(api, 'PUT', '/comunidade/aulas/playlist')[0].corpo).toEqual({ aulaIds: ['a1'], playlistId: 'p2' });
        await expect(page.getByText('“Vídeo de técnica” foi para “Alimentação”.')).toBeVisible();
        await expect.poll(() => estado.aulas.find((a) => a.id === 'a1')?.playlistId).toBe('p2');
        await expect(page.getByText('2 vídeos', { exact: true })).toHaveCount(2);
        expect(api.errosDaPagina).toEqual([]);
      });

      test(`coleção na própria aba: cria (nome repetido no campo), renomeia no título, move e exclui com confirmação (${nomeTema})`, async ({ page }) => {
        const { estado, rotas } = comEstado([TECNICA, ALIMENTACAO], AULAS);
        const api = await abrir(page, rotas, { t });
        // Criar: o campo abre no fim, sem folha; nome repetido fica no campo.
        await page.getByRole('button', { name: 'Nova coleção' }).click();
        const campo = page.getByRole('textbox', { name: 'Nome da nova coleção' });
        await expect(campo).toBeFocused();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await campo.fill('técnica');
        await page.getByRole('button', { name: 'Criar coleção' }).click();
        await expect(page.getByText('Já existe uma coleção com esse nome. Escolha outro.')).toBeVisible();
        await capturar(page, `videos-nova-colecao-erro-${largura}-${nomeTema}`);
        await campo.fill('Mobilidade');
        await campo.press('Enter');
        await expect(page.getByRole('heading', { level: 2, name: 'Mobilidade' })).toBeVisible();
        expect(await secoes(page)).toEqual(['Técnica', 'Alimentação', 'Mobilidade', 'Sem coleção']);
        await expect(page.getByRole('button', { name: 'Nova coleção' })).toBeVisible();

        // Renomear no título: o campo toma o lugar do nome; Enter salva e o foco volta ao ⋯.
        await page.getByRole('button', { name: 'Ações da coleção Alimentação' }).click();
        const menu = page.getByRole('dialog', { name: 'Ações da coleção “Alimentação”' });
        for (const n of ['Renomear', 'Mover para cima', 'Mover para baixo', 'Excluir coleção']) await expect(menu.getByRole('button', { name: new RegExp(`^${n}`) })).toBeVisible();
        await capturar(page, `videos-menu-da-colecao-${largura}-${nomeTema}`);
        await menu.getByRole('button', { name: /^Renomear/ }).click();
        const nome = page.getByRole('textbox', { name: 'Nome da coleção Alimentação' });
        await expect(nome).toBeFocused();
        await nome.fill('Nutrição');
        await nome.press('Enter');
        await expect(page.getByRole('heading', { level: 2, name: 'Nutrição' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Ações da coleção Nutrição' })).toBeFocused();
        expect(pedidos(api, 'PUT', '/comunidade/playlists/p2')[0].corpo).toEqual({ nome: 'Nutrição' });

        // Mover para cima: a ordem vai inteira.
        await page.getByRole('button', { name: 'Ações da coleção Nutrição' }).click();
        await page.getByRole('dialog', { name: 'Ações da coleção “Nutrição”' }).getByRole('button', { name: /^Mover para cima/ }).click();
        await expect.poll(() => pedidos(api, 'PUT', '/comunidade/playlists/ordem').length).toBe(1);
        expect(pedidos(api, 'PUT', '/comunidade/playlists/ordem')[0].corpo).toEqual({ ids: ['p2', 'p1', 'n1'] });
        await expect.poll(() => secoes(page)).toEqual(['Nutrição', 'Técnica', 'Mobilidade', 'Sem coleção']);

        // Excluir: perigo com texto e confirmação; Cancelar não apaga; os vídeos passam para "Sem coleção".
        await page.getByRole('button', { name: 'Ações da coleção Técnica' }).click();
        await page.getByRole('dialog', { name: 'Ações da coleção “Técnica”' }).getByRole('button', { name: /^Excluir coleção/ }).click();
        const painel = page.getByRole('alertdialog', { name: 'Excluir a coleção “Técnica”?' });
        await expect(painel.getByText('Os 3 vídeos dela passam para “Sem coleção”; nenhum vídeo é apagado. Os publicados continuam para o aluno, em “Sem coleção”, sem a numeração da coleção. Essa ação não pode ser desfeita.')).toBeVisible();
        await capturar(page, `videos-excluir-colecao-${largura}-${nomeTema}`);
        await painel.getByRole('button', { name: 'Cancelar' }).click();
        expect(pedidos(api, 'DELETE', '/comunidade/playlists/p1')).toHaveLength(0);
        await page.getByRole('button', { name: 'Ações da coleção Técnica' }).click();
        await page.getByRole('dialog', { name: 'Ações da coleção “Técnica”' }).getByRole('button', { name: /^Excluir coleção/ }).click();
        await page.getByRole('alertdialog', { name: 'Excluir a coleção “Técnica”?' }).getByRole('button', { name: 'Excluir coleção' }).click();
        await expect(page.getByText('Coleção “Técnica” excluída.')).toBeVisible();
        await expect.poll(() => secoes(page)).toEqual(['Nutrição', 'Mobilidade', 'Sem coleção']);
        await expect(page.getByText('4 vídeos', { exact: true })).toBeVisible();
        expect(estado.aulas.filter((a) => a.playlistId === null)).toHaveLength(4);
        expect(api.errosDaPagina).toEqual([]);
      });

      test(`vazio: sem vídeo nem coleção diz o próximo passo; "Adicionar vídeo" da coleção vazia abre o Novo vídeo nela (${nomeTema})`, async ({ page }) => {
        const { rotas } = comEstado([], []);
        await abrir(page, rotas, { t });
        await expect(page.getByText('Nenhum vídeo nem coleção ainda. Publique o primeiro em “Novo vídeo” ou crie uma coleção para organizar.')).toBeVisible();
        await capturar(page, `videos-vazio-${largura}-${nomeTema}`);
        await page.getByRole('button', { name: 'Nova coleção' }).click();
        await page.getByRole('textbox', { name: 'Nome da nova coleção' }).fill('Técnica');
        await page.getByRole('button', { name: 'Criar coleção' }).click();
        await expect(page.getByRole('heading', { level: 2, name: 'Técnica' })).toBeVisible();
        await expect(page.getByText('Nenhum vídeo nesta coleção', { exact: true })).toBeVisible();
        await capturar(page, `videos-colecao-vazia-${largura}-${nomeTema}`);
        await page.getByRole('button', { name: 'Adicionar vídeo à coleção Técnica' }).click();
        const folha = page.getByRole('dialog', { name: 'Novo vídeo' });
        await expect(folha).toBeVisible();
        await expect(folha.getByRole('button', { name: 'Coleção: Técnica. Escolher.' })).toBeVisible();
      });

      test(`erro ao carregar os vídeos: mensagem com "Tentar de novo", que busca de novo (${nomeTema})`, async ({ page }) => {
        let falhar = true;
        const { rotas } = comEstado([TECNICA], AULAS);
        const api = await abrir(page, {
          ...rotas,
          'GET /comunidade/aulas': (p, route) => {
            if (falhar) { const e = erroApi(503, 'Serviço indisponível no momento.', 'INDISPONIVEL'); return json(route, e.corpo, e.status); }
            return (rotas['GET /comunidade/aulas'] as (p: PedidoFalso, r: Route) => Promise<void>)(p, route);
          },
        }, { t });
        const tentar = page.getByRole('button', { name: 'Tentar de novo' });
        await expect(tentar).toBeVisible();
        await expect(page.getByRole('heading', { level: 2, name: 'Técnica' })).toHaveCount(0);
        await capturar(page, `videos-erro-${largura}-${nomeTema}`);
        falhar = false;
        await tentar.click();
        await expect(page.getByRole('heading', { level: 2, name: 'Técnica' })).toBeVisible();
        expect(pedidos(api, 'GET', '/comunidade/aulas').length).toBeGreaterThanOrEqual(2);
      });
    }

    test('"Nova coleção" e renomear com nome digitado perguntam "Sair sem salvar?" ao cancelar (D1)', async ({ page }) => {
      const { rotas } = comEstado([TECNICA], AULAS);
      const api = await abrir(page, rotas);
      await page.getByRole('button', { name: 'Nova coleção' }).click();
      await page.getByRole('textbox', { name: 'Nome da nova coleção' }).fill('Mobilidade');
      await page.getByRole('button', { name: 'Cancelar' }).click();
      const aviso = page.getByRole('alertdialog', { name: 'Sair sem salvar?' });
      await expect(aviso).toBeVisible();
      await aviso.getByRole('button', { name: 'Continuar editando' }).click();
      await expect(page.getByRole('textbox', { name: 'Nome da nova coleção' })).toHaveValue('Mobilidade');
      await page.getByRole('button', { name: 'Cancelar' }).click();
      await aviso.getByRole('button', { name: 'Sair sem salvar' }).click();
      await expect(page.getByRole('textbox', { name: 'Nome da nova coleção' })).toHaveCount(0);
      // Sem nada digitado fecha na hora.
      await page.getByRole('button', { name: 'Nova coleção' }).click();
      await page.getByRole('button', { name: 'Cancelar' }).click();
      await expect(aviso).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Nova coleção' })).toBeVisible();
      // Renomear: com outro nome pergunta; sair volta ao título de antes e o foco ao ⋯.
      await page.getByRole('button', { name: 'Ações da coleção Técnica' }).click();
      await page.getByRole('dialog', { name: 'Ações da coleção “Técnica”' }).getByRole('button', { name: /^Renomear/ }).click();
      await page.getByRole('textbox', { name: 'Nome da coleção Técnica' }).fill('Técnica nova');
      await page.getByRole('button', { name: 'Cancelar' }).click();
      await aviso.getByRole('button', { name: 'Sair sem salvar' }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Técnica' })).toBeVisible();
      expect(pedidos(api, 'POST', '/comunidade/playlists')).toHaveLength(0);
      expect(pedidos(api, 'PUT', '/comunidade/playlists/p1')).toHaveLength(0);
    });

    test('sem conexão: os vídeos não carregam, a mensagem diz e "Tentar de novo" busca quando a rede volta', async ({ page }) => {
      let semRede = true;
      const { rotas } = comEstado([TECNICA], AULAS);
      await abrir(page, {
        ...rotas,
        'GET /comunidade/aulas': (p, route) => (semRede ? route.abort('internetdisconnected')
          : (rotas['GET /comunidade/aulas'] as (p: PedidoFalso, r: Route) => Promise<void>)(p, route)),
      });
      const tentar = page.getByRole('button', { name: 'Tentar de novo' });
      await expect(tentar).toBeVisible();
      await expect(page.getByText(/conex/i).first()).toBeVisible();
      await capturar(page, `videos-sem-conexao-${largura}`);
      semRede = false;
      await tentar.click();
      await expect(page.getByRole('heading', { level: 2, name: 'Técnica' })).toBeVisible();
    });

    test('só leitura (sem COMUNIDADE_MODERAR): seções, sem ⋯ do vídeo; sem criar, adicionar, arrastar nem selecionar', async ({ page }) => {
      const { rotas } = comEstado([TECNICA, MOBILIDADE], AULAS);
      await abrir(page, rotas, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER'] });
      await expect(page.getByRole('heading', { level: 2, name: 'Técnica' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Nova coleção' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Adicionar vídeo/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Ações da coleção/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Selecionar' })).toHaveCount(0);
      await expect(page.getByTestId('alca-de-arraste')).toHaveCount(0);
      // Sem COMUNIDADE_MODERAR o cartão não tem ⋯ (a capa continua tocando o vídeo).
      await expect(page.getByRole('button', { name: /^Ações do vídeo/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Assistir: Vídeo de técnica/ })).toBeVisible();
    });
  });
}

test.describe('vídeos em grade (19/11): arrastar no PC', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test('arrastar o cartão pela alça manda a ordem nova da coleção, e o ⋯ continua como alternativa', async ({ page }) => {
    const { rotas } = comEstado([TECNICA, ALIMENTACAO], AULAS);
    const api = await abrir(page, rotas);
    await expect(page.getByRole('heading', { level: 2, name: 'Técnica' })).toBeVisible();
    // A primeira alça é a da seção "Técnica"; as dos cartões dela vêm logo depois, na ordem da tela.
    const alcas = page.getByTestId('alca-de-arraste');
    const doPrimeiroCartao = 1;
    const de = (await alcas.nth(doPrimeiroCartao).boundingBox())!;
    const para = (await page.getByRole('button', { name: 'Assistir: Vídeo de rascunho' }).boundingBox())!;
    await page.mouse.move(de.x + de.width / 2, de.y + de.height / 2);
    await page.mouse.down();
    await page.mouse.move(de.x + 10, de.y + 10, { steps: 4 });
    await page.mouse.move(para.x + para.width - 4, para.y + para.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect.poll(() => pedidos(api, 'PUT', '/comunidade/playlists/p1/aulas/ordem').length).toBe(1);
    expect(pedidos(api, 'PUT', '/comunidade/playlists/p1/aulas/ordem')[0].corpo).toEqual({ ids: ['a2', 'a3', 'a1'] });
    await expect(page.getByText('Ordem alterada.')).toBeVisible();
  });
});
