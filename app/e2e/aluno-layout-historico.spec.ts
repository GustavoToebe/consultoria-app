import { expect, test, type Locator, type Page } from '@playwright/test';

import type { Atualizacao, DiaDeTreino, PastaDoAluno, RegistroPeso } from '../src/api/tipos';
import { ALUNO, erroApi, simularApi, type RespostasApi } from './api-falsa';
import { fixarHoje, sessaoDeAlunoComTreino, SESSOES_COM_DIAS } from './aluno';

/**
 * Histórico do aluno na web (`docs/planos/aluno-web-layout.md`, seção 7; medidas na 1.7 de `orientacoes-de-design-26-11.md`;
 * regra em `dominio/abasDoHistorico`): com o menu lateral a tela vira abas no topo, Treinos (Registros e cargas + Progresso no
 * apoio, ao lado a partir de 952 px de área), Corpo (Peso, Avaliação física e Fotos na largura do bloco) e Atualizações (lista
 * em até 880), com a aba no endereço (`?aba=`; o voltar desfaz a troca e recarregar mantém a aba).
 * No celular nada muda: uma coluna, na ordem de sempre.
 * Só dados fictícios; fotos vazias (nada sensível nas capturas, que só saem com `CAPTURAS_HISTORICO` apontando uma pasta fora
 * do repositório).
 */

const PASTAS: PastaDoAluno[] = [{ id: 'p-out', titulo: 'Outubro', inicio: '2026-10-05', fim: '2026-11-01', concluidaEm: null, atual: true, temTreino: true, temDieta: true }];
const serie = (id: string, carga: number) => ({ id, serieUid: 's', tipo: 'WS', trabalho: true, carga, unidade: 'kg' as const, repeticoes: 8, concluida: true, observacao: null });
const DIAS: DiaDeTreino[] = ['2026-10-05', '2026-10-12'].map((data, i) => ({
  data,
  sessoes: [{ sessaoUid: 'sa', sessao: 'Peito e tríceps', planoVersaoId: 't0000000-0000-4000-8000-000000000002',
    exercicios: [{ exercicioUid: 'sae1', exercicioId: 'sae1', nome: 'Exercício sae1', series: [serie(`s${i}`, 40 + i * 2)] }] }],
}));
const PESOS: RegistroPeso[] = [
  { id: 'p1', data: '2026-10-05', pesoKg: 70, variacao: null, observacao: null },
  { id: 'p2', data: '2026-10-12', pesoKg: 70.4, variacao: 0.4, observacao: null },
];
const atualizacao = (id: string, data: string): Atualizacao => ({
  id, pastaId: 'p-out', alunoId: ALUNO.id, nomeAluno: null, dataAtualizacao: data, fase: 'REVISADA', diasParaData: 0, diasDeAtraso: 0, atrasoAte: null,
  atrasoMotivo: null, questionarioVersaoNumero: 1, questionarioVersaoId: null, questionarioNome: null, modelo: null, respostas: null,
  enviadaEm: `${data}T12:00:00-03:00`, feedback: null, versao: 1, resumo: null,
});
const ATUALIZACOES = [atualizacao('a2', '2026-10-12'), atualizacao('a1', '2026-09-28')];

interface Opcoes { tema?: 'CLARO' | 'ESCURO'; extra?: RespostasApi; altura?: number; menuRecolhido?: boolean }

