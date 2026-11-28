import { expect, test, type Locator, type Page } from '@playwright/test';

import { TEXTO_COMBINE_COM_O_TREINADOR } from '../src/dominio/financeiro';
import { FALTA_PIX } from '../src/dominio/formasDeRecebimento';
import { erroApi, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { fixarHoje } from './aluno';
import {
  CHAVE_PIX_FALSA, estadoFinanceiro, FORMAS_COM_PIX, LEMBRETES_PADRAO, RECEBIMENTO_CONFIGURADO, rotasDoFinanceiro, sessaoComFinanceiro,
  type EstadoFinanceiro,
} from './financeiro-falso';

/**
 * Lembretes e recebimento (19/11): as abas Lembretes e Recebimento do Financeiro no padrão das duas abas de ajustes (duas
 * colunas no PC, a barra de salvar no rodapé do cartão, as opções em linhas com o interruptor na mesma coluna, o passo de
 * dias, a linha do tempo e "O que o aluno vê"). Capturas em `E2E_CAPTURAS` (fora do repositório) ou na pasta do teste.
 * Relógio em 19/10/2026; só dados fictícios, API simulada.
 */
const CAPTURAS = process.env.E2E_CAPTURAS;

async function capturar(page: Page, nome: string) {
  await page.screenshot({ path: CAPTURAS ? `${CAPTURAS}/${nome}.png` : test.info().outputPath(`${nome}.png`), fullPage: true });
}

async function caixa(alvo: Locator) {
  const c = await alvo.boundingBox();
  if (!c) throw new Error('elemento sem caixa');
  return c;
}

async function semRolagemHorizontal(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function abrir(page: Page, aba: 'lembretes' | 'recebimento', estado: EstadoFinanceiro, extra: RespostasApi = {}) {
  await fixarHoje(page);
  const api = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado), ...extra });
  await page.goto(`/treinador/financeiro?aba=${aba}`);
  await expect(page.getByRole('tab', { name: aba === 'lembretes' ? 'Lembretes' : 'Recebimento', selected: true })).toBeVisible();
  return api;
}

const principal = (page: Page) => page.getByRole('switch', { name: 'Mandar lembretes por e-mail' });
// 28/11: os dias são "digite ou escolha" (`ui/EscolhaSuspensa`), não mais o passo (− número +).
const antes = (page: Page) => page.getByRole('button', { name: /^Dias antes: / });
const depois = (page: Page) => page.getByRole('button', { name: /^Dias depois: / });

