import { expect, test, type Page } from '@playwright/test';

import type { ConsultoriaResponse } from '../src/api/tipos';
import { abreDentro, cartoesVisiveis, destinoNaColuna, gruposDeCartoes } from '../src/dominio/configuracoes';
import { MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Configurações do treinador (`docs/planos/configuracoes-centralizadas.md`). A partir de 1024 px de janela: duas colunas,
 * `nav` "Configurações" à esquerda (busca e grupos, um item por linha) e o item aberto à direita, em
 * `/treinador/configuracoes/<id>`; os itens de telas do menu principal abrem a tela inteira deles. Abaixo de 1024: a lista
 * em linhas, que abre as rotas inteiras de sempre. Os itens esperados saem da regra pura da tela (`dominio/configuracoes`).
 * Só dados fictícios.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const ACESSO_TOTAL = [
  ...PERMISSOES_TREINADOR, 'MARCA_ALTERAR', 'CONTA_LER', 'EQUIPE_LER', 'AUDITORIA_LER', 'MODELO_LER', 'FINANCEIRO_LER',
  'BIBLIOTECA_ALTERAR', 'AGENDA_LER', 'BIBLIOTECA_LER', 'ATUALIZACAO_LER', 'WHATSAPP_ALTERAR',
];
const CONSULTORIA: ConsultoriaResponse = { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR' };

interface Perfil {
  permissoes: string[]; administrador?: boolean; pagamentos?: boolean; recebimentoOnline?: boolean; whatsapp?: boolean; contratos?: boolean; tema?: 'CLARO' | 'AREIA' | 'ESCURO';
  larguraConteudo?: 'AUTOMATICA' | 'LIMITADA';
}

const ADMIN: Perfil = { permissoes: ACESSO_TOTAL, administrador: true, pagamentos: true, recebimentoOnline: true, whatsapp: true };

async function abrir(page: Page, largura: number, perfil: Perfil, caminho = '/treinador/configuracoes') {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 800 });
  if (perfil.tema || perfil.larguraConteudo) {
    const prefs = JSON.stringify({ ...(perfil.tema ? { tema: perfil.tema } : null), ...(perfil.larguraConteudo ? { larguraConteudo: perfil.larguraConteudo } : null) });
    await page.addInitScript(([id, p]) => localStorage.setItem(`treinos:${id}:preferencias`, p), [TREINADOR.id, prefs]);
  }
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, {
      permissoes: perfil.permissoes,
      perfil: { id: 'p1', nome: perfil.administrador ? 'Administrador' : 'Treinador', acessoTotal: !!perfil.administrador },
      pagamentosHabilitados: perfil.pagamentos ?? false,
      recebimentoOnlineHabilitado: perfil.recebimentoOnline ?? false,
      whatsappHabilitado: perfil.whatsapp ?? false,
      contratosHabilitados: perfil.contratos ?? false,
    })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /consultoria': { corpo: CONSULTORIA },
    'GET /contratos/modelos': { corpo: [] },
  });
  await page.goto(caminho);
  return { errosDaPagina };
}

function esperado(perfil: Perfil) {
  const visiveis = cartoesVisiveis({
    pode: (c) => perfil.permissoes.includes(c),
    administrador: !!perfil.administrador,
    pagamentosHabilitados: perfil.pagamentos ?? false,
    chaves: { recebimentoOnlineHabilitado: perfil.recebimentoOnline ?? false, whatsappHabilitado: perfil.whatsapp ?? false, contratosHabilitados: perfil.contratos ?? false },
  });
  return { grupos: gruposDeCartoes(visiveis).map((g) => g.grupo), visiveis };
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Configurações' });
const busca = (page: Page) => page.getByRole('textbox', { name: 'Pesquisar configuração' }).or(page.getByRole('searchbox', { name: 'Pesquisar configuração' })).first();
const item = (page: Page, titulo: string) => nav(page).getByRole('link', { name: titulo, exact: true });
const linha = (page: Page, titulo: string) => page.getByRole('link', { name: new RegExp(`^${titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, `) });
const h1 = (page: Page) => page.getByRole('heading', { level: 1 });

/** Os grupos da coluna (role=group com o nome), na ordem do DOM. */
const gruposDaColuna = (page: Page) => nav(page).getByRole('group').evaluateAll((gs) => gs.map((g) => g.getAttribute('aria-label') ?? ''));

async function semRolagemLateral(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra).toBeLessThanOrEqual(0);
}

