import { expect, test, type Page } from '@playwright/test';

import type { ConsultoriaResponse, EuResponse } from '../src/api/tipos';
import { erroApi, json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Editor dos PDFs (`/treinador/documentos/personalizar`; D-F1 a D-F8 de `docs/planos/documentos-pdf-motor.md` e 3.2 de
 * `docs/planos/orientacoes-de-design-26-11.md`): arranjo pela área de conteúdo (o menu do app continua à vista; 27/11:
 * empilhado de 1024 a 1279, painel de 420 com a prévia no resto a partir de 1280; 28/11: quantas prévias vem da largura da
 * área de prévia, `previasDaLargura`: uma com o segmento abaixo de 1500, duas com o segmento até 2400 e as três com título
 * a partir dela), "Modelo" aberto na chegada, prévia ao vivo sem gravar, um estado só na barra, trocar e restaurar com "Desfazer" no aviso, "Salvar" com a
 * versão, 409 com "Recarregar" e a guarda "Sair sem salvar?". API falsa própria, só dados fictícios. Com `E2E_CAPTURAS`,
 * grava as capturas da matriz.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const ADMIN: Partial<EuResponse> = { permissoes: [...PERMISSOES_TREINADOR, 'MARCA_ALTERAR'], perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true } };
const CONSULTORIA: ConsultoriaResponse = { marca: { ...MARCA, temaPdf: 'CLASSICO', opcoesPdf: {} }, versao: 3, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR' };
type Tema = 'CLARO' | 'ESCURO' | 'AREIA';

/** A consultoria falsa grava modelo e opções e sobe a versão; o `GET` seguinte já devolve o gravado. */
function consultoriaGravavel(): RespostasApi {
  let atual = CONSULTORIA;
  return {
    'GET /consultoria': (_p, route) => json(route, atual),
    'PUT /consultoria/documentos-pdf': (p, route) => {
      const corpo = p.corpo as { modelo: string; opcoes: ConsultoriaResponse['marca']['opcoesPdf'] };
      atual = { ...atual, versao: atual.versao + 1, marca: { ...atual.marca, temaPdf: corpo.modelo, opcoesPdf: corpo.opcoes } };
      return json(route, atual);
    },
  };
}

async function abrir(page: Page, largura: number, opcoes: { tema?: Tema; minimizado?: boolean; busca?: string; extra?: RespostasApi; altura?: number } = {}) {
  await page.setViewportSize({ width: largura, height: opcoes.altura ?? (largura < 768 ? 844 : 720) });
  await page.addInitScript(([id, tema, minimizado]) => {
    if (tema) localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema }));
    if (minimizado) localStorage.setItem('menu-lateral-recolhido', '1');
  }, [TREINADOR.id, opcoes.tema ?? '', opcoes.minimizado ? '1' : ''] as const);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, ADMIN)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    ...consultoriaGravavel(),
    ...opcoes.extra,
  });
  await page.goto(`/treinador/documentos/personalizar${opcoes.busca ?? ''}`);
  // Com o painel de confirmação aberto (celular com `?modelo`), o resto da tela sai da árvore de acessibilidade.
  await expect(page.getByRole('heading', { level: 1, name: 'Personalizar documentos' }).or(page.getByRole('alertdialog'))).toBeVisible();
  return api;
}

