import { expect, test, type Page } from '@playwright/test';

import type { CobrancaResponse, ContratacaoResponse } from '../src/api/financeiroTipos';
import type { AlunoResumo } from '../src/api/tipos';
import { ALUNO, erroApi, json, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { fixarHoje, sessaoDeAluno } from './aluno';
import {
  COBRANCA_ATRASADA, estadoFinanceiro, RECEBIMENTO_CONFIGURADO, rotasDoFinanceiro, sessaoComFinanceiro, type EstadoFinanceiro,
} from './financeiro-falso';
import { esperarValorInteiro } from './valor-inteiro';

/**
 * Financeiro, Fase 1 (B2): nova cobrança avulsa em três etapas (alunos, descrição e valor, vencimento e parcelas), a
 * confirmação "Gerar N cobranças?", os erros do servidor, os totais do filtro, as ações novas do lote (cancelar, links e
 * exportar) e a avulsa na lista, na folha e no "Meu plano" do aluno. Relógio em 19/10/2026; só dados fictícios, API simulada.
 */

const CAPTURAS = 'test-results/financeiro-cobranca-avulsa';

const aluno = (n: number, nome: string, ativo = true): AlunoResumo => ({
  id: `a0000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`, nome, ativo, temAcesso: true, planoAtivo: null, ultimoRegistro: null,
});
const ANA = aluno(1, 'Ana Avulsa');
const BRUNO = aluno(2, 'Bruno Avulso');
const CAROL = aluno(3, 'Carolina Teixeira de Albuquerque Avulsa');

const cobranca = (id: string, alunoNome: string, parcial: Partial<CobrancaResponse>): CobrancaResponse => ({
  ...COBRANCA_ATRASADA, id: `c0000000-0000-4000-8000-${id.padStart(12, '0')}`, alunoNome, criadoEm: '2026-09-20T12:00:00Z', ...parcial,
});
// Abertas: duas vencidas (150 + 200) e uma a vencer (100); uma paga (150) e uma cancelada (999, fica fora dos totais).
const BRUNA = cobranca('1', 'Bruna Teste', {});
const CAIO = cobranca('2', 'Caio Teste', { valorCentavos: 20_000, vencimento: '2026-10-10', diasDeAtraso: 9 });
const DORA = cobranca('3', 'Dora Teste', { valorCentavos: 10_000, competencia: '2026-11-05', vencimento: '2026-11-05', vencida: false, diasDeAtraso: null });
const PAGA = cobranca('4', 'Elis Teste', { situacao: 'PAGA', vencida: false, diasDeAtraso: null, pagoEm: '2026-10-12', forma: 'PIX_DIRETO', provedor: 'MANUAL', versao: 1 });
const CANCELADA = cobranca('5', 'Fabi Teste', { situacao: 'CANCELADA', vencida: false, diasDeAtraso: null, valorCentavos: 99_900 });
const AVULSA = cobranca('6', 'Ana Avulsa', {
  tipo: 'AVULSA', contratacaoId: null, planoNome: null, competencia: null, descricao: 'Camiseta do time (Parcela 1/3)',
  vencimento: '2026-11-10', vencida: false, diasDeAtraso: null, valorCentavos: 5_000,
});

const comCobrancas = (parcial: Partial<EstadoFinanceiro> = {}) =>
  estadoFinanceiro({ cobrancas: [BRUNA, CAIO, DORA, PAGA, CANCELADA].map((c) => ({ ...c })), alunos: [ANA, BRUNO, CAROL].map((a) => ({ ...a })), ...parcial });

async function abrir(page: Page, estado: EstadoFinanceiro, extra: RespostasApi = {}) {
  await fixarHoje(page);
  const api = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado), ...extra });
  await page.goto('/treinador/financeiro?aba=cobrancas');
  await expect(page.getByRole('button', { name: 'Nova cobrança avulsa' })).toBeVisible();
  return api;
}

async function semRolagemHorizontal(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra).toBeLessThanOrEqual(0);
}

const folhaDaAvulsa = (page: Page) => page.getByRole('dialog', { name: 'Nova cobrança avulsa' });

