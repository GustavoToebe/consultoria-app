import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import type { CobrancaResponse, ContratacaoResponse, PreviaDoEncerramento } from '../src/api/financeiroTipos';
import type { AlunoDetalhe } from '../src/api/tipos';
import { TEXTO_COMBINE_COM_O_TREINADOR, TEXTO_NADA_E_BAIXADO } from '../src/dominio/financeiro';
import { ALUNO, erroApi, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { fixarHoje, sessaoDeAluno } from './aluno';
import {
  ALUNO_FINANCEIRO_ID, COBRANCA_ATRASADA, CONFERENCIA_ESTORNO_INFORMADO, CONFERENCIA_SEM_COBRANCA, CONFERENCIA_VALOR_DIFERENTE, estadoFinanceiro, INADIMPLENTE,
  LEMBRETES_PADRAO, LINK_DE_PAGAMENTO, PAINEL_COM_DADOS, PAINEL_VAZIO, RECEBIMENTO_CONFIGURADO, rotasDoFinanceiro, sessaoComFinanceiro,
} from './financeiro-falso';
import { esperarValorInteiro } from './valor-inteiro';

/**
 * Pagamentos do aluno ao treinador: painel (com dados e vazio), filtro "Meus", lançamento de saída, baixa pela lista de
 * inadimplentes, o fluxo completo (plano → contratação na ficha → baixa manual → o aluno vê a cobrança paga em Conta) e
 * o módulo desligado. Recebimento online (InfinitePay): o "Pagar" do aluno na web (no celular, a regra da chave da plataforma
 * está no Jest), a aba do treinador (a chave nunca volta à tela) com os juros do parcelamento, o link da cobrança, o selo
 * "Online", contestação e estorno marcados pelo treinador, os pagamentos para conferir (estorno informado incluído) e a volta
 * do navegador depois do pagamento. O relógio
 * fica em 19/10/2026. Só dados fictícios; a API é simulada em `financeiro-falso.ts`.
 */

const FICHA: AlunoDetalhe = {
  id: ALUNO_FINANCEIRO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null, cpf: null, endereco: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

/** Botão de uma opção dentro do grupo (`Escolha`) com o rótulo dado. */
const opcao = (page: Page, grupo: string, rotulo: string) =>
  page.getByRole('radiogroup', { name: grupo }).getByRole('radio', { name: rotulo, exact: true });

test('visão geral com dados: cartões, líquido indisponível, resultado do mês, inadimplentes e nenhum "Pagar"', async ({ page }) => {
  await fixarHoje(page);
  // O painel conta 2 vencidas no período (R$ 300,00); a lista, sem filtro de período, traz essas duas e mais uma de antes
  // do período (01/05 a 31/10), como faria a API de verdade.
  const estado = estadoFinanceiro({
    inadimplentes: [
      INADIMPLENTE,
      { ...INADIMPLENTE, cobrancaId: 'c0000000-0000-4000-8000-0000000000a2', alunoId: 'a0000000-0000-4000-8000-0000000000b2', alunoNome: 'Aluno Ficticio Dois', vencimento: '2026-09-05', diasDeAtraso: 44 },
      { ...INADIMPLENTE, cobrancaId: 'c0000000-0000-4000-8000-0000000000a3', alunoId: 'a0000000-0000-4000-8000-0000000000b3', alunoNome: 'Aluno Ficticio Tres', vencimento: '2026-04-05', diasDeAtraso: 197 },
    ],
    cobrancas: [{ ...COBRANCA_ATRASADA }],
  });
  const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro');

  await expect(page.getByRole('heading', { name: 'Financeiro', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Financeiro' }).first()).toBeVisible();
  await expect(page.getByText('Recebido no período')).toBeVisible();
  await expect(page.getByText('R$ 1.200,00', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Alunos pagantes')).toBeVisible();
  await expect(page.getByText('Receita recorrente mensal')).toBeVisible();

  // Previsto, atrasado e inadimplência dizem que só contam as cobranças já geradas.
  await expect(page.getByText('considera as cobranças já geradas').first()).toBeVisible();
  // Resumo compacto da inadimplência: percentual, quanto venceu e quantas cobranças, do mesmo conjunto (o do período).
  await expect(page.getByText('12,5%', { exact: true })).toBeVisible();
  await expect(page.getByText('R$ 300,00 de R$ 2.400,00 · 2 cobranças', { exact: true })).toBeVisible();
  // A lista não tem filtro de período: com outro conjunto, a frase diz que a base é outra, sem repetir valor nem contagem.
  await expect(page.getByText('A lista abaixo traz todas as vencidas em aberto, de qualquer data, não só as do período.')).toBeVisible();
  await expect(page.getByText('Aluno Ficticio Tres')).toBeVisible();

  // Líquido: indisponível, com o bruto; nada de desconto inventado.
  await expect(page.getByText('Líquido para você')).toBeVisible();
  await expect(page.getByText('indisponível', { exact: true })).toBeVisible();

  // Resultado do mês com o rótulo fixo e sem a palavra "lucro".
  await expect(page.getByText('Resultado do mês (entradas − saídas registradas)')).toBeVisible();
  await expect(page.getByText('R$ 300,00', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/lucro/i)).toHaveCount(0);

  // Inadimplentes: quem, quanto e há quantos dias. O treinador nunca paga: o "Pagar" é do aluno, na web.
  await expect(page.getByText('Aluna Atrasada')).toBeVisible();
  await expect(page.getByText('14 dias de atraso')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Pagar/ })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('inadimplência com a lista igual ao período: o resumo basta, sem a frase de base diferente', async ({ page }) => {
  await fixarHoje(page);
  // As duas vencidas da lista são as mesmas duas do painel (R$ 300,00).
  const estado = estadoFinanceiro({ inadimplentes: [
    INADIMPLENTE,
    { ...INADIMPLENTE, cobrancaId: 'c0000000-0000-4000-8000-0000000000a2', alunoId: 'a0000000-0000-4000-8000-0000000000b2', alunoNome: 'Aluno Ficticio Dois', vencimento: '2026-09-05', diasDeAtraso: 44 },
  ] });
  await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro');
  await expect(page.getByText('R$ 300,00 de R$ 2.400,00 · 2 cobranças', { exact: true })).toBeVisible();
  await expect(page.getByText('Aluno Ficticio Dois')).toBeVisible();
  await expect(page.getByText(/não só as do período/)).toHaveCount(0);
});

test('visão geral vazia: soma sem registro é R$ 0,00, só o que não tem base é "—" com o motivo, e a lista diz que não há nada vencido', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ painel: PAINEL_VAZIO });
  const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro');

  await expect(page.getByRole('heading', { name: 'Recebido no período' })).toBeVisible();
  await expect(page.getByText('Nenhuma cobrança vencida em aberto.')).toBeVisible();
  // Gustavo, 13/11: a soma vazia (null da API com a consulta feita) é zero; a média sem pagantes não tem base.
  await expect(page.getByLabel('Recebido no período: R$ 0,00', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Recebido das cobranças: R$ 0,00')).toBeVisible();
  const medio = page.getByLabel(/^Valor médio.*—/);
  await expect(medio).toBeVisible();
  await expect(medio.getByText('Sem pagamentos no período', { exact: true })).toBeVisible();
  await expect(page.getByText('0%', { exact: true })).toHaveCount(0);
  await expect(page.getByText('indisponível', { exact: true })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('filtro "Meus": o painel e os inadimplentes são buscados com meus=true', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro();
  const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro');
  await expect(page.getByText('Recebido no período')).toBeVisible();
  expect(pedidos.filter((p) => p.caminho === '/financeiro/painel').every((p) => p.busca.get('meus') === null)).toBe(true);

  await opcao(page, 'Responsável', 'Meus').click();
  await expect(page.getByText(/só os seus alunos/)).toBeVisible();
  const painel = pedidos.filter((p) => p.caminho === '/financeiro/painel');
  expect(painel.at(-1)?.busca.get('meus')).toBe('true');
  const atrasados = pedidos.filter((p) => p.caminho === '/financeiro/inadimplentes');
  expect(atrasados.at(-1)?.busca.get('meus')).toBe('true');
  expect(errosDaPagina).toEqual([]);
});

/** Caixa de um elemento por `testID` (a célula de uma `LinhaDeBlocos`, ou a própria linha). */
const caixa = async (page: Page, id: string) => {
  const c = await page.getByTestId(id).boundingBox();
  if (!c) throw new Error(`${id} sem caixa`);
  return c;
};
const RENOVACOES = { renovacoesProximasCount: 2, renovacoesProximasCentavos: 30_000, projecaoAnualCentavos: 1_080_000 };
const semRolagemHorizontal = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const tema of ['CLARO', 'ESCURO'] as const) {
  test(`composição da visão geral em 1440 (${tema.toLowerCase()}): mensais lado a lado, três resumos, forma e plano dividindo a linha, glossário em duas colunas`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
    await fixarHoje(page);
    const estado = estadoFinanceiro({ inadimplentes: [INADIMPLENTE], renovacoes: RENOVACOES });
    const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
    await page.goto('/treinador/financeiro');
    await expect(page.getByText('Renovações próximas')).toBeVisible();

    // As duas mensais na mesma linha, com a mesma largura, cobrindo a linha inteira.
    await expect.poll(async () => (await caixa(page, 'linha-mensal-1')).y - (await caixa(page, 'linha-mensal-0')).y).toBe(0);
    const linha = await caixa(page, 'linha-mensal');
    const [recebido, movimento] = [await caixa(page, 'linha-mensal-0'), await caixa(page, 'linha-mensal-1')];
    testInfo.annotations.push({ type: 'largura do conteúdo em 1440', description: String(Math.round(linha.width)) });
    expect(Math.abs(recebido.width - movimento.width)).toBeLessThan(1);
    expect(Math.abs(movimento.x + movimento.width - (linha.x + linha.width))).toBeLessThan(1);
    expect(recebido.x).toBeLessThan(movimento.x);
    await page.screenshot({ path: testInfo.outputPath(`visao-geral-1440-${tema.toLowerCase()}-topo.png`) });
    await page.getByTestId('linha-previsoes').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`visao-geral-1440-${tema.toLowerCase()}-meio.png`) });

    // Renovações, próximos recebimentos e líquido: três colunas iguais na mesma linha.
    const previsoes = [await caixa(page, 'linha-previsoes-0'), await caixa(page, 'linha-previsoes-1'), await caixa(page, 'linha-previsoes-2')];
    expect(new Set(previsoes.map((p) => Math.round(p.y))).size).toBe(1);
    expect(Math.abs(previsoes[0].width - previsoes[2].width)).toBeLessThan(1);
    // Na terça parte da linha os dois prazos empilham e cada valor cabe numa linha só (uma linha de texto < 30 px).
    const cartaoProximos = page.getByTestId('linha-previsoes-1');
    const [em7, em30] = [await cartaoProximos.getByText('R$ 150,00 (1 cobrança)').boundingBox(), await cartaoProximos.getByText('R$ 450,00 (3 cobranças)').boundingBox()];
    expect(em7!.height).toBeLessThan(30);
    expect(em30!.height).toBeLessThan(30);
    expect(em30!.y).toBeGreaterThan(em7!.y);

    // Forma e plano: metade cada, sem terceira coluna vazia (o plano termina na borda da linha).
    const quebras = await caixa(page, 'linha-quebras');
    const [forma, plano] = [await caixa(page, 'linha-quebras-0'), await caixa(page, 'linha-quebras-1')];
    expect(forma.y).toBe(plano.y);
    expect(Math.abs(forma.width - plano.width)).toBeLessThan(1);
    expect(Math.abs(plano.x + plano.width - (quebras.x + quebras.width))).toBeLessThan(1);
    expect(forma.width).toBeGreaterThan(quebras.width / 2 - 20);

    // Resultado do mês diz junto ao título que é o mês atual.
    await expect(page.getByLabel('Período: Mês atual')).toBeVisible();

    // Glossário: recolhido no início; aberto, duas colunas (termo em cima, explicação embaixo) e as regras gerais separadas.
    await expect(page.getByText('Períodos e limites dos dados')).toHaveCount(0);
    await page.getByRole('button', { name: 'Como calculamos estes números, recolhido' }).click();
    const glossario = page.getByTestId('glossario');
    const termo1 = await glossario.getByText('Recebido', { exact: true }).boundingBox();
    const termo2 = await glossario.getByText('A receber', { exact: true }).boundingBox();
    expect(termo1 && termo2 && Math.abs(termo1.y - termo2.y)).toBeLessThan(1);
    expect(termo1!.x).toBeLessThan(termo2!.x);
    await expect(page.getByRole('heading', { name: 'Períodos e limites dos dados', level: 3 })).toBeVisible();
    await expect(page.getByText(/^Com o filtro "Meus", os lançamentos avulsos ficam de fora/)).toBeVisible();
    await page.getByRole('heading', { name: 'Períodos e limites dos dados' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`visao-geral-1440-${tema.toLowerCase()}-glossario.png`) });

    // "Meus" mantém as renovações (a rota também filtra por responsável): os três continuam na mesma linha.
    await opcao(page, 'Responsável', 'Meus').click();
    await expect(page.getByText('Renovações próximas')).toBeVisible();
    const [renovar, proximos, liquido] = [await caixa(page, 'linha-previsoes-0'), await caixa(page, 'linha-previsoes-1'), await caixa(page, 'linha-previsoes-2')];
    expect(renovar.y).toBe(proximos.y);
    expect(proximos.y).toBe(liquido.y);
    expect(Math.abs(renovar.width - proximos.width)).toBeLessThan(1);
    expect(await semRolagemHorizontal(page)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });

  test(`composição da visão geral em 390 (${tema.toLowerCase()}): uma coluna na ordem de leitura, sem rolagem horizontal, glossário em uma coluna`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
    await fixarHoje(page);
    const estado = estadoFinanceiro({ inadimplentes: [INADIMPLENTE], renovacoes: RENOVACOES });
    const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
    await page.goto('/treinador/financeiro');
    await expect(page.getByText('Renovações próximas')).toBeVisible();

    const ordem = ['linha-mensal-0', 'linha-mensal-1', 'linha-previsoes-0', 'linha-previsoes-1', 'linha-previsoes-2', 'linha-quebras-0', 'linha-quebras-1'];
    const caixas = [];
    for (const id of ordem) caixas.push(await caixa(page, id));
    for (let i = 1; i < caixas.length; i++) {
      expect(caixas[i].y).toBeGreaterThan(caixas[i - 1].y);
      expect(Math.abs(caixas[i].x - caixas[0].x)).toBeLessThan(1);
      expect(caixas[i].x + caixas[i].width).toBeLessThanOrEqual(390);
    }
    // O resultado do mês fica entre os resumos e as quebras.
    const resultado = await page.getByText('Resultado do mês (entradas − saídas registradas)').boundingBox();
    expect(resultado!.y).toBeGreaterThan(caixas[4].y);
    expect(resultado!.y).toBeLessThan(caixas[5].y);
    expect(await semRolagemHorizontal(page)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`visao-geral-390-${tema.toLowerCase()}-topo.png`) });

    await page.getByRole('button', { name: 'Como calculamos estes números, recolhido' }).click();
    const glossario = page.getByTestId('glossario');
    const termo1 = await glossario.getByText('Recebido', { exact: true }).boundingBox();
    const termo2 = await glossario.getByText('A receber', { exact: true }).boundingBox();
    expect(Math.abs(termo1!.x - termo2!.x)).toBeLessThan(1);
    expect(termo2!.y).toBeGreaterThan(termo1!.y);
    expect(await semRolagemHorizontal(page)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`visao-geral-390-${tema.toLowerCase()}-glossario.png`) });
    expect(errosDaPagina).toEqual([]);
  });
}

