import { expect, test, type Page } from '@playwright/test';

import type { Alimento, ConteudoDieta, ItemDieta, PlanoDetalhe } from '../src/api/tipos';
import { MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Dieta em tabela (18/11; em 1280 com o menu aberto desde 20/11): os alimentos da opção numa tabela (cabeçalho de colunas
 * uma vez, cada item numa faixa com o número, quantidade e unidade num campo só, os números sem o "g" e só o ⋯ no fim),
 * com a opção larga; estreita (390), o item empilhado com os rótulos de sempre. Só dados fictícios.
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

// Em 1920 a opção passa de 1300 px e em 1280 tem 668 (o inspetor ao lado, o menu aberto): tabela. Em 390, empilhado.
for (const escuro of [false, true]) {
  const sufixo = escuro ? 'escuro' : 'claro';
  for (const largura of [1920, 1280]) {
    test(`opção larga: cabeçalho uma vez, colunas alinhadas e contorno do problema (${largura}, ${sufixo})`, async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, largura, escuro);
      expect((await opcoes(page).boundingBox())!.width).toBeGreaterThan(660);
      await expect(page.getByText('Alimento', { exact: true })).toHaveCount(1);
      // O título de cada coluna fica em cima do campo dela, nas duas espécies de item; a unidade fica dentro do campo.
      const titulo = (await page.getByText('Quantidade', { exact: true }).boundingBox())!;
      const campos = page.getByRole('textbox', { name: 'Quantidade', exact: true });
      await expect(campos).toHaveCount(4);
      for (const i of [0, 2]) expect(Math.abs((await campos.nth(i).boundingBox())!.x - titulo.x)).toBeLessThan(2);
      const unidades = page.getByRole('button', { name: 'Unidade: g. Escolher.' });
      await expect(unidades).toHaveCount(4);
      const campo = (await campos.first().boundingBox())!;
      const unidade = (await unidades.first().boundingBox())!;
      expect(unidade.x).toBeGreaterThan(campo.x);
      expect(unidade.x + unidade.width).toBeLessThanOrEqual(campo.x + campo.width + 1);
      // O número do item fica embaixo do título da coluna, à direita, sem o "g" (está no título).
      const kcal = (await page.getByText('Kcal', { exact: true }).first().boundingBox())!;
      const numero = (await page.getByText('192', { exact: true }).boundingBox())!;
      expect(Math.abs(numero.x + numero.width - (kcal.x + kcal.width))).toBeLessThan(2);
      await expect(page.getByText('3,8', { exact: true })).toBeVisible();
      // O item manual digita os valores na linha de baixo, com o rótulo à vista (os campos não cabem nas colunas).
      const nomeDoManual = (await page.getByRole('textbox', { name: 'Item', exact: true }).first().boundingBox())!;
      const campoKcal = (await page.getByRole('textbox', { name: 'Kcal', exact: true }).first().boundingBox())!;
      expect(campoKcal.y).toBeGreaterThan(nomeDoManual.y + nomeDoManual.height);
      // Dois selos "Item manual" e o botão "Item manual" da opção.
      await expect(page.getByText('Item manual', { exact: true })).toHaveCount(3);
      // Na linha, só o ⋯ e a alça: a lixeira foi para o ⋯ ("Excluir alimento").
      await expect(page.getByRole('button', { name: `Remover ${ARROZ.nome}` })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Mais ações de / })).toHaveCount(4);
      expect(await contornoDaFaixa(page, ARROZ.nome)).toBe(TRANSPARENTE);
      await validarComProblemas(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura);
      await capturar(page, `tabela-${largura}-${sufixo}`);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }

  for (const largura of [390]) {
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

// O limite é a largura da OPÇÃO, `larguraDaTabela()` = 656 px desde 20/11 (quantidade e unidade num campo só, números
// em 48 px sem o "g", só o ⋯ no fim, vão de 6 e o nome no mínimo da largura do "Trocar alimento"). No layout de duas
// colunas a opção acompanha a janela 1:1 (medido em 20/11, com o menu aberto e a lista de 260: 1270 → 658, 1280 → 668),
// então a tabela começa em ~1268 px de janela; 1263 (651 px) ainda empilha e 1273 (661 px) já é tabela.
test('o limite sai das colunas: a opção abaixo de 656 px empilha e a partir dele vira tabela (janelas de 1263 e 1273)', async ({ page }) => {
  await abrir(page, 1263);
  const estreita = (await opcoes(page).boundingBox())!.width;
  expect(estreita).toBeLessThan(656);
  expect(estreita).toBeGreaterThan(646);
  await expect(page.getByText('Alimento', { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 1273, height: 1000 });
  await expect.poll(async () => (await opcoes(page).boundingBox())!.width).toBeGreaterThanOrEqual(656);
  await expect(page.getByText('Alimento', { exact: true })).toHaveCount(1);
  await capturar(page, 'opcao-656-claro');
});

// Na tabela, a linha fica com a alça e o ⋯ (20/11): a lixeira é o "Excluir alimento" do ⋯, com o mesmo Desfazer; a unidade
// é um botão de menu dentro do campo da quantidade (Menu Button da APG); o nome longo corta e fica inteiro na dica.
test('na tabela (1280): "Excluir alimento" no ⋯ com Desfazer, a unidade pelo menu do campo e o nome inteiro na dica', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280);
  await expect(page.locator(`[title="${FRANGO.nome}"]`)).toHaveCount(1);
  await page.getByRole('button', { name: `Mais ações de ${ARROZ.nome}`, exact: true }).click();
  await page.getByText('Excluir alimento', { exact: true }).click();
  await expect(page.getByText(`Alimento “${ARROZ.nome}” removido.`)).toBeVisible();
  await expect(page.getByText(ARROZ.nome, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByText(ARROZ.nome, { exact: true })).toBeVisible();

  const unidade = page.getByRole('button', { name: 'Unidade: g. Escolher.' }).first();
  await unidade.click();
  const gramas = page.getByRole('menuitemradio', { name: 'Gramas (g)' });
  await expect(gramas).toBeFocused();
  await expect(gramas).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu', { name: 'Unidade' })).toHaveCount(0);
  await expect(unidade).toBeFocused();
  await unidade.click();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: 'Mililitros (ml)' })).toBeFocused();
  await page.keyboard.press('Enter');
  const ml = page.getByRole('button', { name: 'Unidade: ml. Escolher.' });
  await expect(ml).toHaveCount(1);
  await expect(ml).toBeFocused();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