/** Preenche as três etapas (Ana e Bruno, R$ 150,00, 31/10/2026 em 3 parcelas) e para na etapa 3, sem revisar. */
async function preencherAteAEtapa3(page: Page) {
  await page.getByRole('button', { name: 'Nova cobrança avulsa' }).click();
  const folha = folhaDaAvulsa(page);
  await folha.getByRole('checkbox', { name: 'Ana Avulsa' }).click();
  await folha.getByRole('checkbox', { name: 'Bruno Avulso' }).click();
  await expect(folha.getByText('2 alunos selecionados')).toBeVisible();
  await folha.getByRole('button', { name: 'Continuar' }).click();
  await folha.getByRole('textbox', { name: 'Descrição' }).fill('Camiseta do time');
  await folha.getByLabel('Valor de cada parcela').pressSequentially('15000');
  await expect(folha.getByLabel('Valor de cada parcela')).toHaveValue('R$ 150,00');
  await folha.getByRole('button', { name: 'Continuar' }).click();
  await folha.getByLabel('Primeiro vencimento').fill('31/10/2026');
  await folha.getByLabel('Parcelas', { exact: true }).fill('3');
  return folha;
}

const ehAvulsa = (p: { metodo: string; caminho: string }) => p.metodo === 'POST' && p.caminho === '/financeiro/cobrancas-avulsas';

test('fluxo feliz: 2 alunos × 3 parcelas, voltar mantém o digitado, "Gerar 6 cobranças?" envia o corpo certo e a lista recarrega', async ({ page }) => {
  const estado = comCobrancas();
  const { pedidos, errosDaPagina } = await abrir(page, estado);
  await page.setViewportSize({ width: 1280, height: 900 });
  const folha = await preencherAteAEtapa3(page);

  // A prévia é a do servidor: o dia 31 fica preso ao fim do mês (30/11) e volta ao 31 em dezembro.
  for (const data of ['31/10/2026', '30/11/2026', '31/12/2026']) await expect(folha.getByText(`Vence em ${data}`)).toBeVisible();
  await expect(folha.getByText('Camiseta do time (Parcela 3/3)')).toBeVisible();
  await expect(folha.getByText('Cada um dos 2 alunos recebe estas 3 cobranças.')).toBeVisible();

  // Voltar duas etapas não perde nada.
  await folha.getByRole('button', { name: 'Voltar' }).click();
  await expect(folha.getByRole('textbox', { name: 'Descrição' })).toHaveValue('Camiseta do time');
  await expect(folha.getByLabel('Valor de cada parcela')).toHaveValue('R$ 150,00');
  await folha.getByRole('button', { name: 'Voltar' }).click();
  await expect(folha.getByRole('checkbox', { name: 'Ana Avulsa' })).toBeChecked();
  await expect(folha.getByRole('button', { name: 'Tirar da seleção: Bruno Avulso' })).toBeVisible();
  await folha.getByRole('button', { name: 'Continuar' }).click();
  await folha.getByRole('button', { name: 'Continuar' }).click();
  await expect(folha.getByLabel('Parcelas', { exact: true })).toHaveValue('3');

  await folha.getByRole('button', { name: 'Revisar e gerar' }).click();
  const confirmar = page.getByRole('alertdialog', { name: 'Gerar 6 cobranças?' });
  await expect(confirmar).toContainText('2 alunos × 3 parcelas de R$ 150,00: total de R$ 900,00.');
  await expect(confirmar).toContainText('O primeiro vencimento é 31/10/2026.');
  expect(pedidos.filter(ehAvulsa)).toHaveLength(0);
  await page.screenshot({ path: `${CAPTURAS}/confirmacao-1280.png` });
  // Clique duplo: um pedido só.
  await confirmar.getByRole('button', { name: 'Gerar 6 cobranças' }).dblclick();

  await expect(page.getByText('6 cobranças geradas para 2 alunos.')).toBeVisible();
  await expect(folhaDaAvulsa(page)).toHaveCount(0);
  expect(estado.avulsasRecebidas).toEqual([
    { alunoIds: [ANA.id, BRUNO.id], descricao: 'Camiseta do time', valorCentavos: 15_000, primeiroVencimento: '2026-10-31', parcelas: 3 },
  ]);
  expect(pedidos.filter(ehAvulsa)).toHaveLength(1);
  // A lista recarregou e mostra as avulsas com a descrição e o selo.
  await expect(page.getByText('Camiseta do time (Parcela 2/3)').first()).toBeVisible();
  await expect(page.getByText('Avulsa', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: `${CAPTURAS}/lista-com-avulsas-1280.png`, fullPage: true });
  expect(errosDaPagina).toEqual([]);
});

