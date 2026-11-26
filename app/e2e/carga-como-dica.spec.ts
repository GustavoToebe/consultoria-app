import { expect, test, type Page } from '@playwright/test';

import type { AnterioresDoPacote, Carga, DiaDeTreino, PainelAluno, RegistroEnvio, Serie, SessoesConcluidasResponse } from '../src/api/tipos';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa, fazerSerie } from './aluno';
import { ALUNO, json, sessao, simularApi } from './api-falsa';

/**
 * Carga como dica (passo 3 de `docs/planos/execucao-referencia-e-progressao.md`, D1, D2, D4, D5, D6 e D7, 02/11): o campo de
 * carga começa vazio e a sugestão (60 kg × 8) fica apagada dentro dos campos; o ✓ sem digitar grava a sugestão (tela
 * redesenhada de 25/11, que tirou o painel "Fez…?" e o "Sem carga"); a contagem "x de y" só conta trabalho e pós-trabalho
 * (2 aquecimentos + 4 WS = "x de 4").
 * A "Última vez" da dica vem de `ultimasCargas` (independe da chave do retorno, D7): com a chave ligada e "anteriores"
 * diferentes no pacote, a dica não muda. Exercício e números fictícios; relógio em segunda, 19/10/2026, 12:00.
 */
const LISTA = '/aluno/sessao/sx?data=2026-10-19';
const EXERCICIO = '/aluno/sessao/sx/sxe1?data=2026-10-19';

const NENHUMA: Carga = { modo: 'NENHUMA', percentualMin: null, percentualMax: null };
const DE_TRABALHO: Carga = { modo: 'CARGA_TRABALHO', percentualMin: null, percentualMax: null };
const aquecimento = (n: number): Serie => ({ uid: `aq${n}`, tipo: 'WARM_UP', repsMin: 12, repsMax: 15, carga: NENHUMA, esforco: null, descansoSegundos: null });
const ws = (n: number): Serie => ({ uid: `ws${n}`, tipo: 'WORKING', repsMin: 6, repsMax: 8, carga: DE_TRABALHO, esforco: null, descansoSegundos: null });

/** "Anterior" de propósito diferente da última carga: se a dica usasse os anteriores, mostraria 55 kg × 9. */
const ANTERIORES: AnterioresDoPacote = {
  ate: '2026-10-19',
  exercicios: { x1: { data: '2026-10-16', series: [{ tipo: 'WORKING', ordem: 1, carga: 55, repeticoes: 9, etapas: null }] } },
};

/** Histórico do servidor montado com o que o app enviou (o servidor guarda o que chega). */
function historicoDe(enviados: RegistroEnvio[]): DiaDeTreino[] {
  const ultimos = new Map<string, RegistroEnvio>();
  for (const r of enviados) ultimos.set(r.serieUid, r);
  const series = [...ultimos.values()].filter((r) => r.concluida);
  if (!series.length) return [];
  return [{
    data: '2026-10-19',
    sessoes: [{
      sessaoUid: 'sx', sessao: 'Treino curto', planoVersaoId: 't0000000-0000-4000-8000-000000000002',
      exercicios: [{
        exercicioUid: 'sxe1', exercicioId: 'x1', nome: 'Supino de teste',
        series: series.map((r) => ({
          id: r.id, serieUid: r.serieUid, tipo: r.serieUid.startsWith('ws') ? 'WS' : 'Aquecimento', trabalho: r.serieUid.startsWith('ws'),
          carga: r.carga, unidade: 'kg', repeticoes: r.repeticoes, concluida: r.concluida, observacao: null,
        })),
      }],
    }],
  }];
}

