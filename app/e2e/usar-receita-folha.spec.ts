import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import type { Receita, Serie } from '../src/api/tipos';
import { CONFIGURACAO_PADRAO } from '../src/dominio/metodologiaPadrao';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { linhaDaSerie } from './linhaDaSerie';

/*
 * Folha "Usar receita" do editor de treino (27/11): no PC, lista (busca, abas Completas, Partes e Minhas, chips de tipo e
 * técnica, uma linha por receita com os selos) e prévia fixa lado a lado, rodapé fixo com substituir e acrescentar; no
 * celular, a lista e a prévia em passos, com "Voltar". Só dados fictícios; nada chega ao banco. Capturas com
 * `E2E_CAPTURAS`: `<base>/usar-receita-<caso>-<largura>-<tema>.png`.
 */
const BASE = process.env.E2E_CAPTURAS;
const ID_PLANO = 'm0000000-0000-4000-8000-000000000130';
const PASTA = 'p0000000-0000-4000-8000-000000000131';

const semCarga = { modo: 'CARGA_TRABALHO' as const, percentualMin: null, percentualMax: null };
const daWs = (percentualMin: number) => ({ modo: 'PERCENTUAL_WS' as const, percentualMin, percentualMax: null });
const serie = (uid: string, tipo: string, extra: Partial<Serie> = {}): Serie => ({
  uid, tipo, repsMin: 8, repsMax: 10, carga: semCarga, esforco: null, descansoSegundos: null, tecnica: null, ...extra,
});
const receita = (id: string, nome: string, series: Serie[], extra: Partial<Receita> = {}): Receita => ({
  id, tipo: 'SERIES', origem: 'PADRAO', nome, descricao: null, pastaId: null, ordem: 1, versao: 1, conteudo: { series }, ...extra,
});
const cluster = { tipo: 'CLUSTER' as const, pausaSegundos: 15, blocos: [4, 4] };

const RECEITAS: Receita[] = [
  receita('m0000000-0000-4000-8000-000000000140', 'Força com preparação', [
    serie('a-aq', 'WARM_UP', { repsMin: 12, repsMax: 15 }),
    serie('a-fs1', 'FEEDER', { repsMin: 5, repsMax: 5, carga: daWs(50) }),
    serie('a-fs2', 'FEEDER', { repsMin: 3, repsMax: 3, carga: daWs(70) }),
    serie('a-fs3', 'FEEDER', { repsMin: 2, repsMax: 2, carga: daWs(85) }),
    serie('a-ws', 'WORKING', { repsMin: 4, repsMax: 6, esforco: { rir: 1, rpe: null } }),
    serie('a-bo1', 'BACK_OFF', { repsMin: 10, repsMax: 12, carga: daWs(80) }),
    serie('a-bo2', 'BACK_OFF', { repsMin: 10, repsMax: 12, carga: daWs(80) }),
  ], { pastaId: PASTA, descricao: 'Aquecimento, três de preparação, uma de trabalho e duas de back off.' }),
  receita('m0000000-0000-4000-8000-000000000141', 'Volume fictício', [
    serie('b-ws', 'WORKING'),
    serie('b-bo1', 'BACK_OFF', { repsMin: 10, repsMax: 12, carga: daWs(85) }),
    serie('b-bo2', 'BACK_OFF', { repsMin: 10, repsMax: 12, carga: daWs(85) }),
  ]),
  receita('m0000000-0000-4000-8000-000000000142', 'Top set e back off', [
    serie('c-ts', 'TOP_SET', { repsMin: 3, repsMax: 5 }),
    serie('c-bo', 'BACK_OFF', { repsMin: 8, repsMax: 10, carga: daWs(80) }),
  ]),
  receita('m0000000-0000-4000-8000-000000000143', 'Aquecimento fictício', [serie('d-aq', 'WARM_UP', { repsMin: 15, repsMax: 20 })]),
  receita('m0000000-0000-4000-8000-000000000144', 'Cluster fictício', [serie('e-cl', 'WORKING', { repsMin: 8, repsMax: 8, tecnica: cluster })]),
];

const seriesDaRemada = (n: number) => Array.from({ length: n }, (_, i) => serie(`ws-r${i}`, 'WORKING', { repsMin: 8, repsMax: 12 }));

