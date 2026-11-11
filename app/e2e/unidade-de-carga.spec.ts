import { expect, test, type Page } from '@playwright/test';

import type { AnterioresDoPacote, Carga, DiaDeTreino, PainelAluno, RegistroEnvio, Serie } from '../src/api/tipos';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';
import { ALUNO, json, sessao, simularApi } from './api-falsa';

/**
 * Unidade da carga (Libras, fase 1, `docs/planos/libras.md`): com a chave da plataforma ligada, o aluno escolhe kg ou lb em
 * Preferências; a carga continua guardada e enviada SEMPRE em kg, a libra só aparece e é digitada na tela (campo, dica,
 * painel "Fez com X?", histórico). Chave desligada: a escolha nem aparece e o app segue em kg, mesmo com `lb` salvo de antes.
 * Números fictícios; relógio em segunda, 19/10/2026, 12:00. 60 kg = 132,3 lb; 100 lb = 45,35 kg (o múltiplo de 0,05 kg que volta a 100 lb).
 */
const EXERCICIO = '/aluno/sessao/sx/sxe1?data=2026-10-19';

const NENHUMA: Carga = { modo: 'NENHUMA', percentualMin: null, percentualMax: null };
const DE_TRABALHO: Carga = { modo: 'CARGA_TRABALHO', percentualMin: null, percentualMax: null };
const aquecimento = (n: number): Serie => ({ uid: `aq${n}`, tipo: 'WARM_UP', repsMin: 12, repsMax: 15, carga: NENHUMA, esforco: null, descansoSegundos: null });
const ws = (n: number): Serie => ({ uid: `ws${n}`, tipo: 'WORKING', repsMin: 6, repsMax: 8, carga: DE_TRABALHO, esforco: null, descansoSegundos: null });

const ANTERIORES: AnterioresDoPacote = {
  ate: '2026-10-19',
  exercicios: { x1: { data: '2026-10-16', series: [{ tipo: 'WORKING', ordem: 1, carga: 60, repeticoes: 8, etapas: null }] } },
};

/** O histórico do servidor é montado com o que o app enviou: o servidor guarda o que chega (em kg). */
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
          id: r.id, serieUid: r.serieUid, tipo: 'WS', trabalho: true,
          carga: r.carga, unidade: 'kg', repeticoes: r.repeticoes, concluida: r.concluida, observacao: null,
        })),
      }],
    }],
  }];
}

/** `arredondamentoKg` é o passo da metodologia (o do −/+); o padrão do `sessaoDeAlunoComTreino` é 1 kg. */
async function abrir(page: Page, { chave, preferida, arredondamentoKg }: { chave: boolean; preferida?: 'kg' | 'lb'; arredondamentoKg?: number }) {
  await fixarHoje(page);
  if (preferida) await page.addInitScript(({ id, un }) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ unidadeDeCarga: un })), { id: ALUNO.id, un: preferida });
  const sessoes = [sessaoFalsa('sx', 'Treino curto', 1, 1)];
  sessoes[0]!.exercicios[0] = { ...sessoes[0]!.exercicios[0]!, exercicioId: 'x1', nome: 'Supino de teste', series: [aquecimento(1), ws(1), ws(2), ws(3)] };
  const base = await sessaoDeAlunoComTreino(page, sessoes);
  const painel = (base['GET /aluno/painel'] as { corpo: PainelAluno }).corpo;
  const enviados: RegistroEnvio[] = [];
  const api = await simularApi(page, {
    ...base,
    ...(chave ? await sessao(page, ALUNO, { unidadeDeCargaHabilitada: true }) : {}),
    'GET /aluno/painel': { corpo: { ...painel, configuracao: { ...painel.configuracao, arredondamentoKg: arredondamentoKg ?? painel.configuracao.arredondamentoKg }, ultimasCargas: { x1: { carga: 60, repeticoes: 7, data: '2026-10-16' } }, anteriores: ANTERIORES } },
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
  });
  return { ...api, enviados };
}

