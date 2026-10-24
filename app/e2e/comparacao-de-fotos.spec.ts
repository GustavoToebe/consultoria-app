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

for (const largura of [390, 1280, 3440]) {
  test(`treinador compara fotos e gera a imagem em ${largura}px`, async ({ page }) => {
    const altura = largura === 3440 ? 1440 : 900;
    await page.setViewportSize({ width: largura, height: altura });
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
        expect(pedido.corpo).toMatchObject({
          formato: 'STORIES', comLogo: false, imagens: [{ fotoIds: ['f1', 'f5'] }],
        });
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
    const xs = pontos.map((p) => p?.x ?? 0);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(8);
    expect(xs[1]).toBeGreaterThan(xs[0]);
    expect(xs[3]).toBeGreaterThan(xs[2]);

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
    const dialog = page.getByRole('dialog', { name: 'Gerar imagem' });
    const caixaDialog = await dialog.boundingBox();
    expect(caixaDialog).not.toBeNull();
    expect(caixaDialog!.x).toBeGreaterThanOrEqual(-1);
    expect(caixaDialog!.y).toBeGreaterThanOrEqual(-1);
    expect(caixaDialog!.width).toBeLessThanOrEqual(largura + 1);
    expect(caixaDialog!.height).toBeLessThanOrEqual(altura + 1);
    const imagens = await page.getByLabel('Prévia da imagem').getByRole('img').all();
    expect(imagens.length).toBe(2);
    const linhas = await Promise.all(imagens.map(async (c) => (await c.boundingBox())?.y ?? 0));
    expect(Math.max(...linhas) - Math.min(...linhas)).toBeLessThan(8);
    await expect(page.getByRole('button', { name: 'Stories' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Os dois' }).click();
    await expect(page.getByRole('button', { name: 'Baixar zip' })).toBeVisible();
    await expect(page.getByText('O Feed retrato sai junto, na pasta Feed.')).toBeVisible();
    await page.getByRole('button', { name: 'Stories' }).click();
    const logo = page.getByRole('img', { name: 'Logo da consultoria', exact: true });
    await expect(logo).toBeVisible();
    await page.getByRole('switch', { name: 'Com a logo da consultoria' }).click();
    await expect(logo).toHaveCount(0);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar imagem' }).click();
    expect((await download).suggestedFilename()).toBe('stories.jpg');
    expect(errosDaPagina).toEqual([]);
    expect(pedidos.some((p) => p.caminho.endsWith('/fotos/comparacao'))).toBe(true);
  });

  test(`aluno autoriza na conta e compara no histórico em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 3440 ? 1440 : 900 });
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

test('o carrossel emparelha as fotos das duas datas pela ordem', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const fotos: FotoDaLinha[] = [
    { fotoId: 'a1', origem: 'ATUALIZACAO', origemId: 'u1', data: '2026-01-01', perguntaId: 'fotos', posicao: 'Fotos em jejum', ordem: 0, pesoKg: 80 },
    { fotoId: 'a2', origem: 'ATUALIZACAO', origemId: 'u1', data: '2026-01-01', perguntaId: 'fotos', posicao: 'Fotos em jejum', ordem: 1, pesoKg: 80 },
    { fotoId: 'b1', origem: 'ATUALIZACAO', origemId: 'u2', data: '2026-02-20', perguntaId: 'fotos', posicao: 'Fotos em jejum', ordem: 0, pesoKg: 78 },
    { fotoId: 'b2', origem: 'ATUALIZACAO', origemId: 'u2', data: '2026-02-20', perguntaId: 'fotos', posicao: 'Fotos em jejum', ordem: 1, pesoKg: 78 },
    { fotoId: 'l1', origem: 'ATUALIZACAO', origemId: 'u1', data: '2026-01-01', perguntaId: 'livre', posicao: 'Foto livre', ordem: 0, pesoKg: 80 },
    { fotoId: 'l2', origem: 'ATUALIZACAO', origemId: 'u2', data: '2026-02-20', perguntaId: 'livre', posicao: 'Foto livre', ordem: 0, pesoKg: 78 },
  ];
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES, marca: MARCA })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { ...FICHA, usoDeImagemAutorizadoEm: '2026-10-01T12:00:00Z' } },
    [`GET /alunos/${ALUNO_ID}/fotos`]: { corpo: fotos },
    'GET /atualizacoes/{id}/fotos/{fotoId}': jpeg,
    [`POST /alunos/${ALUNO_ID}/fotos/comparacao`]: (pedido, route) => {
      expect(pedido.corpo).toMatchObject({
        formato: 'STORIES',
        comLogo: false,
        imagens: [{ fotoIds: ['a1', 'b1'] }, { fotoIds: ['a2', 'b2'] }],
      });
      return route.fulfill({ status: 200, contentType: 'application/zip', body: Buffer.from('PK') });
    },
  });

  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  await page.getByRole('tab', { name: 'Comparar' }).click();
  await page.getByRole('button', { name: 'Fotos em jejum', exact: true }).click();
  await page.getByRole('button', { name: 'Primeira × última' }).click();
  await page.getByRole('button', { name: 'Gerar carrossel' }).click();
  const dialog = page.getByRole('dialog', { name: 'Gerar carrossel' });
  await expect(dialog.getByLabel('Prévia da imagem')).toHaveCount(2);
  await expect(dialog.getByText('Foto 1', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Foto 2', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Livre')).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar zip' }).click();
  expect((await download).suggestedFilename()).toBe('comparacao.zip');
  expect(errosDaPagina).toEqual([]);
});
