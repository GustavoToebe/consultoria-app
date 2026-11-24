import { expect, test, type Locator, type Page } from '@playwright/test';

import { MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Menu do treinador (auditoria-ficha, N29 e o menu do tablet): grupos com título e fio vertical no PC, rótulo curto embaixo
 * do ícone no trilho de 768 a 1023 px, PC minimizado com o Início e um ícone por grupo que abre o submenu (Menu Button da
 * APG), barra do celular igual. Guia de 11/11 (p. 28, 29 e 37): sem
 * barra de topo; no topo (24/11, ícones ao lado do logo) a marca e, à direita, "Recolher barra lateral" e a lupa, só ícones
 * com a dica e o atalho (Ctrl+B, Ctrl+K); minimizado, a logo e os dois ícones empilhados embaixo; a conta fixa no pé do
 * menu; o menu aberto mostra as contagens. Só dados fictícios.
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
  // Qualquer item serve: com grupos recolhidos, Alunos pode não estar na lista.
  await expect(menu(page).getByRole('link').first()).toBeVisible();
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
  // Submenu dos grupos (18/11): no grupo aberto, um fio vertical de 1 px, só desenho, liga os itens na coluna da barrinha
  // do item atual (a borda esquerda dos itens), do primeiro ao último.
  const fio = await menu(page).getByRole('group', { name: 'Acompanhamento' }).evaluate((g) => {
    const linha = [...g.querySelectorAll<HTMLElement>('[aria-hidden="true"]')].find((n) => n.getBoundingClientRect().width === 1);
    const itens = [...g.querySelectorAll('a')].map((a) => a.getBoundingClientRect());
    const r = linha?.getBoundingClientRect();
    return r ? { x: r.left, topo: r.top, fim: r.bottom, esquerda: itens[0].left, primeiro: itens[0].top, ultimo: itens[itens.length - 1].bottom } : null;
  });
  expect(fio).not.toBeNull();
  expect(Math.abs(fio!.x - fio!.esquerda)).toBeLessThanOrEqual(3);
  expect(fio!.topo).toBeGreaterThanOrEqual(fio!.primeiro);
  expect(fio!.fim).toBeLessThanOrEqual(fio!.ultimo);
  expect(fio!.fim - fio!.topo).toBeGreaterThan(fio!.ultimo - fio!.primeiro - 44);

  // Com os títulos o menu passa de 720 px e só a lista do meio rola; o recolher fica na linha da marca, uma vez só.
  await expect(menu(page).getByRole('button', { name: 'Recolher barra lateral' })).toBeInViewport();
  await expect(page.getByRole('button', { name: /(Recolher|Expandir) barra lateral/ })).toHaveCount(1);
  const auditoria = menu(page).getByRole('link', { name: 'Auditoria', exact: true });
  await auditoria.scrollIntoViewIfNeeded();
  await expect(auditoria).toBeInViewport();
  expect(errosDaPagina).toEqual([]);
});

// Grupos recolhíveis (docs/planos/menu-grupos-recolhiveis.md): só no menu aberto, escolha guardada no aparelho.
const botaoDoGrupo = (page: Page, acao: 'Recolher' | 'Abrir', grupo: string) =>
  menu(page).getByRole('button', { name: new RegExp(`^${acao} ${grupo}(,|$)`) });
const comGruposRecolhidos = (page: Page, grupos: string[]) =>
  page.addInitScript(([id, g]) => {
    const chave = `treinos:${id}:preferencias`;
    if (localStorage.getItem(chave) === null) localStorage.setItem(chave, JSON.stringify({ gruposRecolhidos: g }));
  }, [TREINADOR.id, grupos] as const);

const botaoDaBusca = (page: Page) => menu(page).getByRole('button', { name: /^Buscar telas e ações, atalho/ });
const botaoDaConta = (page: Page) => menu(page).getByRole('button', { name: /^Conta de / });

test('PC (1280×720): sem barra de topo; uma linha no topo com a marca e, à direita, o recolher e a lupa; a conta fixa no pé, com a lista rolada', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, 720);
  const recolher = menu(page).getByRole('button', { name: 'Recolher barra lateral' });
  // A tela aberta é a Ajuda, perto do fim da lista: o item ativo rola a lista sozinho, então o Início volta antes de medir.
  await menu(page).getByRole('link', { name: 'Início', exact: true }).scrollIntoViewIfNeeded();
  const [caixaRec, caixaBusca, caixaInicio, caixaConta, caixaMenu] = [
    await recolher.boundingBox(),
    await botaoDaBusca(page).boundingBox(),
    await menu(page).getByRole('link', { name: 'Início', exact: true }).boundingBox(),
    await botaoDaConta(page).boundingBox(),
    await menu(page).boundingBox(),
  ];
  // Ícones ao lado do logo (24/11): marca, recolher e lupa na mesma linha, nessa ordem, os dois ícones dentro do menu.
  const marca = await menu(page).getByText(MARCA.nome, { exact: true }).boundingBox();
  const meio = (c: { y: number; height: number }) => c.y + c.height / 2;
  expect(Math.abs(meio(caixaRec!) - meio(marca!))).toBeLessThanOrEqual(4);
  expect(Math.abs(meio(caixaBusca!) - meio(caixaRec!))).toBeLessThanOrEqual(1);
  expect(caixaRec!.x).toBeGreaterThanOrEqual(marca!.x + marca!.width);
  expect(caixaBusca!.x).toBeGreaterThanOrEqual(caixaRec!.x + caixaRec!.width);
  expect(caixaBusca!.x + caixaBusca!.width).toBeLessThanOrEqual(caixaMenu!.x + caixaMenu!.width);
  // O nome curto cabe inteiro ao lado dos ícones, sem alargar o menu.
  expect(caixaMenu!.width).toBe(240);
  expect(await menu(page).getByText(MARCA.nome, { exact: true }).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  // O campo "Buscar" abaixo da marca saiu: a lupa é só ícone, e o recolher existe uma vez só.
  await expect(menu(page).getByText('Buscar', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /(Recolher|Expandir) barra lateral/ })).toHaveCount(1);
  await expect(recolher).toHaveAttribute('aria-expanded', 'true');
  expect(caixaBusca!.y + caixaBusca!.height).toBeLessThanOrEqual(caixaInicio!.y);
  expect(caixaInicio!.y).toBeLessThan(caixaConta!.y);
  // Alvos: 32 de largura por 44 de altura nos ícones do topo (24 é o mínimo da WCAG 2.5.8); a conta com 44.
  for (const caixa of [caixaRec!, caixaBusca!]) {
    expect(caixa.width).toBeGreaterThanOrEqual(32);
    expect(caixa.height).toBeGreaterThanOrEqual(44);
  }
  expect(caixaConta!.height).toBeGreaterThanOrEqual(44);
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

