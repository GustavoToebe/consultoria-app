import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';

import type { AvaliacaoFisica } from '../src/api/avaliacaoFisicaTipos';
import type { Atualizacao, DiaDeTreino, PastaDoAluno, ProgressoPonto, RegistroPeso } from '../src/api/tipos';
import { medidasVazias } from '../src/dominio/avaliacaoFisica';
import { somarDias } from '../src/dominio/formatos';
import { ALUNO, erroApi, simularApi, type RespostasApi } from './api-falsa';
import { fixarHoje, sessaoDeAlunoComTreino, SESSOES_COM_DIAS } from './aluno';

/**
 * Histórico do aluno na web (`docs/planos/aluno-web-layout.md`, seção 7; regras em `dominio/abasDoHistorico` e
 * `dominio/colunasDoHistorico`): com o menu lateral a tela vira abas no topo, Treinos (Registros e cargas + Progresso no
 * apoio, ao lado a partir de 972 px de área), Corpo (Peso, Avaliação física e Fotos) e Atualizações, com a aba no endereço
 * (`?aba=`; o voltar desfaz a troca e recarregar mantém a aba). Contêiner do treinador (27/11): começa ao lado do menu, sem
 * teto; divisões, cartões do Corpo e linhas das Atualizações em 1, 2 e 3 colunas nas faixas normal, larga e ultralarga.
 * No celular nada muda: uma coluna, na ordem de sempre.
 * Só dados fictícios; fotos vazias. Capturas só com `E2E_CAPTURAS` apontando uma pasta fora do git.
 */

const PASTAS: PastaDoAluno[] = [{ id: 'p-out', titulo: 'Outubro', inicio: '2026-10-05', fim: '2026-11-01', concluidaEm: null, atual: true, temTreino: true, temDieta: true }];
const serie = (id: string, carga: number) => ({ id, serieUid: 's', tipo: 'WS', trabalho: true, carga, unidade: 'kg' as const, repeticoes: 8, concluida: true, observacao: null });
const exercicio = (uid: string, i: number) => ({ exercicioUid: uid, exercicioId: uid, nome: `Exercício ${uid}`, series: [serie(`${uid}-${i}`, 40 + i * 2)] });

/** Poucos dados: uma divisão com um exercício (o caso de quem está começando). */
const DIAS: DiaDeTreino[] = ['2026-10-05', '2026-10-12'].map((data, i) => ({
  data,
  sessoes: [{ sessaoUid: 'sa', sessao: 'Peito e tríceps', planoVersaoId: 't0000000-0000-4000-8000-000000000002', exercicios: [exercicio('sae1', i)] }],
}));

/** Três divisões (A seg, B qua, C sex) em três semanas, cada uma com 2 a 4 exercícios. */
const DIVISOES: [string, string, number][] = [['sa', 'Peito e tríceps', 3], ['sb', 'Costas e bíceps', 2], ['sc', 'Pernas', 4]];
const DIAS_RICOS: DiaDeTreino[] = ['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12', '2026-10-14', '2026-10-16', '2026-10-19'].map((data, i) => {
  const [uid, nome, n] = DIVISOES[i % 3];
  return { data, sessoes: [{ sessaoUid: uid, sessao: nome, planoVersaoId: 't0000000-0000-4000-8000-000000000002',
    exercicios: Array.from({ length: n }, (_, j) => exercicio(`${uid}e${j + 1}`, i)) }] };
});
const PROGRESSO: ProgressoPonto[] = ['2026-10-05', '2026-10-12', '2026-10-19'].map((data, i) => ({ data, maiorCargaTrabalho: 40 + i * 2, repeticoes: 8 }));

const PESOS: RegistroPeso[] = [
  { id: 'p1', data: '2026-10-05', pesoKg: 70, variacao: null, observacao: null },
  { id: 'p2', data: '2026-10-12', pesoKg: 70.4, variacao: 0.4, observacao: null },
];
const PESOS_RICOS: RegistroPeso[] = Array.from({ length: 8 }, (_, i) => ({
  id: `pr${i}`, data: somarDias('2026-08-31', i * 7), pesoKg: 72 - i * 0.3, variacao: i ? -0.3 : null, observacao: null,
}));
const avaliacao = (id: string, data: string, cintura: number, quadril: number): AvaliacaoFisica => ({
  id, data, medidas: { ...medidasVazias(), cintura, quadril, peitoral: cintura + 10 }, observacao: null, pesoKg: null, versao: 0,
  criadoEm: `${data}T12:00:00Z`, alteradoEm: `${data}T12:00:00Z`,
});
const AVALIACOES = [avaliacao('av2', '2026-10-01', 86, 98), avaliacao('av1', '2026-09-01', 88, 99)];

