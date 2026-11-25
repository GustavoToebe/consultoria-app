import { expect, test, type Locator, type Page } from '@playwright/test';

import { simularApi, TREINADOR } from './api-falsa';
import { fixarHoje } from './aluno';
import { estadoFinanceiro, INADIMPLENTE, rotasDoFinanceiro, sessaoComFinanceiro } from './financeiro-falso';

/**
 * Visão geral do Financeiro, financeiro (19/11): os seis indicadores em colunas iguais (6, 3 + 3, 2 ou 1; nunca 5 + 1) com
 * a mesma altura na linha, os quatro do Resultado do mês (4, 2 + 2 ou 1), a tabela de inadimplência com as colunas
 * distribuídas (cabeçalho com as mesmas larguras das linhas, 24 px entre colunas, valor à direita, linhas de duas alturas
 * alinhadas pelo topo) e o mês em MM/AAAA na fonte numérica. Relógio em 19/10/2026, só dados fictícios.
 */

const INDICADORES = ['Recebido no período', 'A receber', 'Em atraso', 'Receita recorrente mensal', 'Alunos pagantes', 'Valor médio por aluno'];
const PARCELAS = ['Recebido das cobranças', 'Entradas avulsas', 'Saídas avulsas', 'Resultado'];
const INADIMPLENTES = [
  INADIMPLENTE,
  { ...INADIMPLENTE, cobrancaId: 'c0000000-0000-4000-8000-0000000000a2', alunoId: 'a0000000-0000-4000-8000-0000000000b2', alunoNome: 'Aluno Ficticio Dois', vencimento: '2026-09-05', diasDeAtraso: 44 },
  { ...INADIMPLENTE, cobrancaId: 'c0000000-0000-4000-8000-0000000000a3', alunoId: 'a0000000-0000-4000-8000-0000000000b3', alunoNome: 'Aluno Ficticio Tres', vencimento: '2026-04-05', diasDeAtraso: 197 },
];

async function abrir(page: Page, largura: number, preferencias: Record<string, unknown> = {}) {
  await page.setViewportSize({ width: largura, height: 1000 });
  await page.addInitScript(([id, p]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(p)), [TREINADOR.id, preferencias] as const);
  await fixarHoje(page);
  const r = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estadoFinanceiro({ inadimplentes: INADIMPLENTES })) });
  await page.goto('/treinador/financeiro');
  await expect(page.getByText('Resultado do mês (entradas − saídas registradas)')).toBeVisible();
  return r;
}

const caixa = async (l: Locator) => {
  const c = await l.boundingBox();
  if (!c) throw new Error('sem caixa');
  return c;
};

/** Cartões agrupados por linha (pelo topo): quantos em cada linha, e cada linha com a mesma altura e a mesma largura. */
async function linhasDosCartoes(page: Page, rotulos: string[]) {
  const cs = [];
  for (const r of rotulos) cs.push(await caixa(page.getByLabel(new RegExp(`^${r}: `))));
  const linhas = new Map<number, typeof cs>();
  for (const c of cs) linhas.set(Math.round(c.y), [...(linhas.get(Math.round(c.y)) ?? []), c]);
  for (const l of linhas.values()) {
    for (const c of l) {
      expect(Math.abs(c.height - l[0].height)).toBeLessThan(1);
      expect(Math.abs(c.width - l[0].width)).toBeLessThan(1);
    }
  }
  const largura = Math.max(...cs.map((c) => c.x + c.width)) - Math.min(...cs.map((c) => c.x));
  return { porLinha: [...linhas.values()].map((l) => l.length), largura: Math.round(largura) };
}

