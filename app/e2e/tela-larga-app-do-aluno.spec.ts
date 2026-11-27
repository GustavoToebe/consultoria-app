import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AulaDaComunidade, PaginaDoMural, PostDoMural } from '../src/api/comunidadeTipos';
import type { ItemDaVitrineDoAluno } from '../src/api/vitrineTipos';
import type { ConteudoDieta, DiaDeTreino, ItemDieta, PastaDoAluno, RegistroPeso, VersaoDetalhe } from '../src/api/tipos';
import { ALUNO, erroApi, json, sessao, simularApi, type RespostasApi } from './api-falsa';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa, SESSOES_COM_DIAS } from './aluno';

/**
 * Tela larga do app do aluno na web, o que vale para todas as abas (contêiner de 27/11, o mesmo do treinador: começa ao lado
 * do menu e preenche a área, sem teto): o bloco começa no recuo da `Tela` e termina na borda direita, sem rolagem de lado e
 * sem erro na página. O arranjo de cada aba está na própria spec: `aluno-layout-inicio`, `-treino`, `-treino-do-dia`,
 * `-exercicio`, `-dieta`, `-historico`, `-comunidade` e `-conta`. Aqui ficam só o que elas não conferem. Só dados fictícios.
 */

const item = (uid: string): ItemDieta => ({ uid, alimentoId: null, nome: `Alimento ${uid}`, quantidade: 100, unidade: 'g', kcal: 120, proteina: 8, carboidrato: 14, gordura: 3, manual: true });
const DIETA: VersaoDetalhe<ConteudoDieta> = {
  id: 'd0000000-0000-4000-8000-000000000001', planoId: 'd0000000-0000-4000-8000-000000000002', numero: 1, titulo: 'Dieta fictícia',
  inicio: '2026-10-05', fim: '2026-11-01', publicadoEm: '2026-10-05T12:00:00Z',
  conteudo: {
    objetivo: null, dataInicio: null, profissional: null, observacoes: null, orientacoes: [], suplementacao: [], ergogenicos: null, aguaLitros: 3, variacoes: [],
    refeicoes: Array.from({ length: 5 }, (_, i) => ({ uid: `r${i}`, nome: `Refeição ${i + 1}`, horario: null, observacao: null, opcoes: [{ uid: `o${i}`, rotulo: 'A', itens: [item(`${i}a`), item(`${i}b`)] }] })),
  },
};
const POST: PostDoMural = {
  id: 'p0', autorId: 'u0', autorNome: 'Treinadora Teste', autorApelido: null, autorEhAluno: false, autorFotoUrl: null, texto: 'Aviso fictício.',
  tipo: 'CONVERSA', videoUrl: null, capaId: null, enquete: null, fotos: [], respondida: false, fixado: false, criadoEm: '2026-10-19T12:00:00-03:00',
  reacoes: {}, minhasReacoes: [], totalComentarios: 0, podId: null, podNome: null,
};
const POSTS = Array.from({ length: 5 }, (_, i) => ({ ...POST, id: `p${i}`, texto: `Publicação fictícia ${i + 1}` }));
const AULA: AulaDaComunidade = { id: 'a0', titulo: 'Vídeo fictício', descricao: null, videoUrl: 'https://exemplo.test/video', capaId: null, playlistId: null, ordem: 0, publicada: true, criadaEm: '2026-10-19T12:00:00-03:00', totalComentarios: 0 };
const PASTAS: PastaDoAluno[] = [{ id: 'p-out', titulo: 'Outubro', inicio: '2026-10-05', fim: '2026-11-01', concluidaEm: null, atual: true, temTreino: true, temDieta: true }];
const DIAS: DiaDeTreino[] = [{ data: '2026-10-12', sessoes: [{ sessaoUid: 'sa', sessao: 'Peito e tríceps', planoVersaoId: 't0000000-0000-4000-8000-000000000002',
  exercicios: [{ exercicioUid: 'sae1', exercicioId: 'sae1', nome: 'Exercício sae1', series: [{ id: 's1', serieUid: 's', tipo: 'WS', trabalho: true, carga: 40, unidade: 'kg', repeticoes: 8, concluida: true, observacao: null }] }] }] }];
