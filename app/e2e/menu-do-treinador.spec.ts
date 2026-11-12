import { expect, test, type Locator, type Page } from '@playwright/test';

import { PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Menu do treinador (auditoria-ficha, N29 e o menu do tablet): grupos com título no PC, rótulo curto embaixo do ícone no
 * trilho de 768 a 1023 px, PC minimizado só com ícone e dica, barra do celular igual. Guia de 11/11 (p. 28, 29 e 37): sem
 * barra de topo; o recolher fica na linha da marca, "Buscar" (Ctrl K) logo abaixo e a conta fixa no pé do menu; o menu
 * aberto mostra as contagens. Só dados fictícios.
 */
const TODAS = [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER', 'AGENDA_LER', 'BIBLIOTECA_LER', 'MODELO_LER', 'FINANCEIRO_LER', 'EQUIPE_LER', 'AUDITORIA_LER'];

async function abrir(page: Page, largura: number, altura: number, permissoes = TODAS, aparelho = {}, contagens = { revisar: 0, novas: 0 }) {
  await page.setViewportSize({ width: largura, height: altura });
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes, pagamentosHabilitados: true }, aparelho)),
    'GET /inscricoes': { corpo: { itens: [], total: contagens.novas } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: contagens.revisar } },
  });
  await page.goto('/treinador/ajuda');
  await expect(menu(page).getByRole('link', { name: 'Alunos', exact: true })).toBeVisible();
  return { errosDaPagina };
}

const menu = (page: Page) => page.getByRole('menubar');

/** Texto visível dentro do link e se ele coube sem reticências. */
function rotuloDoLink(link: Locator) {
  return link.evaluate((el) => {
    const folha = [...el.querySelectorAll('*')].find((n) => n.children.length === 0 && (n.textContent ?? '').trim() !== '');
    return folha ? { texto: folha.textContent, cabe: folha.scrollWidth <= folha.clientWidth, visivel: (folha as HTMLElement).offsetWidth > 0 } : null;
  });
}

test('PC (1280): quatro grupos com título, na ordem do D6, e o fim do menu alcançável', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, 720);
  const nomes = async (grupo: string) => menu(page).getByRole('group', { name: grupo }).getByRole('link').evaluateAll((ls) => ls.map((l) => l.getAttribute('aria-label')));
  expect(await nomes('Acompanhamento')).toEqual(['Alunos', 'Atualizações', 'Agenda']);
  expect(await nomes('Conteúdo')).toEqual(['Biblioteca', 'Planejamento']);
  expect(await nomes('Negócio')).toEqual(['Interessados', 'Financeiro', 'Números']);
  // Na web o Perfil não entra na lista: a conta fica no pé do menu.
  expect(await nomes('Configurações')).toEqual(['Equipe', 'Importação', 'Ajuda', 'Auditoria']);
  for (const titulo of ['Acompanhamento', 'Conteúdo', 'Negócio', 'Configurações']) await expect(menu(page).getByText(titulo, { exact: true })).toBeVisible();
  // O Início fica no topo, fora de grupo.
  await expect(menu(page).getByRole('link').first()).toHaveAttribute('aria-label', 'Início');

  // Com os títulos o menu passa de 720 px e só a lista do meio rola; o "Minimizar" fica na linha da marca, uma vez só.
  await expect(menu(page).getByRole('button', { name: 'Minimizar menu' })).toBeInViewport();
  await expect(page.getByRole('button', { name: /Minimizar menu|Expandir menu/ })).toHaveCount(1);
  const auditoria = menu(page).getByRole('link', { name: 'Auditoria', exact: true });
  await auditoria.scrollIntoViewIfNeeded();
  await expect(auditoria).toBeInViewport();
  expect(errosDaPagina).toEqual([]);
});

const botaoDaBusca = (page: Page) => menu(page).getByRole('button', { name: /^Buscar telas e ações, atalho/ });
const botaoDaConta = (page: Page) => menu(page).getByRole('button', { name: /^Conta de / });

