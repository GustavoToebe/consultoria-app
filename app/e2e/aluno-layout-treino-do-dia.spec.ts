import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';

import type { AnterioresDoPacote, PainelAluno, ProgressoPonto, RecordesDoPacote, Sessao } from '../src/api/tipos';
import { ALUNO, sessao, simularApi } from './api-falsa';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';
import { conferirAlturasDeColunas } from './alturasDeColunas';

/**
 * Treino do dia na web (`docs/planos/orientacoes-de-design-26-11.md`, 1.3, e o item 7 do pedido de 27/11): da faixa `normal`
 * em diante, o apoio à esquerda, fixo ao rolar (o resumo com a frase da data numa só e a nota do salvamento no aparelho, o
 * "Começar/Continuar" e as Outras datas), e os exercícios na ordem, com "Última carga" e "N/3 séries" na mesma linha. Na
 * `larga` e na `ultralarga` vale a régua do Exercício (`aluno/exercicio/colunasDoExercicio`): a lista para em 880 e o resto
 * vira a 3ª coluna, também fixa, com o exercício a fazer e o histórico dele (em duas a partir de 752: a carga por data na
 * segunda). Exercício a fazer sem histórico (livre ou cardio): a 3ª coluna tem a largura do apoio e a lista, o resto, em colunas
 * lidas de cima para baixo (`dominio/colunasDoTreinoDoDia`). O celular (e a faixa `compacta`) não muda. Só dados fictícios.
 * Capturas só com `E2E_CAPTURAS` apontando uma pasta fora do git.
 */

const NOTA = 'Cada série marcada fica salva no aparelho na hora e é enviada quando houver internet.';
/** Os exercícios do treino de hoje vêm da biblioteca (têm Histórico); os outros dois, livres. */
const comBiblioteca = (s: Sessao): Sessao => ({ ...s, exercicios: s.exercicios.map((e) => ({ ...e, exercicioId: `ex-${e.uid}` })) });
const SESSOES = [
  comBiblioteca(sessaoFalsa('sa', 'Peito e tríceps', 1, 5)),
  sessaoFalsa('sb', 'Costas e bíceps', 3, 4),
  // Seis exercícios livres iguais: três colunas da mesma altura quando a lista ganha a largura.
  sessaoFalsa('sd', 'Treino livre', 1, 6),
];
const HOJE = '/aluno/sessao/sa?data=2026-10-19';
const FUTURA = '/aluno/sessao/sb?data=2026-10-21';
const LIVRE = '/aluno/sessao/sd?data=2026-10-19';

const PONTOS: ProgressoPonto[] = [
  { data: '2026-09-28', maiorCargaTrabalho: 55, repeticoes: 10 },
  { data: '2026-10-05', maiorCargaTrabalho: 57.5, repeticoes: 9 },
  { data: '2026-10-12', maiorCargaTrabalho: 60, repeticoes: 8 },
];
const RECORDES: RecordesDoPacote = {
  ate: '2026-10-19',
  exercicios: { 'ex-sae1': { maiorCarga: 62.5, maiorVolume: 600, repeticoesPorCarga: [{ carga: 60, repeticoes: 10 }, { carga: 62.5, repeticoes: 6 }] } },
};
const ANTERIORES: AnterioresDoPacote = {
  ate: '2026-10-19',
  exercicios: { 'ex-sae1': { data: '2026-10-12', series: [1, 2, 3].map((ordem) => ({ tipo: 'WORKING' as const, ordem, carga: 60, repeticoes: 8, etapas: null })) } },
};

type Opcoes = { tema?: 'ESCURO' | 'CLARO'; altura?: number; menuMinimizado?: boolean };

