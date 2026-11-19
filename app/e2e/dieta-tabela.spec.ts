import { expect, test, type Page } from '@playwright/test';

import type { Alimento, ConteudoDieta, ItemDieta, PlanoDetalhe } from '../src/api/tipos';
import { MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Dieta em tabela (18/11): os alimentos da opção numa tabela (cabeçalho de colunas uma vez, cada item numa faixa com o
 * número), com a opção larga; estreita, o item empilhado com os rótulos de sempre. Só dados fictícios.
 */
const PLANO_ID = 'p0000000-0000-4000-8000-0000000000b1';
const ALUNO_ID = 'a0000000-0000-4000-8000-0000000000b2';

const alimento = (id: string, nome: string, kcal: number, p: number, c: number, g: number): Alimento =>
  ({ id, nome, baseQuantidade: 100, baseUnidade: 'g', kcal, proteina: p, carboidrato: c, gordura: g, gramasPorUnidade: null, fonte: null, origem: 'MANUAL', fatorCorrecao: null, fatorCoccao: null, grupo: null });
const ARROZ = alimento('f0000000-0000-4000-8000-0000000000b3', 'Arroz fictício', 128, 2.5, 28.1, 0.2);
const FRANGO = alimento('f0000000-0000-4000-8000-0000000000b4', 'Frango fictício grelhado em tiras', 159, 32, 0, 2.5);

const biblioteca = (uid: string, a: Alimento, quantidade: number | null): ItemDieta => {
  const f = quantidade === null ? null : quantidade / 100;
  const v = (x: number | null) => (f === null || x === null ? null : Math.round(x * f * 10) / 10);
  return { uid, alimentoId: a.id, nome: a.nome, quantidade, unidade: 'g', kcal: v(a.kcal), proteina: v(a.proteina), carboidrato: v(a.carboidrato), gordura: v(a.gordura), manual: false };
};
const manual = (uid: string, nome: string, quantidade: number | null): ItemDieta =>
  ({ uid, alimentoId: null, nome, quantidade, unidade: 'g', kcal: 45, proteina: 1.2, carboidrato: 6, gordura: 1.8, manual: true });

const CONTEUDO: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, aguaLitros: null, variacoes: [], suplementacao: [], ergogenicos: null,
  refeicoes: [{ uid: 'almoco', nome: 'Almoço', horario: '12:00', observacao: null, modoDePreparo: null, opcoes: [{ uid: 'aa', rotulo: 'A', itens: [
    biblioteca('arroz', ARROZ, 150),
    biblioteca('frango', FRANGO, null),
    manual('salada', 'Salada fictícia', 80),
    manual('molho', 'Molho fictício', 0),
  ] }] }],
};
const DETALHE: PlanoDetalhe<ConteudoDieta> = {
  plano: {
    id: PLANO_ID, alunoId: ALUNO_ID, pastaId: null, titulo: 'Dieta fictícia', inicio: '2026-11-01', fim: '2026-11-30', ativo: true,
    versaoPublicada: 1, publicadoEm: '2026-11-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho: CONTEUDO,
  versoes: [{ id: 'v0000000-0000-4000-8000-0000000000b5', numero: 1, publicadoEm: '2026-11-01T12:00:00Z' }],
};
/** O que a validação aponta: a quantidade que falta (âmbar) e a quantidade zero (vermelho). */
const PROBLEMAS = [
  { caminho: 'refeicoes[0].opcoes[0].itens[1].quantidade', mensagem: 'Informe a quantidade.' },
  { caminho: 'refeicoes[0].opcoes[0].itens[3].quantidade', mensagem: 'Quantidade precisa ser maior que zero.' },
];

async function abrir(page: Page, largura: number, escuro = false) {
  await page.setViewportSize({ width: largura, height: 1000 });
  if (escuro) await page.addInitScript(([id]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), [TREINADOR.id]);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR', 'DIETA_PUBLICAR'] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /alimentos': { corpo: [ARROZ, FRANGO] },
    'GET /alimentos/fatores': { corpo: [] },
    'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /planos-dieta/${PLANO_ID}`]: { corpo: DETALHE },
    [`POST /planos-dieta/${PLANO_ID}/validar`]: { corpo: { erros: PROBLEMAS, avisos: [] } },
  });
  await page.goto(`/treinador/dietas/${PLANO_ID}`);
  await expect(page.getByRole('heading', { name: 'Refeições (1)' })).toBeVisible();
  const fechada = page.getByRole('button', { name: '12:00 · Almoço, fechado' });
  if (await fechada.count()) await fechada.click();
  await expect(page.getByText(ARROZ.nome, { exact: true })).toBeVisible();
  return api;
}

const opcoes = (page: Page) => page.getByTestId('opcoes-da-refeicao');

/** Cor do contorno da faixa do item (o primeiro ancestral do nome com cantos de 12 px). */
const contornoDaFaixa = (page: Page, nome: string) =>
  page.getByText(nome, { exact: true }).first().evaluate((el) => {
    let no: HTMLElement | null = el as HTMLElement;
    while (no && getComputedStyle(no).borderTopLeftRadius !== '12px') no = no.parentElement;
    return no ? getComputedStyle(no).borderTopColor : null;
  });
