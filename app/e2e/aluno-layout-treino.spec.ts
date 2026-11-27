import { expect, test, type Locator, type Page } from '@playwright/test';

import type { ConteudoMobilidadeApi, PainelAluno, Sessao, VersaoDetalhe } from '../src/api/tipos';
import { ALUNO, erroApi, simularApi, type RespostasApi } from './api-falsa';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';

/**
 * Treino do aluno no computador (pedido de 27/11, padrão do treinador): lista das divisões à esquerda (hoje em destaque,
 * descanso discreto, sem toque) e o treino da divisão escolhida à direita, preenchendo; a escolha fica no endereço
 * (`?divisao=`). Orientações e PDF embaixo da lista (380/420) na `normal` e na `larga`, numa 3ª coluna (440) na `ultralarga`;
 * a mobilidade depois das duas colunas na `normal` e embaixo do treino da `larga` em diante. O celular (e a faixa `compacta`) não muda.
 * Só dados fictícios. `E2E_CAPTURAS` (ou `CAPTURAS`) grava as capturas numa pasta fora do repositório.
 */

const ORIENTACOES = 'Leia antes do primeiro treino.\n\nFS: Série de força, pesada e curta.\n\nWS: Série de trabalho até perto da falha.';
/** Segunda (A, hoje em 19/10), terça (B), quarta (C), quinta de descanso ativo (D, sem exercício), sexta (E). */
const SESSOES: Sessao[] = [
  sessaoFalsa('sa', 'Peito e tríceps', 1, 6),
  sessaoFalsa('sb', 'Costas e bíceps', 2, 5),
  sessaoFalsa('sc', 'Pernas', 3, 6),
  sessaoFalsa('sd', 'Descanso ativo', 4, 0, 'DESCANSO_ATIVO'),
  sessaoFalsa('se', 'Ombros e abdômen', 5, 5),
];
const item = (uid: string, nome: string) => ({ uid, nome, prescricao: '10 repetições', videoUrl: null });
const MOBILIDADE: VersaoDetalhe<ConteudoMobilidadeApi> = {
  id: 'm0000000-0000-4000-8000-000000000001', planoId: 'm0000000-0000-4000-8000-000000000002', numero: 1, titulo: 'Mobilidade de outubro',
  inicio: '2026-10-05', fim: '2026-11-01', publicadoEm: '2026-10-05T12:00:00Z',
  conteudo: {
    orientacoes: null,
    secoes: [
      { uid: 'q', titulo: 'Quadril', itens: [item('i1', 'Gato e vaca'), item('i2', 'Rotação de quadril')] },
      { uid: 'o', titulo: 'Ombros', itens: [item('i3', 'Deslize na parede'), item('i4', 'Rotação externa')] },
    ],
  },
};

type Opcoes = { altura?: number; menuMinimizado?: boolean; extra?: RespostasApi; caminho?: string };

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
  await page.goto(opcoes.caminho ?? '/aluno/treino');
  await expect(page.getByRole('heading', { level: 1, name: 'Treino' })).toBeVisible();
  return api;
}

const caixa = async (l: Locator) => {
  await expect(l).toBeVisible();
  let b: Awaited<ReturnType<Locator['boundingBox']>> = null;
  await expect.poll(async () => (b = await l.boundingBox()) !== null).toBe(true);
  return b!;
};
/** No computador as divisões com treino são botões que escolhem (no celular, links que abrem o dia). */
const divisoes = (page: Page) => page.getByRole('button', { name: /^Divisão [A-E],/ });
const divisao = (page: Page, letra: string) => page.getByRole('button', { name: new RegExp(`^Divisão ${letra},`) });
const treinoDaDivisao = (page: Page) => page.getByRole('region', { name: 'Treino da divisão' });
const apoio = (page: Page) => page.getByRole('complementary', { name: 'Orientações e PDF do treino' });
const semRolagemDeLado = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const pasta = () => process.env.E2E_CAPTURAS ?? process.env.CAPTURAS;
/** A página rola dentro da `Tela` (não no documento): a janela cresce até a altura do conteúdo para a captura sair inteira. */
async function capturarInteira(page: Page, largura: number, altura: number, caminho: string) {
  const conteudo = await page.evaluate(() => Math.max(...Array.from(document.querySelectorAll('*'), (e) => e.scrollHeight)));
  await page.setViewportSize({ width: largura, height: Math.min(Math.max(conteudo, altura), 4000) });
  await page.waitForTimeout(300);
  await page.screenshot({ path: caminho });
  await page.setViewportSize({ width: largura, height: altura });
}

/** 390 (celular como antes), 1280, 1920 e 3440 × 1440, cada uma no escuro e no claro. */
const MATRIZ: { largura: number; altura?: number; tema: 'ESCURO' | 'CLARO' }[] = [
  { largura: 390, altura: 844, tema: 'ESCURO' },
  { largura: 1280, tema: 'ESCURO' }, { largura: 1280, tema: 'CLARO' },
  { largura: 1920, tema: 'ESCURO' }, { largura: 1920, tema: 'CLARO' },
  { largura: 3440, altura: 1440, tema: 'ESCURO' }, { largura: 3440, altura: 1440, tema: 'CLARO' },
];

