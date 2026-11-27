import fs from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { AguaRegistrada, AlunoDetalhe, PlanoResumo } from '../src/api/tipos';
import { dietaFalsa } from './aluno';
import { ALUNO, erroApi, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Gráfico da Água na ficha (27/11): barras em azul-água na largura toda do cartão, valor em cima, ✓ no dia que chegou à
 * meta, linha da meta com "Meta 5,0 L" e a dica/nome de cada barra ("25/11 · 0,8 L de 5,0 L (3 copos)"). Só dados
 * fictícios. Capturas com `E2E_CAPTURAS`: `<base>/agua-<caso>-<largura>-<tema>.png`.
 */

const BASE = process.env.E2E_CAPTURAS;
type Tema = 'ESCURO' | 'CLARO';
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: 15, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};
const DIETA_ATIVA = {
  id: 'd0000000-0000-4000-8000-000000000002', alunoId: ALUNO_ID, pastaId: null, titulo: 'Dieta', inicio: '2026-11-01', fim: '2026-12-01',
  ativo: true, versaoPublicada: 1, publicadoEm: '2026-11-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 1,
} as unknown as PlanoResumo;

const UM_DIA: AguaRegistrada[] = [{ data: '2026-11-25', aguaMl: 750 }];
const CINCO_DIAS: AguaRegistrada[] = [
  { data: '2026-11-21', aguaMl: 2000 },
  { data: '2026-11-22', aguaMl: 3500 },
  { data: '2026-11-24', aguaMl: 5000 },
  { data: '2026-11-25', aguaMl: 750 },
  { data: '2026-11-27', aguaMl: 1250 },
];

async function abrirFicha(page: Page, largura: number, agua: RespostasApi[string], tema: Tema = 'ESCURO') {
  await page.setViewportSize({ width: largura, height: 1000 });
  await page.clock.setFixedTime(new Date('2026-11-27T12:00:00-03:00'));
  await page.addInitScript(([usuario, prefs]) => {
    try { localStorage.setItem(`treinos:${usuario}:preferencias`, JSON.stringify(prefs)); } catch { /* sem armazenamento */ }
  }, [TREINADOR.id, { tema, contraste: 'PADRAO', larguraConteudo: 'AUTOMATICA' }] as const);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'REGISTRO_LER', 'DIETA_LER'] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/agua`]: agua,
    [`GET /alunos/${ALUNO_ID}/planos-dieta`]: { corpo: [DIETA_ATIVA] },
    [`GET /planos-dieta/${DIETA_ATIVA.id}/versoes/1`]: { corpo: dietaFalsa(4, 5).dieta },
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=acompanhamento`);
  await expect(page.getByRole('heading', { name: 'Água', exact: true })).toBeVisible();
  return api;
}

/** O cartão da Água (o mais próximo do título) e o gráfico dentro dele. */
const cartaoDaAgua = (page: Page) => page.getByTestId('cartao').filter({ has: page.getByRole('heading', { name: 'Água', exact: true }) });
const grafico = (page: Page) => page.getByRole('list', { name: 'Água por dia nos últimos 7 dias' });

async function capturar(page: Page, caso: string, largura: number, tema: Tema) {
  if (!BASE) return;
  fs.mkdirSync(BASE, { recursive: true });
  const cartao = cartaoDaAgua(page);
  await cartao.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(BASE, `agua-${caso}-${largura}-${tema.toLowerCase()}.png`) });
  await cartao.screenshot({ path: path.join(BASE, `agua-${caso}-${largura}-${tema.toLowerCase()}-cartao.png`) });
}

