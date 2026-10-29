import { expect, test } from '@playwright/test';

import type { AvaliacaoFisica } from '../src/api/avaliacaoFisicaTipos';
import type { AlunoDetalhe } from '../src/api/tipos';
import { medidasVazias } from '../src/dominio/avaliacaoFisica';
import { ALUNO, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/** Avaliação física: o treinador registra e compara datas na ficha; o aluno só consulta no Histórico. Dados fictícios. */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

function avaliacao(id: string, data: string, cintura: number, quadril: number | null, pesoKg: number | null): AvaliacaoFisica {
  return {
    id, data, medidas: { ...medidasVazias(), cintura, quadril }, observacao: null, pesoKg, versao: 0,
    criadoEm: `${data}T12:00:00Z`, alteradoEm: `${data}T12:00:00Z`,
  };
}

const ANTIGA = avaliacao('av1', '2026-07-01', 90, 100, 82);

for (const largura of [390, 1280]) {
  test(`treinador registra, compara duas datas e vê o comparativo em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    let lista: AvaliacaoFisica[] = [ANTIGA];
    const { pedidos, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
      [`GET /alunos/${ALUNO_ID}/avaliacoes-fisicas`]: (_pedido, route) => json(route, lista),
      [`POST /alunos/${ALUNO_ID}/avaliacoes-fisicas`]: (pedido, route) => {
        const corpo = pedido.corpo as { data: string; medidas: AvaliacaoFisica['medidas'] };
        const nova = { ...avaliacao('av2', corpo.data, corpo.medidas.cintura ?? 0, corpo.medidas.quadril, null), medidas: corpo.medidas };
        lista = [nova, ...lista];
        return json(route, nova);
      },
    });

    await page.goto(`/treinador/alunos/${ALUNO_ID}`);
    const cartao = page.getByText('Avaliação física', { exact: true }).first();
    await cartao.scrollIntoViewIfNeeded();
    await expect(page.getByText('2 medidas · Peso 82 kg')).toBeVisible();

    await page.getByRole('button', { name: 'Nova avaliação' }).click();
    // Salvar sem nenhuma medida mostra o erro e não chama a API.
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Preencha ao menos uma medida.')).toBeVisible();
    await page.getByLabel('Cintura (cm)').fill('85,5');
    await page.getByLabel('Braço direito (cm)').fill('34,25');
    await expect(page.getByLabel('Braço direito (cm)')).toHaveValue('34,2');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('button', { name: 'Salvar' })).toHaveCount(0);

    const post = pedidos.find((p) => p.metodo === 'POST' && p.caminho.endsWith('/avaliacoes-fisicas'));
    expect(post?.corpo).toMatchObject({ medidas: { cintura: 85.5, bracoDireito: 34.2, quadril: null }, observacao: null });

    // Com duas avaliações, marcar as duas datas mostra a tabela e a diferença entre a primeira e a última.
    await page.getByRole('checkbox', { name: 'Comparar 01/07/2026' }).click();
    const nova = (post?.corpo as { data: string }).data.split('-').reverse().join('/');
    await page.getByRole('checkbox', { name: `Comparar ${nova}` }).click();
    await expect(page.getByText('Comparativo', { exact: true })).toBeVisible();
    await expect(page.getByText('−4,5 cm')).toBeVisible();
    await expect(page.getByText('90,0 cm')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Baixar comparativo' })).toBeVisible();
    // Sem palavra de avaliação.
    await expect(page.getByText(/gordura|melhorou|piorou/i)).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
}

test('aluno vê as avaliações no Histórico, só para consulta, e compara', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    'GET /aluno/pesos': { corpo: [] },
    'GET /aluno/fotos/linha-do-tempo': { corpo: [] },
    'GET /aluno/avaliacoes-fisicas': { corpo: [avaliacao('av2', '2026-09-01', 87, null, null), ANTIGA] },
  });
  await page.goto('/aluno/historico');
  await expect(page.getByText('Suas medidas registradas pelo seu treinador, em centímetros.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nova avaliação' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Editar avaliação/ })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Comparar 01/07/2026' }).click();
  await page.getByRole('checkbox', { name: 'Comparar 01/09/2026' }).click();
  await expect(page.getByText('−3,0 cm')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Baixar comparativo' })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});