async function abrir(page: Page, largura: number, caminho = HOJE, opcoes: Opcoes = {}) {
  await page.setViewportSize({ width: largura, height: opcoes.altura ?? 1080 });
  await page.addInitScript(([id, t, minimizado]) => {
    try {
      if (minimizado) localStorage.setItem('menu-lateral-recolhido', '1'); else localStorage.removeItem('menu-lateral-recolhido');
      localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t }));
    } catch { /* sem armazenamento */ }
  }, [ALUNO.id, opcoes.tema ?? 'ESCURO', !!opcoes.menuMinimizado] as const);
  await fixarHoje(page);
  const base = await sessaoDeAlunoComTreino(page, SESSOES);
  const painel = (base['GET /aluno/painel'] as { corpo: PainelAluno }).corpo;
  const api = await simularApi(page, {
    ...base,
    ...(await sessao(page, ALUNO, { retornoHabilitado: true })),
    'GET /aluno/painel': { corpo: { ...painel, recordes: RECORDES, anteriores: ANTERIORES } },
    'GET /aluno/sessoes-concluidas': { corpo: { totalConcluidos: 0, sessoes: [] } },
    'GET /aluno/progresso': { corpo: PONTOS },
  });
  await page.goto(caminho);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  return api;
}

const caixa = async (l: Locator) => {
  await expect(l).toBeVisible();
  let b: Awaited<ReturnType<Locator['boundingBox']>> = null;
  await expect.poll(async () => (b = await l.boundingBox()) !== null).toBe(true);
  return b!;
};
/** Os cartões da lista (no celular a lista não tem testID, e não há 3ª coluna com o cartão repetido). */
const exercicios = (page: Page) => page.getByRole('link', { name: /^Abrir Exercício sae\d/ });
/** Na web, só os da lista: o cartão do próximo, na 3ª coluna, repete o primeiro a fazer. */
const daLista = (page: Page, nome = /^Abrir Exercício s[ad]e\d/) => page.getByTestId('lista-do-dia').getByRole('link', { name: nome });
const apoio = (page: Page) => page.getByRole('complementary', { name: 'Resumo do treino' });
const extras = (page: Page) => page.getByRole('complementary', { name: 'Próximo exercício e histórico' });
const semRolagemDeLado = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** Da larga em diante abre a 3ª coluna (com o menu aberto: 1920, 2560 e 3440). */
const TERCEIRA: Record<number, boolean> = { 1280: false, 1536: false, 1920: true, 2560: true, 3440: true };

