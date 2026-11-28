import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import type { Exercicio, ExercicioPlano, Receita, Serie, Sessao } from '../src/api/tipos';
import { CONFIGURACAO_PADRAO } from '../src/dominio/metodologiaPadrao';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/*
 * Folha "Usar semana de treino" do editor de treino (27/11, no padrão da "Usar receita"): no PC, lista (busca, abas Semanas
 * completas e Estruturas, chips de coleção, uma linha por modelo) e prévia fixa lado a lado (faixa da semana com a sessão
 * clicável e os exercícios dela), rodapé fixo com o aviso, "Usar este modelo" e "Cancelar"; no celular, a lista e a prévia em
 * passos, com "Voltar". Depois de usar, o "Desfazer" vem no aviso (toast). Só dados fictícios; nada chega ao banco.
 * Capturas com `E2E_CAPTURAS`: `<base>/usar-semana-<caso>-<largura>-<tema>.png`.
 */
const BASE = process.env.E2E_CAPTURAS;
const ID_PLANO = 'm0000000-0000-4000-8000-000000000230';
const FORCA = 'p0000000-0000-4000-8000-000000000231';
const HIPERTROFIA = 'p0000000-0000-4000-8000-000000000232';

const EXERCICIOS = {
  agachamento: { id: 'e0000000-0000-4000-8000-000000000241', nome: 'Agachamento fictício', grupoMuscular: 'Quadríceps', modalidade: 'LIVRE' },
  supino: { id: 'e0000000-0000-4000-8000-000000000242', nome: 'Supino fictício', grupoMuscular: 'Peitoral', modalidade: 'LIVRE' },
  puxada: { id: 'e0000000-0000-4000-8000-000000000243', nome: 'Puxada fictícia', grupoMuscular: 'Costas', modalidade: 'MAQUINA' },
  bike: { id: 'e0000000-0000-4000-8000-000000000244', nome: 'Bicicleta fictícia', grupoMuscular: 'Cardio', modalidade: 'CARDIO' },
} as const;
const BIBLIOTECA: Exercicio[] = Object.values(EXERCICIOS).map((e) => ({
  ...e, equipamento: null, videoUrl: null, observacoes: null, origem: 'PROPRIO', imagens: [], imagemPropriaEm: null,
}));

const serie = (uid: string): Serie => ({
  uid, tipo: 'WORKING', repsMin: 8, repsMax: 10, carga: { modo: 'CARGA_TRABALHO', percentualMin: null, percentualMax: null }, esforco: null, descansoSegundos: null, tecnica: null,
});
const exercicio = (uid: string, e: (typeof EXERCICIOS)[keyof typeof EXERCICIOS], series: number): ExercicioPlano => ({
  uid, exercicioId: e.id, nome: e.nome, modalidade: e.modalidade, videoUrl: null, observacao: null, progressao: false, unidade: 'kg', grupoUid: null,
  series: Array.from({ length: series }, (_, i) => serie(`${uid}-s${i}`)),
});
const sessaoDe = (uid: string, nome: string, diaSemana: number | null, exercicios: ExercicioPlano[] = [], tipo: Sessao['tipo'] = 'TREINO'): Sessao => ({
  uid, nome, diaSemana, tipo, frequenciaSemanal: null, observacao: null, cardio: null, grupos: [], exercicios,
});
const semana = (id: string, nome: string, sessoes: Sessao[], extra: Partial<Receita> = {}): Receita => ({
  id, tipo: 'PLANO_TREINO', origem: 'PADRAO', nome, descricao: null, pastaId: null, ordem: 1, versao: 1,
  conteudo: { objetivo: null, orientacoes: null, sessoes }, ...extra,
});

