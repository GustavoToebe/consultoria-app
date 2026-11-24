import { expect, test, type Locator, type Page } from '@playwright/test';

import type { CobrancaResponse } from '../src/api/financeiroTipos';
import { LARGURA_FOLHA_LARGA } from '../src/tema/tokens';
import { fixarHoje, MEUS_DADOS_VAZIOS, sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, sessao, simularApi, TREINADOR } from './api-falsa';
import { COBRANCA_ATRASADA, estadoFinanceiro, rotasDoFinanceiro, sessaoComFinanceiro } from './financeiro-falso';

/**
 * Preferência "Detalhes abrem" (Ajustes › Aparência): Na lateral (padrão, como antes) ou No centro, só no PC. No centro a
 * folha de detalhe é uma janela de `LARGURA_FOLHA_LARGA` centrada, com o véu; no celular nada muda. A cobrança, que já abria
 * no centro (600 px), passa a 800 px; os detalhes da Conta do aluno, que abriam na lateral (460 px), vão ao centro.
 * Relógio fixo em 19/10/2026; só dados fictícios, API simulada.
 */

const COBRANCA: CobrancaResponse = {
  ...COBRANCA_ATRASADA, id: 'c0000000-0000-4000-8000-000000000001', alunoNome: 'Bruna Teste', criadoEm: '2026-09-28T12:00:00Z',
  vencimento: '2026-10-26', vencida: false, diasDeAtraso: null,
};
const TRANSPARENTE = 'rgba(0, 0, 0, 0)';

type Modo = 'LATERAL' | 'CENTRO' | null;

/** Grava a preferência uma vez por cenário (marca na sessionStorage): o `reload` não reinjeta e a escolha da tela vale. */
async function prepararPreferencia(page: Page, usuarioId: string, modo: Modo) {
  await page.addInitScript(([id, prefs, marca]) => {
    try {
      if (sessionStorage.getItem(marca)) return;
      localStorage.setItem(`treinos:${id}:preferencias`, prefs);
      sessionStorage.setItem(marca, '1');
    } catch { /* quadro sem armazenamento */ }
  }, [usuarioId, JSON.stringify({ tema: 'ESCURO', ...(modo ? { detalhesAbrem: modo } : {}) }), `e2e-detalhes-${Math.random()}`] as const);
}

async function abrirCobranca(page: Page, largura: number, modo: Modo) {
  await page.setViewportSize({ width: largura, height: 900 });
  await fixarHoje(page);
  await prepararPreferencia(page, TREINADOR.id, modo);
  const api = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estadoFinanceiro({ cobrancas: [COBRANCA] })) });
  await page.goto('/treinador/financeiro?aba=cobrancas');
  const gatilho = page.getByRole('button', { name: 'Abrir cobrança de Bruna Teste' });
  await gatilho.click();
  const folha = page.getByRole('dialog');
  await expect(folha.getByRole('link', { name: 'Abrir ficha de Bruna Teste' })).toBeVisible();
  return { ...api, folha, gatilho };
}

async function abrirMeusDados(page: Page, largura: number, modo: Modo) {
  await page.setViewportSize({ width: largura, height: 900 });
  await fixarHoje(page);
  await prepararPreferencia(page, ALUNO.id, modo);
  await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    ...(await sessao(page, ALUNO, { pagamentosHabilitados: false })),
    'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /aluno/uso-de-imagem': { corpo: { autorizadoEm: '2026-11-10T12:00:00-03:00' } },
    'GET /aluno/meus-dados': { corpo: { ...MEUS_DADOS_VAZIOS, nome: 'Aluno Teste da Silva', telefone: '(45) 99999-8888', emailDeAcesso: ALUNO.email, versao: 2 } },
    'GET /aluno/comunidade/perfil': erroApi(404, 'Sem perfil.', 'NAO_ENCONTRADO'),
    'GET /aluno/indicacao': erroApi(404, 'Sem indicação.', 'NAO_ENCONTRADO'),
  });
  await page.goto('/aluno/conta');
  await expect(page.getByRole('heading', { level: 1, name: 'Conta' })).toBeVisible();
  const gatilho = page.getByRole('button', { name: /^Meus dados/ });
  await gatilho.click();
  const folha = page.getByRole('dialog', { name: 'Meus dados' });
  await expect(folha.getByText('Aluno Teste da Silva')).toBeVisible();
  return { folha, gatilho };
}

