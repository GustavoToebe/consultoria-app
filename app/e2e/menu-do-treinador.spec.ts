import { expect, test, type Locator, type Page } from '@playwright/test';

import { PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Menu do treinador (auditoria-ficha, N29 e o menu do tablet): grupos com título no PC, rótulo curto embaixo do ícone no
 * trilho de 768 a 1023 px, PC minimizado só com ícone e dica, barra do celular igual. Desde 11/11 (guia, p. 28 a 31) o
 * recolher mora na barra de topo, com o contexto curto, e o menu aberto mostra as contagens. Só dados fictícios.
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
  // Na web o Perfil fica na barra de topo, não no menu lateral.
  expect(await nomes('Configurações')).toEqual(['Equipe', 'Importação', 'Ajuda', 'Auditoria']);
  for (const titulo of ['Acompanhamento', 'Conteúdo', 'Negócio', 'Configurações']) await expect(menu(page).getByText(titulo, { exact: true })).toBeVisible();
  // O Início fica no topo, fora de grupo.
  await expect(menu(page).getByRole('link').first()).toHaveAttribute('aria-label', 'Início');

  // Com os títulos o menu passa de 720 px e a lista rola; o "Minimizar" mora na barra de topo, não no menu (sem cópia).
  await expect(page.getByRole('button', { name: 'Minimizar menu' })).toBeInViewport();
  await expect(menu(page).getByRole('button', { name: /Minimizar menu|Expandir menu/ })).toHaveCount(0);
  const auditoria = menu(page).getByRole('link', { name: 'Auditoria', exact: true });
  await auditoria.scrollIntoViewIfNeeded();
  await expect(auditoria).toBeInViewport();
  expect(errosDaPagina).toEqual([]);
});

test('PC (1280×720): barra de topo de 52 a 56 px com recolher, contexto do grupo, busca global e conta', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, 720);
  const minimizar = page.getByRole('button', { name: 'Minimizar menu' });
  const busca = page.getByRole('combobox', { name: 'Buscar telas e ações em todo o app' });
  const conta = page.getByRole('button', { name: /^Menu do usuário/ });
  await expect(busca).toHaveAttribute('placeholder', 'Buscar');
  // Ajuda fica em Configurações: o topo diz o grupo, sem repetir o título da tela.
  await expect(page.getByText('Configurações', { exact: true }).and(page.locator(':not([role="menubar"] *)'))).toBeVisible();
  const [caixaMin, caixaBusca, caixaConta] = [await minimizar.boundingBox(), await busca.boundingBox(), await conta.boundingBox()];
  // Tudo na mesma faixa: recolher à esquerda, busca e conta à direita, alvos de 44.
  expect(caixaMin!.x).toBeLessThan(caixaBusca!.x);
  expect(caixaBusca!.x).toBeLessThan(caixaConta!.x);
  for (const caixa of [caixaMin!, caixaBusca!, caixaConta!]) expect(caixa.height).toBeGreaterThanOrEqual(44);
  const barra = await minimizar.evaluate((el) => {
    let no: HTMLElement | null = el.parentElement;
    while (no && getComputedStyle(no).borderBottomWidth === '0px') no = no.parentElement;
    return no?.getBoundingClientRect().height ?? 0;
  });
  expect(barra).toBeGreaterThanOrEqual(52);
  expect(barra).toBeLessThanOrEqual(56);
  // Ctrl+K continua focando a busca.
  await page.keyboard.press('Control+k');
  await expect(busca).toBeFocused();
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
  expect(errosDaPagina).toEqual([]);
});
