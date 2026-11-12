import { expect, test } from '@playwright/test';

import type { AlunoDetalhe, PastaResumo } from '../src/api/tipos';
import { ALUNO, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Reunião de 29/10 (análise do vídeo, A05 e A10): na pasta nova o fim acompanha o início pela duração do ciclo até o
 * treinador mexer no fim, e o filtro chama de "Abertas" as pastas não concluídas. Dados fictícios.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: 15, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

const PASTAS: PastaResumo[] = [
  { id: 'p1', alunoId: ALUNO_ID, titulo: 'Plano 16', inicio: '2026-10-01', fim: '2026-10-15', concluidaEm: '2026-10-16T12:00:00Z' },
  { id: 'p2', alunoId: ALUNO_ID, titulo: 'Plano 17', inicio: '2026-10-16', fim: '2026-10-30', concluidaEm: null },
];

for (const largura of [390, 1280]) {
  test(`pasta nova: o fim acompanha o início até ser editado à mão (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'PASTA_ALTERAR'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
      [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: PASTAS },
      [`POST /alunos/${ALUNO_ID}/pastas`]: { corpo: { ...PASTAS[1], id: 'p3', titulo: 'Plano 18' } },
    });

    await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=planos`);
    // "Abertas", não "Ativas": pasta aberta não quer dizer plano em uso pelo aluno.
    await expect(page.getByRole('radio', { name: 'Abertas' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Ativas' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Nova pasta' }).click();
    const folha = page.getByRole('dialog');
    await folha.getByLabel('Título').fill('Plano 18');
    const inicio = folha.getByRole('textbox', { name: 'Início' });
    const fim = folha.getByRole('textbox', { name: 'Fim' });

    await inicio.fill('01/11/2026');
    await expect(fim).toHaveValue('15/11/2026');
    await expect(folha.getByText('Período: 01/11/2026 a 15/11/2026 · 15 dias')).toBeVisible();
    // Virada do ano.
    await inicio.fill('20/12/2026');
    await expect(fim).toHaveValue('03/01/2027');

    // Fim editado à mão fica, e o início não o arrasta mais.
    await fim.fill('10/01/2027');
    await expect(folha.getByText('Fim ajustado à mão.')).toBeVisible();
    await inicio.fill('21/12/2026');
    await expect(fim).toHaveValue('10/01/2027');
    // Voltar à duração do ciclo recalcula pelo início atual.
    await folha.getByRole('button', { name: 'Usar a duração do ciclo (15 dias)' }).click();
    await expect(fim).toHaveValue('04/01/2027');
    await expect(folha.getByText('Fim ajustado à mão.')).toHaveCount(0);

    // Fim antes do início trava o Salvar com o motivo.
    await fim.fill('01/12/2026');
    await expect(folha.getByText('O fim vem antes do início.')).toBeVisible();
    await fim.fill('04/01/2027');

    await folha.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const post = pedidos.find((p) => p.metodo === 'POST' && p.caminho.endsWith('/pastas'));
    expect(post?.corpo).toEqual({ titulo: 'Plano 18', inicio: '2026-12-21', fim: '2027-01-04' });
    expect(errosDaPagina).toEqual([]);
  });

  // C76 (reunião de 30/10): a pasta no ano 0261 não passa. A mensagem fica no próprio campo e o Salvar trava.
  test(`pasta nova: início em 0261 é recusado no campo e trava o Salvar (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'PASTA_ALTERAR'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
      [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: PASTAS },
      [`POST /alunos/${ALUNO_ID}/pastas`]: { corpo: { ...PASTAS[1], id: 'p3', titulo: 'Plano 18' } },
    });

    await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=planos`);
    await page.getByRole('button', { name: 'Nova pasta' }).click();
    const folha = page.getByRole('dialog');
    await folha.getByLabel('Título').fill('Plano 18');
    const inicio = folha.getByRole('textbox', { name: 'Início' });
    const fim = folha.getByRole('textbox', { name: 'Fim' });
    const salvar = folha.getByRole('button', { name: 'Salvar' });

    await inicio.fill('05/05/0261');
    // A máscara não troca o ano digitado, e a faixa vale o relógio do aparelho (2000 até 31/12 daqui a 5 anos).
    await expect(inicio).toHaveValue('05/05/0261');
    await expect(folha.getByText(/^Início da pasta: use uma data entre 01\/01\/2000 e 31\/12\/\d{4}$/)).toBeVisible();
    await expect(salvar).toBeDisabled();

    // O fim também é conferido (aqui passando do teto de 5 anos), e voltar a uma data boa destrava o Salvar.
    await inicio.fill('01/11/2026');
    await expect(folha.getByText(/use uma data entre/)).toHaveCount(0);
    await fim.fill('15/11/2099');
    await expect(folha.getByText(/^Fim da pasta: use uma data entre 01\/01\/2000 e 31\/12\/\d{4}$/)).toBeVisible();
    await expect(salvar).toBeDisabled();
    await fim.fill('15/11/2026');
    await expect(salvar).toBeEnabled();

    expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho.endsWith('/pastas'))).toHaveLength(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`pasta nova: copiar de um período finalizado (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'PASTA_ALTERAR'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
      [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: PASTAS },
      'POST /pastas/p1/replicar': { corpo: { ...PASTAS[0], id: 'p3', titulo: 'Plano 18', concluidaEm: null } },
    });

    await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=planos`);
    await page.getByRole('button', { name: 'Nova pasta' }).click();
    const folha = page.getByRole('dialog', { name: 'Nova pasta' });
    await folha.getByRole('button', { name: 'Copiar de: Não copiar. Escolher.' }).click();
    const lista = page.getByRole('dialog', { name: 'Copiar de' });
    await expect(lista.getByRole('radio', { name: 'Não copiar' })).toBeVisible();
    await expect(lista.getByRole('radio', { name: /Plano 17/ })).toHaveCount(0);
    await lista.getByRole('radio', { name: /Plano 16/ }).click();
    await expect(page.getByRole('dialog', { name: 'Copiar de' })).toHaveCount(0);
    await expect(folha.getByText('Copia os treinos e as dietas publicados dessa pasta, como rascunhos.')).toBeVisible();
    await folha.getByLabel('Título').fill('Plano 18');
    await folha.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const post = pedidos.find((p) => p.metodo === 'POST' && p.caminho === '/pastas/p1/replicar');
    expect(post?.corpo).toMatchObject({ titulo: 'Plano 18', inicio: '2026-10-16', fim: '2026-10-30' });
    expect(errosDaPagina).toEqual([]);
  });
}