const PESOS: RegistroPeso[] = [{ id: 'p1', data: '2026-10-12', pesoKg: 80, variacao: null, observacao: null }];
const VITRINE: ItemDaVitrineDoAluno[] = [{
  id: 'v0000000-0000-4000-8000-000000000001', nome: 'Item fictício', descricao: 'Descrição fictícia.', tipo: 'FISICO',
  precoCentavos: null, precoVigenteCentavos: null, especialAte: null, cupom: null, linkUrl: null, temFoto: false, fotoAtualizadaEm: null, categoria: null,
}];

/** Divisões A a E. */
const CINCO_DIVISOES = [...SESSOES_COM_DIAS, sessaoFalsa('sd', 'Ombros', 6, 5), sessaoFalsa('se', 'Corpo todo', null, 4)];

async function abrir(page: Page, largura: number, caminho: string, extra: RespostasApi = {}) {
  await page.setViewportSize({ width: largura, height: 1080 });
  await page.addInitScript((id) => { try { localStorage.removeItem('menu-lateral-recolhido'); localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })); } catch { /* sem armazenamento */ } }, ALUNO.id);
  await fixarHoje(page);
  const api = await simularApi(page, {
    ...(await sessaoDeAlunoComTreino(page, CINCO_DIVISOES)),
    ...(await sessao(page, ALUNO, { retornoHabilitado: true })),
    'GET /aluno/dieta': { corpo: { dieta: DIETA } },
    'GET /aluno/atualizacao': erroApi(404, 'Nenhuma atualização.', 'NAO_ENCONTRADO'),
    'GET /aluno/atualizacoes': { corpo: [] },
    'GET /aluno/sessoes-concluidas': { corpo: { totalConcluidos: 0, sessoes: [] } },
    'GET /aluno/comunidade/configuracao': { corpo: { alunosPublicam: true, podeAnexarFoto: false } },
    'GET /aluno/comunidade/mural': (p, route) => json(route, { content: POSTS.filter((x) => !p.busca.get('tipo') || x.tipo === p.busca.get('tipo')), totalElements: POSTS.length } satisfies PaginaDoMural),
    'GET /aluno/comunidade/aulas': { corpo: [AULA] },
    'GET /aluno/comunidade/conquistas': { corpo: [] },
    'GET /aluno/pastas': { corpo: PASTAS },
    'GET /aluno/execucoes': { corpo: DIAS },
    'GET /aluno/pesos': { corpo: PESOS },
    'GET /aluno/fotos/linha-do-tempo': { corpo: [] },
    'GET /aluno/avaliacoes-fisicas': { corpo: [] },
    ...extra,
  });
  await page.goto(caminho);
  return api;
}

/** A caixa do elemento; espera ela existir (a `Tabela` do peso troca de elemento depois de se medir). */
const caixa = async (l: Locator) => {
  await expect(l).toBeVisible();
  let b: Awaited<ReturnType<Locator['boundingBox']>> = null;
  await expect.poll(async () => (b = await l.boundingBox()) !== null).toBe(true);
  return b!;
};
/** Borda esquerda e direita do contêiner das telas do aluno: ao lado do menu, com o recuo da `Tela` (48 na ultralarga). */
async function conteiner(page: Page) {
  const { menu, janela } = await page.evaluate(() => ({
    menu: document.querySelector('[role="menubar"]')?.getBoundingClientRect().right ?? 0,
    janela: document.documentElement.clientWidth,
  }));
  const recuo = janela - menu >= 2400 ? 48 : 16;
  // A barra de rolagem da área (até ~15 px) fica dentro do lado direito.
  return { esquerda: menu + recuo, direita: janela - recuo, folgaDaDireita: 20 };
}
/** A borda direita do bloco mais à direita (cartões, regiões e colunas de apoio). */
const direitaDoConteudo = (page: Page) => page.evaluate(() => Math.max(...Array.from(
  document.querySelectorAll('[data-testid="cartao"], [role="region"], [role="complementary"]'),
  (e) => { const r = e.getBoundingClientRect(); return r.width > 0 ? r.right : 0; },
)));
const semRolagemDeLado = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

