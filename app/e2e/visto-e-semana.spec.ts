import { expect, test, type Page } from '@playwright/test';

import type { AlunoDetalhe, PainelTreinador, RecordesDaSemana, SessoesConcluidasResponse } from '../src/api/tipos';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Engajamento 0.5 e 0.6: o "Visto" do treinador nos treinos concluídos (ficha), os "Recordes da semana" (Início e
 * ficha), o "Visto pelo treinador" que o aluno vê e o "Semana completa" no Início do aluno. Dados fictícios; relógio em
 * segunda, 19/10/2026.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const VERSAO = 't0000000-0000-4000-8000-000000000002';
const CONCLUIDA = 'c0000000-0000-4000-8000-000000000001';

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null, cpf: null,
  endereco: null, ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null,
  anonimizado: false, emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false, sexo: null,
};

const RECORDES: RecordesDaSemana = {
  de: '2026-10-13',
  ate: '2026-10-19',
  total: 1,
  series: [{
    alunoId: ALUNO_ID, alunoNome: ALUNO.nome, data: '2026-10-18', exercicioId: 'x1', exercicioNome: 'Supino de teste',
    recordes: [{ tipo: 'MAIOR_CARGA', carga: 70, repeticoes: 8, valor: 70 }],
  }],
};

const CONCLUSOES = (vistoEm: string | null): SessoesConcluidasResponse => ({
  totalConcluidos: 12,
  sessoes: [
    { id: CONCLUIDA, planoVersaoId: VERSAO, sessaoUid: 'sx', sessaoNome: 'Treino curto', data: '2026-10-18', concluida: true,
      resultado: 'COMPLETA', duracaoSegundos: 3120, comentario: 'Comentário fictício do aluno.', vistoEm },
    { id: 'c0000000-0000-4000-8000-000000000002', planoVersaoId: VERSAO, sessaoUid: 'sx', sessaoNome: 'Treino curto', data: '2026-10-17',
      concluida: false, resultado: null, duracaoSegundos: null, comentario: null, vistoEm: null },
  ],
});

const PAINEL: PainelTreinador = {
  atualizacoesParaRevisar: 0, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 0, alunosAtivos: 1,
  alunosSemRegistro: [], ultimasExecucoes: [], planosTerminando: [],
  pastasARenovar: 0, pastasParaRenovar: [], alunosSemPastaComPeriodo: 0, alunosSemRegistroTotal: 0, alunosSemAcesso: 0,
  sessoesConcluidas7Dias: 0,
};

async function treinador(page: Page, permissoes: string[], vistoEm: string | null = null) {
  await fixarHoje(page);
  const vistos: { metodo: string; caminho: string }[] = [];
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'REGISTRO_LER', ...permissoes], retornoHabilitado: true })),
    'GET /painel': { corpo: PAINEL },
    'GET /recordes/semana': { corpo: RECORDES },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/execucoes`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/sessoes-concluidas`]: { corpo: CONCLUSOES(vistoEm) },
    [`GET /alunos/${ALUNO_ID}/recordes/semana`]: { corpo: RECORDES },
    [`PUT /alunos/${ALUNO_ID}/sessoes-concluidas/${CONCLUIDA}/visto`]: (p, route) => {
      vistos.push({ metodo: p.metodo, caminho: p.caminho });
      return json(route, { vistoEm: '2026-10-19T15:00:00Z' });
    },
    [`DELETE /alunos/${ALUNO_ID}/sessoes-concluidas/${CONCLUIDA}/visto`]: (p, route) => {
      vistos.push({ metodo: p.metodo, caminho: p.caminho });
      return route.fulfill({ status: 204 });
    },
  });
  return { ...api, vistos };
}

