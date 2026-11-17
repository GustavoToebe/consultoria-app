import { expect, test, type Page } from '@playwright/test';

import type { ComentarioDoMural, PaginaDoMural, PostDoMural } from '../src/api/comunidadeTipos';
import { sessaoDeAluno } from './aluno';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Comunidade, C25 (capa do vídeo pelo link do YouTube), C36 (a equipe anexa fotos no mural) e a mensagem do filtro de
 * palavras nos campos de texto. API simulada nas rotas reais; só dados fictícios. O app nunca fala com o YouTube: o
 * botão só chama `POST /comunidade/capas/youtube`. Estes casos dependem das rotas novas da API e de `comFotos` ligado
 * para a equipe na tela do treinador; não rodam até a Onda 5.
 */
const YOUTUBE = 'https://youtu.be/abcdefghijk';
const POST: PostDoMural = {
  id: 'p1', autorId: 'u1', autorNome: 'Treinadora Teste', autorApelido: null, autorEhAluno: false, autorFotoUrl: null, texto: 'Semana de constância, time!',
  tipo: 'CONVERSA', videoUrl: null, capaId: null, enquete: null, fotos: [], respondida: false, fixado: false, criadoEm: '2026-10-19T12:00:00-03:00',
  reacoes: {}, minhasReacoes: [], totalComentarios: 0, podId: null, podNome: null,
};
const pagina = (...content: PostDoMural[]): PaginaDoMural => ({ content, totalElements: content.length });
const vazia: RespostasApi = {
  'GET /comunidade/configuracao': { corpo: { alunosPublicam: true, alunosAnexamFotos: false } },
  'GET /comunidade/mural': { corpo: pagina() },
  'GET /comunidade/aulas': { corpo: [] },
  'GET /comunidade/pods': { corpo: [] },
};
const PALAVRA = 'Sua publicação tem uma palavra não permitida.';

const foiPost = (p: { metodo: string; caminho: string }, caminho: string) => p.metodo === 'POST' && p.caminho === caminho;
const novaPublicacao = (page: Page) => page.getByRole('dialog', { name: 'Nova publicação' });
const novoAulao = (page: Page) => page.getByRole('dialog', { name: 'Novo vídeo' });

/** JPEG fictício gerado na página (quadrado liso), para o seletor de arquivo e para as miniaturas. */
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

const abrirTreinador = async (page: Page, respostas: RespostasApi) =>
  simularApi(page, { ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'COMUNIDADE_MODERAR'] })), ...respostas });

