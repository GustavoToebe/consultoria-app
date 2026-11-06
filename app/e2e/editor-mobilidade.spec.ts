import { expect, test, type Page } from '@playwright/test';

import type { ConteudoMobilidadeApi, PlanoDetalhe, Receita } from '../src/api/tipos';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Editor de mobilidade do treinador. Revisão dos editores (passo 3, 04/11): seção no inspetor com "Seção N de M", itens
 * sempre abertos em duas colunas (nome uma vez só, no campo), remover seção e item com "Desfazer" (sem painel de
 * confirmação; empilhado, o aviso fica onde estava o que saiu), adicionar seção só no bloco do fim da lista e a largura
 * usada em 1920 (configuração ao lado das Orientações, os três campos do item numa linha). Ajustes de 04/11 da `main`:
 * "Modelos" ao lado de "Seções" (usar um modelo com Desfazer e salvar o rascunho como modelo), PDF na barra, Orientações
 * recolhidas quando vazias e Nome e Prescrição do item na mesma linha onde cabem. Dados fictícios. Com `CAPTURAS=<pasta>`,
 * guarda as telas.
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

const detalhe = (conteudo: ConteudoMobilidadeApi, publicado: boolean): PlanoDetalhe<ConteudoMobilidadeApi> => ({
  plano: {
    id: MOB_ID, alunoId: ALUNO_ID, pastaId: null, titulo: 'Mobilidade de teste', inicio: '2026-11-01', fim: '2026-11-30', ativo: true,
    versaoPublicada: publicado ? 1 : 0, publicadoEm: publicado ? '2026-11-01T12:00:00Z' : null, rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho: conteudo,
  versoes: publicado ? [{ id: 'v0000000-0000-4000-8000-0000000000m1', numero: 1, publicadoEm: '2026-11-01T12:00:00Z' }] : [],
});

const MODELO: Receita = {
  id: 'r0000000-0000-4000-8000-0000000000m1', tipo: 'MOBILIDADE', nome: 'Mobilidade de quadril', descricao: 'Modelo fictício.',
  conteudo: { orientacoes: 'Do modelo', secoes: [{ uid: 'm1', titulo: 'Quadril', itens: [{ uid: 'm2', nome: 'Noventa-noventa', prescricao: '3 x 30s', videoUrl: null }] }] },
  ordem: 0, pastaId: null, versao: 1,
};

async function abrir(page: Page, largura: number, { escuro = false, conteudo = MOBILIDADE, publicado = false, extra = {} }:
  { escuro?: boolean; conteudo?: ConteudoMobilidadeApi; publicado?: boolean; extra?: RespostasApi } = {}) {
  await page.setViewportSize({ width: largura, height: 1000 });
  if (escuro) await page.addInitScript(([id]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), [TREINADOR.id]);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR'] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    [`GET /planos-mobilidade/${MOB_ID}`]: { corpo: detalhe(conteudo, publicado) },
    ...extra,
  });
  await page.goto(`/treinador/mobilidades/${MOB_ID}`);
  await expect(page.getByRole('heading', { name: `Seções (${conteudo.secoes.length})` })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  return api;
}

/** Nenhum botão ou campo passa da borda da janela (a rolagem do RN-web é de um div interno, não do documento). */
async function semEstouro(page: Page) {
  const fora = await page.evaluate(() => Array.from(document.querySelectorAll('button, input, textarea, [role="button"]'))
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > window.innerWidth + 1; }).length);
  expect(fora).toBe(0);
}

