import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { sessaoComCardio, sessaoDeAlunoComTreino } from './aluno';
import { ALUNO, json, simularApi } from './api-falsa';
import type { Cardio, RegistroEnvio, Sessao } from '../src/api/tipos';

/**
 * Cardio no app do aluno (pedido 27, passo P3 de docs/planos/cardio-e-hiit.md): o timer do intervalado conta cada fase
 * pelo relógio de parede ("Volta 3 de 10", pausar, pular) e marca o bloco como feito no fim pelo mesmo registro do ✓; o
 * pacote com as chaves novas é aceito pelo aparelho (D16); o bloco novo mostra o protocolo no cabeçalho e a prévia do
 * treinador. Relógio falso do Playwright, com o `Date.now` andando (o `fixarHoje` congelaria o timer); dados fictícios.
 */
const PASTA = 'C:/Users/gusta/Documents/consultoria-app/capturas/27-11-cardio-aluno';
const CAMINHO = '/aluno/sessao/cardio/esteira?data=2026-10-19';

/**
 * Intervalado de antes (sem `modo`): o timer vale para ele e ele chega inteiro à tela hoje. O bloco novo (SIT, com
 * `modo`, `protocolo`, aquecimento…) só chega inteiro à tela quando `normalizarTreino` (dominio/editorTreino.ts,
 * `copiarCardio`) copiar as chaves novas (passo P2, aceite comum do plano); por isso o teste do protocolo fica à parte.
 */
const INTERVALADO_ANTIGO: Cardio = { duracaoMin: null, distanciaKm: null, ritmo: null, zona: 5, intervalos: { trabalhoSeg: 30, descansoSeg: 30, voltas: 10 } };
const SIT: Cardio = {
  modo: 'INTERVALADO', protocolo: 'SIT', duracaoMin: null, distanciaKm: null, ritmo: null, zona: null, esforcoMaximo: true,
  aquecimentoSeg: 240, desaquecimentoSeg: 180, recuperacaoTipo: 'PASSIVA', intervalos: { trabalhoSeg: 30, descansoSeg: 180, voltas: 6 },
};

/** A esteira de `sessaoComCardio` com três blocos: o intervalado de antes, o SIT novo e o contínuo de antes. */
function sessaoComHiit(): Sessao[] {
  const [sessao] = sessaoComCardio();
  const esteira = sessao.exercicios[1];
  const [s1, s2] = esteira.series;
  esteira.series = [
    { ...s1, uid: 'esteira-intervalado', cardio: INTERVALADO_ANTIGO },
    { ...s1, uid: 'esteira-sit', cardio: SIT },
    { ...s2, uid: 'esteira-continuo' },
  ];
  return [sessao];
}

async function abrir(page: Page, tema: 'CLARO' | 'ESCURO') {
  await page.clock.install({ time: new Date('2026-10-19T12:00:00-03:00') });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [ALUNO.id, tema] as const);
  const enviados: RegistroEnvio[] = [];
  const api = await simularApi(page, {
    ...(await sessaoDeAlunoComTreino(page, sessaoComHiit())),
    'POST /aluno/execucoes/lote': (p, route) => {
      const lote = (p.corpo as { registros: RegistroEnvio[] }).registros;
      enviados.push(...lote);
      return json(route, { resultados: lote.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) });
    },
  });
  await page.goto(CAMINHO);
  return { ...api, enviados };
}

async function capturar(page: Page, nome: string) {
  mkdirSync(PASTA, { recursive: true });
  await page.screenshot({ path: `${PASTA}/${nome}.png`, fullPage: true });
}

