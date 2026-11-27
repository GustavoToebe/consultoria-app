import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AulaDaComunidade, ColegaDaLista, ConquistaDoAluno, PaginaDoMural, PodDoAluno, PosicaoNoRanking, PostDoMural } from '../src/api/comunidadeTipos';
import { fixarHoje, sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * App do aluno na web, Comunidade (27/11, contêiner do treinador): título e abas na largura do contêiner, ao lado do menu; o
 * mural no padrão do treinador, feed de 720 + coluna de 340 (vão 32) alinhados à esquerda, com a coluna dos números ao lado
 * assim que o bloco de 1092 cabe na área do mural (abaixo, a faixa dos números no topo do feed); a linha de controles
 * (Avisos/Alunos, busca, Filtros e "Nova publicação") na largura do feed; Vídeos e Colegas medem a própria largura; em
 * Conquistas a posição vai no apoio da `PrincipalComApoio`. O celular (390) não muda. Relógio fixo; API simulada, só dados
 * fictícios. Capturas com `E2E_CAPTURAS` (ou `CAPTURAS_ALUNO_LAYOUT`): `<base>/comunidade-<nome>-<largura>-<tema>.png`, mais
 * o Mural do treinador na mesma largura, para comparar.
 */

const BASE = process.env.E2E_CAPTURAS ?? process.env.CAPTURAS_ALUNO_LAYOUT;
type Tema = 'ESCURO' | 'CLARO';
/** Menu aberto (240 px) e minimizado em 1024; 1536 é o notebook a 125%. */
const MATRIZ: { largura: number; altura: number; recolhido?: boolean; temas: Tema[] }[] = [
  { largura: 390, altura: 844, temas: ['ESCURO', 'CLARO'] },
  { largura: 1024, altura: 768, recolhido: true, temas: ['ESCURO'] },
  { largura: 1280, altura: 720, temas: ['ESCURO', 'CLARO'] },
  { largura: 1536, altura: 864, temas: ['ESCURO'] },
  { largura: 1920, altura: 1080, temas: ['ESCURO', 'CLARO'] },
  { largura: 3440, altura: 1440, temas: ['ESCURO', 'CLARO'] },
];
const nomeDa = (m: { largura: number; recolhido?: boolean }) => `${m.largura}${m.recolhido ? '-minimizado' : ''}`;

async function capturar(page: Page, nome: string, largura: string, tema: string) {
  if (!BASE) return;
  fs.mkdirSync(BASE, { recursive: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(BASE, `${nome}-${largura}-${tema.toLowerCase()}.png`) });
}

async function preparar(page: Page, largura: number, altura: number, tema: Tema = 'ESCURO', recolhido = false, id = ALUNO.id) {
  await page.setViewportSize({ width: largura, height: altura });
  await fixarHoje(page);
  await page.addInitScript(([usuario, prefs, minimizado]) => {
    try {
      if (minimizado) localStorage.setItem('menu-lateral-recolhido', '1');
      else localStorage.removeItem('menu-lateral-recolhido');
      localStorage.setItem(`treinos:${usuario}:preferencias`, JSON.stringify(prefs));
    } catch { /* quadro sem armazenamento */ }
  }, [id, { tema, contraste: 'PADRAO', larguraConteudo: 'AUTOMATICA' }, recolhido] as const);
}

const caixa = async (l: Locator) => {
  const c = await l.boundingBox();
  if (!c) throw new Error('elemento sem caixa');
  return c;
};
const assentado = (conferir: () => Promise<void>) => expect(conferir).toPass({ timeout: 10_000 });
const semRolagemHorizontal = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
/** Borda direita do menu lateral (0 sem menu): o contêiner começa logo depois dele, com o recuo da `Tela`. */
const fimDoMenu = (page: Page) => page.evaluate(() => document.querySelector('[role="menubar"]')?.getBoundingClientRect().right ?? 0);

const POST: PostDoMural = {
  id: 'x', autorId: 'u1', autorNome: 'Aluno Fictício', autorApelido: null, autorEhAluno: true, autorFotoUrl: null, texto: '',
  tipo: 'CONVERSA', videoUrl: null, capaId: null, enquete: null, fotos: [], respondida: false, fixado: false, criadoEm: '2026-10-18T09:00:00-03:00',
  reacoes: {}, minhasReacoes: [], totalComentarios: 0, podId: null, podNome: null,
};
const POSTS: PostDoMural[] = Array.from({ length: 6 }, (_, i) => ({
  ...POST, id: `a${i}`, autorId: `u${i + 2}`, totalComentarios: i,
  texto: `Publicação fictícia ${i + 1}: treino de teste concluído, cargas registradas e a semana fechada com constância.`,
}));
const AVISO: PostDoMural = { ...POST, id: 'av', autorEhAluno: false, autorNome: 'Treinadora Teste', tipo: 'AVISO', fixado: true, texto: 'Aviso fictício fixado: a academia fecha mais cedo na sexta.' };
const CONQUISTAS: ConquistaDoAluno[] = ['Primeiro treino', 'Dez treinos', 'Semana completa', 'Novo recorde'].map((titulo, i) => ({
  id: `c${i}`, tipo: `T${i}`, titulo, descricao: `Conquista fictícia ${i + 1}.`, icone: 'award', conquistadaEm: `2026-10-1${i}T12:00:00-03:00`,
}));
const RANKING: PosicaoNoRanking = { posicao: 2, treinosConcluidos: 8, pontuacao: 80, participantes: 12, nivel: 2, xp: 130, xpNoNivel: 30, faltam: 70 };
const AULA: AulaDaComunidade = {
  id: 'v1', titulo: 'Vídeo fictício', descricao: 'Descrição fictícia do vídeo.', videoUrl: 'https://exemplo.test/video', capaId: null,
  playlistId: null, ordem: 0, publicada: true, criadaEm: '2026-10-19T12:00:00-03:00', totalComentarios: 0,
};
const AULAS: AulaDaComunidade[] = Array.from({ length: 7 }, (_, i) => ({ ...AULA, id: `v${i}`, titulo: `Vídeo fictício ${i + 1}`, ordem: i }));
const COLEGAS: ColegaDaLista[] = Array.from({ length: 8 }, (_, i) => ({ autorId: `k${i}`, nome: `Colega Fictício ${i + 1}`, nivel: 1 + (i % 4), temFoto: false }));
const POD: PodDoAluno = { id: 'd0000000-0000-4000-8000-0000000000a1', nome: 'Turma das 6h' };
const pagina = (content: PostDoMural[]): PaginaDoMural => ({ content, totalElements: content.length });

async function abrir(page: Page, { aba = '', pod = null as PodDoAluno | null, publica = true, mural = 'ok' as 'ok' | 'vazio' | 'erro' } = {}) {
  const api = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    'GET /aluno/comunidade/configuracao': { corpo: { alunosPublicam: publica, podeAnexarFoto: false, pod } },
    'GET /aluno/comunidade/mural': (p, route) => mural === 'erro' ? json(route, erroApi(500, 'Falha no servidor.').corpo, 500)
      : json(route, pagina(mural === 'vazio' ? [] : POSTS.filter((x) => x.tipo === p.busca.get('tipo')))),
    'GET /aluno/comunidade/aulas': { corpo: AULAS },
    'GET /aluno/comunidade/conquistas': { corpo: CONQUISTAS },
    'GET /aluno/comunidade/ranking': { corpo: RANKING },
    'GET /aluno/comunidade/perfis': { corpo: { itens: COLEGAS, total: COLEGAS.length } },
  });
  await page.goto(`/aluno/comunidade?mural=alunos${aba ? `&aba=${aba}` : ''}`);
  await expect(page.getByRole('heading', { name: 'Comunidade', level: 1 })).toBeVisible();
  return api;
}

