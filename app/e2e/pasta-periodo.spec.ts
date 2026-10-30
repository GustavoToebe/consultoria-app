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

    await page.goto(`/treinador/alunos/${ALUNO_ID}`);
    // "Abertas", não "Ativas": pasta aberta não quer dizer plano em uso pelo aluno.
    await expect(page.getByRole('button', { name: 'Abertas' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ativas' })).toHaveCount(0);

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
}
