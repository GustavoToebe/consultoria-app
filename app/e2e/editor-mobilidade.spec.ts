import { expect, test, type Page } from '@playwright/test';

import type { ConteudoMobilidadeApi, PlanoDetalhe, Receita } from '../src/api/tipos';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { ALUNO_ID } from './editor-inspetor.dados';

/**
 * Editor da mobilidade do aluno (ajustes de 04/11): "Modelos" ao lado de "Seções" (usar um modelo com Desfazer e salvar o
 * rascunho como modelo), PDF na barra, Orientações recolhidas quando vazias e Nome e Prescrição do item na mesma linha
 * onde cabem. Dados fictícios. Com `CAPTURAS=<pasta>`, guarda as telas.
 */

const MOB_ID = 'p0000000-0000-4000-8000-0000000000f1';

const CONTEUDO: ConteudoMobilidadeApi = {
  orientacoes: null,
  secoes: [
    { uid: 's1', titulo: 'Aquecimento', itens: [
      { uid: 'i1', nome: 'Gato-vaca', prescricao: '2 x 10', videoUrl: null },
      { uid: 'i2', nome: 'Lunge', prescricao: '2 x 20s cada lado', videoUrl: null },
    ] },
    { uid: 's2', titulo: 'Alongamento', itens: [{ uid: 'i3', nome: 'Borboleta', prescricao: '30s', videoUrl: null }] },
  ],
};

const detalhe = (conteudo: ConteudoMobilidadeApi): PlanoDetalhe<ConteudoMobilidadeApi> => ({
  plano: {
    id: MOB_ID, alunoId: ALUNO_ID, pastaId: null, titulo: 'Mobilidade de teste', inicio: '2026-11-01', fim: '2026-11-30', ativo: true,
    versaoPublicada: 1, publicadoEm: '2026-11-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho: conteudo,
  versoes: [{ id: 'v0000000-0000-4000-8000-0000000000f1', numero: 1, publicadoEm: '2026-11-01T12:00:00Z' }],
});

const MODELO: Receita = {
  id: 'r0000000-0000-4000-8000-0000000000f1', tipo: 'MOBILIDADE', nome: 'Mobilidade de quadril', descricao: 'Modelo fictício.',
  conteudo: { orientacoes: 'Do modelo', secoes: [{ uid: 'm1', titulo: 'Quadril', itens: [{ uid: 'm2', nome: 'Noventa-noventa', prescricao: '3 x 30s', videoUrl: null }] }] },
  ordem: 0, pastaId: null, versao: 1,
};

async function abrir(page: Page, { largura, escuro = false, conteudo = CONTEUDO, extra = {} }: { largura: number; escuro?: boolean; conteudo?: ConteudoMobilidadeApi; extra?: RespostasApi }) {
  await page.setViewportSize({ width: largura, height: 1000 });
  if (escuro) await page.addInitScript(([id]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), [TREINADOR.id]);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR'] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    [`GET /planos-mobilidade/${MOB_ID}`]: { corpo: detalhe(conteudo) },
    ...extra,
  });
  await page.goto(`/treinador/mobilidades/${MOB_ID}`);
  await expect(page.getByRole('heading', { name: /^Seções \(\d\)$/ })).toBeVisible();
  return api;
}

async function capturar(page: Page, nome: string) {
  const pasta = process.env.CAPTURAS;
  if (!pasta) return;
  // A rolagem é de um ScrollView: a tela alta mostra o editor inteiro numa captura.
  const { width } = page.viewportSize() ?? { width: 1280 };
  await page.setViewportSize({ width, height: 1800 });
  await page.screenshot({ path: `${pasta}/${nome}.png` });
}

