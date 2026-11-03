import { expect, test, type Page } from '@playwright/test';

import type { ConteudoDieta, DiaDeTreino, ItemDieta, PastaDoAluno, SerieFeita, VersaoDetalhe } from '../src/api/tipos';
import { PALETA_DE_IDENTIFICACAO } from '../src/tema/tokens';
import { ALUNO, json, simularApi } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/**
 * Frente G, passo 5 (D13, D14 e D15): a dieta do aluno com a cor da refeição na barra e na etiqueta da quantidade, e o
 * Histórico com o período em cada cartão, a escolha do período, a letra e a cor de cada divisão e o "Por dia" em semana →
 * dia. Em 390 e 1280 px, nos temas claro e escuro. Só dados fictícios.
 */

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

async function tema(page: Page, nome: 'claro' | 'escuro') {
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [ALUNO.id, nome === 'escuro' ? 'ESCURO' : 'CLARO']);
}

const semRolagemDeLado = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/* ---------------- dieta (D14) ---------------- */

const item = (uid: string, nome: string, quantidade: number | null, unidade: ItemDieta['unidade'] = 'g'): ItemDieta => ({
  uid, alimentoId: null, nome, quantidade, unidade, kcal: 100, proteina: 5, carboidrato: 10, gordura: 2, manual: true,
});

const CONTEUDO: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, suplementacao: [], ergogenicos: null, aguaLitros: null,
  refeicoes: [
    { uid: 'cafe', nome: 'Café da manhã', horario: '07:00', observacao: null, opcoes: [{ uid: 'a', rotulo: 'A', itens: [item('aveia', 'Aveia fictícia', 40)] }] },
    { uid: 'almoco', nome: 'Almoço', horario: '12:00', observacao: null, opcoes: [{ uid: 'a', rotulo: 'A', itens: [item('arroz', 'Arroz fictício', 150), item('sal', 'Tempero fictício', null)] }] },
  ],
};

const DIETA: VersaoDetalhe<ConteudoDieta> = {
  id: 'd0000000-0000-4000-8000-000000000011', planoId: 'p0000000-0000-4000-8000-000000000011', numero: 1, titulo: 'Dieta de teste',
  inicio: '2026-10-01', fim: '2026-10-31', publicadoEm: '2026-10-01T12:00:00Z', conteudo: CONTEUDO,
};

/* ---------------- histórico (D13 e D15) ---------------- */

const serie = (extra: Partial<SerieFeita> = {}): SerieFeita => ({
  id: Math.random().toString(36), serieUid: 's', tipo: 'WS', trabalho: true, carga: 40, unidade: 'kg', repeticoes: 8, concluida: true, observacao: null, ...extra,
});

const sessao = (uid: string, nome: string, exercicio: string, carga: number): DiaDeTreino['sessoes'][number] => ({
  sessaoUid: uid, sessao: nome, planoVersaoId: 'v1',
  exercicios: [{ exercicioUid: `${uid}e`, exercicioId: `${uid}e`, nome: exercicio, series: [serie({ carga })] }],
});

// 07/10 é quarta, 09/10 sexta, 13/10 terça (outubro de 2026); 15/09 é terça.
const OUTUBRO: DiaDeTreino[] = [
  { data: '2026-10-07', sessoes: [sessao('sa', 'Treino A - Peito', 'Supino fictício', 40)] },
  { data: '2026-10-09', sessoes: [sessao('sb', 'Treino B - Costas', 'Remada fictícia', 50)] },
  { data: '2026-10-13', sessoes: [sessao('sa', 'Treino A - Peito', 'Supino fictício', 42.5)] },
];
const SETEMBRO: DiaDeTreino[] = [{ data: '2026-09-15', sessoes: [sessao('sa', 'Treino A - Peito', 'Supino fictício', 37.5)] }];

const pasta = (id: string, titulo: string, inicio: string, fim: string, atual: boolean): PastaDoAluno => ({
  id, titulo, inicio, fim, concluidaEm: atual ? null : `${fim}T12:00:00Z`, atual, temTreino: true, temDieta: false,
});
const PASTAS = [pasta('p-out', 'Outubro', '2026-10-01', '2026-10-31', true), pasta('p-set', 'Setembro', '2026-09-01', '2026-09-30', false)];

async function historico(page: Page) {
  const pedidos: string[] = [];
  const api = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    'GET /aluno/pastas': { corpo: PASTAS },
    'GET /aluno/execucoes': (p, route) => {
      const de = p.busca.get('de') ?? '';
      pedidos.push(`${de}:${p.busca.get('ate') ?? ''}`);
      return json(route, de.startsWith('2026-10') ? OUTUBRO : de.startsWith('2026-09') ? SETEMBRO : []);
    },
    'GET /aluno/pesos': { corpo: [] },
  });
  await page.goto('/aluno/historico');
  return { ...api, pedidos };
}

const borda = (page: Page, testId: string) => page.getByTestId(testId).first().evaluate((el) => getComputedStyle(el).borderLeftColor);

