import { expect, test } from '@playwright/test';

import type { AlunoDetalhe } from '../src/api/tipos';
import { ALUNO, erroApi, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Padrão Tabs da APG nas `Abas` (dívida do lote de 26/11): com o painel passado às abas (Equipe), a aba ativa aponta o
 * painel (`aria-controls`), que é `role="tabpanel"` nomeado pela aba (`aria-labelledby`), e trocar de aba troca o painel;
 * as abas fora da vista não apontam para nada. Sem o painel (ficha do aluno: o conteúdo mora em outro lugar), nenhuma aba
 * aponta para um id que não existe. Dados fictícios.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

for (const largura of [390, 1280]) {
  test(`com o painel, a aba ativa aponta o tabpanel nomeado por ela (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'EQUIPE_LER', 'USUARIO_LER', 'PERFIL_LER'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /usuarios': erroApi(500, 'Erro ao carregar a equipe.'),
    });
    await page.goto('/treinador/equipe?aba=membros');
    const membros = page.getByRole('tab', { name: 'Membros' });
    await expect(membros).toHaveAttribute('aria-selected', 'true');
    const painel = page.getByRole('tabpanel');
    await expect(painel).toHaveCount(1);
    const idDoPainel = await painel.getAttribute('id');
    expect(idDoPainel).toBeTruthy();
    await expect(membros).toHaveAttribute('aria-controls', idDoPainel ?? '');
    await expect(painel).toHaveAttribute('aria-labelledby', (await membros.getAttribute('id')) ?? '');
    await expect(page.getByRole('tabpanel', { name: 'Membros' })).toBeVisible();
    // O erro da lista é conteúdo do painel.
    await expect(painel.getByRole('button', { name: /tentar de novo/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Perfis' })).not.toHaveAttribute('aria-controls', /.+/);

    await page.getByRole('tab', { name: 'Perfis' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Perfis' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Perfis' })).toHaveAttribute('aria-controls', /.+/);
    await expect(membros).not.toHaveAttribute('aria-controls', /.+/);
    expect(errosDaPagina).toEqual([]);
  });

  test(`sem o painel, nenhuma aba aponta para um painel que não existe (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    });
    await page.goto(`/treinador/alunos/${ALUNO_ID}`);
    const abas = page.getByRole('tab');
    await expect(abas.first()).toBeVisible();
    for (const aba of await abas.all()) await expect(aba).not.toHaveAttribute('aria-controls', /.+/);
    expect(errosDaPagina).toEqual([]);
  });
}
