import { expect, test, type Page } from '@playwright/test';

import { ALUNO, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/**
 * Ajuda (F16 e F17): busca sem acento que reabre o que estava recolhido e diz "Nenhum resultado" com o foco de volta no
 * campo, índice lateral no PC (o tópico escolhido em negrito e com o indicador; o clique rola até a seção), seletor no
 * topo do celular, sem rolagem lateral de 390 a 1920 px, com o menu aberto e recolhido, nos temas claro e escuro e com o
 * texto maior; o treinador e o aluno têm cada um o seu guia. A fonte de vídeos começa vazia: nada de bloco de vídeo.
 * `CAPTURAS` aponta a pasta das capturas (sem ela, a pasta de resultados de cada teste). Só dados fictícios.
 */
const captura = (nome: string) => (process.env.CAPTURAS ? `${process.env.CAPTURAS}/${nome}` : test.info().outputPath(nome));

const TODAS = [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER', 'AGENDA_LER', 'BIBLIOTECA_LER', 'MODELO_LER', 'FINANCEIRO_LER', 'EQUIPE_LER'];

type Preferencias = { tema?: 'ESCURO'; tamanhoTexto?: 'EXTRA' };

async function preferir(page: Page, id: string, prefs: Preferencias) {
  await page.addInitScript(([chave, valor]) => localStorage.setItem(chave, valor), [`treinos:${id}:preferencias`, JSON.stringify(prefs)] as const);
}

async function abrirTreinador(page: Page, largura: number, opcoes: { prefs?: Preferencias; menuRecolhido?: boolean } = {}) {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
  if (opcoes.prefs) await preferir(page, TREINADOR.id, opcoes.prefs);
  if (opcoes.menuRecolhido) await page.addInitScript(() => localStorage.setItem('menu-lateral-recolhido', '1'));
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: TODAS, pagamentosHabilitados: true })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
  });
  await page.goto('/treinador/ajuda', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Ajuda', level: 1 })).toBeVisible();
  return { errosDaPagina };
}