for (const [largura, indicadores, parcelas] of [
  [1920, [6], [4]],
  [1280, [3, 3], [4]],
  [1024, [2, 2, 2], [2, 2]],
  [390, [1, 1, 1, 1, 1, 1], [1, 1, 1, 1]],
] as const) {
  test(`grade dos indicadores em ${largura}: ${indicadores.join(' + ')} e resultado do mês ${parcelas.join(' + ')}, mesma altura na linha`, async ({ page }, testInfo) => {
    const { errosDaPagina } = await abrir(page, largura);
    const seis = await linhasDosCartoes(page, INDICADORES);
    const quatro = await linhasDosCartoes(page, PARCELAS);
    testInfo.annotations.push({ type: `grade em ${largura}`, description: `indicadores ${seis.largura} px, resultado ${quatro.largura} px` });
    expect(seis.porLinha).toEqual(indicadores);
    expect(quatro.porLinha).toEqual(parcelas);
    // Os títulos seguem h2 (a tela não perdeu a navegação por títulos).
    await expect(page.getByRole('heading', { name: 'Valor médio por aluno', level: 2 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });
}

// Cartão de indicador pintado (23/11): com situação, degradê e borda de 1 px em volta (a faixa grossa saiu); neutro, liso.
test('cartão de indicador pintado: recebido com degradê e borda fina, alunos pagantes liso', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280);
  const estilo = (rotulo: string) => page.getByLabel(new RegExp(`^${rotulo}: `)).first().evaluate((e) => {
    const s = getComputedStyle(e);
    return { imagem: s.backgroundImage, esquerda: s.borderLeftWidth, topo: s.borderTopWidth };
  });
  const recebido = await estilo('Recebido no período');
  expect(recebido.imagem).toContain('linear-gradient(135deg');
  expect(recebido.esquerda).toBe(recebido.topo);
  expect((await estilo('Alunos pagantes')).imagem).toBe('none');
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [1280, 1920]) {
  test(`inadimplência em ${largura}: colunas distribuídas, cabeçalho igual às linhas, 24 px entre colunas, valor à direita e topo alinhado`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, largura);
    const tabela = page.getByRole('table', { name: 'Cobranças vencidas em aberto' });
    await expect(tabela).toBeVisible();
    const cabecalho = await Promise.all((await tabela.getByRole('columnheader').all()).map(caixa));
    const linhas = tabela.getByRole('row');
    await expect(linhas).toHaveCount(INADIMPLENTES.length + 1);
    for (let r = 1; r <= INADIMPLENTES.length; r++) {
      const celulas = await Promise.all((await linhas.nth(r).getByRole('cell').all()).map(caixa));
      expect(celulas).toHaveLength(cabecalho.length);
      celulas.forEach((c, i) => {
        expect(Math.abs(c.x - cabecalho[i].x)).toBeLessThan(1);
        expect(Math.abs(c.width - cabecalho[i].width)).toBeLessThan(1);
      });
    }
    for (let i = 1; i < cabecalho.length; i++) expect(cabecalho[i].x - (cabecalho[i - 1].x + cabecalho[i - 1].width)).toBeGreaterThanOrEqual(23.5);
    // Aluno com o dobro das outras (flex 2): não ocupa quase tudo.
    expect(cabecalho[0].width).toBeLessThan(cabecalho[1].width * 2.6);
    // Ações coladas à direita da tabela.
    const t = await caixa(tabela);
    expect(t.x + t.width - (cabecalho[4].x + cabecalho[4].width)).toBeLessThan(24);

    // Valor alinhado à direita, no cabeçalho e na linha.
    const linha = linhas.nth(3);
    const valor = await caixa(linha.getByText('R$ 150,00', { exact: true }));
    const tituloValor = await caixa(tabela.getByRole('columnheader').nth(1).getByText('Valor', { exact: true }));
    expect(Math.abs(valor.x + valor.width - (cabecalho[1].x + cabecalho[1].width))).toBeLessThan(1.5);
    expect(Math.abs(tituloValor.x + tituloValor.width - (cabecalho[1].x + cabecalho[1].width))).toBeLessThan(1.5);
    // Topo do texto igual em toda a linha, também quando o atraso quebra em duas.
    const nome = await caixa(linha.getByText('Aluno Ficticio Tres', { exact: true }));
    const atraso = await caixa(linha.getByText('197 dias de atraso', { exact: true }));
    expect(Math.abs(nome.y - valor.y)).toBeLessThan(2);
    expect(Math.abs(atraso.y - valor.y)).toBeLessThan(2);
    // O botão fica centrado na primeira linha do nome, não 11 px abaixo dela.
    const botao = await caixa(linha.getByRole('button', { name: /^Registrar pagamento de Aluno Ficticio Tres/ }));
    expect(Math.abs(botao.y + botao.height / 2 - (nome.y + 11))).toBeLessThan(3);
    expect(errosDaPagina).toEqual([]);
  });
}

test('mês em MM/AAAA na fonte numérica: movimento de alunos, resultado do mês e eixo do gráfico', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280);
  const mes = page.getByRole('table', { name: 'Movimento de alunos por mês' }).getByText('10/2026', { exact: true });
  await expect(mes).toBeVisible();
  await expect(mes).toHaveCSS('font-family', /mono/i);
  await expect(page.getByText(/^out\/2026/)).toHaveCount(0);
  await expect(page.getByText('Mês de 10/2026 · sempre o mês de hoje, não muda com o período acima')).toBeVisible();
  // Eixo do gráfico: o mês inteiro cabe na faixa (64 px no mínimo) sem encostar no vizinho.
  const eixo = page.locator('svg text', { hasText: /^10\/2026$/ });
  await expect(eixo).toHaveCount(1);
  expect((await caixa(eixo)).width).toBeLessThan(64);
  expect(errosDaPagina).toEqual([]);
});

test('sem gráficos, a tabela do recebido mostra o mês em MM/AAAA na fonte numérica', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, 1280, { graficos: false });
  const tabela = page.getByLabel('Recebido e previsto por mês', { exact: true });
  const mes = tabela.getByText('10/2026 (até hoje)', { exact: true });
  await expect(mes).toBeVisible();
  // Fonte mono só no número (T-002): o "(até hoje)" fica em Geist e o "10/2026" em mono.
  await expect(mes.getByText('10/2026', { exact: true })).toHaveCSS('font-family', /mono/i);
  await expect(tabela.getByText('08/2026', { exact: true })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});
