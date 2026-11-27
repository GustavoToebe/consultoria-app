import { expect, test, type Locator, type Page } from '@playwright/test';

import type { ConteudoMobilidadeApi, PainelAluno, VersaoDetalhe } from '../src/api/tipos';
import { ALUNO, erroApi, simularApi, type RespostasApi } from './api-falsa';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa, SESSOES_COM_DIAS } from './aluno';

/**
 * Treino do aluno na web (`docs/planos/orientacoes-de-design-26-11.md`, 1.2): da faixa `normal` em diante, as divisões numa
 * lista só, na ordem da semana (linha de 64 a 72; hoje no poço com a barrinha da marca e o selo "Hoje"; o dia sem exercício
 * com 48 a 56, suave, sem seta nem toque) com a Mobilidade abaixo, e ao lado a coluna de apoio com as Orientações do
 * treinador abertas e o "Baixar PDF do treino" do tamanho do rótulo, tudo até 1312 no meio. O celular (e a faixa
 * `compacta`) não muda.
 * Só dados fictícios. `CAPTURAS` grava as capturas numa pasta fora do repositório.
 */

const ORIENTACOES = 'Leia antes do primeiro treino.\n\nFS: Série de força, pesada e curta.\n\nWS: Série de trabalho até perto da falha.';
/** Segunda (A, hoje em 19/10), quarta (B), quinta de descanso ativo (C, sem exercício), sexta (D). */
const SESSOES = [SESSOES_COM_DIAS[0]!, SESSOES_COM_DIAS[1]!, sessaoFalsa('sd', 'Descanso ativo', 4, 0, 'DESCANSO_ATIVO'), SESSOES_COM_DIAS[2]!];
const MOBILIDADE: VersaoDetalhe<ConteudoMobilidadeApi> = {
  id: 'm0000000-0000-4000-8000-000000000001', planoId: 'm0000000-0000-4000-8000-000000000002', numero: 1, titulo: 'Mobilidade de outubro',
  inicio: '2026-10-05', fim: '2026-11-01', publicadoEm: '2026-10-05T12:00:00Z',
  conteudo: { orientacoes: null, secoes: [{ uid: 'q', titulo: 'Quadril', itens: [{ uid: 'i1', nome: 'Gato e vaca', prescricao: '10 repetições', videoUrl: null }] }] },
};

type Opcoes = { altura?: number; menuMinimizado?: boolean; extra?: RespostasApi };

async function abrir(page: Page, largura: number, tema: 'ESCURO' | 'CLARO' = 'ESCURO', opcoes: Opcoes = {}) {
  await page.setViewportSize({ width: largura, height: opcoes.altura ?? 1080 });
  await page.addInitScript(([id, t, minimizado]) => {
    try {
      if (minimizado) localStorage.setItem('menu-lateral-recolhido', '1'); else localStorage.removeItem('menu-lateral-recolhido');
      localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t }));
    } catch { /* sem armazenamento */ }
  }, [ALUNO.id, tema, !!opcoes.menuMinimizado] as const);
  await fixarHoje(page);
  const base = await sessaoDeAlunoComTreino(page, SESSOES);
  const painel = (base['GET /aluno/painel'] as { corpo: PainelAluno }).corpo;
  const api = await simularApi(page, {
    ...base,
    'GET /aluno/painel': { corpo: { ...painel, treino: { ...painel.treino!, conteudo: { ...painel.treino!.conteudo, objetivo: 'Ganhar força (fictício)', orientacoes: ORIENTACOES } } } },
    'GET /aluno/mobilidade': { corpo: { mobilidade: MOBILIDADE } },
    'GET /aluno/mobilidade/registros': { corpo: [] },
    ...opcoes.extra,
  });
  await page.goto('/aluno/treino');
  await expect(page.getByRole('heading', { level: 1, name: 'Treino' })).toBeVisible();
  return api;
}

const caixa = async (l: Locator) => {
  await expect(l).toBeVisible();
  let b: Awaited<ReturnType<Locator['boundingBox']>> = null;
  await expect.poll(async () => (b = await l.boundingBox()) !== null).toBe(true);
  return b!;
};
const links = (page: Page) => page.getByRole('link', { name: /^Divisão [A-D],/ });
const apoio = (page: Page) => page.getByRole('complementary', { name: 'Orientações e PDF do treino' });
const semRolagemDeLado = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** A matriz da 0.5: 390, 1024 (menu aberto e minimizado), 1280, 1536, 1920, 2560 e 3440; claro também em 1280 e 1920. */
const MATRIZ: { largura: number; tema: 'ESCURO' | 'CLARO'; menuMinimizado?: boolean }[] = [
  { largura: 390, tema: 'ESCURO' }, { largura: 1024, tema: 'ESCURO' }, { largura: 1024, tema: 'ESCURO', menuMinimizado: true },
  { largura: 1280, tema: 'ESCURO' }, { largura: 1280, tema: 'CLARO' }, { largura: 1536, tema: 'ESCURO' }, { largura: 1920, tema: 'ESCURO' },
  { largura: 1920, tema: 'CLARO' }, { largura: 2560, tema: 'ESCURO' }, { largura: 3440, tema: 'ESCURO' },
];

