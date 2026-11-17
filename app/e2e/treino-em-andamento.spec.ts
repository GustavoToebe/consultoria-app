import { expect, test, type Page } from '@playwright/test';

import type { RegistroEnvio, RegistroSessaoConcluidaEnvio, SessoesConcluidasResponse } from '../src/api/tipos';
import { ALVO_TOQUE } from '../src/tema/tokens';
import { dietaFalsa, fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';
import { ALUNO, json, sessao, simularApi } from './api-falsa';

/**
 * Treino em andamento no Início do aluno (item 4 do `docs/planos/treino-do-aluno-lacunas-cbum.md`): série marcada hoje e
 * treino não concluído. Sendo o treino do Hoje, o próprio cartão vira "Continuar treino" (sem a faixa, que repetiria o
 * botão para o mesmo destino); sendo outra divisão, a faixa aparece com "Continuar". Enquanto houver andamento, o "Sua
 * semana" não comemora. Treino fictício de segunda (dois exercícios de três WS); relógio em segunda, 19/10/2026, 12:00.
 * Só com o retorno ligado, como a faixa do treino ao vivo.
 */
const EXERCICIO = '/aluno/sessao/sx/sxe1?data=2026-10-19';
const LISTA = '/aluno/sessao/sx?data=2026-10-19';
const ROTA = '/aluno/sessoes-concluidas';
const captura = (nome: string) => (process.env.CAPTURAS ? `${process.env.CAPTURAS}/${nome}` : test.info().outputPath(nome));

async function abrir(page: Page, { ligada = true, tema, outraDivisao = false }: { ligada?: boolean; tema?: 'AREIA' | 'ESCURO'; outraDivisao?: boolean } = {}) {
  await fixarHoje(page);
  if (tema) await page.addInitScript(([u, t]) => localStorage.setItem(`treinos:${u}:preferencias`, JSON.stringify({ tema: t })), [ALUNO.id, tema] as const);
  const conclusoes: RegistroSessaoConcluidaEnvio[] = [];
  const api = await simularApi(page, {
    ...(await sessaoDeAlunoComTreino(page, [sessaoFalsa('sx', 'Peito e tríceps', 1, 2), ...(outraDivisao ? [sessaoFalsa('sy', 'Costas e bíceps', 3, 2)] : [])])),
    ...(ligada ? await sessao(page, ALUNO, { retornoHabilitado: true }) : {}),
    // Dieta publicada: o Início fica como o do aluno de verdade (a faixa vem antes dela).
    'GET /aluno/dieta': { corpo: dietaFalsa(4, null) },
    'POST /aluno/execucoes/lote': (p, route) => {
      const lote = (p.corpo as { registros: RegistroEnvio[] }).registros;
      return json(route, { resultados: lote.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) });
    },
    ...(ligada
      ? {
          [`GET ${ROTA}`]: { corpo: { totalConcluidos: 0, sessoes: [] } satisfies SessoesConcluidasResponse },
          [`POST ${ROTA}`]: (p, route) => {
            const lote = (p.corpo as { registros: RegistroSessaoConcluidaEnvio[] }).registros;
            conclusoes.push(...lote);
            return json(route, { resultados: lote.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) });
          },
        }
      : {}),
  });
  return { ...api, conclusoes };
}

const serie = (page: Page, n: number) => page.getByRole('checkbox', { name: `Série ${n} feita`, exact: true });
const continuar = (page: Page, nome = 'Peito e tríceps') => page.getByRole('button', { name: `Continuar treino: ${nome}`, exact: true });
const algumContinuar = (page: Page) => page.getByRole('button', { name: /^Continuar treino/ });
const verTreino = (page: Page) => page.getByRole('button', { name: 'Ver meu treino: Peito e tríceps', exact: true });
const semanaCompleta = (page: Page) => page.getByLabel('Semana completa: você fez todos os treinos desta semana.');
const faixa = (page: Page) => page.getByText('Treino em andamento', { exact: true });
const inicio = (page: Page) => page.getByRole('heading', { level: 1 }).filter({ hasText: 'Olá' });

/** Marca a série 1 do primeiro exercício (sem carga: o ✓ marca direto) e confere que ficou marcada. */
async function marcarUmaSerie(page: Page, exercicio = EXERCICIO) {
  await page.goto(exercicio);
  await serie(page, 1).click();
  await expect(serie(page, 1)).toBeChecked();
}

const TEMAS = [undefined, 'AREIA', 'ESCURO'] as const;

