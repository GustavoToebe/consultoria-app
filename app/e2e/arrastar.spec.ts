import { expect, test, type Locator, type Page } from '@playwright/test';

import type { ConteudoDieta, ExercicioPlano, PlanoDetalhe, Receita, Serie } from '../src/api/tipos';
import { CONFIGURACAO_PADRAO } from '../src/dominio/metodologiaPadrao';
import { json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Arrastar para reordenar (18/11, plano `docs/planos/dieta-tabela-e-arrastar.md`): a alça ≡ no começo do item, a linha
 * guia de 2 px onde ele vai cair, o aviso "Ordem alterada." com Desfazer e, como alternativa sem arrastar, "Mover para
 * cima/baixo" no ⋯ do item. Arraste de verdade com o mouse em 1280 px (o toque, com o toque longo, só se confere no
 * aparelho). Só dados fictícios. Capturas só com `CAPTURAS` (pasta fora do repositório).
 */
const PLANO_ID = 'p0000000-0000-4000-8000-0000000000b1';
const ALUNO_ID = 'a0000000-0000-4000-8000-0000000000b2';

const refeicao = (uid: string, nome: string, horario: string, alimentos = ['Alimento fictício']): ConteudoDieta['refeicoes'][number] => ({
  uid, nome, horario, observacao: null, modoDePreparo: null,
  opcoes: [{ uid: `${uid}-a`, rotulo: 'A', itens: alimentos.map((a, i) => ({ uid: `${uid}-i${i}`, alimentoId: null, nome: a, quantidade: 100, unidade: 'g' as const, kcal: 120, proteina: 5, carboidrato: 20, gordura: 2, manual: false })) }],
});

const DIETA: PlanoDetalhe<ConteudoDieta> = {
  plano: {
    id: PLANO_ID, alunoId: ALUNO_ID, pastaId: null, titulo: 'Dieta fictícia', inicio: '2026-11-01', fim: '2026-11-30', ativo: true,
    versaoPublicada: 1, publicadoEm: '2026-11-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho: {
    objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, aguaLitros: null, variacoes: [],
    suplementacao: [], ergogenicos: [],
    refeicoes: [refeicao('cafe', 'Café da manhã', '07:00', ['Pão fictício', 'Leite fictício', 'Fruta fictícia']), refeicao('almoco', 'Almoço', '12:00'), refeicao('jantar', 'Jantar', '19:00')],
  },
  versoes: [],
};

async function abrirDieta(page: Page, escuro = false) {
  if (escuro) await page.addInitScript(([id]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), [TREINADOR.id]);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR'] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /alimentos': { corpo: [] },
    'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /planos-dieta/${PLANO_ID}`]: { corpo: DIETA },
  });
  await page.goto(`/treinador/dietas/${PLANO_ID}`);
  await expect(page.getByRole('heading', { name: 'Refeições (3)' })).toBeVisible();
  return api;
}

const ordemDasRefeicoes = (page: Page) =>
  page.getByRole('group', { name: 'Refeições do plano' }).getByRole('button').evaluateAll((bs) => bs.map((b) => (b.getAttribute('aria-label') ?? '').replace(/^Refeição \d+ de \d+: (?:\d\d:\d\d · )?([^.,]+).*$/, '$1')));

/**
 * Segura a alça e leva o ponteiro, em passos, até o topo do `alvo` (4 px abaixo da borda de cima); `noMeio` roda com o
 * botão ainda apertado. Mede tudo depois de a página parar de rolar (abrir um cartão rola até ele).
 */
async function arrastar(page: Page, alca: Locator, alvo: Locator, noMeio?: () => Promise<void>) {
  await alca.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const de = (await alca.boundingBox())!;
  const y = (await alvo.boundingBox())!.y + 4;
  const x = de.x + de.width / 2;
  const y0 = de.y + de.height / 2;
  await page.mouse.move(x, y0);
  await page.mouse.down();
  for (let k = 1; k <= 10; k += 1) await page.mouse.move(x, y0 + ((y - y0) * k) / 10);
  await noMeio?.();
  await page.mouse.up();
}