async function abrir(page: Page, ligada: boolean) {
  await fixarHoje(page);
  const sessoes = [sessaoFalsa('sx', 'Treino curto', 1, 1)];
  sessoes[0]!.exercicios[0] = { ...sessoes[0]!.exercicios[0]!, exercicioId: 'x1', nome: 'Supino de teste', series: [aquecimento(1), aquecimento(2), ws(1), ws(2), ws(3), ws(4)] };
  const base = await sessaoDeAlunoComTreino(page, sessoes);
  const painel = (base['GET /aluno/painel'] as { corpo: PainelAluno }).corpo;
  const enviados: RegistroEnvio[] = [];
  const api = await simularApi(page, {
    ...base,
    ...(ligada ? await sessao(page, ALUNO, { retornoHabilitado: true }) : {}),
    'GET /aluno/painel': { corpo: { ...painel, ultimasCargas: { x1: { carga: 60, repeticoes: 7, data: '2026-10-16' } }, ...(ligada ? { anteriores: ANTERIORES } : {}) } },
    'POST /aluno/execucoes/lote': (p, route) => {
      const lote = (p.corpo as { registros: RegistroEnvio[] }).registros;
      enviados.push(...lote);
      return json(route, { resultados: lote.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) });
    },
    'GET /aluno/execucoes': (_p, route) => json(route, historicoDe(enviados)),
    'GET /aluno/pesos': { corpo: [] },
    'GET /aluno/fotos/linha-do-tempo': { corpo: [] },
    'GET /aluno/atualizacoes': { corpo: [] },
    'GET /aluno/avaliacoes-fisicas': { corpo: [] },
    ...(ligada ? { 'GET /aluno/sessoes-concluidas': { corpo: { totalConcluidos: 0, sessoes: [] } satisfies SessoesConcluidasResponse } } : {}),
  });
  return { ...api, enviados };
}

const peso = (page: Page, n: number) => page.getByRole('textbox', { name: `Carga da série ${n}, em quilos`, exact: true });
const marcar = (page: Page, n: number) => page.getByRole('checkbox', { name: new RegExp(`^Marcar série ${n} como feita`) });
const semEstourar = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