for (const nomeDoTema of ['claro', 'escuro'] as const) {
  const paleta = PALETA_DE_IDENTIFICACAO[nomeDoTema];
  for (const largura of [390, 1280]) {
    test(`dieta: quantidade na etiqueta com a cor da refeição (${nomeDoTema}, ${largura}px)`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await tema(page, nomeDoTema);
      const { naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessaoDeAluno(page)),
        'GET /aluno/dieta': { corpo: { dieta: DIETA } },
        'GET /aluno/pesos': { corpo: [] },
      });
      await page.goto('/aluno/dieta');
      const aveia = page.getByLabel('Quantidade: 40 g', { exact: true });
      const arroz = page.getByLabel('Quantidade: 150 g', { exact: true });
      await expect(aveia).toBeVisible();
      await expect(arroz).toBeVisible();
      await arroz.scrollIntoViewIfNeeded();
      // A primeira refeição é ciano e a segunda, azul: etiqueta e texto na cor da refeição.
      expect(await aveia.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe(rgb(paleta.CIANO));
      expect(await arroz.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe(rgb(paleta.AZUL));
      await expect(aveia.getByText('40', { exact: true })).toHaveCSS('color', rgb(paleta.CIANO));
      // O nome do alimento continua no texto, e a quantidade ausente é "—" (sem unidade inventada).
      await expect(page.getByText('Arroz fictício', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Quantidade: —', { exact: true })).toBeVisible();
      await expect(page.getByText('Arroz fictício — 150 g')).toHaveCount(0);
      expect(await semRolagemDeLado(page)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`dieta-${nomeDoTema}-${largura}.png`), fullPage: true });
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test(`histórico: período em cada cartão, divisões com letra e cor, e semana → dia (${nomeDoTema}, ${largura}px)`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await tema(page, nomeDoTema);
      const { pedidos, errosDaPagina } = await historico(page);

      // Período na faixa e a frase do que está mostrando.
      await expect(page.getByLabel('Período: Pasta atual: 01/10 a 31/10', { exact: true })).toBeVisible();
      await expect(page.getByText('Mostrando a carga de trabalho de cada exercício por divisão, de 01/10 a 31/10. Carga e reps contam só as séries de trabalho.', { exact: true })).toBeVisible();
      await expect(page.getByLabel(/^Período: Todas as pastas · exercícios dos últimos 12 meses$/)).toBeVisible();
      await expect(page.getByLabel(/^Período: Desde o primeiro registro/).first()).toBeVisible();

      // Por divisão: A azul, B magenta, na barra; o nome lido não repete "Treino A".
      await expect(page.getByRole('button', { name: /^Treino A - Peito, 1 exercício · último em 13\/10\/2026, aberta$/ })).toBeVisible();
      expect(await borda(page, 'divisao-A')).toBe(rgb(paleta.AZUL));
      expect(await borda(page, 'divisao-B')).toBe(rgb(paleta.MAGENTA));
      await expect(page.getByLabel('Cargas de Supino fictício', { exact: true }).getByText('42,5 kg', { exact: true })).toBeVisible();
      await page.getByTestId('divisao-B').scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`historico-divisao-${nomeDoTema}-${largura}.png`), fullPage: true });

      // Por dia: semana → dia, do mais recente ao mais antigo, com a mesma letra e a mesma cor.
      await page.getByText('Por dia', { exact: true }).click();
      await expect(page.getByText(/agrupados por semana\.$/)).toBeVisible();
      const semanas = page.getByText(/^Semana de /);
      await expect(semanas).toHaveText(['Semana de 12/10 a 18/10', 'Semana de 05/10 a 11/10']);
      await expect(page.getByText('2 treinos', { exact: true })).toBeVisible();
      await expect(page.getByLabel('quarta, 07/10/2026', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Dias com treino: quarta, Treino A - Peito; sexta, Treino B - Costas', { exact: true })).toBeVisible();
      await expect(page.getByText('WS 50 kg × 8', { exact: true })).toBeVisible();
      expect(await borda(page, 'divisao-B')).toBe(rgb(paleta.MAGENTA));
      expect(await semRolagemDeLado(page)).toBe(true);
      await page.getByText('Semana de 05/10 a 11/10', { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`historico-semana-${nomeDoTema}-${largura}.png`), fullPage: true });

      // Pasta anterior: as datas dela vão para a mesma rota, e o período da faixa muda.
      await page.getByText('Pasta anterior', { exact: true }).click();
      await expect(page.getByLabel('Período: Pasta anterior: 01/09 a 30/09', { exact: true })).toBeVisible();
      await expect(page.getByText('Semana de 14/09 a 20/09', { exact: true })).toBeVisible();
      expect(pedidos).toContain('2026-09-01:2026-09-30');
      // Últimos 30 dias: o rótulo diz o período (as datas dependem de hoje).
      await page.getByText('Últimos 30 dias', { exact: true }).click();
      await expect(page.getByLabel(/^Período: Últimos 30 dias: \d\d\/\d\d a \d\d\/\d\d$/)).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });
  }
}