const capturas = process.env.CAPTURAS;

for (const escuro of [false, true]) {
  test(`dieta: arrastar a refeição pela alça, linha guia, Ordem alterada e Desfazer (1280, ${escuro ? 'escuro' : 'claro'})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const { naoTratadas, errosDaPagina } = await abrirDieta(page, escuro);
    expect(await ordemDasRefeicoes(page)).toEqual(['Café da manhã', 'Almoço', 'Jantar']);
    const alcas = page.getByRole('group', { name: 'Refeições do plano' }).getByTestId('alca-de-arraste');
    await expect(alcas).toHaveCount(3);
    await page.getByRole('group', { name: 'Refeições do plano' }).evaluate((el) => el.scrollIntoView({ block: 'center' }));
    // A alça fica fora da árvore de acessibilidade: quem usa teclado reordena pelo ⋯ da refeição.
    await expect(alcas.first()).toHaveAttribute('aria-hidden', 'true');
    await arrastar(page, alcas.nth(2), page.getByRole('button', { name: /^Refeição 1 de 3: 07:00 · Café da manhã/ }), async () => {
      if (capturas) await page.screenshot({ path: `${capturas}/dieta-arrastando-1280-${escuro ? 'escuro' : 'claro'}.png` });
    });
    expect(await ordemDasRefeicoes(page)).toEqual(['Jantar', 'Café da manhã', 'Almoço']);
    const aviso = page.getByRole('alert').filter({ hasText: 'Ordem alterada.' });
    await expect(aviso).toBeVisible();
    if (capturas) await page.screenshot({ path: `${capturas}/dieta-ordem-alterada-1280-${escuro ? 'escuro' : 'claro'}.png` });
    await aviso.getByRole('button', { name: 'Desfazer' }).click();
    expect(await ordemDasRefeicoes(page)).toEqual(['Café da manhã', 'Almoço', 'Jantar']);
    // Clicar no item (fora da alça) continua escolhendo a refeição; soltar no mesmo lugar não muda nada nem avisa.
    await page.getByRole('button', { name: /^Refeição 2 de 3: 12:00 · Almoço/ }).click();
    await expect(page.getByRole('button', { name: /^Refeição 2 de 3: 12:00 · Almoço/ })).toHaveAttribute('aria-current', 'true');
    await arrastar(page, alcas.nth(1), page.getByRole('button', { name: /^Refeição 2 de 3: 12:00 · Almoço/ }));
    expect(await ordemDasRefeicoes(page)).toEqual(['Café da manhã', 'Almoço', 'Jantar']);
    expect(errosDaPagina).toEqual([]);
    expect(naoTratadas).toEqual([]);
  });
}

for (const escuro of [false, true]) {
  const tema = escuro ? 'escuro' : 'claro';
  test(`dieta: arrastar o alimento da opção pela alça e ⋯ do alimento com Mover (1280, ${tema})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const { naoTratadas, errosDaPagina } = await abrirDieta(page, escuro);
    const refeicaoAberta = page.locator('#refeicao-cafe');
    const alcas = refeicaoAberta.getByTestId('alca-de-arraste');
    await expect(alcas).toHaveCount(3);
    const nomes = () => refeicaoAberta.getByText(/^(Pão|Leite|Fruta) fictíci[oa]$/).allTextContents();
    expect(await nomes()).toEqual(['Pão fictício', 'Leite fictício', 'Fruta fictícia']);
    await arrastar(page, alcas.nth(2), refeicaoAberta.getByText('Pão fictício', { exact: true }), async () => {
      if (capturas) await page.screenshot({ path: `${capturas}/alimentos-arrastando-1280-${tema}.png` });
    });
    expect(await nomes()).toEqual(['Fruta fictícia', 'Pão fictício', 'Leite fictício']);
    const aviso = page.getByRole('alert').filter({ hasText: 'Ordem alterada.' });
    await aviso.getByRole('button', { name: 'Desfazer' }).click();
    expect(await nomes()).toEqual(['Pão fictício', 'Leite fictício', 'Fruta fictícia']);
    // A alternativa sem arrastar: ⋯ do alimento → "Mover para baixo" (o nome acessível traz o "Descer X" de antes).
    await page.getByRole('button', { name: 'Mais ações de Pão fictício', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Mover para cima/ })).toHaveCount(0);
    if (capturas) await page.screenshot({ path: `${capturas}/menu-alimento-1280-${tema}.png` });
    await page.getByRole('button', { name: /^Mover para baixo, Descer Pão fictício/ }).click();
    expect(await nomes()).toEqual(['Leite fictício', 'Pão fictício', 'Fruta fictícia']);
    // E o da refeição, no cabeçalho do inspetor.
    await page.getByRole('button', { name: 'Mais ações de 07:00 · Café da manhã', exact: true }).click();
    await page.getByRole('button', { name: /^Mover para baixo, Descer 07:00 · Café da manhã/ }).click();
    expect(await ordemDasRefeicoes(page)).toEqual(['Almoço', 'Café da manhã', 'Jantar']);
    expect(errosDaPagina).toEqual([]);
    expect(naoTratadas).toEqual([]);
  });
}