const pesoEm = (page: Page, n: number, unidade: 'libras' | 'quilos') => page.getByRole('textbox', { name: `Peso da série ${n}, em ${unidade}`, exact: true });
const marcar = (page: Page, n: number) => page.getByRole('checkbox', { name: `Série ${n} feita`, exact: true });
/** Preferências do aluno ficam numa folha aberta pelo item "Aparência e preferências" da Conta. */
/** Opção do `Escolha` (botão dentro do grupo, marcada com `aria-checked`). */
const opcao = (page: Page, rotulo: string) => page.getByRole('radiogroup', { name: 'Unidade da carga' }).getByRole('radio', { name: rotulo, exact: true });
const abrirPreferencias = async (page: Page) => {
  await page.goto('/aluno/conta');
  await page.getByRole('button', { name: /^Aparência e preferências/ }).click();
};
const semEstourar = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

for (const largura of [390, 1280]) {
  test(`aluno em libras: digita 100 lb, a API recebe 45,35 kg, e volta a kg sem derrubar nada (${largura} px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await abrir(page, { chave: true });

    // A escolha existe em Preferências, com a chave ligada; o padrão é kg.
    await abrirPreferencias(page);
    await expect(page.getByText('Unidade da carga', { exact: true })).toBeVisible();
    await expect(opcao(page, 'Quilos (kg)')).toHaveAttribute('aria-checked', 'true');
    await opcao(page, 'Libras (lb)').click();
    await expect(opcao(page, 'Libras (lb)')).toHaveAttribute('aria-checked', 'true');

    // Exercício: campo em libras, dica convertida (60 kg = 132,3 lb), "Última vez" e "Anterior" também.
    await page.goto(EXERCICIO);
    for (const n of [2, 3, 4]) await expect(pesoEm(page, n, 'libras')).toHaveValue('');
    await expect(page.getByText('Sugestão: 132,3 lb × 8 reps · Última vez: 132,3 lb × 7', { exact: true })).toHaveCount(3);
    await expect(page.getByText(/ kg/)).toHaveCount(0);
    await semEstourar(page);
    await page.screenshot({ path: testInfo.outputPath(`lb-${largura}.png`), fullPage: true });

    // Digita 100 lb e marca: o servidor recebe 45,35 kg (nunca 100).
    await pesoEm(page, 2, 'libras').fill('100');
    await marcar(page, 2).click();
    await expect(marcar(page, 2)).toBeChecked();
    await expect(pesoEm(page, 2, 'libras')).toHaveValue('100');
    await expect.poll(() => api.enviados.filter((r) => r.serieUid === 'ws1').at(-1)).toMatchObject({ carga: 45.35, concluida: true });

    // Painel na unidade do aluno; "Sim" grava a sugestão em kg (60 × 8), não 132,3.
    await marcar(page, 3).click();
    await expect(page.getByText('Fez 132,3 lb × 8 reps?', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sim, 132,3 lb × 8, série 3', exact: true }).click();
    await expect(marcar(page, 3)).toBeChecked();
    await expect.poll(() => api.enviados.filter((r) => r.serieUid === 'ws2').at(-1)).toMatchObject({ carga: 60, repeticoes: 8, concluida: true });
    await expect(pesoEm(page, 3, 'libras')).toHaveValue('132,3');
    // Daqui em diante nada novo pode ser enviado: recarregar, ver o histórico e trocar de unidade não regravam carga.
    const enviadosAntes = api.enviados.length;
    expect(enviadosAntes).toBeGreaterThan(0);

    // Recarregar: o que está guardado em kg volta em libras sem derivar (45,35 kg -> 100 lb).
    await page.reload();
    await expect(pesoEm(page, 2, 'libras')).toHaveValue('100');

    // Histórico do aluno na unidade dele; o envio à API continua em kg.
    await page.goto('/aluno/historico');
    // Por divisão (a aba padrão) e o progresso do exercício: a carga em libras, nenhum "kg" de carga na tela.
    await expect(page.getByLabel('Cargas de Supino de teste', { exact: true }).getByText('132,3 lb', { exact: true })).toBeVisible();
    await expect(page.getByText(/ kg/)).toHaveCount(0);
    await page.getByText('Por dia', { exact: true }).click();
    await expect(page.getByText(/WS 100 lb × sem repetições/)).toBeVisible();
    await semEstourar(page);

    // Voltar a kg: a mesma série mostra 45,35 kg e nada foi reenviado em outra unidade.
    await abrirPreferencias(page);
    await opcao(page, 'Quilos (kg)').click();
    await page.goto(EXERCICIO);
    await expect(pesoEm(page, 2, 'quilos')).toHaveValue('45,35');
    await expect(pesoEm(page, 3, 'quilos')).toHaveValue('60');
    expect(api.enviados).toHaveLength(enviadosAntes);
    expect(api.errosDaPagina).toEqual([]);
  });
}

// Em kg o rótulo é o de antes, sem a unidade por extenso (`CampoDeCarga.rotuloDaCarga`).
const baseDoDia = (page: Page, unidade: 'libras' | 'quilos') =>
  page.getByRole('textbox', { name: unidade === 'libras' ? 'Carga de trabalho do dia, em libras' : 'Carga de trabalho do dia', exact: true });

test('aluno em libras: o passo de 1 kg do painel de teste vira 2,5 lb (o mínimo), sem 102,2', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const api = await abrir(page, { chave: true, preferida: 'lb' });
  await page.goto(EXERCICIO);
  await baseDoDia(page, 'libras').fill('100');
  await page.getByRole('button', { name: 'Aumentar 2,5 lb em carga de trabalho', exact: true }).click();
  await expect(baseDoDia(page, 'libras')).toHaveValue('102,5');
  await page.getByRole('button', { name: 'Diminuir 2,5 lb em carga de trabalho', exact: true }).click();
  await expect(baseDoDia(page, 'libras')).toHaveValue('100');
  await expect(page.getByText(/ kg/)).toHaveCount(0);
  expect(api.errosDaPagina).toEqual([]);
});

test('aluno em libras com arredondamento de 2,5 kg: o rótulo diz 5 lb e 100 lb + 5 lb = 105 lb', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const api = await abrir(page, { chave: true, preferida: 'lb', arredondamentoKg: 2.5 });
  await page.goto(EXERCICIO);
  await baseDoDia(page, 'libras').fill('100');
  await page.getByRole('button', { name: 'Aumentar 5 lb em carga de trabalho', exact: true }).click();
  await expect(baseDoDia(page, 'libras')).toHaveValue('105');
  await page.getByRole('button', { name: 'Diminuir 5 lb em carga de trabalho', exact: true }).click();
  await page.getByRole('button', { name: 'Diminuir 5 lb em carga de trabalho', exact: true }).click();
  await expect(baseDoDia(page, 'libras')).toHaveValue('95');
  expect(api.errosDaPagina).toEqual([]);
});

test('em kg o passo continua o arredondamento da metodologia (sem mudança)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const api = await abrir(page, { chave: true, preferida: 'kg' });
  await page.goto(EXERCICIO);
  await baseDoDia(page, 'quilos').fill('100');
  await page.getByRole('button', { name: 'Aumentar 1 kg em carga de trabalho', exact: true }).click();
  await expect(baseDoDia(page, 'quilos')).toHaveValue('101');
  expect(api.errosDaPagina).toEqual([]);
});

test('chave desligada: sem a escolha e tudo em kg, mesmo com lb salvo de antes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const api = await abrir(page, { chave: false, preferida: 'lb' });
  await abrirPreferencias(page);
  await expect(page.getByText('Tema', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Unidade da carga', { exact: true })).toHaveCount(0);

  await page.goto(EXERCICIO);
  await expect(pesoEm(page, 2, 'quilos')).toHaveValue('');
  await expect(page.getByText('Sugestão: 60 kg × 8 reps · Última vez: 60 kg × 7', { exact: true })).toHaveCount(3);
  await expect(page.getByText(/ lb/)).toHaveCount(0);
  await pesoEm(page, 2, 'quilos').fill('62,5');
  await marcar(page, 2).click();
  await expect.poll(() => api.enviados.filter((r) => r.serieUid === 'ws1').at(-1)).toMatchObject({ carga: 62.5, concluida: true });
  expect(api.errosDaPagina).toEqual([]);
});

test('controle da chave: o mesmo lb salvo, com a chave ligada, mostra o campo em libras', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const api = await abrir(page, { chave: true, preferida: 'lb' });
  await page.goto(EXERCICIO);
  await expect(pesoEm(page, 2, 'libras')).toHaveValue('');
  await expect(page.getByText('Sugestão: 132,3 lb × 8 reps · Última vez: 132,3 lb × 7', { exact: true })).toHaveCount(3);
  await expect(page.getByText(/ kg/)).toHaveCount(0);
  expect(api.errosDaPagina).toEqual([]);
});