test('PC (1280×720): sem barra de topo; recolher na linha da marca, Buscar abaixo e a conta fixa no pé, com a lista rolada', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, 720);
  const minimizar = menu(page).getByRole('button', { name: 'Minimizar menu' });
  // A tela aberta é a Ajuda, perto do fim da lista: o item ativo rola a lista sozinho, então o Início volta antes de medir.
  await menu(page).getByRole('link', { name: 'Início', exact: true }).scrollIntoViewIfNeeded();
  const [caixaMin, caixaBusca, caixaInicio, caixaConta] = [
    await minimizar.boundingBox(),
    await botaoDaBusca(page).boundingBox(),
    await menu(page).getByRole('link', { name: 'Início', exact: true }).boundingBox(),
    await botaoDaConta(page).boundingBox(),
  ];
  // Ordem de cima para baixo: marca + recolher, Buscar, itens, conta; alvos de 44.
  expect(caixaMin!.y).toBeLessThan(caixaBusca!.y);
  expect(caixaBusca!.y).toBeLessThan(caixaInicio!.y);
  expect(caixaInicio!.y).toBeLessThan(caixaConta!.y);
  for (const caixa of [caixaMin!, caixaBusca!, caixaConta!]) expect(caixa.height).toBeGreaterThanOrEqual(44);
  // Nada de faixa no topo do conteúdo: o título da tela começa no respiro da Tela (8 de folga do painel + 16). Com a barra
  // de 52 a 56 px ele ficava abaixo de 76; o teto de 72 separa os dois casos (a Ajuda no PC não tem nada antes do título).
  const titulo = await page.getByRole('heading', { level: 1 }).boundingBox();
  expect(titulo!.y).toBeLessThan(72);
  // Rolar a lista até o fim não tira a busca nem a conta da tela.
  const auditoria = menu(page).getByRole('link', { name: 'Auditoria', exact: true });
  await auditoria.scrollIntoViewIfNeeded();
  await expect(botaoDaBusca(page)).toBeInViewport({ ratio: 1 });
  await expect(botaoDaConta(page)).toBeInViewport({ ratio: 1 });
  expect(errosDaPagina).toEqual([]);
});

test('PC (1280): Ctrl+K abre a busca em qualquer tela, Esc fecha; a estrela favorita e o campo vazio mostra os favoritos', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, 900);
  await page.keyboard.press('Control+k');
  const folha = page.getByRole('dialog', { name: 'Buscar' });
  const campo = folha.getByRole('searchbox', { name: 'Buscar tela ou ação' });
  await expect(campo).toBeFocused();
  await expect(folha.getByText('Atalhos', { exact: true })).toBeVisible();
  await campo.fill('alunos');
  const estrela = folha.getByRole('button', { name: 'Favoritar Alunos', exact: true });
  await expect(estrela).toBeVisible();
  const caixa = await estrela.boundingBox();
  expect(caixa!.width).toBeGreaterThanOrEqual(44);
  expect(caixa!.height).toBeGreaterThanOrEqual(44);
  await estrela.click();
  await expect(folha.getByRole('button', { name: 'Tirar Alunos dos favoritos', exact: true })).toBeVisible();
  await campo.fill('');
  await expect(folha.getByText('Favoritos', { exact: true })).toBeVisible();
  await expect(folha.getByRole('link', { name: /^Alunos, / })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(folha).toHaveCount(0);
  // Pelo botão do menu abre a mesma busca, e o foco volta a ele ao fechar.
  await botaoDaBusca(page).click();
  await expect(page.getByRole('dialog', { name: 'Buscar' }).getByText('Favoritos', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(botaoDaBusca(page)).toBeFocused();
  expect(errosDaPagina).toEqual([]);
});

test('PC minimizado (1280): a busca vira a lupa com nome e a conta, só as iniciais; o menu da conta abre ao lado e Esc o fecha', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, 900);
  await menu(page).getByRole('button', { name: 'Minimizar menu' }).click();
  await expect(botaoDaBusca(page)).toBeVisible();
  await expect(menu(page).getByText('Buscar', { exact: true })).toHaveCount(0);
  await botaoDaBusca(page).focus();
  await expect(menu(page).getByText(/^Buscar \((Ctrl|⌘) K\)$/)).toBeVisible();
  const conta = botaoDaConta(page);
  const caixaDaConta = await conta.boundingBox();
  await conta.click();
  const opcoes = page.getByRole('menu', { name: 'Conta' });
  await expect(opcoes.getByRole('menuitem', { name: 'Sair' })).toBeVisible();
  // Recolhido, o menu abre para o lado, sem sair da janela.
  const caixaDoMenu = await opcoes.boundingBox();
  expect(caixaDoMenu!.x).toBeGreaterThan(caixaDaConta!.x + caixaDaConta!.width);
  expect(caixaDoMenu!.y + caixaDoMenu!.height).toBeLessThanOrEqual(900);
  await page.keyboard.press('Escape');
  await expect(opcoes).toHaveCount(0);
  await expect(conta).toBeFocused();
  await menu(page).getByRole('button', { name: 'Expandir menu' }).click();
  expect(errosDaPagina).toEqual([]);
});

