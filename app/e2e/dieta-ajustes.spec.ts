import { expect, test, type Page } from '@playwright/test';

import type { ConteudoDieta, ItemDieta, PlanoDetalhe, Receita } from '../src/api/tipos';
import { MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Ajustes do editor de dieta (04/11): observação e modo de preparo vazios recolhidos num link, unidade do alimento numa
 * lista suspensa ao lado da quantidade, "Adicionar refeição" só no pé da lista (duas colunas) e no topo (uma coluna), cada linha de
 * Suplementação e de "Outros" num sub-cartão "#N · Nome" com a lixeira, "Mais detalhes" em "Outros" e o modelo de uma
 * refeição só sem complementos, sem duas colunas e sem "Salvar como modelo de refeição". Só dados fictícios.
 */
const PLANO_ID = 'p0000000-0000-4000-8000-0000000000a1';
const ALUNO_ID = 'a0000000-0000-4000-8000-0000000000a2';
const MODELO_ID = 'm0000000-0000-4000-8000-0000000000a3';

const item = (uid: string, nome: string, unidade: ItemDieta['unidade']): ItemDieta =>
  ({ uid, alimentoId: null, nome, quantidade: 100, unidade, kcal: 120, proteina: 5, carboidrato: 20, gordura: 2, manual: false });

const CONTEUDO: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, aguaLitros: null, variacoes: [],
  refeicoes: [
    { uid: 'cafe', nome: 'Café da manhã', horario: '07:00', observacao: null, modoDePreparo: null, opcoes: [
      { uid: 'ca', rotulo: 'A', itens: [item('pao', 'Pão fictício', 'g'), item('leite', 'Leite fictício', 'ml')] },
      { uid: 'cb', rotulo: 'B', itens: [item('fruta', 'Fruta fictícia', 'un')] },
    ] },
    { uid: 'almoco', nome: 'Almoço', horario: '12:00', observacao: null, modoDePreparo: 'Grelhe sem óleo.', opcoes: [
      { uid: 'aa', rotulo: 'A', itens: [item('arroz', 'Arroz fictício', 'g')] },
    ] },
  ],
  suplementacao: [
    { uid: 's1', nome: 'Creatina fictícia', dose: '3 g', horario: 'Manhã', observacao: '', link: null, cupom: null },
    { uid: 's2', nome: '', dose: '', horario: '', observacao: '', link: null, cupom: null },
  ],
  ergogenicos: [
    { uid: 'e1', nome: 'Item fictício A', principioAtivo: 'Substância fictícia', concentracao: '10 mg', dose: '1 cápsula', horario: 'Noite', observacao: '', prescricao: '' },
    { uid: 'e2', nome: 'Item fictício B', principioAtivo: '', concentracao: '', dose: '2 gotas', horario: 'Manhã', observacao: '', prescricao: '' },
  ],
};

const DETALHE: PlanoDetalhe<ConteudoDieta> = {
  plano: {
    id: PLANO_ID, alunoId: ALUNO_ID, pastaId: null, titulo: 'Dieta fictícia', inicio: '2026-11-01', fim: '2026-11-30', ativo: true,
    versaoPublicada: 1, publicadoEm: '2026-11-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho: CONTEUDO,
  versoes: [{ id: 'v0000000-0000-4000-8000-0000000000a4', numero: 1, publicadoEm: '2026-11-01T12:00:00Z' }],
};

async function tema(page: Page, escuro: boolean) {
  if (!escuro) return;
  await page.addInitScript(([id]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), [TREINADOR.id]);
}

/** Captura (só com `CAPTURAS`): a tela alta, com o alvo rolado para o topo. */
async function capturar(page: Page, nome: string, alvo?: ReturnType<Page['getByRole']>) {
  const pasta = process.env.CAPTURAS;
  if (!pasta) return;
  const { width } = page.viewportSize() ?? { width: 1280 };
  await page.setViewportSize({ width, height: 1400 });
  if (alvo) await alvo.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: `${pasta}/${nome}.png` });
}

