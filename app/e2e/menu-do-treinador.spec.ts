import { expect, test, type Locator, type Page } from '@playwright/test';

import { PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Menu do treinador (auditoria-ficha, N29 e o menu do tablet): grupos com título no PC, rótulo curto embaixo do ícone no
 * trilho de 768 a 1023 px, PC minimizado só com ícone e dica, barra do celular igual. Só dados fictícios.
 */
const TODAS = [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER', 'AGENDA_LER', 'BIBLIOTECA_LER', 'MODELO_LER', 'FINANCEIRO_LER', 'EQUIPE_LER', 'AUDITORIA_LER'];

async function abrir(page: Page, largura: number, altura: number, permissoes = TODAS, aparelho = {}) {
  await page.setViewportSize({ width: largura, height: altura });
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes, pagamentosHabilitados: true }, aparelho)),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
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

test('PC (1280): três grupos com título, na ordem do D6, e o fim do menu alcançável', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, 720);
  const nomes = async (grupo: string) => menu(page).getByRole('group', { name: grupo }).getByRole('link').evaluateAll((ls) => ls.map((l) => l.getAttribute('aria-label')));
  expect(await nomes('Alunos e acompanhamento')).toEqual(['Alunos', 'Atualizações', 'Agenda', 'Biblioteca', 'Planejamento']);
  expect(await nomes('Negócio')).toEqual(['Interessados', 'Financeiro', 'Números']);
  // Na web o Perfil fica na barra de topo, não no menu lateral.
  expect(await nomes('Configurações')).toEqual(['Equipe', 'Importação', 'Ajuda', 'Auditoria']);
  for (const titulo of ['Alunos e acompanhamento', 'Negócio', 'Configurações']) await expect(menu(page).getByText(titulo, { exact: true })).toBeVisible();
  // O Início fica no topo, fora de grupo.
  await expect(menu(page).getByRole('link').first()).toHaveAttribute('aria-label', 'Início');

  // Com os títulos o menu passa de 720 px: a lista rola e o "Minimizar" fica fixo embaixo.
  await expect(page.getByRole('button', { name: 'Minimizar menu' })).toBeInViewport();
  const auditoria = menu(page).getByRole('link', { name: 'Auditoria', exact: true });
  await auditoria.scrollIntoViewIfNeeded();
  await expect(auditoria).toBeInViewport();
  expect(errosDaPagina).toEqual([]);
});

test('PC (1280×720): o passeio traz para a tela o item que a lista rolada escondia', async ({ page }) => {
  await abrir(page, 1280, 720, TODAS, { passeioVisto: false });
  const passeio = page.getByRole('dialog');
  await expect(passeio.getByText('Boas-vindas')).toBeVisible();
  for (let i = 0; i < 20 && !(await passeio.getByText('Importação', { exact: true }).isVisible()); i++) {
    await passeio.getByRole('button', { name: 'Próximo' }).click();
  }
  await expect(passeio).toHaveAttribute('aria-label', 'Passeio pelo menu: Importação');
  await expect(menu(page).getByRole('link', { name: 'Importação', exact: true })).toBeInViewport();
  await passeio.getByRole('button', { name: 'Próximo' }).click();
  await expect(passeio).toHaveAttribute('aria-label', 'Passeio pelo menu: Ajuda');
  await expect(menu(page).getByRole('link', { name: 'Ajuda', exact: true })).toBeInViewport();
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
    // "Planejamento" usa o rótulo curto da barra do celular; o leitor de tela ouve o nome inteiro.
    expect(await rotuloDoLink(menu(page).getByRole('link', { name: 'Planejamento', exact: true }))).toMatchObject({ texto: 'Planos' });
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
  await expect(biblioteca.getByText('Biblioteca', { exact: true })).toBeVisible();
  await expect(menu(page).getByText('Negócio', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Expandir menu' }).click();
  await expect(menu(page).getByText('Negócio', { exact: true })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('celular (390): a barra inferior é a de antes, sem grupos', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 390, 844);
  const nomes = await menu(page).getByRole('link').evaluateAll((ls) => ls.map((l) => l.getAttribute('aria-label')));
  expect(nomes).toEqual(['Início', 'Alunos', 'Biblioteca', 'Planejamento', 'Perfil']);
  await expect(menu(page).getByText('Planos', { exact: true })).toBeVisible();
  await expect(menu(page).getByRole('group')).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});
