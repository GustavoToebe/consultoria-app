import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

import type { Receita } from '../src/api/tipos';
import { SUBTITULO_DO_MODELO } from '../src/dominio/planoDoAluno';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { BIBLIOTECA, conteudoDoPlano } from './editor-inspetor.dados';

/**
 * Cabeçalho único do "Montar treino" do modelo (27/11, `SERIE-ABERTA.md` 0.1): à esquerda voltar, trilha, título com o
 * lápis "Editar nome" ao lado (antes do ⓘ) e o subtítulo do modelo; à direita, na mesma faixa, "Alterações não salvas"
 * (âmbar), "Aplicar ao aluno" (secundário) e "Salvar modelo" (primário). A faixa gruda no topo ao rolar e o motivo de
 * "Aplicar ao aluno" desabilitado vira dica (mouse e teclado, Esc fecha). No celular (390) fica como antes: barra à parte e
 * o motivo escrito sob o botão. Só dados fictícios. Capturas em `E2E_CAPTURAS` (padrão: a pasta do teste).
 */

const capturas = process.env.E2E_CAPTURAS;
async function capturar(page: Page, nome: string, saida: string) {
  await page.screenshot({ path: capturas ? path.join(capturas, nome) : path.join(saida, nome), fullPage: false });
}

const MODELO_ID = 'm0000000-0000-4000-8000-0000000000c1';
const NOME = 'Semana fictícia de força';

async function abrirModelo(page: Page, tema: 'CLARO' | 'ESCURO') {
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
  const modelo: Receita = { id: MODELO_ID, tipo: 'PLANO_TREINO', origem: 'CONSULTORIA', nome: NOME, descricao: null, pastaId: null, ordem: 1, versao: 1, conteudo: conteudoDoPlano(false) };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR', 'MODELO_APLICAR', 'ALUNO_LER', 'TREINO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios': { corpo: BIBLIOTECA },
    'GET /receitas': { corpo: [] },
    [`GET /receitas/${MODELO_ID}`]: (_p, route) => json(route, modelo),
  });
  await page.goto(`/treinador/planejamento/modelo/${MODELO_ID}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(NOME);
  return api;
}

/** Renomeia pelo lápis e conclui: o modelo fica com alteração não salva e "Aplicar ao aluno" desabilitado. */
async function deixarSemSalvar(page: Page) {
  await page.getByRole('button', { name: 'Editar nome', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nome do modelo' }).fill(`${NOME} 2`);
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${NOME} 2`);
}

const faixa = (page: Page) => page.locator('#barra-do-editor');
const aplicar = (page: Page) => page.getByRole('button', { name: /^Aplicar ao aluno/ });
const salvar = (page: Page) => page.getByRole('button', { name: 'Salvar modelo', exact: true });
const dica = (page: Page) => page.getByTestId('dica-do-botao');
const semRolagemLateral = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
/** A rolagem da página é a de dentro (`RolagemComTopo`), não a da janela: o `scrollTop` do ancestral que rola a faixa. */
const rolagemDaFaixa = (page: Page) => faixa(page).evaluate((el) => {
  let r = el.parentElement;
  while (r && !/(auto|scroll)/.test(getComputedStyle(r).overflowY)) r = r.parentElement;
  return r?.scrollTop ?? 0;
});
/** `atencao` dos temas (tokens): âmbar claro no escuro e âmbar escuro no claro. */
const AMBAR = { ESCURO: 'rgb(241, 201, 107)', CLARO: 'rgb(128, 77, 0)' } as const;

