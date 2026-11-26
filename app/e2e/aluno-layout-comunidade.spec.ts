import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AulaDaComunidade, ColegaDaLista, ConquistaDoAluno, PaginaDoMural, PodDoAluno, PosicaoNoRanking, PostDoMural } from '../src/api/comunidadeTipos';
import { fixarHoje, sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, json, simularApi } from './api-falsa';

/**
 * App do aluno na web, Comunidade (`docs/planos/aluno-web-layout.md`, seção 6, e `orientacoes-de-design-26-11.md`, 1.6, 26/11):
 * o bloco feed (720) + coluna (340) = 1092 a partir da borda esquerda do contêiner de 1312 das telas do aluno, com o título, as abas e as abas Vídeos, Conquistas e Colegas
 * na mesma largura; o "Qual mural" em cima e Avisos/Alunos, a busca, os Filtros e "Nova publicação" (à direita) numa linha
 * só, na largura do feed. O celular (390) não muda. Relógio fixo; API simulada, só dados fictícios. Capturas só com
 * `CAPTURAS_ALUNO_LAYOUT` (pasta fora do git) e `CAPTURAS_FASE` (`antes` ou `depois`): `<base>/<fase>/<nome>-<largura>-<tema>.png`.
 */

const BASE = process.env.CAPTURAS_ALUNO_LAYOUT;
const FASE = process.env.CAPTURAS_FASE ?? 'depois';
type Tema = 'ESCURO' | 'CLARO';
/** A matriz da 0.5 de `orientacoes-de-design-26-11.md`: claro e escuro em 390, 1280 e 1920; 1024 também com o menu minimizado. */
const MATRIZ: { largura: number; altura: number; recolhido?: boolean; temas: Tema[] }[] = [
  { largura: 390, altura: 844, temas: ['ESCURO', 'CLARO'] },
  { largura: 1024, altura: 768, temas: ['ESCURO'] },
  { largura: 1024, altura: 768, recolhido: true, temas: ['ESCURO'] },
  { largura: 1280, altura: 720, temas: ['ESCURO', 'CLARO'] },
  { largura: 1536, altura: 864, temas: ['ESCURO'] },
  { largura: 1920, altura: 1080, temas: ['ESCURO', 'CLARO'] },
  { largura: 2560, altura: 1440, temas: ['ESCURO'] },
  { largura: 3440, altura: 1440, temas: ['ESCURO'] },
];
const nomeDa = (m: { largura: number; recolhido?: boolean }) => `${m.largura}${m.recolhido ? '-minimizado' : ''}`;
/** O bloco de 1092 cabe na área (menu aberto a partir de 1536 de janela): a coluna dos números vai ao lado. */
const comColuna = (largura: number) => largura >= 1536;

async function capturar(page: Page, nome: string, largura: string, tema: string) {
  if (!BASE) return;
  const pasta = path.join(BASE, FASE);
  fs.mkdirSync(pasta, { recursive: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(pasta, `${nome}-${largura}-${tema.toLowerCase()}.png`), fullPage: false });
}

async function preparar(page: Page, largura: number, altura: number, tema: Tema = 'ESCURO', recolhido = false) {
  await page.setViewportSize({ width: largura, height: altura });
  await fixarHoje(page);
  await page.addInitScript(([id, prefs, minimizado]) => {
    try {
      if (minimizado) localStorage.setItem('menu-lateral-recolhido', '1');
      else localStorage.removeItem('menu-lateral-recolhido');
      localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(prefs));
    } catch { /* quadro sem armazenamento */ }
  }, [ALUNO.id, { tema, contraste: 'PADRAO', larguraConteudo: 'AUTOMATICA' }, recolhido] as const);
}

const caixa = async (l: Locator) => {
  const c = await l.boundingBox();
  if (!c) throw new Error('elemento sem caixa');
  return c;
};
const assentado = (conferir: () => Promise<void>) => expect(conferir).toPass({ timeout: 10_000 });
const semRolagemHorizontal = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
/**
 * Borda esquerda do contêiner das telas do aluno (1312, centralizado; decisão do Gustavo de 26/11): com espaço, centrado na
 * área ao lado do menu (a barra de rolagem da tela, até ~15 px, desloca a conta em até ~8 px); sem espaço, a borda da área
 * com o recuo de 16 da `Tela`. O título de todas as telas do aluno cai nesse x.
 */
