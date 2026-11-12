import { expect, test, type Page } from '@playwright/test';

import type { CobrancaResponse } from '../src/api/financeiroTipos';
import { simularApi, TREINADOR } from './api-falsa';
import { fixarHoje } from './aluno';
import { COBRANCA_ATRASADA, estadoFinanceiro, rotasDoFinanceiro, sessaoComFinanceiro, type EstadoFinanceiro } from './financeiro-falso';

/**
 * Lançamentos (máscara do valor, Entrada/Saída em texto), filtros combinados das cobranças, a lista com ID, emissão e
 * pagamento, e o registro de pagamentos em lote: seleção só das em aberto, revisão obrigatória, falha parcial que nunca
 * vira sucesso e nova tentativa só das que falharam. Relógio em 19/10/2026; só dados fictícios, API simulada.
 */

const CAPTURAS = 'test-results/financeiro-cobrancas-lote';

const cobranca = (id: string, alunoNome: string, parcial: Partial<CobrancaResponse>): CobrancaResponse => ({
  ...COBRANCA_ATRASADA, id: `c0000000-0000-4000-8000-${id.padStart(12, '0')}`, alunoNome, criadoEm: '2026-09-20T12:00:00Z', ...parcial,
});

const BRUNA = cobranca('1', 'Bruna Teste', { alunoCpf: '123.456.789-09' });
const CAIO = cobranca('2', 'Caio Teste', { valorCentavos: 20_000, vencimento: '2026-10-10', diasDeAtraso: 9 });
const DORA = cobranca('3', 'Dora Teste', { valorCentavos: 10_000, competencia: '2026-11-05', vencimento: '2026-11-05', vencida: false, diasDeAtraso: null });
const PAGA = cobranca('4', 'Elis Teste', {
  situacao: 'PAGA', vencida: false, diasDeAtraso: null, pagoEm: '2026-10-12', forma: 'PIX_DIRETO', provedor: 'MANUAL', versao: 1,
  criadoEm: '2026-10-01T12:00:00Z',
});

const estadoComCobrancas = (parcial: Partial<EstadoFinanceiro> = {}) =>
  estadoFinanceiro({ cobrancas: [BRUNA, CAIO, DORA, PAGA].map((c) => ({ ...c })), ...parcial });

async function abrir(page: Page, estado: EstadoFinanceiro, aba = 'cobrancas') {
  await fixarHoje(page);
  const api = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto(`/treinador/financeiro?aba=${aba}`);
  return api;
}

async function semRolagemHorizontal(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra).toBeLessThanOrEqual(0);
}