const atualizacao = (id: string, data: string): Atualizacao => ({
  id, pastaId: 'p-out', alunoId: ALUNO.id, nomeAluno: null, dataAtualizacao: data, fase: 'REVISADA', diasParaData: 0, diasDeAtraso: 0, atrasoAte: null,
  atrasoMotivo: null, questionarioVersaoNumero: 1, questionarioVersaoId: null, questionarioNome: null, modelo: null, respostas: null,
  enviadaEm: `${data}T12:00:00-03:00`, feedback: null, versao: 1, resumo: null,
});
const ATUALIZACOES = [atualizacao('a2', '2026-10-12'), atualizacao('a1', '2026-09-28')];
const DATAS_DAS_ATUALIZACOES = Array.from({ length: 7 }, (_, i) => somarDias('2026-10-12', -14 * i));
const ATUALIZACOES_RICAS = DATAS_DAS_ATUALIZACOES.map((data, i) => atualizacao(`ar${i}`, data));

interface Opcoes { tema?: 'CLARO' | 'ESCURO'; extra?: RespostasApi; altura?: number; menuRecolhido?: boolean; ricos?: boolean }

async function abrir(page: Page, largura: number, caminho = '/aluno/historico', opcoes: Opcoes = {}) {
  await page.setViewportSize({ width: largura, height: opcoes.altura ?? 1080 });
  await page.addInitScript(({ id, tema, recolhido }) => {
    try {
      if (recolhido) localStorage.setItem('menu-lateral-recolhido', '1'); else localStorage.removeItem('menu-lateral-recolhido');
      localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema }));
    } catch { /* sem armazenamento */ }
  }, { id: ALUNO.id, tema: opcoes.tema ?? 'ESCURO', recolhido: !!opcoes.menuRecolhido });
  await fixarHoje(page);
  const ricos = !!opcoes.ricos;
  const api = await simularApi(page, {
    ...(await sessaoDeAlunoComTreino(page, SESSOES_COM_DIAS)),
    'GET /aluno/pastas': { corpo: PASTAS },
    'GET /aluno/execucoes': { corpo: ricos ? DIAS_RICOS : DIAS },
    'GET /aluno/progresso': { corpo: ricos ? PROGRESSO : [] },
    'GET /aluno/pesos': { corpo: ricos ? PESOS_RICOS : PESOS },
    'GET /aluno/fotos/linha-do-tempo': { corpo: [] },
    'GET /aluno/avaliacoes-fisicas': { corpo: ricos ? AVALIACOES : [] },
    'GET /aluno/atualizacoes': { corpo: ricos ? ATUALIZACOES_RICAS : ATUALIZACOES },
    'GET /aluno/atualizacao': erroApi(404, 'Nenhuma atualização.', 'NAO_ENCONTRADO'),
    'GET /aluno/sessoes-concluidas': { corpo: { totalConcluidos: 0, sessoes: [] } },
    ...opcoes.extra,
  });
  await page.goto(caminho);
  await expect(page.getByRole('heading', { level: 1, name: 'Histórico' })).toBeVisible();
  return api;
}

const titulo = (page: Page, nome: string) => page.getByRole('heading', { name: nome, exact: true });
const abaDaTela = (page: Page, nome: string) => page.getByRole('tab', { name: nome, exact: true });
const caixa = async (l: Locator) => {
  await expect(l).toBeVisible();
  let b: Awaited<ReturnType<Locator['boundingBox']>> = null;
  await expect.poll(async () => (b = await l.boundingBox()) !== null).toBe(true);
  return b!;
};
const semRolagemDeLado = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
/** Quantas colunas distintas (x arredondado a 8 px) os elementos ocupam. */
const colunasDe = async (locs: Locator[]) => new Set(await Promise.all(locs.map(async (l) => Math.round((await caixa(l)).x / 8)))).size;

test('390: sem abas, todos os cartões numa coluna, na ordem de sempre (o ?aba= do endereço é ignorado)', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 390, '/aluno/historico?aba=corpo');
  await expect(abaDaTela(page, 'Corpo')).toHaveCount(0);
  const nomes = ['Fotos', 'Atualizações', 'Registros e cargas', 'Progresso por exercício', 'Peso', 'Avaliação física'];
  const caixas = [];
  for (const n of nomes) caixas.push(await caixa(titulo(page, n)));
  for (let i = 1; i < caixas.length; i++) {
    expect(caixas[i].y).toBeGreaterThan(caixas[i - 1].y);
    expect(Math.abs(caixas[i].x - caixas[0].x)).toBeLessThan(2);
  }
  expect(await semRolagemDeLado(page)).toBe(true);
  expect(errosDaPagina).toEqual([]);
});

