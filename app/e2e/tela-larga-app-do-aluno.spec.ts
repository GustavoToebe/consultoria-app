import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AulaDaComunidade, PaginaDoMural, PostDoMural } from '../src/api/comunidadeTipos';
import type { ItemDaVitrineDoAluno } from '../src/api/vitrineTipos';
import type { ConteudoDieta, DiaDeTreino, ItemDieta, PastaDoAluno, RegistroPeso, VersaoDetalhe } from '../src/api/tipos';
import { ALUNO, erroApi, json, sessao, simularApi, type RespostasApi } from './api-falsa';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa, SESSOES_COM_DIAS } from './aluno';

/**
 * Tela larga: revisão (24/11), app do aluno na web. Até a faixa `normal` (1280 com o menu aberto) nada muda: duas colunas e
 * teto de 1120. Da faixa `larga` em diante (1920, 2560 e 3440 com o menu aberto) o teto sobe para 1688 e o espaço vira colunas:
 * Início em três, divisões, exercícios, refeições e mural em grade sem cartão sozinho na última linha, a sessão e a dieta com a
 * coluna de resumo à esquerda e o Histórico em duas. Botão e campo não esticam. Só dados fictícios.
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

/** Divisões A a E (5 cartões: na grade larga, 3 + 2). */
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
/** Colunas distintas (pelo x arredondado) de um conjunto de cartões e quantos há em cada linha. */
async function arranjo(cartoes: Locator) {
  const caixas = await Promise.all((await cartoes.all()).map((c) => c.boundingBox()));
  const xs = new Set(caixas.map((c) => Math.round(c!.x)));
  const porLinha = new Map<number, number>();
  for (const c of caixas) porLinha.set(Math.round(c!.y), (porLinha.get(Math.round(c!.y)) ?? 0) + 1);
  return { colunas: xs.size, linhas: [...porLinha.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n) };
}
const semRolagemDeLado = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const divisoes = (page: Page) => page.getByRole('link', { name: /^Divisão [A-E],/ });

test('1280 (faixa normal): nada muda, divisões em duas colunas e o PDF cheio como antes', async ({ page }) => {
  await abrir(page, 1280, '/aluno/treino');
  await expect(divisoes(page)).toHaveCount(5);
  await expect.poll(async () => (await arranjo(divisoes(page))).colunas).toBe(2);
  const pdf = await caixa(page.getByRole('button', { name: 'Baixar PDF do treino' }));
  expect(pdf.width).toBeGreaterThan(900);
});

for (const largura of [1920, 3440]) {
  test(`${largura}: divisões em três colunas (3 + 2), PDF do tamanho do texto, conteúdo até 1688 e sem rolagem de lado`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura, '/aluno/treino');
    await expect(divisoes(page)).toHaveCount(5);
    // A entrada em cascata mexe no y por um instante: espera o arranjo assentar.
    await expect.poll(() => arranjo(divisoes(page))).toEqual({ colunas: 3, linhas: [3, 2] });
    const pdf = await caixa(page.getByRole('button', { name: 'Baixar PDF do treino' }));
    expect(pdf.width).toBeLessThan(400);
    const titulo = await caixa(page.getByRole('heading', { name: 'Divisões da semana' }));
    const ultima = await caixa(divisoes(page).nth(2));
    expect(ultima.x + ultima.width - titulo.x).toBeLessThanOrEqual(1688 + 1);
    expect(await semRolagemDeLado(page)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });
}

test('1920: a sessão do dia tem o começar numa coluna à esquerda e os exercícios em colunas ao lado (3 + 2)', async ({ page }) => {
  await abrir(page, 1920, '/aluno/sessao/sa?data=2026-10-19');
  const exercicios = page.getByRole('link', { name: /^Abrir Exercício sae/ });
  await expect(exercicios).toHaveCount(5);
  // Primeiro o arranjo assentar (medida da área e a entrada em cascata); depois as caixas.
  await expect.poll(() => arranjo(exercicios)).toEqual({ colunas: 3, linhas: [3, 2] });
  const comecar = await caixa(page.getByRole('button', { name: 'Começar treino', exact: true }));
  expect(comecar.width).toBeLessThanOrEqual(400 + 1);
  expect((await caixa(exercicios.first())).x).toBeGreaterThan(comecar.x + comecar.width);
  // O "Concluir treino" do rodapé não estica com a coluna dos exercícios.
  expect((await caixa(page.getByRole('button', { name: 'Concluir treino' }).last())).width).toBeLessThan(400);
});

