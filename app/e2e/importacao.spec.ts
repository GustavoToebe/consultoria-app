import { expect, test, type Page } from '@playwright/test';

import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Importação em etapas (análise do vídeo de 29/10): lista separada do assistente, destino e arquivo juntos, configuração
 * com ajuda, amostra com o campo escolhido em cada coluna, resumo Total / Com erro / Corretas e o resultado.
 * API falsa, dados fictícios. 390 e 1280 são a mesma página com a largura trocada.
 */
const ID = 'i0000000-0000-4000-8000-000000000001';
const ITEM = {
  id: ID, destino: 'alunos', nomeArquivo: 'alunos.csv', criadoEm: '2026-01-15T15:00:00Z',
  linhas: 3, novos: 2, atualizados: 0, ignorados: 0, comErro: 1, situacao: 'CONCLUIDA_COM_ERROS',
};
const DETALHE = { ...ITEM, configuracao: {}, erros: [{ linha: 4, campo: 'nome', motivo: 'Informe o nome.' }] };
const CSV = 'Aluno;E-mail;Apelido\nAna Fictícia;ana.ficticia@exemplo.com;Aninha\n';
const COLUNAS = {
  abas: ['Dados', 'Instruções'], aba: 0, colunas: ['Aluno', 'E-mail', 'Apelido'], linhas: 3,
  amostra: [
    ['Ana Fictícia', 'ana.ficticia@exemplo.com', 'Aninha'],
    ['Bruno Fictício', 'bruno.ficticio@exemplo.com', ''],
    ['', 'sem.nome@exemplo.com', ''],
  ],
};
const PREVIA = {
  hash: 'hash-falso', linhas: 3, novos: 1, atualizados: 1, ignorados: 0, comErro: 1,
  erros: [{ linha: 4, campo: 'nome', motivo: 'Informe o nome.' }], errosAlem: 0, amostra: [],
};

async function preparar(page: Page, largura: number) {
  await page.setViewportSize({ width: largura, height: 900 });
  const pedidos = { previa: 0, colunas: [] as string[], configuracao: null as unknown };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /importacoes': { corpo: { itens: [ITEM], total: 1, pagina: 0 } },
    [`GET /importacoes/${ID}`]: { corpo: DETALHE },
    [`GET /importacoes/${ID}/erros.csv`]: (_pedido, route) => route.fulfill({
      status: 200, contentType: 'text/csv;charset=utf-8', body: 'Linha;Campo;Motivo\n4;nome;Informe o nome.\n',
    }),
    'POST /importacoes/alunos/colunas': (pedido, route) => {
      pedidos.colunas.push(pedido.busca.toString());
      return json(route, COLUNAS);
    },
    'POST /importacoes/alunos/previa': (_pedido, route) => {
      pedidos.previa += 1;
      const corpo = route.request().postDataBuffer()?.toString('utf8') ?? '';
      const inicio = corpo.indexOf('{"aba"');
      pedidos.configuracao = inicio >= 0 ? JSON.parse(corpo.slice(inicio, corpo.indexOf('}}', inicio) + 2)) : null;
      return json(route, PREVIA);
    },
    'POST /importacoes/alunos': (_pedido, route) => json(route, { ...DETALHE, situacao: 'CONCLUIDA_COM_ERROS', novos: 1, atualizados: 1, comErro: 1 }),
  });
  return { ...api, pedidos };
}

