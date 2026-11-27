import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

import type { Cardio, ConteudoTreino, Exercicio, Receita, Serie } from '../src/api/tipos';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { sessaoFalsa } from './aluno';

/**
 * Chave do cardio intervalado (`cardioIntervaladoHabilitado` no `/eu`, D16 de docs/planos/cardio-e-hiit.md). Desligada (o
 * padrão de produção até o APK com o timer estar nas lojas): o segmento só tem o contínuo, o contínuo sai sem `modo`, e o
 * intervalado que já existe fica só para leitura com o aviso; o 422 da API aparece no topo. Ligada: o Intervalado volta.
 * Só dados fictícios; a API é simulada. Capturas em `E2E_CAPTURAS` (padrão: a pasta do teste).
 */

const ID = 'm0000000-0000-4000-8000-0000000000d1';
const BIKE_ID = 'e0000000-0000-4000-8000-0000000000d1';
const TEXTO_422 = 'O cardio intervalado ainda não está liberado nesta consultoria.';
const capturas = process.env.E2E_CAPTURAS;
const CHAVES_DE_SEMPRE = ['distanciaKm', 'duracaoMin', 'intervalos', 'ritmo', 'zona'];

const bloco = (uid: string, cardio: Cardio): Serie => ({
  uid, tipo: null, repsMin: null, repsMax: null, amrap: null, carga: null, esforco: null, descansoSegundos: null, tecnica: null, alvoExtra: null, cardio,
});
const CONTINUO_VAZIO: Cardio = { duracaoMin: null, distanciaKm: null, ritmo: null, zona: null, intervalos: null };
const SIT: Cardio = { modo: 'INTERVALADO', protocolo: 'SIT', duracaoMin: null, distanciaKm: null, ritmo: null, zona: null, esforcoMaximo: true,
  aquecimentoSeg: 240, desaquecimentoSeg: 180, recuperacaoTipo: 'PASSIVA', intervalos: { trabalhoSeg: 30, descansoSeg: 180, voltas: 6 } };
const BIBLIOTECA = [{ id: BIKE_ID, nome: 'Bike de teste', modalidade: 'CARDIO', grupoMuscular: null, equipamento: null, videoUrl: null, observacoes: null,
  imagens: [], imagemPropriaEm: null, ativo: true, tipoDeCardio: 'BIKE', medidasDeCardio: ['RITMO'] }] as unknown as Exercicio[];

/** O modelo de sessão com a bike; o PUT responde como a API com a chave desligada: 422 se algum bloco leva chave nova. */
async function abrir(page: Page, series: Serie[], liberado: boolean) {
  const dia = sessaoFalsa('dia', 'Dia com cardio', 1, 1);
  dia.exercicios = [{ ...dia.exercicios[0], uid: 'bike', nome: 'Bike de teste', exercicioId: BIKE_ID, modalidade: 'CARDIO', unidade: 'nenhuma', progressao: false, series }];
  const conteudo: ConteudoTreino = { objetivo: null, orientacoes: null, sessoes: [dia] };
  let atual: Receita = { id: ID, tipo: 'SESSAO_TREINO', origem: 'CONSULTORIA', nome: 'Cardio fictício', descricao: null, pastaId: null, ordem: 1, versao: 1, conteudo };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'], ...(liberado ? { cardioIntervaladoHabilitado: true } : {}) })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios': { corpo: BIBLIOTECA },
    [`GET /receitas/${ID}`]: (_p, route) => json(route, atual),
    [`PUT /receitas/${ID}/conteudo`]: (p, route) => {
      const corpo = p.corpo as Receita;
      const series = (corpo.conteudo as ConteudoTreino).sessoes[0].exercicios[0].series;
      const novo = series.findIndex((s) => s.cardio && Object.keys(s.cardio).some((k) => !CHAVES_DE_SEMPRE.includes(k) && (s.cardio as Record<string, unknown>)[k] != null));
      if (!liberado && novo >= 0) {
        const e = erroApi(422, TEXTO_422, 'PLANO_INVALIDO', [{ field: `sessoes[0].exercicios[0].series[${novo}].cardio`, message: TEXTO_422 }]);
        return json(route, e.corpo, e.status);
      }
      atual = { ...atual, ...corpo, versao: atual.versao + 1 };
      return json(route, atual);
    },
  });
  await page.goto(`/treinador/planejamento/modelo/${ID}`);
  await expect(page.getByRole('button', { name: 'Salvar modelo', exact: true })).toBeVisible();
  await expect(page.getByText('Prescrição do cardio', { exact: true })).toBeVisible();
  return { ...api, salvo: () => (api.pedidos.filter((p) => p.metodo === 'PUT').at(-1)!.corpo as { conteudo: ConteudoTreino }).conteudo.sessoes[0].exercicios[0].series };
}

