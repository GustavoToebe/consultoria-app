import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { ALUNO_ID, BIBLIOTECA, PLANO_ID, planoDetalhe } from './editor-inspetor.dados';

/**
 * Série aberta do editor de treino (27/11): Tipo e Técnica como selects iguais com o ⓘ, Séries e Descanso como "Digite ou
 * escolha", repetições Faixa · Exata · AMRAP com a dica de uma linha, carga e RIR com "Mesmo valor para todas", a prévia
 * "Para o aluno" em mini cartão, o Cluster (adicionar, remover e editar blocos na hora: o defeito de 27/11), as seções
 * recolhíveis do exercício e o fim da lista ("+ Nova série" como última linha, o total no cabeçalho). Só dados fictícios.
 * Capturas em `E2E_CAPTURAS` (padrão: a pasta do teste), em 1280 e 1920, claro e escuro.
 */

const capturas = process.env.E2E_CAPTURAS;
async function capturar(page: Page, nome: string, saida: string) {
  await page.screenshot({ path: capturas ? path.join(capturas, nome) : path.join(saida, nome), fullPage: false });
}

async function abrir(page: Page, tema: 'CLARO' | 'ESCURO') {
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR'] })),
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /exercicios': { corpo: BIBLIOTECA },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /planos-treino/${PLANO_ID}`]: (_p, route) => json(route, planoDetalhe(false)),
  });
  await page.goto(`/treinador/treinos/${PLANO_ID}`);
  await expect(page.getByText('Peito e tríceps', { exact: true }).first()).toBeVisible();
  return api;
}

