import { expect, test, type Page } from '@playwright/test';

import type { Alimento, ConteudoDieta, ItemDieta, PlanoDetalhe, Refeicao } from '../src/api/tipos';
import { MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Opções em abas (19/11): com duas ou mais opções, a comparação dos totais, as abas (padrão Tabs da APG: setas, Home/End,
 * a aberta com `aria-selected`) e a opção aberta na largura toda; com uma só, nada de abas e o "+ Opção" discreto. O
 * "Trocar alimento" (secundário compacto) fica embaixo do nome na tabela e com as ações no empilhado. Só dados fictícios.
 * Com `CAPTURAS=<pasta>`, guarda as telas (tema escuro).
 */
const PLANO_ID = 'p0000000-0000-4000-8000-0000000000e1';
const ALUNO_ID = 'a0000000-0000-4000-8000-0000000000e2';

const alimento = (id: string, nome: string, kcal: number, p: number, c: number, g: number, fibra: number | null): Alimento =>
  ({ id, nome, baseQuantidade: 100, baseUnidade: 'g', kcal, proteina: p, carboidrato: c, gordura: g, fibra, gramasPorUnidade: null, fonte: null, origem: 'MANUAL', fatorCorrecao: null, fatorCoccao: null, grupo: null });
const PAO = alimento('f0000000-0000-4000-8000-0000000000e3', 'Pão fictício integral', 250, 9, 45, 3.5, 6.9);
const IOGURTE = alimento('f0000000-0000-4000-8000-0000000000e4', 'Iogurte fictício natural desnatado com granola e mel', 72, 4, 11, 1.3, 0.8);
const BANANA = alimento('f0000000-0000-4000-8000-0000000000e5', 'Banana fictícia', 98, 1.3, 26, 0.1, 2);
const AVEIA = alimento('f0000000-0000-4000-8000-0000000000e6', 'Aveia fictícia em flocos', 394, 14, 67, 8.5, null);
const ARROZ = alimento('f0000000-0000-4000-8000-0000000000e7', 'Arroz fictício', 128, 2.5, 28.1, 0.2, 1.6);
const FRANGO = alimento('f0000000-0000-4000-8000-0000000000e8', 'Frango fictício grelhado', 159, 32, 0, 2.5, null);
const BATATA = alimento('f0000000-0000-4000-8000-0000000000e9', 'Batata fictícia cozida', 52, 1.2, 11.9, 0, 1.3);
const ALIMENTOS = [PAO, IOGURTE, BANANA, AVEIA, ARROZ, FRANGO, BATATA];

const doAlimento = (uid: string, a: Alimento, quantidade: number): ItemDieta => {
  const f = quantidade / 100;
  const v = (x: number | null | undefined) => (x == null ? null : Math.round(x * f * 10) / 10);
  return { uid, alimentoId: a.id, nome: a.nome, quantidade, unidade: 'g', kcal: v(a.kcal), proteina: v(a.proteina), carboidrato: v(a.carboidrato), gordura: v(a.gordura), fibra: v(a.fibra), manual: false };
};

const CAFE: Refeicao = { uid: 'cafe', nome: 'Café da manhã', horario: '07:00', observacao: null, modoDePreparo: null, opcoes: [
  { uid: 'cafe-a', rotulo: 'A', itens: [doAlimento('pao', PAO, 50), doAlimento('iogurte', IOGURTE, 170), doAlimento('banana', BANANA, 80), doAlimento('aveia', AVEIA, 30)] },
] };
const ALMOCO: Refeicao = { uid: 'almoco', nome: 'Almoço', horario: '12:00', observacao: null, modoDePreparo: null, opcoes: [
  { uid: 'almoco-a', rotulo: 'A', itens: [doAlimento('arroz', ARROZ, 150), doAlimento('frango', FRANGO, 120)] },
  { uid: 'almoco-b', rotulo: 'B', itens: [doAlimento('batata', BATATA, 250)] },
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
  versoes: [{ id: 'v0000000-0000-4000-8000-0000000000ea', numero: 1, publicadoEm: '2026-11-01T12:00:00Z' }],
};

async function abrir(page: Page, largura: number, escuro = true) {
  await page.setViewportSize({ width: largura, height: 1000 });
  if (escuro) await page.addInitScript(([id]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), [TREINADOR.id]);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR', 'DIETA_PUBLICAR'] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /alimentos': { corpo: ALIMENTOS },
    'GET /alimentos/fatores': { corpo: [] },
    'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /planos-dieta/${PLANO_ID}`]: { corpo: DETALHE },
    // A batata da opção B sem quantidade: o erro fica atrás de uma aba fechada.
    [`POST /planos-dieta/${PLANO_ID}/validar`]: { corpo: { erros: [{ caminho: 'refeicoes[1].opcoes[1].itens[0].quantidade', mensagem: 'Informe a quantidade.' }], avisos: [] } },
  });
  await page.goto(`/treinador/dietas/${PLANO_ID}`);
  await expect(page.getByRole('heading', { name: 'Refeições (2)' })).toBeVisible();
  return api;
}

