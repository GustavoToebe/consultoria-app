import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import type { Atualizacao } from '../src/api/tipos';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso, type RespostasApi } from './api-falsa';
import { ANTERIOR, ATUAL, ID, LISTA, rotasDaRevisao, SO_COM_PONTOS, SO_PONTOS } from './pontos-de-atencao-falsos';

/**
 * Pontos de atenção (`docs/planos/regras-de-atencao.md`, R4, R9, C5 e o plano-front): o selo neutro "N pontos de atenção" na
 * lista de atualizações, o filtro "Só com pontos de atenção" (`?comAtencao=true` na lista, nas contagens e na fila do
 * "Próxima ›") e o grupo "Pontos de atenção" no topo do "O que mudou" da revisão. Com a chave desligada (ou sem as
 * permissões) nada aparece e nada vai à API, mesmo que a API mande. `E2E_CAPTURAS` grava as capturas. Só dados fictícios.
 */

const TODAS = [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER', 'ATUALIZACAO_RESPONDER'];
const ultimo = (pedidos: PedidoFalso[], caminho: string) => pedidos.filter((p) => p.metodo === 'GET' && p.caminho === caminho).at(-1)?.busca;
const comAtencaoEmAlgum = (pedidos: PedidoFalso[]) => pedidos.some((p) => p.busca.has('comAtencao'));

async function capturar(page: Page, nome: string) {
  const pasta = process.env.E2E_CAPTURAS;
  if (!pasta) return;
  mkdirSync(pasta, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(pasta, `${nome}.png`), fullPage: true });
}

async function preparar(page: Page, largura: number, o: { escuro?: boolean; ligada?: boolean; permissoes?: string[]; extra?: RespostasApi } = {}) {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 1080 });
  if (o.escuro) await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), TREINADOR.id);
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: o.permissoes ?? TODAS, regrasAtencaoHabilitada: o.ligada ?? true })),
    'GET /responsaveis': { corpo: [] },
    ...o.extra,
  });
}

/** A lista: com `comAtencao=true` só as com pontos; o detalhe de cada uma pelo id (pasta e nome da linha). */
function rotasDaLista(o: { vaziaComAtencao?: boolean } = {}): RespostasApi {
  const itens = (p: PedidoFalso) => (p.busca.get('comAtencao') === 'true' ? (o.vaziaComAtencao ? [] : SO_COM_PONTOS) : LISTA);
  return {
    ...rotasDaRevisao(ATUAL),
    'GET /atualizacoes/pagina': (p, route) => json(route, { itens: itens(p), total: itens(p).length }),
    'GET /atualizacoes/contagens': (p, route) => json(route, { PARA_REVISAR: itens(p).length, ATRASADAS: 0, AVISARAM_ATRASO: 0, PROXIMAS: 0 }),
    'GET /atualizacoes': (p, route) => json(route, itens(p)),
    'GET /atualizacoes/{id}': (p, route) => {
      const id = p.caminho.split('/').at(-1) ?? null;
      const item = LISTA.find((a) => a.id === id);
      return item ? json(route, { ...ATUAL, id, pastaId: item.pastaId, nomeAluno: item.nomeAluno } satisfies Atualizacao) : json(route, erroApi(404, 'Não encontrado.').corpo, 404);
    },
  };
}

const linha = (page: Page, nome: string) => page.getByRole('link', { name: new RegExp(`^Abrir atualização de ${nome}`) });

