import { expect, test, type Page } from '@playwright/test';

import type { ConteudoDieta, ItemDieta, PlanoDetalhe } from '../src/api/tipos';
import { MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Editor de dieta › refeição, seção "Observação e modo de preparo" (27/11): abre e fecha pelo título; fechada, o resumo
 * ao lado ("Nenhuma", o começo da observação com reticências, "Modo de preparo: N linhas"); nasce aberta com texto e
 * fechada sem nada; aberta, os dois campos lado a lado a partir de ~900 px de seção, com o contador; o texto acima do
 * limite abre a seção com o erro. Capturas só com `E2E_CAPTURAS=<pasta>`. Só dados fictícios.
 */
const PLANO_ID = 'p0000000-0000-4000-8000-0000000000b1';
const ALUNO_ID = 'a0000000-0000-4000-8000-0000000000b2';

const item = (uid: string, nome: string): ItemDieta =>
  ({ uid, alimentoId: null, nome, quantidade: 100, unidade: 'g', kcal: 120, proteina: 5, carboidrato: 20, gordura: 2, manual: false });

const OBSERVACAO_LONGA = 'Pode trocar o arroz branco pelo integral nos dias de treino pesado e servir a salada antes do prato principal, '
  + 'sem molho pronto; prefira azeite e limão.';
const PREPARO = 'Lave e corte os legumes.\n\nRefogue no azeite por 5 minutos.\nSirva com o arroz.';

const refeicao = (uid: string, nome: string, horario: string, observacao: string | null, modoDePreparo: string | null) =>
  ({ uid, nome, horario, observacao, modoDePreparo, opcoes: [{ uid: `${uid}-a`, rotulo: 'A', itens: [item(`${uid}-i`, 'Alimento fictício')] }] });

const CONTEUDO: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, aguaLitros: null, variacoes: [],
  suplementacao: [], ergogenicos: null,
  refeicoes: [
    refeicao('cafe', 'Café da manhã', '07:00', null, null),
    refeicao('almoco', 'Almoço', '12:00', OBSERVACAO_LONGA, PREPARO),
    refeicao('lanche', 'Lanche', '16:00', 'Fruta da estação.', null),
    refeicao('jantar', 'Jantar', '20:00', null, 'x'.repeat(2001)),
  ],
};

const DETALHE: PlanoDetalhe<ConteudoDieta> = {
  plano: {
    id: PLANO_ID, alunoId: ALUNO_ID, pastaId: null, titulo: 'Dieta fictícia', inicio: '2026-11-01', fim: '2026-11-30', ativo: true,
    versaoPublicada: 1, publicadoEm: '2026-11-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho: CONTEUDO,
  versoes: [{ id: 'v0000000-0000-4000-8000-0000000000b4', numero: 1, publicadoEm: '2026-11-01T12:00:00Z' }],
};

const titulo = (page: Page) => page.getByRole('button', { name: 'Observação e modo de preparo', exact: true });

async function abrir(page: Page, largura: number, tema: 'CLARO' | 'ESCURO') {
  await page.setViewportSize({ width: largura, height: 1100 });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema]);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR'] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /alimentos': { corpo: [] },
    'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /planos-dieta/${PLANO_ID}`]: { corpo: DETALHE },
  });
  await page.goto(`/treinador/dietas/${PLANO_ID}`);
  await expect(page.getByRole('heading', { name: 'Refeições (4)' })).toBeVisible();
  return api;
}

