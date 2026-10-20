import { expect, test, type Page } from '@playwright/test';

import type { AnamneseDetalhe, Atualizacao } from '../src/api/tipos';
import { erroApi, simularApi, type RespostasApi } from './api-falsa';
import { dietaFalsa, fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa, SESSOES_COM_DIAS } from './aluno';

/**
 * Início do aluno (proposta do Gustavo, 19/10): Dieta compacta → Hoje → Suas pendências → Divisões da semana → Sua semana.
 * O relógio fica em segunda-feira, 19/10/2026 (o treino de hoje é o A).
 */

const ANAMNESE_PENDENTE = {
  id: 'n0000000-0000-4000-8000-000000000001',
  alunoId: 'a0000000-0000-4000-8000-000000000002',
  nomeAluno: null,
  situacao: 'PENDENTE',
  questionarioVersaoId: 'v0000000-0000-4000-8000-000000000001',
  questionarioVersaoNumero: 1,
  questionarioNome: null,
  modelo: { formato: 2, instrucoes: [], secoes: [] },
  respostas: {},
  atribuidaEm: '2026-10-18T12:00:00Z',
  atribuidaPorNome: null,
  enviadaEm: null,
  revisadaEm: null,
  revisadaPorNome: null,
  dispensadaEm: null,
  dispensadaPorNome: null,
  alteracoes: [],
  dispensaMotivo: null,
  versao: 1,
} as AnamneseDetalhe;

/** Atualização aberta cuja data (17/10) já passou: o app calcula "atrasada há 2 dias". */
const ATUALIZACAO_ATRASADA = {
  id: 'z0000000-0000-4000-8000-000000000001',
  pastaId: 'p0000000-0000-4000-8000-000000000001',
  alunoId: 'a0000000-0000-4000-8000-000000000002',
  nomeAluno: null,
  dataAtualizacao: '2026-10-17',
  fase: 'ABERTA',
  diasParaData: -2,
  diasDeAtraso: 0,
  atrasoAte: null,
  atrasoMotivo: null,
  questionarioVersaoNumero: 1,
  questionarioVersaoId: 'v0000000-0000-4000-8000-000000000001',
  questionarioNome: null,
  modelo: { formato: 2, instrucoes: [], secoes: [] },
  respostas: null,
  enviadaEm: null,
  feedback: null,
  versao: 1,
  resumo: null,
} as Atualizacao;

interface Cenario {
  sessoes?: ReturnType<typeof sessaoFalsa>[] | null;
  dieta?: ReturnType<typeof dietaFalsa> | { dieta: null } | 'erro';
  extra?: RespostasApi;
}

/** Abre o início com o cenário dado e devolve o que a página recebeu. */
async function abrirInicio(page: Page, { sessoes = SESSOES_COM_DIAS, dieta = dietaFalsa(6, 3), extra = {} }: Cenario = {}) {
  await fixarHoje(page);
  const respostas: RespostasApi = {
    ...(await sessaoDeAlunoComTreino(page, sessoes)),
    'GET /aluno/dieta': dieta === 'erro' ? erroApi(503, 'Servidor fora do ar.') : { corpo: dieta },
    'GET /aluno/atualizacao': erroApi(404, 'Nenhuma atualização.', 'NAO_ENCONTRADO'),
    ...extra,
  };
  const api = await simularApi(page, respostas);
  await page.goto('/aluno');
  return api;
}

/** Posição vertical (topo) do elemento na página. */
async function topo(page: Page, nome: string | RegExp, papel: 'heading' | 'link' | 'button' = 'heading'): Promise<number> {
  const caixa = await page.getByRole(papel, { name: nome }).first().boundingBox();
  expect(caixa, `${papel} ${nome} na tela`).not.toBeNull();
  return caixa!.y;
}