async function capturar(page: Page, nome: string) {
  const pasta = process.env.CAPTURAS;
  if (!pasta) return;
  // A rolagem é de um ScrollView: a tela alta mostra o editor inteiro numa captura.
  const { width } = page.viewportSize() ?? { width: 1280 };
  await page.setViewportSize({ width, height: 1800 });
  await page.screenshot({ path: `${pasta}/${nome}.png` });
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

test('seção sem item acende o "Corrigir" e o Desfazer o apaga (1280px)', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280);
  await expect(page.getByText('Corrigir', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^Seção 2 de 2: Alongamento/ }).click();
  await page.getByRole('button', { name: 'Remover Posterior' }).click();
  // A API recusa "Seção sem item.": a tela já acusa antes de salvar ou publicar.
  await expect(page.getByText('Seção sem item. Adicione ao menos um.')).toBeVisible();
  await expect(page.getByText('Corrigir', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByText('Seção sem item. Adicione ao menos um.')).toHaveCount(0);
  await expect(page.getByText('Corrigir', { exact: true })).toHaveCount(0);
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

for (const [largura, escuro] of [[1280, false], [1280, true], [390, false], [390, true]] as const) {
  const sufixo = `${largura}${escuro ? '-escuro' : ''}`;
  test(`mobilidade: barra com PDF, Modelos, Orientações recolhidas e Nome e Prescrição ${largura >= 1280 ? 'lado a lado' : 'empilhados'} (${largura}px${escuro ? ', escuro' : ''})`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, largura, { escuro, publicado: true, conteudo: { ...MOBILIDADE, orientacoes: null } });
    // PDF da versão publicada: botão com texto no PC, ícone no celular.
    await expect(largura >= 1280 ? page.getByRole('button', { name: 'PDF v1' }) : page.getByRole('button', { name: 'PDF da versão 1' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Modelos' })).toBeVisible();
    // Orientações vazias: só a faixa, recolhida.
    await expect(page.getByRole('button', { name: 'Orientações, recolhido' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Orientações (opcional)' })).toHaveCount(0);

    // No inspetor (1280) o item já está aberto; empilhado, abre no chevron.
    if (largura < 1280) await page.getByRole('button', { name: 'Abrir Gato-vaca' }).click();
    const nome = page.getByRole('textbox', { name: 'Nome do item 1' });
    const prescricao = page.getByRole('textbox', { name: 'Prescrição do item 1' });
    const video = page.getByRole('textbox', { name: 'Vídeo do item 1 (link do YouTube, opcional)' });
    await expect(nome).toHaveValue('Gato-vaca');
    const [n, p, v] = [await nome.boundingBox(), await prescricao.boundingBox(), await video.boundingBox()];
    if (!n || !p || !v) throw new Error('campos do item sem caixa');
    if (largura >= 1280) {
      expect(Math.abs(n.y - p.y)).toBeLessThan(2);
      expect(p.x).toBeGreaterThan(n.x + n.width);
    } else {
      expect(p.y).toBeGreaterThan(n.y + n.height);
    }
    expect(v.y).toBeGreaterThan(Math.max(n.y + n.height, p.y + p.height));
    // Nada passa da largura da tela.
    expect(p.x + p.width).toBeLessThanOrEqual(largura);
    await semEstouro(page);
    await capturar(page, `mobilidade-${sufixo}`);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('mobilidade: Orientações com texto já abrem expandidas', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280, { conteudo: { ...MOBILIDADE, orientacoes: 'Faça antes do treino.' } });
  await expect(page.getByRole('button', { name: 'Orientações, expandido' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Orientações (opcional)' })).toHaveValue('Faça antes do treino.');
  // Recolher continua possível.
  await page.getByRole('button', { name: 'Orientações, expandido' }).click();
  await expect(page.getByRole('textbox', { name: 'Orientações (opcional)' })).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('mobilidade: Modelos usa um modelo no rascunho e o Desfazer volta ao que era', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280, {
    conteudo: { ...MOBILIDADE, orientacoes: null },
    extra: { 'GET /receitas': (p, route) => json(route, p.busca.get('tipo') === 'MOBILIDADE' ? [MODELO] : []) },
  });
  await page.getByRole('button', { name: 'Modelos' }).click();
  const folha = page.getByRole('dialog', { name: 'Modelos' });
  await expect(folha.getByRole('button', { name: 'Usar modelo de mobilidade' })).toBeVisible();
  await expect(folha.getByRole('button', { name: 'Salvar como modelo de mobilidade' })).toBeVisible();
  await capturar(page, 'mobilidade-folha-modelos-1280');
  await folha.getByRole('button', { name: 'Usar modelo de mobilidade' }).click();
  await expect(page.getByText('Mobilidade de quadril')).toBeVisible();
  await page.getByRole('button', { name: 'Usar este modelo' }).click();
  await expect(page.getByRole('heading', { name: 'Seções (1)' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Título da seção 1' })).toHaveValue('Quadril');
  await expect(page.getByText('Modelo “Mobilidade de quadril” aplicado.')).toBeVisible();
  // As orientações do plano (vazias) ficam: o cartão continua recolhido.
  await expect(page.getByRole('button', { name: 'Orientações, recolhido' })).toBeVisible();
  await capturar(page, 'mobilidade-modelo-aplicado-1280');
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByRole('heading', { name: 'Seções (2)' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Título da seção 1' })).toHaveValue('Aquecimento');
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('mobilidade: Modelos salva o rascunho como modelo de mobilidade', async ({ page }) => {
  const pedidos: unknown[] = [];
  const { naoTratadas, errosDaPagina } = await abrir(page, 390, {
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