for (const largura of [390, 1280]) {
  test(`escopo "Meus" em ${largura}: o cartão de renovações fica e mostra o número do escopo`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await fixarHoje(page);
    const renovacoesMeus = { renovacoesProximasCount: 1, renovacoesProximasCentavos: 12_345, projecaoAnualCentavos: 987_650 };
    const estado = estadoFinanceiro({ renovacoes: RENOVACOES, renovacoesMeus });
    const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
    await page.goto('/treinador/financeiro');
    await expect(page.getByText('2 planos', { exact: true })).toBeVisible();

    await opcao(page, 'Responsável', 'Meus').click();
    await expect(page.getByText('Renovações próximas')).toBeVisible();
    await expect(page.getByText('1 plano', { exact: true })).toBeVisible();
    await expect(page.getByText('R$ 123,45', { exact: true })).toBeVisible();
    await expect(page.getByText('R$ 9.876,50', { exact: true })).toBeVisible();
    await expect(page.getByText('2 planos', { exact: true })).toHaveCount(0);
    expect(pedidos.filter((p) => p.caminho === '/financeiro/visao-geral').at(-1)?.busca.get('meus')).toBe('true');
    expect(await semRolagemHorizontal(page)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });
}

test('visão geral em 1280: largura medida decide; três resumos que não cabem empilham inteiros, sem cartão sozinho pela metade', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await fixarHoje(page);
  const estado = estadoFinanceiro({ inadimplentes: [INADIMPLENTE], renovacoes: RENOVACOES });
  const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro');
  await expect(page.getByText('Renovações próximas')).toBeVisible();
  const linha = await caixa(page, 'linha-previsoes');
  testInfo.annotations.push({ type: 'largura do conteúdo em 1280', description: String(Math.round(linha.width)) });
  // Seja qual for o arranjo, cada bloco ou ocupa a linha inteira ou divide com os outros por igual: nenhum buraco.
  for (const nome of ['mensal', 'previsoes', 'quebras']) {
    const l = await caixa(page, `linha-${nome}`);
    const n = await page.locator(`[data-testid^="linha-${nome}-"]`).count();
    const cs = [];
    for (let i = 0; i < n; i++) cs.push(await caixa(page, `linha-${nome}-${i}`));
    const mesmaLinha = new Set(cs.map((c) => Math.round(c.y))).size === 1;
    for (const c of cs) {
      if (mesmaLinha) expect(Math.abs(c.width - cs[0].width)).toBeLessThan(1);
      else expect(Math.abs(c.width - l.width)).toBeLessThan(1);
    }
  }
  await page.screenshot({ path: testInfo.outputPath('visao-geral-1280-topo.png') });
  await page.getByTestId('linha-previsoes').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('visao-geral-1280-meio.png') });
  expect(errosDaPagina).toEqual([]);
});

test('zero, "—" e nenhum registro continuam distintos na visão geral', async ({ page }) => {
  await fixarHoje(page);
  const painel = {
    ...PAINEL_VAZIO,
    cartoes: { ...PAINEL_VAZIO.cartoes, recebidoCentavos: 0 },
    // Tudo pago: 0% com a base; zero não vira "—".
    inadimplencia: { percentual: 0, vencidoCentavos: 0, cobradoCentavos: 50_000 },
    // Saídas nulas (sem dado) ao lado de entradas 0: o "—" e o zero seguem distintos (a API manda 0 na consulta vazia).
    resultadoDoMes: { ...PAINEL_VAZIO.resultadoDoMes, entradasAvulsasCentavos: 0, saidasAvulsasCentavos: null },
  };
  const estado = estadoFinanceiro({ painel });
  const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro');

  await expect(page.getByText('0%', { exact: true })).toBeVisible();
  await expect(page.getByText('R$ 0,00 de R$ 500,00', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Recebido no período: R$ 0,00', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Entradas avulsas: R$ 0,00')).toBeVisible();
  await expect(page.getByLabel('Saídas avulsas: —')).toBeVisible();
  // D14: o zero é só "R$ 0,00"; o indisponível tem o "—" e o motivo escrito, para não se parecerem.
  await expect(page.getByLabel('Entradas avulsas: R$ 0,00').getByText('Sem dados')).toHaveCount(0);
  await expect(page.getByLabel('Saídas avulsas: —').getByText('Sem dados', { exact: true })).toBeVisible();
  await expect(page.getByText('Nenhum pagamento recebido no período.')).toHaveCount(2);
  await expect(page.getByText('Nenhuma cobrança vencida em aberto.')).toBeVisible();
  await expect(page.getByText('Nenhuma contratação nova ou encerrada no período.')).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('lançamento de saída: o app envia centavos e o resultado do mês acompanha', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ painel: PAINEL_COM_DADOS });
  const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=lancamentos');

  await expect(page.getByText('Nenhum lançamento')).toBeVisible();
  await page.getByRole('button', { name: 'Novo lançamento' }).click();
  const folha = page.getByRole('dialog');
  await folha.getByLabel('Descrição').fill('Aluguel da sala');
  await folha.getByLabel('Valor', { exact: true }).fill('350,00');
  await folha.getByLabel('Categoria (opcional)').fill('Aluguel');
  await folha.getByRole('button', { name: 'Registrar lançamento' }).click();

  await expect(page.getByText('Lançamento registrado.')).toBeVisible();
  await expect(page.getByText('Aluguel da sala').first()).toBeVisible();
  const envio = pedidos.find((p) => p.metodo === 'POST' && p.caminho === '/financeiro/lancamentos');
  expect(envio?.corpo).toEqual({ data: '2026-10-19', descricao: 'Aluguel da sala', valorCentavos: 35_000, tipo: 'SAIDA', categoria: 'Aluguel', versao: null });
  // Saídas avulsas: 200,00 + 350,00; resultado: 450,00 + 50,00 - 550,00.
  await expect(page.getByText('R$ 550,00', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('-R$ 50,00', { exact: true })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('baixa pela lista de inadimplentes: busca a versão da cobrança, envia só data, forma e versão e tira o aluno da lista', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ inadimplentes: [INADIMPLENTE], cobrancas: [{ ...COBRANCA_ATRASADA }] });
  const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro');

  await page.getByRole('button', { name: 'Registrar pagamento de Aluna Atrasada' }).click();
  const folha = page.getByRole('dialog');
  await expect(folha.getByRole('heading', { name: 'Registrar pagamento' })).toBeVisible();
  await expect(folha.getByText('R$ 150,00')).toBeVisible();
  await folha.getByRole('button', { name: 'Registrar pagamento', exact: true }).click();

  await expect(page.getByText('Pagamento registrado.')).toBeVisible();
  const baixa = pedidos.find((p) => p.metodo === 'POST' && p.caminho.endsWith('/baixa-manual'));
  expect(baixa?.corpo).toEqual({ data: '2026-10-19', forma: 'PIX_DIRETO', observacao: null, versao: 0 });
  await expect(page.getByText('Nenhuma cobrança vencida em aberto.')).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('fluxo completo: o treinador cria o plano, contrata na ficha e dá a baixa; o aluno vê a cobrança paga em Conta', async ({ page, context }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro();
  const { pedidos, errosDaPagina } = await simularApi(page, {
    ...(await sessaoComFinanceiro(page)),
    ...rotasDoFinanceiro(estado),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    [`GET /alunos/${ALUNO_FINANCEIRO_ID}`]: { corpo: FICHA },
  });

  // 1. Plano comercial.
  await page.goto('/treinador/financeiro?aba=planos');
  await expect(page.getByText('Nenhum plano comercial ainda')).toBeVisible();
  await page.getByRole('button', { name: 'Novo plano' }).click();
  const novoPlano = page.getByRole('dialog');
  await novoPlano.getByLabel('Nome do plano').fill('Consultoria mensal');
  await novoPlano.getByLabel('Valor', { exact: true }).fill('150,00');
  await novoPlano.getByRole('button', { name: 'Criar plano' }).click();
  await expect(page.getByText('Plano criado.')).toBeVisible();
  await expect(page.getByText('Consultoria mensal').first()).toBeVisible();
  expect(pedidos.find((p) => p.metodo === 'POST' && p.caminho === '/financeiro/planos')?.corpo)
    .toEqual({ nome: 'Consultoria mensal', valorCentavos: 15_000, periodicidade: 'MENSAL', tempoMinimoMeses: null, regraDeSaida: null, versao: null });
  const planoId = estado.planos[0].id;

  // 2. Contratação na ficha do aluno.
  await page.goto(`/treinador/alunos/${ALUNO_FINANCEIRO_ID}?aba=ficha`);
  await expect(page.getByText('Nenhum plano comercial contratado.')).toBeVisible();
  await page.getByRole('button', { name: 'Contratar plano' }).click();
  await page.getByRole('button', { name: /^Plano:/ }).click();
  await page.getByRole('radio', { name: /^Consultoria mensal/ }).click();
  const contratar = page.getByRole('dialog');
  await contratar.getByLabel('Dia do vencimento').fill('25');
  await contratar.getByRole('button', { name: 'Contratar plano', exact: true }).click();
  await expect(page.getByText('Plano contratado.')).toBeVisible();
  // Valor em branco = o do plano: o app não manda valor.
  expect(pedidos.find((p) => p.metodo === 'POST' && p.caminho.endsWith('/contratacoes'))?.corpo)
    .toEqual({ planoComercialId: planoId, valorCentavos: null, motivoValor: null, inicio: '2026-10-19', diaVencimento: 25 });

  // 3. Baixa manual da primeira cobrança.
  await page.getByRole('button', { name: /^Abrir cobrança de/ }).click();
  const cobranca = page.getByRole('dialog');
  await expect(cobranca.getByText('R$ 150,00')).toBeVisible();
  await cobranca.getByRole('button', { name: 'Registrar pagamento', exact: true }).click();
  await cobranca.getByLabel('Observação (opcional)').fill('Pago na academia');
  await cobranca.getByRole('button', { name: 'Registrar pagamento', exact: true }).click();
  await expect(page.getByText('Pagamento registrado.')).toBeVisible();
  expect(pedidos.find((p) => p.metodo === 'POST' && p.caminho.endsWith('/baixa-manual'))?.corpo)
    .toEqual({ data: '2026-10-19', forma: 'PIX_DIRETO', observacao: 'Pago na academia', versao: 0 });
  await expect(page.getByRole('button', { name: /^Abrir cobrança de .*Paga$/ })).toBeVisible();

  // 4. O aluno, em outra página, vê o plano e a cobrança paga; a observação interna não chega a ele.
  const aluno = await context.newPage();
  await fixarHoje(aluno);
  const doAluno = await simularApi(aluno, {
    ...(await sessaoDeAluno(aluno)),
    ...(await sessao(aluno, ALUNO, { pagamentosHabilitados: true })),
    ...rotasDoFinanceiro(estado),
  });
  await aluno.goto('/aluno/conta');
  await expect(aluno.getByText('Meu plano').first()).toBeVisible();
  await expect(aluno.getByText('Consultoria mensal').first()).toBeVisible();
  await expect(aluno.getByText('R$ 150,00').first()).toBeVisible();
  await expect(aluno.getByText('Pago em 19/10/2026 · Pix direto')).toBeVisible();
  await expect(aluno.getByText('Pago na academia')).toHaveCount(0);
  // Sem recebimento online na consultoria (`pagamentoOnline` falso), o aluno não tem "Pagar".
  await expect(aluno.getByRole('button', { name: /pagar/i })).toHaveCount(0);
  expect(doAluno.errosDaPagina).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

const CONTRATACAO_ATIVA: ContratacaoResponse = {
  id: 'e0000000-0000-4000-8000-0000000000dd', alunoId: ALUNO_FINANCEIRO_ID, planoComercialId: 'b0000000-0000-4000-8000-0000000000f1',
  planoNome: 'Consultoria mensal', periodicidade: 'MENSAL', valorCentavos: 15_000, motivoValor: null, inicio: '2026-08-05', diaVencimento: 5,
  situacao: 'ATIVA', encerradaEm: null, criadoEm: '2026-08-05T12:00:00Z', versao: 0, minimoAte: null,
};

const abertaDaContratacao = (id: string, vencimento: string, vencida: boolean): CobrancaResponse => ({
  ...COBRANCA_ATRASADA, id, contratacaoId: CONTRATACAO_ATIVA.id, alunoId: ALUNO_FINANCEIRO_ID, competencia: vencimento, vencimento, vencida,
  diasDeAtraso: vencida ? 14 : null,
});

test('Pausar e Encerrar (sem tempo mínimo) avisam das cobranças abertas (as vencidas incluídas) só quando há alguma', async ({ page, context }) => {
  await fixarHoje(page);
  const comAbertas = estadoFinanceiro({
    contratacoes: [{ ...CONTRATACAO_ATIVA }],
    cobrancas: [
      abertaDaContratacao('c0000000-0000-4000-8000-0000000000a1', '2026-10-05', true),
      abertaDaContratacao('c0000000-0000-4000-8000-0000000000a2', '2026-11-05', false),
      { ...abertaDaContratacao('c0000000-0000-4000-8000-0000000000a3', '2026-09-05', false), situacao: 'PAGA', vencida: false },
    ],
  });
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(comAbertas),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } }, [`GET /alunos/${ALUNO_FINANCEIRO_ID}`]: { corpo: FICHA },
  });
  await page.goto(`/treinador/alunos/${ALUNO_FINANCEIRO_ID}?aba=ficha`);
  const aviso = 'Há 2 cobranças abertas; elas continuam valendo. Cancele uma a uma se precisar.';

  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  const pausar = page.getByRole('alertdialog', { name: 'Pausar este plano?' });
  await expect(pausar.getByText(aviso)).toBeVisible();
  await pausar.getByRole('button', { name: 'Voltar' }).click();

  // Encerrar: a folha da prévia, com "Não cobrar" escolhido; a conta das abertas vem da API (1 vencida + 1 a vencer).
  await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
  const encerrar = page.getByRole('dialog', { name: 'Encerrar este plano?' });
  await expect(encerrar.getByText(aviso)).toBeVisible();
  await expect(opcao(page, 'Cobrança de saída', 'Não cobrar')).toBeChecked();
  await encerrar.getByRole('button', { name: 'Voltar' }).click();
  await expect(encerrar).toHaveCount(0);

  // Sem cobrança aberta: nenhum texto sobre cobranças abertas no painel.
  const outra = await context.newPage();
  await fixarHoje(outra);
  const semAbertas = estadoFinanceiro({ contratacoes: [{ ...CONTRATACAO_ATIVA }], cobrancas: [] });
  const daOutra = await simularApi(outra, {
    ...(await sessaoComFinanceiro(outra)), ...rotasDoFinanceiro(semAbertas),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } }, [`GET /alunos/${ALUNO_FINANCEIRO_ID}`]: { corpo: FICHA },
  });
  await outra.goto(`/treinador/alunos/${ALUNO_FINANCEIRO_ID}?aba=ficha`);
  await outra.getByRole('button', { name: 'Pausar', exact: true }).click();
  const painel = outra.getByRole('alertdialog', { name: 'Pausar este plano?' });
  await expect(painel).toBeVisible();
  await expect(painel).not.toContainText(/cobranças? abertas?/);
  expect(daOutra.errosDaPagina).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

