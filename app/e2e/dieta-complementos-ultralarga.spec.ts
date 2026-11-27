import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { ConteudoDieta, ItemDieta, PlanoDetalhe } from '../src/api/tipos';
import { MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Editor de dieta › Complementos na tela larga (27/11): a partir da faixa `larga`, Orientações em duas partes (lista como
 * `listbox` à esquerda, editor da selecionada e "Como o aluno vê" à direita: embaixo do editor na `larga`, ao lado na
 * `ultralarga`), Observações com o campo e a prévia lado a lado, e na Suplementação o link do produto dentro do campo do
 * nome. Abaixo da `larga`, como antes (edição na linha). Capturas com `E2E_CAPTURAS`:
 * `<base>/complementos-<aba>-<largura>-<tema>.png`. Só dados fictícios.
 */
const BASE = process.env.E2E_CAPTURAS;
const PLANO_ID = 'p0000000-0000-4000-8000-0000000000d1';
const ALUNO_ID = 'a0000000-0000-4000-8000-0000000000d2';
type Tema = 'ESCURO' | 'CLARO';

const item = (uid: string, nome: string): ItemDieta =>
  ({ uid, alimentoId: null, nome, quantidade: 100, unidade: 'g', kcal: 120, proteina: 5, carboidrato: 20, gordura: 2, manual: false });

const TEXTO_LONGO = Array.from({ length: 14 }, (_, i) => `Linha fictícia ${i + 1} da orientação, para ver o campo crescer com o texto.`).join('\n');

const CONTEUDO: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, aguaLitros: null, variacoes: [],
  observacoes: 'Evite **frituras** e __refrigerante__.\nNo fim de semana, uma refeição livre.',
  refeicoes: [
    { uid: 'cafe', nome: 'Café da manhã', horario: '07:00', observacao: null, modoDePreparo: null, opcoes: [{ uid: 'ca', rotulo: 'A', itens: [item('pao', 'Pão fictício')] }] },
  ],
  orientacoes: [
    { titulo: 'Hidratação', texto: 'Beba **3 litros** de água por dia.\nComece logo ao __acordar__.' },
    { titulo: 'Preparo', texto: TEXTO_LONGO },
    { titulo: '', texto: 'Texto fictício sem título.' },
  ],
  suplementacao: [
    { uid: 's1', nome: 'Creatina fictícia', dose: '3 g', horario: 'Manhã', observacao: 'Com água', link: 'https://exemplo.com/creatina', cupom: 'TESTE10' },
    { uid: 's2', nome: 'Whey fictício', dose: '30 g', horario: 'Pós-treino', observacao: '', link: null, cupom: null },
  ],
  ergogenicos: null,
};

const detalhe = (rascunho: ConteudoDieta, versao = 1): PlanoDetalhe<ConteudoDieta> => ({
  plano: {
    id: PLANO_ID, alunoId: ALUNO_ID, pastaId: null, titulo: 'Dieta fictícia', inicio: '2026-11-01', fim: '2026-11-30', ativo: true,
    versaoPublicada: 1, publicadoEm: '2026-11-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao,
  },
  rascunho,
  versoes: [{ id: 'v0000000-0000-4000-8000-0000000000d4', numero: 1, publicadoEm: '2026-11-01T12:00:00Z' }],
});

async function abrir(page: Page, { largura, conteudo = CONTEUDO, tema = 'ESCURO' }: { largura: number; conteudo?: ConteudoDieta; tema?: Tema }) {
  await page.setViewportSize({ width: largura, height: 1100 });
  await page.addInitScript(([usuario, prefs]) => {
    try { localStorage.setItem(`treinos:${usuario}:preferencias`, JSON.stringify(prefs)); } catch { /* sem armazenamento */ }
  }, [TREINADOR.id, { tema, contraste: 'PADRAO', larguraConteudo: 'AUTOMATICA' }] as const);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR'] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /alimentos': { corpo: [] },
    'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /planos-dieta/${PLANO_ID}`]: { corpo: detalhe(conteudo) },
    [`PUT /planos-dieta/${PLANO_ID}/rascunho`]: { corpo: detalhe(conteudo, 2) },
  });
  await page.goto(`/treinador/dietas/${PLANO_ID}`);
  await expect(page.getByRole('heading', { name: 'Complementos' })).toBeVisible({ timeout: 30_000 });
  return api;
}