for (const largura of [390, 1280]) {
  test(`ficha: treinos concluídos com "Marcar como visto", desfazer, e os recordes da semana (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await treinador(page, ['REGISTRO_REAGIR']);
    await page.goto(`/treinador/alunos/${ALUNO_ID}`);

    const cartao = page.getByRole('heading', { name: 'Treinos concluídos' });
    await expect(cartao).toBeVisible();
    await expect(page.getByText('Últimos 14 dias · 12 treinos concluídos no total')).toBeVisible();
    // Só o concluído aparece (o reaberto não), com o que o aluno informou.
    await expect(page.getByText('Treino curto · ontem')).toBeVisible();
    await expect(page.getByText('Fiz tudo · 52 min')).toBeVisible();
    await expect(page.getByText('Comentário fictício do aluno.')).toBeVisible();
    await expect(page.getByText(/Treino curto · 17\/10|anteontem/)).toHaveCount(0);

    await page.getByRole('button', { name: 'Marcar Treino curto · ontem como visto' }).click();
    await expect(page.getByRole('button', { name: 'Treino curto · ontem: visto. Tocar desfaz.' })).toBeVisible();
    await page.getByRole('button', { name: 'Treino curto · ontem: visto. Tocar desfaz.' }).click();
    await expect(page.getByRole('button', { name: 'Marcar Treino curto · ontem como visto' })).toBeVisible();
    expect(api.vistos.map((v) => v.metodo)).toEqual(['PUT', 'DELETE']);

    await expect(page.getByRole('heading', { name: 'Recordes da semana' })).toBeVisible();
    await expect(page.getByText('Supino de teste: Maior carga · 70 kg')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(api.errosDaPagina).toEqual([]);
  });
}

test('sem REGISTRO_REAGIR o treinador só lê: sem botão, com o selo "Visto" quando já marcado', async ({ page }) => {
  const api = await treinador(page, [], '2026-10-19T10:00:00Z');
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  await expect(page.getByText('Treino curto · ontem')).toBeVisible();
  await expect(page.getByText('Visto', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /como visto|Tocar desfaz/ })).toHaveCount(0);
  expect(api.errosDaPagina).toEqual([]);
});

test('Início do treinador: "Recordes da semana" com a linha que abre a ficha', async ({ page }) => {
  const api = await treinador(page, []);
  await page.goto('/treinador');
  await expect(page.getByRole('heading', { name: 'Recordes da semana' })).toBeVisible();
  await expect(page.getByText('1 série com recorde nos últimos 7 dias')).toBeVisible();
  await page.getByRole('link', { name: /Abrir Aluno Teste: Supino de teste: Maior carga · 70 kg/ }).click();
  await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${ALUNO_ID}$`));
  expect(api.errosDaPagina).toEqual([]);
});

async function aluno(page: Page, vistoEm: string | null) {
  await fixarHoje(page);
  const base = await sessaoDeAlunoComTreino(page, [sessaoFalsa('sx', 'Treino curto', 1, 1)]);
  return simularApi(page, {
    ...base,
    ...(await sessao(page, ALUNO, { retornoHabilitado: true })),
    'GET /aluno/dieta': { corpo: { dieta: null } },
    'GET /aluno/atualizacao': erroApi(404, 'Nenhuma atualização.', 'NAO_ENCONTRADO'),
    'GET /aluno/sessoes-concluidas': {
      corpo: {
        totalConcluidos: 1,
        sessoes: [{ id: CONCLUIDA, planoVersaoId: VERSAO, sessaoUid: 'sx', sessaoNome: 'Treino curto', data: '2026-10-19', concluida: true,
          resultado: 'COMPLETA', duracaoSegundos: 3000, comentario: null, vistoEm }],
      } satisfies SessoesConcluidasResponse,
    },
    'POST /aluno/execucoes/lote': (p, route) => {
      const lote = (p.corpo as { registros: { id: string }[] }).registros;
      return json(route, { resultados: lote.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) });
    },
  });
}

test('aluno: "Visto pelo treinador" no treino concluído e "Semana completa" no Início', async ({ page }) => {
  const api = await aluno(page, '2026-10-19T15:00:00Z');
  await page.goto('/aluno/sessao/sx?data=2026-10-19');
  await expect(page.getByText('Visto pelo treinador').first()).toBeVisible();
  // Plano com um treino só, na segunda: marcando a série de hoje, a semana fica completa.
  await page.goto('/aluno/sessao/sx/sxe1?data=2026-10-19');
  await page.getByRole('checkbox', { name: 'Série 1 feita', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Série 1 feita', exact: true })).toBeChecked();
  await page.goto('/aluno');
  await expect(page.getByLabel('Semana completa: você fez todos os treinos desta semana.')).toBeVisible();
  expect(api.errosDaPagina).toEqual([]);
});

test('aluno sem "Visto" e semana ainda por fazer: nada disso aparece', async ({ page }) => {
  const api = await aluno(page, null);
  await page.goto('/aluno/sessao/sx?data=2026-10-19');
  await expect(page.getByText('Treino concluído', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Visto pelo treinador')).toHaveCount(0);
  await page.goto('/aluno');
  await expect(page.getByRole('heading', { name: 'Sua semana' })).toBeVisible();
  await expect(page.getByText('Semana completa')).toHaveCount(0);
  expect(api.errosDaPagina).toEqual([]);
});