for (const largura of [390, 1280, 1920]) {
  test(`um dia registrado: valor, dica, meta e "Hoje" (${largura}px)`, async ({ page }) => {
    const { errosDaPagina } = await abrirFicha(page, largura, { corpo: UM_DIA });
    await expect(page.getByText('Registrou 1 de 7 dias · média 0,8 L por dia · meta 5,0 L', { exact: true })).toBeVisible();
    const barra = page.getByRole('img', { name: '25/11 · 0,8 L de 5,0 L (3 copos)' });
    await expect(barra).toBeVisible();
    await expect(barra).toHaveAttribute('title', '25/11 · 0,8 L de 5,0 L (3 copos)');
    await expect(barra.getByText('0,8 L', { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: /· sem registro$/ })).toHaveCount(6);
    await expect(page.getByText('Meta 5,0 L', { exact: true })).toBeVisible();
    await expect(cartaoDaAgua(page).getByText('Hoje', { exact: true })).toBeVisible();

    // Largura toda do cartão e barras entre 40 e 56 px a partir do PC (no celular encolhem com a coluna).
    const caixaDoCartao = (await cartaoDaAgua(page).boundingBox())!;
    const caixaDoGrafico = (await grafico(page).boundingBox())!;
    expect(caixaDoGrafico.width).toBeGreaterThan(caixaDoCartao.width * 0.7);
    const caixaDaBarra = (await barra.getByTestId('barra-da-agua').boundingBox())!;
    expect(caixaDaBarra.width).toBeLessThanOrEqual(56);
    if (largura >= 1280) expect(caixaDaBarra.width).toBeGreaterThanOrEqual(40);
    expect(caixaDoGrafico.x + caixaDoGrafico.width).toBeLessThanOrEqual(caixaDoCartao.x + caixaDoCartao.width);
    expect(errosDaPagina).toEqual([]);
  });
}

test('cinco dias, um batendo a meta: só ele tem o ✓ e a escala cabe a barra mais alta', async ({ page }) => {
  const { errosDaPagina } = await abrirFicha(page, 1280, { corpo: CINCO_DIAS });
  await expect(page.getByText('Registrou 5 de 7 dias · média 2,5 L por dia · meta 5,0 L', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: '24/11 · 5,0 L de 5,0 L (20 copos)' })).toBeVisible();
  await expect(page.getByRole('img', { name: '27/11 · 1,3 L de 5,0 L (5 copos)' })).toBeVisible();
  await expect(page.getByRole('img', { name: /· sem registro$/ })).toHaveCount(2);
  // O valor da barra mais alta fica dentro do gráfico (a folga de cima não deixa cortar).
  const valor = (await page.getByRole('img', { name: /^24\/11/ }).getByText('5,0 L', { exact: true }).boundingBox())!;
  const caixa = (await grafico(page).boundingBox())!;
  expect(valor.y).toBeGreaterThanOrEqual(caixa.y);
  expect(errosDaPagina).toEqual([]);
});

test('erro ao buscar a água mostra a mensagem com "Tentar de novo"', async ({ page }) => {
  await abrirFicha(page, 390, erroApi(500, 'Falha simulada.'));
  await expect(cartaoDaAgua(page).getByRole('button', { name: /Tentar de novo/ })).toBeVisible();
  await expect(grafico(page)).toHaveCount(0);
  await capturar(page, 'erro', 390, 'ESCURO');
});

test('sem registro na semana: só a frase, sem gráfico nem bolinha', async ({ page }) => {
  await abrirFicha(page, 1280, { corpo: [] });
  await expect(page.getByText('Nenhum registro nos últimos 7 dias · meta 5,0 L', { exact: true })).toBeVisible();
  await expect(grafico(page)).toHaveCount(0);
});

for (const tema of ['ESCURO', 'CLARO'] as const) {
  for (const largura of [1280, 1920]) {
    for (const [caso, agua] of [['1-dia', UM_DIA], ['5-dias', CINCO_DIAS]] as const) {
      test(`captura ${caso} ${tema.toLowerCase()} ${largura}px`, async ({ page }) => {
        test.skip(!BASE, 'só com E2E_CAPTURAS');
        await abrirFicha(page, largura, { corpo: agua }, tema);
        await expect(page.getByRole('img', { name: /^25\/11/ })).toBeVisible();
        await capturar(page, caso, largura, tema);
      });
    }
  }
}

test('capturas 390 escuro (5 dias)', async ({ page }) => {
  test.skip(!BASE, 'só com E2E_CAPTURAS');
  await abrirFicha(page, 390, { corpo: CINCO_DIAS });
  await expect(page.getByRole('img', { name: /^24\/11/ })).toBeVisible();
  await capturar(page, '5-dias', 390, 'ESCURO');
});
