import { expect, test } from '@playwright/test';

import type { AlunoDetalhe, FotoDaLinha } from '../src/api/tipos';
import { ALUNO, json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/**
 * Comparação de fotos na ficha e no Histórico. A API é falsa e as fotos são um JPEG mínimo,
 * sem imagem de pessoa.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

const FOTOS: FotoDaLinha[] = [
  { fotoId: 'f1', origem: 'ANAMNESE', origemId: 'n1', data: '2026-01-01', perguntaId: 'frente', posicao: 'Frente', ordem: 0, pesoKg: 80 },
  { fotoId: 'f2', origem: 'ATUALIZACAO', origemId: 'u1', data: '2026-01-10', perguntaId: 'frente', posicao: 'Frente', ordem: 0, pesoKg: 79.5 },
  { fotoId: 'f3', origem: 'ATUALIZACAO', origemId: 'u2', data: '2026-01-20', perguntaId: 'frente', posicao: 'Frente', ordem: 0, pesoKg: 79.3 },
  { fotoId: 'f4', origem: 'ATUALIZACAO', origemId: 'u3', data: '2026-02-01', perguntaId: 'frente', posicao: 'Frente', ordem: 0, pesoKg: 79 },
  { fotoId: 'f5', origem: 'ATUALIZACAO', origemId: 'u4', data: '2026-02-10', perguntaId: 'frente', posicao: 'Frente', ordem: 0, pesoKg: 78.5 },
];

const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGf/9k=',
  'base64',
);

function jpeg(_pedido: unknown, route: Parameters<typeof json>[0]) {
  return route.fulfill({ status: 200, contentType: 'image/jpeg', body: JPEG });
}

const PERMISSOES = [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER'];

for (const largura of [390, 1280]) {
  test(`treinador compara fotos e gera a imagem em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const marca = { ...MARCA, logoUrl: '/publico/marcas/c0000000-0000-4000-8000-000000000001/logo?v=1' };
    const { pedidos, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES, marca })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: { ...FICHA, usoDeImagemAutorizadoEm: null } },
      [`GET /alunos/${ALUNO_ID}/fotos`]: { corpo: FOTOS },
      'GET /atualizacoes/{id}/fotos/{fotoId}': jpeg,
      'GET /anamneses/{id}/fotos/{fotoId}': jpeg,
      'GET /publico/marcas/{id}/logo': jpeg,
      [`POST /alunos/${ALUNO_ID}/fotos/comparacao`]: (pedido, route) => {
        expect(pedido.corpo).toMatchObject({ comLogo: false, fotoIds: ['f1', 'f5'] });
        return route.fulfill({ status: 200, contentType: 'image/jpeg', body: JPEG });
      },
    });

    await page.goto(`/treinador/alunos/${ALUNO_ID}`);
    await page.getByRole('tab', { name: 'Comparar' }).click();
    await page.getByRole('button', { name: 'Frente', exact: true }).click();
    await page.getByRole('button', { name: 'Primeira × última' }).click();
    await expect(page.getByText('01/01 → 10/02: −1,5 kg em 40 dias')).toBeVisible();

    await page.getByRole('button', { name: '10/01', exact: true }).click();
    await page.getByRole('button', { name: '20/01', exact: true }).click();
    await page.getByRole('button', { name: '01/02', exact: true }).click();
    const quinta = page.getByRole('button', { name: '10/02', exact: true });
    await expect(quinta).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: '01/02', exact: true }).click();
    await expect(page.getByRole('button', { name: '01/02', exact: true })).not.toHaveAttribute('aria-selected', 'true');

    const previa = page.getByLabel('Prévia da comparação');
    const caixas = await previa.locator('> div').all();
    expect(caixas.length).toBe(4);
    const pontos = await Promise.all(caixas.map(async (c) => c.boundingBox()));
    const ys = pontos.map((p) => p?.y ?? 0);
    expect(Math.abs(ys[0] - ys[1])).toBeLessThan(8);
    expect(ys[2]).toBeGreaterThan(ys[0] + 40);

    await page.getByRole('button', { name: 'Gerar imagem' }).click();
    await expect(page.getByRole('button', { name: 'Baixar imagem' })).toBeDisabled();
    await expect(page.getByText('O aluno ainda não autorizou o uso das fotos.').first()).toBeVisible();
    await page.getByRole('button', { name: 'Fechar' }).click();

    await page.route(`**/api/alunos/${ALUNO_ID}`, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return json(route, { ...FICHA, usoDeImagemAutorizadoEm: '2026-10-01T12:00:00Z' });
    });
    await page.reload();
    await page.getByRole('tab', { name: 'Comparar' }).click();
    await page.getByRole('button', { name: 'Primeira × última' }).click();
    await page.getByRole('button', { name: 'Gerar imagem' }).click();
    await expect(page.getByText('Aluno autorizou em 01/10/2026')).toBeVisible();
    const logo = page.getByRole('img', { name: 'Logo da consultoria', exact: true });
    await expect(logo).toBeVisible();
    await page.getByRole('switch', { name: 'Com a logo da consultoria' }).click();
    await expect(logo).toHaveCount(0);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar imagem' }).click();
    expect((await download).suggestedFilename()).toBe('comparacao.jpg');
    expect(errosDaPagina).toEqual([]);
    expect(pedidos.some((p) => p.caminho.endsWith('/fotos/comparacao'))).toBe(true);
  });

  test(`aluno autoriza na conta e compara no histórico em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    let autorizado = false;
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAluno(page)),
      'GET /aluno/uso-de-imagem': (_pedido, route) => json(route, { autorizadoEm: autorizado ? '2026-10-23T15:00:00Z' : null }),
      'PUT /aluno/uso-de-imagem': (pedido, route) => {
        autorizado = (pedido.corpo as { autorizado: boolean }).autorizado;
        return json(route, { autorizadoEm: '2026-10-23T15:00:00Z' });
      },
      'GET /aluno/fotos/linha-do-tempo': { corpo: FOTOS },
      'GET /aluno/fotos/{id}': jpeg,
      'GET /aluno/pesos': { corpo: [] },
      'GET /aluno/execucoes': { corpo: [] },
    });
    await page.goto('/aluno/conta');
    await page.getByRole('switch', { name: /Autorizo a consultoria/ }).click();
    await expect(page.getByText('Autorizado em 23/10/2026')).toBeVisible();

    await page.goto('/aluno/historico');
    await page.getByRole('tab', { name: 'Comparar' }).click();
    await page.getByRole('button', { name: 'Primeira × última' }).click();
    await expect(page.getByText('01/01 → 10/02: −1,5 kg em 40 dias')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gerar imagem' })).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
}
