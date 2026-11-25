import { expect, test, type Page } from '@playwright/test';

import { json, simularApi } from './api-falsa';
import { CODIGO, paginaPublica } from './inscricoes-falsas';

/*
 * Verificação humana em navegador de dentro de outro app (item 13 de docs/planos/ajustes-da-revisao-25-11.md): quando o
 * Turnstile falha no Instagram, no WhatsApp ou no Android, o widget mostra "Abra no navegador para entrar" com "Copiar link"
 * e, só no Android, "Abrir no Chrome". A falha é simulada abortando challenges.cloudflare.com (o script nunca carrega); o
 * Turnstile segue ligado e o envio continua esperando o token. Nada disto prova o comportamento no WhatsApp ou no Instagram
 * de verdade: é o roteiro manual do relatório. API simulada, só dados fictícios.
 */

const INSTAGRAM_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 330.0.0.40.101 Android (34/14; 420dpi; 1080x2400; Google; Pixel 8; shiba; shiba; pt_BR; 000000000)';
const WHATSAPP_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.1';
const INSTAGRAM_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 Instagram 330.0.0.40.101 (iPhone14,5; iOS 17_5; pt_BR; pt; scale=3.00; 1170x2532; 000000000)';

const TITULO = 'Abra no navegador para entrar';
const botao = (page: Page, nome: string) => page.getByRole('button', { name: nome, exact: true });

/** Liga a API com a verificação ligada e derruba o script da Cloudflare, como o navegador embutido faz. */
async function comTurnstileQueFalha(page: Page) {
  let scripts = 0;
  const api = await simularApi(page, {
    'GET /publico/configuracao': (_p, route) => json(route, { verificacaoHumana: true, siteKey: 'chave-ficticia-0000', cadastroAberto: true }),
    [`GET /publico/inscricoes/${CODIGO}`]: { corpo: paginaPublica() },
  });
  await page.route('https://challenges.cloudflare.com/**', (route) => {
    scripts += 1;
    return route.abort();
  });
  return { ...api, scripts: () => scripts };
}

/** Anota as navegações que o app pede (o `intent://` não abre nada num Chromium de PC, mas a Navigation API enxerga o pedido). */
async function anotarNavegacoes(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __navegacoes: string[]; navigation?: EventTarget };
    w.__navegacoes = [];
    w.navigation?.addEventListener('navigate', (e) => w.__navegacoes.push((e as unknown as { destination: { url: string } }).destination.url));
  });
}

const navegacoes = (page: Page) => page.evaluate(() => (window as unknown as { __navegacoes: string[] }).__navegacoes);

async function irParaASegundaParteDaInscricao(page: Page) {
  await page.getByLabel('Nome').fill('Pessoa Fictícia');
  await page.getByLabel('WhatsApp com DDD').pressSequentially('11987654321');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Sobre você', level: 2 })).toBeVisible();
}

const TELAS = [
  { nome: 'entrar do aluno', caminho: '/aluno/entrar' },
  { nome: 'entrar do treinador', caminho: '/treinador/entrar' },
  { nome: 'esqueci a senha', caminho: '/esqueci-senha' },
  { nome: 'cadastro', caminho: '/cadastro' },
  { nome: 'inscrição', caminho: `/inscricao/${CODIGO}`, antes: irParaASegundaParteDaInscricao },
] as const;

for (const largura of [390, 1280]) {
  test.describe(`Instagram no Android, ${largura} px`, () => {
    test.use({ userAgent: INSTAGRAM_ANDROID, permissions: ['clipboard-read', 'clipboard-write'] });

    for (const tela of TELAS) {
      test(`${tela.nome}: bloco com Copiar link e Abrir no Chrome, e a verificação continua exigida`, async ({ page }) => {
        await page.setViewportSize({ width: largura, height: 900 });
        await anotarNavegacoes(page);
        const { scripts, pedidos, errosDaPagina } = await comTurnstileQueFalha(page);
        await page.goto(tela.caminho);
        if ('antes' in tela) await tela.antes(page);

        await expect(page.getByText(TITULO)).toBeVisible();
        await expect(page.getByText('A verificação de segurança não funcionou neste navegador.')).toBeVisible();
        await expect(botao(page, 'Copiar link')).toBeVisible();
        await expect(botao(page, 'Abrir no Chrome')).toBeVisible();
        await expect(botao(page, 'Tentar de novo')).toBeVisible();
        // O texto de erro do widget é o do desktop: aqui só o bloco.
        await expect(page.getByText('Não foi possível carregar a verificação de segurança.')).toHaveCount(0);
        expect(scripts()).toBeGreaterThan(0);

        // A verificação não foi desligada nem contornada: o envio segue esperando o token.
        await expect(page.getByRole('button', { name: 'Verificando…' })).toBeDisabled();

        await botao(page, 'Copiar link').click();
        await expect(page.getByText('Link copiado.')).toBeVisible();
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());

        await botao(page, 'Abrir no Chrome').click();
        const alvo = new URL(page.url());
        const esperado = `intent://${alvo.host}${alvo.pathname}${alvo.search}#Intent;scheme=http;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(page.url())};end`;
        await expect.poll(() => navegacoes(page)).toContain(esperado);

        // "Tentar de novo" continua: confere a configuração de novo e tenta carregar o script outra vez.
        const antes = scripts();
        await botao(page, 'Tentar de novo').click();
        await expect.poll(() => scripts()).toBeGreaterThan(antes);
        expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho !== '/auth/refresh')).toHaveLength(0);
        expect(errosDaPagina).toEqual([]);
      });
    }
  });
}

test.describe('WhatsApp no Android', () => {
  test.use({ userAgent: WHATSAPP_ANDROID });
  test('mostra o bloco com o atalho do Chrome', async ({ page }) => {
    await comTurnstileQueFalha(page);
    await page.goto('/aluno/entrar');
    await expect(page.getByText(TITULO)).toBeVisible();
    await expect(botao(page, 'Copiar link')).toBeVisible();
    await expect(botao(page, 'Abrir no Chrome')).toBeVisible();
  });
});

test.describe('Instagram no iPhone', () => {
  test.use({ userAgent: INSTAGRAM_IPHONE });
  test('mostra o bloco só com Copiar link, sem o atalho do Chrome', async ({ page }) => {
    await comTurnstileQueFalha(page);
    await page.goto('/aluno/entrar');
    await expect(page.getByText(TITULO)).toBeVisible();
    await expect(botao(page, 'Copiar link')).toBeVisible();
    await expect(botao(page, 'Tentar de novo')).toBeVisible();
    await expect(botao(page, 'Abrir no Chrome')).toHaveCount(0);
  });
});

test.describe('navegador comum no PC', () => {
  test('continua com o erro de sempre e "Tentar de novo", sem o bloco', async ({ page }) => {
    await comTurnstileQueFalha(page);
    await page.goto('/aluno/entrar');
    await expect(page.getByText('Não foi possível carregar a verificação de segurança.')).toBeVisible();
    await expect(botao(page, 'Tentar de novo')).toBeVisible();
    await expect(page.getByText(TITULO)).toHaveCount(0);
    await expect(botao(page, 'Copiar link')).toHaveCount(0);
  });
});
