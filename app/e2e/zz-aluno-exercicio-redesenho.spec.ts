import { mkdirSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import type { PainelAluno, RegistroEnvio, Serie, SessoesConcluidasResponse } from '../src/api/tipos';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';
import { ALUNO, json, sessao, simularApi } from './api-falsa';

/**
 * Tela do exercício redesenhada ("Treino na academia", 25/11). Dados fictícios: "Agachamento de teste" (peso livre, 3 WS
 * de 6 a 8 reps até a falha, descanso de 30 s) e depois "Leg press de teste". Da última vez (16/10): 90 kg × 7. O relógio
 * fica parado em 19/10/2026 12:00 e anda só por `passaram` (os temporizadores da tela seguem reais e releem a hora).
 * Capturas dos três estados (A recém-aberto, B uma série feita com o descanso, C tudo feito com o recorde) em 390 px.
 */
const PASTA = 'C:/Users/gusta/Documents/consultoria-app/capturas/24-11/20-treino-aluno';
const EXERCICIO = '/aluno/sessao/pernas/agacho?data=2026-10-19';
const WS = (uid: string): Serie => ({
  uid, tipo: 'WORKING', repsMin: 6, repsMax: 8, carga: { modo: 'CARGA_TRABALHO', percentualMin: null, percentualMax: null }, esforco: { rir: 0 }, descansoSegundos: 30,
});

async function abrir(page: Page, tema: 'CLARO' | 'ESCURO' = 'ESCURO', comHistorico = true) {
  await fixarHoje(page);
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [ALUNO.id, tema] as const);
  const s = sessaoFalsa('pernas', 'Pernas', 1, 2);
  s.exercicios[0] = { ...s.exercicios[0]!, uid: 'agacho', exercicioId: 'x1', nome: 'Agachamento de teste', modalidade: 'LIVRE', videoUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaaa', series: [WS('s1'), WS('s2'), WS('s3')] };
  s.exercicios[1] = { ...s.exercicios[1]!, uid: 'leg', nome: 'Leg press de teste' };
  const base = await sessaoDeAlunoComTreino(page, [s]);
  const painel = (base['GET /aluno/painel'] as { corpo: PainelAluno }).corpo;
  const enviados: RegistroEnvio[] = [];
  const api = await simularApi(page, {
    ...base,
    ...(await sessao(page, ALUNO, { retornoHabilitado: true })),
    'GET /aluno/painel': { corpo: { ...painel, configuracao: { arredondamentoKg: 0.5, tipoTrabalho: 'WS' }, ultimasCargas: comHistorico ? { x1: { carga: 90, repeticoes: 7, data: '2026-10-16' } } : {} } },
    'GET /aluno/sessoes-concluidas': { corpo: { totalConcluidos: 0, sessoes: [] } satisfies SessoesConcluidasResponse },
    'POST /aluno/execucoes/lote': (p, route) => {
      const lote = (p.corpo as { registros: RegistroEnvio[] }).registros;
      enviados.push(...lote);
      return json(route, { resultados: lote.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) });
    },
  });
  return { ...api, enviados };
}

const carga = (page: Page, n: number) => page.getByRole('textbox', { name: `Carga da série ${n}, em quilos`, exact: true });
const reps = (page: Page, n: number) => page.getByRole('textbox', { name: `Repetições da série ${n}`, exact: true });
const marcar = (page: Page, n: number) => page.getByRole('checkbox', { name: new RegExp(`^Marcar série ${n} como feita`) });
const passaram = (page: Page, segundos: number) => page.clock.setFixedTime(new Date(new Date('2026-10-19T12:00:00-03:00').getTime() + segundos * 1000));
const capturar = async (page: Page, nome: string) => {
  mkdirSync(PASTA, { recursive: true });
  await page.screenshot({ path: `${PASTA}/${nome}.png` });
};