for (const largura of [390, 1280]) {
  for (const tema of TEMAS) {
    const nomeDoTema = tema?.toLowerCase() ?? 'claro';
    test(`treino de hoje começado: o Hoje vira "Continuar treino", sem faixa repetida, e abre a lista do dia (${largura} px, ${nomeDoTema})`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 844 });
      const api = await abrir(page, { tema });
      // Sem série marcada: o Hoje de sempre, sem faixa.
      await page.goto('/aluno');
      await expect(inicio(page)).toBeVisible();
      await expect(verTreino(page)).toBeVisible();
      await expect(faixa(page)).toHaveCount(0);

      await marcarUmaSerie(page);
      // Sai da execução pela navegação do app.
      await page.getByRole('link', { name: 'Início', exact: true }).click();
      await expect(continuar(page)).toBeVisible();
      // Um botão só para a lista do dia: sem a faixa e sem o "Ver meu treino".
      await expect(faixa(page)).toHaveCount(0);
      await expect(verTreino(page)).toHaveCount(0);
      await expect(algumContinuar(page)).toHaveCount(1);
      await expect(page.getByText('1 de 6 séries feitas', { exact: true })).toBeVisible();
      // Plano de um treino só, começado: "1 de 1 treino" sem comemorar ao lado de "1 de 6 séries feitas".
      await expect(page.getByText('1 de 1 treino', { exact: true })).toBeVisible();
      await expect(semanaCompleta(page)).toHaveCount(0);
      const botao = await continuar(page).boundingBox();
      expect(botao!.width).toBeGreaterThanOrEqual(ALVO_TOQUE);
      expect(botao!.height).toBeGreaterThanOrEqual(ALVO_TOQUE);
      // Em 390 × 844 o botão do Hoje continua na primeira tela.
      expect(botao!.y + botao!.height).toBeLessThanOrEqual(844);
      await expect(page.getByText('4 refeições no seu plano', { exact: true })).toBeVisible();
      await page.screenshot({ path: captura(`treino-em-andamento-${largura}-${nomeDoTema}.png`) });

      // Recarregar: o andamento vem do que ficou no aparelho.
      await page.goto('/aluno');
      await expect(continuar(page)).toBeVisible();
      await continuar(page).click();
      await expect(page).toHaveURL(LISTA);
      expect(api.errosDaPagina).toEqual([]);
    });
  }
}

test('sem internet o "Continuar treino" aparece e abre a lista (dados do aparelho)', async ({ page }) => {
  const api = await abrir(page);
  await page.goto(EXERCICIO);
  await expect(serie(page, 1)).toBeVisible();
  await page.context().setOffline(true);
  await serie(page, 1).click();
  await expect(serie(page, 1)).toBeChecked();
  await page.getByRole('link', { name: 'Início', exact: true }).click();
  await expect(continuar(page)).toBeVisible();
  await continuar(page).click();
  await expect(page).toHaveURL(LISTA);
  await expect(page.getByLabel('1 de 6 séries feitas', { exact: true })).toBeVisible();
  await page.context().setOffline(false);
  expect(api.errosDaPagina).toEqual([]);
});

test('série desmarcada não deixa andamento', async ({ page }) => {
  await abrir(page);
  await marcarUmaSerie(page);
  await serie(page, 1).click();
  await expect(serie(page, 1)).not.toBeChecked();
  await page.getByRole('link', { name: 'Início', exact: true }).click();
  await expect(inicio(page)).toBeVisible();
  await expect(verTreino(page)).toBeVisible();
  await expect(faixa(page)).toHaveCount(0);
  await expect(algumContinuar(page)).toHaveCount(0);
});

for (const largura of [390, 1280]) {
  test(`outra divisão começada hoje: a faixa aparece com "Continuar" e o Hoje segue "Ver meu treino" (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 844 });
    const api = await abrir(page, { outraDivisao: true });
    await marcarUmaSerie(page, '/aluno/sessao/sy/sye1?data=2026-10-19');
    await page.getByRole('link', { name: 'Início', exact: true }).click();
    await expect(faixa(page)).toBeVisible();
    await expect(page.getByText('1 de 6 séries feitas', { exact: true })).toBeVisible();
    await expect(verTreino(page)).toBeVisible();
    await expect(algumContinuar(page)).toHaveCount(1);
    const botao = await continuar(page, 'Costas e bíceps').boundingBox();
    expect(botao!.width).toBeGreaterThanOrEqual(ALVO_TOQUE);
    expect(botao!.height).toBeGreaterThanOrEqual(ALVO_TOQUE);
    // Em 390 × 844 o botão do Hoje continua na primeira tela, mesmo com a faixa acima dele.
    const hoje = await verTreino(page).boundingBox();
    expect(hoje!.y + hoje!.height).toBeLessThanOrEqual(844);
    await page.screenshot({ path: captura(`treino-em-andamento-outra-divisao-${largura}.png`) });
    await continuar(page, 'Costas e bíceps').click();
    await expect(page).toHaveURL('/aluno/sessao/sy?data=2026-10-19');
    expect(api.errosDaPagina).toEqual([]);
  });
}

test('treino concluído: o andamento some e a semana completa é comemorada', async ({ page }) => {
  const api = await abrir(page);
  await marcarUmaSerie(page);
  await page.goto(LISTA);
  await page.getByRole('button', { name: 'Concluir treino', exact: true }).first().click();
  const folha = page.getByRole('dialog', { name: 'Concluir treino' });
  await folha.getByRole('textbox', { name: 'Duração em minutos', exact: true }).fill('45');
  await folha.getByRole('button', { name: 'Concluir treino', exact: true }).click();
  await expect(folha).toHaveCount(0);
  await page.goto('/aluno');
  await expect(inicio(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver resumo do treino: Peito e tríceps', exact: true })).toBeVisible();
  await expect(faixa(page)).toHaveCount(0);
  await expect(algumContinuar(page)).toHaveCount(0);
  await expect(semanaCompleta(page)).toBeVisible();
  await page.screenshot({ path: captura('treino-em-andamento-concluido-1280.png') });
  expect(api.errosDaPagina).toEqual([]);
});

test('chave do retorno desligada: marcar não muda o Início', async ({ page }) => {
  const api = await abrir(page, { ligada: false });
  await marcarUmaSerie(page);
  await page.getByRole('link', { name: 'Início', exact: true }).click();
  await expect(inicio(page)).toBeVisible();
  await expect(verTreino(page)).toBeVisible();
  await expect(faixa(page)).toHaveCount(0);
  await expect(algumContinuar(page)).toHaveCount(0);
  expect(api.errosDaPagina).toEqual([]);
});