// ---------------------------------------------------------------- Capturas

test.describe('capturas da Comunidade do aluno', () => {
  test.skip(!BASE, 'só com E2E_CAPTURAS');
  for (const m of MATRIZ) {
    for (const tema of m.temas) {
      const largura = nomeDa(m);
      test(`mural, grupo, vídeos, conquistas, colegas e erro em ${largura} px, ${tema}`, async ({ page }) => {
        test.slow();
        await preparar(page, m.largura, m.altura, tema, m.recolhido);
        await abrir(page);
        await expect(page.getByText(POSTS[0].texto)).toBeVisible();
        await capturar(page, 'comunidade-mural', largura, tema);
        await abrir(page, { pod: POD });
        await expect(page.getByText(POSTS[0].texto)).toBeVisible();
        await capturar(page, 'comunidade-mural-com-grupo', largura, tema);
        await abrir(page, { aba: 'auloes' });
        await expect(page.getByText('Vídeo fictício 1', { exact: true }).first()).toBeVisible();
        await capturar(page, 'comunidade-videos', largura, tema);
        await abrir(page, { aba: 'ranking' });
        await expect(page.getByRole('heading', { name: 'Suas conquistas' })).toBeVisible();
        await capturar(page, 'comunidade-conquistas', largura, tema);
        await abrir(page, { aba: 'colegas' });
        await expect(page.getByText('Colega Fictício 1', { exact: true })).toBeVisible();
        await capturar(page, 'comunidade-colegas', largura, tema);
        await abrir(page, { mural: 'erro', publica: false });
        await expect(page.getByRole('button', { name: /Tentar de novo/ }).first()).toBeVisible();
        await capturar(page, 'comunidade-mural-erro', largura, tema);
      });
    }
  }

  // Comparação: o Mural do treinador (o mesmo `MuralComLateral`) nas mesmas larguras e temas.
  for (const largura of [1280, 1920, 3440]) for (const tema of ['ESCURO', 'CLARO'] as const) {
    test(`Mural do treinador em ${largura} px, ${tema}`, async ({ page }) => {
      await preparar(page, largura, largura === 3440 ? 1440 : largura === 1920 ? 1080 : 720, tema, false, TREINADOR.id);
      await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'COMUNIDADE_MODERAR'] })),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        'GET /comunidade/aulas': { corpo: [] },
        'GET /comunidade/configuracao': { corpo: { alunosPublicam: true, alunosAnexamFotos: false } },
        'GET /comunidade/pods': { corpo: [] },
        'GET /comunidade/mural': (p, route) => json(route, pagina([AVISO, ...POSTS].filter((x) => x.tipo === p.busca.get('tipo')))),
      });
      await page.goto('/treinador/comunidade?aba=mural');
      await expect(page.getByText(AVISO.texto).first()).toBeVisible();
      await capturar(page, 'treinador-mural', String(largura), tema);
    });
  }
});