// ---- Saída e tempo mínimo (plano `docs/planos/saida-e-tempo-minimo.md`, passo 3) ----

const ID_VENCIDA = 'c0000000-0000-4000-8000-0000000000b1';
const ID_A_VENCER_1 = 'c0000000-0000-4000-8000-0000000000b2';
const ID_A_VENCER_2 = 'c0000000-0000-4000-8000-0000000000b3';
const COM_MINIMO: ContratacaoResponse = { ...CONTRATACAO_ATIVA, minimoAte: '2027-02-05' };
const REGRA = 'Saída antes do mínimo: paga os meses que faltam, conforme o contrato.';

/** A prévia de uma contratação com mínimo, como a API devolve: todos os números vêm daqui, a tela não calcula nada. */
const PREVIA_COM_MINIMO: PreviaDoEncerramento = {
  contratacaoId: COM_MINIMO.id, periodicidade: 'MENSAL', situacao: 'ATIVA', minimoAte: '2027-02-05', mesesQueFaltam: 4,
  regraDeSaida: REGRA, vencidas: { quantidade: 1, valorCentavos: 15_000 }, aVencerNoMinimo: { quantidade: 2, valorCentavos: 30_000 },
  aVencerQueFicam: { quantidade: 0, valorCentavos: 0 }, cobrancasACancelar: [ID_A_VENCER_1, ID_A_VENCER_2], comLinkVivo: 1,
  mesesNaoGerados: 2, valorDosNaoGeradosCentavos: 30_000,
  opcoes: [
    { opcao: 'FALTAM', disponivel: true, valorCentavos: 60_000, motivo: null },
    { opcao: 'VIGENTE', disponivel: false, valorCentavos: null, motivo: 'O mês vigente já está pago.' },
    { opcao: 'OUTRO', disponivel: true, valorCentavos: null, motivo: null },
    { opcao: 'NAO_COBRAR', disponivel: true, valorCentavos: null, motivo: null },
  ],
};
/** A mesma conta depois de o aluno pagar uma das a vencer enquanto a folha estava aberta. */
const PREVIA_MUDOU: PreviaDoEncerramento = {
  ...PREVIA_COM_MINIMO, mesesQueFaltam: 3, aVencerNoMinimo: { quantidade: 1, valorCentavos: 15_000 }, cobrancasACancelar: [ID_A_VENCER_2], comLinkVivo: 0,
  opcoes: PREVIA_COM_MINIMO.opcoes.map((o) => (o.opcao === 'FALTAM' ? { ...o, valorCentavos: 45_000 } : o)),
};

const cobrancasComMinimo = (): CobrancaResponse[] => [
  abertaDaContratacao(ID_VENCIDA, '2026-10-05', true),
  abertaDaContratacao(ID_A_VENCER_1, '2026-11-05', false),
  abertaDaContratacao(ID_A_VENCER_2, '2026-12-05', false),
];

const fichaComFinanceiro = async (page: Page, estado: ReturnType<typeof estadoFinanceiro>, permissoes?: string[]) => simularApi(page, {
  ...(await sessaoComFinanceiro(page, permissoes)), ...rotasDoFinanceiro(estado),
  'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } }, [`GET /alunos/${ALUNO_FINANCEIRO_ID}`]: { corpo: FICHA },
});

const comTema = (page: Page, tema: 'CLARO' | 'ESCURO') =>
  page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);