test('cada etapa inválida mostra o erro no campo e não avança; nada vai ao servidor', async ({ page }) => {
  const { pedidos, errosDaPagina } = await abrir(page, comCobrancas());
  await page.getByRole('button', { name: 'Nova cobrança avulsa' }).click();
  const folha = folhaDaAvulsa(page);
  await folha.getByRole('button', { name: 'Continuar' }).click();
  await expect(folha.getByText('Escolha ao menos um aluno.')).toBeVisible();
  // O foco vai à busca de alunos, logo acima do erro.
  await expect(folha.getByLabel('Buscar aluno')).toBeFocused();
  await page.screenshot({ path: `${CAPTURAS}/etapa1-erro-1280.png` });

  await folha.getByLabel('Buscar aluno').fill('carolina');
  await expect(folha.getByRole('checkbox', { name: CAROL.nome })).toBeVisible();
  await expect(folha.getByRole('checkbox', { name: 'Ana Avulsa' })).toHaveCount(0);
  await folha.getByRole('checkbox', { name: CAROL.nome }).click();
  await expect(folha.getByText('Escolha ao menos um aluno.')).toHaveCount(0);
  await folha.getByRole('button', { name: 'Continuar' }).click();

  await folha.getByRole('button', { name: 'Continuar' }).click();
  await expect(folha.getByText('Descreva a cobrança.')).toBeVisible();
  await expect(folha.getByText('Informe um valor maior que zero, por exemplo 150,00.')).toBeVisible();
  await expect(folha.getByRole('textbox', { name: 'Descrição' })).toBeFocused();
  await folha.getByRole('textbox', { name: 'Descrição' }).fill('Avaliação extra');
  await folha.getByLabel('Valor de cada parcela').pressSequentially('8000');
  await folha.getByRole('button', { name: 'Continuar' }).click();

  await folha.getByLabel('Parcelas', { exact: true }).fill('13');
  await folha.getByLabel('Primeiro vencimento').fill('01/01/1999');
  await folha.getByRole('button', { name: 'Revisar e gerar' }).click();
  await expect(folha.getByText('As parcelas vão de 1 a 12.')).toBeVisible();
  await expect(folha.getByText(/^Primeiro vencimento: use uma data entre 01\/01\/2000 e/)).toBeVisible();
  // O foco vai ao primeiro campo com erro na ordem da tela: a data vem antes das parcelas.
  await expect(folha.getByLabel('Primeiro vencimento')).toBeFocused();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.screenshot({ path: `${CAPTURAS}/etapa3-erro-1280.png` });
  expect(pedidos.filter(ehAvulsa)).toHaveLength(0);
  expect(errosDaPagina).toEqual([]);
});