test('1280: a sessão do dia continua numa coluna só, com o começar antes de "Outras datas"', async ({ page }) => {
  await abrir(page, 1280, '/aluno/sessao/sa?data=2026-10-19');
  const comecar = await caixa(page.getByRole('button', { name: 'Começar treino', exact: true }));
  const outras = await caixa(page.getByRole('heading', { name: 'Outras datas' }));
  expect(comecar.y).toBeLessThan(outras.y);
  expect(comecar.width).toBeGreaterThan(900);
});

test('1920: a dieta tem o resumo (água, total, lista de compras) à esquerda e as refeições em colunas (3 + 2)', async ({ page }) => {
  await abrir(page, 1920, '/aluno/dieta');
  const refeicoes = page.getByText(/^Refeição \d$/);
  await expect(refeicoes).toHaveCount(5);
  await expect.poll(async () => (await arranjo(refeicoes)).linhas).toEqual([3, 2]);
  const total = await caixa(page.getByRole('heading', { name: 'Total do dia' }));
  const agua = await caixa(page.getByRole('heading', { name: 'Água de hoje' }));
  expect(Math.abs(agua.x - total.x)).toBeLessThan(2);
  expect(agua.y).toBeLessThan(total.y);
  expect((await caixa(refeicoes.first())).x).toBeGreaterThan(total.x + 300);
  expect((await caixa(page.getByRole('button', { name: 'Lista de compras' }))).width).toBeLessThanOrEqual(400 + 1);
});

test('1920 com seis refeições: 3 + 3', async ({ page }) => {
  const seis = { ...DIETA, conteudo: { ...DIETA.conteudo, refeicoes: [...DIETA.conteudo.refeicoes, { ...DIETA.conteudo.refeicoes[0], uid: 'r5', nome: 'Refeição 6' }] } };
  await abrir(page, 1920, '/aluno/dieta', { 'GET /aluno/dieta': { corpo: { dieta: seis } } });
  const refeicoes = page.getByText(/^Refeição \d$/);
  await expect(refeicoes).toHaveCount(6);
  await expect.poll(async () => (await arranjo(refeicoes)).linhas).toEqual([3, 3]);
});

test('3440: o mapa de treinos ocupa o cartão (célula de 22, não para em ~950 px)', async ({ page }) => {
  await abrir(page, 3440, '/aluno');
  const grade = page.getByLabel(/^Mapa de treinos:/);
  await expect.poll(async () => (await caixa(grade)).width).toBeGreaterThan(1100);
});

test('2560: o Histórico em duas colunas, registros à esquerda e peso ao lado', async ({ page }) => {
  await abrir(page, 2560, '/aluno/historico');
  const lado = async () => {
    const registros = await caixa(page.getByRole('heading', { name: 'Registros e cargas' }));
    const peso = await caixa(page.getByRole('heading', { name: 'Peso', exact: true }));
    return peso.x - registros.x > 600 && peso.y < registros.y + 400;
  };
  await expect.poll(lado).toBe(true);
});

test('1920 com o retorno ligado: o Início em três colunas (Hoje, pendências e semana, nível); em 1280, duas', async ({ page }) => {
  await abrir(page, 1920, '/aluno');
  const emTres = async () => {
    const hoje = await caixa(page.getByRole('heading', { name: 'Hoje', level: 2, exact: true }));
    const semana = await caixa(page.getByRole('heading', { name: 'Sua semana' }));
    const nivel = await caixa(page.getByRole('heading', { name: 'Seu nível' }));
    return hoje.x < semana.x && semana.x < nivel.x;
  };
  await expect.poll(emTres).toBe(true);
  await page.setViewportSize({ width: 1280, height: 1080 });
  await expect.poll(async () => Math.round((await page.getByRole('heading', { name: 'Seu nível' }).boundingBox())!.x)).toBe(Math.round((await page.getByRole('heading', { name: 'Sua semana' }).boundingBox())!.x));
});

const VITRINE: ItemDaVitrineDoAluno[] = [{
  id: 'v0000000-0000-4000-8000-000000000001', nome: 'Item fictício', descricao: 'Descrição fictícia.', tipo: 'FISICO',
  precoCentavos: null, precoVigenteCentavos: null, especialAte: null, cupom: null, linkUrl: null, temFoto: false, fotoAtualizadaEm: null,
}];