const cartao = (page: Page) => page.getByTestId('cartao').filter({ has: page.getByRole('heading', { name: 'Complementos' }) });
const aba = (page: Page, nome: RegExp) => page.getByRole('tab', { name: nome });
const lista = (page: Page) => page.getByRole('listbox', { name: 'Orientações da dieta' });
const opcao = (page: Page, n: number) => lista(page).getByRole('option', { name: new RegExp(`^Orientação ${n} de \\d+:`) });
const previa = (page: Page) => page.getByRole('region', { name: 'Como o aluno vê' });
const caixa = async (l: ReturnType<Page['locator']>) => (await l.boundingBox())!;

async function capturar(page: Page, nome: string) {
  if (!BASE) return;
  // Janela alta e o cartão no meio: com o topo rente, a barra grudada do editor cobria o título e as abas na captura.
  const antes = page.viewportSize()!;
  await page.setViewportSize({ width: antes.width, height: 1900 });
  await cartao(page).evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  await cartao(page).screenshot({ path: path.join(BASE, `${nome}.png`) });
  await page.setViewportSize(antes);
}

for (const largura of [1920, 3440]) {
  test(`orientações lado a lado: lista, editor e prévia formatada; teclado e remover (${largura}px)`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, { largura });
    // "Sem título" não marca a aba (o aviso fica só no campo).
    await expect(aba(page, /^Orientações \(3\)$/)).toHaveAttribute('aria-selected', 'true');
    await expect(lista(page).getByRole('option')).toHaveCount(3);
    await expect(opcao(page, 1)).toHaveAttribute('aria-selected', 'true');
    // Foco móvel: só a selecionada entra no Tab.
    await expect(opcao(page, 1)).toHaveAttribute('tabindex', '0');
    await expect(opcao(page, 2)).toHaveAttribute('tabindex', '-1');
    await expect(page.getByLabel('Título da orientação 1')).toHaveValue('Hidratação');

    // A lista fica com ~40% e o editor com a prévia com ~60%.
    const l = await caixa(lista(page));
    const c = await caixa(cartao(page));
    expect(l.width / c.width).toBeGreaterThan(0.3);
    expect(l.width / c.width).toBeLessThan(0.45);

    // Prévia: as peças do aluno, com negrito e sublinhado aplicados e sem os marcadores; a selecionada com aria-current.
    const p = previa(page);
    await expect(p.getByRole('heading', { name: 'Orientações' })).toBeVisible();
    await expect(p.getByText('3 litros', { exact: true })).toHaveCSS('font-family', /Bold|Negrito|700/i);
    await expect(p.getByText('acordar', { exact: true })).toHaveCSS('text-decoration-line', 'underline');
    await expect(p.getByText(/\*\*|__/)).toHaveCount(0);
    await expect(p.locator('[aria-current="true"]')).toHaveCount(1);
    await expect(p.locator('[aria-current="true"]')).toContainText('Hidratação');

    // Na larga a prévia vem embaixo do editor; na ultralarga, ao lado.
    const editor = await caixa(page.getByRole('group', { name: 'Editando orientação 1' }));
    const pv = await caixa(p);
    if (largura === 1920) expect(pv.y).toBeGreaterThan(editor.y + editor.height - 1);
    else expect(pv.x).toBeGreaterThan(editor.x + editor.width - 1);
    await capturar(page, `complementos-orientacoes-${largura}-escuro`);

    // Teclado: ↓ seleciona e foca a próxima; o editor e o destaque da prévia acompanham.
    await opcao(page, 1).focus();
    await page.keyboard.press('ArrowDown');
    await expect(opcao(page, 2)).toHaveAttribute('aria-selected', 'true');
    await expect(opcao(page, 2)).toBeFocused();
    await expect(page.getByLabel('Título da orientação 2')).toHaveValue('Preparo');
    await expect(p.locator('[aria-current="true"]')).toContainText('Preparo');
    // Texto longo (14 linhas): o campo cresce até mostrar tudo, sem rolar (não fica nas 8 linhas iniciais).
    const texto = page.getByLabel('Texto da orientação 2');
    expect((await caixa(texto)).height).toBeGreaterThan(260);
    expect(await texto.evaluate((e) => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
    await page.keyboard.press('End');
    await expect(opcao(page, 3)).toBeFocused();

    // Sem título: o aviso só no campo Título, uma vez.
    await expect(page.getByText('Sem título: o aluno lê o texto sem um nome em cima.')).toHaveCount(1);
    await expect(page.getByLabel('Título da orientação 3')).toHaveAccessibleDescription('Sem título: o aluno lê o texto sem um nome em cima.');

    // Remover a selecionada seleciona a vizinha (a última sai, a anterior fica).
    await page.getByRole('button', { name: 'Mais ações de orientação 3' }).click();
    await page.getByRole('button', { name: /^Excluir orientação/ }).click();
    await expect(lista(page).getByRole('option')).toHaveCount(2);
    await expect(opcao(page, 2)).toHaveAttribute('aria-selected', 'true');

    // Adicionar: a nova entra selecionada, com o foco no título; a prévia não a mostra enquanto está vazia.
    await page.getByRole('button', { name: 'Adicionar orientação' }).click();
    await expect(page.getByLabel('Título da orientação 3')).toBeFocused();
    await expect(p.locator('[aria-current="true"]')).toHaveCount(0);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`observações lado a lado com a prévia formatada; vazio diz "Nada para mostrar ainda" (${largura}px)`, async ({ page }) => {
    await abrir(page, { largura });
    await aba(page, /^Observações$/).click();
    const campo = page.getByLabel('Observações (opcional)');
    const p = previa(page);
    await expect(p.getByRole('heading', { name: 'Observações' })).toBeVisible();
    await expect(p.getByText('frituras', { exact: true })).toHaveCSS('font-family', /Bold|Negrito|700/i);
    const cc = await caixa(campo);
    const pc = await caixa(p);
    expect(pc.x).toBeGreaterThan(cc.x + cc.width);
    expect(Math.abs(cc.width - pc.width)).toBeLessThan(cc.width * 0.1);
    await expect(page.getByText('O aluno lê junto com a dieta, com as quebras de linha.')).toHaveCount(0);
    await capturar(page, `complementos-observacoes-${largura}-escuro`);
    await campo.fill('');
    await expect(p.getByText('Nada para mostrar ainda')).toBeVisible();
  });

  test(`suplementação: o link fica dentro do campo do nome, só quando há link (${largura}px)`, async ({ page }) => {
    await abrir(page, { largura });
    await aba(page, /^Suplementação/).click();
    const nome1 = await caixa(page.getByLabel('Nome do suplemento 1'));
    const nome2 = await caixa(page.getByLabel('Nome do suplemento 2'));
    const link = await caixa(page.getByRole('button', { name: /^Abrir produto Creatina/ }));
    await expect(page.getByRole('button', { name: /^Abrir produto/ })).toHaveCount(1);
    // O ícone está dentro da caixa do campo, no fim; os dois campos têm a mesma largura (sem coluna vazia).
    expect(link.x).toBeGreaterThan(nome1.x + nome1.width / 2);
    expect(link.x + link.width).toBeLessThanOrEqual(nome1.x + nome1.width + 1);
    expect(Math.abs(nome1.width - nome2.width)).toBeLessThan(1);
    // As colunas alinham em todas as linhas.
    for (const campo of ['Dose prescrita', 'Horário', 'Observação']) {
      const a = await caixa(page.getByLabel(`${campo} do suplemento 1`));
      const b = await caixa(page.getByLabel(`${campo} do suplemento 2`));
      expect(Math.abs(a.x - b.x)).toBeLessThan(1);
    }
    await capturar(page, `complementos-suplementacao-${largura}-escuro`);
  });

  test(`capturas no tema claro, as três abas (${largura}px)`, async ({ page }) => {
    test.skip(!BASE, 'só com E2E_CAPTURAS');
    await abrir(page, { largura, tema: 'CLARO' });
    await capturar(page, `complementos-orientacoes-${largura}-claro`);
    await aba(page, /^Observações$/).click();
    await capturar(page, `complementos-observacoes-${largura}-claro`);
    await aba(page, /^Suplementação/).click();
    await capturar(page, `complementos-suplementacao-${largura}-claro`);
  });
}

test('orientações vazias na tela larga: sem editor, prévia com "Nada para mostrar ainda" (1920px)', async ({ page }) => {
  await abrir(page, { largura: 1920, conteudo: { ...CONTEUDO, orientacoes: [] } });
  await expect(page.getByText(/^Nenhuma orientação ainda/)).toBeVisible();
  await expect(previa(page).getByText('Nada para mostrar ainda')).toBeVisible();
  await expect(page.getByLabel(/^Título da orientação/)).toHaveCount(0);
  await capturar(page, 'complementos-orientacoes-vazias-1920-escuro');
  await page.getByRole('button', { name: 'Adicionar orientação' }).click();
  await expect(page.getByLabel('Título da orientação 1')).toBeFocused();
  await expect(opcao(page, 1)).toHaveAttribute('aria-selected', 'true');
});

test('texto acima do limite: contador em perigo, erro no campo e a aba marcada (1920px)', async ({ page }) => {
  await abrir(page, { largura: 1920, conteudo: { ...CONTEUDO, orientacoes: [{ titulo: 'Longa', texto: 'x'.repeat(2001) }] } });
  await expect(aba(page, /^Orientações \(1\), com problema a corrigir$/)).toBeVisible();
  await expect(page.getByText('Até 2.000 caracteres.')).toBeVisible();
  await expect(page.getByText('2.001/2.000')).toBeVisible();
  await capturar(page, 'complementos-orientacoes-erro-1920-escuro');
});

// O limite da `larga`: a área ao lado do menu aberto (240) passa de 1599 para 1600 na janela 1840, mas o cartão é medido
// dentro da rolagem (a barra de rolagem da web tira ~16 px), então a troca real fica perto de 1856. O que importa: as
// Orientações mudam junto com a coluna do Total do dia (a mesma régua, `colunasDaDieta`), em qualquer janela.
test('limite da faixa larga: as Orientações abrem lado a lado junto com a coluna do Total do dia', async ({ page }) => {
  await abrir(page, { largura: 1839 });
  for (const janela of [1839, 1840, 1855, 1856, 1857, 1858, 1880]) {
    await page.setViewportSize({ width: janela, height: 1100 });
    await page.waitForTimeout(300);
    const total = await page.getByTestId('coluna-total-dieta').count();
    await expect(lista(page), `janela ${janela}`).toHaveCount(total);
    if (janela === 1839) expect(total).toBe(0);
    if (janela === 1880) expect(total).toBe(1);
  }
});

// Abaixo da faixa `larga`: como antes (edição na própria linha, sem listbox nem prévia); a aba não avisa o "Sem título".
for (const largura of [1024, 390]) {
  test(`orientações abaixo da larga continuam na linha, sem prévia (${largura}px)`, async ({ page }) => {
    await abrir(page, { largura });
    await expect(lista(page)).toHaveCount(0);
    await expect(previa(page)).toHaveCount(0);
    await expect(aba(page, /^Orientações \(3\)$/)).toBeVisible();
    await page.getByRole('button', { name: /^Orientação 3 de 3: sem título/ }).click();
    await expect(page.getByText('Sem título: o aluno lê o texto sem um nome em cima.')).toHaveCount(1);
    await aba(page, /^Observações$/).click();
    await expect(previa(page)).toHaveCount(0);
    await expect(page.getByText('O aluno lê junto com a dieta, com as quebras de linha.')).toBeVisible();
    await capturar(page, `complementos-observacoes-${largura}-escuro`);
  });
}
