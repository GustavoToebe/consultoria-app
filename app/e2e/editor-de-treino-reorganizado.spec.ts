import { expect, test, type Page } from '@playwright/test';

import type { Receita } from '../src/api/tipos';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { ALUNO_ID, BIBLIOTECA, conteudoDoPlano, PLANO_ID, planoDetalhe } from './editor-inspetor.dados';

/**
 * Editor de treino reorganizado (passo 3 de `docs/planos/editor-de-treino-reorganizado.md`), sem capturas (decisão do
 * Gustavo): posição, tamanho, foco e teclado. Plano do aluno e modelo do Planejamento; só dados fictícios.
 */

async function abrirPlano(page: Page, comProblema = false, ajustar?: (d: ReturnType<typeof planoDetalhe>) => void) {
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR'] })),
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /exercicios': { corpo: BIBLIOTECA },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /planos-treino/${PLANO_ID}`]: (_p, route) => {
      const d = planoDetalhe(comProblema);
      ajustar?.(d);
      return json(route, d);
    },
  });
  await page.goto(`/treinador/treinos/${PLANO_ID}`);
  await expect(page.getByRole('button', { name: /^Editar sessão/ })).toBeVisible();
  return api;
}

const MODELO_ID = 'm0000000-0000-4000-8000-0000000000e7';
async function abrirModelo(page: Page) {
  const modelo: Receita = { id: MODELO_ID, tipo: 'PLANO_TREINO', nome: 'Semana fictícia de força', descricao: null, pastaId: null, ordem: 1, versao: 1, conteudo: conteudoDoPlano(false) };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR', 'MODELO_APLICAR', 'ALUNO_LER', 'TREINO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios': { corpo: BIBLIOTECA },
    'GET /receitas': { corpo: [] },
    [`GET /receitas/${MODELO_ID}`]: (_p, route) => json(route, modelo),
  });
  await page.goto(`/treinador/planejamento/modelo/${MODELO_ID}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Semana fictícia de força');
  return api;
}

const blocos = (page: Page) => page.getByRole('tab', { name: /^Série \d/ });
const bloco = (page: Page, n: number) => page.getByRole('tab', { name: new RegExp(`^Série ${n}( ·|,)`) });
const semRolagemLateral = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
/** Base da barra grudada do editor (a única `position: sticky` no topo). */
const baseDaBarra = (page: Page) => page.evaluate(() => {
  const barra = [...document.querySelectorAll<HTMLElement>('div')].find((d) => getComputedStyle(d).position === 'sticky' && getComputedStyle(d).top === '0px');
  return barra ? barra.getBoundingClientRect().bottom : 0;
});

test.describe('PC (1280)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('tabela de blocos: colunas, variação, blocos × séries e teclado (setas movem o foco, Enter e Espaço escolhem)', async ({ page }) => {
    const api = await abrirPlano(page);
    for (const coluna of ['Bloco', 'Quantidade', 'Repetições', 'Descanso']) await expect(page.getByText(coluna, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Blocos do exercício' })).toHaveAttribute('aria-orientation', 'vertical');
    await expect(blocos(page)).toHaveCount(3);
    // Supino: 3 FS com % diferentes, 1 WS e 1 Back off.
    await expect(bloco(page, 1)).toHaveAccessibleName(/^Série 1 · FS, 3 séries, repetições .*, Varia entre as séries: carga/);
    await expect(page.getByText('Este exercício: 3 blocos · 5 séries', { exact: true })).toBeVisible();
    // Uma linha por bloco, empilhadas, com 44 px ou mais.
    const [a, b] = [await bloco(page, 1).boundingBox(), await bloco(page, 2).boundingBox()];
    expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1);
    expect(a!.height).toBeGreaterThanOrEqual(44);

    await bloco(page, 1).focus();
    await page.keyboard.press('ArrowDown');
    await expect(bloco(page, 2)).toBeFocused();
    // Ativação manual: o foco andou, a escolha não.
    await expect(bloco(page, 1)).toHaveAttribute('aria-selected', 'true');
    // Foco = anel do teclado; a escolhida tem outro fundo: os dois sinais não se confundem.
    expect(await bloco(page, 2).evaluate((e) => parseFloat(getComputedStyle(e).outlineWidth))).toBeGreaterThan(0);
    const fundo = (n: number) => bloco(page, n).evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(await fundo(2)).not.toBe(await fundo(1));
    await page.keyboard.press('Enter');
    await expect(bloco(page, 2)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/^Editando: Série 2( ·|$)/)).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await expect(bloco(page, 3)).toHaveAttribute('aria-selected', 'true');
    expect(api.errosDaPagina).toEqual([]);
  });

  test('trocar de bloco e de exercício não perde a mudança', async ({ page }) => {
    await abrirPlano(page);
    await bloco(page, 2).click();
    await page.getByRole('button', { name: 'Uma série completa a mais', exact: true }).click();
    await expect(page.getByText('Este exercício: 3 blocos · 6 séries', { exact: true })).toBeVisible();
    await bloco(page, 1).click();
    await page.getByRole('button', { name: /^Exercício 2 de 7:/ }).click();
    await page.getByRole('button', { name: /^Exercício 1 de 7:/ }).click();
    await expect(bloco(page, 2)).toHaveAccessibleName(/^Série 2 · WS, 2 séries/);
    await expect(page.getByText('Este exercício: 3 blocos · 6 séries', { exact: true })).toBeVisible();
  });

  test('"Ir à primeira pendência": escolhe exercício e bloco e foca o campo fora da barra grudada', async ({ page }) => {
    const api = await abrirPlano(page, true);
    const estado = page.getByRole('button', { name: /· Ir à primeira pendência$/ });
    await expect(estado).toBeVisible();
    // Erro = borda própria (e o nome acessível diz): a linha com problema, não escolhida, difere de uma sem problema.
    const borda = () => bloco(page, 2).evaluate((e) => getComputedStyle(e).borderTopColor);
    const semProblema = await borda();
    await page.getByRole('button', { name: /^Exercício 2 de 7:/ }).click();
    await expect(bloco(page, 2)).toHaveAccessibleName(/, com problema a corrigir$/);
    await expect(bloco(page, 2)).toHaveAttribute('aria-selected', 'false');
    expect(await borda()).not.toBe(semProblema);
    await expect(page.getByText('Pronto para publicar', { exact: true })).toHaveCount(0);
    await estado.click();
    await expect(page.getByRole('button', { name: /^Exercício 2 de 7:/ })).toHaveAttribute('aria-current', 'true');
    await expect(bloco(page, 2)).toHaveAttribute('aria-selected', 'true');
    const focado = page.locator(':focus');
    await expect(focado).toHaveAttribute('aria-invalid', 'true');
    const caixa = (await focado.boundingBox())!;
    expect(caixa.y).toBeGreaterThanOrEqual(await baseDaBarra(page));
    expect(caixa.y + caixa.height).toBeLessThanOrEqual(900);
    expect(api.errosDaPagina).toEqual([]);
  });

  test('sem pendência, o plano do aluno diz "Pronto para publicar"; distribuição recolhida e totais na sessão', async ({ page }) => {
    await abrirPlano(page);
    await expect(page.getByText('Pronto para publicar', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/^\d+ exercícios · \d+ séries · \d+ séries de trabalho$/)).toBeVisible();
    await expect(page.getByText('Séries por tipo', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: /^Ver distribuição da sessão/ }).click();
    await expect(page.getByText('Séries por tipo', { exact: true })).toBeVisible();
    // "Salvar como dia de treino" mora no ⋯ da sessão.
    await page.getByRole('button', { name: /^Mais ações da sessão/ }).click();
    await expect(page.getByText(/^Salvar como/).first()).toBeVisible();
  });

  test('sessão nova: convite "Monte esta sessão", sem lista vazia nem zeros; dia de descanso sem convite nem erro', async ({ page }) => {
    const api = await abrirPlano(page);
    await page.getByRole('button', { name: 'Adicionar sessão', exact: true }).click();
    await expect(page.getByText('Monte esta sessão', { exact: true })).toBeVisible();
    await expect(page.getByText('Adicione exercícios ou comece com um modelo pronto.', { exact: true })).toBeVisible();
    const ordem = await Promise.all(['Adicionar exercício', 'Usar modelo', 'Adicionar cardio'].map(async (n) => (await page.getByRole('button', { name: n, exact: true }).boundingBox())!));
    const antes = (x: { x: number; y: number }, y: { x: number; y: number }) => x.y < y.y || (x.y === y.y && x.x < y.x);
    expect(antes(ordem[0], ordem[1]) && antes(ordem[1], ordem[2])).toBe(true);
    await expect(page.getByText(/^0 exercícios/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Ver distribuição/ })).toHaveCount(0);

    // A sessão nova já nasce com o nome do dia: "Editar sessão" fica recolhido.
    await page.getByRole('button', { name: /^Editar sessão/ }).click();
    await page.getByRole('button', { name: /^Tipo: / }).click();
    await page.getByRole('radio', { name: 'Descanso', exact: true }).click();
    await expect(page.getByText(/^Dia de descanso: esta sessão não leva exercícios/)).toBeVisible();
    await expect(page.getByText('Monte esta sessão', { exact: true })).toHaveCount(0);
    expect(api.errosDaPagina).toEqual([]);
  });

  test('modelo: o nome é o título, "Editar nome" abre o campo com foco e o estado diz "Sem pendências"', async ({ page }) => {
    const api = await abrirModelo(page);
    await expect(page.getByText('Sem pendências', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Aplicar ao aluno/ })).toBeEnabled();
    await expect(page.getByRole('textbox', { name: 'Nome do modelo' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Editar nome', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Nome do modelo' })).toBeFocused();
    await page.getByRole('textbox', { name: 'Nome do modelo' }).fill('Semana fictícia nova');
    await page.getByRole('button', { name: 'Concluir', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Semana fictícia nova');
    await expect(blocos(page)).toHaveCount(3);
    // Salvamento separado da validação: renomeado sem salvar, o selo diz e "Aplicar ao aluno" pede para salvar antes.
    await expect(page.getByText('Alterações não salvas', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Sem pendências', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Aplicar ao aluno/ })).toBeDisabled();
    await expect(page.getByText('Salve o modelo antes.', { exact: true })).toBeVisible();
    expect(await semRolagemLateral(page)).toBe(true);
    expect(api.errosDaPagina).toEqual([]);
  });
});

test.describe('celular (390)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('tabela empilhada sem rolagem lateral; "Exercício aberto" abre qualquer exercício sem descer a lista', async ({ page }) => {
    const api = await abrirPlano(page);
    await page.getByRole('button', { name: /^Exercício aberto/ }).click();
    await page.getByRole('radio', { name: /^6\. / }).click();
    await expect(blocos(page).first()).toBeVisible();
    // Empilhada: sem o cabeçalho das colunas e cada linha cabe na largura.
    await expect(page.getByText('Quantidade', { exact: true })).toHaveCount(0);
    const linha = (await blocos(page).first().boundingBox())!;
    expect(linha.x + linha.width).toBeLessThanOrEqual(390);
    expect(await semRolagemLateral(page)).toBe(true);
    expect(api.errosDaPagina).toEqual([]);
  });
});

for (const largura of [390, 768, 1280, 1920]) {
  for (const tema of ['CLARO', 'ESCURO'] as const) {
    test(`sem rolagem lateral e a tabela inteira na tela (${largura}px, ${tema.toLowerCase()})`, async ({ page }) => {
      // O tema vem da preferência do usuário (a marca falsa tem `temaPadrao: 'CLARO'`), como no ver-como-aluno.
      await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
      await page.setViewportSize({ width: largura, height: 900 });
      const api = await abrirPlano(page);
      if (largura < 1024) {
        await page.getByRole('button', { name: /^Exercício aberto/ }).click();
        await page.getByRole('radio', { name: /^1\. / }).click();
      }
      await expect(blocos(page)).toHaveCount(3);
      for (const n of [1, 2, 3]) {
        const c = (await bloco(page, n).boundingBox())!;
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x + c.width).toBeLessThanOrEqual(largura);
      }
      // A linha escolhida é invertida (fundo na cor do texto): escura no claro, clara no escuro; prova que o tema valeu.
      const fundo = await page.getByRole('tab', { name: /^Série \d/, selected: true }).evaluate((e) => getComputedStyle(e).backgroundColor);
      const soma = (fundo.match(/\d+/g) ?? []).slice(0, 3).reduce((t, v) => t + Number(v), 0);
      expect(tema === 'ESCURO' ? soma > 382 : soma < 382).toBe(true);
      // Alvo de 44 px pelo estilo da própria linha (o primitivo descarta `style` em função: este teste o pegou).
      for (const n of [1, 2, 3]) expect(await bloco(page, n).evaluate((e) => parseFloat(getComputedStyle(e).minHeight))).toBeGreaterThanOrEqual(44);
      // Hover numa linha não escolhida muda o fundo dela.
      const fundoDa = () => bloco(page, 2).evaluate((e) => getComputedStyle(e).backgroundColor);
      await page.mouse.move(0, 0);
      const antes = await fundoDa();
      await bloco(page, 2).hover();
      await expect.poll(fundoDa).not.toBe(antes);
      expect(await semRolagemLateral(page)).toBe(true);
      expect(api.errosDaPagina).toEqual([]);
    });
  }
}

const NOME_LONGO = 'Supino inclinado com halteres e pausa isométrica no meio da descida';
for (const largura of [390, 768]) {
  test(`nomes longos de sessão e exercício não empurram a tela (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await abrirPlano(page, false, (d) => {
      d.rascunho.sessoes[0].nome = 'Peito, ombros e tríceps com ênfase na parte superior';
      d.rascunho.sessoes[0].exercicios[0].nome = NOME_LONGO;
    });
    await page.getByRole('button', { name: /^Exercício aberto/ }).click();
    await page.getByRole('radio', { name: /^1\. / }).click();
    await expect(blocos(page)).toHaveCount(3);
    for (const n of [1, 2, 3]) {
      const c = (await bloco(page, n).boundingBox())!;
      expect(c.x + c.width).toBeLessThanOrEqual(largura);
    }
    expect(await semRolagemLateral(page)).toBe(true);
    expect(api.errosDaPagina).toEqual([]);
  });
}

test('modelo no celular (390): topo com nome, estado e ações sem rolagem lateral', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const api = await abrirModelo(page);
  for (const nome of ['Editar nome', 'Salvar modelo', 'Aplicar ao aluno']) {
    const c = (await page.getByRole('button', { name: nome, exact: true }).boundingBox())!;
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width).toBeLessThanOrEqual(390);
  }
  expect(await semRolagemLateral(page)).toBe(true);
  expect(api.errosDaPagina).toEqual([]);
});
