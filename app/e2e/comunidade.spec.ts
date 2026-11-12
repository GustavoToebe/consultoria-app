import { expect, test, type Page } from '@playwright/test';

import type {
  AulaDaComunidade, ComentarioDoMural, ConquistaDoAluno, PaginaDeComentarios, PaginaDoMural, PerfilDaComunidade, PosicaoNoRanking, PostDoMural,
} from '../src/api/comunidadeTipos';
import type { EuResponse } from '../src/api/tipos';
import { MEUS_DADOS_VAZIOS, sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso, type RespostasApi } from './api-falsa';

/**
 * Comunidade do aluno e do treinador, com a API simulada nas rotas e nos formatos reais (`/aluno/comunidade/{aulas, mural,
 * mural/{id}/reacoes, conquistas, ranking}` e `/comunidade/{aulas, mural}`). Só dados fictícios. O erro da API chega à tela
 * como erro de verdade, com "Tentar de novo": o cliente não troca falha por dado de exemplo.
 */
const CURTIDA = '❤️';
const POST: PostDoMural = {
  id: 'p1', autorId: 'u1', autorNome: 'Treinadora Teste', autorApelido: null, autorEhAluno: false, autorFotoUrl: null, texto: 'Semana de constância, time!',
  tipo: 'CONVERSA', videoUrl: null, fotos: [], respondida: false, fixado: true, criadoEm: '2026-10-19T12:00:00-03:00', reacoes: { [CURTIDA]: 2, '🔥': 5 }, minhasReacoes: [], totalComentarios: 4,
};
const POST_CURTIDO: PostDoMural = {
  ...POST, id: 'p2', autorId: 'u2', autorNome: 'Aluno Fictício', autorApelido: 'Fictí', autorEhAluno: true, texto: 'Treino feito.', fixado: false,
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
// Colega visível como a API manda (V070): conquistas sem id nem horário, sem foto.
const PERFIL: PerfilDaComunidade = {
  autorId: 'u2', nome: 'Aluno Fictício', apelido: 'Fictí', ehVoce: false, reservado: false, treinosConcluidos: 8, nivel: 2,
  conquistas: CONQUISTAS.map(({ tipo, titulo, descricao, icone }) => ({ tipo, titulo, descricao, icone })), destaques: [],
  temFoto: false, atividade: { diasTreinadosUltimos30: [], ultimasConquistas: [] }, recordes: [],
};
const RANKING: PosicaoNoRanking = { posicao: 2, treinosConcluidos: 8, pontuacao: 80, participantes: 12 };

const COMENTARIOS: ComentarioDoMural[] = [
  { id: 'c1', autorId: 'u2', autorNome: 'Aluno Fictício', autorApelido: 'Fictí', autorEhAluno: true, autorFotoUrl: null, texto: 'Bora, time!', criadoEm: '2026-10-19T13:00:00-03:00', daEquipe: false },
  { id: 'c2', autorId: 'u1', autorNome: 'Treinadora Teste', autorApelido: null, autorEhAluno: false, autorFotoUrl: null, texto: 'Mandou bem.', criadoEm: '2026-10-19T14:00:00-03:00', daEquipe: true },
];

/** Uma página da lista, como a API: `?pagina=` (0 primeiro) e `?tamanho=` (padrão 30), `{itens, total}`. */
function paginaDe(lista: ComentarioDoMural[], p: PedidoFalso): PaginaDeComentarios {
  const n = Number(p.busca.get('pagina') ?? 0);
  const tamanho = Number(p.busca.get('tamanho') ?? 30);
  return { itens: lista.slice(n * tamanho, (n + 1) * tamanho), total: lista.length };
}

/** Mural e comentários com estado: o total do post acompanha a lista, como na API (só os não ocultos). */
function comComentarios(caminhoDoMural: string, rotaDaLista: string, inicial: ComentarioDoMural[] = COMENTARIOS) {
  const estado = { lista: [...inicial] };
  const rotas: RespostasApi = {
    [`GET ${caminhoDoMural}`]: (_p, route) => json(route, pagina({ ...POST, totalComentarios: estado.lista.length }, POST_CURTIDO)),
    [`GET ${rotaDaLista}`]: (p, route) => json(route, paginaDe(estado.lista, p)),
  };
  return { estado, rotas };
}

/** Aulas e comentários da aula com estado (aluno ou equipe), como `comComentarios`. */
function comComentariosDaAula(caminhoDasAulas: string, rotaDaLista: string, inicial: ComentarioDoMural[] = COMENTARIOS) {
  const estado = { lista: [...inicial] };
  const rotas: RespostasApi = {
    [`GET ${caminhoDasAulas}`]: (_p, route) => json(route, [{ ...AULA, totalComentarios: estado.lista.length }]),
    [`GET ${rotaDaLista}`]: (p, route) => json(route, paginaDe(estado.lista, p)),
  };
  return { estado, rotas };
}

/** `n` comentários fictícios, do mais antigo ao mais novo. */
const varios = (n: number): ComentarioDoMural[] => Array.from({ length: n }, (_, i) => ({
  ...COMENTARIOS[0], id: `v${i + 1}`, texto: `Comentário de teste ${i + 1}`, criadoEm: `2026-10-19T13:${String(i).padStart(2, '0')}:00-03:00`,
}));

// Chaves do mural (C9): ligadas para publicar, sem foto; cada teste que mexe nelas troca a rota.
const CONFIGURACAO_DO_ALUNO = { alunosPublicam: true, podeAnexarFoto: false };
const CONFIGURACAO_DA_EQUIPE = { alunosPublicam: true, alunosAnexamFotos: false };

const cheia: RespostasApi = {
  'GET /aluno/comunidade/configuracao': { corpo: CONFIGURACAO_DO_ALUNO },
  'GET /comunidade/configuracao': { corpo: CONFIGURACAO_DA_EQUIPE },
  'GET /aluno/comunidade/mural': { corpo: pagina(POST, POST_CURTIDO) },
  'GET /aluno/comunidade/aulas': { corpo: [AULA] },
  'GET /aluno/comunidade/conquistas': { corpo: CONQUISTAS },
  'GET /aluno/comunidade/ranking': { corpo: RANKING },
  'POST /aluno/comunidade/mural/{id}/reacoes': { status: 204 },
  'GET /comunidade/mural': { corpo: pagina(POST, POST_CURTIDO) },
  'GET /comunidade/aulas': { corpo: [AULA] },
};
const vazia: RespostasApi = {
  'GET /aluno/comunidade/configuracao': { corpo: CONFIGURACAO_DO_ALUNO },
  'GET /comunidade/configuracao': { corpo: CONFIGURACAO_DA_EQUIPE },
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
const novaPublicacao = (page: Page) => page.getByRole('dialog', { name: 'Nova publicação' });

/** Posts de cada tipo, como a API manda (o aviso fixado vem por último para conferir que a tela o põe no topo). */
const DUVIDA: PostDoMural = { ...POST_CURTIDO, id: 'p3', tipo: 'DUVIDA', texto: 'Dúvida de teste sobre o aquecimento.', respondida: true, minhasReacoes: [] };
const VIDEO: PostDoMural = { ...POST, id: 'p4', tipo: 'VIDEO', texto: 'Vídeo de teste da técnica', videoUrl: 'https://video.exemplo.invalid/aula', fixado: false, totalComentarios: 0 };
const AVISO: PostDoMural = { ...POST, id: 'p5', tipo: 'AVISO', texto: 'Aviso de teste para o time.', fixado: true, totalComentarios: 0 };

/** JPEG fictício gerado na página (quadrado em degradê), para o seletor de arquivo da web. */
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

    test('aluno: "Nova publicação" abre a folha, valida no envio, escolhe o tipo e manda o objeto; sem foto, sem botão de foto', async ({ page }) => {
      const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...vazia, 'POST /aluno/comunidade/mural': { corpo: { ...POST, id: 'novo', texto: 'Oi, time' } } });
      await page.goto('/aluno/comunidade');
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      const folha = novaPublicacao(page);
      // O aluno escolhe só Conversa, Dúvida e Resultado; Aviso e Vídeo são da equipe.
      await expect(folha.getByRole('radio', { name: 'Conversa', exact: true })).toBeChecked();
      await expect(folha.getByRole('radio', { name: 'Aviso', exact: true })).toHaveCount(0);
      await expect(folha.getByRole('button', { name: 'Adicionar foto' })).toHaveCount(0);
      await folha.getByRole('button', { name: /^Publicar/ }).click();
      await expect(folha.getByText('Escreva a publicação.')).toBeVisible();
      expect(api.pedidos.some((p) => foiPost(p, '/aluno/comunidade/mural'))).toBe(false);
      await capturar(page, `aluno-nova-publicacao-erro-${largura}`);

      await folha.getByRole('radio', { name: 'Dúvida', exact: true }).click();
      await folha.getByRole('textbox', { name: 'Texto', exact: true }).fill('Oi, time');
      await folha.getByRole('button', { name: /^Publicar/ }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/aluno/comunidade/mural'))?.corpo).toEqual({ tipo: 'DUVIDA', texto: 'Oi, time' });
      await expect(folha).toHaveCount(0);
      await expect(page.getByText('Publicado no mural.')).toBeVisible();
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: com "Alunos podem publicar" desligado, só a frase neutra; curtir e comentar continuam', async ({ page }) => {
      const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...cheia, 'GET /aluno/comunidade/configuracao': { corpo: { alunosPublicam: false, podeAnexarFoto: false } } });
      await page.goto('/aluno/comunidade');
      await expect(page.getByText('No momento, só a equipe publica no mural. Você pode curtir e comentar.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Nova publicação' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Curtir' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ver 4 comentário(s)' })).toBeVisible();
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: vindo do "Bom trabalho!", abre Resultado com o texto editável, limpa o endereço e não publica sozinho', async ({ page }) => {
      const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...vazia, 'POST /aluno/comunidade/mural': { corpo: { ...POST, id: 'novo' } } });
      await page.goto('/aluno/comunidade?publicar=RESULTADO&texto=Treino%20conclu%C3%ADdo%3A%20Treino%20A.');
      const folha = novaPublicacao(page);
      const texto = folha.getByRole('textbox', { name: 'Texto', exact: true });
      await expect(texto).toHaveValue('Treino concluído: Treino A.');
      await expect(folha.getByRole('radio', { name: 'Resultado', exact: true })).toBeChecked();
      await expect(page).not.toHaveURL(/publicar=/);
      await capturar(page, `aluno-publicar-resultado-${largura}`);
      expect(api.pedidos.some((p) => foiPost(p, '/aluno/comunidade/mural'))).toBe(false);

      // Fechar e reabrir mantém o rascunho; o texto pronto é editável.
      await folha.getByRole('button', { name: 'Cancelar' }).click();
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      await texto.fill('Treino concluído: Treino A. Bora!');
      await folha.getByRole('button', { name: /^Publicar/ }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/aluno/comunidade/mural'))?.corpo)
        .toEqual({ tipo: 'RESULTADO', texto: 'Treino concluído: Treino A. Bora!' });
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: vindo do "Bom trabalho!" com a chave desligada, nada abre e fica a frase neutra', async ({ page }) => {
      const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...vazia, 'GET /aluno/comunidade/configuracao': { corpo: { alunosPublicam: false, podeAnexarFoto: false } } });
      await page.goto('/aluno/comunidade?publicar=RESULTADO&texto=Treino%20conclu%C3%ADdo.');
      await expect(page.getByText('No momento, só a equipe publica no mural. Você pode curtir e comentar.')).toBeVisible();
      await expect(novaPublicacao(page)).toHaveCount(0);
      await expect(page).not.toHaveURL(/publicar=/);
      expect(api.pedidos.some((p) => foiPost(p, '/aluno/comunidade/mural'))).toBe(false);
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

    test('aluno: publicar com erro da API avisa dentro da folha e não finge que publicou', async ({ page }) => {
      const e = erroApi(429, 'Muitas publicações. Tente de novo em instantes.');
      await simularApi(page, { ...(await sessaoDeAluno(page)), ...vazia, 'POST /aluno/comunidade/mural': (_p, route) => json(route, e.corpo, e.status) });
      await page.goto('/aluno/comunidade');
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      const folha = novaPublicacao(page);
      await folha.getByRole('textbox', { name: 'Texto', exact: true }).fill('Oi, time');
      await folha.getByRole('button', { name: /^Publicar/ }).click();
      await expect(folha.getByText('Muitas publicações. Tente de novo em instantes.')).toBeVisible();
      await expect(folha.getByRole('textbox', { name: 'Texto', exact: true })).toHaveValue('Oi, time');
      await page.keyboard.press('Escape');
      await expect(page.getByText('Nenhuma publicação no mural ainda.')).toBeVisible();
    });

    test('aluno: chips do tipo e busca vão à API; vazio com filtro diz isso e limpa', async ({ page }) => {
      const api = await simularApi(page, {
        ...(await sessaoDeAluno(page)), ...cheia,
        'GET /aluno/comunidade/mural': (p, route) => json(route, p.busca.get('tipo') || p.busca.get('busca') ? pagina() : pagina(POST, POST_CURTIDO)),
      });
      await page.goto('/aluno/comunidade');
      await expect(page.getByText('Treino feito.')).toBeVisible();
      for (const rotulo of ['Todos', 'Avisos', 'Vídeos', 'Dúvidas', 'Resultados', 'Conversas']) {
        await expect(page.getByRole('radio', { name: rotulo, exact: true })).toHaveCount(1);
      }
      await expect(page.getByRole('radio', { name: 'Denunciados', exact: true })).toHaveCount(0);
      await page.getByRole('radio', { name: 'Dúvidas', exact: true }).click();
      await expect.poll(() => api.pedidos.some((p) => p.caminho === '/aluno/comunidade/mural' && p.busca.get('tipo') === 'DUVIDA')).toBe(true);
      await expect(page.getByText('Nenhuma publicação encontrada com esse filtro.')).toBeVisible();
      await capturar(page, `aluno-mural-filtro-vazio-${largura}`);
      await page.getByRole('button', { name: 'Limpar filtros' }).click();
      await expect(page.getByText('Treino feito.')).toBeVisible();

      await page.getByRole('searchbox', { name: 'Buscar na comunidade' }).fill('supino');
      await expect.poll(() => api.pedidos.some((p) => p.caminho === '/aluno/comunidade/mural' && p.busca.get('busca') === 'supino')).toBe(true);
      await expect(page.getByText('Nenhuma publicação encontrada com esse filtro.')).toBeVisible();
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: aviso fixado no topo, vídeo com "Assistir" fora do app e dúvida respondida', async ({ page, context }) => {
      await context.route('https://video.exemplo.invalid/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Vídeo de teste</p>' }));
      const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...cheia, 'GET /aluno/comunidade/mural': { corpo: pagina(VIDEO, DUVIDA, AVISO) } });
      await page.goto('/aluno/comunidade');
      const aviso = page.getByText('Aviso de teste para o time.');
      const video = page.getByText('Vídeo de teste da técnica');
      await expect(aviso).toBeVisible();
      // Fixado primeiro, com os dois selos.
      expect((await aviso.boundingBox())!.y).toBeLessThan((await video.boundingBox())!.y);
      await expect(page.getByText('Aviso', { exact: true })).toBeVisible();
      await expect(page.getByText('Fixado', { exact: true })).toBeVisible();
      await expect(page.getByText('Respondida', { exact: true })).toBeVisible();
      // O vídeo não traz miniatura de fora: só o título e o botão.
      await expect(page.locator('img[src^="http"]')).toHaveCount(0);
      await capturar(page, `aluno-mural-tipos-${largura}`);
      const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Assistir: Vídeo de teste da técnica' }).click()]);
      await popup.waitForURL('https://video.exemplo.invalid/aula');
      expect(await popup.evaluate(() => window.opener)).toBeNull();
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: com foto liberada, anexa uma, vê a miniatura, remove a pendente e publica com as fotos', async ({ page }) => {
      let n = 0;
      let jpeg: Buffer = Buffer.alloc(0);
      const api = await simularApi(page, {
        ...(await sessaoDeAluno(page)), ...vazia,
        'GET /aluno/comunidade/configuracao': { corpo: { alunosPublicam: true, podeAnexarFoto: true } },
        'POST /aluno/comunidade/mural/fotos': (_p, route) => json(route, { id: `f${++n}` }),
        'GET /aluno/comunidade/mural/fotos/{id}': (_p, route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: jpeg }),
        'DELETE /aluno/comunidade/mural/fotos/{id}': (_p, route) => route.fulfill({ status: 204 }),
        'POST /aluno/comunidade/mural': { corpo: { ...POST, id: 'novo' } },
      });
      await page.goto('/aluno/comunidade');
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
      await capturar(page, `aluno-nova-publicacao-fotos-${largura}`);
      await folha.getByRole('button', { name: 'Remover a foto 1' }).click();
      await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'DELETE').map((p) => p.caminho)).toEqual(['/aluno/comunidade/mural/fotos/f1']);
      await expect(folha.getByRole('button', { name: 'Remover a foto 2' })).toHaveCount(0);
      await folha.getByRole('textbox', { name: 'Texto', exact: true }).fill('Resultado de teste');
      await folha.getByRole('button', { name: /^Publicar/ }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/aluno/comunidade/mural'))?.corpo).toEqual({ tipo: 'CONVERSA', texto: 'Resultado de teste', fotoIds: ['f2'] });
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: foto recusada pela API (422) aparece junto das fotos', async ({ page }) => {
      const e = erroApi(422, 'A foto passou do tamanho.', 'FOTO_GRANDE_DEMAIS');
      await simularApi(page, {
        ...(await sessaoDeAluno(page)), ...vazia,
        'GET /aluno/comunidade/configuracao': { corpo: { alunosPublicam: true, podeAnexarFoto: true } },
        'POST /aluno/comunidade/mural/fotos': (_p, route) => json(route, e.corpo, e.status),
      });
      await page.goto('/aluno/comunidade');
      const jpeg = await jpegFicticio(page);
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      const folha = novaPublicacao(page);
      const [seletor] = await Promise.all([page.waitForEvent('filechooser'), folha.getByRole('button', { name: 'Adicionar foto' }).click()]);
      await seletor.setFiles({ name: 'foto-ficticia.jpg', mimeType: 'image/jpeg', buffer: jpeg });
      await expect(folha.getByText('A foto passou do tamanho.')).toBeVisible();
      await expect(folha.getByRole('button', { name: /^Remover a foto/ })).toHaveCount(0);
    });

    test('aluno: denuncia o post de outra pessoa pelo ⋯, com motivo, e o próprio post não tem ⋯', async ({ page }) => {
      const MEU: PostDoMural = { ...POST_CURTIDO, id: 'p9', autorId: ALUNO.id, autorNome: ALUNO.nome, texto: 'Post do próprio aluno.' };
      const api = await simularApi(page, {
        ...(await sessaoDeAluno(page)), ...cheia,
        'GET /aluno/comunidade/mural': { corpo: pagina(POST, MEU) },
        'POST /aluno/comunidade/mural/{id}/denuncias': { status: 204 },
      });
      await page.goto('/aluno/comunidade');
      await expect(page.getByText('Post do próprio aluno.')).toBeVisible();
      await expect(page.getByRole('button', { name: `Ações da publicação de ${ALUNO.nome}` })).toHaveCount(0);
      await page.getByRole('button', { name: 'Ações da publicação de Treinadora Teste' }).click();
      await page.getByRole('dialog', { name: 'Ações da publicação' }).getByRole('button', { name: /^Denunciar/ }).click();
      const painel = page.getByRole('alertdialog', { name: 'Denunciar a publicação?' });
      await expect(painel.getByText(/Quem publicou não fica sabendo quem denunciou/)).toBeVisible();
      await expect(painel.getByRole('button', { name: /^Denunciar/ })).toBeDisabled();
      await painel.getByRole('radio', { name: 'Propaganda ou spam', exact: true }).click();
      await capturar(page, `aluno-denunciar-${largura}`);
      await painel.getByRole('button', { name: /^Denunciar/ }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/aluno/comunidade/mural/p1/denuncias'))?.corpo).toEqual({ motivo: 'SPAM' });
      await expect(painel).toHaveCount(0);
      await expect(page.getByText('Denúncia enviada.')).toBeVisible();
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    for (const [nome, t, contraste] of TEMAS) {
      test(`aluno: apelido ao lado do nome e perfil do colega numa folha, tema ${nome}`, async ({ page }) => {
        await tema(page, ALUNO.id, t, contraste);
        const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...cheia, 'GET /aluno/comunidade/perfis/{id}': { corpo: PERFIL } });
        await page.goto('/aluno/comunidade');
        await expect(page.getByText('«Fictí»')).toBeVisible();
        // Autor da equipe não abre perfil; o aluno abre.
        await expect(page.getByRole('button', { name: 'Ver perfil de Treinadora Teste' })).toHaveCount(0);
        const autor = page.getByRole('button', { name: 'Ver perfil de Aluno Fictício' });
        expect((await autor.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await autor.focus();
        await capturar(page, `aluno-mural-apelido-${nome}-${largura}`);
        await page.keyboard.press('Enter');
        const folha = page.getByRole('dialog', { name: 'Perfil na Comunidade' });
        await expect(folha.getByText('Aluno Fictício', { exact: true })).toBeVisible();
        await expect(folha.getByText('«Fictí»')).toBeVisible();
        await expect(folha.getByText('8 treinos concluídos')).toBeVisible();
        await expect(folha.getByText('Nível 2', { exact: true })).toBeVisible();
        await expect(folha.getByText('Primeiro treino', { exact: true })).toBeVisible();
        // Nunca horário de conquista.
        await expect(folha.getByText(/\d{2}:\d{2}/)).toHaveCount(0);
        await expect(folha.getByText('Você', { exact: true })).toHaveCount(0);
        // Sem `temFoto` não busca foto (as iniciais ficam) e não há compartilhar. Foto seria um <img>; os ícones são SVG.
        await expect(folha.locator('img')).toHaveCount(0);
        await expect(folha.getByRole('button', { name: /Compartilhar/ })).toHaveCount(0);
        await capturar(page, `aluno-perfil-${nome}-${largura}`);
        expect(api.pedidos.filter((p) => p.metodo === 'GET' && p.caminho.startsWith('/aluno/comunidade/perfis/')).map((p) => p.caminho)).toEqual(['/aluno/comunidade/perfis/u2']);
        expect(api.naoTratadas).toEqual([]);
        expect(api.errosDaPagina).toEqual([]);
      });
    }

    test('aluno: o próprio perfil mostra "Você"; perfil fora do alcance (404) diz "Perfil não encontrado." sem tentar de novo', async ({ page }) => {
      let resposta: 'meu' | '404' | '503' = 'meu';
      const api = await simularApi(page, {
        ...(await sessaoDeAluno(page)), ...cheia,
        'GET /aluno/comunidade/perfis/{id}': (_p, route) => {
          if (resposta === 'meu') return json(route, { ...PERFIL, ehVoce: true });
          const e = resposta === '404' ? erroApi(404, 'Não encontrado.', 'NAO_ENCONTRADO') : erroApi(503, 'Indisponível.');
          return json(route, e.corpo, e.status);
        },
      });
      await page.goto('/aluno/comunidade');
      const autor = page.getByRole('button', { name: 'Ver perfil de Aluno Fictício' });
      const folha = page.getByRole('dialog', { name: 'Perfil na Comunidade' });
      await autor.click();
      await expect(folha.getByText('Você', { exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(folha).toHaveCount(0);

      resposta = '404';
      await autor.click();
      await expect(folha.getByText('Perfil não encontrado.')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);
      await expect(folha.getByText('8 treinos concluídos')).toHaveCount(0);
      await capturar(page, `aluno-perfil-404-${largura}`);
      await page.keyboard.press('Escape');
      await expect(folha).toHaveCount(0);

      resposta = '503';
      await autor.click();
      await expect(folha.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
      resposta = 'meu';
      await folha.getByRole('button', { name: 'Tentar de novo' }).click();
      await expect(folha.getByText('8 treinos concluídos')).toBeVisible();
      // O próprio perfil leva ao cartão "Meu perfil" da Conta, fechando a folha.
      await folha.getByRole('button', { name: 'Editar meu perfil' }).click();
      // A Conta consome o `?secao=` ao rolar até o cartão (como o atalho do aviso).
      await expect(page).toHaveURL(/\/aluno\/conta/);
      await expect(page.getByTestId('cartao-meu-perfil')).toBeInViewport();
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: apelido na Conta valida no aparelho, mostra o 422 no campo, salva e remove', async ({ page }) => {
      const estado = { apelido: null as string | null, recusar: true };
      const rotas = await sessaoDeAluno(page);
      const eu = (rotas['GET /eu'] as { corpo: EuResponse }).corpo;
      const api = await simularApi(page, {
        ...rotas,
        'GET /eu': { corpo: { ...eu, aluno: { id: 'a0000000-0000-4000-8000-000000000002', nome: ALUNO.nome } } },
        'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
        'GET /aluno/uso-de-imagem': { corpo: { autorizadoEm: null } },
        'GET /aluno/meus-dados': (_p, route) => json(route, { ...MEUS_DADOS_VAZIOS, apelido: estado.apelido }),
        'PUT /aluno/comunidade/apelido': (p, route) => {
          if (estado.recusar) {
            estado.recusar = false;
            const e = erroApi(422, 'Confira o apelido.', 'APELIDO_INVALIDO', [{ field: 'apelido', message: 'Esse apelido não pode ser usado.' }]);
            return json(route, e.corpo, e.status);
          }
          estado.apelido = (p.corpo as { apelido: string | null }).apelido;
          return route.fulfill({ status: 204 });
        },
      });
      await page.goto('/aluno/conta');
      const campo = page.getByRole('textbox', { name: 'Apelido (opcional)' });
      await expect(campo).toBeVisible();
      await expect(page.getByText('Aparece ao lado do seu nome na Comunidade.')).toBeVisible();
      const salvar = page.getByRole('button', { name: 'Salvar apelido' });
      await expect(salvar).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Remover apelido' })).toHaveCount(0);

      await campo.fill('meu.site.com');
      await expect(page.getByText('O apelido não pode ser um link.')).toBeVisible();
      await expect(salvar).toBeDisabled();
      await campo.fill('Fictí');
      await salvar.click();
      await expect(page.getByText('Esse apelido não pode ser usado.')).toBeVisible();
      await capturar(page, `aluno-conta-apelido-422-${largura}`);
      await salvar.click();
      await expect(page.getByText('Apelido salvo.')).toBeVisible();
      await capturar(page, `aluno-conta-apelido-salvo-${largura}`);
      await page.getByRole('button', { name: 'Remover apelido' }).click();
      await expect(page.getByText('Apelido removido.')).toBeVisible();
      await expect(campo).toHaveValue('');
      const enviados = api.pedidos.filter((p) => p.metodo === 'PUT' && p.caminho === '/aluno/comunidade/apelido').map((p) => p.corpo);
      expect(enviados).toEqual([{ apelido: 'Fictí' }, { apelido: 'Fictí' }, { apelido: null }]);
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: abre os comentários, comenta, o total sobe; perfil abre pelo autor aluno e a equipe não é link', async ({ page }) => {
      await tema(page, ALUNO.id, 'CLARO');
      const { estado, rotas } = comComentarios('/aluno/comunidade/mural', '/aluno/comunidade/mural/{id}/comentarios');
      const api = await simularApi(page, {
        ...(await sessaoDeAluno(page)), ...cheia, ...rotas,
        'GET /aluno/comunidade/perfis/{id}': { corpo: PERFIL },
        'POST /aluno/comunidade/mural/{id}/comentarios': (p, route) => {
          const novo: ComentarioDoMural = {
            id: 'c3', autorId: ALUNO.id, autorNome: ALUNO.nome, autorApelido: null, autorEhAluno: true, autorFotoUrl: null,
            texto: (p.corpo as { texto: string }).texto.trim(), criadoEm: '2026-10-20T09:00:00-03:00', daEquipe: false,
          };
          estado.lista.push(novo);
          return json(route, novo);
        },
      });
      await page.goto('/aluno/comunidade');
      const abrir = page.getByRole('button', { name: 'Ver 2 comentário(s)' });
      expect((await abrir.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await abrir.click();
      const folha = page.getByRole('dialog', { name: 'Comentários' });
      await expect(folha.getByText('Bora, time!')).toBeVisible();
      await expect(folha.getByText('Mandou bem.')).toBeVisible();
      await expect(folha.getByText('«Fictí»')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Ver perfil de Treinadora Teste' })).toHaveCount(0);
      const comentar = folha.getByRole('button', { name: /^Comentar/ });
      await expect(comentar).toBeDisabled();
      await expect(folha.getByText('Escreva o comentário.')).toBeVisible();
      await capturar(page, `aluno-comentarios-${largura}`);
      expect(api.pedidos.filter((p) => p.metodo === 'GET' && p.caminho.endsWith('/comentarios')).map((p) => p.caminho))
        .toEqual(['/aluno/comunidade/mural/p1/comentarios']);

      const campo = folha.getByRole('textbox', { name: 'Seu comentário' });
      await campo.fill('  Boa, time!  ');
      await comentar.click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/aluno/comunidade/mural/p1/comentarios'))?.corpo).toEqual({ texto: 'Boa, time!' });
      await expect(folha.getByText('Boa, time!', { exact: true })).toBeVisible();
      await expect(campo).toHaveValue('');

      // Perfil do colega por cima dos comentários; o Esc fecha só o perfil.
      await folha.getByRole('button', { name: 'Ver perfil de Aluno Fictício' }).click();
      const perfil = page.getByRole('dialog', { name: 'Perfil na Comunidade' });
      await expect(perfil.getByText('8 treinos concluídos')).toBeVisible();
      await capturar(page, `aluno-comentarios-perfil-${largura}`);
      await page.keyboard.press('Escape');
      await expect(perfil).toHaveCount(0);
      await expect(folha).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(folha).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Ver 3 comentário(s)' })).toBeVisible();
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: 429 ao comentar vira aviso na folha e o texto fica', async ({ page }) => {
      const e = erroApi(429, 'Muitas tentativas. Tente de novo em alguns minutos.', 'LOGIN_LIMITADO');
      const { rotas } = comComentarios('/aluno/comunidade/mural', '/aluno/comunidade/mural/{id}/comentarios');
      const api = await simularApi(page, {
        ...(await sessaoDeAluno(page)), ...cheia, ...rotas,
        'POST /aluno/comunidade/mural/{id}/comentarios': (_p, route) => route.fulfill({
          status: e.status, contentType: 'application/json', headers: { 'Retry-After': '60' }, body: JSON.stringify(e.corpo),
        }),
      });
      await page.goto('/aluno/comunidade');
      await page.getByRole('button', { name: 'Ver 2 comentário(s)' }).click();
      const folha = page.getByRole('dialog', { name: 'Comentários' });
      const campo = folha.getByRole('textbox', { name: 'Seu comentário' });
      await campo.fill('Oi, time');
      await folha.getByRole('button', { name: /^Comentar/ }).click();
      await expect(folha.getByText('Muitas tentativas. Tente de novo em alguns minutos.')).toBeVisible();
      await expect(campo).toHaveValue('Oi, time');
      await capturar(page, `aluno-comentarios-429-${largura}`);
      expect(api.pedidos.filter((p) => foiPost(p, '/aluno/comunidade/mural/p1/comentarios'))).toHaveLength(1);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: comentário até 280 caracteres (emoji conta 2), contador com texto e o antigo maior aparece inteiro', async ({ page }) => {
      const ANTIGO = `Comentário antigo e longo ${'x'.repeat(380)} fim.`;
      const { rotas } = comComentarios('/aluno/comunidade/mural', '/aluno/comunidade/mural/{id}/comentarios',
        [...COMENTARIOS, { ...COMENTARIOS[0], id: 'c9', texto: ANTIGO }]);
      const api = await simularApi(page, {
        ...(await sessaoDeAluno(page)), ...cheia, ...rotas,
        'POST /aluno/comunidade/mural/{id}/comentarios': (p, route) => json(route, {
          ...COMENTARIOS[0], id: 'n1', autorId: ALUNO.id, autorNome: ALUNO.nome, texto: (p.corpo as { texto: string }).texto,
        }),
      });
      await page.goto('/aluno/comunidade');
      await page.getByRole('button', { name: 'Ver 3 comentário(s)' }).click();
      const folha = page.getByRole('dialog', { name: 'Comentários' });
      await expect(folha.getByText(ANTIGO)).toBeVisible();
      const campo = folha.getByRole('textbox', { name: 'Seu comentário' });
      const comentar = folha.getByRole('button', { name: /^Comentar/ });
      // Sem texto, sem contador; ao digitar, o número aparece.
      await expect(folha.getByText(/\/280/)).toHaveCount(0);
      await campo.fill('Oi');
      await expect(folha.getByText('2/280', { exact: true })).toBeVisible();

      await campo.fill('a'.repeat(281));
      await expect(folha.getByText('281/280 · 1 a mais')).toBeVisible();
      await expect(folha.getByText('Use até 280 caracteres.').first()).toBeVisible();
      await expect(comentar).toBeDisabled();
      await capturar(page, `aluno-comentarios-limite-${largura}`);

      await campo.fill(`${'a'.repeat(279)}💪`);
      await expect(folha.getByText('281/280 · 1 a mais')).toBeVisible();
      await expect(comentar).toBeDisabled();

      await campo.fill(`${'a'.repeat(262)}💪`);
      await expect(folha.getByText('264/280 · faltam 16')).toBeVisible();
      await expect(comentar).toBeEnabled();
      await capturar(page, `aluno-comentarios-perto-do-limite-${largura}`);

      await campo.fill('a'.repeat(280));
      await expect(folha.getByText('280/280 · no limite')).toBeVisible();
      await expect(comentar).toBeEnabled();
      await comentar.click();
      await expect.poll(() => api.pedidos.filter((p) => foiPost(p, '/aluno/comunidade/mural/p1/comentarios'))
        .map((p) => (p.corpo as { texto: string }).texto.length)).toEqual([280]);
      await expect(campo).toHaveValue('');
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: 35 comentários vêm 30 por vez; "Carregar mais" acrescenta sem perder, a falha mantém o lido e o enviado não se repete', async ({ page }) => {
      const { estado, rotas } = comComentarios('/aluno/comunidade/mural', '/aluno/comunidade/mural/{id}/comentarios', varios(35));
      let falharMais = true;
      const api = await simularApi(page, {
        ...(await sessaoDeAluno(page)), ...cheia, ...rotas,
        'GET /aluno/comunidade/mural/{id}/comentarios': (p, route) => {
          if (p.busca.get('pagina') !== '0' && falharMais) { const e = erroApi(503, 'Indisponível.'); return json(route, e.corpo, e.status); }
          return json(route, paginaDe(estado.lista, p));
        },
        'POST /aluno/comunidade/mural/{id}/comentarios': (p, route) => {
          const novo: ComentarioDoMural = {
            ...COMENTARIOS[0], id: 'novo', autorId: ALUNO.id, autorNome: ALUNO.nome, autorApelido: null, texto: (p.corpo as { texto: string }).texto,
          };
          estado.lista.push(novo);
          return json(route, novo);
        },
      });
      await page.goto('/aluno/comunidade');
      await page.getByRole('button', { name: 'Ver 35 comentário(s)' }).click();
      const folha = page.getByRole('dialog', { name: 'Comentários' });
      await expect(folha.getByText('Comentário de teste 30', { exact: true })).toBeVisible();
      await expect(folha.getByText('Comentário de teste 31', { exact: true })).toHaveCount(0);
      await expect(folha.getByText('Mostrando 30 de 35 comentários.')).toBeVisible();

      // Comentar com páginas faltando: o novo aparece no fim, sem buscar a lista de novo.
      await folha.getByRole('textbox', { name: 'Seu comentário' }).fill('Meu comentário novo');
      await folha.getByRole('button', { name: /^Comentar/ }).click();
      await expect(folha.getByText('Meu comentário novo', { exact: true })).toBeVisible();
      await expect(folha.getByText('Mostrando 31 de 36 comentários.')).toBeVisible();

      const carregar = folha.getByRole('button', { name: 'Carregar mais comentários' });
      expect((await carregar.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await carregar.scrollIntoViewIfNeeded();
      await capturar(page, `aluno-comentarios-carregar-mais-${largura}`);
      await carregar.click();
      await expect(folha.getByText('Indisponível.')).toBeVisible();
      await expect(folha.getByText('Comentário de teste 1', { exact: true })).toBeVisible();
      await expect(folha.getByText('Comentário de teste 30', { exact: true })).toBeVisible();
      await folha.getByText('Indisponível.').scrollIntoViewIfNeeded();
      await capturar(page, `aluno-comentarios-carregar-mais-erro-${largura}`);

      falharMais = false;
      await folha.getByRole('button', { name: 'Tentar de novo' }).click();
      await expect(folha.getByText('Comentário de teste 35', { exact: true })).toBeVisible();
      await expect(folha.getByText('Comentário de teste 1', { exact: true })).toBeVisible();
      await expect(folha.getByText('Meu comentário novo', { exact: true })).toHaveCount(1);
      await expect(folha.getByRole('button', { name: 'Carregar mais comentários' })).toHaveCount(0);
      await expect(folha.getByText(/^Mostrando /)).toHaveCount(0);
      const paginas = api.pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/aluno/comunidade/mural/p1/comentarios')
        .map((p) => `${p.busca.get('pagina')}/${p.busca.get('tamanho')}`);
      expect(paginas).toEqual(['0/30', '1/30', '1/30']);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: comentários do aulão abrem pelo cartão, comenta e o total do aulão sobe', async ({ page }) => {
      await tema(page, ALUNO.id, 'CLARO');
      const { estado, rotas } = comComentariosDaAula('/aluno/comunidade/aulas', '/aluno/comunidade/aulas/{id}/comentarios');
      const api = await simularApi(page, {
        ...(await sessaoDeAluno(page)), ...cheia, ...rotas,
        'POST /aluno/comunidade/aulas/{id}/comentarios': (p, route) => {
          const novo: ComentarioDoMural = {
            ...COMENTARIOS[0], id: 'c3', autorId: ALUNO.id, autorNome: ALUNO.nome, autorApelido: null, texto: (p.corpo as { texto: string }).texto,
          };
          estado.lista.push(novo);
          return json(route, novo);
        },
      });
      await page.goto('/aluno/comunidade?aba=auloes');
      const abrir = page.getByRole('button', { name: 'Ver 2 comentário(s) do aulão Aulão de técnica' });
      expect((await abrir.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await capturar(page, `aluno-aulao-com-comentarios-${largura}`);
      await abrir.click();
      const folha = page.getByRole('dialog', { name: 'Comentários' });
      await expect(folha.getByText('Bora, time!')).toBeVisible();
      await folha.getByRole('textbox', { name: 'Seu comentário' }).fill('Aulão excelente');
      await folha.getByRole('button', { name: /^Comentar/ }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/aluno/comunidade/aulas/a1/comentarios'))?.corpo).toEqual({ texto: 'Aulão excelente' });
      await expect(folha.getByText('Aulão excelente', { exact: true })).toBeVisible();
      await capturar(page, `aluno-aulao-comentarios-${largura}`);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Ver 3 comentário(s) do aulão Aulão de técnica' })).toBeVisible();
      expect(api.pedidos.filter((p) => p.metodo === 'GET' && p.caminho.endsWith('/comentarios')).map((p) => p.caminho))
        .toEqual(['/aluno/comunidade/aulas/a1/comentarios']);
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: aulão fora do alcance (404) diz "Aulão não disponível"; erro comum tem "Tentar de novo"', async ({ page }) => {
      let resposta: '404' | '503' | 'ok' = '404';
      await simularApi(page, {
        ...(await sessaoDeAluno(page)), ...cheia,
        'GET /aluno/comunidade/aulas/{id}/comentarios': (p, route) => {
          if (resposta === 'ok') return json(route, paginaDe([], p));
          const e = resposta === '404' ? erroApi(404, 'Aula não encontrada.', 'NAO_ENCONTRADO') : erroApi(503, 'Indisponível.');
          return json(route, e.corpo, e.status);
        },
      });
      await page.goto('/aluno/comunidade?aba=auloes');
      const abrir = page.getByRole('button', { name: /^Ver 0 comentário\(s\) do aulão/ });
      await abrir.click();
      const folha = page.getByRole('dialog', { name: 'Comentários' });
      await expect(folha.getByText('Aulão não disponível')).toBeVisible();
      await expect(folha.getByText('Este aulão saiu da Comunidade.')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);
      await expect(folha.getByRole('textbox', { name: 'Seu comentário' })).toHaveCount(0);
      await capturar(page, `aluno-aulao-comentarios-404-${largura}`);
      await page.keyboard.press('Escape');
      await expect(folha).toHaveCount(0);

      resposta = '503';
      await abrir.click();
      await expect(folha.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
      resposta = 'ok';
      await folha.getByRole('button', { name: 'Tentar de novo' }).click();
      await expect(folha.getByText('Ninguém comentou ainda.')).toBeVisible();
      await capturar(page, `aluno-aulao-comentarios-vazio-${largura}`);
    });

    for (const [nome, t, contraste] of TEMAS) {
      test(`aluno: comentários do aulão no tema ${nome}`, async ({ page }) => {
        await tema(page, ALUNO.id, t, contraste);
        const { rotas } = comComentariosDaAula('/aluno/comunidade/aulas', '/aluno/comunidade/aulas/{id}/comentarios', varios(32));
        await simularApi(page, { ...(await sessaoDeAluno(page)), ...cheia, ...rotas });
        await page.goto('/aluno/comunidade?aba=auloes');
        const verComentarios = page.getByRole('button', { name: /^Ver 32 comentário\(s\) do aulão/ });
        await expect(verComentarios).toBeVisible();
        await capturar(page, `aluno-auloes-tema-${nome}-${largura}`);
        await verComentarios.click();
        const folha = page.getByRole('dialog', { name: 'Comentários' });
        await expect(folha.getByText('Mostrando 30 de 32 comentários.')).toBeVisible();
        await folha.getByRole('textbox', { name: 'Seu comentário' }).fill('a'.repeat(270));
        await expect(folha.getByText('270/280 · faltam 10')).toBeVisible();
        await folha.getByRole('button', { name: 'Carregar mais comentários' }).scrollIntoViewIfNeeded();
        await capturar(page, `aluno-aulao-comentarios-tema-${nome}-${largura}`);
      });
    }

    test('aluno: post fora do alcance (404) diz "Post não disponível" sem tentar de novo; sem internet o campo trava com o motivo', async ({ page }) => {
      let lista: 'ok' | '404' = '404';
      await simularApi(page, {
        ...(await sessaoDeAluno(page)), ...cheia,
        'GET /aluno/comunidade/mural/{id}/comentarios': (_p, route) => {
          if (lista === 'ok') return json(route, { itens: COMENTARIOS, total: COMENTARIOS.length });
          const e = erroApi(404, 'Post não encontrado.', 'NAO_ENCONTRADO');
          return json(route, e.corpo, e.status);
        },
      });
      await page.goto('/aluno/comunidade');
      await page.getByRole('button', { name: 'Ver 4 comentário(s)' }).click();
      const folha = page.getByRole('dialog', { name: 'Comentários' });
      await expect(folha.getByText('Post não disponível')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);
      await expect(folha.getByRole('textbox', { name: 'Seu comentário' })).toHaveCount(0);
      await capturar(page, `aluno-comentarios-404-${largura}`);
      await page.keyboard.press('Escape');

      lista = 'ok';
      await page.getByRole('button', { name: 'Ver 4 comentário(s)' }).click();
      await expect(folha.getByText('Bora, time!')).toBeVisible();
      const campo = folha.getByRole('textbox', { name: 'Seu comentário' });
      await campo.fill('Rascunho');
      await page.context().setOffline(true);
      await expect(folha.getByText('Sem conexão. Comentar precisa de internet.')).toBeVisible();
      await expect(campo).not.toBeEditable();
      await expect(folha.getByRole('button', { name: /^Comentar/ })).toBeDisabled();
      await expect(campo).toHaveValue('Rascunho');
      await capturar(page, `aluno-comentarios-offline-${largura}`);
      await page.context().setOffline(false);
    });

    test('aluno: post sem comentários mostra "Ninguém comentou ainda."', async ({ page }) => {
      await simularApi(page, { ...(await sessaoDeAluno(page)), ...cheia, 'GET /aluno/comunidade/mural/{id}/comentarios': { corpo: { itens: [], total: 0 } } });
      await page.goto('/aluno/comunidade');
      await page.getByRole('button', { name: 'Ver 0 comentário(s)' }).click();
      await expect(page.getByRole('dialog', { name: 'Comentários' }).getByText('Ninguém comentou ainda.')).toBeVisible();
      await capturar(page, `aluno-comentarios-vazio-${largura}`);
    });

    for (const [nome, t, contraste] of TEMAS) {
      test(`aluno: comentários no tema ${nome}`, async ({ page }) => {
        await tema(page, ALUNO.id, t, contraste);
        const { rotas } = comComentarios('/aluno/comunidade/mural', '/aluno/comunidade/mural/{id}/comentarios');
        await simularApi(page, { ...(await sessaoDeAluno(page)), ...cheia, ...rotas });
        await page.goto('/aluno/comunidade');
        await page.getByRole('button', { name: 'Ver 2 comentário(s)' }).click();
        await expect(page.getByRole('dialog', { name: 'Comentários' }).getByText('Mandou bem.')).toBeVisible();
        await capturar(page, `aluno-comentarios-tema-${nome}-${largura}`);
      });
    }

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

    const abrirTreinador = async (page: Page, respostas: RespostasApi, permissoes = [...PERMISSOES_TREINADOR, 'TREINO_LER', 'COMUNIDADE_MODERAR']) =>
      simularApi(page, { ...(await sessao(page, TREINADOR, { permissoes })), ...respostas });

    test('treinador: aulões e mural com dados, sem ranking nem curtida', async ({ page }) => {
      await tema(page, TREINADOR.id, 'CLARO');
      const api = await abrirTreinador(page, cheia);
      await page.goto('/treinador/comunidade');
      await expect(page.getByRole('heading', { level: 1, name: 'Comunidade' })).toBeVisible();
      await expect(page.getByText('Técnica', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Abrir vídeo: Aulão de técnica' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Ranking' })).toHaveCount(0);
      // Uma ação principal por vez, a da aba ativa, no cabeçalho (guia pág. 35).
      await expect(page.getByRole('button', { name: 'Novo aulão' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Nova publicação' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Configurações do mural' })).toHaveCount(0);
      // Coluna de leitura de 800 px (D10): o título da tela não passa dela, mesmo com a janela larga.
      if (largura >= 1280) {
        const titulo = await page.getByRole('heading', { level: 1, name: 'Comunidade' }).boundingBox();
        const acao = await page.getByRole('button', { name: 'Novo aulão' }).boundingBox();
        expect(acao!.x + acao!.width - titulo!.x).toBeLessThanOrEqual(800);
      }
      await capturar(page, `treinador-auloes-${largura}`);

      await page.getByRole('tab', { name: 'Mural' }).click();
      await expect(page.getByText('Treino feito.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Novo aulão' })).toHaveCount(0);
      // As chaves não ficam mais no caminho de leitura: só o acesso "Configurações do mural".
      await expect(page.getByRole('button', { name: 'Configurações do mural' })).toBeVisible();
      await expect(page.getByRole('switch')).toHaveCount(0);
      await expect(page.getByText('Quem publica no mural')).toHaveCount(0);
      await expect(page.getByText('Fixado', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Curtir' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      await novaPublicacao(page).getByRole('textbox', { name: 'Texto', exact: true }).fill('Rascunho de teste');
      await novaPublicacao(page).getByRole('button', { name: 'Cancelar' }).click();
      await page.getByRole('tab', { name: 'Aulões' }).click();
      await expect(page).toHaveURL(/aba=auloes/);
      await capturar(page, `treinador-mural-${largura}`);
      // A aba mora no endereço e a tela continua montada: o rascunho do mural continua lá.
      await page.getByRole('tab', { name: 'Mural' }).click();
      await expect(page).toHaveURL(/aba=mural/);
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      await expect(novaPublicacao(page).getByRole('textbox', { name: 'Texto', exact: true })).toHaveValue('Rascunho de teste');
      expect(api.naoTratadas.filter((r) => r.includes('/comunidade'))).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('treinador: publica aviso (nasce fixado, a tela diz) e vídeo (link https conferido no envio)', async ({ page }) => {
      const api = await abrirTreinador(page, { ...vazia, 'POST /comunidade/mural': { corpo: { ...POST, id: 'novo' } } });
      await page.goto('/treinador/comunidade?aba=mural');
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      const folha = novaPublicacao(page);
      await folha.getByRole('radio', { name: 'Aviso', exact: true }).click();
      await expect(folha.getByText(/O aviso nasce fixado no topo do mural/)).toBeVisible();
      await folha.getByRole('textbox', { name: 'Texto', exact: true }).fill('Recado do time');
      await capturar(page, `treinador-nova-publicacao-aviso-${largura}`);
      await folha.getByRole('button', { name: /^Publicar/ }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/comunidade/mural'))?.corpo).toEqual({ tipo: 'AVISO', texto: 'Recado do time' });
      await expect(folha).toHaveCount(0);

      await page.getByRole('button', { name: 'Nova publicação' }).click();
      await folha.getByRole('radio', { name: 'Vídeo', exact: true }).click();
      await folha.getByRole('textbox', { name: 'Título do vídeo' }).fill('Vídeo de teste');
      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill('http://video.exemplo.invalid/aula');
      await folha.getByRole('button', { name: /^Publicar/ }).click();
      await expect(folha.getByText(/https/)).toBeVisible();
      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill('https://video.exemplo.invalid/aula');
      await folha.getByRole('button', { name: /^Publicar/ }).click();
      await expect.poll(() => api.pedidos.filter((p) => foiPost(p, '/comunidade/mural')).map((p) => p.corpo))
        .toEqual([{ tipo: 'AVISO', texto: 'Recado do time' }, { tipo: 'VIDEO', texto: 'Vídeo de teste', videoUrl: 'https://video.exemplo.invalid/aula' }]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('treinador: "Configurações do mural" abre a folha; as chaves mudam na hora, o PUT manda as duas e a recusa volta com o erro na folha', async ({ page }) => {
      let recusar = false;
      const api = await abrirTreinador(page, {
        ...cheia,
        'PUT /comunidade/configuracao': (p, route) => {
          if (recusar) { const e = erroApi(409, 'Configuração recusada.', 'CONFLITO_EDICAO'); return json(route, e.corpo, e.status); }
          return json(route, p.corpo);
        },
      });
      await page.goto('/treinador/comunidade?aba=mural');
      await expect(page.getByRole('switch')).toHaveCount(0);
      await page.getByRole('button', { name: 'Configurações do mural' }).click();
      const folha = page.getByRole('dialog', { name: 'Configurações do mural' });
      const publicar = folha.getByRole('switch', { name: 'Alunos podem publicar' });
      const fotos = folha.getByRole('switch', { name: 'Alunos podem anexar fotos' });
      await expect(publicar).toBeChecked();
      await expect(fotos).not.toBeChecked();
      await capturar(page, `treinador-chaves-${largura}`);
      await fotos.click();
      await expect(fotos).toBeChecked();
      await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').map((p) => p.corpo)).toEqual([{ alunosPublicam: true, alunosAnexamFotos: true }]);

      recusar = true;
      await publicar.click();
      // A recusa fica dentro da folha (o aviso de rodapé ficaria atrás do véu).
      await expect(folha.getByText('Configuração recusada.')).toBeVisible();
      await expect(publicar).toBeChecked();
      expect(api.pedidos.filter((p) => p.metodo === 'PUT').at(-1)?.corpo).toEqual({ alunosPublicam: false, alunosAnexamFotos: true });
      await page.keyboard.press('Escape');
      await expect(folha).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Configurações do mural' })).toBeFocused();
      expect(api.errosDaPagina).toEqual([]);
    });

    test('treinador: moderação pelo ⋯ — desafixar, denunciados com a contagem, dispensar e remover com confirmação', async ({ page }) => {
      const DENUNCIADO: PostDoMural = { ...POST_CURTIDO, denuncias: 2 };
      const api = await abrirTreinador(page, {
        ...cheia,
        'GET /comunidade/mural': (p, route) => json(route, p.busca.get('denunciados') === 'true' ? pagina(DENUNCIADO) : pagina(POST, DENUNCIADO)),
        'POST /comunidade/mural/{id}/fixar': { status: 204 },
        'POST /comunidade/mural/{id}/denuncias/dispensar': { status: 204 },
        'DELETE /comunidade/mural/{id}': { status: 204 },
      });
      await page.goto('/treinador/comunidade?aba=mural');
      await expect(page.getByText('2 denúncias', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Ações da publicação de Treinadora Teste' }).click();
      const menu = page.getByRole('dialog', { name: 'Ações da publicação' });
      await expect(menu.getByRole('button', { name: /^Dispensar denúncias/ })).toHaveCount(0);
      await menu.getByRole('button', { name: /^Desafixar/ }).click();
      await expect.poll(() => api.pedidos.some((p) => foiPost(p, '/comunidade/mural/p1/fixar'))).toBe(true);
      await expect(page.getByText('Publicação desafixada.')).toBeVisible();

      await page.getByRole('radio', { name: 'Denunciados', exact: true }).click();
      await expect.poll(() => api.pedidos.some((p) => p.caminho === '/comunidade/mural' && p.busca.get('denunciados') === 'true')).toBe(true);
      await expect(page.getByText('Semana de constância, time!')).toHaveCount(0);
      await capturar(page, `treinador-denunciados-${largura}`);
      await page.getByRole('button', { name: 'Ações da publicação de Aluno Fictício' }).click();
      await menu.getByRole('button', { name: /^Dispensar denúncias/ }).click();
      await expect.poll(() => api.pedidos.some((p) => foiPost(p, '/comunidade/mural/p2/denuncias/dispensar'))).toBe(true);

      await page.getByRole('button', { name: 'Ações da publicação de Aluno Fictício' }).click();
      await menu.getByRole('button', { name: /^Remover publicação/ }).click();
      const painel = page.getByRole('alertdialog', { name: 'Remover a publicação?' });
      await painel.getByRole('button', { name: 'Cancelar' }).click();
      expect(api.pedidos.some((p) => p.metodo === 'DELETE')).toBe(false);
      await page.getByRole('button', { name: 'Ações da publicação de Aluno Fictício' }).click();
      await menu.getByRole('button', { name: /^Remover publicação/ }).click();
      await painel.getByRole('button', { name: 'Remover publicação' }).click();
      await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'DELETE').map((p) => p.caminho)).toEqual(['/comunidade/mural/p2']);
      expect(api.naoTratadas.filter((r) => r.includes('/comunidade'))).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('treinador: sem COMUNIDADE_MODERAR (mesmo com TREINO_ALTERAR) lê, mas não publica nem remove apelido', async ({ page }) => {
      await abrirTreinador(page, cheia, [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR']);
      await page.goto('/treinador/comunidade');
      await expect(page.getByText('Aulão de técnica')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Novo aulão' })).toHaveCount(0);
      await page.getByRole('tab', { name: 'Mural' }).click();
      await expect(page.getByText('Treino feito.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Nova publicação' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Configurações do mural' })).toHaveCount(0);
      await expect(page.getByRole('switch')).toHaveCount(0);
      await expect(page.getByRole('radio', { name: 'Denunciados', exact: true })).toHaveCount(0);
      // O apelido aparece para todos; só a moderação (o ⋯) some.
      await expect(page.getByText('«Fictí»')).toBeVisible();
      await expect(page.getByRole('button', { name: /^Ações da publicação/ })).toHaveCount(0);
    });

    test('treinador: "Remover apelido" pede confirmação, chama o DELETE e recarrega o mural', async ({ page }) => {
      let semApelido = false;
      const api = await abrirTreinador(page, {
        ...cheia,
        'GET /comunidade/mural': (_p, route) => json(route, pagina(POST, { ...POST_CURTIDO, autorApelido: semApelido ? null : 'Fictí' })),
        'DELETE /comunidade/perfis/{id}/apelido': (_p, route) => { semApelido = true; return route.fulfill({ status: 204 }); },
      });
      await page.goto('/treinador/comunidade?aba=mural');
      await expect(page.getByText('«Fictí»')).toBeVisible();
      const menu = page.getByRole('dialog', { name: 'Ações da publicação' });
      // Só o post do aluno com apelido tem a ação; o da equipe (sem apelido) não.
      await page.getByRole('button', { name: 'Ações da publicação de Treinadora Teste' }).click();
      await expect(menu.getByRole('button', { name: /^Remover apelido/ })).toHaveCount(0);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Ações da publicação de Aluno Fictício' }).click();
      await menu.getByRole('button', { name: /^Remover apelido/ }).click();
      const painel = page.getByRole('alertdialog', { name: 'Remover o apelido?' });
      await expect(painel.getByText(/O apelido «Fictí» sai de Aluno Fictício/)).toBeVisible();
      await capturar(page, `treinador-remover-apelido-${largura}`);
      await painel.getByRole('button', { name: 'Cancelar' }).click();
      await expect(painel).toHaveCount(0);
      expect(api.pedidos.some((p) => p.metodo === 'DELETE')).toBe(false);

      await page.getByRole('button', { name: 'Ações da publicação de Aluno Fictício' }).click();
      await menu.getByRole('button', { name: /^Remover apelido/ }).click();
      await painel.getByRole('button', { name: 'Remover apelido' }).click();
      await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'DELETE').map((p) => p.caminho)).toEqual(['/comunidade/perfis/u2/apelido']);
      await expect(page.getByText('«Fictí»')).toHaveCount(0);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('treinador: com COMUNIDADE_MODERAR responde como equipe no post; o comentário entra com o selo', async ({ page }) => {
      const { estado, rotas } = comComentarios('/comunidade/mural', '/comunidade/mural/{id}/comentarios');
      const api = await abrirTreinador(page, {
        ...cheia, ...rotas,
        'POST /comunidade/mural/{id}/comentarios': (p, route) => {
          const novo: ComentarioDoMural = {
            id: 'c3', autorId: TREINADOR.id, autorNome: TREINADOR.nome, autorApelido: null, autorEhAluno: false, autorFotoUrl: null,
            texto: (p.corpo as { texto: string }).texto.trim(), criadoEm: '2026-10-20T09:00:00-03:00', daEquipe: true,
          };
          estado.lista.push(novo);
          return json(route, novo);
        },
      });
      await page.goto('/treinador/comunidade?aba=mural');
      await page.getByRole('button', { name: 'Ver 2 comentário(s)' }).click();
      const folha = page.getByRole('dialog', { name: 'Comentários' });
      await expect(folha.getByText('Equipe', { exact: true })).toHaveCount(1);
      await folha.getByRole('textbox', { name: 'Responder como equipe' }).fill('Resposta de teste da equipe.');
      await folha.getByRole('button', { name: /^Comentar/ }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/comunidade/mural/p1/comentarios'))?.corpo).toEqual({ texto: 'Resposta de teste da equipe.' });
      await expect(folha.getByText('Resposta de teste da equipe.')).toBeVisible();
      await expect(folha.getByText('Equipe', { exact: true })).toHaveCount(2);
      await capturar(page, `treinador-comentar-como-equipe-${largura}`);
      expect(api.naoTratadas.filter((r) => r.includes('/comunidade'))).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('treinador: lê os comentários e remove com confirmação; 404 tira da lista', async ({ page }) => {
      const { estado, rotas } = comComentarios('/comunidade/mural', '/comunidade/mural/{id}/comentarios');
      const api = await abrirTreinador(page, {
        ...cheia, ...rotas,
        'DELETE /comunidade/mural/comentarios/{id}': (p, route) => {
          const id = p.caminho.split('/').pop();
          estado.lista = estado.lista.filter((c) => c.id !== id);
          // c2 já tinha sido removido por outra pessoa: a API responde 404.
          if (id === 'c2') { const e = erroApi(404, 'Comentário não encontrado.', 'NAO_ENCONTRADO'); return json(route, e.corpo, e.status); }
          return route.fulfill({ status: 204 });
        },
      });
      await page.goto('/treinador/comunidade?aba=mural');
      await page.getByRole('button', { name: 'Ver 2 comentário(s)' }).click();
      const folha = page.getByRole('dialog', { name: 'Comentários' });
      await expect(folha.getByText('Bora, time!')).toBeVisible();
      await expect(folha.getByText('«Fictí»')).toBeVisible();
      // O comentário da equipe leva o selo; nenhum autor vira link para ela.
      await expect(folha.getByText('Equipe', { exact: true })).toHaveCount(1);
      await expect(folha.getByRole('button', { name: /^Ver perfil/ })).toHaveCount(0);
      await expect(folha.getByRole('button', { name: /^Remover comentário de / })).toHaveCount(2);
      await capturar(page, `treinador-comentarios-${largura}`);

      await folha.getByRole('button', { name: 'Remover comentário de Aluno Fictício' }).click();
      const painel = page.getByRole('alertdialog', { name: 'Remover o comentário?' });
      await expect(painel.getByText('O comentário de Aluno Fictício sai do mural para todos.')).toBeVisible();
      await capturar(page, `treinador-comentarios-remover-${largura}`);
      await painel.getByRole('button', { name: 'Cancelar' }).click();
      await expect(painel).toHaveCount(0);
      expect(api.pedidos.some((p) => p.metodo === 'DELETE')).toBe(false);

      await folha.getByRole('button', { name: 'Remover comentário de Aluno Fictício' }).click();
      await painel.getByRole('button', { name: 'Remover comentário' }).click();
      await expect(painel).toHaveCount(0);
      await expect(folha.getByText('Bora, time!')).toHaveCount(0);

      await folha.getByRole('button', { name: 'Remover comentário de Treinadora Teste' }).click();
      await painel.getByRole('button', { name: 'Remover comentário' }).click();
      await expect(painel).toHaveCount(0);
      await expect(folha.getByText('Ninguém comentou ainda.')).toBeVisible();
      expect(api.pedidos.filter((p) => p.metodo === 'DELETE').map((p) => p.caminho))
        .toEqual(['/comunidade/mural/comentarios/c1', '/comunidade/mural/comentarios/c2']);
      await page.keyboard.press('Escape');
      // O post de teste e o outro post do mural ficam com zero.
      await expect(page.getByRole('button', { name: 'Ver 0 comentário(s)' })).toHaveCount(2);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('treinador: sem COMUNIDADE_MODERAR lê os comentários, sem "Remover comentário"', async ({ page }) => {
      const { rotas } = comComentarios('/comunidade/mural', '/comunidade/mural/{id}/comentarios');
      await abrirTreinador(page, { ...cheia, ...rotas }, [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR']);
      await page.goto('/treinador/comunidade?aba=mural');
      await page.getByRole('button', { name: 'Ver 2 comentário(s)' }).click();
      const folha = page.getByRole('dialog', { name: 'Comentários' });
      await expect(folha.getByText('Mandou bem.')).toBeVisible();
      await expect(folha.getByRole('button', { name: /Remover comentário/ })).toHaveCount(0);
      await expect(folha.getByRole('textbox')).toHaveCount(0);
    });

    test('treinador: comentários do aulão; lê sem campo, remove com confirmação e o total do aulão desce', async ({ page }) => {
      const { estado, rotas } = comComentariosDaAula('/comunidade/aulas', '/comunidade/aulas/{id}/comentarios', varios(31));
      const api = await abrirTreinador(page, {
        ...cheia, ...rotas,
        'DELETE /comunidade/aulas/comentarios/{id}': (p, route) => {
          estado.lista = estado.lista.filter((c) => c.id !== p.caminho.split('/').pop());
          return route.fulfill({ status: 204 });
        },
      });
      await page.goto('/treinador/comunidade');
      await capturar(page, `treinador-auloes-comentarios-${largura}`);
      await page.getByRole('button', { name: 'Ver 31 comentário(s) do aulão Aulão de técnica' }).click();
      const folha = page.getByRole('dialog', { name: 'Comentários' });
      await expect(folha.getByText('Comentário de teste 1', { exact: true })).toBeVisible();
      await expect(folha.getByText('Mostrando 30 de 31 comentários.')).toBeVisible();
      // A equipe não comenta no aulão (a rota existe na API, o app não a oferece).
      await expect(folha.getByRole('textbox')).toHaveCount(0);
      await expect(folha.getByRole('button', { name: /^Comentar/ })).toHaveCount(0);

      await folha.getByRole('button', { name: 'Remover comentário de Aluno Fictício' }).first().click();
      const painel = page.getByRole('alertdialog', { name: 'Remover o comentário?' });
      await expect(painel.getByText('O comentário de Aluno Fictício sai do aulão para todos.')).toBeVisible();
      await capturar(page, `treinador-aulao-comentarios-remover-${largura}`);
      await painel.getByRole('button', { name: 'Remover comentário' }).click();
      await expect(painel).toHaveCount(0);
      await expect(folha.getByText('Comentário de teste 1', { exact: true })).toHaveCount(0);
      // Depois da remoção a API andou uma posição: o "Carregar mais" pede a página que ainda tem o próximo e ninguém é pulado.
      await folha.getByRole('button', { name: 'Carregar mais comentários' }).click();
      await expect(folha.getByText('Comentário de teste 31', { exact: true })).toBeVisible();
      await expect(folha.getByText(/^Comentário de teste \d+$/)).toHaveCount(30);
      expect(api.pedidos.filter((p) => p.metodo === 'DELETE').map((p) => p.caminho)).toEqual(['/comunidade/aulas/comentarios/v1']);
      expect(api.pedidos.some((p) => foiPost(p, '/comunidade/aulas/a1/comentarios'))).toBe(false);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Ver 30 comentário(s) do aulão Aulão de técnica' })).toBeVisible();
      // Só as rotas dos comentários importam aqui (o menu do treinador consulta outras, como nos demais casos da equipe).
      expect(api.naoTratadas.filter((r) => r.includes('/comunidade'))).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('treinador: aulão fora do alcance (404) diz "Aulão não disponível"; sem COMUNIDADE_MODERAR não há "Remover"', async ({ page }) => {
      let resposta: '404' | 'ok' = '404';
      await abrirTreinador(page, {
        ...cheia,
        'GET /comunidade/aulas': { corpo: [{ ...AULA, totalComentarios: 2 }] },
        'GET /comunidade/aulas/{id}/comentarios': (p, route) => {
          if (resposta === 'ok') return json(route, paginaDe(COMENTARIOS, p));
          const e = erroApi(404, 'Aula não encontrada.', 'NAO_ENCONTRADO');
          return json(route, e.corpo, e.status);
        },
      }, [...PERMISSOES_TREINADOR, 'TREINO_LER']);
      await page.goto('/treinador/comunidade');
      const abrir = page.getByRole('button', { name: 'Ver 2 comentário(s) do aulão Aulão de técnica' });
      await abrir.click();
      const folha = page.getByRole('dialog', { name: 'Comentários' });
      await expect(folha.getByText('Aulão não disponível')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(folha).toHaveCount(0);
      resposta = 'ok';
      await abrir.click();
      await expect(folha.getByText('Mandou bem.')).toBeVisible();
      await expect(folha.getByRole('button', { name: /Remover comentário/ })).toHaveCount(0);
    });

    for (const [nome, t, contraste] of TEMAS) {
      test(`treinador: comentários no tema ${nome}`, async ({ page }) => {
        await tema(page, TREINADOR.id, t, contraste);
        const { rotas } = comComentarios('/comunidade/mural', '/comunidade/mural/{id}/comentarios');
        await abrirTreinador(page, { ...cheia, ...rotas });
        await page.goto('/treinador/comunidade?aba=mural');
        await page.getByRole('button', { name: 'Ver 2 comentário(s)' }).click();
        await expect(page.getByRole('dialog', { name: 'Comentários' }).getByText('Mandou bem.')).toBeVisible();
        await capturar(page, `treinador-comentarios-tema-${nome}-${largura}`);
      });
    }

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

    test('treinador: falha sem campo (503) ao publicar o aulão aparece no rodapé da folha, que continua aberta', async ({ page }) => {
      const e = erroApi(503, 'Comunidade indisponível agora.');
      await abrirTreinador(page, { ...vazia, 'POST /comunidade/aulas': (_p, route) => json(route, e.corpo, e.status) });
      await page.goto('/treinador/comunidade');
      await page.getByRole('button', { name: 'Novo aulão' }).click();
      const folha = page.getByRole('dialog', { name: 'Novo aulão' });
      await folha.getByRole('textbox', { name: 'Título' }).fill('Aulão de teste');
      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill('https://exemplo.test/video');
      await folha.getByRole('button', { name: 'Publicar para o time' }).click();
      await expect(folha.getByText('Comunidade indisponível agora.')).toBeVisible();
      await expect(folha.getByRole('textbox', { name: 'Título' })).toHaveValue('Aulão de teste');
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