async function abrir(page: Page, { largura, tema = 'ESCURO', series = seriesDaRemada(5), receitas = RECEITAS, erroNaLista = false }: {
  largura: number; tema?: 'CLARO' | 'ESCURO'; series?: Serie[]; receitas?: Receita[]; erroNaLista?: boolean;
}) {
  await page.setViewportSize({ width: largura, height: largura >= 1280 ? 1080 : 844 });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema]);
  const plano: Receita = {
    id: ID_PLANO, tipo: 'PLANO_TREINO', origem: 'CONSULTORIA', nome: 'Semana fictícia', descricao: null, pastaId: null, ordem: 1, versao: 1,
    conteudo: {
      objetivo: null, orientacoes: null,
      metodologia: { id: null, nome: 'Metodologia fictícia', configuracao: structuredClone(CONFIGURACAO_PADRAO) },
      sessoes: [{
        uid: 'sessao-1', nome: 'Treino A', diaSemana: 1, tipo: 'TREINO', frequenciaSemanal: null, observacao: null, cardio: null, grupos: [],
        exercicios: [{ uid: 'ex-1', exercicioId: null, nome: 'Remada fictícia', modalidade: 'LIVRE', videoUrl: null, observacao: null, progressao: true, unidade: 'kg', grupoUid: null, series }],
      }],
    },
  };
  let falhar = erroNaLista;
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /pastas-modelos': { corpo: [{ id: PASTA, nome: 'Força', versao: 1 }] },
    'GET /exercicios': { corpo: [] },
    'GET /receitas': (p, route) => {
      if (p.busca.get('tipo') !== 'SERIES') return json(route, []);
      if (falhar) { falhar = false; const e = erroApi(500, 'Erro interno.'); return json(route, e.corpo, e.status); }
      return json(route, receitas);
    },
    [`GET /receitas/${ID_PLANO}`]: (_p, route) => json(route, plano),
  });
  await page.goto(`/treinador/planejamento/modelo/${ID_PLANO}`);
  // Duas colunas (lista de exercícios) ou uma (o título do cartão abre), conforme a largura que sobra ao editor.
  await page.getByRole('button', { name: /^Exercício 1 de 1: Remada fictícia/ }).or(page.getByRole('button', { name: 'Editar Remada fictícia', exact: true })).click();
  await page.getByRole('button', { name: 'Usar receita de séries', exact: true }).click();
  return api;
}

