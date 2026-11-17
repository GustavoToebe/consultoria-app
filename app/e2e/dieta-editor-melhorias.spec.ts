import { expect, test, type Page } from '@playwright/test';

import type { Alimento, ConteudoDieta, ItemDieta, PlanoDetalhe, Refeicao } from '../src/api/tipos';
import { corDaRefeicao } from '../src/dominio/corDaSerie';
import { PALETA_DE_IDENTIFICACAO, paletaDe } from '../src/tema/tokens';
import { MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso } from './api-falsa';
import { transbordos } from './transbordo';

/**
 * Editor de dieta, passos 9 a 11 do plano `dieta-pronta-para-comecar` (C56, C66+C60, C63+C95): "Trocar" no item da
 * biblioteca mantém o lugar, a quantidade e a unidade e recalcula pelo novo alimento (com "Desfazer"); o subtotal da
 * refeição (kcal e P/C/G) aparece também com ela aberta; a barra lateral de 6 px na cor da refeição, pela posição na
 * seção aberta (na dieta por dia, dentro da variação). Em 390 e 1280 px, nos temas claro, Areia e escuro. Dados fictícios.
 */
const PLANO_ID = 'p0000000-0000-4000-8000-0000000000d1';
const ALUNO_ID = 'a0000000-0000-4000-8000-0000000000d2';

const alimento = (id: string, nome: string, baseQuantidade: number, baseUnidade: Alimento['baseUnidade'], kcal: number, p: number, c: number, g: number): Alimento =>
  ({ id, nome, baseQuantidade, baseUnidade, kcal, proteina: p, carboidrato: c, gordura: g, gramasPorUnidade: null, fonte: null, origem: 'MANUAL', fatorCorrecao: null, fatorCoccao: null, grupo: null });
const PAO = alimento('pao', 'Pão fictício', 100, 'g', 266, 8.4, 49.6, 3.2);
const LEITE = alimento('leite', 'Leite fictício', 100, 'ml', 50, 3, 5, 2);
const BANANA = alimento('banana', 'Banana fictícia', 1, 'un', 90, 1, 23, 0.3);
const IOGURTE = alimento('iogurte', 'Iogurte fictício', 100, 'ml', 60, 3.5, 4.7, 3);
const ARROZ = alimento('arroz', 'Arroz fictício', 100, 'g', 128, 2.5, 28, 0.2);
const ALIMENTOS = [PAO, LEITE, BANANA, IOGURTE, ARROZ];

const item = (uid: string, a: Alimento, quantidade: number, unidade: ItemDieta['unidade']): ItemDieta => {
  const fator = quantidade / (a.baseQuantidade ?? 1);
  return { uid, alimentoId: a.id, nome: a.nome, quantidade, unidade, kcal: (a.kcal ?? 0) * fator, proteina: (a.proteina ?? 0) * fator,
    carboidrato: (a.carboidrato ?? 0) * fator, gordura: (a.gordura ?? 0) * fator, manual: false };
};
const cafe = (uid = 'cafe'): Refeicao => ({ uid, nome: 'Café da manhã', horario: '07:00', observacao: null, modoDePreparo: null, opcoes: [
  { uid: `${uid}-a`, rotulo: 'A', itens: [item(`${uid}-pao`, PAO, 50, 'g'), item(`${uid}-leite`, LEITE, 200, 'ml'), item(`${uid}-banana`, BANANA, 1, 'un')] },
] });
const ALMOCO: Refeicao = { uid: 'almoco', nome: 'Almoço', horario: '12:00', observacao: null, modoDePreparo: null, opcoes: [
  { uid: 'almoco-a', rotulo: 'A', itens: [item('almoco-arroz', ARROZ, 150, 'g')] },
] };

const BASE: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, suplementacao: [], ergogenicos: null, aguaLitros: null,
  refeicoes: [cafe(), ALMOCO], variacoes: [],
};
const POR_DIA: ConteudoDieta = { ...BASE, refeicoes: [], variacoes: [
  { uid: 'v-treino', rotulo: 'Dia de treino', dias: [1, 3, 5], refeicoes: [ALMOCO] },
  { uid: 'v-descanso', rotulo: 'Descanso', dias: [2, 4, 6, 7], refeicoes: [cafe('cafe2')] },
] };