// ---------------------------------------------------------------- Arranjo

const bloco = async (page: Page) => caixa(page.getByTestId('bloco-da-comunidade'));

for (const { largura, altura, recolhido } of MATRIZ.filter((m) => m.largura >= 1024)) {
  test.describe(`Comunidade do aluno em ${largura} px (menu ${recolhido ? 'minimizado' : 'aberto'})`, () => {
    test('título e bloco na borda do contêiner, ao lado do menu; feed de 720 à esquerda e a coluna de 340 ao lado quando cabe', async ({ page }) => {
      await preparar(page, largura, altura, 'ESCURO', recolhido);
      const { errosDaPagina } = await abrir(page);
      const feed = page.getByTestId('coluna-das-publicacoes');
      await expect(feed.getByText(POSTS[0].texto)).toBeVisible();
      await assentado(async () => {
        const b = await bloco(page);
        const f = await caixa(feed);
        const titulo = await caixa(page.getByRole('heading', { name: 'Comunidade', level: 1 }));
        const menu = await fimDoMenu(page);
        expect(Math.abs(titulo.x - b.x)).toBeLessThan(2);
        expect(Math.abs(f.x - b.x)).toBeLessThan(2);
        // O contêiner começa logo depois do menu (o recuo da `Tela`), sem centralizar nem faixa vazia à esquerda.
        expect(b.x - menu).toBeLessThan(64);
        // O bloco ocupa a largura do contêiner (não para em 1092 nem em 1312).
        expect(largura - (b.x + b.width)).toBeLessThan(64);
        expect(Math.abs(f.width - Math.min(720, b.width))).toBeLessThan(2);
        if (b.width >= 1092) {
          const c = await caixa(page.getByTestId('coluna-dos-numeros'));
          expect(Math.abs(c.x - (f.x + f.width + 32))).toBeLessThan(2);
          expect(Math.abs(c.width - 340)).toBeLessThan(2);
          expect(Math.abs(c.y - f.y)).toBeLessThan(4);
        } else {
          await expect(page.getByTestId('coluna-dos-numeros')).toHaveCount(0);
          await expect(page.getByTestId('faixa-dos-numeros')).toBeVisible();
        }
      });
      await semRolagemHorizontal(page);
      expect(errosDaPagina).toEqual([]);
    });

    test('o Qual mural em cima e Avisos/Alunos, a busca e os Filtros numa linha só, na largura do feed', async ({ page }) => {
      await preparar(page, largura, altura, 'ESCURO', recolhido);
      const { errosDaPagina } = await abrir(page, { pod: POD });
      const feed = page.getByTestId('coluna-das-publicacoes');
      await expect(feed.getByText(POSTS[0].texto)).toBeVisible();
      const qual = page.getByRole('radiogroup', { name: 'Qual mural' });
      const publicacoes = page.getByRole('radiogroup', { name: 'Publicações' });
      const busca = page.getByRole('searchbox', { name: 'Buscar na comunidade' });
      const filtros = page.getByRole('button', { name: /^Filtros/ });
      await assentado(async () => {
        const [q, p, bu, fi, f] = await Promise.all([caixa(qual), caixa(publicacoes), caixa(busca), caixa(filtros), caixa(feed)]);
        const base = (c: { y: number; height: number }) => c.y + c.height;
        expect(base(q)).toBeLessThan(p.y);
        expect(Math.abs(p.y - bu.y)).toBeLessThan(6);
        expect(Math.abs(base(fi) - base(bu))).toBeLessThan(2);
        expect(p.x).toBeLessThan(bu.x);
        expect(bu.x).toBeLessThan(fi.x);
        expect(fi.x + fi.width).toBeLessThanOrEqual(f.x + f.width + 1);
        expect(bu.width).toBeGreaterThanOrEqual(200);
        expect(base(bu)).toBeLessThan(f.y);
      });
      expect(errosDaPagina).toEqual([]);
    });

    test('Nova publicação acima do feed, à direita da linha de controles', async ({ page }) => {
      await preparar(page, largura, altura, 'ESCURO', recolhido);
      const { errosDaPagina } = await abrir(page);
      const feed = page.getByTestId('coluna-das-publicacoes');
      await expect(feed.getByText(POSTS[0].texto)).toBeVisible();
      const botao = page.getByRole('button', { name: 'Nova publicação' });
      await assentado(async () => {
        const [bt, f, fi] = await Promise.all([caixa(botao), caixa(feed), caixa(page.getByRole('button', { name: /^Filtros/ }))]);
        expect(bt.y + bt.height).toBeLessThanOrEqual(f.y);
        expect(Math.abs(bt.x + bt.width - (f.x + f.width))).toBeLessThan(2);
        expect(bt.x).toBeGreaterThan(fi.x + fi.width);
        expect(bt.height).toBeGreaterThanOrEqual(44);
      });
      await botao.click();
      await expect(page.getByRole('dialog', { name: 'Nova publicação' })).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });

    test('Vídeos: grade na largura do contêiner, linhas equilibradas, nenhum vídeo sozinho na última linha', async ({ page }) => {
      await preparar(page, largura, altura, 'ESCURO', recolhido);
      const { errosDaPagina } = await abrir(page, { aba: 'auloes' });
      await expect(page.getByText('Vídeo fictício 1', { exact: true }).first()).toBeVisible();
      await assentado(async () => {
        const ys = await Promise.all(AULAS.map((_, i) => caixa(page.getByRole('heading', { name: `Vídeo fictício ${i + 1}`, exact: true })).then((c) => Math.round(c.y))));
        const linhas = [...new Set(ys)].map((y) => ys.filter((v) => Math.abs(v - y) < 2).length);
        // Em 2 colunas, 7 vídeos sempre deixam um sozinho (2 + 2 + 2 + 1, a regra da grade); a partir de 3, nunca.
        if (linhas.length > 1 && linhas[0] >= 3) {
          expect(linhas[linhas.length - 1]).toBeGreaterThanOrEqual(2);
          expect(Math.max(...linhas) - Math.min(...linhas)).toBeLessThanOrEqual(1);
        }
      });
      await semRolagemHorizontal(page);
      expect(errosDaPagina).toEqual([]);
    });

    test('Conquistas na principal e a posição no apoio ao lado, no topo das duas', async ({ page }) => {
      await preparar(page, largura, altura, 'ESCURO', recolhido);
      const { errosDaPagina } = await abrir(page, { aba: 'ranking' });
      const conquistas = page.getByRole('heading', { name: 'Suas conquistas' });
      await expect(conquistas).toBeVisible();
      await assentado(async () => {
        const b = await bloco(page);
        const apoio = await caixa(page.getByTestId('apoio-da-posicao'));
        const c = await caixa(conquistas);
        if (b.width >= 972) {
          // Lado a lado: o apoio à direita, de 380 a 440 pela faixa, encostado na borda direita do bloco.
          expect(apoio.x).toBeGreaterThan(c.x + 300);
          expect(apoio.width).toBeGreaterThanOrEqual(379);
          expect(apoio.width).toBeLessThanOrEqual(441);
          expect(Math.abs(apoio.x + apoio.width - (b.x + b.width))).toBeLessThan(2);
        } else {
          expect(apoio.y).toBeGreaterThan(c.y);
        }
      });
      expect(errosDaPagina).toEqual([]);
    });

    test('Colegas: colunas de cima para baixo, o nome perto do "Ver perfil"', async ({ page }) => {
      await preparar(page, largura, altura, 'ESCURO', recolhido);
      const { errosDaPagina } = await abrir(page, { aba: 'colegas' });
      await expect(page.getByText('Colega Fictício 1', { exact: true })).toBeVisible();
      await assentado(async () => {
        const c1 = await caixa(page.getByText('Colega Fictício 1', { exact: true }));
        const ver = await caixa(page.getByRole('button', { name: 'Ver perfil de Colega Fictício 1', exact: true }));
        expect(ver.x + ver.width - c1.x).toBeLessThan(640);
        if (largura >= 1280) {
          const c2 = await caixa(page.getByText('Colega Fictício 2', { exact: true }));
          const c8 = await caixa(page.getByText('Colega Fictício 8', { exact: true }));
          expect(c2.y).toBeGreaterThan(c1.y);
          expect(c8.x).toBeGreaterThan(c1.x + 300);
        }
      });
      await semRolagemHorizontal(page);
      expect(errosDaPagina).toEqual([]);
    });

    test('sem permissão para publicar e com o mural vazio: o texto da equipe acima do feed e o vazio no feed', async ({ page }) => {
      await preparar(page, largura, altura, 'ESCURO', recolhido);
      const { errosDaPagina } = await abrir(page, { publica: false, mural: 'vazio' });
      await expect(page.getByText('No momento, só a equipe publica no mural. Você pode reagir, votar nas enquetes e comentar.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Nova publicação' })).toHaveCount(0);
      await expect(page.getByTestId('coluna-das-publicacoes').getByText(/Nenhuma/).first()).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });
  });
}

