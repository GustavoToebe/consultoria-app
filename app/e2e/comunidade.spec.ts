import { expect, test, type Page, type Route } from '@playwright/test';

import type {
  AulaDaComunidade, ComentarioDoMural, ConquistaDoAluno, EnqueteDoMural, PaginaDeComentarios, PaginaDoMural, PerfilDaComunidade, PlaylistDaComunidade,
  PosicaoNoRanking, PostDoMural, VotosDaEnquete,
} from '../src/api/comunidadeTipos';
import type { EuResponse } from '../src/api/tipos';
import { MEUS_DADOS_VAZIOS, sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso, type Resposta, type RespostasApi } from './api-falsa';

/**
 * Comunidade do aluno e do treinador, com a API simulada nas rotas e nos formatos reais (`/aluno/comunidade/{aulas, mural,
 * mural/{id}/reacoes, conquistas, ranking}` e `/comunidade/{aulas, mural}`). Só dados fictícios. O erro da API chega à tela
 * como erro de verdade, com "Tentar de novo": o cliente não troca falha por dado de exemplo.
 */
const POST: PostDoMural = {
  id: 'p1', autorId: 'u1', autorNome: 'Treinadora Teste', autorApelido: null, autorEhAluno: false, autorFotoUrl: null, texto: 'Semana de constância, time!',
  tipo: 'CONVERSA', videoUrl: null, capaId: null, enquete: null, fotos: [], respondida: false, fixado: true, criadoEm: '2026-10-19T12:00:00-03:00',
  reacoes: { CURTIR: 2, FOGO: 5 }, minhasReacoes: [], totalComentarios: 4, podId: null, podNome: null,
};
const POST_CURTIDO: PostDoMural = {
  ...POST, id: 'p2', autorId: 'u2', autorNome: 'Aluno Fictício', autorApelido: 'Fictí', autorEhAluno: true, texto: 'Treino feito.', fixado: false,
  reacoes: { CURTIR: 1 }, minhasReacoes: ['CURTIR'], totalComentarios: 0,
};
const pagina = (...content: PostDoMural[]): PaginaDoMural => ({ content, totalElements: content.length });
/**
 * Como a API manda a um ALUNO (V085): o servidor já monta o nome do autor (aqui, a escolha "Nome e apelido": "Aluno (Fictí)")
 * e `autorApelido` chega nulo. A equipe continua recebendo o nome completo e o apelido à parte (os fixtures como estão).
 */
const NOME_DO_COLEGA = 'Aluno (Fictí)';
function comoAluno<T extends { autorNome: string; autorApelido: string | null }>(p: PedidoFalso, x: T): T {
  if (!p.caminho.startsWith('/aluno/') || !x.autorApelido) return x;
  return { ...x, autorNome: `${x.autorNome.split(' ')[0]} (${x.autorApelido})`, autorApelido: null };
}
/**
 * O mural como a API: só os posts do `?tipo=` pedido. Cada aba do mural (C39) pede um tipo por vez (Avisos: aviso, vídeo e
 * enquete; Alunos: conversa, dúvida e resultado) e junta as respostas.
 */
const doTipo = (p: PedidoFalso, ...posts: PostDoMural[]) =>
  pagina(...posts.filter((x) => !p.busca.get('tipo') || x.tipo === p.busca.get('tipo')).map((x) => comoAluno(p, x)));
const muralFalso = (...posts: PostDoMural[]): Resposta => (p, route) => json(route, doTipo(p, ...posts));
// POST e POST_CURTIDO são conversas: moram na aba Alunos (a padrão é Avisos).
const MURAL_DOS_ALUNOS = '/aluno/comunidade?mural=alunos';
const MURAL_DOS_ALUNOS_DA_EQUIPE = '/treinador/comunidade?aba=mural&mural=alunos';
const AULA: AulaDaComunidade = {
  id: 'a1', titulo: 'Vídeo de técnica', descricao: 'Pauta do vídeo de teste.', videoUrl: 'https://exemplo.test/video', capaId: null,
  playlistId: null, ordem: 0, publicada: true, criadaEm: '2026-10-19T12:00:00-03:00', totalComentarios: 0,
};
/** Coleções na ordem do treinador (a API manda fora de ordem de propósito nos testes que conferem). */
const PLAYLIST_TECNICA: PlaylistDaComunidade = { id: 'p1', nome: 'Técnica', ordem: 0, totalAulas: 2 };
const PLAYLIST_ALIMENTACAO: PlaylistDaComunidade = { id: 'p2', nome: 'Alimentação', ordem: 1, totalAulas: 1 };
const CONQUISTAS: ConquistaDoAluno[] = [
  { id: 'c1', tipo: 'PRIMEIRO_TREINO', titulo: 'Primeiro treino', descricao: 'Concluiu o primeiro treino.', icone: 'award', conquistadaEm: '2026-10-19T12:00:00-03:00' },
];
// Colega visível como a API manda (V070): conquistas sem id nem horário, sem foto; o nome já montado (V085).
const PERFIL: PerfilDaComunidade = {
  autorId: 'u2', nome: NOME_DO_COLEGA, ehVoce: false, reservado: false, treinosConcluidos: 8, nivel: 2,
  conquistas: CONQUISTAS.map(({ tipo, titulo, descricao, icone }) => ({ tipo, titulo, descricao, icone })), destaques: [],
  temFoto: false, atividade: { diasTreinadosUltimos30: [], ultimasConquistas: [] }, recordes: [],
};
const RANKING: PosicaoNoRanking = { posicao: 2, treinosConcluidos: 8, pontuacao: 80, participantes: 12, nivel: 2, xp: 130, xpNoNivel: 30, faltam: 70 };

const COMENTARIOS: ComentarioDoMural[] = [
  { id: 'c1', autorId: 'u2', autorNome: 'Aluno Fictício', autorApelido: 'Fictí', autorEhAluno: true, autorFotoUrl: null, texto: 'Bora, time!', criadoEm: '2026-10-19T13:00:00-03:00', daEquipe: false },
  { id: 'c2', autorId: 'u1', autorNome: 'Treinadora Teste', autorApelido: null, autorEhAluno: false, autorFotoUrl: null, texto: 'Mandou bem.', criadoEm: '2026-10-19T14:00:00-03:00', daEquipe: true },
];

/** Uma página da lista, como a API: `?pagina=` (0 primeiro) e `?tamanho=` (padrão 30), `{itens, total}`. */
function paginaDe(lista: ComentarioDoMural[], p: PedidoFalso): PaginaDeComentarios {
  const n = Number(p.busca.get('pagina') ?? 0);
  const tamanho = Number(p.busca.get('tamanho') ?? 30);
  return { itens: lista.slice(n * tamanho, (n + 1) * tamanho).map((c) => comoAluno(p, c)), total: lista.length };
}