test('capturas: treino na matriz de larguras e temas', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const destino = pasta() ?? testInfo.outputPath();
  for (const { largura, altura, tema } of MATRIZ) {
    await abrir(page, largura, tema, { altura });
    await expect(page.getByText('Peito e tríceps', { exact: true }).first()).toBeVisible();
    await page.waitForTimeout(600);
    // A janela (o que se vê sem rolar) e a página inteira.
    await page.screenshot({ path: `${destino}/treino-${largura}-${tema.toLowerCase()}-janela.png` });
    await capturarInteira(page, largura, altura ?? 1080, `${destino}/treino-${largura}-${tema.toLowerCase()}.png`);
  }
});

for (const largura of [1280, 1920]) {
  test(`${largura}: lista à esquerda com hoje escolhido, o treino ao lado preenchendo e o apoio embaixo da lista`, async ({ page }) => {
    const { errosDaPagina, naoTratadas } = await abrir(page, largura);
    await expect(divisoes(page)).toHaveCount(4);
    // Hoje (A) vem escolhido, com o selo; o descanso só informa (nem botão nem link).
    const hoje = page.getByRole('button', { name: /^Divisão A, Peito e tríceps, Segunda · 6 exercícios, hoje$/ });
    await expect(hoje).toHaveAttribute('aria-current', 'true');
    await expect(hoje.getByText('Hoje', { exact: true })).toBeVisible();
    await expect(divisao(page, 'B')).not.toHaveAttribute('aria-current', 'true');
    await expect(page.getByLabel(/^Divisão D, Descanso ativo, Quinta · Descanso ativo$/)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Divisão D,/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^Divisão [A-E],/ })).toHaveCount(0);
    // O treino de A à direita, com o Começar treino e os 6 exercícios.
    const lista = await caixa(hoje);
    const detalhe = await caixa(treinoDaDivisao(page));
    await expect(treinoDaDivisao(page).getByRole('heading', { name: 'Divisão A · Peito e tríceps' })).toBeVisible();
    await expect(treinoDaDivisao(page).getByRole('button', { name: 'Começar treino' })).toBeVisible();
    await expect(treinoDaDivisao(page).getByRole('link', { name: /^Abrir Exercício sae\d/ })).toHaveCount(6);
    expect(detalhe.x).toBeGreaterThan(lista.x + lista.width);
    // A coluna da lista tem a largura do apoio da faixa (380 na normal, 420 na larga) e o treino vai até a borda do conteúdo.
    expect(Math.round(lista.width)).toBe(largura === 1280 ? 380 : 420);
    // Orientações, PDF e mobilidade embaixo da lista, na mesma borda.
    const lateral = await caixa(apoio(page));
    expect(Math.abs(lateral.x - lista.x)).toBeLessThan(2);
    expect(lateral.y).toBeGreaterThan(lista.y + lista.height);
    await expect(apoio(page).getByRole('button', { name: 'Orientações do treinador, expandido' })).toBeVisible();
    await expect(apoio(page).getByText('Objetivo: Ganhar força (fictício)', { exact: true })).toBeVisible();
    // Mobilidade: depois das duas colunas na normal (1280, na borda da lista), embaixo do treino na larga (1920).
    await expect(apoio(page).getByRole('heading', { name: 'Mobilidade', exact: true })).toHaveCount(0);
    const mobilidade = await caixa(page.getByRole('heading', { name: 'Mobilidade', exact: true }));
    expect(mobilidade.y).toBeGreaterThan(detalhe.y + detalhe.height);
    if (largura === 1280) {
      expect(Math.abs(mobilidade.x - lista.x)).toBeLessThan(2);
      expect(mobilidade.y).toBeGreaterThan(lateral.y + lateral.height);
    } else expect(Math.abs(mobilidade.x - detalhe.x)).toBeLessThan(2);
    const pdf = await caixa(apoio(page).getByRole('button', { name: 'Baixar PDF do treino' }));
    expect(pdf.width).toBeLessThan(lateral.width - 40);
    expect(pdf.height).toBeGreaterThanOrEqual(44);
    // Medidas da linha: treino de 64 a 72, descanso de 48 a 56.
    expect(lista.height).toBeGreaterThanOrEqual(64);
    expect(lista.height).toBeLessThanOrEqual(72 + 1);
    const descanso = await caixa(page.getByLabel(/^Divisão D,/));
    expect(descanso.height).toBeGreaterThanOrEqual(48);
    expect(descanso.height).toBeLessThanOrEqual(56 + 1);
    expect(await semRolagemDeLado(page)).toBe(true);
    expect(errosDaPagina).toEqual([]);
    expect(naoTratadas).toEqual([]);
  });
}