for (const [largura, escuro] of [[1280, false], [1280, true], [390, false], [390, true]] as const) {
  const sufixo = `${largura}${escuro ? '-escuro' : ''}`;
  test(`mobilidade: barra com PDF, Modelos, Orientações recolhidas e Nome e Prescrição ${largura >= 1280 ? 'lado a lado' : 'empilhados'} (${largura}px${escuro ? ', escuro' : ''})`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, { largura, escuro });
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    // PDF da versão publicada: botão com texto no PC, ícone no celular.
    await expect(largura >= 1280 ? page.getByRole('button', { name: 'PDF v1' }) : page.getByRole('button', { name: 'PDF da versão 1' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Modelos' })).toBeVisible();
    // Orientações vazias: só a faixa, recolhida.
    await expect(page.getByRole('button', { name: 'Orientações, recolhido' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Orientações (opcional)' })).toHaveCount(0);

    await page.getByRole('button', { name: '1. Gato-vaca, fechado' }).click();
    const nome = page.getByRole('textbox', { name: 'Nome do exercício' });
    const prescricao = page.getByRole('textbox', { name: 'Prescrição (ex.: 2 x 20s cada lado)' });
    const video = page.getByRole('textbox', { name: 'Vídeo (link do YouTube, opcional)' });
    await expect(nome).toHaveValue('Gato-vaca');
    const [n, p, v] = [await nome.boundingBox(), await prescricao.boundingBox(), await video.boundingBox()];
    if (!n || !p || !v) throw new Error('campos do item sem caixa');
    if (largura >= 1280) {
      expect(Math.abs(n.y - p.y)).toBeLessThan(2);
      expect(p.x).toBeGreaterThan(n.x + n.width);
      // O nome é o campo largo (flex 2 contra 1).
      expect(n.width).toBeGreaterThan(p.width);
    } else {
      expect(p.y).toBeGreaterThan(n.y + n.height);
    }
    expect(v.y).toBeGreaterThan(Math.max(n.y + n.height, p.y + p.height));
    // Nada passa da largura da tela.
    expect(p.x + p.width).toBeLessThanOrEqual(largura);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura);
    await capturar(page, `mobilidade-${sufixo}`);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('mobilidade: Orientações com texto já abrem expandidas', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, { largura: 1280, conteudo: { ...CONTEUDO, orientacoes: 'Faça antes do treino.' } });
  await expect(page.getByRole('button', { name: 'Orientações, expandido' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Orientações (opcional)' })).toHaveValue('Faça antes do treino.');
  // Recolher continua possível.
  await page.getByRole('button', { name: 'Orientações, expandido' }).click();
  await expect(page.getByRole('textbox', { name: 'Orientações (opcional)' })).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('mobilidade: Modelos usa um modelo no rascunho e o Desfazer volta ao que era', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, {
    largura: 1280,
    extra: { 'GET /receitas': (p, route) => json(route, p.busca.get('tipo') === 'MOBILIDADE' ? [MODELO] : []) },
  });
  await expect(page.getByRole('heading', { name: 'Seções (2)' })).toBeVisible();
  await page.getByRole('button', { name: 'Modelos' }).click();
  const folha = page.getByRole('dialog', { name: 'Modelos' });
  await expect(folha.getByRole('button', { name: 'Usar modelo de mobilidade' })).toBeVisible();
  await expect(folha.getByRole('button', { name: 'Salvar como modelo de mobilidade' })).toBeVisible();
  await capturar(page, 'mobilidade-folha-modelos-1280');
  await folha.getByRole('button', { name: 'Usar modelo de mobilidade' }).click();
  await expect(page.getByText('Mobilidade de quadril')).toBeVisible();
  await page.getByRole('button', { name: 'Usar este modelo' }).click();
  await expect(page.getByRole('heading', { name: 'Seções (1)' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Seção 1' })).toHaveValue('Quadril');
  await expect(page.getByText('Modelo “Mobilidade de quadril” aplicado.')).toBeVisible();
  // As orientações do plano (vazias) ficam: o cartão continua recolhido.
  await expect(page.getByRole('button', { name: 'Orientações, recolhido' })).toBeVisible();
  await capturar(page, 'mobilidade-modelo-aplicado-1280');
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByRole('heading', { name: 'Seções (2)' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Seção 1' })).toHaveValue('Aquecimento');
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('mobilidade: Modelos salva o rascunho como modelo de mobilidade', async ({ page }) => {
  const pedidos: unknown[] = [];
  const { naoTratadas, errosDaPagina } = await abrir(page, {
    largura: 390,
    extra: {
      [`POST /planos-mobilidade/${MOB_ID}/salvar-como-receita`]: (p, route) => { pedidos.push(p.corpo); return json(route, { ...MODELO, nome: 'Rotina da manhã' }); },
    },
  });
  await page.getByRole('button', { name: 'Modelos' }).click();
  await page.getByRole('dialog', { name: 'Modelos' }).getByRole('button', { name: 'Salvar como modelo de mobilidade' }).click();
  const folha = page.getByRole('dialog', { name: 'Salvar como modelo de mobilidade' });
  await expect(folha.getByRole('button', { name: 'Salvar modelo' })).toBeDisabled();
  await folha.getByRole('textbox', { name: 'Nome do modelo' }).fill('Rotina da manhã');
  await folha.getByRole('button', { name: 'Salvar modelo' }).click();
  await expect(page.getByText('Modelo de mobilidade salvo no Planejamento.')).toBeVisible();
  expect(pedidos).toEqual([{ nome: 'Rotina da manhã', descricao: null }]);
  await expect(page.getByRole('dialog', { name: 'Salvar como modelo de mobilidade' })).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
