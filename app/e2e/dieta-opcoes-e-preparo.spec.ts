import { expect, test, type Page } from '@playwright/test';

import type { ConteudoDieta, ItemDieta, PlanoDetalhe, VersaoDetalhe } from '../src/api/tipos';
import { ALUNO, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/**
 * Dieta de 28/10: o almoço tem duas opções (alternativas, cada uma com o próprio total, "—" no que falta) e o modo de
 * preparo. Números e textos fictícios.
 */
function item(uid: string, nome: string, quantidade: number, kcal: number | null, gordura: number | null): ItemDieta {
  return { uid, alimentoId: null, nome, quantidade, unidade: 'g', kcal, proteina: 4, carboidrato: 30, gordura, manual: true };
}

const PREPARO = 'Cozinhe o arroz por 15 minutos.\nGrelhe o frango com limão.';

const CONTEUDO: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, suplementacao: [], ergogenicos: null, aguaLitros: null, variacoes: [],
  refeicoes: [{
    uid: 'almoco', nome: 'Almoço', horario: '12:00', observacao: null, modoDePreparo: PREPARO,
    opcoes: [
      { uid: 'a', rotulo: 'A', itens: [item('arroz', 'Arroz fictício', 150, 190, 0.4)] },
      { uid: 'b', rotulo: 'B', itens: [item('batata', 'Batata fictícia', 200, 170, null)] },
    ],
  }],
};

/**
 * Capturas do pedido de 25/11 (opções como abas), só com `CAPTURAS_OPCOES=<pasta>`: a dieta do aluno em 390 e o editor com
 * duas opções (A aberta, B vazia) em 1920, nos temas escuro e claro. A tela de agora fica como está; o tema muda e volta.
 */
const PASTA_OPCOES = process.env.CAPTURAS_OPCOES;
async function capturarAluno(page: Page, largura: number) {
  if (!PASTA_OPCOES || largura !== 390) return;
  for (const tema of ['ESCURO', 'CLARO'] as const) {
    await page.evaluate(([k, t]) => localStorage.setItem(k, JSON.stringify({ tema: t })), [`treinos:${ALUNO.id}:preferencias`, tema]);
    await page.reload();
    const abas = page.getByRole('tablist', { name: 'Opções de Almoço' });
    await expect(abas).toBeVisible();
    await abas.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${PASTA_OPCOES}/aluno-dieta-abas-390-${tema.toLowerCase()}.png` });
  }
  await page.evaluate(([k]) => localStorage.removeItem(k), [`treinos:${ALUNO.id}:preferencias`]);
  await page.reload();
}

const DIETA: VersaoDetalhe<ConteudoDieta> = {
  id: 'd0000000-0000-4000-8000-000000000001', planoId: 'p0000000-0000-4000-8000-000000000001', numero: 1, titulo: 'Dieta de teste',
  inicio: '2026-10-01', fim: '2026-10-31', publicadoEm: '2026-10-01T12:00:00Z', conteudo: CONTEUDO,
};

for (const largura of [390, 1280]) {
  test(`aluno: escolhe uma das opções, abre o modo de preparo e o PDF o leva (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.addInitScript(() => { window.print = () => undefined; });
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAluno(page)),
      'GET /aluno/dieta': { corpo: { dieta: DIETA } },
      'GET /aluno/pesos': { corpo: [] },
    });
    await page.goto('/aluno/dieta');
    await expect(page.getByText('Escolha uma das opções: A ou B.')).toBeVisible();
    await expect(page.getByText(/equivalente/i)).toHaveCount(0);
    // Total da opção pela peça única dos macros (`ui/ValoresDaDieta`): o rótulo e, logo abaixo, kcal e P, C e G.
    const totalDaOpcao = page.getByRole('group', { name: 'Total da opção A' });
    await expect(totalDaOpcao.getByText('190 kcal', { exact: true })).toBeVisible();
    await expect(totalDaOpcao.getByText('P 4,0 g', { exact: true })).toBeVisible();
    // 25/11: as abas do aluno são as do editor, com "Opção A", a kcal em texto secundário e o círculo da letra, preenchido
    // na aberta (a cor do sublinhado da aba, a de ação); trocar de aba move o preenchimento. Sem "+ Nova opção" nem ⋯.
    const abaDoAluno = (r: string) => page.getByRole('tab', { name: new RegExp(`^Opção ${r},`) });
    await expect(abaDoAluno('A')).toHaveAccessibleName('Opção A, 190 kcal');
    await expect(abaDoAluno('B')).toContainText('170 kcal');
    await expect(page.getByRole('button', { name: /^Adicionar opção/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Mais ações da opção/ })).toHaveCount(0);
    await capturarAluno(page, largura);
    const circulo = (r: string) => abaDoAluno(r).getByTestId('marcador-de-opcao').evaluate((el) => ({ letra: el.textContent, fundo: getComputedStyle(el).backgroundColor }));
    const sublinhado = (r: string) => abaDoAluno(r).evaluate((el) => getComputedStyle(el).borderBottomColor);
    await expect(abaDoAluno('A')).toHaveAttribute('aria-selected', 'true');
    // Com poll: a cor do sublinhado da aba transita (0,984 de opacidade no meio da animação).
    await expect.poll(async () => (await circulo('A')).fundo === (await sublinhado('A'))).toBe(true);
    expect((await circulo('A')).letra).toBe('A');
    await expect.poll(async () => (await circulo('B')).fundo).toBe('rgba(0, 0, 0, 0)');
    expect((await circulo('B')).letra).toBe('B');
    await abaDoAluno('B').click();
    await expect(page.getByRole('group', { name: 'Total da opção B' })).toBeVisible();
    await expect.poll(async () => (await circulo('B')).fundo === (await sublinhado('B'))).toBe(true);
    await abaDoAluno('A').click();

    // Fechado por padrão; abre ao tocar e mostra o texto com as quebras de linha.
    await expect(page.getByText('Cozinhe o arroz por 15 minutos.', { exact: false })).toHaveCount(0);
    await page.getByRole('button', { name: 'Abrir modo de preparo' }).click();
    await expect(page.getByText('Grelhe o frango com limão.', { exact: false })).toBeVisible();

    await page.getByRole('button', { name: 'Baixar PDF da dieta' }).click();
    await page.getByRole('dialog', { name: 'PDF da dieta' }).getByRole('button', { name: 'Baixar PDF', exact: true }).click();
    const bloco = page.locator('#treinos-impressao');
    await expect(bloco).toContainText('Sugestão de plano alimentar');
    await expect(bloco).toContainText('Escolha uma das opções: A ou B.');
    await expect(bloco).toContainText('Modo de preparo');
    await expect(bloco).toContainText('Grelhe o frango com limão.');
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