test('1920: escolher outra divisão troca o treino e o endereço; voltar do exercício mantém a escolha', async ({ page }) => {
  const { errosDaPagina, naoTratadas } = await abrir(page, 1920);
  await divisao(page, 'C').click();
  await expect(page).toHaveURL(/divisao=sc/);
  await expect(divisao(page, 'C')).toHaveAttribute('aria-current', 'true');
  await expect(divisao(page, 'A')).not.toHaveAttribute('aria-current', 'true');
  await expect(treinoDaDivisao(page).getByRole('heading', { name: 'Divisão C · Pernas' })).toBeVisible();
  // Quarta seguinte a hoje (segunda, 19/10): o dia que se registraria.
  await expect(treinoDaDivisao(page).getByText('Próximo: 21/10/2026', { exact: true })).toBeVisible();
  await treinoDaDivisao(page).getByRole('link', { name: /^Abrir Exercício sce2,/ }).click();
  await expect(page).toHaveURL(/\/aluno\/sessao\/sc\/sce2\?data=2026-10-21/);
  await page.goBack();
  await expect(treinoDaDivisao(page).getByRole('heading', { name: 'Divisão C · Pernas' })).toBeVisible();
  await expect(divisao(page, 'C')).toHaveAttribute('aria-current', 'true');
  // Teclado: Tab chega à divisão e Enter escolhe.
  await divisao(page, 'E').focus();
  await page.keyboard.press('Enter');
  await expect(treinoDaDivisao(page).getByRole('heading', { name: 'Divisão E · Ombros e abdômen' })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
  expect(naoTratadas).toEqual([]);
});

test('1920: endereço com divisão desconhecida ou de descanso cai na de hoje', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1920, 'ESCURO', { caminho: '/aluno/treino?divisao=sd' });
  await expect(treinoDaDivisao(page).getByRole('heading', { name: 'Divisão A · Peito e tríceps' })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('3440 × 1440: três colunas (lista, treino preenchendo e apoio de 440) e sem rolagem de lado', async ({ page }) => {
  const { errosDaPagina, naoTratadas } = await abrir(page, 3440, 'ESCURO', { altura: 1440 });
  const lista = await caixa(divisao(page, 'A'));
  const detalhe = await caixa(treinoDaDivisao(page));
  const lateral = await caixa(apoio(page));
  expect(Math.round(lista.width)).toBe(440);
  expect(Math.round(lateral.width)).toBe(440);
  expect(detalhe.x).toBeGreaterThan(lista.x + lista.width);
  expect(lateral.x).toBeGreaterThan(detalhe.x + detalhe.width);
  // O treino em duas colunas de cartões (largo demais para uma): o 2º exercício ao lado do 1º.
  const primeiro = await caixa(treinoDaDivisao(page).getByRole('link', { name: /^Abrir Exercício sae1,/ }));
  const segundo = await caixa(treinoDaDivisao(page).getByRole('link', { name: /^Abrir Exercício sae2,/ }));
  expect(Math.abs(segundo.y - primeiro.y)).toBeLessThan(2);
  // A mobilidade embaixo do treino; o apoio só com orientações e PDF.
  const mobilidade = await caixa(page.getByRole('heading', { name: 'Mobilidade', exact: true }));
  expect(Math.abs(mobilidade.x - detalhe.x)).toBeLessThan(2);
  await expect(page.getByRole('complementary', { name: 'Orientações e PDF do treino' })).toBeVisible();
  expect(await semRolagemDeLado(page)).toBe(true);
  expect(errosDaPagina).toEqual([]);
  expect(naoTratadas).toEqual([]);
});

for (const largura of [390, 1024]) {
  test(`${largura}: celular e faixa compacta como antes (links, sem apoio, orientações recolhidas)`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura, 'ESCURO', { altura: 844 });
    await expect(page.getByRole('link', { name: /^Divisão [A-E],/ })).toHaveCount(4);
    await expect(treinoDaDivisao(page)).toHaveCount(0);
    await expect(apoio(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Orientações do treinador, recolhido' })).toBeVisible();
    expect(await semRolagemDeLado(page)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });
}

test('1920: sem treino publicado, o vazio e nenhuma coluna', async ({ page }, testInfo) => {
  const base = await sessaoDeAlunoComTreino(page, null);
  const { errosDaPagina } = await abrir(page, 1920, 'ESCURO', { extra: { 'GET /aluno/painel': base['GET /aluno/painel']!, 'GET /aluno/mobilidade': erroApi(404, 'Sem mobilidade publicada.') } });
  await expect(page.getByText('Seu treinador ainda não publicou um treino.')).toBeVisible();
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await expect(treinoDaDivisao(page)).toHaveCount(0);
  await page.screenshot({ path: `${pasta() ?? testInfo.outputPath()}/treino-1920-escuro-vazio.png`, fullPage: true });
  expect(errosDaPagina).toEqual([]);
});

test('1920: falha ao baixar o treino mostra o erro com "Tentar de novo", sem colunas', async ({ page }, testInfo) => {
  const { errosDaPagina } = await abrir(page, 1920, 'CLARO', { extra: { 'GET /aluno/painel': erroApi(500, 'Erro fictício do servidor.') } });
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await page.screenshot({ path: `${pasta() ?? testInfo.outputPath()}/treino-1920-claro-erro.png`, fullPage: true });
  expect(errosDaPagina).toEqual([]);
});