test('PC (1280): nome longo da consultoria fica numa linha com reticências e não empurra os ícones; minimizado, a logo no topo e os ícones empilhados embaixo', async ({ page }) => {
  const nome = 'Saraiva Team Consultoria Esportiva e Nutricional de Alta Performance';
  await page.setViewportSize({ width: 1280, height: 720 });
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: TODAS, marca: { ...MARCA, nome } })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
  });
  await page.goto('/treinador/ajuda');
  const texto = menu(page).getByText(nome, { exact: true });
  await expect(texto).toBeVisible();
  const medida = await texto.evaluate((el) => ({
    linhas: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)),
    cortado: el.scrollWidth > el.clientWidth,
    reticencias: getComputedStyle(el).textOverflow,
  }));
  expect(medida).toEqual({ linhas: 1, cortado: true, reticencias: 'ellipsis' });
  const recolher = menu(page).getByRole('button', { name: 'Recolher barra lateral' });
  const [t, busca, rec, coluna] = [await texto.boundingBox(), await botaoDaBusca(page).boundingBox(), await recolher.boundingBox(), await menu(page).boundingBox()];
  expect(rec!.x).toBeGreaterThanOrEqual(t!.x + t!.width);
  expect(busca!.x + busca!.width).toBeLessThanOrEqual(coluna!.x + coluna!.width);
  expect(coluna!.width).toBe(240);
  // Minimizado: a logo (a inicial, com o nome para o leitor de tela) no topo e, embaixo, "Expandir" e a lupa, na coluna de 72.
  await recolher.click();
  const expandir = menu(page).getByRole('button', { name: 'Expandir barra lateral' });
  await expect(expandir).toHaveAttribute('aria-expanded', 'false');
  const logo = menu(page).getByRole('img', { name: nome });
  await expect(logo).toBeVisible();
  const [caixaLogo, seta, lupa, colunaMin] = [await logo.boundingBox(), await expandir.boundingBox(), await botaoDaBusca(page).boundingBox(), await menu(page).boundingBox()];
  const centro = (c: { x: number; width: number }) => c.x + c.width / 2;
  expect(colunaMin!.width).toBeLessThanOrEqual(73);
  for (const c of [seta!, lupa!]) {
    expect(Math.abs(centro(c) - (colunaMin!.x + 36))).toBeLessThanOrEqual(2);
    expect(c.height).toBeGreaterThanOrEqual(44);
    expect(c.width).toBeGreaterThanOrEqual(44);
  }
  expect(caixaLogo!.y + caixaLogo!.height).toBeLessThanOrEqual(seta!.y);
  expect(seta!.y + seta!.height).toBeLessThanOrEqual(lupa!.y);
  const inicio = await menu(page).getByRole('link', { name: 'Início', exact: true }).boundingBox();
  expect(lupa!.y + lupa!.height).toBeLessThanOrEqual(inicio!.y);
  expect(errosDaPagina).toEqual([]);
});

/** Dica do menu: o texto e o atalho ("Ctrl+B" fora do Mac), desenhados pelo menu fora da lista que rola. */
const dicaDoMenu = (page: Page, texto: string) => menu(page).getByText(texto, { exact: true });
type Caixa = { x: number; y: number; width: number; height: number };
const sobrepoe = (a: Caixa, b: Caixa) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