test('lançamento: o valor ganha a máscara enquanto digita e a lista diz Entrada ou Saída em texto, com o sinal', async ({ page }) => {
  const { pedidos, errosDaPagina } = await abrir(page, estadoFinanceiro(), 'lancamentos');
  await page.getByRole('button', { name: 'Novo lançamento' }).click();
  const folha = page.getByRole('dialog');
  await folha.getByLabel('Descrição').fill('Aluguel da sala');
  const valor = folha.getByLabel('Valor', { exact: true });
  await valor.pressSequentially('35000');
  await expect(valor).toHaveValue('R$ 350,00');
  await valor.press('Backspace');
  await expect(valor).toHaveValue('R$ 35,00');
  await valor.pressSequentially('0');
  await folha.getByRole('radiogroup', { name: 'Tipo' }).getByRole('radio', { name: 'Saída', exact: true }).click();
  await folha.getByRole('button', { name: 'Registrar lançamento' }).click();

  await expect(page.getByText('Lançamento registrado.')).toBeVisible();
  const envio = pedidos.find((p) => p.metodo === 'POST' && p.caminho === '/financeiro/lancamentos');
  expect(envio?.corpo).toMatchObject({ valorCentavos: 35_000, tipo: 'SAIDA' });
  await expect(page.getByText('Saída', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('−R$ 350,00').first()).toBeVisible();
  await page.screenshot({ path: `${CAPTURAS}/lancamentos-1280.png`, fullPage: true });
  expect(errosDaPagina).toEqual([]);
});

test('cobranças: situação, emissão e pagamento combinados vão juntos ao endereço e à API, e a lista mostra ID, CPF mascarado, emissão e pagamento', async ({ page }) => {
  const { pedidos, errosDaPagina } = await abrir(page, estadoComCobrancas());
  await page.setViewportSize({ width: 1440, height: 900 });

  // Colunas novas: ID curto, CPF mascarado (nunca o completo), emissão e a data da baixa com a forma.
  await expect(page.getByRole('columnheader', { name: 'ID' })).toBeVisible();
  await expect(page.getByText('00000001', { exact: true })).toBeVisible();
  await expect(page.getByText('CPF ***.456.789-**')).toBeVisible();
  await expect(page.getByText('123.456.789-09')).toHaveCount(0);
  await expect(page.getByText('12/10/2026', { exact: true })).toBeVisible();

  // Em 1440 o painel abre na própria página, sem folha.
  await page.getByRole('button', { name: /^Filtros/ }).click();
  const painel = page.locator('body');
  await painel.getByRole('button', { name: 'Situação: Todas. Escolher.' }).click();
  await page.getByRole('dialog', { name: 'Situação' }).getByRole('checkbox', { name: 'Pagas', exact: true }).click();
  await page.keyboard.press('Escape');
  const emissao = painel.getByRole('group', { name: 'Emissão' });
  await emissao.getByRole('textbox', { name: 'De' }).fill('01/10/2026');
  await emissao.getByRole('textbox', { name: 'Até' }).fill('19/10/2026');
  await painel.getByRole('group', { name: 'Pagamento' }).getByRole('textbox', { name: 'De' }).fill('10/10/2026');
  // No computador cada escolha já vale (como os outros filtros da tela); no celular é o "Ver cobranças" da folha.

  await expect(page).toHaveURL(/situacao=PAGA/);
  await expect(page).toHaveURL(/emissaoDe=2026-10-01/);
  await expect(page).toHaveURL(/pagoDe=2026-10-10/);
  const ultimo = pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/financeiro/cobrancas').at(-1);
  expect(ultimo?.busca.get('situacao')).toBe('PAGA');
  expect(ultimo?.busca.get('emissaoDe')).toBe('2026-10-01');
  expect(ultimo?.busca.get('emissaoAte')).toBe('2026-10-19');
  expect(ultimo?.busca.get('pagoDe')).toBe('2026-10-10');
  // O CPF nunca vai no endereço nem num pedido.
  expect(pedidos.some((p) => `${p.caminho}?${p.busca}`.includes('456'))).toBe(false);

  await expect(page.getByRole('button', { name: /^Abrir cobrança de/ })).toHaveCount(1);
  await expect(page.getByText('Elis Teste').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Emissão: / })).toBeVisible();
  await expect(page.getByRole('button', { name: /Pagamento: / })).toBeVisible();
  await page.screenshot({ path: `${CAPTURAS}/filtros-combinados-1440.png`, fullPage: true });
  expect(errosDaPagina).toEqual([]);
});

