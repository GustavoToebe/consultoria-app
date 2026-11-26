import { expect, test, type Locator, type Page } from '@playwright/test';

import type { ConteudoDieta, ItemDieta, PlanoDetalhe, Refeicao } from '../src/api/tipos';
import { MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { conferirSombra } from './sombraDoArraste';

/**
 * Reordenar as opções da refeição (26/11) nos dois lugares, que mostram a mesma ordem: arrastar a aba aberta (pela alça
 * ⠿ ao lado dela) e a linha da comparação, com a mesma peça das outras listas; sem arrastar, "Mover para a esquerda/direita"
 * e "Tornar Opção A" no ⋯ da aba aberta (o que não se aplica fica apagado com o motivo). A letra segue a posição: a
 * primeira é sempre a "Opção A" e, quando outra passa a contar no total do dia, o aviso diz qual era, com Desfazer. A
 * aberta continua a mesma opção. Só dados fictícios.
 */
const PLANO_ID = 'p0000000-0000-4000-8000-0000000000f1';
const ALUNO_ID = 'a0000000-0000-4000-8000-0000000000f2';

const item = (uid: string, nome: string, kcal: number): ItemDieta =>
  ({ uid, alimentoId: null, nome, quantidade: 100, unidade: 'g', kcal, proteina: 10, carboidrato: 20, gordura: 5, manual: false });

const CAFE: Refeicao = { uid: 'cafe', nome: 'Café da manhã', horario: '07:00', observacao: null, modoDePreparo: null, opcoes: [
  { uid: 'cafe-a', rotulo: 'A', itens: [item('pao', 'Pão fictício', 150)] },
] };
const ALMOCO: Refeicao = { uid: 'almoco', nome: 'Almoço', horario: '12:00', observacao: null, modoDePreparo: null, opcoes: [
  { uid: 'almoco-a', rotulo: 'A', itens: [item('arroz', 'Arroz fictício', 200), item('frango', 'Frango fictício', 180)] },
  { uid: 'almoco-b', rotulo: 'B', itens: [item('batata', 'Batata fictícia', 130)] },
  { uid: 'almoco-c', rotulo: 'C', itens: [] },
] };
const CONTEUDO: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, aguaLitros: null, variacoes: [], suplementacao: [], ergogenicos: null,
  refeicoes: [CAFE, ALMOCO],
};
const DETALHE: PlanoDetalhe<ConteudoDieta> = {
  plano: {
    id: PLANO_ID, alunoId: ALUNO_ID, pastaId: null, titulo: 'Dieta fictícia', inicio: '2026-11-01', fim: '2026-11-30', ativo: true,
    versaoPublicada: 1, publicadoEm: '2026-11-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho: CONTEUDO,
  versoes: [{ id: 'v0000000-0000-4000-8000-0000000000fa', numero: 1, publicadoEm: '2026-11-01T12:00:00Z' }],
};

async function abrir(page: Page, largura: number, escuro = true) {
  await page.setViewportSize({ width: largura, height: 1000 });
  if (escuro) await page.addInitScript(([id]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), [TREINADOR.id]);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR'] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /alimentos': { corpo: [] },
    'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /planos-dieta/${PLANO_ID}`]: { corpo: DETALHE },
    [`PUT /planos-dieta/${PLANO_ID}/rascunho`]: { corpo: { ...DETALHE, plano: { ...DETALHE.plano, versao: 2 } } },
  });
  await page.goto(`/treinador/dietas/${PLANO_ID}`);
  await expect(page.getByRole('heading', { name: 'Refeições (2)' })).toBeVisible();
  if (largura >= 1280) await page.getByRole('button', { name: /^Refeição 2 de 2: 12:00 · Almoço/ }).click();
  else await page.getByRole('button', { name: '12:00 · Almoço, fechado' }).click();
  await expect(abas(page)).toBeVisible();
  return api;
}

const abas = (page: Page) => page.getByRole('tablist', { name: 'Opções de 12:00 · Almoço' });
const aba = (page: Page, letra: string) => abas(page).getByRole('tab', { name: new RegExp(`^Opção ${letra},`) });
const comparacao = (page: Page) => page.locator('#refeicao-almoco').getByRole('group', { name: 'Comparação das opções' });
/** "A 380 · B 130 · C —": a letra e a kcal de cada aba, na ordem da tela. */
const ordemDasAbas = (page: Page) => abas(page).getByRole('tab').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') ?? '')
  .replace(/^Opção (\w), (vazia|(\d+) kcal).*$/, (_t, l: string, v: string, k?: string) => `${l} ${k ?? v}`)).join(' · '));