for (const largura of [390, 1280]) {
  test(`Planos em ${largura}px: tempo mínimo e regra de saída só no plano mensal, enviados sempre e mostrados na lista`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await fixarHoje(page);
    const estado = estadoFinanceiro();
    const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
    await page.goto('/treinador/financeiro?aba=planos');
    await expect(page.getByText('Nenhum plano comercial ainda')).toBeVisible();

    await page.getByRole('button', { name: 'Novo plano' }).click();
    const folha = page.getByRole('dialog');
    await folha.getByLabel('Nome do plano').fill('Consultoria mensal');
    await folha.getByLabel('Valor', { exact: true }).fill('150,00');
    await folha.getByLabel('Tempo mínimo (meses)').fill('61');
    await folha.getByLabel('Regra de saída').fill(REGRA);
    await folha.getByRole('button', { name: 'Criar plano' }).click();
    // Fora de 1 a 60 a tela recusa sem chamar a API.
    await expect(folha.getByText('O tempo mínimo vai de 1 a 60 meses.')).toBeVisible();
    expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho === '/financeiro/planos')).toHaveLength(0);
    await folha.getByLabel('Tempo mínimo (meses)').fill('6');
    await folha.getByRole('button', { name: 'Criar plano' }).click();
    await expect(page.getByText('Plano criado.')).toBeVisible();
    expect(pedidos.find((p) => p.metodo === 'POST' && p.caminho === '/financeiro/planos')?.corpo).toEqual({
      nome: 'Consultoria mensal', valorCentavos: 15_000, periodicidade: 'MENSAL', tempoMinimoMeses: 6, regraDeSaida: REGRA, versao: null,
    });
    await expect(page.getByText(/Mínimo de 6 meses/)).toBeVisible();

    // Outra periodicidade: os dois campos nem aparecem, e o corpo os manda nulos.
    await page.getByRole('button', { name: 'Novo plano' }).click();
    const outro = page.getByRole('dialog');
    await outro.getByLabel('Nome do plano').fill('Consultoria trimestral');
    await outro.getByLabel('Valor', { exact: true }).fill('400,00');
    await opcao(page, 'Periodicidade', 'Trimestral').click();
    await expect(outro.getByLabel('Tempo mínimo (meses)')).toHaveCount(0);
    await expect(outro.getByLabel('Regra de saída')).toHaveCount(0);
    await outro.getByRole('button', { name: 'Criar plano' }).click();
    await expect.poll(() => pedidos.filter((p) => p.metodo === 'POST' && p.caminho === '/financeiro/planos').length).toBe(2);
    expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho === '/financeiro/planos').at(-1)?.corpo).toEqual({
      nome: 'Consultoria trimestral', valorCentavos: 40_000, periodicidade: 'TRIMESTRAL', tempoMinimoMeses: null, regraDeSaida: null, versao: null,
    });

    // Editar o mensal e trocar para trimestral avisa que o mínimo será apagado.
    await page.getByRole('button', { name: /Consultoria mensal/ }).first().click();
    const editar = page.getByRole('dialog');
    await expect(editar.getByLabel('Tempo mínimo (meses)')).toHaveValue('6');
    await opcao(page, 'Periodicidade', 'Trimestral').click();
    await expect(editar.getByText(/ao salvar com outra periodicidade, eles são apagados/)).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });

  test(`erro do servidor no tempo mínimo aparece no campo, sem fechar a folha (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await fixarHoje(page);
    const estado = estadoFinanceiro();
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado),
      'POST /financeiro/planos': { status: 422, corpo: { status: 422, message: 'Confira os dados do plano.', codigo: 'PLANO_INVALIDO', fieldErrors: [{ field: 'regraDeSaida', message: 'A regra de saída pode ter até 500 caracteres.' }] } },
    });
    await page.goto('/treinador/financeiro?aba=planos');
    await page.getByRole('button', { name: 'Novo plano' }).click();
    const folha = page.getByRole('dialog');
    await folha.getByLabel('Nome do plano').fill('Consultoria mensal');
    await folha.getByLabel('Valor', { exact: true }).fill('150,00');
    await folha.getByLabel('Regra de saída').fill(REGRA);
    await folha.getByRole('button', { name: 'Criar plano' }).click();
    await expect(folha.getByText('A regra de saída pode ter até 500 caracteres.')).toBeVisible();
    await expect(folha).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });

  test(`tempo mínimo na ficha em ${largura}px: o cartão mostra a data e a edição valida, apaga e envia sempre o minimoAte`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await fixarHoje(page);
    const estado = estadoFinanceiro({ contratacoes: [{ ...COM_MINIMO }], cobrancas: [] });
    const { pedidos, errosDaPagina } = await fichaComFinanceiro(page, estado);
    await page.goto(`/treinador/alunos/${ALUNO_FINANCEIRO_ID}?aba=ficha`);
    await expect(page.getByText('Tempo mínimo até 05/02/2027')).toBeVisible();

    await page.getByRole('button', { name: 'Alterar', exact: true }).click();
    const folha = page.getByRole('dialog', { name: 'Alterar contratação' });
    const campo = folha.getByLabel('Fim do tempo mínimo');
    await expect(campo).toHaveValue('05/02/2027');
    await campo.fill('01/01/2020');
    await folha.getByRole('button', { name: 'Salvar contratação' }).click();
    await expect(folha.getByText('O fim do mínimo vai de 05/08/2026 até 05/08/2031.')).toBeVisible();
    expect(pedidos.filter((p) => p.metodo === 'PUT' && p.caminho.startsWith('/contratacoes/'))).toHaveLength(0);

    // Em branco apaga: o PUT manda `minimoAte: null` e o cartão passa a dizer "Sem tempo mínimo".
    await campo.fill('');
    await folha.getByRole('button', { name: 'Salvar contratação' }).click();
    await expect(page.getByText('Contratação alterada.')).toBeVisible();
    expect(pedidos.find((p) => p.metodo === 'PUT' && p.caminho === `/contratacoes/${COM_MINIMO.id}`)?.corpo)
      .toEqual({ valorCentavos: 15_000, motivoValor: null, diaVencimento: 5, minimoAte: null, versao: 0 });
    await expect(page.getByText('Sem tempo mínimo')).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });
}

for (const [largura, tema] of [[390, 'CLARO'], [1280, 'CLARO'], [390, 'ESCURO'], [1280, 'ESCURO']] as const) {
  test(`encerrar com cobrança de saída em ${largura}px (${tema.toLowerCase()}): opções da API, indisponível com o motivo, 409 recarrega e o selo "Saída" aparece`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await comTema(page, tema);
    await fixarHoje(page);
    const estado = estadoFinanceiro({
      contratacoes: [{ ...COM_MINIMO }], cobrancas: cobrancasComMinimo(), previas: { [COM_MINIMO.id]: PREVIA_COM_MINIMO }, previaQueMuda: PREVIA_MUDOU,
      recebimento: { ...RECEBIMENTO_CONFIGURADO }, pagamentoOnline: true,
    });
    const { errosDaPagina } = await fichaComFinanceiro(page, estado);
    await page.goto(`/treinador/alunos/${ALUNO_FINANCEIRO_ID}?aba=ficha`);
    await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
    const folha = page.getByRole('dialog', { name: 'Encerrar este plano?' });
    await expect(folha.getByText('Faltam 4 meses para o mínimo (até 05/02/2027)')).toBeVisible();
    await expect(folha.getByText(REGRA)).toBeVisible();
    // Começa em "Não cobrar": as três abertas continuam.
    await expect(opcao(page, 'Cobrança de saída', 'Não cobrar')).toBeChecked();
    await expect(folha.getByText('Há 3 cobranças abertas; elas continuam valendo. Cancele uma a uma se precisar.')).toBeVisible();
    // A opção indisponível fica desabilitada e o motivo aparece sob o grupo.
    await expect(opcao(page, 'Cobrança de saída', 'Mês vigente')).toBeDisabled();
    await expect(folha.getByText('O mês vigente já está pago.')).toBeVisible();

    // "Meses que faltam": o valor da API, só leitura, a conta e o aviso do link vivo.
    await opcao(page, 'Cobrança de saída', 'Meses que faltam para o mínimo: R$ 600,00').click();
    await expect(folha.getByText('R$ 600,00').last()).toBeVisible();
    await expect(folha.getByText('2 mensalidades a vencer dentro do mínimo (R$ 300,00), canceladas ao cobrar a saída.')).toBeVisible();
    await expect(folha.getByText('2 meses ainda não gerados (R$ 300,00).')).toBeVisible();
    await expect(folha.getByText(/Uma das cobranças canceladas tem link de pagamento ainda válido/)).toBeVisible();
    await expect(folha.getByText('Há 1 cobrança aberta; ela continua valendo. Cancele-a se precisar.')).toBeVisible();
    await expect(folha.getByLabel('Vence em')).toHaveValue('19/10/2026');
    await page.screenshot({ path: testInfo.outputPath(`encerrar-${largura}-${tema.toLowerCase()}.png`), fullPage: true });

    // A conta mudou no servidor: 409, a folha continua aberta com o aviso e o valor novo.
    await folha.getByRole('button', { name: 'Encerrar plano' }).click();
    await expect(folha.getByText('A conta da saída mudou. Confira os valores novos e confirme de novo.')).toBeVisible();
    // O que a prévia nova reflete: o aluno pagou a mensalidade de 05/11 enquanto a folha estava aberta.
    Object.assign(estado.cobrancas.find((c) => c.id === ID_A_VENCER_1) as CobrancaResponse, { situacao: 'PAGA', vencida: false, pagoEm: '2026-10-19', forma: 'PIX' });
    await expect(opcao(page, 'Cobrança de saída', 'Meses que faltam para o mínimo: R$ 450,00')).toBeChecked();
    await expect(folha.getByText(/link de pagamento ainda válido/)).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`encerrar-409-${largura}-${tema.toLowerCase()}.png`), fullPage: true });
    await folha.getByRole('button', { name: 'Encerrar plano' }).click();
    await expect(page.getByText('Plano encerrado. A cobrança de saída foi criada.')).toBeVisible();
    expect(estado.encerramentos).toEqual([
      { versao: 0, saida: { opcao: 'FALTAM', valorCentavos: 60_000, vencimento: '2026-10-19', cobrancasACancelar: [ID_A_VENCER_1, ID_A_VENCER_2] } },
      { versao: 0, saida: { opcao: 'FALTAM', valorCentavos: 45_000, vencimento: '2026-10-19', cobrancasACancelar: [ID_A_VENCER_2] } },
    ]);

    // Na ficha, a cobrança de saída tem o selo; a folha dela chama-se "Cobrança de saída" e não tem link de pagamento.
    const daSaida = page.getByRole('button', { name: /^Abrir cobrança de saída de/ });
    await expect(daSaida).toBeVisible();
    await expect(daSaida.getByText('Saída', { exact: true })).toBeVisible();
    await daSaida.click();
    const cobranca = page.getByRole('dialog', { name: 'Cobrança de saída' });
    await expect(cobranca.getByText('Saída', { exact: true })).toBeVisible();
    await expect(cobranca.getByText('R$ 450,00').first()).toBeVisible();
    await expect(cobranca.getByRole('button', { name: 'Copiar link de pagamento' })).toHaveCount(0);
    await expect(cobranca.getByRole('button', { name: 'Registrar pagamento' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`folha-saida-${largura}-${tema.toLowerCase()}.png`), fullPage: true });
    await cobranca.getByRole('button', { name: /Fechar/ }).first().click();

    // Na lista de cobranças do Financeiro, o selo também.
    await page.goto('/treinador/financeiro?aba=cobrancas');
    await expect(page.getByRole('button', { name: /^Abrir cobrança de saída de / }).first()).toBeVisible();
    await expect(page.getByText('Saída', { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`cobrancas-saida-${largura}-${tema.toLowerCase()}.png`), fullPage: true });

    // O aluno, na web e com recebimento online: a saída tem o selo e nunca o "Pagar"; a mensalidade vencida mantém o dela.
    const aluno = await context.newPage();
    await aluno.setViewportSize({ width: largura, height: 900 });
    await fixarHoje(aluno);
    const doAluno = await simularApi(aluno, {
      ...(await sessaoDoAlunoComFinanceiro(aluno)), ...rotasDoFinanceiro(estado),
    });
    await aluno.goto('/aluno/conta');
    const daSaidaNoAluno = aluno.getByLabel(/^Cobrança de saída, /).first();
    await daSaidaNoAluno.scrollIntoViewIfNeeded();
    await expect(daSaidaNoAluno).toBeVisible();
    await expect(aluno.getByText('Saída', { exact: true })).toBeVisible();
    await expect(aluno.getByRole('button', { name: /^Pagar/ })).toHaveCount(1);
    await expect(aluno.getByRole('button', { name: /R\$ 450,00/ })).toHaveCount(0);
    // A saída não tem "Pagar": com o recebimento online, o texto diz ao aluno para combinar com o treinador.
    await expect(aluno.getByText(TEXTO_COMBINE_COM_O_TREINADOR)).toBeVisible();
    await aluno.screenshot({ path: testInfo.outputPath(`meu-plano-saida-${largura}-${tema.toLowerCase()}.png`), fullPage: true });
    expect(doAluno.errosDaPagina).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

for (const largura of [390, 1280]) {
  test(`encerrar em ${largura}px: a opção escolhida some da prévia nova e a tela não cai em "Não cobrar" (botão desabilitado com o motivo)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await fixarHoje(page);
    const comVigente = { ...PREVIA_COM_MINIMO, opcoes: PREVIA_COM_MINIMO.opcoes.map((o) => (o.opcao === 'VIGENTE' ? { ...o, disponivel: true, valorCentavos: 15_000, motivo: null } : o)) };
    const estado = estadoFinanceiro({
      contratacoes: [{ ...COM_MINIMO }], cobrancas: cobrancasComMinimo(), previas: { [COM_MINIMO.id]: comVigente }, previaQueMuda: PREVIA_MUDOU,
    });
    const { errosDaPagina } = await fichaComFinanceiro(page, estado);
    await page.goto(`/treinador/alunos/${ALUNO_FINANCEIRO_ID}?aba=ficha`);
    await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
    const folha = page.getByRole('dialog', { name: 'Encerrar este plano?' });
    await opcao(page, 'Cobrança de saída', 'Mês vigente: R$ 150,00').click();
    await folha.getByRole('button', { name: 'Encerrar plano' }).click();

    // O servidor recusa (a conta mudou) e a prévia nova traz "Mês vigente" indisponível.
    await expect(folha.getByText('A conta da saída mudou. Confira os valores novos e confirme de novo.')).toBeVisible();
    await expect(opcao(page, 'Cobrança de saída', 'Mês vigente')).toBeDisabled();
    // A escolha NÃO cai em "Não cobrar": o motivo da API aparece sob o grupo (da opção desabilitada) e o aviso do que fazer, no grupo e sob o botão.
    await expect(opcao(page, 'Cobrança de saída', 'Não cobrar')).not.toBeChecked();
    await expect(folha.getByText('O mês vigente já está pago.')).toHaveCount(1);
    await expect(folha.getByText('A opção escolhida não está mais disponível. Escolha de novo.')).toHaveCount(2);
    const botao = folha.getByRole('button', { name: 'Encerrar plano' });
    await expect(botao).toBeDisabled();
    expect(estado.encerramentos).toEqual([{ versao: 0, saida: { opcao: 'VIGENTE', valorCentavos: 15_000, vencimento: '2026-10-19' } }]);

    // Escolher de novo destrava; nenhum encerrar sem `saida` saiu até aqui.
    await opcao(page, 'Cobrança de saída', 'Não cobrar').click();
    await expect(folha.getByText('A opção escolhida não está mais disponível. Escolha de novo.')).toHaveCount(0);
    await expect(botao).toBeEnabled();
    expect(estado.encerramentos.filter((c) => !c.saida)).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('encerrar sem mínimo com "Outro valor": a tela valida o valor e o vencimento antes de enviar', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ contratacoes: [{ ...CONTRATACAO_ATIVA }], cobrancas: [] });
  const { errosDaPagina } = await fichaComFinanceiro(page, estado);
  await page.goto(`/treinador/alunos/${ALUNO_FINANCEIRO_ID}?aba=ficha`);
  await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
  const folha = page.getByRole('dialog', { name: 'Encerrar este plano?' });
  await expect(opcao(page, 'Cobrança de saída', 'Meses que faltam para o mínimo')).toBeDisabled();
  await expect(folha.getByText('A contratação não tem tempo mínimo.')).toHaveCount(1);
  await opcao(page, 'Cobrança de saída', 'Outro valor').click();
  await folha.getByLabel('Vence em').fill('19/10/2028');
  await folha.getByRole('button', { name: 'Encerrar plano' }).click();
  await expect(folha.getByText('Informe um valor maior que zero, até R$ 1.000.000,00.')).toBeVisible();
  await expect(folha.getByText('O vencimento vai de hoje até um ano à frente.')).toBeVisible();
  expect(estado.encerramentos).toHaveLength(0);
  await folha.getByLabel('Valor da cobrança de saída').fill('200,00');
  await folha.getByLabel('Vence em').fill('30/10/2026');
  await folha.getByRole('button', { name: 'Encerrar plano' }).click();
  await expect(page.getByText('Plano encerrado. A cobrança de saída foi criada.')).toBeVisible();
  expect(estado.encerramentos).toEqual([{ versao: 0, saida: { opcao: 'OUTRO', valorCentavos: 20_000, vencimento: '2026-10-30' } }]);
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [390, 1280]) {
  test(`inativar em ${largura}px: o painel mostra o que acontece com as cobranças, pela API`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await fixarHoje(page);
    const estado = estadoFinanceiro({
      contratacoes: [{ ...COM_MINIMO }], cobrancas: cobrancasComMinimo(),
      resumoDaSaida: { aCancelar: { quantidade: 2, valorCentavos: 30_000 }, emAberto: { quantidade: 1, valorCentavos: 15_000 }, minimoAte: '2027-02-05', mesesQueFaltam: 4 },
    });
    const { pedidos, errosDaPagina } = await fichaComFinanceiro(page, estado);
    await page.goto(`/treinador/alunos/${ALUNO_FINANCEIRO_ID}?aba=ficha`);
    await page.getByRole('button', { name: 'Mais ações do aluno', exact: true }).click();
    await page.getByText('Inativar aluno', { exact: true }).click();
    const painel = page.getByRole('alertdialog', { name: `Inativar ${ALUNO.nome}?` });
    await expect(painel.getByText('2 mensalidades a vencer serão canceladas (R$ 300,00).')).toBeVisible();
    await expect(painel.getByText('1 cobrança vencida ou de saída continua em aberto (R$ 150,00). Dê baixa ou cancele depois, se precisar.')).toBeVisible();
    await expect(painel.getByText('Faltam 4 meses para o mínimo (até 05/02/2027). Inativar não cobra a saída: para cobrar, encerre o plano antes.')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`inativar-${largura}.png`) });
    expect(pedidos.filter((p) => p.caminho === `/alunos/${ALUNO_FINANCEIRO_ID}/resumo-da-saida`)).toHaveLength(1);
    expect(errosDaPagina).toEqual([]);
  });
}

