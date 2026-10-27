import { expect, test, type Page } from '@playwright/test';

import type { AlunoResumo, AtualizacaoDaLista } from '../src/api/tipos';
import { PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Listas do treinador em linha (`ui/LinhaDaLista`): a linha que abre outra tela é um `<a href>` (botão direito e
 * Ctrl+clique) e, no "Selecionar" dos alunos, a linha inteira vira um checkbox que marca sem abrir a ficha. Só dados fictícios.
 */
const ontem = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();

function aluno(n: number, nome: string): AlunoResumo {
  return { id: `a0000000-0000-4000-8000-00000000000${n}`, nome, ativo: true, temAcesso: true, planoAtivo: { id: `pl${n}`, titulo: 'Treino de outubro' }, ultimoRegistro: ontem, atualizacao: null };
}
const ALUNOS = [aluno(1, 'Ana Fictícia'), aluno(2, 'Bruno Exemplo')];

const ATUALIZACAO: AtualizacaoDaLista = {
  id: 'b0000000-0000-4000-8000-000000000001', pastaId: 'c0000000-0000-4000-8000-000000000001', alunoId: ALUNOS[0].id,
  nomeAluno: 'Ana Fictícia', dataAtualizacao: ontem, fase: 'ENVIADA', diasParaData: -1, diasDeAtraso: 0, atrasoAte: null,
};

async function abrir(page: Page) {
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: 1, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 0, alunosAtivos: 2, alunosSemRegistro: [], ultimasExecucoes: [], planosTerminando: [] } },
    'GET /alunos': { corpo: { itens: ALUNOS, total: ALUNOS.length } },
    'GET /responsaveis': { corpo: [] },
    'GET /atualizacoes': { corpo: [ATUALIZACAO] },
  });
}

for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: altura } });

    test('alunos: a linha é um link para a ficha e, no Selecionar, a linha inteira marca sem abrir', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page);
      await page.goto('/treinador/alunos');

      const linkAna = page.getByRole('link', { name: /^Abrir Ana Fictícia/ });
      await expect(linkAna).toHaveAttribute('href', `/treinador/alunos/${ALUNOS[0].id}`);
      await expect(page.getByRole('link', { name: /^Abrir Bruno Exemplo/ })).toHaveAttribute('href', `/treinador/alunos/${ALUNOS[1].id}`);
      // Fora do Selecionar a linha é o link, sem caixa de marcar.
      await expect(page.getByRole('checkbox')).toHaveCount(0);

      await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
      // No Selecionar a linha da Ana é o checkbox (com o nome dela) e deixa de ser link: nunca os dois.
      const linha = page.getByRole('checkbox', { name: 'Ana Fictícia', exact: true });
      await expect(page.getByRole('link', { name: /Ana Fictícia/ })).toHaveCount(0);
      await expect(page.locator(`a[href="/treinador/alunos/${ALUNOS[0].id}"]`)).toHaveCount(0);
      await expect(linha).toHaveAttribute('aria-checked', 'false');
      // Alvo de toque de pelo menos 44 px de altura.
      expect((await linha.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

      // Tocar no nome marca; não abre a ficha.
      await linha.getByText('Ana Fictícia', { exact: true }).click();
      await expect(linha).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByText('1 aluno marcado', { exact: false })).toBeVisible();
      expect(new URL(page.url()).pathname).toBe('/treinador/alunos');

      // Tocar de novo desmarca.
      await linha.getByText('Ana Fictícia', { exact: true }).click();
      await expect(linha).toHaveAttribute('aria-checked', 'false');
      expect(new URL(page.url()).pathname).toBe('/treinador/alunos');

      // Desligar o Selecionar devolve o link.
      await page.getByRole('button', { name: 'Sair da seleção', exact: true }).click();
      await expect(page.getByRole('checkbox')).toHaveCount(0);
      await expect(page.getByRole('link', { name: /^Abrir Ana Fictícia/ })).toHaveAttribute('href', `/treinador/alunos/${ALUNOS[0].id}`);

      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('atualizações: a linha é um link para o detalhe', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page);
      await page.goto('/treinador/atualizacoes?situacao=PARA_REVISAR');

      const linha = page.getByRole('link', { name: /Ana Fictícia/ });
      await expect(linha).toHaveAttribute('href', /^\/treinador\/atualizacoes\//);
      await expect(linha.getByRole('button')).toHaveCount(0);

      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}