test('PC (1280): o menu aberto mostra o número de Atualizações e Interessados; recolhido volta ao ponto', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, 900, TODAS, {}, { revisar: 3, novas: 1 });
  await expect(menu(page).getByRole('link', { name: 'Atualizações, 3 para revisar', exact: true })).toBeVisible();
  await expect(menu(page).getByRole('link', { name: 'Interessados, 1 inscrição nova', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Minimizar menu' }).click();
  await expect(menu(page).getByRole('link', { name: 'Atualizações, pendência', exact: true })).toBeVisible();
  await expect(menu(page).getByRole('link', { name: 'Interessados, pendência', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Expandir menu' }).click();
  expect(errosDaPagina).toEqual([]);
});

test('PC (1280): sem nada para revisar, nenhum número nem ponto', async ({ page }) => {
  await abrir(page, 1280, 900);
  await expect(menu(page).getByRole('link', { name: 'Atualizações', exact: true })).toBeVisible();
  await expect(menu(page).getByRole('link', { name: 'Interessados', exact: true })).toBeVisible();
});

test('PC (1280×720): o passeio traz para a tela o item que a lista rolada escondia', async ({ page }) => {
  await abrir(page, 1280, 720, TODAS, { passeioVisto: false });
  const passeio = page.getByRole('dialog');
  await expect(passeio.getByText('Boas-vindas')).toBeVisible();
  const passos: string[] = [];
  for (let i = 0; i < 20; i++) {
    const nome = ((await passeio.getAttribute('aria-label')) ?? '').replace('Passeio pelo menu: ', '');
    passos.push(nome);
    if (nome === 'Importação' || nome === 'Ajuda') await expect(menu(page).getByRole('link', { name: nome, exact: true })).toBeInViewport();
    if (nome === 'Ajuda') break;
    await passeio.getByRole('button', { name: 'Próximo' }).click();
    await expect(passeio).not.toHaveAttribute('aria-label', `Passeio pelo menu: ${nome}`);
  }
  expect(passos).toContain('Importação');
  // O passeio segue a ordem do menu (D6): os passos que apontam um item vêm na mesma ordem dos links.
  const links = await menu(page).getByRole('link').evaluateAll((ls) => ls.map((l) => l.getAttribute('aria-label') ?? ''));
  const doMenu = passos.filter((p) => links.includes(p));
  expect(doMenu).toEqual(links.filter((l) => doMenu.includes(l)));
});

test('PC (1280×720): o item da tela aberta não fica cortado no fim da lista', async ({ page }) => {
  await abrir(page, 1280, 720);
  await expect(menu(page).getByRole('link', { name: 'Ajuda', exact: true })).toBeInViewport({ ratio: 1 });
});

test('perfil sem nenhum item de Negócio: o grupo some com o título', async ({ page }) => {
  await abrir(page, 1280, 720, ['ALUNO_LER', 'BIBLIOTECA_LER']);
  await expect(menu(page).getByRole('link', { name: 'Alunos', exact: true })).toBeVisible();
  await expect(menu(page).getByRole('group', { name: 'Negócio' })).toHaveCount(0);
  await expect(menu(page).getByText('Negócio', { exact: true })).toHaveCount(0);
  await expect(menu(page).getByRole('group', { name: 'Configurações' }).getByRole('link')).toHaveText([/Ajuda/]);
});

for (const [largura, altura] of [[900, 720], [768, 1024]] as const) {
  test(`tablet (${largura}): rótulo curto embaixo de cada ícone, sem corte, e grupos separados por fio`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura, altura);
    const links = menu(page).getByRole('link');
    const total = await links.count();
    expect(total).toBe(13);
    for (let i = 0; i < total; i++) {
      const rotulo = await rotuloDoLink(links.nth(i));
      expect(rotulo, `item ${i}`).not.toBeNull();
      expect(rotulo!.visivel, `${rotulo!.texto} visível`).toBe(true);
      expect(rotulo!.cabe, `${rotulo!.texto} sem reticências`).toBe(true);
    }
    // "Planejamento" usa o rótulo curto da barra do celular; o nome acessível começa pelo visível (WCAG 2.5.3) e diz o inteiro.
    expect(await rotuloDoLink(menu(page).getByRole('link', { name: 'Planos (Planejamento)', exact: true }))).toMatchObject({ texto: 'Planos' });
    // Sem título no trilho (só o fio), mas o grupo continua com nome para o leitor de tela.
    await expect(menu(page).getByText('Negócio', { exact: true })).toHaveCount(0);
    await expect(menu(page).getByRole('group', { name: 'Negócio' })).toHaveCount(1);
    // Sem rolagem para o lado e sem "Minimizar" (o trilho é fixo nesta largura).
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: /Minimizar menu|Expandir menu/ })).toHaveCount(0);
    // Busca e conta com o rótulo embaixo, como os itens; o nome acessível começa pelo texto visível.
    await expect(botaoDaBusca(page)).toContainText('Buscar');
    await expect(botaoDaConta(page)).toContainText('Conta');
    const auditoria = menu(page).getByRole('link', { name: 'Auditoria', exact: true });
    await auditoria.scrollIntoViewIfNeeded();
    await expect(auditoria).toBeInViewport();
    expect(errosDaPagina).toEqual([]);
  });
}