// `.first()`: com várias prévias lado a lado há várias folhas; a primeira é a da esquerda (Treino, até alguém trocar).
const folha = (page: Page) => page.getByRole('img', { name: /^Prévia do PDF de/ }).first();
const previa = (page: Page) => page.getByTestId('previa-pdf').first();
const aviso = (page: Page) => page.getByRole('alert');
const painel = (page: Page) => page.getByTestId('painel-de-opcoes');
const grupo = (page: Page, nome: string) => page.getByRole('button', { name: new RegExp(`^${nome}, (aberto|recolhido)$`) });
const fundoDoTh = (page: Page) => previa(page).locator('th').first().evaluate((th) => getComputedStyle(th).backgroundColor);
const escritas = (pedidos: { metodo: string; caminho: string }[]) => pedidos.filter((p) => p.metodo !== 'GET' && p.caminho !== '/auth/refresh');
const largura = async (page: Page, alvo: ReturnType<typeof folha>) => Math.round((await alvo.boundingBox())?.width ?? 0);
/** O segmento "Treino · Dieta · Mobilidade" de uma coluna (uma prévia: "Documento da prévia"; duas: "… da esquerda"/"… da direita"). */
const segmento = (page: Page, nome = /^Documento da prévia/) => page.getByRole('radiogroup', { name: nome });
const documento = (page: Page, nome: string, grupoDoSegmento = segmento(page).first()) => grupoDoSegmento.getByRole('radio', { name: nome, exact: true });
/** Respiro da folha em cada lado da coluna (`RESPIRO_DA_FOLHA`): a folha ajustada é a coluna menos 32, até o teto de 993. */
const RESPIRO = 16;

async function capturar(page: Page, nome: string) {
  if (process.env.E2E_CAPTURAS) await page.screenshot({ path: `${process.env.E2E_CAPTURAS}/documentos-editor-${nome}.png` });
}

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

test('(390) celular: confirma o modelo escolhido na galeria, grava sem opções e volta aos modelos', async ({ page }) => {
  const { pedidos, errosDaPagina } = await abrir(page, 390, { busca: '?modelo=ELEGANTE' });
  const dialogo = page.getByRole('alertdialog', { name: 'Usar o modelo Elegante?' });
  await expect(dialogo).toBeVisible();
  // O `?modelo` é consumido na chegada: o voltar não reabre a escolha.
  await expect(page).toHaveURL(/\/treinador\/documentos\/personalizar$/);
  await expect(page.getByText('Personalize numa tela maior')).toBeVisible();
  await expect(previa(page)).toHaveCount(0);
  await capturar(page, '390-confirmar');
  await dialogo.getByRole('button', { name: 'Usar este modelo' }).click();
  await expect(page.getByText('Documentos salvos no modelo Elegante.', { exact: false })).toBeVisible();
  expect(escritas(pedidos)).toEqual([{ metodo: 'PUT', caminho: '/consultoria/documentos-pdf', busca: expect.anything(), corpo: { modelo: 'ELEGANTE', opcoes: {}, versao: 3 } }]);
  await expect(page).toHaveURL(/\/treinador\/documentos$/);
  expect(errosDaPagina).toEqual([]);
});

for (const minimizado of [false, true]) {
  test(`(1024, menu ${minimizado ? 'minimizado' : 'aberto'}) a área fica abaixo de 1024: só "Personalize numa tela maior"`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, 1024, { minimizado });
    await expect(page.getByText('Personalize numa tela maior')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver os modelos' })).toBeVisible();
    await expect(previa(page)).toHaveCount(0);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await semRolagemLateral(page);
    await capturar(page, `1024-${minimizado ? 'minimizado' : 'aberto'}`);
    expect(errosDaPagina).toEqual([]);
  });
}