const PLANO_ID = 'p0000000-0000-4000-8000-000000000001';

/** O ⋯ da aba aberta (25/11) e o "Excluir opção" da folha de ações. */
async function excluirPeloMenu(page: Page, rotulo: string, dentro = page.locator('body')) {
  await dentro.getByRole('button', { name: `Mais ações da opção ${rotulo}` }).click();
  await page.getByText('Excluir opção', { exact: true }).click();
}
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const DETALHE: PlanoDetalhe<ConteudoDieta> = {
  plano: {
    id: PLANO_ID, alunoId: ALUNO_ID, pastaId: null, titulo: 'Dieta de teste', inicio: '2026-10-01', fim: '2026-10-31', ativo: true,
    versaoPublicada: 1, publicadoEm: '2026-10-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho: CONTEUDO,
  versoes: [{ id: 'v0000000-0000-4000-8000-000000000001', numero: 1, publicadoEm: '2026-10-01T12:00:00Z' }],
};

// Opções em abas (19/11): no lugar das colunas lado a lado; a opção é achada pela aba.
for (const [largura, inspetor] of [[390, false], [1280, true]] as const) {
  test(`treinador: opções em abas com o total de cada uma e o modo de preparo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /alimentos': { corpo: [] },
      'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluno Teste' } },
      [`GET /planos-dieta/${PLANO_ID}`]: { corpo: DETALHE },
    });
    await page.goto(`/treinador/dietas/${PLANO_ID}`);
    // PC: a refeição da lista abre no inspetor; celular: a refeição única já nasce aberta (18/11), sem clique.
    if (inspetor) await page.getByRole('button', { name: /^Refeição 1 de 1: 12:00 · Almoço/ }).click();
    else await expect(page.getByRole('button', { name: /12:00 · Almoço, aberto/ })).toBeVisible();

    const abas = page.getByRole('tablist', { name: 'Opções de 12:00 · Almoço' });
    const a = abas.getByRole('tab', { name: /^Opção A,/ });
    const b = abas.getByRole('tab', { name: /^Opção B,/ });
    await expect(a).toHaveAttribute('aria-selected', 'true');
    await expect(b).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByText('Cada opção substitui a refeição inteira: o aluno escolhe uma.')).toBeVisible();
    // Total de cada opção (com a aba dela aberta), separado dos itens, gramas com uma casa; o que falta (gordura da batata) é "—".
    // No PC a opção é tabela (20/11): cada número embaixo da coluna dele, sem a unidade (está no título da coluna).
    const totalA = page.getByRole('group', { name: 'Total da opção A' });
    const totalB = page.getByRole('group', { name: 'Total da opção B' });
    const textosA = inspetor ? ['190', '4,0', '30,0', '0,4'] : ['190 kcal', 'P 4,0 g', 'C 30,0 g', 'G 0,4 g'];
    for (const texto of textosA) await expect(totalA.getByText(texto, { exact: true }).first()).toBeVisible();
    await expect(totalB).toHaveCount(0);
    await b.click();
    const textosB = inspetor ? ['170', '4,0', '30,0', '—'] : ['170 kcal', 'P 4,0 g', 'C 30,0 g', 'G —'];
    for (const texto of textosB) await expect(totalB.getByText(texto, { exact: true }).first()).toBeVisible();
    await expect(totalA).toHaveCount(0);
    // O modo de preparo gravado também fica atrás do link (18/11): o toque abre os campos e o texto está lá.
    await expect(page.getByLabel('Modo de preparo (opcional)', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Observação ou modo de preparo (opcional)' }).click();
    await expect(page.getByLabel('Modo de preparo (opcional)', { exact: true })).toHaveValue(PREPARO);
    await expect(page.getByText(/equivalente/i)).toHaveCount(0);
    // Excluir a opção (no ⋯ da aba aberta, 25/11; com itens, pede confirmação) leva os itens junto: dá para desfazer (04/11).
    await excluirPeloMenu(page, 'B');
    await page.getByRole('alertdialog', { name: 'Excluir a opção B?' }).getByRole('button', { name: 'Excluir opção' }).click();
    await expect(b).toHaveCount(0);
    await expect(page.getByText('Opção B removida.')).toBeVisible();
    await page.getByRole('button', { name: 'Desfazer' }).click();
    await expect(b).toBeVisible();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

/**
 * Opções como abas (25/11 à noite): a barra aparece também com uma opção só ("Opção A" e "+ Nova opção" tracejado, logo
 * depois da última aba, acima da tabela e à esquerda); o "+ Nova opção" cria a próxima letra, vazia ("vazia" na aba);
 * trocar de aba troca a tabela e o "Total da opção X"; o ⋯ da aba aberta exclui com Desfazer. "Adicionar alimento" é o
 * único `acao` da área (o fundo do "Adicionar refeição"); "Item manual" não. Com `CAPTURAS_OPCOES`, guarda o editor com a
 * A aberta e a B vazia em 1920.
 */
const UMA_OPCAO: PlanoDetalhe<ConteudoDieta> = {
  ...DETALHE,
  rascunho: { ...CONTEUDO, refeicoes: [{ ...CONTEUDO.refeicoes[0], opcoes: [CONTEUDO.refeicoes[0].opcoes[0]] }] },
};
/** O primeiro fundo pintado do botão (ele ou o que está dentro dele). */
const fundoDe = (l: ReturnType<Page['getByRole']>) =>
  l.evaluate((el) => [el, ...el.querySelectorAll('*')].map((e) => getComputedStyle(e).backgroundColor).find((c) => c !== 'rgba(0, 0, 0, 0)'));

for (const [largura, tema] of [[1920, 'ESCURO'], [1920, 'CLARO'], [390, 'CLARO']] as const) {
  test(`treinador: opções como abas, também com uma só; "+ Nova opção", total da aba e ⋯ com Desfazer (${largura}px, ${tema.toLowerCase()})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema]);
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /alimentos': { corpo: [] },
      'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluno Teste' } },
      [`GET /planos-dieta/${PLANO_ID}`]: { corpo: UMA_OPCAO },
    });
    await page.goto(`/treinador/dietas/${PLANO_ID}`);
    if (largura >= 1280) await page.getByRole('button', { name: /^Refeição 1 de 1: 12:00 · Almoço/ }).click();
    else await expect(page.getByRole('button', { name: /12:00 · Almoço, aberto/ })).toBeVisible();
    const cartao = page.locator('#refeicao-almoco');
    const abas = cartao.getByRole('tablist', { name: 'Opções de 12:00 · Almoço' });
    const aba = (r: string) => abas.getByRole('tab', { name: new RegExp(`^Opção ${r},`) });
    const nova = cartao.getByRole('button', { name: 'Adicionar opção em 12:00 · Almoço' });

    // Uma opção: a barra com a A (sem o selo e sem ⋯: não há o que escolher nem o que excluir) e o "+ Nova opção".
    await expect(abas.getByRole('tab')).toHaveCount(1);
    await expect(aba('A')).toHaveAccessibleName('Opção A, 190 kcal');
    await expect(aba('A')).toContainText('190 kcal');
    await expect(nova).toBeVisible();
    await expect(cartao.getByRole('button', { name: /^Mais ações da opção/ })).toHaveCount(0);
    await expect(cartao.getByRole('group', { name: 'Comparação das opções' })).toHaveCount(0);
    await expect(cartao.getByText('Conta no total do dia')).toHaveCount(0);
    const [caixaA, caixaNova, titulo, painel] = await Promise.all([aba('A').boundingBox(), nova.boundingBox(),
      cartao.getByText('Alimentos (1)', { exact: true }).boundingBox(), cartao.getByTestId('opcoes-da-refeicao').boundingBox()]);
    if (!caixaA || !caixaNova || !titulo || !painel) throw new Error('sem caixa');
    // À esquerda, acima da tabela, e o "+ Nova opção" colado à última aba (não na ponta da faixa).
    expect(Math.abs(caixaA.x - painel.x)).toBeLessThan(4);
    expect(caixaA.y + caixaA.height).toBeLessThanOrEqual(titulo.y);
    expect(caixaNova.x - (caixaA.x + caixaA.width)).toBeLessThan(16);
    expect(caixaNova.height).toBeGreaterThanOrEqual(44);
    // O "+ Opção" saiu do cabeçalho "Alimentos": nada de botão na linha dele.
    await expect(cartao.getByRole('button', { name: 'Opção', exact: true })).toHaveCount(0);
    // Um só `acao` na área: o "Adicionar alimento" (o fundo do "Adicionar refeição"); o "Item manual" fica secundário.
    const adicionar = cartao.getByRole('button', { name: 'Adicionar alimento', exact: true });
    const corDeAcao = await fundoDe(page.getByRole('button', { name: 'Adicionar refeição' }));
    expect(await fundoDe(adicionar)).toBe(corDeAcao);
    expect(await fundoDe(cartao.getByRole('button', { name: 'Item manual', exact: true }))).not.toBe(corDeAcao);
    // A aba tracejada é discreta: sem fundo, contorno tracejado e o texto na cor de ação.
    const tracejado = await nova.evaluate((el) => {
      const d = [...el.querySelectorAll('*')].find((e) => getComputedStyle(e).borderStyle === 'dashed');
      return d ? getComputedStyle(d).backgroundColor : null;
    });
    expect(tracejado).toBe('rgba(0, 0, 0, 0)');

    // "+ Nova opção": a B nasce vazia, aberta e com o foco; a A ganha o selo; a vazia não tem total.
    await nova.click();
    await expect(abas.getByRole('tab')).toHaveCount(2);
    await expect(aba('B')).toHaveAttribute('aria-selected', 'true');
    await expect(aba('B')).toBeFocused();
    await expect(aba('B')).toHaveAccessibleName('Opção B, vazia');
    await expect(aba('B')).toContainText('vazia');
    await expect(aba('A')).toHaveAccessibleName('Opção A, 190 kcal, conta no total do dia');
    await expect(cartao.getByText('Nenhum alimento nesta opção ainda. Adicione um da biblioteca ou um item manual.')).toBeVisible();
    await expect(cartao.getByRole('group', { name: /^Total da opção/ })).toHaveCount(0);
    await expect(cartao.locator('input[value="Arroz fictício"]')).toHaveCount(0);

    // Trocar de aba troca a tabela e o total.
    await aba('A').click();
    await expect(cartao.getByRole('group', { name: 'Total da opção A' })).toBeVisible();
    await expect(cartao.locator('input[value="Arroz fictício"]')).toBeVisible();
    // O ⋯ fica na ponta da aba aberta.
    const menuA = cartao.getByRole('button', { name: 'Mais ações da opção A' });
    await expect(menuA).toBeVisible();
    const [abaAberta, caixaMenu] = [(await aba('A').boundingBox())!, (await menuA.boundingBox())!];
    expect(caixaMenu.x).toBeGreaterThanOrEqual(abaAberta.x);
    expect(caixaMenu.x + caixaMenu.width).toBeLessThanOrEqual(abaAberta.x + abaAberta.width + 1);
    if (PASTA_OPCOES) {
      await page.setViewportSize({ width: largura, height: 1200 });
      await cartao.evaluate((el) => { el.style.scrollMarginTop = '180px'; el.scrollIntoView({ block: 'start' }); });
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${PASTA_OPCOES}/editor-dieta-2-opcoes-A-aberta-B-vazia-${largura}-${tema.toLowerCase()}.png` });
    }

    // ⋯ da B (vazia): exclui sem perguntar, a A abre com o foco e o Desfazer devolve a B.
    await aba('B').click();
    await excluirPeloMenu(page, 'B', cartao);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(aba('B')).toHaveCount(0);
    await expect(aba('A')).toHaveAttribute('aria-selected', 'true');
    await expect(aba('A')).toBeFocused();
    await expect(cartao.getByRole('button', { name: /^Mais ações da opção/ })).toHaveCount(0);
    await expect(page.getByText('Opção B removida.')).toBeVisible();
    await page.getByRole('button', { name: 'Desfazer' }).click();
    await expect(aba('B')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

/**
 * Empilhado (celular), várias refeições abertas empurravam o "Desfazer" do topo para fora da janela: a opção removida
 * mostra o aviso na refeição dela e a refeição removida, no lugar onde estava. Em duas colunas o aviso fica onde sempre
 * esteve, entre "Refeições (N)" e a lista. Com `CAPTURAS=<pasta>`, guarda as telas.
 */
const REFEICOES = ['Café da manhã', 'Almoço', 'Jantar'].map((nome, i) => ({
  uid: `r${i}`, nome, horario: `0${7 + i * 6}:00`.slice(-5), observacao: null, modoDePreparo: null,
  opcoes: ['A', 'B'].map((rotulo) => ({ uid: `r${i}${rotulo}`, rotulo, itens: [
    item(`r${i}${rotulo}1`, `Arroz ${rotulo}${i}`, 100, 130, 0.3), item(`r${i}${rotulo}2`, `Frango ${rotulo}${i}`, 120, 190, 4),
  ] })),
}));
const VARIAS: PlanoDetalhe<ConteudoDieta> = { ...DETALHE, rascunho: { ...CONTEUDO, refeicoes: REFEICOES } };

for (const [largura, escuro] of [[390, false], [390, true], [1280, false]] as const) {
  test(`treinador: o Desfazer de opção e refeição removidas fica à vista (${largura}px${escuro ? ', escuro' : ''})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    if (escuro) await page.addInitScript(([id]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), [TREINADOR.id]);
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /alimentos': { corpo: [] },
      'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluno Teste' } },
      [`GET /planos-dieta/${PLANO_ID}`]: { corpo: VARIAS },
    });
    await page.goto(`/treinador/dietas/${PLANO_ID}`);
    const cabecalho = page.getByRole('heading', { name: 'Refeições (3)' });
    await expect(cabecalho).toBeVisible();
    const opcoesB = page.getByRole('tab', { name: /^Opção B,/ });
    /** Abre a aba B (a última, no celular: a do jantar), exclui e confirma (a opção tem itens). */
    const excluirB = async () => {
      await opcoesB.last().click();
      await page.getByRole('button', { name: 'Mais ações da opção B' }).last().click();
      await page.getByText('Excluir opção', { exact: true }).click();
      await page.getByRole('alertdialog', { name: 'Excluir a opção B?' }).getByRole('button', { name: 'Excluir opção' }).click();
    };
    const capturar = async (nome: string) => {
      if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/${nome}-${largura}${escuro ? '-escuro' : ''}.png` });
    };

    if (largura === 390) {
      await page.getByRole('button', { name: 'Abrir todas' }).click();
      // A opção B do jantar, lá embaixo: o aviso aparece no jantar, não no topo (que ficou fora da janela).
      await excluirB();
      await expect(opcoesB).toHaveCount(2);
      await expect(page.getByText('Opção B removida.')).toBeInViewport();
      await expect(cabecalho).not.toBeInViewport();
      await capturar('desfazer-opcao');
      await page.getByRole('button', { name: 'Desfazer' }).click();
      await expect(opcoesB).toHaveCount(3);
      await expect(page.getByText('Opção B removida.')).toHaveCount(0);

      await page.getByRole('button', { name: 'Remover 19:00 · Jantar' }).click();
      await expect(page.getByRole('heading', { name: 'Refeições (2)' })).toBeAttached();
      await expect(page.getByText('Refeição “Jantar” removida.')).toBeInViewport();
      await capturar('desfazer-refeicao');
      await page.getByRole('button', { name: 'Desfazer' }).click();
      await expect(page.getByRole('heading', { name: 'Refeições (3)' })).toBeAttached();
      await expect(page.getByRole('button', { name: 'Remover 19:00 · Jantar' })).toBeVisible();
    } else {
      // Duas colunas: o aviso fica entre "Refeições (N)" e a lista, como antes.
      await page.getByRole('button', { name: /^Refeição 3 de 3: 19:00 · Jantar/ }).click();
      await excluirB();
      const aviso = page.getByText('Opção B removida.');
      await expect(aviso).toBeInViewport();
      const [topo, caixa, lista] = [await cabecalho.boundingBox(), await aviso.boundingBox(),
        await page.getByRole('button', { name: /^Refeição 1 de 3/ }).boundingBox()];
      if (!topo || !caixa || !lista) throw new Error('sem caixa');
      expect(caixa.y).toBeGreaterThan(topo.y);
      expect(caixa.y).toBeLessThan(lista.y);
      await capturar('desfazer-opcao');
      await expect(opcoesB).toHaveCount(0);
      await page.getByRole('button', { name: 'Desfazer' }).click();
      await expect(opcoesB).toHaveCount(1);

      // Refeição removida também avisa no topo; a seguinte fica escolhida e o Desfazer devolve o Jantar.
      await page.getByRole('button', { name: 'Remover 19:00 · Jantar' }).click();
      const avisoDaRefeicao = page.getByText('Refeição “Jantar” removida.');
      await expect(avisoDaRefeicao).toBeInViewport();
      const [caixa2, lista2] = [await avisoDaRefeicao.boundingBox(), await page.getByRole('button', { name: /^Refeição 1 de 2/ }).boundingBox()];
      if (!caixa2 || !lista2) throw new Error('sem caixa');
      expect(caixa2.y).toBeGreaterThan(topo.y);
      expect(caixa2.y).toBeLessThan(lista2.y);
      await page.getByRole('button', { name: 'Desfazer' }).click();
      await expect(page.getByRole('button', { name: /^Refeição 3 de 3: 19:00 · Jantar/ })).toBeVisible();
    }
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

/**
 * 30/10: "Água por dia" fica no cartão "Total do dia", à vista. Antes morava na "Configuração do plano", que já abre
 * fechada quando a dieta tem refeições, e o treinador não a achava.
 */
for (const largura of [390, 1280]) {
  test(`treinador: água por dia à vista no Total do dia e salva no rascunho (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /alimentos': { corpo: [] },
      'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluno Teste' } },
      [`GET /planos-dieta/${PLANO_ID}`]: { corpo: DETALHE },
      [`PUT /planos-dieta/${PLANO_ID}/rascunho`]: { corpo: { ...DETALHE, rascunho: { ...CONTEUDO, aguaLitros: 2.5 }, plano: { ...DETALHE.plano, versao: 2 } } },
    });
    await page.goto(`/treinador/dietas/${PLANO_ID}`);
    const total = page.getByRole('heading', { name: 'Total do dia' });
    await expect(total).toBeVisible();
    // A configuração do plano está fechada, e mesmo assim o campo da água aparece.
    await expect(page.getByLabel('Objetivo (opcional)')).toHaveCount(0);
    const agua = page.getByLabel('Água por dia, em litros (opcional)');
    await expect(agua).toBeVisible();
    await agua.fill('2,5');
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect.poll(() => pedidos.filter((p) => p.metodo === 'PUT' && p.caminho.endsWith('/rascunho')).length).toBe(1);
    const put = pedidos.find((p) => p.metodo === 'PUT' && p.caminho.endsWith('/rascunho'));
    expect((put?.corpo as { conteudo: ConteudoDieta }).conteudo.aguaLitros).toBe(2.5);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