// Treinos: lado a lado a partir de 972 px de área (`ui/PrincipalComApoio`); colunas: 1 até a normal, 2 na larga, 3 na ultralarga.
const MATRIZ: { largura: number; menuRecolhido?: boolean; lado: boolean; colunas: number }[] = [
  { largura: 1024, lado: false, colunas: 1 },
  { largura: 1024, menuRecolhido: true, lado: false, colunas: 1 },
  { largura: 1280, lado: true, colunas: 1 },
  { largura: 1536, lado: true, colunas: 1 },
  { largura: 1920, lado: true, colunas: 2 },
  { largura: 2560, lado: true, colunas: 2 },
  { largura: 3440, lado: true, colunas: 3 },
];
for (const { largura, menuRecolhido, lado, colunas } of MATRIZ) {
  test(`${largura}${menuRecolhido ? ' (menu minimizado)' : ''}: progresso ${lado ? 'ao lado' : 'embaixo'}; ${colunas} coluna(s) nos Registros, no Corpo e nas Atualizações`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura, '/aluno/historico', { menuRecolhido, ricos: true });
    await expect(abaDaTela(page, 'Treinos')).toHaveAttribute('aria-selected', 'true');
    await expect(titulo(page, 'Peso')).toHaveCount(0);
    await expect(page.getByText('Exercício sae1').first()).toBeVisible();
    const arranjo = async () => {
      const r = await caixa(titulo(page, 'Registros e cargas'));
      const p = await caixa(titulo(page, 'Progresso por exercício'));
      // O título do progresso (cartão recolhível) desce alguns px em relação ao dos registros: mesma faixa, não mesma linha exata.
      if (p.x - r.x > 400 && Math.abs(p.y - r.y) < 24) return 'lado';
      return p.y > r.y && Math.abs(p.x - r.x) < 2 ? 'embaixo' : 'outro';
    };
    await expect.poll(arranjo).toBe(lado ? 'lado' : 'embaixo');
    // Contêiner do treinador: o conteúdo começa no x do título e vai até a borda direita (sem teto, sem faixa vazia).
    const h1 = await caixa(page.getByRole('heading', { level: 1, name: 'Histórico' }));
    const abas = await caixa(page.getByRole('tablist').first());
    expect(Math.abs(abas.x - h1.x)).toBeLessThan(16);
    if (lado) {
      const apoio = await caixa(page.getByRole('complementary', { name: 'Progresso por exercício' }));
      expect(apoio.x + apoio.width).toBeGreaterThan(largura - 80);
      // Item 12 (27/11): apoio de 380 na normal, 420 na larga e 440 na ultralarga (as faixas da `Tela`).
      const esperado = largura >= 3440 ? 440 : largura >= 1920 ? 420 : 380;
      // A faixa da `Tela` chega depois da primeira medida (o apoio nasce com 380): confere a largura já assentada.
      const apoioDaTela = page.getByRole('complementary', { name: 'Progresso por exercício' });
      await expect.poll(async () => Math.abs(((await apoioDaTela.boundingBox())?.width ?? 0) - esperado)).toBeLessThan(2);
    }
    // As três divisões: uma coluna até a normal; 2 e 3 colunas equilibradas na larga e na ultralarga.
    const divisoes = DIVISOES.map(([, nome]) => page.getByText(nome, { exact: true }).first());
    await expect.poll(() => colunasDe(divisoes)).toBe(colunas);
    expect(await semRolagemDeLado(page)).toBe(true);

    // Corpo: peso, avaliação e fotos em 1 ou 2 colunas (2 também na ultralarga, como a Ficha › Evolução), a primeira na borda do título.
    await abaDaTela(page, 'Corpo').click();
    await expect(page).toHaveURL(/[?&]aba=corpo/);
    await expect(titulo(page, 'Registros e cargas')).toHaveCount(0);
    const cartoes = ['Peso', 'Avaliação física', 'Fotos'].map((n) => titulo(page, n));
    await expect.poll(() => colunasDe(cartoes)).toBe(Math.min(colunas, 2));
    expect((await caixa(cartoes[0])).x - h1.x).toBeLessThan(40);
    await expect(page.getByLabel('Registros de peso').getByText('70,8 kg', { exact: true })).toBeVisible();
    expect(await semRolagemDeLado(page)).toBe(true);

    // Atualizações: na largura do contêiner, começando na borda do título; as linhas em 1, 2 ou 3 colunas.
    await abaDaTela(page, 'Atualizações').click();
    await expect(page).toHaveURL(/[?&]aba=atualizacoes/);
    const linhas = DATAS_DAS_ATUALIZACOES.map((d) => page.getByRole('link', { name: new RegExp(`Atualização · ${d.slice(8, 10)}/${d.slice(5, 7)}`) }));
    await expect.poll(() => colunasDe(linhas)).toBe(colunas);
    const primeira = await caixa(linhas[0]);
    expect(primeira.x - h1.x).toBeLessThan(60);
    await expect(titulo(page, 'Peso')).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
}

