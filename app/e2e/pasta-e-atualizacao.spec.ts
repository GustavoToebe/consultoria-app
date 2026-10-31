import { expect, test, type Page } from '@playwright/test';

import type { AlunoDetalhe, Atualizacao, ConteudoDieta, PastaResumo, PlanoDetalhe, RegistroPeso } from '../src/api/tipos';
import { ALUNO, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Reunião de 30/10 (Análise 4): caminho do treinador mais claro na renovação do ciclo.
 * - Finalizar a pasta mostra o peso que a atualização já gravou, nunca o copia para o campo e avisa quando um peso novo
 *   na mesma data vai substituí-lo.
 * - "Voltar à pasta" nos editores do plano do aluno leva à ficha com a Folha da pasta aberta, passa pela guarda de saída
 *   e funciona com o editor aberto direto pela URL.
 * - A atualização ao lado do editor é um `<a href>` que abre sempre em outra aba.
 * Dados fictícios.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const PASTA_ID = 'f0000000-0000-4000-8000-000000000017';
const PLANO_ID = 'd0000000-0000-4000-8000-000000000001';
const ATUALIZACAO_ID = 'e0000000-0000-4000-8000-000000000005';

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: 15, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

const PASTAS: PastaResumo[] = [
  { id: PASTA_ID, alunoId: ALUNO_ID, titulo: 'Plano 17', inicio: '2026-10-06', fim: '2026-10-20', concluidaEm: null },
];
const PASTA_RENOVADA: PastaResumo = {
  id: 'f0000000-0000-4000-8000-000000000018', alunoId: ALUNO_ID, titulo: 'Plano 18', inicio: '2026-10-21', fim: '2026-11-04', concluidaEm: null,
};

// Enviada na data dela (20/10): a API gravou o peso respondido nesse dia.
const ATUALIZACAO: Atualizacao = {
  id: ATUALIZACAO_ID, pastaId: PASTA_ID, alunoId: ALUNO_ID, nomeAluno: ALUNO.nome, dataAtualizacao: '2026-10-20',
  fase: 'ENVIADA', diasParaData: -11, diasDeAtraso: 0, atrasoAte: null, atrasoMotivo: null,
  questionarioVersaoNumero: 1, questionarioVersaoId: 'q0000000-0000-4000-8000-000000000001', questionarioNome: 'Padrão',
  modelo: null, respostas: null, enviadaEm: '2026-10-20T12:00:00Z', feedback: null, versao: 1, resumo: null,
};

const PESOS: RegistroPeso[] = [
  { id: 'r1', data: '2026-10-06', pesoKg: 83.1, variacao: null, observacao: null },
  { id: 'r2', data: '2026-10-20', pesoKg: 82.4, variacao: -0.7, observacao: null },
];

const CONTEUDO: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, suplementacao: [], ergogenicos: null,
  aguaLitros: null, refeicoes: [],
};

const DIETA: PlanoDetalhe<ConteudoDieta> = {
  plano: {
    id: PLANO_ID, alunoId: ALUNO_ID, pastaId: PASTA_ID, titulo: 'Dieta do Plano 17', inicio: '2026-10-06', fim: '2026-10-20', ativo: false,
    versaoPublicada: 0, publicadoEm: null, rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho: CONTEUDO,
  versoes: [],
};

/** A ficha, a Folha da pasta e o editor de dieta da pasta, com a atualização enviada e o peso dela. */
async function abrir(page: Page, permissoesExtras: string[], extras: RespostasApi = {}) {
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'PASTA_ALTERAR', 'DIETA_LER', 'DIETA_ALTERAR', ...permissoesExtras] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /alunos': { corpo: { itens: [], total: 0 } },
    'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
    'GET /alimentos': { corpo: [] },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: PASTAS },
    [`GET /alunos/${ALUNO_ID}/atualizacao`]: { corpo: ATUALIZACAO },
    [`GET /alunos/${ALUNO_ID}/atualizacoes`]: { corpo: [ATUALIZACAO] },
    [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: PESOS },
    [`GET /planos-dieta/${PLANO_ID}`]: { corpo: DIETA },
    [`POST /pastas/${PASTA_ID}/finalizar`]: { corpo: { ...PASTAS[0], concluidaEm: '2026-10-31T12:00:00Z' } },
    ...extras,
  });
}

