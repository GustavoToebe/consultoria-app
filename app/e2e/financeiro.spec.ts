import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import type { CobrancaResponse, ContratacaoResponse } from '../src/api/financeiroTipos';
import type { AlunoDetalhe } from '../src/api/tipos';
import { TEXTO_COMBINE_COM_O_TREINADOR, TEXTO_NADA_E_BAIXADO } from '../src/dominio/financeiro';
import { ALUNO, erroApi, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { fixarHoje, sessaoDeAluno } from './aluno';
import {
  ALUNO_FINANCEIRO_ID, COBRANCA_ATRASADA, CONFERENCIA_ESTORNO_INFORMADO, CONFERENCIA_SEM_COBRANCA, CONFERENCIA_VALOR_DIFERENTE, estadoFinanceiro, INADIMPLENTE,
  LINK_DE_PAGAMENTO, PAINEL_COM_DADOS, PAINEL_VAZIO, RECEBIMENTO_CONFIGURADO, rotasDoFinanceiro, sessaoComFinanceiro,
} from './financeiro-falso';

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
  page.getByRole('radiogroup', { name: grupo }).getByRole('button', { name: rotulo, exact: true });

test('visão geral com dados: cartões, líquido indisponível, resultado do mês, inadimplentes e nenhum "Pagar"', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ inadimplentes: [INADIMPLENTE], cobrancas: [{ ...COBRANCA_ATRASADA }] });
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
  await expect(page.getByText('12,5%', { exact: true })).toBeVisible();

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

test('visão geral vazia: tudo "—", nunca R$ 0,00, e a lista de inadimplentes diz que não há nada vencido', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ painel: PAINEL_VAZIO });
  const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro');

  await expect(page.getByRole('heading', { name: 'Recebido no período' })).toBeVisible();
  await expect(page.getByText('Nenhuma cobrança vencida em aberto.')).toBeVisible();
  await expect(page.getByText('—', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('R$ 0,00')).toHaveCount(0);
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

test('lançamento de saída: o app envia centavos e o resultado do mês acompanha', async ({ page }) => {
  await fixarHoje(page);
  const estado = estadoFinanceiro({ painel: PAINEL_COM_DADOS });
  const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=lancamentos');

  await expect(page.getByText('Nenhum lançamento')).toBeVisible();
  await page.getByRole('button', { name: 'Novo lançamento' }).click();
  const folha = page.getByRole('dialog');
  await folha.getByLabel('Descrição').fill('Aluguel da sala');
  await folha.getByLabel('Valor (R$)').fill('350,00');
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
  await novoPlano.getByLabel('Valor (R$)').fill('150,00');
  await novoPlano.getByRole('button', { name: 'Criar plano' }).click();
  await expect(page.getByText('Plano criado.')).toBeVisible();
  await expect(page.getByText('Consultoria mensal').first()).toBeVisible();
  expect(pedidos.find((p) => p.metodo === 'POST' && p.caminho === '/financeiro/planos')?.corpo)
    .toEqual({ nome: 'Consultoria mensal', valorCentavos: 15_000, periodicidade: 'MENSAL', versao: null });
  const planoId = estado.planos[0].id;

  // 2. Contratação na ficha do aluno.
  await page.goto(`/treinador/alunos/${ALUNO_FINANCEIRO_ID}`);
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
  situacao: 'ATIVA', encerradaEm: null, criadoEm: '2026-08-05T12:00:00Z', versao: 0,
};

const abertaDaContratacao = (id: string, vencimento: string, vencida: boolean): CobrancaResponse => ({
  ...COBRANCA_ATRASADA, id, contratacaoId: CONTRATACAO_ATIVA.id, alunoId: ALUNO_FINANCEIRO_ID, competencia: vencimento, vencimento, vencida,
  diasDeAtraso: vencida ? 14 : null,
});

test('Pausar e Encerrar avisam das cobranças abertas (as vencidas incluídas) só quando há alguma', async ({ page, context }) => {
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
  await page.goto(`/treinador/alunos/${ALUNO_FINANCEIRO_ID}`);
  const aviso = 'Há 2 cobranças abertas; elas continuam valendo. Cancele uma a uma se precisar.';

  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  const pausar = page.getByRole('alertdialog', { name: 'Pausar este plano?' });
  await expect(pausar.getByText(aviso)).toBeVisible();
  await pausar.getByRole('button', { name: 'Voltar' }).click();

  await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
  await expect(page.getByRole('alertdialog', { name: 'Encerrar este plano?' }).getByText(aviso)).toBeVisible();
  await page.getByRole('alertdialog', { name: 'Encerrar este plano?' }).getByRole('button', { name: 'Voltar' }).click();

  // Sem cobrança aberta: nenhum texto sobre cobranças abertas no painel.
  const outra = await context.newPage();
  await fixarHoje(outra);
  const semAbertas = estadoFinanceiro({ contratacoes: [{ ...CONTRATACAO_ATIVA }], cobrancas: [] });
  const daOutra = await simularApi(outra, {
    ...(await sessaoComFinanceiro(outra)), ...rotasDoFinanceiro(semAbertas),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } }, [`GET /alunos/${ALUNO_FINANCEIRO_ID}`]: { corpo: FICHA },
  });
  await outra.goto(`/treinador/alunos/${ALUNO_FINANCEIRO_ID}`);
  await outra.getByRole('button', { name: 'Pausar', exact: true }).click();
  const painel = outra.getByRole('alertdialog', { name: 'Pausar este plano?' });
  await expect(painel).toBeVisible();
  await expect(painel).not.toContainText(/cobranças? abertas?/);
  expect(daOutra.errosDaPagina).toEqual([]);
  expect(errosDaPagina).toEqual([]);
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
  expect(doAluno.pedidos.filter((p) => p.caminho.includes('financeiro'))).toEqual([]);

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
  await expect(treinador.getByRole('heading', { name: 'Financeiro', level: 1 })).toHaveCount(0);
  expect(doTreinador.pedidos.filter((p) => p.caminho.startsWith('/financeiro'))).toEqual([]);
});

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