/** Mural e comentários com estado: o total do post acompanha a lista, como na API (só os não ocultos). */
function comComentarios(caminhoDoMural: string, rotaDaLista: string, inicial: ComentarioDoMural[] = COMENTARIOS) {
  const estado = { lista: [...inicial] };
  const rotas: RespostasApi = {
    [`GET ${caminhoDoMural}`]: (p, route) => json(route, doTipo(p, { ...POST, totalComentarios: estado.lista.length }, POST_CURTIDO)),
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
  'GET /aluno/comunidade/mural': muralFalso(POST, POST_CURTIDO),
  'GET /aluno/comunidade/aulas': { corpo: [AULA] },
  'GET /aluno/comunidade/conquistas': { corpo: CONQUISTAS },
  'GET /aluno/comunidade/ranking': { corpo: RANKING },
  'PUT /aluno/comunidade/mural/{id}/reacoes/{codigo}': { status: 204 },
  'DELETE /aluno/comunidade/mural/{id}/reacoes/{codigo}': { status: 204 },
  'GET /comunidade/mural': muralFalso(POST, POST_CURTIDO),
  'GET /comunidade/aulas': { corpo: [AULA] },
  'GET /comunidade/pods': { corpo: [] },
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
  'GET /comunidade/pods': { corpo: [] },
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

/**
 * Filtros no painel lateral (`docs/planos/filtros-laterais.md`): o botão "Filtros, …" abre o diálogo "Filtros do mural" ou
 * "Filtros de aulões"; as escolhas são rascunho e só valem no "Aplicar filtros".
 */
const botaoFiltros = (page: Page) => page.getByRole('button', { name: /^Filtros, / });
async function abrirPainel(page: Page, nome: string) {
  await botaoFiltros(page).click();
  const painel = page.getByRole('dialog', { name: nome });
  await expect(painel).toBeVisible();
  return painel;
}
async function aplicarFiltros(painel: ReturnType<Page['getByRole']>) {
  await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(painel).toHaveCount(0);
}
/** Escolhe a coleção no painel dos vídeos e aplica. */
async function filtrarColecao(page: Page, rotulo: string) {
  const painel = await abrirPainel(page, 'Filtros de vídeos');
  await painel.getByRole('radio', { name: rotulo, exact: true }).click();
  await aplicarFiltros(painel);
}

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

    test('aluno: mural, vídeos, conquistas e a própria posição; um h1 e selos neutros', async ({ page }) => {
      await tema(page, ALUNO.id, 'CLARO');
      const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...cheia });
      await page.goto(MURAL_DOS_ALUNOS);
      await expect(page.getByRole('heading', { level: 1, name: 'Comunidade' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByText('Semana de constância, time!')).toBeVisible();
      await expect(page.getByText('Fixado', { exact: true })).toBeVisible();
      // As cinco reações, cada uma com a própria contagem; "você reagiu" no nome e no aria-pressed, não só na cor.
      const curtirP1 = page.getByRole('button', { name: 'Curtir, 2 reações', exact: true });
      await expect(curtirP1).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByRole('button', { name: 'Fogo, 5 reações', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Risada, 0 reações', exact: true })).toHaveCount(2);
      const curtidoP2 = page.getByRole('button', { name: 'Curtir, 1 reação, você reagiu' });
      await expect(curtidoP2).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByText('4 comentários', { exact: true })).toBeVisible();
      await capturar(page, `aluno-mural-${largura}`);

      // Sem otimismo: a contagem muda quando a API confirma (204).
      await curtirP1.click();
      await expect.poll(() => api.pedidos.some((p) => p.metodo === 'PUT' && p.caminho === '/aluno/comunidade/mural/p1/reacoes/CURTIR')).toBe(true);
      await expect(page.getByRole('button', { name: 'Curtir, 3 reações, você reagiu' })).toHaveAttribute('aria-pressed', 'true');
      await curtidoP2.click();
      await expect.poll(() => api.pedidos.some((p) => p.metodo === 'DELETE' && p.caminho === '/aluno/comunidade/mural/p2/reacoes/CURTIR')).toBe(true);
      await expect(page.getByRole('button', { name: 'Curtir, 0 reações', exact: true })).toBeVisible();

      await page.getByRole('tab', { name: 'Vídeos' }).click();
      await expect(page.getByText('Pauta do vídeo de teste.')).toBeVisible();
      // Link que não é do YouTube: só o botão de abrir fora, sem player.
      await expect(page.getByRole('button', { name: 'Abrir vídeo: Vídeo de técnica' })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Assistir aqui/ })).toHaveCount(0);

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
      // Publicou de Avisos (a aba padrão): a tela segue para Alunos, onde a dúvida aparece.
      await expect(page).toHaveURL(/[?&]mural=alunos/);
      await expect(page.getByRole('radio', { name: 'Alunos', exact: true })).toBeChecked();
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: com "Alunos podem publicar" desligado, só a frase neutra; reagir e comentar continuam', async ({ page }) => {
      const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...cheia, 'GET /aluno/comunidade/configuracao': { corpo: { alunosPublicam: false, podeAnexarFoto: false } } });
      await page.goto(MURAL_DOS_ALUNOS);
      await expect(page.getByText('No momento, só a equipe publica no mural. Você pode reagir, votar nas enquetes e comentar.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Nova publicação' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Curtir, 2 reações', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ver comentários: 4 comentários' })).toBeVisible();
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
      // Atrás da folha, o mural já fica na aba onde o resultado vai aparecer.
      await expect(page).toHaveURL(/[?&]mural=alunos/);
      await capturar(page, `aluno-publicar-resultado-${largura}`);
      expect(api.pedidos.some((p) => foiPost(p, '/aluno/comunidade/mural'))).toBe(false);

      // Sair sem salvar no aluno (19/11): o texto pronto é editável e, editado, fechar pergunta; continuar mantém o texto.
      await texto.fill('Treino concluído: Treino A. Bora!');
      await folha.getByRole('button', { name: 'Cancelar' }).click();
      await page.getByRole('alertdialog', { name: 'Sair sem salvar?' }).getByRole('button', { name: 'Continuar editando' }).click();
      await expect(texto).toHaveValue('Treino concluído: Treino A. Bora!');
      await folha.getByRole('button', { name: /^Publicar/ }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/aluno/comunidade/mural'))?.corpo)
        .toEqual({ tipo: 'RESULTADO', texto: 'Treino concluído: Treino A. Bora!' });
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: vindo do "Bom trabalho!" com a chave desligada, nada abre e fica a frase neutra', async ({ page }) => {
      const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...vazia, 'GET /aluno/comunidade/configuracao': { corpo: { alunosPublicam: false, podeAnexarFoto: false } } });
      await page.goto('/aluno/comunidade?publicar=RESULTADO&texto=Treino%20conclu%C3%ADdo.');
      await expect(page.getByText('No momento, só a equipe publica no mural. Você pode reagir, votar nas enquetes e comentar.')).toBeVisible();
      await expect(novaPublicacao(page)).toHaveCount(0);
      await expect(page).not.toHaveURL(/publicar=/);
      expect(api.pedidos.some((p) => foiPost(p, '/aluno/comunidade/mural'))).toBe(false);
    });

    test('aluno: vazio em cada fonte e aviso sem conexão', async ({ page }) => {
      const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...vazia });
      await page.goto('/aluno/comunidade');
      // Cada aba do mural diz o que falta nela.
      await expect(page.getByText('Nenhum aviso, vídeo ou enquete ainda.')).toBeVisible();
      // O vazio de Avisos leva à outra aba (próximo passo); o de Alunos não tem ação.
      await page.getByRole('button', { name: 'Ver publicações dos alunos' }).click();
      await expect(page).toHaveURL(/[?&]mural=alunos/);
      await expect(page.getByText('Nenhuma conversa, dúvida ou resultado ainda.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ver publicações dos alunos' })).toHaveCount(0);
      await page.getByRole('tab', { name: 'Vídeos' }).click();
      await expect(page.getByText('Nenhum vídeo por enquanto.')).toBeVisible();
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
        'GET /aluno/comunidade/mural': (p, route) => {
          if (falhando) { const e = erroApi(503, 'Indisponível.'); return json(route, e.corpo, e.status); }
          return json(route, doTipo(p, POST));
        },
      });
      await page.goto(MURAL_DOS_ALUNOS);
      await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
      await expect(page.getByText('Semana de constância, time!')).toHaveCount(0);
      await expect(page.getByText('Nenhuma conversa, dúvida ou resultado ainda.')).toHaveCount(0);
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
      await page.getByRole('alertdialog', { name: 'Sair sem salvar?' }).getByRole('button', { name: 'Sair sem salvar' }).click();
      await expect(folha).toHaveCount(0);
      await expect(page.getByText('Nenhum aviso, vídeo ou enquete ainda.')).toBeVisible();
      // Não publicou: a tela fica na aba em que estava.
      await expect(page).not.toHaveURL(/mural=alunos/);
    });

    // Sair sem salvar no aluno (19/11): fechar com alteração pergunta; continuar mantém tudo; sair zera a próxima abertura.
    test('aluno: "Nova publicação" preenchida pergunta "Sair sem salvar?" ao fechar; sem nada digitado fecha na hora', async ({ page }) => {
      await tema(page, ALUNO.id, 'ESCURO');
      const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...vazia });
      await page.goto('/aluno/comunidade');
      const folha = novaPublicacao(page);
      const aviso = page.getByRole('alertdialog', { name: 'Sair sem salvar?' });
      const texto = folha.getByRole('textbox', { name: 'Texto', exact: true });

      // Sem nada digitado: fecha pelo X na hora, sem aviso.
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      await folha.getByRole('button', { name: 'Fechar', exact: true }).click();
      await expect(folha).toHaveCount(0);
      await expect(aviso).toHaveCount(0);

      await page.getByRole('button', { name: 'Nova publicação' }).click();
      await folha.getByRole('radio', { name: 'Dúvida', exact: true }).click();
      await texto.fill('Rascunho de teste');
      await folha.getByRole('button', { name: 'Fechar', exact: true }).click();
      await expect(aviso.getByText('Há alterações que ainda não foram salvas. Se sair agora, elas serão perdidas.')).toBeVisible();
      await expect(aviso.getByRole('button', { name: 'Continuar editando' })).toBeVisible();
      await expect(aviso.getByRole('button', { name: 'Sair sem salvar' })).toBeVisible();
      await capturar(page, `aluno-sair-sem-salvar-escuro-${largura}`);

      // Continuar editando: a folha fica como estava e o foco volta ao campo de texto.
      await aviso.getByRole('button', { name: 'Continuar editando' }).click();
      await expect(aviso).toHaveCount(0);
      await expect(texto).toHaveValue('Rascunho de teste');
      await expect(folha.getByRole('radio', { name: 'Dúvida', exact: true })).toBeChecked();
      await expect(texto).toBeFocused();

      // Esc pergunta do mesmo jeito; Esc no aviso só fecha o aviso.
      await page.keyboard.press('Escape');
      await expect(aviso).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(aviso).toHaveCount(0);
      await expect(folha).toBeVisible();
      await expect(texto).toHaveValue('Rascunho de teste');

      // O voltar do navegador também pergunta e não sai da tela; continuar mantém a folha como estava.
      await page.goBack();
      await expect(aviso).toBeVisible();
      await aviso.getByRole('button', { name: 'Continuar editando' }).click();
      await expect(folha).toBeVisible();
      await expect(texto).toHaveValue('Rascunho de teste');
      await expect(page).toHaveURL(/\/aluno\/comunidade/);

      // Sair sem salvar (pelo Cancelar): fecha e a próxima abertura começa em branco, em Conversa.
      await folha.getByRole('button', { name: 'Cancelar' }).click();
      await aviso.getByRole('button', { name: 'Sair sem salvar' }).click();
      await expect(folha).toHaveCount(0);
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      await expect(texto).toHaveValue('');
      await expect(folha.getByRole('radio', { name: 'Conversa', exact: true })).toBeChecked();
      await folha.getByRole('button', { name: 'Cancelar' }).click();
      await expect(folha).toHaveCount(0);
      await expect(aviso).toHaveCount(0);
      expect(api.pedidos.some((p) => foiPost(p, '/aluno/comunidade/mural'))).toBe(false);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: tipo (no painel) e busca vão à API; vazio com filtro diz isso e limpa', async ({ page }) => {
      const api = await simularApi(page, {
        ...(await sessaoDeAluno(page)), ...cheia,
        'GET /aluno/comunidade/mural': (p, route) => json(route, p.busca.get('busca') ? pagina() : doTipo(p, POST, POST_CURTIDO)),
      });
      const doMural = () => api.pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/aluno/comunidade/mural');
      await page.goto(MURAL_DOS_ALUNOS);
      await expect(page.getByText('Treino feito.')).toBeVisible();
      // A aba pede os três tipos dela, um por vez.
      await expect.poll(() => doMural().map((p) => p.busca.get('tipo')).sort()).toEqual(['CONVERSA', 'DUVIDA', 'RESULTADO']);
      const antes = doMural().length;
      const painel = await abrirPainel(page, 'Filtros do mural');
      // Só os tipos da aba Alunos.
      for (const rotulo of ['Todos', 'Dúvidas', 'Resultados', 'Conversas']) {
        await expect(painel.getByRole('radio', { name: rotulo, exact: true })).toHaveCount(1);
      }
      for (const rotulo of ['Avisos', 'Vídeos', 'Enquetes']) {
        await expect(painel.getByRole('radio', { name: rotulo, exact: true })).toHaveCount(0);
      }
      // "Só denunciadas" é só de quem modera.
      await expect(painel.getByRole('checkbox', { name: /Só denunciadas/ })).toHaveCount(0);
      await painel.getByRole('radio', { name: 'Dúvidas', exact: true }).click();
      await aplicarFiltros(painel);
      // Com o chip, uma chamada só, do tipo escolhido.
      await expect.poll(() => doMural().slice(antes).map((p) => p.busca.get('tipo'))).toEqual(['DUVIDA']);
      await expect(page.getByText('Nenhuma publicação encontrada com esse filtro.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tirar filtro: Tipo: Dúvidas' })).toBeVisible();
      await capturar(page, `aluno-mural-filtro-vazio-${largura}`);
      await page.getByRole('button', { name: 'Limpar filtros aplicados' }).click();
      await expect(page.getByText('Treino feito.')).toBeVisible();
      await expect(botaoFiltros(page)).toHaveAccessibleName('Filtros, nenhum ligado');

      await page.getByRole('searchbox', { name: 'Buscar na comunidade' }).fill('supino');
      await expect.poll(() => api.pedidos.some((p) => p.caminho === '/aluno/comunidade/mural' && p.busca.get('busca') === 'supino')).toBe(true);
      await expect(page.getByText('Nenhuma publicação encontrada com esse filtro.')).toBeVisible();
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: aviso fixado no topo, vídeo de outro site só com "Abrir vídeo" fora do app e dúvida respondida', async ({ page, context }) => {
      await context.route('https://video.exemplo.invalid/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Vídeo de teste</p>' }));
      const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...cheia, 'GET /aluno/comunidade/mural': muralFalso(VIDEO, DUVIDA, AVISO) });
      await page.goto('/aluno/comunidade');
      const aviso = page.getByText('Aviso de teste para o time.');
      const video = page.getByText('Vídeo de teste da técnica');
      await expect(aviso).toBeVisible();
      // Avisos é a aba padrão; a dúvida mora em Alunos.
      await expect(page.getByRole('radio', { name: 'Avisos', exact: true })).toBeChecked();
      await expect(page.getByText('Dúvida de teste sobre o aquecimento.')).toHaveCount(0);
      // Fixado primeiro, com os dois selos.
      expect((await aviso.boundingBox())!.y).toBeLessThan((await video.boundingBox())!.y);
      await expect(page.getByText('Aviso', { exact: true })).toBeVisible();
      await expect(page.getByText('Fixado', { exact: true })).toBeVisible();
      // O vídeo não traz miniatura de fora nem player (o link não é do YouTube): só o título e o botão.
      await expect(page.locator('img[src^="http"]')).toHaveCount(0);
      await expect(page.locator('iframe')).toHaveCount(0);
      await capturar(page, `aluno-mural-tipos-${largura}`);
      const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Abrir vídeo: Vídeo de teste da técnica' }).click()]);
      await popup.waitForURL('https://video.exemplo.invalid/aula');
      expect(await popup.evaluate(() => window.opener)).toBeNull();
      await popup.close();

      await page.getByRole('radio', { name: 'Alunos', exact: true }).click();
      await expect(page).toHaveURL(/[?&]mural=alunos/);
      await expect(page.getByText('Respondida', { exact: true })).toBeVisible();
      await expect(aviso).toHaveCount(0);
      await expect(video).toHaveCount(0);
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
      const MEU: PostDoMural = { ...POST_CURTIDO, id: 'p9', autorId: ALUNO.id, autorNome: ALUNO.nome, autorApelido: null, texto: 'Post do próprio aluno.' };
      const api = await simularApi(page, {
        ...(await sessaoDeAluno(page)), ...cheia,
        'GET /aluno/comunidade/mural': muralFalso(POST, MEU),
        'POST /aluno/comunidade/mural/{id}/denuncias': { status: 204 },
      });
      await page.goto(MURAL_DOS_ALUNOS);
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
      test(`aluno: o nome do colega como a API monta (sem apelido à parte) e o perfil numa folha, tema ${nome}`, async ({ page }) => {
        await tema(page, ALUNO.id, t, contraste);
        const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...cheia, 'GET /aluno/comunidade/perfis/{id}': { corpo: PERFIL } });
        await page.goto(MURAL_DOS_ALUNOS);
        await expect(page.getByText(NOME_DO_COLEGA, { exact: true })).toBeVisible();
        await expect(page.getByText('«Fictí»')).toHaveCount(0);
        // Autor da equipe não abre perfil; o aluno abre.
        await expect(page.getByRole('button', { name: 'Ver perfil de Treinadora Teste' })).toHaveCount(0);
        const autor = page.getByRole('button', { name: `Ver perfil de ${NOME_DO_COLEGA}` });
        expect((await autor.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await autor.focus();
        await capturar(page, `aluno-mural-nome-${nome}-${largura}`);
        await page.keyboard.press('Enter');
        const folha = page.getByRole('dialog', { name: 'Perfil na Comunidade' });
        await expect(folha.getByText(NOME_DO_COLEGA, { exact: true })).toBeVisible();
        await expect(folha.getByText('«Fictí»')).toHaveCount(0);
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
      await page.goto(MURAL_DOS_ALUNOS);
      const autor = page.getByRole('button', { name: `Ver perfil de ${NOME_DO_COLEGA}` });
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
      await expect(page.getByText('Os colegas veem o apelido se você escolher mostrá-lo em Meu perfil, logo abaixo.')).toBeVisible();
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
      await page.goto(MURAL_DOS_ALUNOS);
      const abrir = page.getByRole('button', { name: 'Ver comentários: 2 comentários' });
      expect((await abrir.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await abrir.click();
      const folha = page.getByRole('dialog', { name: 'Comentários' });
      await expect(folha.getByText('Bora, time!')).toBeVisible();
      await expect(folha.getByText('Mandou bem.')).toBeVisible();
      await expect(folha.getByText(NOME_DO_COLEGA, { exact: true })).toBeVisible();
      await expect(folha.getByText('«Fictí»')).toHaveCount(0);
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
      await folha.getByRole('button', { name: `Ver perfil de ${NOME_DO_COLEGA}` }).click();
      const perfil = page.getByRole('dialog', { name: 'Perfil na Comunidade' });
      await expect(perfil.getByText('8 treinos concluídos')).toBeVisible();
      await capturar(page, `aluno-comentarios-perfil-${largura}`);
      await page.keyboard.press('Escape');
      await expect(perfil).toHaveCount(0);
      await expect(folha).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(folha).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Ver comentários: 3 comentários' })).toBeVisible();
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
      await page.goto(MURAL_DOS_ALUNOS);
      await page.getByRole('button', { name: 'Ver comentários: 2 comentários' }).click();
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
      await page.goto(MURAL_DOS_ALUNOS);
      await page.getByRole('button', { name: 'Ver comentários: 3 comentários' }).click();
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
      await page.goto(MURAL_DOS_ALUNOS);
      await page.getByRole('button', { name: 'Ver comentários: 35 comentários' }).click();
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

    test('aluno: comentários do vídeo abrem pelo cartão, comenta e o total do vídeo sobe', async ({ page }) => {
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
      const abrir = page.getByRole('button', { name: 'Ver 2 comentário(s) do vídeo Vídeo de técnica' });
      expect((await abrir.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await capturar(page, `aluno-aulao-com-comentarios-${largura}`);
      await abrir.click();
      const folha = page.getByRole('dialog', { name: 'Comentários' });
      await expect(folha.getByText('Bora, time!')).toBeVisible();
      await folha.getByRole('textbox', { name: 'Seu comentário' }).fill('Vídeo excelente');
      await folha.getByRole('button', { name: /^Comentar/ }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/aluno/comunidade/aulas/a1/comentarios'))?.corpo).toEqual({ texto: 'Vídeo excelente' });
      await expect(folha.getByText('Vídeo excelente', { exact: true })).toBeVisible();
      await capturar(page, `aluno-aulao-comentarios-${largura}`);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Ver 3 comentário(s) do vídeo Vídeo de técnica' })).toBeVisible();
      expect(api.pedidos.filter((p) => p.metodo === 'GET' && p.caminho.endsWith('/comentarios')).map((p) => p.caminho))
        .toEqual(['/aluno/comunidade/aulas/a1/comentarios']);
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: vídeo fora do alcance (404) diz "Vídeo não disponível"; erro comum tem "Tentar de novo"', async ({ page }) => {
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
      const abrir = page.getByRole('button', { name: /^Ver 0 comentário\(s\) do vídeo/ });
      await abrir.click();
      const folha = page.getByRole('dialog', { name: 'Comentários' });
      await expect(folha.getByText('Vídeo não disponível')).toBeVisible();
      await expect(folha.getByText('Este vídeo saiu da Comunidade.')).toBeVisible();
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
      test(`aluno: comentários do vídeo no tema ${nome}`, async ({ page }) => {
        await tema(page, ALUNO.id, t, contraste);
        const { rotas } = comComentariosDaAula('/aluno/comunidade/aulas', '/aluno/comunidade/aulas/{id}/comentarios', varios(32));
        await simularApi(page, { ...(await sessaoDeAluno(page)), ...cheia, ...rotas });
        await page.goto('/aluno/comunidade?aba=auloes');
        const verComentarios = page.getByRole('button', { name: /^Ver 32 comentário\(s\) do vídeo/ });
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
      await page.goto(MURAL_DOS_ALUNOS);
      await page.getByRole('button', { name: 'Ver comentários: 4 comentários' }).click();
      const folha = page.getByRole('dialog', { name: 'Comentários' });
      await expect(folha.getByText('Post não disponível')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);
      await expect(folha.getByRole('textbox', { name: 'Seu comentário' })).toHaveCount(0);
      await capturar(page, `aluno-comentarios-404-${largura}`);
      await page.keyboard.press('Escape');

      lista = 'ok';
      await page.getByRole('button', { name: 'Ver comentários: 4 comentários' }).click();
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
      await page.goto(MURAL_DOS_ALUNOS);
      await page.getByRole('button', { name: 'Ver comentários: Nenhum comentário' }).click();
      await expect(page.getByRole('dialog', { name: 'Comentários' }).getByText('Ninguém comentou ainda.')).toBeVisible();
      await capturar(page, `aluno-comentarios-vazio-${largura}`);
    });

    for (const [nome, t, contraste] of TEMAS) {
      test(`aluno: comentários no tema ${nome}`, async ({ page }) => {
        await tema(page, ALUNO.id, t, contraste);
        const { rotas } = comComentarios('/aluno/comunidade/mural', '/aluno/comunidade/mural/{id}/comentarios');
        await simularApi(page, { ...(await sessaoDeAluno(page)), ...cheia, ...rotas });
        await page.goto(MURAL_DOS_ALUNOS);
        await page.getByRole('button', { name: 'Ver comentários: 2 comentários' }).click();
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

    test('treinador: vídeos e mural com dados, sem ranking; com moderação, reage como equipe', async ({ page }) => {
      await tema(page, TREINADOR.id, 'CLARO');
      const api = await abrirTreinador(page, { ...cheia, 'PUT /comunidade/mural/{id}/reacoes/{codigo}': { status: 204 } });
      await page.goto('/treinador/comunidade');
      await expect(page.getByRole('heading', { level: 1, name: 'Comunidade' })).toBeVisible();
      // Sem coleção nenhuma: os vídeos em "Sem coleção", sem filtro nem "Selecionar"; o "Coleções" do topo saiu (D3, 19/11:
      // elas se organizam na própria aba).
      await expect(page.getByRole('button', { name: 'Abrir vídeo: Vídeo de técnica' })).toBeVisible();
      await expect(botaoFiltros(page)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Selecionar' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Coleções' })).toHaveCount(0);
      await expect(page.getByRole('tab', { name: 'Ranking' })).toHaveCount(0);
      // Uma ação principal por vez, a da aba ativa, no cabeçalho (guia pág. 35).
      await expect(page.getByRole('button', { name: 'Novo vídeo' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Nova publicação' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Configurações do mural' })).toHaveCount(0);
      // Cabeçalho na largura útil (plano larguras-das-telas): a ação vai até a borda direita, sem faixa estreita no meio.
      if (largura >= 1280) {
        const titulo = await page.getByRole('heading', { level: 1, name: 'Comunidade' }).boundingBox();
        const acao = await page.getByRole('button', { name: 'Novo vídeo' }).boundingBox();
        expect(acao!.x + acao!.width - titulo!.x).toBeGreaterThan(800);
        expect(largura - (acao!.x + acao!.width)).toBeLessThanOrEqual(48);
      }
      await capturar(page, `treinador-auloes-${largura}`);

      await page.getByRole('tab', { name: 'Mural' }).click();
      // O mural abre em Avisos; as conversas moram em Alunos.
      await expect(page.getByText('Nenhum aviso, vídeo ou enquete ainda.')).toBeVisible();
      await page.getByRole('radio', { name: 'Alunos', exact: true }).click();
      await expect(page).toHaveURL(/[?&]mural=alunos/);
      await expect(page.getByText('Treino feito.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Novo vídeo' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Coleções' })).toHaveCount(0);
      // As chaves não ficam mais no caminho de leitura: só o acesso "Configurações do mural".
      await expect(page.getByRole('button', { name: 'Configurações do mural' })).toBeVisible();
      await expect(page.getByRole('switch')).toHaveCount(0);
      await expect(page.getByText('Quem publica no mural')).toHaveCount(0);
      await expect(page.getByText('Fixado', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Fogo, 5 reações', exact: true }).click();
      await expect.poll(() => api.pedidos.some((p) => p.metodo === 'PUT' && p.caminho === '/comunidade/mural/p1/reacoes/FOGO')).toBe(true);
      await expect(page.getByRole('button', { name: 'Fogo, 6 reações, você reagiu' })).toBeVisible();
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      await novaPublicacao(page).getByRole('textbox', { name: 'Texto', exact: true }).fill('Rascunho de teste');
      // Sair sem salvar no novo vídeo (19/11): o Cancelar com texto pergunta, e sair apaga o rascunho.
      await novaPublicacao(page).getByRole('button', { name: 'Cancelar' }).click();
      await page.getByRole('alertdialog', { name: 'Sair sem salvar?' }).getByRole('button', { name: 'Sair sem salvar' }).click();
      await expect(novaPublicacao(page)).toHaveCount(0);
      await page.getByRole('tab', { name: 'Vídeos' }).click();
      await expect(page).toHaveURL(/aba=auloes/);
      await capturar(page, `treinador-mural-${largura}`);
      // A aba mora no endereço; a "Nova publicação" reabre vazia, no tipo da aba.
      await page.getByRole('tab', { name: 'Mural' }).click();
      await expect(page).toHaveURL(/aba=mural/);
      await expect(page).toHaveURL(/[?&]mural=alunos/);
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      await expect(novaPublicacao(page).getByRole('textbox', { name: 'Texto', exact: true })).toHaveValue('');
      expect(api.naoTratadas.filter((r) => r.includes('/comunidade'))).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('treinador: publica aviso (nasce fixado, a tela diz) e vídeo (link https conferido no envio)', async ({ page }) => {
      const api = await abrirTreinador(page, { ...vazia, 'POST /comunidade/mural': { corpo: { ...POST, id: 'novo' } } });
      await page.goto('/treinador/comunidade?aba=mural');
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      const folha = novaPublicacao(page);
      // Na aba Avisos (a padrão), a folha já abre em Aviso.
      await expect(folha.getByRole('radio', { name: 'Aviso', exact: true })).toBeChecked();
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
      await expect(folha).toHaveCount(0);
      await expect(page).not.toHaveURL(/mural=alunos/);

      // Uma conversa publicada de Avisos vai para Alunos, e a tela segue para lá; em Alunos a folha abre em Conversa.
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      await expect(folha.getByRole('radio', { name: 'Aviso', exact: true })).toBeChecked();
      await folha.getByRole('radio', { name: 'Conversa', exact: true }).click();
      await folha.getByRole('textbox', { name: 'Texto', exact: true }).fill('Conversa de teste');
      await folha.getByRole('button', { name: /^Publicar/ }).click();
      await expect(folha).toHaveCount(0);
      await expect(page).toHaveURL(/[?&]mural=alunos/);
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      await expect(folha.getByRole('radio', { name: 'Conversa', exact: true })).toBeChecked();
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
        'GET /comunidade/mural': (p, route) => json(route, p.busca.get('denunciados') === 'true' ? doTipo(p, DENUNCIADO) : doTipo(p, POST, DENUNCIADO)),
        'POST /comunidade/mural/{id}/fixar': { status: 204 },
        'POST /comunidade/mural/{id}/denuncias/dispensar': { status: 204 },
        'DELETE /comunidade/mural/{id}': { status: 204 },
      });
      await page.goto(MURAL_DOS_ALUNOS_DA_EQUIPE);
      await expect(page.getByText('2 denúncias', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Ações da publicação de Treinadora Teste' }).click();
      const menu = page.getByRole('dialog', { name: 'Ações da publicação' });
      await expect(menu.getByRole('button', { name: /^Dispensar denúncias/ })).toHaveCount(0);
      await menu.getByRole('button', { name: /^Desafixar/ }).click();
      await expect.poll(() => api.pedidos.some((p) => foiPost(p, '/comunidade/mural/p1/fixar'))).toBe(true);
      await expect(page.getByText('Publicação desafixada.')).toBeVisible();

      const filtros = await abrirPainel(page, 'Filtros do mural');
      await filtros.getByRole('checkbox', { name: /Só denunciadas/ }).click();
      await aplicarFiltros(filtros);
      await expect.poll(() => api.pedidos.some((p) => p.caminho === '/comunidade/mural' && p.busca.get('denunciados') === 'true')).toBe(true);
      await expect(page.getByRole('button', { name: 'Tirar filtro: Só denunciadas' })).toBeVisible();
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
      await expect(page.getByRole('heading', { name: 'Vídeo de técnica' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Novo vídeo' })).toHaveCount(0);
      // Sem COMUNIDADE_MODERAR o cartão do vídeo não tem ⋯ (decisão de 20/11); a capa continua abrindo o vídeo.
      await expect(page.getByRole('button', { name: /^Ações do vídeo/ })).toHaveCount(0);
      await page.getByRole('tab', { name: 'Mural' }).click();
      await page.getByRole('radio', { name: 'Alunos', exact: true }).click();
      await expect(page.getByText('Treino feito.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Nova publicação' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Configurações do mural' })).toHaveCount(0);
      await expect(page.getByRole('switch')).toHaveCount(0);
      const filtros = await abrirPainel(page, 'Filtros do mural');
      await expect(filtros.getByRole('checkbox', { name: /Só denunciadas/ })).toHaveCount(0);
      await filtros.getByRole('button', { name: 'Cancelar' }).click();
      // O apelido aparece para todos; só a moderação (o ⋯) some.
      await expect(page.getByText('«Fictí»')).toBeVisible();
      await expect(page.getByRole('button', { name: /^Ações da publicação/ })).toHaveCount(0);
    });

    test('treinador: "Remover apelido" pede confirmação, chama o DELETE e recarrega o mural', async ({ page }) => {
      let semApelido = false;
      const api = await abrirTreinador(page, {
        ...cheia,
        'GET /comunidade/mural': (p, route) => json(route, doTipo(p, POST, { ...POST_CURTIDO, autorApelido: semApelido ? null : 'Fictí' })),
        'DELETE /comunidade/perfis/{id}/apelido': (_p, route) => { semApelido = true; return route.fulfill({ status: 204 }); },
      });
      await page.goto(MURAL_DOS_ALUNOS_DA_EQUIPE);
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
      await page.goto(MURAL_DOS_ALUNOS_DA_EQUIPE);
      await page.getByRole('button', { name: 'Ver comentários: 2 comentários' }).click();
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
      await page.goto(MURAL_DOS_ALUNOS_DA_EQUIPE);
      await page.getByRole('button', { name: 'Ver comentários: 2 comentários' }).click();
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
      await expect(page.getByRole('button', { name: 'Ver comentários: Nenhum comentário' })).toHaveCount(2);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('treinador: sem COMUNIDADE_MODERAR lê os comentários, sem "Remover comentário"', async ({ page }) => {
      const { rotas } = comComentarios('/comunidade/mural', '/comunidade/mural/{id}/comentarios');
      await abrirTreinador(page, { ...cheia, ...rotas }, [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR']);
      await page.goto(MURAL_DOS_ALUNOS_DA_EQUIPE);
      await page.getByRole('button', { name: 'Ver comentários: 2 comentários' }).click();
      const folha = page.getByRole('dialog', { name: 'Comentários' });
      await expect(folha.getByText('Mandou bem.')).toBeVisible();
      await expect(folha.getByRole('button', { name: /Remover comentário/ })).toHaveCount(0);
      await expect(folha.getByRole('textbox')).toHaveCount(0);
    });

    test('treinador: comentários do vídeo; lê sem campo, remove com confirmação e o total do vídeo desce', async ({ page }) => {
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
      await page.getByRole('button', { name: 'Ver comentários do vídeo Vídeo de técnica: 31 comentários' }).click();
      const folha = page.getByRole('dialog', { name: 'Comentários' });
      await expect(folha.getByText('Comentário de teste 1', { exact: true })).toBeVisible();
      await expect(folha.getByText('Mostrando 30 de 31 comentários.')).toBeVisible();
      // A equipe não comenta no aulão (a rota existe na API, o app não a oferece).
      await expect(folha.getByRole('textbox')).toHaveCount(0);
      await expect(folha.getByRole('button', { name: /^Comentar/ })).toHaveCount(0);

      await folha.getByRole('button', { name: 'Remover comentário de Aluno Fictício' }).first().click();
      const painel = page.getByRole('alertdialog', { name: 'Remover o comentário?' });
      await expect(painel.getByText('O comentário de Aluno Fictício sai do vídeo para todos.')).toBeVisible();
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
      await expect(page.getByRole('button', { name: 'Ver comentários do vídeo Vídeo de técnica: 30 comentários' })).toBeVisible();
      // Só as rotas dos comentários importam aqui (o menu do treinador consulta outras, como nos demais casos da equipe).
      expect(api.naoTratadas.filter((r) => r.includes('/comunidade'))).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('treinador: vídeo fora do alcance (404) diz "Vídeo não disponível"; sem COMUNIDADE_MODERAR não há "Remover"', async ({ page }) => {
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
      const abrir = page.getByRole('button', { name: 'Ver comentários do vídeo Vídeo de técnica: 2 comentários' });
      await abrir.click();
      const folha = page.getByRole('dialog', { name: 'Comentários' });
      await expect(folha.getByText('Vídeo não disponível')).toBeVisible();
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
        await page.goto(MURAL_DOS_ALUNOS_DA_EQUIPE);
        await page.getByRole('button', { name: 'Ver comentários: 2 comentários' }).click();
        await expect(page.getByRole('dialog', { name: 'Comentários' }).getByText('Mandou bem.')).toBeVisible();
        await capturar(page, `treinador-comentarios-tema-${nome}-${largura}`);
      });
    }

    test('treinador: folha do vídeo pede título e link https, escolhe a coleção e envia os campos da API (sem ordem)', async ({ page }) => {
      const api = await abrirTreinador(page, {
        ...vazia, 'POST /comunidade/aulas': { corpo: { ...AULA, id: 'novo' } },
        'GET /comunidade/playlists': { corpo: [PLAYLIST_ALIMENTACAO, PLAYLIST_TECNICA] },
      });
      await page.goto('/treinador/comunidade');
      // Com coleções e sem vídeo, cada seção diz que está vazia (D2, 19/11).
      await expect(page.getByText('Nenhum vídeo nesta coleção', { exact: true }).first()).toBeVisible();
      await page.getByRole('button', { name: 'Novo vídeo' }).click();
      const folha = page.getByRole('dialog', { name: 'Novo vídeo' });
      await folha.getByRole('button', { name: 'Publicar', exact: true }).click();
      await expect(folha.getByText('Escreva o título.')).toBeVisible();
      await expect(folha.getByText('Cole o link do vídeo.')).toBeVisible();
      // O primeiro campo com erro (o link, que vem primeiro: D4) recebe o foco.
      await expect(folha.getByRole('textbox', { name: 'Link do vídeo' })).toBeFocused();
      await folha.getByRole('textbox', { name: 'Título' }).fill('Vídeo de teste');
      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill('http://exemplo.test');
      // Link inválido: erro sob o campo e o Publicar desativado com o motivo (D4).
      await expect(folha.getByText('Use um link https completo.')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Publicar', exact: true })).toBeDisabled();
      await expect(folha.getByText('Corrija o link do vídeo.')).toBeVisible();
      await capturar(page, `treinador-folha-erros-${largura}`);
      expect(api.pedidos.some((p) => foiPost(p, '/comunidade/aulas'))).toBe(false);

      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill('https://exemplo.test/video');
      // Link fora do YouTube: sem prévia e sem busca de capa; a capa continua opcional pela galeria.
      await expect(folha.getByRole('button', { name: 'Escolher capa' })).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Usar a capa do YouTube' })).toHaveCount(0);
      // Coleção: só escolhe uma existente (D17), na ordem do treinador, com "Sem coleção" primeiro; o vídeo entra no fim dela.
      await expect(folha.getByText('Entra no fim da coleção.')).toBeVisible();
      await escolherColecao(page, folha, 'Sem coleção', 'Técnica');
      await expect(folha.getByRole('button', { name: 'Coleção: Técnica. Escolher.' })).toBeVisible();
      await folha.getByRole('textbox', { name: /^Descrição/ }).fill('Pauta de teste.');
      await capturar(page, `treinador-folha-colecao-${largura}`);
      await folha.getByRole('button', { name: 'Publicar', exact: true }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/comunidade/aulas'))?.corpo)
        .toEqual({ titulo: 'Vídeo de teste', descricao: 'Pauta de teste.', videoUrl: 'https://exemplo.test/video', playlistId: 'p1' });
      await expect(folha).toHaveCount(0);
    });

    test('treinador: sem coleção nenhuma a folha diz onde criar; coleção recusada (422) aparece junto da escolha', async ({ page }) => {
      const e = erroApi(422, 'Dados inválidos.', 'COMUNIDADE_INVALIDA', [{ field: 'playlistId', message: 'Escolha uma coleção da consultoria.' }]);
      await abrirTreinador(page, { ...vazia, 'POST /comunidade/aulas': (_p, route) => json(route, e.corpo, e.status) });
      await page.goto('/treinador/comunidade');
      await page.getByRole('button', { name: 'Novo vídeo' }).click();
      const folha = page.getByRole('dialog', { name: 'Novo vídeo' });
      await expect(folha.getByText('Nenhuma coleção ainda. Crie em “+ Nova coleção”, no fim da aba Vídeos.')).toBeVisible();
      await folha.getByRole('textbox', { name: 'Título' }).fill('Vídeo de teste');
      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill('https://exemplo.test/video');
      await folha.getByRole('button', { name: 'Publicar', exact: true }).click();
      await expect(folha.getByText('Escolha uma coleção da consultoria.')).toBeVisible();
      await expect(folha).toBeVisible();
    });

    test('treinador: link recusado pela API (422) aparece no campo e a folha continua aberta', async ({ page }) => {
      const e = erroApi(422, 'Dados inválidos.', 'COMUNIDADE_INVALIDA', [{ field: 'videoUrl', message: 'Use um link https sem usuário e senha.' }]);
      await abrirTreinador(page, { ...vazia, 'POST /comunidade/aulas': (_p, route) => json(route, e.corpo, e.status) });
      await page.goto('/treinador/comunidade');
      await page.getByRole('button', { name: 'Novo vídeo' }).click();
      const folha = page.getByRole('dialog', { name: 'Novo vídeo' });
      await folha.getByRole('textbox', { name: 'Título' }).fill('Vídeo de teste');
      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill('https://exemplo.test/video');
      await folha.getByRole('button', { name: 'Publicar', exact: true }).click();
      await expect(folha.getByText('Use um link https sem usuário e senha.')).toBeVisible();
      await expect(folha.getByRole('textbox', { name: 'Link do vídeo' })).toBeFocused();
      await expect(folha).toBeVisible();
    });

    test('treinador: falha sem campo (503) ao publicar o vídeo aparece no rodapé da folha, que continua aberta', async ({ page }) => {
      const e = erroApi(503, 'Comunidade indisponível agora.');
      await abrirTreinador(page, { ...vazia, 'POST /comunidade/aulas': (_p, route) => json(route, e.corpo, e.status) });
      await page.goto('/treinador/comunidade');
      await page.getByRole('button', { name: 'Novo vídeo' }).click();
      const folha = page.getByRole('dialog', { name: 'Novo vídeo' });
      await folha.getByRole('textbox', { name: 'Título' }).fill('Vídeo de teste');
      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill('https://exemplo.test/video');
      await folha.getByRole('button', { name: 'Publicar', exact: true }).click();
      await expect(folha.getByText('Comunidade indisponível agora.')).toBeVisible();
      await expect(folha.getByRole('textbox', { name: 'Título' })).toHaveValue('Vídeo de teste');
    });

    // Sair sem salvar no novo vídeo (19/11): fechar com alteração pergunta; continuar mantém tudo; sair zera a próxima abertura.
    test('treinador: "Novo vídeo" preenchido pergunta "Sair sem salvar?" ao fechar; sem nada digitado fecha na hora', async ({ page }) => {
      await tema(page, TREINADOR.id, 'ESCURO');
      const api = await abrirTreinador(page, { ...vazia, 'GET /comunidade/playlists': { corpo: [PLAYLIST_ALIMENTACAO, PLAYLIST_TECNICA] } });
      await page.goto('/treinador/comunidade');
      const folha = page.getByRole('dialog', { name: 'Novo vídeo' });
      const aviso = page.getByRole('alertdialog', { name: 'Sair sem salvar?' });
      const titulo = folha.getByRole('textbox', { name: 'Título' });
      const link = folha.getByRole('textbox', { name: 'Link do vídeo' });

      // Sem nada digitado: fecha pelo X na hora, sem aviso.
      await page.getByRole('button', { name: 'Novo vídeo' }).click();
      await folha.getByRole('button', { name: 'Fechar', exact: true }).click();
      await expect(folha).toHaveCount(0);
      await expect(aviso).toHaveCount(0);

      await page.getByRole('button', { name: 'Novo vídeo' }).click();
      await link.fill('https://exemplo.test/video');
      await titulo.fill('Vídeo de teste');
      await folha.getByRole('button', { name: 'Fechar', exact: true }).click();
      await expect(aviso.getByText('Há alterações que ainda não foram salvas. Se sair agora, elas serão perdidas.')).toBeVisible();
      await expect(aviso.getByRole('button', { name: 'Continuar editando' })).toBeVisible();
      await expect(aviso.getByRole('button', { name: 'Sair sem salvar' })).toBeVisible();
      await capturar(page, `sair-sem-salvar-escuro-${largura}`);

      // Continuar editando: a folha fica como estava e o foco volta ao campo em que a pessoa estava.
      await aviso.getByRole('button', { name: 'Continuar editando' }).click();
      await expect(aviso).toHaveCount(0);
      await expect(titulo).toHaveValue('Vídeo de teste');
      await expect(link).toHaveValue('https://exemplo.test/video');
      await expect(titulo).toBeFocused();

      // Esc pergunta do mesmo jeito; Esc no aviso só fecha o aviso.
      await page.keyboard.press('Escape');
      await expect(aviso).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(aviso).toHaveCount(0);
      await expect(folha).toBeVisible();
      await expect(titulo).toHaveValue('Vídeo de teste');

      // Sair sem salvar (pelo Cancelar): fecha e a próxima abertura começa em branco.
      await folha.getByRole('button', { name: 'Cancelar' }).click();
      await aviso.getByRole('button', { name: 'Sair sem salvar' }).click();
      await expect(folha).toHaveCount(0);
      await page.getByRole('button', { name: 'Novo vídeo' }).click();
      await expect(titulo).toHaveValue('');
      await expect(link).toHaveValue('');
      await folha.getByRole('button', { name: 'Cancelar' }).click();
      await expect(folha).toHaveCount(0);
      await expect(aviso).toHaveCount(0);
      expect(api.pedidos.some((p) => foiPost(p, '/comunidade/aulas'))).toBe(false);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('treinador: erro da API vira mensagem com "Tentar de novo" e nenhum dado de exemplo', async ({ page }) => {
      const e = erroApi(503, 'Indisponível.');
      await abrirTreinador(page, { ...cheia, 'GET /comunidade/aulas': (_p, route) => json(route, e.corpo, e.status) });
      await page.goto('/treinador/comunidade');
      await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
      await expect(page.getByText('Nenhum vídeo publicado.')).toHaveCount(0);
      await capturar(page, `treinador-erro-${largura}`);
    });

    for (const [nome, t, contraste] of TEMAS) {
      test(`treinador: vídeos no tema ${nome}`, async ({ page }) => {
        await tema(page, TREINADOR.id, t, contraste);
        const api = await abrirTreinador(page, cheia);
        await page.goto('/treinador/comunidade');
        await expect(page.getByText('Pauta do vídeo de teste.')).toBeVisible();
        await capturar(page, `treinador-tema-${nome}-${largura}`);
        expect(api.errosDaPagina).toEqual([]);
      });
    }
  });
}

/**
 * Vídeos de duas coleções e um sem coleção, na ordem da API (fora da ordem da tela de propósito). Técnica tem um rascunho
 * (não publicado) no meio e `ordem` com buraco: o número é a posição, e o PUT da ordem leva também o rascunho.
 */
const AULAS_VARIADAS: AulaDaComunidade[] = [
  { ...AULA, id: 'a1', titulo: 'Vídeo de técnica', playlistId: 'p1', ordem: 0 },
  { ...AULA, id: 'a2', titulo: 'Vídeo de proteína', descricao: 'Proteína no café da manhã.', playlistId: 'p2', ordem: 0 },
  { ...AULA, id: 'a3', titulo: 'Vídeo de boas-vindas', descricao: 'Como o time funciona.', playlistId: null, ordem: 0 },
  { ...AULA, id: 'a4', titulo: 'Vídeo de execução', descricao: 'Amplitude e cadência.', playlistId: 'p1', ordem: 4 },
  { ...AULA, id: 'a5', titulo: 'Vídeo de rascunho', descricao: 'Ainda em gravação.', playlistId: 'p1', ordem: 2, publicada: false },
];
const PLAYLISTS_VARIADAS = [PLAYLIST_ALIMENTACAO, { ...PLAYLIST_TECNICA, totalAulas: 3 }];

/** Títulos dos vídeos na ordem da tela (h3 dentro da seção da coleção, h2 na grade plana das coleções em erro). */
const titulosNaTela = (page: Page) => page.getByRole('heading', { name: /^Vídeo de/ }).allInnerTexts();
/** "Mover para cima/baixo" pelo ⋯ do vídeo (D2, 19/11: as setas do cartão saíram). */
async function moverPeloMenu(page: Page, titulo: string, direcao: 'cima' | 'baixo') {
  await page.getByRole('button', { name: `Ações do vídeo ${titulo}` }).click();
  await page.getByRole('dialog', { name: 'Ações do vídeo' }).getByRole('button', { name: new RegExp(`^Mover para ${direcao}`) }).click();
}

/** Escolhe a coleção do vídeo (lista suspensa no PC, folha no celular). */
async function escolherColecao(page: Page, folha: ReturnType<Page['getByRole']>, atual: string, nova: string) {
  await folha.getByRole('button', { name: `Coleção: ${atual}. Escolher.` }).click();
  await page.getByRole('option', { name: nova, exact: true }).click();
}

/**
 * Coleções e vídeos com estado, como a API (V088): `totalAulas` conta todos os vídeos da equipe; as rotas de ordem pedem a
 * lista inteira (senão 409 `CONFLITO_EDICAO`); o lote põe no fim do destino na ordem enviada; excluir deixa os vídeos sem
 * coleção. `recusar` força a lista velha (409 na ordem, 404 no lote).
 */
function colecoesComEstado(playlists: PlaylistDaComunidade[] = PLAYLISTS_VARIADAS, aulas: AulaDaComunidade[] = AULAS_VARIADAS) {
  const estado = { playlists: playlists.map((p) => ({ ...p })), aulas: aulas.map((a) => ({ ...a })), recusar: false, criadas: 0 };
  const erro = (route: Route, status: number, codigo: string, campos: { field: string; message: string }[] = []) => {
    const e = erroApi(status, 'Recusado.', codigo, campos);
    return json(route, e.corpo, e.status);
  };
  const mesmos = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join();
  const nomeEmUso = (nome: string, menos?: string) => estado.playlists.some((x) => x.id !== menos && x.nome.toLowerCase() === nome.toLowerCase());
  const rotas: RespostasApi = {
    'GET /comunidade/playlists': (_p, route) => json(route, estado.playlists.map((p) => ({ ...p, totalAulas: estado.aulas.filter((a) => a.playlistId === p.id).length }))),
    'GET /comunidade/aulas': (_p, route) => json(route, estado.aulas),
    'POST /comunidade/playlists': (p, route) => {
      const { nome } = p.corpo as { nome: string };
      if (nomeEmUso(nome)) return erro(route, 409, 'PLAYLIST_NOME_EM_USO');
      const nova = { id: `n${++estado.criadas}`, nome, ordem: Math.max(-1, ...estado.playlists.map((x) => x.ordem)) + 1, totalAulas: 0 };
      estado.playlists.push(nova);
      return json(route, nova);
    },
    'PUT /comunidade/playlists/ordem': (p, route) => {
      const { ids } = p.corpo as { ids: string[] };
      if (estado.recusar || !mesmos(ids, estado.playlists.map((x) => x.id))) return erro(route, 409, 'CONFLITO_EDICAO');
      estado.playlists = estado.playlists.map((x) => ({ ...x, ordem: ids.indexOf(x.id) }));
      return route.fulfill({ status: 204 });
    },
    'PUT /comunidade/playlists/{id}': (p, route) => {
      const id = p.caminho.split('/')[3];
      const { nome } = p.corpo as { nome: string };
      if (nome === 'Nome recusado') return erro(route, 422, 'PLAYLIST_INVALIDA', [{ field: 'nome', message: 'Use outro nome para a coleção.' }]);
      if (nomeEmUso(nome, id)) return erro(route, 409, 'PLAYLIST_NOME_EM_USO');
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
      if (estado.recusar || !mesmos(ids, estado.aulas.filter((a) => a.playlistId === id).map((a) => a.id))) return erro(route, 409, 'CONFLITO_EDICAO');
      estado.aulas = estado.aulas.map((a) => (ids.includes(a.id) ? { ...a, ordem: ids.indexOf(a.id) } : a));
      return route.fulfill({ status: 204 });
    },
    'PUT /comunidade/aulas/playlist': (p, route) => {
      const { aulaIds, playlistId } = p.corpo as { aulaIds: string[]; playlistId: string | null };
      if (estado.recusar || aulaIds.some((id) => !estado.aulas.some((a) => a.id === id))) return erro(route, 404, 'NAO_ENCONTRADO');
      for (const id of aulaIds) {
        const fim = Math.max(-1, ...estado.aulas.filter((a) => a.playlistId === playlistId && playlistId !== null).map((a) => a.ordem)) + 1;
        estado.aulas = estado.aulas.map((a) => (a.id === id ? { ...a, playlistId, ordem: playlistId ? fim : 0 } : a));
      }
      return route.fulfill({ status: 204 });
    },
  };
  return { estado, rotas };
}

const PERMISSOES_DE_MODERAR = [...PERMISSOES_TREINADOR, 'TREINO_LER', 'COMUNIDADE_MODERAR'];
const pedidosDe = (api: { pedidos: PedidoFalso[] }, metodo: string, caminho: string) => api.pedidos.filter((p) => p.metodo === metodo && p.caminho === caminho);

for (const largura of [390, 1280]) {
  test.describe(`vídeos: editar e excluir em ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });
    const abrir = async (page: Page, respostas: RespostasApi) => {
      await tema(page, TREINADOR.id, 'CLARO');
      return simularApi(page, { ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_DE_MODERAR })), ...cheia, ...respostas });
    };

    test('editar abre a folha preenchida e o PUT reenvia os seis campos (com a coleção, sem ordem); o que gravou continua depois de recarregar', async ({ page }) => {
      // Aula despublicada e com capa: o PUT substitui tudo, e sem esses campos ela voltaria publicada, sem coleção e sem capa.
      const estado: { aula: AulaDaComunidade } = { aula: { ...AULA, publicada: false, playlistId: 'p1', ordem: 3, capaId: 'capa-1' } };
      const api = await abrir(page, {
        'GET /comunidade/playlists': { corpo: [PLAYLIST_TECNICA, { id: 'p3', nome: 'Mobilidade', ordem: 2, totalAulas: 0 }] },
        'GET /comunidade/aulas': (_p, route) => json(route, [estado.aula]),
        'PUT /comunidade/aulas/{id}': (p, route) => {
          estado.aula = { ...estado.aula, ...(p.corpo as Partial<AulaDaComunidade>) };
          return json(route, estado.aula);
        },
      });
      await page.goto('/treinador/comunidade');
      await page.getByRole('button', { name: 'Ações do vídeo Vídeo de técnica' }).click();
      await page.getByRole('dialog', { name: 'Ações do vídeo' }).getByRole('button', { name: /^Editar vídeo/ }).click();
      const folha = page.getByRole('dialog', { name: 'Editar vídeo' });
      await expect(folha.getByRole('textbox', { name: 'Título' })).toHaveValue('Vídeo de técnica');
      await expect(folha.getByRole('textbox', { name: 'Link do vídeo' })).toHaveValue('https://exemplo.test/video');
      await expect(folha.getByRole('textbox', { name: /^Descrição/ })).toHaveValue('Pauta do vídeo de teste.');
      await expect(folha.getByRole('button', { name: 'Coleção: Técnica. Escolher.' })).toBeVisible();
      await expect(folha.getByText('Trocar de coleção leva o vídeo para o fim da nova.')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Publicar', exact: true })).toHaveCount(0);
      await capturar(page, `treinador-editar-aulao-${largura}`);

      // Link inválido não sai do aparelho: ao sair do campo o erro aparece e o Salvar fica desativado (D4).
      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill('http://exemplo.test');
      await folha.getByRole('textbox', { name: 'Link do vídeo' }).blur();
      await expect(folha.getByText('Use um link https completo.')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Salvar', exact: true })).toBeDisabled();
      expect(api.pedidos.some((p) => p.metodo === 'PUT')).toBe(false);

      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill('https://exemplo.test/video-novo');
      await folha.getByRole('textbox', { name: 'Título' }).fill('Vídeo de técnica avançada');
      await escolherColecao(page, folha, 'Técnica', 'Mobilidade');
      await folha.getByRole('textbox', { name: /^Descrição/ }).fill('');
      await folha.getByRole('button', { name: 'Salvar', exact: true }).click();
      await expect.poll(() => api.pedidos.find((p) => p.metodo === 'PUT')?.corpo).toEqual({
        titulo: 'Vídeo de técnica avançada', descricao: null, videoUrl: 'https://exemplo.test/video-novo',
        capaId: 'capa-1', playlistId: 'p3', publicada: false,
      });
      expect(api.pedidos.find((p) => p.metodo === 'PUT')?.caminho).toBe('/comunidade/aulas/a1');
      await expect(folha).toHaveCount(0);
      await expect(page.getByText('Vídeo atualizado.')).toBeVisible();
      await expect(page.getByRole('heading', { level: 3, name: 'Vídeo de técnica avançada' })).toBeVisible();

      await page.reload();
      await expect(page.getByRole('heading', { level: 3, name: 'Vídeo de técnica avançada' })).toBeVisible();
      await expect(page.getByText('Não publicado', { exact: true })).toBeVisible();
      const filtros = await abrirPainel(page, 'Filtros de vídeos');
      await expect(filtros.getByRole('radio', { name: 'Mobilidade, 1' })).toBeVisible();
      expect(api.errosDaPagina).toEqual([]);
    });

    test('editar uma aula que já saiu (404) fecha a folha, avisa e recarrega', async ({ page }) => {
      const estado = { aulas: [AULA] };
      await abrir(page, {
        'GET /comunidade/aulas': (_p, route) => json(route, estado.aulas),
        'PUT /comunidade/aulas/{id}': (_p, route) => { estado.aulas = []; const e = erroApi(404, 'Aula não encontrada.'); return json(route, e.corpo, e.status); },
      });
      await page.goto('/treinador/comunidade');
      await page.getByRole('button', { name: 'Ações do vídeo Vídeo de técnica' }).click();
      await page.getByRole('dialog', { name: 'Ações do vídeo' }).getByRole('button', { name: /^Editar vídeo/ }).click();
      await page.getByRole('dialog', { name: 'Editar vídeo' }).getByRole('button', { name: 'Salvar', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Editar vídeo' })).toHaveCount(0);
      await expect(page.getByText('Este vídeo já tinha sido excluído.')).toBeVisible();
      await expect(page.getByText(/^Nenhum vídeo nem coleção ainda\./)).toBeVisible();
    });

    test('excluir pede confirmação com o aviso dos comentários; Cancelar não apaga; a falha fica no painel; confirmar chama o DELETE', async ({ page }) => {
      const estado = { aulas: [...AULAS_VARIADAS], falhar: true };
      const api = await abrir(page, {
        'GET /comunidade/playlists': { corpo: PLAYLISTS_VARIADAS },
        'GET /comunidade/aulas': (_p, route) => json(route, estado.aulas),
        'DELETE /comunidade/aulas/{id}': (p, route) => {
          if (estado.falhar) { estado.falhar = false; const e = erroApi(503, 'Comunidade indisponível agora.'); return json(route, e.corpo, e.status); }
          estado.aulas = estado.aulas.filter((a) => `/comunidade/aulas/${a.id}` !== p.caminho);
          return route.fulfill({ status: 204 });
        },
      });
      await page.goto('/treinador/comunidade');
      const menu = page.getByRole('dialog', { name: 'Ações do vídeo' });
      const painel = page.getByRole('alertdialog', { name: 'Excluir o vídeo?' });
      await page.getByRole('button', { name: 'Ações do vídeo Vídeo de proteína' }).click();
      await menu.getByRole('button', { name: /^Excluir vídeo/ }).click();
      await expect(painel.getByText('Excluir o vídeo “Vídeo de proteína”? Os comentários dele também somem. Essa ação não pode ser desfeita.')).toBeVisible();
      await capturar(page, `treinador-excluir-aulao-${largura}`);
      await painel.getByRole('button', { name: 'Cancelar' }).click();
      expect(api.pedidos.some((p) => p.metodo === 'DELETE')).toBe(false);

      await page.getByRole('button', { name: 'Ações do vídeo Vídeo de proteína' }).click();
      await menu.getByRole('button', { name: /^Excluir vídeo/ }).click();
      await painel.getByRole('button', { name: 'Excluir vídeo' }).click();
      await expect(painel.getByText('Comunidade indisponível agora.')).toBeVisible();
      expect(estado.aulas).toHaveLength(5);
      await capturar(page, `treinador-excluir-aulao-falha-${largura}`);

      await painel.getByRole('button', { name: 'Excluir vídeo' }).click();
      await expect(painel).toHaveCount(0);
      await expect(page.getByText('Vídeo excluído.')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Vídeo de proteína' })).toHaveCount(0);
      expect(pedidosDe(api, 'DELETE', '/comunidade/aulas/a2')).toHaveLength(2);
      // A coleção que ficou sem vídeo sai do filtro (e continua na lista, vazia).
      await expect(page.getByText('Nenhum vídeo nesta coleção', { exact: true })).toBeVisible();
      const filtros = await abrirPainel(page, 'Filtros de vídeos');
      await expect(filtros.getByRole('radio', { name: /^Técnica/ })).toBeVisible();
      await expect(filtros.getByRole('radio', { name: /^Alimentação/ })).toHaveCount(0);
      expect(api.errosDaPagina).toEqual([]);
    });
  });

  test.describe(`coleções do treinador em ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });
    const abrir = async (page: Page, respostas: RespostasApi, t = 'CLARO') => {
      await tema(page, TREINADOR.id, t);
      return simularApi(page, { ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_DE_MODERAR })), ...cheia, ...respostas });
    };

    test('lista por coleção na ordem do treinador (a vazia também), numerada com o rascunho; "Mover para cima" manda a coleção inteira; 409 recarrega com o aviso', async ({ page }) => {
      const { estado, rotas } = colecoesComEstado([...PLAYLISTS_VARIADAS, { id: 'p3', nome: 'Mobilidade', ordem: 2, totalAulas: 0 }]);
      const api = await abrir(page, rotas);
      await page.goto('/treinador/comunidade');
      // Coleções pela `ordem` (Técnica antes de Alimentação, como o aluno verá), "Sem coleção" por último; dentro, pela ordem dela.
      await expect.poll(() => titulosNaTela(page))
        .toEqual(['Vídeo de técnica', 'Vídeo de rascunho', 'Vídeo de execução', 'Vídeo de proteína', 'Vídeo de boas-vindas']);
      await expect(page.getByText('3 vídeos', { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'Mobilidade' })).toBeVisible();
      await expect(page.getByText('Nenhum vídeo nesta coleção', { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'Sem coleção' })).toBeVisible();
      await expect(page.getByText('Não publicado', { exact: true })).toBeVisible();
      // O número é a posição na coleção (o rascunho conta): 1, 2 e 3 em Técnica, 1 em Alimentação, nada em "Sem coleção".
      await expect(page.getByLabel(/^Posição \d+$/)).toHaveText(['1', '2', '3', '1']);
      await capturar(page, `treinador-colecoes-lista-${largura}`);

      // Na ponta o "Mover para cima" não existe; "Sem coleção" não tem ordem.
      await page.getByRole('button', { name: 'Ações do vídeo Vídeo de técnica' }).click();
      await expect(page.getByRole('dialog', { name: 'Ações do vídeo' }).getByRole('button', { name: /^Mover para cima/ })).toHaveCount(0);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Ações do vídeo Vídeo de boas-vindas' }).click();
      await expect(page.getByRole('dialog', { name: 'Ações do vídeo' }).getByRole('button', { name: /^Mover para (cima|baixo)/ })).toHaveCount(0);
      await page.keyboard.press('Escape');

      await moverPeloMenu(page, 'Vídeo de execução', 'cima');
      // A lista INTEIRA da coleção, com o não publicado, na ordem nova.
      await expect.poll(() => pedidosDe(api, 'PUT', '/comunidade/playlists/p1/aulas/ordem').map((p) => p.corpo)).toEqual([{ ids: ['a1', 'a4', 'a5'] }]);
      await expect.poll(() => titulosNaTela(page))
        .toEqual(['Vídeo de técnica', 'Vídeo de execução', 'Vídeo de rascunho', 'Vídeo de proteína', 'Vídeo de boas-vindas']);

      // Lista velha (409): aviso fixo e a lista vem de novo.
      estado.recusar = true;
      const antes = pedidosDe(api, 'GET', '/comunidade/aulas').length;
      await moverPeloMenu(page, 'Vídeo de técnica', 'baixo');
      await expect(page.getByText('A lista mudou. Confira e tente de novo.')).toBeVisible();
      await expect.poll(() => pedidosDe(api, 'GET', '/comunidade/aulas').length).toBeGreaterThan(antes);
      await expect.poll(() => titulosNaTela(page))
        .toEqual(['Vídeo de técnica', 'Vídeo de execução', 'Vídeo de rascunho', 'Vídeo de proteína', 'Vídeo de boas-vindas']);
      expect(await semRolagemHorizontal(page)).toBe(true);
      expect(api.naoTratadas.filter((r) => r.includes('/comunidade'))).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('coleções na própria aba (D3): cria vazia, nome repetido no campo, renomeia no título (422 no campo), reordena e exclui com confirmação', async ({ page }) => {
      const { estado, rotas } = colecoesComEstado();
      const api = await abrir(page, rotas);
      await page.goto('/treinador/comunidade');
      await expect(page.getByText(/^O aluno vê as coleções nesta ordem/)).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'Técnica' })).toBeVisible();

      // Nome repetido: o erro fica no campo (a pessoa corrige ali) e nada é criado.
      await page.getByRole('button', { name: 'Nova coleção' }).click();
      const nome = page.getByRole('textbox', { name: 'Nome da nova coleção' });
      await nome.fill('técnica');
      await page.getByRole('button', { name: 'Criar coleção' }).click();
      await expect(page.getByText('Já existe uma coleção com esse nome. Escolha outro.')).toBeVisible();
      await nome.fill('   ');
      await page.getByRole('button', { name: 'Criar coleção' }).click();
      await expect(page.getByText('Use de 1 a 60 caracteres.')).toBeVisible();
      expect(pedidosDe(api, 'POST', '/comunidade/playlists')).toHaveLength(1);
      // Vazia vale (C28).
      await nome.fill('  Mobilidade   e  alongamento ');
      await page.getByRole('button', { name: 'Criar coleção' }).click();
      await expect.poll(() => pedidosDe(api, 'POST', '/comunidade/playlists').at(-1)?.corpo).toEqual({ nome: 'Mobilidade e alongamento' });
      await expect(page.getByRole('heading', { level: 2, name: 'Mobilidade e alongamento' })).toBeVisible();
      await expect(page.getByText('0 vídeos', { exact: true })).toBeVisible();
      await expect(nome).toHaveCount(0);
      await capturar(page, `treinador-colecoes-criada-${largura}`);

      // Renomear no título: 422 PLAYLIST_INVALIDA no campo; depois salva.
      await page.getByRole('button', { name: 'Ações da coleção Alimentação' }).click();
      await page.getByRole('dialog', { name: 'Ações da coleção “Alimentação”' }).getByRole('button', { name: /^Renomear/ }).click();
      const novoNome = page.getByRole('textbox', { name: 'Nome da coleção Alimentação' });
      await novoNome.fill('Nome recusado');
      await page.getByRole('button', { name: 'Salvar nome' }).click();
      await expect(page.getByText('Use outro nome para a coleção.')).toBeVisible();
      await novoNome.fill('Nutrição');
      await page.getByRole('button', { name: 'Salvar nome' }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Nutrição' })).toBeVisible();
      expect(pedidosDe(api, 'PUT', '/comunidade/playlists/p2').map((p) => p.corpo)).toEqual([{ nome: 'Nome recusado' }, { nome: 'Nutrição' }]);

      // "Mover para baixo" da coleção manda a lista inteira; na ponta o "Mover para cima" não existe.
      await page.getByRole('button', { name: 'Ações da coleção Técnica' }).click();
      const menuDaTecnica = page.getByRole('dialog', { name: 'Ações da coleção “Técnica”' });
      await expect(menuDaTecnica.getByRole('button', { name: /^Mover para cima/ })).toHaveCount(0);
      await menuDaTecnica.getByRole('button', { name: /^Mover para baixo/ }).click();
      await expect.poll(() => pedidosDe(api, 'PUT', '/comunidade/playlists/ordem').map((p) => p.corpo)).toEqual([{ ids: ['p2', 'p1', 'n1'] }]);
      await expect.poll(() => page.getByRole('heading', { level: 2 }).allInnerTexts()).toEqual(['Nutrição', 'Técnica', 'Mobilidade e alongamento', 'Sem coleção']);

      // Excluir pede confirmação, diz que os vídeos ficam em "Sem coleção"; Cancelar não apaga.
      const painel = page.getByRole('alertdialog', { name: 'Excluir a coleção “Técnica”?' });
      const pedirExcluir = async () => {
        await page.getByRole('button', { name: 'Ações da coleção Técnica' }).click();
        await page.getByRole('dialog', { name: 'Ações da coleção “Técnica”' }).getByRole('button', { name: /^Excluir coleção/ }).click();
      };
      await pedirExcluir();
      await expect(painel.getByText(/^Os 3 vídeos dela passam para “Sem coleção”; nenhum vídeo é apagado\./)).toBeVisible();
      await capturar(page, `treinador-colecoes-excluir-${largura}`);
      await painel.getByRole('button', { name: 'Cancelar' }).click();
      expect(api.pedidos.some((p) => p.metodo === 'DELETE')).toBe(false);
      await pedirExcluir();
      await painel.getByRole('button', { name: 'Excluir coleção' }).click();
      await expect(painel).toHaveCount(0);
      await expect(page.getByRole('heading', { level: 2, name: 'Técnica' })).toHaveCount(0);
      expect(pedidosDe(api, 'DELETE', '/comunidade/playlists/p1')).toHaveLength(1);
      expect(estado.aulas.filter((a) => a.playlistId === null).map((a) => a.id)).toEqual(['a1', 'a3', 'a4', 'a5']);

      // A lista vem de novo: os vídeos da excluída estão em "Sem coleção" (sem número); a nova aparece vazia.
      await expect(page.getByRole('heading', { level: 2, name: 'Mobilidade e alongamento' })).toBeVisible();
      await expect.poll(() => titulosNaTela(page)).toEqual(['Vídeo de proteína', 'Vídeo de técnica', 'Vídeo de boas-vindas', 'Vídeo de execução', 'Vídeo de rascunho']);
      await expect(page.getByLabel(/^Posição \d+$/)).toHaveText(['1']);
      expect(api.naoTratadas.filter((r) => r.includes('/comunidade'))).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('"Selecionar": marca, move em lote na ordem da tela para o fim da coleção e sai; lista velha (404) recarrega com o aviso', async ({ page }) => {
      const { estado, rotas } = colecoesComEstado();
      const api = await abrir(page, rotas);
      await page.goto('/treinador/comunidade');
      await page.getByRole('button', { name: 'Selecionar' }).click();
      await expect(page.getByText('Nenhum vídeo marcado')).toBeVisible();
      const mover = page.getByRole('button', { name: /^Mover para coleção/ });
      await expect(mover).toBeDisabled();
      await expect(page.getByText('Marque ao menos um vídeo.')).toBeVisible();
      // No modo Selecionar a caixa toma o lugar do ⋯ e das setas.
      await expect(page.getByRole('button', { name: /^Ações do vídeo/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Descer / })).toHaveCount(0);
      // Marca de baixo para cima: o lote vai na ordem da tela, não na do toque.
      await page.getByRole('checkbox', { name: 'Selecionar Vídeo de boas-vindas' }).click();
      await page.getByRole('checkbox', { name: 'Selecionar Vídeo de proteína' }).click();
      await page.getByRole('checkbox', { name: 'Selecionar Vídeo de técnica' }).click();
      await expect(page.getByText('3 vídeos marcados')).toBeVisible();
      await capturar(page, `treinador-colecoes-selecao-${largura}`);
      await mover.click();
      const destino = page.getByRole('dialog', { name: 'Mover para coleção' });
      await expect(destino.getByRole('button', { name: /^Tirar da coleção/ })).toBeVisible();
      await destino.getByRole('button', { name: /^Técnica/ }).click();
      // O que já está em Técnica não vai (pularia para o fim); os outros entram no fim, na ordem da tela.
      await expect.poll(() => pedidosDe(api, 'PUT', '/comunidade/aulas/playlist').map((p) => p.corpo)).toEqual([{ aulaIds: ['a2', 'a3'], playlistId: 'p1' }]);
      await expect(page.getByText('2 vídeos movidos para “Técnica”.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Selecionar' })).toBeVisible();
      await expect(page.getByText('Nenhum vídeo marcado')).toHaveCount(0);
      await expect.poll(() => titulosNaTela(page))
        .toEqual(['Vídeo de técnica', 'Vídeo de rascunho', 'Vídeo de execução', 'Vídeo de proteína', 'Vídeo de boas-vindas']);
      await expect(page.getByText('Sem coleção', { exact: true })).toHaveCount(0);

      // "Marcar todos" e a lista velha: 404 no lote avisa, recarrega e limpa a marcação (o modo continua).
      await page.getByRole('button', { name: 'Selecionar' }).click();
      await page.getByRole('button', { name: 'Marcar todos' }).click();
      await expect(page.getByText('5 vídeos marcados')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Desmarcar todos' })).toBeVisible();
      estado.recusar = true;
      await mover.click();
      await destino.getByRole('button', { name: /^Tirar da coleção/ }).click();
      await expect(page.getByText('A lista mudou. Confira e tente de novo.')).toBeVisible();
      await expect(page.getByText('Nenhum vídeo marcado')).toBeVisible();
      expect(estado.aulas.every((a) => a.playlistId !== null)).toBe(true);
      expect(await semRolagemHorizontal(page)).toBe(true);
      expect(api.naoTratadas.filter((r) => r.includes('/comunidade'))).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('coleções em erro: os vídeos aparecem sem grupo, com a mensagem e "Tentar de novo"', async ({ page }) => {
      const e = erroApi(503, 'Indisponível.');
      const estado = { falhar: true };
      await abrir(page, {
        'GET /comunidade/aulas': { corpo: AULAS_VARIADAS },
        'GET /comunidade/playlists': (_p, route) => (estado.falhar ? json(route, e.corpo, e.status) : json(route, PLAYLISTS_VARIADAS)),
      });
      await page.goto('/treinador/comunidade');
      await expect(page.getByText(/^Não foi possível carregar as coleções/)).toBeVisible();
      await expect.poll(() => titulosNaTela(page)).toHaveLength(5);
      await expect(page.getByText('Sem coleção', { exact: true })).toHaveCount(0);
      await expect(botaoFiltros(page)).toHaveCount(0);
      await capturar(page, `treinador-colecoes-erro-${largura}`);
      estado.falhar = false;
      await page.getByRole('button', { name: 'Tentar de novo' }).click();
      await expect(page.getByText('Sem coleção', { exact: true })).toBeVisible();
      await expect(page.getByText(/^Não foi possível carregar as coleções/)).toHaveCount(0);
    });

    test('sem COMUNIDADE_MODERAR (só TREINO_LER) vê a lista por coleção, sem Nova coleção, Selecionar, alça nem ⋯ de coleção', async ({ page }) => {
      await tema(page, TREINADOR.id, 'CLARO');
      const { rotas } = colecoesComEstado([...PLAYLISTS_VARIADAS, { id: 'p3', nome: 'Mobilidade', ordem: 2, totalAulas: 0 }]);
      const api = await simularApi(page, { ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER'] })), ...cheia, ...rotas });
      await page.goto('/treinador/comunidade');
      await expect.poll(() => titulosNaTela(page)).toHaveLength(5);
      await expect(page.getByText('Nenhum vídeo nesta coleção', { exact: true })).toBeVisible();
      for (const nome of ['Nova coleção', 'Novo vídeo', 'Selecionar']) await expect(page.getByRole('button', { name: nome, exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^(Adicionar vídeo|Ações da coleção)/ })).toHaveCount(0);
      await expect(page.getByTestId('alca-de-arraste')).toHaveCount(0);
      // Sem COMUNIDADE_MODERAR o vídeo também não tem ⋯ (decisão de 20/11).
      await expect(page.getByRole('button', { name: /^Ações do vídeo / })).toHaveCount(0);
      await expect(botaoFiltros(page)).toBeVisible();
      expect(api.errosDaPagina).toEqual([]);
    });

    test('teclado: Enter no ⋯ e em "Mover para cima" move o vídeo e o foco volta ao ⋯ dele', async ({ page }) => {
      const { rotas } = colecoesComEstado();
      await abrir(page, rotas);
      await page.goto('/treinador/comunidade');
      const menu = page.getByRole('button', { name: 'Ações do vídeo Vídeo de execução' });
      for (const esperado of [
        ['Vídeo de técnica', 'Vídeo de execução', 'Vídeo de rascunho', 'Vídeo de proteína', 'Vídeo de boas-vindas'],
        ['Vídeo de execução', 'Vídeo de técnica', 'Vídeo de rascunho', 'Vídeo de proteína', 'Vídeo de boas-vindas'],
      ]) {
        await menu.focus();
        await page.keyboard.press('Enter');
        const acoes = page.getByRole('dialog', { name: 'Ações do vídeo' });
        await acoes.getByRole('button', { name: /^Mover para cima/ }).focus();
        await page.keyboard.press('Enter');
        await expect.poll(() => titulosNaTela(page)).toEqual(esperado);
        // O cartão mudou de lugar no DOM: o foco volta ao ⋯ do mesmo vídeo (sem isso cairia no body).
        await expect(menu).toBeFocused();
      }
      // Na ponta o "Mover para cima" some do menu.
      await menu.press('Enter');
      await expect(page.getByRole('dialog', { name: 'Ações do vídeo' }).getByRole('button', { name: /^Mover para cima/ })).toHaveCount(0);
    });

    test('a coleção vazia e o "Sem coleção" no fim da lista', async ({ page }) => {
      for (const [nome, t] of [['claro', 'CLARO'], ['escuro', 'ESCURO']] as const) {
        const { rotas } = colecoesComEstado([...PLAYLISTS_VARIADAS, { id: 'p3', nome: 'Mobilidade', ordem: 2, totalAulas: 0 }]);
        await abrir(page, rotas, t);
        await page.goto('/treinador/comunidade');
        await page.getByText('Sem coleção', { exact: true }).scrollIntoViewIfNeeded();
        await expect(page.getByText('Nenhum vídeo nesta coleção', { exact: true })).toBeVisible();
        if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/treinador-colecoes-fim-${nome}-${largura}.png` });
      }
    });

    for (const [nome, t] of [['claro', 'CLARO'], ['escuro', 'ESCURO']] as const) {
      test(`lista, seleção e menu da coleção no tema ${nome}`, async ({ page }) => {
        const { rotas } = colecoesComEstado();
        const api = await abrir(page, rotas, t);
        await page.goto('/treinador/comunidade');
        await expect.poll(() => titulosNaTela(page)).toHaveLength(5);
        await capturar(page, `treinador-colecoes-tema-${nome}-${largura}`);
        await page.getByRole('button', { name: 'Selecionar' }).click();
        await page.getByRole('checkbox', { name: 'Selecionar Vídeo de proteína' }).click();
        await capturar(page, `treinador-colecoes-selecao-tema-${nome}-${largura}`);
        await page.getByRole('button', { name: 'Sair da seleção' }).click();
        await page.getByRole('button', { name: 'Ações da coleção Alimentação' }).click();
        await expect(page.getByRole('dialog', { name: 'Ações da coleção “Alimentação”' }).getByRole('button', { name: /^Renomear/ })).toBeVisible();
        await capturar(page, `treinador-colecoes-menu-tema-${nome}-${largura}`);
        expect(api.errosDaPagina).toEqual([]);
      });
    }
  });
}

for (const [largura, altura] of [[390, 900], [1280, 900], [1440, 900], [1920, 1080]] as const) {
  test.describe(`vídeos por coleção em ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: altura } });

    test('treinador: no painel, Todas, cada coleção e Sem coleção filtram a lista; a etiqueta tira o filtro', async ({ page }) => {
      await tema(page, TREINADOR.id, 'CLARO');
      await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_DE_MODERAR })), ...cheia,
        'GET /comunidade/playlists': { corpo: PLAYLISTS_VARIADAS },
        'GET /comunidade/aulas': { corpo: AULAS_VARIADAS },
      });
      await page.goto('/treinador/comunidade');
      await expect.poll(() => titulosNaTela(page)).toHaveLength(5);
      const painel = await abrirPainel(page, 'Filtros de vídeos');
      const chips = painel.getByRole('radiogroup', { name: 'Coleção do vídeo' }).getByRole('radio');
      // Na ordem das coleções e "Sem coleção" por último, com a contagem (o rascunho conta).
      await expect(chips).toHaveText([/^Todas\s*5$/, /^Técnica\s*3$/, /^Alimentação\s*1$/, /^Sem coleção\s*1$/]);
      await expect(painel.getByRole('radio', { name: 'Todas, 5' })).toBeChecked();
      await painel.getByRole('radio', { name: 'Técnica, 3' }).click();
      // Rascunho: a lista só muda no Aplicar.
      await expect.poll(() => titulosNaTela(page)).toHaveLength(5);
      await aplicarFiltros(painel);
      await expect.poll(() => titulosNaTela(page)).toEqual(['Vídeo de técnica', 'Vídeo de rascunho', 'Vídeo de execução']);
      await expect(botaoFiltros(page)).toHaveAccessibleName('Filtros, 1 ligado');
      // Filtrada, a coleção continua numerada e o ⋯ continua movendo (a ordem vai com a coleção inteira).
      await expect(page.getByLabel(/^Posição \d+$/)).toHaveText(['1', '2', '3']);
      await page.getByRole('button', { name: 'Ações do vídeo Vídeo de execução' }).click();
      await expect(page.getByRole('dialog', { name: 'Ações do vídeo' }).getByRole('button', { name: /^Mover para cima/ })).toBeVisible();
      await page.keyboard.press('Escape');
      await capturar(page, `treinador-filtro-colecao-${largura}`);
      await filtrarColecao(page, 'Sem coleção, 1');
      await expect.poll(() => titulosNaTela(page)).toEqual(['Vídeo de boas-vindas']);
      await page.getByRole('button', { name: 'Tirar filtro: Coleção: Sem coleção' }).click();
      await expect.poll(() => titulosNaTela(page)).toHaveLength(5);
      await expect(botaoFiltros(page)).toHaveAccessibleName('Filtros, nenhum ligado');
      expect(await semRolagemHorizontal(page)).toBe(true);
    });
  });
}

test.describe('vídeos: estados', () => {
  test.use({ viewport: { width: 390, height: 900 } });

  test('coleção de 60 caracteres e título longo cabem em 390 px no treinador, sem rolagem horizontal', async ({ page }) => {
    const longa = 'Coleção muito comprida para conferir a quebra de linha em 60';
    const aula: AulaDaComunidade = {
      ...AULA, playlistId: 'p9', publicada: false,
      titulo: 'Vídeo com um título bem comprido para ver se o cartão quebra a linha sem espremer nada',
    };
    await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_DE_MODERAR })), ...cheia,
      'GET /comunidade/playlists': { corpo: [{ id: 'p9', nome: longa, ordem: 0, totalAulas: 1 }] },
      'GET /comunidade/aulas': { corpo: [aula] },
    });
    await page.goto('/treinador/comunidade');
    await expect(page.getByRole('heading', { level: 3, name: aula.titulo })).toBeVisible();
    await expect(page.getByText(longa, { exact: true })).toBeVisible();
    expect(await semRolagemHorizontal(page)).toBe(true);
    // O título continua com largura de leitura (não espremido pelo selo e pelo ⋯).
    expect((await page.getByRole('heading', { level: 3, name: aula.titulo }).boundingBox())!.width).toBeGreaterThan(200);
    // O ⋯ continua inteiro dentro da tela.
    const menu = (await page.getByRole('button', { name: `Ações do vídeo ${aula.titulo}` }).boundingBox())!;
    expect(menu.x + menu.width).toBeLessThanOrEqual(390);
    await capturar(page, 'treinador-colecao-longa-390');
    await page.getByRole('button', { name: `Ações do vídeo ${aula.titulo}` }).click();
    await page.getByRole('dialog', { name: 'Ações do vídeo' }).getByRole('button', { name: /^Editar vídeo/ }).click();
    await expect(page.getByRole('dialog', { name: 'Editar vídeo' }).getByRole('button', { name: `Coleção: ${longa}. Escolher.` })).toBeVisible();
    expect(await semRolagemHorizontal(page)).toBe(true);
    await capturar(page, 'treinador-colecao-longa-folha-390');
  });

  test('treinador: carregando mostra o esqueleto e depois a grade', async ({ page }) => {
    let liberar: () => void = () => {};
    const espera = new Promise<void>((r) => { liberar = r; });
    await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_DE_MODERAR })), ...cheia,
      'GET /comunidade/aulas': async (_p, route) => { await espera; return json(route, AULAS_VARIADAS); },
    });
    await page.goto('/treinador/comunidade');
    await expect(page.getByRole('progressbar').first()).toBeVisible();
    await capturar(page, 'treinador-auloes-carregando-390');
    liberar();
    await expect(page.getByRole('heading', { name: /^Vídeo de/ })).toHaveCount(5);
  });

  test('aluno: carregando mostra o esqueleto; falha tem "Tentar de novo", que busca de novo', async ({ page }) => {
    let liberar: () => void = () => {};
    const espera = new Promise<void>((r) => { liberar = r; });
    const estado = { falhar: true };
    await simularApi(page, {
      ...(await sessaoDeAluno(page)), ...cheia,
      'GET /aluno/comunidade/aulas': async (_p, route) => {
        await espera;
        if (estado.falhar) { estado.falhar = false; const e = erroApi(503, 'Indisponível.'); return json(route, e.corpo, e.status); }
        return json(route, AULAS_VARIADAS);
      },
    });
    await page.goto('/aluno/comunidade?aba=auloes');
    await expect(page.getByRole('progressbar').first()).toBeVisible();
    await capturar(page, 'aluno-auloes-carregando-390');
    liberar();
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: /^Vídeo de/ })).toHaveCount(0);
    await capturar(page, 'aluno-auloes-falha-390');
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);
  });
});

/** `n` aulões fictícios com títulos distintos. */
const aulas = (n: number): AulaDaComunidade[] => Array.from({ length: n }, (_, i) => ({ ...AULA, id: `a${i + 1}`, titulo: `Vídeo de teste ${i + 1}` }));

/** Colunas da grade dos aulões: quantos `x` distintos têm os botões de comentários (à esquerda de cada cartão). */
async function colunasDosAuloes(page: Page) {
  const caixas = await Promise.all((await page.getByRole('button', { name: /^Ver comentários do vídeo/ }).all()).map((b) => b.boundingBox()));
  return new Set(caixas.map((c) => Math.round(c!.x))).size;
}

/** Borda esquerda e direita do conteúdo: o título da tela e a ação do cabeçalho, que vai até a borda direita. */
async function bordasDoConteudo(page: Page, acao: string) {
  const titulo = (await page.getByRole('heading', { level: 1, name: 'Comunidade' }).boundingBox())!;
  const botao = (await page.getByRole('button', { name: acao }).boundingBox())!;
  return { esquerda: titulo.x, direita: botao.x + botao.width };
}

const semRolagemHorizontal = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

// Colunas dos vídeos pela área ao lado do menu (D2, 19/11): 1440 com o menu aberto tem ~1200 px (3) e 1920, ~1680 (4).
for (const [largura, altura, colunas] of [[390, 900, 1], [1440, 900, 3], [1920, 1080, 4]] as const) {
  test.describe(`treinador: larguras da Comunidade em ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: altura } });
    const abrir = async (page: Page, respostas: RespostasApi) => {
      await tema(page, TREINADOR.id, 'CLARO');
      return simularApi(page, { ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'COMUNIDADE_MODERAR'] })), ...cheia, ...respostas });
    };

    test(`vídeos em ${colunas} coluna(s) pela largura medida; sem rolagem horizontal`, async ({ page }) => {
      await abrir(page, { 'GET /comunidade/aulas': { corpo: aulas(4) } });
      await page.goto('/treinador/comunidade');
      await expect(page.getByRole('button', { name: 'Abrir vídeo: Vídeo de teste 4' })).toBeVisible();
      await expect.poll(() => colunasDosAuloes(page)).toBe(colunas);
      expect(await semRolagemHorizontal(page)).toBe(true);
      await capturar(page, `treinador-auloes-grade-${largura}`);
    });

    test('um vídeo só fica à esquerda, com a largura de uma coluna (não estica)', async ({ page }) => {
      await abrir(page, { 'GET /comunidade/aulas': { corpo: aulas(1) } });
      await page.goto('/treinador/comunidade');
      const video = page.getByRole('button', { name: 'Abrir vídeo: Vídeo de teste 1' });
      await expect(video).toBeVisible();
      const { esquerda, direita } = await bordasDoConteudo(page, 'Novo vídeo');
      const comentarios = (await page.getByRole('button', { name: /^Ver comentários do vídeo Vídeo de teste 1:/ }).boundingBox())!;
      // O botão de comentários fica rente ao recuo do cartão, colado à borda esquerda do conteúdo.
      expect(comentarios.x - esquerda).toBeLessThanOrEqual(32);
      const fimDoCartao = (await video.boundingBox())!;
      if (colunas > 1) expect(fimDoCartao.x + fimDoCartao.width - esquerda).toBeLessThanOrEqual((direita - esquerda) / colunas + 2);
      await capturar(page, `treinador-auloes-um-${largura}`);
    });

    test('mural: barra única de controles e publicações numa coluna de leitura na borda esquerda do cabeçalho', async ({ page }) => {
      await abrir(page, {});
      await page.goto(MURAL_DOS_ALUNOS_DA_EQUIPE);
      await expect(page.getByText('Treino feito.')).toBeVisible();
      const { esquerda, direita } = await bordasDoConteudo(page, 'Nova publicação');
      const coluna = (await page.getByTestId('coluna-das-publicacoes').boundingBox())!;
      expect(Math.abs(coluna.x - esquerda)).toBeLessThanOrEqual(1);
      expect(coluna.width).toBeLessThanOrEqual(720);
      // Barra única (D5, 19/11): sem grupo, o seletor é só o "Gerenciar grupos", na borda esquerda; depois Avisos | Alunos,
      // a busca e o "Filtros", na mesma linha no PC (quebram no celular). No celular a ação do cabeçalho desce para baixo
      // do título e não marca a borda direita.
      const gerenciar = (await page.getByRole('button', { name: 'Gerenciar grupos' }).boundingBox())!;
      expect(Math.abs(gerenciar.x - esquerda)).toBeLessThanOrEqual(2);
      const abas = (await page.getByRole('radiogroup', { name: 'Publicações', exact: true }).boundingBox())!;
      expect(abas.width).toBeLessThanOrEqual(800 + 1);
      const busca = (await page.getByRole('searchbox', { name: 'Buscar na comunidade' }).boundingBox())!;
      const filtros = (await botaoFiltros(page).boundingBox())!;
      expect(busca.x).toBeGreaterThanOrEqual(esquerda - 1);
      expect(filtros.x).toBeGreaterThan(busca.x + busca.width);
      if (largura >= 1440) expect(Math.abs(abas.y - busca.y)).toBeLessThanOrEqual(30);
      if (largura >= 768) expect(filtros.x + filtros.width).toBeLessThanOrEqual(direita + 1);
      expect(await semRolagemHorizontal(page)).toBe(true);
      await capturar(page, `treinador-mural-largura-${largura}`);
    });
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

/**
 * Passo 4 do plano `comunidade-enquetes-reacoes-video`: enquete (aviso antes do voto, voto na hora, "Mostrar votos",
 * encerrada, 409), vídeo do YouTube (player só depois do toque, `youtube-nocookie`, "Abrir no YouTube") e capa do vídeo
 * (bytes pela API; envio na nova publicação e no aulão). Só dados fictícios; o YouTube é interceptado, nunca o real.
 */
const ENQUETE_ABERTA: EnqueteDoMural = {
  variasRespostas: false, encerrada: false, encerraEm: '2026-12-31T23:59:59-03:00', participantes: 5, meusVotos: [],
  opcoes: [
    { id: 'o1', texto: 'Manhã', votos: 3, votantesAmostra: [{ autorId: 'u7', nome: 'Colega Fictícia', temFoto: false }] },
    { id: 'o2', texto: 'Noite', votos: 2, votantesAmostra: [] },
  ],
};
const POST_ENQUETE: PostDoMural = {
  ...POST, id: 'p9', tipo: 'ENQUETE', texto: 'Qual horário de treino você prefere?', fixado: false, reacoes: {}, totalComentarios: 0,
  enquete: ENQUETE_ABERTA,
};
const ID_DO_YOUTUBE = 'abcDEF12345';
const VIDEO_YT: PostDoMural = {
  ...POST, id: 'p8', tipo: 'VIDEO', texto: 'Técnica do agachamento', videoUrl: `https://www.youtube.com/watch?v=${ID_DO_YOUTUBE}`,
  capaId: 'capa-1', fixado: false, reacoes: {}, totalComentarios: 0,
};
const VOTOS: VotosDaEnquete = {
  pergunta: POST_ENQUETE.texto, participantes: 5,
  opcoes: [{ opcaoId: 'o1', texto: 'Manhã', votos: 3 }, { opcaoId: 'o2', texto: 'Noite', votos: 2 }],
  votantes: {
    total: 2,
    itens: [
      { autorId: ALUNO.id, opcaoId: 'o2', nome: 'Aluno Fictício', temFoto: false, votadoEm: '2026-11-12T10:00:00-03:00', ehVoce: true },
      { autorId: 'u7', opcaoId: 'o1', nome: 'Colega (Coleguinha)', temFoto: false, votadoEm: '2026-11-11T09:00:00-03:00', ehVoce: false },
    ],
  },
};

/** DD/MM/AAAA daqui a `dias` dias (o prazo precisa ser futuro e até 1 ano). */
function dataDaquiA(dias: number): { tela: string; iso: string } {
  const d = new Date(Date.now() + dias * 86400000);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const aaaa = d.getFullYear();
  return { tela: `${dd}/${mm}/${aaaa}`, iso: new Date(`${aaaa}-${mm}-${dd}T23:59:59-03:00`).toISOString() };
}

const opcaoDaEnquete = (page: Page, nome: RegExp) => page.getByRole('radiogroup', { name: 'Opções da enquete' }).getByRole('radio', { name: nome });

for (const largura of [390, 1280]) {
  test.describe(`enquete, vídeo e capa em ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    for (const [nome, t] of [['claro', 'CLARO'], ['escuro', 'ESCURO']] as const) {
      test(`aluno (${nome}): aviso antes das opções, voto na hora (o PUT devolve a enquete), troca e retira`, async ({ page }) => {
        await tema(page, ALUNO.id, t);
        const api = await simularApi(page, {
          ...(await sessaoDeAluno(page)), ...cheia,
          'GET /aluno/comunidade/mural': muralFalso(POST_ENQUETE),
          'PUT /aluno/comunidade/mural/{id}/votos': (p, route) => {
            const ids = (p.corpo as { opcaoIds: string[] }).opcaoIds;
            const opcoes = ENQUETE_ABERTA.opcoes.map((o) => ({ ...o, votos: o.votos + (ids.includes(o.id) ? 1 : 0) }));
            return json(route, { ...ENQUETE_ABERTA, opcoes, meusVotos: ids, participantes: ENQUETE_ABERTA.participantes + (ids.length ? 1 : 0) });
          },
        });
        await page.goto('/aluno/comunidade');
        await expect(page.getByRole('heading', { level: 3, name: 'Qual horário de treino você prefere?' })).toBeVisible();
        const aviso = page.getByText('Seu nome, suas escolhas e o horário do voto ficam visíveis para quem tem acesso a esta enquete.');
        await expect(aviso).toBeVisible();
        const manha = opcaoDaEnquete(page, /^Manhã, 3 votos, 60%/);
        // O aviso vem antes das opções, na leitura e na tela.
        expect((await aviso.boundingBox())!.y).toBeLessThan((await manha.boundingBox())!.y);
        await expect(page.getByText('Escolha uma opção')).toBeVisible();
        await expect(page.getByText('5 pessoas votaram')).toBeVisible();
        await expect(manha).toHaveAttribute('aria-checked', 'false');
        await capturar(page, `enquete-aberta-${nome}-${largura}`);

        await opcaoDaEnquete(page, /^Noite/).click();
        await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').map((p) => p.corpo)).toEqual([{ opcaoIds: ['o2'] }]);
        expect(api.pedidos.find((p) => p.metodo === 'PUT')?.caminho).toBe('/aluno/comunidade/mural/p9/votos');
        const noite = opcaoDaEnquete(page, /^Noite, 3 votos, 50%, seu voto$/);
        await expect(noite).toHaveAttribute('aria-checked', 'true');
        await expect(page.getByText('Seu voto', { exact: true })).toBeVisible();
        await expect(page.getByText('6 pessoas votaram')).toBeVisible();
        await capturar(page, `enquete-votada-${nome}-${largura}`);

        // Tocar de novo na mesma retira o voto (conjunto vazio).
        await noite.click();
        await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').map((p) => p.corpo)).toEqual([{ opcaoIds: ['o2'] }, { opcaoIds: [] }]);
        await expect(opcaoDaEnquete(page, /^Noite, 2 votos, 40%$/)).toHaveAttribute('aria-checked', 'false');
        expect(api.naoTratadas).toEqual([]);
        expect(api.errosDaPagina).toEqual([]);
      });
    }

    test('aluno: várias respostas liga e desliga cada opção (caixas de seleção)', async ({ page }) => {
      const varias: EnqueteDoMural = { ...ENQUETE_ABERTA, variasRespostas: true };
      const api = await simularApi(page, {
        ...(await sessaoDeAluno(page)), ...cheia,
        'GET /aluno/comunidade/mural': muralFalso({ ...POST_ENQUETE, enquete: varias }),
        'PUT /aluno/comunidade/mural/{id}/votos': (p, route) => json(route, { ...varias, meusVotos: (p.corpo as { opcaoIds: string[] }).opcaoIds }),
      });
      await page.goto('/aluno/comunidade');
      await expect(page.getByText('Escolha uma ou mais opções')).toBeVisible();
      await page.getByRole('checkbox', { name: /^Manhã/ }).click();
      await expect(page.getByRole('checkbox', { name: /^Manhã.*seu voto$/ })).toHaveAttribute('aria-checked', 'true');
      await page.getByRole('checkbox', { name: /^Noite/ }).click();
      await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').map((p) => p.corpo)).toEqual([{ opcaoIds: ['o1'] }, { opcaoIds: ['o1', 'o2'] }]);
      await expect(page.getByRole('checkbox', { name: /seu voto$/ })).toHaveCount(2);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: "Mostrar votos" abre a folha com "Você" e filtra por opção', async ({ page }) => {
      const api = await simularApi(page, {
        ...(await sessaoDeAluno(page)), ...cheia,
        'GET /aluno/comunidade/mural': muralFalso({ ...POST_ENQUETE, enquete: { ...ENQUETE_ABERTA, meusVotos: ['o2'] } }),
        'GET /aluno/comunidade/mural/{id}/votos': (p, route) => {
          const opcao = p.busca.get('opcaoId');
          const itens = VOTOS.votantes.itens.filter((v) => !opcao || v.opcaoId === opcao);
          return json(route, { ...VOTOS, votantes: { total: itens.length, itens } });
        },
      });
      await page.goto('/aluno/comunidade');
      await page.getByRole('button', { name: 'Mostrar votos' }).click();
      const folha = page.getByRole('dialog', { name: 'Votos da enquete' });
      await expect(folha.getByText('Você', { exact: true })).toBeVisible();
      await expect(folha.getByText('Colega (Coleguinha)', { exact: true })).toBeVisible();
      await expect(folha.getByText(/^Noite · /)).toBeVisible();
      await capturar(page, `enquete-votos-${largura}`);
      await folha.getByRole('radio', { name: /^Manhã/ }).click();
      await expect.poll(() => api.pedidos.some((p) => p.caminho === '/aluno/comunidade/mural/p9/votos' && p.busca.get('opcaoId') === 'o1')).toBe(true);
      await expect(folha.getByText('Você', { exact: true })).toHaveCount(0);
      await expect(folha.getByText('Colega (Coleguinha)', { exact: true })).toBeVisible();
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: enquete encerrada mostra o selo, sem aviso e sem voto; 409 ENQUETE_ENCERRADA avisa e recarrega', async ({ page }) => {
      let encerrada = false;
      const e = erroApi(409, 'A enquete foi encerrada.', 'ENQUETE_ENCERRADA');
      const api = await simularApi(page, {
        ...(await sessaoDeAluno(page)), ...cheia,
        'GET /aluno/comunidade/mural': (p, route) => json(route, doTipo(p, { ...POST_ENQUETE, enquete: { ...ENQUETE_ABERTA, encerrada } })),
        'PUT /aluno/comunidade/mural/{id}/votos': (_p, route) => { encerrada = true; return json(route, e.corpo, e.status); },
      });
      await page.goto('/aluno/comunidade');
      await opcaoDaEnquete(page, /^Manhã/).click();
      await expect(page.getByText('A enquete foi encerrada. Seu voto não mudou.')).toBeVisible();
      await expect(page.getByText('Encerrada', { exact: true })).toBeVisible();
      await expect(page.getByText(/^Seu nome, suas escolhas/)).toHaveCount(0);
      await expect(opcaoDaEnquete(page, /^Manhã/)).toBeDisabled();
      expect(api.pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/aluno/comunidade/mural').length).toBeGreaterThanOrEqual(2);
      await capturar(page, `enquete-encerrada-${largura}`);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: vídeo do YouTube com a nossa capa; o player só monta depois do toque, e "Abrir no YouTube" vai pelo id', async ({ page, context }) => {
      await context.route('https://www.youtube-nocookie.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>player de teste</p>' }));
      await context.route('https://www.youtube.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>YouTube de teste</p>' }));
      let jpeg: Buffer = Buffer.alloc(0);
      const api = await simularApi(page, {
        ...(await sessaoDeAluno(page)), ...cheia,
        'GET /aluno/comunidade/mural': muralFalso(VIDEO_YT),
        'GET /aluno/comunidade/capas/{id}': (_p, route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: jpeg }),
      });
      // O JPEG fictício sai da página em branco, antes de abrir a tela (a capa é pedida logo na primeira renderização).
      jpeg = await jpegFicticio(page);
      await page.goto('/aluno/comunidade');
      const assistir = page.getByRole('button', { name: 'Assistir aqui: Técnica do agachamento' });
      await expect(assistir).toBeVisible();
      await expect.poll(() => api.pedidos.some((p) => p.caminho === '/aluno/comunidade/capas/capa-1')).toBe(true);
      // A capa é a nossa (blob: pela API), nunca imagem de fora; nada do YouTube carrega antes do toque.
      await expect(page.locator('img[src^="blob:"]')).toHaveCount(1);
      await expect(page.locator('img[src^="http"]')).toHaveCount(0);
      await expect(page.locator('iframe')).toHaveCount(0);
      await capturar(page, `video-capa-${largura}`);

      await assistir.click();
      const player = page.locator('iframe');
      await expect(player).toHaveAttribute('src', `https://www.youtube-nocookie.com/embed/${ID_DO_YOUTUBE}`);
      await expect(player).toHaveAttribute('title', 'Vídeo: Técnica do agachamento');
      await expect(player).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      await expect(player).toHaveAttribute('allow', 'fullscreen; picture-in-picture; encrypted-media');
      await expect(player).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
      await expect(player).toHaveAttribute('loading', 'lazy');
      await expect(assistir).toHaveCount(0);
      await capturar(page, `video-tocando-${largura}`);

      const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Abrir no YouTube: Técnica do agachamento' }).click()]);
      await popup.waitForURL(`https://www.youtube.com/watch?v=${ID_DO_YOUTUBE}`);
      expect(await popup.evaluate(() => window.opener)).toBeNull();
      expect(api.errosDaPagina).toEqual([]);
    });

    test('aluno: vídeo de outro site também mostra a nossa capa, sem player, e "Abrir vídeo" abre fora do app', async ({ page, context }) => {
      await context.route('https://video.exemplo.invalid/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Vídeo de teste</p>' }));
      let jpeg: Buffer = Buffer.alloc(0);
      const api = await simularApi(page, {
        ...(await sessaoDeAluno(page)), ...cheia,
        'GET /aluno/comunidade/mural': muralFalso({ ...VIDEO, capaId: 'capa-1' }),
        'GET /aluno/comunidade/capas/{id}': (_p, route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: jpeg }),
      });
      jpeg = await jpegFicticio(page);
      await page.goto('/aluno/comunidade');
      const abrir = page.getByRole('button', { name: 'Abrir vídeo: Vídeo de teste da técnica' });
      await expect(abrir).toBeVisible();
      await expect.poll(() => api.pedidos.some((p) => p.caminho === '/aluno/comunidade/capas/capa-1')).toBe(true);
      await expect(page.locator('img[src^="blob:"]')).toHaveCount(1);
      await expect(page.locator('img[src^="http"]')).toHaveCount(0);
      await expect(page.locator('iframe')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Assistir aqui/ })).toHaveCount(0);
      await capturar(page, `video-outro-site-capa-${largura}`);
      const [popup] = await Promise.all([page.waitForEvent('popup'), abrir.click()]);
      await popup.waitForURL('https://video.exemplo.invalid/aula');
      expect(await popup.evaluate(() => window.opener)).toBeNull();
      expect(api.errosDaPagina).toEqual([]);
    });

    const abrirEquipe = async (page: Page, respostas: RespostasApi, permissoes = [...PERMISSOES_TREINADOR, 'TREINO_LER', 'COMUNIDADE_MODERAR']) =>
      simularApi(page, { ...(await sessao(page, TREINADOR, { permissoes })), ...vazia, ...respostas });

    test('treinador: cria enquete com o aviso de voto identificado, 2 a 6 opções, várias respostas e prazo', async ({ page }) => {
      const api = await abrirEquipe(page, { 'POST /comunidade/mural': { corpo: { ...POST_ENQUETE, id: 'novo' } } });
      await page.goto('/treinador/comunidade?aba=mural');
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      const folha = novaPublicacao(page);
      await folha.getByRole('radio', { name: 'Enquete', exact: true }).click();
      await expect(folha.getByText('O voto é identificado: não pergunte sobre saúde, lesão, peso ou dieta.')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Remover a opção 1' })).toHaveCount(0);
      await folha.getByRole('button', { name: /^Publicar/ }).click();
      await expect(folha.getByText('Cada opção tem de 1 a 80 caracteres.')).toBeVisible();
      expect(api.pedidos.some((p) => foiPost(p, '/comunidade/mural'))).toBe(false);

      await folha.getByRole('textbox', { name: 'Pergunta' }).fill('Qual horário de treino você prefere?');
      await folha.getByRole('textbox', { name: 'Opção 1' }).fill('Manhã');
      await folha.getByRole('textbox', { name: 'Opção 2' }).fill('Noite');
      await folha.getByRole('button', { name: 'Adicionar opção' }).click();
      await folha.getByRole('textbox', { name: 'Opção 3' }).fill('Tarde');
      await folha.getByRole('button', { name: 'Remover a opção 3' }).click();
      await expect(folha.getByRole('textbox', { name: 'Opção 3' })).toHaveCount(0);
      await folha.getByRole('switch', { name: 'Permitir várias respostas' }).click();
      const prazo = dataDaquiA(10);
      await folha.getByRole('textbox', { name: /^Encerra em/ }).fill(prazo.tela);
      await capturar(page, `treinador-nova-enquete-${largura}`);
      await folha.getByRole('button', { name: /^Publicar/ }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/comunidade/mural'))?.corpo).toEqual({
        tipo: 'ENQUETE', texto: 'Qual horário de treino você prefere?', opcoes: ['Manhã', 'Noite'], variasRespostas: true, encerraEm: prazo.iso,
      });
      await expect(folha).toHaveCount(0);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('treinador: vídeo com capa (envia na hora, prévia pela API, remove e escolhe de novo) e vídeo com capa', async ({ page }) => {
      let n = 0;
      let jpeg: Buffer = Buffer.alloc(0);
      const api = await abrirEquipe(page, {
        'POST /comunidade/capas': (_p, route) => json(route, { id: `capa-${++n}` }),
        'POST /comunidade/capas/youtube': { corpo: { id: 'capa-yt' } },
        'GET /comunidade/capas/{id}': (_p, route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: jpeg }),
        'POST /comunidade/mural': { corpo: { ...VIDEO_YT, id: 'novo' } },
        'POST /comunidade/aulas': { corpo: { ...AULA, id: 'novo' } },
      });
      await page.goto('/treinador/comunidade?aba=mural');
      jpeg = await jpegFicticio(page);
      await page.getByRole('button', { name: 'Nova publicação' }).click();
      const folha = novaPublicacao(page);
      await folha.getByRole('radio', { name: 'Vídeo', exact: true }).click();
      await folha.getByRole('textbox', { name: 'Título do vídeo' }).fill('Técnica do agachamento');
      await folha.getByRole('textbox', { name: 'Link do vídeo' }).fill(VIDEO_YT.videoUrl!);
      const escolherCapa = async (dentro: ReturnType<Page['getByRole']>, rotulo: string) => {
        const [seletor] = await Promise.all([page.waitForEvent('filechooser'), dentro.getByRole('button', { name: rotulo }).click()]);
        await seletor.setFiles({ name: 'capa-ficticia.jpg', mimeType: 'image/jpeg', buffer: jpeg });
      };
      await escolherCapa(folha, 'Escolher capa');
      await expect(folha.getByRole('button', { name: 'Trocar capa' })).toBeVisible();
      await expect(folha.getByRole('img', { name: 'Capa do vídeo' })).toBeVisible();
      await capturar(page, `treinador-video-com-capa-${largura}`);
      await folha.getByRole('button', { name: 'Remover capa' }).click();
      await expect(folha.getByRole('button', { name: 'Escolher capa' })).toBeVisible();
      await escolherCapa(folha, 'Escolher capa');
      await expect(folha.getByRole('button', { name: 'Trocar capa' })).toBeVisible();
      await folha.getByRole('button', { name: /^Publicar/ }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/comunidade/mural'))?.corpo).toEqual({
        tipo: 'VIDEO', texto: 'Técnica do agachamento', videoUrl: VIDEO_YT.videoUrl, capaId: 'capa-2',
      });
      await expect(folha).toHaveCount(0);

      await page.getByRole('tab', { name: 'Vídeos' }).click();
      await page.getByRole('button', { name: 'Novo vídeo' }).click();
      const aulao = page.getByRole('dialog', { name: 'Novo vídeo' });
      await aulao.getByRole('textbox', { name: 'Título' }).fill('Vídeo de teste');
      // Link do YouTube: a capa vem sozinha (D4); trocar pela da galeria fica valendo.
      await aulao.getByRole('textbox', { name: 'Link do vídeo' }).fill('https://youtu.be/abcDEF12345');
      await expect(aulao.getByRole('button', { name: 'Trocar capa' })).toBeVisible();
      await escolherCapa(aulao, 'Trocar capa');
      await expect.poll(() => api.pedidos.filter((p) => foiPost(p, '/comunidade/capas')).length).toBe(3);
      await aulao.getByRole('button', { name: 'Publicar', exact: true }).click();
      await expect.poll(() => api.pedidos.find((p) => foiPost(p, '/comunidade/aulas'))?.corpo)
        .toEqual({ titulo: 'Vídeo de teste', videoUrl: 'https://youtu.be/abcDEF12345', playlistId: null, capaId: 'capa-3' });
      expect(api.pedidos.filter((p) => foiPost(p, '/comunidade/capas/youtube')).length).toBe(1);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('treinador sem moderar: reações só para leitura (sem botões), mas vota com TREINO_LER', async ({ page }) => {
      const api = await abrirEquipe(page, {
        'GET /comunidade/mural': muralFalso(POST, POST_ENQUETE),
        'PUT /comunidade/mural/{id}/votos': (p, route) => json(route, { ...ENQUETE_ABERTA, meusVotos: (p.corpo as { opcaoIds: string[] }).opcaoIds }),
      }, [...PERMISSOES_TREINADOR, 'TREINO_LER']);
      await page.goto(MURAL_DOS_ALUNOS_DA_EQUIPE);
      await expect(page.getByText('Semana de constância, time!')).toBeVisible();
      await expect(page.getByLabel('Curtir, 2 reações', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /reaç(ão|ões)/ })).toHaveCount(0);
      // A enquete mora em Avisos.
      await page.getByRole('radio', { name: 'Avisos', exact: true }).click();
      await expect(page.getByText('Semana de constância, time!')).toHaveCount(0);
      await opcaoDaEnquete(page, /^Manhã/).click();
      await expect.poll(() => api.pedidos.find((p) => p.metodo === 'PUT')?.caminho).toBe('/comunidade/mural/p9/votos');
      expect(api.errosDaPagina).toEqual([]);
    });
  });
}
