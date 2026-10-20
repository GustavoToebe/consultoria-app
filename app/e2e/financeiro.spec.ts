import { expect, test, type Page } from '@playwright/test';

import type { AlunoDetalhe } from '../src/api/tipos';
import { ALUNO, sessao, simularApi, TREINADOR } from './api-falsa';
import { fixarHoje, sessaoDeAluno } from './aluno';
import {
  ALUNO_FINANCEIRO_ID, COBRANCA_ATRASADA, estadoFinanceiro, INADIMPLENTE, PAINEL_COM_DADOS, PAINEL_VAZIO, rotasDoFinanceiro,
  sessaoComFinanceiro,
} from './financeiro-falso';

/**
 * Pagamentos do aluno ao treinador: painel (com dados e vazio), filtro "Meus", lançamento de saída, baixa pela lista de
 * inadimplentes, o fluxo completo (plano → contratação na ficha → baixa manual → o aluno vê a cobrança paga em Conta) e
 * o módulo desligado. O relógio fica em 19/10/2026. Só dados fictícios; a API é simulada em `financeiro-falso.ts`.
 */

const FICHA: AlunoDetalhe = {
  id: ALUNO_FINANCEIRO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null, cpf: null, endereco: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
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

  // Inadimplentes: quem, quanto e há quantos dias. O aluno não paga por aqui.
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
  await expect(aluno.getByRole('button', { name: /pagar/i })).toHaveCount(0);
  expect(doAluno.errosDaPagina).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('aluno com cobrança vencida: "Pagamento em aberto" nas pendências do Início, sem botão de pagar', async ({ page }) => {
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
