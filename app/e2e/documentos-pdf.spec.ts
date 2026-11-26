import { expect, test, type Page } from '@playwright/test';

import type { ConsultoriaResponse, EuResponse } from '../src/api/tipos';
import { erroApi, json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Documentos (PDF), galeria de modelos ("Nova direção" de `docs/planos/documentos-pdf-motor.md`, D-F1 a D-F4 e D24; seção
 * 3.1 de `orientacoes-de-design-26-11.md`): seis modelos com a miniatura do gerador real (6, 3, 2 ou 1 por linha). Onde
 * cabe o editor, escolher navega para `/treinador/documentos/personalizar?modelo=<ID>`; na faixa compacta, escolher confirma
 * e grava (`PUT /consultoria/documentos-pdf`). Só dados fictícios. Com `E2E_CAPTURAS`, grava capturas.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const ADMIN: Partial<EuResponse> = { permissoes: [...PERMISSOES_TREINADOR, 'MARCA_ALTERAR'], perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true } };
const CONSULTORIA: ConsultoriaResponse = { marca: MARCA, versao: 3, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR' };
const MODELOS = ['Clássico', 'Minimalista', 'Marcante', 'Compacto', 'Elegante', 'Esportivo'] as const;

type Tema = 'CLARO' | 'ESCURO' | 'AREIA';
interface Opcoes { eu?: Partial<EuResponse>; extra?: RespostasApi; tema?: Tema; recolhido?: boolean; altura?: number; caminho?: string }

/** A consultoria falsa guarda o modelo: o `PUT` grava e o `GET` seguinte (o recarregar da tela) já devolve o novo. */
function consultoriaGravavel(): RespostasApi {
  let temaPdf: string | null = null;
  const atual = (): ConsultoriaResponse => ({ ...CONSULTORIA, marca: { ...MARCA, temaPdf } });
  return {
    'GET /consultoria': (_p, route) => json(route, atual()),
    'PUT /consultoria/documentos-pdf': (p, route) => {
      temaPdf = (p.corpo as { modelo: string }).modelo;
      return json(route, atual());
    },
  };
}

async function abrir(page: Page, largura: number, o: Opcoes = {}) {
  await page.setViewportSize({ width: largura, height: o.altura ?? (largura < 768 ? 844 : 900) });
  if (o.tema) await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, o.tema]);
  if (o.recolhido) await page.addInitScript(() => localStorage.setItem('menu-lateral-recolhido', '1'));
  // Registro das navegações: o editor (outra frente) tira o `?modelo=` do endereço ao chegar, e a rota pode nem existir ainda.
  await page.addInitScript(() => {
    const w = window as unknown as { navegacoes: string[] };
    w.navegacoes = [];
    const push = history.pushState.bind(history);
    history.pushState = (estado, titulo, url) => {
      w.navegacoes.push(String(url));
      push(estado, titulo, url);
    };
  });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, o.eu ?? ADMIN)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /consultoria': { corpo: CONSULTORIA },
    ...o.extra,
  });
  await page.goto(o.caminho ?? '/treinador/documentos');
  return api;
}

const cartao = (page: Page, nome: string) => page.getByRole('button', { name: new RegExp(`^Usar o modelo ${nome}[,.]`) });
const miniaturas = (page: Page) => page.getByTestId('previa-pdf');
const navegacoes = (page: Page) => page.evaluate(() => (window as unknown as { navegacoes: string[] }).navegacoes);
const escritas = (pedidos: { metodo: string; caminho: string }[]) => pedidos.filter((p) => p.metodo !== 'GET' && p.caminho !== '/auth/refresh');

/** Cartões por linha, pela posição na tela (a grade não diz quantas colunas usou). */
async function colunas(page: Page) {
  const topos = await Promise.all(MODELOS.map(async (m) => Math.round((await cartao(page, m).boundingBox())?.y ?? -1)));
  // Tolerância de 2 px: o cartão "Em uso" (borda de 2 px, margem 0) fica 1 px acima dos outros (borda de 1 px, margem 1).
  return topos.filter((y) => Math.abs(y - topos[0]) <= 2).length;
}

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

async function capturar(page: Page, nome: string, inteira = false) {
  if (process.env.E2E_CAPTURAS) await page.screenshot({ path: `${process.env.E2E_CAPTURAS}/documentos-${nome}.png`, fullPage: inteira });
}