for (const largura of [390, 1280]) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test('vídeo: "Usar a capa do YouTube" só com link do YouTube; busca pela API, mostra a capa e salva com o capaId', async ({ page }) => {
      let jpeg: Buffer = Buffer.alloc(0);
      let soltar: () => void = () => {};
      const resposta = new Promise<void>((resolve) => { soltar = resolve; });
      const api = await abrirTreinador(page, {
        ...vazia,
        'POST /comunidade/capas/youtube': async (_p, route) => { await resposta; return json(route, { id: 'capa-yt' }); },
        'GET /comunidade/capas/{id}': (_p, route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: jpeg }),
        'POST /comunidade/aulas': { corpo: { id: 'novo' } },
      });
      // `api.pedidos` só vê a nossa API (onde `/comunidade/capas/youtube` é legítimo); host de fora é abortado sem registro.
      const hostsDeFora: string[] = [];
      page.on('request', (r) => {
        const url = new URL(r.url());
        if (url.protocol.startsWith('http') && url.hostname !== 'localhost') hostsDeFora.push(url.hostname);
      });
      await page.goto('/treinador/comunidade');
      jpeg = await jpegFicticio(page);
      await page.getByRole('button', { name: 'Novo vídeo' }).click();
      const folha = novoAulao(page);
      const botao = folha.getByRole('button', { name: 'Usar a capa do YouTube' });
      await expect(botao).toHaveCount(0);
      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill('https://video.exemplo.invalid/aula');
      await expect(botao).toHaveCount(0);
      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill(YOUTUBE);
      await expect(botao).toBeVisible();

      await botao.click();
      // Carregando: o botão fica desabilitado com o texto novo, e o pedido leva só o link.
      await expect(folha.getByRole('button', { name: 'Buscando a capa…' })).toBeDisabled();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/comunidade/capas/youtube'))?.corpo).toEqual({ videoUrl: YOUTUBE });
      soltar();
      await expect(folha.getByRole('img', { name: 'Capa do vídeo' })).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Usar a capa do YouTube' })).toHaveCount(0);
      await expect(folha.getByRole('button', { name: 'Remover capa' })).toBeVisible();

      await folha.getByRole('textbox', { name: 'Título' }).fill('Vídeo de teste');
      await folha.getByRole('button', { name: 'Publicar para o time' }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/comunidade/aulas'))?.corpo)
        .toEqual({ titulo: 'Vídeo de teste', videoUrl: YOUTUBE, capaId: 'capa-yt' });
      // O navegador nunca pede nada ao YouTube (a capa vem só da nossa API).
      expect(hostsDeFora.filter((h) => /youtube|ytimg/.test(h))).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('post de vídeo: o botão aparece com o link do YouTube e a capa vai no corpo junto com o link', async ({ page }) => {
      let jpeg: Buffer = Buffer.alloc(0);
      const api = await abrirTreinador(page, {
        ...vazia,
        'POST /comunidade/capas/youtube': { corpo: { id: 'capa-yt' } },
        'GET /comunidade/capas/{id}': (_p, route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: jpeg }),
        'POST /comunidade/mural': { corpo: { ...POST, id: 'novo' } },
      });
      await page.goto('/treinador/comunidade?aba=mural');
      jpeg = await jpegFicticio(page);
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      const folha = novaPublicacao(page);
      await folha.getByRole('radio', { name: 'Vídeo', exact: true }).click();
      await expect(folha.getByRole('button', { name: 'Usar a capa do YouTube' })).toHaveCount(0);
      await folha.getByRole('textbox', { name: 'Título do vídeo' }).fill('Vídeo de teste');
      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill(YOUTUBE);
      await folha.getByRole('button', { name: 'Usar a capa do YouTube' }).click();
      await expect(folha.getByRole('img', { name: 'Capa do vídeo' })).toBeVisible();
      await folha.getByRole('button', { name: /^Publicar/ }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/comunidade/mural'))?.corpo)
        .toEqual({ tipo: 'VIDEO', texto: 'Vídeo de teste', videoUrl: YOUTUBE, capaId: 'capa-yt' });
      expect(api.errosDaPagina).toEqual([]);
    });

    test('capa do YouTube: 503 mostra a mensagem da API com "Tente enviar a imagem" e 422 CAPA_INVALIDA vai ao campo', async ({ page }) => {
      let n = 0;
      const indisponivel = erroApi(503, 'Não foi possível buscar a capa agora.');
      const invalida = erroApi(422, 'Dados inválidos.', 'CAPA_INVALIDA', [{ field: 'videoUrl', message: 'Esse vídeo não tem capa disponível.' }]);
      await abrirTreinador(page, {
        ...vazia,
        'POST /comunidade/capas/youtube': (_p, route) => (++n === 1 ? json(route, indisponivel.corpo, indisponivel.status) : json(route, invalida.corpo, invalida.status)),
      });
      await page.goto('/treinador/comunidade');
      await page.getByRole('button', { name: 'Novo vídeo' }).click();
      const folha = novoAulao(page);
      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill(YOUTUBE);
      await folha.getByRole('button', { name: 'Usar a capa do YouTube' }).click();
      await expect(folha.getByText('Não foi possível buscar a capa agora. Tente enviar a imagem.')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Escolher capa' })).toBeEnabled();
      await folha.getByRole('button', { name: 'Usar a capa do YouTube' }).click();
      await expect(folha.getByText('Esse vídeo não tem capa disponível.')).toBeVisible();
      await expect(folha.getByRole('textbox', { name: 'Link do vídeo' })).toHaveValue(YOUTUBE);
      await expect(folha.getByRole('img', { name: 'Capa do vídeo' })).toHaveCount(0);
    });

    test('equipe: anexa até 4 fotos no mural, vê as miniaturas, remove a pendente e publica com os fotoIds', async ({ page }) => {
      let n = 0;
      let jpeg: Buffer = Buffer.alloc(0);
      const api = await abrirTreinador(page, {
        ...vazia,
        'POST /comunidade/mural/fotos': (_p, route) => json(route, { id: `f${++n}` }),
        'GET /comunidade/mural/fotos/{id}': (_p, route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: jpeg }),
        'DELETE /comunidade/mural/fotos/{id}': (_p, route) => route.fulfill({ status: 204 }),
        'POST /comunidade/mural': { corpo: { ...POST, id: 'novo' } },
      });
      await page.goto('/treinador/comunidade?aba=mural');
      jpeg = await jpegFicticio(page);
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      const folha = novaPublicacao(page);
      const anexar = async () => {
        const [seletor] = await Promise.all([page.waitForEvent('filechooser'), folha.getByRole('button', { name: 'Adicionar foto' }).click()]);
        await seletor.setFiles({ name: 'foto-ficticia.jpg', mimeType: 'image/jpeg', buffer: jpeg });
      };
      await anexar();
      await expect(folha.getByRole('button', { name: 'Remover a foto 1' })).toBeVisible();
      await anexar();
      await expect(folha.getByRole('button', { name: 'Remover a foto 2' })).toBeVisible();
      await folha.getByRole('button', { name: 'Remover a foto 1' }).click();
      await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'DELETE').map((p) => p.caminho)).toEqual(['/comunidade/mural/fotos/f1']);
      await expect(folha.getByRole('button', { name: 'Remover a foto 2' })).toHaveCount(0);
      await folha.getByRole('radio', { name: 'Aviso', exact: true }).click();
      await folha.getByRole('textbox', { name: 'Texto', exact: true }).fill('Aviso com foto');
      await folha.getByRole('button', { name: /^Publicar/ }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/comunidade/mural'))?.corpo).toEqual({ tipo: 'AVISO', texto: 'Aviso com foto', fotoIds: ['f2'] });
      // Só a rota da equipe: nada do aluno.
      expect(api.pedidos.some((p) => p.caminho.startsWith('/aluno/comunidade/mural/fotos'))).toBe(false);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('equipe: com 4 fotos o botão "Adicionar foto" trava com o motivo', async ({ page }) => {
      let n = 0;
      let jpeg: Buffer = Buffer.alloc(0);
      await abrirTreinador(page, {
        ...vazia,
        'POST /comunidade/mural/fotos': (_p, route) => json(route, { id: `f${++n}` }),
        'GET /comunidade/mural/fotos/{id}': (_p, route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: jpeg }),
      });
      await page.goto('/treinador/comunidade?aba=mural');
      jpeg = await jpegFicticio(page);
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      const folha = novaPublicacao(page);
      for (let i = 1; i <= 4; i++) {
        const [seletor] = await Promise.all([page.waitForEvent('filechooser'), folha.getByRole('button', { name: 'Adicionar foto' }).click()]);
        await seletor.setFiles({ name: 'foto-ficticia.jpg', mimeType: 'image/jpeg', buffer: jpeg });
        await expect(folha.getByRole('button', { name: `Remover a foto ${i}` })).toBeVisible();
      }
      await expect(folha.getByRole('button', { name: 'Adicionar foto' })).toBeDisabled();
      await expect(folha.getByText('Até 4 fotos por publicação.')).toBeVisible();
    });

    test('filtro: a mensagem do 422 aparece no campo de texto da publicação e o texto digitado fica', async ({ page }) => {
      const e = erroApi(422, 'Dados inválidos.', 'POST_INVALIDO', [{ field: 'texto', message: PALAVRA }]);
      await abrirTreinador(page, { ...vazia, 'POST /comunidade/mural': (_p, route) => json(route, e.corpo, e.status) });
      await page.goto('/treinador/comunidade?aba=mural');
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      const folha = novaPublicacao(page);
      const campo = folha.getByRole('textbox', { name: 'Texto', exact: true });
      await campo.fill('Texto fictício do teste');
      await folha.getByRole('button', { name: /^Publicar/ }).click();
      await expect(folha.getByText(PALAVRA)).toBeVisible();
      await expect(campo).toHaveValue('Texto fictício do teste');
      // O texto do usuário nunca é repetido na mensagem; editar o campo limpa o erro.
      await campo.fill('Texto fictício do teste, editado');
      await expect(folha.getByText(PALAVRA)).toHaveCount(0);
    });

    test('filtro: a mensagem do 422 aparece no campo do comentário e o texto fica', async ({ page }) => {
      const e = erroApi(422, 'Dados inválidos.', 'COMENTARIO_INVALIDO', [{ field: 'texto', message: PALAVRA }]);
      const comentarios: ComentarioDoMural[] = [];
      await simularApi(page, {
        ...(await sessaoDeAluno(page)),
        'GET /aluno/comunidade/configuracao': { corpo: { alunosPublicam: true, podeAnexarFoto: false } },
        'GET /aluno/comunidade/mural': { corpo: pagina(POST) },
        'GET /aluno/comunidade/aulas': { corpo: [] },
        'GET /aluno/comunidade/conquistas': { corpo: [] },
        'GET /aluno/comunidade/ranking': { corpo: { posicao: 1, treinosConcluidos: 1, pontuacao: 10, participantes: 2, nivel: 1, xp: 10, xpNoNivel: 10, faltam: 90 } },
        'GET /aluno/comunidade/mural/{id}/comentarios': { corpo: { itens: comentarios, total: 0 } },
        'POST /aluno/comunidade/mural/{id}/comentarios': (_p, route) => json(route, e.corpo, e.status),
      });
      await page.goto('/aluno/comunidade');
      await page.getByRole('button', { name: /comentário/ }).first().click();
      const folha = page.getByRole('dialog', { name: 'Comentários' });
      const campo = folha.getByRole('textbox', { name: 'Seu comentário' });
      await campo.fill('Comentário fictício');
      await folha.getByRole('button', { name: /^Comentar/ }).click();
      await expect(folha.getByText(PALAVRA)).toBeVisible();
      await expect(campo).toHaveValue('Comentário fictício');
    });
  });
}