const capturar = (page: Page, nome: string, saida: string) => page.screenshot({ path: capturas ? path.join(capturas, nome) : path.join(saida, nome) });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
});

test('chave desligada: só o contínuo, que sai sem modo', async ({ page }, testInfo) => {
  const api = await abrir(page, [bloco('b1', CONTINUO_VAZIO)], false);
  await expect(page.getByRole('radio', { name: 'Contínuo', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Intervalado', exact: true })).toHaveCount(0);
  await expect(page.getByText('O intervalado ainda não foi liberado: por enquanto, só contínuo.', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Duração (min)', exact: true }).fill('30');
  await page.getByRole('radio', { name: 'Zona 2', exact: true }).click();
  await capturar(page, 'chave-desligada-continuo.png', testInfo.outputPath());
  await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
  await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
  const [s] = api.salvo();
  expect(Object.keys(s.cardio!).sort()).toEqual(CHAVES_DE_SEMPRE);
  expect(s.cardio).toEqual({ duracaoMin: 30, distanciaKm: null, ritmo: null, zona: 2, intervalos: null });
  expect(api.errosDaPagina).toEqual([]);
  expect(api.naoTratadas).toEqual([]);
});

test('chave desligada: o intervalado que já existe fica legível, com aviso; salvar mostra o 422 e "Contínuo" destrava', async ({ page }, testInfo) => {
  const api = await abrir(page, [bloco('b1', SIT)], false);
  await expect(page.getByText('Cardio intervalado ainda não liberado: este bloco só pode ser salvo depois da liberação.', { exact: true })).toBeVisible();
  // Só leitura: sem os campos do intervalado, com o resumo e a prévia do aluno.
  await expect(page.getByRole('button', { name: /^Protocolo: / })).toHaveCount(0);
  await expect(page.getByText('6 × 30 s / 3 min · ~25 min no total', { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Prévia para o aluno' })).toContainText('SIT');
  await capturar(page, 'chave-desligada-intervalado.png', testInfo.outputPath());
  // Uma mudança em outro lugar do modelo faria o salvar mandar o bloco como está: o servidor recusa e o topo mostra.
  await page.getByRole('button', { name: 'Novo bloco de cardio', exact: true }).click();
  await page.getByRole('textbox', { name: 'Duração (min)', exact: true }).fill('10');
  await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
  await expect(page.getByText(TEXTO_422).first()).toBeVisible();
  // Abre o bloco 1 e passa para Contínuo: o aviso some e o salvar passa, sem modo.
  await page.getByRole('button', { name: /^Bloco 1 · SIT/ }).click();
  await page.getByRole('radio', { name: 'Contínuo', exact: true }).click();
  await expect(page.getByText(/^Cardio intervalado ainda não liberado/)).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Duração (min)', exact: true }).fill('20');
  await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
  await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(2);
  const [primeiro, segundo] = api.salvo();
  expect('modo' in primeiro.cardio!).toBe(false);
  expect(Object.keys(segundo.cardio!).sort()).toEqual(CHAVES_DE_SEMPRE);
  expect(api.errosDaPagina).toEqual([]);
  expect(api.naoTratadas).toEqual([]);
});

test('chave ligada: o Intervalado volta e grava o modo', async ({ page }) => {
  const api = await abrir(page, [bloco('b1', CONTINUO_VAZIO)], true);
  await expect(page.getByText(/^O intervalado ainda não foi liberado/)).toHaveCount(0);
  await page.getByRole('radio', { name: 'Intervalado', exact: true }).click();
  await page.getByRole('button', { name: /^Protocolo: / }).click();
  await page.getByRole('option', { name: /^SIT/ }).click();
  await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
  await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
  const [s] = api.salvo();
  expect(s.cardio).toMatchObject({ modo: 'INTERVALADO', protocolo: 'SIT' });
  expect(api.naoTratadas).toEqual([]);
});