test('1280, acesso total: sem item abre Meus dados (sem empilhar), a coluna traz os grupos em ordem e cada item com o destino certo', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, ADMIN);
  await expect(page).toHaveURL(/\/treinador\/configuracoes\/meus-dados$/);
  await expect(h1(page)).toHaveText('Meus dados');
  await expect(h1(page)).toHaveCount(1);
  await expect(item(page, 'Meus dados')).toHaveAttribute('aria-current', 'page');
  const { grupos, visiveis } = esperado(ADMIN);
  expect(grupos).toEqual(['Sua conta', 'Consultoria', 'Equipe', 'Alunos e atendimento', 'Financeiro', 'Dados', 'Ajuda']);
  await expect.poll(() => gruposDaColuna(page)).toEqual(grupos);
  for (const c of visiveis) {
    const nome = abreDentro(c) ? c.titulo : `${c.titulo}, abre a tela inteira`;
    await expect(item(page, nome), c.id).toHaveAttribute('href', destinoNaColuna(c));
    // A descrição não aparece na linha: vai no `title` (dica do mouse e descrição acessível).
    await expect(item(page, nome)).toHaveAttribute('title', c.descricao);
  }
  await expect(nav(page).getByText('Aniversários dos alunos')).toHaveCount(0);
  // O "voltar" depois do redirecionamento não cai em /configuracoes de novo (ele seria um laço).
  expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(2);
  await semRolagemLateral(page);
  expect(errosDaPagina).toEqual([]);
});

test('Contratos (1280 e 390): com CONTRATO_LER e a chave, o item abre dentro (1280) ou a rota inteira (390); sem a chave, some', async ({ page }) => {
  const comContratos: Perfil = { ...ADMIN, permissoes: [...ACESSO_TOTAL, 'CONTRATO_LER'], contratos: true };
  const { errosDaPagina } = await abrir(page, 1280, comContratos);
  expect(esperado(comContratos).visiveis.map((c) => c.id)).toContain('contratos');
  await item(page, 'Contratos').click();
  await expect(page).toHaveURL(/\/configuracoes\/contratos$/);
  await expect(h1(page)).toHaveText('Contratos');
  await expect(page.getByText('Ainda não há modelo de contrato. Peça a quem administra a consultoria.')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/treinador/configuracoes');
  await linha(page, 'Contratos').click();
  await expect(page).toHaveURL(/\/treinador\/contratos$/);
  await expect(h1(page)).toHaveText('Contratos');
  expect(errosDaPagina).toEqual([]);
});

test('Contratos (1280): sem a chave da plataforma o item não aparece, mesmo com CONTRATO_LER', async ({ page }) => {
  const semChave: Perfil = { ...ADMIN, permissoes: [...ACESSO_TOTAL, 'CONTRATO_LER'], contratos: false };
  await abrir(page, 1280, semChave);
  await expect(h1(page)).toHaveText('Meus dados');
  expect(esperado(semChave).visiveis.map((c) => c.id)).not.toContain('contratos');
  await expect(item(page, 'Contratos')).toHaveCount(0);
});

test('perfil restrito (1280): só os itens que ele pode abrir; Consultoria, Equipe e Financeiro somem', async ({ page }) => {
  const restrito: Perfil = { permissoes: PERMISSOES_TREINADOR };
  await abrir(page, 1280, restrito);
  const { grupos } = esperado(restrito);
  await expect.poll(() => gruposDaColuna(page)).toEqual(grupos);
  for (const fora of ['Marca', 'Contato', 'Documentos (PDF)', 'Assinatura e faturas']) await expect(item(page, fora)).toHaveCount(0);
});

test('1280: escolher empilha no histórico, o voltar do navegador volta ao item anterior e a coluna não remonta', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, ADMIN);
  await expect(h1(page)).toHaveText('Meus dados');
  await busca(page).fill('a');
  await item(page, 'Segurança').click();
  await expect(page).toHaveURL(/\/configuracoes\/seguranca$/);
  await expect(h1(page)).toHaveText('Segurança');
  await expect(item(page, 'Segurança')).toHaveAttribute('aria-current', 'page');
  await expect(item(page, 'Meus dados')).not.toHaveAttribute('aria-current', 'page');
  await expect(page).toHaveTitle(/^Segurança · /);
  await item(page, 'Termos e privacidade').click();
  await expect(h1(page)).toHaveText('Termos e privacidade');
  await page.goBack();
  await expect(page).toHaveURL(/\/configuracoes\/seguranca$/);
  await expect(h1(page)).toHaveText('Segurança');
  // A busca continua escrita: a coluna (e o campo) ficou montada nas três trocas.
  await expect(busca(page)).toHaveValue('a');
  expect(errosDaPagina).toEqual([]);
});