test('3440 com poucos dados: uma divisão ocupa a principal inteira (nenhuma coluna vazia)', async ({ page }) => {
  await abrir(page, 3440, '/aluno/historico', { altura: 1440 });
  const divisao = await caixa(page.getByText('Peito e tríceps', { exact: true }).first());
  const registros = await caixa(titulo(page, 'Registros e cargas'));
  expect(Math.abs(divisao.x - registros.x)).toBeLessThan(80);
  await expect(page.getByText('Exercício sae1').first()).toBeVisible();
});

test('1920: o apoio do progresso fica fixo abaixo da barra ao rolar a principal', async ({ page }) => {
  await abrir(page, 1920, '/aluno/historico', { ricos: true });
  await expect(page.getByText('Exercício sae1').first()).toBeVisible();
  const apoio = page.getByRole('complementary', { name: 'Progresso por exercício' });
  const registros = await caixa(titulo(page, 'Registros e cargas'));
  // A `Alvenaria` das divisões fica transparente e sem altura enquanto mede as peças: rolar antes disso, a página encolhe
  // por um quadro e o navegador devolve a rolagem ao topo. Rola só com as duas colunas assentadas.
  const divisoes = DIVISOES.map(([, nome]) => page.getByText(nome, { exact: true }).first());
  await expect.poll(() => colunasDe(divisoes)).toBe(2);
  await expect.poll(() => divisoes[0].evaluate((el) => {
    for (let e: Element | null = el; e; e = e.parentElement) if (getComputedStyle(e).opacity === '0') return false;
    return true;
  })).toBe(true);
  await page.mouse.move(registros.x + 200, 700);
  await page.mouse.wheel(0, 900);
  await expect.poll(async () => (await titulo(page, 'Registros e cargas').boundingBox())?.y ?? 0).toBeLessThan(0);
  // A rolagem termina depois do evento da roda: confere onde o apoio assenta (abaixo da barra, sem descer dela).
  await expect.poll(async () => {
    const y = Math.round((await apoio.boundingBox())?.y ?? -1);
    return y >= 56 && y < 104 ? 'na barra' : y;
  }).toBe('na barra');
});

test('1920: o voltar do navegador desfaz uma troca de aba por vez e recarregar mantém a aba', async ({ page }) => {
  await abrir(page, 1920);
  await abaDaTela(page, 'Corpo').click();
  await expect(page).toHaveURL(/[?&]aba=corpo/);
  await abaDaTela(page, 'Atualizações').click();
  await expect(page).toHaveURL(/[?&]aba=atualizacoes/);
  await page.reload();
  await expect(abaDaTela(page, 'Atualizações')).toHaveAttribute('aria-selected', 'true');
  await page.goBack();
  await expect(abaDaTela(page, 'Corpo')).toHaveAttribute('aria-selected', 'true');
  await expect(titulo(page, 'Peso')).toBeVisible();
  await page.goBack();
  await expect(abaDaTela(page, 'Treinos')).toHaveAttribute('aria-selected', 'true');
  await expect(titulo(page, 'Registros e cargas')).toBeVisible();
});

test('1920 "Por dia": as semanas também viram colunas e mantêm a ordem de leitura (mais recente primeiro)', async ({ page }) => {
  await abrir(page, 1920, '/aluno/historico', { ricos: true });
  await page.getByRole('tab', { name: 'Por dia', exact: true }).click();
  const semanas = ['Semana de 19/10 a 25/10', 'Semana de 12/10 a 18/10', 'Semana de 05/10 a 11/10'].map((t) => page.getByText(t, { exact: true }));
  await expect.poll(() => colunasDe(semanas)).toBe(2);
  // No DOM (leitor de tela e Tab), a semana mais recente vem antes das outras.
  expect(await page.getByText(/^Semana de \d\d\/\d\d a \d\d\/\d\d$/).allTextContents()).toEqual(['Semana de 19/10 a 25/10', 'Semana de 12/10 a 18/10', 'Semana de 05/10 a 11/10']);
});