test('inativar sem a permissão do Financeiro: a linha genérica, sem valores e sem chamar o resumo; nada em aberto = nenhuma linha', async ({ page, context }) => {
  await fixarHoje(page);
  const { pedidos, errosDaPagina } = await fichaComFinanceiro(page, estadoFinanceiro(), []);
  await page.goto(`/treinador/alunos/${ALUNO_FINANCEIRO_ID}?aba=ficha`);
  await page.getByRole('button', { name: 'Mais ações do aluno', exact: true }).click();
  await page.getByText('Inativar aluno', { exact: true }).click();
  const painel = page.getByRole('alertdialog', { name: `Inativar ${ALUNO.nome}?` });
  await expect(painel.getByText('As cobranças que ainda não venceram serão canceladas. As vencidas e a cobrança de saída continuam em aberto.')).toBeVisible();
  expect(pedidos.filter((p) => p.caminho.endsWith('/resumo-da-saida'))).toHaveLength(0);
  expect(errosDaPagina).toEqual([]);

  const outra = await context.newPage();
  await fixarHoje(outra);
  const daOutra = await fichaComFinanceiro(outra, estadoFinanceiro());
  await outra.goto(`/treinador/alunos/${ALUNO_FINANCEIRO_ID}?aba=ficha`);
  await outra.getByRole('button', { name: 'Mais ações do aluno', exact: true }).click();
  await outra.getByText('Inativar aluno', { exact: true }).click();
  const vazio = outra.getByRole('alertdialog', { name: `Inativar ${ALUNO.nome}?` });
  await expect(vazio).toBeVisible();
  await expect.poll(() => daOutra.pedidos.filter((p) => p.caminho.endsWith('/resumo-da-saida')).length).toBe(1);
  await expect(vazio).not.toContainText(/cobran/);
  expect(daOutra.errosDaPagina).toEqual([]);
});

test('aluno com cobrança vencida: "Pagamento em aberto" nas pendências do Início, sem botão de pagar (o Pagar fica na Conta)', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ cobrancas: [{ ...COBRANCA_ATRASADA }] });
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    ...(await sessao(page, ALUNO, { pagamentosHabilitados: true })),
    ...rotasDoFinanceiro(estado),
  });
  await page.goto('/aluno');

  const pendencia = page.getByRole('link', { name: /Pagamento em aberto/ });
  await expect(pendencia).toBeVisible();
  await expect(pendencia).toContainText('Vencida');
  await expect(pendencia).toContainText('R$ 150,00');
  await expect(page.getByRole('button', { name: /pagar/i })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('módulo desligado: o aluno não chama o financeiro nem vê "Meu plano"; o treinador não vê o Financeiro', async ({ page, context }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ cobrancas: [{ ...COBRANCA_ATRASADA }] });
  const doAluno = await simularApi(page, { ...(await sessaoDeAluno(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/aluno/conta');
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
  await expect(page.getByText('Meu plano')).toHaveCount(0);
  expect(doAluno.pedidos.filter((p) => p.caminho.includes('financeiro') || p.caminho.includes('lembretes-de-cobranca'))).toEqual([]);

  const treinador = await context.newPage();
  const doTreinador = await simularApi(treinador, {
    ...(await sessao(treinador, TREINADOR, {
      pagamentosHabilitados: false,
      permissoes: ['PAINEL_VER', 'ALUNO_LER', 'FINANCEIRO_LER', 'FINANCEIRO_ALTERAR'],
    })),
    ...rotasDoFinanceiro(estado),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
  });
  await treinador.goto('/treinador/financeiro');
  // A guarda barra a rota (espera a tela de "sem permissão" antes de conferir as ausências) e o menu não oferece o Financeiro.
  await expect(treinador.getByRole('button', { name: 'Voltar ao início' })).toBeVisible();
  await expect(treinador.getByRole('link', { name: 'Alunos' }).first()).toBeVisible();
  await expect(treinador.getByRole('link', { name: 'Financeiro' })).toHaveCount(0);
  await expect(treinador.getByRole('heading', { name: 'Financeiro', exact: true, level: 1 })).toHaveCount(0);
  // C4: a tela diz que o módulo está desligado (com o seu h1), sem culpar a permissão nem mandar pedir a alguém.
  await expect(treinador.getByRole('heading', { name: 'Recurso desativado', level: 1 })).toBeVisible();
  await expect(treinador.getByText('Os pagamentos não estão ativos nesta instalação do app.')).toBeVisible();
  await expect(treinador.getByText(/Peça a um administrador/)).toHaveCount(0);
  expect(doTreinador.pedidos.filter((p) => p.caminho.startsWith('/financeiro'))).toEqual([]);
});

for (const [largura, tema] of [[390, 'CLARO'], [1280, 'CLARO'], [390, 'ESCURO'], [1280, 'ESCURO']] as const) {
  test(`C4: administrador com os pagamentos desligados vê "Recurso desativado", com um h1 e sem mandar pedir acesso (${largura}px, ${tema.toLowerCase()})`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 844 });
    await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
    const titulosDeNivel1 = page.locator('h1, [role="heading"][aria-level="1"]');
    const rotasDoInicio = { 'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } } };
    const admin = await simularApi(page, {
      ...(await sessao(page, TREINADOR, {
        pagamentosHabilitados: false,
        perfil: { id: 'p-admin', nome: 'Administrador', acessoTotal: true },
        permissoes: ['PAINEL_VER', 'ALUNO_LER', 'FINANCEIRO_LER', 'FINANCEIRO_ALTERAR'],
      })),
      ...rotasDoInicio,
    });
    await page.goto('/treinador/financeiro');
    await expect(page.getByRole('heading', { name: 'Recurso desativado', level: 1 })).toBeVisible();
    await expect(titulosDeNivel1).toHaveCount(1);
    await expect(page.getByText(/Peça a um administrador/)).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`modulo-desligado-${largura}-${tema.toLowerCase()}.png`) });
    await page.getByRole('button', { name: 'Voltar ao início' }).click();
    await expect(page).toHaveURL(/\/treinador$/);
    expect(admin.errosDaPagina).toEqual([]);
  });

  test(`C4: membro sem a permissão do Financeiro, com os pagamentos ligados, vê "Sem acesso a esta tela" (${largura}px, ${tema.toLowerCase()})`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 844 });
    await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
    const titulosDeNivel1 = page.locator('h1, [role="heading"][aria-level="1"]');
    const membro = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { pagamentosHabilitados: true, permissoes: ['PAINEL_VER', 'ALUNO_LER'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    });
    await page.goto('/treinador/financeiro');
    await expect(page.getByRole('heading', { name: 'Sem acesso a esta tela', level: 1 })).toBeVisible();
    await expect(titulosDeNivel1).toHaveCount(1);
    await expect(page.getByText('Seu perfil não tem permissão para abrir esta tela. Peça a um administrador da consultoria.')).toBeVisible();
    await expect(page.getByText('Recurso desativado')).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath(`sem-permissao-${largura}-${tema.toLowerCase()}.png`) });
    expect(membro.pedidos.filter((p) => p.caminho.startsWith('/financeiro'))).toEqual([]);
    expect(membro.errosDaPagina).toEqual([]);
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Recebimento online (InfinitePay): "Pagar" do aluno na web, aba do treinador, link da cobrança e pagamentos para conferir.
// ---------------------------------------------------------------------------------------------------------------------

const CHAVE_DE_TESTE = 'chave-de-teste-0123456789';

const aberta = () => abertaDaContratacao('c0000000-0000-4000-8000-0000000000b1', '2026-11-05', false);

/** A "página de pagamento": o domínio `.invalid` nunca resolve; o contexto (que vale para pop-ups) responde no lugar dele. */
async function servirPaginaDePagamento(context: BrowserContext) {
  await context.route('https://pagamento.exemplo.invalid/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Pagamento</title><p>Pagamento de teste</p>' }));
}

const ehPedidoDeLink = (p: { metodo: string; caminho: string }) => p.metodo === 'POST' && p.caminho.endsWith('/link');

/** Sessão do aluno com o financeiro ligado (o `GET /aluno/financeiro` diz se o recebimento online está pronto). */
async function sessaoDoAlunoComFinanceiro(page: Page): Promise<RespostasApi> {
  return { ...(await sessaoDeAluno(page)), ...(await sessao(page, ALUNO, { pagamentosHabilitados: true })) };
}

test('aluno na web com recebimento online: "Pagar" abre o link em outra aba e o clique duplo pede um link só', async ({ page, context }) => {
  await fixarHoje(page);
  await servirPaginaDePagamento(context);
  const estado = estadoFinanceiro({ contratacoes: [{ ...CONTRATACAO_ATIVA }], cobrancas: [aberta()], pagamentoOnline: true });
  const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoDoAlunoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/aluno/conta');

  const pagar = page.getByRole('button', { name: /^Pagar/ });
  await expect(pagar).toBeVisible();
  await expect(page.getByText(TEXTO_COMBINE_COM_O_TREINADOR)).toHaveCount(0);
  const novasAbas: Page[] = [];
  context.on('page', (p) => novasAbas.push(p));

  const [popup] = await Promise.all([page.waitForEvent('popup'), pagar.dblclick()]);
  await popup.waitForURL(LINK_DE_PAGAMENTO);
  await expect(popup.getByText('Pagamento de teste')).toBeVisible();
  // A página de pagamento não alcança o app.
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  await expect(page.getByText('Abrimos o pagamento em outra aba.')).toBeVisible();
  expect(pedidos.filter(ehPedidoDeLink)).toHaveLength(1);
  expect(novasAbas).toHaveLength(1);
  await expect(page.getByText(/boleto/i)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('aluno na web: se a API falha, a aba em branco é fechada e o aviso aparece', async ({ page, context }) => {
  await fixarHoje(page);
  await servirPaginaDePagamento(context);
  const estado = estadoFinanceiro({ contratacoes: [{ ...CONTRATACAO_ATIVA }], cobrancas: [aberta()], pagamentoOnline: true });
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessaoDoAlunoComFinanceiro(page)),
    ...rotasDoFinanceiro(estado),
    'POST /aluno/financeiro/cobrancas/{id}/link': erroApi(503, 'O pagamento online está indisponível agora. Tente de novo em instantes.', 'PROVEDOR_INDISPONIVEL'),
  });
  await page.goto('/aluno/conta');

  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: /^Pagar/ }).click()]);
  await expect.poll(() => popup.isClosed()).toBe(true);
  await expect(page.getByText('O pagamento online está indisponível agora. Tente de novo em instantes.')).toBeVisible();
  // O botão volta a poder ser usado.
  await expect(page.getByRole('button', { name: /^Pagar/ })).toBeEnabled();
  expect(errosDaPagina).toEqual([]);
});