/** Abre a refeição: no PC pela lista (inspetor), no celular pelo cabeçalho do cartão. */
async function abrirRefeicao(page: Page, largura: number, posicao: number, titulo: string) {
  if (largura >= 1280) await page.getByRole('button', { name: new RegExp(`^Refeição ${posicao} de 2: ${titulo}`) }).click();
  else await page.getByRole('button', { name: `${titulo}, fechado` }).click();
}

const abasDoAlmoco = (page: Page) => page.getByRole('tablist', { name: 'Opções de 12:00 · Almoço' });
const aba = (page: Page, rotulo: string) => abasDoAlmoco(page).getByRole('tab', { name: new RegExp(`^Opção ${rotulo},`) });

/** Captura (só com `CAPTURAS`): a refeição inteira e, para o contexto, a janela com ela no topo. */
async function capturar(page: Page, id: string, nome: string) {
  const pasta = process.env.CAPTURAS;
  if (!pasta) return;
  const { width } = page.viewportSize() ?? { width: 1280 };
  await page.setViewportSize({ width, height: 1800 });
  const cartao = page.locator(`#refeicao-${id}`);
  // A barra do editor gruda no topo: a margem deixa o cabeçalho da refeição abaixo dela.
  await cartao.evaluate((el) => { el.style.scrollMarginTop = '180px'; el.scrollIntoView({ block: 'start' }); });
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${pasta}/${nome}.png` });
  await page.setViewportSize({ width, height: 1000 });
}

for (const largura of [1280, 390, 1920]) {
  test(`uma opção sem abas, três opções em abas com a comparação, a aberta na largura toda (${largura}, escuro)`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, largura);
    if (largura < 1280) await abrirRefeicao(page, largura, 1, '07:00 · Café da manhã');
    const cafe = page.locator('#refeicao-cafe');
    // Uma opção: sem abas nem comparação; o "+ Opção" discreto e um "Trocar alimento" por alimento da biblioteca.
    await expect(cafe.getByRole('tablist')).toHaveCount(0);
    await expect(cafe.getByRole('group', { name: 'Comparação das opções' })).toHaveCount(0);
    await expect(cafe.getByRole('button', { name: 'Adicionar opção em 07:00 · Café da manhã' })).toBeVisible();
    await expect(cafe.getByRole('button', { name: /^Trocar alimento: / })).toHaveCount(4);
    await expect(cafe.getByRole('button', { name: `Trocar alimento: ${IOGURTE.nome}` })).toBeVisible();
    await capturar(page, 'cafe', `1-opcao-4-alimentos-${largura}-escuro`);

    await abrirRefeicao(page, largura, 2, '12:00 · Almoço');
    const almoco = page.locator('#refeicao-almoco');
    await expect(abasDoAlmoco(page).getByRole('tab')).toHaveCount(3);
    await expect(aba(page, 'A')).toHaveAttribute('aria-selected', 'true');
    await expect(aba(page, 'A')).toHaveAccessibleName('Opção A, 383 kcal, conta no total do dia');
    await expect(aba(page, 'C')).toHaveAccessibleName('Opção C, vazia');
    await expect(almoco.getByText('Cada opção substitui a refeição inteira: o aluno escolhe uma.')).toBeVisible();
    const comparacao = almoco.getByRole('group', { name: 'Comparação das opções' });
    await expect(comparacao.getByRole('button')).toHaveCount(3);
    // O painel da aba: rótulo dela no `tabpanel` (Radix liga o painel à aba).
    await expect(page.getByRole('tabpanel', { name: /^Opção A,/ })).toBeVisible();
    await expect(almoco.getByRole('group', { name: 'Total da opção A' })).toBeVisible();
    await capturar(page, 'almoco', `3-opcoes-aba-A-${largura}-escuro`);

    await aba(page, 'B').click();
    await expect(aba(page, 'B')).toHaveAttribute('aria-selected', 'true');
    await expect(almoco.getByRole('group', { name: 'Total da opção B' })).toBeVisible();
    await expect(almoco.getByRole('group', { name: 'Total da opção A' })).toHaveCount(0);
    await expect(almoco.getByText(FRANGO.nome, { exact: true })).toHaveCount(0);
    // A aba aberta cabe inteira na faixa das abas (o selo da A vai na linha de baixo); em 1280, as três cabem.
    const faixa = (await almoco.getByTestId('faixa-das-abas').boundingBox())!;
    const dentro = async (rotulo: string) => {
      const c = (await aba(page, rotulo).boundingBox())!;
      return c.x >= faixa.x - 1 && c.x + c.width <= faixa.x + faixa.width + 1;
    };
    expect(await dentro('B')).toBe(true);
    if (largura >= 1280) for (const r of ['A', 'C']) expect(await dentro(r)).toBe(true);
    await capturar(page, 'almoco', `3-opcoes-aba-B-${largura}-escuro`);

    if (largura >= 1280) {
      // Tabela (em 1280 com o menu aberto desde 20/11): o "Trocar alimento" embaixo do nome, e cada número do total
      // embaixo da coluna dele.
      await aba(page, 'A').click();
      const titulo = (await page.getByRole('tabpanel').getByText('Kcal', { exact: true }).boundingBox())!;
      const total = (await almoco.getByRole('group', { name: 'Total da opção A' }).getByText('383', { exact: true }).boundingBox())!;
      expect(Math.abs(total.x + total.width - (titulo.x + titulo.width))).toBeLessThan(2);
      const nome = (await almoco.getByText(ARROZ.nome, { exact: true }).boundingBox())!;
      const trocar = (await almoco.getByRole('button', { name: `Trocar alimento: ${ARROZ.nome}` }).boundingBox())!;
      expect(trocar.y).toBeGreaterThan(nome.y + nome.height - 1);
      expect(Math.abs(trocar.x - nome.x)).toBeLessThan(2);
    }
    // Nada passa da janela.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('Desfazer do alimento removido fica à vista, perto da lista (390)', async ({ page }) => {
  await abrir(page, 390, false);
  await abrirRefeicao(page, 390, 1, '07:00 · Café da manhã');
  await page.getByRole('button', { name: `Remover ${AVEIA.nome}` }).click();
  await expect(page.getByText(`Alimento “${AVEIA.nome}” removido.`)).toBeInViewport();
});

test('teclado nas abas (APG): setas movem e abrem, Home e End vão às pontas', async ({ page }) => {
  await abrir(page, 1280, false);
  await abrirRefeicao(page, 1280, 2, '12:00 · Almoço');
  await aba(page, 'A').focus();
  await page.keyboard.press('ArrowRight');
  await expect(aba(page, 'B')).toBeFocused();
  await expect(aba(page, 'B')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(aba(page, 'C')).toBeFocused();
  await expect(aba(page, 'C')).toHaveAttribute('aria-selected', 'true');
  await capturar(page, 'almoco', 'foco-na-aba-C-1280-claro');
  await page.keyboard.press('Home');
  await expect(aba(page, 'A')).toHaveAttribute('aria-selected', 'true');
  // Só a aba aberta entra na ordem do Tab.
  await expect(aba(page, 'B')).toHaveAttribute('tabindex', '-1');
  await expect(aba(page, 'A')).toHaveAttribute('tabindex', '0');
});

test('criar abre a opção nova com o foco na aba; excluir pede confirmação com itens e abre a vizinha; Desfazer devolve', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 1280, false);
  // Com uma opção só, o "+ Opção" cria a B e as abas aparecem com ela aberta.
  await page.getByRole('button', { name: 'Adicionar opção em 07:00 · Café da manhã' }).click();
  const abaNova = page.getByRole('tablist', { name: 'Opções de 07:00 · Café da manhã' }).getByRole('tab', { name: /^Opção B,/ });
  await expect(abaNova).toHaveAttribute('aria-selected', 'true');
  await expect(abaNova).toBeFocused();
  await expect(page.getByText('Nenhum alimento nesta opção ainda. Adicione um da biblioteca ou um item manual.')).toBeVisible();

  await abrirRefeicao(page, 1280, 2, '12:00 · Almoço');
  await aba(page, 'B').click();
  await page.getByRole('button', { name: 'Excluir opção B' }).click();
  const dialogo = page.getByRole('alertdialog', { name: 'Excluir a opção B?' });
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole('button', { name: 'Excluir opção' }).click();
  await expect(aba(page, 'B')).toHaveCount(0);
  // A vizinha (a C, que agora é a segunda) abre com o foco nela.
  await expect(aba(page, 'C')).toHaveAttribute('aria-selected', 'true');
  await expect(aba(page, 'C')).toBeFocused();
  await expect(page.getByText('Opção B removida.')).toBeVisible();
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(aba(page, 'B')).toHaveCount(1);

  // A C está vazia: sai sem perguntar.
  await aba(page, 'C').click();
  await page.getByRole('button', { name: 'Excluir opção C' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(aba(page, 'C')).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('a linha da comparação abre a aba; a validação abre a opção com o erro e a aba avisa', async ({ page }) => {
  await abrir(page, 1280, false);
  await abrirRefeicao(page, 1280, 2, '12:00 · Almoço');
  const comparacao = page.locator('#refeicao-almoco').getByRole('group', { name: 'Comparação das opções' });
  await comparacao.getByRole('button', { name: /^Opção C: vazia/ }).click();
  await expect(aba(page, 'C')).toHaveAttribute('aria-selected', 'true');
  await expect(comparacao.getByRole('button', { name: /^Opção C: vazia/ })).toHaveAttribute('aria-current', 'true');
  await capturar(page, 'almoco', '3-opcoes-aba-C-vazia-1280-claro');

  await aba(page, 'A').click();
  await page.getByRole('button', { name: 'Validar', exact: true }).click();
  await expect(aba(page, 'B')).toHaveAttribute('aria-selected', 'true');
  await expect(aba(page, 'B')).toHaveAccessibleName(/com problema a corrigir$/);
  await capturar(page, 'almoco', 'erro-na-aba-B-1280-claro');
});