test('erro 422 do servidor volta à etapa do campo com a mensagem dele; 409 aluno inativo volta aos alunos e busca a lista de novo', async ({ page }) => {
  const estado = comCobrancas();
  const criar = rotasDoFinanceiro(estado)['POST /financeiro/cobrancas-avulsas'];
  let respostas = 0;
  const { pedidos, errosDaPagina } = await abrir(page, estado, {
    'POST /financeiro/cobrancas-avulsas': (p, route) => {
      respostas += 1;
      if (respostas === 1) {
        return json(route, erroApi(422, 'Confira os dados da cobrança avulsa.', 'COBRANCA_AVULSA_INVALIDA',
          [{ field: 'descricao', message: 'A descrição não pode ter só símbolos.' }]).corpo, 422);
      }
      return typeof criar === 'function' ? criar(p, route) : undefined;
    },
  });
  const folha = await preencherAteAEtapa3(page);
  await folha.getByRole('button', { name: 'Revisar e gerar' }).click();
  await page.getByRole('alertdialog', { name: 'Gerar 6 cobranças?' }).getByRole('button', { name: 'Gerar 6 cobranças' }).click();

  // 422: a etapa 2 de volta, o aviso no topo e a mensagem do servidor no campo (sai quando o campo muda).
  await expect(folha.getByText('Confira os campos destacados.')).toBeVisible();
  await expect(folha.getByText('A descrição não pode ter só símbolos.')).toBeVisible();
  await expect(folha.getByRole('textbox', { name: 'Descrição' })).toHaveValue('Camiseta do time');
  await page.screenshot({ path: `${CAPTURAS}/erro-422-1280.png` });
  await folha.getByRole('textbox', { name: 'Descrição' }).fill('Camiseta oficial');
  await expect(folha.getByText('A descrição não pode ter só símbolos.')).toHaveCount(0);
  await folha.getByRole('button', { name: 'Continuar' }).click();

  // 409: o Bruno foi inativado enquanto a folha estava aberta.
  estado.alunos[1].ativo = false;
  const buscasAntes = pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/alunos').length;
  await folha.getByRole('button', { name: 'Revisar e gerar' }).click();
  await page.getByRole('alertdialog', { name: 'Gerar 6 cobranças?' }).getByRole('button', { name: 'Gerar 6 cobranças' }).click();
  await expect(folha.getByText('Algum aluno da seleção está inativo. Nenhuma cobrança foi gerada. Tire-o da seleção ou reative-o.')).toBeVisible();
  await expect(folha.getByText('2 alunos selecionados')).toBeVisible();
  await expect.poll(() => pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/alunos').length).toBeGreaterThan(buscasAntes);
  await expect(folha.getByRole('checkbox', { name: 'Bruno Avulso' })).toHaveCount(0);
  expect(estado.cobrancas.filter((c) => c.tipo === 'AVULSA')).toHaveLength(0);
  // A API não diz qual aluno: a folha busca os ativos inteiros (páginas de 100) e marca quem saiu, primeiro na lista.
  const remover = folha.getByRole('button', { name: 'Remover os que não estão ativos (1)' });
  await expect(remover).toBeVisible();
  await expect(folha.getByText('Bruno Avulso não está mais entre os ativos (inativo, anonimizado ou excluído).')).toBeVisible();
  const linhas = folha.getByRole('list', { name: 'Alunos selecionados' }).getByRole('listitem');
  await expect(linhas.first()).toContainText('Bruno Avulso');
  await expect(linhas.first()).toContainText('Não está ativo');
  await expect(linhas.nth(1)).not.toContainText('Não está ativo');
  expect(pedidos.some((p) => p.metodo === 'GET' && p.caminho === '/alunos' && p.busca.get('tamanho') === '100')).toBe(true);
  await page.screenshot({ path: `${CAPTURAS}/erro-409-1280.png` });
  await remover.click();
  await expect(folha.getByText('1 aluno selecionado', { exact: true })).toBeVisible();
  await expect(folha.getByRole('button', { name: /Remover os que não estão ativos/ })).toHaveCount(0);
  await expect(folha.getByText(/Algum aluno da seleção está inativo/)).toHaveCount(0);
  await folha.getByRole('button', { name: 'Continuar' }).click();
  await folha.getByRole('button', { name: 'Continuar' }).click();
  await folha.getByRole('button', { name: 'Revisar e gerar' }).click();
  await page.getByRole('alertdialog', { name: 'Gerar 3 cobranças?' }).getByRole('button', { name: 'Gerar 3 cobranças' }).click();
  await expect(page.getByText('3 cobranças geradas para 1 aluno.')).toBeVisible();
  expect(estado.avulsasRecebidas.at(-1)?.alunoIds).toEqual([ANA.id]);
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [1280, 390]) {
  test(`sem conexão em ${largura}px: o principal deixa de ser "Gerar" e vira "Conferir a lista", que fecha e recarrega`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, errosDaPagina } = await abrir(page, comCobrancas(), {
      'POST /financeiro/cobrancas-avulsas': (_p, route) => route.abort('internetdisconnected'),
    });
    const folha = await preencherAteAEtapa3(page);
    await folha.getByRole('button', { name: 'Revisar e gerar' }).click();
    await page.getByRole('alertdialog', { name: 'Gerar 6 cobranças?' }).getByRole('button', { name: 'Gerar 6 cobranças' }).click();
    const conferir = page.getByRole('alertdialog', { name: 'Confira a lista de cobranças' });
    await expect(conferir.getByText(/Confira a lista de cobranças antes de gerar de novo: repetir pode criar tudo em dobro\./)).toBeVisible();
    await expect(conferir.getByRole('button', { name: /^Gerar/ })).toHaveCount(0);
    await expect(conferir.getByRole('button', { name: 'Conferir a lista' })).toBeEnabled();
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/sem-conexao-${largura}.png` });

    // Voltar e revisar de novo não traz o "Gerar" de volta.
    await conferir.getByRole('button', { name: 'Voltar' }).click();
    await folha.getByRole('button', { name: 'Revisar e gerar' }).click();
    const deNovo = page.getByRole('alertdialog', { name: 'Confira a lista de cobranças' });
    await expect(deNovo.getByRole('button', { name: /^Gerar/ })).toHaveCount(0);
    const listasAntes = pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/financeiro/cobrancas').length;
    await deNovo.getByRole('button', { name: 'Conferir a lista' }).click();
    await expect(folhaDaAvulsa(page)).toHaveCount(0);
    await expect.poll(() => pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/financeiro/cobrancas').length).toBeGreaterThan(listasAntes);
    expect(pedidos.filter(ehAvulsa)).toHaveLength(1);
    expect(errosDaPagina.filter((e) => !/internet|Failed to fetch/i.test(e))).toEqual([]);
  });
}

test('totais do filtro: total, pago, em aberto e vencido do servidor; mudam com o filtro; sem lista, sem totais', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, comCobrancas());
  await page.setViewportSize({ width: 1280, height: 900 });
  const totais = (rotulo: string, valor: string) => page.getByLabel(new RegExp(`^${rotulo}: R\\$\\s${valor.replace('.', '\\.')}`));
  await expect(totais('Total', '600,00')).toBeVisible();
  await expect(totais('Pago', '150,00')).toBeVisible();
  await expect(totais('Em aberto', '450,00')).toBeVisible();
  await expect(totais('Vencido', '350,00')).toBeVisible();
  await expect(page.getByText(/Em aberto inclui as vencidas/)).toBeVisible();
  await expect(page.getByText(/Contestadas entram no total, mas não em pago nem em aberto\./)).toBeVisible();
  await esperarValorInteiro(totais('Total', '600,00'), ['R$ 600,00']);
  await page.screenshot({ path: `${CAPTURAS}/totais-1280.png`, fullPage: true });

  // Só as pagas: o em aberto e o vencido vão a zero (nunca some o número).
  await page.getByRole('button', { name: /^Filtros/ }).click();
  const painel = page.getByRole('dialog', { name: 'Filtros de cobranças' });
  await painel.getByRole('button', { name: 'Situação: Todas. Escolher.' }).click();
  await page.getByRole('dialog', { name: 'Situação' }).getByRole('checkbox', { name: 'Pagas', exact: true }).click();
  await page.keyboard.press('Escape');
  await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(totais('Total', '150,00')).toBeVisible();
  await expect(totais('Em aberto', '0,00')).toBeVisible();
  await expect(totais('Vencido', '0,00')).toBeVisible();
  expect(errosDaPagina).toEqual([]);

  // A lista falhou: a mensagem de erro, e nenhum total inventado.
  const falha = await page.context().newPage();
  await fixarHoje(falha);
  const api = await simularApi(falha, {
    ...(await sessaoComFinanceiro(falha)), ...rotasDoFinanceiro(comCobrancas()),
    'GET /financeiro/cobrancas': erroApi(500, 'Erro inesperado.', 'ERRO_INESPERADO'),
  });
  await falha.goto('/treinador/financeiro?aba=cobrancas');
  await expect(falha.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  await expect(falha.getByText('Totais', { exact: true })).toHaveCount(0);
  await expect(falha.getByText('R$ 0,00')).toHaveCount(0);
  await falha.screenshot({ path: `${CAPTURAS}/totais-erro-1280.png`, fullPage: true });
  expect(api.errosDaPagina.filter((e) => !/500/.test(e))).toEqual([]);
});

test('totais grandes em 390px: lista de rótulo e valor, cada valor inteiro numa linha, sem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const grande = cobranca('7', 'Gil Teste', { valorCentavos: 123_456_700 });
  const { errosDaPagina } = await abrir(page, estadoFinanceiro({ cobrancas: [grande, { ...PAGA, valorCentavos: 99_999_900 }] }));
  const total = page.getByLabel(/^Total: R\$\s2\.234\.566,00/);
  await expect(total).toBeVisible();
  await esperarValorInteiro(total, ['R$ 2.234.566,00']);
  await esperarValorInteiro(page.getByLabel(/^Vencido: R\$\s1\.234\.567,00/), ['R$ 1.234.567,00']);
  await semRolagemHorizontal(page);
  await page.screenshot({ path: `${CAPTURAS}/totais-grandes-390.png` });
  expect(errosDaPagina).toEqual([]);
});

test('cancelar em lote: confirmação destrutiva com motivo opcional, resultado por item e a lista recarregada', async ({ page }) => {
  const estado = comCobrancas();
  const { pedidos, errosDaPagina } = await abrir(page, estado);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('checkbox', { name: /^Selecionar cobrança de Bruna/ }).click();
  await page.getByRole('checkbox', { name: /^Selecionar cobrança de Caio/ }).click();
  await page.getByRole('button', { name: 'Mais ações' }).click();
  const menu = page.getByRole('dialog', { name: 'Ações com 2 cobranças' });
  await page.screenshot({ path: `${CAPTURAS}/menu-do-lote-1280.png` });
  await menu.getByRole('button', { name: /Cancelar cobranças/ }).click();
  const confirmar = page.getByRole('alertdialog', { name: 'Cancelar 2 cobranças?' });
  await expect(confirmar).toContainText('Não tem volta');
  await expect(confirmar).toContainText('R$ 350,00');
  await confirmar.getByLabel('Motivo (opcional)').fill('Lançadas em dobro');
  await page.screenshot({ path: `${CAPTURAS}/cancelar-confirmacao-1280.png` });
  await confirmar.getByRole('button', { name: 'Cancelar 2 cobranças' }).click();

  const resultado = page.getByRole('dialog', { name: 'Resultado do cancelamento' });
  await expect(resultado.getByText('2 cobranças canceladas.')).toBeVisible();
  const envio = pedidos.find((p) => p.metodo === 'POST' && p.caminho === '/cobrancas/cancelar-em-lote');
  expect(envio?.corpo).toEqual({ itens: [BRUNA, CAIO].map((c) => ({ cobrancaId: c.id, versao: c.versao })), motivo: 'Lançadas em dobro' });
  await resultado.getByRole('button', { name: 'Fechar' }).last().click();
  await expect(page.getByRole('checkbox', { name: /^Selecionar cobrança de (Bruna|Caio)/ })).toHaveCount(0);
  await expect(page.getByText(/cobranças? selecionadas?/)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('gerar links em lote com falha parcial: diz quantos deram certo, o motivo da que falhou e copia os links', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const estado = comCobrancas({ recebimento: { ...RECEBIMENTO_CONFIGURADO }, recusasDoLote: { [CAIO.id]: 'PROVEDOR_INDISPONIVEL' } });
  const { pedidos, errosDaPagina } = await abrir(page, estado);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: 'Selecionar todas desta página' }).click();
  await page.getByRole('button', { name: 'Mais ações' }).click();
  await page.getByRole('dialog', { name: 'Ações com 3 cobranças' }).getByRole('button', { name: /Gerar links de pagamento/ }).click();

  const resultado = page.getByRole('dialog', { name: 'Links de pagamento' });
  await expect(resultado.getByText('2 de 3 links gerados. 1 não foi gerado: veja o motivo abaixo.')).toBeVisible();
  await expect(resultado.getByText('Sem link: A InfinitePay não respondeu. Tente de novo.')).toBeVisible();
  await expect(resultado.getByText(/^https:\/\/pagamento\.exemplo\.invalid\/abc-/)).toHaveCount(2);
  await page.screenshot({ path: `${CAPTURAS}/links-parcial-1280.png` });
  await resultado.getByRole('button', { name: 'Copiar os 2 links' }).click();
  await expect(page.getByText('Links copiados, um por linha.')).toBeVisible();
  const copiado = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiado.split('\n')).toHaveLength(2);
  await resultado.getByRole('button', { name: 'Copiar link de Bruna Teste' }).click();
  await expect(page.getByText('Link copiado.')).toBeVisible();

  // A InfinitePay voltou: "Tentar de novo" manda só a que falhou e o resultado entra no lugar dela.
  estado.recusasDoLote = {};
  await resultado.getByRole('button', { name: 'Tentar de novo a que falhou' }).click();
  await expect(resultado.getByText('3 links gerados.')).toBeVisible();
  await expect(resultado.getByText(/^https:\/\/pagamento\.exemplo\.invalid\/abc-/)).toHaveCount(3);
  await expect(resultado.getByRole('button', { name: /Tentar de novo/ })).toHaveCount(0);
  const tentativas = pedidos.filter((p) => p.metodo === 'POST' && p.caminho === '/cobrancas/link-em-lote');
  expect(tentativas).toHaveLength(2);
  expect(tentativas[1].corpo).toEqual({ cobrancaIds: [CAIO.id] });
  await page.screenshot({ path: `${CAPTURAS}/links-tentar-de-novo-1280.png` });
  expect(errosDaPagina).toEqual([]);
});

test('sem recebimento online na plataforma não há "Gerar links"; exportar as selecionadas baixa o CSV delas', async ({ page }) => {
  await fixarHoje(page);
  const estado = comCobrancas();
  const { pedidos, errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page, undefined, false)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=cobrancas');
  await page.getByRole('checkbox', { name: /^Selecionar cobrança de Bruna/ }).click();
  await page.getByRole('checkbox', { name: /^Selecionar cobrança de Dora/ }).click();
  await page.getByRole('button', { name: 'Mais ações' }).click();
  const menu = page.getByRole('dialog', { name: 'Ações com 2 cobranças' });
  await expect(menu.getByRole('button', { name: /Gerar links de pagamento/ })).toHaveCount(0);
  const baixando = page.waitForEvent('download');
  await menu.getByRole('button', { name: /Exportar selecionadas/ }).click();
  const arquivo = await baixando;
  expect(arquivo.suggestedFilename()).toBe('financeiro-selecionadas-2026-10-19.csv');
  await expect(page.getByText('2 cobranças exportadas.')).toBeVisible();
  const envio = pedidos.find((p) => p.metodo === 'POST' && p.caminho === '/financeiro/exportacao/selecionadas');
  expect(envio?.corpo).toEqual({ cobrancaIds: [BRUNA.id, DORA.id] });
  // Exportar não mexe na seleção.
  await expect(page.getByText('2 cobranças selecionadas')).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [1280, 390]) {
  test(`a avulsa na lista, na folha e no lote em ${largura}px: selo, descrição e nenhum "—" de competência`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrir(page, estadoFinanceiro({ cobrancas: [{ ...AVULSA }, { ...BRUNA }], alunos: [ANA] }));
    await expect(page.getByText('Camiseta do time (Parcela 1/3)').first()).toBeVisible();
    await expect(page.getByText('Avulsa', { exact: true }).first()).toBeVisible();
    if (largura === 1280) await expect(page.getByText('Não se aplica')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Selecionar cobrança de Ana Avulsa, Camiseta do time (Parcela 1/3)' })).toBeVisible();
    await semRolagemHorizontal(page);
    // A página rola por dentro: a captura vai até a linha da avulsa (no celular, o cartão; no PC, a linha da tabela).
    await page.getByText('Camiseta do time (Parcela 1/3)').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURAS}/lista-avulsa-${largura}.png` });

    await page.getByRole('button', { name: 'Abrir cobrança avulsa de Ana Avulsa' }).click();
    const folha = page.getByRole('dialog', { name: 'Cobrança avulsa' });
    await expect(folha.getByText('Camiseta do time (Parcela 1/3)')).toBeVisible();
    await expect(folha.getByText('Competência', { exact: true })).toHaveCount(0);
    await expect(folha.getByRole('button', { name: /Pausar|Encerrar/ })).toHaveCount(0);
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/folha-avulsa-${largura}.png`, fullPage: true });
    expect(errosDaPagina).toEqual([]);
  });
}

test('o aluno vê a descrição da avulsa no "Meu plano", nunca o mês nem "—"', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await fixarHoje(page);
  const contratacao: ContratacaoResponse = {
    id: 'e0000000-0000-4000-8000-0000000000cc', alunoId: ALUNO.id, planoComercialId: 'b0000000-0000-4000-8000-0000000000f1', planoNome: 'Consultoria mensal',
    periodicidade: 'MENSAL', valorCentavos: 15_000, motivoValor: null, inicio: '2026-10-05', diaVencimento: 5, situacao: 'ATIVA', encerradaEm: null,
    criadoEm: '2026-10-01T12:00:00Z', versao: 0, minimoAte: null,
  };
  const estado = estadoFinanceiro({ contratacoes: [contratacao], cobrancas: [{ ...AVULSA }] });
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessaoDeAluno(page)), ...(await sessao(page, ALUNO, { pagamentosHabilitados: true })), ...rotasDoFinanceiro(estado),
  });
  await page.goto('/aluno/conta');
  await expect(page.getByText('Camiseta do time (Parcela 1/3)')).toBeVisible();
  await expect(page.getByText('Avulsa', { exact: true })).toBeVisible();
  await semRolagemHorizontal(page);
  await page.getByText('Camiseta do time (Parcela 1/3)').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${CAPTURAS}/aluno-meu-plano-390.png` });
  expect(errosDaPagina).toEqual([]);
});