const folha = (page: Page) => page.getByRole('dialog', { name: 'Usar receita' });
const opcao = (page: Page, nome: string) => folha(page).getByRole('option', { name: new RegExp(`^${nome}:`) });
const capturar = async (page: Page, caso: string, largura: number, tema: string) => {
  if (BASE) await page.screenshot({ path: path.join(BASE, `usar-receita-${caso}-${largura}-${tema.toLowerCase()}.png`) });
};
const semRolagemDeLado = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const tema of ['ESCURO', 'CLARO'] as const) {
  for (const largura of [1920, 1280]) {
    test(`usar receita no PC: abas, chip, escolha, prévia, setas + Enter e desfazer (${largura}px, ${tema.toLowerCase()})`, async ({ page }) => {
      const api = await abrir(page, { largura, tema });
      const f = folha(page);
      // Folha larga: 1100 px a partir de 1200 de janela.
      expect(Math.round((await f.boundingBox())!.width)).toBe(1100);
      await expect(f.getByRole('tab', { name: /^Completas/ })).toHaveAttribute('aria-selected', 'true');
      await expect(f.getByRole('option')).toHaveCount(3);
      // A primeira já vem escolhida, com a prévia: descrição uma vez, sequência pintada e a coleção.
      await expect(opcao(page, 'Força com preparação')).toHaveAttribute('aria-selected', 'true');
      const previa = f.getByRole('region', { name: 'Prévia da receita' });
      await expect(previa.getByRole('heading', { name: 'Força com preparação' })).toBeVisible();
      await expect(f.getByText('Aquecimento, três de preparação, uma de trabalho e duas de back off.', { exact: true })).toHaveCount(1);
      await expect(previa.getByText('Coleção: Força', { exact: true })).toBeVisible();
      // Uma linha por grupo de séries iguais e seguidas (as três FS têm repetições diferentes): seis linhas.
      await expect(previa.getByRole('button', { name: /^Série \d/ })).toHaveCount(6);
      // A linha que repetia os tipos em texto saiu: virou os selos da lista.
      await expect(f.getByText('Aquecimento ×1 · FS ×3 · WS ×1 · Back off ×2', { exact: true })).toHaveCount(0);
      await expect(opcao(page, 'Força com preparação').getByText('FS ×3', { exact: true })).toBeVisible();
      // Aviso curto e as duas ações no rodapé.
      await expect(f.getByText('Este exercício já tem 5 séries.', { exact: true })).toBeVisible();
      await expect(f.getByRole('button', { name: 'Substituir as 5 séries por Força com preparação', exact: true })).toBeEnabled();
      await expect(f.getByRole('button', { name: 'Acrescentar ao fim as séries de Força com preparação', exact: true })).toBeEnabled();
      // Chip Back off: só as completas com back off; a escolha vai à primeira que sobrou se a de antes sumir.
      await f.getByRole('radio', { name: 'Top set', exact: true }).click();
      await expect(f.getByRole('option')).toHaveCount(1);
      await expect(opcao(page, 'Top set e back off')).toHaveAttribute('aria-selected', 'true');
      await f.getByRole('radio', { name: 'Back off', exact: true }).click();
      await expect(f.getByRole('option')).toHaveCount(3);
      await opcao(page, 'Volume fictício').click();
      await expect(previa.getByRole('heading', { name: 'Volume fictício' })).toBeVisible();
      expect(await semRolagemDeLado(page)).toBe(true);
      await capturar(page, 'escolhida-com-filtro', largura, tema);
      // Setas trocam a escolha (sem dar a volta) e Enter aplica uma vez só.
      await opcao(page, 'Volume fictício').focus();
      await page.keyboard.press('ArrowDown');
      await expect(opcao(page, 'Top set e back off')).toHaveAttribute('aria-selected', 'true');
      await expect(opcao(page, 'Top set e back off')).toBeFocused();
      await capturar(page, 'foco-pelo-teclado', largura, tema);
      await page.keyboard.press('ArrowUp');
      await expect(opcao(page, 'Volume fictício')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(f).toHaveCount(0);
      await expect(page.getByText('Receita “Volume fictício” aplicada.', { exact: true })).toHaveCount(1);
      await expect(linhaDaSerie(page, /^Série \d/)).toHaveCount(2);
      await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
      await expect(linhaDaSerie(page, /^Série \d/)).toHaveCount(1);
      expect(api.pedidos.filter((p) => p.metodo === 'PUT')).toHaveLength(0);
      expect(api.errosDaPagina).toEqual([]);
      expect(api.naoTratadas).toEqual([]);
    });
  }
}

test('usar receita no PC: aba Partes, acrescentar ao fim e o limite de 30 séries', async ({ page }) => {
  const api = await abrir(page, { largura: 1280, series: seriesDaRemada(28) });
  const f = folha(page);
  await f.getByRole('tab', { name: /^Partes/ }).click();
  await expect(f.getByRole('option')).toHaveCount(2);
  // Força com preparação não existe em Partes: a escolha vai à primeira.
  await expect(opcao(page, 'Aquecimento fictício')).toHaveAttribute('aria-selected', 'true');
  await f.getByRole('button', { name: 'Acrescentar ao fim as séries de Aquecimento fictício', exact: true }).click();
  await expect(page.getByText('Receita “Aquecimento fictício” acrescentada ao fim.', { exact: true })).toBeVisible();
  // 29 + a receita de 7 passaria de 30: acrescentar fica desabilitado com o motivo, substituir vale.
  await page.getByRole('button', { name: 'Usar receita de séries', exact: true }).click();
  await expect(f.getByText('Este exercício já tem 29 séries.', { exact: true })).toBeVisible();
  await expect(f.getByRole('button', { name: 'Acrescentar ao fim as séries de Força com preparação', exact: true })).toBeDisabled();
  await expect(f.getByText('Passaria de 30 séries, o máximo: o exercício tem 29 e a receita traz 7.', { exact: true })).toBeVisible();
  await expect(f.getByRole('button', { name: 'Substituir as 29 séries por Força com preparação', exact: true })).toBeEnabled();
  expect(api.naoTratadas).toEqual([]);
});

test('usar receita no PC: exercício sem séries tem só "Usar receita"; busca e filtro sem resultado', async ({ page }) => {
  await abrir(page, { largura: 1280, tema: 'CLARO', series: [] });
  const f = folha(page);
  await expect(f.getByText(/^Este exercício já tem/)).toHaveCount(0);
  await expect(f.getByRole('button', { name: /^Substituir/ })).toHaveCount(0);
  await expect(f.getByRole('button', { name: /^Acrescentar/ })).toHaveCount(0);
  const busca = f.getByRole('textbox', { name: 'Buscar receita', exact: true });
  await busca.fill('nada assim');
  await expect(f.getByText('Nenhuma receita com essa busca.', { exact: true })).toBeVisible();
  await expect(f.getByRole('button', { name: 'Usar receita', exact: true })).toBeDisabled();
  await capturar(page, 'busca-sem-resultado', 1280, 'CLARO');
  await f.getByRole('button', { name: 'Limpar busca', exact: true }).click();
  await f.getByRole('radio', { name: 'Top set', exact: true }).click();
  await busca.fill('volume');
  await expect(f.getByText('Nenhuma receita com Top set nessa busca.', { exact: true })).toBeVisible();
  await f.getByRole('button', { name: 'Mostrar todos os tipos', exact: true }).click();
  await expect(opcao(page, 'Volume fictício')).toBeVisible();
  await f.getByRole('button', { name: 'Usar receita Volume fictício', exact: true }).click();
  await expect(page.getByText('Receita “Volume fictício” aplicada.', { exact: true })).toBeVisible();
  await expect(linhaDaSerie(page, /^Série \d/)).toHaveCount(2);
});

test('usar receita: erro ao carregar com "Tentar de novo" e consultoria sem receitas', async ({ page }) => {
  await abrir(page, { largura: 1280, erroNaLista: true });
  const f = folha(page);
  await expect(f.getByRole('button', { name: 'Tentar de novo', exact: true })).toBeVisible();
  await capturar(page, 'erro', 1280, 'ESCURO');
  await f.getByRole('button', { name: 'Tentar de novo', exact: true }).click();
  await expect(f.getByRole('option')).toHaveCount(3);

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const outra = await page.context().newPage();
  await abrir(outra, { largura: 1280, receitas: [] });
  await expect(folha(outra).getByText('Nenhuma receita de séries ainda', { exact: true })).toBeVisible();
  await capturar(outra, 'vazio', 1280, 'ESCURO');
});

for (const tema of ['ESCURO', 'CLARO'] as const) {
  test(`usar receita no celular: lista, prévia com Voltar e aplicar (390px, ${tema.toLowerCase()})`, async ({ page }) => {
    const api = await abrir(page, { largura: 390, tema });
    const f = folha(page);
    await expect(f.getByRole('option')).toHaveCount(3);
    // Na lista não há ações: elas aparecem na prévia.
    await expect(f.getByRole('button', { name: /^Substituir/ })).toHaveCount(0);
    await f.getByRole('radio', { name: 'Back off', exact: true }).click();
    expect(await semRolagemDeLado(page)).toBe(true);
    await capturar(page, 'lista', 390, tema);
    await opcao(page, 'Top set e back off').click();
    await expect(f.getByRole('heading', { name: 'Top set e back off' })).toBeVisible();
    await expect(f.getByRole('option')).toHaveCount(0);
    await expect(f.getByText('Este exercício já tem 5 séries.', { exact: true })).toBeVisible();
    await capturar(page, 'previa', 390, tema);
    // "Voltar à lista" (e o X) voltam à lista sem fechar, com o chip e a escolha como estavam.
    await f.getByRole('button', { name: 'Voltar à lista', exact: true }).click();
    await expect(opcao(page, 'Top set e back off')).toHaveAttribute('aria-selected', 'true');
    await opcao(page, 'Top set e back off').click();
    await f.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(f.getByRole('option')).toHaveCount(3);
    // O voltar do navegador também volta da prévia à lista, com a folha aberta.
    await opcao(page, 'Volume fictício').click();
    await expect(f.getByRole('heading', { name: 'Volume fictício' })).toBeVisible();
    await page.goBack();
    await expect(opcao(page, 'Volume fictício')).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(new RegExp(ID_PLANO));
    await opcao(page, 'Volume fictício').click();
    await f.getByRole('button', { name: 'Substituir as 5 séries por Volume fictício', exact: true }).click();
    await expect(page.getByText('Receita “Volume fictício” aplicada.', { exact: true })).toBeVisible();
    // Aplicar pela prévia fecha a folha e o passo sem tirar a pessoa do editor.
    await expect(f).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(ID_PLANO));
    await expect(linhaDaSerie(page, /^Série \d/)).toHaveCount(2);
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}

// Janela baixa: as duas partes cabem sem o corpo da folha rolar, também com o motivo sob "Acrescentar ao fim" (29 séries).
for (const largura of [1024, 1280]) {
  test(`usar receita em janela baixa: largura da folha e nada rola fora das partes (${largura}×720)`, async ({ page }) => {
    await abrir(page, { largura, series: seriesDaRemada(29) });
    await page.setViewportSize({ width: largura, height: 720 });
    const f = folha(page);
    await expect(f.getByText('Passaria de 30 séries, o máximo: o exercício tem 29 e a receita traz 7.', { exact: true })).toBeVisible();
    expect(Math.round((await f.boundingBox())!.width)).toBe(largura >= 1200 ? 1100 : Math.round(largura * 0.92));
    // O corpo rolável da folha (o primeiro com rolagem dentro do diálogo) não rola: só a lista e a prévia rolam.
    const corpoRola = await f.evaluate((dialogo) => {
      const rolavel = [...dialogo.querySelectorAll<HTMLElement>('*')].find((el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowY));
      return rolavel ? rolavel.scrollHeight > rolavel.clientHeight + 1 : false;
    });
    expect(corpoRola).toBe(false);
    await expect(f.getByRole('button', { name: 'Substituir as 29 séries por Força com preparação', exact: true })).toBeInViewport();
    await capturar(page, 'janela-baixa', largura, 'ESCURO');
  });
}

// Aba "Minhas" (V115): as receitas que a equipe criou ou salvou (`origem` CONSULTORIA), completas ou partes; seguem
// também em Completas e Partes. A folha nunca abre nela, a busca vale ao trocar de aba e, vazia, diz como criar uma.
const COM_MINHAS: Receita[] = RECEITAS.map((r) => (['Volume fictício', 'Cluster fictício'].includes(r.nome) ? { ...r, origem: 'CONSULTORIA' } : r));
for (const tema of ['ESCURO', 'CLARO'] as const) {
  for (const largura of [1280, 390]) {
    test(`usar receita: aba Minhas com contagem, busca preservada, setas e estado vazio (${largura}px, ${tema.toLowerCase()})`, async ({ page }) => {
      const api = await abrir(page, { largura, tema, receitas: COM_MINHAS });
      const f = folha(page);
      await expect(f.getByRole('tab', { name: 'Completas (3)', exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(f.getByRole('tab', { name: 'Partes (2)', exact: true })).toBeVisible();
      const minhas = f.getByRole('tab', { name: 'Minhas (2)', exact: true });
      await minhas.click();
      await expect(minhas).toHaveAttribute('aria-selected', 'true');
      await expect(f.getByRole('option')).toHaveCount(2);
      await expect(opcao(page, 'Volume fictício')).toBeVisible();
      await expect(opcao(page, 'Cluster fictício')).toBeVisible();
      expect(await semRolagemDeLado(page)).toBe(true);
      await capturar(page, 'minhas', largura, tema);
      if (largura >= 1280) {
        await expect(opcao(page, 'Volume fictício')).toHaveAttribute('aria-selected', 'true');
        await expect(f.getByRole('region', { name: 'Prévia da receita' }).getByRole('heading', { name: 'Volume fictício' })).toBeVisible();
        await opcao(page, 'Volume fictício').focus();
        await page.keyboard.press('ArrowDown');
        await expect(opcao(page, 'Cluster fictício')).toHaveAttribute('aria-selected', 'true');
        await expect(opcao(page, 'Cluster fictício')).toBeFocused();
      }
      // A busca fica ao trocar de aba e as contagens a seguem.
      await f.getByRole('textbox', { name: 'Buscar receita', exact: true }).fill('cluster');
      await expect(f.getByRole('tab', { name: 'Minhas (1)', exact: true })).toBeVisible();
      await expect(f.getByRole('option')).toHaveCount(1);
      await f.getByRole('tab', { name: 'Completas (0)', exact: true }).click();
      await expect(f.getByText('Nenhuma receita com essa busca.', { exact: true })).toBeVisible();
      await f.getByRole('tab', { name: 'Partes (1)', exact: true }).click();
      await expect(opcao(page, 'Cluster fictício')).toBeVisible();
      expect(api.errosDaPagina).toEqual([]);
      expect(api.naoTratadas).toEqual([]);

      // Sem nenhuma receita da equipe: o estado vazio da aba, com a dica de "Salvar como receita".
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      const outra = await page.context().newPage();
      await abrir(outra, { largura, tema });
      const g = folha(outra);
      await g.getByRole('tab', { name: 'Minhas (0)', exact: true }).click();
      await expect(g.getByText('Você ainda não tem receitas suas', { exact: true })).toBeVisible();
      await expect(g.getByText('Num exercício com séries, toque em “Salvar como receita” para guardar a estrutura; ela aparece aqui.', { exact: true })).toBeVisible();
      await expect(g.getByRole('option')).toHaveCount(0);
      await capturar(outra, 'minhas-vazia', largura, tema);
    });
  }
}