test('aluno sem recebimento online: nenhum "Pagar", o texto manda combinar com o treinador e nenhum link é pedido', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ contratacoes: [{ ...CONTRATACAO_ATIVA }], cobrancas: [aberta()], pagamentoOnline: false });
  const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoDoAlunoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/aluno/conta');

  await expect(page.getByText('Meu plano').first()).toBeVisible();
  await expect(page.getByText(TEXTO_COMBINE_COM_O_TREINADOR)).toBeVisible();
  await expect(page.getByRole('button', { name: /pagar/i })).toHaveCount(0);
  await expect(page.getByText(/boleto/i)).toHaveCount(0);
  expect(pedidos.filter(ehPedidoDeLink)).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('Recebimento online do treinador: salva a tag e a chave, a chave nunca volta à tela, troca, remove a chave e remove tudo', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro();
  const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro');
  await page.getByRole('tab', { name: 'Recebimento online' }).click();

  await expect(page.getByText('Ainda não configurado', { exact: true })).toBeVisible();
  const tag = page.getByLabel('InfiniteTag', { exact: true });
  await tag.fill('$Saraiva.Team');
  // Sem o $ e em minúsculas, já ao digitar.
  await expect(tag).toHaveValue('saraiva.team');
  await page.getByLabel('API Key (opcional)', { exact: true }).fill(CHAVE_DE_TESTE);
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();

  await expect(page.getByText('Recebimento online salvo.')).toBeVisible();
  const salvar = pedidos.find((p) => p.metodo === 'PUT' && p.caminho === '/financeiro/recebimento-online');
  expect(salvar?.corpo).toEqual({ infiniteTag: 'saraiva.team', versao: null, jurosDoParcelamento: 'ALUNO', apiKey: CHAVE_DE_TESTE });
  await expect(page.getByText('Configurado', { exact: true })).toBeVisible();
  await expect(page.getByText('Chave configurada', { exact: true })).toBeVisible();
  await expect(tag).toHaveValue('saraiva.team');
  // A chave é só de escrita: nem no HTML, nem em campo, nem no armazenamento do navegador.
  expect(await page.content()).not.toContain(CHAVE_DE_TESTE);
  const valores = await page.locator('input, textarea').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(valores).not.toContain(CHAVE_DE_TESTE);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(CHAVE_DE_TESTE);
  expect(estado.chaveGuardada).toBe(CHAVE_DE_TESTE);

  // Trocar a chave: o campo nasce vazio, a chave antiga não aparece.
  await page.getByRole('button', { name: 'Trocar chave' }).click();
  await expect(page.getByLabel('Nova API Key', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Cancelar a troca' }).click();
  await expect(page.getByText('Chave configurada', { exact: true })).toBeVisible();

  // Remover só a chave: a tag fica e o campo da chave volta.
  await page.getByRole('button', { name: 'Remover chave' }).click();
  const removerChave = page.getByRole('alertdialog', { name: 'Remover a chave?' });
  await removerChave.getByRole('button', { name: 'Remover chave' }).click();
  await expect(page.getByText('Chave removida.')).toBeVisible();
  const removida = pedidos.filter((p) => p.metodo === 'PUT' && p.caminho === '/financeiro/recebimento-online').at(-1);
  expect(removida?.corpo).toEqual({ infiniteTag: 'saraiva.team', removerApiKey: true, jurosDoParcelamento: 'ALUNO', versao: 0 });
  await expect(page.getByLabel('API Key (opcional)', { exact: true })).toBeVisible();
  expect(estado.chaveGuardada).toBeNull();

  // Remover o recebimento online inteiro: DELETE com a versão atual.
  await page.getByRole('button', { name: 'Remover recebimento online' }).click();
  const removerTudo = page.getByRole('alertdialog', { name: 'Remover o recebimento online?' });
  await removerTudo.getByRole('button', { name: 'Remover recebimento online' }).click();
  await expect(page.getByText('Recebimento online removido.')).toBeVisible();
  const apagar = pedidos.find((p) => p.metodo === 'DELETE' && p.caminho === '/financeiro/recebimento-online');
  expect(apagar?.busca.get('versao')).toBe('1');
  await expect(page.getByText('Ainda não configurado', { exact: true })).toBeVisible();
  await expect(page.getByText(/boleto/i)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('Recebimento online: tag curta e chave curta são recusadas na tela, sem chamar a API', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro();
  const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=recebimento');

  await page.getByLabel('InfiniteTag', { exact: true }).fill('ab');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText(/Use a InfiniteTag sem o cifrão/)).toBeVisible();

  await page.getByLabel('InfiniteTag', { exact: true }).fill('saraiva.team');
  await page.getByLabel('API Key (opcional)', { exact: true }).fill('curta');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText(/A chave precisa ter de 10 a 200 caracteres/)).toBeVisible();
  await expect(page.getByText('curta', { exact: true })).toHaveCount(0);
  expect(pedidos.filter((p) => p.metodo === 'PUT')).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('Recebimento online sem permissão de alterar: só leitura, sem campos', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ recebimento: { ...RECEBIMENTO_CONFIGURADO } });
  const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page, ['FINANCEIRO_LER'])), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=recebimento');

  await expect(page.getByText('saraiva.team', { exact: true })).toBeVisible();
  await expect(page.getByText('Chave configurada', { exact: true })).toBeVisible();
  await expect(page.getByLabel('InfiniteTag', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('cobrança em aberto: "Copiar link de pagamento" pede o link, copia e avisa', async ({ page }) => {
  await fixarHoje(page);
  // O navegador de teste não deixa ler a área de transferência: um substituto guarda o que foi copiado.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (texto: string) => { (window as unknown as { __copiado?: string }).__copiado = texto; return Promise.resolve(); } },
    });
  });
  const estado = estadoFinanceiro({ cobrancas: [{ ...COBRANCA_ATRASADA }], recebimento: { ...RECEBIMENTO_CONFIGURADO }, pagamentoOnline: true });
  const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=cobrancas');

  await page.getByRole('button', { name: /^Abrir cobrança de/ }).click();
  const folha = page.getByRole('dialog');
  await folha.getByRole('button', { name: 'Copiar link de pagamento' }).click();

  await expect(page.getByText('Link copiado.')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __copiado?: string }).__copiado)).toBe(LINK_DE_PAGAMENTO);
  expect(pedidos.filter(ehPedidoDeLink)).toHaveLength(1);
  expect(pedidos.find(ehPedidoDeLink)?.caminho).toBe(`/cobrancas/${COBRANCA_ATRASADA.id}/link`);
  await expect(page.getByText(/boleto/i)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('cobrança em aberto sem recebimento configurado: sem botão de link, com o caminho para configurar', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ cobrancas: [{ ...COBRANCA_ATRASADA }] });
  const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=cobrancas');

  await page.getByRole('button', { name: /^Abrir cobrança de/ }).click();
  const folha = page.getByRole('dialog');
  await expect(folha.getByText(/Configure o recebimento online/)).toBeVisible();
  await expect(folha.getByRole('button', { name: 'Copiar link de pagamento' })).toHaveCount(0);
  expect(pedidos.filter(ehPedidoDeLink)).toEqual([]);

  await folha.getByRole('button', { name: 'Abrir Recebimento online' }).click();
  await expect(page).toHaveURL(/aba=recebimento/);
  await expect(page.getByRole('tab', { name: 'Recebimento online', selected: true })).toBeVisible();
  await expect(page.getByText('Ainda não configurado', { exact: true })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('cobrança paga pelo provedor ganha o selo "Online", sem botão de link; a paga à mão não', async ({ page }) => {
  await fixarHoje(page);
  const paga = { ...COBRANCA_ATRASADA, situacao: 'PAGA' as const, vencida: false, diasDeAtraso: null, pagoEm: '2026-10-18', versao: 1 };
  const estado = estadoFinanceiro({
    cobrancas: [{ ...paga, forma: 'PIX', provedor: 'INFINITEPAY' }],
    recebimento: { ...RECEBIMENTO_CONFIGURADO },
    pagamentoOnline: true,
  });
  const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=cobrancas');

  await expect(page.getByText('Online', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: /^Abrir cobrança de/ }).click();
  const folha = page.getByRole('dialog');
  await expect(folha.getByText('Online', { exact: true })).toBeVisible();
  await expect(folha.getByRole('button', { name: 'Copiar link de pagamento' })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);

  // Paga à mão: sem selo.
  const manual = await page.context().newPage();
  await fixarHoje(manual);
  const estadoManual = estadoFinanceiro({ cobrancas: [{ ...paga, forma: 'PIX_DIRETO', provedor: 'MANUAL' }], recebimento: { ...RECEBIMENTO_CONFIGURADO } });
  const doManual = await simularApi(manual, { ...(await sessaoComFinanceiro(manual)), ...rotasDoFinanceiro(estadoManual) });
  await manual.goto('/treinador/financeiro?aba=cobrancas');
  await expect(manual.getByRole('button', { name: /^Abrir cobrança de/ })).toBeVisible();
  await expect(manual.getByText('Online', { exact: true })).toHaveCount(0);
  expect(doManual.errosDaPagina).toEqual([]);
});

test('cobrança paga: marcar contestação, manter como paga e marcar estorno, sempre com motivo e a versão vista', async ({ page }) => {
  await fixarHoje(page);
  const paga = {
    ...COBRANCA_ATRASADA, situacao: 'PAGA' as const, vencida: false, diasDeAtraso: null, pagoEm: '2026-10-18', forma: 'PIX' as const,
    provedor: 'INFINITEPAY', versao: 3,
  };
  const estado = estadoFinanceiro({ cobrancas: [paga], recebimento: { ...RECEBIMENTO_CONFIGURADO } });
  const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=cobrancas');
  const abrir = () => page.getByRole('button', { name: /^Abrir cobrança de/ }).click();
  const caminho = (acao: string) => `/cobrancas/${paga.id}/${acao}`;

  // Paga online: não há desfazer baixa, mas contestação e estorno valem.
  await abrir();
  let folha = page.getByRole('dialog');
  await expect(folha.getByRole('button', { name: 'Desfazer baixa' })).toHaveCount(0);
  await expect(folha.getByRole('button', { name: 'Manter como paga' })).toHaveCount(0);
  await folha.getByRole('button', { name: 'Marcar contestação' }).click();
  let painel = page.getByRole('alertdialog', { name: 'Marcar como contestada?' });
  await expect(painel.getByRole('button', { name: 'Marcar contestação' })).toBeDisabled();
  await painel.getByRole('textbox', { name: 'Motivo' }).fill('Aluno contestou no cartão');
  await painel.getByRole('button', { name: 'Marcar contestação' }).click();
  await expect(page.getByText('Cobrança marcada como contestada.')).toBeVisible();
  expect(pedidos.find((p) => p.caminho === caminho('contestar'))?.corpo).toEqual({ motivo: 'Aluno contestou no cartão', versao: 3 });
  await expect(page.getByText('Contestada', { exact: true }).first()).toBeVisible();

  // Contestada: a baixa continua na ficha; manter como paga volta a "Paga".
  await abrir();
  folha = page.getByRole('dialog');
  await expect(folha.getByText('Pago em')).toBeVisible();
  await expect(folha.getByRole('button', { name: 'Marcar contestação' })).toHaveCount(0);
  await folha.getByRole('button', { name: 'Manter como paga' }).click();
  painel = page.getByRole('alertdialog', { name: 'Manter como paga?' });
  await painel.getByRole('textbox', { name: 'Motivo' }).fill('Banco decidiu a favor');
  await painel.getByRole('button', { name: 'Manter como paga' }).click();
  await expect(page.getByText('Cobrança mantida como paga.')).toBeVisible();
  expect(pedidos.find((p) => p.caminho === caminho('manter-paga'))?.corpo).toEqual({ motivo: 'Banco decidiu a favor', versao: 4 });
  // A folha abre com a linha da lista: espera a lista recarregada, senão abre a cobrança ainda contestada.
  await expect(page.getByText('Paga', { exact: true }).first()).toBeVisible();

  // Estorno: perigo, sem volta; depois dele nenhuma ação sobra.
  await abrir();
  await page.getByRole('dialog').getByRole('button', { name: 'Marcar estorno' }).click();
  painel = page.getByRole('alertdialog', { name: 'Marcar como estornada?' });
  await expect(painel.getByText(/não volta a ficar paga/)).toBeVisible();
  await painel.getByRole('textbox', { name: 'Motivo' }).fill('Devolvido na InfinitePay');
  await painel.getByRole('button', { name: 'Marcar estorno' }).click();
  await expect(page.getByText('Cobrança marcada como estornada.')).toBeVisible();
  expect(pedidos.find((p) => p.caminho === caminho('estornar'))?.corpo).toEqual({ motivo: 'Devolvido na InfinitePay', versao: 5 });
  await expect(page.getByText('Estornada', { exact: true }).first()).toBeVisible();
  await abrir();
  folha = page.getByRole('dialog');
  await expect(folha.getByText('Estornada', { exact: true })).toBeVisible();
  for (const rotulo of ['Marcar estorno', 'Marcar contestação', 'Manter como paga', 'Desfazer baixa']) {
    await expect(folha.getByRole('button', { name: rotulo })).toHaveCount(0);
  }
  expect(errosDaPagina).toEqual([]);
});

test('cobrança paga sem permissão de alterar: nenhuma ação de contestação ou estorno', async ({ page }) => {
  await fixarHoje(page);
  const paga = { ...COBRANCA_ATRASADA, situacao: 'PAGA' as const, vencida: false, diasDeAtraso: null, pagoEm: '2026-10-18', versao: 1 };
  const estado = estadoFinanceiro({ cobrancas: [{ ...paga, forma: 'PIX_DIRETO', provedor: 'MANUAL' }] });
  const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page, ['FINANCEIRO_LER'])), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=cobrancas');
  await page.getByRole('button', { name: /^Abrir cobrança de/ }).click();
  const folha = page.getByRole('dialog');
  await expect(folha.getByText('Paga', { exact: true })).toBeVisible();
  for (const rotulo of ['Marcar estorno', 'Marcar contestação', 'Desfazer baixa']) {
    await expect(folha.getByRole('button', { name: rotulo })).toHaveCount(0);
  }
  expect(errosDaPagina).toEqual([]);
});