test('(1200, menu minimizado) janela abaixo de 1280 com área de 1024 ou mais: opções em cima e prévia embaixo, na largura toda', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1200, { minimizado: true });
  await expect(previa(page)).toContainText('Aluno de Exemplo');
  // O painel tem a largura do conteúdo (a da barra) e a prévia começa embaixo dele; a folha amplia até o teto de 125% (sem o zoom).
  const conteudo = await largura(page, page.getByRole('toolbar', { name: 'Ações do editor' }));
  expect(await largura(page, painel(page))).toBe(conteudo);
  const caixaDoPainel = await painel(page).boundingBox();
  const caixaDaFolha = await folha(page).boundingBox();
  expect(caixaDaFolha?.y ?? 0).toBeGreaterThan((caixaDoPainel?.y ?? 0) + (caixaDoPainel?.height ?? 0));
  expect(await largura(page, folha(page))).toBe(Math.min(conteudo - 2 * RESPIRO, 993));
  await expect(page.getByRole('radio', { name: 'Ajustar' })).toHaveCount(0);
  // Uma prévia (a área fica abaixo de 1500), com o segmento e Treino escolhido.
  await expect(page.getByRole('img', { name: /^Prévia do PDF de/ })).toHaveCount(1);
  await expect(documento(page, 'Treino')).toHaveAttribute('aria-checked', 'true');
  // Painel acima da prévia (~1080 px): "Modelo" chega aberto, com os seis modelos numa linha só.
  await expect(grupo(page, 'Modelo')).toHaveAccessibleName('Modelo, aberto');
  const modelos = painel(page).getByRole('radiogroup', { name: 'Modelo' }).getByRole('radio');
  const caixas = await Promise.all([0, 5].map((i) => modelos.nth(i).boundingBox()));
  expect(Math.round(caixas[0]?.y ?? 0)).toBe(Math.round(caixas[1]?.y ?? 1));
  await semRolagemLateral(page);
  await capturar(page, '1200-empilhado');
  expect(errosDaPagina).toEqual([]);
});

