import { expect, test, type Locator, type Page } from '@playwright/test';

import type { ConteudoMobilidadeApi, PlanoDetalhe, Receita } from '../src/api/tipos';
import { colunasDaMobilidade } from '../src/dominio/colunasDaMobilidade';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Editor de mobilidade do treinador: mobilidade no padrão do editor (19/11). No topo, um cartão só (no modelo, "Sobre o
 * modelo" com Nome e Descrição lado a lado e, embaixo, as Orientações como campo normal que cresce com o texto (26/11); no
 * plano do aluno, a Configuração do plano com as Orientações dentro). Da faixa larga em diante (1920 e 3440), a 3ª coluna é
 * a prévia ao vivo do que o aluno vê, grudada ao rolar e rolada até a seção aberta. Seções na lista com a alça de arrastar (mouse em 1280), "Ordem alterada." com Desfazer e as setas
 * no ⋯ ("Mover para cima/baixo"); o painel da seção com "Seção N de M", o título editável no cabeçalho, ⋯ e "Excluir
 * seção" (confirma com itens). Itens em tabela (cabeçalho uma vez, faixas, alça, número e ⋯ com mover e "Excluir item");
 * o vídeo vazio, "Vídeo adicionado" (Abrir e Trocar) ou o erro em vermelho ("Link inválido" na tabela, "Link do YouTube
 * inválido" empilhado), que trava o salvar; estreito, o item empilhado com
 * os rótulos. "Adicionar item" leva o foco ao Nome do novo. Dados fictícios. Com `CAPTURAS=<pasta>`, guarda as telas.
 */

const ALUNO_ID = 'a0000000-0000-4000-8000-0000000000m1';
const MOB_ID = 'p0000000-0000-4000-8000-0000000000m1';
const MODELO_ID = 'r0000000-0000-4000-8000-0000000000m2';
const VIDEO = 'https://youtu.be/exemploFicticio';

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

/** A seção das capturas: um item com vídeo válido, um sem vídeo e um com link inválido. */
const COM_VIDEOS: ConteudoMobilidadeApi = {
  orientacoes: 'Faça antes do treino, sem pressa, respirando fundo em cada posição.',
  secoes: [
    { uid: 's1', titulo: 'Aquecimento', itens: [
      { uid: 'i1', nome: 'Gato-vaca', prescricao: '2 x 10', videoUrl: VIDEO },
      { uid: 'i2', nome: 'Lunge', prescricao: '2 x 20s cada lado', videoUrl: null },
      { uid: 'i3', nome: 'Rotação torácica', prescricao: '2 x 8 cada lado', videoUrl: 'https://exemplo.com/video' },
    ] },
    { uid: 's2', titulo: 'Alongamento', itens: [{ uid: 'i4', nome: 'Posterior', prescricao: '30s', videoUrl: null }] },
    { uid: 's3', titulo: 'Respiração', itens: [{ uid: 'i5', nome: 'Respiração diafragmática', prescricao: '2 min', videoUrl: null }] },
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
  id: 'r0000000-0000-4000-8000-0000000000m1', tipo: 'MOBILIDADE', origem: 'CONSULTORIA', nome: 'Mobilidade de quadril', descricao: 'Modelo fictício.',
  conteudo: { orientacoes: 'Do modelo', secoes: [{ uid: 'm1', titulo: 'Quadril', itens: [{ uid: 'm2', nome: 'Noventa-noventa', prescricao: '3 x 30s', videoUrl: null }] }] },
  ordem: 0, pastaId: null, versao: 1,
};

const tema = (page: Page, escuro: boolean) => (escuro
  ? page.addInitScript(([id]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), [TREINADOR.id])
  : Promise.resolve());

async function abrir(page: Page, largura: number, { escuro = false, conteudo = MOBILIDADE, publicado = false, extra = {} }:
  { escuro?: boolean; conteudo?: ConteudoMobilidadeApi; publicado?: boolean; extra?: RespostasApi } = {}) {
  await page.setViewportSize({ width: largura, height: 1000 });
  await tema(page, escuro);
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

/** O editor do modelo de mobilidade do Planejamento (a tela do pedido de 19/11). */
async function abrirModelo(page: Page, largura: number, { escuro = false, conteudo = COM_VIDEOS, salvar }: { escuro?: boolean; conteudo?: ConteudoMobilidadeApi; salvar?: unknown[] } = {}) {
  await page.setViewportSize({ width: largura, height: 1000 });
  await tema(page, escuro);
  const modelo: Receita = { id: MODELO_ID, tipo: 'MOBILIDADE', origem: 'CONSULTORIA', nome: 'Rotina fictícia da manhã', descricao: 'Para os dias de treino de pernas.', conteudo, ordem: 0, pastaId: null, versao: 1 };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /pastas-modelos': { corpo: [] },
    'GET /receitas': { corpo: [] },
    [`GET /receitas/${MODELO_ID}`]: (_p, route) => json(route, modelo),
    [`PUT /receitas/${MODELO_ID}`]: (p, route) => { salvar?.push(p.corpo); return json(route, { ...modelo, versao: 2 }); },
  });
  await page.goto(`/treinador/planejamento/modelo/${MODELO_ID}`);
  await expect(page.getByRole('heading', { name: 'Sobre o modelo' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  return api;
}

/** Nenhum botão ou campo passa da borda da janela (a rolagem do RN-web é de um div interno, não do documento). */
async function semEstouro(page: Page) {
  const fora = await page.evaluate(() => Array.from(document.querySelectorAll('button, input, textarea, [role="button"]'))
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > window.innerWidth + 1; }).length);
  expect(fora).toBe(0);
}

async function capturar(page: Page, nome: string, altura = 1800) {
  const pasta = process.env.CAPTURAS;
  if (!pasta) return;
  // A rolagem é de um ScrollView: a tela alta mostra o editor inteiro numa captura.
  const { width } = page.viewportSize() ?? { width: 1280 };
  await page.setViewportSize({ width, height: altura });
  await page.screenshot({ path: `${pasta}/${nome}.png` });
}

/** Segura a alça e leva o ponteiro, em passos, até o topo do `alvo` (o mesmo de `arrastar.spec.ts`). */
async function arrastar(page: Page, alca: Locator, alvo: Locator) {
  await alca.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const de = (await alca.boundingBox())!;
  const y = (await alvo.boundingBox())!.y + 4;
  const x = de.x + de.width / 2;
  const y0 = de.y + de.height / 2;
  await page.mouse.move(x, y0);
  await page.mouse.down();
  for (let k = 1; k <= 10; k += 1) await page.mouse.move(x, y0 + ((y - y0) * k) / 10);
  await page.mouse.up();
}

const lista = (page: Page) => page.getByRole('group', { name: 'Seções da mobilidade' });
const ordemDasSecoes = (page: Page) => lista(page).getByRole('button').evaluateAll((bs) => bs.map((b) => (b.getAttribute('aria-label') ?? '').replace(/^Seção \d+ de \d+: ([^.,]+).*$/, '$1')));
/** O ⋯ de um item ou seção e a ação da folha que ele abre. */
async function noMenu(page: Page, de: string, acao: string) {
  await page.getByRole('button', { name: `Mais ações de ${de}` }).click();
  await page.getByRole('dialog').getByRole('button', { name: new RegExp(`^${acao}`) }).click();
}

test('seções: arrastar pela alça com o mouse, Ordem alterada com Desfazer e Mover pelo ⋯ (1280px)', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280);
  expect(await ordemDasSecoes(page)).toEqual(['Aquecimento', 'Alongamento']);
  // O item escolhido é o em edição (o selo "Editando" só na lista); a alça fica fora da árvore de acessibilidade.
  await expect(page.getByRole('button', { name: /^Seção 1 de 2: Aquecimento/ })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByText('Editando', { exact: true })).toHaveCount(1);
  const alcas = lista(page).getByTestId('alca-de-arraste');
  await expect(alcas).toHaveCount(2);
  await expect(alcas.first()).toHaveAttribute('aria-hidden', 'true');
  await arrastar(page, alcas.nth(1), page.getByRole('button', { name: /^Seção 1 de 2: Aquecimento/ }));
  expect(await ordemDasSecoes(page)).toEqual(['Alongamento', 'Aquecimento']);
  const aviso = page.getByRole('alert').filter({ hasText: 'Ordem alterada.' });
  await expect(aviso).toBeVisible();
  await aviso.getByRole('button', { name: 'Desfazer' }).click();
  expect(await ordemDasSecoes(page)).toEqual(['Aquecimento', 'Alongamento']);

  // Sem arrastar: "Mover para baixo" no ⋯ do painel, com o nome acessível de antes no detalhe ("Descer …").
  await page.getByRole('button', { name: 'Mais ações de Aquecimento' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /Mover para cima/ })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Mover para baixo, Descer Aquecimento uma posição.' }).click();
  expect(await ordemDasSecoes(page)).toEqual(['Alongamento', 'Aquecimento']);
  await expect(page.getByText('Seção 2 de 2', { exact: true })).toBeVisible();
  // O título é editável no cabeçalho do painel (um campo só, sem o repetido embaixo).
  await page.getByRole('textbox', { name: 'Título da seção 2' }).fill('Aquecimento leve');
  await expect(page.getByRole('button', { name: /^Seção 2 de 2: Aquecimento leve/ })).toBeVisible();
  await semEstouro(page);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('excluir seção: confirma com itens, sai direto vazia, e Desfazer (1280px)', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280);
  await page.getByRole('button', { name: 'Excluir seção: Aquecimento' }).click();
  const painel = page.getByRole('alertdialog');
  await expect(painel.getByText('Os 2 itens dela saem junto. Dá para desfazer logo depois.')).toBeVisible();
  await painel.getByRole('button', { name: 'Excluir seção' }).click();
  await expect(page.getByText('Seção “Aquecimento” removida, com 2 itens.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Seção 1 de 1: Alongamento/ })).toHaveAttribute('aria-current', 'true');
  // A única seção não sai: sem "Excluir seção" nem ⋯.
  await expect(page.getByRole('button', { name: /^Excluir seção/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByRole('button', { name: /^Seção 1 de 2: Aquecimento/ })).toHaveAttribute('aria-current', 'true');

  // Seção nova (vazia de nome) com um item vazio: o item sai pelo ⋯ e a seção sem item sai sem perguntar.
  await page.getByRole('button', { name: 'Adicionar seção' }).click();
  await expect(page.getByRole('button', { name: /^Seção 3 de 3: Seção 3/ })).toHaveAttribute('aria-current', 'true');
  await noMenu(page, 'item 1', 'Excluir item');
  await expect(page.getByText('Seção sem item. Adicione ao menos um.')).toBeVisible();
  await expect(page.getByText('Corrigir', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Excluir seção: Seção 3' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Seções (2)' })).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('itens em tabela: cabeçalho uma vez, ⋯ com mover e excluir, Adicionar item foca o Nome (1280px)', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280);
  // Cabeçalho das colunas fora do leitor de tela; os campos sem rótulo à vista, com o nome acessível de sempre.
  for (const coluna of ['#', 'Nome', 'Prescrição', 'Vídeo']) await expect(page.getByText(coluna, { exact: true })).toHaveCount(1);
  const [nome, prescricao, video] = await Promise.all(['Nome do item 1', 'Prescrição do item 1', 'Vídeo do item 1 (link do YouTube, opcional)']
    .map(async (n) => (await page.getByRole('textbox', { name: n }).boundingBox())!));
  expect(Math.abs(nome.y - prescricao.y)).toBeLessThan(2);
  expect(Math.abs(nome.y - video.y)).toBeLessThan(2);
  // Nome e Prescrição maiores que o Vídeo.
  expect(nome.width).toBeGreaterThan(video.width);
  expect(Math.abs(nome.width - prescricao.width)).toBeLessThan(2);
  await expect(page.getByRole('textbox', { name: 'Vídeo do item 1 (link do YouTube, opcional)' })).toHaveAttribute('placeholder', 'Link do YouTube');

  await noMenu(page, 'Lunge', 'Mover para cima');
  await expect(page.getByRole('textbox', { name: 'Nome do item 1' })).toHaveValue('Lunge');
  await noMenu(page, 'Lunge', 'Excluir item');
  await expect(page.getByText('Item “Lunge” removido.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Nome do item 2' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByRole('textbox', { name: 'Nome do item 1' })).toHaveValue('Lunge');

  // Arrastar o item pela alça (a mesma regra do ⋯).
  const alcasDosItens = page.locator('[id^="secao-"]').getByTestId('alca-de-arraste');
  await arrastar(page, alcasDosItens.nth(1), page.getByRole('textbox', { name: 'Nome do item 1' }));
  await expect(page.getByRole('textbox', { name: 'Nome do item 1' })).toHaveValue('Gato-vaca');

  await page.getByRole('button', { name: 'Adicionar item em Aquecimento' }).click();
  await expect(page.getByRole('textbox', { name: 'Nome do item 3' })).toBeFocused();
  await page.keyboard.type('Respiração');
  await expect(page.getByRole('button', { name: /^Seção 1 de 2: Aquecimento.*Respiração/ })).toBeVisible();
  await semEstouro(page);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('vídeo: vazio com o placeholder, válido vira "Vídeo adicionado" (Abrir e Trocar) e inválido avisa (1280px)', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280, { conteudo: COM_VIDEOS });
  await page.context().route('https://youtu.be/**', (r) => r.fulfill({ body: '' }));
  await expect(page.getByText('Vídeo adicionado', { exact: true })).toHaveCount(1);
  await expect(page.getByRole('textbox', { name: 'Vídeo do item 1 (link do YouTube, opcional)' })).toHaveCount(0);
  await expect(page.getByText('Link inválido', { exact: true })).toBeVisible();
  // Abrir: nova aba com o link, fora do app.
  const [aba] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Abrir vídeo do item 1 (nova aba)' }).click()]);
  // O popup nasce em about:blank e só depois navega: esperar a URL, não lê-la no evento.
  await aba.waitForURL(/youtu\.be\/exemploFicticio/);
  await aba.close();
  // Trocar: o campo volta com o foco e o link de agora; fora do foco, a linha compacta volta.
  await page.getByRole('button', { name: 'Trocar vídeo do item 1' }).click();
  const campo = page.getByRole('textbox', { name: 'Vídeo do item 1 (link do YouTube, opcional)' });
  await expect(campo).toBeFocused();
  await expect(campo).toHaveValue(VIDEO);
  await page.keyboard.press('Tab');
  await expect(page.getByText('Vídeo adicionado', { exact: true })).toHaveCount(1);
  // Digitar um link válido no item vazio: enquanto o campo tem o foco ele continua campo.
  const vazio = page.getByRole('textbox', { name: 'Vídeo do item 2 (link do YouTube, opcional)' });
  await vazio.click();
  await vazio.pressSequentially('https://youtu.be/outroFicticio');
  await expect(vazio).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByText('Vídeo adicionado', { exact: true })).toHaveCount(2);
  // Corrigir o inválido apaga o aviso.
  await page.getByRole('textbox', { name: 'Vídeo do item 3 (link do YouTube, opcional)' }).fill('');
  await expect(page.getByText('Link inválido', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Vídeo do item 3 (link do YouTube, opcional)' })).toHaveAttribute('aria-invalid', 'false');
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

// D8 decidida em 19/11: link inválido é erro (vermelho, 4.5), porque trava o salvar; na coluna Vídeo de 1280 tudo curto.
for (const escuro of [false, true]) {
  test(`vídeo: link inválido em vermelho, "Link inválido" e "Link do YouTube" sem corte nem quebra, salvar travado (1280px, ${escuro ? 'escuro' : 'claro'})`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrirModelo(page, 1280, { escuro });
    const selo = page.getByText('Link inválido', { exact: true });
    await expect(selo).toHaveCount(1);
    await expect(page.getByText('Link do YouTube inválido', { exact: true })).toHaveCount(0);
    // Mesma cor do "Corrigir" da seção (token `perigo`), no texto do selo e na borda do campo; o campo vai ao leitor como inválido.
    const perigo = await page.getByText('Corrigir', { exact: true }).first().evaluate((e) => getComputedStyle(e).color);
    expect(await selo.evaluate((e) => getComputedStyle(e).color)).toBe(perigo);
    const invalido = page.getByRole('textbox', { name: 'Vídeo do item 3 (link do YouTube, opcional)' });
    await expect(invalido).toHaveAttribute('aria-invalid', 'true');
    expect(await invalido.evaluate((e) => getComputedStyle(e).borderTopColor)).toBe(perigo);
    const idDoSelo = await invalido.getAttribute('aria-describedby');
    await expect(page.locator(`[id="${idDoSelo}"]`)).toHaveText('Link inválido');
    // O selo numa linha só, sem cortar.
    const seloInteiro = await selo.evaluate((e) => e.scrollWidth <= e.clientWidth && e.getBoundingClientRect().height < parseFloat(getComputedStyle(e).lineHeight) * 1.5);
    expect(seloInteiro).toBe(true);
    // O placeholder curto cabe na caixa (o `scrollWidth` do input não mede o placeholder: mede no canvas com a fonte dele).
    const vazio = page.getByRole('textbox', { name: 'Vídeo do item 2 (link do YouTube, opcional)' });
    await expect(vazio).toHaveAttribute('placeholder', 'Link do YouTube');
    const folga = await vazio.evaluate((e) => {
      const input = e as HTMLInputElement;
      const s = getComputedStyle(input);
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.font = s.font;
      return input.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) - ctx.measureText(input.placeholder).width;
    });
    expect(folga).toBeGreaterThanOrEqual(0);
    // Salvar travado, com o motivo à vista.
    await expect(page.getByRole('button', { name: 'Salvar modelo', exact: true })).toBeDisabled();
    await expect(page.getByText('Toda seção precisa de item, todo item de nome e o vídeo precisa ser do YouTube.')).toBeVisible();
    await semEstouro(page);
    await capturar(page, `mobilidade-link-invalido-1280-${escuro ? 'escuro' : 'claro'}`, 1000);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('1920: os três campos do item numa linha, em colunas de 35%, 35% e o resto', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1920);
  const caixa = async (nome: string) => (await page.getByRole('textbox', { name: nome }).boundingBox())!;
  const [nome, prescricao, video] = [await caixa('Nome do item 1'), await caixa('Prescrição do item 1'), await caixa('Vídeo do item 1 (link do YouTube, opcional)')];
  expect(Math.abs(nome.y - prescricao.y)).toBeLessThan(2);
  expect(Math.abs(nome.y - video.y)).toBeLessThan(2);
  // 35 : 35 : 30 das colunas que crescem; o ⋯ fecha a linha na borda do painel.
  const total = nome.width + prescricao.width + video.width;
  expect(nome.width / total).toBeCloseTo(0.35, 1);
  expect(Math.abs(nome.width - prescricao.width)).toBeLessThan(2);
  expect(video.width / total).toBeCloseTo(0.3, 1);
  const painel = (await page.locator('[id^="secao-"]').first().boundingBox())!;
  const mais = (await page.getByRole('button', { name: 'Mais ações de Gato-vaca' }).boundingBox())!;
  expect(painel.x + painel.width - (mais.x + mais.width)).toBeLessThan(40);
  await semEstouro(page);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('celular: cartões empilhados com a alça no cabeçalho, item com os rótulos à vista, mover pelo ⋯ e Desfazer (390px)', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 390);
  await expect(page.getByRole('button', { name: /^Seção \d de/ })).toHaveCount(0);
  // Empilhado: o número por extenso no cabeçalho, sem faixa de edição; os campos com o rótulo em cima.
  await expect(page.getByText('Seção 1 de 2', { exact: true })).toBeVisible();
  await expect(page.getByText('Prescrição', { exact: true }).first()).toBeVisible();
  // Empilhadas, cada seção tem o seu "item 1": olha a primeira.
  const primeira = page.locator('[id^="secao-"]').first();
  const [n, p] = [await primeira.getByRole('textbox', { name: 'Nome do item 1' }).boundingBox(), await primeira.getByRole('textbox', { name: 'Prescrição do item 1' }).boundingBox()];
  expect(p!.y).toBeGreaterThan(n!.y + n!.height);
  await noMenu(page, 'Lunge', 'Mover para cima');
  await expect(primeira.getByRole('textbox', { name: 'Nome do item 1' })).toHaveValue('Lunge');
  await noMenu(page, 'Posterior', 'Excluir item');
  await expect(page.getByText('Item “Posterior” removido.')).toBeInViewport();
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await page.getByRole('button', { name: 'Mais ações de Alongamento' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Mover para cima/ }).click();
  await expect(page.getByRole('textbox', { name: 'Título da seção 1' })).toHaveValue('Alongamento');
  await page.getByRole('button', { name: 'Excluir seção: Alongamento' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir seção' }).click();
  await expect(page.getByText('Seção “Alongamento” removida, com 1 item.')).toBeInViewport();
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByRole('textbox', { name: 'Título da seção 1' })).toHaveValue('Alongamento');
  await semEstouro(page);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('plano do aluno: Orientações dentro da Configuração do plano, como campo normal (sem o "Orientações ⌄")', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280, { conteudo: { ...MOBILIDADE, orientacoes: 'Faça antes do treino.' } });
  await page.getByRole('button', { name: 'Configuração do plano, recolhido' }).click();
  await expect(page.getByRole('textbox', { name: 'Orientações (opcional)' })).toHaveValue('Faça antes do treino.');
  await expect(page.getByRole('button', { name: /^Orientações/ })).toHaveCount(0);
  // A prévia só existe da faixa larga em diante: 1280 continua em duas colunas.
  await expect(page.getByTestId('previa-da-mobilidade')).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('modelo: "Sobre o modelo" com Nome e Descrição lado a lado pelo topo, Descrição de 1 a 4 linhas sem alça, Orientações crescendo; salvar leva tudo', async ({ page }) => {
  const pedidos: unknown[] = [];
  const { naoTratadas, errosDaPagina } = await abrirModelo(page, 1280, { conteudo: { ...MOBILIDADE, orientacoes: null }, salvar: pedidos });
  const campoNome = page.getByRole('textbox', { name: 'Nome do modelo' });
  const campoDescricao = page.getByRole('textbox', { name: 'Descrição (opcional)' });
  const campoOrientacoes = page.getByRole('textbox', { name: 'Orientações (opcional)' });
  await campoDescricao.fill('Curta.');
  const [nome, descricao] = [(await campoNome.boundingBox())!, (await campoDescricao.boundingBox())!];
  // Linha 1: lado a lado, alinhados pelo topo, 40% e 60%, e a Descrição curta com a altura do Nome.
  expect(Math.abs(nome.y - descricao.y)).toBeLessThan(2);
  expect(nome.width / (nome.width + descricao.width)).toBeCloseTo(0.4, 1);
  expect(Math.abs(nome.height - descricao.height)).toBeLessThan(2);
  expect(await campoDescricao.evaluate((e) => getComputedStyle(e).resize)).toBe('none');
  // Cresce com o texto até 4 linhas e para (depois rola por dentro); encurtar volta a 1 linha.
  await campoDescricao.fill('Rotina fictícia para os dias de pernas, com quadril, tornozelo e coluna. '.repeat(2));
  const duas = (await campoDescricao.boundingBox())!.height;
  expect(duas).toBeGreaterThan(nome.height + 8);
  await campoDescricao.fill('Rotina fictícia para os dias de pernas, com quadril, tornozelo e coluna. '.repeat(4));
  const teto = (await campoDescricao.boundingBox())!.height;
  // Quatro linhas (a altura de linha do campo, mais recuo e borda) e o resto rola por dentro.
  const quatro = await campoDescricao.evaluate((e) => {
    const cs = getComputedStyle(e);
    const px = (v: string) => parseFloat(v) || 0;
    return 4 * px(cs.lineHeight) + px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth);
  });
  expect(teto).toBeGreaterThan(duas);
  expect(teto).toBeLessThanOrEqual(quatro + 1);
  // Seis linhas curtas: para nas quatro e o resto rola por dentro.
  await campoDescricao.fill(['Um.', 'Dois.', 'Três.', 'Quatro.', 'Cinco.', 'Seis.'].join('\n'));
  expect(Math.abs((await campoDescricao.boundingBox())!.height - quatro)).toBeLessThan(2);
  expect(await campoDescricao.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
  await campoDescricao.fill('Curta.');
  await expect.poll(async () => Math.round((await campoDescricao.boundingBox())!.height)).toBe(Math.round(nome.height));
  // Linha 2: as Orientações abaixo, um campo normal (sem o "Orientações ⌄"), de 2 linhas, que cresce com o texto.
  const orientacoes = (await campoOrientacoes.boundingBox())!;
  expect(orientacoes.y).toBeGreaterThan(nome.y + nome.height);
  await expect(page.getByRole('button', { name: /^Orientações/ })).toHaveCount(0);
  // Um cartão só: nada de cartão "Orientações" separado.
  await expect(page.getByRole('heading', { name: 'Orientações' })).toHaveCount(0);
  await campoOrientacoes.fill(Array.from({ length: 5 }, (_, i) => `Linha fictícia ${i + 1}.`).join('\n'));
  expect((await campoOrientacoes.boundingBox())!.height).toBeGreaterThan(orientacoes.height + 20);
  await campoOrientacoes.fill('Sem pressa.');
  await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
  await expect(page.getByText('Modelo salvo.')).toBeVisible();
  expect(pedidos).toHaveLength(1);
  expect((pedidos[0] as { conteudo: { orientacoes: string } }).conteudo.orientacoes).toBe('Sem pressa.');
  expect((pedidos[0] as { descricao: string }).descricao).toBe('Curta.');
  await semEstouro(page);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

// Capturas do pedido de 19/11: seção com 3 itens (vídeo válido, vazio e link inválido) e as Orientações à vista (26/11).
for (const [largura, escuro] of [[1280, false], [1280, true], [390, false], [390, true]] as const) {
  const sufixo = `${largura}-${escuro ? 'escuro' : 'claro'}`;
  test(`modelo: seção com vídeo válido, vazio e inválido e as Orientações (${largura}px, ${escuro ? 'escuro' : 'claro'})`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrirModelo(page, largura, { escuro });
    await expect(page.getByText('Vídeo adicionado', { exact: true })).toHaveCount(1);
    // Na tabela (1280) o selo curto; empilhado (390) o longo, com o rótulo do campo à vista.
    await expect(page.getByText(largura < 1280 ? 'Link do YouTube inválido' : 'Link inválido', { exact: true })).toHaveCount(1);
    await expect(page.getByRole('textbox', { name: 'Vídeo do item 2 (link do YouTube, opcional)' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Orientações (opcional)' })).toHaveValue(/^Faça antes do treino/);
    await semEstouro(page);
    await capturar(page, `mobilidade-modelo-${sufixo}`, largura < 1280 ? 2600 : 1400);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('mobilidade: Modelos usa um modelo no rascunho e o Desfazer volta ao que era', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280, {
    conteudo: { ...MOBILIDADE, orientacoes: null },
    extra: { 'GET /receitas': (p, route) => json(route, p.busca.get('tipo') === 'MOBILIDADE' ? [MODELO] : []) },
  });
  await page.getByRole('button', { name: 'Modelos' }).click();
  const folha = page.getByRole('dialog', { name: 'Modelos' });
  await expect(folha.getByRole('button', { name: 'Usar modelo de mobilidade' })).toBeVisible();
  await expect(folha.getByRole('button', { name: 'Salvar como modelo de mobilidade' })).toBeVisible();
  await folha.getByRole('button', { name: 'Usar modelo de mobilidade' }).click();
  await expect(page.getByText('Mobilidade de quadril')).toBeVisible();
  await page.getByRole('button', { name: 'Usar este modelo' }).click();
  await expect(page.getByRole('heading', { name: 'Seções (1)' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Título da seção 1' })).toHaveValue('Quadril');
  await expect(page.getByText('Modelo “Mobilidade de quadril” aplicado.')).toBeVisible();
  // As orientações do plano (vazias) ficam.
  await page.getByRole('button', { name: 'Configuração do plano, recolhido' }).click();
  await expect(page.getByRole('textbox', { name: 'Orientações (opcional)' })).toHaveValue('');
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

// C61: "Adicionar seção" leva a tela até a seção nova (como o "Adicionar refeição" da dieta).
for (const [largura, altura] of [[390, 844], [1280, 720]] as const) {
  test(`adicionar seção rola até a seção nova, logo abaixo da barra (${largura}×${altura})`, async ({ page }) => {
    const itens = (n: number) => Array.from({ length: 4 }, (_, i) => ({ uid: `i${n}${i}`, nome: `Item fictício ${n}.${i}`, prescricao: '2 x 10', videoUrl: null }));
    const conteudo: ConteudoMobilidadeApi = { orientacoes: 'Antes do treino.', secoes: [1, 2, 3].map((n) => ({ uid: `s${n}`, titulo: `Seção fictícia ${n}`, itens: itens(n) })) };
    await abrir(page, largura, { conteudo });
    await page.setViewportSize({ width: largura, height: altura });
    const adicionar = page.getByRole('button', { name: 'Adicionar seção' });
    // Mouse na posição, sem o auto-rolar do `click()` (que centralizaria o botão e esconderia o defeito).
    await adicionar.evaluate((el) => el.scrollIntoView({ block: 'end' }));
    const ponto = (await adicionar.boundingBox())!;
    await page.mouse.click(ponto.x + ponto.width / 2, ponto.y + ponto.height / 2);
    await expect(page.getByRole('heading', { name: 'Seções (4)' })).toBeVisible();
    const cartao = page.locator('[id^="secao-"]').last();
    // Logo abaixo da barra grudada, ou o mais perto que a tela deixa quando a rolagem já chegou ao fim (a seção é a última da coluna).
    const noLugar = async () => {
      const [c, barra] = [await cartao.boundingBox(), await page.locator('#barra-do-editor').boundingBox()];
      if (!c || !barra) return false;
      const folga = c.y - (barra.y + barra.height);
      const noFim = await page.evaluate(() => { let r = document.getElementById('barra-do-editor')!.parentElement; while (r && !/(auto|scroll)/.test(getComputedStyle(r).overflowY)) r = r.parentElement; return r!.scrollTop >= r!.scrollHeight - r!.clientHeight - 1; });
      return folga >= 0 && (folga <= 24 || noFim);
    };
    await expect.poll(noLugar).toBe(true);
    const titulo = (await page.getByRole('textbox', { name: 'Título da seção 4' }).boundingBox())!;
    expect(titulo.y).toBeGreaterThanOrEqual(0);
    expect(titulo.y + titulo.height).toBeLessThanOrEqual(altura);
  });
}

/** Para a tela larga: uma seção longa (a página rola), prescrição longa, item com e sem vídeo e uma seção vazia. */
const LONGA: ConteudoMobilidadeApi = {
  orientacoes: 'Faça antes do treino, sem pressa.',
  secoes: [
    { uid: 's1', titulo: 'Aquecimento', itens: Array.from({ length: 12 }, (_, i) => ({ uid: `l${i}`, nome: `Item fictício ${i + 1}`, prescricao: i === 0 ? '3 x 12 cada lado, segurando 2 s no fim do movimento e respirando fundo' : '2 x 10', videoUrl: i === 1 ? VIDEO : null })) },
    { uid: 's2', titulo: 'Alongamento', itens: [{ uid: 'a1', nome: 'Posterior', prescricao: '', videoUrl: VIDEO }] },
    { uid: 's3', titulo: 'Respiração', itens: [] },
  ],
};

/** A rolagem da página do editor (o pai da barra grudada que rola). */
const rolarPagina = (page: Page, y: number) => page.evaluate((alvo) => {
  let r = document.getElementById('barra-do-editor')!.parentElement;
  while (r && !/(auto|scroll)/.test(getComputedStyle(r).overflowY)) r = r.parentElement;
  r!.scrollTop = alvo;
}, y);

// Tela larga (26/11): lista | seção | prévia ao vivo, com as larguras de `colunasDaMobilidade` medidas na tela.
// 1920: faixa larga (prévia de 440, a seção com o resto); 3440: ultralarga (prévia de 560, a seção para em 1400, a lista em
// 320 e a sobra vira dois vãos iguais). A linha é a medida na tela (menu aberto, barra de rolagem), não um número fixo.
for (const [largura, previaEsperada] of [[1920, 440], [3440, 560]] as const) {
  test(`${largura}: três colunas que preenchem a linha, prévia grudada ao rolar, rolada até a seção aberta e atualizada ao digitar`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, largura, { conteudo: LONGA });
    const previa = page.getByTestId('previa-da-mobilidade');
    await expect(previa).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Prévia para o aluno' })).toBeVisible();
    const lista = (await page.getByRole('group', { name: 'Seções da mobilidade' }).boundingBox())!;
    const painel = (await page.locator('[id^="secao-"]').first().boundingBox())!;
    const caixa = (await previa.boundingBox())!;
    // Com a página no topo a prévia inteira cabe na janela (rola por dentro), nunca cortada pela borda de baixo.
    expect(caixa.y + caixa.height).toBeLessThanOrEqual(1000);
    // Abrir a Configuração do plano empurra a prévia para baixo: a altura dela encolhe junto (até o mínimo de 320).
    await page.getByRole('button', { name: 'Configuração do plano, recolhido' }).click();
    await expect.poll(async () => {
      const p = (await previa.boundingBox())!;
      return p.y > caixa.y && (p.y + p.height <= 1000 || Math.round(p.height) === 320) && p.height < caixa.height;
    }).toBe(true);
    await page.getByRole('button', { name: /^Configuração do plano/ }).click();
    // Teclado: o Tab nunca para em controle da prévia.
    await page.getByRole('button', { name: 'Adicionar item em Aquecimento' }).focus();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="previa-da-mobilidade"] [inert]'))).toBe(false);
    }
    const linha = caixa.x + caixa.width - lista.x;
    const esperado = colunasDaMobilidade(Math.round(linha))!;
    expect(esperado.previa).toBe(previaEsperada);
    expect(Math.abs(lista.width - esperado.lista)).toBeLessThan(2);
    expect(Math.abs(painel.width - esperado.editor)).toBeLessThan(2);
    expect(Math.round(caixa.width)).toBe(esperado.previa);
    if (largura > 3000) expect([Math.round(lista.width), Math.round(painel.width)]).toEqual([320, 1400]);
    // Os dois vãos iguais (a sobra não fica numa faixa só) e a linha inteira ocupada até a prévia.
    expect(Math.abs(painel.x - (lista.x + lista.width) - esperado.vao)).toBeLessThan(2);
    expect(Math.abs(caixa.x - (painel.x + painel.width) - esperado.vao)).toBeLessThan(2);
    const tituloDasSecoes = (await page.getByRole('heading', { name: 'Seções (3)' }).boundingBox())!;
    expect(Math.abs(tituloDasSecoes.x - lista.x)).toBeLessThan(2);
    // O que o aluno vê: as seções, a prescrição ("—" sem ela) e "Ver vídeo" só no item com vídeo; nada de campo nem foco.
    await expect(previa.getByText('Item fictício 12')).toBeVisible();
    await expect(previa.getByText('Ver vídeo')).toHaveCount(2);
    await expect(previa.getByText('—', { exact: true })).toHaveCount(1);
    await expect(previa.getByText(/^3 x 12 cada lado, segurando/)).toBeVisible();
    await expect(previa.locator('[inert]')).toHaveCount(1);
    await expect(previa.getByRole('button')).toHaveCount(0);
    // Atualiza a cada tecla, com o estado do editor (não salvo).
    await page.getByRole('textbox', { name: 'Nome do item 1', exact: true }).fill('Gato-vaca lento');
    await expect(previa.getByText('Gato-vaca lento')).toBeVisible();
    // Grudada abaixo da barra ao rolar a página.
    await rolarPagina(page, 600);
    await expect.poll(async () => {
      const [b, p] = [await page.locator('#barra-do-editor').boundingBox(), await previa.boundingBox()];
      return !!b && !!p && p.y >= b.y + b.height && p.y - (b.y + b.height) <= 24;
    }).toBe(true);
    // Escolher a seção 3 (vazia) leva a prévia até ela; a roda do mouse ainda rola a prévia.
    await rolarPagina(page, 0);
    await page.getByRole('button', { name: /^Seção 3 de 3: Respiração/ }).click();
    // Distância do topo da seção ao topo da área que rola na prévia (o ancestral com rolagem própria).
    // A seção a ~16 px do topo da prévia ou, sendo a última, à vista com a rolagem no fim.
    const noLugar = () => page.getByTestId('previa-secao-s3').evaluate((s) => {
      let r = s.parentElement;
      while (r && !/(auto|scroll)/.test(getComputedStyle(r).overflowY)) r = r.parentElement;
      const [a, b] = [s.getBoundingClientRect(), r!.getBoundingClientRect()];
      const folga = a.top - b.top;
      const noFim = r!.scrollTop > 0 && r!.scrollTop >= r!.scrollHeight - r!.clientHeight - 1;
      return (folga >= 8 && folga <= 24) || (noFim && a.top >= b.top && a.bottom <= b.bottom);
    });
    await expect.poll(noLugar).toBe(true);
    // A primeira seção volta ao topo da prévia, com as orientações à vista.
    await page.getByRole('button', { name: /^Seção 1 de 3: Aquecimento/ }).click();
    await expect.poll(async () => previa.evaluate((e) => Array.from(e.querySelectorAll('div')).some((d) => d.scrollTop > 0))).toBe(false);
    await previa.hover();
    await page.mouse.wheel(0, 400);
    await expect.poll(async () => previa.evaluate((e) => Array.from(e.querySelectorAll('div')).some((d) => d.scrollTop > 0))).toBe(true);
    await semEstouro(page);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('modelo em 1920: a prévia também aparece, com as orientações do modelo', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrirModelo(page, 1920);
  const previa = page.getByTestId('previa-da-mobilidade');
  await expect(previa.getByText('Faça antes do treino, sem pressa, respirando fundo em cada posição.')).toBeVisible();
  // O link inválido não vira "Ver vídeo" (como na publicação): só o do item 1.
  await expect(previa.getByText('Ver vídeo')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Orientações (opcional)' }).fill('Novas orientações fictícias.');
  await expect(previa.getByText('Novas orientações fictícias.')).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
