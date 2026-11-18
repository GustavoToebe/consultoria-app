import { expect, test, type Locator, type Page } from '@playwright/test';

import type { ConteudoDieta, PlanoDetalhe } from '../src/api/tipos';
import { MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Arrastar para reordenar (18/11, plano `docs/planos/dieta-tabela-e-arrastar.md`): a alça ≡ no começo do item, a linha
 * guia de 2 px onde ele vai cair, o aviso "Ordem alterada." com Desfazer e, como alternativa sem arrastar, "Mover para
 * cima/baixo" no ⋯ do item. Arraste de verdade com o mouse em 1280 px (o toque, com o toque longo, só se confere no
 * aparelho). Só dados fictícios. Capturas só com `CAPTURAS` (pasta fora do repositório).
 */
const PLANO_ID = 'p0000000-0000-4000-8000-0000000000b1';
const ALUNO_ID = 'a0000000-0000-4000-8000-0000000000b2';

const refeicao = (uid: string, nome: string, horario: string): ConteudoDieta['refeicoes'][number] => ({
  uid, nome, horario, observacao: null, modoDePreparo: null,
  opcoes: [{ uid: `${uid}-a`, rotulo: 'A', itens: [{ uid: `${uid}-i`, alimentoId: null, nome: 'Alimento fictício', quantidade: 100, unidade: 'g', kcal: 120, proteina: 5, carboidrato: 20, gordura: 2, manual: false }] }],
});

const DIETA: PlanoDetalhe<ConteudoDieta> = {
  plano: {
    id: PLANO_ID, alunoId: ALUNO_ID, pastaId: null, titulo: 'Dieta fictícia', inicio: '2026-11-01', fim: '2026-11-30', ativo: true,
    versaoPublicada: 1, publicadoEm: '2026-11-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho: {
    objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, aguaLitros: null, variacoes: [],
    suplementacao: [], ergogenicos: [],
    refeicoes: [refeicao('cafe', 'Café da manhã', '07:00'), refeicao('almoco', 'Almoço', '12:00'), refeicao('jantar', 'Jantar', '19:00')],
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

/** Segura a alça e leva o ponteiro, em passos, até `y` (o meio do alvo); `noMeio` roda com o botão ainda apertado. */
async function arrastar(page: Page, alca: Locator, y: number, noMeio?: () => Promise<void>) {
  const de = (await alca.boundingBox())!;
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
    const primeiro = (await page.getByRole('button', { name: /^Refeição 1 de 3: 07:00 · Café da manhã/ }).boundingBox())!;
    await arrastar(page, alcas.nth(2), primeiro.y + 4, async () => {
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
    const meio = (await alcas.nth(1).boundingBox())!;
    await arrastar(page, alcas.nth(1), meio.y + meio.height / 2 + 2);
    expect(await ordemDasRefeicoes(page)).toEqual(['Café da manhã', 'Almoço', 'Jantar']);
    expect(errosDaPagina).toEqual([]);
    expect(naoTratadas).toEqual([]);
  });
}
