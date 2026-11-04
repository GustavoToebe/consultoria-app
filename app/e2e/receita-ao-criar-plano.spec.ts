import { expect, test } from '@playwright/test';

import type { AlunoDetalhe, PastaResumo, Receita } from '../src/api/tipos';
import { ALUNO, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * "Novo treino", "Nova dieta" e "Nova mobilidade" na pasta: com "De um modelo", a receita se escolhe numa folha com busca
 * (`EscolhaEmFolha`), não numa fileira de chips. Só dados fictícios.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const PASTA_ID = 'b0000000-0000-4000-8000-000000000010';

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: 15, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

const PASTA: PastaResumo = { id: PASTA_ID, alunoId: ALUNO_ID, titulo: 'Plano 17', inicio: '2026-10-16', fim: '2026-10-30', concluidaEm: null };

function receita(n: number, tipo: Receita['tipo'], nome: string): Receita {
  return { id: `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, tipo, nome, descricao: null, conteudo: {}, ordem: n, pastaId: null, versao: 1 };
}

const NOMES = ['Semana ABC', 'Semana ABCD', 'Wellness 1', 'Wellness 2', 'Wellness 3', 'Wellness 4', 'Torso e Limbs', 'Plano 10', 'Plano 2.1', 'Plano 16'];
const TREINOS = NOMES.map((n, i) => receita(i + 1, 'PLANO_TREINO', n));
const DIETAS = [receita(51, 'PLANO_DIETA', 'Dieta de teste')];
const MOBILIDADES = [receita(61, 'MOBILIDADE', 'Mobilidade de teste')];

for (const largura of [390, 1280]) {
  test(`receita do novo treino é escolhida numa folha com busca, não em chips (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const PLANO_ID = 'b0000000-0000-4000-8000-000000000031';
    const { pedidos, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'PASTA_ALTERAR', 'TREINO_LER', 'TREINO_ALTERAR'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /receitas': (p, route) => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(p.busca.get('tipo') === 'PLANO_TREINO' ? TREINOS : []),
      }),
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
      [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [PASTA] },
      [`GET /alunos/${ALUNO_ID}/planos-treino`]: { corpo: [] },
      [`GET /alunos/${ALUNO_ID}/planos-dieta`]: { corpo: [] },
      [`GET /alunos/${ALUNO_ID}/planos-mobilidade`]: { corpo: [] },
      [`POST /alunos/${ALUNO_ID}/planos-treino`]: { corpo: { plano: { id: PLANO_ID } } },
    });

    await page.goto(`/treinador/alunos/${ALUNO_ID}`);
    await page.getByRole('button', { name: /^Pasta Plano 17, aberta/ }).click();
    await page.getByRole('dialog', { name: 'Plano 17' }).getByRole('button', { name: 'Novo treino', exact: true }).click();
    const novo = page.getByRole('dialog', { name: /^Novo treino em/ });
    await novo.getByRole('button', { name: 'De um modelo', exact: true }).click();

    // Um botão só ("Receita: Escolher"); as receitas não aparecem como chips na folha do plano.
    const botao = novo.getByRole('button', { name: 'Receita: Escolher. Escolher.' });
    await expect(botao).toBeVisible();
    await expect(novo.getByRole('button', { name: 'Semana ABC', exact: true })).toHaveCount(0);
    await expect(novo.getByRole('button', { name: 'Criar e abrir', exact: true })).toBeDisabled();

    await botao.click();
    const escolha = page.getByRole('dialog', { name: 'Receita' });
    // Dez receitas: a folha ganha a busca (sem acento) e filtra a lista.
    await escolha.getByLabel('Buscar').fill('wellness 3');
    await expect(escolha.getByRole('radio')).toHaveCount(1);
    await escolha.getByLabel('Buscar').fill('plano');
    await expect(escolha.getByRole('radio')).toHaveCount(3);
    await escolha.getByRole('radio', { name: 'Plano 10', exact: true }).click();

    await expect(escolha).toHaveCount(0);
    await expect(novo.getByRole('button', { name: 'Receita: Plano 10. Escolher.' })).toBeVisible();
    await novo.getByRole('button', { name: 'Criar e abrir', exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`/treinador/treinos/${PLANO_ID}`));
    const post = pedidos.find((p) => p.metodo === 'POST' && p.caminho.endsWith('/planos-treino'));
    expect((post?.corpo as { receitaId?: string }).receitaId).toBe(TREINOS[7].id);
    expect(errosDaPagina).toEqual([]);
  });

  test(`nova dieta e nova mobilidade usam a mesma escolha de receita (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'PASTA_ALTERAR', 'TREINO_LER', 'TREINO_ALTERAR', 'DIETA_LER', 'DIETA_ALTERAR'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /receitas': (p, route) => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(p.busca.get('tipo') === 'PLANO_DIETA' ? DIETAS : p.busca.get('tipo') === 'MOBILIDADE' ? MOBILIDADES : []),
      }),
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
      [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [PASTA] },
      [`GET /alunos/${ALUNO_ID}/planos-treino`]: { corpo: [] },
      [`GET /alunos/${ALUNO_ID}/planos-dieta`]: { corpo: [] },
      [`GET /alunos/${ALUNO_ID}/planos-mobilidade`]: { corpo: [] },
    });

    await page.goto(`/treinador/alunos/${ALUNO_ID}`);
    await page.getByRole('button', { name: /^Pasta Plano 17, aberta/ }).click();
    const pasta = page.getByRole('dialog', { name: 'Plano 17' });

    for (const [botaoNovo, titulo, nome] of [
      ['Nova dieta', /^Nova dieta em/, 'Dieta de teste'],
      ['Nova mobilidade', /^Nova mobilidade em/, 'Mobilidade de teste'],
    ] as const) {
      await pasta.getByRole('button', { name: botaoNovo, exact: true }).click();
      const novo = page.getByRole('dialog', { name: titulo });
      await novo.getByRole('button', { name: 'De um modelo', exact: true }).click();
      await novo.getByRole('button', { name: 'Receita: Escolher. Escolher.' }).click();
      const escolha = page.getByRole('dialog', { name: 'Receita' });
      await escolha.getByRole('radio', { name: nome }).click();
      await expect(novo.getByRole('button', { name: `Receita: ${nome}. Escolher.` })).toBeVisible();
      await expect(novo.getByRole('button', { name: 'Criar e abrir', exact: true })).toBeEnabled();
      await novo.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await expect(novo).toHaveCount(0);
    }
    expect(errosDaPagina).toEqual([]);
  });
}
