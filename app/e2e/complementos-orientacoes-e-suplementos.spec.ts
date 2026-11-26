import { expect, test, type Locator, type Page } from '@playwright/test';

import type { ConteudoDieta, ItemDieta, PlanoDetalhe } from '../src/api/tipos';
import { MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { conferirSombra } from './sombraDoArraste';

/**
 * Editor de dieta › Complementos (25/11): um cartão com abas (Orientações, Observações, Suplementação e, com
 * ERGOGENICO_LER, Outros), contagens, ícone de problema na aba, aba lembrada ao salvar e ao trocar de refeição,
 * orientações em lista compacta (uma aberta por vez, reordenar, excluir com Desfazer, nova já aberta), observações com
 * contador e suplementação em tabela (cabeçalho uma vez, nome em duas linhas, link, ⋯) ou cartões no celular.
 * Só dados fictícios.
 */
const PLANO_ID = 'p0000000-0000-4000-8000-0000000000c1';
const ALUNO_ID = 'a0000000-0000-4000-8000-0000000000c2';

const item = (uid: string, nome: string): ItemDieta =>
  ({ uid, alimentoId: null, nome, quantidade: 100, unidade: 'g', kcal: 120, proteina: 5, carboidrato: 20, gordura: 2, manual: false });

const NOME_LONGO = 'Creatina monohidratada fictícia em pó sabor neutro, pote de 300 g';

const CONTEUDO: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, observacoes: 'Evite frituras.', aguaLitros: null, variacoes: [],
  refeicoes: [
    { uid: 'cafe', nome: 'Café da manhã', horario: '07:00', observacao: null, modoDePreparo: null, opcoes: [{ uid: 'ca', rotulo: 'A', itens: [item('pao', 'Pão fictício')] }] },
    { uid: 'almoco', nome: 'Almoço', horario: '12:00', observacao: null, modoDePreparo: null, opcoes: [{ uid: 'aa', rotulo: 'A', itens: [item('arroz', 'Arroz fictício')] }] },
  ],
  orientacoes: [
    { titulo: 'Hidratação', texto: 'Beba água ao longo do dia, começando logo ao acordar e levando a garrafa para o treino.' },
    { titulo: 'Preparo', texto: 'Prefira grelhados e assados.' },
    { titulo: '', texto: 'Texto fictício sem título.' },
  ],
  suplementacao: [
    { uid: 's1', nome: NOME_LONGO, dose: '3 g', horario: 'Manhã', observacao: 'Com água', link: 'https://exemplo.com/creatina', cupom: 'TESTE10' },
    { uid: 's2', nome: 'Whey fictício', dose: '', horario: 'Pós-treino', observacao: '', link: null, cupom: null },
    { uid: 's3', nome: 'Ômega fictício', dose: '1 cápsula', horario: 'Almoço', observacao: '', link: null, cupom: null },
  ],
  ergogenicos: [
    { uid: 'e1', nome: 'Item fictício A', principioAtivo: '', concentracao: '', dose: '1 cápsula', horario: 'Noite', observacao: '', prescricao: '' },
    { uid: 'e2', nome: 'Item fictício B', principioAtivo: '', concentracao: '', dose: '2 gotas', horario: 'Manhã', observacao: '', prescricao: '' },
    { uid: 'e3', nome: 'Item fictício C', principioAtivo: '', concentracao: '', dose: '1 dose', horario: 'Tarde', observacao: '', prescricao: '' },
  ],
};

const detalhe = (rascunho: ConteudoDieta, versao = 1): PlanoDetalhe<ConteudoDieta> => ({
  plano: {
    id: PLANO_ID, alunoId: ALUNO_ID, pastaId: null, titulo: 'Dieta fictícia', inicio: '2026-11-01', fim: '2026-11-30', ativo: true,
    versaoPublicada: 1, publicadoEm: '2026-11-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao,
  },
  rascunho,
  versoes: [{ id: 'v0000000-0000-4000-8000-0000000000c4', numero: 1, publicadoEm: '2026-11-01T12:00:00Z' }],
});