test('pasta nova: uma pasta só não oferece copiar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'PASTA_ALTERAR'] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [PASTAS[0]] },
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=planos`);
  await page.getByRole('button', { name: 'Nova pasta' }).click();
  await expect(page.getByRole('dialog').getByText('Copiar de')).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

// Guia de 11/11, pág. 33: na lista, título, selo "Rascunho" e período na mesma linha; pasta sem datas = "Não definido".
// O selo só aparece com as listas de planos conhecidas e nenhum plano da pasta publicado; lista que falhou = sem selo.
const plano = (id: string, pastaId: string, versaoPublicada: number) => ({
  id, alunoId: ALUNO_ID, pastaId, titulo: `Plano ${id}`, inicio: null, fim: null, ativo: versaoPublicada > 0,
  versaoPublicada, publicadoEm: null, rascunhoAlteradoDepoisDePublicar: false, versao: 1,
});
const PASTAS_DO_SELO: PastaResumo[] = [
  ...PASTAS,
  { id: 'p4', alunoId: ALUNO_ID, titulo: 'Plano 18', inicio: null, fim: null, concluidaEm: null },
];

for (const largura of [390, 1280]) {
  for (const dietaFalha of [false, true]) {
    test(`lista de pastas: selo Rascunho e "Não definido"${dietaFalha ? ', dieta que falhou não afirma rascunho' : ''} (${largura}px)`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      const { errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'PASTA_ALTERAR', 'TREINO_LER', 'DIETA_LER'] })),
        'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
        [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: PASTAS_DO_SELO },
        // p1 (concluída) e p2 só com rascunho; p4 com a dieta publicada.
        [`GET /alunos/${ALUNO_ID}/planos-treino`]: { corpo: [plano('t1', 'p1', 0), plano('t2', 'p2', 0), plano('t4', 'p4', 0)] },
        [`GET /alunos/${ALUNO_ID}/planos-dieta`]: dietaFalha
          ? { status: 500, corpo: { codigo: 'ERRO_INTERNO', mensagem: 'Falhou.' } }
          : { corpo: [plano('d2', 'p2', 0), plano('d4', 'p4', 1)] },
        [`GET /alunos/${ALUNO_ID}/planos-mobilidade`]: { corpo: [] },
      });

      await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=planos`);
      await expect(page.getByRole('button', { name: /^Pasta Plano 18, aberta, período Não definido\. Abrir\.$/ })).toBeVisible();
      await expect(page.getByText('Período: Não definido', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Pasta Plano 16, concluída, período/ })).toBeVisible();
      // Só a Plano 17 pode ganhar o selo: a 18 tem a dieta publicada e a 16 está concluída (os nomes acima já o excluem).
      await expect(page.getByRole('button', { name: dietaFalha ? /^Pasta Plano 17, aberta, período/ : /^Pasta Plano 17, aberta, rascunho, período/ })).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });
  }
}