test('pagamentos para conferir: lista com "—" onde não há dado, marcar como conferido tira da lista e o cartão some no fim', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({
    conferencias: [{ ...CONFERENCIA_VALOR_DIFERENTE }, { ...CONFERENCIA_SEM_COBRANCA }],
    recebimento: { ...RECEBIMENTO_CONFIGURADO },
    pagamentoOnline: true,
  });
  const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=cobrancas');

  await expect(page.getByText('Pagamentos para conferir (2)')).toBeVisible();
  await expect(page.getByText(TEXTO_NADA_E_BAIXADO)).toBeVisible();
  await expect(page.getByText('Aluna Conferir', { exact: true })).toBeVisible();
  await expect(page.getByText('Valor diferente do combinado')).toBeVisible();
  await expect(page.getByText('R$ 100,00', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Cobrança não encontrada', { exact: false }).first()).toBeVisible();
  // Sem cobrança casada, aluno, competência e valor da cobrança ficam em "—" (nunca R$ 0,00); o valor pago é o do aviso.
  await expect(page.getByText('—', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('R$ 90,00', { exact: true })).toBeVisible();
  await expect(page.getByText('R$ 0,00')).toHaveCount(0);

  await page.getByRole('button', { name: 'Marcar como conferido o pagamento de Aluna Conferir' }).click();
  const painel = page.getByRole('alertdialog', { name: 'Marcar como conferido?' });
  await painel.getByRole('button', { name: 'Marcar como conferido' }).click();
  await expect(page.getByText('Marcado como conferido.')).toBeVisible();
  expect(pedidos.some((p) => p.metodo === 'POST' && p.caminho === `/financeiro/conferencias/${CONFERENCIA_VALOR_DIFERENTE.id}/conferido`)).toBe(true);
  await expect(page.getByText('Pagamentos para conferir (1)')).toBeVisible();
  await expect(page.getByText('Aluna Conferir', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Marcar como conferido o pagamento de aluno não identificado' }).click();
  await page.getByRole('alertdialog', { name: 'Marcar como conferido?' }).getByRole('button', { name: 'Marcar como conferido' }).click();
  await expect(page.getByText(/Pagamentos para conferir/)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('pagamentos para conferir sem permissão de alterar: a lista aparece, sem o botão de marcar', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ conferencias: [{ ...CONFERENCIA_VALOR_DIFERENTE }], recebimento: { ...RECEBIMENTO_CONFIGURADO } });
  const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page, ['FINANCEIRO_LER'])), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=cobrancas');

  await expect(page.getByText('Pagamentos para conferir (1)')).toBeVisible();
  await expect(page.getByRole('button', { name: /Marcar como conferido/ })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('consultoria sem recebimento online: nenhuma aba, nenhum cartão, e o endereço da aba cai na visão geral sem chamar a API', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ conferencias: [{ ...CONFERENCIA_VALOR_DIFERENTE }], cobrancas: [{ ...COBRANCA_ATRASADA }] });
  const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page, undefined, false)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=recebimento');

  await expect(page.getByText('Recebido no período')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Recebimento online' })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Cobranças' }).click();
  await page.getByRole('button', { name: /^Abrir cobrança de/ }).click();
  const folha = page.getByRole('dialog');
  await expect(folha.getByRole('button', { name: 'Registrar pagamento', exact: true })).toBeVisible();
  await expect(folha.getByRole('button', { name: 'Copiar link de pagamento' })).toHaveCount(0);
  await expect(folha.getByText(/Configure o recebimento online/)).toHaveCount(0);
  await expect(page.getByText(/Pagamentos para conferir/)).toHaveCount(0);
  expect(pedidos.filter((p) => p.caminho.startsWith('/financeiro/recebimento-online') || p.caminho.startsWith('/financeiro/conferencias'))).toEqual([]);
  expect(pedidos.filter(ehPedidoDeLink)).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('nenhuma tela do financeiro fala em boleto', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({
    inadimplentes: [INADIMPLENTE],
    cobrancas: [{ ...COBRANCA_ATRASADA }],
    recebimento: { ...RECEBIMENTO_CONFIGURADO },
    conferencias: [{ ...CONFERENCIA_VALOR_DIFERENTE }],
    pagamentoOnline: true,
  });
  const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  for (const aba of ['visao', 'cobrancas', 'planos', 'lancamentos', 'recebimento']) {
    await page.goto(`/treinador/financeiro?aba=${aba}`);
    await expect(page.getByRole('heading', { name: 'Financeiro', level: 1 })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Recebimento online' })).toBeVisible();
    await expect(page.getByText(/boleto/i)).toHaveCount(0);
  }
  expect(errosDaPagina).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------
// Celular: o e2e só roda a web (Platform.OS = 'web'), então a web é a prova de que as chaves da plataforma não a afetam;
// iOS e Android × pagamento online × chave ligada ou desligada estão no Jest (`comoPagar`, `informacaoDaCobranca`,
// `itemDoPagamento`), porque a decisão é uma função pura.
// ---------------------------------------------------------------------------------------------------------------------

test('web: as chaves do celular desligadas não tiram o "Pagar" nem trazem o texto de só informar', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ contratacoes: [{ ...CONTRATACAO_ATIVA }], cobrancas: [aberta()], pagamentoOnline: true });
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    ...(await sessao(page, ALUNO, { pagamentosHabilitados: true, pagarNoIos: false, pagarNoAndroid: false })),
    ...rotasDoFinanceiro(estado),
  });
  await page.goto('/aluno/conta');

  await expect(page.getByRole('button', { name: /^Pagar/ })).toBeVisible();
  await expect(page.getByText(/Mensalidade de|Em aberto desde/)).toHaveCount(0);
  await expect(page.getByText(/pague pelo|pelo site/i)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------
// Volta do navegador depois do pagamento: /aluno/conta?order_nsu=...&transaction_nsu=... (só a web, só essa tela).
// ---------------------------------------------------------------------------------------------------------------------

const RETORNO = `order_nsu=${aberta().id}&transaction_nsu=tx-0123456789&slug=abc123&capture_method=pix&receipt_url=${encodeURIComponent('https://recibo.exemplo.invalid/r/1')}`;
const ehRetorno = (p: { metodo: string; caminho: string }) => p.metodo === 'POST' && p.caminho === '/aluno/financeiro/retorno-pagamento';

test('volta do pagamento: avisa a API uma vez, limpa o endereço, recarrega o financeiro e mostra o aviso neutro', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ contratacoes: [{ ...CONTRATACAO_ATIVA }], cobrancas: [aberta()], pagamentoOnline: true });
  const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoDoAlunoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto(`/aluno/conta?${RETORNO}`);

  await expect(page.getByText('Recebemos o retorno do pagamento. A confirmação pode levar alguns instantes.')).toBeVisible();
  await expect(page).toHaveURL(/\/aluno\/conta$/);
  expect(page.url()).not.toMatch(/order_nsu|transaction_nsu|receipt_url|slug|capture_method/);
  expect(pedidos.filter(ehRetorno)).toHaveLength(1);
  // Só os campos conhecidos, em camelCase; o `receipt_url` nunca sai do aparelho.
  expect(pedidos.find(ehRetorno)?.corpo).toEqual({ orderNsu: aberta().id, transactionNsu: 'tx-0123456789', slug: 'abc123', captureMethod: 'pix' });
  // O financeiro foi buscado de novo depois do retorno (a carga da tela e a recarga).
  await expect.poll(() => pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/aluno/financeiro').length).toBeGreaterThanOrEqual(2);
  await expect(page.getByText('Meu plano').first()).toBeVisible();
  // O endereço limpo não chama a API de novo ao recarregar a tela.
  await page.reload();
  await expect(page.getByText('Meu plano').first()).toBeVisible();
  expect(pedidos.filter(ehRetorno)).toHaveLength(1);
  expect(errosDaPagina).toEqual([]);
});

test('volta do pagamento: se a API falha, a tela segue, o aviso é neutro e nada é repetido', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ contratacoes: [{ ...CONTRATACAO_ATIVA }], cobrancas: [aberta()], pagamentoOnline: true });
  const { pedidos, errosDaPagina } = await simularApi(page, {
    ...(await sessaoDoAlunoComFinanceiro(page)),
    ...rotasDoFinanceiro(estado),
    'POST /aluno/financeiro/retorno-pagamento': erroApi(503, 'O pagamento online está indisponível agora. Tente de novo em instantes.', 'PROVEDOR_INDISPONIVEL'),
  });
  await page.goto(`/aluno/conta?${RETORNO}`);

  await expect(page.getByText(/Não foi possível conferir o retorno agora/)).toBeVisible();
  await expect(page).toHaveURL(/\/aluno\/conta$/);
  await expect(page.getByText('Meu plano').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Pagar/ })).toBeVisible();
  expect(pedidos.filter(ehRetorno)).toHaveLength(1);
  expect(errosDaPagina).toEqual([]);
});

test('volta do pagamento: NSU fora do padrão não chama a API, mas o endereço é limpo', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ contratacoes: [{ ...CONTRATACAO_ATIVA }], cobrancas: [aberta()], pagamentoOnline: true });
  const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoDoAlunoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto(`/aluno/conta?order_nsu=${encodeURIComponent('../../x y')}&transaction_nsu=tx1`);

  await expect(page.getByText('Meu plano').first()).toBeVisible();
  await expect(page).toHaveURL(/\/aluno\/conta$/);
  expect(pedidos.filter(ehRetorno)).toEqual([]);
  await expect(page.getByText(/Recebemos o retorno/)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------
// Juros do parcelamento.
// ---------------------------------------------------------------------------------------------------------------------

const JUROS = 'Quem paga os juros do parcelamento';
const ehSalvar = (p: { metodo: string; caminho: string }) => p.metodo === 'PUT' && p.caminho === '/financeiro/recebimento-online';

test('juros do parcelamento: "Você" fica apagado sem chave, com o motivo; com a chave digitada vale; salvar manda o campo', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro();
  const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=recebimento');

  await expect(page.getByText(JUROS, { exact: true })).toBeVisible();
  await expect(page.getByText('Aluno: ele paga os juros quando parcela no cartão. Você: você absorve os juros do parcelamento.')).toBeVisible();
  await expect(opcao(page, JUROS, 'Aluno')).toBeVisible();
  await expect(opcao(page, JUROS, 'Você')).toBeDisabled();
  await expect(page.getByText('Precisa da chave de API para valer.')).toBeVisible();

  // Com uma chave válida digitada, "Você" libera; apagar a chave devolve a escolha para Aluno.
  const chave = page.getByLabel('API Key (opcional)', { exact: true });
  await chave.fill(CHAVE_DE_TESTE);
  await expect(opcao(page, JUROS, 'Você')).toBeEnabled();
  await expect(page.getByText('Precisa da chave de API para valer.')).toHaveCount(0);
  await opcao(page, JUROS, 'Você').click();
  await expect(opcao(page, JUROS, 'Você')).toHaveAttribute('aria-checked', 'true');
  await chave.fill('');
  await expect(opcao(page, JUROS, 'Você')).toBeDisabled();
  await expect(opcao(page, JUROS, 'Aluno')).toHaveAttribute('aria-checked', 'true');

  // Criar com Tag, chave e "Você" num salvar só.
  await page.getByLabel('InfiniteTag', { exact: true }).fill('saraiva.team');
  await chave.fill(CHAVE_DE_TESTE);
  await opcao(page, JUROS, 'Você').click();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Recebimento online salvo.')).toBeVisible();
  expect(pedidos.filter(ehSalvar).at(-1)?.corpo).toEqual({
    infiniteTag: 'saraiva.team', versao: null, apiKey: CHAVE_DE_TESTE, jurosDoParcelamento: 'TREINADOR',
  });
  expect(estado.recebimento.jurosDoParcelamento).toBe('TREINADOR');
  await expect(opcao(page, JUROS, 'Você')).toHaveAttribute('aria-checked', 'true');
  // Nada mudou desde o salvar: o botão fica apagado.
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeDisabled();

  // Voltar para Aluno é uma alteração que se salva sozinha (sem mexer na Tag nem na chave).
  await opcao(page, JUROS, 'Aluno').click();
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  // O aviso do primeiro salvar ainda pode estar na tela: espera o segundo PUT chegar antes de conferir o corpo.
  await expect.poll(() => pedidos.filter(ehSalvar).length).toBe(2);
  await expect(page.getByText('Recebimento online salvo.').first()).toBeVisible();
  expect(pedidos.filter(ehSalvar).at(-1)?.corpo).toEqual({ infiniteTag: 'saraiva.team', versao: 0, jurosDoParcelamento: 'ALUNO' });
  expect(estado.recebimento.jurosDoParcelamento).toBe('ALUNO');
  expect(errosDaPagina).toEqual([]);
});

test('juros do parcelamento: remover a chave estando em "Você" manda os juros de volta para o aluno', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ recebimento: { ...RECEBIMENTO_CONFIGURADO, jurosDoParcelamento: 'TREINADOR' }, chaveGuardada: CHAVE_DE_TESTE });
  const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=recebimento');

  await expect(opcao(page, JUROS, 'Você')).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Remover chave' }).click();
  const painel = page.getByRole('alertdialog', { name: 'Remover a chave?' });
  await expect(painel.getByText(/os juros do parcelamento voltam a ser do aluno/)).toBeVisible();
  await painel.getByRole('button', { name: 'Remover chave' }).click();
  await expect(page.getByText('Chave removida.')).toBeVisible();
  expect(pedidos.filter(ehSalvar).at(-1)?.corpo).toEqual({
    infiniteTag: 'saraiva.team', removerApiKey: true, jurosDoParcelamento: 'ALUNO', versao: 0,
  });
  expect(estado.recebimento.jurosDoParcelamento).toBe('ALUNO');
  await expect(opcao(page, JUROS, 'Aluno')).toHaveAttribute('aria-checked', 'true');
  await expect(opcao(page, JUROS, 'Você')).toBeDisabled();
  expect(errosDaPagina).toEqual([]);
});