const detalhe = (rascunho: ConteudoDieta): PlanoDetalhe<ConteudoDieta> => ({
  plano: {
    id: PLANO_ID, alunoId: ALUNO_ID, pastaId: null, titulo: 'Dieta fictícia', inicio: '2026-11-01', fim: '2026-11-30', ativo: true,
    versaoPublicada: 1, publicadoEm: '2026-11-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho,
  versoes: [{ id: 'v0000000-0000-4000-8000-0000000000d3', numero: 1, publicadoEm: '2026-11-01T12:00:00Z' }],
});

type Tema = 'CLARO' | 'AREIA' | 'ESCURO';
const VARIANTE = { CLARO: 'claro', AREIA: 'areia', ESCURO: 'escuro' } as const;
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

async function abrirEditor(page: Page, rascunho: ConteudoDieta, tema: Tema) {
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema]);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR', 'BIBLIOTECA_LER'] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    // A mesma rota serve os alimentos e os suplementos (`?tipo=SUPLEMENTO`): estes ficam vazios.
    'GET /alimentos': (pedido: PedidoFalso, route) => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(pedido.busca.get('tipo') === 'SUPLEMENTO' ? [] : ALIMENTOS) }),
    'GET /alimentos/fatores': { corpo: [] },
    'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /planos-dieta/${PLANO_ID}`]: { corpo: detalhe(rascunho) },
    [`PUT /planos-dieta/${PLANO_ID}/rascunho`]: { corpo: { ...detalhe(rascunho), plano: { ...detalhe(rascunho).plano, versao: 2 } } },
  });
  await page.goto(`/treinador/dietas/${PLANO_ID}`);
  await expect(page.getByRole('heading', { name: /^Refeições \(/ })).toBeVisible();
  return api;
}

async function salvarERetornar(page: Page, pedidos: PedidoFalso[]): Promise<ConteudoDieta> {
  const doRascunho = () => pedidos.filter((p) => p.metodo === 'PUT' && p.caminho.endsWith('/rascunho'));
  const antes = doRascunho().length;
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect.poll(() => doRascunho().length).toBe(antes + 1);
  return (doRascunho().at(-1)?.corpo as { conteudo: ConteudoDieta }).conteudo;
}

const cartao = (page: Page, uid: string) => page.locator(`#refeicao-${uid} [data-testid="cartao"]`).first();
const barra = (page: Page, uid: string) => cartao(page, uid).evaluate((el) => {
  const e = getComputedStyle(el);
  return { largura: e.borderLeftWidth, cor: e.borderLeftColor };
});

/** No celular as refeições começam fechadas; no PC a primeira já está no inspetor. */
async function abrirRefeicao(page: Page, largura: number, titulo: string) {
  if (largura >= 1280) return;
  await page.getByRole('button', { name: `Abrir ${titulo}` }).click();
}