const linha = (page: Page, nome: RegExp) => page.getByRole('group', { name: 'Blocos do exercício' }).getByRole('button', { name: nome });
const item = (page: Page, n: number, nome: string) => page.getByRole('button', { name: new RegExp(`^Exercício ${n} de 7: ${nome}`) });
const semRolagemLateral = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const largura of [1280, 1920]) {
  for (const tema of ['ESCURO', 'CLARO'] as const) {
    const sufixo = `${largura}-${tema.toLowerCase()}`;

    test(`série normal: Faixa, Exata e AMRAP, fim da lista e seções do exercício (${sufixo})`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: largura, height: 1100 });
      const api = await abrir(page, tema);
      const saida = testInfo.outputPath();

      // Item 10: o total no cabeçalho da seção e as duas ações de receita ao lado; nada do rodapé antigo.
      await expect(page.getByText('· 5 no total', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Usar receita de séries', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Salvar como receita de séries', exact: true })).toBeVisible();
      await expect(page.getByText(/^Este exercício:/)).toHaveCount(0);
      // "+ Nova série" é a última linha da tabela, tracejada, na largura da tabela.
      const grupo = page.getByRole('group', { name: 'Blocos do exercício' });
      const nova = grupo.getByRole('button', { name: 'Nova série', exact: true });
      await expect(nova).toBeVisible();
      const [caixaNova, caixaDaUltima, caixaDaTabela] = [await nova.boundingBox(), await linha(page, /^Série 3 · Back off/).boundingBox(), await grupo.boundingBox()];
      expect(caixaNova!.y).toBeGreaterThan(caixaDaUltima!.y);
      expect(Math.abs(caixaNova!.width - caixaDaTabela!.width)).toBeLessThan(4);
      // A altura de uma linha fechada de duas linhas de texto (Série N e N séries).
      expect(caixaNova!.height).toBeGreaterThanOrEqual(56);

      // A WS aberta: Tipo e Técnica lado a lado, com o ⓘ.
      await linha(page, /^Série 2 · WS/).click();
      const tipo = page.getByRole('button', { name: /^Tipo da série: WS\. Escolher\.$/ });
      const tecnica = page.getByRole('button', { name: /^Técnica da série: Nenhuma\. Escolher\.$/ });
      await expect(tipo).toBeVisible();
      const [t, k] = [await tipo.boundingBox(), await tecnica.boundingBox()];
      expect(Math.abs(t!.y - k!.y)).toBeLessThan(4);
      expect(Math.abs(t!.width - k!.width)).toBeLessThan(4);
      await page.getByRole('button', { name: 'O que é o tipo WS?', exact: true }).click();
      await expect(page.getByRole('button', { name: 'O que é o tipo WS?', exact: true })).toHaveAttribute('aria-expanded', 'true');
      await page.getByRole('button', { name: 'O que é o tipo WS?', exact: true }).click();

      // Séries e Descanso: "Digite ou escolha"; o descanso aceita "1:30" e mostra "90 s".
      await expect(page.getByRole('button', { name: 'Séries: 1. Escolher.', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Descanso: 3 min. Escolher.', exact: true }).click();
      await page.getByRole('textbox', { name: 'Digite ou escolha', exact: true }).fill('1:30');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: 'Descanso: 90 s. Escolher.', exact: true })).toBeVisible();

      // Faixa (6 a 8): a área das repetições tem largura fixa, o Descanso não pula ao trocar de forma.
      const descanso = page.getByRole('button', { name: 'Descanso: 90 s. Escolher.', exact: true });
      const x0 = (await descanso.boundingBox())!.x;
      await expect(page.getByRole('textbox', { name: 'Reps mín.', exact: true })).toHaveValue('6');
      await capturar(page, `serie-faixa-${sufixo}.png`, saida);
      await page.getByRole('radio', { name: 'Exata', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Repetições', exact: true })).toHaveValue('6');
      expect((await descanso.boundingBox())!.x).toBeCloseTo(x0, 0);
      await page.getByRole('textbox', { name: 'Repetições', exact: true }).fill('');
      await expect(page.getByText('Sem repetições: o aluno lê a série por tempo.', { exact: true })).toBeVisible();
      await page.getByRole('textbox', { name: 'Repetições', exact: true }).fill('8');
      await capturar(page, `serie-exata-${sufixo}.png`, saida);
      await page.getByRole('radio', { name: 'AMRAP', exact: true }).click();
      await expect(page.getByText('O aluno faz o máximo que conseguir e anota quantas fez.', { exact: true })).toBeVisible();
      expect((await descanso.boundingBox())!.x).toBeCloseTo(x0, 0);
      // A prévia do aluno (seção 4): os cartões da tela do exercício do aluno e a legenda; a linha "Para o aluno:" saiu.
      await expect(page.getByRole('group', { name: 'Prévia para o aluno' })).toBeVisible();
      await expect(page.getByText('Descanso de 90 s depois da série', { exact: true })).toBeVisible();
      await expect(page.getByText(/^Para o aluno: /)).toHaveCount(0);
      await capturar(page, `serie-amrap-${sufixo}.png`, saida);

      // Carga e RIR: o ⓘ do título; o RIR mostra só o valor.
      await expect(page.getByRole('button', { name: 'Série 1 · RIR: 1. Escolher.', exact: true })).toBeVisible();

      // Item 8: seções recolhíveis com resumo; abertas, em grade.
      await expect(page.getByText('Supino reto com barra · sem vídeo · sem cadência', { exact: true })).toBeVisible();
      await expect(page.getByText('Nenhuma alternativa', { exact: true })).toBeVisible();
      // A página rola por dentro: leva o topo do exercício ao meio da janela antes da captura.
      const topoDasSecoes = () => page.getByRole('button', { name: 'Nome de exibição e instruções', exact: true }).evaluate((e) => e.scrollIntoView({ block: 'center' }));
      await topoDasSecoes();
      await capturar(page, `secoes-fechadas-${sufixo}.png`, saida);
      await page.getByRole('button', { name: 'Nome de exibição e instruções', exact: true }).click();
      await page.getByRole('button', { name: 'Alternativas de troca · 0 de 3', exact: true }).click();
      const nome = await page.getByRole('textbox', { name: 'Nome de exibição', exact: true }).boundingBox();
      const video = await page.getByRole('textbox', { name: 'Vídeo (link do YouTube, opcional)', exact: true }).boundingBox();
      expect(Math.abs(nome!.y - video!.y)).toBeLessThan(4);
      expect((await page.getByRole('textbox', { name: 'Cadência', exact: true }).boundingBox())!.width).toBeLessThan(230);
      await expect(page.getByRole('button', { name: 'Adicionar alternativa a Supino reto com barra', exact: true })).toBeVisible();
      await topoDasSecoes();
      await capturar(page, `secoes-abertas-${sufixo}.png`, saida);

      // "+ Nova série" adiciona e abre a série nova (a de trabalho, depois do Back off).
      await nova.click();
      await expect(page.getByText('· 6 no total', { exact: true })).toBeVisible();
      await expect(page.getByRole('region', { name: /^Editando série 4, / })).toBeVisible();
      expect(await semRolagemLateral(page)).toBe(true);
      expect(api.errosDaPagina).toEqual([]);
    });

    test(`cluster: blocos diferentes, adicionar, editar e remover atualizam na hora (${sufixo})`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: largura, height: 1100 });
      const api = await abrir(page, tema);
      const saida = testInfo.outputPath();
      await item(page, 3, 'Crucifixo na máquina').click();
      // O 1º bloco já abre com o exercício; tocar nele fecharia.
      if ((await linha(page, /^Série 1 · WS/).getAttribute('aria-expanded')) !== 'true') await linha(page, /^Série 1 · WS/).click();
      const bloco = (n: number) => page.getByRole('textbox', { name: `Bloco ${n}`, exact: true });
      await expect(page.getByRole('radio', { name: 'Blocos diferentes', exact: true })).toBeChecked();
      await expect(bloco(3)).toHaveValue('2');
      await expect(page.getByText('3 blocos · 10 reps por série', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Descanso: 2 min. Escolher.', exact: true })).toBeVisible();
      // O descanso do cluster é o da série inteira (seção 3); a linha Repetições não existe no cluster.
      await expect(page.getByText('É o tempo depois de cada série (os blocos têm a pausa própria).', { exact: true })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Reps mín.', exact: true })).toHaveCount(0);
      await capturar(page, `cluster-antes-${sufixo}.png`, saida);

      // Adicionar: o bloco novo entra com as repetições do último, editável e focado; resumo e linha mudam na hora.
      await page.getByRole('button', { name: 'Adicionar um bloco', exact: true }).click();
      await expect(bloco(4)).toHaveValue('2');
      await expect(bloco(4)).toBeFocused();
      await expect(page.getByText('4 blocos · 12 reps por série', { exact: true })).toBeVisible();
      await capturar(page, `cluster-depois-${sufixo}.png`, saida);
      await bloco(4).fill('4');
      await expect(page.getByText('4 blocos · 14 reps por série', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Remover um bloco', exact: true }).click();
      await expect(bloco(4)).toHaveCount(0);
      await expect(page.getByText('3 blocos · 10 reps por série', { exact: true })).toBeVisible();

      // O defeito de 27/11: com blocos iguais em "Blocos diferentes", mais um bloco não pode voltar para "iguais".
      await page.getByRole('button', { name: 'Digitar como texto (4-4-2)', exact: true }).click();
      await page.getByRole('textbox', { name: 'Blocos de repetições', exact: true }).fill('5+5+5+5');
      await expect(page.getByText('4 blocos · 20 reps por série', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Adicionar um bloco', exact: true }).click();
      await expect(page.getByRole('radio', { name: 'Blocos diferentes', exact: true })).toBeChecked();
      await expect(bloco(5)).toHaveValue('5');
      await expect(page.getByText('5 blocos · 25 reps por série', { exact: true })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Blocos de repetições', exact: true })).toHaveValue('5-5-5-5-5');
      await page.getByRole('button', { name: 'Remover um bloco', exact: true }).click();
      await expect(page.getByText('4 blocos · 20 reps por série', { exact: true })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Blocos de repetições', exact: true })).toHaveValue('5-5-5-5');

      // Blocos iguais: um campo só, com a quantidade ao lado e os mesmos − e +.
      await page.getByRole('radio', { name: 'Blocos iguais', exact: true }).click();
      await page.getByRole('textbox', { name: 'Repetições em cada bloco', exact: true }).fill('3');
      await expect(page.getByText('4 blocos · 12 reps por série', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Adicionar um bloco', exact: true }).click();
      await expect(page.getByText('5 blocos · 15 reps por série', { exact: true })).toBeVisible();
      // A pausa: `[s] s · [respirações] respirações (opcional)`, dois campos fixos na mesma linha; a dica diz o que o aluno lê.
      const pausa = page.getByRole('textbox', { name: 'Pausa entre blocos (s)', exact: true });
      const respiracoes = page.getByRole('textbox', { name: 'Pausa entre blocos em respirações', exact: true });
      await respiracoes.fill('3');
      expect(Math.abs((await pausa.boundingBox())!.y - (await respiracoes.boundingBox())!.y)).toBeLessThan(4);
      await expect(page.getByText(/^O aluno vê ".*3 respirações"/)).toBeVisible();
      await expect(page.getByRole('button', { name: /^Informar também em/ })).toHaveCount(0);
      await capturar(page, `cluster-iguais-${sufixo}.png`, saida);
      // RIR · RPE vale para todas as séries; no RPE a dica diz a escala.
      // O Crucifixo tem RIR 0 gravado: trocar apaga, então o painel pergunta antes.
      await page.getByRole('radio', { name: 'RPE', exact: true }).click();
      const painel = page.getByRole('alertdialog', { name: 'Trocar o esforço para RPE?' });
      await expect(painel.getByText('Trocar para RPE apaga o RIR de 1 série.', { exact: true })).toBeVisible();
      await painel.getByRole('button', { name: 'Trocar para RPE', exact: true }).click();
      await expect(page.getByText('RPE de 1 a 10, de meio em meio (ex.: 8 ou 8,5).', { exact: true })).toBeVisible();
      await capturar(page, `cluster-rpe-${sufixo}.png`, saida);
      expect(await semRolagemLateral(page)).toBe(true);
      expect(api.errosDaPagina).toEqual([]);
    });
  }
}

test('celular (390): a série aberta e o cluster cabem sem rolagem lateral', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await abrir(page, 'ESCURO');
  await page.getByRole('button', { name: 'Editar Supino reto com barra', exact: true }).click();
  await page.getByRole('button', { name: /^Série 2 · WS/ }).first().click();
  await expect(page.getByRole('button', { name: /^Tipo da série: WS\. Escolher\.$/ })).toBeVisible();
  expect(await semRolagemLateral(page)).toBe(true);
  await capturar(page, 'serie-390-escuro.png', testInfo.outputPath());
});
