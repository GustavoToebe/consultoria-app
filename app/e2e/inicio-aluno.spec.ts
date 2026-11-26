import { expect, test, type Page } from '@playwright/test';

import type { AnamneseDetalhe, Atualizacao, SessoesConcluidasResponse } from '../src/api/tipos';
import { ALUNO, erroApi, sessao, simularApi, type RespostasApi } from './api-falsa';
import { dietaFalsa, fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa, SESSOES_COM_DIAS } from './aluno';

/**
 * Início do aluno: Hoje → Dieta compacta → Água de hoje (com meta na dieta) → Suas pendências → Sua semana, em qualquer largura (o Hoje
 * primeiro desde 24/11). As divisões ficam na aba Treino.
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

/** Caixas do Hoje, do Dieta, da Água de hoje, das pendências e do Sua semana, nessa ordem. */
async function ordemDoInicio(page: Page) {
  const caixa = async (nome: string | RegExp, papel: 'heading' | 'link') => (await page.getByRole(papel, { name: nome }).first().boundingBox())!;
  return [
    await caixa(/^Hoje$/, 'heading'), await caixa(/^Dieta,/, 'link'), await caixa('Água de hoje', 'heading'),
    await caixa('Suas pendências', 'heading'), await caixa('Sua semana', 'heading'),
  ];
}

test('com dieta e água, anamnese e atualização atrasada: a ordem é Hoje → Dieta → Água → pendências → Sua semana', async ({ page }) => {
  const { errosDaPagina } = await abrirInicio(page, {
    extra: { 'GET /aluno/anamnese': { corpo: ANAMNESE_PENDENTE }, 'GET /aluno/atualizacao': { corpo: ATUALIZACAO_ATRASADA } },
  });

  // Cabeçalho: um h1 só, "Olá, <primeiro nome>." com a data de hoje por extenso.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Olá, Aluno.');
  await expect(page.getByText('Segunda-feira · 19 de outubro')).toBeVisible();

  // Dieta compacta: refeições e "Ver dieta", sem a água (ela fica só no cartão "Água de hoje").
  const dieta = page.getByRole('link', { name: /^Dieta,/ });
  await expect(dieta).toContainText('6 refeições no seu plano');
  await expect(dieta).toContainText('Ver dieta');
  await expect(dieta).not.toContainText('Água do dia');
  await expect(dieta).not.toContainText('3,0 L');

  // Hoje: rótulo, nome, contagem, o botão primário e a nota.
  await expect(page.getByRole('heading', { name: 'Hoje', level: 2, exact: true })).toBeVisible();
  await expect(page.getByText('TREINO A')).toBeVisible();
  await expect(page.getByText('5 exercícios').first()).toBeVisible();
  await expect(page.getByText('Consulte a lista antes de começar.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Ver meu treino/ })).toBeVisible();

  // Pendências: anamnese neutra e atualização atrasada (a única em vermelho), com a contagem.
  await expect(page.getByRole('heading', { name: 'Suas pendências' })).toBeVisible();
  await expect(page.getByLabel('2 pendências')).toBeVisible();
  await expect(page.getByRole('link', { name: /Anamnese inicial/ })).toContainText('Pendente');
  await expect(page.getByRole('link', { name: /Atualização do período/ })).toContainText(/Atrasada 2 dias/i);

  // As divisões saíram do resumo.
  await expect(page.getByRole('heading', { name: 'Divisões da semana' })).toHaveCount(0);

  // No PC (1280, área de 952 em diante; 26/11, `inicioLargoDoAluno`): Hoje → Dieta à esquerda e, ao lado, na coluna de apoio,
  // pendências → Água, com as pendências na altura do Hoje; a Sua semana embaixo das duas, na borda do Hoje.
  const [hoje, cartaoDieta, agua, pendencias, semana] = await ordemDoInicio(page);
  expect(hoje.y).toBeLessThan(cartaoDieta.y);
  expect(Math.abs(cartaoDieta.x - hoje.x)).toBeLessThan(2);
  expect(pendencias.x).toBeGreaterThan(hoje.x + 300);
  expect(Math.abs(pendencias.y - hoje.y)).toBeLessThan(4);
  expect(Math.abs(agua.x - pendencias.x)).toBeLessThan(24);
  expect(agua.y).toBeGreaterThan(pendencias.y);
  expect(semana.y).toBeGreaterThan(Math.max(cartaoDieta.y, agua.y));
  expect(Math.abs(semana.x - hoje.x)).toBeLessThan(24);

  await page.getByRole('link', { name: 'Treino', exact: true }).click();
  await expect(page).toHaveURL(/\/aluno\/treino$/);
  await expect(page.getByRole('heading', { name: 'Divisões da semana' })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Divisão A, Peito e tríceps, Segunda · 5 exercícios, hoje/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Divisão B, Costas e bíceps, Quarta · 4 exercícios$/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Divisão C, Pernas, Sexta · 6 exercícios$/ })).toBeVisible();

  expect(errosDaPagina).toEqual([]);
});