const ID_MODELO = 'm0000000-0000-4000-8000-0000000000b3';
const serie = (uid: string, tipo: string): Serie => ({
  uid, tipo, repsMin: 8, repsMax: 10, carga: { modo: 'CARGA_TRABALHO', percentualMin: null, percentualMax: null }, esforco: null, descansoSegundos: 90, tecnica: null,
});
const exercicio = (uid: string, nome: string, series: Serie[]): ExercicioPlano => ({
  uid, exercicioId: null, nome, modalidade: 'LIVRE', videoUrl: null, observacao: null, progressao: true, unidade: 'kg', grupoUid: null, series,
});

async function abrirTreino(page: Page, escuro = false) {
  if (escuro) await page.addInitScript(([id]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), [TREINADOR.id]);
  const modelo: Receita = {
    id: ID_MODELO, tipo: 'PLANO_TREINO', nome: 'Semana fictícia', descricao: null, pastaId: null, ordem: 1, versao: 1,
    conteudo: {
      objetivo: null, orientacoes: null,
      metodologia: { id: null, nome: 'Metodologia fictícia', configuracao: structuredClone(CONFIGURACAO_PADRAO) },
      sessoes: [{
        uid: 'sessao-1', nome: 'Treino A', diaSemana: 1, tipo: 'TREINO', frequenciaSemanal: null, observacao: null, cardio: null, grupos: [],
        exercicios: [
          exercicio('ex-1', 'Agachamento fictício', [serie('fs-1', 'FEEDER'), serie('ws-1', 'WORKING')]),
          exercicio('ex-2', 'Remada fictícia', [serie('ws-r', 'WORKING')]),
          exercicio('ex-3', 'Supino fictício', [serie('ws-s', 'WORKING')]),
        ],
      }],
    },
  };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /pastas-modelos': { corpo: [] },
    'GET /exercicios': { corpo: [] },
    'GET /receitas': { corpo: [] },
    [`GET /receitas/${ID_MODELO}`]: (_p, route) => json(route, modelo),
  });
  await page.goto(`/treinador/planejamento/modelo/${ID_MODELO}`);
  await expect(page.getByRole('button', { name: 'Salvar modelo', exact: true })).toBeVisible();
  return api;
}

const rotulos = (grupo: Locator) => grupo.getByRole('button').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label') ?? ''));
// As linhas da tabela de blocos são as sanfonas (`aria-expanded`); o editor aberto embaixo tem outros botões.
const linhas = (blocos: Locator) => blocos.locator('[aria-expanded]').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label') ?? ''));
const nomesDosExercicios = async (lista: Locator) => (await rotulos(lista)).map((r) => r.replace(/^Exercício \d de 3: ([^.,]+).*$/, '$1'));