for (const largura of [1280, 1536, 1920, 2560, 3440]) {
  test(`${largura}: resumo à esquerda, exercícios numa coluna, na ordem${TERCEIRA[largura] ? ', e o próximo com o histórico na 3ª coluna' : ''}`, async ({ page }) => {
    const { errosDaPagina, naoTratadas } = await abrir(page, largura);
    await expect(daLista(page)).toHaveCount(5);
    const lateral = await caixa(apoio(page));
    await expect(apoio(page).getByRole('button', { name: 'Começar treino', exact: true })).toBeVisible();
    // A nota do salvamento no aparelho mora no cartão do resumo, uma vez só.
    await expect(page.getByText(NOTA, { exact: true })).toHaveCount(1);
    await expect(apoio(page).getByText(NOTA, { exact: true })).toBeVisible();
    // Uma coluna só, na ordem 1 a 5, à direita do apoio (a lista nunca passa de 1064 aqui).
    await expect.poll(async () => new Set((await Promise.all((await daLista(page).all()).map(caixa))).map((c) => Math.round(c.x))).size).toBe(1);
    const cartoes = await Promise.all((await daLista(page).all()).map(caixa));
    for (let i = 1; i < cartoes.length; i++) expect(cartoes[i]!.y).toBeGreaterThan(cartoes[i - 1]!.y);
    expect(cartoes[0]!.x).toBeGreaterThan(lateral.x + lateral.width);
    const janela = await page.evaluate(() => document.documentElement.clientWidth);
    const ultimo = cartoes[cartoes.length - 1]!;
    if (TERCEIRA[largura]) {
      // A 3ª coluna à direita da lista, até a borda do conteúdo (o recuo da tela, até 48, e a barra de rolagem); a lista até 880.
      await expect.poll(async () => extras(page).count()).toBe(1);
      const terceira = await caixa(extras(page));
      expect(terceira.x).toBeGreaterThan(ultimo.x + ultimo.width);
      expect(terceira.x + terceira.width).toBeGreaterThanOrEqual(janela - 48 - 20);
      for (const c of cartoes) expect(c.width).toBeLessThanOrEqual(880);
      // Nada feito ainda: o primeiro exercício (o mesmo do "Começar treino") e o histórico dele, com o que veio no pacote.
      await expect(extras(page).getByRole('heading', { name: 'Primeiro exercício', exact: true })).toBeVisible();
      await expect(extras(page).getByRole('link', { name: /^Abrir Exercício sae1/ })).toBeVisible();
      await expect(extras(page).getByRole('heading', { name: 'Histórico de Exercício sae1', exact: true })).toBeVisible();
      await expect(extras(page).getByText(/^Última vez/).first()).toBeVisible();
      await expect(extras(page).getByRole('heading', { name: 'Carga por data', exact: true })).toHaveCount(terceira.width >= 752 ? 1 : 0);
    } else {
      // Faixa normal: sem 3ª coluna; a lista vai até a borda do conteúdo (sem faixa vazia).
      await expect(extras(page)).toHaveCount(0);
      expect(ultimo.x + ultimo.width).toBeGreaterThanOrEqual(janela - 48 - 20);
    }
    // "Última carga: —" e "0/3 séries" na mesma linha do primeiro cartão.
    const primeiro = daLista(page).first();
    const carga = await caixa(primeiro.getByText(/^Última carga:/));
    const series = await caixa(primeiro.getByText('0/3 séries', { exact: true }));
    expect(Math.abs(carga.y + carga.height / 2 - (series.y + series.height / 2))).toBeLessThan(4);
    // O rodapé não estica.
    expect((await caixa(page.getByRole('button', { name: 'Concluir treino' }).last())).width).toBeLessThan(400);
    expect(await semRolagemDeLado(page)).toBe(true);
    expect(errosDaPagina).toEqual([]);
    expect(naoTratadas).toEqual([]);
  });
}

test('3440: o próximo é livre (sem histórico): 3ª coluna de 440 só com o cartão, a lista em três colunas da mesma altura', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 3440, LIVRE, { altura: 1440 });
  await expect(daLista(page)).toHaveCount(6);
  await expect.poll(async () => Math.round((await caixa(extras(page))).width)).toBe(440);
  await expect(extras(page).getByRole('link', { name: /^Abrir Exercício sde1/ })).toBeVisible();
  await expect(extras(page).getByRole('heading', { name: /^Histórico/ })).toHaveCount(0);
  // As colunas lidas de cima para baixo terminam juntas (seis cartões iguais, dois por coluna).
  await conferirAlturasDeColunas(page, { prefixo: 'treino-do-dia-coluna', colunasEsperadas: 3, limite: 24 });
  expect(await semRolagemDeLado(page)).toBe(true);
  expect(errosDaPagina).toEqual([]);
});

test('1920 × 720: rolando até o fim, o resumo e a 3ª coluna continuam à vista (fixos ao rolar)', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1920, HOJE, { altura: 720 });
  await expect(daLista(page)).toHaveCount(5);
  await page.mouse.move(1000, 400);
  await page.mouse.wheel(0, 3000);
  await expect(page.getByRole('button', { name: 'Concluir treino' }).last()).toBeInViewport();
  await expect(apoio(page).getByRole('button', { name: 'Começar treino', exact: true })).toBeInViewport();
  await expect(extras(page).getByRole('heading', { name: 'Primeiro exercício', exact: true })).toBeInViewport();
  expect(errosDaPagina).toEqual([]);
});

test('1280 × 720: rolando até o fim, o apoio continua à vista com o "Começar treino"', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, HOJE, { altura: 720 });
  await expect(daLista(page)).toHaveCount(5);
  await page.mouse.move(900, 400);
  await page.mouse.wheel(0, 3000);
  await expect(page.getByRole('button', { name: 'Concluir treino' }).last()).toBeInViewport();
  await expect(apoio(page).getByRole('button', { name: 'Começar treino', exact: true })).toBeInViewport();
  expect(errosDaPagina).toEqual([]);
});

