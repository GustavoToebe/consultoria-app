import { expect, test, type Page, type Route } from '@playwright/test';

import { sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, json, simularApi, type PedidoFalso, type RespostasApi } from './api-falsa';

/**
 * "Convidar um amigo" na Conta do aluno (passo 3 de `docs/planos/indicacao-de-alunos.md`): o link de `GET /aluno/indicacao`
 * para copiar e compartilhar, sem contagem nem nome de quem se inscreveu; some sem link aberto (404) e sem internet.
 * Só dados fictícios.
 */
const CAPTURAS = process.env.CAPTURAS_DIR;
const TEMAS = [['claro', 'CLARO'], ['areia', 'AREIA'], ['escuro', 'ESCURO']] as const;
const LINK = 'https://exemplo.test/inscricao/codigo-ficticio?origem=indicacao#indicacao=00000000-0000-4000-8000-0000000000aa';
const PRIVACIDADE = 'Quando alguém se inscrever pelo seu link, o seu treinador vê que foi você. Você não vê quem se inscreveu.';

type Janela = { __copiado?: string; __compartilhado?: ShareData };

async function tema(page: Page, t: string) {
  await page.addInitScript(([id, tm]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: tm, contraste: 'PADRAO' })), [ALUNO.id, t]);
}
async function capturar(page: Page, nome: string) {
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/${nome}.png`, fullPage: true });
}

/** O navegador de teste não deixa ler a área de transferência nem abrir a folha do sistema: substitutos guardam o pedido. */
async function substitutos(page: Page, share: 'guarda' | 'cancela' | 'falha' | 'nenhum') {
  await page.addInitScript((modo) => {
    const w = window as unknown as Janela;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (texto: string) => { w.__copiado = texto; return Promise.resolve(); } },
    });
    const valor = modo === 'nenhum'
      ? undefined
      : (dados: ShareData) => {
          if (modo === 'cancela') return Promise.reject(new DOMException('Cancelado', 'AbortError'));
          if (modo === 'falha') return Promise.reject(new Error('Falha fictícia'));
          w.__compartilhado = dados;
          return Promise.resolve();
        };
    Object.defineProperty(navigator, 'share', { configurable: true, value: valor });
  }, share);
}

async function abrirConta(page: Page, indicacao: RespostasApi[string], share: 'guarda' | 'cancela' | 'falha' | 'nenhum' = 'guarda') {
  await substitutos(page, share);
  const api = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /aluno/uso-de-imagem': { corpo: { autorizadoEm: null } },
    'GET /aluno/indicacao': indicacao,
  });
  await page.goto('/aluno/conta');
  await expect(page.getByRole('heading', { level: 1, name: 'Conta' })).toBeVisible();
  return api;
}

const titulo = (page: Page) => page.getByRole('heading', { name: 'Convidar um amigo', level: 2 });
const pedidosDoLink = (pedidos: PedidoFalso[]) => pedidos.filter((p) => p.caminho === '/aluno/indicacao').length;

for (const largura of [390, 1280]) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    for (const [nome, t] of TEMAS) {
      test(`tema ${nome}: mostra o link e a frase de privacidade, copia com aviso e não mostra contagem`, async ({ page }) => {
        await tema(page, t);
        const api = await abrirConta(page, { corpo: { link: LINK } });
        await expect(titulo(page)).toBeVisible();
        const cartao = page.locator('div').filter({ has: titulo(page) }).filter({ hasText: PRIVACIDADE }).last();
        await expect(cartao.getByText(PRIVACIDADE, { exact: true })).toBeVisible();
        await expect(cartao.getByText(LINK, { exact: true })).toBeVisible();
        // Só o link: nada de "N inscritos", nome ou situação de quem se inscreveu.
        await expect(cartao.getByText(/inscrit[oa]s?\b|\d+ (pessoa|amigo)/i)).toHaveCount(0);
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

        const copiar = page.getByRole('button', { name: 'Copiar link de convite' });
        const compartilhar = page.getByRole('button', { name: 'Compartilhar link de convite' });
        for (const b of [copiar, compartilhar]) {
          const caixa = await b.boundingBox();
          expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
        }
        await titulo(page).scrollIntoViewIfNeeded();
        await capturar(page, `convidar-${nome}-${largura}`);

        await copiar.click();
        await expect(page.getByText('Link copiado.')).toBeVisible();
        expect(await page.evaluate(() => (window as unknown as Janela).__copiado)).toBe(LINK);
        await capturar(page, `convidar-copiado-${nome}-${largura}`);
        expect(api.errosDaPagina).toEqual([]);
        expect(api.naoTratadas).toEqual([]);
      });
    }

    test('Compartilhar entrega o link inteiro (com o fragmento) à folha do sistema', async ({ page }) => {
      await abrirConta(page, { corpo: { link: LINK } });
      await page.getByRole('button', { name: 'Compartilhar link de convite' }).click();
      await expect.poll(() => page.evaluate(() => (window as unknown as Janela).__compartilhado?.url)).toBe(LINK);
    });

    test('fechar a folha de compartilhar sem escolher não mostra aviso', async ({ page }) => {
      await abrirConta(page, { corpo: { link: LINK } }, 'cancela');
      await page.getByRole('button', { name: 'Compartilhar link de convite' }).click();
      // Depois de um aviso que com certeza chega, o do compartilhar (se existisse) já teria aparecido.
      await page.getByRole('button', { name: 'Copiar link de convite' }).click();
      await expect(page.getByText('Link copiado.')).toBeVisible();
      await expect(page.getByText(/Não foi possível compartilhar/)).toHaveCount(0);
    });

    test('falha de verdade no compartilhar avisa e sugere copiar', async ({ page }) => {
      await abrirConta(page, { corpo: { link: LINK } }, 'falha');
      await page.getByRole('button', { name: 'Compartilhar link de convite' }).click();
      await expect(page.getByText('Não foi possível compartilhar. Use "Copiar link".')).toBeVisible();
    });

    test('na web sem navigator.share só existe "Copiar link"', async ({ page }) => {
      await abrirConta(page, { corpo: { link: LINK } }, 'nenhum');
      await expect(page.getByRole('button', { name: 'Copiar link de convite' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Compartilhar/ })).toHaveCount(0);
    });

    test('sem link de inscrição aberto (404) o cartão não existe e não há erro', async ({ page }) => {
      const api = await abrirConta(page, erroApi(404, 'Sem link de inscrição aberto.', 'NAO_ENCONTRADO'));
      await expect(page.getByRole('heading', { name: 'Meus dados' })).toBeVisible();
      await expect.poll(() => pedidosDoLink(api.pedidos)).toBeGreaterThan(0);
      await expect(titulo(page)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);
      expect(api.naoTratadas).toEqual([]);
    });

    test('carregando mostra o esqueleto; erro da API mostra "Tentar de novo", que lê de novo', async ({ page }) => {
      let liberar: () => void = () => undefined;
      const espera = new Promise<void>((r) => { liberar = r; });
      let falhar = true;
      const api = await abrirConta(page, async (_p: PedidoFalso, route: Route) => {
        if (!falhar) return json(route, { link: LINK });
        await espera;
        return json(route, erroApi(500, 'Erro interno.').corpo, 500);
      });
      await expect(page.getByRole('progressbar', { name: 'Carregando seu link de convite' })).toBeVisible();
      await titulo(page).scrollIntoViewIfNeeded();
      await capturar(page, `convidar-carregando-${largura}`);
      liberar();
      const tentar = page.getByRole('button', { name: 'Tentar de novo' });
      await expect(tentar).toBeVisible();
      await titulo(page).scrollIntoViewIfNeeded();
      await capturar(page, `convidar-erro-${largura}`);
      falhar = false;
      await tentar.click();
      await expect(page.getByText(LINK, { exact: true })).toBeVisible();
      await expect(tentar).toHaveCount(0);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('sem internet o cartão some', async ({ page }) => {
      await abrirConta(page, { corpo: { link: LINK } });
      await expect(titulo(page)).toBeVisible();
      await page.context().setOffline(true);
      await expect(titulo(page)).toHaveCount(0);
      await page.context().setOffline(false);
    });
  });
}
