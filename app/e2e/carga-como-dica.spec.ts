import { expect, test, type Page } from '@playwright/test';

import type { AnterioresDoPacote, Carga, DiaDeTreino, PainelAluno, RegistroEnvio, Serie, SessoesConcluidasResponse } from '../src/api/tipos';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';
import { ALUNO, json, sessao, simularApi } from './api-falsa';

/**
 * Carga como dica (passo 3 de `docs/planos/execucao-referencia-e-progressao.md`, D1, D2, D4, D5, D6 e D7, 02/11): o campo de
 * carga começa vazio e a sugestão fica ao lado ("Sugestão: 60 kg · Última vez: 60 kg × 7"), com a meta de repetições; o ✓
 * com o peso vazio pergunta "Fez com 60 kg?" na própria tela; "Sem carga" grava a série feita sem carga, que o histórico
 * mostra como "feito, sem carga"; a contagem "x de y" só conta trabalho e pós-trabalho (2 aquecimentos + 4 WS = "x de 4").
 * A "Última vez" da dica vem de `ultimasCargas` (independe da chave do retorno, D7): com a chave ligada e "anteriores"
 * diferentes no pacote, a dica não muda. Exercício e números fictícios; relógio em segunda, 19/10/2026, 12:00.
 */
const LISTA = '/aluno/sessao/sx?data=2026-10-19';
const EXERCICIO = '/aluno/sessao/sx/sxe1?data=2026-10-19';
const DICA = 'Sugestão: 60 kg · Última vez: 60 kg × 7';

const NENHUMA: Carga = { modo: 'NENHUMA', percentualMin: null, percentualMax: null, referenciaUid: null };
const DE_TRABALHO: Carga = { modo: 'CARGA_TRABALHO', percentualMin: null, percentualMax: null, referenciaUid: null };
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

const peso = (page: Page, n: number) => page.getByRole('textbox', { name: `Peso da série ${n}, em quilos`, exact: true });
const marcar = (page: Page, n: number) => page.getByRole('checkbox', { name: `Série ${n} feita`, exact: true });
const semEstourar = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

