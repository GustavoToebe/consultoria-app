import { expect, test, type Page } from '@playwright/test';

import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Migração assistida, fase 1: "Conferir o arquivo antes de importar" na tela de importação. Só aparece com a chave ligada
 * (`migracaoAssistidaHabilitada` do `GET /eu`), mostra o diagnóstico em texto simples e não grava nada. API falsa e arquivo
 * fictício gerado aqui, como nos outros e2e da importação.
 */
const CSV = 'Aluno;E-mail;Apelido\nAluno Teste 1;aluno.teste.1@exemplo.com;Apelido Teste\n';
const DIAGNOSTICO = {
  tipo: 'CADASTRO_DE_ALUNOS', linhas: 3,
  problemas: [{ codigo: 'EMAIL_INVALIDO', quantidade: 1 }, { codigo: 'COLUNA_NAO_RECONHECIDA', quantidade: 1 }],
  abas: [{
    indice: 0, nome: 'Alunos', tipo: 'ALUNOS', linhas: 3, linhasVazias: 0, linhasSemNome: 0, emailsInvalidos: 1, emailsDuplicados: 0,
    datasInvalidas: 0, celulasComErro: 0,
    colunas: [
      { letra: 'A', nome: 'Aluno', campo: 'ALUNO' },
      { letra: 'B', nome: 'E-mail', campo: 'EMAIL' },
      { letra: 'C', nome: 'Apelido', campo: null },
    ],
    problemas: [{ codigo: 'EMAIL_INVALIDO', quantidade: 1 }, { codigo: 'COLUNA_NAO_RECONHECIDA', quantidade: 1 }],
  }],
};

async function preparar(page: Page, habilitada: boolean) {
  await page.setViewportSize({ width: 1280, height: 900 });
  const pedidos = { diagnostico: 0, outrosPosts: [] as string[] };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR, migracaoAssistidaHabilitada: habilitada })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /importacoes': { corpo: { itens: [], total: 0, pagina: 0 } },
    'POST /importacoes/diagnostico': (_pedido, route) => {
      pedidos.diagnostico += 1;
      return json(route, DIAGNOSTICO);
    },
  });
  return { ...api, pedidos };
}

test.describe('Conferir o arquivo antes de importar', () => {
  test('com a chave ligada mostra o diagnóstico e não grava nada', async ({ page }) => {
    const { naoTratadas, errosDaPagina, pedidos } = await preparar(page, true);
    await page.goto('/treinador/importacao/nova');
    const botao = page.getByRole('button', { name: 'Conferir o arquivo antes de importar' });
    await expect(botao).toBeVisible();
    await expect(botao).toBeDisabled();

    await page.getByLabel('Arquivo da planilha').setInputFiles({ name: 'alunos.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });
    await expect(botao).toBeEnabled();
    await botao.click();

    const resultado = page.getByTestId('diagnostico-do-arquivo');
    await expect(resultado).toBeVisible();
    await expect(resultado.getByText('Cadastro de alunos')).toBeVisible();
    await expect(resultado.getByText('1 e-mail inválido.').first()).toBeVisible();
    await expect(resultado.getByText(/Colunas que ficam de fora: Apelido/)).toBeVisible();
    await expect(resultado.getByText(/Nome do aluno/)).toBeVisible();
    expect(pedidos.diagnostico).toBe(1);

    // Trocar o arquivo esconde o diagnóstico do anterior.
    await page.getByLabel('Arquivo da planilha').setInputFiles({ name: 'outro.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });
    await expect(resultado).toBeHidden();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test('com a chave desligada não aparece nada', async ({ page }) => {
    const { naoTratadas, errosDaPagina, pedidos } = await preparar(page, false);
    await page.goto('/treinador/importacao/nova');
    await expect(page.getByRole('heading', { name: 'Nova importação', level: 1 })).toBeVisible();
    await page.getByLabel('Arquivo da planilha').setInputFiles({ name: 'alunos.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });
    await expect(page.getByRole('button', { name: 'Conferir o arquivo antes de importar' })).toHaveCount(0);
    expect(pedidos.diagnostico).toBe(0);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
});