/** O mesmo, para o item manual (o nome é um campo): `posicao` entre os itens manuais. */
const contornoDoManual = (page: Page, posicao: number) =>
  page.getByRole('textbox', { name: 'Item', exact: true }).nth(posicao).evaluate((el) => {
    let no: HTMLElement | null = el as HTMLElement;
    while (no && getComputedStyle(no).borderTopLeftRadius !== '12px') no = no.parentElement;
    return no ? getComputedStyle(no).borderTopColor : null;
  });

const TRANSPARENTE = 'rgba(0, 0, 0, 0)';

/** "Validar" acha os dois problemas: os itens com problema ganham o contorno; o resto fica sem. */
async function validarComProblemas(page: Page) {
  await page.getByRole('button', { name: 'Validar', exact: true }).click();
  await expect.poll(() => contornoDaFaixa(page, FRANGO.nome)).not.toBe(TRANSPARENTE);
  await expect.poll(() => contornoDoManual(page, 1)).not.toBe(TRANSPARENTE);
  // Âmbar na quantidade que falta, vermelho na quantidade zero: cores diferentes.
  expect(await contornoDoManual(page, 1)).not.toBe(await contornoDaFaixa(page, FRANGO.nome));
  expect(await contornoDaFaixa(page, ARROZ.nome)).toBe(TRANSPARENTE);
  expect(await contornoDoManual(page, 0)).toBe(TRANSPARENTE);
}

/** Captura (só com `CAPTURAS`): a janela alta, com a refeição no topo. */
async function capturar(page: Page, nome: string) {
  const pasta = process.env.CAPTURAS;
  if (!pasta) return;
  const { width } = page.viewportSize() ?? { width: 1280 };
  await page.setViewportSize({ width, height: 1300 });
  await page.getByRole('heading', { name: 'Refeições (1)' }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: `${pasta}/${nome}.png` });
}

// Em 1920 a opção passa de 1300 px: tabela. Em 1280 (664 px, com o inspetor ao lado) e 390, empilhado.
for (const escuro of [false, true]) {
  const sufixo = escuro ? 'escuro' : 'claro';
  test(`opção larga: cabeçalho uma vez, colunas alinhadas e contorno do problema (1920, ${sufixo})`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, 1920, escuro);
    expect((await opcoes(page).boundingBox())!.width).toBeGreaterThan(900);
    await expect(page.getByText('Alimento', { exact: true })).toHaveCount(1);
    // O título de cada coluna fica em cima do campo dela, nas duas espécies de item.
    const titulo = (await page.getByText('Quantidade', { exact: true }).boundingBox())!;
    const campos = page.getByRole('textbox', { name: 'Quantidade', exact: true });
    await expect(campos).toHaveCount(4);
    for (const i of [0, 2]) expect(Math.abs((await campos.nth(i).boundingBox())!.x - titulo.x)).toBeLessThan(2);
    const kcal = (await page.getByText('Kcal', { exact: true }).boundingBox())!;
    const campoKcal = (await page.getByRole('textbox', { name: 'Kcal', exact: true }).first().boundingBox())!;
    expect(Math.abs(campoKcal.x + campoKcal.width - (kcal.x + kcal.width))).toBeLessThan(2);
    // Item da biblioteca: os valores como texto, sem rótulo por linha; o manual com o selo.
    await expect(page.getByText('192', { exact: true })).toBeVisible();
    // Dois selos "Item manual" e o botão "Item manual" da opção.
    await expect(page.getByText('Item manual', { exact: true })).toHaveCount(3);
    expect(await contornoDaFaixa(page, ARROZ.nome)).toBe(TRANSPARENTE);
    await validarComProblemas(page);
    await capturar(page, `tabela-1920-${sufixo}`);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  for (const largura of [1280, 390]) {
    test(`opção estreita: item empilhado com os rótulos, sem cabeçalho (${largura}, ${sufixo})`, async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, largura, escuro);
      await expect(page.getByText('Alimento', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Quantidade', { exact: true })).toHaveCount(4);
      await expect(page.getByRole('textbox', { name: 'Quantidade', exact: true })).toHaveCount(4);
      await expect(page.getByRole('button', { name: 'Unidade: g. Escolher.' })).toHaveCount(4);
      await validarComProblemas(page);
      // Nada passa da janela no celular.
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura);
      await capturar(page, `empilhado-${largura}-${sufixo}`);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

// O limite é a largura da OPÇÃO, `larguraDaTabela()` = 910 px desde 19/11 (o "Trocar alimento" saiu da coluna das ações,
// que reserva só o ⋯ e a lixeira). Opções em abas (19/11): a opção aberta tem a largura toda do inspetor, então o limite
// em janela cai no layout de duas colunas: a opção acompanha a janela 1:1 (medido em 19/11: 1520 → 889 px), então a tabela
// começa em ~1541 px de janela; 1536 (905 px) ainda empilha e 1546 (915 px) já é tabela.
test('o limite sai das colunas: a opção abaixo de 910 px empilha e a partir dele vira tabela (janelas de 1536 e 1546)', async ({ page }) => {
  await abrir(page, 1536);
  const estreita = (await opcoes(page).boundingBox())!.width;
  expect(estreita).toBeLessThan(910);
  expect(estreita).toBeGreaterThan(900);
  await expect(page.getByText('Alimento', { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 1546, height: 1000 });
  await expect.poll(async () => (await opcoes(page).boundingBox())!.width).toBeGreaterThanOrEqual(910);
  await expect(page.getByText('Alimento', { exact: true })).toHaveCount(1);
  await capturar(page, 'opcao-910-claro');
});