test('juros do parcelamento: o 422 do campo aparece sob a escolha, sem derrubar a tela', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ recebimento: { ...RECEBIMENTO_CONFIGURADO } });
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessaoComFinanceiro(page)),
    ...rotasDoFinanceiro(estado),
    'PUT /financeiro/recebimento-online': {
      status: 422,
      corpo: {
        status: 422, message: 'Confira os dados do recebimento online.', codigo: 'RECEBIMENTO_ONLINE_INVALIDO',
        fieldErrors: [{ field: 'jurosDoParcelamento', message: 'Para absorver os juros, configure a API Key.' }],
      },
    },
  });
  await page.goto('/treinador/financeiro?aba=recebimento');

  await opcao(page, JUROS, 'Você').click();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Para absorver os juros, configure a API Key.')).toBeVisible();
  await expect(opcao(page, JUROS, 'Você')).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('juros do parcelamento sem permissão de alterar: só leitura, sem a escolha', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ recebimento: { ...RECEBIMENTO_CONFIGURADO, jurosDoParcelamento: 'TREINADOR' } });
  const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page, ['FINANCEIRO_LER'])), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=recebimento');

  await expect(page.getByText(JUROS, { exact: true })).toBeVisible();
  await expect(page.getByText('O treinador absorve os juros')).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: JUROS })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------
// Estorno informado: a baixa nunca é desfeita sozinha.
// ---------------------------------------------------------------------------------------------------------------------

test('estorno informado pela InfinitePay: o texto manda conferir e ajustar à mão, e nada diz que o sistema estornou', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({
    conferencias: [{ ...CONFERENCIA_ESTORNO_INFORMADO }],
    recebimento: { ...RECEBIMENTO_CONFIGURADO },
    pagamentoOnline: true,
  });
  const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=cobrancas');

  await expect(page.getByText('Pagamentos para conferir (1)')).toBeVisible();
  await expect(page.getByText('A InfinitePay informou estorno deste pagamento. Confira na sua conta e, se for o caso, ajuste a cobrança à mão.')).toBeVisible();
  await expect(page.getByText(TEXTO_NADA_E_BAIXADO)).toBeVisible();
  await expect(page.getByText(/foi estornad|estornamos|sistema estornou|baixa desfeita/i)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('lembretes de cobrança: liga, muda os dias e salva com a versão; dia fora do limite é recusado na tela', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro();
  const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=lembretes');

  await expect(page.getByRole('tab', { name: 'Lembretes', selected: true })).toBeVisible();
  await expect(page.getByText('Desligados', { exact: true })).toBeVisible();
  await expect(page.getByText(/Só por e-mail e só com o e-mail do app ligado/)).toBeVisible();
  await expect(page.getByText('E-mail do app desligado')).toHaveCount(0);

  await page.getByLabel('Mandar lembretes por e-mail').click();
  const antes = page.getByRole('textbox', { name: 'Dias antes do vencimento' });
  await antes.fill('16');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Use um número de 0 a 15.')).toBeVisible();
  expect(pedidos.filter((x) => x.metodo === 'PUT')).toEqual([]);

  await antes.fill('5');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Lembretes salvos.')).toBeVisible();
  const put = pedidos.find((x) => x.metodo === 'PUT' && x.caminho === '/financeiro/lembretes');
  expect(put?.corpo).toEqual({ ligado: true, diasAntes: 5, noDia: true, diasDepois: 3, versao: null });
  await expect(page.getByText('Ligados', { exact: true })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('lembretes com o e-mail do app desligado: o cartão avisa que nenhum lembrete sai', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ lembretes: { ...LEMBRETES_PADRAO, emailDisponivel: false } });
  const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=lembretes');

  await expect(page.getByText('E-mail do app desligado')).toBeVisible();
  await expect(page.getByText(/O e-mail do app está desligado: enquanto ele não for ligado/)).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('folha da cobrança: lista os lembretes e abre o WhatsApp com a mensagem pronta, fora do app', async ({ page, context }) => {
  await fixarHoje(page);
  await context.route('https://wa.me/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>WhatsApp</title><p>WhatsApp de teste</p>' }));
  const mensagem = 'Olá, Aluna.\n\nA mensalidade de Equipe Fictícia no valor de R$ 150,00 venceu em 05/10 e ainda está em aberto.';
  const estado = estadoFinanceiro({
    cobrancas: [{ ...COBRANCA_ATRASADA }],
    lembretesDasCobrancas: {
      [COBRANCA_ATRASADA.id]: {
        itens: [
          { id: 'l1', tipo: 'ANTES', situacao: 'ENVIADO', motivo: null, dataPrevista: '2026-10-02', enviadoEm: '2026-10-02T12:07:00Z', atualizadoEm: '2026-10-02T12:07:00Z' },
          { id: 'l2', tipo: 'NO_DIA', situacao: 'CANCELADO', motivo: 'SEM_EMAIL', dataPrevista: '2026-10-05', enviadoEm: null, atualizadoEm: '2026-10-05T12:07:00Z' },
        ],
        whatsapp: { telefone: '(45) 99999-8888', mensagem },
        motivoSemWhatsapp: null,
        alunoDesligou: false,
      },
    },
  });
  const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=cobrancas');

  await page.getByRole('button', { name: /^Abrir cobrança de/ }).click();
  const folha = page.getByRole('dialog');
  await expect(folha.getByRole('heading', { name: 'Lembretes por e-mail' })).toBeVisible();
  await expect(folha.getByText('Enviado em 02/10/2026')).toBeVisible();
  await expect(folha.getByText('Não enviado: o aluno não tem e-mail')).toBeVisible();

  const [popup] = await Promise.all([page.waitForEvent('popup'),
    folha.getByRole('button', { name: 'Abrir WhatsApp com a mensagem' }).click()]);
  await popup.waitForLoadState();
  const url = new URL(popup.url());
  expect(url.origin + url.pathname).toBe('https://wa.me/5545999998888');
  expect(url.searchParams.get('text')).toBe(mensagem);
  expect(errosDaPagina).toEqual([]);
});

test('folha da cobrança sem telefone do aluno: o botão do WhatsApp fica desabilitado com o porquê', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({
    cobrancas: [{ ...COBRANCA_ATRASADA }],
    lembretesDasCobrancas: { [COBRANCA_ATRASADA.id]: { itens: [], whatsapp: { telefone: null, mensagem: 'Olá, Aluna.' }, motivoSemWhatsapp: null, alunoDesligou: false } },
  });
  const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=cobrancas');

  await page.getByRole('button', { name: /^Abrir cobrança de/ }).click();
  const folha = page.getByRole('dialog');
  await expect(folha.getByRole('button', { name: 'Abrir WhatsApp com a mensagem' })).toBeDisabled();
  await expect(folha.getByText('O aluno não tem telefone no cadastro.')).toBeVisible();
  await expect(folha.getByRole('heading', { name: 'Lembretes por e-mail' })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('folha da cobrança: o aluno que desligou os lembretes aparece em texto suave e o WhatsApp manual continua', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({
    cobrancas: [{ ...COBRANCA_ATRASADA }],
    lembretesDasCobrancas: { [COBRANCA_ATRASADA.id]: { itens: [], whatsapp: { telefone: '(45) 99999-8888', mensagem: 'Olá, Aluna.' }, motivoSemWhatsapp: null, alunoDesligou: true } },
  });
  const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=cobrancas');

  await page.getByRole('button', { name: /^Abrir cobrança de/ }).click();
  const folha = page.getByRole('dialog');
  await expect(folha.getByRole('heading', { name: 'Lembretes por e-mail' })).toBeVisible();
  await expect(folha.getByText('O aluno desligou os lembretes por e-mail')).toBeVisible();
  await expect(folha.getByRole('button', { name: 'Abrir WhatsApp com a mensagem' })).toBeEnabled();
  expect(errosDaPagina).toEqual([]);
});

const INTERRUPTOR_DE_LEMBRETES = 'Receber lembretes de pagamento por e-mail';

for (const largura of [390, 1280]) {
  test(`aluno desliga e liga de novo os lembretes de pagamento em Meu plano em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await fixarHoje(page);
    const estado = estadoFinanceiro({ contratacoes: [{ ...CONTRATACAO_ATIVA }], cobrancas: [aberta()] });
    const { errosDaPagina } = await simularApi(page, { ...(await sessaoDoAlunoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
    await page.goto('/aluno/conta');

    const interruptor = page.getByRole('switch', { name: INTERRUPTOR_DE_LEMBRETES });
    await expect(interruptor).toBeChecked();
    await interruptor.click();
    await expect(interruptor).not.toBeChecked();
    await expect.poll(() => estado.pedidosDeLembretesDoAluno).toEqual([{ receber: false }]);
    expect(estado.alunoRecebeLembretes).toBe(false);
    await interruptor.click();
    await expect(interruptor).toBeChecked();
    await expect.poll(() => estado.pedidosDeLembretesDoAluno).toEqual([{ receber: false }, { receber: true }]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('aluno: se a API recusa, o interruptor dos lembretes volta ao valor de antes e o aviso aparece', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({
    contratacoes: [{ ...CONTRATACAO_ATIVA }], cobrancas: [aberta()],
    falhaAoDefinirLembretesDoAluno: 'Não foi possível salvar agora. Tente de novo em instantes.',
  });
  const { errosDaPagina } = await simularApi(page, { ...(await sessaoDoAlunoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/aluno/conta');

  const interruptor = page.getByRole('switch', { name: INTERRUPTOR_DE_LEMBRETES });
  await expect(interruptor).toBeChecked();
  await interruptor.click();
  await expect(page.getByText('Não foi possível salvar agora. Tente de novo em instantes.')).toBeVisible();
  await expect(interruptor).toBeChecked();
  expect(estado.alunoRecebeLembretes).toBe(true);
  expect(errosDaPagina).toEqual([]);
});

test('aluno que já desligou os lembretes abre com o interruptor desligado; sem internet ele some com o resto de "Meu plano"', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ contratacoes: [{ ...CONTRATACAO_ATIVA }], cobrancas: [aberta()], alunoRecebeLembretes: false });
  const { errosDaPagina } = await simularApi(page, { ...(await sessaoDoAlunoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/aluno/conta');

  const interruptor = page.getByRole('switch', { name: INTERRUPTOR_DE_LEMBRETES });
  await expect(interruptor).not.toBeChecked();
  await page.context().setOffline(true);
  await expect(page.getByText('Os dados do seu plano aparecem quando você estiver conectado à internet.')).toBeVisible();
  await expect(interruptor).toHaveCount(0);
  await page.context().setOffline(false);
  expect(errosDaPagina).toEqual([]);
});

// Gustavo, 13/11: R$ 10.000,00 e R$ 100.000,00 cabem inteiros (sem cortar, sem o "R$" numa linha e o número noutra e sem
// encolher a fonte) nos cartões da Visão geral e no Resultado do mês, no celular e no PC.
for (const extra of [false, true]) test(`valores grandes cabem inteiros nos cartões da visão geral e no resultado do mês, em 390 e 1280${extra ? ', texto extra grande' : ''}`, async ({ page }) => {
  await fixarHoje(page);
  if (extra) await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tamanhoTexto: 'EXTRA' })), TREINADOR.id);
  const painel = {
    ...PAINEL_COM_DADOS,
    cartoes: {
      recebidoCentavos: 10_000_000, aReceberCentavos: 1_000_000, emAtraso: { valorCentavos: 10_000_000, cobrancas: 40 },
      receitaRecorrenteMensalCentavos: 1_000_000, alunosPagantes: 120, valorMedioPorAlunoCentavos: 83_333,
    },
    resultadoDoMes: { ...PAINEL_COM_DADOS.resultadoDoMes, recebidoCentavos: 10_000_000, entradasAvulsasCentavos: 1_000_000, saidasAvulsasCentavos: 10_000_000, resultadoCentavos: 1_000_000 },
  };
  const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estadoFinanceiro({ painel })) });
  await page.goto('/treinador/financeiro');
  await expect(page.getByText('Resultado do mês (entradas − saídas registradas)')).toBeVisible();
  const pecas: [string, string][] = [
    ['Recebido no período', 'R$ 100.000,00'], ['A receber', 'R$ 10.000,00'], ['Em atraso', 'R$ 100.000,00'], ['Receita recorrente mensal', 'R$ 10.000,00'],
    ['Recebido das cobranças', 'R$ 100.000,00'], ['Entradas avulsas', 'R$ 10.000,00'], ['Saídas avulsas', 'R$ 100.000,00'], ['Resultado', 'R$ 10.000,00'],
  ];
  for (const largura of [390, 1280]) {
    await page.setViewportSize({ width: largura, height: 900 });
    for (const [rotulo, valor] of pecas) {
      await esperarValorInteiro(page.getByLabel(`${rotulo}: ${valor}`), [valor]);
    }
  }
  expect(errosDaPagina).toEqual([]);
});