for (const largura of [1280, 1920]) {
  for (const tema of ['ESCURO', 'CLARO'] as const) {
    const sufixo = `${largura}-${tema.toLowerCase()}`;

    test(`faixa única: lápis, subtítulo, selo âmbar e botões à direita; gruda ao rolar (${sufixo})`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: largura, height: 1000 });
      const api = await abrirModelo(page, tema);
      const saida = testInfo.outputPath();
      const titulo = page.getByRole('heading', { level: 1 });
      const lapis = page.getByRole('button', { name: 'Editar nome', exact: true });
      const info = page.getByRole('button', { name: 'Sobre esta tela', exact: true });

      // Tudo dentro da faixa grudada: título, lápis, ⓘ, subtítulo e as ações (sem barra à parte).
      for (const alvo of [titulo, lapis, info, salvar(page), aplicar(page)]) await expect(faixa(page).locator(alvo)).toHaveCount(1);
      await expect(faixa(page).getByText(SUBTITULO_DO_MODELO, { exact: true })).toBeVisible();
      await expect(page.getByRole('toolbar', { name: 'Ações do editor' })).toHaveCount(0);

      // Lápis logo depois do título e antes do ⓘ, na mesma linha.
      const [t, l, i] = [await titulo.boundingBox(), await lapis.boundingBox(), await info.boundingBox()];
      expect(l!.x).toBeGreaterThan(t!.x + t!.width - 2);
      expect(i!.x).toBeGreaterThan(l!.x + l!.width - 2);
      expect(Math.abs(l!.y - i!.y)).toBeLessThan(4);

      // Botões à direita do título, na mesma faixa; "Salvar modelo" na ponta.
      const [a, s, f] = [await aplicar(page).boundingBox(), await salvar(page).boundingBox(), await faixa(page).boundingBox()];
      expect(a!.x).toBeGreaterThan(i!.x + i!.width);
      expect(s!.x).toBeGreaterThan(a!.x + a!.width - 2);
      expect(s!.x + s!.width).toBeGreaterThan(f!.x + f!.width - 64);
      await capturar(page, `cabecalho-salvo-${sufixo}.png`, saida);

      // Não salvo: texto e lápis em âmbar (sem pílula) e "Aplicar ao aluno" desabilitado.
      await deixarSemSalvar(page);
      const naoSalvo = faixa(page).getByText('Alterações não salvas', { exact: true });
      await expect(naoSalvo).toBeVisible();
      await expect(naoSalvo).toHaveCSS('color', AMBAR[tema]);
      await expect(aplicar(page)).toBeDisabled();
      const [n, a2] = [await naoSalvo.boundingBox(), await aplicar(page).boundingBox()];
      expect(n!.x + n!.width).toBeLessThan(a2!.x + 1);
      await capturar(page, `cabecalho-nao-salvo-${sufixo}.png`, saida);

      // Ao rolar a faixa fica no topo, com o título à vista.
      await page.mouse.move(largura / 2, 700);
      await page.mouse.wheel(0, 1200);
      await expect.poll(() => rolagemDaFaixa(page)).toBeGreaterThan(200);
      const presa = (await faixa(page).boundingBox())!;
      expect(presa.y).toBeLessThan(4);
      const tituloPreso = (await titulo.boundingBox())!;
      expect(tituloPreso.y).toBeGreaterThanOrEqual(presa.y);
      expect(tituloPreso.y + tituloPreso.height).toBeLessThanOrEqual(presa.y + presa.height + 1);
      await expect(salvar(page)).toBeInViewport();
      await capturar(page, `cabecalho-grudado-${sufixo}.png`, saida);

      expect(await semRolagemLateral(page)).toBe(true);
      expect(api.errosDaPagina).toEqual([]);
    });
  }

  test(`motivo de "Aplicar ao aluno" na dica: mouse, teclado e Esc (${largura})`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    const api = await abrirModelo(page, 'ESCURO');
    const saida = testInfo.outputPath();
    await deixarSemSalvar(page);
    // O motivo não fica escrito sob o botão (quebraria a faixa): só na dica e na descrição acessível.
    await expect(dica(page)).toHaveCount(0);

    // Mouse em cima: a dica abre abaixo do botão; sair fecha.
    await aplicar(page).hover();
    await expect(dica(page)).toBeVisible();
    await expect(dica(page)).toHaveText('Salve o modelo antes.');
    const [b, d] = [await aplicar(page).boundingBox(), await dica(page).boundingBox()];
    expect(d!.y).toBeGreaterThanOrEqual(b!.y + b!.height - 1);
    await capturar(page, `dica-mouse-${largura}.png`, saida);
    await page.mouse.move(10, 900);
    await expect(dica(page)).toHaveCount(0);

    // Teclado: do lápis, o Tab chega ao "Aplicar ao aluno" (o desabilitado continua no Tab, pelo envoltório).
    await page.getByRole('button', { name: 'Editar nome', exact: true }).focus();
    let chegou = false;
    for (let k = 0; k < 6 && !chegou; k++) {
      await page.keyboard.press('Tab');
      chegou = await aplicar(page).evaluate((el) => el === document.activeElement);
    }
    expect(chegou).toBe(true);
    await expect(aplicar(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(dica(page)).toBeVisible();
    await capturar(page, `dica-foco-${largura}.png`, saida);

    // Esc fecha a dica sem tirar o foco (WCAG 1.4.13).
    await page.keyboard.press('Escape');
    await expect(dica(page)).toHaveCount(0);
    await expect(aplicar(page)).toBeFocused();
    expect(api.errosDaPagina).toEqual([]);
  });
}

test('celular (390): sem faixa única nem dica; o motivo fica escrito sob "Aplicar ao aluno"', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await abrirModelo(page, 'ESCURO');
  await deixarSemSalvar(page);
  await expect(aplicar(page)).toBeDisabled();
  await expect(page.getByText('Salve o modelo antes.', { exact: true })).toBeVisible();
  await expect(dica(page)).toHaveCount(0);
  // A faixa grudada é a barra de ações, não o cabeçalho: o título rola com o conteúdo.
  await expect(faixa(page).getByRole('heading', { level: 1 })).toHaveCount(0);
  for (const nome of ['Salvar modelo', 'Aplicar ao aluno']) {
    const c = (await page.getByRole('button', { name: nome, exact: true }).boundingBox())!;
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width).toBeLessThanOrEqual(390);
  }
  expect(await semRolagemLateral(page)).toBe(true);
  await capturar(page, 'cabecalho-390-escuro.png', testInfo.outputPath());
  expect(api.errosDaPagina).toEqual([]);
});