const caixa = async (l: Locator) => {
  const c = (await l.boundingBox())!;
  return { x: Math.round(c.x), largura: Math.round(c.width), direita: Math.round(c.x + c.width), altura: Math.round(c.height) };
};
/** A camada em volta do painel: no centro é o próprio véu (`VEU`); na lateral fica transparente e o véu é uma camada irmã. */
const fundoDaCamada = (folha: Locator) => folha.evaluate((el) => getComputedStyle(el.parentElement!).backgroundColor);

test('Ajustes: "Detalhes abrem" nasce Na lateral, grava No centro no aparelho e a escolha sobrevive ao recarregar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await prepararPreferencia(page, TREINADOR.id, null);
  await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estadoFinanceiro({ cobrancas: [COBRANCA] })) });
  await page.goto('/treinador/ajustes');
  const grupo = page.getByRole('radiogroup', { name: 'Detalhes abrem' });
  await expect(grupo.getByRole('radio', { name: 'Na lateral' })).toHaveAttribute('aria-checked', 'true');
  await grupo.getByRole('radio', { name: 'No centro' }).click();
  await expect(grupo.getByRole('radio', { name: 'No centro' })).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => page.evaluate((id) => localStorage.getItem(`treinos:${id}:preferencias`), TREINADOR.id)).toContain('"detalhesAbrem":"CENTRO"');

  await page.reload();
  await expect(page.getByRole('radiogroup', { name: 'Detalhes abrem' }).getByRole('radio', { name: 'No centro' })).toHaveAttribute('aria-checked', 'true');
});

test('1280 px, cobrança: Na lateral (padrão) segue a folha central de 600 px, com véu', async ({ page }) => {
  const { folha } = await abrirCobranca(page, 1280, null);
  const antes = await caixa(folha);
  expect(antes.largura).toBe(600);
  expect(antes.x).toBe(340);
  expect(await fundoDaCamada(folha)).not.toBe(TRANSPARENTE);
});

test('1280 px, cobrança No centro: 800 px, centrada, véu, rodapé à vista; Esc fecha e devolve o foco; o voltar também fecha', async ({ page }) => {
  const { folha, gatilho } = await abrirCobranca(page, 1280, 'CENTRO');
  const c = await caixa(folha);
  expect(c.largura).toBe(LARGURA_FOLHA_LARGA);
  expect(c.x).toBe((1280 - LARGURA_FOLHA_LARGA) / 2);
  expect(c.altura).toBeLessThanOrEqual(Math.round(900 * 0.9) + 1);
  expect(await fundoDaCamada(folha)).not.toBe(TRANSPARENTE);
  // As ações do rodapé numa linha só, dentro da janela.
  const acoes = folha.getByRole('button', { name: /^(Cancelar cobrança|Renegociar|Registrar pagamento)$/ });
  const topos = new Set(await Promise.all((await acoes.all()).map(async (b) => Math.round((await b.boundingBox())!.y))));
  expect(topos.size).toBe(1);
  await expect(acoes.last()).toBeInViewport();
  const semRolagemLateral = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(semRolagemLateral).toBe(true);

  await page.keyboard.press('Escape');
  await expect(folha).toBeHidden();
  await expect(gatilho).toBeFocused();

  await gatilho.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page).toHaveURL(/\/treinador\/financeiro\?aba=cobrancas/);
});

