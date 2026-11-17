import { expect, test, type Page } from '@playwright/test';

import { CARTOES_DE_CONFIGURACAO, cartoesVisiveis, gruposDeCartoes } from '../src/dominio/configuracoes';
import { PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Hub de Configurações do treinador (`docs/planos/configuracoes-centralizadas.md`, passo 2): um índice dos ajustes, com
 * os cartões que o perfil pode abrir, agrupados, e uma busca. Os cartões esperados saem da mesma regra pura da tela
 * (`dominio/configuracoes`), então o teste confere a ligação da tela com a sessão, não a lista à mão. Só dados fictícios.
 * Capturas em 390 e 1280, nos temas claro, areia e escuro, vão para `E2E_CAPTURAS` (pasta fora do repositório).
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const ACESSO_TOTAL = [
  ...PERMISSOES_TREINADOR, 'MARCA_ALTERAR', 'CONTA_LER', 'EQUIPE_LER', 'AUDITORIA_LER', 'MODELO_LER', 'FINANCEIRO_LER',
  'BIBLIOTECA_ALTERAR', 'AGENDA_LER', 'BIBLIOTECA_LER', 'ATUALIZACAO_LER',
];

interface Perfil { permissoes: string[]; administrador?: boolean; pagamentos?: boolean; recebimentoOnline?: boolean; tema?: 'CLARO' | 'AREIA' | 'ESCURO' }

async function abrir(page: Page, largura: number, perfil: Perfil, caminho = '/treinador/configuracoes') {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 800 });
  if (perfil.tema) await page.addInitScript(([id, tema]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema })), [TREINADOR.id, perfil.tema]);
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, {
      permissoes: perfil.permissoes,
      perfil: { id: 'p1', nome: perfil.administrador ? 'Administrador' : 'Treinador', acessoTotal: !!perfil.administrador },
      pagamentosHabilitados: perfil.pagamentos ?? false,
      recebimentoOnlineHabilitado: perfil.recebimentoOnline ?? false,
    })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
  });
  await page.goto(caminho);
  return { errosDaPagina };
}

/** O que a regra pura promete para o perfil: títulos dos grupos e dos cartões, na ordem. */
function esperado(perfil: Perfil) {
  const visiveis = cartoesVisiveis({
    pode: (c) => perfil.permissoes.includes(c),
    administrador: !!perfil.administrador,
    pagamentosHabilitados: perfil.pagamentos ?? false,
    chaves: { recebimentoOnlineHabilitado: perfil.recebimentoOnline ?? false },
  });
  return { grupos: gruposDeCartoes(visiveis).map((g) => g.grupo), titulos: visiveis.map((c) => c.titulo), visiveis };
}

const busca = (page: Page) => page.getByRole('textbox', { name: 'Pesquisar configuração' }).or(page.getByRole('searchbox', { name: 'Pesquisar configuração' })).first();

/** Cartão do hub: o nome acessível é "Título, descrição." (o menu lateral tem links só com o título). */
const cartao = (page: Page, titulo: string) => page.getByRole('link', { name: new RegExp(`^${titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, `) });

async function titulosDosCartoes(page: Page) {
  const h2 = await page.getByRole('heading', { level: 2 }).allTextContents();
  return h2.map((t) => t.trim());
}

async function semRolagemLateral(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra).toBeLessThanOrEqual(0);
}

async function capturar(page: Page, nome: string) {
  if (process.env.E2E_CAPTURAS) await page.screenshot({ path: `${process.env.E2E_CAPTURAS}/configuracoes-${nome}.png`, fullPage: true });
}

const ADMIN: Perfil = { permissoes: ACESSO_TOTAL, administrador: true, pagamentos: true, recebimentoOnline: true };