async function galeriaPronta(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: 'Documentos (PDF)' })).toBeVisible();
  for (const m of MODELOS) await expect(cartao(page, m)).toBeVisible();
  await expect(miniaturas(page)).toHaveCount(6);
  await expect(miniaturas(page).first()).toContainText('Aluno de Exemplo');
}

/** Largura, menu minimizado, colunas esperadas e o que escolher faz (área = janela - menu de 240, 88 no trilho, 72 minimizado). */
const MATRIZ = [
  { largura: 390, recolhido: false, colunas: 1, modo: 'confirmar' },
  { largura: 1024, recolhido: false, colunas: 3, modo: 'confirmar' },
  { largura: 1024, recolhido: true, colunas: 3, modo: 'confirmar' },
  { largura: 1280, recolhido: false, colunas: 3, modo: 'editor' },
  { largura: 1536, recolhido: false, colunas: 3, modo: 'editor' },
  { largura: 1920, recolhido: false, colunas: 6, modo: 'editor' },
  { largura: 2560, recolhido: false, colunas: 6, modo: 'editor' },
] as const;

for (const caso of MATRIZ) {
  const nome = `${caso.largura}${caso.recolhido ? '-minimizado' : ''}`;
  test(`(${nome}) seis modelos em ${caso.colunas} por linha, "Em uso" no gravado, e escolher ${caso.modo === 'editor' ? 'abre o editor' : 'pede confirmação'}`, async ({ page }) => {
    const { errosDaPagina, pedidos } = await abrir(page, caso.largura, { recolhido: caso.recolhido, extra: consultoriaGravavel(), altura: 720 });
    await galeriaPronta(page);
    expect(await colunas(page)).toBe(caso.colunas);
    await expect(page.getByText('Em uso', { exact: true })).toHaveCount(1);
    await expect(cartao(page, 'Clássico')).toHaveAccessibleName(/^Usar o modelo Clássico, em uso\. /);
    // Célula de no máximo 320 (a sobra vira margem) e pelo menos 220 quando há mais de uma por linha.
    const caixa = await cartao(page, 'Minimalista').boundingBox();
    expect(caixa?.width ?? 0).toBeLessThanOrEqual(322);
    if (caso.colunas > 1) expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(218);
    // A miniatura é decorativa e a folha não traz um segundo h1.
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await semRolagemLateral(page);
    await capturar(page, `galeria-${nome}`);

    // O toque em cima da miniatura (inerte) chega ao cartão.
    await cartao(page, 'Minimalista').getByTestId('previa-pdf').click({ force: true });
    if (caso.modo === 'editor') {
      await expect.poll(() => navegacoes(page)).toContain('/treinador/documentos/personalizar?modelo=MINIMALISTA');
      expect(escritas(pedidos)).toEqual([]);
    } else {
      const painel = page.getByRole('alertdialog', { name: 'Usar o modelo Minimalista?' });
      await expect(painel).toBeVisible();
      await capturar(page, `painel-${nome}`);
      await painel.getByRole('button', { name: 'Cancelar' }).click();
      await expect(painel).toHaveCount(0);
      expect(escritas(pedidos)).toEqual([]);
      expect(await navegacoes(page)).not.toContain('/treinador/documentos/personalizar?modelo=MINIMALISTA');
    }
    expect(errosDaPagina).toEqual([]);
  });
}

test('(1280) o modelo em uso e "Personalizar este modelo" abrem o editor sem trocar de modelo', async ({ page }) => {
  await abrir(page, 1280);
  await galeriaPronta(page);
  await cartao(page, 'Clássico').click();
  await expect.poll(() => navegacoes(page)).toContain('/treinador/documentos/personalizar');
  expect((await navegacoes(page)).some((u) => u.includes('modelo='))).toBe(false);
  await page.goBack();
  await galeriaPronta(page);
  await page.getByRole('link', { name: 'Personalizar este modelo' }).click();
  await expect.poll(async () => (await navegacoes(page)).filter((u) => u === '/treinador/documentos/personalizar').length).toBeGreaterThanOrEqual(2);
});

