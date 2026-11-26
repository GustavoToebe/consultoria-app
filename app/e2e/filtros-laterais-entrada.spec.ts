import { expect, test, type Page } from '@playwright/test';

import { json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { fixarHoje } from './aluno';
import { COBRANCA_ATRASADA, estadoFinanceiro, PERMISSOES_FINANCEIRO, rotasDoFinanceiro } from './financeiro-falso';

/**
 * Entrada do painel lateral de filtros (`docs/planos/filtros-laterais.md`, D1): no PC desliza da direita e o véu clareia
 * (~180 ms); com movimento reduzido (do sistema ou do app) nasce pronto; a saída é imediata e devolve o foco (D8); a folha
 * de baixo do celular não muda. Financeiro › Cobranças com o relógio fixo dos outros e2e; só dados fictícios, API simulada.
 * As capturas vão para `CAPTURAS_FILTROS` (prefixo `d-`), só quando a variável existe.
 */
const PASTA = process.env.CAPTURAS_FILTROS;
// Movimento normal fixo: sem isto o contexto herda o "efeitos de animação" do sistema da máquina.
test.use({ contextOptions: { reducedMotion: 'no-preference' } });

async function abrirCobrancas(page: Page, largura: number, { preferencias, relogio = 'fixo' }: { preferencias?: object; relogio?: 'fixo' | 'parado' } = {}) {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
  if (relogio === 'fixo') await fixarHoje(page);
  else await page.clock.install({ time: new Date('2026-10-19T12:00:00-03:00') });
  if (preferencias) await page.addInitScript(([id, p]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(p)), [TREINADOR.id, preferencias] as const);
  const base = await sessao(page, TREINADOR, { marca: MARCA, pagamentosHabilitados: true, recebimentoOnlineHabilitado: false, permissoes: [...PERMISSOES_TREINADOR, ...PERMISSOES_FINANCEIRO] });
  const login = base['POST /auth/refresh'] as { corpo: object };
  const api = await simularApi(page, {
    ...base,
    'POST /auth/refresh': (_p, route) => json(route, { ...login.corpo, marca: MARCA }),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    ...rotasDoFinanceiro(estadoFinanceiro({ cobrancas: [{ ...COBRANCA_ATRASADA, alunoNome: 'Bruna Teste' }] })),
  });
  await page.goto('/treinador/financeiro?aba=cobrancas');
  await expect(page.getByText('Bruna Teste').first()).toBeVisible();
  // Guarda cada transform que o painel recebe (o reanimated escreve no `style` do elemento), sem depender de relógio.
  await page.evaluate(() => {
    const w = window as unknown as { transformsDoPainel: string[] };
    w.transformsDoPainel = [];
    new MutationObserver(() => {
      const d = document.querySelector<HTMLElement>('[role="dialog"]');
      if (d) w.transformsDoPainel.push(d.style.transform);
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
  });
  return api;
}

const botao = (page: Page) => page.getByRole('button', { name: /^Filtros, / });
const painel = (page: Page) => page.getByRole('dialog', { name: 'Filtros de cobranças' });
const transforms = (page: Page) => page.evaluate(() => (window as unknown as { transformsDoPainel: string[] }).transformsDoPainel);

/** Onde o painel está agora: borda direita, largura, transform calculado e a opacidade do véu (a camada irmã dele). */
const medida = (page: Page) => painel(page).evaluate((d) => {
  const r = d.getBoundingClientRect();
  const veu = Array.from(d.parentElement!.children).find((e) => e !== d && getComputedStyle(e).pointerEvents === 'none') as HTMLElement | undefined;
  return { direita: r.right, largura: r.width, transform: getComputedStyle(d).transform, veu: veu ? getComputedStyle(veu).opacity : null };
});

/** O que vale nos três modos depois que o painel assenta: encostado à direita, sem camada de transform, véu inteiro. */
const PRONTO = { direita: 1280, largura: 460, transform: 'none', veu: '1' };

test('1280px, movimento normal: o painel desliza da direita, assenta sem resto de transform e fecha na hora', async ({ page }) => {
  // Relógio da página parado na abertura: a animação anda só quando o teste manda (`runFor`). Com o relógio solto, a
  // máquina carregada pulava o primeiro quadro (a animação já nascia no fim, 180 ms depois) e o deslocamento nunca
  // aparecia: a asserção media a velocidade da máquina, não o painel (25/11).
  await abrirCobrancas(page, 1280, { relogio: 'parado' });
  await page.clock.pauseAt(new Date('2026-10-19T12:05:00-03:00'));
  await botao(page).click();
  await expect(painel(page)).toBeVisible();
  await page.clock.runFor(16);
  // A caminho de zero: o painel ainda está à direita (deslocado) e o véu ainda não está inteiro.
  const caminho = await medida(page);
  expect(caminho.direita).toBeGreaterThan(PRONTO.direita);
  expect(Number(caminho.veu)).toBeLessThan(1);
  await page.clock.runFor(400);
  await page.clock.resume();
  // Espera o fim de verdade (o estado final estável), não um tempo fixo.
  await expect.poll(() => medida(page)).toEqual(PRONTO);
  // Houve deslocamento a caminho de zero, e o último valor escrito tira o inline (`''`): nada de 0,7 px sobrando.
  const vistos = await transforms(page);
  expect(vistos.some((t) => /translateX\((?!0px)[\d.]+px\)/.test(t))).toBe(true);
  expect(vistos.at(-1)).toBe('');
  // Fica parado: a medida não muda depois de assentar.
  await page.waitForTimeout(300);
  expect(await medida(page)).toEqual(PRONTO);
  // O foco entrou no painel na abertura e a saída é imediata, com o foco de volta ao botão (D8).
  expect(await painel(page).evaluate((d) => d !== document.activeElement && d.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(painel(page)).toHaveCount(0);
  await expect(botao(page)).toBeFocused();
});

for (const modo of ['sistema', 'app'] as const) {
  test(`1280px, movimento reduzido pelo ${modo}: o painel nasce no lugar, sem deslocamento nenhum`, async ({ page }) => {
    if (modo === 'sistema') await page.emulateMedia({ reducedMotion: 'reduce' });
    await abrirCobrancas(page, 1280, modo === 'app' ? { preferencias: { movimento: 'REDUZIDO' } } : {});
    await botao(page).click();
    await expect(painel(page)).toBeVisible();
    // A primeira medida já é a final.
    expect(await medida(page)).toEqual(PRONTO);
    expect((await transforms(page)).filter((t) => t !== '')).toEqual([]);
  });
}

test('390px, movimento normal: a folha de baixo segue sem entrada animada', async ({ page }) => {
  await abrirCobrancas(page, 390);
  await botao(page).click();
  await expect(painel(page)).toBeVisible();
  const caixa = (await painel(page).boundingBox())!;
  expect(caixa.x).toBe(0);
  expect(caixa.width).toBe(390);
  expect(await painel(page).evaluate((d) => getComputedStyle(d).transform)).toBe('none');
  expect((await transforms(page)).filter((t) => t !== '')).toEqual([]);
});

test('capturas da entrada em 1280px (início, meio e fim), com o relógio parado', async ({ page }) => {
  test.skip(!PASTA, 'sem CAPTURAS_FILTROS');
  await abrirCobrancas(page, 1280, { relogio: 'parado' });
  await page.clock.pauseAt(new Date('2026-10-19T12:05:00-03:00'));
  await botao(page).focus();
  await page.keyboard.press('Enter');
  await expect(painel(page)).toBeVisible();
  await page.clock.runFor(16);
  await page.screenshot({ path: `${PASTA}/d-entrada-1-inicio-1280.png` });
  await page.clock.runFor(48);
  await page.screenshot({ path: `${PASTA}/d-entrada-2-meio-1280.png` });
  await page.clock.runFor(400);
  await expect.poll(() => medida(page)).toEqual(PRONTO);
  await page.screenshot({ path: `${PASTA}/d-entrada-3-fim-1280.png` });
});