test('1920: data futura junta as duas frases da data numa só', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1920, FUTURA);
  await expect(apoio(page).getByText('Você está registrando o treino de 21/10/2026 e poderá concluí-lo a partir desse dia.', { exact: true })).toBeVisible();
  await expect(page.getByText(/Você poderá concluir este treino/)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

for (const { largura, menuMinimizado } of [{ largura: 390 }, { largura: 1024 }, { largura: 1024, menuMinimizado: true }]) {
  test(`${largura}${menuMinimizado ? ' (menu minimizado)' : ''}: celular e faixa compacta como antes (sem apoio, a nota depois dos exercícios e as duas frases da data)`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura, HOJE, { menuMinimizado });
    await expect(exercicios(page)).toHaveCount(5);
    await expect(apoio(page)).toHaveCount(0);
    await expect(extras(page)).toHaveCount(0);
    const nota = await caixa(page.getByText(NOTA, { exact: true }));
    expect(nota.y).toBeGreaterThan((await caixa(exercicios(page).last())).y);
    await page.goto(FUTURA);
    await expect(page.getByText('Você poderá concluir este treino a partir de 21/10/2026.', { exact: true })).toBeVisible();
    expect(await semRolagemDeLado(page)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });
}

test('1920: sessão que saiu do plano mostra o vazio com "Ver meu treino"', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1920, '/aluno/sessao/nao-existe?data=2026-10-19');
  await expect(page.getByText('Esta sessão não está mais no seu plano. Volte para ver o treino atual.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver meu treino' })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

// Capturas para conferir (pasta fora do git): `E2E_CAPTURAS=<pasta> npx playwright test aluno-layout-treino-do-dia -g capturas`.
const PASTA = process.env.E2E_CAPTURAS;
const CASOS: { largura: number; altura?: number; tema: 'ESCURO' | 'CLARO'; caminho?: string; nome?: string; menuMinimizado?: boolean }[] = [
  { largura: 390, altura: 844, tema: 'ESCURO' },
  { largura: 1024, altura: 768, tema: 'ESCURO', menuMinimizado: true },
  { largura: 1280, altura: 800, tema: 'ESCURO' }, { largura: 1280, altura: 800, tema: 'CLARO' },
  { largura: 1536, altura: 864, tema: 'ESCURO' },
  { largura: 1920, tema: 'ESCURO' }, { largura: 1920, tema: 'CLARO' },
  { largura: 2560, altura: 1440, tema: 'ESCURO' },
  { largura: 3440, altura: 1440, tema: 'ESCURO' }, { largura: 3440, altura: 1440, tema: 'CLARO' },
  { largura: 1920, tema: 'ESCURO', caminho: FUTURA, nome: 'futura' },
  { largura: 3440, altura: 1440, tema: 'ESCURO', caminho: LIVRE, nome: 'sem-historico' },
];
test('capturas: treino do dia na matriz de larguras e temas', async ({ page }) => {
  test.skip(!PASTA, 'sem E2E_CAPTURAS');
  test.setTimeout(300_000);
  fs.mkdirSync(PASTA!, { recursive: true });
  for (const { largura, altura, tema, caminho, nome, menuMinimizado } of CASOS) {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await abrir(page, largura, caminho ?? HOJE, { tema, altura, menuMinimizado });
    await expect(exercicios(page).or(page.getByRole('link', { name: /^Abrir Exercício s[bd]e\d/ })).first()).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${PASTA}/treino-do-dia-${tema.toLowerCase()}-${largura}${nome ? `-${nome}` : ''}${menuMinimizado ? '-minimizado' : ''}.png`, fullPage: true });
  }
  // Rolado até o fim (o apoio e a 3ª coluna fixos ao rolar).
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await abrir(page, 1920, HOJE, { altura: 720 });
  await page.mouse.move(1000, 400);
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${PASTA}/treino-do-dia-escuro-1920x720-rolado.png` });
});
