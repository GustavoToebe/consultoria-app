import { expect, test } from '@playwright/test';

import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Importação: assistente de alunos, modelos e histórico com selo e CSV de erros. API falsa, dados fictícios.
 * O Playwright sobe a web; 390 e 1280 são a mesma página com a largura trocada.
 */
const ID = 'i0000000-0000-4000-8000-000000000001';
const ITEM = {
  id: ID, destino: 'alunos', nomeArquivo: 'alunos.csv', criadoEm: '2026-01-15T15:00:00Z',
  linhas: 3, novos: 2, atualizados: 0, ignorados: 0, comErro: 1, situacao: 'CONCLUIDA_COM_ERROS',
};
const DETALHE = { ...ITEM, configuracao: {}, erros: [{ linha: 4, campo: 'nome', motivo: 'Informe o nome.' }] };
const CSV = 'Nome;E-mail\nAna Fictícia;ana.ficticia@exemplo.com\n';

for (const largura of [390, 1280]) {
  test(`assistente, modelos e histórico em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /importacoes': { corpo: { itens: [ITEM], total: 1, pagina: 0 } },
      [`GET /importacoes/${ID}`]: { corpo: DETALHE },
      [`GET /importacoes/${ID}/erros.csv`]: (_pedido, route) => route.fulfill({
        status: 200, contentType: 'text/csv;charset=utf-8', body: 'Linha;Campo;Motivo\n4;nome;Informe o nome.\n',
      }),
      'POST /importacoes/alunos/colunas': (_pedido, route) => json(route, { abas: ['Dados'], aba: 0, colunas: ['Nome', 'E-mail'] }),
      'POST /importacoes/alunos/previa': (_pedido, route) => json(route, {
        hash: 'hash-falso', linhas: 1, novos: 1, atualizados: 0, ignorados: 0, comErro: 0, erros: [], errosAlem: 0, amostra: [],
      }),
      'POST /importacoes/alunos': (_pedido, route) => json(route, { ...DETALHE, situacao: 'CONCLUIDA', comErro: 0, erros: [] }),
    });

    await page.goto('/treinador/importacao');
    await expect(page.getByText('Concluída com erros')).toBeVisible();
    await page.getByRole('button', { name: 'Abrir alunos.csv' }).click();
    await expect(page.getByRole('button', { name: 'Baixar CSV de erros' })).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar CSV de erros' }).click();
    expect((await download).suggestedFilename()).toBe('erros.csv');
    await page.getByRole('button', { name: 'Fechar' }).click();

    await page.getByRole('button', { name: 'Modelos de planilha' }).click();
    await expect(page.getByRole('button', { name: 'CSV de Alunos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Excel de Alunos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'CSV de Pesos' })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar' }).click();

    await page.getByRole('button', { name: 'Nova importação' }).click();
    await page.getByRole('button', { name: 'Escolher Alunos' }).click();
    await page.getByLabel('Arquivo da planilha').setInputFiles({ name: 'alunos.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('A primeira linha é o cabeçalho')).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Importar 1 linhas' }).click();
    await expect(page.getByText('Importação registrada.')).toBeVisible();

    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