test('lembretes desligados: os controles ficam no cinza do desabilitado e fora do Tab, com a dica; os valores continuam guardados', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { pedidos, errosDaPagina } = await abrir(page, 'lembretes', estadoFinanceiro());

  await expect(page.getByText('Ligue os lembretes para escolher quando mandar.')).toBeVisible();
  await expect(antes(page)).toBeDisabled();
  await expect(antes(page)).toHaveAccessibleName('Dias antes: 3 dias. Escolher.');
  await expect(page.getByRole('button', { name: 'Lembrete 3 dias antes: ligado', exact: true })).toBeDisabled();
  await expect(page.getByRole('switch', { name: 'No dia do vencimento' })).toBeDisabled();
  // Do interruptor principal o Tab pula o bloco apagado inteiro (linha do tempo, dias e "no dia").
  await principal(page).focus();
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '')).not.toMatch(/^(Dias antes|Dias depois|Lembrete )/);
  }

  // Ligar: o bloco volta, com os mesmos valores; a linha do tempo e o resumo seguem a tela.
  await principal(page).click();
  await expect(page.getByText('Ligue os lembretes para escolher quando mandar.')).toHaveCount(0);
  await expect(page.getByText('Lembretes 3 dias antes, no dia e 3 dias depois do vencimento.')).toBeVisible();
  await depois(page).click();
  await page.getByRole('option', { name: 'Não manda' }).click();
  await expect(depois(page)).toHaveAccessibleName('Dias depois: Não manda. Escolher.');
  await page.getByRole('switch', { name: 'No dia do vencimento' }).click();
  await expect(page.getByText('Lembretes 3 dias antes do vencimento.')).toBeVisible();
  await expect(page.getByText('Alterações não salvas', { exact: true })).toBeVisible();

  // Cancelar volta ao salvo e o rodapé some (só aparece com alteração).
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByText('Alterações não salvas', { exact: true })).toHaveCount(0);
  await expect(antes(page)).toBeDisabled();
  await expect(depois(page)).toHaveAccessibleName('Dias depois: 3 dias. Escolher.');
  expect(pedidos.filter((p) => p.metodo === 'PUT')).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('lembretes: trocar de aba com alteração pendente pergunta antes; o link "Cobranças" leva à aba', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errosDaPagina } = await abrir(page, 'lembretes', estadoFinanceiro({ lembretes: { ...LEMBRETES_PADRAO, ligado: true, versao: 0 } }));

  await page.getByRole('button', { name: 'Lembrete 3 dias antes: ligado', exact: true }).click();
  await page.getByRole('tab', { name: 'Recebimento' }).click();
  const pergunta = page.getByRole('alertdialog', { name: 'Sair sem salvar?' });
  await expect(pergunta).toBeVisible();
  await pergunta.getByRole('button', { name: 'Continuar editando' }).click();
  await expect(page.getByRole('tab', { name: 'Lembretes', selected: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lembrete 3 dias antes: desligado', exact: true })).toHaveAttribute('aria-pressed', 'false');

  // O link dentro de "Quem recebe e por onde" passa pela mesma pergunta; confirmando, abre Cobranças.
  await page.getByRole('link', { name: 'Cobranças', exact: true }).click();
  await pergunta.getByRole('button', { name: 'Sair sem salvar' }).click();
  await expect(page.getByRole('tab', { name: 'Cobranças', selected: true })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('lembretes: erro ao carregar mostra "Tentar de novo" e depois o cartão', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const estado = estadoFinanceiro();
  let vezes = 0;
  const { errosDaPagina } = await abrir(page, 'lembretes', estado, {
    'GET /financeiro/lembretes': (_p, route) => {
      vezes += 1;
      if (vezes === 1) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify(erroApi(500, 'Falha de teste.').corpo) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(estado.lembretes) });
    },
  });
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  await capturar(page, 'lembretes-erro-390');
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(principal(page)).toBeVisible();
  expect(errosDaPagina.filter((e) => !/500/.test(e))).toEqual([]);
});

test('recebimento: "O que o aluno vê" segue a tela; Pix ligado sem dados diz o que falta; o link do plano leva a Planos', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errosDaPagina } = await abrir(page, 'recebimento', estadoFinanceiro({ recebimento: { ...RECEBIMENTO_CONFIGURADO } }));
  const previa = page.getByRole('list', { name: 'Botões que o aluno vê' });

  // Padrão: só a InfinitePay (configurada).
  await expect(previa.getByRole('listitem')).toHaveText(['Pagar']);
  await page.getByRole('switch', { name: 'Link de pagamento próprio' }).click();
  await expect(previa.getByRole('listitem')).toHaveText(['Pagar pela InfinitePay', 'Pagar pelo link do treinador']);
  await expect(page.getByText('O link próprio só aparece na mensalidade de plano com link.')).toBeVisible();
  await page.getByRole('switch', { name: 'Pix copia e cola' }).click();
  await expect(page.getByText(FALTA_PIX)).toBeVisible();
  await expect(previa.getByRole('listitem')).toHaveCount(2);

  // Tudo desligado: nenhum botão, a frase de combinar com o treinador (o Manual).
  await page.getByRole('switch', { name: 'InfinitePay' }).click();
  await page.getByRole('switch', { name: 'Link de pagamento próprio' }).click();
  await page.getByRole('switch', { name: 'Pix copia e cola' }).click();
  await expect(previa).toHaveCount(0);
  await expect(page.getByText(TEXTO_COMBINE_COM_O_TREINADOR)).toBeVisible();
  await expect(page.getByText('O app não recebe nem guarda dinheiro.', { exact: true })).toBeVisible();

  // Interruptores e "Sempre ligado" terminam na mesma borda direita.
  const bordas = await Promise.all([
    page.getByRole('switch', { name: 'InfinitePay' }), page.getByRole('switch', { name: 'Pix copia e cola' }), page.getByText('Sempre ligado', { exact: true }),
  ].map(async (l) => { const c = await caixa(l); return c.x + c.width; }));
  expect(Math.max(...bordas) - Math.min(...bordas)).toBeLessThan(2);

  await page.getByRole('link', { name: 'Planos › Link de pagamento' }).click();
  await page.getByRole('alertdialog', { name: 'Sair sem salvar?' }).getByRole('button', { name: 'Sair sem salvar' }).click();
  await expect(page.getByRole('tab', { name: 'Planos', selected: true })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------
// Capturas: 1920, 1280 e 390 px, escuro e claro. Lembretes ligados, desligados e com alteração pendente; Recebimento com o
// Pix ligado e desligado. Confere as duas colunas pelo topo no PC.
// ---------------------------------------------------------------------------------------------------------------------

const TEMAS = [['escuro', 'ESCURO'], ['claro', 'CLARO']] as const;
const LARGURAS = [[1920, 1080], [1280, 900], [390, 844]] as const;

for (const [nomeDoTema, tema] of TEMAS) for (const [largura, altura] of LARGURAS) {
  test(`capturas ${nomeDoTema} ${largura} px: lembretes e recebimento`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: altura });
    await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
    const sufixo = `${nomeDoTema}-${largura}`;
    const estado = estadoFinanceiro({
      lembretes: { ...LEMBRETES_PADRAO, ligado: true, versao: 0 },
      formas: structuredClone(FORMAS_COM_PIX), chavePixGuardada: CHAVE_PIX_FALSA, recebimento: { ...RECEBIMENTO_CONFIGURADO },
    });
    const { errosDaPagina } = await abrir(page, 'lembretes', estado);

    await expect(principal(page)).toBeChecked();
    const titulo = page.getByRole('heading', { name: 'Lembretes de cobrança' });
    const apoio = page.getByRole('heading', { name: 'Prévia do e-mail' });
    // 28/11: duas colunas só da faixa larga (área ≥ 1600, 1920 com o menu aberto); em 1280 a prévia desce.
    if (largura >= 1920) {
      await expect.poll(async () => Math.abs((await caixa(titulo)).y - (await caixa(apoio)).y)).toBeLessThan(2);
    } else {
      await expect.poll(async () => (await caixa(apoio)).y > (await caixa(titulo)).y).toBe(true);
    }
    await semRolagemHorizontal(page);
    await capturar(page, `lembretes-ligados-${sufixo}`);
    // No celular a tela rola por dentro (a captura de página inteira pega só a janela): uma segunda, rolada até o fim.
    const rolarECapturar = async (alvo: Locator, nome: string) => {
      if (largura >= 1280) return;
      await alvo.scrollIntoViewIfNeeded();
      await page.screenshot({ path: CAPTURAS ? `${CAPTURAS}/${nome}.png` : test.info().outputPath(`${nome}.png`) });
    };
    await rolarECapturar(page.getByRole('heading', { name: 'Quem recebe e por onde' }), `lembretes-ligados-${sufixo}-apoio`);

    await page.getByRole('button', { name: 'Lembrete 3 dias depois: ligado', exact: true }).click();
    await expect(page.getByText('Alterações não salvas', { exact: true })).toBeVisible();
    await capturar(page, `lembretes-pendente-${sufixo}`);
    await rolarECapturar(page.getByText('Alterações não salvas', { exact: true }), `lembretes-pendente-${sufixo}-rodape`);
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();

    await principal(page).click();
    await expect(page.getByText('Ligue os lembretes para escolher quando mandar.')).toBeVisible();
    await capturar(page, `lembretes-desligados-${sufixo}`);
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();

    await page.getByRole('tab', { name: 'Recebimento' }).click();
    await expect(page.getByRole('switch', { name: 'Pix copia e cola' })).toBeChecked();
    await expect(page.getByRole('list', { name: 'Botões que o aluno vê' })).toBeVisible();
    await semRolagemHorizontal(page);
    await capturar(page, `recebimento-pix-ligado-${sufixo}`);
    await rolarECapturar(page.getByRole('heading', { name: 'O que o aluno vê' }), `recebimento-pix-ligado-${sufixo}-previa`);
    await page.getByRole('switch', { name: 'Pix copia e cola' }).click();
    await expect(page.getByText(/O Pix está desligado/)).toBeVisible();
    await page.getByRole('heading', { name: 'Formas de recebimento' }).scrollIntoViewIfNeeded();
    await capturar(page, `recebimento-pix-desligado-${sufixo}`);
    await rolarECapturar(page.getByText('Alterações não salvas', { exact: true }), `recebimento-pix-desligado-${sufixo}-rodape`);
    expect(errosDaPagina).toEqual([]);
  });
}
