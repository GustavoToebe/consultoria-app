import { expect, test } from '@playwright/test';

import type { ConteudoDieta, ItemDieta, PlanoDetalhe, VersaoDetalhe } from '../src/api/tipos';
import { MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/**
 * Dieta de 28/10: o almoço tem duas opções (alternativas, cada uma com o próprio total, "—" no que falta) e o modo de
 * preparo. Números e textos fictícios.
 */
function item(uid: string, nome: string, quantidade: number, kcal: number | null, gordura: number | null): ItemDieta {
  return { uid, alimentoId: null, nome, quantidade, unidade: 'g', kcal, proteina: 4, carboidrato: 30, gordura, manual: true };
}

const PREPARO = 'Cozinhe o arroz por 15 minutos.\nGrelhe o frango com limão.';

const CONTEUDO: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, suplementacao: [], ergogenicos: null, aguaLitros: null,
  refeicoes: [{
    uid: 'almoco', nome: 'Almoço', horario: '12:00', observacao: null, modoDePreparo: PREPARO,
    opcoes: [
      { uid: 'a', rotulo: 'A', itens: [item('arroz', 'Arroz fictício', 150, 190, 0.4)] },
      { uid: 'b', rotulo: 'B', itens: [item('batata', 'Batata fictícia', 200, 170, null)] },
    ],
  }],
};

const DIETA: VersaoDetalhe<ConteudoDieta> = {
  id: 'd0000000-0000-4000-8000-000000000001', planoId: 'p0000000-0000-4000-8000-000000000001', numero: 1, titulo: 'Dieta de teste',
  inicio: '2026-10-01', fim: '2026-10-31', publicadoEm: '2026-10-01T12:00:00Z', conteudo: CONTEUDO,
};

for (const largura of [390, 1280]) {
  test(`aluno: escolhe uma das opções, abre o modo de preparo e o PDF o leva (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.addInitScript(() => { window.print = () => undefined; });
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAluno(page)),
      'GET /aluno/dieta': { corpo: { dieta: DIETA } },
      'GET /aluno/pesos': { corpo: [] },
    });
    await page.goto('/aluno/dieta');
    await expect(page.getByText('Escolha uma das opções: A ou B.')).toBeVisible();
    await expect(page.getByText(/equivalente/i)).toHaveCount(0);
    await expect(page.getByText('Total da opção A: 190 kcal', { exact: false })).toBeVisible();

    // Fechado por padrão; abre ao tocar e mostra o texto com as quebras de linha.
    await expect(page.getByText('Cozinhe o arroz por 15 minutos.', { exact: false })).toHaveCount(0);
    await page.getByRole('button', { name: 'Abrir modo de preparo' }).click();
    await expect(page.getByText('Grelhe o frango com limão.', { exact: false })).toBeVisible();

    await page.getByRole('button', { name: 'Baixar PDF da dieta' }).click();
    await page.getByRole('dialog', { name: 'PDF da dieta' }).getByRole('button', { name: 'Baixar PDF', exact: true }).click();
    const bloco = page.locator('#treinos-impressao');
    await expect(bloco).toContainText('Sugestão de plano alimentar');
    await expect(bloco).toContainText('Escolha uma das opções: A ou B.');
    await expect(bloco).toContainText('Modo de preparo');
    await expect(bloco).toContainText('Grelhe o frango com limão.');
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

const PLANO_ID = 'p0000000-0000-4000-8000-000000000001';
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const DETALHE: PlanoDetalhe<ConteudoDieta> = {
  plano: {
    id: PLANO_ID, alunoId: ALUNO_ID, pastaId: null, titulo: 'Dieta de teste', inicio: '2026-10-01', fim: '2026-10-31', ativo: true,
    versaoPublicada: 1, publicadoEm: '2026-10-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho: CONTEUDO,
  versoes: [{ id: 'v0000000-0000-4000-8000-000000000001', numero: 1, publicadoEm: '2026-10-01T12:00:00Z' }],
};

for (const [largura, ladoALado] of [[390, false], [1280, true]] as const) {
  test(`treinador: opções ${ladoALado ? 'lado a lado' : 'empilhadas'} com o total de cada uma e o modo de preparo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /alimentos': { corpo: [] },
      'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluno Teste' } },
      [`GET /planos-dieta/${PLANO_ID}`]: { corpo: DETALHE },
    });
    await page.goto(`/treinador/dietas/${PLANO_ID}`);
    await page.getByRole('button', { name: /12:00 · Almoço, fechado/ }).click();

    const a = page.getByRole('heading', { name: 'Opção A' });
    const b = page.getByRole('heading', { name: 'Opção B' });
    await expect(a).toBeVisible();
    await expect(b).toBeVisible();
    await expect(page.getByText('O aluno escolhe uma das opções. O total do dia usa só a opção A.')).toBeVisible();
    // Total de cada opção; o que falta (gordura da batata) é "—".
    await expect(page.getByText('Total da opção A: 190 kcal · P 4 g · C 30 g · G 0,4 g')).toBeVisible();
    await expect(page.getByText('Total da opção B: 170 kcal · P 4 g · C 30 g · G —')).toBeVisible();
    const [caixaA, caixaB] = [await a.boundingBox(), await b.boundingBox()];
    if (!caixaA || !caixaB) throw new Error('sem caixa');
    if (ladoALado) {
      expect(Math.abs(caixaA.y - caixaB.y)).toBeLessThan(2);
      expect(caixaB.x).toBeGreaterThan(caixaA.x + 200);
    } else {
      expect(caixaB.y).toBeGreaterThan(caixaA.y + 50);
      expect(Math.abs(caixaA.x - caixaB.x)).toBeLessThan(2);
    }
    await expect(page.getByLabel('Modo de preparo (opcional)')).toHaveValue(PREPARO);
    await expect(page.getByText(/equivalente/i)).toHaveCount(0);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