test('1280: link direto, troca e voltar: o voltar do navegador volta ao item do link, com o endereço dele', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, ADMIN, '/treinador/configuracoes/seguranca');
  await expect(h1(page)).toHaveText('Segurança');
  await expect(page).toHaveURL(/\/configuracoes\/seguranca$/);
  await item(page, 'Termos e privacidade').click();
  await expect(h1(page)).toHaveText('Termos e privacidade');
  await page.goBack();
  await expect(page).toHaveURL(/\/configuracoes\/seguranca$/);
  await expect(h1(page)).toHaveText('Segurança');
  await expect(item(page, 'Segurança')).toHaveAttribute('aria-current', 'page');
  expect(errosDaPagina).toEqual([]);
});

test('1280: recarregar (F5), trocar e voltar: volta à Marca com o endereço dela', async ({ page }) => {
  await abrir(page, 1280, ADMIN, '/treinador/configuracoes/marca');
  await expect(h1(page)).toHaveText('Marca');
  await page.reload();
  await expect(h1(page)).toHaveText('Marca');
  await expect(page).toHaveURL(/\/configuracoes\/marca$/);
  await item(page, 'Meus dados').click();
  await expect(h1(page)).toHaveText('Meus dados');
  await page.goBack();
  await expect(page).toHaveURL(/\/configuracoes\/marca$/);
  await expect(h1(page)).toHaveText('Marca');
});

test('1280: a coluna fica parada quando o item rola, e o item novo abre no topo', async ({ page }) => {
  await abrir(page, 1280, ADMIN, '/treinador/configuracoes/ajustes');
  await expect(h1(page)).toHaveText('Aparência e preferências');
  await expect(page).toHaveURL(/\/configuracoes\/ajustes$/);
  const topoDaColuna = async () => (await nav(page).boundingBox())!.y;
  const antes = await topoDaColuna();
  const titulo0 = (await h1(page).boundingBox())!.y;
  await page.mouse.move(900, 500);
  await page.mouse.wheel(0, 1500);
  await expect.poll(async () => (await h1(page).boundingBox())!.y).toBeLessThan(titulo0 - 200);
  expect(await topoDaColuna()).toBe(antes);
  await item(page, 'Meus dados').click();
  await expect(h1(page)).toHaveText('Meus dados');
  // No topo da coluna (o Ajustes tem folga maior que as outras telas, 28 contra 16 px).
  expect((await h1(page).boundingBox())!.y).toBeLessThanOrEqual(titulo0);
});

test('1280: item de tela do menu principal abre a tela inteira, fora das duas colunas', async ({ page }) => {
  await abrir(page, 1280, ADMIN);
  await item(page, 'Auditoria, abre a tela inteira').click();
  await expect(page).toHaveURL(/\/treinador\/auditoria$/);
  await expect(h1(page)).toHaveText('Auditoria');
  await expect(nav(page)).toHaveCount(0);
  await page.goBack();
  await expect(nav(page)).toBeVisible();
});