async function abrirAluno(page: Page, largura: number, prefs?: Preferencias) {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
  if (prefs) await preferir(page, ALUNO.id, prefs);
  const { errosDaPagina } = await simularApi(page, await sessaoDeAluno(page));
  await page.goto('/aluno/ajuda', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Ajuda', level: 1 })).toBeVisible();
  return { errosDaPagina };
}

const indice = (page: Page) => page.getByRole('navigation', { name: 'Tópicos da ajuda' });
const seletor = (page: Page) => page.getByRole('button', { name: /^Ir para o tópico/ });
const campoDaBusca = (page: Page) => page.getByLabel('Buscar na ajuda');
const secao = (page: Page, titulo: string) => page.getByRole('button', { name: new RegExp(`^${titulo.replace(/[()]/g, '\\$&')}, (aberto|recolhido)$`) });

/** A busca não passa da borda direita da coluna de leitura (a seção "Início" ou a primeira que casou). */
async function buscaAlinhada(page: Page, titulo: string) {
  const campo = await campoDaBusca(page).boundingBox();
  const cartao = await secao(page, titulo).boundingBox();
  // O botão da faixa fica 16 px para dentro da borda do cartão; a busca alinha com a borda.
  expect(campo!.x + campo!.width).toBeLessThanOrEqual(cartao!.x + cartao!.width + 16 + 1);
}

async function semRolagemLateral(page: Page) {
  const { documento, janela } = await page.evaluate(() => ({ documento: document.documentElement.scrollWidth, janela: document.documentElement.clientWidth }));
  expect(documento).toBeLessThanOrEqual(janela);
}

test('treinador no PC (1280, menu aberto): índice ao lado, busca sem acento reabre a seção e "Nenhum resultado" devolve o foco', async ({ page }) => {
  const { errosDaPagina } = await abrirTreinador(page, 1280);
  await expect(indice(page)).toBeVisible();
  await expect(seletor(page)).toHaveCount(0);
  await expect(secao(page, 'Financeiro (cobrar seus alunos)')).toHaveAccessibleName(/recolhido$/);
  // Começar a usar e a fonte de vídeos vazia: nenhum bloco de vídeo.
  await expect(page.getByRole('button', { name: 'Tutorial passo a passo' })).toBeVisible();
  await expect(page.getByText(/Vídeos? \(abre fora do app\)/)).toHaveCount(0);
  // O nome acessível começa pelo texto visível (WCAG 2.5.3).
  await expect(page.getByRole('button', { name: /^Abrir o guia \(.+ em PDF\)$/ })).toBeVisible();
  await semRolagemLateral(page);
  await page.screenshot({ path: captura('ajuda-treinador-1280.png'), fullPage: false });

  // Sem acento acha "Emissão" e abre a seção recolhida; o índice passa a listar só o que casou.
  await campoDaBusca(page).fill('emissao');
  await expect(page.getByText(/^\d+ resultados?$/)).toBeVisible();
  await expect(secao(page, 'Financeiro (cobrar seus alunos)')).toHaveAccessibleName(/aberto$/);
  await expect(page.getByRole('heading', { name: 'Achar uma cobrança', level: 3 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tutorial passo a passo' })).toHaveCount(0);
  await expect(indice(page).getByRole('button', { name: 'Começar a usar' })).toHaveCount(0);
  await expect(indice(page).getByRole('button', { name: 'Financeiro (cobrar seus alunos)' })).toBeVisible();
  // Com acento, o mesmo resultado.
  await campoDaBusca(page).fill('Emissão');
  await expect(page.getByRole('heading', { name: 'Achar uma cobrança', level: 3 })).toBeVisible();
  await page.screenshot({ path: captura('ajuda-treinador-1280-busca.png') });

  await campoDaBusca(page).fill('xyzzy');
  await expect(page.getByText('Nenhum resultado', { exact: true }).first()).toBeVisible();
  await expect(indice(page).getByText('Nesta página')).toHaveCount(0);
  await page.screenshot({ path: captura('ajuda-treinador-1280-sem-resultado.png') });
  await page.getByRole('button', { name: 'Limpar busca' }).click();
  await expect(campoDaBusca(page)).toBeFocused();
  await expect(campoDaBusca(page)).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Tutorial passo a passo' })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('treinador no PC: o clique no índice rola até a seção, abre e marca o tópico; o índice fica à vista', async ({ page }) => {
  const { errosDaPagina } = await abrirTreinador(page, 1440);
  const ultimo = indice(page).getByRole('button', { name: 'Perguntas frequentes' });
  // O índice mais alto que a janela rola por dentro: o último tópico é alcançável.
  await ultimo.scrollIntoViewIfNeeded();
  await expect(ultimo).toBeInViewport();
  await expect(secao(page, 'Perguntas frequentes')).not.toBeInViewport();
  await ultimo.click();
  await expect(secao(page, 'Perguntas frequentes')).toHaveAccessibleName(/aberto$/);
  await expect(secao(page, 'Perguntas frequentes')).toBeInViewport();
  await expect(ultimo).toHaveAttribute('aria-current', 'location');
  await expect(ultimo).not.toHaveAttribute('aria-selected');
  await expect(indice(page).getByRole('button', { name: 'Começar a usar' })).not.toHaveAttribute('aria-current', 'location');
  // Parado enquanto a página rola.
  const topoDoIndice = await indice(page).evaluate((el) => el.getBoundingClientRect().top);
  expect(topoDoIndice).toBeGreaterThanOrEqual(0);
  expect(topoDoIndice).toBeLessThan(40);
  await expect(ultimo).toBeInViewport();
  await semRolagemLateral(page);
  await page.screenshot({ path: captura('ajuda-treinador-1440-indice.png') });
  // Teclado: da busca, o Tab vai ao índice e o Enter escolhe o tópico.
  await campoDaBusca(page).focus();
  await page.keyboard.press('Tab');
  await expect(indice(page).getByRole('button', { name: 'Começar a usar' })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(indice(page).getByRole('button', { name: 'Primeiros passos' })).toHaveAttribute('aria-current', 'location');
  await expect(page.getByRole('heading', { name: 'Primeiros passos', level: 2 })).toBeInViewport();
  await page.screenshot({ path: captura('ajuda-treinador-1440-teclado.png') });
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [1280, 1920]) {
  test(`treinador em ${largura} com o menu recolhido: índice ao lado e sem rolagem lateral`, async ({ page }) => {
    const { errosDaPagina } = await abrirTreinador(page, largura, { menuRecolhido: largura === 1280 });
    if (largura === 1280) await expect(page.getByRole('menubar').getByRole('button', { name: 'Expandir menu' })).toBeVisible();
    await expect(indice(page)).toBeVisible();
    await semRolagemLateral(page);
    // A coluna de leitura não passa de 800 px.
    const larguraDaSecao = await secao(page, 'Início').evaluate((el) => el.getBoundingClientRect().width);
    expect(larguraDaSecao).toBeLessThanOrEqual(800);
    await buscaAlinhada(page, 'Início');
    await page.screenshot({ path: captura(`ajuda-treinador-${largura}${largura === 1280 ? '-menu-recolhido' : ''}.png`) });
    expect(errosDaPagina).toEqual([]);
  });
}

test('treinador no celular (390): seletor no topo leva ao tópico, sem índice e sem rolagem lateral', async ({ page }) => {
  const { errosDaPagina } = await abrirTreinador(page, 390);
  await expect(indice(page)).toHaveCount(0);
  await expect(seletor(page)).toBeVisible();
  await semRolagemLateral(page);
  await page.screenshot({ path: captura('ajuda-treinador-390.png') });
  await seletor(page).click();
  await page.getByRole('radio', { name: 'Agenda presencial', exact: true }).click();
  await expect(secao(page, 'Agenda presencial')).toHaveAccessibleName(/aberto$/);
  await expect(secao(page, 'Agenda presencial')).toBeInViewport();
  await semRolagemLateral(page);
  await page.screenshot({ path: captura('ajuda-treinador-390-topico.png') });
  expect(errosDaPagina).toEqual([]);
});

test('treinador no tema escuro e com o texto maior (1280 e 390): sem rolagem lateral', async ({ page }) => {
  const { errosDaPagina } = await abrirTreinador(page, 1280, { prefs: { tema: 'ESCURO', tamanhoTexto: 'EXTRA' } });
  await campoDaBusca(page).fill('lote');
  await expect(page.getByRole('heading', { name: 'Registrar pagamentos em lote', level: 3 })).toBeVisible();
  await semRolagemLateral(page);
  await buscaAlinhada(page, 'Financeiro (cobrar seus alunos)');
  await page.screenshot({ path: captura('ajuda-treinador-1280-escuro-extra.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(seletor(page)).toBeVisible();
  await semRolagemLateral(page);
  await page.screenshot({ path: captura('ajuda-treinador-390-escuro-extra.png') });
  expect(errosDaPagina).toEqual([]);
});

test('aluno: guia próprio, busca e seletor no celular; índice no PC, também no tema escuro', async ({ page }) => {
  const { errosDaPagina } = await abrirAluno(page, 390);
  await expect(seletor(page)).toBeVisible();
  await expect(secao(page, 'Comunidade')).toBeVisible();
  await expect(secao(page, 'Financeiro (cobrar seus alunos)')).toHaveCount(0);
  await expect(page.getByText(/Vídeos? \(abre fora do app\)/)).toHaveCount(0);
  await semRolagemLateral(page);
  await page.screenshot({ path: captura('ajuda-aluno-390.png') });
  await campoDaBusca(page).fill('aulao');
  await expect(secao(page, 'Comunidade')).toHaveAccessibleName(/aberto$/);
  await expect(page.getByRole('heading', { name: 'Aulões', level: 3 })).toBeVisible();
  await semRolagemLateral(page);
  await page.screenshot({ path: captura('ajuda-aluno-390-busca.png') });
  expect(errosDaPagina).toEqual([]);
});

test('aluno no PC (1280, escuro): índice ao lado e sem rolagem lateral', async ({ page }) => {
  const { errosDaPagina } = await abrirAluno(page, 1280, { tema: 'ESCURO' });
  await expect(indice(page)).toBeVisible();
  await indice(page).getByRole('button', { name: 'Sem internet' }).click();
  await expect(secao(page, 'Sem internet')).toHaveAccessibleName(/aberto$/);
  await expect(secao(page, 'Sem internet')).toBeInViewport();
  await semRolagemLateral(page);
  await page.screenshot({ path: captura('ajuda-aluno-1280-escuro.png') });
  expect(errosDaPagina).toEqual([]);
});