test('capturas: treino na matriz de larguras e temas', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const pasta = process.env.CAPTURAS ?? testInfo.outputPath();
  for (const { largura, tema, menuMinimizado } of MATRIZ) {
    await abrir(page, largura, tema, { menuMinimizado });
    await expect(links(page)).toHaveCount(3);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${pasta}/treino-${largura}${menuMinimizado ? '-minimizado' : ''}-${tema.toLowerCase()}.png`, fullPage: true });
  }
});

for (const largura of [1280, 1536, 1920, 2560, 3440]) {
  test(`${largura}: divisões numa lista só na ordem da semana, hoje em destaque, descanso sem seta e o apoio ao lado`, async ({ page }) => {
    const { errosDaPagina, naoTratadas } = await abrir(page, largura);
    // Uma coluna, na ordem da semana: A (hoje), B, C (descanso, sem link), D.
    await expect(links(page)).toHaveCount(3);
    const hoje = page.getByRole('link', { name: /^Divisão A, Peito e tríceps, Segunda · 5 exercícios, hoje$/ });
    await expect(hoje.getByText('Hoje', { exact: true })).toBeVisible();
    const descanso = page.getByLabel(/^Divisão C, Descanso ativo, Quinta · Descanso ativo$/);
    await expect(descanso).toBeVisible();
    await expect(page.getByRole('link', { name: /^Divisão C,/ })).toHaveCount(0);
    const linhas = await Promise.all([links(page).nth(0), links(page).nth(1), descanso, links(page).nth(2)].map(caixa));
    expect(new Set(linhas.map((l) => Math.round(l.x))).size).toBe(1);
    for (let i = 1; i < linhas.length; i++) expect(linhas[i]!.y).toBeGreaterThan(linhas[i - 1]!.y);
    // Medidas da 1.2: treino de 64 a 72, descanso de 48 a 56.
    for (const l of [linhas[0]!, linhas[1]!, linhas[3]!]) {
      expect(l.height).toBeGreaterThanOrEqual(64);
      expect(l.height).toBeLessThanOrEqual(72 + 1);
    }
    expect(linhas[2]!.height).toBeGreaterThanOrEqual(48);
    expect(linhas[2]!.height).toBeLessThanOrEqual(56 + 1);
    // O apoio à direita: Orientações abertas e o PDF (do tamanho do rótulo), sem passar da altura da janela.
    const lateral = await caixa(apoio(page));
    expect(lateral.x).toBeGreaterThan(linhas[0]!.x + linhas[0]!.width);
    await expect(apoio(page).getByRole('button', { name: 'Orientações do treinador, expandido' })).toBeVisible();
    await expect(apoio(page).getByText('Leia antes do primeiro treino.', { exact: true })).toBeVisible();
    await expect(apoio(page).getByText('Série de força, pesada e curta.', { exact: true })).toBeVisible();
    await expect(apoio(page).getByText('Objetivo: Ganhar força (fictício)', { exact: true })).toBeVisible();
    const pdf = await caixa(apoio(page).getByRole('button', { name: 'Baixar PDF do treino' }));
    expect(pdf.width).toBeLessThan(lateral.width - 40);
    expect(pdf.height).toBeGreaterThanOrEqual(44);
    expect(lateral.height).toBeLessThanOrEqual(1080);
    // A Mobilidade na coluna principal, abaixo da última divisão e na mesma borda.
    await expect(apoio(page).getByRole('heading', { name: 'Mobilidade', exact: true })).toHaveCount(0);
    const mobilidade = await caixa(page.getByRole('heading', { name: 'Mobilidade', exact: true }));
    expect(mobilidade.y).toBeGreaterThan(linhas[3]!.y + linhas[3]!.height);
    expect(Math.abs(mobilidade.x - linhas[0]!.x)).toBeLessThan(2);
    // A composição fica no meio, sem esticar: lista + apoio até 1312 e a lista até 880 (0.3).
    expect(lateral.x + lateral.width - linhas[0]!.x).toBeLessThanOrEqual(1312 + 1);
    expect(linhas[0]!.width).toBeLessThanOrEqual(880 + 1);
    expect(await semRolagemDeLado(page)).toBe(true);
    expect(errosDaPagina).toEqual([]);
    expect(naoTratadas).toEqual([]);
  });
}

for (const { largura, menuMinimizado } of [{ largura: 390 }, { largura: 1024 }, { largura: 1024, menuMinimizado: true }]) {
  test(`${largura}${menuMinimizado ? ' (menu minimizado)' : ''}: celular e faixa compacta como antes (sem apoio, orientações recolhidas)`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura, 'ESCURO', { menuMinimizado });
    await expect(links(page)).toHaveCount(3);
    await expect(apoio(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Orientações do treinador, recolhido' })).toBeVisible();
    expect(await semRolagemDeLado(page)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });
}

test('1920: sem treino publicado, o vazio e nenhuma coluna de apoio vazia', async ({ page }) => {
  const base = await sessaoDeAlunoComTreino(page, null);
  const { errosDaPagina } = await abrir(page, 1920, 'ESCURO', { extra: { 'GET /aluno/painel': base['GET /aluno/painel']!, 'GET /aluno/mobilidade': erroApi(404, 'Sem mobilidade publicada.') } });
  await expect(page.getByText('Seu treinador ainda não publicou um treino.')).toBeVisible();
  await expect(page.getByRole('complementary')).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('1920: falha ao baixar o treino mostra o erro com "Tentar de novo", sem colunas', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1920, 'ESCURO', { extra: { 'GET /aluno/painel': erroApi(500, 'Erro fictício do servidor.') } });
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  await expect(page.getByRole('complementary')).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});