for (const [largura, escuro] of [[1280, false], [1280, true], [390, false], [390, true]] as const) {
  const sufixo = `${largura}${escuro ? '-escuro' : '-claro'}`;
  test(`dieta: campos recolhidos, unidade compacta, adicionar no pé da lista e sub-cartões (${sufixo})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    await tema(page, escuro);
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR', 'ERGOGENICO_LER', 'ERGOGENICO_ALTERAR'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /alimentos': { corpo: [] },
      'GET /ergogenicos': { corpo: [] },
      'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
      [`GET /planos-dieta/${PLANO_ID}`]: { corpo: DETALHE },
    });
    await page.goto(`/treinador/dietas/${PLANO_ID}`);
    await expect(page.getByRole('heading', { name: 'Refeições (2)' })).toBeVisible();
    const duas = largura >= 1280;
    const adicionar = page.getByRole('button', { name: 'Adicionar refeição' });
    if (duas) {
      // Em duas colunas só no pé da lista: abaixo do último item e à esquerda do inspetor.
      await expect(adicionar).toHaveCount(1);
      const ultimo = await page.getByRole('button', { name: /^Refeição 2 de 2: 12:00 · Almoço/ }).boundingBox();
      const pe = await adicionar.boundingBox();
      const inspetor = await page.getByRole('heading', { name: '07:00 · Café da manhã', level: 3 }).boundingBox();
      if (!ultimo || !pe || !inspetor) throw new Error('sem caixa');
      expect(pe.y).toBeGreaterThan(ultimo.y + ultimo.height - 1);
      expect(pe.x + pe.width).toBeLessThan(inspetor.x);
    } else {
      await expect(adicionar).toHaveCount(1);
      await page.getByRole('button', { name: '07:00 · Café da manhã, fechado' }).click();
    }

    // Café da manhã: sem observação nem modo de preparo, só o link; o toque abre os dois campos.
    const extras = page.getByRole('button', { name: 'Observação ou modo de preparo (opcional)' });
    await expect(extras).toBeVisible();
    await expect(page.getByLabel('Modo de preparo (opcional)', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Observação (opcional)', { exact: true })).toHaveCount(0);

    // Unidade: a atual ao lado da quantidade, numa lista suspensa; nenhum chip de unidade.
    await expect(page.getByRole('button', { name: 'Unidade: g. Escolher.' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Unidade: ml. Escolher.' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Unidade: un. Escolher.' })).toHaveCount(1);
    await expect(page.getByRole('radio', { name: 'ml' })).toHaveCount(0);
    const [a, b] = [await page.getByRole('heading', { name: 'Opção A' }).boundingBox(), await page.getByRole('heading', { name: 'Opção B' }).boundingBox()];
    if (!a || !b) throw new Error('sem opção');
    if (duas) expect(Math.abs(a.y - b.y)).toBeLessThan(2);
    const [qtd, unidade] = [await page.getByLabel('Quantidade', { exact: true }).first().boundingBox(), await page.getByRole('button', { name: 'Unidade: g. Escolher.' }).boundingBox()];
    if (!qtd || !unidade) throw new Error('sem campo');
    expect(unidade.x).toBeGreaterThan(qtd.x + qtd.width - 1);
    expect(Math.abs(unidade.y + unidade.height - (qtd.y + qtd.height))).toBeLessThan(12);
    await capturar(page, `refeicao-${sufixo}`, page.getByRole('heading', { name: 'Refeições (2)' }));

    await extras.click();
    await expect(page.getByLabel('Observação (opcional)', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Modo de preparo (opcional)', { exact: true })).toBeVisible();
    await expect(extras).toHaveCount(0);

    // Almoço: nasce fechado também com modo de preparo gravado (18/11); o link abre os campos e o texto está lá.
    if (duas) await page.getByRole('button', { name: /^Refeição 2 de 2: 12:00 · Almoço/ }).click();
    else await page.getByRole('button', { name: '12:00 · Almoço, fechado' }).click();
    // (empilhado, o Café segue aberto com os campos dele; em duas colunas ele saiu do inspetor)
    await expect(page.getByLabel('Modo de preparo (opcional)', { exact: true })).toHaveCount(duas ? 0 : 1);
    await page.getByRole('button', { name: 'Observação ou modo de preparo (opcional)' }).click();
    await expect(page.getByLabel('Modo de preparo (opcional)', { exact: true }).last()).toHaveValue('Grelhe sem óleo.');

    // Complementos nascem fechados, mesmo com conteúdo (18/11): só os títulos; cada um abre no toque.
    await expect(page.getByRole('heading', { name: '#1 · Creatina fictícia' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '#1 · Item fictício A' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Suplementação, recolhido' }).click();
    await page.getByRole('button', { name: 'Outros (medicação e ergogênicos), recolhido' }).click();

    // Suplementação: um sub-cartão por linha, "#N · Nome" e a lixeira no canto.
    await expect(page.getByRole('heading', { name: '#1 · Creatina fictícia' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '#2 · Sem nome' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remover Creatina fictícia' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remover linha' })).toBeVisible();
    await capturar(page, `suplementacao-${sufixo}`, page.getByRole('heading', { name: 'Suplementação' }));

    // Outros: nome, dose e horário à vista; "Mais detalhes" nasce fechado em todos os itens, também no que tem princípio ativo.
    await expect(page.getByRole('heading', { name: '#1 · Item fictício A' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remover Item fictício A' })).toBeVisible();
    const detalhes = page.getByRole('button', { name: 'Mais detalhes (princípio ativo, concentração, observação)' });
    await expect(detalhes).toHaveCount(2);
    await expect(detalhes.first()).toHaveAttribute('aria-expanded', 'false');
    await expect(detalhes.last()).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByLabel('Princípio ativo', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Dose prescrita', { exact: true })).toHaveCount(4);
    await detalhes.first().click();
    await expect(page.getByLabel('Princípio ativo', { exact: true })).toHaveCount(1);
    await expect(page.getByLabel('Princípio ativo', { exact: true })).toHaveValue('Substância fictícia');
    await capturar(page, `outros-${sufixo}`, page.getByRole('heading', { name: 'Outros (medicação e ergogênicos)' }));
    await detalhes.last().click();
    await expect(page.getByLabel('Princípio ativo', { exact: true })).toHaveCount(2);

    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

const MODELO: Receita = {
  id: MODELO_ID, tipo: 'REFEICAO', nome: 'Lanche fictício', descricao: null, pastaId: null, ordem: 1, versao: 1,
  conteudo: { ...CONTEUDO, suplementacao: [], ergogenicos: null, refeicoes: [CONTEUDO.refeicoes[0]] },
};

for (const [largura, escuro] of [[1280, false], [1280, true], [390, false], [390, true]] as const) {
  const sufixo = `${largura}${escuro ? '-escuro' : '-claro'}`;
  test(`modelo de refeição: só a refeição, aberta em largura total, sem complementos nem "Salvar como" (${sufixo})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    await tema(page, escuro);
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] })),
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /alimentos': { corpo: [] },
      [`GET /receitas/${MODELO_ID}`]: { corpo: MODELO },
    });
    await page.goto(`/treinador/planejamento/modelo/${MODELO_ID}`);
    await expect(page.getByRole('heading', { name: 'Refeições (1)' })).toBeVisible();
    // A refeição já está aberta (sem lista ao lado nem cartão para abrir).
    await expect(page.getByRole('textbox', { name: 'Nome' }).last()).toHaveValue('Café da manhã');
    await expect(page.getByRole('group', { name: 'Refeições do plano' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Refeição 1 de 1/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Complementos' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Suplementação' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Orientações' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Salvar como modelo de refeição' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Adicionar refeição' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Observação ou modo de preparo (opcional)' })).toBeVisible();
    await capturar(page, `modelo-refeicao-${sufixo}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

// ---- C59: "Data de início" fora do modelo de dieta; a dieta do aluno mantém o campo ----

const MODELO_DIETA: Receita = {
  id: MODELO_ID, tipo: 'PLANO_DIETA', nome: 'Dieta fictícia padrão', descricao: null, pastaId: null, ordem: 1, versao: 1,
  // Data antiga no modelo gravado: ao salvar de novo ela sai (o modelo aplicado não a leva para o aluno).
  conteudo: { ...CONTEUDO, dataInicio: '2026-10-01', suplementacao: [], ergogenicos: null },
};

for (const largura of [390, 1280]) {
  test(`modelo de dieta sem "Data de início" e dieta do aluno com o campo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR', 'DIETA_LER', 'DIETA_ALTERAR'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /alimentos': { corpo: [] },
      'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
      [`GET /receitas/${MODELO_ID}`]: { corpo: MODELO_DIETA },
      [`PUT /receitas/${MODELO_ID}/conteudo`]: { corpo: { ...MODELO_DIETA, versao: 2 } },
      [`GET /planos-dieta/${PLANO_ID}`]: { corpo: DETALHE },
    });

    // Modelo: o objetivo e o profissional ficam; a data de início não existe e a antiga não é regravada.
    await page.goto(`/treinador/planejamento/modelo/${MODELO_ID}`);
    await expect(page.getByRole('heading', { name: 'Refeições (2)' })).toBeVisible();
    await page.getByRole('button', { name: /Configuração do plano/ }).click();
    await expect(page.getByLabel('Profissional (opcional)')).toBeVisible();
    await expect(page.getByText('Data de início (opcional)')).toHaveCount(0);
    await page.getByLabel('Objetivo (opcional)').fill('Objetivo fictício');
    await page.getByRole('button', { name: 'Salvar modelo' }).click();
    await expect.poll(() => pedidos.filter((p) => p.metodo === 'PUT' && p.caminho.endsWith('/conteudo')).length).toBe(1);
    const modelo = pedidos.find((p) => p.metodo === 'PUT' && p.caminho.endsWith('/conteudo'));
    expect((modelo?.corpo as { conteudo: ConteudoDieta }).conteudo.dataInicio).toBeNull();

    // Dieta do aluno: o campo continua.
    await page.goto(`/treinador/dietas/${PLANO_ID}`);
    await expect(page.getByRole('heading', { name: 'Refeições (2)' })).toBeVisible();
    await page.getByRole('button', { name: /Configuração do plano/ }).click();
    await expect(page.getByText('Data de início (opcional)')).toBeVisible();
    await expect(page.getByLabel('Profissional (opcional)')).toBeVisible();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