test.describe('390 px: o celular como antes', () => {
  test('o grupo e o botão em cima, Avisos/Alunos na largura toda, a busca embaixo e a faixa dos números no topo do feed', async ({ page }) => {
    await preparar(page, 390, 844);
    const { errosDaPagina } = await abrir(page, { pod: POD });
    const feed = page.getByTestId('coluna-das-publicacoes');
    await expect(feed.getByText(POSTS[0].texto)).toBeVisible();
    const botao = page.getByRole('button', { name: 'Nova publicação' });
    const publicacoes = page.getByRole('radiogroup', { name: 'Publicações' });
    const busca = page.getByRole('searchbox', { name: 'Buscar na comunidade' });
    await assentado(async () => {
      const [bt, p, bu, f] = await Promise.all([caixa(botao), caixa(publicacoes), caixa(busca), caixa(feed)]);
      expect(bt.y).toBeLessThan(p.y);
      expect(p.y + p.height).toBeLessThanOrEqual(bu.y);
      expect(Math.abs(bt.width - f.width)).toBeLessThan(2);
      const faixa = await caixa(page.getByTestId('faixa-dos-numeros'));
      expect(faixa.y - f.y).toBeLessThan(2);
    });
    await semRolagemHorizontal(page);
    expect(errosDaPagina).toEqual([]);
  });
});