test('no celular (390px) o início é uma coluna só: Hoje → Dieta → Água → pendências → Sua semana', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrirInicio(page, {
    extra: { 'GET /aluno/anamnese': { corpo: ANAMNESE_PENDENTE }, 'GET /aluno/atualizacao': { corpo: ATUALIZACAO_ATRASADA } },
  });
  await expect(page.getByRole('heading', { name: 'Suas pendências' })).toBeVisible();
  const y = (await ordemDoInicio(page)).map((c) => c.y);
  expect(y).toEqual([...y].sort((a, b) => a - b));
});

test('"Ver meu treino" abre a lista do dia de hoje', async ({ page }) => {
  await abrirInicio(page);
  await page.getByRole('button', { name: /^Ver meu treino/ }).click();
  await expect(page).toHaveURL(/\/aluno\/sessao\/sa\?data=2026-10-19$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Segunda · Peito e tríceps');
});

test('N3: treino de hoje concluído: o cartão diz "Treino concluído · …" e "Ver resumo" abre o "Bom trabalho!"', async ({ page }) => {
  const VERSAO = 't0000000-0000-4000-8000-000000000002';
  await abrirInicio(page, {
    extra: {
      ...(await sessao(page, ALUNO, { retornoHabilitado: true })),
      'GET /aluno/sessoes-concluidas': {
        corpo: {
          totalConcluidos: 3,
          sessoes: [{ planoVersaoId: VERSAO, sessaoUid: 'sa', data: '2026-10-19', concluida: true, resultado: 'COMPLETA', duracaoSegundos: 3120, comentario: null }],
        } satisfies SessoesConcluidasResponse,
      },
    },
  });
  await expect(page.getByText('Treino concluído · Fiz tudo · 52 min', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Ver meu treino/ })).toHaveCount(0);
  await page.getByRole('button', { name: /^Ver resumo do treino/ }).click();
  await expect(page).toHaveURL(/\/aluno\/sessao\/sa\/concluido\?data=2026-10-19$/);
  await expect(page.getByRole('heading', { name: 'Bom trabalho!' })).toBeVisible();
});

test('a divisão de outro dia abre a próxima vez dela e a tela do dia deixa escolher outra data', async ({ page }) => {
  await abrirInicio(page);
  await page.getByRole('link', { name: 'Treino', exact: true }).click();
  await page.getByRole('link', { name: /^Divisão B,/ }).click();
  await expect(page).toHaveURL(/\/aluno\/sessao\/sb\?data=2026-10-21$/);
  await expect(page.getByRole('heading', { name: 'Outras datas' })).toBeVisible();
  await page.getByRole('button', { name: /Quarta · Costas e bíceps, 14\/10/ }).click();
  await expect(page).toHaveURL(/\/aluno\/sessao\/sb\?data=2026-10-14$/);
  await expect(page.getByText('Você está registrando o treino de')).toBeVisible();
});