// ---- C57: refeição sem nome é gravada como "Refeição N" ----

for (const largura of [390, 1280]) {
  test(`refeição sem nome vai ao rascunho como "Refeição N", também ao apagar o nome (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
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

    // Refeição nova, sem digitar o nome: o rascunho já leva "Refeição 3" (o validador recusa nome vazio na publicação).
    await page.getByRole('button', { name: 'Adicionar refeição' }).click();
    await expect(page.getByRole('heading', { name: 'Refeições (3)' })).toBeVisible();
    // A refeição nova é a única aberta; a Suplementação, mais abaixo, também tem campos "Nome".
    const nome = page.getByRole('textbox', { name: 'Nome', exact: true }).first();
    await expect(nome).toHaveValue('Refeição 3');

    // Apagar o nome não preenche na hora (dá para digitar outro); ao sair do campo, volta "Refeição 3".
    await nome.fill('');
    await expect(nome).toHaveValue('');
    await nome.blur();
    await expect(nome).toHaveValue('Refeição 3');

    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect.poll(() => pedidos.filter((p) => p.metodo === 'PUT' && p.caminho.endsWith('/rascunho')).length).toBe(1);
    const put = pedidos.find((p) => p.metodo === 'PUT' && p.caminho.endsWith('/rascunho'));
    expect((put?.corpo as { conteudo: ConteudoDieta }).conteudo.refeicoes.map((r) => r.nome)).toEqual(['Café da manhã', 'Almoço', 'Refeição 3']);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

// ---- C49: unidade sem conversão avisa o que falta, sem inventar valor ----

const FARINHA = { id: 'f0000000-0000-4000-8000-0000000000a5', nome: 'Farinha fictícia', baseQuantidade: 100, baseUnidade: 'g', kcal: 360, proteina: 10, carboidrato: 70, gordura: 1, gramasPorUnidade: null, fonte: null, origem: 'MANUAL', fatorCorrecao: null, fatorCoccao: null, grupo: null } as const;

for (const largura of [390, 1280]) {
  test(`item em "un" de alimento sem gramas por unidade avisa o que falta e o valor continua "—" (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    const conteudo: ConteudoDieta = {
      ...CONTEUDO, suplementacao: [], ergogenicos: null,
      refeicoes: [{ uid: 'lanche', nome: 'Lanche', horario: null, observacao: null, modoDePreparo: null, opcoes: [{ uid: 'la', rotulo: 'A', itens: [
        { uid: 'farinha', alimentoId: FARINHA.id, nome: FARINHA.nome, quantidade: 2, unidade: 'un', kcal: null, proteina: null, carboidrato: null, gordura: null, manual: false },
        { uid: 'manual', alimentoId: null, nome: 'Item manual fictício', quantidade: 1, unidade: 'un', kcal: 50, proteina: 1, carboidrato: 1, gordura: 1, manual: true },
      ] }] }],
    };
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /alimentos': { corpo: [FARINHA] },
      'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
      [`GET /planos-dieta/${PLANO_ID}`]: { corpo: { ...DETALHE, rascunho: conteudo } },
    });
    await page.goto(`/treinador/dietas/${PLANO_ID}`);
    await expect(page.getByRole('heading', { name: 'Refeições (1)' })).toBeVisible();
    // A refeição única nasce aberta (18/11: uma seção só abre sozinha), sem o clique que o celular pedia.
    await expect(page.getByRole('button', { name: 'Lanche, fechado' })).toHaveCount(0);

    // Só o item da biblioteca sem conversão leva o aviso (o manual não); o aviso fica dentro da janela e não corta.
    const aviso = page.getByText('Informe gramas por unidade no alimento');
    await expect(aviso).toHaveCount(1);
    await expect(aviso).toBeVisible();
    const caixa = (await aviso.boundingBox())!;
    expect(caixa.x).toBeGreaterThanOrEqual(0);
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(largura + 0.5);
    // Nenhum valor é inventado: a linha do item continua com "—" nos valores.
    await expect(page.getByLabel('Total da opção A')).toBeVisible();
    const linha = page.locator('div', { has: page.getByText(FARINHA.nome, { exact: true }) }).filter({ has: page.getByLabel('Quantidade', { exact: true }) }).last();
    await expect(linha.getByText('—').first()).toBeVisible();
    await expect(linha.getByText('360')).toHaveCount(0);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

// ---- C61: "Adicionar refeição" leva a tela até a refeição nova ----

for (const [largura, altura] of [[390, 844], [1280, 720]] as const) {
  test(`adicionar refeição rola até o campo Nome da refeição nova (${largura}×${altura})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: altura });
    const conteudo: ConteudoDieta = {
      ...CONTEUDO,
      refeicoes: [...CONTEUDO.refeicoes, { uid: 'jantar', nome: 'Jantar', horario: '20:00', observacao: null, modoDePreparo: null, opcoes: [
        { uid: 'ja', rotulo: 'A', itens: [item('sopa', 'Sopa fictícia', 'g')] },
      ] }],
    };
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /alimentos': { corpo: [] },
      'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
      [`GET /planos-dieta/${PLANO_ID}`]: { corpo: { ...DETALHE, rascunho: conteudo } },
    });
    await page.goto(`/treinador/dietas/${PLANO_ID}`);
    await expect(page.getByRole('heading', { name: 'Refeições (3)' })).toBeVisible();
    const adicionar = page.getByRole('button', { name: 'Adicionar refeição' });
    // O botão na borda de baixo da janela: é onde a pessoa está ao tocar, e a refeição nova nasce logo abaixo dele.
    // Clique pelo mouse na posição, sem o auto-rolar do `click()` do Playwright (que já centralizaria o botão e esconderia o defeito).
    await adicionar.evaluate((el) => el.scrollIntoView({ block: 'end' }));
    const ponto = (await adicionar.boundingBox())!;
    await page.mouse.click(ponto.x + ponto.width / 2, ponto.y + ponto.height / 2);
    await expect(page.getByRole('heading', { name: 'Refeições (4)' })).toBeVisible();
    const nome = page.getByRole('textbox', { name: 'Nome', exact: true }).first();
    await expect(nome).toHaveValue('Refeição 4');
    // A tela andou até a refeição nova: o cartão começa logo abaixo da barra grudada, como o exercício aberto do treino
    // (sem o conserto o cartão ficava onde nasceu, com o campo Nome colado na borda de baixo). A rolagem é assíncrona: poll.
    const cartao = page.locator('[id^="refeicao-"]').last();
    const folgaSobAbarra = async () => {
      const [c, barra] = [await cartao.boundingBox(), await page.locator('#barra-do-editor').boundingBox()];
      return c && barra ? Math.round(c.y - (barra.y + barra.height)) : null;
    };
    await expect.poll(folgaSobAbarra).toBeLessThanOrEqual(24);
    expect(await folgaSobAbarra()).toBeGreaterThanOrEqual(0);
    // E o campo Nome inteiro dentro da janela.
    const caixa = (await nome.boundingBox())!;
    expect(caixa.y).toBeGreaterThanOrEqual(0);
    expect(caixa.y + caixa.height).toBeLessThanOrEqual(altura);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