const semRolagemDeLado = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const largura of [390, 1280]) {
  test(`aluno: o timer do intervalado conta as fases, pausa, pula e marca o bloco no fim (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await abrir(page, 'CLARO');
    await expect(page.getByText('Bloco 1 · Intervalado', { exact: true })).toBeVisible();
    // O contínuo de antes (sem modo) segue com as linhas de sempre e sem timer.
    await expect(page.getByText('Bloco 3 · Contínuo', { exact: true })).toBeVisible();
    await expect(page.getByText('Duração: 10 min', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Iniciar timer do bloco/ })).toHaveCount(2);
    expect(await semRolagemDeLado(page)).toBe(true);
    await capturar(page, `cardio-blocos-claro-${largura}`);

    await page.getByRole('button', { name: 'Iniciar timer do bloco 1', exact: true }).click();
    const timer = page.getByRole('timer', { name: 'Timer do bloco 1' });
    await expect(timer.getByText('Estímulo', { exact: true })).toBeVisible();
    await expect(timer.getByText('Volta 1 de 10', { exact: true })).toBeVisible();
    await expect(timer.getByText('0:30', { exact: true })).toBeVisible();
    // 2 min no relógio de parede sem tique no meio (aba escondida): 2 voltas de 1 min, e o timer acerta a fase.
    await page.clock.fastForward('02:00');
    await expect(timer.getByText('Volta 3 de 10', { exact: true })).toBeVisible();
    await expect(timer.getByText('Estímulo', { exact: true })).toBeVisible();
    await expect(timer.getByText('Zona 5', { exact: true })).toBeVisible();
    await expect(timer.getByText('0:30', { exact: true })).toBeVisible();
    await expect(timer.getByText('Depois: Recuperação 30 s', { exact: true })).toBeVisible();
    expect(await semRolagemDeLado(page)).toBe(true);
    await capturar(page, `cardio-timer-estimulo-claro-${largura}`);

    // Pausado, o tempo não anda; retomar continua de onde parou.
    await page.clock.fastForward('00:10');
    await expect(timer.getByText('0:20', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Pausar timer do bloco 1', exact: true }).click();
    await page.clock.fastForward('02:00');
    await expect(timer.getByText('0:20', { exact: true })).toBeVisible();
    await expect(timer.getByText('Zona 5 · Pausado', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Parar timer do bloco 1', exact: true })).toBeVisible();
    await capturar(page, `cardio-timer-pausado-claro-${largura}`);
    await page.getByRole('button', { name: 'Retomar timer do bloco 1', exact: true }).click();
    await page.getByRole('button', { name: 'Pular fase do bloco 1', exact: true }).click();
    await expect(timer.getByText('Recuperação', { exact: true })).toBeVisible();
    await expect(timer.getByText('Volta 3 de 10', { exact: true })).toBeVisible();

    // No fim, o bloco é marcado como feito pelo mesmo registro do ✓ (carga e repetições nulas), uma vez.
    expect(api.enviados).toEqual([]);
    await page.clock.fastForward('20:00');
    await expect.poll(() => api.enviados.filter((r) => r.serieUid === 'esteira-intervalado').length).toBe(1);
    expect(api.enviados[0]).toMatchObject({ serieUid: 'esteira-intervalado', exercicioUid: 'esteira', carga: null, repeticoes: null, concluida: true });
    await expect(page.getByRole('checkbox', { name: 'Marcar cardio da série 1 como feito', exact: true })).toBeChecked();
    await expect(page.getByRole('timer')).toHaveCount(0);
    await capturar(page, `cardio-bloco-feito-claro-${largura}`);
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`aluno: timer do intervalado no tema escuro (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await abrir(page, 'ESCURO');
    await expect(page.getByText('Bloco 1 · Intervalado', { exact: true })).toBeVisible();
    await capturar(page, `cardio-blocos-escuro-${largura}`);
    await page.getByRole('button', { name: 'Iniciar timer do bloco 1', exact: true }).click();
    // 2 voltas (2 min) + o 3º estímulo (30 s) + 10 s da recuperação da volta 3.
    await page.clock.fastForward('02:40');
    const timer = page.getByRole('timer', { name: 'Timer do bloco 1' });
    await expect(timer.getByText('Recuperação', { exact: true })).toBeVisible();
    await expect(timer.getByText('Volta 3 de 10', { exact: true })).toBeVisible();
    await expect(timer.getByText('0:20', { exact: true })).toBeVisible();
    await expect(timer.getByText('Depois: Estímulo 30 s', { exact: true })).toBeVisible();
    expect(await semRolagemDeLado(page)).toBe(true);
    await capturar(page, `cardio-timer-recuperacao-escuro-${largura}`);
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}

test('aluno: o pacote com o cardio intervalado novo é aceito pelo aparelho e lido de novo (D16)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const api = await abrir(page, 'CLARO');
  await expect(page.getByText('Bloco 3 · Contínuo', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate((id) => localStorage.getItem(`treinos:${id}:pacote`), ALUNO.id)).toContain('"protocolo":"SIT"');
  // Recarregar lê o pacote salvo (`lerPacote` → `pacoteNoFormatoAtual`): fora do formato ele seria apagado e marcado recusado.
  await page.reload();
  await expect(page.getByText('Bloco 3 · Contínuo', { exact: true })).toBeVisible();
  expect(await page.evaluate((id) => localStorage.getItem(`treinos:${id}:pacoteRecusado`), ALUNO.id)).toBeNull();
  expect(await page.evaluate((id) => localStorage.getItem(`treinos:${id}:pacote`), ALUNO.id)).toContain('"aquecimentoSeg":240');
  expect(api.errosDaPagina).toEqual([]);
  expect(api.naoTratadas).toEqual([]);
});

for (const largura of [390, 1280]) {
  // Depende de `copiarCardio` (dominio/editorTreino.ts, passo P2) levar as chaves novas: hoje `normalizarTreino` as tira.
  test(`aluno: bloco novo mostra o protocolo e a prévia do treinador, com o timer do SIT (${largura}px) [depende do P2]`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await abrir(page, 'ESCURO');
    await expect(page.getByText('Bloco 2 · SIT', { exact: true })).toBeVisible();
    await expect(page.getByText('6 × 30 s all-out / 3 min (passiva) · ~25 min', { exact: true })).toBeVisible();
    await expect(page.getByText('Aquecimento 4 min · Desaquecimento 3 min', { exact: true })).toBeVisible();
    await capturar(page, `cardio-sit-escuro-${largura}`);
    await page.getByRole('button', { name: 'Iniciar timer do bloco 2', exact: true }).click();
    // 4 min de aquecimento + o 1º tiro (30 s) + 1 min da recuperação passiva da volta 1.
    await page.clock.fastForward('05:30');
    const timer = page.getByRole('timer', { name: 'Timer do bloco 2' });
    await expect(timer.getByText('Recuperação passiva', { exact: true })).toBeVisible();
    await expect(timer.getByText('Volta 1 de 6', { exact: true })).toBeVisible();
    await expect(timer.getByText('2:00', { exact: true })).toBeVisible();
    await page.clock.fastForward('02:00');
    await expect(timer.getByText('All-out', { exact: true })).toBeVisible();
    await expect(timer.getByText('Volta 2 de 6', { exact: true })).toBeVisible();
    await capturar(page, `cardio-sit-timer-escuro-${largura}`);
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}