for (const largura of [390, 1280]) {
  test(`lista, modelos e histórico em ${largura}px`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await preparar(page, largura);
    await page.goto('/treinador/importacao');
    await expect(page.getByText('Concluída com erros')).toBeVisible();
    await page.getByRole('button', { name: 'Abrir alunos.csv' }).click();
    await expect(page.getByText('Com erro (ficaram de fora)')).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar CSV de erros' }).click();
    expect((await download).suggestedFilename()).toBe('erros.csv');
    await page.getByRole('button', { name: 'Fechar' }).click();

    await page.getByRole('button', { name: 'Modelos de planilha' }).click();
    await expect(page.getByRole('button', { name: 'CSV de Alunos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Excel de Pesos' })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar' }).click();

    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`assistente em etapas, do destino ao resultado, em ${largura}px`, async ({ page }) => {
    const { naoTratadas, errosDaPagina, pedidos } = await preparar(page, largura);
    await page.goto('/treinador/importacao');
    await page.getByRole('button', { name: 'Nova importação' }).click();
    const folha = page.getByRole('dialog');
    await expect(folha.getByText(/Destino e arquivo/).first()).toBeVisible();

    // Etapa 1: sem destino nem arquivo, Continuar explica o porquê; arquivo .xls não passa.
    await expect(folha.getByText('Escolha o que vai importar.')).toBeVisible();
    await folha.getByRole('radiogroup', { name: 'O que vai importar' }).getByRole('button', { name: 'Alunos', exact: true }).click();
    await expect(folha.getByRole('button', { name: 'Baixar modelo Excel' })).toBeVisible();
    await expect(folha.getByText('Escolha o arquivo da planilha.')).toBeVisible();
    await page.getByLabel('Arquivo da planilha').setInputFiles({ name: 'alunos.xls', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('x') });
    await expect(folha.getByText('Envie um arquivo .xlsx ou .csv.').first()).toBeVisible();
    await page.getByLabel('Arquivo da planilha').setInputFiles({ name: 'alunos.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });
    await expect(folha.getByText('alunos.csv')).toBeVisible();
    await expect(folha.getByText(/CSV · \d+ bytes · selecionado, ainda não enviado/)).toBeVisible();
    await folha.getByRole('button', { name: 'Continuar' }).click();

    // Etapa 2: aba, cabeçalho, chave e regra com a frase de ajuda.
    await expect(folha.getByText('3 linhas de dados na aba “Dados”', { exact: false })).toBeVisible();
    await expect(folha.getByText('A primeira linha é o cabeçalho')).toBeVisible();
    await expect(folha.getByText('Deixa o cadastro como está e não usa a linha.')).toBeVisible();
    await folha.getByRole('button', { name: 'Continuar' }).click();

    // Etapa 3: amostra e o campo em cada coluna; "Aluno" casa com Nome pelo sinônimo, "Apelido" fica sem campo.
    await expect(folha.getByText('Bruno Fictício').first()).toBeVisible();
    await expect(folha.getByRole('button', { name: /Campo: Nome/ })).toBeVisible();
    await expect(folha.getByRole('button', { name: /Campo: E-mail/ })).toBeVisible();
    await expect(folha.getByRole('button', { name: /Campo: Não importar/ })).toBeVisible();
    // Tirar o Nome trava a validação com o motivo.
    await folha.getByRole('button', { name: /Campo: Nome/ }).click();
    await page.getByRole('dialog', { name: /Campo da coluna “Aluno”/ }).getByRole('radio', { name: 'Não importar' }).click();
    await expect(folha.getByText('Falta escolher a coluna de: Nome.')).toBeVisible();
    await expect(folha.getByText('Escolha a coluna de Nome.')).toBeVisible();
    await folha.getByRole('button', { name: /Campo: Não importar/ }).first().click();
    await page.getByRole('dialog', { name: /Campo da coluna “Aluno”/ }).getByRole('radio', { name: /^Nome, Obrigatório/ }).click();
    await expect(folha.getByText('Falta escolher a coluna de: Nome.')).toHaveCount(0);
    await folha.getByRole('button', { name: 'Validar' }).click();

    // Etapa 4: resumo, o que vai acontecer e o erro com linha, campo e coluna.
    await expect(folha.getByLabel('Total: 3')).toBeVisible();
    await expect(folha.getByLabel('Com erro: 1')).toBeVisible();
    await expect(folha.getByLabel('Corretas: 2')).toBeVisible();
    await expect(folha.getByText('Ao confirmar, a importação vai criar 1 registro e atualizar 1.')).toBeVisible();
    await expect(folha.getByText('Linha 4 · Nome (coluna “Aluno”): Informe o nome.')).toBeVisible();
    expect(pedidos.previa).toBe(1);
    expect(pedidos.configuracao).toMatchObject({ aba: 0, cabecalho: true, chave: 'email', existentes: 'IGNORAR', mapeamento: { nome: 0, email: 1 } });

    // Voltar e mudar o mapeamento invalida a prévia: validar de novo pede outra.
    await folha.getByRole('button', { name: 'Voltar' }).click();
    await folha.getByRole('button', { name: /Campo: Não importar/ }).click();
    await page.getByRole('dialog', { name: /Campo da coluna “Apelido”/ }).getByRole('radio', { name: /^Telefone/ }).click();
    await folha.getByRole('button', { name: 'Validar' }).click();
    await expect(folha.getByLabel('Corretas: 2')).toBeVisible();
    expect(pedidos.previa).toBe(2);

    await folha.getByRole('button', { name: 'Confirmar importação' }).click();
    await expect(folha.getByLabel('Novos: 1')).toBeVisible();
    await expect(folha.getByLabel('Atualizados: 1')).toBeVisible();
    await folha.getByRole('button', { name: 'Concluir' }).click();
    await expect(page.getByText('Importação registrada.')).toBeVisible();

    expect(pedidos.colunas).toEqual(['aba=0&cabecalho=true']);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
