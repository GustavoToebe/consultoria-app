import { expect, test, type Page } from '@playwright/test';

import type { Exercicio, Sessao } from '../src/api/tipos';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { GIF_FALSO, pngDeCor } from './imagens-falsas';

/**
 * Imagem ou GIF do exercício: miniatura na biblioteca, envio/troca/remoção na folha do exercício (treinador) e a
 * demonstração na tela do exercício do aluno, com a imagem própria só pela API e as fotos do catálogo pelo próprio
 * site (`/catalogo/exercicios/...`, aqui respondidas com quadrados gerados). Só dados fictícios.
 */
const AZUL = pngDeCor(16, [30, 90, 200]);
const VERDE = pngDeCor(16, [30, 160, 90]);

const COM_CATALOGO: Exercicio = {
  id: 'e0000000-0000-4000-8000-000000000001', nome: 'Remada baixa', grupoMuscular: 'Costas', equipamento: 'Cabo', modalidade: 'LIVRE',
  videoUrl: null, observacoes: null, origem: 'CATALOGO', imagens: ['Remada_Baixa/0.jpg', 'Remada_Baixa/1.jpg'], imagemPropriaEm: null,
};
const COM_PROPRIA: Exercicio = {
  id: 'e0000000-0000-4000-8000-000000000002', nome: 'Agachamento livre', grupoMuscular: 'Pernas', equipamento: 'Barra', modalidade: 'LIVRE',
  videoUrl: null, observacoes: null, origem: 'MANUAL', imagens: [], imagemPropriaEm: '2026-10-20T12:00:00Z',
};

/** Responde as fotos do catálogo (rota do site, não da API) e conta o que foi pedido. */
async function servirCatalogo(page: Page): Promise<string[]> {
  const pedidas: string[] = [];
  await page.route('**/catalogo/exercicios/**', (route) => {
    pedidas.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 200, contentType: 'image/png', body: route.request().url().endsWith('/1.jpg') ? VERDE : AZUL });
  });
  return pedidas;
}