const FULL_BODY = semana('m0000000-0000-4000-8000-000000000250', 'Full body fictício', [
  sessaoDe('fb-a', 'Full Body A', 1, [exercicio('fb-a1', EXERCICIOS.agachamento, 4), exercicio('fb-a2', EXERCICIOS.supino, 3), exercicio('fb-a3', EXERCICIOS.puxada, 3)]),
  sessaoDe('fb-ter', 'Terça', 2, [], 'DESCANSO'),
  sessaoDe('fb-b', 'Full Body B', 3, [exercicio('fb-b1', EXERCICIOS.supino, 4), exercicio('fb-b2', EXERCICIOS.puxada, 4)]),
  sessaoDe('fb-c', 'Full Body C', 5, [exercicio('fb-c1', EXERCICIOS.agachamento, 3), exercicio('fb-c2', EXERCICIOS.puxada, 3)]),
  sessaoDe('fb-sab', 'Mobilidade e bike', 6, [exercicio('fb-s1', EXERCICIOS.bike, 1)], 'DESCANSO_ATIVO'),
], { pastaId: FORCA, descricao: 'Três treinos de corpo inteiro e um dia leve no sábado.' });
const UPPER_LOWER = semana('m0000000-0000-4000-8000-000000000251', 'Upper lower fictício', [
  sessaoDe('ul-1', 'Superiores', 1, [exercicio('ul-11', EXERCICIOS.supino, 3)]),
  sessaoDe('ul-2', 'Inferiores', 2, [exercicio('ul-21', EXERCICIOS.agachamento, 3)]),
  sessaoDe('ul-4', 'Superiores', 4, [exercicio('ul-41', EXERCICIOS.puxada, 3)]),
  sessaoDe('ul-5', 'Inferiores', 5, [exercicio('ul-51', EXERCICIOS.agachamento, 3)]),
]);
const PUSH_PULL = semana('m0000000-0000-4000-8000-000000000252', 'Push pull fictício', [
  sessaoDe('pp-1', 'Push', 1, [exercicio('pp-11', EXERCICIOS.supino, 4)]),
  sessaoDe('pp-2', 'Pull', 3, [exercicio('pp-21', EXERCICIOS.puxada, 4)]),
], { pastaId: HIPERTROFIA });
const ESTRUTURA = semana('m0000000-0000-4000-8000-000000000253', 'Estrutura ABC fictícia', [
  sessaoDe('abc-a', 'Treino A', 1), sessaoDe('abc-b', 'Treino B', 3), sessaoDe('abc-c', 'Treino C', 5),
], { pastaId: FORCA, descricao: 'Só os dias e os nomes, para montar do zero.' });
const SEMANAS = [FULL_BODY, UPPER_LOWER, PUSH_PULL, ESTRUTURA];

async function abrir(page: Page, { largura, tema = 'ESCURO', semanas = SEMANAS, erroNaLista = false }: {
  largura: number; tema?: 'CLARO' | 'ESCURO'; semanas?: Receita[]; erroNaLista?: boolean;
}) {
  await page.setViewportSize({ width: largura, height: largura >= 1280 ? 1080 : 844 });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema]);
  const plano: Receita = {
    id: ID_PLANO, tipo: 'PLANO_TREINO', origem: 'CONSULTORIA', nome: 'Semana em edição fictícia', descricao: null, pastaId: null, ordem: 1, versao: 1,
    conteudo: {
      objetivo: 'Objetivo fictício', orientacoes: null,
      metodologia: { id: null, nome: 'Metodologia fictícia', configuracao: structuredClone(CONFIGURACAO_PADRAO) },
      sessoes: [sessaoDe('sessao-1', 'Treino atual', 1, [exercicio('ex-1', EXERCICIOS.supino, 3)])],
    },
  };
  let falhar = erroNaLista;
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /pastas-modelos': { corpo: [{ id: FORCA, nome: 'Força', versao: 1 }, { id: HIPERTROFIA, nome: 'Hipertrofia', versao: 1 }] },
    'GET /exercicios': { corpo: BIBLIOTECA },
    'GET /receitas': (p, route) => {
      if (p.busca.get('tipo') !== 'PLANO_TREINO') return json(route, []);
      if (falhar) { falhar = false; const e = erroApi(500, 'Erro interno.'); return json(route, e.corpo, e.status); }
      return json(route, semanas);
    },
    [`GET /receitas/${ID_PLANO}`]: (_p, route) => json(route, plano),
  });
  await page.goto(`/treinador/planejamento/modelo/${ID_PLANO}`);
  // "Modelos prontos" fica no cartão da sessão (e, sem sessões, no estado vazio): o primeiro serve.
  await page.getByRole('button', { name: 'Modelos prontos', exact: true }).first().click();
  await page.getByRole('dialog', { name: 'Modelos prontos' }).getByRole('button', { name: 'Usar semana de treino', exact: true }).click();
  return api;
}