for (const tema of ['ESCURO', 'CLARO'] as const) {
  test(`(1280, ${tema.toLowerCase()}) janela de 1280: painel de 420 ao lado e folha ajustada; a opção muda a prévia ao vivo, sem gravar, e o Salvar grava`, async ({ page }) => {
    const { pedidos, errosDaPagina } = await abrir(page, 1280, { tema });
    await expect(previa(page)).toContainText('Aluno de Exemplo');
    // A janela decide as colunas (a área é ~1040): painel de 420 e a folha ajustada abaixo da A4, com o controle de zoom.
    expect(await largura(page, painel(page))).toBe(420);
    const ajustada = await largura(page, folha(page));
    expect(ajustada).toBeGreaterThan(476);
    expect(ajustada).toBeLessThan(794);
    await expect(page.getByRole('radio', { name: 'Ajustar' })).toHaveAttribute('aria-checked', 'true');
    // O papel (o `.previa-pdf` da instância, `cssDaPrevia`) é branco em qualquer tema.
    expect(await previa(page).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    await expect(page.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Restaurar o modelo' })).toBeDisabled();
    await expect(page.getByText('Clássico · Sem alterações')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    // "Modelo" chega aberto com as miniaturas; os outros grupos, recolhidos com o resumo.
    await expect(grupo(page, 'Modelo')).toHaveAccessibleName('Modelo, aberto');
    await expect(painel(page).getByRole('radiogroup', { name: 'Modelo' }).getByRole('radio')).toHaveCount(6);
    for (const g of ['Cores', 'Texto', 'Cabeçalho', 'Tabelas']) await expect(grupo(page, g)).toHaveAccessibleName(`${g}, recolhido`);
    // A frase dos dados de exemplo aparece uma vez só, no topo das prévias; sem abas (o segmento as substituiu).
    await expect(page.getByText('Dados de exemplo, nenhum é real.', { exact: false })).toHaveCount(1);
    await expect(page.getByRole('tab')).toHaveCount(0);
    await capturar(page, `1280-${tema.toLowerCase()}`);

    await grupo(page, 'Cores').click();
    await expect(painel(page).getByText('Cor da marca', { exact: true }).first()).toBeVisible();
    expect(await fundoDoTh(page)).toBe('rgb(185, 28, 28)');
    await painel(page).getByRole('radio', { name: 'Azul' }).click();
    await expect.poll(() => fundoDoTh(page)).toBe('rgb(37, 99, 235)');
    await expect(page.getByText('Destaque: Azul')).toBeVisible();
    await expect(page.getByText('Alterações não salvas')).toBeVisible();
    await expect(page.getByText('Clássico · 1 opção mudada')).toBeVisible();
    await expect(page.getByText('Em uso nos PDFs')).toHaveCount(0);
    expect(escritas(pedidos)).toEqual([]);
    await capturar(page, `1280-${tema.toLowerCase()}-cores`);

    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Documentos salvos no modelo Clássico.', { exact: false })).toBeVisible();
    expect(escritas(pedidos)).toEqual([{ metodo: 'PUT', caminho: '/consultoria/documentos-pdf', busca: expect.anything(), corpo: { modelo: 'CLASSICO', opcoes: { cores: { destaque: 'AZUL' } }, versao: 3 } }]);
    await expect(page.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    await expect(page.getByText('Em uso nos PDFs')).toBeVisible();
    await expect(page.getByText('Alterações não salvas')).toHaveCount(0);
    await semRolagemLateral(page);
    expect(errosDaPagina).toEqual([]);
  });
}

/**
 * Janela → quantas prévias (pela área delas, com o menu aberto): 1536 e 1920 ficam abaixo de 1500 (uma; em 1536 a folha
 * fica menor que a A4 e o zoom aparece) e 2560 passa de 1500 (duas, cada uma com o segmento). A folha é a coluna menos o
 * respiro, até o teto de 125% (993).
 */
const MATRIZ: { janela: number; previas: 1 | 2; zoom: boolean; tema: Tema; nome: string }[] = [
  { janela: 1536, previas: 1, zoom: true, tema: 'CLARO', nome: '1536' },
  { janela: 1920, previas: 1, zoom: false, tema: 'ESCURO', nome: '1920-escuro' },
  { janela: 1920, previas: 1, zoom: false, tema: 'CLARO', nome: '1920-claro' },
  { janela: 1920, previas: 1, zoom: false, tema: 'AREIA', nome: '1920-areia' },
  { janela: 2560, previas: 2, zoom: false, tema: 'CLARO', nome: '2560' },
];

for (const m of MATRIZ) {
  test(`(${m.nome}) painel de 420 à esquerda e ${m.previas === 1 ? 'uma prévia' : 'duas prévias'} com o segmento no resto`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, m.janela, { tema: m.tema });
    await expect(previa(page)).toContainText('Aluno de Exemplo');
    expect(await largura(page, painel(page))).toBe(420);
    const regioes = page.getByRole('region', { name: /^Prévia (do|da) / });
    await expect(regioes).toHaveCount(m.previas);
    await expect(segmento(page)).toHaveCount(m.previas);
    // Cada folha ocupa a sua coluna menos o respiro, até o teto.
    for (let i = 0; i < m.previas; i++) {
      const coluna = await largura(page, regioes.nth(i));
      expect(await largura(page, regioes.nth(i).getByRole('img', { name: /^Prévia do PDF de/ }))).toBe(Math.min(coluna - 2 * RESPIRO, 993));
    }
    await expect(page.getByRole('radio', { name: 'Ajustar' })).toHaveCount(m.zoom ? m.previas : 0);
    // As colunas vão do vão do painel até a borda do conteúdo (a da barra): sem mesa cinza nem faixa vazia à direita.
    const ultima = await regioes.last().boundingBox();
    const barra = await page.getByRole('toolbar', { name: 'Ações do editor' }).boundingBox();
    expect(Math.abs(((ultima?.x ?? 0) + (ultima?.width ?? 0)) - ((barra?.x ?? 0) + (barra?.width ?? 0)))).toBeLessThanOrEqual(1);
    expect(await previa(page).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    await expect(page.getByText('Dados de exemplo, nenhum é real.', { exact: false })).toHaveCount(1);
    await grupo(page, 'Cabeçalho').click();
    await expect(page.getByText('Faixa cheia · logo à esquerda · média')).toBeVisible();
    if (m.previas === 1) {
      await documento(page, 'Dieta').click();
      await expect(previa(page)).toContainText('Sugestão de plano alimentar');
      await expect(page.getByRole('region', { name: 'Prévia da dieta' })).toBeVisible();
    } else {
      // Padrão: Treino à esquerda e Dieta à direita; as folhas começam na mesma linha.
      const esquerda = segmento(page, /da esquerda$/);
      const direita = segmento(page, /da direita$/);
      await expect(documento(page, 'Treino', esquerda)).toHaveAttribute('aria-checked', 'true');
      await expect(documento(page, 'Dieta', direita)).toHaveAttribute('aria-checked', 'true');
      const folhas = page.getByRole('img', { name: /^Prévia do PDF de/ });
      const [y0, y1] = await Promise.all([folhas.nth(0).boundingBox(), folhas.nth(1).boundingBox()]);
      expect(Math.abs((y0?.y ?? 0) - (y1?.y ?? 99))).toBeLessThanOrEqual(1);
      // Escolher à esquerda o que a direita mostra troca os dois: nunca o mesmo documento nos dois lados.
      await documento(page, 'Dieta', esquerda).click();
      await expect(documento(page, 'Dieta', esquerda)).toHaveAttribute('aria-checked', 'true');
      await expect(documento(page, 'Treino', direita)).toHaveAttribute('aria-checked', 'true');
      await expect(regioes.nth(0)).toHaveAccessibleName('Prévia da dieta');
      await expect(regioes.nth(1)).toHaveAccessibleName('Prévia do treino');
      // Pelo teclado: foco na opção e Espaço escolhe (Mobilidade à direita, sem conflito: só ela muda).
      await documento(page, 'Mobilidade', direita).focus();
      await page.keyboard.press('Space');
      await expect(documento(page, 'Mobilidade', direita)).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('region', { name: 'Prévia da mobilidade' }).getByTestId('previa-pdf')).toContainText('Gato-camelo');
      await expect(documento(page, 'Dieta', esquerda)).toHaveAttribute('aria-checked', 'true');
    }
    await semRolagemLateral(page);
    await capturar(page, m.nome);
    expect(errosDaPagina).toEqual([]);
  });
}

test('(1920) o painel fica fixo ao rolar e a opção muda a prévia sem mexer na rolagem', async ({ page }) => {
  await abrir(page, 1920, { altura: 1080 });
  await expect(previa(page)).toContainText('Aluno de Exemplo');
  // A rolagem da página é a do `ScrollView` do editor: marca o ancestral da folha que rola, para ler e mexer nele.
  await previa(page).evaluate((el) => {
    let no: Element | null = el;
    while (no && !(/(auto|scroll)/.test(getComputedStyle(no).overflowY) && no.scrollHeight > no.clientHeight)) no = no.parentElement;
    no?.setAttribute('data-rolagem-do-teste', '');
  });
  const rolagem = page.locator('[data-rolagem-do-teste]');
  const topo = () => rolagem.evaluate((no) => no.scrollTop);
  await rolagem.evaluate((no) => { no.scrollTop = 900; });
  const antes = await topo();
  expect(antes).toBeGreaterThan(800);
  // Grudado abaixo da barra: o painel continua à vista depois de rolar 900 px.
  const caixa = await painel(page).boundingBox();
  expect(caixa?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect(caixa?.y ?? 9999).toBeLessThan(300);
  await grupo(page, 'Cores').click();
  await painel(page).getByRole('radio', { name: 'Azul' }).click();
  await expect.poll(() => fundoDoTh(page)).toBe('rgb(37, 99, 235)');
  expect(await topo()).toBe(antes);
});

/** Capturas pedidas em 27/11: 1920×1080 e 3440×1440, escuro e claro, com alteração pendente e a grade de modelos aberta. */
const CAPTURAS: { janela: number; altura: number; tema: Tema }[] = [
  { janela: 1920, altura: 1080, tema: 'ESCURO' },
  { janela: 1920, altura: 1080, tema: 'CLARO' },
  { janela: 3440, altura: 1440, tema: 'ESCURO' },
  { janela: 3440, altura: 1440, tema: 'CLARO' },
];

for (const c of CAPTURAS) {
  const tres = c.janela >= 3440;
  test(`(${c.janela}x${c.altura}, ${c.tema.toLowerCase()}) grade de modelos em miniaturas, alteração pendente${tres ? ', as três prévias lado a lado' : ''}`, async ({ page }) => {
    const { pedidos, errosDaPagina } = await abrir(page, c.janela, { tema: c.tema, altura: c.altura });
    await expect(previa(page)).toContainText('Aluno de Exemplo');
    expect(await largura(page, painel(page))).toBe(420);
    if (tres) {
      // 3440 com o menu aberto (área de prévia acima de 2400): as três, cada uma com o título simples, sem segmento.
      await expect(segmento(page)).toHaveCount(0);
      for (const nome of ['Treino', 'Dieta', 'Mobilidade']) await expect(page.getByRole('heading', { level: 2, name: nome, exact: true })).toBeVisible();
      const folhas = page.getByRole('img', { name: /^Prévia do PDF de/ });
      await expect(folhas).toHaveCount(3);
      const larguras = await Promise.all([0, 1, 2].map((i) => largura(page, folhas.nth(i))));
      expect(new Set(larguras).size).toBe(1);
      // As três folhas começam na mesma linha.
      const caixas = await Promise.all([0, 1, 2].map((i) => folhas.nth(i).boundingBox()));
      for (const caixa of caixas) expect(Math.abs((caixa?.y ?? 0) - (caixas[0]?.y ?? 99))).toBeLessThanOrEqual(1);
      await expect(page.getByRole('region', { name: 'Prévia da dieta' }).getByTestId('previa-pdf')).toContainText('Sugestão de plano alimentar');
      await expect(page.getByRole('region', { name: 'Prévia da mobilidade' }).getByTestId('previa-pdf')).toContainText('Gato-camelo');
    } else {
      await expect(segmento(page)).toHaveCount(1);
      expect(await largura(page, folha(page))).toBe(993);
    }
    // "Modelo" chega aberto: seis cartões em duas colunas, o escolhido com ✓ e borda da cor de ação.
    const modelos = painel(page).getByRole('radiogroup', { name: 'Modelo' }).getByRole('radio');
    await expect(modelos).toHaveCount(6);
    const [primeiro, segundo, terceiro] = await Promise.all([0, 1, 2].map((i) => modelos.nth(i).boundingBox()));
    expect(Math.round(primeiro?.y ?? 0)).toBe(Math.round(segundo?.y ?? 1));
    expect(terceiro?.y ?? 0).toBeGreaterThan(primeiro?.y ?? 0);
    await expect(modelos.nth(0)).toHaveAttribute('aria-checked', 'true');
    await painel(page).getByRole('radio', { name: /^Elegante\. / }).click();
    await expect(painel(page).getByRole('radio', { name: /^Elegante\. / })).toHaveAttribute('aria-checked', 'true');
    await expect(aviso(page)).toContainText('Modelo trocado para Elegante.');
    await expect(page.getByText('Alterações não salvas')).toBeVisible();
    await expect(page.getByText('Elegante · os PDFs ainda usam Clássico')).toBeVisible();
    await expect(page.getByText('Em uso nos PDFs')).toHaveCount(0);
    await semRolagemLateral(page);
    expect(escritas(pedidos)).toEqual([]);
    await capturar(page, `${c.janela}-${c.tema.toLowerCase()}-modelos-pendente`);
    expect(errosDaPagina).toEqual([]);
  });
}

/** Cores pintadas no desenho de um cartão (fundo e fio de baixo das Views), para conferir o destaque sem depender do pixel. */
const coresDoDesenho = (cartao: ReturnType<Page['getByRole']>) => cartao.evaluate((el) => {
  const cores = new Set<string>();
  el.querySelectorAll('div').forEach((d) => {
    const s = getComputedStyle(d);
    cores.add(s.backgroundColor);
    if (s.borderBottomStyle !== 'none' && parseFloat(s.borderBottomWidth) > 0) cores.add(s.borderBottomColor);
  });
  return [...cores];
});

for (const tema of ['CLARO', 'ESCURO'] as const) {
  test(`(1920, ${tema.toLowerCase()}) as seis miniaturas usam o destaque atual e a descrição tem uma linha`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, 1920, { tema, altura: 1080 });
    await expect(previa(page)).toContainText('Aluno de Exemplo');
    await grupo(page, 'Cores').click();
    await painel(page).getByRole('radio', { name: 'Azul' }).click();
    await expect.poll(() => fundoDoTh(page)).toBe('rgb(37, 99, 235)');
    await grupo(page, 'Modelo').click();
    const modelos = painel(page).getByRole('radiogroup', { name: 'Modelo' }).getByRole('radio');
    await expect(modelos).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      const cores = await coresDoDesenho(modelos.nth(i));
      // Azul em todos (o escolhido e os outros), e nenhum com o vermelho da marca.
      expect(cores).toContain('rgb(37, 99, 235)');
      expect(cores).not.toContain('rgb(185, 28, 28)');
      // A descrição é o último texto do cartão: uma linha só, com reticências.
      const descricao = modelos.nth(i).locator('div[dir]').last();
      const [altura, linha] = await descricao.evaluate((el) => [el.getBoundingClientRect().height, parseFloat(getComputedStyle(el).lineHeight)]);
      expect(altura).toBeLessThanOrEqual(linha + 1);
    }
    await semRolagemLateral(page);
    if (process.env.E2E_CAPTURAS) await painel(page).screenshot({ path: `${process.env.E2E_CAPTURAS}/documentos-editor-1920-${tema.toLowerCase()}-miniaturas-azul.png` });
    expect(errosDaPagina).toEqual([]);
  });
}