for (const largura of [390, 1280]) {
  test(`campo vazio com a sugestão apagada, ✓ grava a sugestão e contagem só do trabalho (${largura} px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await abrir(page, false);
    await page.goto(EXERCICIO);

    // D1: nenhum campo de peso vem preenchido; a sugestão (60 kg × 8, progressão da última vez) fica apagada nas quatro WS.
    for (const n of [1, 2, 3, 4, 5, 6]) await expect(peso(page, n)).toHaveValue('');
    for (const n of [3, 4, 5, 6]) await expect(peso(page, n)).toHaveAttribute('placeholder', '60');
    for (const n of [1, 2]) await expect(peso(page, n)).toHaveAttribute('placeholder', '—');
    await expect(page.getByRole('textbox', { name: 'Repetições da série 3', exact: true })).toHaveAttribute('placeholder', '8');
    // A meta de repetições fica no cabeçalho de cada série; D6: a contagem não conta os aquecimentos.
    await expect(page.getByText('6 a 8 reps', { exact: true })).toHaveCount(4);
    await expect(page.getByText('Séries 0 de 4 feitas', { exact: true })).toBeVisible();
    await semEstourar(page);
    await page.screenshot({ path: testInfo.outputPath(`sugestao-${largura}.png`), fullPage: true });

    // Aquecimento sem sugestão: o ✓ espera o kg e as reps; marcado, não entra na contagem.
    await expect(marcar(page, 1)).toBeDisabled();
    await peso(page, 1).fill('20');
    await page.getByRole('textbox', { name: 'Repetições da série 1', exact: true }).fill('12');
    await fazerSerie(page, 1);
    await expect(marcar(page, 1)).toBeChecked();
    await expect(page.getByText('Séries 0 de 4 feitas', { exact: true })).toBeVisible();

    // WS com o peso e as reps vazios: o ✓ grava a sugestão (60 kg × 8; pedido de 25/11, sem o painel "Fez…?").
    await fazerSerie(page, 3);
    await expect(marcar(page, 3)).toBeChecked();
    await expect(page.getByText('60 kg × 8', { exact: true })).toBeVisible();
    await expect(page.getByText('Séries 1 de 4 feitas', { exact: true })).toBeVisible();
    await expect.poll(() => api.enviados.filter((r) => r.serieUid === 'ws1').at(-1)).toMatchObject({ carga: 60, repeticoes: 8, concluida: true });

    // Lista do dia: a mesma contagem, 1 de 4 (o aquecimento marcado não conta).
    await page.goto(LISTA);
    await expect(page.getByText('1 de 4 séries feitas', { exact: true })).toBeVisible();
    await page.goto('/aluno/historico');
    await page.getByText('Por dia', { exact: true }).click();
    await expect(page.getByText(/WS 60 kg × 8/)).toBeVisible();
    await semEstourar(page);
    expect(api.naoTratadas).toEqual([]);
    expect(api.errosDaPagina).toEqual([]);
  });
}

test('chave do retorno ligada: a sugestão continua a mesma (última carga), e o "Anterior" fica na linha da série', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), ALUNO.id);
  const api = await abrir(page, true);
  await page.goto(EXERCICIO);
  for (const n of [3, 4, 5, 6]) await expect(peso(page, n)).toHaveAttribute('placeholder', '60');
  await expect(page.getByLabel('Série 3 da última vez: 55 kg × 9', { exact: true })).toBeVisible();
  for (const n of [3, 4, 5, 6]) await expect(peso(page, n)).toHaveValue('');
  await expect(page.getByText('Séries 0 de 4 feitas', { exact: true })).toBeVisible();
  await fazerSerie(page, 3);
  await page.getByText('60 kg × 8', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('feita-390-escuro.png') });
  for (const n of [4, 5, 6]) {
    await peso(page, n).fill('60');
    await fazerSerie(page, n);
  }
  await expect(page.getByText('Séries 4 de 4 feitas', { exact: true })).toBeVisible();
  // Concluir: os aquecimentos não feitos não tornam o treino parcial (D6).
  await page.getByRole('button', { name: /^(Revisar e c|C)oncluir treino$/ }).first().click();
  const folha = page.getByRole('dialog', { name: 'Concluir treino' });
  await expect(folha.getByText('Você marcou 4 de 4 séries.', { exact: true })).toBeVisible();
  await expect(folha.getByLabel('Fiz tudo', { exact: true })).toHaveAttribute('aria-checked', 'true');
  expect(api.errosDaPagina).toEqual([]);
});

test('sem internet: o ✓ com a sugestão funciona e a série fica salva no aparelho', async ({ page }) => {
  const api = await abrir(page, false);
  await page.goto(EXERCICIO);
  await expect(peso(page, 3)).toHaveAttribute('placeholder', '60');
  await page.context().setOffline(true);
  await fazerSerie(page, 3);
  await expect(marcar(page, 3)).toBeChecked();
  await expect(page.getByText('60 kg × 8', { exact: true })).toBeVisible();
  await page.context().setOffline(false);
  // A fila reenvia a série quando a internet volta: a mesma série, o mesmo id (o servidor é idempotente), carga 60 e uma só vez.
  await expect.poll(() => api.enviados.filter((r) => r.serieUid === 'ws1').length).toBeGreaterThan(0);
  const daWs = api.enviados.filter((r) => r.serieUid === 'ws1');
  expect(new Set(daWs.map((r) => r.id)).size).toBe(1);
  expect(daWs.at(-1)).toMatchObject({ carga: 60, concluida: true });
  expect(daWs).toHaveLength(1);
  expect(api.errosDaPagina).toEqual([]);
});

test('atingiu a meta da série de trabalho: o aviso fala do passo do próximo treino e o campo de peso continua vazio', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const api = await abrir(page, false);
  await page.goto(EXERCICIO);
  const reps = (n: number) => page.getByRole('textbox', { name: `Repetições da série ${n}`, exact: true });
  const NO_TOPO = 'Meta de 8 repetições atingida! No próximo treino a sugestão sobe +1 kg.';
  const PASSOU = 'Passou de 8 repetições (meta atingida)! No próximo treino a sugestão sobe +1 kg.';

  await reps(3).fill('8');
  await expect(page.getByText(NO_TOPO, { exact: true })).toHaveCount(1);
  await reps(3).fill('9');
  await expect(page.getByText(PASSOU, { exact: true })).toHaveCount(1);
  // O aviso não escreve a carga no campo.
  await expect(peso(page, 3)).toHaveValue('');
  // Aquecimento (meta 12 a 15) não avisa, mesmo passando do máximo.
  await reps(1).fill('20');
  await expect(page.getByText(/^Passou de 15/)).toHaveCount(0);
  await reps(3).fill('7');
  await expect(page.getByText(NO_TOPO, { exact: true })).toHaveCount(0);
  await expect(page.getByText(PASSOU, { exact: true })).toHaveCount(0);
  await semEstourar(page);
  expect(api.errosDaPagina).toEqual([]);
});
