import { expect, test, type Page } from '@playwright/test';

import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Importação em etapas (análise do vídeo de 29/10 e referência de 30/10): lista separada do assistente, destino em
 * cartões e arquivo juntos, configuração com ajuda, a planilha com o campo de cada coluna (lista suspensa com busca no
 * PC, folha no celular), busca, correção de célula e lixeira por linha, resumo Total / Com erro / Corretas e o
 * resultado. API falsa, dados fictícios. 390 e 1280 são a mesma página com a largura trocada.
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
  numerosDasLinhas: [2, 3, 4], amostraCortada: false, celulasCortadas: [],
};
/** Planilha maior que a amostra: 60 linhas vieram, de 1.500 no arquivo. */
const COLUNAS_GRANDES = {
  ...COLUNAS, linhas: 1500, amostraCortada: true,
  amostra: Array.from({ length: 60 }, (_, i) => [`Pessoa Fictícia ${i + 1}`, `p${i + 1}@exemplo.com`, '']),
  numerosDasLinhas: Array.from({ length: 60 }, (_, i) => i + 2),
};
const PREVIA = {
  hash: 'hash-falso', linhas: 3, novos: 1, atualizados: 1, ignorados: 0, comErro: 1,
  erros: [{ linha: 4, campo: 'nome', motivo: 'Informe o nome.' }], errosAlem: 0, amostra: [],
};
const PREVIA_CORRIGIDA = { ...PREVIA, hash: 'hash-corrigido', novos: 2, comErro: 0, erros: [] };

type Configuracao = { ajustes?: { celulas: { linha: number; coluna: number; valor: string }[]; removidas: number[] } };

async function preparar(page: Page, largura: number, colunas: object = COLUNAS) {
  await page.setViewportSize({ width: largura, height: 900 });
  const pedidos = { previa: 0, colunas: [] as string[], configuracao: null as Configuracao | null };
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
      return json(route, colunas);
    },
    'POST /importacoes/alunos/previa': (_pedido, route) => {
      pedidos.previa += 1;
      const corpo = route.request().postDataBuffer()?.toString('utf8') ?? '';
      const inicio = corpo.indexOf('{"aba"');
      pedidos.configuracao = inicio >= 0 ? JSON.parse(corpo.slice(inicio, corpo.indexOf('\r\n--', inicio))) : null;
      // A correção da célula vazia (linha 4, coluna "Aluno") resolve o único erro.
      const corrigiu = pedidos.configuracao?.ajustes?.celulas.some((c) => c.linha === 4 && c.coluna === 0 && c.valor.trim() !== '');
      return json(route, corrigiu ? PREVIA_CORRIGIDA : PREVIA);
    },
    'POST /importacoes/alunos': (_pedido, route) => json(route, { ...DETALHE, situacao: 'CONCLUIDA_COM_ERROS', novos: 1, atualizados: 1, comErro: 1 }),
  });
  return { ...api, pedidos };
}

