import { mkdirSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import type { Exercicio } from '../src/api/tipos';
import { exercicio as exercicioDoPlano, serie } from '../src/dominio/exemplosDeTreino.apoioTeste';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Folha "Escolher cardio" (docs/planos/cardio-e-hiit.md, P4b): a mesma folha do "Escolher exercício", só com os cardios
 * da biblioteca; o "Tipo de cardio" (chips com a contagem) no lugar do grupo muscular, a linha "● Cardio · Escada" (o
 * cardio antigo sem tipo mostra o equipamento), a busca pelo tipo, a linha do cardio manual, a troca pré-filtrada pelo
 * tipo do atual (o cardio antigo com o grupo "Cardio" não pré-filtra: esconderia os cardios novos, sem grupo), o erro da
 * API e os vazios. `CAPTURAS` aponta a pasta das capturas. Só dados fictícios.
 */
const PASTA = process.env.CAPTURAS;
type Tema = 'CLARO' | 'ESCURO';
const ID = 'f0000000-0000-4000-8000-000000000028';
const ex = (n: number, nome: string, p: Partial<Exercicio>): Exercicio => ({
  id: `e${String(n).padStart(7, '0')}-0000-4000-8000-000000000028`, nome, grupoMuscular: null, equipamento: null, modalidade: 'CARDIO',
  videoUrl: null, observacoes: null, origem: 'MANUAL', imagens: [], imagemPropriaEm: null, ...p,
});
const SUPINO = ex(1, 'Supino reto fictício', { grupoMuscular: 'Peito', equipamento: 'Barra', modalidade: 'LIVRE' });
// O nome não diz "escada": a busca acha pelo tipo.
const SUBIDA = ex(2, 'Subida contínua fictícia', { tipoDeCardio: 'ESCADA', medidasDeCardio: ['RITMO'] });
const BIKE = ex(3, 'Bike de spinning fictícia', { tipoDeCardio: 'BIKE', medidasDeCardio: ['DISTANCIA', 'RITMO'] });
// Antes da V113: grupo "Cardio" e equipamento do catálogo, sem tipo.
const ESTEIRA_ANTIGA = ex(4, 'Esteira do catálogo fictícia', { grupoMuscular: 'Cardio', equipamento: 'Esteira' });
const LISTA = [SUPINO, SUBIDA, BIKE, ESTEIRA_ANTIGA];
const CARDIOS = 3;

const blocoContinuo = (uid: string) => serie(uid, { tipo: null, repsMin: null, repsMax: null, carga: null, cardio: { duracaoMin: 20, distanciaKm: null, ritmo: null, zona: 2, intervalos: null } });

async function abrir(page: Page, largura: number, { tema = 'CLARO' as Tema, exercicios = { corpo: LISTA } as RespostasApi[string] } = {}) {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
  const conteudo = { sessoes: [{ uid: 's1', nome: 'Treino A', exercicios: [
    exercicioDoPlano('x1', { exercicioId: SUBIDA.id, nome: SUBIDA.nome, modalidade: 'CARDIO', unidade: 'nenhuma', series: [blocoContinuo('b1')] }),
    exercicioDoPlano('x2', { exercicioId: ESTEIRA_ANTIGA.id, nome: ESTEIRA_ANTIGA.nome, modalidade: 'CARDIO', unidade: 'nenhuma', series: [blocoContinuo('b2')] }),
  ] }] };
  const modelo = { id: ID, tipo: 'SESSAO_TREINO', origem: 'CONSULTORIA', nome: 'Dia de cardio', descricao: null, conteudo, ordem: 0, pastaId: null, versao: 1 };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR', 'MODELO_LER', 'MODELO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios': exercicios,
    [`GET /receitas/${ID}`]: { corpo: modelo },
    [`PUT /receitas/${ID}`]: (pedido, route) => json(route, { ...modelo, conteudo: pedido.corpo, versao: 2 }),
  });
  await page.goto(`/treinador/planejamento/modelo/${ID}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Adicionar cardio' }).first()).toBeVisible();
  return api;
}

const folhaDe = (page: Page) => page.getByRole('dialog', { name: 'Escolher cardio' });
const opcoes = (page: Page) => folhaDe(page).getByRole('listbox').getByRole('option');
async function capturar(page: Page, nome: string) {
  if (!PASTA) return;
  mkdirSync(PASTA, { recursive: true });
  await page.screenshot({ path: `${PASTA}/${nome}.png` });
}

async function abrirTroca(page: Page, nome: string) {
  const trocar = page.getByRole('button', { name: `Trocar exercício: ${nome}` });
  if (!(await trocar.first().isVisible())) await page.getByText(nome, { exact: true }).first().click();
  await trocar.first().click();
  await expect(folhaDe(page)).toBeVisible();
}

for (const largura of [1280, 390]) {
  for (const tema of ['CLARO', 'ESCURO'] as const) {
    test(`adicionar cardio: só cardio, "Cardio · Escada", filtro por tipo com a contagem, busca pelo tipo e o manual (${largura} px, ${tema})`, async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, largura, { tema });
      await page.getByRole('button', { name: 'Adicionar cardio' }).first().click();
      const folha = folhaDe(page);
      await expect(opcoes(page)).toHaveCount(CARDIOS);
      await expect(folha.getByText('Cardio · Escada', { exact: true })).toBeVisible();
      await expect(folha.getByText('Cardio · Bike', { exact: true })).toBeVisible();
      // O cardio antigo mostra o equipamento, nunca "Cardio · Cardio".
      await expect(folha.getByText('Cardio · Esteira', { exact: true })).toBeVisible();
      await expect(folha.getByText(/Cardio · Cardio/)).toHaveCount(0);
      await expect(folha.getByRole('option', { name: `${SUBIDA.nome}, Cardio · Escada` })).toBeVisible();
      // Todas as linhas são Cardio: sem a legenda das modalidades.
      await expect(folha.getByRole('list', { name: 'Cores das modalidades' })).toHaveCount(0);
      await capturar(page, `adicionar-${largura}-${tema.toLowerCase()}`);

      // Filtros: o tipo no lugar do grupo muscular, sem a modalidade.
      await folha.getByRole('button', { name: /^Filtros, / }).click();
      const etapa = page.getByRole('dialog', { name: 'Filtros de cardio' });
      await expect(etapa.getByRole('group', { name: 'Grupo muscular' })).toHaveCount(0);
      await expect(etapa.getByRole('group', { name: 'Modalidade' })).toHaveCount(0);
      const tipos = etapa.getByRole('group', { name: 'Tipo de cardio' }).getByRole('checkbox');
      await expect(tipos).toHaveCount(2);
      await expect(tipos.first()).toHaveAccessibleName('Bike, 1 cardio');
      await etapa.getByRole('checkbox', { name: 'Escada, 1 cardio' }).click();
      await expect(etapa.getByRole('checkbox', { name: 'Escada, 1 cardio' })).toBeChecked();
      await capturar(page, `filtros-${largura}-${tema.toLowerCase()}`);
      await etapa.getByRole('button', { name: 'Mostrar 1 cardio' }).click();
      await expect(folha.getByRole('button', { name: 'Tirar filtro: Tipo de cardio: Escada' })).toBeVisible();
      await expect(opcoes(page)).toHaveCount(1);
      await folha.getByRole('button', { name: 'Tirar filtro: Tipo de cardio: Escada' }).click();
      await expect(opcoes(page)).toHaveCount(CARDIOS);

      // A busca acha pelo tipo; texto novo vira a linha do cardio manual.
      const busca = folha.getByRole('textbox', { name: 'Buscar na biblioteca' });
      await busca.fill('escada');
      await expect(opcoes(page).first()).toHaveAccessibleName(`${SUBIDA.nome}, Cardio · Escada`);
      await busca.fill('Remo livre');
      await expect(folha.getByText('Nenhum cardio com “Remo livre” na biblioteca.', { exact: true })).toBeVisible();
      await expect(folha.getByText('Usar “Remo livre” como cardio manual', { exact: true })).toBeVisible();
      await page.keyboard.press('Enter');
      await expect(folha).toHaveCount(0);
      await expect(page.getByText('Remo livre').first()).toBeVisible();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }

  test(`trocar cardio: pré-filtro pelo tipo do atual e "Atual"; o cardio antigo não pré-filtra (${largura} px)`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, largura, { tema: 'ESCURO' });
    await abrirTroca(page, SUBIDA.nome);
    const folha = folhaDe(page);
    await expect(folha.getByRole('button', { name: 'Tirar filtro: Tipo de cardio: Escada' })).toBeVisible();
    await expect(opcoes(page)).toHaveCount(1);
    await expect(folha.getByRole('option', { name: /Subida contínua fictícia.*atual$/ })).toHaveAttribute('aria-selected', 'true');
    await expect(folha.getByText('Atual', { exact: true })).toBeVisible();
    await capturar(page, `trocar-${largura}-escuro`);
    // O ✕ tira o pré-filtro; a troca é só por cardio (o supino nunca aparece).
    await folha.getByRole('button', { name: 'Tirar filtro: Tipo de cardio: Escada' }).click();
    await expect(opcoes(page)).toHaveCount(CARDIOS);
    await expect(folha.getByText(SUPINO.nome)).toHaveCount(0);
    await folha.getByRole('option', { name: `${BIKE.nome}, Cardio · Bike` }).click();
    await expect(folha).toHaveCount(0);
    await expect(page.getByText(BIKE.nome).first()).toBeVisible();

    // O cardio do catálogo (grupo "Cardio", sem tipo): sem pré-filtro, todos os cardios, com o atual marcado.
    await abrirTroca(page, ESTEIRA_ANTIGA.nome);
    await expect(folha.getByRole('button', { name: /^Tirar filtro/ })).toHaveCount(0);
    await expect(opcoes(page)).toHaveCount(CARDIOS);
    await expect(folha.getByRole('option', { name: /Esteira do catálogo fictícia.*atual$/ })).toBeVisible();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`vazios: biblioteca sem cardio e cardios sem tipo; erro da API com "Tentar de novo" (${largura} px)`, async ({ page }) => {
    let resposta: 'erro' | 'sem-cardio' | 'sem-tipo' = 'erro';
    const { errosDaPagina } = await abrir(page, largura, {
      exercicios: (_p, route) => {
        if (resposta === 'erro') { const e = erroApi(500, 'Falha simulada.'); return json(route, e.corpo, e.status); }
        return json(route, resposta === 'sem-cardio' ? [SUPINO] : [SUPINO, ESTEIRA_ANTIGA]);
      },
    });
    await page.getByRole('button', { name: 'Adicionar cardio' }).first().click();
    const folha = folhaDe(page);
    await expect(folha.getByRole('button', { name: /Tentar de novo/ })).toBeVisible();
    await capturar(page, `erro-${largura}-claro`);
    resposta = 'sem-cardio';
    await folha.getByRole('button', { name: /Tentar de novo/ }).click();
    await expect(folha.getByText('A biblioteca não tem cardio. Digite o nome (ex.: Esteira) para usar um cardio manual.', { exact: true })).toBeVisible();
    await capturar(page, `sem-cardio-${largura}-claro`);
    await folha.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('Esteira');
    await expect(folha.getByText('Usar “Esteira” como cardio manual', { exact: true })).toBeVisible();
    await folha.getByRole('button', { name: 'Cancelar' }).click();
    await expect(folha).toHaveCount(0);

    // Só o cardio do catálogo, sem tipo: o filtro diz por que não há tipo para escolher.
    resposta = 'sem-tipo';
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Adicionar cardio' }).first().click();
    await expect(opcoes(page)).toHaveCount(1);
    await folha.getByRole('button', { name: /^Filtros, / }).click();
    const etapa = page.getByRole('dialog', { name: 'Filtros de cardio' });
    await expect(etapa.getByText('Nenhum cardio da biblioteca tem tipo ainda. O tipo se escolhe ao editar o cardio na Biblioteca.', { exact: true })).toBeVisible();
    await capturar(page, `filtros-sem-tipo-${largura}-claro`);
    expect(errosDaPagina).toEqual([]);
  });
}