test('no celular (390 px) o botão "Ver meu treino" aparece na primeira tela, com a dieta numa linha só', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrirInicio(page);
  const botao = page.getByRole('button', { name: /^Ver meu treino/ });
  await expect(botao).toBeVisible();
  const caixa = await botao.boundingBox();
  expect(caixa!.y + caixa!.height).toBeLessThanOrEqual(844 - 64);
  // Cartão da dieta numa linha só (ícone, "Dieta · Ver dieta →" e as refeições, sem a água): baixo, sem quebrar.
  const cartaoDieta = page.getByRole('link', { name: /^Dieta,/ });
  const dieta = await cartaoDieta.boundingBox();
  expect(dieta!.height).toBeLessThanOrEqual(76);
  const ver = await cartaoDieta.getByText('Ver dieta →').boundingBox();
  const nome = await cartaoDieta.getByText('Dieta', { exact: true }).boundingBox();
  expect(Math.abs((ver!.y + ver!.height / 2) - (nome!.y + nome!.height / 2))).toBeLessThan(6);
  await expect(cartaoDieta).not.toContainText('Água do dia');
  // Alvos de toque de 44 px.
  expect(caixa!.height).toBeGreaterThanOrEqual(44);
  for (const nome of ['Início', 'Treino', 'Dieta', 'Histórico', 'Conta']) {
    const aba = await page.getByRole('link', { name: nome, exact: true }).boundingBox();
    expect(aba, nome).not.toBeNull();
    expect(aba!.x).toBeGreaterThanOrEqual(0);
    expect(aba!.x + aba!.width).toBeLessThanOrEqual(390);
    expect(aba!.y + aba!.height).toBeLessThanOrEqual(844);
  }
});