test('acesso total (1280): um h1, os sete grupos na ordem e os vinte e dois cartões, cada um com o destino do catálogo', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, ADMIN);
  await expect(page.getByRole('heading', { level: 1, name: 'Configurações' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  const { grupos, visiveis } = esperado(ADMIN);
  expect(visiveis).toHaveLength(CARTOES_DE_CONFIGURACAO.length);
  expect(grupos).toEqual(['Sua conta', 'Consultoria', 'Equipe', 'Alunos e atendimento', 'Financeiro', 'Dados', 'Ajuda']);
  await expect.poll(() => titulosDosCartoes(page)).toEqual(grupos);
  // Cada cartão é um link inteiro (ícone, título e descrição) com o href do catálogo, aba inclusive.
  for (const c of visiveis) {
    const link = cartao(page, c.titulo);
    await expect(link, c.id).toHaveAttribute('href', c.href);
  }
  await semRolagemLateral(page);
  expect(errosDaPagina).toEqual([]);
});

test('perfil restrito: só os cartões que ele pode abrir; Consultoria, Equipe e Financeiro somem', async ({ page }) => {
  const restrito: Perfil = { permissoes: PERMISSOES_TREINADOR };
  const { errosDaPagina } = await abrir(page, 1280, restrito);
  const { grupos, titulos } = esperado(restrito);
  await expect.poll(() => titulosDosCartoes(page)).toEqual(grupos);
  for (const fora of ['Consultoria', 'Equipe', 'Financeiro']) await expect(page.getByRole('heading', { level: 2, name: fora })).toHaveCount(0);
  for (const fora of ['Marca', 'Contato', 'Documentos (PDF)', 'Assinatura e faturas', 'Metodologias', 'Auditoria']) await expect(cartao(page, fora)).toHaveCount(0);
  for (const titulo of titulos) await expect(cartao(page, titulo)).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('perfil com poucos cartões (390): Sua conta, Aniversários e Ajuda, sem buraco nem rolagem lateral', async ({ page }) => {
  const poucos: Perfil = { permissoes: ['ALUNO_LER'] };
  const { errosDaPagina } = await abrir(page, 390, poucos);
  const { grupos } = esperado(poucos);
  // Com ALUNO_LER entra o "Aniversários dos alunos" (D4 de docs/planos/aniversarios.md), único do grupo dele.
  expect(grupos).toEqual(['Sua conta', 'Alunos e atendimento', 'Ajuda']);
  await expect.poll(() => titulosDosCartoes(page)).toEqual(grupos);
  await expect(cartao(page, 'Aniversários dos alunos')).toHaveAttribute('href', '/treinador/ajustes');
  await semRolagemLateral(page);
  await capturar(page, 'poucos-390');
  expect(errosDaPagina).toEqual([]);
});

test('sem a InfinitePay ligada o cartão de Recebimento continua: Pix, link próprio e Manual não dependem dela', async ({ page }) => {
  const semChave: Perfil = { ...ADMIN, recebimentoOnline: false };
  await abrir(page, 1280, semChave);
  await expect(cartao(page, 'Planos comerciais')).toBeVisible();
  await expect(cartao(page, 'Lembretes de cobrança')).toBeVisible();
  await expect(cartao(page, 'Recebimento online')).toBeVisible();
});

test('busca: acha por palavra sem acento, mostra o vazio e "Limpar busca" volta tudo com o foco no campo', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, ADMIN);
  await busca(page).fill('historico');
  await expect(page.getByText('1 configuração encontrada')).toBeVisible();
  await expect(cartao(page, 'Auditoria')).toBeVisible();
  await expect.poll(() => titulosDosCartoes(page)).toEqual(['Equipe']);

  await busca(page).fill('xyzw nada');
  await expect(page.getByRole('heading', { level: 2, name: 'Nenhuma configuração encontrada' })).toBeVisible();
  await expect(page.getByText('0 configurações encontradas')).toBeVisible();
  await capturar(page, 'vazio-1280');
  await page.getByRole('button', { name: 'Limpar busca' }).click();
  await expect(busca(page)).toHaveValue('');
  await expect(busca(page)).toBeFocused();
  await expect.poll(() => titulosDosCartoes(page)).toEqual(esperado(ADMIN).grupos);
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [390, 1280]) {
  test(`Contato (${largura}): a busca por "remetente" acha o cartão, que abre a Marca`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura, ADMIN);
    await busca(page).fill('remetente');
    await expect(page.getByText('1 configuração encontrada')).toBeVisible();
    await expect.poll(() => titulosDosCartoes(page)).toEqual(['Consultoria']);
    await expect(cartao(page, 'Contato')).toHaveAttribute('href', '/treinador/marca');
    await cartao(page, 'Contato').click();
    await expect(page).toHaveURL(/\/treinador\/marca$/);
    expect(errosDaPagina).toEqual([]);
  });
}

