import { expect, test, type Locator, type Page } from '@playwright/test';

import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/** Itens de navegação são links de verdade na web: botão direito e Ctrl+clique abrem em nova guia. Só dados fictícios. */
const ID = 'f0000000-0000-4000-8000-000000000001';

/** Permissões completas para que Acompanhamento, Negócio e Configurações tenham 4 itens cada (mesma altura no submenu). */
const PERMISSOES_COMPLETAS = [
  ...PERMISSOES_TREINADOR,
  'ATUALIZACAO_LER',
  'AGENDA_LER',
  'TREINO_LER',
  'BIBLIOTECA_LER',
  'BIBLIOTECA_ALTERAR',
  'MODELO_LER',
  'MODELO_ALTERAR',
  'FINANCEIRO_LER',
  'VITRINE_LER',
  'EQUIPE_LER',
  'AUDITORIA_LER',
];

async function abrirEditor(page: Page, opcoes: { permissoes?: string[]; pagamentosHabilitados?: boolean; vitrineHabilitada?: boolean } = {}) {
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, {
      permissoes: opcoes.permissoes ?? [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR', 'MODELO_LER', 'MODELO_ALTERAR'],
      pagamentosHabilitados: opcoes.pagamentosHabilitados ?? false,
      vitrineHabilitada: opcoes.vitrineHabilitada ?? false,
    })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /exercicios': { corpo: [] },
    [`GET /receitas/${ID}`]: { corpo: { id: ID, tipo: 'SESSAO_TREINO', nome: 'Dia de treino', descricao: null, conteudo: { sessoes: [{ nome: 'Treino A' }] }, ordem: 0, pastaId: null, versao: 1 } },
    [`PUT /receitas/${ID}`]: (pedido, route) => json(route, { id: ID, tipo: 'SESSAO_TREINO', nome: 'Dia de treino', descricao: null, conteudo: pedido.corpo, ordem: 0, pastaId: null, versao: 2 }),
  });
  await page.goto(`/treinador/planejamento/modelo/${ID}`);
  return { errosDaPagina };
}

/** Opacidade efetiva do elemento (multiplica pela dos ancestrais, como o invólucro do submenu). */
async function opacidadeEfetiva(alvo: Locator) {
  return alvo.evaluate((el) => {
    let opacidade = 1;
    for (let no: HTMLElement | null = el as HTMLElement; no && no !== document.body; no = no.parentElement) {
      opacidade *= parseFloat(getComputedStyle(no).opacity);
    }
    return opacidade;
  });
}

test('menu lateral: cada item é um link com href e o Ctrl+clique abre em outra guia', async ({ page, context }) => {
  const { errosDaPagina } = await abrirEditor(page);
  const biblioteca = page.getByRole('link', { name: 'Biblioteca', exact: true });
  await expect(biblioteca).toHaveAttribute('href', '/treinador/biblioteca');
  await expect(page.getByRole('link', { name: 'Alunos', exact: true })).toHaveAttribute('href', '/treinador/alunos');

  // A guia nova não tem a API simulada: abre no href e, assim que o app carrega, volta ao Entrar. O popup já nasce
  // navegado (o Playwright só se liga depois de o pedido sair: nem `request` nem `route` o veem) e, com a máquina
  // carregada, `guia.url()` já é o Entrar. O documento que a guia carregou fica no `PerformanceNavigationTiming`,
  // que a volta ao Entrar (troca de rota dentro do app) não muda.
  const guiaNova = context.waitForEvent('page');
  await biblioteca.click({ modifiers: ['Control'] });
  const guia = await guiaNova;
  // O popup nasce em about:blank e o documento real vem depois (com a máquina carregada, o domcontentloaded do
  // about:blank chega primeiro e o contexto morre na navegação): espera até o documento ser o da Biblioteca.
  await expect.poll(
    () => guia.evaluate(() => new URL((performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).name).pathname).catch(() => ''),
    { timeout: 30_000 },
  ).toBe('/treinador/biblioteca');
  // A guia de origem não saiu do lugar.
  expect(new URL(page.url()).pathname).toBe(`/treinador/planejamento/modelo/${ID}`);
  expect(errosDaPagina).toEqual([]);
});