async function abrir(page: Page, largura: number, caminho = '/aluno/historico', opcoes: Opcoes = {}) {
  await page.setViewportSize({ width: largura, height: opcoes.altura ?? 1080 });
  await page.addInitScript(({ id, tema, recolhido }) => {
    try {
      if (recolhido) localStorage.setItem('menu-lateral-recolhido', '1'); else localStorage.removeItem('menu-lateral-recolhido');
      localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema }));
    } catch { /* sem armazenamento */ }
  }, { id: ALUNO.id, tema: opcoes.tema ?? 'ESCURO', recolhido: !!opcoes.menuRecolhido });
  await fixarHoje(page);
  const api = await simularApi(page, {
    ...(await sessaoDeAlunoComTreino(page, SESSOES_COM_DIAS)),
    'GET /aluno/pastas': { corpo: PASTAS },
    'GET /aluno/execucoes': { corpo: DIAS },
    'GET /aluno/progresso': { corpo: [] },
    'GET /aluno/pesos': { corpo: PESOS },
    'GET /aluno/fotos/linha-do-tempo': { corpo: [] },
    'GET /aluno/avaliacoes-fisicas': { corpo: [] },
    'GET /aluno/atualizacoes': { corpo: ATUALIZACOES },
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

// Treinos: lado a lado a partir de 952 px de área (`ui/PrincipalComApoio`); abaixo, o progresso embaixo dos registros.
const MATRIZ: { largura: number; menuRecolhido?: boolean; lado: boolean }[] = [
  { largura: 1024, lado: false },
  { largura: 1024, menuRecolhido: true, lado: false },
  { largura: 1280, lado: true },
  { largura: 1536, lado: true },
  { largura: 1920, lado: true },
  { largura: 2560, lado: true },
  { largura: 3440, lado: true },
];
for (const { largura, menuRecolhido, lado } of MATRIZ) {
  test(`${largura}${menuRecolhido ? ' (menu minimizado)' : ''}: abas no topo; Treinos com o progresso ${lado ? 'ao lado' : 'embaixo'}; Corpo e Atualizações no bloco`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura, '/aluno/historico', { menuRecolhido });
    await expect(abaDaTela(page, 'Treinos')).toHaveAttribute('aria-selected', 'true');
    await expect(titulo(page, 'Peso')).toHaveCount(0);
    await expect(titulo(page, 'Fotos')).toHaveCount(0);
    await expect(page.getByText('Exercício sae1').first()).toBeVisible();
    const arranjo = async () => {
      const r = await caixa(titulo(page, 'Registros e cargas'));
      const p = await caixa(titulo(page, 'Progresso por exercício'));
      // O título do progresso (cartão recolhível) desce alguns px em relação ao dos registros: mesma faixa, não mesma linha exata.
      if (p.x - r.x > 400 && Math.abs(p.y - r.y) < 24) return 'lado';
      return p.y > r.y && Math.abs(p.x - r.x) < 2 ? 'embaixo' : 'outro';
    };
    await expect.poll(arranjo).toBe(lado ? 'lado' : 'embaixo');
    // O bloco não passa do teto de 1312 nem estica: em 3440 a sobra vira margem dos dois lados.
    const abas = await caixa(page.getByRole('tablist').first());
    expect(abas.width).toBeLessThanOrEqual(1312 + 1);
    expect(await semRolagemDeLado(page)).toBe(true);

    // Corpo: peso, avaliação e fotos um embaixo do outro, na largura do bloco.
    await abaDaTela(page, 'Corpo').click();
    await expect(page).toHaveURL(/[?&]aba=corpo/);
    await expect(titulo(page, 'Registros e cargas')).toHaveCount(0);
    const peso = await caixa(titulo(page, 'Peso'));
    const avaliacao = await caixa(titulo(page, 'Avaliação física'));
    const fotos = await caixa(titulo(page, 'Fotos'));
    expect(peso.y).toBeLessThan(avaliacao.y);
    expect(avaliacao.y).toBeLessThan(fotos.y);
    expect(Math.abs(peso.x - fotos.x)).toBeLessThan(2);
    await expect(page.getByLabel('Registros de peso').getByText('70,4 kg', { exact: true })).toBeVisible();
    expect(await semRolagemDeLado(page)).toBe(true);

    // Atualizações: a lista das enviadas em largura de leitura (até 880), no meio do bloco.
    await abaDaTela(page, 'Atualizações').click();
    await expect(page).toHaveURL(/[?&]aba=atualizacoes/);
    const linha = await caixa(page.getByRole('link', { name: /Atualização · 12\/10\/2026/ }));
    expect(linha.width).toBeLessThanOrEqual(880);
    // Com o bloco mais largo que a lista, ela sai da borda esquerda (fica no meio), em vez de colada à esquerda com vazio à direita.
    const h1 = await caixa(page.getByRole('heading', { level: 1, name: 'Histórico' }));
    // Em 1280 a sobra é pequena (bloco de ~990 e lista de 880): basta sair da borda.
    if (lado) expect(linha.x).toBeGreaterThan(h1.x + 40);
    await expect(titulo(page, 'Peso')).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
}

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

// Capturas para conferir (pasta temporária, nunca no git): `CAPTURAS_HISTORICO=<pasta> npx playwright test aluno-layout-historico -g capturas`.
const PASTA = process.env.CAPTURAS_HISTORICO;
const CASOS_DAS_CAPTURAS: { largura: number; tema: 'ESCURO' | 'CLARO'; menuRecolhido?: boolean }[] = [
  { largura: 390, tema: 'ESCURO' }, { largura: 1024, tema: 'ESCURO' }, { largura: 1024, tema: 'ESCURO', menuRecolhido: true },
  { largura: 1280, tema: 'ESCURO' }, { largura: 1280, tema: 'CLARO' }, { largura: 1536, tema: 'ESCURO' },
  { largura: 1920, tema: 'ESCURO' }, { largura: 1920, tema: 'CLARO' }, { largura: 2560, tema: 'ESCURO' }, { largura: 3440, tema: 'ESCURO' },
];
test('capturas do Histórico na matriz de larguras, escuro e claro', async ({ page }) => {
  test.skip(!PASTA, 'sem CAPTURAS_HISTORICO');
  test.setTimeout(300_000);
  for (const { largura, tema, menuRecolhido } of CASOS_DAS_CAPTURAS) {
    for (const aba of largura > 390 ? ['treinos', 'corpo', 'atualizacoes'] : ['treinos']) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await abrir(page, largura, `/aluno/historico?aba=${aba}`, { tema, menuRecolhido });
      await expect(page.getByText(/Exercício sae1|70,4 kg|Atualização · 12/).first()).toBeVisible();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${PASTA}/${tema.toLowerCase()}-${largura}${menuRecolhido ? '-recolhido' : ''}-${aba}.png` });
    }
  }
});
