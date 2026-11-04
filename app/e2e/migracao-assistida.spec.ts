import { expect, test, type Page } from '@playwright/test';

import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Migração assistida, fase 1: "Conferir o arquivo antes de importar" na Planilha completa. Só aparece com a chave ligada
 * (`migracaoAssistidaHabilitada` do `GET /eu`) e a quem tem `ALUNO_ALTERAR`; mostra o diagnóstico em texto simples ("Aba 1",
 * nunca o nome da aba) e não grava nada. A importação de uma aba não tem o botão. API falsa e arquivo fictício gerado aqui.
 */
const CSV = 'Aluno;E-mail;Apelido\nAluno Teste 1;aluno.teste.1@exemplo.com;Apelido Teste\n';
const DIAGNOSTICO = {
  tipo: 'CADASTRO_DE_ALUNOS', linhas: 3,
  problemas: [{ codigo: 'EMAIL_INVALIDO', quantidade: 1 }, { codigo: 'COLUNA_NAO_RECONHECIDA', quantidade: 1 }],
  abas: [{
    indice: 0, tipo: 'ALUNOS', linhas: 3, linhasVazias: 0, linhasSemNome: 0, emailsInvalidos: 1, emailsDuplicados: 0,
    datasInvalidas: 0, celulasComErro: 0,
    colunas: [
      { letra: 'A', nome: 'Aluno', campo: 'ALUNO' },
      { letra: 'B', nome: 'E-mail', campo: 'EMAIL' },
      { letra: 'C', nome: null, campo: null },
    ],
    problemas: [{ codigo: 'EMAIL_INVALIDO', quantidade: 1 }, { codigo: 'COLUNA_NAO_RECONHECIDA', quantidade: 1 }],
  }],
};
const ARQUIVO = { name: 'alunos.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) };

async function preparar(page: Page, opcoes: { habilitada: boolean; permissoes?: string[]; falha?: boolean }) {
  await page.setViewportSize({ width: 1280, height: 900 });
  const pedidos = { diagnostico: 0 };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: opcoes.permissoes ?? PERMISSOES_TREINADOR, migracaoAssistidaHabilitada: opcoes.habilitada })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /importacoes': { corpo: { itens: [], total: 0, pagina: 0 } },
    'POST /importacoes/diagnostico': (_pedido, route) => {
      pedidos.diagnostico += 1;
      return opcoes.falha
        ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ status: 503, message: 'Indisponível.', codigo: 'MIGRACAO_INDISPONIVEL', fieldErrors: [] }) })
        : json(route, DIAGNOSTICO);
    },
  });
  return { ...api, pedidos };
}

const BOTAO = 'Conferir o arquivo antes de importar';

test.describe('Conferir o arquivo antes de importar', () => {
  test('com a chave ligada mostra o diagnóstico, anuncia, põe o foco nele e não grava nada', async ({ page }) => {
    const { naoTratadas, errosDaPagina, pedidos } = await preparar(page, { habilitada: true });
    await page.goto('/treinador/importacao/planilha-completa');
    const botao = page.getByRole('button', { name: BOTAO });
    await expect(botao).toBeVisible();
    await expect(botao).toBeDisabled();

    await page.getByLabel('Arquivo da planilha').setInputFiles(ARQUIVO);
    await expect(botao).toBeEnabled();
    await botao.click();

    const resultado = page.getByTestId('diagnostico-do-arquivo');
    await expect(resultado).toBeVisible();
    await expect(resultado.getByText('Cadastro de alunos')).toBeVisible();
    await expect(resultado.getByText('Aba 1 · Alunos')).toBeVisible();
    await expect(resultado.getByText('1 e-mail inválido.').first()).toBeVisible();
    await expect(resultado.getByText(/Colunas que ficam de fora: Coluna C/)).toBeVisible();
    // O veredito fica numa região viva e o foco vai para o começo do resultado.
    await expect(page.locator('[aria-live="polite"]').filter({ hasText: 'Dá para importar, mas há pontos para corrigir' }).first()).toBeVisible();
    await expect(resultado.locator(':focus')).toHaveCount(1);
    expect(pedidos.diagnostico).toBe(1);

    // Trocar o arquivo esconde o diagnóstico do anterior.
    await page.getByLabel('Arquivo da planilha').setInputFiles({ ...ARQUIVO, name: 'outro.csv' });
    await expect(resultado).toBeHidden();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test('o erro some quando o arquivo muda', async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await preparar(page, { habilitada: true, falha: true });
    await page.goto('/treinador/importacao/planilha-completa');
    await page.getByLabel('Arquivo da planilha').setInputFiles(ARQUIVO);
    await page.getByRole('button', { name: BOTAO }).click();
    const erro = page.getByText('Indisponível.');
    await expect(erro).toBeVisible();
    await page.getByLabel('Arquivo da planilha').setInputFiles({ ...ARQUIVO, name: 'outro.csv' });
    await expect(erro).toBeHidden();
    expect(errosDaPagina).toEqual([]);
    expect(naoTratadas).toEqual([]);
  });

  test('com a chave desligada não aparece nada', async ({ page }) => {
    const { naoTratadas, errosDaPagina, pedidos } = await preparar(page, { habilitada: false });
    await page.goto('/treinador/importacao/planilha-completa');
    await page.getByLabel('Arquivo da planilha').setInputFiles(ARQUIVO);
    await expect(page.getByRole('button', { name: BOTAO })).toHaveCount(0);
    expect(pedidos.diagnostico).toBe(0);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test('sem ALUNO_ALTERAR a tela da planilha completa nem abre (e o botão tem a mesma guarda)', async ({ page }) => {
    const { errosDaPagina, pedidos } = await preparar(page, {
      habilitada: true, permissoes: PERMISSOES_TREINADOR.filter((p) => p !== 'ALUNO_ALTERAR'),
    });
    await page.goto('/treinador/importacao/planilha-completa');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByLabel('Arquivo da planilha')).toHaveCount(0);
    await expect(page.getByRole('button', { name: BOTAO })).toHaveCount(0);
    expect(pedidos.diagnostico).toBe(0);
    expect(errosDaPagina).toEqual([]);
  });

  test('a importação de uma aba não tem o botão', async ({ page }) => {
    const { errosDaPagina } = await preparar(page, { habilitada: true });
    await page.goto('/treinador/importacao/nova');
    await page.getByLabel('Arquivo da planilha').setInputFiles(ARQUIVO);
    await expect(page.getByRole('button', { name: BOTAO })).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
});