test('sem água na dieta, o cartão da dieta continua igual (a água nunca aparece nele)', async ({ page }) => {
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
  await expect(page.getByRole('heading', { name: 'Divisões da semana' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Treino', exact: true }).click();
  await expect(page.getByRole('link', { name: /^Divisão A, Costas e bíceps, Quarta · 4 exercícios$/ })).toBeVisible();
});

for (const [largura, tema] of [[390, 'CLARO'], [1280, 'CLARO'], [390, 'ESCURO'], [1280, 'ESCURO']] as const) {
  test(`dia de descanso: "Próximo treino" com o dia e a divisão, e "Treinar mesmo assim" abre a aba Treino (${largura}px, ${tema.toLowerCase()})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 844 });
    await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [ALUNO.id, tema] as const);
    // Segunda sem treino: o próximo é o de quarta (o de sexta vem depois).
    await abrirInicio(page, { sessoes: [sessaoFalsa('sc', 'Pernas', 5, 6), sessaoFalsa('sb', 'Costas e bíceps', 3, 4)] });
    await expect(page.getByText('Hoje é dia de descanso.')).toBeVisible();
    await expect(page.getByText('Próximo treino: Quarta · Costas e bíceps', { exact: true })).toBeVisible();
    const link = page.getByRole('link', { name: 'Treinar mesmo assim', exact: true });
    await expect(link).toBeVisible();
    const caixa = await link.boundingBox();
    expect(caixa!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`descanso-${largura}-${tema.toLowerCase()}.png`) });
    await link.click();
    await expect(page).toHaveURL(/\/aluno\/treino$/);
    await expect(page.getByRole('link', { name: /^Divisão A, Costas e bíceps, Quarta · 4 exercícios$/ })).toBeVisible();
  });
}

test('dia de descanso com o próximo treino só na semana que vem: a linha vira a semana (sábado → segunda)', async ({ page }) => {
  // Sábado, 24/10: depois dele só a segunda tem treino.
  await page.clock.setFixedTime(new Date('2026-10-24T12:00:00-03:00'));
  await simularApi(page, {
    ...(await sessaoDeAlunoComTreino(page, [sessaoFalsa('sa', 'Peito e tríceps', 1, 5)])),
    'GET /aluno/dieta': { corpo: dietaFalsa(6, 3) },
    'GET /aluno/atualizacao': erroApi(404, 'Nenhuma atualização.', 'NAO_ENCONTRADO'),
  });
  await page.goto('/aluno');
  await expect(page.getByText('Hoje é dia de descanso.')).toBeVisible();
  await expect(page.getByText('Próximo treino: Segunda · Peito e tríceps', { exact: true })).toBeVisible();
});

for (const largura of [390, 1280]) {
  test(`sessão do dia: "Começar treino" logo abaixo do cartão de hoje, antes de "Outras datas", sem rolar (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 844 });
    await abrirInicio(page);
    await page.goto('/aluno/sessao/sa?data=2026-10-19');
    const comecar = page.getByRole('button', { name: 'Começar treino', exact: true });
    await expect(comecar).toBeVisible();
    const caixa = (await comecar.boundingBox())!;
    // Sem rolar: o botão inteiro acima da barra inferior do aluno (no celular) ou da borda da janela (menu lateral, desde 768 px).
    const barra = (await page.getByRole('link', { name: 'Início', exact: true }).boundingBox())!;
    expect(caixa.y + caixa.height).toBeLessThanOrEqual(largura < 768 ? barra.y : 844);
    expect(caixa.y).toBeLessThan(await topo(page, 'Outras datas'));
    await page.screenshot({ path: test.info().outputPath(`sessao-comecar-${largura}.png`) });
  });
}

test('plano sem dia fixo: "Qual é o treino de hoje?" e "Escolher treino" abre a aba Treino', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await abrirInicio(page, { sessoes: [sessaoFalsa('sa', 'Corpo todo 1', null, 5), sessaoFalsa('sb', 'Corpo todo 2', null, 4)] });
  await expect(page.getByText('Qual é o treino de hoje?')).toBeVisible();
  await expect(page.getByText('TREINO A')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ver meu treino' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Divisões da semana' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Escolher treino' }).click();
  await expect(page).toHaveURL(/\/aluno\/treino$/);
  await expect(page.getByRole('heading', { name: 'Divisões da semana' })).toBeInViewport();
  await expect(page.getByRole('link', { name: /^Divisão A, Corpo todo 1, Sem dia fixo · 5 exercícios$/ })).toBeVisible();
  await page.getByRole('link', { name: /^Divisão B,/ }).click();
  await expect(page).toHaveURL(/\/aluno\/sessao\/sb\?data=2026-10-19$/);
});

test('treino ainda não publicado: "Seu treino está sendo preparado" (não é erro)', async ({ page }) => {
  await abrirInicio(page, { sessoes: null });
  await expect(page.getByText('Seu treino está sendo preparado')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('sem pendências o bloco "Suas pendências" some', async ({ page }) => {
  await abrirInicio(page);
  await expect(page.getByRole('heading', { name: 'Hoje', level: 2, exact: true })).toBeVisible();
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

test('a barra tem Início, Treino, Dieta, Histórico e Conta', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await abrirInicio(page);
  for (const nome of ['Início', 'Treino', 'Dieta', 'Histórico', 'Conta']) {
    const aba = page.getByRole('link', { name: nome, exact: true });
    await expect(aba).toBeVisible();
    const caixa = await aba.boundingBox();
    expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(1280);
  }
  await expect(page.getByRole('link', { name: 'Mobilidade', exact: true })).toHaveCount(0);
});

test('M1–M4: mapa de treinos abaixo de "Sua semana", com título, legenda escrita e o dia tocado na linha de baixo', async ({ page }) => {
  const VERSAO = 't0000000-0000-4000-8000-000000000002';
  const conclusao = (data: string, resultado: 'COMPLETA' | 'PARCIAL', sessaoNome: string) =>
    ({ planoVersaoId: VERSAO, sessaoUid: 'sa', sessaoNome, data, concluida: true, resultado, duracaoSegundos: 3000, comentario: null });
  const { errosDaPagina } = await abrirInicio(page, {
    extra: {
      ...(await sessao(page, ALUNO, { retornoHabilitado: true })),
      'GET /aluno/sessoes-concluidas': {
        corpo: {
          totalConcluidos: 2,
          sessoes: [conclusao('2026-10-14', 'PARCIAL', 'Treino fictício B'), conclusao('2026-10-19', 'COMPLETA', 'Treino fictício A')],
        } satisfies SessoesConcluidasResponse,
      },
    },
  });

  const titulo = page.getByRole('heading', { name: '2 dias de treino no último ano' });
  await expect(titulo).toBeVisible();
  expect(await topo(page, 'Sua semana')).toBeLessThan(await topo(page, '2 dias de treino no último ano'));
  for (const legenda of ['Sem treino', 'Fiz em parte', 'Fiz tudo']) await expect(page.getByText(legenda, { exact: true }).first()).toBeVisible();

  // Tocar no dia mostra o texto dele na linha fixa abaixo da grade; dia futuro não é botão.
  await page.getByRole('button', { name: '14 de outubro: Treino fictício B, fiz em parte', exact: true }).click();
  await expect(page.getByText('14 de outubro: Treino fictício B, fiz em parte', { exact: true }).last()).toBeVisible();
  await expect(page.getByRole('button', { name: /ainda não chegou/ })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('mapa de treinos vazio: grade com a frase', async ({ page }) => {
  await abrirInicio(page, {
    extra: {
      ...(await sessao(page, ALUNO, { retornoHabilitado: true })),
      'GET /aluno/sessoes-concluidas': { corpo: { totalConcluidos: 0, sessoes: [] } satisfies SessoesConcluidasResponse },
    },
  });
  await expect(page.getByRole('heading', { name: 'Seu ano de treinos' })).toBeVisible();
  await expect(page.getByText('Seus treinos concluídos aparecem aqui, um quadrado por dia.')).toBeVisible();
});

test('sem o retorno ligado o mapa de treinos não aparece', async ({ page }) => {
  await abrirInicio(page);
  await expect(page.getByRole('heading', { name: 'Sua semana' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /dias? de treino no último ano|Seu ano de treinos/ })).toHaveCount(0);
});

// Texto grande (Ajustes › Aparência): nenhum rótulo da barra inferior corta. Padrão = uma linha como sempre; Grande e Extra
// deixam o item crescer com a palavra e o rótulo quebrar em até duas linhas, sem reticências e com alvo de toque de 44 px.
for (const tema of ['CONSULTORIA', 'AREIA'] as const) {
  for (const [texto, fator] of [['PADRAO', 1], ['GRANDE', 1.25], ['EXTRA', 1.4]] as const) {
    test(`barra inferior do aluno (390px, texto ${texto.toLowerCase()}, ${tema.toLowerCase()}): nenhum rótulo corta`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript(([id, t, x]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t, tamanhoTexto: x })), [ALUNO.id, tema, texto] as const);
      await abrirInicio(page);
      await expect(page.getByRole('link', { name: 'Histórico', exact: true })).toBeVisible();
      const itens = await page.getByRole('menubar').locator('a').evaluateAll((links) => links.map((a) => {
        const rotulo = [...a.querySelectorAll('*')].filter((e) => e.children.length === 0 && (e.textContent ?? '').trim() !== '').pop() as HTMLElement;
        const estilo = getComputedStyle(rotulo);
        return {
          nome: rotulo.textContent!.trim(),
          largura: a.getBoundingClientRect().width,
          altura: a.getBoundingClientRect().height,
          cortaNaLargura: rotulo.scrollWidth > rotulo.clientWidth,
          cortaNaAltura: rotulo.scrollHeight > rotulo.clientHeight,
          linhas: Math.round(rotulo.clientHeight / parseFloat(estilo.lineHeight)),
          reticencias: estilo.textOverflow === 'ellipsis' && rotulo.scrollWidth > rotulo.clientWidth,
        };
      }));
      expect(itens.map((i) => i.nome)).toContain('Histórico');
      for (const i of itens) {
        expect(i.cortaNaLargura, `${i.nome} corta na largura`).toBe(false);
        expect(i.cortaNaAltura, `${i.nome} corta na altura`).toBe(false);
        expect(i.reticencias, `${i.nome} com reticências`).toBe(false);
        expect(i.altura, `${i.nome}: alvo de toque`).toBeGreaterThanOrEqual(44);
        expect(i.linhas, `${i.nome}: linhas`).toBeLessThanOrEqual(fator === 1 ? 1 : 2);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const ultimo = (await page.getByRole('link', { name: 'Conta', exact: true }).boundingBox())!;
      expect(ultimo.x + ultimo.width).toBeLessThanOrEqual(390.5);
      await page.screenshot({ path: test.info().outputPath(`${texto.toLowerCase()}-${tema.toLowerCase()}-390.png`) });
    });
  }
}