for (const largura of [390, 1280]) {
  test(`campo vazio com a dica, painel do ✓, "Sem carga" no histórico e contagem só do trabalho (${largura} px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await abrir(page, false);
    await page.goto(EXERCICIO);

    // D1: nenhum campo de peso vem preenchido; a dica aparece nas quatro WS, não nos aquecimentos.
    for (const n of [1, 2, 3, 4, 5, 6]) await expect(peso(page, n)).toHaveValue('');
    await expect(page.getByText(DICA, { exact: true })).toHaveCount(4);
    // Sem base do dia digitada, a origem diz que a conta partiu da última vez.
    await expect(page.getByText('carga da última vez', { exact: true })).toHaveCount(4);
    // D5: a meta de repetições ao lado do campo, em cada série.
    await expect(page.getByLabel('Meta da série 3: 6 a 8 reps', { exact: false })).toBeVisible();
    // D6: a contagem do treino não conta os aquecimentos.
    await expect(page.getByText('0 de 4 séries feitas neste treino.', { exact: true }).first()).toBeVisible();
    await semEstourar(page);
    await page.screenshot({ path: testInfo.outputPath(`dica-${largura}.png`), fullPage: true });

    // Aquecimento sem sugestão: o ✓ grava direto e não entra na contagem.
    await marcar(page, 1).click();
    await expect(marcar(page, 1)).toBeChecked();
    await expect(page.getByText('0 de 4 séries feitas neste treino.', { exact: true }).first()).toBeVisible();

    // D2: WS com o peso vazio e sugestão: o ✓ não grava no escuro, pergunta na tela.
    await marcar(page, 3).click();
    await expect(page.getByText('Fez com 60 kg?', { exact: true })).toBeVisible();
    await expect(marcar(page, 3)).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Sim, 60 kg, série 3', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Outra carga, série 3', exact: true })).toBeVisible();
    await semEstourar(page);
    await page.screenshot({ path: testInfo.outputPath(`painel-${largura}.png`), fullPage: true });

    // "Outra carga" fecha o painel e leva ao campo de peso, sem gravar.
    await page.getByRole('button', { name: 'Outra carga, série 3', exact: true }).click();
    await expect(page.getByText('Fez com 60 kg?', { exact: true })).toHaveCount(0);
    await expect(peso(page, 3)).toBeFocused();
    await expect(marcar(page, 3)).not.toBeChecked();

    // "Sem carga" grava a série feita sem carga (nada inventado) e ela entra na contagem.
    await marcar(page, 3).click();
    await page.getByRole('button', { name: 'Sem carga, série 3', exact: true }).click();
    await expect(marcar(page, 3)).toBeChecked();
    await expect(peso(page, 3)).toHaveValue('');
    await expect(page.getByText('1 de 4 séries feitas neste treino.', { exact: true }).first()).toBeVisible();
    await expect.poll(() => api.enviados.filter((r) => r.serieUid === 'ws1').at(-1)).toMatchObject({ carga: null, repeticoes: null, concluida: true });
    await expect(page.getByText(DICA, { exact: true })).toHaveCount(3); // feita não mostra a dica

    // "Sim, 60 kg" grava a sugestão.
    await marcar(page, 4).click();
    await page.getByRole('button', { name: 'Sim, 60 kg, série 4', exact: true }).click();
    await expect(marcar(page, 4)).toBeChecked();
    await expect(peso(page, 4)).toHaveValue('60');
    await expect.poll(() => api.enviados.filter((r) => r.serieUid === 'ws2').at(-1)).toMatchObject({ carga: 60, concluida: true });

    // Lista do dia: a mesma contagem, 2 de 4 (o aquecimento marcado não conta).
    await page.goto(LISTA);
    await expect(page.getByText('2 de 4 séries feitas', { exact: true })).toBeVisible();

    // D4: o histórico diz o que faltou numa série feita, no lugar do "—". Por divisão (a aba padrão), a linha do dia é a
    // WS com carga: 60 kg e "sem repetições".
    await page.goto('/aluno/historico');
    const tabela = page.getByLabel('Cargas de Supino de teste', { exact: true });
    await expect(tabela.getByText('60 kg', { exact: true })).toBeVisible();
    await expect(tabela.getByText('sem repetições', { exact: true })).toBeVisible();
    await page.getByText('Por dia', { exact: true }).click();
    await expect(page.getByText(/WS feito, sem carga/)).toBeVisible();
    await expect(page.getByText(/WS 60 kg × sem repetições/)).toBeVisible();
    await semEstourar(page);
    expect(api.naoTratadas).toEqual([]);
    expect(api.errosDaPagina).toEqual([]);
  });
}

test('chave do retorno ligada: a dica continua a mesma (última carga), e o "Anterior" fica na linha da série', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 });
  // Tema escuro escolhido nas preferências: o painel e a dica usam só tokens.
  await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), ALUNO.id);
  const api = await abrir(page, true);
  await page.goto(EXERCICIO);
  await expect(page.getByText(DICA, { exact: true })).toHaveCount(4);
  await expect(page.getByText(/Última vez: 55 kg/)).toHaveCount(0);
  await expect(page.getByLabel('Série 3 da última vez: 55 kg × 9', { exact: true })).toBeVisible();
  for (const n of [3, 4, 5, 6]) await expect(peso(page, n)).toHaveValue('');
  // A faixa do treino ao vivo conta só as quatro WS.
  await expect(page.getByLabel('0 de 4 séries feitas', { exact: true })).toBeVisible();
  await marcar(page, 3).click();
  await expect(page.getByText('Fez com 60 kg?', { exact: true })).toBeVisible();
  await page.getByText('Fez com 60 kg?', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('painel-390-escuro.png') });
  await page.getByRole('button', { name: 'Sim, 60 kg, série 3', exact: true }).click();
  for (const n of [4, 5, 6]) {
    await peso(page, n).fill('60');
    await marcar(page, n).click();
  }
  await expect(page.getByLabel('4 de 4 séries feitas', { exact: true })).toBeVisible();
  // Concluir: os aquecimentos não feitos não tornam o treino parcial (D6).
  await page.getByRole('button', { name: /^(Revisar e c|C)oncluir treino$/ }).first().click();
  const folha = page.getByRole('dialog', { name: 'Concluir treino' });
  await expect(folha.getByText('Você marcou 4 de 4 séries.', { exact: true })).toBeVisible();
  await expect(folha.getByLabel('Fiz tudo', { exact: true })).toHaveAttribute('aria-checked', 'true');
  expect(api.errosDaPagina).toEqual([]);
});

test('sem internet: o painel do ✓ funciona e a série fica salva no aparelho', async ({ page }) => {
  const api = await abrir(page, false);
  await page.goto(EXERCICIO);
  await expect(page.getByText(DICA, { exact: true })).toHaveCount(4);
  await page.context().setOffline(true);
  await marcar(page, 3).click();
  await page.getByRole('button', { name: 'Sim, 60 kg, série 3', exact: true }).click();
  await expect(marcar(page, 3)).toBeChecked();
  await expect(peso(page, 3)).toHaveValue('60');
  await page.context().setOffline(false);
  expect(api.errosDaPagina).toEqual([]);
});