test('1920 sem nível e sem vitrine: o Início não reserva a terceira coluna, fica em duas e no teto de 1120', async ({ page }) => {
  await abrir(page, 1920, '/aluno', await sessao(page, ALUNO, { retornoHabilitado: false }));
  const emDuas = async () => {
    const hoje = await caixa(page.getByRole('heading', { name: 'Hoje', level: 2, exact: true }));
    const semana = await caixa(page.getByRole('heading', { name: 'Sua semana' }));
    return hoje.x < semana.x && semana.x - hoje.x < 1120 / 2 + 40;
  };
  await expect.poll(emDuas).toBe(true);
  await expect(page.getByRole('heading', { name: 'Seu nível' })).toHaveCount(0);
});

test('1920 sem o retorno e com itens na vitrine: a terceira coluna existe e leva a vitrine', async ({ page }) => {
  await abrir(page, 1920, '/aluno', { ...(await sessao(page, ALUNO, { retornoHabilitado: false, vitrineHabilitada: true })), 'GET /aluno/vitrine': { corpo: VITRINE } });
  const emTres = async () => {
    const semana = await caixa(page.getByRole('heading', { name: 'Sua semana' }));
    const vitrine = await caixa(page.getByRole('heading', { name: 'Vitrine' }));
    return semana.x < vitrine.x;
  };
  await expect.poll(emTres).toBe(true);
});

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

test('390: divisões, refeições e mural numa coluna só; o Hoje antes da semana', async ({ page }) => {
  await abrir(page, 390, '/aluno/treino');
  await expect(divisoes(page)).toHaveCount(5);
  await expect.poll(async () => (await arranjo(divisoes(page))).colunas).toBe(1);
  await page.goto('/aluno/dieta');
  const refeicoes = page.getByText(/^Refeição \d$/);
  await expect(refeicoes).toHaveCount(5);
  await expect.poll(async () => (await arranjo(refeicoes)).colunas).toBe(1);
  await page.goto('/aluno/comunidade?mural=alunos');
  const posts = page.getByText(/^Publicação fictícia \d$/);
  await expect(posts).toHaveCount(5);
  await expect.poll(async () => (await arranjo(posts)).colunas).toBe(1);
  await page.goto('/aluno');
  const hoje = await caixa(page.getByRole('heading', { name: 'Hoje', level: 2, exact: true }));
  expect(hoje.y).toBeLessThan((await caixa(page.getByRole('heading', { name: 'Sua semana' }))).y);
});

test('1280: a dieta sem coluna lateral (água, total e refeições na mesma borda, refeições 2 + 2 + 1 como antes) e o mural numa coluna', async ({ page }) => {
  await abrir(page, 1280, '/aluno/dieta');
  const refeicoes = page.getByText(/^Refeição \d$/);
  await expect(refeicoes).toHaveCount(5);
  await expect.poll(async () => (await arranjo(refeicoes)).linhas).toEqual([2, 2, 1]);
  const agua = await caixa(page.getByRole('heading', { name: 'Água de hoje' }));
  const total = await caixa(page.getByRole('heading', { name: 'Total do dia' }));
  expect(Math.abs(agua.x - total.x)).toBeLessThan(2);
  expect(Math.abs((await caixa(refeicoes.first())).x - total.x)).toBeLessThan(4);
  await page.goto('/aluno/comunidade?mural=alunos');
  const posts = page.getByText(/^Publicação fictícia \d$/);
  await expect(posts).toHaveCount(5);
  await expect.poll(async () => (await arranjo(posts)).colunas).toBe(1);
});

test('1920: o mural vira quadro em colunas sem cartão sozinho e a busca dos vídeos fica na largura de formulário', async ({ page }) => {
  await abrir(page, 1920, '/aluno/comunidade?mural=alunos');
  const posts = page.getByText(/^Publicação fictícia \d$/);
  await expect(posts).toHaveCount(5);
  await expect.poll(async () => (await arranjo(posts)).linhas).toEqual([3, 2]);
  await page.getByRole('tab', { name: 'Vídeos' }).click();
  expect((await caixa(page.getByLabel('Buscar nos vídeos'))).width).toBeLessThanOrEqual(640 + 1);
});