for (const escuro of [false, true]) {
  const tema = escuro ? 'escuro' : 'claro';
  test(`treino: arrastar exercício na lista e bloco de série na tabela, ⋯ com Mover (1280, ${tema})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    const { naoTratadas, errosDaPagina } = await abrirTreino(page, escuro);
    const lista = page.getByRole('group', { name: 'Exercícios da sessão' });
    await lista.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const alcas = lista.getByTestId('alca-de-arraste');
    await expect(alcas).toHaveCount(3);
    await arrastar(page, alcas.nth(2), lista.getByRole('button', { name: /^Exercício 1 de 3/ }));
    expect(await nomesDosExercicios(lista)).toEqual(['Supino fictício', 'Agachamento fictício', 'Remada fictícia']);
    const aviso = page.getByRole('alert').filter({ hasText: 'Ordem alterada.' });
    await expect(aviso).toBeVisible();
    await aviso.getByRole('button', { name: 'Desfazer' }).click();
    expect(await nomesDosExercicios(lista)).toEqual(['Agachamento fictício', 'Remada fictícia', 'Supino fictício']);

    // Blocos da série do exercício escolhido (o 1º): arrastar a linha "Série 2" para cima da "Série 1".
    const blocos = page.getByRole('group', { name: 'Blocos do exercício' });
    await blocos.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    expect((await linhas(blocos))[0]).toMatch(/^Série 1 · FS/);
    await arrastar(page, blocos.getByTestId('alca-de-arraste').nth(1), blocos.locator('[aria-expanded]').first(), async () => {
      if (capturas) await page.screenshot({ path: `${capturas}/blocos-arrastando-1280-${tema}.png` });
    });
    expect((await linhas(blocos))[1]).toMatch(/^Série 2 · FS/);
    await expect(page.getByRole('alert').filter({ hasText: 'Ordem alterada.' })).toBeVisible();

    // O ⋯ do exercício traz "Mover para cima/baixo" (a alternativa sem arrastar).
    await page.getByRole('button', { name: 'Mais ações de Agachamento fictício', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Mover para baixo, Descer Agachamento fictício/ })).toBeVisible();
    if (capturas) await page.screenshot({ path: `${capturas}/menu-mover-1280-${tema}.png` });
    await page.keyboard.press('Escape');
    expect(errosDaPagina).toEqual([]);
    expect(naoTratadas).toEqual([]);
  });

  test(`treino: alça nos blocos empilhados e ⋯ da série (390, ${tema})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    const { naoTratadas, errosDaPagina } = await abrirTreino(page, escuro);
    await page.getByRole('button', { name: 'Editar Agachamento fictício', exact: true }).click();
    const blocos = page.getByRole('group', { name: 'Blocos do exercício' });
    await blocos.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(blocos.getByTestId('alca-de-arraste')).toHaveCount(2);
    await arrastar(page, blocos.getByTestId('alca-de-arraste').nth(1), blocos.locator('[aria-expanded]').first(), async () => {
      if (capturas) await page.screenshot({ path: `${capturas}/blocos-arrastando-390-${tema}.png` });
    });
    expect((await linhas(blocos))[1]).toMatch(/^Série 2 · FS/);
    // A série aberta (a FS) foi junto para a 2ª posição: o ⋯ dela só oferece subir.
    await page.getByRole('button', { name: 'Mais ações da série 2', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Mover para cima, Subir série 2/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Mover para baixo/ })).toHaveCount(0);
    if (capturas) await page.screenshot({ path: `${capturas}/menu-mover-390-${tema}.png` });
    expect(errosDaPagina).toEqual([]);
    expect(naoTratadas).toEqual([]);
  });
}