async function abrir(page: Page, { largura, permissoes = ['ERGOGENICO_LER', 'ERGOGENICO_ALTERAR'], conteudo = CONTEUDO }: { largura: number; permissoes?: string[]; conteudo?: ConteudoDieta }) {
  await page.setViewportSize({ width: largura, height: 1000 });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR', ...permissoes] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /alimentos': { corpo: [] },
    'GET /ergogenicos': { corpo: [] },
    'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /planos-dieta/${PLANO_ID}`]: { corpo: detalhe(conteudo) },
    [`PUT /planos-dieta/${PLANO_ID}/rascunho`]: { corpo: detalhe(conteudo, 2) },
  });
  await page.goto(`/treinador/dietas/${PLANO_ID}`);
  await expect(page.getByRole('heading', { name: 'Complementos' })).toBeVisible({ timeout: 30_000 });
  return api;
}

/**
 * Linhas de texto à vista no campo, sem meia linha: (altura − bordas − recuo de cima) ÷ linha quando rola (o recuo de
 * baixo sai, para não mostrar o começo da linha seguinte) ou (altura − bordas − recuos) ÷ linha quando cabe tudo.
 * Devolve fração se sobrar meia linha.
 */
async function linhasVisiveis(campo: Locator) {
  await expect.poll(() => campo.evaluate((e) => e.style.height !== '' && e.style.height !== 'auto')).toBe(true);
  return campo.evaluate((e) => {
    const cs = getComputedStyle(e);
    const px = (v: string) => parseFloat(v) || 0;
    const rola = e.scrollHeight > e.clientHeight + 1;
    const util = e.getBoundingClientRect().height - px(cs.borderTopWidth) - px(cs.borderBottomWidth) - px(cs.paddingTop) - (rola ? 0 : px(cs.paddingBottom));
    return Math.round((util / px(cs.lineHeight)) * 100) / 100;
  });
}

/** O cartão Complementos (a refeição aberta também tem "Nome" e "Horário"). */
const cartao = (page: Page) => page.getByTestId('cartao').filter({ has: page.getByRole('heading', { name: 'Complementos' }) });

const aba = (page: Page, nome: RegExp) => page.getByRole('tab', { name: nome });