/** Escolhe o campo da coluna: a mesma lista com busca, colada ao botão no PC e numa folha no celular. */
async function escolherCampo(page: Page, botao: RegExp, coluna: string, campo: string, busca?: string) {
  await page.getByRole('dialog').first().getByRole('button', { name: botao }).first().click();
  const lista = page.getByRole('dialog', { name: `Campo da coluna “${coluna}”` });
  if (busca) await lista.getByLabel('Buscar campo').fill(busca);
  await lista.getByRole('option', { name: new RegExp(`^${campo}`) }).click();
  await expect(lista).toHaveCount(0);
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

    // Etapa 1: destino em cartões; sem destino nem arquivo, Continuar explica o porquê; arquivo .xls não passa.
    await expect(folha.getByText('Escolha o que vai importar.')).toBeVisible();
    const destinos = folha.getByRole('radiogroup', { name: 'O que vai importar' });
    await expect(destinos.getByRole('radio', { name: 'Pesos' })).toBeVisible();
    await destinos.getByRole('radio', { name: 'Alunos' }).click();
    await expect(destinos.getByRole('radio', { name: 'Alunos' })).toHaveAttribute('aria-checked', 'true');
    await expect(folha.getByRole('button', { name: 'Baixar modelo Excel' })).toBeVisible();
    await expect(folha.getByText('Clique ou arraste o arquivo até aqui.')).toBeVisible();
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

    // Etapa 3: a planilha com o ID do arquivo e o campo em cada coluna; "Aluno" casa com Nome pelo sinônimo.
    await expect(folha.getByLabel('Linha 3, coluna “Aluno”')).toHaveValue('Bruno Fictício');
    await expect(folha.getByRole('button', { name: /Campo: Cadastro > Nome/ })).toBeVisible();
    await expect(folha.getByRole('button', { name: /Campo: Cadastro > E-mail/ })).toBeVisible();
    await expect(folha.getByRole('button', { name: /Campo: Não importar/ })).toBeVisible();
    // Tirar o Nome trava a validação com o motivo; a busca da lista acha o campo de novo.
    await escolherCampo(page, /Campo: Cadastro > Nome/, 'Aluno', 'Não importar');
    await expect(folha.getByText('Falta escolher a coluna de: Nome.')).toBeVisible();
    await expect(folha.getByText('Escolha a coluna de Nome.')).toBeVisible();
    await escolherCampo(page, /Campo: Não importar/, 'Aluno', 'Cadastro > Nome, Obrigatório', 'nome');
    await expect(folha.getByText('Falta escolher a coluna de: Nome.')).toHaveCount(0);

    // Busca na tabela.
    await folha.getByLabel('Pesquisar na planilha').fill('bruno');
    await expect(folha.getByLabel('Linha 2, coluna “Aluno”')).toHaveCount(0);
    await expect(folha.getByLabel('Linha 3, coluna “Aluno”')).toBeVisible();
    await folha.getByLabel('Pesquisar na planilha').fill('');

    // Tirar uma linha e desfazer.
    await folha.getByRole('button', { name: 'Tirar a linha 3' }).click();
    await expect(folha.getByLabel('Linha 3, coluna “Aluno”')).toHaveCount(0);
    await expect(folha.getByText('1 linha tirada (3)')).toBeVisible();
    await folha.getByRole('button', { name: 'Desfazer a última' }).click();
    await expect(folha.getByLabel('Linha 3, coluna “Aluno”')).toBeVisible();
    await folha.getByRole('button', { name: 'Validar' }).click();

    // Etapa 4: resumo, o que vai acontecer e o erro com linha, campo e coluna.
    await expect(folha.getByLabel('Total: 3')).toBeVisible();
    await expect(folha.getByLabel('Com erro: 1')).toBeVisible();
    await expect(folha.getByLabel('Corretas: 2')).toBeVisible();
    await expect(folha.getByText('Ao confirmar, a importação vai criar 1 registro e atualizar 1.')).toBeVisible();
    await expect(folha.getByText('Linha 4 · Nome (coluna “Aluno”): Informe o nome.')).toBeVisible();
    expect(pedidos.previa).toBe(1);
    expect(pedidos.configuracao).toMatchObject({ aba: 0, cabecalho: true, chave: 'email', existentes: 'IGNORAR', mapeamento: { nome: 0, email: 1 } });
    expect(pedidos.configuracao?.ajustes).toBeUndefined();

    // Corrigir na tabela: só a linha com erro, o motivo na célula; corrigir e validar de novo zera os erros.
    await folha.getByRole('button', { name: 'Corrigir na tabela' }).click();
    await expect(folha.getByLabel('Linha 2, coluna “Aluno”')).toHaveCount(0);
    await expect(folha.getByText('Informe o nome.')).toBeVisible();
    const celula = folha.getByLabel('Linha 4, coluna “Aluno”');
    await celula.fill('Carla Fictícia');
    await celula.press('Enter');
    await expect(folha.getByText('1 célula corrigida')).toBeVisible();
    await expect(folha.getByText('Corrigida ·')).toBeVisible();
    await folha.getByRole('button', { name: 'Mostrar todas as linhas' }).click();
    await expect(folha.getByLabel('Linha 2, coluna “Aluno”')).toBeVisible();
    await folha.getByRole('button', { name: 'Validar' }).click();
    await expect(folha.getByLabel('Com erro: 0')).toBeVisible();
    expect(pedidos.previa).toBe(2);
    expect(pedidos.configuracao?.ajustes).toEqual({ celulas: [{ linha: 4, coluna: 0, valor: 'Carla Fictícia' }], removidas: [] });

    // Voltar e mudar o mapeamento invalida a prévia: validar de novo pede outra (a correção continua).
    await folha.getByRole('button', { name: 'Voltar' }).click();
    await escolherCampo(page, /Campo: Não importar/, 'Apelido', 'Cadastro > Telefone');
    await folha.getByRole('button', { name: 'Validar' }).click();
    await expect(folha.getByLabel('Corretas: 3')).toBeVisible();
    expect(pedidos.previa).toBe(3);
    expect(pedidos.configuracao?.ajustes?.celulas).toHaveLength(1);

    await folha.getByRole('button', { name: 'Confirmar importação' }).click();
    await expect(folha.getByLabel('Novos: 1')).toBeVisible();
    await expect(folha.getByLabel('Atualizados: 1')).toBeVisible();
    await folha.getByRole('button', { name: 'Concluir' }).click();
    await expect(page.getByText('Importação registrada.')).toBeVisible();

    expect(pedidos.colunas).toEqual(['aba=0&cabecalho=true']);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`planilha maior que a amostra: aviso do corte, páginas e busca em ${largura}px`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await preparar(page, largura, COLUNAS_GRANDES);
    await page.goto('/treinador/importacao');
    await page.getByRole('button', { name: 'Nova importação' }).click();
    const folha = page.getByRole('dialog');
    await folha.getByRole('radiogroup', { name: 'O que vai importar' }).getByRole('radio', { name: 'Alunos' }).click();
    await page.getByLabel('Arquivo da planilha').setInputFiles({ name: 'alunos.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });
    await folha.getByRole('button', { name: 'Continuar' }).click();
    await folha.getByRole('button', { name: 'Continuar' }).click();

    await expect(folha.getByText('Mostrando as primeiras 60 de 1500 linhas. A validação confere todas.')).toBeVisible();
    await expect(folha.getByText('Página 1 de 2 · 60 linhas')).toBeVisible();
    await expect(folha.getByLabel('Linha 51, coluna “Aluno”')).toHaveValue('Pessoa Fictícia 50');
    await expect(folha.getByLabel('Linha 52, coluna “Aluno”')).toHaveCount(0);
    await folha.getByRole('button', { name: 'Próxima' }).click();
    await expect(folha.getByLabel('Linha 61, coluna “Aluno”')).toHaveValue('Pessoa Fictícia 60');
    if (largura >= 768) {
      // Teclado na lista suspensa: busca, setas e Enter escolhem; Esc fecha e o foco volta ao botão.
      await folha.getByRole('button', { name: /Campo: Não importar/ }).click();
      const lista = page.getByRole('dialog', { name: 'Campo da coluna “Apelido”' });
      await expect(lista.getByLabel('Buscar campo')).toBeFocused();
      await page.keyboard.type('tele');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('Enter');
      await expect(lista).toHaveCount(0);
      const botao = folha.getByRole('button', { name: /Campo: Cadastro > Telefone/ });
      await expect(botao).toBeFocused();
      await botao.click();
      await expect(lista).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(lista).toHaveCount(0);
      await expect(botao).toBeFocused();
    }
    await folha.getByLabel('Pesquisar na planilha').fill('ficticia 7');
    await expect(folha.getByText('Página 1 de 2')).toHaveCount(0);
    await expect(folha.getByLabel('Linha 8, coluna “Aluno”')).toHaveValue('Pessoa Fictícia 7');
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