async function bordaDoContainer(page: Page): Promise<number> {
  const { menu, janela } = await page.evaluate(() => ({
    menu: document.querySelector('[role="menubar"]')?.getBoundingClientRect().right ?? 0,
    janela: document.documentElement.clientWidth,
  }));
  const area = janela - menu;
  return area >= 1312 + 2 * 16 + 15 ? menu + (area - 1312) / 2 : menu + 16;
}

const POST: PostDoMural = {
  id: 'x', autorId: 'u1', autorNome: 'Aluno Fictício', autorApelido: null, autorEhAluno: true, autorFotoUrl: null, texto: '',
  tipo: 'CONVERSA', videoUrl: null, capaId: null, enquete: null, fotos: [], respondida: false, fixado: false, criadoEm: '2026-10-18T09:00:00-03:00',
  reacoes: {}, minhasReacoes: [], totalComentarios: 0, podId: null, podNome: null,
};
const POSTS: PostDoMural[] = Array.from({ length: 6 }, (_, i) => ({
  ...POST, id: `a${i}`, autorId: `u${i + 2}`, totalComentarios: i,
  texto: `Publicação fictícia ${i + 1}: treino de teste concluído, cargas registradas e a semana fechada com constância.`,
}));
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

// ---------------------------------------------------------------- Capturas (antes e depois)

test.describe('capturas da Comunidade do aluno', () => {
  test.skip(!BASE, 'só com CAPTURAS_ALUNO_LAYOUT');
  for (const m of MATRIZ) {
    for (const tema of m.temas) {
      const largura = nomeDa(m);
      test(`mural, grupo, vídeos, conquistas, colegas e erro em ${largura} px, ${tema}`, async ({ page }) => {
        test.slow();
        await preparar(page, m.largura, m.altura, tema, m.recolhido);
        await abrir(page);
        await expect(page.getByText(POSTS[0].texto)).toBeVisible();
        await capturar(page, 'mural', largura, tema);
        await abrir(page, { pod: POD });
        await expect(page.getByText(POSTS[0].texto)).toBeVisible();
        await capturar(page, 'mural-com-grupo', largura, tema);
        await abrir(page, { aba: 'auloes' });
        await expect(page.getByText('Vídeo fictício 1', { exact: true }).first()).toBeVisible();
        await capturar(page, 'videos', largura, tema);
        await abrir(page, { aba: 'ranking' });
        await expect(page.getByRole('heading', { name: 'Suas conquistas' })).toBeVisible();
        await capturar(page, 'conquistas', largura, tema);
        await abrir(page, { aba: 'colegas' });
        await expect(page.getByText('Colega Fictício 1', { exact: true })).toBeVisible();
        await capturar(page, 'colegas', largura, tema);
        await abrir(page, { mural: 'erro', publica: false });
        await expect(page.getByRole('button', { name: /Tentar de novo/ }).first()).toBeVisible();
        await capturar(page, 'mural-erro', largura, tema);
      });
    }
  }
});

// ---------------------------------------------------------------- Arranjo

/** O bloco da tela inteira (título, abas e as quatro abas). */
const bloco = async (page: Page) => caixa(page.getByTestId('bloco-da-comunidade'));