test('PC minimizado por escolha: só ícone e a dica ao passar o mouse, como antes', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, 900);
  await page.getByRole('button', { name: 'Minimizar menu' }).click();
  const biblioteca = menu(page).getByRole('link', { name: 'Biblioteca', exact: true });
  expect(await rotuloDoLink(biblioteca)).toBeNull();
  await biblioteca.hover();
  // A dica mora no trilho, fora da lista que rola (D20), e aparece ao lado do item.
  const dica = menu(page).getByText('Biblioteca', { exact: true });
  await expect(dica).toBeVisible();
  const [caixaDoItem, caixaDaDica] = [await biblioteca.boundingBox(), await dica.boundingBox()];
  expect(caixaDaDica!.x).toBeGreaterThan(caixaDoItem!.x + caixaDoItem!.width);
  expect(Math.abs(caixaDaDica!.y + caixaDaDica!.height / 2 - (caixaDoItem!.y + caixaDoItem!.height / 2))).toBeLessThan(caixaDoItem!.height / 2);
  await page.mouse.move(640, 400);
  await expect(dica).toHaveCount(0);
  await expect(menu(page).getByText('Negócio', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Expandir menu' }).click();
  await expect(menu(page).getByText('Negócio', { exact: true })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('PC minimizado em janela baixa (1280×720): o "Expandir" fica à vista e a lista rola com a dica no lugar (D20)', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, 720);
  await page.getByRole('button', { name: 'Minimizar menu' }).click();
  const expandir = page.getByRole('button', { name: 'Expandir menu' });
  await expect(expandir).toBeInViewport({ ratio: 1 });
  // O último item chega rolando a lista de ícones, e a dica dele aparece ao lado, inteira, sem a rolagem cortar.
  const auditoria = menu(page).getByRole('link', { name: 'Auditoria', exact: true });
  await auditoria.scrollIntoViewIfNeeded();
  await expect(auditoria).toBeInViewport({ ratio: 1 });
  await auditoria.hover();
  const dica = menu(page).getByText('Auditoria', { exact: true });
  await expect(dica).toBeInViewport({ ratio: 1 });
  const [caixaDoItem, caixaDaDica] = [await auditoria.boundingBox(), await dica.boundingBox()];
  expect(Math.abs(caixaDaDica!.y + caixaDaDica!.height / 2 - (caixaDoItem!.y + caixaDoItem!.height / 2))).toBeLessThan(caixaDoItem!.height / 2);
  // A página não rola junto: só a lista do menu.
  expect(await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0)).toBe(0);
  await expandir.click();
  await expect(menu(page).getByText('Negócio', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Minimizar menu' })).toBeInViewport({ ratio: 1 });
  expect(errosDaPagina).toEqual([]);
});

test('celular (390): a barra inferior é a de antes, sem grupos', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 390, 844);
  const nomes = await menu(page).getByRole('link').evaluateAll((ls) => ls.map((l) => l.getAttribute('aria-label')));
  expect(nomes).toEqual(['Início', 'Alunos', 'Biblioteca', 'Planos (Planejamento)', 'Perfil']);
  await expect(menu(page).getByText('Planos', { exact: true })).toBeVisible();
  await expect(menu(page).getByRole('group')).toHaveCount(0);
  // Sem faixa global no celular: nem busca nem conta no menu; o Perfil abre a mesma busca em "Buscar telas".
  await expect(botaoDaBusca(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Conta de / })).toHaveCount(0);
  await menu(page).getByRole('link', { name: 'Perfil', exact: true }).click();
  await page.getByRole('button', { name: /^Buscar telas/ }).click();
  await expect(page.getByRole('dialog', { name: 'Buscar' }).getByRole('searchbox', { name: 'Buscar tela ou ação' })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});