test('1280 px, Meus dados: Na lateral encosta à direita com 460 px; No centro, 800 px centrada e com véu', async ({ page, context }) => {
  const lateral = await abrirMeusDados(page, 1280, null);
  await expect.poll(async () => (await caixa(lateral.folha)).direita).toBe(1280);
  expect((await caixa(lateral.folha)).largura).toBe(460);

  const outra = await context.newPage();
  const centro = await abrirMeusDados(outra, 1280, 'CENTRO');
  const c = await caixa(centro.folha);
  expect(c.largura).toBe(LARGURA_FOLHA_LARGA);
  expect(c.x).toBe((1280 - LARGURA_FOLHA_LARGA) / 2);
  expect(await fundoDaCamada(centro.folha)).not.toBe(TRANSPARENTE);
  // Botão de ação não estica na largura da janela.
  const editar = centro.folha.getByRole('button', { name: 'Editar' });
  expect((await editar.boundingBox())!.width).toBeLessThan(400);
  await outra.keyboard.press('Escape');
  await expect(centro.folha).toBeHidden();
  await expect(centro.gatilho).toBeFocused();
});

test('390 px com No centro gravado: nada muda, a cobrança e Meus dados são a folha de baixo na largura toda', async ({ page, context }) => {
  const { folha } = await abrirCobranca(page, 390, 'CENTRO');
  const c = await caixa(folha);
  expect(c.x).toBe(0);
  expect(c.largura).toBe(390);

  const outra = await context.newPage();
  const dados = await abrirMeusDados(outra, 390, 'CENTRO');
  const d = await caixa(dados.folha);
  expect(d.x).toBe(0);
  expect(d.largura).toBe(390);
});

/** Capturas só com `CAPTURAS_DETALHES` (pasta fora do repositório). */
const capturar = (page: Page, nome: string) => process.env.CAPTURAS_DETALHES
  ? page.waitForTimeout(300).then(() => page.screenshot({ path: `${process.env.CAPTURAS_DETALHES}/${nome}.png` }))
  : Promise.resolve();

for (const modo of [null, 'CENTRO'] as const) {
  test(`3440 × 1440, menu aberto (ultralarga), ${modo ?? 'padrão'}: ${modo ? 'folha central de 800 px com véu, sem painel, e a tabela não encolhe' : 'painel fixo de 480 px, sem véu nem diálogo'}`, async ({ page }) => {
    await page.setViewportSize({ width: 3440, height: 1440 });
    await fixarHoje(page);
    await page.addInitScript(() => { try { localStorage.removeItem('menu-lateral-recolhido'); } catch { /* */ } });
    await prepararPreferencia(page, TREINADOR.id, modo);
    const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estadoFinanceiro({ cobrancas: [COBRANCA] })) });
    await page.goto('/treinador/financeiro?aba=cobrancas');
    const tabela = page.getByRole('table', { name: 'Cobranças' });
    await expect(tabela).toBeVisible();
    const antes = Math.round((await tabela.boundingBox())!.width);
    await page.getByRole('button', { name: 'Abrir cobrança de Bruna Teste' }).click();
    const painel = page.getByRole('region', { name: /^Cobrança de / });
    if (modo === null) {
      await expect(painel.getByRole('link', { name: 'Abrir ficha de Bruna Teste' })).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(Math.round((await painel.boundingBox())!.width)).toBe(480);
      expect(Math.round((await tabela.boundingBox())!.width)).toBeLessThan(antes - 400);
      await capturar(page, 'cobranca-ultralarga-painel-padrao-escuro-3440');
    } else {
      const folha = page.getByRole('dialog');
      await expect(folha.getByRole('link', { name: 'Abrir ficha de Bruna Teste' })).toBeVisible();
      await expect(painel).toHaveCount(0);
      const c = await caixa(folha);
      expect(c.largura).toBe(LARGURA_FOLHA_LARGA);
      expect(c.x).toBe((3440 - LARGURA_FOLHA_LARGA) / 2);
      expect(await fundoDaCamada(folha)).not.toBe(TRANSPARENTE);
      expect(Math.round((await tabela.boundingBox())!.width)).toBe(antes);
      await capturar(page, 'cobranca-ultralarga-no-centro-escuro-3440');
    }
    expect(errosDaPagina).toEqual([]);
  });
}