const ordemDaComparacao = (page: Page) => comparacao(page).getByRole('button').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') ?? '')
  .replace(/^Opção (\w): (vazia|(\d+) kcal).*$/, (_t, l: string, v: string, k?: string) => `${l} ${k ?? v}`)).join(' · '));
const aviso = (page: Page, texto: string) => page.getByRole('alert').filter({ hasText: texto });

/** Segura a alça e leva o ponteiro em passos até `ponto` (a borda do alvo), depois solta. */
async function arrastar(page: Page, alca: Locator, ponto: (alvo: { x: number; y: number; width: number; height: number }) => { x: number; y: number }, alvo: Locator) {
  await alca.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await page.waitForTimeout(300);
  const a = (await alca.boundingBox())!;
  const fim = ponto((await alvo.boundingBox())!);
  const x0 = a.x + a.width / 2;
  const y0 = a.y + a.height / 2;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let k = 1; k <= 10; k += 1) await page.mouse.move(x0 + ((fim.x - x0) * k) / 10, y0 + ((fim.y - y0) * k) / 10);
  await page.mouse.up();
}

test('arrastar a aba B para o primeiro lugar: vira a A, conta no total, a comparação acompanha, a aberta fica; Desfazer volta (1280, escuro)', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280);
  // Uma opção só (o Café): nada a reordenar, sem alça.
  await expect(page.getByRole('tablist', { name: 'Opções de 07:00 · Café da manhã' }).getByTestId('alca-de-arraste')).toHaveCount(0);
  // A alça fica só na aba aberta; a comparação tem uma por linha.
  await expect(abas(page).getByTestId('alca-de-arraste')).toHaveCount(1);
  await expect(comparacao(page).getByTestId('alca-de-arraste')).toHaveCount(3);
  expect(await ordemDasAbas(page)).toBe('A 380 · B 130 · C vazia');

  // Abre a B e a leva pela alça até a borda esquerda da A, só na horizontal (descer um pouco não muda o destino).
  await aba(page, 'B').click();
  await arrastar(page, abas(page).getByTestId('alca-de-arraste'), (c) => ({ x: c.x + 6, y: c.y + c.height / 2 + 12 }), aba(page, 'A'));
  await expect(aviso(page, 'Opção B agora é a Opção A e conta no total do dia.')).toBeVisible();
  expect(await ordemDasAbas(page)).toBe('A 130 · B 380 · C vazia');
  expect(await ordemDaComparacao(page)).toBe('A 130 · B 380 · C vazia');
  await expect(aba(page, 'A')).toHaveAccessibleName('Opção A, 130 kcal, conta no total do dia');
  // A aberta continua a da batata (agora a A); o subtotal da refeição é o dela.
  await expect(aba(page, 'A')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#refeicao-almoco').getByRole('group', { name: 'Subtotal da refeição, opção A' })).toContainText('130');

  await aviso(page, 'Opção B agora é a Opção A').getByRole('button', { name: 'Desfazer' }).click();
  expect(await ordemDasAbas(page)).toBe('A 380 · B 130 · C vazia');
  await expect(aba(page, 'B')).toHaveAttribute('aria-selected', 'true');
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('arrastar a linha C da comparação para o topo: as abas acompanham e o rascunho leva as letras pela posição (1280)', async ({ page }) => {
  const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, 1280, false);
  await arrastar(page, comparacao(page).getByTestId('alca-de-arraste').nth(2), (c) => ({ x: c.x + c.width / 2, y: c.y + 4 }), comparacao(page).getByRole('button').first());
  await expect(aviso(page, 'Opção C agora é a Opção A e conta no total do dia.')).toBeVisible();
  expect(await ordemDaComparacao(page)).toBe('A vazia · B 380 · C 130');
  expect(await ordemDasAbas(page)).toBe('A vazia · B 380 · C 130');
  await expect(aba(page, 'B')).toHaveAttribute('aria-selected', 'true');

  // Arrastar sem mudar a primeira: "Ordem alterada." (a peça), com Desfazer.
  await arrastar(page, comparacao(page).getByTestId('alca-de-arraste').nth(2), (c) => ({ x: c.x + c.width / 2, y: c.y + 4 }), comparacao(page).getByRole('button').nth(1));
  await expect(aviso(page, 'Ordem alterada.')).toBeVisible();
  expect(await ordemDasAbas(page)).toBe('A vazia · B 130 · C 380');

  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect.poll(() => pedidos.filter((p) => p.metodo === 'PUT' && p.caminho.endsWith('/rascunho')).length).toBe(1);
  const corpo = pedidos.find((p) => p.metodo === 'PUT' && p.caminho.endsWith('/rascunho'))!.corpo as { conteudo: ConteudoDieta };
  const almoco = corpo.conteudo.refeicoes.find((r) => r.uid === 'almoco')!;
  expect(almoco.opcoes.map((o) => `${o.rotulo}:${o.uid}`)).toEqual(['A:almoco-c', 'B:almoco-b', 'C:almoco-a']);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('sem arrastar, pelo teclado: o ⋯ move e anuncia a posição, "Tornar Opção A" avisa com Desfazer, o foco volta à aba (1280)', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280, false);
  // Na primeira, o que não se aplica fica apagado com o motivo.
  await aba(page, 'A').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Mais ações da opção A' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Mover para a esquerda, Já é a primeira opção.' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Tornar Opção A, Já é a Opção A.' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /^Mover para a direita, Passa a ser a Opção B/ })).toBeEnabled();
  await page.keyboard.press('Escape');

  // A B para a direita: vira a C; sem aviso (a primeira não mudou), a região viva diz a posição nova.
  await aba(page, 'A').focus();
  await page.keyboard.press('ArrowRight');
  await expect(aba(page, 'B')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  const direita = page.getByRole('button', { name: /^Mover para a direita, Passa a ser a Opção C/ });
  await direita.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#refeicao-almoco').getByRole('status')).toHaveText('Opção B movida para a posição 3: agora é a Opção C.');
  expect(await ordemDasAbas(page)).toBe('A 380 · B vazia · C 130');
  await expect(aba(page, 'C')).toHaveAttribute('aria-selected', 'true');
  await expect(aba(page, 'C')).toBeFocused();
  await expect(page.getByRole('alert').filter({ hasText: /Opção|Ordem/ })).toHaveCount(0);

  // "Tornar Opção A": a C (batata) vai para o primeiro lugar, avisa e o foco fica na aba dela.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  const tornar = page.getByRole('button', { name: /^Tornar Opção A, Vai para o primeiro lugar/ });
  await tornar.focus();
  await page.keyboard.press('Enter');
  await expect(aviso(page, 'Opção C agora é a Opção A e conta no total do dia.')).toBeVisible();
  expect(await ordemDasAbas(page)).toBe('A 130 · B 380 · C vazia');
  expect(await ordemDaComparacao(page)).toBe('A 130 · B 380 · C vazia');
  await expect(aba(page, 'A')).toBeFocused();
  await expect(aba(page, 'A')).toHaveAttribute('aria-selected', 'true');

  await aviso(page, 'Opção C agora é a Opção A').getByRole('button', { name: 'Desfazer' }).click();
  expect(await ordemDasAbas(page)).toBe('A 380 · B vazia · C 130');
  await expect(aba(page, 'C')).toHaveAttribute('aria-selected', 'true');
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('a sombra da aba e da linha da comparação sai sobre a origem e acompanha o ponteiro (1280)', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280);
  await aba(page, 'C').click();
  await conferirSombra(page, abas(page).getByTestId('alca-de-arraste'), { x: -8, y: 5 }, { x: -60, y: 10 });
  await conferirSombra(page, comparacao(page).getByTestId('alca-de-arraste').nth(1), { x: 6, y: -7 }, { x: 25, y: -20 });
  expect(await ordemDasAbas(page)).toBe('A 380 · B 130 · C vazia');
  expect(errosDaPagina).toEqual([]);
});

test('celular (390): alça só na comparação (a faixa das abas é estreita), sem passar da largura; o ⋯ reordena', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 390);
  await expect(abas(page).getByTestId('alca-de-arraste')).toHaveCount(0);
  await expect(comparacao(page).getByTestId('alca-de-arraste')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  // Cada linha da comparação cabe na largura dela (os números não vazam).
  for (const b of await comparacao(page).getByRole('button').all()) expect(await b.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await aba(page, 'B').click();
  await page.getByRole('button', { name: 'Mais ações da opção B' }).click();
  await page.getByText('Tornar Opção A', { exact: true }).click();
  await expect(aviso(page, 'Opção B agora é a Opção A e conta no total do dia.')).toBeVisible();
  expect(await ordemDasAbas(page)).toBe('A 130 · B 380 · C vazia');
  await expect(aba(page, 'A')).toHaveAttribute('aria-selected', 'true');
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