test('menu lateral: o clique simples navega dentro do app e, com alteração pendente, pergunta antes', async ({ page }) => {
  const { errosDaPagina } = await abrirEditor(page);
  await page.getByRole('button', { name: 'Adicionar exercício' }).first().click();
  const folha = page.getByRole('dialog', { name: 'Escolher exercício' });
  await folha.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('Flexão diamante');
  await folha.getByRole('option', { name: /Usar só o nome Flexão diamante/ }).click();
  await expect(folha).toHaveCount(0);

  await page.getByRole('link', { name: 'Biblioteca', exact: true }).click();
  await expect(page.getByText('Sair sem salvar?')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(`/treinador/planejamento/modelo/${ID}`);
  await page.getByRole('button', { name: 'Sair sem salvar' }).click();
  await expect(page).toHaveURL(/\/treinador\/biblioteca/);
  expect(errosDaPagina).toEqual([]);
});

test('menu lateral minimizado: Ctrl+clique num item do submenu fecha o submenu na guia atual e abre a nova guia', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const { errosDaPagina } = await abrirEditor(page);
  const menu = page.getByRole('menubar');
  await menu.getByRole('button', { name: 'Recolher barra lateral' }).click();

  await menu.getByRole('button', { name: /^Conteúdo(,|$)/ }).click();
  const submenu = menu.getByRole('menu', { name: 'Conteúdo' });
  await expect(submenu).toBeVisible();
  const biblioteca = submenu.getByRole('menuitem', { name: 'Biblioteca', exact: true });
  await expect(biblioteca).toHaveAttribute('href', '/treinador/biblioteca');

  const guiaNova = context.waitForEvent('page');
  await biblioteca.click({ modifiers: ['Control'] });
  await expect(submenu).toHaveCount(0);
  const guia = await guiaNova;
  // O popup nasce em about:blank e o documento real vem depois (com a máquina carregada, o domcontentloaded do
  // about:blank chega primeiro e o contexto morre na navegação): espera até o documento ser o da Biblioteca.
  await expect.poll(
    () => guia.evaluate(() => new URL((performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).name).pathname).catch(() => ''),
    { timeout: 30_000 },
  ).toBe('/treinador/biblioteca');
  expect(new URL(page.url()).pathname).toBe(`/treinador/planejamento/modelo/${ID}`);
  expect(errosDaPagina).toEqual([]);
});