test('destinos: os cartões abrem a tela e a aba certas', async ({ page }) => {
  await abrir(page, 1280, ADMIN);
  await cartao(page, 'Membros e convites').click();
  await expect(page).toHaveURL(/\/treinador\/equipe\?aba=membros$/);
  await page.goBack();
  await cartao(page, 'Lembretes de cobrança').click();
  await expect(page).toHaveURL(/\/treinador\/financeiro\?aba=lembretes$/);
  await page.goBack();
  await cartao(page, 'Anamneses').click();
  await expect(page).toHaveURL(/\/treinador\/planejamento\?aba=anamnese$/);
});

test('teclado: do campo, o Tab chega ao primeiro cartão com foco visível e o Enter abre', async ({ page }) => {
  await abrir(page, 1280, ADMIN);
  await busca(page).focus();
  await page.keyboard.press('Tab');
  const primeiro = cartao(page, 'Meus dados');
  await expect(primeiro).toBeFocused();
  const contorno = await primeiro.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(contorno).not.toBe('none');
  await page.keyboard.press('Tab');
  await expect(cartao(page, 'Segurança')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/treinador\/seguranca$/);
});

test('PC (1280): "Configurações" é o primeiro item do menu da conta e abre o hub', async ({ page }) => {
  await abrir(page, 1280, ADMIN, '/treinador/ajuda');
  await page.getByRole('menubar').getByRole('button', { name: /^Conta de / }).click();
  const conta = page.getByRole('menu', { name: 'Conta' });
  await expect(conta.getByRole('menuitem').first()).toHaveText(/Configurações/);
  await conta.getByRole('menuitem', { name: /Configurações/ }).click();
  await expect(page).toHaveURL(/\/treinador\/configuracoes$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Configurações' })).toBeVisible();
});

test('celular (390): o Perfil leva às Configurações', async ({ page }) => {
  await abrir(page, 390, ADMIN, '/treinador/perfil');
  await page.getByRole('link', { name: 'Configurações', exact: true }).click();
  await expect(page).toHaveURL(/\/treinador\/configuracoes$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Configurações' })).toBeVisible();
});

for (const tema of ['CLARO', 'AREIA', 'ESCURO'] as const) {
  for (const largura of [390, 1280]) {
    test(`tema ${tema.toLowerCase()} em ${largura}: sem rolagem lateral, cartões da mesma linha com a mesma altura`, async ({ page }) => {
      const { errosDaPagina } = await abrir(page, largura, { ...ADMIN, tema });
      await expect(page.getByRole('heading', { level: 2, name: 'Ajuda' })).toBeVisible();
      await semRolagemLateral(page);
      if (largura === 1280) {
        // Grade de duas colunas (P3): os dois cartões da primeira linha têm a mesma altura.
        const [a, b] = await page.evaluate(() => {
          const h2 = [...document.querySelectorAll('[role="heading"][aria-level="2"], h2')] as HTMLElement[];
          const [ha, hb] = ['Sua conta', 'Consultoria'].map((t) => h2.find((h) => h.textContent?.trim() === t)!);
          // O cartão de cada título é o ancestral mais alto que ainda não contém o outro título.
          const cartao = (h: HTMLElement, outro: HTMLElement) => {
            let el = h;
            while (el.parentElement && !el.parentElement.contains(outro)) el = el.parentElement;
            const r = el.getBoundingClientRect();
            return { top: r.top, height: r.height, left: r.left };
          };
          return [cartao(ha, hb), cartao(hb, ha)];
        });
        expect(Math.abs(a.top - b.top)).toBeLessThanOrEqual(1);
        expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1);
        expect(b.left).toBeGreaterThan(a.left);
      }
      // No celular o hub é um destino do Perfil: a aba Perfil fica acesa na barra inferior.
      if (largura === 390) await expect(page.getByRole('menubar').getByRole('link', { name: 'Perfil', exact: true })).toHaveAttribute('aria-current', 'page');
      await capturar(page, `${tema.toLowerCase()}-${largura}`);
      // A tela rola por dentro: a captura de página inteira para no primeiro quadro; esta mostra o fim (Dados e Ajuda).
      await page.getByRole('heading', { level: 2, name: 'Ajuda' }).scrollIntoViewIfNeeded();
      await capturar(page, `${tema.toLowerCase()}-${largura}-fim`);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('tablet (768, trilho do menu): sem rolagem lateral', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 768, ADMIN);
  await expect(page.getByRole('heading', { level: 2, name: 'Ajuda' })).toBeVisible();
  await semRolagemLateral(page);
  await capturar(page, 'claro-768');
  expect(errosDaPagina).toEqual([]);
});