test('(390) escolher confirma e grava o modelo com as opções zeradas; o "Em uso" passa para ele', async ({ page }) => {
  const { pedidos, errosDaPagina } = await abrir(page, 390, { extra: consultoriaGravavel() });
  await galeriaPronta(page);
  await expect(page.getByRole('link', { name: 'Personalizar este modelo' })).toHaveCount(0);
  await expect(page.getByText(/abra esta tela no computador/)).toBeVisible();
  // O modelo em uso não tem o que gravar.
  await expect(cartao(page, 'Clássico')).toBeDisabled();
  await cartao(page, 'Esportivo').click();
  await page.getByRole('alertdialog', { name: 'Usar o modelo Esportivo?' }).getByRole('button', { name: 'Usar este modelo' }).click();
  await expect(page.getByText('Modelo Esportivo em uso nos PDFs.')).toBeVisible();
  expect(escritas(pedidos)).toEqual([{ metodo: 'PUT', caminho: '/consultoria/documentos-pdf', busca: expect.anything(), corpo: { modelo: 'ESPORTIVO', opcoes: {}, versao: 3 } }]);
  await expect(cartao(page, 'Esportivo')).toHaveAccessibleName(/, em uso\. /);
  await expect(cartao(page, 'Esportivo')).toBeDisabled();
  await expect(cartao(page, 'Clássico')).toBeEnabled();
  expect(errosDaPagina).toEqual([]);
});

test('(390) personalizado: o resumo aparece e trocar de modelo avisa que as personalizações deixam de valer', async ({ page }) => {
  const marca = { ...MARCA, temaPdf: 'ELEGANTE', opcoesPdf: { texto: { tamanho: 'G' as const } } };
  await abrir(page, 390, { extra: { 'GET /consultoria': { corpo: { ...CONSULTORIA, marca } } } });
  await galeriaPronta(page);
  await expect(page.getByText('· personalizado (1 alteração: tamanho do texto)')).toBeVisible();
  await expect(cartao(page, 'Elegante')).toHaveAccessibleName(/, em uso\. /);
  await cartao(page, 'Clássico').click();
  await expect(page.getByRole('alertdialog', { name: 'Usar o modelo Clássico?' })).toContainText('As personalizações do Elegante (1 alteração: tamanho do texto) deixam de valer.');
});

test('409 ao gravar: avisa para recarregar e volta ao modelo gravado', async ({ page }) => {
  await abrir(page, 390, { extra: { 'PUT /consultoria/documentos-pdf': erroApi(409, 'Conflito.', 'CONFLITO_EDICAO') } });
  await galeriaPronta(page);
  await cartao(page, 'Marcante').click();
  await page.getByRole('alertdialog', { name: 'Usar o modelo Marcante?' }).getByRole('button', { name: 'Usar este modelo' }).click();
  await expect(page.getByText('Recarregue a tela: outra pessoa alterou os documentos.')).toBeVisible();
  await expect(cartao(page, 'Clássico')).toHaveAccessibleName(/, em uso\. /);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('"Baixar PDF de exemplo" imprime o treino de exemplo no modelo gravado', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { impressoes: number }).impressoes = 0;
    window.print = () => { (window as unknown as { impressoes: number }).impressoes += 1; };
  });
  const { errosDaPagina } = await abrir(page, 1280, { extra: { 'GET /consultoria': { corpo: { ...CONSULTORIA, marca: { ...MARCA, temaPdf: 'MINIMALISTA' } } } } });
  await galeriaPronta(page);
  await page.getByRole('button', { name: 'Baixar PDF de exemplo' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { impressoes: number }).impressoes)).toBe(1);
  const bloco = page.locator('#treinos-impressao .doc');
  await expect(bloco).toContainText('Supino reto');
  // O cabeçalho de tabela do Minimalista é só uma linha, sem fundo (motor N1: `.doc th { background: transparent }`), não a cor da marca do Clássico.
  expect(await bloco.locator('th').first().evaluate((th) => getComputedStyle(th).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  expect(await page.title()).toMatch(/^Treino - Aluno de Exemplo/);
  expect(errosDaPagina).toEqual([]);
});

test('miniaturas com CSS próprio: cada modelo pinta o cabeçalho de tabela do seu jeito', async ({ page }) => {
  await abrir(page, 1920);
  await galeriaPronta(page);
  const fundo = (nome: string) => cartao(page, nome).locator('th').first().evaluate((th) => getComputedStyle(th).backgroundColor);
  expect(await fundo('Clássico')).toBe('rgb(185, 28, 28)'); // a cor da marca (#B91C1C)
  expect(await fundo('Minimalista')).not.toBe('rgb(185, 28, 28)');
});

test('erro ao carregar a consultoria: mensagem com "Tentar de novo", que mostra a galeria', async ({ page }) => {
  let falhar = true;
  await abrir(page, 1280, {
    extra: {
      'GET /consultoria': (_p, route) => (falhar ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify(erroApi(503, 'Fora do ar.').corpo) }) : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CONSULTORIA) })),
    },
  });
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  await expect(miniaturas(page)).toHaveCount(0);
  await capturar(page, 'erro-1280');
  falhar = false;
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await galeriaPronta(page);
});