for (const tema of ['CLARO', 'ESCURO'] as const) {
  for (const modelo of ['CLASSICO', 'ESPORTIVO'] as const) {
    test(`(1280) aba Mobilidade da prévia: ${modelo}, ${tema}`, async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrir(page, 1280, { tema, busca: modelo === 'CLASSICO' ? '' : `?modelo=${modelo}` });
      await documento(page, 'Mobilidade').click();
      await expect(previa(page)).toContainText('Aluno de Exemplo');
      await expect(previa(page)).toContainText('Gato-camelo');
      await expect(previa(page)).toContainText('Quadril e pernas');
      await expect(folha(page)).toHaveAccessibleName(/Prévia do PDF de mobilidade/);
      await semRolagemLateral(page);
      await capturar(page, `mobilidade-1280-${tema.toLowerCase()}-${modelo.toLowerCase()}`);
      expect(escritas(pedidos)).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('(1280) ?modelo da galeria abre o modelo como rascunho; trocar e restaurar têm Desfazer, sem pergunta', async ({ page }) => {
  const { pedidos, errosDaPagina } = await abrir(page, 1280, { busca: '?modelo=ESPORTIVO' });
  await expect(page).toHaveURL(/\/treinador\/documentos\/personalizar$/);
  // Um estado só: o pendente diz o que muda em relação ao gravado, nunca "Sem alterações" nem "Em uso nos PDFs" junto.
  await expect(page.getByText('Alterações não salvas')).toBeVisible();
  await expect(page.getByText('Esportivo · os PDFs ainda usam Clássico')).toBeVisible();
  await expect(page.getByText('Em uso nos PDFs')).toHaveCount(0);
  await expect(page.getByText('Sem alterações')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Salvar' })).toBeEnabled();

  // A troca avisa no aviso (toast) com "Desfazer", sem faixa na tela ("Modelo" já chega aberto).
  await expect(painel(page).getByRole('radio', { name: /^Esportivo\. / })).toHaveAttribute('aria-checked', 'true');
  await painel(page).getByRole('radio', { name: /^Elegante\. / }).click();
  await expect(aviso(page)).toContainText('Modelo trocado para Elegante.');
  await expect(page.getByText('Elegante · os PDFs ainda usam Clássico')).toBeVisible();
  await aviso(page).getByRole('button', { name: 'Desfazer' }).click();
  await expect(painel(page).getByRole('radio', { name: /^Esportivo\. / })).toHaveAttribute('aria-checked', 'true');
  await expect(aviso(page)).toHaveCount(0);

  // Mudar uma opção abre só um grupo por vez; "Restaurar o modelo" volta aos valores dele (o foco vai ao Salvar), e o
  // Desfazer do aviso devolve a opção.
  await grupo(page, 'Tabelas').click();
  await expect(grupo(page, 'Modelo')).toHaveAccessibleName('Modelo, recolhido');
  await painel(page).getByRole('radio', { name: 'Cartões' }).click();
  await expect(page.getByText('Cartões · normal')).toBeVisible();
  await page.getByRole('button', { name: 'Restaurar o modelo' }).click();
  await expect(aviso(page)).toContainText('Opções do modelo Esportivo restauradas.');
  await expect(page.getByRole('button', { name: 'Salvar' })).toBeFocused();
  await expect(page.getByText('Listrada · normal')).toBeVisible();
  await aviso(page).getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByText('Cartões · normal')).toBeVisible();
  expect(escritas(pedidos)).toEqual([]);
  await capturar(page, '1280-desfazer');
  expect(errosDaPagina).toEqual([]);
});

test('(1280) 409 ao salvar: painel com "Recarregar", que relê a consultoria e descarta o rascunho', async ({ page }) => {
  const { pedidos } = await abrir(page, 1280, { extra: { 'PUT /consultoria/documentos-pdf': erroApi(409, 'Conflito.', 'CONFLITO_EDICAO') } });
  await grupo(page, 'Texto').click();
  await painel(page).getByRole('radio', { name: 'Serifada' }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  const dialogo = page.getByRole('alertdialog', { name: 'Os documentos foram alterados em outro lugar' });
  await expect(dialogo).toBeVisible();
  await capturar(page, '1280-409');
  const leituras = pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/consultoria').length;
  await dialogo.getByRole('button', { name: 'Recarregar' }).click();
  await expect.poll(() => pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/consultoria').length).toBe(leituras + 1);
  await expect(page.getByText('Clássico · Sem alterações')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar' })).toBeDisabled();
});

test('(1280) 422 ao salvar: a mensagem do campo aparece na barra', async ({ page }) => {
  await abrir(page, 1280, { extra: { 'PUT /consultoria/documentos-pdf': erroApi(422, 'Dados inválidos.', 'DOCUMENTOS_PDF_INVALIDOS', [{ field: 'opcoes.tabelas.densidade', message: 'Valor não aceito.' }]) } });
  await grupo(page, 'Tabelas').click();
  await painel(page).getByRole('radio', { name: 'Espaçosa' }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Tabelas: Valor não aceito.')).toBeVisible();
  await expect(page.getByText('Falha ao salvar')).toBeVisible();
});

test('(1280) guarda de saída: com alteração, sair pelo menu pergunta "Sair sem salvar?"', async ({ page }) => {
  await abrir(page, 1280);
  await grupo(page, 'Cabeçalho').click();
  await painel(page).getByRole('radio', { name: 'Linha fina' }).click();
  await page.getByRole('link', { name: 'Alunos', exact: true }).first().click();
  const dialogo = page.getByRole('alertdialog', { name: 'Sair sem salvar?' });
  await expect(dialogo).toBeVisible();
  await capturar(page, '1280-guarda');
  await dialogo.getByRole('button', { name: 'Continuar editando' }).click();
  await expect(page).toHaveURL(/\/treinador\/documentos\/personalizar$/);
  await expect(page.getByText('Clássico · 1 opção mudada')).toBeVisible();
});

test('sem acesso: perfil sem administrador não abre o editor', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MARCA_ALTERAR'], perfil: { id: 'p2', nome: 'Treinador', acessoTotal: false } })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
  });
  await page.goto('/treinador/documentos/personalizar');
  await expect(page.getByRole('heading', { level: 1, name: 'Sem acesso a esta tela' })).toBeVisible();
  await expect(previa(page)).toHaveCount(0);
});
