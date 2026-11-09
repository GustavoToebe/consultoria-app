import { expect, test, type Page } from '@playwright/test';

import type { AulaDaComunidade, ConquistaDoAluno, PaginaDoMural, PosicaoNoRanking, PostDoMural } from '../src/api/comunidadeTipos';
import { sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Comunidade do aluno e do treinador, com a API simulada nas rotas e nos formatos reais (`/aluno/comunidade/{aulas, mural,
 * mural/{id}/reacoes, conquistas, ranking}` e `/comunidade/{aulas, mural}`). Só dados fictícios. O erro da API chega à tela
 * como erro de verdade, com "Tentar de novo": o cliente não troca falha por dado de exemplo.
 */
const CURTIDA = '❤️';
const POST: PostDoMural = {
  id: 'p1', autorId: 'u1', autorNome: 'Treinadora Teste', autorFotoUrl: null, texto: 'Semana de constância, time!', imagemUrl: null,
  fixado: true, criadoEm: '2026-10-19T12:00:00-03:00', reacoes: { [CURTIDA]: 2, '🔥': 5 }, minhasReacoes: [], totalComentarios: 4,
};
const POST_CURTIDO: PostDoMural = {
  ...POST, id: 'p2', autorId: 'u2', autorNome: 'Aluno Fictício', texto: 'Treino feito.', fixado: false,
  reacoes: { [CURTIDA]: 1 }, minhasReacoes: [CURTIDA], totalComentarios: 0,
};
const pagina = (...content: PostDoMural[]): PaginaDoMural => ({ content, totalElements: content.length });
const AULA: AulaDaComunidade = {
  id: 'a1', titulo: 'Aulão de técnica', descricao: 'Pauta do aulão de teste.', videoUrl: 'https://exemplo.test/video', miniaturaUrl: null,
  categoria: 'Técnica', ordem: 0, publicada: true, criadaEm: '2026-10-19T12:00:00-03:00', totalComentarios: 0,
};
const CONQUISTAS: ConquistaDoAluno[] = [
  { id: 'c1', tipo: 'PRIMEIRO_TREINO', titulo: 'Primeiro treino', descricao: 'Concluiu o primeiro treino.', icone: 'award', conquistadaEm: '2026-10-19T12:00:00-03:00' },
];
const RANKING: PosicaoNoRanking = { posicao: 2, treinosConcluidos: 8, pontuacao: 80, participantes: 12 };

const cheia: RespostasApi = {
  'GET /aluno/comunidade/mural': { corpo: pagina(POST, POST_CURTIDO) },
  'GET /aluno/comunidade/aulas': { corpo: [AULA] },
  'GET /aluno/comunidade/conquistas': { corpo: CONQUISTAS },
  'GET /aluno/comunidade/ranking': { corpo: RANKING },
  'POST /aluno/comunidade/mural/{id}/reacoes': { status: 204 },
  'GET /comunidade/mural': { corpo: pagina(POST, POST_CURTIDO) },
  'GET /comunidade/aulas': { corpo: [AULA] },
};
const vazia: RespostasApi = {
  'GET /aluno/comunidade/mural': { corpo: pagina() },
  'GET /aluno/comunidade/aulas': { corpo: [] },
  'GET /aluno/comunidade/conquistas': { corpo: [] },
  'GET /aluno/comunidade/ranking': { corpo: RANKING },
  'GET /comunidade/mural': { corpo: pagina() },
  'GET /comunidade/aulas': { corpo: [] },
};

const CAPTURAS = process.env.CAPTURAS_DIR;
async function capturar(page: Page, nome: string) {
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/${nome}.png`, fullPage: true });
}

async function tema(page: Page, usuarioId: string, t: string, contraste = 'PADRAO') {
  await page.addInitScript(([id, tm, c]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: tm, contraste: c })), [usuarioId, t, contraste]);
}

const TEMAS = [['claro', 'CLARO', 'PADRAO'], ['escuro', 'ESCURO', 'PADRAO'], ['areia', 'AREIA', 'PADRAO'], ['contraste', 'CLARO', 'ALTO']] as const;

const foiPost = (p: { metodo: string; caminho: string }, caminho: string) => p.metodo === 'POST' && p.caminho === caminho;

for (const largura of [390, 1280]) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    test('aluno: mural, aulões, conquistas e a própria posição; um h1 e selos neutros', async ({ page }) => {
      await tema(page, ALUNO.id, 'CLARO');
      const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...cheia });
      await page.goto('/aluno/comunidade');
      await expect(page.getByRole('heading', { level: 1, name: 'Comunidade' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByText('Semana de constância, time!')).toBeVisible();
      await expect(page.getByText('Fixado', { exact: true })).toBeVisible();
      // Só a curtida conta: as outras reações (🔥) não entram no número.
      await expect(page.getByText('2 curtida(s)')).toBeVisible();
      await expect(page.getByText('4 comentário(s)')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Desfazer curtida' })).toBeVisible();
      await capturar(page, `aluno-mural-${largura}`);

      await page.getByRole('button', { name: 'Curtir' }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/aluno/comunidade/mural/p1/reacoes'))?.corpo).toEqual({ emoji: CURTIDA });

      await page.getByRole('tab', { name: 'Aulões' }).click();
      await expect(page.getByText('Pauta do aulão de teste.')).toBeVisible();
      await expect(page.getByText('Técnica', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Assistir ao aulão' })).toBeVisible();

      await page.getByRole('tab', { name: 'Conquistas' }).click();
      await expect(page.getByText('Conquistada', { exact: true })).toBeVisible();
      await expect(page.getByText('2º de 12 participantes')).toBeVisible();
      await expect(page.getByText('8 treino(s) concluído(s) · 80 pts')).toBeVisible();
      await capturar(page, `aluno-conquistas-${largura}`);
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: publicar fica desabilitado com motivo até escrever e envia só o texto', async ({ page }) => {
      const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...vazia, 'POST /aluno/comunidade/mural': { corpo: { ...POST, id: 'novo', texto: 'Oi, time' } } });
      await page.goto('/aluno/comunidade');
      const publicar = page.getByRole('button', { name: /^Publicar/ });
      await expect(publicar).toBeDisabled();
      await expect(page.getByText('Escreva a mensagem.')).toBeVisible();
      await page.getByRole('textbox', { name: 'Mensagem para o time' }).fill('Oi, time');
      await expect(publicar).toBeEnabled();
      await publicar.click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/aluno/comunidade/mural'))?.corpo).toEqual({ texto: 'Oi, time' });
    });

    test('aluno: vindo do "Bom trabalho!", a mensagem vem escrita e a aba muda sem perder o rascunho', async ({ page }) => {
      const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...vazia, 'POST /aluno/comunidade/mural': { corpo: { ...POST, id: 'novo' } } });
      await page.goto('/aluno/comunidade?compartilharTreino=true&tituloTreino=Treino%20A&dataTreino=2026-10-19');
      const mensagem = page.getByRole('textbox', { name: 'Mensagem para o time' });
      await expect(mensagem).toHaveValue('Acabei de finalizar meu Treino A!');
      // O mural só guarda texto: não há treino anexado.
      await expect(page.getByText('Treino anexado: Treino A')).toHaveCount(0);
      await capturar(page, `aluno-compartilhar-${largura}`);

      await page.getByRole('tab', { name: 'Conquistas' }).click();
      await expect(page).toHaveURL(/aba=ranking/);
      await page.getByRole('tab', { name: 'Mural' }).click();
      await expect(mensagem).toHaveValue('Acabei de finalizar meu Treino A!');

      await page.getByRole('button', { name: /^Publicar/ }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/aluno/comunidade/mural'))?.corpo).toEqual({ texto: 'Acabei de finalizar meu Treino A!' });
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: vazio em cada fonte e aviso sem conexão', async ({ page }) => {
      const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...vazia });
      await page.goto('/aluno/comunidade');
      await expect(page.getByText('Nenhuma publicação no mural ainda.')).toBeVisible();
      await page.getByRole('tab', { name: 'Aulões' }).click();
      await expect(page.getByText('Nenhum aulão por enquanto.')).toBeVisible();
      await page.getByRole('tab', { name: 'Conquistas' }).click();
      await expect(page.getByText('Nenhuma conquista por enquanto.')).toBeVisible();
      await capturar(page, `aluno-vazio-${largura}`);

      await page.context().setOffline(true);
      await expect(page.getByText(/^Sem conexão\. O mural/)).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Mural' })).toHaveCount(0);
      await capturar(page, `aluno-offline-${largura}`);
      await page.context().setOffline(false);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: erro da API vira mensagem com "Tentar de novo" e nenhum dado de exemplo', async ({ page }) => {
      let falhando = true;
      const api = await simularApi(page, {
        ...(await sessaoDeAluno(page)),
        ...cheia,
        'GET /aluno/comunidade/mural': (_p, route) => {
          if (falhando) { const e = erroApi(503, 'Indisponível.'); return json(route, e.corpo, e.status); }
          return json(route, pagina(POST));
        },
      });
      await page.goto('/aluno/comunidade');
      await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
      await expect(page.getByText('Semana de constância, time!')).toHaveCount(0);
      await expect(page.getByText('Nenhuma publicação no mural ainda.')).toHaveCount(0);
      await capturar(page, `aluno-erro-${largura}`);
      falhando = false;
      await page.getByRole('button', { name: 'Tentar de novo' }).click();
      await expect(page.getByText('Semana de constância, time!')).toBeVisible();
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: publicar com erro da API avisa e não finge que publicou', async ({ page }) => {
      const e = erroApi(429, 'Muitas publicações. Tente de novo em instantes.');
      await simularApi(page, { ...(await sessaoDeAluno(page)), ...vazia, 'POST /aluno/comunidade/mural': (_p, route) => json(route, e.corpo, e.status) });
      await page.goto('/aluno/comunidade');
      await page.getByRole('textbox', { name: 'Mensagem para o time' }).fill('Oi, time');
      await page.getByRole('button', { name: /^Publicar/ }).click();
      await expect(page.getByText('Muitas publicações. Tente de novo em instantes.')).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Mensagem para o time' })).toHaveValue('Oi, time');
      await expect(page.getByText('Nenhuma publicação no mural ainda.')).toBeVisible();
    });

    for (const [nome, t, contraste] of TEMAS) {
      test(`aluno: conquistas no tema ${nome}`, async ({ page }) => {
        await tema(page, ALUNO.id, t, contraste);
        const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...cheia });
        await page.goto('/aluno/comunidade');
        await page.getByRole('tab', { name: 'Conquistas' }).click();
        await expect(page.getByText('2º de 12 participantes')).toBeVisible();
        await capturar(page, `aluno-tema-${nome}-${largura}`);
        expect(api.errosDaPagina).toEqual([]);
      });
    }

    const abrirTreinador = async (page: Page, respostas: RespostasApi, permissoes = [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR']) =>
      simularApi(page, { ...(await sessao(page, TREINADOR, { permissoes })), ...respostas });

    test('treinador: aulões e mural com dados, sem ranking nem curtida', async ({ page }) => {
      await tema(page, TREINADOR.id, 'CLARO');
      const api = await abrirTreinador(page, cheia);
      await page.goto('/treinador/comunidade');
      await expect(page.getByRole('heading', { level: 1, name: 'Comunidade' })).toBeVisible();
      await expect(page.getByText('Técnica', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Abrir o vídeo' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Ranking' })).toHaveCount(0);
      await capturar(page, `treinador-auloes-${largura}`);

      await page.getByRole('tab', { name: 'Mural' }).click();
      await expect(page.getByText('Treino feito.')).toBeVisible();
      await expect(page.getByText('Fixado', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Curtir' })).toHaveCount(0);
      await page.getByRole('textbox', { name: 'Mensagem' }).fill('Rascunho de teste');
      await page.getByRole('tab', { name: 'Aulões' }).click();
      await expect(page).toHaveURL(/aba=auloes/);
      await capturar(page, `treinador-mural-${largura}`);
      // A aba mora no endereço e a tela continua montada: o rascunho do mural continua lá.
      await page.getByRole('tab', { name: 'Mural' }).click();
      await expect(page).toHaveURL(/aba=mural/);
      await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveValue('Rascunho de teste');
      expect(api.errosDaPagina).toEqual([]);
    });

    test('treinador: publicar no mural envia só o texto', async ({ page }) => {
      const api = await abrirTreinador(page, { ...vazia, 'POST /comunidade/mural': { corpo: { ...POST, id: 'novo' } } });
      await page.goto('/treinador/comunidade?aba=mural');
      await page.getByRole('textbox', { name: 'Mensagem' }).fill('Recado do time');
      await page.getByRole('button', { name: 'Publicar no mural' }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/comunidade/mural'))?.corpo).toEqual({ texto: 'Recado do time' });
    });

    test('treinador: sem TREINO_ALTERAR lê, mas não vê como publicar', async ({ page }) => {
      await abrirTreinador(page, cheia, [...PERMISSOES_TREINADOR, 'TREINO_LER']);
      await page.goto('/treinador/comunidade');
      await expect(page.getByText('Aulão de técnica')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Novo aulão' })).toHaveCount(0);
      await page.getByRole('tab', { name: 'Mural' }).click();
      await expect(page.getByText('Treino feito.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Publicar no mural' })).toHaveCount(0);
    });

    test('treinador: folha do aulão pede título e link https e envia os campos da API', async ({ page }) => {
      const api = await abrirTreinador(page, { ...vazia, 'POST /comunidade/aulas': { corpo: { ...AULA, id: 'novo' } } });
      await page.goto('/treinador/comunidade');
      await expect(page.getByText('Nenhum aulão publicado.')).toBeVisible();
      await page.getByRole('button', { name: 'Novo aulão' }).click();
      const folha = page.getByRole('dialog', { name: 'Novo aulão' });
      await folha.getByRole('button', { name: 'Publicar para o time' }).click();
      await expect(folha.getByText('Escreva o título.')).toBeVisible();
      await expect(folha.getByText('Cole o link do vídeo.')).toBeVisible();
      await folha.getByRole('textbox', { name: 'Título' }).fill('Aulão de teste');
      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill('http://exemplo.test');
      await folha.getByRole('button', { name: 'Publicar para o time' }).click();
      await expect(folha.getByText('Use um link https completo.')).toBeVisible();
      await capturar(page, `treinador-folha-erros-${largura}`);
      expect(api.pedidos.some((p) => foiPost(p, '/comunidade/aulas'))).toBe(false);

      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill('https://exemplo.test/video');
      await folha.getByRole('textbox', { name: /^Categoria/ }).fill('Técnica');
      await folha.getByRole('textbox', { name: /^Descrição/ }).fill('Pauta de teste.');
      await folha.getByRole('button', { name: 'Publicar para o time' }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/comunidade/aulas'))?.corpo)
        .toEqual({ titulo: 'Aulão de teste', descricao: 'Pauta de teste.', videoUrl: 'https://exemplo.test/video', categoria: 'Técnica' });
      await expect(folha).toHaveCount(0);
    });

    test('treinador: link recusado pela API (422) aparece no campo e a folha continua aberta', async ({ page }) => {
      const e = erroApi(422, 'Dados inválidos.', 'COMUNIDADE_INVALIDA', [{ field: 'videoUrl', message: 'Use um link https sem usuário e senha.' }]);
      await abrirTreinador(page, { ...vazia, 'POST /comunidade/aulas': (_p, route) => json(route, e.corpo, e.status) });
      await page.goto('/treinador/comunidade');
      await page.getByRole('button', { name: 'Novo aulão' }).click();
      const folha = page.getByRole('dialog', { name: 'Novo aulão' });
      await folha.getByRole('textbox', { name: 'Título' }).fill('Aulão de teste');
      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill('https://exemplo.test/video');
      await folha.getByRole('button', { name: 'Publicar para o time' }).click();
      await expect(folha.getByText('Use um link https sem usuário e senha.')).toBeVisible();
      await expect(folha).toBeVisible();
    });

    test('treinador: erro da API vira mensagem com "Tentar de novo" e nenhum dado de exemplo', async ({ page }) => {
      const e = erroApi(503, 'Indisponível.');
      await abrirTreinador(page, { ...cheia, 'GET /comunidade/aulas': (_p, route) => json(route, e.corpo, e.status) });
      await page.goto('/treinador/comunidade');
      await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
      await expect(page.getByText('Nenhum aulão publicado.')).toHaveCount(0);
      await capturar(page, `treinador-erro-${largura}`);
    });

    for (const [nome, t, contraste] of TEMAS) {
      test(`treinador: aulões no tema ${nome}`, async ({ page }) => {
        await tema(page, TREINADOR.id, t, contraste);
        const api = await abrirTreinador(page, cheia);
        await page.goto('/treinador/comunidade');
        await expect(page.getByText('Pauta do aulão de teste.')).toBeVisible();
        await capturar(page, `treinador-tema-${nome}-${largura}`);
        expect(api.errosDaPagina).toEqual([]);
      });
    }
  });
}

test.describe('barra inferior do aluno em 390 px', () => {
  test.use({ viewport: { width: 390, height: 900 } });

  test('o rótulo curto "Time" do item Comunidade cabe inteiro, sem corte', async ({ page }) => {
    await simularApi(page, { ...(await sessaoDeAluno(page)), ...vazia });
    await page.goto('/aluno/comunidade');
    const item = page.getByRole('link', { name: 'Time (Comunidade)' });
    await expect(item).toBeVisible();
    const rotulo = item.getByText('Time', { exact: true });
    expect(await rotulo.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    await capturar(page, 'aluno-barra-390');
  });
});