for (const { largura, altura, recolhido } of MATRIZ.filter((m) => m.largura >= 1024)) {
  test.describe(`Comunidade do aluno em ${largura} px (menu ${recolhido ? 'minimizado' : 'aberto'})`, () => {
    test('o bloco começa na borda esquerda do contêiner do aluno, com o título, o feed e a coluna dentro dele', async ({ page }) => {
      await preparar(page, largura, altura, 'ESCURO', recolhido);
      const { errosDaPagina } = await abrir(page);
      const feed = page.getByTestId('coluna-das-publicacoes');
      await expect(feed.getByText(POSTS[0].texto)).toBeVisible();
      await assentado(async () => {
        const b = await bloco(page);
        const f = await caixa(feed);
        const titulo = await caixa(page.getByRole('heading', { name: 'Comunidade', level: 1 }));
        // Título, abas e feed na mesma borda esquerda: a do bloco.
        expect(Math.abs(titulo.x - b.x)).toBeLessThan(2);
        expect(Math.abs(f.x - b.x)).toBeLessThan(2);
        // O bloco começa na borda esquerda do contêiner de 1312 (o mesmo x do título das outras telas do aluno) e termina antes.
        expect(Math.abs(b.x - (await bordaDoContainer(page)))).toBeLessThan(10);
        if (comColuna(largura)) {
          expect(Math.abs(b.width - 1092)).toBeLessThan(2);
          const c = await caixa(page.getByTestId('coluna-dos-numeros'));
          expect(Math.abs(c.x + c.width - (b.x + b.width))).toBeLessThan(2);
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
        // O segmento (com a trilha de 3 px em volta) e o campo começam na mesma altura; Filtros com a base do campo.
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

    for (const aba of ['auloes', 'ranking', 'colegas'] as const) {
      test(`aba ${aba}: na largura e na borda do bloco`, async ({ page }) => {
        await preparar(page, largura, altura, 'ESCURO', recolhido);
        const { errosDaPagina } = await abrir(page, { aba });
        const alvo = aba === 'auloes' ? page.getByText('Vídeo fictício 1', { exact: true }).first()
          : aba === 'ranking' ? page.getByRole('heading', { name: 'Suas conquistas' }) : page.getByText('Colega Fictício 1', { exact: true });
        await expect(alvo).toBeVisible();
        await assentado(async () => {
          const b = await bloco(page);
          if (comColuna(largura)) expect(Math.abs(b.width - 1092)).toBeLessThan(2);
          const a = await caixa(alvo);
          expect(a.x).toBeGreaterThanOrEqual(b.x - 1);
          expect(a.x + a.width).toBeLessThanOrEqual(b.x + b.width + 1);
        });
        if (aba === 'auloes' && comColuna(largura)) {
          // 7 vídeos em 3 colunas no bloco de 1092: 3 + 2 + 2, nenhum cartão sozinho na última linha; cartões da mesma largura.
          const titulo = (n: number) => caixa(page.getByRole('heading', { name: `Vídeo fictício ${n}`, exact: true }));
          await assentado(async () => {
            const [t1, t3, t4, t5, t6, t7] = await Promise.all([titulo(1), titulo(3), titulo(4), titulo(5), titulo(6), titulo(7)]);
            expect(Math.abs(t3.y - t1.y)).toBeLessThan(2);
            expect(t4.y).toBeGreaterThan(t3.y + 10);
            expect(Math.abs(t5.y - t4.y)).toBeLessThan(2);
            expect(t6.y).toBeGreaterThan(t5.y + 10);
            expect(Math.abs(t7.y - t6.y)).toBeLessThan(2);
            expect(Math.abs(t6.x - t1.x)).toBeLessThan(2);
          });
        }
        if (aba === 'colegas' && largura >= 1280) {
          // Duas colunas de cima para baixo (1 a 4 e 5 a 8): o nome fica perto do "Ver perfil", a linha não cruza o bloco.
          const nome = (n: number) => caixa(page.getByText(`Colega Fictício ${n}`, { exact: true }));
          await assentado(async () => {
            const [c1, c5] = await Promise.all([nome(1), nome(5)]);
            const ver = await caixa(page.getByRole('button', { name: 'Ver perfil de Colega Fictício 1', exact: true }));
            expect(Math.abs(c5.y - c1.y)).toBeLessThan(2);
            expect(c5.x).toBeGreaterThan(c1.x + 300);
            expect(ver.x + ver.width - c1.x).toBeLessThan(560);
          });
        }
        await semRolagemHorizontal(page);
        expect(errosDaPagina).toEqual([]);
      });
    }

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
      // O botão na largura toda, como antes.
      expect(Math.abs(bt.width - f.width)).toBeLessThan(2);
      const faixa = await caixa(page.getByTestId('faixa-dos-numeros'));
      expect(faixa.y - f.y).toBeLessThan(2);
    });
    await semRolagemHorizontal(page);
    expect(errosDaPagina).toEqual([]);
  });
});