test('lote com falha parcial: só as em aberto se marcam, a revisão mostra itens e total, o resultado diz o que falhou e a nova tentativa manda só as falhas', async ({ page }) => {
  const estado = estadoComCobrancas({
    recusasDoLote: { [CAIO.id]: 'CONFLITO_EDICAO', [DORA.id]: 'CONFLITO_EDICAO' },
  });
  const { errosDaPagina } = await abrir(page, estado);
  await page.setViewportSize({ width: 1280, height: 900 });

  // Paga não tem caixa; as três em aberto (vencidas incluídas) têm.
  await expect(page.getByRole('checkbox', { name: /^Selecionar cobrança de/ })).toHaveCount(3);
  await expect(page.getByRole('checkbox', { name: /^Selecionar cobrança de Elis/ })).toHaveCount(0);
  await expect(page.getByText('Registrar vários pagamentos')).toBeVisible();

  await page.getByRole('checkbox', { name: /^Selecionar cobrança de Bruna/ }).click();
  await expect(page.getByText('1 cobrança selecionada')).toBeVisible();
  await page.getByRole('button', { name: 'Selecionar todas desta página' }).click();
  await expect(page.getByText('3 cobranças selecionadas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Desmarcar as desta página' })).toBeVisible();
  await page.screenshot({ path: `${CAPTURAS}/selecao-1280.png`, fullPage: true });

  // Revisão obrigatória: itens, total e os campos; nada sai antes da confirmação.
  await page.getByRole('button', { name: 'Revisar pagamentos' }).click();
  const folha = page.getByRole('dialog', { name: 'Revisar pagamentos' });
  await expect(folha.getByText('Bruna Teste')).toBeVisible();
  await expect(folha.getByText('Caio Teste')).toBeVisible();
  await expect(folha.getByText('Dora Teste')).toBeVisible();
  await expect(folha.getByText('R$ 450,00')).toBeVisible();
  await expect(folha.getByLabel('Data do pagamento')).toHaveValue('19/10/2026');
  await page.screenshot({ path: `${CAPTURAS}/revisao-1280.png` });
  await folha.getByRole('button', { name: 'Registrar 3 pagamentos' }).click();
  expect(estado.lotesRecebidos).toHaveLength(0);
  const confirmar = page.getByRole('alertdialog', { name: 'Registrar 3 pagamentos?' });
  await expect(confirmar).toContainText('R$ 450,00');
  await confirmar.getByRole('button', { name: 'Registrar 3 pagamentos' }).click();

  // Falha parcial: atenção, nunca sucesso; cada item diz se foi e por quê.
  const resultado = page.getByRole('dialog', { name: 'Resultado do registro' });
  await expect(resultado.getByText('1 de 3 registrados. 2 não foram registrados: veja o motivo abaixo.')).toBeVisible();
  await expect(resultado.getByText('Registrado', { exact: true })).toHaveCount(1);
  await expect(resultado.getByText('Não registrado: A cobrança foi alterada por outra pessoa ou aba.')).toHaveCount(2);
  await expect(resultado.getByText(/pagamentos registrados\.$/)).toHaveCount(0);
  await page.screenshot({ path: `${CAPTURAS}/falha-parcial-1280.png` });
  expect(estado.lotesRecebidos[0]).toEqual({
    itens: [BRUNA, CAIO, DORA].map((c) => ({ cobrancaId: c.id, versao: c.versao })), data: '2026-10-19', forma: 'PIX_DIRETO', observacao: null,
  });
  expect(estado.lotesRecebidos.some((l) => JSON.stringify(l).includes('valorCentavos'))).toBe(false);

  // Nova tentativa: relê as que falharam, volta à revisão só com elas e manda só elas.
  estado.recusasDoLote = {};
  await resultado.getByRole('button', { name: 'Tentar de novo as 2 que falharam' }).click();
  const deNovo = page.getByRole('dialog', { name: 'Revisar pagamentos' });
  await expect(deNovo.getByText('Bruna Teste')).toHaveCount(0);
  await expect(deNovo.getByText('R$ 300,00')).toBeVisible();
  await deNovo.getByRole('button', { name: 'Registrar 2 pagamentos' }).click();
  await page.getByRole('alertdialog', { name: 'Registrar 2 pagamentos?' }).getByRole('button', { name: 'Registrar 2 pagamentos' }).click();
  await expect(page.getByRole('dialog', { name: 'Resultado do registro' }).getByText('2 pagamentos registrados.')).toBeVisible();
  expect((estado.lotesRecebidos[1] as { itens: { cobrancaId: string }[] }).itens.map((i) => i.cobrancaId)).toEqual([CAIO.id, DORA.id]);

  // Fechar: a lista recarrega, nenhuma em aberto sobrou e a seleção esvaziou.
  await page.getByRole('dialog', { name: 'Resultado do registro' }).getByRole('button', { name: 'Fechar' }).last().click();
  await expect(page.getByRole('checkbox', { name: /^Selecionar cobrança de/ })).toHaveCount(0);
  await expect(page.getByText(/cobranças? selecionadas?/)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('lote: tirar da revisão atualiza o total; sem permissão de alterar não há caixa nem barra', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, estadoComCobrancas());
  await page.getByRole('button', { name: 'Selecionar todas desta página' }).click();
  await page.getByRole('button', { name: 'Revisar pagamentos' }).click();
  const folha = page.getByRole('dialog', { name: 'Revisar pagamentos' });
  await folha.getByRole('button', { name: /^Tirar do lote: Caio/ }).click();
  await expect(folha.getByText('R$ 250,00')).toBeVisible();
  await expect(folha.getByRole('button', { name: 'Registrar 2 pagamentos' })).toBeVisible();
  await folha.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.getByText('2 cobranças selecionadas')).toBeVisible();
  expect(errosDaPagina).toEqual([]);

  const leitura = await page.context().newPage();
  await fixarHoje(leitura);
  const api = await simularApi(leitura, { ...(await sessaoComFinanceiro(leitura, ['FINANCEIRO_LER'])), ...rotasDoFinanceiro(estadoComCobrancas()) });
  await leitura.goto('/treinador/financeiro?aba=cobrancas');
  await expect(leitura.getByRole('button', { name: /^Abrir cobrança de/ }).first()).toBeVisible();
  await expect(leitura.getByRole('checkbox', { name: /^Selecionar cobrança de/ })).toHaveCount(0);
  await expect(leitura.getByText('Registrar vários pagamentos')).toHaveCount(0);
  expect(api.errosDaPagina).toEqual([]);
});

