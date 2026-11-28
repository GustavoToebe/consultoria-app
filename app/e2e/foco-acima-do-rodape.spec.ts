import { expect, test, type Page } from '@playwright/test';

import type { ConsultoriaResponse } from '../src/api/tipos';
import { MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Foco não encoberto pelo rodapé grudado (WCAG 2.4.11, 28/11; `ui/focoAcimaDoRodape`): com o "Salvar padrões" à vista,
 * cada parada do Tab pelo formulário de Padrões do acompanhamento (1280 × 720, ciclo aberto, página mais alta que a janela)
 * fica inteira acima do rodapé, com folga. Só dados fictícios.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const ADMIN = { permissoes: [...PERMISSOES_TREINADOR, 'MARCA_ALTERAR'], perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true }, cicloHabilitado: true };
const VAZIA: ConsultoriaResponse = {
  marca: MARCA, versao: 3, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR',
  textosFasesCiclo: { menstrual: null, folicular: null, ovulatoria: null, lutea: null },
};

/** Onde está o foco em relação ao rodapé grudado: `noRodape` quando o Tab já chegou nos botões dele. */
function posicaoDoFoco(page: Page) {
  return page.evaluate(() => {
    const status = [...document.querySelectorAll('div')].find((d) => d.textContent === 'Alterações não salvas' && d.children.length === 0);
    let rodape: HTMLElement | null = status ?? null;
    while (rodape && getComputedStyle(rodape).position !== 'sticky') rodape = rodape.parentElement;
    const foco = document.activeElement as HTMLElement | null;
    if (!rodape || !foco) return null;
    const f = foco.getBoundingClientRect();
    return { noRodape: rodape.contains(foco), base: f.bottom, topo: f.top, topoDoRodape: rodape.getBoundingClientRect().top, nome: foco.getAttribute('aria-label') ?? foco.textContent?.slice(0, 40) ?? '' };
  });
}

test('1280 × 720: o Tab pelo formulário nunca deixa o foco atrás do rodapé de salvar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), TREINADOR.id);
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, ADMIN)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /consultoria': { corpo: VAZIA },
  });
  await page.goto('/treinador/configuracoes/padroes-do-acompanhamento');
  await expect(page.getByRole('heading', { level: 1, name: 'Padrões do acompanhamento' })).toBeVisible();
  await page.getByRole('button', { name: /^Ciclo menstrual: textos das fases/ }).first().click();
  await expect(page.getByRole('textbox', { name: 'Lútea', exact: true })).toBeVisible();
  // Uma alteração mostra o rodapé grudado; a página é mais alta que a janela.
  await page.getByRole('button', { name: '7 dias', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Salvar padrões', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight
    || [...document.querySelectorAll('div')].some((d) => d.scrollHeight > d.clientHeight + 100 && /(auto|scroll)/.test(getComputedStyle(d).overflowY)))).toBe(true);

  await page.getByRole('textbox', { name: 'Nova atualização a cada (dias)' }).focus();
  let paradas = 0;
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const p = await posicaoDoFoco(page);
    expect(p, 'rodapé grudado à vista').not.toBeNull();
    if (p!.noRodape) break;
    paradas += 1;
    // A rolagem acontece um quadro depois do foco: espera a medida assentar.
    await expect.poll(async () => {
      const q = (await posicaoDoFoco(page))!;
      return q.base <= q.topoDoRodape - 8 + 0.5;
    }, { message: `foco atrás do rodapé: ${p!.nome}` }).toBe(true);
    // O topo do focado também fica na tela (não rolou demais).
    expect((await posicaoDoFoco(page))!.topo).toBeGreaterThanOrEqual(0);
  }
  // O Tab passou por vários controles do formulário antes de chegar ao rodapé (as quatro fases do ciclo incluídas).
  expect(paradas).toBeGreaterThan(6);
  expect(errosDaPagina).toEqual([]);
});
