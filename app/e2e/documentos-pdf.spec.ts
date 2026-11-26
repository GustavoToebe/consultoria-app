import { expect, test, type Page } from '@playwright/test';

import type { ConsultoriaResponse, EuResponse } from '../src/api/tipos';
import { erroApi, json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Documentos (PDF), primeira entrega de `docs/planos/documentos-pdf-motor.md`: prévia dos PDFs de exemplo nos três temas,
 * na web pelo mesmo sanitizador da impressão. Escolher o tema só muda a prévia; "Salvar tema" grava na consultoria
 * (`PUT /consultoria/tema-pdf`, V096). Só dados fictícios. Com `E2E_CAPTURAS`,
 * grava capturas da tela e da folha e o PDF de exemplo de cada tema (impressão emulada, `page.pdf`).
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const ADMIN: Partial<EuResponse> = { permissoes: [...PERMISSOES_TREINADOR, 'MARCA_ALTERAR'], perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true } };
const CONSULTORIA: ConsultoriaResponse = { marca: MARCA, versao: 3, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR' };
const TEMAS = ['Clássico', 'Minimalista', 'Marcante'] as const;

/** A consultoria falsa guarda o tema: o `PUT` grava e o `GET` seguinte (o recarregar da tela) já devolve o novo. */
function consultoriaGravavel(): RespostasApi {
  let temaPdf: string | null = null;
  const atual = (): ConsultoriaResponse => ({ ...CONSULTORIA, marca: { ...MARCA, temaPdf } });
  return {
    'GET /consultoria': (_p, route) => json(route, atual()),
    'PUT /consultoria/tema-pdf': (p, route) => {
      temaPdf = (p.corpo as { temaPdf: string }).temaPdf;
      return json(route, atual());
    },
  };
}

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
  test(`(${largura}) prévia do treino no Clássico, troca para a Dieta e de tema, e só grava ao salvar`, async ({ page }) => {
    const { errosDaPagina, pedidos } = await abrir(page, largura, ADMIN, consultoriaGravavel());
    await expect(page.getByRole('heading', { level: 1, name: 'Documentos (PDF)' })).toBeVisible();
    await expect(tema(page, 'Clássico')).toHaveAttribute('aria-checked', 'true');
    await expect(previa(page)).toContainText('Aluno de Exemplo');
    await expect(previa(page)).toContainText('Supino reto');
    // Sem escolha nova não há o que gravar: o "Salvar tema" começa desabilitado e a tela não promete mais "não é gravada".
    await expect(page.getByRole('button', { name: 'Salvar tema' })).toBeDisabled();
    await expect(page.getByText('Esta escolha não é gravada')).toHaveCount(0);
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
    // A troca de aba mantém o tema escolhido, e escolher não grava: até aqui nenhuma escrita na API.
    await expect(tema(page, 'Marcante')).toHaveAttribute('aria-checked', 'true');
    const escritas = () => pedidos.filter((p) => p.metodo !== 'GET' && p.caminho !== '/auth/refresh');
    expect(escritas()).toEqual([]);
    await semRolagemLateral(page);
    await capturar(page, `tela-dieta-marcante-${largura}`);

    // Salvar grava o tema na consultoria, recarrega e a escolha passa a ser a salva.
    await page.getByRole('button', { name: 'Salvar tema' }).click();
    await expect(page.getByText('Tema dos PDFs salvo.')).toBeVisible();
    expect(escritas()).toEqual([{ metodo: 'PUT', caminho: '/consultoria/tema-pdf', busca: expect.anything(), corpo: { temaPdf: 'MARCANTE' } }]);
    await expect(page.getByRole('button', { name: 'Salvar tema' })).toBeDisabled();
    await expect(tema(page, 'Marcante')).toHaveAttribute('aria-checked', 'true');
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
  // Configurações em 1280 (duas colunas, 26/11): sem item abre Meus dados, e a coluna não traz o item dos documentos.
  await page.goto('/treinador/configuracoes');
  const coluna = page.getByRole('navigation', { name: 'Configurações' });
  await expect(coluna.getByRole('link', { name: 'Meus dados', exact: true })).toBeVisible();
  await expect(coluna.getByRole('link', { name: 'Documentos (PDF)', exact: true })).toHaveCount(0);
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
  // Em 1280 Configurações abre no primeiro item (Meus dados), com a coluna dos itens ao lado.
  await expect(page).toHaveURL(/\/treinador\/configuracoes\/meus-dados$/);
  const coluna = page.getByRole('navigation', { name: 'Configurações' });
  await expect(coluna.getByRole('link', { name: 'Marca', exact: true })).toBeVisible();
  await expect(coluna.getByRole('link', { name: 'Documentos (PDF)', exact: true })).toHaveCount(0);
});

test('o hub leva à tela, e a busca do hub acha por "pdf"', async ({ page }) => {
  await abrir(page, 1280);
  await page.goto('/treinador/configuracoes');
  const busca = page.getByRole('textbox', { name: 'Pesquisar configuração' }).or(page.getByRole('searchbox', { name: 'Pesquisar configuração' })).first();
  await busca.fill('pdf');
  await expect(page.getByText('1 configuração encontrada')).toBeVisible();
  // Em 1280 o item abre dentro de Configurações (coluna da direita); a rota /treinador/documentos continua valendo sozinha.
  await page.getByRole('navigation', { name: 'Configurações' }).getByRole('link', { name: 'Documentos (PDF)', exact: true }).click();
  await expect(page).toHaveURL(/\/treinador\/configuracoes\/documentos-pdf$/);
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