/** Captura da janela com a seção no meio (só com `E2E_CAPTURAS`). */
async function capturar(page: Page, nome: string) {
  const pasta = process.env.E2E_CAPTURAS;
  if (!pasta) return;
  await titulo(page).evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${pasta}/${nome}.png` });
}

for (const largura of [1920, 3440] as const) {
  for (const tema of ['ESCURO', 'CLARO'] as const) {
    const sufixo = `${largura}-${tema.toLowerCase()}`;
    test(`seção de observação e modo de preparo: fechada vazia, fechada com conteúdo e aberta (${sufixo})`, async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, largura, tema);
      const lista = page.getByRole('group', { name: 'Refeições do plano' });

      // Café (o primeiro, no inspetor): nada escrito, fechada com "Nenhuma" ao lado do título.
      await expect(titulo(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByText('Nenhuma', { exact: true })).toBeVisible();
      const [t, n] = [await titulo(page).boundingBox(), await page.getByText('Nenhuma', { exact: true }).boundingBox()];
      if (!t || !n) throw new Error('sem caixa');
      expect(Math.abs(t.y + t.height / 2 - (n.y + n.height / 2))).toBeLessThan(8);
      expect(n.x).toBeGreaterThan(t.x + t.width - 1);
      // O título cabe numa linha (o alvo de 44 px, sem quebrar com espaço sobrando).
      expect(t.height).toBeLessThan(50);
      await capturar(page, `fechada-vazia-${sufixo}`);

      // Almoço: com texto, nasce aberta; os dois campos lado a lado, na mesma largura, com o contador no canto.
      await lista.getByRole('button', { name: /^Refeição 2 de 4: 12:00 · Almoço/ }).click();
      await expect(titulo(page)).toHaveAttribute('aria-expanded', 'true');
      const obs = page.getByRole('textbox', { name: 'Observação', exact: true });
      const prep = page.getByRole('textbox', { name: 'Modo de preparo', exact: true });
      await expect(obs).toHaveValue(OBSERVACAO_LONGA);
      await expect(prep).toHaveValue(PREPARO);
      const [a, b] = [await obs.boundingBox(), await prep.boundingBox()];
      if (!a || !b) throw new Error('sem caixa');
      expect(Math.abs(a.y - b.y)).toBeLessThan(2);
      expect(Math.abs(a.width - b.width)).toBeLessThan(2);
      expect(b.x).toBeGreaterThan(a.x + a.width);
      // Sem a alça de redimensionar; começa com 3 linhas e cresce com o texto.
      expect(await prep.evaluate((el) => getComputedStyle(el).resize)).toBe('none');
      await expect(page.getByText(`${OBSERVACAO_LONGA.length}/1.000`, { exact: true })).toBeVisible();
      await expect(page.getByText(`${PREPARO.length}/2.000`, { exact: true })).toBeVisible();
      await expect(obs).toHaveAttribute('aria-describedby', /.+/);
      await capturar(page, `aberta-${sufixo}`);

      // Fecha pelo título: o começo da observação numa linha (reticências) e as linhas do preparo, que não cortam.
      await titulo(page).click();
      await expect(obs).toHaveCount(0);
      const inicio = page.getByText(OBSERVACAO_LONGA, { exact: true });
      await expect(inicio).toBeVisible();
      expect((await inicio.boundingBox())!.height).toBeLessThan(30);
      await expect(page.getByText('Modo de preparo: 3 linhas', { exact: true })).toBeVisible();
      await capturar(page, `fechada-com-conteudo-${sufixo}`);
      // E abre de novo.
      await titulo(page).click();
      await expect(obs).toBeVisible();

      // Só a observação: nasce aberta; fechada, só o começo dela.
      await lista.getByRole('button', { name: /^Refeição 3 de 4: 16:00 · Lanche/ }).click();
      await expect(titulo(page)).toHaveAttribute('aria-expanded', 'true');
      await titulo(page).click();
      await expect(page.getByText('Fruta da estação.', { exact: true })).toBeVisible();

      // Acima do limite: aberta, com o erro no campo e o contador em vermelho.
      await lista.getByRole('button', { name: /^Refeição 4 de 4: 20:00 · Jantar/ }).click();
      await expect(titulo(page)).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByText('Passou do limite: use até 2.000 caracteres.', { exact: true })).toBeVisible();
      await expect(page.getByText('2.001/2.000', { exact: true })).toBeVisible();
      if (largura === 1920) await capturar(page, `aberta-com-erro-${sufixo}`);

      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('390: a seção fecha e abre na refeição empilhada e os campos ficam um embaixo do outro', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 390, 'CLARO');
  await page.getByRole('button', { name: '12:00 · Almoço, fechado' }).click();
  const prep = page.getByRole('textbox', { name: 'Modo de preparo', exact: true });
  const obs = page.getByRole('textbox', { name: 'Observação', exact: true });
  await expect(prep).toHaveValue(PREPARO);
  const [a, b] = [await obs.boundingBox(), await prep.boundingBox()];
  if (!a || !b) throw new Error('sem caixa');
  expect(b.y).toBeGreaterThan(a.y + a.height);
  expect(a.x + a.width).toBeLessThanOrEqual(390);
  await capturar(page, 'aberta-390-claro');
  await titulo(page).click();
  await expect(prep).toHaveCount(0);
  await expect(page.getByText('Modo de preparo: 3 linhas', { exact: true })).toBeVisible();
  await capturar(page, 'fechada-com-conteudo-390-claro');
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