for (const tema of ['CLARO', 'AREIA', 'ESCURO'] as const) {
  for (const largura of [390, 1280]) {
    const sufixo = `${largura}-${VARIANTE[tema]}`;
    test(`trocar o 2º de 3 itens mantém lugar e quantidade; subtotal aberto; barra da refeição (${sufixo})`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: largura, height: 1000 });
      const { pedidos, naoTratadas, errosDaPagina } = await abrirEditor(page, BASE, tema);
      // A paleta que o tema usa de verdade (a Areia hoje resolve para a variante clara: `PALETAS.AREIA`).
      const paleta = PALETA_DE_IDENTIFICACAO[paletaDe(tema).variante];

      // Cor: barra de 6 px pela posição (1ª magenta, 2ª índigo, fora das cores dos macros; no PC, a 2ª entra no inspetor pela lista).
      expect(await barra(page, 'cafe')).toEqual({ largura: '6px', cor: rgb(paleta[corDaRefeicao(0)]) });
      if (largura < 1280) expect(await barra(page, 'almoco')).toEqual({ largura: '6px', cor: rgb(paleta[corDaRefeicao(1)]) });
      if (largura < 1280) await page.screenshot({ path: testInfo.outputPath(`fechadas-${sufixo}.png`), fullPage: true });

      await abrirRefeicao(page, largura, '07:00 · Café da manhã');
      const cafeAberto = cartao(page, 'cafe');
      // Subtotal (opção A) no cabeçalho com a refeição aberta: 133 + 100 + 90 kcal.
      const subtotal = cafeAberto.getByRole('group', { name: 'Subtotal da refeição' });
      await expect(subtotal).toBeVisible();
      await expect(subtotal.getByText('323 kcal', { exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`aberta-${sufixo}.png`), fullPage: true });

      // Só item da biblioteca tem "Trocar"; troca o 2º (leite, 200 ml) pelo iogurte.
      await cafeAberto.getByRole('button', { name: 'Trocar Leite fictício' }).click();
      await expect(page.getByText('No lugar de “Leite fictício”. A posição, a quantidade e a unidade ficam; os valores são recalculados.')).toBeVisible();
      // O alimento atual não aparece na lista da troca; a busca sem resultado diz que não achou.
      await expect(page.getByRole('button', { name: 'Escolher Leite fictício' })).toHaveCount(0);
      await page.getByRole('textbox', { name: 'Buscar alimento' }).fill('nada parecido');
      await expect(page.getByText('Nenhum alimento encontrado.')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`troca-sem-resultado-${sufixo}.png`) });
      await page.getByRole('textbox', { name: 'Buscar alimento' }).fill('iog');
      await page.screenshot({ path: testInfo.outputPath(`troca-folha-${sufixo}.png`) });
      await page.getByRole('button', { name: 'Escolher Iogurte fictício' }).click();

      await expect(page.getByText('“Leite fictício” trocado por “Iogurte fictício”.')).toBeVisible();
      await expect(cafeAberto.getByRole('button', { name: 'Trocar Iogurte fictício' })).toBeVisible();
      await expect(subtotal.getByText('343 kcal', { exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`trocado-${sufixo}.png`), fullPage: true });

      const salvo = await salvarERetornar(page, pedidos);
      const itens = salvo.refeicoes[0].opcoes[0].itens;
      expect(itens.map((i) => i.uid)).toEqual(['cafe-pao', 'cafe-leite', 'cafe-banana']);
      expect(itens[1]).toMatchObject({ alimentoId: 'iogurte', nome: 'Iogurte fictício', quantidade: 200, unidade: 'ml', manual: false, kcal: 120, proteina: 7, carboidrato: 9.4, gordura: 6 });
      expect(itens[0]).toMatchObject({ alimentoId: 'pao', quantidade: 50 });
      expect(itens[2]).toMatchObject({ alimentoId: 'banana', quantidade: 1, unidade: 'un' });

      // Desfazer devolve o leite.
      await page.getByRole('button', { name: 'Desfazer' }).click();
      await expect(cafeAberto.getByRole('button', { name: 'Trocar Leite fictício' })).toBeVisible();

      if (largura >= 1280) {
        await page.getByRole('button', { name: /^Refeição 2 de 2: 12:00 · Almoço/ }).click();
        expect(await barra(page, 'almoco')).toEqual({ largura: '6px', cor: rgb(paleta[corDaRefeicao(1)]) });
      }
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