for (const tema of ['ESCURO', 'CLARO'] as const) {
  test(`exercício redesenhado, três estados (390 px, ${tema.toLowerCase()})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { errosDaPagina, naoTratadas, enviados } = await abrir(page, tema);
    await page.goto(EXERCICIO);

    // Topo fixo, cabeçalho e o bloco da carga de trabalho.
    await expect(page.getByText('Segunda - Pernas', { exact: true })).toBeVisible();
    await expect(page.getByText('Exercício 1 de 2', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Agachamento de teste' })).toBeVisible();
    await expect(page.getByText('Peso livre · 3 séries · meta da WS: 6 a 8 reps', { exact: true })).toBeVisible();
    // Os três botões cabem lado a lado em 390 px, na mesma altura.
    for (const nome of ['Vídeo de Agachamento de teste', 'Como fazer Agachamento de teste', 'Descanso 0:30: iniciar descanso']) await expect(page.getByRole('button', { name: nome, exact: true })).toBeVisible();
    const caixas = await Promise.all(['Vídeo de Agachamento de teste', 'Descanso 0:30: iniciar descanso'].map((nome) => page.getByRole('button', { name: nome, exact: true }).boundingBox()));
    expect(Math.abs((caixas[0]?.y ?? 0) - (caixas[1]?.y ?? 1))).toBeLessThan(2);
    expect(Math.abs((caixas[0]?.height ?? 0) - (caixas[1]?.height ?? 99))).toBeLessThan(2); // "Descanso 0:30" numa linha só
    await expect(page.getByText('Carga de trabalho de hoje', { exact: true })).toBeVisible();
    await expect(page.getByText('Último registro: 90 kg × 7 em 16/10', { exact: true })).toBeVisible();
    await expect(page.getByText('Séries 0 de 3 feitas', { exact: true })).toBeVisible();
    // O cartão antigo Duração/Volume/Séries saiu.
    await expect(page.getByText('Volume', { exact: true })).toHaveCount(0);

    // (A) Série 1 ativa, sugestões apagadas nos campos ("sugerido"): a progressão sugere 90 kg × 8, então o ✓ já habilita.
    await expect(carga(page, 1)).toHaveValue('');
    await expect(carga(page, 1)).toHaveAttribute('placeholder', '90');
    await expect(reps(page, 1)).toHaveValue('');
    await expect(reps(page, 1)).toHaveAttribute('placeholder', '8');
    await expect(page.getByText('sugerido', { exact: true }).first()).toBeVisible();
    await expect(marcar(page, 1)).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Próximo: Leg press de teste', exact: true })).toBeVisible();
    await capturar(page, `A-recem-aberto-390-${tema.toLowerCase()}`);

    // ✓ sem digitar nada usa as sugestões; inicia o descanso na barra azul.
    await marcar(page, 1).click();
    await expect.poll(() => enviados.find((r) => r.serieUid === 's1')).toMatchObject({ carga: 90, repeticoes: 8, concluida: true });
    await expect(page.getByLabel('30 segundos restantes', { exact: true })).toBeVisible();
    for (const nome of ['Diminuir 15 segundos', 'Aumentar 15 segundos', 'Pular descanso']) await expect(page.getByRole('button', { name: nome, exact: true })).toBeVisible();
    await expect(page.getByText('90 kg × 8', { exact: true })).toBeVisible();
    await expect(page.getByText('Séries 1 de 3 feitas', { exact: true })).toBeVisible();
    // (B) Uma série feita (verde) e o descanso rodando.
    await capturar(page, `B-serie-feita-descanso-390-${tema.toLowerCase()}`);
    await page.getByRole('button', { name: 'Aumentar 15 segundos', exact: true }).click();
    await expect(page.getByLabel('45 segundos restantes', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Diminuir 15 segundos', exact: true }).click();
    await expect(page.getByLabel('30 segundos restantes', { exact: true })).toBeVisible();
    // No fim do descanso a barra volta ao "Próximo".
    await passaram(page, 31);
    await expect(page.getByRole('button', { name: 'Próximo: Leg press de teste', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pular descanso', exact: true })).toHaveCount(0);

    // (C) Todas feitas: recorde âmbar (mesma carga, mais reps) e o "Próximo exercício" como principal.
    await marcar(page, 2).click();
    await page.getByRole('button', { name: 'Pular descanso', exact: true }).click();
    await marcar(page, 3).click();
    await page.getByRole('button', { name: 'Pular descanso', exact: true }).click();
    await expect(page.getByText('Séries 3 de 3 feitas', { exact: true })).toBeVisible();
    await expect(page.getByText('Recorde na WS', { exact: true })).toBeVisible();
    await expect(page.getByText('90 kg × 8 (antes: 90 kg × 7 em 16/10)', { exact: true })).toBeVisible();
    const proximo = page.getByRole('button', { name: 'Próximo exercício: Leg press de teste', exact: true });
    await expect(proximo).toBeVisible();
    await page.getByText('Recorde na WS', { exact: true }).scrollIntoViewIfNeeded();
    await capturar(page, `C-tudo-feito-recorde-390-${tema.toLowerCase()}`);
    await proximo.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Leg press de teste' })).toBeVisible();
    expect(errosDaPagina).toEqual([]);
    expect(naoTratadas).toEqual([]);
  });
}

test('stepper: passo de 0,5 kg por toque, repete ao segurar, e o digitado sem ✓ sobrevive a recarregar (390 px)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errosDaPagina, enviados } = await abrir(page, 'ESCURO', false);
  await page.goto(EXERCICIO);
  // Sem histórico não há sugestão: o ✓ espera o kg e as reps, e a série ativa diz o que falta.
  await expect(page.getByText('Sem registro anterior', { exact: true })).toBeVisible();
  await expect(marcar(page, 1)).toBeDisabled();
  await expect(page.getByText('Digite a carga para marcar a série.', { exact: true })).toBeVisible();
  // (D) Sem sugestão: ✓ tracejado e desabilitado, campos vazios com "—".
  await capturar(page, 'D-sem-historico-390-escuro');
  const mais = page.getByRole('button', { name: 'Aumentar 0,5 kg em carga da série 1', exact: true });
  await mais.click();
  await expect(carga(page, 1)).toHaveValue('0,5'); // vazio e sem sugestão: parte do 0
  await mais.click();
  await page.getByRole('button', { name: 'Diminuir 0,5 kg em carga da série 1', exact: true }).click();
  await expect(carga(page, 1)).toHaveValue('0,5');
  await expect(page.getByText('Digite as repetições para marcar a série.', { exact: true })).toBeVisible();
  await expect(marcar(page, 1)).toBeDisabled();
  // Segurar: espera 400 ms e repete a cada 100 ms (relógio real; ao menos três passos em ~900 ms).
  await mais.hover();
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.mouse.up();
  await expect.poll(async () => Number((await carga(page, 1).inputValue()).replace(',', '.'))).toBeGreaterThanOrEqual(2);
  // Teclado: Enter soma um passo.
  const antes = Number((await carga(page, 1).inputValue()).replace(',', '.'));
  await mais.focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => Number((await carga(page, 1).inputValue()).replace(',', '.'))).toBe(antes + 0.5);
  // Rascunho: o digitado sem ✓ volta depois de recarregar a página, e nada foi enviado.
  await carga(page, 2).fill('85');
  await reps(page, 2).fill('7');
  await page.reload();
  await expect(carga(page, 2)).toHaveValue('85');
  await expect(reps(page, 2)).toHaveValue('7');
  expect(enviados).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('exercício redesenhado em 1280 px (a web não quebra)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errosDaPagina } = await abrir(page, 'CLARO');
  await page.goto(EXERCICIO);
  await expect(page.getByRole('heading', { level: 1, name: 'Agachamento de teste' })).toBeVisible();
  await marcar(page, 1).click();
  await expect(page.getByLabel('30 segundos restantes', { exact: true })).toBeVisible();
  await capturar(page, 'B-serie-feita-descanso-1280-claro');
  expect(errosDaPagina).toEqual([]);
});