test('com dieta e água, anamnese e atualização atrasada: a ordem é Dieta → Hoje → pendências → divisões → Sua semana', async ({ page }) => {
  const { errosDaPagina } = await abrirInicio(page, {
    extra: { 'GET /aluno/anamnese': { corpo: ANAMNESE_PENDENTE }, 'GET /aluno/atualizacao': { corpo: ATUALIZACAO_ATRASADA } },
  });

  // Cabeçalho: um h1 só, "Olá, <primeiro nome>." com a data de hoje por extenso.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Olá, Aluno.');
  await expect(page.getByText('Segunda-feira · 19 de outubro')).toBeVisible();

  // Dieta compacta: refeições, "Ver dieta" e a água do dia.
  const dieta = page.getByRole('link', { name: /^Dieta,/ });
  await expect(dieta).toContainText('6 refeições no seu plano');
  await expect(dieta).toContainText('Ver dieta');
  await expect(dieta).toContainText('Água do dia');
  await expect(dieta).toContainText('3,0 L');

  // Hoje: rótulo, nome, contagem, o botão primário e a nota.
  await expect(page.getByRole('heading', { name: 'Hoje', level: 2 })).toBeVisible();
  await expect(page.getByText('TREINO A')).toBeVisible();
  await expect(page.getByText('5 exercícios').first()).toBeVisible();
  await expect(page.getByText('Consulte a lista antes de começar.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Ver meu treino/ })).toBeVisible();

  // Pendências: anamnese neutra e atualização atrasada (a única em vermelho), com a contagem.
  await expect(page.getByRole('heading', { name: 'Suas pendências' })).toBeVisible();
  await expect(page.getByLabel('2 pendências')).toBeVisible();
  await expect(page.getByRole('link', { name: /Anamnese inicial/ })).toContainText('Pendente');
  await expect(page.getByRole('link', { name: /Atualização do período/ })).toContainText(/Atrasada 2 dias/i);

  // Divisões: A, B e C, "Hoje" só na de segunda.
  await expect(page.getByRole('heading', { name: 'Divisões da semana' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Divisão A, Peito e tríceps, Segunda · 5 exercícios, hoje/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Divisão B, Costas e bíceps, Quarta · 4 exercícios$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Divisão C, Pernas, Sexta · 6 exercícios$/ })).toBeVisible();

  // A ordem na página.
  const y = [
    await topo(page, /^Dieta,/, 'link'),
    await topo(page, 'Hoje'),
    await topo(page, 'Suas pendências'),
    await topo(page, 'Divisões da semana'),
    await topo(page, 'Sua semana'),
  ];
  expect(y).toEqual([...y].sort((a, b) => a - b));

  expect(errosDaPagina).toEqual([]);
});

test('"Ver meu treino" abre a lista do dia de hoje', async ({ page }) => {
  await abrirInicio(page);
  await page.getByRole('button', { name: /^Ver meu treino/ }).click();
  await expect(page).toHaveURL(/\/aluno\/sessao\/sa\?data=2026-10-19$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Segunda · Peito e tríceps');
});

test('a divisão de outro dia abre a próxima vez dela e a tela do dia deixa escolher outra data', async ({ page }) => {
  await abrirInicio(page);
  await page.getByRole('button', { name: /^Divisão B,/ }).click();
  await expect(page).toHaveURL(/\/aluno\/sessao\/sb\?data=2026-10-21$/);
  await expect(page.getByRole('heading', { name: 'Outras datas' })).toBeVisible();
  await page.getByRole('button', { name: /Quarta · Costas e bíceps, 14\/10/ }).click();
  await expect(page).toHaveURL(/\/aluno\/sessao\/sb\?data=2026-10-14$/);
  await expect(page.getByText('Você está registrando o treino de')).toBeVisible();
});

test('no celular (390 px) o botão "Ver meu treino" aparece na primeira tela, com a dieta em poucas linhas', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrirInicio(page);
  const botao = page.getByRole('button', { name: /^Ver meu treino/ });
  await expect(botao).toBeVisible();
  const caixa = await botao.boundingBox();
  expect(caixa!.y + caixa!.height).toBeLessThanOrEqual(844 - 64);
  // Cartão da dieta baixo: cabe em até duas linhas de texto (menos de 100 px).
  const dieta = await page.getByRole('link', { name: /^Dieta,/ }).boundingBox();
  expect(dieta!.height).toBeLessThan(100);
  // Alvos de toque de 44 px.
  expect(caixa!.height).toBeGreaterThanOrEqual(44);
});

test('sem água, a coluna da água some', async ({ page }) => {
  await abrirInicio(page, { dieta: dietaFalsa(4, null) });
  const dieta = page.getByRole('link', { name: /^Dieta,/ });
  await expect(dieta).toContainText('4 refeições no seu plano');
  await expect(dieta).not.toContainText('Água do dia');
});

test('sem dieta publicada, a linha neutra explica e não há link', async ({ page }) => {
  await abrirInicio(page, { dieta: { dieta: null } });
  await expect(page.getByText('Seu treinador ainda não publicou um plano alimentar.')).toBeVisible();
  await expect(page.getByRole('link', { name: /^Dieta,/ })).toHaveCount(0);
});

test('falha ao carregar a dieta oferece "Tentar de novo" e não diz que não foi publicada', async ({ page }) => {
  await abrirInicio(page, { dieta: 'erro' });
  await expect(page.getByText('Não foi possível carregar a dieta.')).toBeVisible();
  await expect(page.getByText('ainda não publicou um plano alimentar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
});

test('dia de descanso: "Hoje é dia de descanso." e nenhum botão de treino', async ({ page }) => {
  await abrirInicio(page, { sessoes: [sessaoFalsa('sb', 'Costas e bíceps', 3, 4), sessaoFalsa('sc', 'Pernas', 5, 6)] });
  await expect(page.getByText('Hoje é dia de descanso.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Ver meu treino/ })).toHaveCount(0);
  // As divisões continuam na lista, sem "Hoje".
  await expect(page.getByRole('button', { name: /^Divisão A, Costas e bíceps, Quarta · 4 exercícios$/ })).toBeVisible();
});

test('plano sem dia fixo: "Qual é o treino de hoje?" e "Escolher treino" leva às divisões', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await abrirInicio(page, { sessoes: [sessaoFalsa('sa', 'Corpo todo 1', null, 5), sessaoFalsa('sb', 'Corpo todo 2', null, 4)] });
  await expect(page.getByText('Qual é o treino de hoje?')).toBeVisible();
  await expect(page.getByText('TREINO A')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ver meu treino' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Divisão A, Corpo todo 1, Sem dia fixo · 5 exercícios$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Escolher treino' }).click();
  // A tela rola até as divisões: o título delas fica à vista.
  await expect(page.getByRole('heading', { name: 'Divisões da semana' })).toBeInViewport();
  // Divisão sem dia fixo abre hoje.
  await page.getByRole('button', { name: /^Divisão B,/ }).click();
  await expect(page).toHaveURL(/\/aluno\/sessao\/sb\?data=2026-10-19$/);
});

test('treino ainda não publicado: "Seu treino está sendo preparado" (não é erro)', async ({ page }) => {
  await abrirInicio(page, { sessoes: null });
  await expect(page.getByText('Seu treino está sendo preparado')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('sem pendências o bloco "Suas pendências" some', async ({ page }) => {
  await abrirInicio(page);
  await expect(page.getByRole('heading', { name: 'Hoje', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Suas pendências' })).toHaveCount(0);
});

test('só com a anamnese pendente: uma pendência, neutra', async ({ page }) => {
  await abrirInicio(page, { extra: { 'GET /aluno/anamnese': { corpo: ANAMNESE_PENDENTE } } });
  await expect(page.getByLabel('1 pendência')).toBeVisible();
  await expect(page.getByRole('link', { name: /Anamnese inicial/ })).toContainText('Seu treinador pediu algumas informações.');
  await expect(page.getByRole('link', { name: /Atualização do período/ })).toHaveCount(0);
  await page.getByRole('link', { name: /Anamnese inicial/ }).click();
  await expect(page).toHaveURL(/\/aluno\/anamnese$/);
});

test('a aba de baixo se chama Início', async ({ page }) => {
  await abrirInicio(page);
  await expect(page.getByRole('link', { name: 'Início' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Treino', exact: true })).toHaveCount(0);
});