const TEMAS = [
  { nome: 'claro', preferencias: { tema: 'CLARO' } },
  { nome: 'escuro', preferencias: { tema: 'ESCURO' } },
  { nome: 'areia', preferencias: { tema: 'AREIA' } },
] as const;

for (const { nome, preferencias } of TEMAS) for (const largura of [1280, 390]) {
  test(`tema ${nome} em ${largura}px: totais, as três etapas e a confirmação, sem rolagem horizontal`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.addInitScript(([id, p]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(p)), [TREINADOR.id, preferencias] as const);
    const { errosDaPagina } = await abrir(page, comCobrancas({ alunos: [ANA, BRUNO, CAROL] }));
    await expect(page.getByText(/Em aberto inclui as vencidas/)).toBeVisible();
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/${nome}-totais-${largura}.png`, fullPage: true });

    await page.getByRole('button', { name: 'Nova cobrança avulsa' }).click();
    const folha = folhaDaAvulsa(page);
    await folha.getByRole('checkbox', { name: 'Ana Avulsa' }).click();
    await folha.getByRole('checkbox', { name: CAROL.nome }).click();
    await page.screenshot({ path: `${CAPTURAS}/${nome}-etapa1-${largura}.png` });
    await folha.getByRole('button', { name: 'Continuar' }).click();
    await folha.getByRole('button', { name: 'Continuar' }).click();
    await page.screenshot({ path: `${CAPTURAS}/${nome}-etapa2-erro-${largura}.png` });
    await folha.getByRole('textbox', { name: 'Descrição' }).fill('Camiseta do time');
    await folha.getByLabel('Valor de cada parcela').pressSequentially('15000');
    await folha.getByRole('button', { name: 'Continuar' }).click();
    await folha.getByLabel('Primeiro vencimento').fill('31/10/2026');
    await folha.getByLabel('Parcelas', { exact: true }).fill('3');
    await page.screenshot({ path: `${CAPTURAS}/${nome}-etapa3-${largura}.png` });
    await semRolagemHorizontal(page);
    await folha.getByRole('button', { name: 'Revisar e gerar' }).click();
    await expect(page.getByRole('alertdialog', { name: 'Gerar 6 cobranças?' })).toBeVisible();
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/${nome}-confirmacao-${largura}.png` });
    expect(errosDaPagina).toEqual([]);
  });
}