/** Os nomes das orientações na ordem da tela (pelo nome acessível de cada linha). */
async function ordemDasOrientacoes(page: Page) {
  const nomes = await page.getByRole('button', { name: /^Orientação \d+ de \d+:/ }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
  return nomes.map((n) => n.replace(/^Orientação \d+ de \d+: /, '').replace(/[,.].*$/, ''));
}

async function arrastar(page: Page, alca: Locator, alvo: Locator) {
  await alca.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const de = (await alca.boundingBox())!;
  const y = (await alvo.boundingBox())!.y + 4;
  const x = de.x + de.width / 2;
  const y0 = de.y + de.height / 2;
  await page.mouse.move(x, y0);
  await page.mouse.down();
  for (let k = 1; k <= 10; k += 1) await page.mouse.move(x, y0 + ((y - y0) * k) / 10);
  await page.mouse.up();
}

for (const largura of [1280, 390]) {
  test(`complementos: abas com contagem e problema, aba lembrada ao salvar e ao trocar de refeição (${largura}px)`, async ({ page }) => {
    const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, { largura });
    // Contagens reais; Observações não conta; a orientação sem título e o suplemento sem dose avisam na própria aba.
    await expect(aba(page, /^Orientações \(3\), com aviso$/)).toHaveAttribute('aria-selected', 'true');
    await expect(aba(page, /^Observações$/)).toBeVisible();
    await expect(aba(page, /^Suplementação \(3\), com aviso$/)).toBeVisible();
    await expect(aba(page, /^Outros \(3\)$/)).toBeVisible();
    // Uma aba aberta por vez, na largura toda: só a lista das orientações está na tela.
    await expect(page.getByRole('button', { name: /^Orientação 1 de 3: Hidratação/ })).toBeVisible();
    await expect(page.getByLabel('Observações (opcional)')).toHaveCount(0);

    // Uma mudança (para o "Salvar rascunho" valer) e a aba Suplementação aberta.
    await aba(page, /^Observações$/).click();
    await page.getByLabel('Observações (opcional)').fill('Texto fictício.');
    await aba(page, /^Suplementação/).click();
    await expect(aba(page, /^Suplementação/)).toHaveAttribute('aria-selected', 'true');
    // Salvar não volta à primeira aba.
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect.poll(() => pedidos.filter((p) => p.metodo === 'PUT' && p.caminho.endsWith('/rascunho')).length).toBe(1);
    await expect(aba(page, /^Suplementação/)).toHaveAttribute('aria-selected', 'true');
    // Trocar de refeição também não.
    if (largura >= 1280) await page.getByRole('button', { name: /^Refeição 2 de 2: 12:00 · Almoço/ }).click();
    else await page.getByRole('button', { name: '12:00 · Almoço, fechado' }).click();
    await expect(aba(page, /^Suplementação/)).toHaveAttribute('aria-selected', 'true');
    // O corpo salvo leva os complementos como estavam (só a apresentação mudou).
    const put = pedidos.find((p) => p.metodo === 'PUT' && p.caminho.endsWith('/rascunho'));
    const salvo = (put?.corpo as { conteudo: ConteudoDieta }).conteudo;
    expect(salvo.orientacoes).toEqual(CONTEUDO.orientacoes);
    expect(salvo.suplementacao).toEqual(CONTEUDO.suplementacao);
    expect(salvo.ergogenicos).toEqual(CONTEUDO.ergogenicos);
    expect(salvo.observacoes).toBe('Texto fictício.');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('orientações: abre na linha, uma aberta por vez, reordena, exclui com Desfazer e a nova nasce aberta (1280px)', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, { largura: 1280 });
  expect(await ordemDasOrientacoes(page)).toEqual(['Hidratação', 'Preparo', 'sem título']);
  // Fechadas: o título e o começo do texto; nenhum campo.
  await expect(page.getByText('Beba água ao longo do dia', { exact: false })).toBeVisible();
  await expect(page.getByLabel(/^Título da orientação/)).toHaveCount(0);

  await page.getByRole('button', { name: /^Orientação 1 de 3: Hidratação/ }).click();
  await expect(page.getByRole('button', { name: /^Orientação 1 de 3: Hidratação/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel('Título da orientação 1')).toHaveValue('Hidratação');
  await page.getByLabel('Texto da orientação 1').fill('Texto fictício novo.');
  await expect(page.getByText('20/2.000')).toBeVisible();
  // Abrir outra fecha a primeira.
  await page.getByRole('button', { name: /^Orientação 2 de 3: Preparo/ }).click();
  await expect(page.getByLabel('Título da orientação 1')).toHaveCount(0);
  await expect(page.getByLabel('Título da orientação 2')).toHaveValue('Preparo');

  // Reordenar pelo ⋯ (o caminho do teclado): a aberta continua a mesma orientação, agora na posição 1.
  await page.getByRole('button', { name: 'Mais ações de Preparo' }).click();
  await page.getByRole('button', { name: /^Mover para cima/ }).click();
  expect(await ordemDasOrientacoes(page)).toEqual(['Preparo', 'Hidratação', 'sem título']);
  await expect(page.getByLabel('Título da orientação 1')).toHaveValue('Preparo');
  // E arrastando pela alça: a terceira vai para o topo.
  await arrastar(page, cartao(page).getByTestId('alca-de-arraste').nth(2), page.getByRole('button', { name: /^Orientação 1 de 3:/ }));
  await expect.poll(() => ordemDasOrientacoes(page)).toEqual(['sem título', 'Preparo', 'Hidratação']);

  // Excluir com Desfazer.
  await page.getByRole('button', { name: 'Mais ações de Hidratação' }).click();
  await page.getByRole('button', { name: /^Excluir orientação/ }).click();
  await expect(page.getByText('Orientação “Hidratação” removida.')).toBeVisible();
  await expect(aba(page, /^Orientações \(2\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Desfazer' }).first().click();
  await expect(aba(page, /^Orientações \(3\)/)).toBeVisible();

  // A nova nasce aberta, com o foco no título, e as outras fecham.
  await page.getByRole('button', { name: 'Adicionar orientação' }).click();
  await expect(page.getByLabel('Título da orientação 4')).toBeFocused();
  await expect(page.getByLabel('Título da orientação 1')).toHaveCount(0);
  await expect(aba(page, /^Orientações \(4\), com aviso$/)).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('observações: largura de leitura e contador de caracteres (1280px)', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, { largura: 1280 });
  await aba(page, /^Observações$/).click();
  const campo = page.getByLabel('Observações (opcional)');
  await expect(campo).toHaveValue('Evite frituras.');
  await expect(page.getByLabel('15 de 8.000 caracteres')).toBeVisible();
  await campo.fill('Texto fictício.');
  await expect(page.getByText('15/8.000')).toBeVisible();
  // ~72 caracteres: bem mais estreito que o cartão em 1280.
  const largura = (await campo.boundingBox())!.width;
  expect(largura).toBeLessThan(720);
  expect(largura).toBeGreaterThan(480);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('suplementação em tabela: cabeçalho uma vez, nome em duas linhas, link, ⋯ e os dois botões (1280px)', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, { largura: 1280 });
  await aba(page, /^Suplementação/).click();
  for (const titulo of ['Suplemento', 'Dose prescrita', 'Horário', 'Observação']) await expect(cartao(page).getByText(titulo, { exact: true })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: /^#1 ·/ })).toHaveCount(0);
  // O nome quebra em até duas linhas (o que passar rola no campo), sem a alça de redimensionar; o curto fica em uma.
  const nome = page.getByLabel('Nome do suplemento 1');
  await expect(nome).toHaveValue(NOME_LONGO);
  expect(await nome.evaluate((el) => [el.tagName, getComputedStyle(el).resize])).toEqual(['TEXTAREA', 'none']);
  expect(await linhasVisiveis(nome)).toBe(2);
  expect(Math.round((await page.getByLabel('Nome do suplemento 2').boundingBox())!.height)).toBe(44);
  // Link: só no que tem, ao lado do nome; cupom à vista embaixo; o que falta avisa na linha.
  await expect(page.getByRole('button', { name: /^Abrir produto/ })).toHaveCount(1);
  await expect(page.getByText('TESTE10')).toBeVisible();
  await expect(page.getByText('Falta a dose')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Suplemento da biblioteca' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Suplemento manual' })).toBeVisible();

  // ⋯: Tirar link e Tirar cupom.
  await page.getByRole('button', { name: `Mais ações de ${NOME_LONGO}` }).click();
  await page.getByRole('button', { name: /^Tirar link/ }).click();
  await expect(page.getByRole('button', { name: /^Abrir produto/ })).toHaveCount(0);
  await expect(page.getByText('TESTE10')).toBeVisible();

  // Reordenar arrastando: o terceiro vai para o topo.
  await arrastar(page, cartao(page).getByTestId('alca-de-arraste').nth(2), page.getByLabel('Nome do suplemento 1'));
  await expect(page.getByLabel('Nome do suplemento 1')).toHaveValue('Ômega fictício');
  await page.getByRole('button', { name: 'Desfazer' }).first().click();
  await expect(page.getByLabel('Nome do suplemento 1')).toHaveValue(NOME_LONGO);

  // Excluir com Desfazer.
  await page.getByRole('button', { name: 'Mais ações de Whey fictício' }).click();
  await page.getByRole('button', { name: /^Excluir suplemento/ }).click();
  await expect(page.getByText('Suplemento “Whey fictício” removido.')).toBeVisible();
  await expect(aba(page, /^Suplementação \(2\)$/)).toBeVisible();
  await page.getByRole('button', { name: 'Desfazer' }).first().click();
  await expect(aba(page, /^Suplementação \(3\), com aviso$/)).toBeVisible();

  // Manual: linha nova com o foco no nome.
  await page.getByRole('button', { name: 'Suplemento manual' }).click();
  await expect(page.getByLabel('Nome do suplemento 4')).toBeFocused();
  await expect(page.getByText('Falta o nome')).toHaveCount(1);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

// 26/11: sem o teto de 1400 nos Complementos; colunas proporcionais (Suplemento 28%, Dose 12% e Horário 10% com teto,
// Observação com o resto); nome e observação inteiros em até duas linhas; Orientações em largura de leitura.
for (const largura of [1920, 3440]) {
  test(`suplementação sem teto, colunas proporcionais e texto inteiro em duas linhas (${largura}px)`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, { largura, conteudo: {
      ...CONTEUDO,
      suplementacao: CONTEUDO.suplementacao.map((s, i) => (i === 0 ? { ...s, observacao: 'Misturar em 200 ml de água, todos os dias, inclusive nos dias sem treino.' } : s)),
    } });
    const lista = page.getByRole('group', { name: 'Orientações da dieta' });
    expect((await lista.boundingBox())!.width).toBeLessThan(720);
    await aba(page, /^Suplementação/).click();
    const tabela = (await page.getByRole('group', { name: 'Suplementação da dieta' }).boundingBox())!.width;
    expect(tabela).toBeGreaterThan(1400);
    const celula = async (rotulo: string) => (await cartao(page).getByText(rotulo, { exact: true }).locator('..').boundingBox())!.width;
    const linha = tabela - 2 * 9; // a faixa tem 1 px de borda e 8 de recuo de cada lado
    expect(Math.abs((await celula('Suplemento')) - linha * 0.28)).toBeLessThan(2);
    expect(Math.abs((await celula('Dose prescrita')) - Math.min(240, linha * 0.12))).toBeLessThan(2);
    expect(Math.abs((await celula('Horário')) - Math.min(200, linha * 0.1))).toBeLessThan(2);
    expect(await celula('Observação')).toBeGreaterThan(linha * 0.4);
    for (const campo of ['Nome do suplemento 1', 'Observação do suplemento 1']) {
      const el = page.getByLabel(campo);
      expect(await el.evaluate((e) => [e.tagName, getComputedStyle(e).resize, e.scrollHeight <= e.clientHeight + 1])).toEqual(['TEXTAREA', 'none', true]);
    }
    expect(await page.getByLabel('Observação do suplemento 2').evaluate((e) => (e as HTMLTextAreaElement).rows)).toBe(1);
    // Linha de uma linha só: os quatro campos com a mesma altura (o texto na mesma linha de base).
    const alturas = new Set<number>();
    for (const campo of ['Nome', 'Dose prescrita', 'Horário', 'Observação']) alturas.add(Math.round((await page.getByLabel(`${campo} do suplemento 3`).boundingBox())!.height));
    expect(alturas.size).toBe(1);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

// 26/11: Outros sem teto, com as colunas da Suplementação: Dose e Horário até o teto (240 e 200) e o Nome com o resto;
// em "Mais detalhes", princípio ativo, concentração e prescrição com teto e a Observação com o resto. Nada se sobrepõe.
const OUTROS_LONGOS: NonNullable<ConteudoDieta['ergogenicos']> = [
  { uid: 'e1', nome: 'Medicação fictícia de uso contínuo com nome bem comprido para testar a coluna', principioAtivo: 'Substância fictícia', concentracao: '10 mg', dose: '1 cápsula', horario: 'Noite', prescricao: 'Receita fictícia',
    observacao: 'Tomar depois do jantar, com bastante água, e não junto com o café; parar se houver qualquer desconforto e avisar.' },
  { uid: 'e2', nome: 'Item curto', principioAtivo: '', concentracao: '', dose: '2 gotas', horario: 'Manhã', observacao: '', prescricao: '' },
];

/** Caixas dos campos (pelo rótulo exato) de um item de Outros, na ordem da linha. */
async function caixasDoItem(page: Page, indice: number, rotulos: string[]) {
  const caixas = [];
  for (const r of rotulos) caixas.push((await cartao(page).getByLabel(r, { exact: true }).nth(indice).boundingBox())!);
  return caixas;
}

function semSobreposicao(caixas: { x: number; y: number; width: number }[]) {
  for (let k = 1; k < caixas.length; k += 1) {
    expect(Math.abs(caixas[k].y - caixas[0].y)).toBeLessThan(2); // a mesma linha
    expect(caixas[k - 1].x + caixas[k - 1].width).toBeLessThanOrEqual(caixas[k].x + 1);
  }
}

for (const largura of [1920, 3440]) {
  test(`outros sem teto: Dose e Horário até o teto, Nome e Observação com o resto, sem sobreposição (${largura}px)`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, { largura, conteudo: { ...CONTEUDO, ergogenicos: OUTROS_LONGOS } });
    await aba(page, /^Outros/).click();
    await expect(page.getByRole('heading', { name: /^#1 · Medicação fictícia/ })).toBeVisible();
    for (const i of [0, 1]) {
      const [nome, dose, horario] = await caixasDoItem(page, i, ['Nome', 'Dose prescrita', 'Horário']);
      semSobreposicao([nome, dose, horario]);
      expect(dose.width).toBeGreaterThanOrEqual(120);
      expect(dose.width).toBeLessThanOrEqual(241);
      expect(horario.width).toBeGreaterThanOrEqual(104);
      expect(horario.width).toBeLessThanOrEqual(201);
      expect(nome.width).toBeGreaterThan(dose.width + horario.width);
      // Sem o teto de 1400: a linha vai na largura toda.
      expect(horario.x + horario.width - nome.x).toBeGreaterThan(1400);
    }
    await page.getByRole('button', { name: 'Mais detalhes (princípio ativo, concentração, observação)' }).first().click();
    const [principio, concentracao, prescricao, observacao] = await caixasDoItem(page, 0, ['Princípio ativo', 'Concentração', 'Prescrição (opcional)', 'Observação']);
    semSobreposicao([principio, concentracao, prescricao, observacao]);
    expect(principio.width).toBeLessThanOrEqual(321);
    expect(concentracao.width).toBeLessThanOrEqual(241);
    expect(prescricao.width).toBeLessThanOrEqual(321);
    expect(observacao.width).toBeGreaterThan(principio.width + concentracao.width + prescricao.width);
    // Nome e observação longos inteiros em até duas linhas, sem a alça de redimensionar (o campo da Suplementação).
    for (const rotulo of ['Nome', 'Observação']) {
      const el = cartao(page).getByLabel(rotulo, { exact: true }).first();
      expect(await el.evaluate((e) => [e.tagName, getComputedStyle(e).resize, e.scrollHeight <= e.clientHeight + 1])).toEqual(['TEXTAREA', 'none', true]);
    }
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

// 26/11 (fechamento): nas colunas estreitas o campo de uma linha nascia com duas ("Pré-treino" em 104 px, a conta de
// caracteres era folgada demais), a observação de três linhas parava em duas e meia e, na grade de 654 px, o nome e a
// observação cortavam. Agora a altura vem do texto medido: uma linha = 44 (alinhada na linha), o texto longo inteiro.
const OUTROS_ESTREITOS: NonNullable<ConteudoDieta['ergogenicos']> = [
  ...OUTROS_LONGOS,
  { uid: 'e3', nome: 'Ergogênico fictício', principioAtivo: 'Composto fictício', concentracao: '5 mg/ml', dose: '0,5 ml', horario: 'Pré-treino', observacao: 'Só nos dias de treino.', prescricao: '' },
];

for (const [janela, modo] of [[1000, 'colunas'], [898, 'colunas'], [720, 'grade']] as const) {
  test(`outros estreito: campo de uma linha com 44 px e alinhado, texto longo inteiro (janela ${janela}px, ${modo})`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, { largura: janela, conteudo: { ...CONTEUDO, ergogenicos: OUTROS_ESTREITOS } });
    await aba(page, /^Outros/).click();
    const detalhes = page.getByRole('button', { name: 'Mais detalhes (princípio ativo, concentração, observação)' });
    await detalhes.nth(0).click();
    await detalhes.nth(2).click();
    const campo = (rotulo: string, n: number) => cartao(page).getByLabel(rotulo, { exact: true }).nth(n);
    // Item 3: tudo cabe numa linha, então os campos medem 44 e ficam na mesma altura (os da mesma linha da grade também).
    for (const [rotulos, n] of [[['Nome', 'Dose prescrita', 'Horário'], 2], [['Princípio ativo', 'Concentração', 'Prescrição (opcional)', 'Observação'], 1]] as const) {
      const caixas = [];
      for (const r of rotulos) {
        await expect.poll(async () => Math.round((await campo(r, n).boundingBox())!.height)).toBe(44);
        caixas.push((await campo(r, n).boundingBox())!);
      }
      if (modo === 'colunas') semSobreposicao(caixas);
    }
    // Item 1: nome e observação longos inteiros, em linhas inteiras (sem meia linha), sem rolar.
    for (const rotulo of ['Nome', 'Observação']) {
      const el = campo(rotulo, 0);
      expect(await linhasVisiveis(el)).toBeGreaterThanOrEqual(2);
      expect(Number.isInteger(await linhasVisiveis(el))).toBe(true);
      expect(await el.evaluate((e) => [e.tagName, getComputedStyle(e).resize, e.scrollHeight <= e.clientHeight + 1])).toEqual(['TEXTAREA', 'none', true]);
    }
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('outros no celular: a grade que quebra, um campo por linha (390px)', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, { largura: 390, conteudo: { ...CONTEUDO, ergogenicos: OUTROS_LONGOS } });
  await aba(page, /^Outros/).click();
  const [nome, dose, horario] = await caixasDoItem(page, 0, ['Nome', 'Dose prescrita', 'Horário']);
  expect(dose.y).toBeGreaterThan(nome.y + nome.height - 1);
  expect(horario.y).toBeGreaterThan(dose.y + dose.height - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

// 26/11: a cópia saía deslocada (para cima e para o lado) em relação à linha. Agora sai exatamente sobre ela e anda o
// mesmo que o ponteiro desde o ponto de pega, também depois de reordenar.
test('suplementação: a sombra do arraste sai sobre a linha e acompanha o ponteiro (1280px)', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, { largura: 1280 });
  await aba(page, /^Suplementação/).click();
  const alca = cartao(page).getByTestId('alca-de-arraste').nth(1);
  await conferirSombra(page, alca, { x: 9, y: 7 }, { x: 40, y: -60 });
  await conferirSombra(page, cartao(page).getByTestId('alca-de-arraste').nth(2), { x: -6, y: -8 }, { x: -30, y: -50 });
  // Depois de reordenar, o arraste pega a linha certa (antes, a do índice em que ela nasceu: a sombra saía em outra linha).
  await arrastar(page, cartao(page).getByTestId('alca-de-arraste').nth(2), page.getByLabel('Nome do suplemento 1'));
  await expect(page.getByLabel('Nome do suplemento 1')).toHaveValue('Ômega fictício');
  await conferirSombra(page, cartao(page).getByTestId('alca-de-arraste').nth(0), { x: 7, y: 9 }, { x: 20, y: 70 });
  await conferirSombra(page, cartao(page).getByTestId('alca-de-arraste').nth(2), { x: 5, y: -9 }, { x: 15, y: -40 });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('suplementação no celular: cartão compacto que abre ao tocar, um aberto por vez (390px)', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, { largura: 390 });
  await aba(page, /^Suplementação/).click();
  // Sem cabeçalho de tabela; nome em cima, dose · horário embaixo.
  await expect(cartao(page).getByText('Dose prescrita', { exact: true })).toHaveCount(0);
  const primeiro = page.getByRole('button', { name: new RegExp(`^Suplemento 1 de 3: ${NOME_LONGO}, 3 g · Manhã`) });
  await expect(primeiro).toBeVisible();
  await expect(page.getByText('1 cápsula · Almoço')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Abrir produto/ })).toHaveCount(1);
  // Nada sai da janela (sem rolagem horizontal).
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await primeiro.click();
  await expect(page.getByLabel('Dose prescrita do suplemento 1')).toHaveValue('3 g');
  await page.getByRole('button', { name: /^Suplemento 2 de 3: Whey fictício/ }).click();
  await expect(page.getByLabel('Dose prescrita do suplemento 1')).toHaveCount(0);
  await page.getByLabel('Dose prescrita do suplemento 2').fill('30 g');
  await expect(aba(page, /^Suplementação \(3\)$/)).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('permissões: sem ERGOGENICO_LER não há a aba Outros; só com LER, Outros é só leitura (1280px)', async ({ page }) => {
  const primeira = await abrir(page, { largura: 1280, permissoes: [], conteudo: { ...CONTEUDO, ergogenicos: null } });
  await expect(aba(page, /^Outros/)).toHaveCount(0);
  await expect(aba(page, /^Suplementação/)).toBeVisible();
  expect(primeira.naoTratadas).toEqual([]);
});

test('permissões: com ERGOGENICO_LER sem ALTERAR, Outros sem ações nem edição (1280px)', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, { largura: 1280, permissoes: ['ERGOGENICO_LER'] });
  await aba(page, /^Outros/).click();
  await expect(page.getByText('Seu perfil só pode ler esta lista.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Remover Item fictício/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Ergogênico/ })).toHaveCount(0);
  await expect(cartao(page).getByLabel('Nome', { exact: true }).first()).not.toBeEditable();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
