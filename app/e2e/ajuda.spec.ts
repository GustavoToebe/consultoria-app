import { expect, test, type Page } from '@playwright/test';

import { ALUNO, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/**
 * Ajuda em formato de documentação (28/11): página inicial "Começar a usar" (tutorial, passeio, Primeiros passos e a
 * grade dos assuntos), índice dos assuntos à esquerda no PC (seletor "Assunto" no celular), o artigo do assunto com um
 * h3 por tópico e "Nesta página" à direita na tela larga; a busca lista os tópicos com o trecho e Enter abre o primeiro;
 * `?secao=&topico=` abre o artigo no tópico. Sem rolagem lateral de 390 a 1920 px, nos temas claro e escuro e com o
 * texto maior; o treinador e o aluno têm cada um o seu guia. A fonte de vídeos começa vazia: nada de bloco de vídeo.
 * `CAPTURAS` aponta a pasta das capturas (sem ela, a pasta de resultados de cada teste). Só dados fictícios.
 */
const captura = (nome: string) => (process.env.CAPTURAS ? `${process.env.CAPTURAS}/${nome}` : test.info().outputPath(nome));

const TODAS = [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER', 'AGENDA_LER', 'BIBLIOTECA_LER', 'MODELO_LER', 'FINANCEIRO_LER', 'EQUIPE_LER'];

type Preferencias = { tema?: 'ESCURO'; tamanhoTexto?: 'EXTRA' };

async function preferir(page: Page, id: string, prefs: Preferencias) {
  await page.addInitScript(([chave, valor]) => localStorage.setItem(chave, valor), [`treinos:${id}:preferencias`, JSON.stringify(prefs)] as const);
}

async function abrirTreinador(page: Page, largura: number, opcoes: { prefs?: Preferencias; menuRecolhido?: boolean; caminho?: string } = {}) {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
  if (opcoes.prefs) await preferir(page, TREINADOR.id, opcoes.prefs);
  if (opcoes.menuRecolhido) await page.addInitScript(() => localStorage.setItem('menu-lateral-recolhido', '1'));
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: TODAS, pagamentosHabilitados: true })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
  });
  await page.goto(opcoes.caminho ?? '/treinador/ajuda', { waitUntil: 'domcontentloaded' });
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
const nestaPagina = (page: Page) => page.getByRole('navigation', { name: 'Nesta página' });
const seletor = (page: Page) => page.getByRole('button', { name: /^Assunto: .*\. Escolher\.$/ });
const campoDaBusca = (page: Page) => page.getByLabel('Buscar na ajuda');
const resultados = (page: Page) => page.getByRole('list', { name: 'Resultados da busca' });
const artigo = (page: Page, titulo: string) => page.getByRole('heading', { name: titulo, level: 2, exact: true });
const topico = (page: Page, titulo: string) => page.getByRole('heading', { name: titulo, level: 3, exact: true });

async function semRolagemLateral(page: Page) {
  const { documento, janela } = await page.evaluate(() => ({ documento: document.documentElement.scrollWidth, janela: document.documentElement.clientWidth }));
  expect(documento).toBeLessThanOrEqual(janela);
}