test('1280, busca: filtra por título e descrição sem acento, esconde grupo vazio, não mexe no endereço nem no item aberto; Esc limpa', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, ADMIN, '/treinador/configuracoes/seguranca');
  await expect(h1(page)).toHaveText('Segurança');
  await busca(page).fill('HISTORICO');
  await expect(nav(page).getByText('1 configuração encontrada')).toBeVisible();
  await expect.poll(() => gruposDaColuna(page)).toEqual(['Equipe']);
  await expect(item(page, 'Auditoria, abre a tela inteira')).toBeVisible();
  // O item aberto some da lista, mas continua aberto à direita.
  await expect(item(page, 'Segurança')).toHaveCount(0);
  await expect(h1(page)).toHaveText('Segurança');
  await expect(page).toHaveURL(/\/configuracoes\/seguranca$/);
  await busca(page).fill('verificação em duas');
  await expect.poll(() => gruposDaColuna(page)).toEqual(['Sua conta']);
  await busca(page).fill('xyzw');
  await expect(nav(page).getByText('Nada encontrado para “xyzw”')).toBeVisible();
  await expect(nav(page).getByRole('group')).toHaveCount(0);
  await busca(page).press('Escape');
  await expect(busca(page)).toHaveValue('');
  await expect.poll(() => gruposDaColuna(page)).toEqual(esperado(ADMIN).grupos);
  await busca(page).fill('xyzw');
  await nav(page).getByRole('button', { name: 'Limpar busca' }).first().click();
  await expect(busca(page)).toHaveValue('');
  await expect(busca(page)).toBeFocused();
  expect(errosDaPagina).toEqual([]);
});

test('1280, teclado: do campo, o Tab chega ao primeiro item com foco visível e o Enter abre', async ({ page }) => {
  await abrir(page, 1280, ADMIN);
  await expect(h1(page)).toHaveText('Meus dados');
  await busca(page).focus();
  await page.keyboard.press('Tab');
  await expect(item(page, 'Meus dados')).toBeFocused();
  expect(await item(page, 'Meus dados').evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Tab');
  await expect(item(page, 'Segurança')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/configuracoes\/seguranca$/);
});

test('1280: Contato abre a Marca dentro de Configurações, rolada até o cartão Contato', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, ADMIN);
  await busca(page).fill('remetente');
  await item(page, 'Contato').click();
  await expect(page).toHaveURL(/\/configuracoes\/contato$/);
  await expect(h1(page)).toHaveText('Marca');
  await expect(page.getByRole('heading', { level: 2, name: 'Contato' })).toBeInViewport();
  expect(errosDaPagina).toEqual([]);
});

