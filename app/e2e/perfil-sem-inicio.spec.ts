import { expect, test, type Page } from '@playwright/test';

import type { AlunoResumo } from '../src/api/tipos';
import { sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * N1 (auditoria de 03/11): perfil sem `PAINEL_VER` que abre `/treinador` cai na primeira tela que pode abrir, em vez de
 * "Sem acesso"; as outras rotas seguem na guarda, e perfil sem tela de trabalho não entra em laço. API simulada.
 */
const ALUNO: AlunoResumo = {
  id: 'a0000000-0000-4000-8000-000000000001', nome: 'Ana Fictícia', ativo: true, temAcesso: true, planoAtivo: null,
  ultimoRegistro: null, responsavelId: TREINADOR.id, atualizacao: null,
};

async function abrir(page: Page, permissoes: string[]) {
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes, perfil: { id: 'p2', nome: 'Recepção', acessoTotal: false } })),
    'GET /alunos': { corpo: { itens: [ALUNO], total: 1 } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
  });
}

for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: altura } });

    test('sem o Início, /treinador abre a primeira tela permitida', async ({ page }) => {
      const { errosDaPagina } = await abrir(page, ['ALUNO_LER']);
      await page.goto('/treinador');
      await expect(page).toHaveURL(/\/treinador\/alunos/);
      await expect(page.getByRole('heading', { name: 'Alunos', level: 1 })).toBeVisible();
      await expect(page.getByText('Sem acesso a esta tela')).toHaveCount(0);
      expect(errosDaPagina).toEqual([]);
    });

    test('outra rota sem permissão segue em "Sem acesso", e o botão leva a uma tela aberta', async ({ page }) => {
      const { errosDaPagina } = await abrir(page, ['ALUNO_LER']);
      await page.goto('/treinador/auditoria');
      await expect(page.getByText('Sem acesso a esta tela').first()).toBeVisible();
      await page.getByRole('button', { name: 'Voltar ao início' }).click();
      await expect(page).toHaveURL(/\/treinador\/alunos/);
      expect(errosDaPagina).toEqual([]);
    });

    test('perfil sem tela de trabalho cai na Ajuda, sem laço', async ({ page }) => {
      const { errosDaPagina } = await abrir(page, []);
      await page.goto('/treinador');
      await expect(page).toHaveURL(/\/treinador\/ajuda/);
      expect(errosDaPagina).toEqual([]);
    });
  });
}
