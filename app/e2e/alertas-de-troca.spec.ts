import { expect, test, type Page } from '@playwright/test';

import type { AlunoDetalhe, ChaveDaTroca, PainelTreinador, TrocaDeExercicio, TrocasDeExercicio, TrocasPendentes } from '../src/api/tipos';
import { fixarHoje } from './aluno';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type Resposta } from './api-falsa';

/**
 * Alertas de troca de exercício (`docs/planos/alertas-de-troca.md`, passo 2): a pendência "Trocas para ver" no bloco
 * Treinos do Início, a Folha que leva à ficha na seção das trocas e o cartão "Trocas de exercício" da aba Acompanhamento,
 * com "Marcar como visto" e "Desfazer" (corpo = a chave da troca). Dados fictícios; relógio em segunda, 19/10/2026.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const captura = (nome: string) => (process.env.CAPTURAS ? `${process.env.CAPTURAS}/${nome}` : test.info().outputPath(nome));

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null, cpf: null,
  endereco: null, ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null,
  anonimizado: false, emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false, sexo: null,
};

const PAINEL: PainelTreinador = {
  atualizacoesParaRevisar: 0, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 0, alunosAtivos: 1,
  alunosSemRegistro: [], ultimasExecucoes: [], planosTerminando: [],
  pastasARenovar: 0, pastasParaRenovar: [], alunosSemPastaComPeriodo: 0, alunosSemRegistroTotal: 0, alunosSemAcesso: 0, alunosInativos: 0,
  sessoesConcluidas7Dias: 3,
};

const SUPINO: TrocaDeExercicio = {
  data: '2026-10-18', planoVersaoId: 'v0000000-0000-4000-8000-000000000001', sessaoUid: 'sa', sessao: 'Treino A', exercicioUid: 'ex-supino',
  principal: { exercicioId: 'e0000000-0000-4000-8000-000000000001', nome: 'Supino reto' },
  alternativa: { exercicioId: 'e0000000-0000-4000-8000-000000000002', nome: 'Supino com halteres' }, series: 3, vistoEm: null,
};
const AGACHAMENTO: TrocaDeExercicio = {
  ...SUPINO, data: '2026-10-16', sessaoUid: 'sb', sessao: 'Treino B', exercicioUid: 'ex-agacha',
  principal: { exercicioId: 'e0000000-0000-4000-8000-000000000003', nome: 'Agachamento livre' },
  alternativa: { exercicioId: 'e0000000-0000-4000-8000-000000000004', nome: 'Leg press 45°' }, series: 4, vistoEm: '2026-10-17T13:00:00Z',
};
const CHAVE_SUPINO: ChaveDaTroca = { data: SUPINO.data, planoVersaoId: SUPINO.planoVersaoId, exercicioUid: SUPINO.exercicioUid, alternativaId: SUPINO.alternativa.exercicioId };

const doAluno = (trocas: TrocaDeExercicio[]): TrocasDeExercicio => ({ de: '2026-10-13', ate: '2026-10-19', trocas });
const PENDENTES: TrocasPendentes = { de: '2026-10-13', ate: '2026-10-19', total: 1, trocas: [{ alunoId: ALUNO_ID, alunoNome: ALUNO.nome, troca: SUPINO }] };

interface Opcoes {
  permissoes?: string[];
  trocas?: Resposta;
  pendentes?: Resposta;
  put?: Resposta;
  tema?: 'CLARO' | 'AREIA' | 'ESCURO';
}

async function treinador(page: Page, o: Opcoes = {}) {
  await fixarHoje(page);
  if (o.tema) await page.addInitScript(([id, tema]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema })), [TREINADOR.id, o.tema]);
  const vistos: { metodo: string; corpo: unknown }[] = [];
  const buscas: string[] = [];
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'REGISTRO_LER', ...(o.permissoes ?? ['REGISTRO_REAGIR'])], retornoHabilitado: true })),
    'GET /painel': { corpo: PAINEL },
    'GET /recordes/semana': { corpo: { de: '2026-10-13', ate: '2026-10-19', total: 0, series: [] } },
    'GET /trocas-de-exercicio/pendentes': o.pendentes ?? ((p, route) => {
      buscas.push(p.busca.toString());
      return json(route, PENDENTES);
    }),
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/execucoes`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/agua`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/sessoes-concluidas`]: { corpo: { totalConcluidos: 0, sessoes: [] } },
    [`GET /alunos/${ALUNO_ID}/recordes/semana`]: { corpo: { de: '2026-10-13', ate: '2026-10-19', total: 0, series: [] } },
    [`GET /alunos/${ALUNO_ID}/trocas-de-exercicio`]: o.trocas ?? { corpo: doAluno([SUPINO, AGACHAMENTO]) },
    [`PUT /alunos/${ALUNO_ID}/trocas-de-exercicio/visto`]: o.put ?? ((p, route) => {
      vistos.push({ metodo: p.metodo, corpo: p.corpo });
      return json(route, { vistoEm: '2026-10-19T15:00:00Z' });
    }),
    [`DELETE /alunos/${ALUNO_ID}/trocas-de-exercicio/visto`]: (p, route) => {
      vistos.push({ metodo: p.metodo, corpo: p.corpo });
      return route.fulfill({ status: 204 });
    },
  });
  return { ...api, vistos, buscas };
}

const semRolagemLateral = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const largura of [390, 1280]) {
  test(`Início → Folha "Trocas para ver" → ficha na seção das trocas, marcar e desfazer o visto (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await treinador(page);
    await page.goto('/treinador');

    const cartao = page.getByRole('button', { name: 'Trocas de exercício para ver nos últimos 7 dias: 1. Abre a lista' });
    await expect(cartao).toBeVisible();
    // O treinador sem acesso total vê os alunos dele: a pendência é só do responsável.
    expect(api.buscas).toContain('meus=true');
    expect(await semRolagemLateral(page)).toBe(true);
    await page.screenshot({ path: captura(`inicio-trocas-${largura}.png`), fullPage: true });

    await cartao.click();
    const folha = page.getByRole('dialog', { name: 'Trocas para ver' });
    await expect(folha.getByText('1 troca.')).toBeVisible();
    await page.screenshot({ path: captura(`folha-trocas-${largura}.png`) });
    await folha.getByRole('link', { name: /^Aluno Teste, Supino reto trocado por Supino com halteres, Treino A · ontem · 3 séries/ }).click();

    // A ficha abre na Acompanhamento e o `secao` sai do endereço depois de levar até o cartão.
    await expect(page.getByRole('heading', { name: 'Trocas de exercício' })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${ALUNO_ID}\\?aba=acompanhamento$`));
    await expect(page.getByText('Últimos 7 dias · 1 para ver')).toBeVisible();
    await expect(page.getByText('Para ver', { exact: true })).toBeVisible();
    await expect(page.getByText('Agachamento livre trocado por Leg press 45°')).toBeVisible();
    await expect(page.getByText('Treino B · 16/10 · 4 séries').or(page.getByText(/Treino B · .* · 4 séries/))).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Trocas de exercício' })).toBeInViewport();
    await page.screenshot({ path: captura(`ficha-trocas-${largura}.png`), fullPage: true });

    await page.getByRole('button', { name: 'Marcar como visto: Supino reto trocado por Supino com halteres, ontem' }).click();
    const desfazer = page.getByRole('button', { name: 'Desfazer o visto: Supino reto trocado por Supino com halteres, ontem' });
    await expect(desfazer).toBeVisible();
    await expect(page.getByText('Últimos 7 dias · todas vistas')).toBeVisible();
    await desfazer.click();
    await expect(page.getByRole('button', { name: 'Marcar como visto: Supino reto trocado por Supino com halteres, ontem' })).toBeVisible();
    // DELETE com corpo: o cliente manda a mesma chave nos dois.
    expect(api.vistos).toEqual([{ metodo: 'PUT', corpo: CHAVE_SUPINO }, { metodo: 'DELETE', corpo: CHAVE_SUPINO }]);
    expect(await semRolagemLateral(page)).toBe(true);
    expect(api.errosDaPagina).toEqual([]);
  });

  test(`temas areia e escuro: Início e cartão da ficha (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    for (const tema of ['AREIA', 'ESCURO'] as const) {
      const api = await treinador(page, { tema });
      await page.goto('/treinador');
      await expect(page.getByRole('button', { name: /^Trocas de exercício para ver nos últimos 7 dias: 1/ })).toBeVisible();
      await page.screenshot({ path: captura(`inicio-trocas-${tema.toLowerCase()}-${largura}.png`), fullPage: true });
      await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=acompanhamento&secao=trocas`);
      await expect(page.getByRole('heading', { name: 'Trocas de exercício' })).toBeInViewport();
      await page.screenshot({ path: captura(`ficha-trocas-${tema.toLowerCase()}-${largura}.png`) });
      expect(api.errosDaPagina).toEqual([]);
    }
  });
}

test('a API recusa o visto: aviso com o motivo e a troca continua "Para ver"', async ({ page }) => {
  const api = await treinador(page, { put: erroApi(404, 'Essa troca não existe mais.', 'NAO_ENCONTRADO') });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=acompanhamento`);
  await page.getByRole('button', { name: /^Marcar como visto: Supino reto/ }).click();
  await expect(page.getByText('Essa troca não existe mais.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Marcar como visto: Supino reto/ })).toBeVisible();
  await expect(page.getByText('Para ver', { exact: true })).toBeVisible();
  expect(api.errosDaPagina).toEqual([]);
});

test('sem troca em 7 dias: a ficha não tem o cartão e o Início mostra zero', async ({ page }) => {
  const api = await treinador(page, { trocas: { corpo: doAluno([]) }, pendentes: { corpo: { ...PENDENTES, total: 0, trocas: [] } } });
  await page.goto('/treinador');
  await expect(page.getByRole('button', { name: /^Trocas de exercício para ver nos últimos 7 dias: 0/ })).toBeVisible();
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=acompanhamento&secao=trocas`);
  await expect(page.getByRole('heading', { name: 'Treinos concluídos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trocas de exercício' })).toHaveCount(0);
  // O `secao` sai do endereço mesmo sem o cartão.
  await expect(page).toHaveURL(new RegExp(`\\?aba=acompanhamento$`));
  expect(api.errosDaPagina).toEqual([]);
});

test('falha ao carregar: "Tentar de novo" busca outra vez', async ({ page }) => {
  let vezes = 0;
  const api = await treinador(page, {
    trocas: (_p, route) => (++vezes === 1
      ? json(route, { status: 500, message: 'Erro interno.', codigo: 'ERRO_INTERNO', fieldErrors: [] }, 500)
      : json(route, doAluno([SUPINO]))),
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=acompanhamento`);
  await expect(page.getByRole('heading', { name: 'Trocas de exercício' })).toBeVisible();
  const tentar = page.getByRole('button', { name: 'Tentar de novo' });
  await expect(tentar).toBeVisible();
  await tentar.scrollIntoViewIfNeeded();
  await page.screenshot({ path: captura('ficha-trocas-erro-390.png') });
  await tentar.click();
  await expect(page.getByText('Supino reto trocado por Supino com halteres')).toBeVisible();
  expect(api.errosDaPagina).toEqual([]);
});

test('403 nas trocas esconde o cartão, sem mensagem de erro', async ({ page }) => {
  const api = await treinador(page, { trocas: erroApi(403, 'Sem permissão.', 'PERMISSAO_NEGADA') });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=acompanhamento`);
  await expect(page.getByRole('heading', { name: 'Treinos concluídos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trocas de exercício' })).toHaveCount(0);
  await expect(page.getByText('Sem permissão.')).toHaveCount(0);
  expect(api.errosDaPagina).toEqual([]);
});

test('sem REGISTRO_REAGIR: só leitura, "Não vista" neutro e sem botões', async ({ page }) => {
  const api = await treinador(page, { permissoes: [] });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=acompanhamento`);
  await expect(page.getByText('Últimos 7 dias · 1 não vista')).toBeVisible();
  await expect(page.getByText('Não vista', { exact: true })).toBeVisible();
  await expect(page.getByText('Visto', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Marcar como visto|Desfazer o visto/ })).toHaveCount(0);
  await page.screenshot({ path: captura('ficha-trocas-leitura-1280.png'), fullPage: true });
  expect(api.errosDaPagina).toEqual([]);
});

test('Próximo passo: "Ver trocas" abre a mesma Folha', async ({ page }) => {
  const api = await treinador(page);
  await page.goto('/treinador');
  await expect(page.getByText('1 troca de exercício para ver nos últimos 7 dias.')).toBeVisible();
  await page.getByRole('button', { name: 'Ver trocas' }).click();
  await expect(page.getByRole('dialog', { name: 'Trocas para ver' })).toBeVisible();
  expect(api.errosDaPagina).toEqual([]);
});