for (const largura of [1280, 1440, 1920, 390]) {
  test(`cobranças com seleção em ${largura}px: sem rolagem horizontal, caixa fora do toque da linha`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrir(page, estadoComCobrancas());
    await expect(page.getByRole('checkbox', { name: /^Selecionar cobrança de/ })).toHaveCount(3);
    await page.getByRole('checkbox', { name: /^Selecionar cobrança de Caio/ }).click();
    await expect(page.getByText('1 cobrança selecionada')).toBeVisible();
    // Marcar não abre a cobrança.
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/lista-${largura}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Revisar pagamentos' }).click();
    await expect(page.getByRole('dialog', { name: 'Revisar pagamentos' }).getByText('Caio Teste')).toBeVisible();
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/revisao-${largura}.png` });
    expect(errosDaPagina).toEqual([]);
  });
}

const TEMAS = [
  { nome: 'escuro', preferencias: { tema: 'ESCURO' } },
  { nome: 'areia', preferencias: { tema: 'AREIA' } },
  { nome: 'contraste-alto', preferencias: { tema: 'CLARO', contraste: 'ALTO' } },
] as const;

for (const { nome, preferencias } of TEMAS) for (const largura of [1280, 390]) {
  test(`tema ${nome} em ${largura}px: lista com seleção, resultado parcial e a folha da cobrança, sem rolagem horizontal`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.addInitScript(([id, p]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(p)), [TREINADOR.id, preferencias] as const);
    const estado = estadoComCobrancas({ recusasDoLote: { [DORA.id]: 'COBRANCA_NAO_ABERTA' } });
    const { errosDaPagina } = await abrir(page, estado);
    await page.getByRole('button', { name: 'Selecionar todas desta página' }).click();
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/${nome}-lista-${largura}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Revisar pagamentos' }).click();
    await page.getByRole('dialog', { name: 'Revisar pagamentos' }).getByRole('button', { name: 'Registrar 3 pagamentos' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Registrar 3 pagamentos' }).click();
    const resultado = page.getByRole('dialog', { name: 'Resultado do registro' });
    await expect(resultado.getByText('2 de 3 registrados. 1 não foi registrado: veja o motivo abaixo.')).toBeVisible();
    await expect(resultado.getByText('Não registrado: A cobrança não está mais em aberto.')).toBeVisible();
    await page.screenshot({ path: `${CAPTURAS}/${nome}-resultado-${largura}.png` });
    await resultado.getByRole('button', { name: 'Fechar' }).last().click();

    // A folha refeita: datas, pagamento com a transação, ID inteiro no fim e CPF mascarado.
    await page.getByRole('button', { name: 'Abrir cobrança de Bruna Teste' }).click();
    const folha = page.getByRole('dialog');
    await expect(folha.getByText('CPF ***.456.789-**')).toBeVisible();
    await expect(folha.getByText('123.456.789-09')).toHaveCount(0);
    await expect(folha.getByText('Datas', { exact: true })).toBeVisible();
    await expect(folha.getByText('Pagamento', { exact: true })).toBeVisible();
    await expect(folha.getByText(BRUNA.id, { exact: true })).toBeVisible();
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/${nome}-folha-${largura}.png`, fullPage: true });
    expect(errosDaPagina).toEqual([]);
  });
}

test('tabela no limite (1280px com o menu aberto): valor de cinco dígitos e datas inteiros; abaixo disso, cartões', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const grande = cobranca('9', 'Maria Aparecida dos Santos Albuquerque Teste', { valorCentavos: 1_234_500, alunoCpf: '987.654.321-00' });
  const estado = estadoFinanceiro({ cobrancas: [grande, { ...PAGA, valorCentavos: 9_999_900 }] });
  const { errosDaPagina } = await abrir(page, estado);
  await expect(page.getByRole('columnheader', { name: 'Valor' })).toBeVisible();
  for (const texto of ['R$ 12.345,00', 'R$ 99.999,00', '05/10/2026', '20/09/2026', '12/10/2026']) {
    const alvo = page.getByText(texto, { exact: true }).first();
    await expect(alvo).toBeVisible();
    // Texto cortado com reticências tem a caixa de rolagem maior que a visível.
    expect(await alvo.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  }
  await semRolagemHorizontal(page);
  await page.screenshot({ path: `${CAPTURAS}/limite-1280.png`, fullPage: true });

  // Um pouco mais estreito, a tabela não cabe: cartões, sem cabeçalho de colunas e sem cortar o valor.
  await page.setViewportSize({ width: 1225, height: 900 });
  await expect(page.getByRole('columnheader', { name: 'Valor' })).toHaveCount(0);
  await expect(page.getByText(/R\$ 12\.345,00/).first()).toBeVisible();
  await semRolagemHorizontal(page);
  await page.screenshot({ path: `${CAPTURAS}/limite-1225.png`, fullPage: true });
  expect(errosDaPagina).toEqual([]);
});