test('no editor de modelo de treino (tema escuro, menu minimizado): hover, clique, troca rápida e travessia nos grupos abrem sempre visíveis', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript((id) => {
    const chave = `treinos:${id}:preferencias`;
    if (localStorage.getItem(chave) === null) localStorage.setItem(chave, JSON.stringify({ tema: 'ESCURO' }));
  }, TREINADOR.id);

  const { errosDaPagina } = await abrirEditor(page, {
    permissoes: PERMISSOES_COMPLETAS,
    pagamentosHabilitados: true,
    vitrineHabilitada: true,
  });

  const menu = page.getByRole('menubar');
  await expect(menu.getByRole('link').first()).toBeVisible();
  await menu.getByRole('button', { name: 'Recolher barra lateral' }).click();
  await page.mouse.move(900, 400);

  const grupo = (nome: string) => menu.getByRole('button', { name: new RegExp(`^${nome}(,|$)`) });
  const submenu = (nome: string) => menu.getByRole('menu', { name: nome });
  const conferirAbertoEVisivel = async (nome: string) => {
    await expect(grupo(nome)).toHaveAttribute('aria-expanded', 'true');
    const painel = submenu(nome);
    await expect(painel).toBeVisible();
    await expect.poll(() => opacidadeEfetiva(painel)).toBe(1);
    expect(await painel.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  };

  // Caso A — Alternância contínua entre grupos (incluindo grupos com o mesmo número de itens e mesma altura).
  let itensNegocio = 0;
  let itensConfiguracoes = 0;
  for (const nome of ['Acompanhamento', 'Conteúdo', 'Negócio', 'Configurações', 'Negócio', 'Configurações', 'Acompanhamento'] as const) {
    await grupo(nome).hover();
    await conferirAbertoEVisivel(nome);
    if (nome === 'Negócio') itensNegocio = await submenu('Negócio').getByRole('menuitem').count();
    if (nome === 'Configurações') itensConfiguracoes = await submenu('Configurações').getByRole('menuitem').count();
  }
  expect(itensNegocio).toBe(4);
  expect(itensConfiguracoes).toBe(itensNegocio);

  // Caso B — Conflito hover + clique imediato + segundo clique no mesmo ícone mantém o submenu aberto e visível.
  for (const nome of ['Negócio', 'Configurações'] as const) {
    await grupo(nome).hover();
    await conferirAbertoEVisivel(nome);
    await grupo(nome).click();
    await conferirAbertoEVisivel(nome);
    await grupo(nome).click();
    await conferirAbertoEVisivel(nome);
  }

  // Caso C — Travessia do ícone até o submenu pelo vão de 16 px com pausa maior que 200 ms.
  await page.mouse.click(900, 400);
  await expect(menu.getByRole('menu')).toHaveCount(0);
  await grupo('Negócio').hover();
  await conferirAbertoEVisivel('Negócio');
  const caixaIconeNegocio = (await grupo('Negócio').boundingBox())!;
  await page.mouse.move(caixaIconeNegocio.x + caixaIconeNegocio.width + 8, caixaIconeNegocio.y + caixaIconeNegocio.height / 2);
  await page.waitForTimeout(260);
  await conferirAbertoEVisivel('Negócio');
  const financeiro = submenu('Negócio').getByRole('menuitem', { name: 'Financeiro', exact: true });
  await financeiro.hover();
  await conferirAbertoEVisivel('Negócio');
  await expect(financeiro).toBeVisible();

  // Caso D1 — Travessia diagonal em 1280×720 raspando em Configurações: hover em Negócio até o último item.
  await page.mouse.click(900, 400);
  await expect(menu.getByRole('menu')).toHaveCount(0);
  await grupo('Negócio').hover();
  await conferirAbertoEVisivel('Negócio');
  const caixaNegocioHover = (await grupo('Negócio').boundingBox())!;
  const ultimoItemNegocio = submenu('Negócio').getByRole('menuitem').last();
  const caixaUltimoNegocio = (await ultimoItemNegocio.boundingBox())!;
  await page.mouse.move(caixaNegocioHover.x + caixaNegocioHover.width / 2, caixaNegocioHover.y + caixaNegocioHover.height / 2);
  await page.mouse.move(caixaUltimoNegocio.x + caixaUltimoNegocio.width / 2, caixaUltimoNegocio.y + caixaUltimoNegocio.height / 2, { steps: 20 });
  await conferirAbertoEVisivel('Negócio');
  await expect(ultimoItemNegocio).toBeVisible();

  // Caso D2 — Em janela baixa (1280×520), topoDoSubmenu empurra Configurações para cima; travessia diagonal subindo sobre Negócio.
  await page.setViewportSize({ width: 1280, height: 520 });
  await page.mouse.click(900, 300);
  await expect(menu.getByRole('menu')).toHaveCount(0);
  await grupo('Configurações').hover();
  await conferirAbertoEVisivel('Configurações');
  const caixaConfig = (await grupo('Configurações').boundingBox())!;
  const primeiroItemConfig = submenu('Configurações').getByRole('menuitem').first();
  const caixaPrimeiroConfig = (await primeiroItemConfig.boundingBox())!;
  await page.mouse.move(caixaConfig.x + caixaConfig.width / 2, caixaConfig.y + caixaConfig.height / 2);
  await page.mouse.move(caixaPrimeiroConfig.x + caixaPrimeiroConfig.width / 2, caixaPrimeiroConfig.y + caixaPrimeiroConfig.height / 2, { steps: 20 });
  await conferirAbertoEVisivel('Configurações');
  await expect(primeiroItemConfig).toBeVisible();

  // Caso D3 — Em 1280×720 com clique em Negócio, travessia diagonal até o último item e clique acionam a navegação.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.mouse.click(900, 400);
  await expect(menu.getByRole('menu')).toHaveCount(0);
  await grupo('Negócio').click();
  await conferirAbertoEVisivel('Negócio');
  const caixaNegocioClique = (await grupo('Negócio').boundingBox())!;
  const ultimoDestino = submenu('Negócio').getByRole('menuitem').last();
  const caixaUltimoDestino = (await ultimoDestino.boundingBox())!;
  await page.mouse.move(caixaNegocioClique.x + caixaNegocioClique.width / 2, caixaNegocioClique.y + caixaNegocioClique.height / 2);
  await page.mouse.move(caixaUltimoDestino.x + caixaUltimoDestino.width / 2, caixaUltimoDestino.y + caixaUltimoDestino.height / 2, { steps: 20 });
  await conferirAbertoEVisivel('Negócio');
  await ultimoDestino.click();
  await expect(page).toHaveURL(/\/treinador\/numeros/);
  await expect(menu.getByRole('menu')).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});