// O contêiner sem teto (27/11) nas abas cujas specs não medem contra o menu e a janela: o título na borda esquerda e o bloco
// mais à direita no recuo da direita (sem faixa vazia), com o menu aberto. Dieta, Comunidade e Conta conferem isso nas próprias.
const ESPERA: Record<string, (page: Page) => Locator> = {
  '/aluno': (page) => page.getByTestId('inicio-coluna-hoje'),
  '/aluno/treino': (page) => page.getByRole('region', { name: 'Treino da divisão' }),
  '/aluno/historico': (page) => page.getByRole('heading', { name: 'Progresso por exercício' }),
};
for (const largura of [1920, 3440]) {
  for (const [caminho, espera] of Object.entries(ESPERA)) {
    test(`${largura} ${caminho}: o bloco começa ao lado do menu e vai até a borda direita, sem rolagem de lado`, async ({ page }) => {
      const { errosDaPagina } = await abrir(page, largura, caminho);
      await expect(espera(page)).toBeVisible();
      const c = await conteiner(page);
      // O arranjo assenta depois da medida da área e da entrada em cascata.
      await expect.poll(async () => Math.abs((await caixa(page.getByRole('heading', { level: 1 }).first())).x - c.esquerda)).toBeLessThan(4);
      await expect.poll(() => direitaDoConteudo(page)).toBeGreaterThan(c.direita - c.folgaDaDireita);
      expect(await direitaDoConteudo(page)).toBeLessThanOrEqual(c.direita + 1);
      expect(await semRolagemDeLado(page)).toBe(true);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('1280: a sessão do dia tem o apoio de 380 à esquerda, com o começar antes de "Outras datas", e os exercícios ao lado', async ({ page }) => {
  await abrir(page, 1280, '/aluno/sessao/sa?data=2026-10-19');
  const comecar = await caixa(page.getByRole('button', { name: 'Começar treino', exact: true }));
  const outras = await caixa(page.getByRole('heading', { name: 'Outras datas' }));
  expect(comecar.y).toBeLessThan(outras.y);
  expect(comecar.width).toBeLessThanOrEqual(380 + 1);
  expect((await caixa(page.getByRole('link', { name: /^Abrir Exercício sae/ }).first())).x).toBeGreaterThan(comecar.x + comecar.width);
});

/** O cartão (`ui/Cartao`, testID "cartao") que contém o localizador. */
const cartaoCom = (page: Page, dentro: Locator) => page.getByTestId('cartao').filter({ has: dentro });
const grade = (page: Page) => page.getByLabel(/^Mapa de treinos:/);

// Com a vitrine ao lado (`mapaAoLadoDaVitrine`: área de pelo menos ~1940), o cartão do mapa tem a largura do ano cheio e a
// grade o ocupa (antes, sozinho na linha, ~1/3 do cartão ficava vazio). Em 1920 a área não cabe os dois e a vitrine desce.
for (const largura of [2560, 3440]) {
  test(`${largura} com a vitrine: o mapa e a vitrine na mesma linha, e a grade ocupa o cartão do mapa`, async ({ page }) => {
    await abrir(page, largura, '/aluno', { ...(await sessao(page, ALUNO, { retornoHabilitado: true, vitrineHabilitada: true })), 'GET /aluno/vitrine': { corpo: VITRINE } });
    const mapa = cartaoCom(page, grade(page));
    const vitrine = cartaoCom(page, page.getByRole('heading', { name: 'Vitrine', exact: true }));
    await expect.poll(async () => {
      const [m, v] = [await caixa(mapa), await caixa(vitrine)];
      return Math.abs(v.y - m.y) < 2 && v.x > m.x + m.width;
    }).toBe(true);
    const ocupa = async () => {
      const [cartao, g] = [await caixa(mapa), await caixa(grade(page))];
      return (g.x + g.width - cartao.x) / cartao.width;
    };
    await expect.poll(ocupa).toBeGreaterThan(0.9);
  });
}

// Sem regressão no celular e no PC comum (rodam sempre, sem depender das capturas).
for (const largura of [390, 1280]) {
  for (const caminho of ['/aluno', '/aluno/treino', '/aluno/dieta', '/aluno/historico', '/aluno/comunidade']) {
    test(`${largura} ${caminho}: sem rolagem de lado e sem erro na página`, async ({ page }) => {
      const { errosDaPagina } = await abrir(page, largura, caminho);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      expect(await semRolagemDeLado(page)).toBe(true);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

// O arranjo do mural na tela larga (feed e coluna lateral, decisão 3 da revisão 2) é conferido no spec do mural.
test('1920: a busca dos vídeos fica na largura de formulário', async ({ page }) => {
  await abrir(page, 1920, '/aluno/comunidade?mural=alunos');
  await expect(page.getByText(/^Publicação fictícia \d$/)).toHaveCount(5);
  await page.getByRole('tab', { name: 'Vídeos' }).click();
  expect((await caixa(page.getByLabel('Buscar nos vídeos'))).width).toBeLessThanOrEqual(640 + 1);
});
