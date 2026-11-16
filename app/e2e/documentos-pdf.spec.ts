import { expect, test, type Page } from '@playwright/test';

import type { ConsultoriaResponse, EuResponse } from '../src/api/tipos';
import { erroApi, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Documentos (PDF), primeira entrega de `docs/planos/documentos-pdf-motor.md`: prévia dos PDFs de exemplo nos três temas,
 * na web pelo mesmo sanitizador da impressão. O tema não é gravado (nenhum PUT). Só dados fictícios. Com `E2E_CAPTURAS`,
 * grava capturas da tela e da folha e o PDF de exemplo de cada tema (impressão emulada, `page.pdf`).
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const ADMIN: Partial<EuResponse> = { permissoes: [...PERMISSOES_TREINADOR, 'MARCA_ALTERAR'], perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true } };
const CONSULTORIA: ConsultoriaResponse = { marca: MARCA, versao: 3, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR' };
const TEMAS = ['Clássico', 'Minimalista', 'Marcante'] as const;

async function abrir(page: Page, largura: number, eu: Partial<EuResponse> = ADMIN, extra: RespostasApi = {}, tema?: 'CLARO' | 'ESCURO') {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
  if (tema) await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema]);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, eu)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /consultoria': { corpo: CONSULTORIA },
    ...extra,
  });
  await page.goto('/treinador/documentos');
  return api;
}

const previa = (page: Page) => page.getByTestId('previa-pdf');
const tema = (page: Page, nome: string) => page.getByRole('radio', { name: new RegExp(`^${nome}\\. `) });
/** O que muda entre os temas sem mudar o HTML: o fundo do cabeçalho da primeira tabela da folha. */
const fundoDoCabecalho = (page: Page) => previa(page).locator('th').first().evaluate((th) => getComputedStyle(th).backgroundColor);

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

async function capturar(page: Page, nome: string) {
  if (process.env.E2E_CAPTURAS) await page.screenshot({ path: `${process.env.E2E_CAPTURAS}/documentos-${nome}.png` });
}

for (const largura of [390, 1280]) {
  test(`(${largura}) prévia do treino no Clássico, troca para a Dieta e de tema, e avisa que a escolha não é gravada`, async ({ page }) => {
    const { errosDaPagina, pedidos } = await abrir(page, largura);
    await expect(page.getByRole('heading', { level: 1, name: 'Documentos (PDF)' })).toBeVisible();
    await expect(tema(page, 'Clássico')).toHaveAttribute('aria-checked', 'true');
    await expect(previa(page)).toContainText('Aluno de Exemplo');
    await expect(previa(page)).toContainText('Supino reto');
    await expect(page.getByText('Esta escolha não é gravada')).toBeVisible();
    await expect(page.getByText('Os PDFs dos seus alunos continuam saindo no tema Clássico por enquanto.', { exact: false })).toBeVisible();
    // A folha é inerte: os títulos dela não viram um segundo h1 da tela.
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

    const fundosDoTreino = [await fundoDoCabecalho(page)];
    expect(fundosDoTreino[0]).toBe('rgb(185, 28, 28)'); // a cor da marca (#B91C1C) no Clássico
    for (const nome of TEMAS.slice(1)) {
      await tema(page, nome).click();
      await expect(tema(page, nome)).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('heading', { level: 2, name: `Prévia: Treino no tema ${nome}` })).toBeVisible();
      await expect.poll(() => fundoDoCabecalho(page)).not.toBe(fundosDoTreino.at(-1));
      fundosDoTreino.push(await fundoDoCabecalho(page));
    }
    expect(new Set(fundosDoTreino).size).toBe(3);

    await page.getByRole('tab', { name: 'Dieta' }).click();
    await expect(previa(page)).toContainText('Sugestão de plano alimentar');
    await expect(previa(page)).not.toContainText('Supino reto');
    // A troca de aba mantém o tema escolhido.
    await expect(tema(page, 'Marcante')).toHaveAttribute('aria-checked', 'true');
    await semRolagemLateral(page);
    await capturar(page, `tela-dieta-marcante-${largura}`);
    // Nada é gravado: nenhuma escrita na API.
    expect(pedidos.filter((p) => p.metodo !== 'GET' && p.caminho !== '/auth/refresh')).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('"Baixar PDF de exemplo" imprime o documento da aba no tema escolhido', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { impressoes: number }).impressoes = 0;
    window.print = () => { (window as unknown as { impressoes: number }).impressoes += 1; };
  });
  const { errosDaPagina } = await abrir(page, 1280);
  await tema(page, 'Marcante').click();
  await page.getByRole('button', { name: 'Baixar PDF de exemplo' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { impressoes: number }).impressoes)).toBe(1);
  const bloco = page.locator('#treinos-impressao .doc');
  await expect(bloco).toContainText('Aluno de Exemplo');
  expect(await bloco.locator('th').first().evaluate((th) => getComputedStyle(th).backgroundColor)).toBe('rgb(243, 244, 246)');
  expect(await page.title()).toMatch(/^Treino - Aluno de Exemplo/);
  expect(errosDaPagina).toEqual([]);
});