test('sem acesso: quem não é administrador, ou não tem MARCA_ALTERAR, não abre a tela nem acha o cartão', async ({ page }) => {
  await abrir(page, 1280, { eu: { permissoes: [...PERMISSOES_TREINADOR, 'MARCA_ALTERAR'], perfil: { id: 'p2', nome: 'Treinador', acessoTotal: false } } });
  await expect(page.getByRole('heading', { level: 1, name: 'Sem acesso a esta tela' })).toBeVisible();
  await expect(miniaturas(page)).toHaveCount(0);
  // Configurações em 1280 (duas colunas, 26/11): sem item abre Meus dados, e a coluna não traz o item dos documentos.
  await page.goto('/treinador/configuracoes');
  const coluna = page.getByRole('navigation', { name: 'Configurações' });
  await expect(coluna.getByRole('link', { name: 'Meus dados', exact: true })).toBeVisible();
  await expect(coluna.getByRole('link', { name: 'Documentos (PDF)', exact: true })).toHaveCount(0);
});

test('administrador sem MARCA_ALTERAR também fica sem acesso', async ({ page }) => {
  await abrir(page, 390, { eu: { permissoes: PERMISSOES_TREINADOR, perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true } } });
  await expect(page.getByRole('heading', { level: 1, name: 'Sem acesso a esta tela' })).toBeVisible();
  await expect(miniaturas(page)).toHaveCount(0);
});

test('plano sem PDF: a tela diz que é de outro plano, sem buscar nada, e o cartão some do hub', async ({ page }) => {
  const { pedidos } = await abrir(page, 1280, { eu: { ...ADMIN, funcionalidadesDoPlano: ['MOBILIDADE', 'EQUIPE'] } });
  await expect(page.getByRole('heading', { level: 1, name: 'Disponível em outro plano' })).toBeVisible();
  await expect(miniaturas(page)).toHaveCount(0);
  expect(pedidos.some((p) => p.caminho === '/consultoria')).toBe(false);
  await page.getByRole('button', { name: 'Voltar às configurações' }).click();
  // Em 1280 Configurações abre no primeiro item (Meus dados), com a coluna dos itens ao lado.
  await expect(page).toHaveURL(/\/treinador\/configuracoes\/meus-dados$/);
  const coluna = page.getByRole('navigation', { name: 'Configurações' });
  await expect(coluna.getByRole('link', { name: 'Marca', exact: true })).toBeVisible();
  await expect(coluna.getByRole('link', { name: 'Documentos (PDF)', exact: true })).toHaveCount(0);
});

test('(1280) o hub leva à galeria, que cabe na coluna e também abre o editor ao escolher', async ({ page }) => {
  await abrir(page, 1280);
  await page.goto('/treinador/configuracoes');
  const busca = page.getByRole('textbox', { name: 'Pesquisar configuração' }).or(page.getByRole('searchbox', { name: 'Pesquisar configuração' })).first();
  await busca.fill('pdf');
  await expect(page.getByText('1 configuração encontrada')).toBeVisible();
  await page.getByRole('navigation', { name: 'Configurações' }).getByRole('link', { name: 'Documentos (PDF)', exact: true }).click();
  await expect(page).toHaveURL(/\/treinador\/configuracoes\/documentos-pdf$/);
  await galeriaPronta(page);
  expect(await colunas(page)).toBe(3);
  await semRolagemLateral(page);
  await capturar(page, 'hub-1280');
  await cartao(page, 'Compacto').click();
  await expect.poll(() => navegacoes(page)).toContain('/treinador/documentos/personalizar?modelo=COMPACTO');
});

for (const [largura, tema] of [[1280, 'ESCURO'], [1280, 'CLARO'], [1280, 'AREIA'], [1920, 'ESCURO'], [1920, 'CLARO'], [390, 'AREIA']] as const) {
  test(`tema do app ${tema.toLowerCase()} em ${largura}: papel branco nas miniaturas, sem rolagem lateral`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura, { tema });
    await galeriaPronta(page);
    expect(await miniaturas(page).first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    // O CSS global do PDF (fundo branco do html e do body) não vaza para a página do app.
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe('rgb(255, 255, 255)');
    await semRolagemLateral(page);
    await capturar(page, `tema-${tema.toLowerCase()}-${largura}`, largura === 390);
    expect(errosDaPagina).toEqual([]);
  });
}