for (const largura of [390, 1280, 1920]) {
  for (const escuro of [false, true]) {
    const tema = escuro ? 'escuro' : 'claro';

    test(`lista: selo neutro com a contagem e o filtro "Só com pontos de atenção" no pedido, no chip e na fila (${largura}px, ${tema})`, async ({ page }) => {
      const { pedidos, naoTratadas, errosDaPagina } = await preparar(page, largura, { escuro, extra: rotasDaLista() });
      await page.goto('/treinador/atualizacoes?situacao=PARA_REVISAR');
      await expect(page.getByRole('heading', { level: 1, name: 'Atualizações' })).toBeVisible();
      // O selo diz quantos (singular e plural) e entra no nome do link; zero e nulo não ganham selo.
      await expect(linha(page, 'Ana Fictícia')).toHaveAccessibleName(/, Para revisar, 2 pontos de atenção$/);
      await expect(linha(page, 'Ana Fictícia').getByText('2 pontos de atenção', { exact: true })).toBeVisible();
      await expect(linha(page, 'Carla Teste').getByText('1 ponto de atenção', { exact: true })).toBeVisible();
      for (const nome of ['Bruno Exemplo', 'Diego Modelo']) await expect(linha(page, nome)).not.toContainText('ponto');
      expect(comAtencaoEmAlgum(pedidos)).toBe(false);
      await capturar(page, `lista-${largura}-${tema}`);

      // O filtro mora no painel, no grupo próprio; nada vai à API antes do Aplicar.
      await page.getByRole('button', { name: /^Filtros, / }).click();
      const painel = page.getByRole('dialog', { name: 'Filtros de atualizações' });
      await painel.getByRole('checkbox', { name: 'Só com pontos de atenção' }).click();
      expect(comAtencaoEmAlgum(pedidos)).toBe(false);
      await painel.getByRole('button', { name: /^(Aplicar filtros|Mostrar )/ }).click();
      await expect(painel).toHaveCount(0);
      await expect.poll(() => ultimo(pedidos, '/atualizacoes/pagina')?.get('comAtencao')).toBe('true');
      expect(ultimo(pedidos, '/atualizacoes/contagens')?.get('comAtencao')).toBe('true');
      await expect(page).toHaveURL(/comAtencao=true/);
      await expect(page.getByRole('button', { name: 'Tirar filtro: Só com pontos de atenção' })).toBeVisible();
      await expect(linha(page, 'Bruno Exemplo')).toHaveCount(0);
      await expect(linha(page, 'Ana Fictícia')).toHaveAttribute('href', /comAtencao=true/);
      await capturar(page, `lista-filtrada-${largura}-${tema}`);

      // A fila da revisão segue o filtro: "Próxima ›" pede a lista com comAtencao e abre a seguinte com pontos.
      if (largura === 1920 && !escuro) {
        await linha(page, 'Ana Fictícia').click();
        await expect(page.getByRole('heading', { level: 1, name: /Ana Fictícia · Atualização/ })).toBeVisible();
        await page.getByRole('button', { name: 'Abrir a próxima atualização da lista' }).click();
        await expect(page.getByRole('heading', { level: 1, name: /Carla Teste · Atualização/ })).toBeVisible();
        expect(ultimo(pedidos, '/atualizacoes')?.get('comAtencao')).toBe('true');
        await expect(page).toHaveURL(/comAtencao=true/);
      }
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test(`revisão: pontos de atenção no topo do "O que mudou", antes do histórico e sem repetir linha (${largura}px, ${tema})`, async ({ page }) => {
      let liberar = () => {};
      const historicoChegou = new Promise<void>((r) => { liberar = r; });
      const { naoTratadas, errosDaPagina } = await preparar(page, largura, { escuro, extra: rotasDaRevisao(ATUAL, async (_p, route) => {
        await historicoChegou;
        await json(route, [ATUAL, ANTERIOR]);
      }) });
      await page.goto(`/treinador/atualizacoes/${ID}`);
      await expect(page.getByRole('heading', { level: 1, name: new RegExp(`${ALUNO.nome} · Atualização`) })).toBeVisible();
      const bloco = page.getByTestId('pontos-de-atencao');
      // Antes do histórico: os pontos já aparecem (vêm do detalhe), com o valor atual; o "O que mudou" ainda compara.
      await expect(page.getByText('Comparando com a atualização anterior…', { exact: true })).toBeVisible();
      await expect(bloco.getByRole('heading', { name: '6 pontos de atenção' })).toBeVisible();
      const itens = bloco.getByRole('listitem');
      await expect(itens).toHaveCount(5);
      // Ordem: perguntas do questionário, a de fora desta versão, os dias com treino e o peso.
      await expect(itens.nth(0)).toContainText('Sono');
      await expect(itens.nth(0)).toContainText('Sua regra: Sono 5 ou menos');
      await expect(itens.nth(0)).toContainText('Sua regra: nota caiu 2 pontos ou mais');
      await expect(itens.nth(1)).toContainText('Sentiu dores nos treinos?');
      await expect(itens.nth(1)).toContainText('Sua regra: resposta Sim em Sentiu dores nos treinos?');
      await expect(itens.nth(2)).toContainText('Pergunta');
      await expect(itens.nth(2)).toContainText('3');
      await expect(itens.nth(2)).toContainText('Sua regra: Pergunta 4 ou menos');
      await expect(itens.nth(3)).toContainText('Dias com treino registrado');
      await expect(itens.nth(3)).toContainText('Sua regra: 4 dias com treino ou menos, contados no envio');
      await expect(itens.nth(4)).toHaveText(/^PesoSua regra: peso mudou 1,5 kg ou mais$/);

      // O histórico chega: o sono e os dias ganham "anterior → atual"; o "O que mudou" fica só com o que os pontos não mostram.
      liberar();
      await expect(page.getByText('desde a atualização de 23/10', { exact: true })).toBeVisible();
      await expect(itens.nth(0)).toContainText(/7\s*→\s*para\s*4/);
      await expect(itens.nth(3)).toContainText(/9\s*→\s*para\s*3/);
      const mudou = page.getByRole('list', { name: 'O que mudou', exact: true });
      await expect(mudou.getByRole('listitem')).toHaveCount(2);
      await expect(mudou).toContainText('Peso em jejum');
      await expect(mudou).toContainText('Energia nos treinos');
      await expect(mudou).not.toContainText('Sono');
      await expect(mudou).not.toContainText('Dias com treino');
      // O grupo vem antes do título "O que mudou".
      const yBloco = (await bloco.boundingBox())!.y;
      const yMudou = (await page.getByRole('heading', { name: 'O que mudou' }).boundingBox())!.y;
      expect(yBloco).toBeLessThan(yMudou);
      if (largura < 768) expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura);
      await bloco.scrollIntoViewIfNeeded();
      await capturar(page, `revisao-${largura}-${tema}`);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('revisão: o histórico falhou e os pontos de atenção continuam; todas as mudanças nos pontos não dizem "nada mudou"', async ({ page }) => {
  const { errosDaPagina } = await preparar(page, 1280, { extra: rotasDaRevisao(ATUAL, erroApi(500, 'Falha simulada.')) });
  await page.goto(`/treinador/atualizacoes/${ID}`);
  await expect(page.getByTestId('pontos-de-atencao').getByRole('heading', { name: '6 pontos de atenção' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Tentar de novo/ })).toBeVisible();
  expect(errosDaPagina).toEqual([]);

  const outra = await page.context().newPage();
  await preparar(outra, 1280, { extra: rotasDaRevisao(SO_PONTOS, { corpo: [SO_PONTOS, ANTERIOR] }) });
  await outra.goto(`/treinador/atualizacoes/${ID}`);
  await expect(outra.getByTestId('pontos-de-atencao').getByRole('heading', { name: '1 ponto de atenção' })).toBeVisible();
  await expect(outra.getByTestId('pontos-de-atencao')).toContainText(/7\s*→\s*para\s*4/);
  await expect(outra.getByText('Nenhuma outra resposta comparável mudou.', { exact: true })).toBeVisible();
  await expect(outra.getByText('Nenhuma resposta comparável mudou desde a atualização anterior.', { exact: true })).toHaveCount(0);
  await capturar(outra, 'revisao-so-pontos-1280-claro');
});

test('lista: só o filtro de atenção e nada encontrado diz o porquê e volta à lista inteira', async ({ page }) => {
  const { pedidos } = await preparar(page, 1280, { extra: rotasDaLista({ vaziaComAtencao: true }) });
  await page.goto('/treinador/atualizacoes?situacao=PARA_REVISAR&comAtencao=true');
  await expect(page.getByText('Nenhuma atualização com pontos de atenção', { exact: true })).toBeVisible();
  await capturar(page, 'lista-vazia-1280-claro');
  await page.getByRole('button', { name: 'Ver todas as atualizações' }).click();
  await expect(page).not.toHaveURL(/comAtencao/);
  await expect(linha(page, 'Ana Fictícia')).toBeVisible();
  expect(ultimo(pedidos, '/atualizacoes/pagina')?.has('comAtencao')).toBe(false);
});

// Sem `ATUALIZACAO_LER` + `ALUNO_SENSIVEL_LER` a tela nem abre (guarda da rota); a regra da tela está em `pontosDeAtencaoVisiveis`.
test('chave desligada: nada de pontos de atenção na lista nem na revisão, nem o comAtencao do endereço vai à API', async ({ page }) => {
  const { pedidos } = await preparar(page, 1280, { ligada: false, extra: rotasDaLista() });
  await page.goto('/treinador/atualizacoes?situacao=PARA_REVISAR&comAtencao=true');
  await expect(linha(page, 'Ana Fictícia')).toBeVisible();
  await expect(page.getByText(/pontos? de atenção/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tirar filtro: Só com pontos de atenção' })).toHaveCount(0);
  expect(comAtencaoEmAlgum(pedidos)).toBe(false);
  await page.getByRole('button', { name: /^Filtros, / }).click();
  await expect(page.getByRole('dialog', { name: 'Filtros de atualizações' }).getByRole('checkbox', { name: 'Só com pontos de atenção' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.goto(`/treinador/atualizacoes/${LISTA[0].id}?situacao=PARA_REVISAR&comAtencao=true`);
  await expect(page.getByRole('heading', { name: 'O que mudou' })).toBeVisible();
  await expect(page.getByTestId('pontos-de-atencao')).toHaveCount(0);
  await page.getByRole('button', { name: 'Abrir a próxima atualização da lista' }).click();
  await expect.poll(() => ultimo(pedidos, '/atualizacoes')?.has('situacao')).toBe(true);
  expect(comAtencaoEmAlgum(pedidos)).toBe(false);
});