test('erro ao carregar a consultoria: mensagem com "Tentar de novo", que mostra a prévia', async ({ page }) => {
  let falhar = true;
  await abrir(page, 1280, ADMIN, {
    'GET /consultoria': (_p, route) => (falhar ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify(erroApi(503, 'Fora do ar.').corpo) }) : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CONSULTORIA) })),
  });
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  await expect(previa(page)).toHaveCount(0);
  falhar = false;
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(previa(page)).toContainText('Aluno de Exemplo');
});

test('sem acesso: quem não é administrador, ou não tem MARCA_ALTERAR, não abre a tela nem acha o cartão', async ({ page }) => {
  await abrir(page, 1280, { permissoes: [...PERMISSOES_TREINADOR, 'MARCA_ALTERAR'], perfil: { id: 'p2', nome: 'Treinador', acessoTotal: false } });
  await expect(page.getByRole('heading', { level: 1, name: 'Sem acesso a esta tela' })).toBeVisible();
  await expect(previa(page)).toHaveCount(0);
  await page.goto('/treinador/configuracoes');
  await expect(page.getByRole('heading', { level: 1, name: 'Configurações' })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Documentos \(PDF\), / })).toHaveCount(0);
});

test('administrador sem MARCA_ALTERAR também fica sem acesso', async ({ page }) => {
  await abrir(page, 390, { permissoes: PERMISSOES_TREINADOR, perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true } });
  await expect(page.getByRole('heading', { level: 1, name: 'Sem acesso a esta tela' })).toBeVisible();
  await expect(previa(page)).toHaveCount(0);
});

test('plano sem PDF: a tela diz que é de outro plano, sem buscar nada, e o cartão some do hub', async ({ page }) => {
  const { pedidos } = await abrir(page, 1280, { ...ADMIN, funcionalidadesDoPlano: ['MOBILIDADE', 'EQUIPE'] });
  await expect(page.getByRole('heading', { level: 1, name: 'Disponível em outro plano' })).toBeVisible();
  await expect(previa(page)).toHaveCount(0);
  expect(pedidos.some((p) => p.caminho === '/consultoria')).toBe(false);
  await page.getByRole('button', { name: 'Voltar às configurações' }).click();
  await expect(page).toHaveURL(/\/treinador\/configuracoes$/);
  await expect(page.getByRole('link', { name: /^Marca, / })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Documentos \(PDF\), / })).toHaveCount(0);
});

test('o hub leva à tela, e a busca do hub acha por "pdf"', async ({ page }) => {
  await abrir(page, 1280);
  await page.goto('/treinador/configuracoes');
  const busca = page.getByRole('textbox', { name: 'Pesquisar configuração' }).or(page.getByRole('searchbox', { name: 'Pesquisar configuração' })).first();
  await busca.fill('pdf');
  await expect(page.getByText('1 configuração encontrada')).toBeVisible();
  await page.getByRole('link', { name: /^Documentos \(PDF\), / }).click();
  await expect(page).toHaveURL(/\/treinador\/documentos$/);
  await expect(previa(page)).toContainText('Aluno de Exemplo');
});

for (const largura of [390, 1280]) {
  for (const modo of ['CLARO', 'ESCURO'] as const) {
    test(`tema do app ${modo.toLowerCase()} em ${largura}: a folha fica branca, sem rolagem lateral`, async ({ page }) => {
      const { errosDaPagina } = await abrir(page, largura, ADMIN, {}, modo);
      await expect(previa(page)).toContainText('Aluno de Exemplo');
      expect(await previa(page).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
      // O CSS global do PDF (fundo branco do html e do body) não vaza para a página do app.
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe('rgb(255, 255, 255)');
      await semRolagemLateral(page);
      await capturar(page, `tela-${modo.toLowerCase()}-${largura}`);
      if (process.env.E2E_CAPTURAS) {
        await previa(page).scrollIntoViewIfNeeded();
        await capturar(page, `tela-${modo.toLowerCase()}-${largura}-previa`);
      }
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('capturas da folha e do PDF de exemplo de treino e dieta nos três temas', async ({ page }) => {
  test.skip(!process.env.E2E_CAPTURAS, 'só gera capturas com E2E_CAPTURAS');
  await page.addInitScript(() => { window.print = () => undefined; });
  await abrir(page, 1920);
  await page.setViewportSize({ width: 1920, height: 6000 });
  for (const aba of ['Treino', 'Dieta']) {
    await page.getByRole('tab', { name: aba }).click();
    for (const nome of TEMAS) {
      await tema(page, nome).click();
      await expect(page.getByRole('heading', { level: 2, name: `Prévia: ${aba} no tema ${nome}` })).toBeVisible();
      const arquivo = `${aba.toLowerCase()}-${{ Clássico: 'classico', Minimalista: 'minimalista', Marcante: 'marcante' }[nome]}`;
      await previa(page).screenshot({ path: `${process.env.E2E_CAPTURAS}/folha-${arquivo}.png` });
      await page.getByRole('button', { name: 'Baixar PDF de exemplo' }).click();
      await expect(page.locator('#treinos-impressao .doc')).toContainText('Aluno de Exemplo');
      await page.emulateMedia({ media: 'print' });
      await page.pdf({ path: `${process.env.E2E_CAPTURAS}/pdf-${arquivo}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true });
      await page.emulateMedia({ media: 'screen' });
    }
  }
});