test('PC (1280): dica com o atalho no mouse e no foco dos ícones do topo, sem cobrir o título; Esc dispensa', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, 900);
  const tituloDaTela = (await page.getByRole('heading', { name: 'Ajuda', exact: true }).first().boundingBox())!;
  const recolher = menu(page).getByRole('button', { name: 'Recolher barra lateral' });
  const caixaMenu = (await menu(page).boundingBox())!;
  // Aberto: a dica fica abaixo do ícone, alinhada pela direita dele, dentro da coluna do menu.
  for (const [botao, texto, atalho] of [[recolher, 'Recolher barra lateral', 'Ctrl+B'], [botaoDaBusca(page), 'Buscar', 'Ctrl+K']] as const) {
    await botao.hover();
    await expect(dicaDoMenu(page, texto)).toBeVisible();
    await expect(dicaDoMenu(page, atalho)).toBeVisible();
    const [dica, caixa, doAtalho] = [(await dicaDoMenu(page, texto).boundingBox())!, (await botao.boundingBox())!, (await dicaDoMenu(page, atalho).boundingBox())!];
    expect(dica.y).toBeGreaterThanOrEqual(caixa.y + caixa.height);
    expect(dica.x).toBeGreaterThanOrEqual(caixaMenu.x);
    expect(doAtalho.x + doAtalho.width).toBeLessThanOrEqual(caixaMenu.x + caixaMenu.width);
    expect(sobrepoe(dica, tituloDaTela)).toBe(false);
    await page.mouse.move(640, 450);
    await expect(dicaDoMenu(page, atalho)).toHaveCount(0);
  }
  // Pelo teclado a dica aparece no foco; Esc a dispensa sem tirar o foco.
  await botaoDaBusca(page).focus();
  await expect(dicaDoMenu(page, 'Ctrl+K')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dicaDoMenu(page, 'Ctrl+K')).toHaveCount(0);
  await expect(botaoDaBusca(page)).toBeFocused();
  // Minimizado: a dica fica à direita do menu, na altura do ícone, e também não cobre o título.
  await recolher.click();
  await page.mouse.move(640, 450);
  const expandir = menu(page).getByRole('button', { name: 'Expandir barra lateral' });
  for (const [botao, texto] of [[expandir, 'Expandir barra lateral'], [botaoDaBusca(page), 'Buscar']] as const) {
    await botao.hover();
    await expect(dicaDoMenu(page, texto)).toBeVisible();
    const [dica, caixa, menuMin] = [(await dicaDoMenu(page, texto).boundingBox())!, (await botao.boundingBox())!, (await menu(page).boundingBox())!];
    expect(dica.x).toBeGreaterThanOrEqual(menuMin.x + menuMin.width);
    expect(Math.abs(dica.y + dica.height / 2 - (caixa.y + caixa.height / 2))).toBeLessThan(caixa.height / 2);
    expect(sobrepoe(dica, tituloDaTela)).toBe(false);
    await page.mouse.move(640, 450);
  }
  expect(errosDaPagina).toEqual([]);
});