for (const largura of [390, 1280]) {
  test(`dieta por dia: troca na 2ª variação, a 1ª refeição dela volta à cor da 1ª; unidade sem conversão fica "—" (${largura})`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    const { pedidos, naoTratadas, errosDaPagina } = await abrirEditor(page, POR_DIA, 'CLARO');
    await page.getByRole('tablist', { name: 'Variações da dieta' }).getByRole('tab', { name: /^Descanso,/ }).click();
    await expect(page.getByRole('heading', { name: 'Total do dia · Descanso' })).toBeVisible();
    expect(await barra(page, 'cafe2')).toEqual({ largura: '6px', cor: rgb(PALETA_DE_IDENTIFICACAO.claro[corDaRefeicao(0)]) });

    await abrirRefeicao(page, largura, '07:00 · Café da manhã');
    const cafe2 = cartao(page, 'cafe2');
    // Banana em "un" trocada por arroz (base em g, sem gramas por unidade): o valor fica "—" e o aviso diz o que falta.
    await cafe2.getByRole('button', { name: 'Trocar Banana fictícia' }).click();
    await page.getByRole('button', { name: 'Escolher Arroz fictício' }).click();
    await expect(cafe2.getByText('Informe gramas por unidade no alimento')).toBeVisible();
    await expect(cafe2.getByRole('group', { name: 'Subtotal da refeição' }).getByText('— kcal', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`variacao-sem-conversao-${largura}.png`), fullPage: true });

    const salvo = await salvarERetornar(page, pedidos);
    expect(salvo.refeicoes).toEqual([]);
    expect(salvo.variacoes[0].refeicoes[0].opcoes[0].itens.map((i) => i.alimentoId)).toEqual(['arroz']);
    const itens = salvo.variacoes[1].refeicoes[0].opcoes[0].itens;
    expect(itens.map((i) => i.uid)).toEqual(['cafe2-pao', 'cafe2-leite', 'cafe2-banana']);
    expect(itens[2]).toMatchObject({ alimentoId: 'arroz', nome: 'Arroz fictício', quantidade: 1, unidade: 'un', kcal: null });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

/** Nome longo (com e sem espaços) não estoura o cartão nem empurra kcal/macros para fora; 80 = limite do campo Nome. */
const NOME_LONGO = 'Refeição pré-treino com batata-doce, frango desfiado e salada verde temperada no azeite';
const SEM_ESPACOS = 'Batatadocecozidasemcascaamassadacomazeitedeolivaextravirgemsalrosadohimalaiaenozmoscada';
const COM_NOME_LONGO: ConteudoDieta = { ...BASE, refeicoes: [
  { ...cafe(), nome: NOME_LONGO.slice(0, 80), opcoes: [
    { uid: 'cafe-a', rotulo: 'A', itens: [{ ...item('cafe-pao', PAO, 50, 'g'), nome: SEM_ESPACOS }, item('cafe-leite', LEITE, 200, 'ml')] },
    { uid: 'cafe-b', rotulo: 'B', itens: [item('cafe-banana', BANANA, 1, 'un')] },
  ] },
  { ...ALMOCO, nome: SEM_ESPACOS.slice(0, 80) },
] };

for (const largura of [390, 1280]) {
  test(`nome longo de refeição e de alimento quebra a linha sem empurrar o subtotal (${largura})`, async ({ page }, testInfo) => {
    // Alta para o cartão aberto caber inteiro na captura (a tela rola por dentro).
    await page.setViewportSize({ width: largura, height: 2600 });
    const { naoTratadas, errosDaPagina } = await abrirEditor(page, COM_NOME_LONGO, 'CLARO');
    const titulo = `07:00 · ${NOME_LONGO.slice(0, 80)}`;
    if (largura < 1280) {
      // Fechadas: o cabeçalho empilha título, contagem e subtotal, sem corte.
      expect(await transbordos(cartao(page, 'almoco'))).toEqual([]);
      expect(await transbordos(cartao(page, 'cafe'))).toEqual([]);
      // A tela rola por dentro: a captura é do cartão.
      await cartao(page, 'cafe').screenshot({ path: testInfo.outputPath(`nome-longo-fechada-${largura}.png`) });
    }
    await abrirRefeicao(page, largura, titulo);
    const subtotal = cartao(page, 'cafe').getByRole('group', { name: 'Subtotal da refeição, opção A' });
    await expect(subtotal).toBeVisible();
    // O leitor de tela ouve o rótulo e os valores por extenso, numa frase só.
    await expect(subtotal.getByText('Subtotal da refeição, opção A: 233 kcal, proteína 10,2 g, carboidrato 34,8 g, gordura 5,6 g', { exact: true })).toHaveCount(1);
    await expect(cartao(page, 'cafe').getByText(SEM_ESPACOS, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await transbordos(cartao(page, 'cafe'))).toEqual([]);
    await cartao(page, 'cafe').screenshot({ path: testInfo.outputPath(`nome-longo-aberta-${largura}.png`) });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
