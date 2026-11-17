import { expect, test, type Page } from '@playwright/test';

import type { PainelAluno } from '../src/api/tipos';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';
import { json, simularApi } from './api-falsa';

/**
 * "Trocar só hoje" (plano `docs/planos/trocar-exercicio.md`, passo 3b): o aluno escolhe uma alternativa que o treinador
 * deixou no exercício e tudo do dia passa a seguir o `exercicioId` dela (título, última carga, série enviada). Dados
 * fictícios: exercício "x1" com a alternativa "x2"; relógio em segunda, 19/10/2026.
 */
const EXERCICIO = '/aluno/sessao/sx/sxe1?data=2026-10-19';
const LISTA = '/aluno/sessao/sx?data=2026-10-19';

async function abrir(page: Page, comAlternativa = true) {
  await fixarHoje(page);
  const sessoes = [sessaoFalsa('sx', 'Treino curto', 1, 1)];
  sessoes[0]!.exercicios[0] = {
    ...sessoes[0]!.exercicios[0]!,
    exercicioId: 'x1',
    nome: 'Supino de teste',
    alternativas: comAlternativa ? [{ exercicioId: 'x2', nome: 'Supino com halteres de teste', videoUrl: null }] : [],
  };
  const base = await sessaoDeAlunoComTreino(page, sessoes);
  const painel = (base['GET /aluno/painel'] as { corpo: PainelAluno }).corpo;
  return simularApi(page, {
    ...base,
    'GET /aluno/painel': {
      corpo: {
        ...painel,
        ultimasCargas: { x1: { carga: 60, repeticoes: 10, data: '2026-10-16' }, x2: { carga: 24, repeticoes: 12, data: '2026-10-14' } },
      },
    },
    'POST /aluno/execucoes/lote': (p, route) => {
      const lote = (p.corpo as { registros: { id: string }[] }).registros;
      return json(route, { resultados: lote.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) });
    },
  });
}

const botaoTrocar = (page: Page) => page.getByRole('button', { name: /^Trocar .* só hoje$/ });
const folha = (page: Page) => page.getByRole('dialog', { name: 'Trocar só hoje' });
const peso = (page: Page, n: number) => page.getByRole('textbox', { name: `Peso da série ${n}, em quilos`, exact: true });
const reps = (page: Page, n: number) => page.getByRole('textbox', { name: `Repetições da série ${n}`, exact: true });
const marcar = (page: Page, n: number) => page.getByRole('checkbox', { name: `Série ${n} feita`, exact: true });
const enviados = (api: Awaited<ReturnType<typeof abrir>>) =>
  api.pedidos
    .filter((p) => p.metodo === 'POST' && p.caminho === '/aluno/execucoes/lote')
    .flatMap((p) => (p.corpo as { registros: { serieUid: string; exercicioId: string | null; concluida: boolean }[] }).registros);

for (const largura of [390, 1280]) {
  test(`troca o exercício só hoje e a série vai com o da alternativa (${largura} px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await abrir(page);
    await page.goto(EXERCICIO);
    await expect(page.getByRole('heading', { level: 1, name: 'Supino de teste' })).toBeVisible();

    await botaoTrocar(page).click();
    await expect(folha(page).getByRole('radio', { name: /Supino de teste/ })).toHaveAttribute('aria-checked', 'true');
    await page.screenshot({ path: testInfo.outputPath(`trocar-folha-${largura}.png`), fullPage: true });
    await folha(page).getByRole('radio', { name: /Supino com halteres de teste/ }).click();
    await expect(folha(page)).toHaveCount(0);

    // O dia agora é da alternativa: título, a linha neutra "no lugar de" e a última carga dela (24 kg, não 60).
    await expect(page.getByRole('heading', { level: 1, name: 'Supino com halteres de teste' })).toBeVisible();
    await expect(page.getByText('Só hoje · no lugar de Supino de teste', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`trocar-trocado-${largura}.png`), fullPage: true });

    await peso(page, 1).fill('26');
    await reps(page, 1).fill('10');
    await marcar(page, 1).click();
    await expect(marcar(page, 1)).toBeChecked();
    await expect.poll(() => enviados(api).filter((r) => r.serieUid === 'sxe1-s1' && r.concluida).length).toBeGreaterThan(0);
    expect(enviados(api).filter((r) => r.serieUid === 'sxe1-s1').at(-1)).toMatchObject({ exercicioId: 'x2', concluida: true });

    // Com série marcada, a troca fica presa: a folha explica como destravar e não oferece as opções.
    await botaoTrocar(page).click();
    await expect(folha(page).getByText(/Para trocar, desmarque as séries feitas\./)).toBeVisible();
    await expect(folha(page).getByRole('radio')).toHaveCount(0);
    await page.keyboard.press('Escape');

    // A lista do dia mostra o exercício que valeu hoje.
    await page.goto(LISTA);
    await expect(page.getByText('Supino com halteres de teste').first()).toBeVisible();
    expect(api.errosDaPagina).toEqual([]);
  });
}

test('voltar ao do plano desfaz a troca antes de marcar série', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const api = await abrir(page);
  await page.goto(EXERCICIO);
  await botaoTrocar(page).click();
  await folha(page).getByRole('radio', { name: /Supino com halteres de teste/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Supino com halteres de teste' })).toBeVisible();

  await botaoTrocar(page).click();
  await folha(page).getByRole('radio', { name: /Supino de teste.*Do plano/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Supino de teste' })).toBeVisible();
  await expect(page.getByText(/no lugar de/)).toHaveCount(0);

  await peso(page, 1).fill('60');
  await reps(page, 1).fill('10');
  await marcar(page, 1).click();
  await expect.poll(() => enviados(api).filter((r) => r.serieUid === 'sxe1-s1' && r.concluida).length).toBeGreaterThan(0);
  expect(enviados(api).filter((r) => r.serieUid === 'sxe1-s1').at(-1)).toMatchObject({ exercicioId: 'x1' });
  expect(api.errosDaPagina).toEqual([]);
});

test('sem alternativa no plano, o botão de trocar não aparece', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const api = await abrir(page, false);
  await page.goto(EXERCICIO);
  await expect(page.getByRole('heading', { level: 1, name: 'Supino de teste' })).toBeVisible();
  await expect(botaoTrocar(page)).toHaveCount(0);
  expect(api.errosDaPagina).toEqual([]);
});