test('PC (1280): Ctrl+B alterna a barra (não com o foco num campo nem com Shift); o recolher pelo teclado mantém o foco; a escolha fica ao recarregar', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, 900);
  const largura = async () => Math.round((await menu(page).boundingBox())!.width);
  const recolher = menu(page).getByRole('button', { name: 'Recolher barra lateral' });
  const expandir = menu(page).getByRole('button', { name: 'Expandir barra lateral' });
  await page.keyboard.press('Control+b');
  await expect.poll(largura).toBe(72);
  await expect(expandir).toBeVisible();
  await page.keyboard.press('Control+b');
  await expect.poll(largura).toBe(240);
  // Ctrl+Shift+B é a barra de favoritos do navegador: não mexe na barra.
  await page.keyboard.press('Control+Shift+b');
  await expect(recolher).toBeVisible();
  expect(await largura()).toBe(240);
  // Com o foco num campo de texto (o da busca) Ctrl+B fica com o campo.
  await page.keyboard.press('Control+k');
  const campo = page.getByRole('dialog', { name: 'Buscar' }).getByRole('searchbox', { name: 'Buscar tela ou ação' });
  await expect(campo).toBeFocused();
  await campo.fill('alunos');
  await page.keyboard.press('Control+b');
  await expect(campo).toBeFocused();
  expect(await largura()).toBe(240);
  // E Ctrl+K no campo também não age (o texto fica).
  await page.keyboard.press('Control+k');
  await expect(campo).toHaveValue('alunos');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Buscar' })).toHaveCount(0);

  // Teclado no botão: Enter recolhe e Espaço expande, e o foco continua no mesmo elemento (o botão não é desmontado).
  const elemento = await recolher.elementHandle();
  const focado = () => elemento!.evaluate((el) => document.activeElement === el);
  await recolher.focus();
  await page.keyboard.press('Enter');
  await expect(expandir).toBeFocused();
  expect(await focado()).toBe(true);
  await expect(menu(page).getByText('Negócio', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Space');
  await expect(recolher).toBeFocused();
  expect(await focado()).toBe(true);
  await expect(menu(page).getByText('Negócio', { exact: true })).toBeVisible();

  // A escolha fica salva no aparelho, também a do atalho: recarregar mantém minimizado; expandido, mantém expandido.
  await page.keyboard.press('Control+b');
  await expect.poll(largura).toBe(72);
  await page.reload();
  await expect(expandir).toHaveCount(1);
  await expect(menu(page).getByText('Negócio', { exact: true })).toHaveCount(0);
  await expandir.click();
  await expect(recolher).toBeVisible();
  await page.reload();
  await expect(recolher).toBeVisible();
  await expect(menu(page).getByText('Negócio', { exact: true })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('PC (1280): títulos dos grupos em 14 px semibold, menores que o item de 15, e as setas na mesma coluna', async ({ page }) => {
  await comGruposRecolhidos(page, ['Negócio']);
  const { errosDaPagina } = await abrir(page, 1280, 900, TODAS, {}, { revisar: 0, novas: 2 });
  const estilo = (alvo: Locator) => alvo.evaluate((el) => ({ tamanho: parseFloat(getComputedStyle(el).fontSize), familia: getComputedStyle(el).fontFamily }));
  // O peso vem da família (cada peso da Geist é uma família, Geist_600SemiBold): o `font-weight` computado fica 400.
  for (const titulo of ['Acompanhamento', 'Conteúdo', 'Negócio', 'Configurações']) {
    const e = await estilo(menu(page).getByText(titulo, { exact: true }));
    expect(e.tamanho, titulo).toBeGreaterThanOrEqual(14);
    expect(e.familia, titulo).toMatch(/Geist_(600SemiBold|700Bold)/);
  }
  const item = await estilo(menu(page).getByRole('link', { name: 'Biblioteca', exact: true }).getByText('Biblioteca', { exact: true }));
  expect(item.tamanho).toBe(15);
  expect(item.familia).toMatch(/Geist_500Medium/);
  // A seta dos grupos (abertos e o recolhido, com a contagem) termina na mesma coluna em todos.
  const direitas: number[] = [];
  for (const botao of [botaoDoGrupo(page, 'Recolher', 'Acompanhamento'), botaoDoGrupo(page, 'Recolher', 'Conteúdo'), botaoDoGrupo(page, 'Abrir', 'Negócio')]) {
    const seta = await botao.locator('svg').last().boundingBox();
    direitas.push(seta!.x + seta!.width);
  }
  expect(Math.max(...direitas) - Math.min(...direitas)).toBeLessThanOrEqual(1);
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
  await menu(page).getByRole('button', { name: 'Recolher barra lateral' }).click();
  await expect(botaoDaBusca(page)).toBeVisible();
  await expect(menu(page).getByText('Buscar', { exact: true })).toHaveCount(0);
  await botaoDaBusca(page).focus();
  await expect(menu(page).getByText('Buscar', { exact: true })).toBeVisible();
  await expect(menu(page).getByText(/^(Ctrl\+K|⌘K)$/)).toBeVisible();
  const conta = botaoDaConta(page);
  const caixaDaConta = await conta.boundingBox();
  await conta.click();
  const opcoes = page.getByRole('menu', { name: 'Conta' });
  await expect(opcoes.getByRole('menuitem', { name: 'Sair' })).toBeVisible();
  // Recolhido, o menu abre para o lado, sem sair da janela.
  const caixaDoMenu = await opcoes.boundingBox();
  expect(caixaDoMenu!.x).toBeGreaterThan(caixaDaConta!.x + caixaDaConta!.width);
  expect(caixaDoMenu!.y + caixaDoMenu!.height).toBeLessThanOrEqual(900);
  // submenu dos grupos (18/11): captura do menu da conta, a peça irmã do submenu dos grupos.
  await page.screenshot({ path: test.info().outputPath('menu-conta-minimizado-1280.png') });
  await page.keyboard.press('Escape');
  await expect(opcoes).toHaveCount(0);
  await expect(conta).toBeFocused();
  await menu(page).getByRole('button', { name: 'Expandir barra lateral' }).click();
  expect(errosDaPagina).toEqual([]);
});

test('PC (1280): o menu aberto mostra o número de Atualizações e Interessados; recolhido volta ao ponto', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, 900, TODAS, {}, { revisar: 3, novas: 1 });
  await expect(menu(page).getByRole('link', { name: 'Atualizações, 3 para revisar', exact: true })).toBeVisible();
  await expect(menu(page).getByRole('link', { name: 'Interessados, 1 inscrição nova', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Recolher barra lateral' }).click();
  // submenu dos grupos (18/11): minimizado, o ícone do grupo diz as contagens e o submenu mostra o número no item.
  const acompanhamento = menu(page).getByRole('button', { name: 'Acompanhamento, 3 para revisar', exact: true });
  await expect(acompanhamento).toBeVisible();
  await expect(menu(page).getByRole('button', { name: 'Negócio, 1 inscrição nova', exact: true })).toBeVisible();
  await acompanhamento.hover();
  await expect(menu(page).getByRole('menu', { name: 'Acompanhamento' }).getByRole('menuitem', { name: 'Atualizações, 3 para revisar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Expandir barra lateral' }).click();
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
    // Sem rolagem para o lado e sem o recolher (o trilho é fixo nesta largura).
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: /(Recolher|Expandir) barra lateral/ })).toHaveCount(0);
    // Busca e conta com o rótulo embaixo, como os itens; o nome acessível começa pelo texto visível.
    await expect(botaoDaBusca(page)).toContainText('Buscar');
    await expect(botaoDaConta(page)).toContainText('Conta');
    const auditoria = menu(page).getByRole('link', { name: 'Auditoria', exact: true });
    await auditoria.scrollIntoViewIfNeeded();
    await expect(auditoria).toBeInViewport();
    await page.screenshot({ path: test.info().outputPath(`menu-tablet-${largura}.png`) });
    expect(errosDaPagina).toEqual([]);
  });
}

test('PC minimizado por escolha: só ícone e a dica ao passar o mouse, como antes', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, 900);
  await page.getByRole('button', { name: 'Recolher barra lateral' }).click();
  // submenu dos grupos (18/11): fora de grupo só o Início continua item do trilho, com a dica.
  const biblioteca = menu(page).getByRole('link', { name: 'Início', exact: true });
  expect(await rotuloDoLink(biblioteca)).toBeNull();
  await biblioteca.hover();
  // A dica mora no trilho, fora da lista que rola (D20), e aparece ao lado do item.
  const dica = menu(page).getByText('Início', { exact: true });
  await expect(dica).toBeVisible();
  const [caixaDoItem, caixaDaDica] = [await biblioteca.boundingBox(), await dica.boundingBox()];
  expect(caixaDaDica!.x).toBeGreaterThan(caixaDoItem!.x + caixaDoItem!.width);
  expect(Math.abs(caixaDaDica!.y + caixaDaDica!.height / 2 - (caixaDoItem!.y + caixaDoItem!.height / 2))).toBeLessThan(caixaDoItem!.height / 2);
  await page.mouse.move(640, 400);
  await expect(dica).toHaveCount(0);
  await expect(menu(page).getByText('Negócio', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Expandir barra lateral' }).click();
  await expect(menu(page).getByText('Negócio', { exact: true })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('PC minimizado em janela baixa (1280×720): o "Expandir" fica à vista e o submenu do último grupo abre inteiro na janela (D20)', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, 720);
  await page.getByRole('button', { name: 'Recolher barra lateral' }).click();
  const expandir = page.getByRole('button', { name: 'Expandir barra lateral' });
  await expect(expandir).toBeInViewport({ ratio: 1 });
  // submenu dos grupos (18/11): o último grupo fica à vista e o submenu dele abre inteiro dentro da janela, ao lado
  // do trilho, sem a rolagem nem a borda de baixo cortarem; a Auditoria, último item, está nele.
  const configuracoes = menu(page).getByRole('button', { name: 'Configurações', exact: true });
  await expect(configuracoes).toBeInViewport({ ratio: 1 });
  await configuracoes.hover();
  const submenu = menu(page).getByRole('menu', { name: 'Configurações' });
  await expect(submenu).toBeInViewport({ ratio: 1 });
  await expect(submenu.getByRole('menuitem', { name: 'Auditoria', exact: true })).toBeInViewport({ ratio: 1 });
  const [caixaDoIcone, caixaDoSubmenu] = [await configuracoes.boundingBox(), await submenu.boundingBox()];
  expect(caixaDoSubmenu!.x).toBeGreaterThan(caixaDoIcone!.x + caixaDoIcone!.width);
  expect(caixaDoSubmenu!.y + caixaDoSubmenu!.height).toBeLessThanOrEqual(720);
  await page.screenshot({ path: test.info().outputPath('menu-submenu-ultimo-grupo-1280x720.png') });
  // A página não rola junto: só a lista do menu.
  expect(await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0)).toBe(0);
  await expandir.click();
  await expect(menu(page).getByText('Negócio', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Recolher barra lateral' })).toBeInViewport({ ratio: 1 });
  expect(errosDaPagina).toEqual([]);
});

test('PC (1280): recolher um grupo esconde os itens, mostra a contagem no título e continua recolhido ao recarregar', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, 900, TODAS, {}, { revisar: 3, novas: 1 });
  const recolher = botaoDoGrupo(page, 'Recolher', 'Acompanhamento');
  await expect(recolher).toHaveAttribute('aria-expanded', 'true');
  const caixa = await recolher.boundingBox();
  expect(caixa!.height).toBeGreaterThanOrEqual(44);
  await recolher.click();
  // O mesmo botão, agora "Abrir", com a soma das contagens no nome e o número visível no título; os itens saem.
  const abrirGrupo = menu(page).getByRole('button', { name: 'Abrir Acompanhamento, 3 para revisar', exact: true });
  await expect(abrirGrupo).toHaveAttribute('aria-expanded', 'false');
  await expect(abrirGrupo).toBeFocused();
  await expect(abrirGrupo.getByText('3', { exact: true })).toBeVisible();
  await expect(menu(page).getByRole('link', { name: 'Alunos', exact: true })).toHaveCount(0);
  await expect(menu(page).getByRole('group', { name: 'Acompanhamento' })).toHaveCount(1);

  await page.reload();
  await expect(menu(page).getByRole('link', { name: 'Biblioteca', exact: true })).toBeVisible();
  await expect(botaoDoGrupo(page, 'Abrir', 'Acompanhamento')).toHaveAttribute('aria-expanded', 'false');
  await expect(menu(page).getByRole('link', { name: 'Alunos', exact: true })).toHaveCount(0);

  // Pelo teclado: Enter abre, Espaço recolhe de novo, e o foco fica no botão.
  await botaoDoGrupo(page, 'Abrir', 'Acompanhamento').focus();
  await page.keyboard.press('Enter');
  await expect(botaoDoGrupo(page, 'Recolher', 'Acompanhamento')).toBeFocused();
  await expect(menu(page).getByRole('link', { name: 'Alunos', exact: true })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(botaoDoGrupo(page, 'Abrir', 'Acompanhamento')).toBeFocused();
  expect(errosDaPagina).toEqual([]);
});

test('PC (1280): o nome do grupo recolhido diz a contagem (plural) e, sem nada pendente, é só "Abrir X"', async ({ page }) => {
  await comGruposRecolhidos(page, ['Negócio', 'Conteúdo']);
  const { errosDaPagina } = await abrir(page, 1280, 900, TODAS, {}, { revisar: 0, novas: 2 });
  await expect(menu(page).getByRole('button', { name: 'Abrir Negócio, 2 inscrições novas', exact: true })).toBeVisible();
  await expect(menu(page).getByRole('button', { name: 'Abrir Conteúdo', exact: true })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [1024, 1280]) {
  test(`PC (${largura}), texto Extra e contagem de três dígitos: o nome do grupo recolhido não quebra no meio`, async ({ page }) => {
    await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tamanhoTexto: 'EXTRA', gruposRecolhidos: ['Acompanhamento'] })), TREINADOR.id);
    const { errosDaPagina } = await abrir(page, largura, 900, TODAS, {}, { revisar: 128, novas: 0 });
    const botao = menu(page).getByRole('button', { name: 'Abrir Acompanhamento, 128 para revisar', exact: true });
    await expect(botao.getByText('128', { exact: true })).toBeVisible();
    const nome = botao.getByText('Acompanhamento', { exact: true });
    const linhas = await nome.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
    expect(linhas).toBe(1);
    expect(await nome.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });
}

/** Cor da barrinha (3 × 16, `marcaPeca`) dentro do elemento: a do item atual ou a do título do grupo atual; nulo sem barrinha. */
const corDaBarrinha = (el: Element) => {
  const barra = [...el.querySelectorAll('*')].find((n) => {
    const caixa = n.getBoundingClientRect();
    return getComputedStyle(n).position === 'absolute' && Math.round(caixa.width) === 3 && Math.round(caixa.height) === 16;
  });
  return barra ? getComputedStyle(barra).backgroundColor : null;
};

test('PC (1280): o grupo da tela aberta também recolhe; recolhido, o título leva a barrinha e o aria-current do item atual, e entrar em outra tela não abre o grupo (D9)', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, 900, TODAS, {}, { revisar: 0, novas: 1 });
  // Na Ajuda (Configurações) o título do grupo da tela é botão como os outros: seta, aria-expanded e alvo de 44 px.
  const recolher = botaoDoGrupo(page, 'Recolher', 'Configurações');
  await expect(recolher).toHaveAttribute('aria-expanded', 'true');
  expect((await recolher.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // Aberto, quem tem a barrinha e o aria-current é o item atual, não o título.
  await expect(recolher).not.toHaveAttribute('aria-current');
  expect(await recolher.evaluate(corDaBarrinha)).toBeNull();
  const ajuda = menu(page).getByRole('link', { name: 'Ajuda', exact: true });
  await expect(ajuda).toHaveAttribute('aria-current', 'page');
  const corDoItem = await ajuda.evaluate(corDaBarrinha);
  expect(corDoItem).not.toBeNull();

  await recolher.click();
  // Recolhido: os itens saem e o título ganha a barrinha (a mesma cor do item) e o aria-current; o foco fica no botão.
  const abrirGrupo = botaoDoGrupo(page, 'Abrir', 'Configurações');
  await expect(abrirGrupo).toHaveAttribute('aria-expanded', 'false');
  await expect(abrirGrupo).toHaveAttribute('aria-current', 'true');
  await expect(abrirGrupo).toBeFocused();
  await expect(ajuda).toHaveCount(0);
  expect(await abrirGrupo.evaluate(corDaBarrinha)).toBe(corDoItem);
  // Outro grupo recolhido, sem a tela aberta, não tem marca.
  await botaoDoGrupo(page, 'Recolher', 'Conteúdo').click();
  const conteudo = botaoDoGrupo(page, 'Abrir', 'Conteúdo');
  await expect(conteudo).not.toHaveAttribute('aria-current');
  expect(await conteudo.evaluate(corDaBarrinha)).toBeNull();

  // A escolha fica no aparelho: recarregar mantém o grupo da tela recolhido e marcado.
  await page.reload();
  await expect(botaoDoGrupo(page, 'Abrir', 'Configurações')).toHaveAttribute('aria-current', 'true');
  await expect(menu(page).getByRole('link', { name: 'Ajuda', exact: true })).toHaveCount(0);

  // Pela busca até uma tela de Negócio (grupo aberto): o grupo da tela muda, a marca vai junto e nada abre sozinho.
  await botaoDoGrupo(page, 'Recolher', 'Negócio').click();
  await page.keyboard.press('Control+k');
  const folha = page.getByRole('dialog', { name: 'Buscar' });
  await folha.getByRole('searchbox', { name: 'Buscar tela ou ação' }).fill('interessados');
  await folha.getByRole('link', { name: /^Interessados, / }).first().click();
  const negocio = botaoDoGrupo(page, 'Abrir', 'Negócio');
  await expect(negocio).toHaveAttribute('aria-current', 'true');
  await expect(negocio).toHaveAttribute('aria-expanded', 'false');
  await expect(menu(page).getByRole('link', { name: 'Interessados', exact: true })).toHaveCount(0);
  await expect(botaoDoGrupo(page, 'Abrir', 'Configurações')).not.toHaveAttribute('aria-current');

  // Abrir o grupo mostra o item atual com a marca dele, e o título volta a não ter a sua.
  await negocio.click();
  await expect(menu(page).getByRole('link', { name: /^Interessados/ })).toHaveAttribute('aria-current', 'page');
  const recolherNegocio = botaoDoGrupo(page, 'Recolher', 'Negócio');
  await expect(recolherNegocio).not.toHaveAttribute('aria-current');
  expect(await recolherNegocio.evaluate(corDaBarrinha)).toBeNull();
  expect(errosDaPagina).toEqual([]);
});

test('PC (1280×720): com os grupos recolhidos a lista cabe sem rolar; a busca e a conta ficam onde estavam', async ({ page }) => {
  await comGruposRecolhidos(page, ['Acompanhamento', 'Conteúdo', 'Negócio']);
  const { errosDaPagina } = await abrir(page, 1280, 720);
  const lista = page.locator('#rolagem-do-menu');
  await expect(botaoDoGrupo(page, 'Abrir', 'Negócio')).toBeVisible();
  expect(await lista.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
  await expect(botaoDaBusca(page)).toBeInViewport({ ratio: 1 });
  await expect(botaoDaConta(page)).toBeInViewport({ ratio: 1 });
  expect(errosDaPagina).toEqual([]);
});

test('passeio com um grupo recolhido: os passos dos itens escondidos saem, sem abrir o grupo nem mudar a escolha', async ({ page }) => {
  await comGruposRecolhidos(page, ['Negócio']);
  await abrir(page, 1280, 900, TODAS, { passeioVisto: false });
  const passeio = page.getByRole('dialog');
  await expect(passeio.getByText('Boas-vindas')).toBeVisible();
  const passos: string[] = [];
  for (let i = 0; i < 20; i++) {
    const nome = ((await passeio.getAttribute('aria-label')) ?? '').replace('Passeio pelo menu: ', '');
    passos.push(nome);
    const proximo = passeio.getByRole('button', { name: 'Próximo' });
    if (!(await proximo.count())) break;
    await proximo.click();
    await expect(passeio).not.toHaveAttribute('aria-label', `Passeio pelo menu: ${nome}`);
  }
  expect(passos).toContain('Alunos');
  for (const escondido of ['Interessados', 'Financeiro', 'Números']) expect(passos).not.toContain(escondido);
  await expect(botaoDoGrupo(page, 'Abrir', 'Negócio')).toHaveAttribute('aria-expanded', 'false');
});

test('passeio com o grupo da tela aberta recolhido: o passo do item atual sai, os dos outros grupos ficam e a escolha não muda', async ({ page }) => {
  await comGruposRecolhidos(page, ['Configurações']);
  await abrir(page, 1280, 900, TODAS, { passeioVisto: false });
  const passeio = page.getByRole('dialog');
  await expect(passeio.getByText('Boas-vindas')).toBeVisible();
  const passos: string[] = [];
  for (let i = 0; i < 20; i++) {
    const nome = ((await passeio.getAttribute('aria-label')) ?? '').replace('Passeio pelo menu: ', '');
    passos.push(nome);
    const proximo = passeio.getByRole('button', { name: 'Próximo' });
    if (!(await proximo.count())) break;
    await proximo.click();
    await expect(passeio).not.toHaveAttribute('aria-label', `Passeio pelo menu: ${nome}`);
  }
  expect(passos).toContain('Alunos');
  expect(passos).toContain('Financeiro');
  for (const escondido of ['Equipe', 'Importação', 'Ajuda']) expect(passos).not.toContain(escondido);
  await expect(botaoDoGrupo(page, 'Abrir', 'Configurações')).toHaveAttribute('aria-expanded', 'false');
});

test('trilho (900) e PC minimizado: nenhum botão de grupo e todos os itens à vista, mesmo com grupo recolhido', async ({ page }) => {
  await comGruposRecolhidos(page, ['Negócio']);
  await abrir(page, 900, 720);
  await expect(menu(page).getByRole('button', { name: /^(Recolher|Abrir) / })).toHaveCount(0);
  await expect(menu(page).getByRole('link', { name: 'Financeiro', exact: true })).toHaveCount(1);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(botaoDoGrupo(page, 'Abrir', 'Negócio')).toBeVisible();
  await page.getByRole('button', { name: 'Recolher barra lateral' }).click();
  await expect(menu(page).getByRole('button', { name: /^(Recolher|Abrir) / })).toHaveCount(0);
  // submenu dos grupos (18/11): minimizado, o Financeiro está no submenu de Negócio, mesmo com o grupo salvo recolhido.
  await menu(page).getByRole('button', { name: /^Negócio/ }).hover();
  await expect(menu(page).getByRole('menuitem', { name: 'Financeiro', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Expandir barra lateral' }).click();
});

// submenu dos grupos (18/11): no PC minimizado cada grupo é um botão de menu (padrão "Menu Button" da WAI-ARIA APG).
test('PC minimizado (1280): o ícone do grupo abre o submenu pelo teclado, setas andam, Esc e Tab saem, clique fora fecha', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, 900);
  await menu(page).getByRole('button', { name: 'Recolher barra lateral' }).click();
  const grupo = (nome: string) => menu(page).getByRole('button', { name: new RegExp(`^${nome}`) });
  const submenu = (nome: string) => menu(page).getByRole('menu', { name: nome });
  const acompanhamento = grupo('Acompanhamento');
  await expect(acompanhamento).toHaveAttribute('aria-haspopup', 'menu');
  await expect(acompanhamento).toHaveAttribute('aria-expanded', 'false');

  // Focar mostra o submenu sem tirar o foco do ícone; ↓ entra no primeiro item.
  await acompanhamento.focus();
  await expect(acompanhamento).toHaveAttribute('aria-expanded', 'true');
  await expect(submenu('Acompanhamento')).toBeVisible();
  await expect(acompanhamento).toBeFocused();
  await page.keyboard.press('ArrowDown');
  const itens = submenu('Acompanhamento').getByRole('menuitem');
  await expect(itens.first()).toBeFocused();
  await page.screenshot({ path: test.info().outputPath('menu-submenu-foco-1280.png') });
  for (const caixa of await itens.evaluateAll((ls) => ls.map((l) => l.getBoundingClientRect().height))) expect(caixa).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('ArrowUp');
  await expect(itens.last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(itens.first()).toBeFocused();
  await page.keyboard.press('End');
  await expect(itens.last()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(itens.first()).toBeFocused();

  // Esc fecha e devolve o foco ao ícone, sem reabrir; Enter abre de novo com o foco no primeiro item.
  await page.keyboard.press('Escape');
  await expect(submenu('Acompanhamento')).toHaveCount(0);
  await expect(acompanhamento).toBeFocused();
  await expect(acompanhamento).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await expect(itens.first()).toBeFocused();

  // Tab sai do submenu, que fecha, e segue para o ícone do grupo seguinte.
  await page.keyboard.press('Tab');
  await expect(submenu('Acompanhamento')).toHaveCount(0);
  await expect(grupo('Conteúdo')).toBeFocused();

  // O grupo da tela aberta (Ajuda, em Configurações) fica marcado; dentro, o item atual tem aria-current.
  const configuracoes = grupo('Configurações');
  await expect(configuracoes).toHaveAttribute('aria-current', 'true');
  await expect(acompanhamento).not.toHaveAttribute('aria-current', /.+/);
  await configuracoes.click();
  await expect(submenu('Configurações').getByRole('menuitem', { name: 'Ajuda', exact: true })).toHaveAttribute('aria-current', 'page');
  // Aberto pelo clique, fica aberto com o mouse fora e fecha com o clique fora.
  await page.mouse.move(900, 450);
  await expect(submenu('Configurações')).toBeVisible();
  await page.mouse.click(900, 450);
  await expect(submenu('Configurações')).toHaveCount(0);

  // Aberto pela passagem do mouse, fecha quando o mouse sai; escolher um item navega e fecha.
  await grupo('Conteúdo').hover();
  await expect(submenu('Conteúdo')).toBeVisible();
  await page.mouse.move(900, 450);
  await expect(submenu('Conteúdo')).toHaveCount(0);
  await grupo('Conteúdo').hover();
  await submenu('Conteúdo').getByRole('menuitem', { name: 'Biblioteca', exact: true }).click();
  await expect(page).toHaveURL(/\/treinador\/biblioteca/);
  await expect(submenu('Conteúdo')).toHaveCount(0);
  await expect(grupo('Conteúdo')).toHaveAttribute('aria-current', 'true');
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
  // submenu dos grupos (18/11): captura do celular, que segue com a barra de baixo (não há gaveta).
  await page.keyboard.press('Escape');
  await page.screenshot({ path: test.info().outputPath('menu-celular-390.png') });
  expect(errosDaPagina).toEqual([]);
});

// Capturas para conferir o desenho (só com CAPTURAS=<pasta>, fora da suíte normal): topo do menu e títulos dos grupos.
const LOGO_LARGA = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="150"><rect width="600" height="150" rx="16" fill="#3F3F46"/><text x="300" y="98" font-family="Arial" font-size="72" font-weight="700" fill="#FAFAFA" text-anchor="middle">LOGO LARGA</text></svg>';
for (const tema of ['ESCURO', 'CLARO'] as const) {
  test(`capturas do menu no tema ${tema}`, async ({ page }) => {
    test.skip(!process.env.CAPTURAS, 'só para gerar capturas');
    const pasta = process.env.CAPTURAS;
    const foto = (nome: string) => page.screenshot({ path: `${pasta}/menu-${tema.toLowerCase()}-${nome}.png` });
    // Recorte só do menu lateral, para conferir a largura do trilho (72 minimizado, 88 no tablet) e o alinhamento.
    const recorte = async (nome: string) => page.screenshot({ path: `${pasta}/menu-${tema.toLowerCase()}-${nome}.png`, clip: (await menu(page).boundingBox())! });
    const preparar = async (largura: number, prefs: object, marca = MARCA) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.evaluate(([id, p]) => { localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(p)); localStorage.removeItem('menu-lateral-recolhido'); }, [TREINADOR.id, { tema, ...prefs }] as const);
      await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: TODAS, pagamentosHabilitados: true, marca })),
        'GET /inscricoes': { corpo: { itens: [], total: 1 } },
        'GET /painel': { corpo: { atualizacoesParaRevisar: 3 } },
        'GET /publico/marcas/{id}/logo': (_pedido, route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: LOGO_LARGA }),
      });
      await page.goto('/treinador/ajuda');
      await expect(menu(page).getByRole('link').first()).toBeVisible();
      await page.mouse.move(900, 600);
    };
    await page.goto('/');
    await preparar(1280, {});
    await foto('1280-expandido');
    await menu(page).getByRole('button', { name: 'Recolher barra lateral' }).click();
    await page.mouse.move(900, 600);
    await foto('1280-minimizado-repouso');
    await menu(page).getByRole('button', { name: 'Expandir barra lateral' }).hover();
    await foto('1280-minimizado-hover');
    await page.mouse.move(900, 600);
    await botaoDaBusca(page).focus();
    await page.keyboard.press('Shift+Tab');
    await foto('1280-minimizado-foco-teclado');
    // Submenu dos grupos: aberto pela passagem do mouse e pelo teclado (↓ foca o primeiro item). Sem foco antes, para a
    // dica do "Expandir" não aparecer junto.
    const semFoco = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await semFoco();
    await page.mouse.move(900, 600);
    await menu(page).getByRole('button', { name: /^Acompanhamento/ }).hover();
    await expect(menu(page).getByRole('menu', { name: 'Acompanhamento' })).toBeVisible();
    await foto('1280-minimizado-submenu-mouse');
    await page.mouse.move(900, 600);
    await expect(menu(page).getByRole('menu', { name: 'Acompanhamento' })).toHaveCount(0);
    await menu(page).getByRole('button', { name: /^Negócio/ }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(menu(page).getByRole('menu', { name: 'Negócio' }).getByRole('menuitem').first()).toBeFocused();
    await foto('1280-minimizado-submenu-teclado');
    await page.keyboard.press('Escape');
    await semFoco();
    await page.mouse.move(900, 600);
    await recorte('1280-minimizado-trilho-72');
    await preparar(1280, { gruposRecolhidos: ['Acompanhamento'] });
    await foto('1280-grupo-recolhido');
    // D9: o grupo da tela aberta (Configurações, na Ajuda) recolhido leva a barrinha e o resumo no título; Negócio, sem a tela, não.
    await preparar(1280, { gruposRecolhidos: ['Configurações', 'Negócio'] });
    await foto('1280-grupo-atual-recolhido');
    await recorte('1280-grupo-atual-recolhido-recorte');
    await preparar(1280, { tamanhoTexto: 'EXTRA', gruposRecolhidos: ['Acompanhamento'] });
    await foto('1280-texto-extra');
    await preparar(1280, {}, { ...MARCA, logoUrl: '/publico/marcas/c0000000-0000-4000-8000-000000000001/logo?v=1' });
    await expect(menu(page).getByRole('img', { name: MARCA.nome })).toBeVisible();
    await foto('1280-logo-larga');
    await menu(page).getByRole('button', { name: 'Recolher barra lateral' }).click();
    await page.mouse.move(900, 600);
    await foto('1280-logo-larga-minimizado');
    await preparar(1280, {}, { ...MARCA, nome: 'Saraiva Team Consultoria Esportiva e Nutricional de Alta Performance' });
    await foto('1280-nome-longo');
    await preparar(800, {});
    await foto('800-trilho');
    await recorte('800-trilho-88');
    await preparar(390, {});
    await foto('390-celular');
  });
}