test('1280, Tags dos alunos dentro de Configurações: sem a seta e a trilha da tela inteira', async ({ page }) => {
  await abrir(page, 1280, ADMIN, '/treinador/configuracoes/tags-dos-alunos');
  await expect(h1(page)).toHaveText('Tags dos alunos');
  await expect(page.getByRole('navigation', { name: 'Trilha' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Voltar' })).toHaveCount(0);
});

test('1280: item que o perfil não vê mostra o vazio; link direto para item sem a permissão não abre a tela dele', async ({ page }) => {
  // Administrador sem MARCA_ALTERAR: abre a Marca (rota), mas o item Contato pede a permissão.
  await abrir(page, 1280, { permissoes: PERMISSOES_TREINADOR, administrador: true }, '/treinador/configuracoes/contato');
  await expect(page.getByRole('heading', { level: 1, name: 'Configuração indisponível' })).toBeVisible();
  await page.goto('/treinador/configuracoes/minha-conta');
  // Sem CONTA_LER a guarda fecha a rota (o roteador volta ao índice, que abre Meus dados); a Assinatura nunca aparece.
  await expect(page).toHaveURL(/\/configuracoes\/meus-dados$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Assinatura e faturas' })).toHaveCount(0);
});

test('1280: link direto para um item que pede a permissão da rota (Marca) abre nele, com o endereço certo', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, ADMIN, '/treinador/configuracoes/marca');
  await expect(h1(page)).toHaveText('Marca');
  await expect(page).toHaveURL(/\/configuracoes\/marca$/);
  await expect(item(page, 'Marca')).toHaveAttribute('aria-current', 'page');
  await expect(page).toHaveTitle(/^Marca · /);
  expect(errosDaPagina).toEqual([]);
});

test('390: a lista em linhas simples, sem Aniversários; o item abre a rota inteira e o voltar volta à lista', async ({ page }) => {
  const poucos: Perfil = { permissoes: ['ALUNO_LER', 'PAINEL_VER'] };
  const { errosDaPagina } = await abrir(page, 390, poucos);
  await expect(h1(page)).toHaveText('Configurações');
  await expect(nav(page)).toHaveCount(0);
  const h2 = await page.getByRole('heading', { level: 2 }).allTextContents();
  expect(h2.map((t) => t.trim())).toEqual(esperado(poucos).grupos);
  await expect(page.getByText('Aniversários dos alunos')).toHaveCount(0);
  await linha(page, 'Segurança').click();
  await expect(page).toHaveURL(/\/treinador\/seguranca$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/treinador\/configuracoes$/);
  await semRolagemLateral(page);
  expect(errosDaPagina).toEqual([]);
});

test('390: busca com vazio e o endereço do item dentro de Configurações vai para a rota inteira', async ({ page }) => {
  await abrir(page, 390, ADMIN);
  await busca(page).fill('xyzw');
  await expect(page.getByRole('heading', { level: 2, name: 'Nada encontrado para “xyzw”' })).toBeVisible();
  await page.getByRole('button', { name: 'Limpar busca' }).last().click();
  await expect(linha(page, 'Meus dados')).toBeVisible();
  await page.goto('/treinador/configuracoes/marca');
  await expect(page).toHaveURL(/\/treinador\/marca$/);
  await expect(h1(page)).toHaveText('Marca');
});

test('PC (1280): "Configurações" do menu da conta abre a coluna com Meus dados', async ({ page }) => {
  await abrir(page, 1280, ADMIN, '/treinador/ajuda');
  await page.getByRole('menubar').getByRole('button', { name: /^Conta de / }).click();
  await page.getByRole('menu', { name: 'Conta' }).getByRole('menuitem', { name: /Configurações/ }).click();
  await expect(page).toHaveURL(/\/treinador\/configuracoes\/meus-dados$/);
  await expect(nav(page)).toBeVisible();
});

test('celular (390): o Perfil leva às Configurações', async ({ page }) => {
  await abrir(page, 390, ADMIN, '/treinador/perfil');
  await page.getByRole('link', { name: 'Configurações', exact: true }).click();
  await expect(page).toHaveURL(/\/treinador\/configuracoes$/);
  await expect(h1(page)).toHaveText('Configurações');
});

for (const tema of ['CLARO', 'ESCURO'] as const) {
  for (const largura of [390, 768, 1024, 1920]) {
    test(`tema ${tema.toLowerCase()} em ${largura}: sem rolagem lateral nem erro`, async ({ page }) => {
      const { errosDaPagina } = await abrir(page, largura, { ...ADMIN, tema });
      if (largura >= 1024) await expect(nav(page)).toBeVisible();
      else await expect(page.getByRole('heading', { level: 2, name: 'Ajuda' })).toBeVisible();
      await semRolagemLateral(page);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

/**
 * Bordas do bloco do item (o conteúdo da `Tela`, que contém o h1) dentro da área à direita da coluna dos itens: a área
 * começa onde a coluna termina (com a borda dela) e vai até a barra de rolagem do item.
 */
async function blocoDoItem(page: Page) {
  return h1(page).evaluate((titulo) => {
    let b = titulo as HTMLElement;
    while (b.parentElement && (b.getBoundingClientRect().width < 900 || b.parentElement.getBoundingClientRect().width - b.getBoundingClientRect().width < 4)) b = b.parentElement;
    const r = b.getBoundingClientRect();
    let coluna = document.querySelector('nav[aria-label="Configurações"], [role="navigation"][aria-label="Configurações"]') as HTMLElement;
    while (coluna.parentElement && coluna.getBoundingClientRect().width < 300) coluna = coluna.parentElement;
    // O fim da área é o do conteúdo da rolagem (o pai do bloco): a barra de rolagem vertical do item fica fora dela.
    const area = b.parentElement!.getBoundingClientRect();
    return { antes: r.left - coluna.getBoundingClientRect().right, depois: area.right - r.right, largura: r.width };
  });
}

// Tela larga (26/11, item 7): sem vão ao lado do item. Automática: o item preenche a área à direita da coluna (só o respiro
// lateral de 48 px da ultralarga); Limitada: para em 1800, centrado na área.
for (const item of ['meus-dados', 'seguranca', 'marca', 'tags-dos-alunos', 'ajustes'] as const) {
  test(`3440, ${item}, Automática: preenche a área à direita da coluna`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, 3440, { ...ADMIN, larguraConteudo: 'AUTOMATICA' }, `/treinador/configuracoes/${item}`);
    await expect(h1(page)).toBeVisible();
    await expect(async () => {
      const b = await blocoDoItem(page);
      expect(b.antes).toBeLessThanOrEqual(48 + 1);
      expect(b.depois).toBeLessThanOrEqual(48 + 1);
    }).toPass({ timeout: 10_000 });
    expect(errosDaPagina).toEqual([]);
  });

  test(`3440, ${item}, Limitada: 1800 px centrado na área`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, 3440, { ...ADMIN, larguraConteudo: 'LIMITADA' }, `/treinador/configuracoes/${item}`);
    await expect(h1(page)).toBeVisible();
    await expect(async () => {
      const b = await blocoDoItem(page);
      expect(Math.abs(b.largura - 1800)).toBeLessThanOrEqual(1);
      expect(Math.abs(b.antes - b.depois)).toBeLessThanOrEqual(2);
    }).toPass({ timeout: 10_000 });
    expect(errosDaPagina).toEqual([]);
  });
}

/** Bordas do formulário, da prévia e do bloco do item (o mesmo de `blocoDoItem`), em coordenadas da página. */
async function colunasDaMarca(page: Page) {
  const caixa = async (id: string) => (await page.getByTestId(id).boundingBox())!;
  const bloco = await h1(page).evaluate((titulo) => {
    let b = titulo as HTMLElement;
    while (b.parentElement && (b.getBoundingClientRect().width < 900 || b.parentElement.getBoundingClientRect().width - b.getBoundingClientRect().width < 4)) b = b.parentElement;
    const r = b.getBoundingClientRect();
    return { x: r.left, direita: r.right };
  });
  const nome = (await page.getByRole('textbox', { name: 'Nome da consultoria' }).boundingBox())!;
  return { form: await caixa('coluna-do-formulario'), previa: await caixa('coluna-da-previa'), desenho: await caixa('previa-da-paleta'), nome, bloco };
}

// Item 5 (26/11): na tela larga o formulário inteiro fica em 640 px e a prévia ocupa o resto da linha, ao lado; o desenho do
// app do aluno não passa de 720 e fica centrado no cartão. Em Limitada o conjunto fica nos 1800 centrados.
for (const [largura, larguraConteudo] of [[3440, 'AUTOMATICA'], [3440, 'LIMITADA'], [1920, 'AUTOMATICA']] as const) {
  test(`${largura}, marca, ${larguraConteudo === 'LIMITADA' ? 'Limitada' : 'Automática'}: formulário de 640 e a prévia no resto`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura, { ...ADMIN, larguraConteudo }, '/treinador/configuracoes/marca');
    await expect(page.getByTestId('coluna-do-formulario')).toBeVisible();
    await expect(page.getByTestId('previa-da-paleta')).toHaveCount(1);
    await expect(async () => {
      const { form, previa, desenho, nome, bloco } = await colunasDaMarca(page);
      expect(form.width).toBeLessThanOrEqual(640 + 1);
      expect(nome.x + nome.width).toBeLessThanOrEqual(form.x + form.width + 1);
      expect(Math.abs(form.x - bloco.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(previa.x - (form.x + form.width) - 24)).toBeLessThanOrEqual(1);
      expect(Math.abs(previa.x + previa.width - bloco.direita)).toBeLessThanOrEqual(1);
      expect(desenho.width).toBeLessThanOrEqual(720 + 1);
      expect(Math.abs(desenho.x + desenho.width / 2 - (previa.x + previa.width / 2))).toBeLessThanOrEqual(2);
      if (larguraConteudo === 'LIMITADA') expect(Math.abs(bloco.direita - bloco.x - 1800)).toBeLessThanOrEqual(1);
    }).toPass({ timeout: 10_000 });
    // As cores prontas abrem as colunas que cabem nos 640 (duas), dentro da coluna do formulário.
    const cores = (await page.getByRole('radiogroup', { name: 'Cores prontas' }).boundingBox())!;
    const { form } = await colunasDaMarca(page);
    expect(cores.x + cores.width).toBeLessThanOrEqual(form.x + form.width + 1);
    await semRolagemLateral(page);
    expect(errosDaPagina).toEqual([]);
  });
}