test('treinador no PC (1280): página inicial, busca em lista com o trecho, Enter abre o primeiro e "Nenhum resultado" devolve o foco', async ({ page }) => {
  const { errosDaPagina } = await abrirTreinador(page, 1280);
  await expect(indice(page)).toBeVisible();
  await expect(seletor(page)).toHaveCount(0);
  await expect(artigo(page, 'Começar a usar')).toBeVisible();
  await expect(indice(page).getByRole('button', { name: 'Começar a usar' })).toHaveAttribute('aria-current', 'location');
  await expect(page.getByRole('button', { name: 'Começar o tutorial' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Conhecer o menu' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Início, \d+ tópicos$/ }).first()).toBeVisible();
  await expect(page.getByText(/Vídeos? \(abre fora do app\)/)).toHaveCount(0);
  // O nome acessível começa pelo texto visível (WCAG 2.5.3).
  await expect(page.getByRole('button', { name: /^Abrir o guia \(PDF\)/ })).toBeVisible();
  // Abaixo de ~1190 px de área (1280 com o menu aberto) não há "Nesta página".
  await indice(page).getByRole('button', { name: /^Início,/ }).click();
  await expect(artigo(page, 'Início')).toBeVisible();
  await expect(nestaPagina(page)).toHaveCount(0);
  await semRolagemLateral(page);
  await page.screenshot({ path: captura('ajuda-treinador-1280.png') });

  // Sem acento acha "Emissão": a lista traz o assunto, o tópico e o trecho com a palavra.
  await campoDaBusca(page).fill('emissao');
  await expect(page.getByText(/^\d+ resultados?$/)).toBeVisible();
  const achado = resultados(page).getByRole('link', { name: /Achar uma cobrança/ });
  await expect(achado).toBeVisible();
  await expect(achado).toContainText(/emissão/i);
  await campoDaBusca(page).fill('Emissão');
  await expect(achado).toBeVisible();
  await page.screenshot({ path: captura('ajuda-treinador-1280-busca.png') });
  await achado.click();
  await expect(page).toHaveURL(/secao=financeiro&topico=achar-uma-cobranca/);
  await expect(campoDaBusca(page)).toHaveValue('');
  await expect(topico(page, 'Achar uma cobrança')).toBeInViewport();

  // Enter abre o primeiro resultado (o tópico cujo título casa vem primeiro).
  await campoDaBusca(page).fill('trocas para ver');
  await campoDaBusca(page).press('Enter');
  await expect(page).toHaveURL(/secao=inicio&topico=trocas-para-ver/);
  await expect(topico(page, 'Trocas para ver')).toBeInViewport();

  await campoDaBusca(page).fill('xyzzy');
  await expect(page.getByText('Nenhum resultado', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Limpar busca' }).click();
  await expect(campoDaBusca(page)).toBeFocused();
  await expect(campoDaBusca(page)).toHaveValue('');
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [1920, 3440]) test(`treinador em ${largura}: conjunto junto do menu, "Nesta página" acompanha a rolagem e o índice fica parado`, async ({ page }) => {
  const { errosDaPagina } = await abrirTreinador(page, largura, { caminho: '/treinador/ajuda?secao=inicio' });
  await expect(artigo(page, 'Início')).toBeVisible();
  await expect(nestaPagina(page)).toBeVisible();
  // Sem faixa vazia antes do título: o índice começa na mesma borda do título "Ajuda" e a coluna de leitura para em 760.
  const titulo = await page.getByRole('heading', { name: 'Ajuda', level: 1 }).boundingBox();
  const caixaDoIndice = await indice(page).boundingBox();
  expect(Math.abs(caixaDoIndice!.x - titulo!.x)).toBeLessThanOrEqual(8);
  const leitura = await artigo(page, 'Início').evaluate((el) => el.parentElement!.parentElement!.getBoundingClientRect().width);
  expect(leitura).toBeLessThanOrEqual(760);
  // A sobra fica à direita do conjunto (índice + artigo + "Nesta página", até 1308 px), não entre as colunas.
  const caixaDaNesta = await nestaPagina(page).boundingBox();
  expect(caixaDaNesta!.x + caixaDaNesta!.width - caixaDoIndice!.x).toBeLessThanOrEqual(1308 + 8);
  const ultimo = nestaPagina(page).getByRole('link').last();
  await ultimo.click();
  await expect(ultimo).toHaveAttribute('aria-current', 'location');
  const topoDoIndice = await indice(page).evaluate((el) => el.getBoundingClientRect().top);
  expect(topoDoIndice).toBeGreaterThanOrEqual(0);
  expect(topoDoIndice).toBeLessThan(40);
  await expect(indice(page).getByRole('button', { name: /^Início,/ })).toHaveAttribute('aria-current', 'location');
  await semRolagemLateral(page);
  await page.screenshot({ path: captura(`ajuda-treinador-${largura}-artigo.png`) });
  expect(errosDaPagina).toEqual([]);
});

test('o "Saiba mais" abre o artigo no tópico, destacado por um instante', async ({ page }) => {
  const { errosDaPagina } = await abrirTreinador(page, 1440, { caminho: '/treinador/ajuda?secao=inicio&topico=graficos' });
  await expect(artigo(page, 'Início')).toBeVisible();
  await expect(topico(page, 'Gráficos')).toBeInViewport();
  // Deep-link antigo, só com a seção: o artigo no topo.
  await page.goto('/treinador/ajuda?secao=consultoria', { waitUntil: 'domcontentloaded' });
  await expect(artigo(page, 'Consultoria')).toBeInViewport();
  // Seção que não existe: a página inicial.
  await page.goto('/treinador/ajuda?secao=nao-existe', { waitUntil: 'domcontentloaded' });
  await expect(artigo(page, 'Começar a usar')).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('treinador no celular (390): seletor de assunto no topo, sem índice e sem rolagem lateral', async ({ page }) => {
  const { errosDaPagina } = await abrirTreinador(page, 390);
  await expect(indice(page)).toHaveCount(0);
  await expect(seletor(page)).toBeVisible();
  await semRolagemLateral(page);
  await page.screenshot({ path: captura('ajuda-treinador-390.png') });
  await seletor(page).click();
  await page.getByRole('option', { name: /Agenda presencial/ }).click();
  await expect(artigo(page, 'Agenda presencial')).toBeVisible();
  await semRolagemLateral(page);
  await page.screenshot({ path: captura('ajuda-treinador-390-artigo.png') });
  expect(errosDaPagina).toEqual([]);
});

test('treinador no tema escuro e com o texto maior (1280 e 390): sem rolagem lateral', async ({ page }) => {
  const { errosDaPagina } = await abrirTreinador(page, 1280, { prefs: { tema: 'ESCURO', tamanhoTexto: 'EXTRA' } });
  await campoDaBusca(page).fill('lote');
  await expect(resultados(page).getByRole('link', { name: /Registrar pagamentos em lote/ })).toBeVisible();
  await semRolagemLateral(page);
  await page.screenshot({ path: captura('ajuda-treinador-1280-escuro-extra.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(seletor(page)).toBeVisible();
  await semRolagemLateral(page);
  await page.screenshot({ path: captura('ajuda-treinador-390-escuro-extra.png') });
  expect(errosDaPagina).toEqual([]);
});

test('aluno: guia próprio, busca e seletor no celular', async ({ page }) => {
  const { errosDaPagina } = await abrirAluno(page, 390);
  await expect(seletor(page)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Comunidade, \d+ tópicos$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Financeiro \(cobrar seus alunos\)/ })).toHaveCount(0);
  await expect(page.getByText(/Vídeos? \(abre fora do app\)/)).toHaveCount(0);
  await semRolagemLateral(page);
  await page.screenshot({ path: captura('ajuda-aluno-390.png') });
  await campoDaBusca(page).fill('colecoes');
  await expect(resultados(page).getByRole('link', { name: /Comunidade/ }).first()).toBeVisible();
  await semRolagemLateral(page);
  await page.screenshot({ path: captura('ajuda-aluno-390-busca.png') });
  expect(errosDaPagina).toEqual([]);
});

test('aluno no PC (1280, escuro): índice ao lado e sem rolagem lateral', async ({ page }) => {
  const { errosDaPagina } = await abrirAluno(page, 1280, { tema: 'ESCURO' });
  await expect(indice(page)).toBeVisible();
  await indice(page).getByRole('button', { name: /^Sem internet,/ }).click();
  await expect(artigo(page, 'Sem internet')).toBeInViewport();
  await expect(indice(page).getByRole('button', { name: /^Sem internet,/ })).toHaveAttribute('aria-current', 'location');
  await semRolagemLateral(page);
  await page.screenshot({ path: captura('ajuda-aluno-1280-escuro.png') });
  expect(errosDaPagina).toEqual([]);
});