const folha = (page: Page) => page.getByRole('dialog', { name: 'Usar semana de treino' });
const opcao = (page: Page, nome: string) => folha(page).getByRole('option', { name: new RegExp(`^${nome}:`) });
const sessoesDoEditor = (page: Page) => page.getByRole('tablist', { name: 'Sessões do plano' }).getByRole('tab');
const capturar = async (page: Page, caso: string, largura: number, tema: string) => {
  if (BASE) await page.screenshot({ path: path.join(BASE, `usar-semana-${caso}-${largura}-${tema.toLowerCase()}.png`) });
};
const semRolagemDeLado = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const AVISO = 'As sessões deste plano serão trocadas pelas da semana escolhida. O objetivo e as orientações ficam.';

for (const tema of ['ESCURO', 'CLARO'] as const) {
  for (const largura of [1920, 1280]) {
    test(`usar semana no PC: abas, chip, prévia com a faixa, sessão, setas + Enter e desfazer (${largura}px, ${tema.toLowerCase()})`, async ({ page }) => {
      const api = await abrir(page, { largura, tema });
      const f = folha(page);
      expect(Math.round((await f.boundingBox())!.width)).toBe(1100);
      await expect(f.getByRole('tab', { name: 'Semanas completas (3)', exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(f.getByRole('tab', { name: 'Estruturas (sem exercícios) (1)', exact: true })).toBeVisible();
      await expect(f.getByRole('option')).toHaveCount(3);
      // Uma linha por modelo: nome e "N sessões · N exercícios"; sem "Usar este modelo" dentro das linhas.
      await expect(opcao(page, 'Full body fictício')).toHaveAttribute('aria-selected', 'true');
      await expect(opcao(page, 'Full body fictício').getByText('5 sessões · 8 exercícios', { exact: true })).toBeVisible();
      await expect(f.getByRole('listbox', { name: 'Semanas' }).getByRole('button', { name: /Usar este modelo/ })).toHaveCount(0);
      // Prévia: descrição uma vez, faixa com os 7 dias, segunda aberta com os exercícios (nome, séries e grupo).
      const previa = f.getByRole('region', { name: 'Prévia da semana' });
      await expect(previa.getByRole('heading', { name: 'Full body fictício' })).toBeVisible();
      await expect(f.getByText('Três treinos de corpo inteiro e um dia leve no sábado.', { exact: true })).toHaveCount(1);
      const dias = previa.getByRole('list', { name: 'Dias da semana' }).getByRole('listitem');
      await expect(dias).toHaveCount(7);
      await expect(dias.nth(6)).toContainText('Descanso');
      await expect(dias.nth(1)).toContainText('Descanso');
      await expect(dias.nth(1).getByRole('button')).toHaveCount(0);
      const segunda = previa.getByRole('button', { name: 'Segunda: Full Body A, 3 exercícios', exact: true });
      await expect(segunda).toHaveAttribute('aria-pressed', 'true');
      const exercicios = previa.getByRole('region', { name: 'Exercícios de Segunda, Full Body A' });
      // Só a lista dos exercícios: a legenda das modalidades, acima dela, também é uma lista.
      await expect(exercicios.getByRole('list', { name: 'Exercícios da sessão' }).getByRole('listitem')).toHaveCount(3);
      await expect(exercicios.getByText('4 séries · Quadríceps', { exact: true })).toBeVisible();
      await expect(previa.getByText('Coleção: Força', { exact: true })).toBeVisible();
      // Rodapé: o aviso uma vez e as duas ações.
      await expect(f.getByText(AVISO, { exact: true })).toHaveCount(1);
      await expect(f.getByRole('button', { name: 'Usar este modelo: Full body fictício', exact: true })).toBeEnabled();
      await expect(f.getByRole('button', { name: 'Cancelar', exact: true })).toBeVisible();
      expect(await semRolagemDeLado(page)).toBe(true);
      await capturar(page, 'completa-segunda', largura, tema);
      // Outra sessão: o sábado (descanso ativo, com exercício) abre e a segunda sai do destaque.
      await previa.getByRole('button', { name: 'Sábado: Mobilidade e bike, 1 exercício', exact: true }).click();
      await expect(segunda).toHaveAttribute('aria-pressed', 'false');
      await expect(previa.getByRole('region', { name: 'Exercícios de Sábado, Mobilidade e bike' }).getByText('1 série · Cardio', { exact: true })).toBeVisible();
      // Chip de coleção: só as da Hipertrofia; a escolha vai à primeira que sobrou.
      await f.getByRole('radio', { name: 'Hipertrofia', exact: true }).click();
      await expect(f.getByRole('option')).toHaveCount(1);
      await expect(opcao(page, 'Push pull fictício')).toHaveAttribute('aria-selected', 'true');
      await f.getByRole('radio', { name: 'Todas', exact: true }).click();
      // Setas trocam a escolha (sem dar a volta) e Enter usa uma vez só.
      await opcao(page, 'Full body fictício').click();
      await opcao(page, 'Full body fictício').focus();
      await page.keyboard.press('ArrowDown');
      await expect(opcao(page, 'Upper lower fictício')).toHaveAttribute('aria-selected', 'true');
      await expect(opcao(page, 'Upper lower fictício')).toBeFocused();
      await page.keyboard.press('ArrowUp');
      await expect(opcao(page, 'Full body fictício')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(f).toHaveCount(0);
      await expect(page.getByText('Semana “Full body fictício” aplicada.', { exact: true })).toHaveCount(1);
      await expect(sessoesDoEditor(page)).toHaveCount(5);
      // O "Desfazer" vem no aviso (toast) e volta às sessões de antes.
      const aviso = page.getByRole('alert').filter({ hasText: 'Semana “Full body fictício” aplicada.' });
      await aviso.getByRole('button', { name: 'Desfazer', exact: true }).click();
      await expect(aviso).toHaveCount(0);
      await expect(sessoesDoEditor(page)).toHaveCount(1);
      expect(api.pedidos.filter((p) => p.metodo === 'PUT')).toHaveLength(0);
      expect(api.errosDaPagina).toEqual([]);
      expect(api.naoTratadas).toEqual([]);
    });
  }
}

for (const tema of ['ESCURO', 'CLARO'] as const) {
  for (const largura of [1920, 390]) {
    test(`usar semana: estrutura sem exercícios só com a faixa e o aviso (${largura}px, ${tema.toLowerCase()})`, async ({ page }) => {
      const api = await abrir(page, { largura, tema });
      const f = folha(page);
      await f.getByRole('tab', { name: 'Estruturas (sem exercícios) (1)', exact: true }).click();
      await expect(f.getByRole('option')).toHaveCount(1);
      await expect(opcao(page, 'Estrutura ABC fictícia').getByText('3 sessões · sem exercícios', { exact: true })).toBeVisible();
      if (largura < 1280) await opcao(page, 'Estrutura ABC fictícia').click();
      await expect(f.getByRole('heading', { name: 'Estrutura ABC fictícia' })).toBeVisible();
      await expect(f.getByText('Só a estrutura: as sessões vêm vazias.', { exact: true })).toBeVisible();
      const dias = f.getByRole('list', { name: 'Dias da semana' }).getByRole('listitem');
      await expect(dias).toHaveCount(7);
      await expect(dias.nth(0)).toContainText('Treino A');
      // Nada se toca na faixa e não há lista de exercícios.
      await expect(f.getByRole('list', { name: 'Dias da semana' }).getByRole('button')).toHaveCount(0);
      await expect(f.getByRole('region', { name: /^Exercícios de/ })).toHaveCount(0);
      await expect(f.getByText(AVISO, { exact: true })).toBeVisible();
      expect(await semRolagemDeLado(page)).toBe(true);
      await capturar(page, 'estrutura', largura, tema);
      await f.getByRole('button', { name: 'Usar este modelo: Estrutura ABC fictícia', exact: true }).click();
      await expect(page.getByText('Semana “Estrutura ABC fictícia” aplicada.', { exact: true })).toBeVisible();
      await expect(sessoesDoEditor(page)).toHaveCount(3);
      expect(api.errosDaPagina).toEqual([]);
      expect(api.naoTratadas).toEqual([]);
    });
  }
}

for (const tema of ['ESCURO', 'CLARO'] as const) {
  test(`usar semana no celular: lista, prévia com a segunda aberta, Voltar e usar (390px, ${tema.toLowerCase()})`, async ({ page }) => {
    const api = await abrir(page, { largura: 390, tema });
    const f = folha(page);
    await expect(f.getByRole('option')).toHaveCount(3);
    // Na lista não há ações: elas aparecem na prévia.
    await expect(f.getByRole('button', { name: /^Usar este modelo/ })).toHaveCount(0);
    expect(await semRolagemDeLado(page)).toBe(true);
    await capturar(page, 'lista', 390, tema);
    await opcao(page, 'Full body fictício').click();
    await expect(f.getByRole('heading', { name: 'Full body fictício' })).toBeVisible();
    await expect(f.getByRole('option')).toHaveCount(0);
    await expect(f.getByRole('button', { name: 'Segunda: Full Body A, 3 exercícios', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(f.getByRole('region', { name: 'Exercícios de Segunda, Full Body A' }).getByRole('list', { name: 'Exercícios da sessão' }).getByRole('listitem')).toHaveCount(3);
    await expect(f.getByText(AVISO, { exact: true })).toBeVisible();
    expect(await semRolagemDeLado(page)).toBe(true);
    await capturar(page, 'completa-segunda', 390, tema);
    // "Voltar à lista", o X e o voltar do navegador voltam à lista sem fechar.
    await f.getByRole('button', { name: 'Voltar à lista', exact: true }).click();
    await expect(opcao(page, 'Full body fictício')).toHaveAttribute('aria-selected', 'true');
    await opcao(page, 'Full body fictício').click();
    await f.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(f.getByRole('option')).toHaveCount(3);
    await opcao(page, 'Upper lower fictício').click();
    await page.goBack();
    await expect(opcao(page, 'Upper lower fictício')).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(new RegExp(ID_PLANO));
    await opcao(page, 'Upper lower fictício').click();
    await f.getByRole('button', { name: 'Usar este modelo: Upper lower fictício', exact: true }).click();
    await expect(f).toHaveCount(0);
    await expect(page.getByText('Semana “Upper lower fictício” aplicada.', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(ID_PLANO));
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}

test('usar semana: busca sem resultado, Cancelar fecha sem mudar nada', async ({ page }) => {
  const api = await abrir(page, { largura: 1280, tema: 'CLARO' });
  const f = folha(page);
  const busca = f.getByRole('textbox', { name: 'Buscar semana', exact: true });
  await busca.fill('nada assim');
  await expect(f.getByText('Nenhum modelo com essa busca.', { exact: true })).toBeVisible();
  await expect(f.getByRole('button', { name: 'Usar este modelo', exact: true })).toBeDisabled();
  await f.getByRole('button', { name: 'Limpar busca', exact: true }).click();
  await f.getByRole('radio', { name: 'Hipertrofia', exact: true }).click();
  await busca.fill('full');
  await expect(f.getByText('Nenhum modelo em Hipertrofia nessa busca.', { exact: true })).toBeVisible();
  await f.getByRole('button', { name: 'Mostrar todas as coleções', exact: true }).click();
  await expect(opcao(page, 'Full body fictício')).toBeVisible();
  await f.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(f).toHaveCount(0);
  await expect(sessoesDoEditor(page)).toHaveCount(1);
  expect(api.naoTratadas).toEqual([]);
});

test('usar semana: erro ao carregar com "Tentar de novo" e consultoria sem semanas', async ({ page }) => {
  await abrir(page, { largura: 1280, erroNaLista: true });
  const f = folha(page);
  await expect(f.getByRole('button', { name: 'Tentar de novo', exact: true })).toBeVisible();
  await capturar(page, 'erro', 1280, 'ESCURO');
  await f.getByRole('button', { name: 'Tentar de novo', exact: true }).click();
  await expect(f.getByRole('option')).toHaveCount(3);

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const outra = await page.context().newPage();
  await abrir(outra, { largura: 1280, semanas: [] });
  await expect(folha(outra).getByText('Nenhuma semana de treino ainda', { exact: true })).toBeVisible();
  await expect(folha(outra).getByRole('button', { name: /^Usar este modelo/ })).toHaveCount(0);
  await capturar(outra, 'vazio', 1280, 'ESCURO');
});
