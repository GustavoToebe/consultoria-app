import { expect, test, type Page } from '@playwright/test';

import type { ConteudoMobilidadeApi, PlanoDetalhe } from '../src/api/tipos';
import { erroApi, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Editor de mobilidade do treinador (revisão dos editores, passo 3, 04/11): seção no inspetor com "Seção N de M", itens
 * sempre abertos em duas colunas (nome uma vez só, no campo), remover seção e item com "Desfazer" (sem painel de
 * confirmação; empilhado, o aviso fica onde estava o que saiu), adicionar seção só no bloco do fim da lista e a largura usada em 1920 (configuração ao lado das
 * Orientações, os três campos do item numa linha). Dados fictícios.
 */

const ALUNO_ID = 'a0000000-0000-4000-8000-0000000000m1';
const MOB_ID = 'p0000000-0000-4000-8000-0000000000m1';

const MOBILIDADE: ConteudoMobilidadeApi = {
  orientacoes: 'Antes do treino.',
  secoes: [
    { uid: 's1', titulo: 'Aquecimento', itens: [
      { uid: 'i1', nome: 'Gato-vaca', prescricao: '2 x 10', videoUrl: null },
      { uid: 'i2', nome: 'Lunge', prescricao: '2 x 20s cada lado', videoUrl: null },
    ] },
    { uid: 's2', titulo: 'Alongamento', itens: [{ uid: 'i3', nome: 'Posterior', prescricao: '30s', videoUrl: null }] },
  ],
};

const DETALHE: PlanoDetalhe<ConteudoMobilidadeApi> = {
  plano: {
    id: MOB_ID, alunoId: ALUNO_ID, pastaId: null, titulo: 'Mobilidade de teste', inicio: '2026-11-01', fim: '2026-11-30', ativo: true,
    versaoPublicada: 0, publicadoEm: null, rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho: MOBILIDADE,
  versoes: [],
};

async function abrir(page: Page, largura: number) {
  await page.setViewportSize({ width: largura, height: 1000 });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR'] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    [`GET /planos-mobilidade/${MOB_ID}`]: { corpo: DETALHE },
  });
  await page.goto(`/treinador/mobilidades/${MOB_ID}`);
  await expect(page.getByRole('heading', { name: 'Seções (2)' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  return api;
}

/** Nenhum botão ou campo passa da borda da janela (a rolagem do RN-web é de um div interno, não do documento). */
async function semEstouro(page: Page) {
  const fora = await page.evaluate(() => Array.from(document.querySelectorAll('button, input, textarea, [role="button"]'))
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > window.innerWidth + 1; }).length);
  expect(fora).toBe(0);
}

test('duas colunas: remover item e seção com Desfazer, sem painel de confirmação (1280px)', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280);
  await expect(page.getByText('Seção 1 de 2', { exact: true })).toBeVisible();
  // Itens abertos no inspetor: o nome aparece uma vez, no campo; nada de "Abrir todos".
  await expect(page.getByRole('textbox', { name: 'Nome do item 2' })).toHaveValue('Lunge');
  await expect(page.getByRole('button', { name: /Abrir todos|Fechar todos/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Abrir Lunge' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Remover Lunge' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Item “Lunge” removido.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Nome do item 2' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByRole('textbox', { name: 'Nome do item 2' })).toHaveValue('Lunge');

  await page.getByRole('button', { name: 'Remover Aquecimento' }).click();
  await expect(page.getByText('Seção “Aquecimento” removida, com 2 itens.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Seção 1 de 1: Alongamento/ })).toHaveAttribute('aria-current', 'true');
  await page.getByRole('button', { name: 'Desfazer' }).click();
  // Desfazer devolve a seção e a escolhe de novo.
  await expect(page.getByRole('button', { name: /^Seção 1 de 2: Aquecimento/ })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('textbox', { name: 'Título da seção 1' })).toHaveValue('Aquecimento');

  // Adicionar seção só no bloco do fim da lista; a nova fica escolhida e ganha item.
  await expect(page.getByRole('button', { name: 'Adicionar seção' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Adicionar seção' }).click();
  await expect(page.getByRole('button', { name: /^Seção 3 de 3: Seção 3/ })).toHaveAttribute('aria-current', 'true');
  await page.getByRole('button', { name: 'Adicionar item em Seção 3' }).click();
  await page.getByRole('textbox', { name: 'Nome do item 2' }).fill('Respiração');
  await expect(page.getByRole('button', { name: /^Seção 3 de 3: Seção 3.*Respiração/ })).toBeVisible();
  // O item que ficou sem nome diz o que falta no próprio campo.
  await expect(page.getByText('Informe o nome.', { exact: true })).toHaveCount(1);
  await semEstouro(page);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('1920: configuração ao lado das Orientações e os três campos do item numa linha', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1920);
  const config = await page.getByRole('textbox', { name: 'Título', exact: true }).boundingBox();
  const orientacoes = await page.getByRole('textbox', { name: 'Orientações (opcional)' }).boundingBox();
  if (!config || !orientacoes) throw new Error('sem a linha de cima');
  // A configuração começa aberta em duas colunas (divide a linha com as Orientações).
  expect(orientacoes.x).toBeGreaterThan(config.x + config.width);
  const caixa = async (nome: string) => (await page.getByRole('textbox', { name: nome }).boundingBox())!;
  const [nome, prescricao, video] = [await caixa('Nome do item 1'), await caixa('Prescrição do item 1'), await caixa('Vídeo do item 1 (link do YouTube, opcional)')];
  expect(Math.abs(nome.y - prescricao.y)).toBeLessThan(2);
  expect(Math.abs(nome.y - video.y)).toBeLessThan(2);
  // O inspetor vai até a beirada da área útil.
  const remover = await page.getByRole('button', { name: 'Remover Aquecimento' }).boundingBox();
  expect((remover?.x ?? 0) + (remover?.width ?? 0)).toBeGreaterThan(1850);
  await semEstouro(page);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('celular: item fechado só com o chevron, aberto com Subir, Descer e Remover, e Desfazer (390px)', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 390);
  await expect(page.getByRole('button', { name: /^Seção \d de/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Subir Lunge' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Abrir Lunge' }).click();
  await expect(page.getByRole('textbox', { name: 'Nome do item 2' })).toHaveValue('Lunge');
  await page.getByRole('button', { name: 'Subir Lunge' }).click();
  await expect(page.getByRole('textbox', { name: 'Nome do item 1' })).toHaveValue('Lunge');
  await page.getByRole('button', { name: 'Remover Lunge' }).click();
  await expect(page.getByText('Item “Lunge” removido.')).toBeVisible();
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByRole('textbox', { name: 'Nome do item 1' })).toHaveValue('Lunge');
  await expect(page.getByRole('button', { name: 'Abrir todos' })).toBeVisible();

  // Empilhado as seções ficam abertas uma embaixo da outra: o aviso aparece onde estava o que saiu, à vista.
  await page.getByRole('button', { name: 'Abrir Posterior' }).click();
  await page.getByRole('button', { name: 'Remover Posterior' }).click();
  await expect(page.getByText('Item “Posterior” removido.')).toBeInViewport();
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await page.getByRole('button', { name: 'Remover Alongamento' }).click();
  await expect(page.getByText('Seção “Alongamento” removida, com 1 item.')).toBeInViewport();
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByRole('textbox', { name: 'Título da seção 2' })).toHaveValue('Alongamento');
  await semEstouro(page);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