const LINHA_DO_PESO = /Peso da atualização já registrado: 82,4 kg em 20\/10/;

for (const largura of [390, 1280]) {
  test(`finalizar: mostra o peso da atualização, o campo começa vazio e avisa da substituição (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina } = await abrir(page, ['ATUALIZACAO_LER']);
    await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);

    const pasta = page.getByRole('dialog', { name: 'Plano 17' });
    // A ordem sugerida fica recolhida: o botão principal continua o de antes.
    await expect(pasta.getByRole('button', { name: /Ordem sugerida para renovar o ciclo, recolhido/ })).toBeVisible();
    await expect(pasta.getByText('Finalizar não publica nada.')).toHaveCount(0);
    await pasta.getByRole('button', { name: /Ordem sugerida para renovar o ciclo/ }).click();
    await expect(pasta.getByText('Finalizar a pasta anterior.')).toBeVisible();
    await expect(pasta.getByText('Finalizar não publica nada.')).toBeVisible();
    await expect(pasta.getByText('Publicar não abre um ciclo novo: para um novo período, renove a pasta.')).toBeVisible();

    await pasta.getByRole('button', { name: 'Finalizar pasta' }).click();
    const folha = page.getByRole('dialog', { name: 'Finalizar “Plano 17”' });
    await expect(folha.getByText(LINHA_DO_PESO)).toBeVisible();
    // Nunca pré-preenchido com o peso antigo.
    const peso = folha.getByRole('textbox', { name: 'Peso (opcional)' });
    await expect(peso).toHaveValue('');

    // Peso novo na data da atualização: avisa que substitui; em outra data, não.
    const data = folha.getByRole('textbox', { name: 'Data do peso' });
    await data.fill('20/10/2026');
    await peso.fill('81,9');
    await expect(folha.getByText('Vai substituir o peso da atualização')).toBeVisible();
    await data.fill('31/10/2026');
    await expect(folha.getByText('Vai substituir o peso da atualização')).toHaveCount(0);

    // Finalizar sem peso novo continua possível.
    await peso.fill('');
    await folha.getByRole('button', { name: 'Finalizar pasta' }).click();
    await expect(page.getByRole('dialog', { name: 'Finalizar “Plano 17”' })).toHaveCount(0);
    const post = pedidos.find((p) => p.metodo === 'POST' && p.caminho === `/pastas/${PASTA_ID}/finalizar`);
    expect(post?.corpo).toEqual({ data: null, pesoKg: null, observacao: null });
    expect(errosDaPagina).toEqual([]);
  });

  test(`finalizar: sem ATUALIZACAO_LER a linha do peso não aparece (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrir(page, []);
    await page.goto(`/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
    await page.getByRole('dialog', { name: 'Plano 17' }).getByRole('button', { name: 'Finalizar pasta' }).click();
    const folha = page.getByRole('dialog', { name: 'Finalizar “Plano 17”' });
    await expect(folha.getByRole('textbox', { name: 'Peso (opcional)' })).toHaveValue('');
    await expect(folha.getByText(LINHA_DO_PESO)).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`editor aberto direto pela URL: "Voltar à pasta" abre a ficha com a Folha da pasta (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrir(page, ['ATUALIZACAO_LER']);
    await page.goto(`/treinador/dietas/${PLANO_ID}`);

    const voltar = page.getByRole('link', { name: 'Voltar à pasta' });
    await expect(voltar).toHaveAttribute('href', `/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}`);
    await voltar.click();
    await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${ALUNO_ID}\\?pastaId=${PASTA_ID}$`));
    await expect(page.getByRole('dialog', { name: 'Plano 17' })).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });

  test(`"Voltar à pasta" com alteração pendente pergunta antes, e na ficha o menu não pergunta de novo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrir(page, ['ATUALIZACAO_LER']);
    await page.goto(`/treinador/dietas/${PLANO_ID}`);

    await page.getByLabel('Água por dia (opcional)').fill('2,5');
    await page.getByRole('link', { name: 'Voltar à pasta' }).click();
    await expect(page.getByText('Sair sem salvar?')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(`/treinador/dietas/${PLANO_ID}`);
    await page.getByRole('button', { name: 'Sair sem salvar' }).click();
    await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${ALUNO_ID}\\?pastaId=${PASTA_ID}$`));
    const pasta = page.getByRole('dialog', { name: 'Plano 17' });
    await expect(pasta).toBeVisible();

    // O editor saiu da pilha: navegar a partir da ficha não traz a pergunta de volta.
    await pasta.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(pasta).toHaveCount(0);
    await page.getByRole('link', { name: 'Alunos', exact: true }).first().click();
    await expect(page).toHaveURL(/\/treinador\/alunos$/);
    await expect(page.getByText('Sair sem salvar?')).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`pasta renovada sem atualização: mostra a última enviada, com a pasta e a data dela (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    // A dieta é da pasta renovada (Plano 18), que ainda não tem atualização; a enviada é a do Plano 17.
    const { errosDaPagina } = await abrir(page, ['ATUALIZACAO_LER'], {
      [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [...PASTAS, PASTA_RENOVADA] },
      [`GET /planos-dieta/${PLANO_ID}`]: { corpo: { ...DIETA, plano: { ...DIETA.plano, pastaId: PASTA_RENOVADA.id, titulo: 'Dieta do Plano 18' } } },
    });
    await page.goto(`/treinador/dietas/${PLANO_ID}`);

    await expect(page.getByText('Atualização de Plano 17 · 20/10/2026')).toBeVisible();
    await expect(page.getByText('A pasta deste plano ainda não tem atualização.')).toBeVisible();
    await expect(page.getByText('Sem atualização nesta pasta.')).toHaveCount(0);
    const link = page.getByRole('link', { name: /Abrir atualização de Plano 17 de 20\/10\/2026 em outra aba/ });
    await expect(link).toHaveAttribute('href', `/treinador/atualizacoes/${ATUALIZACAO_ID}`);
    // O "Voltar à pasta" continua sendo o da pasta do plano.
    await expect(page.getByRole('link', { name: 'Voltar à pasta' })).toHaveAttribute('href', `/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_RENOVADA.id}`);
    expect(errosDaPagina).toEqual([]);
  });
}

test('web: a atualização ao lado do editor é <a href> que abre em outra aba', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errosDaPagina } = await abrir(page, ['ATUALIZACAO_LER']);
  await page.goto(`/treinador/dietas/${PLANO_ID}`);

  const link = page.getByRole('link', { name: /Abrir atualização de 20\/10\/2026 em outra aba/ });
  await expect(link).toHaveAttribute('href', `/treinador/atualizacoes/${ATUALIZACAO_ID}`);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.getByText('Abrir atualização em outra aba')).toBeVisible();

  // O clique simples também abre outra aba: o editor fica onde está, com o rascunho.
  await page.getByLabel('Água por dia (opcional)').fill('2,5');
  const nova = context.waitForEvent('page');
  await link.click();
  const aba = await nova;
  await aba.waitForURL(/\/treinador\/atualizacoes\//);
  expect(new URL(aba.url()).pathname).toBe(`/treinador/atualizacoes/${ATUALIZACAO_ID}`);
  expect(new URL(page.url()).pathname).toBe(`/treinador/dietas/${PLANO_ID}`);
  await expect(page.getByText('Sair sem salvar?')).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('web: sem ATUALIZACAO_LER o editor não mostra a atualização, mas mantém o "Voltar à pasta"', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { pedidos, errosDaPagina } = await abrir(page, []);
  await page.goto(`/treinador/dietas/${PLANO_ID}`);
  await expect(page.getByRole('link', { name: 'Voltar à pasta' })).toBeVisible();
  await expect(page.getByText('Abrir atualização em outra aba')).toHaveCount(0);
  expect(pedidos.some((p) => p.caminho.endsWith('/atualizacao') || p.caminho.endsWith('/atualizacoes'))).toBe(false);
  expect(errosDaPagina).toEqual([]);
});