test('1280 no tema claro: o endereço abre a aba pedida, valor desconhecido abre Treinos e a seta só move o foco', async ({ page }) => {
  await abrir(page, 1280, '/aluno/historico?aba=atualizacoes', { tema: 'CLARO' });
  await expect(abaDaTela(page, 'Atualizações')).toHaveAttribute('aria-selected', 'true');
  await page.goto('/aluno/historico?aba=qualquer');
  await expect(abaDaTela(page, 'Treinos')).toHaveAttribute('aria-selected', 'true');
  // Ativação manual: a seta move o foco sem trocar de aba; Enter troca.
  await abaDaTela(page, 'Treinos').focus();
  await page.keyboard.press('ArrowRight');
  await expect(abaDaTela(page, 'Corpo')).toBeFocused();
  await expect(abaDaTela(page, 'Treinos')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/[?&]aba=corpo/);
  await expect(titulo(page, 'Peso')).toBeVisible();
});

test('1280 com 720 de altura: o apoio do progresso cabe abaixo da barra, dentro da janela', async ({ page }) => {
  await abrir(page, 1280, '/aluno/historico', { altura: 720 });
  const apoio = await caixa(page.getByRole('complementary', { name: 'Progresso por exercício' }));
  expect(apoio.height).toBeLessThanOrEqual(720 - 80);
  expect(apoio.y + apoio.height).toBeLessThanOrEqual(720);
});

test('1920: erro ao carregar as atualizações e peso vazio mostram o estado na própria aba', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1920, '/aluno/historico?aba=atualizacoes', {
    extra: { 'GET /aluno/atualizacoes': erroApi(500, 'Falha fictícia ao carregar.'), 'GET /aluno/pesos': { corpo: [] } },
  });
  await expect(page.getByText('Falha fictícia ao carregar.').first()).toBeVisible();
  await abaDaTela(page, 'Corpo').click();
  await expect(page.getByText('Nenhum registro de peso.', { exact: true })).toBeVisible();
  await expect(page.getByText('Nenhuma foto enviada ainda.')).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

// Capturas para conferir (pasta fora do git): `E2E_CAPTURAS=<pasta> npx playwright test aluno-layout-historico -g capturas`.
const PASTA = process.env.E2E_CAPTURAS;
const CASOS_DAS_CAPTURAS: { largura: number; altura?: number; tema: 'ESCURO' | 'CLARO'; ricos?: boolean; menuRecolhido?: boolean; nome?: string }[] = [
  { largura: 390, altura: 844, tema: 'ESCURO', ricos: true },
  { largura: 1280, altura: 800, tema: 'ESCURO', ricos: true }, { largura: 1280, altura: 800, tema: 'CLARO', ricos: true },
  { largura: 1536, altura: 864, tema: 'ESCURO', ricos: true },
  { largura: 1920, tema: 'ESCURO', ricos: true }, { largura: 1920, tema: 'CLARO', ricos: true },
  { largura: 2560, altura: 1440, tema: 'ESCURO', ricos: true },
  { largura: 3440, altura: 1440, tema: 'ESCURO', ricos: true }, { largura: 3440, altura: 1440, tema: 'CLARO', ricos: true },
  { largura: 1920, tema: 'ESCURO', nome: 'poucos' }, { largura: 3440, altura: 1440, tema: 'ESCURO', nome: 'poucos' },
];
test('capturas do Histórico na matriz de larguras, escuro e claro', async ({ page }) => {
  test.skip(!PASTA, 'sem E2E_CAPTURAS');
  test.setTimeout(600_000);
  fs.mkdirSync(PASTA!, { recursive: true });
  for (const { largura, altura, tema, ricos, menuRecolhido, nome } of CASOS_DAS_CAPTURAS) {
    for (const aba of largura > 390 ? ['treinos', 'corpo', 'atualizacoes'] : ['treinos']) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await abrir(page, largura, `/aluno/historico?aba=${aba}`, { tema, menuRecolhido, ricos, altura });
      await expect(page.getByText(/Exercício sae1|70,8 kg|70,4 kg|Atualização · 12/).first()).toBeVisible();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${PASTA}/${tema.toLowerCase()}-${largura}${nome ? `-${nome}` : ''}${menuRecolhido ? '-recolhido' : ''}-${aba}.png` });
    }
  }
  // Um estado que não é o de sucesso: erro nas atualizações.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await abrir(page, 1920, '/aluno/historico?aba=atualizacoes', { extra: { 'GET /aluno/atualizacoes': erroApi(500, 'Falha fictícia ao carregar.') } });
  await expect(page.getByText('Falha fictícia ao carregar.').first()).toBeVisible();
  await page.screenshot({ path: `${PASTA}/escuro-1920-erro-atualizacoes.png` });
});