test('biblioteca: miniaturas, enviar GIF, trocar e remover a imagem própria', async ({ page }) => {
  const pedidasDoCatalogo = await servirCatalogo(page);
  let atual: Exercicio = COM_PROPRIA;
  const envios: { metodo: string; caminho: string; corpo: string }[] = [];
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios': { corpo: [COM_CATALOGO, COM_PROPRIA] },
    [`GET /exercicios/${COM_PROPRIA.id}/imagem`]: (_p, route) => route.fulfill({ status: 200, contentType: 'image/png', body: AZUL }),
    [`PUT /exercicios/${COM_PROPRIA.id}/imagem`]: (p, route) => {
      envios.push({ metodo: p.metodo, caminho: p.caminho, corpo: route.request().postDataBuffer()?.toString('latin1') ?? '' });
      atual = { ...COM_PROPRIA, imagemPropriaEm: '2026-10-20T15:00:00Z' };
      return json(route, atual);
    },
    [`DELETE /exercicios/${COM_PROPRIA.id}/imagem`]: (p, route) => {
      envios.push({ metodo: p.metodo, caminho: p.caminho, corpo: '' });
      atual = { ...COM_PROPRIA, imagemPropriaEm: null };
      return json(route, atual);
    },
  });
  await page.goto('/treinador/biblioteca');
  await expect(page.getByText('Remada baixa', { exact: true })).toBeVisible();

  // Miniatura do catálogo: as duas fotos são pedidas ao próprio site (nunca ao GitHub).
  await expect.poll(() => pedidasDoCatalogo.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
  expect(pedidasDoCatalogo).toEqual(expect.arrayContaining(['/catalogo/exercicios/Remada_Baixa/0.jpg', '/catalogo/exercicios/Remada_Baixa/1.jpg']));
  await expect(page.getByRole('img', { name: 'Demonstração: Remada baixa' })).toHaveCount(1);
  await expect(page.getByRole('img', { name: 'Demonstração: Agachamento livre' })).toBeVisible();

  // Folha do exercício com imagem própria: troca por um GIF.
  await page.getByRole('button', { name: 'Editar Agachamento livre' }).click();
  await expect(page.getByText('Imagem ou GIF', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remover imagem' })).toBeVisible();
  const [seletor] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Trocar imagem ou GIF' }).click(),
  ]);
  await seletor.setFiles({ name: 'agachamento.gif', mimeType: 'image/gif', buffer: GIF_FALSO });
  await expect.poll(() => envios.length, { timeout: 15_000 }).toBe(1);
  expect(envios[0].metodo).toBe('PUT');
  // O nome do arquivo é fixo: o original não sai do aparelho.
  expect(envios[0].corpo).toContain('filename="imagem.gif"');
  expect(envios[0].corpo).not.toContain('agachamento');
  await expect(page.getByText('Imagem salva.')).toBeVisible();

  // Remover pede confirmação na tela (nada de confirm do navegador).
  await page.getByRole('button', { name: 'Remover imagem' }).click();
  await expect(page.getByText('Remover a imagem?')).toBeVisible();
  expect(envios).toHaveLength(1);
  await page.getByRole('button', { name: 'Remover', exact: true }).click();
  await expect.poll(() => envios.length, { timeout: 15_000 }).toBe(2);
  expect(envios[1].metodo).toBe('DELETE');
  await expect(page.getByText('Imagem removida.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remover imagem' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enviar imagem ou GIF' })).toBeVisible();

  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('biblioteca: sem permissão de alterar a folha só mostra a imagem', async ({ page }) => {
  await servirCatalogo(page);
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios': { corpo: [COM_CATALOGO] },
  });
  await page.goto('/treinador/biblioteca');
  await expect(page.getByText('Remada baixa', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar Remada baixa' })).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

/** Sessão com dois exercícios da biblioteca (um com fotos do catálogo, outro com imagem própria) e um fora dela. */
function sessaoComBiblioteca(): Sessao[] {
  const base = sessaoFalsa('sa', 'Peito e tríceps', 1, 3);
  const [a, b, c] = base.exercicios;
  return [{
    ...base,
    exercicios: [
      { ...a, nome: 'Remada baixa', exercicioId: COM_CATALOGO.id },
      { ...b, nome: 'Agachamento livre', exercicioId: COM_PROPRIA.id },
      { ...c, nome: 'Exercício avulso' },
    ],
  }];
}

test('aluno: demonstração acima do Como fazer; imagem própria só pela API; sem imagem não sobra espaço', async ({ page }) => {
  await fixarHoje(page);
  const pedidasDoCatalogo = await servirCatalogo(page);
  const cabecalhos: Record<string, string | undefined>[] = [];
  const sessoes = sessaoComBiblioteca();
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessaoDeAlunoComTreino(page, sessoes)),
    'GET /aluno/exercicios/demonstracoes': {
      corpo: [
        { exercicioId: COM_CATALOGO.id, imagens: COM_CATALOGO.imagens, imagemPropriaEm: null },
        { exercicioId: COM_PROPRIA.id, imagens: [], imagemPropriaEm: COM_PROPRIA.imagemPropriaEm },
      ],
    },
    [`GET /aluno/exercicios/${COM_PROPRIA.id}/imagem`]: (_p, route) => {
      cabecalhos.push(route.request().headers());
      return route.fulfill({ status: 200, contentType: 'image/png', body: VERDE });
    },
  });

  // Exercício do catálogo: as duas fotos vêm do próprio site.
  await page.goto(`/aluno/sessao/sa/${sessoes[0].exercicios[0].uid}?data=2026-10-19`);
  await expect(page.getByRole('heading', { name: 'Remada baixa', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /Demonstração: Remada baixa\. Tocar para ampliar/ })).toBeVisible();
  await expect.poll(() => pedidasDoCatalogo.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
  expect(pedidasDoCatalogo.every((c) => c.startsWith('/catalogo/exercicios/Remada_Baixa/'))).toBe(true);

  // Tocar amplia numa folha.
  await page.getByRole('button', { name: /Demonstração: Remada baixa\. Tocar para ampliar/ }).click();
  await expect(page.getByRole('dialog').getByText('Demonstração', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  // Exercício com imagem própria: baixada com o token, pela rota do aluno.
  await page.goto(`/aluno/sessao/sa/${sessoes[0].exercicios[1].uid}?data=2026-10-19`);
  await expect(page.getByRole('heading', { name: 'Agachamento livre', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /Demonstração: Agachamento livre/ })).toBeVisible();
  await expect.poll(() => cabecalhos.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
  expect(cabecalhos[0]['authorization']).toBe('Bearer token-falso');

  // Fora da biblioteca ou sem imagem: nada de caixa vazia.
  await page.goto(`/aluno/sessao/sa/${sessoes[0].exercicios[2].uid}?data=2026-10-19`);
  await expect(page.getByRole('heading', { name: 'Exercício avulso', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /Demonstração/ })).toHaveCount(0);
  await expect(page.getByRole('img', { name: /Demonstração/ })).toHaveCount(0);

  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('aluno: imagem própria que não carrega (sem internet) some sem quebrar a tela', async ({ page }) => {
  await fixarHoje(page);
  await servirCatalogo(page);
  const sessoes = sessaoComBiblioteca();
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessaoDeAlunoComTreino(page, sessoes)),
    'GET /aluno/exercicios/demonstracoes': {
      corpo: [{ exercicioId: COM_PROPRIA.id, imagens: [], imagemPropriaEm: COM_PROPRIA.imagemPropriaEm }],
    },
    [`GET /aluno/exercicios/${COM_PROPRIA.id}/imagem`]: erroApi(404, 'Sem imagem.', 'NAO_ENCONTRADO'),
  });
  await page.goto(`/aluno/sessao/sa/${sessoes[0].exercicios[1].uid}?data=2026-10-19`);
  await expect(page.getByRole('heading', { name: 'Agachamento livre', level: 1 })).toBeVisible();
  await expect(page.getByText('Séries', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /Demonstração/ })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});
