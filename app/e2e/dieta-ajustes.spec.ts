import { expect, test, type Page } from '@playwright/test';

import type { ConteudoDieta, ItemDieta, PlanoDetalhe, Receita } from '../src/api/tipos';
import { MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Ajustes do editor de dieta (04/11): observação e modo de preparo vazios recolhidos num link, unidade do alimento numa
 * lista suspensa ao lado da quantidade, "Adicionar refeição" também no pé da lista (duas colunas), cada linha de
 * Suplementação e de "Outros" num sub-cartão "#N · Nome" com a lixeira, "Mais detalhes" em "Outros" e o modelo de uma
 * refeição só sem complementos, sem duas colunas e sem "Salvar como modelo de refeição". Só dados fictícios.
 */
const PLANO_ID = 'p0000000-0000-4000-8000-0000000000a1';
const ALUNO_ID = 'a0000000-0000-4000-8000-0000000000a2';
const MODELO_ID = 'm0000000-0000-4000-8000-0000000000a3';

const item = (uid: string, nome: string, unidade: ItemDieta['unidade']): ItemDieta =>
  ({ uid, alimentoId: null, nome, quantidade: 100, unidade, kcal: 120, proteina: 5, carboidrato: 20, gordura: 2, manual: false });

const CONTEUDO: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, aguaLitros: null,
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
      // Também no pé da lista: abaixo do último item e à esquerda do inspetor.
      await expect(adicionar).toHaveCount(2);
      const ultimo = await page.getByRole('button', { name: /^Refeição 2 de 2: 12:00 · Almoço/ }).boundingBox();
      const pe = await adicionar.last().boundingBox();
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

    // Almoço: o modo de preparo gravado já abre os campos.
    if (duas) await page.getByRole('button', { name: /^Refeição 2 de 2: 12:00 · Almoço/ }).click();
    else await page.getByRole('button', { name: '12:00 · Almoço, fechado' }).click();
    await expect(page.getByLabel('Modo de preparo (opcional)', { exact: true }).last()).toHaveValue('Grelhe sem óleo.');

    // Suplementação: um sub-cartão por linha, "#N · Nome" e a lixeira no canto.
    await expect(page.getByRole('heading', { name: '#1 · Creatina fictícia' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '#2 · Sem nome' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remover Creatina fictícia' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remover linha' })).toBeVisible();
    await capturar(page, `suplementacao-${sufixo}`, page.getByRole('heading', { name: 'Suplementação' }));

    // Outros: nome, dose e horário à vista; "Mais detalhes" aberto só no item com princípio ativo.
    await expect(page.getByRole('heading', { name: '#1 · Item fictício A' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remover Item fictício A' })).toBeVisible();
    const detalhes = page.getByRole('button', { name: 'Mais detalhes (princípio ativo, concentração, observação)' });
    await expect(detalhes).toHaveCount(2);
    await expect(detalhes.first()).toHaveAttribute('aria-expanded', 'true');
    await expect(detalhes.last()).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByLabel('Princípio ativo', { exact: true })).toHaveCount(1);
    await expect(page.getByLabel('Princípio ativo', { exact: true })).toHaveValue('Substância fictícia');
    await expect(page.getByLabel('Dose prescrita', { exact: true })).toHaveCount(4);
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
