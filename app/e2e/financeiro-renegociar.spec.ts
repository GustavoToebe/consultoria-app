import { expect, test, type Page, type Route } from '@playwright/test';

import type { CobrancaResponse, ContratacaoResponse } from '../src/api/financeiroTipos';
import { ALUNO, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { fixarHoje, sessaoDeAluno } from './aluno';
import { COBRANCA_ATRASADA, estadoFinanceiro, RECEBIMENTO_CONFIGURADO, rotasDoFinanceiro, sessaoComFinanceiro, type EstadoFinanceiro } from './financeiro-falso';

/**
 * Renegociar (D14): pelo "Mais ações" do lote e pela folha de uma cobrança, em três etapas (cobranças, condições, prévia do
 * servidor), com as que ficam de fora e o porquê, os erros do servidor (prévia que falha, 422 no campo, 409 que trava a
 * folha, sem conexão com o mesmo pedido), o selo "Renegociada" e o "Acordo" nas listas, desfazer o acordo e o que o aluno
 * vê. Relógio em 19/10/2026; só dados fictícios, API simulada.
 */

const CAPTURAS = 'test-results/financeiro-renegociar';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const cobranca = (id: string, alunoNome: string, parcial: Partial<CobrancaResponse>): CobrancaResponse => ({
  // Ids altos: o `idFalso` da API falsa conta a partir de 1 e daria às parcelas o id de uma original.
  ...COBRANCA_ATRASADA, id: `c0000000-0000-4000-8000-9${id.padStart(11, '0')}`, alunoNome, criadoEm: '2026-09-20T12:00:00Z', ...parcial,
});
const BRUNA = 'a0000000-0000-4000-8000-0000000000b1';
// Bruna: duas abertas vencidas (150 + 200), uma de saída (fica de fora) e uma paga (não entra no lote).
const SETEMBRO = cobranca('1', 'Bruna Teste', { alunoId: BRUNA, competencia: '2026-09-05', vencimento: '2026-09-05', diasDeAtraso: 44, versao: 2 });
const OUTUBRO = cobranca('2', 'Bruna Teste', { alunoId: BRUNA, valorCentavos: 20_000, competencia: '2026-10-05', vencimento: '2026-10-05' });
const SAIDA = cobranca('3', 'Bruna Teste', { alunoId: BRUNA, tipo: 'SAIDA', valorCentavos: 5_000, competencia: '2026-11-05', vencimento: '2026-11-05', vencida: false, diasDeAtraso: null });
const CAIO = cobranca('4', 'Caio Teste', { alunoId: 'a0000000-0000-4000-8000-0000000000c1', valorCentavos: 9_000 });
const DORA = cobranca('5', 'Dora Teste', { alunoId: 'a0000000-0000-4000-8000-0000000000d1', valorCentavos: 10_000, competencia: '2026-10-05' });
const PAGA = cobranca('6', 'Elis Teste', {
  alunoId: 'a0000000-0000-4000-8000-0000000000e1', situacao: 'PAGA', vencida: false, diasDeAtraso: null, pagoEm: '2026-10-12', forma: 'PIX_DIRETO', provedor: 'MANUAL',
});

const comCobrancas = (parcial: Partial<EstadoFinanceiro> = {}) =>
  estadoFinanceiro({ cobrancas: [SETEMBRO, OUTUBRO, SAIDA, CAIO, DORA, PAGA].map((c) => ({ ...c })), ...parcial });

async function abrir(page: Page, estado: EstadoFinanceiro, extra: RespostasApi = {}) {
  await fixarHoje(page);
  const api = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado), ...extra });
  // filtro padrão das cobranças (19/11): `filtro=nenhum` abre a lista sem o padrão (Ativas, mês de vencimento atual); o padrão tem o spec próprio.
  await page.goto('/treinador/financeiro?aba=cobrancas&filtro=nenhum');
  await expect(page.getByRole('button', { name: 'Nova cobrança avulsa' })).toBeVisible();
  return api;
}

async function semRolagemHorizontal(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra).toBeLessThanOrEqual(0);
}

/** Marca as três de Bruna (duas renegociáveis e a de saída) e abre "Renegociar" no "Mais ações". */
async function abrirPeloLote(page: Page) {
  await page.getByRole('checkbox', { name: /^Selecionar cobrança de Bruna Teste, 09\/2026/ }).click();
  await page.getByRole('checkbox', { name: /^Selecionar cobrança de Bruna Teste, 10\/2026/ }).click();
  await page.getByRole('checkbox', { name: /^Selecionar cobrança de Bruna Teste, 11\/2026/ }).click();
  await page.getByRole('button', { name: 'Mais ações' }).click();
  await page.getByRole('dialog', { name: 'Ações com 3 cobranças' }).getByRole('button', { name: /^Renegociar/ }).click();
  return page.getByRole('dialog', { name: 'Renegociar 2 cobranças' });
}

/** Etapa 2: R$ 10,01 de acréscimo (a sobra de 1 centavo vai à última), 3 parcelas a partir de 31/10/2026 e o motivo. */
async function preencherCondicoes(folha: ReturnType<Page['getByRole']>, parcelas = '3') {
  await folha.getByLabel('Acréscimo (opcional)').pressSequentially('1001');
  await expect(folha.getByLabel('Acréscimo (opcional)')).toHaveValue('R$ 10,01');
  await folha.getByLabel('Parcelas', { exact: true }).fill(parcelas);
  await folha.getByLabel('Primeiro vencimento').fill('31/10/2026');
  await folha.getByLabel('Motivo', { exact: true }).fill('Combinado com a aluna');
}

const ehConfirmar = (p: { metodo: string; caminho: string }) => p.metodo === 'POST' && p.caminho === '/cobrancas/renegociar';
const ehPrevia = (p: { metodo: string; caminho: string }) => p.metodo === 'POST' && p.caminho === '/cobrancas/renegociar/previa';

for (const largura of [1280, 390]) {
  test(`fluxo feliz pelo lote em ${largura}px: a de saída fica de fora, a prévia é do servidor e as originais viram "Renegociada"`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const estado = comCobrancas();
    const { pedidos, errosDaPagina } = await abrir(page, estado);
    const folha = await abrirPeloLote(page);

    // Etapa 1: as duas que entram (com o valor da lista, sem soma) e a de saída fora, com o motivo.
    await expect(folha.getByRole('list', { name: 'Cobranças que entram no acordo' }).getByRole('listitem')).toHaveCount(2);
    await expect(folha.getByText('Ficam de fora (1)')).toBeVisible();
    await expect(folha.getByText('Cobrança de saída não entra em renegociação.')).toBeVisible();
    await expect(folha.getByText('R$ 350,00')).toHaveCount(0);
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/etapa1-${largura}.png` });
    await folha.getByRole('button', { name: 'Continuar' }).click();

    // Etapa 2: "Ver prévia" sem nada confere os campos e não chama o servidor.
    await folha.getByRole('button', { name: 'Ver prévia' }).click();
    await expect(folha.getByText('Informe o primeiro vencimento.')).toBeVisible();
    await expect(folha.getByText('Explique o motivo da renegociação. Só a equipe vê.')).toBeVisible();
    expect(pedidos.filter(ehPrevia)).toHaveLength(0);
    await page.screenshot({ path: `${CAPTURAS}/etapa2-erro-${largura}.png` });
    await preencherCondicoes(folha);
    await page.screenshot({ path: `${CAPTURAS}/etapa2-${largura}.png` });
    await folha.getByRole('button', { name: 'Ver prévia' }).click();

    // Etapa 3: soma, acréscimo, total e as parcelas como o servidor calculou (sobra na última, 30/11 no fim do mês).
    await expect(folha.getByLabel(/^Cobranças originais \(2\): R\$\s350,00$/)).toBeVisible();
    await expect(folha.getByLabel(/^Acréscimo: \+R\$\s10,01$/)).toBeVisible();
    await expect(folha.getByLabel(/^Total do acordo: R\$\s360,01$/)).toBeVisible();
    const parcelas = folha.getByRole('list', { name: 'Parcelas do acordo' }).getByRole('listitem');
    await expect(parcelas).toHaveCount(3);
    for (const data of ['31/10/2026', '30/11/2026', '31/12/2026']) await expect(folha.getByText(`Vence em ${data}`)).toBeVisible();
    await expect(parcelas.nth(2)).toContainText('R$ 120,01');
    await expect(parcelas.nth(0)).toContainText('Renegociação (Parcela 1/3)');
    await expect(folha.getByText(/As 2 cobranças originais passam a “Renegociada”/)).toBeVisible();
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/etapa3-previa-${largura}.png` });

    // Voltar e ver a prévia de novo sem mudar nada não pede outra.
    await folha.getByRole('button', { name: 'Voltar' }).click();
    await expect(folha.getByLabel('Motivo', { exact: true })).toHaveValue('Combinado com a aluna');
    await folha.getByRole('button', { name: 'Ver prévia' }).click();
    await expect(folha.getByLabel(/^Total do acordo/)).toBeVisible();
    expect(pedidos.filter(ehPrevia)).toHaveLength(1);

    // Clique duplo: um pedido só, com as versões vistas, o motivo e um pedidoId.
    await folha.getByRole('button', { name: 'Renegociar 2 cobranças em 3 parcelas' }).dblclick();
    await expect(page.getByText('2 cobranças renegociadas em 3 parcelas.')).toBeVisible();
    await expect(folha).toHaveCount(0);
    expect(pedidos.filter(ehConfirmar)).toHaveLength(1);
    expect(estado.renegociacoesRecebidas).toEqual([{
      itens: [{ cobrancaId: SETEMBRO.id, versao: 2 }, { cobrancaId: OUTUBRO.id, versao: 0 }], acrescimoCentavos: 1_001, descontoCentavos: 0, parcelas: 3,
      primeiroVencimento: '2026-10-31', pedidoId: expect.stringMatching(UUID_V4), motivo: 'Combinado com a aluna',
    }]);

    // A lista recarregou: originais "Renegociada" (neutras, fora do lote) e três parcelas com o selo "Acordo".
    await expect(page.getByText('Renegociada', { exact: true })).toHaveCount(2);
    await expect(page.getByText('Acordo', { exact: true })).toHaveCount(3);
    await expect(page.getByText('Renegociação (Parcela 3/3)').first()).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /^Selecionar cobrança de Bruna Teste, 09\/2026/ })).toHaveCount(0);
    await expect(page.getByText(/cobranças? selecionadas?/)).toHaveCount(1);
    await expect(page.getByText(/canceladas, estornadas e renegociadas não entram/)).toBeVisible();
    await semRolagemHorizontal(page);
    await page.getByText('Renegociação (Parcela 1/3)').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURAS}/lista-depois-${largura}.png` });
    expect(errosDaPagina).toEqual([]);
  });
}

test('alunos diferentes: o aviso vem antes, no menu (item apagado); só inelegíveis: a primeira etapa explica e só deixa fechar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { pedidos, errosDaPagina } = await abrir(page, comCobrancas());
  await page.getByRole('checkbox', { name: /^Selecionar cobrança de Bruna Teste, 09\/2026/ }).click();
  await page.getByRole('checkbox', { name: /^Selecionar cobrança de Caio Teste/ }).click();
  await page.getByRole('button', { name: 'Mais ações' }).click();
  // O aviso vem ANTES de abrir a renegociação: o item fica apagado e a explicação é o motivo (nenhuma folha, nenhum pedido).
  const menu = page.getByRole('dialog', { name: 'Ações com 2 cobranças' });
  const item = menu.getByRole('button', { name: /^Renegociar/ });
  await expect(item).toBeDisabled();
  await expect(menu.getByText('As cobranças são de alunos diferentes. Renegocie um aluno por vez: filtre pelo aluno e marque só as dele.')).toHaveCount(1);
  await expect(menu.getByRole('button', { name: /^Exportar selecionadas/ })).toBeEnabled();
  await page.screenshot({ path: `${CAPTURAS}/alunos-diferentes-1280.png` });
  await item.click({ force: true });
  await expect(page.getByRole('dialog', { name: 'Renegociar 2 cobranças' })).toHaveCount(0);
  expect(pedidos.filter((p) => ehPrevia(p) || ehConfirmar(p))).toHaveLength(0);
  await menu.getByRole('button', { name: 'Fechar' }).first().click();
  // A seleção continua para a pessoa ajustar.
  await expect(page.getByText('2 cobranças selecionadas')).toBeVisible();

  // Só a de saída: nada entra.
  await page.getByRole('button', { name: 'Limpar seleção' }).click();
  await page.getByRole('checkbox', { name: /^Selecionar cobrança de Bruna Teste, 11\/2026/ }).click();
  await page.getByRole('button', { name: 'Mais ações' }).click();
  await page.getByRole('dialog', { name: 'Ações com 1 cobrança' }).getByRole('button', { name: /^Renegociar/ }).click();
  const uma = page.getByRole('dialog', { name: 'Renegociar cobrança' });
  await expect(uma.getByText('Esta cobrança não pode ser renegociada.')).toBeVisible();
  await expect(uma.getByText('Cobrança de saída não entra em renegociação.')).toBeVisible();
  await expect(uma.getByText('Saída', { exact: true })).toBeVisible();
  await uma.getByRole('button', { name: 'Fechar' }).last().click();

  // Paga e de saída não têm "Renegociar" na folha; a em aberto tem.
  await page.getByRole('button', { name: 'Abrir cobrança de Elis Teste' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Renegociar' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Abrir cobrança de saída de Bruna Teste' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Renegociar' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  expect(pedidos.filter((p) => ehPrevia(p) || ehConfirmar(p))).toHaveLength(0);
  expect(errosDaPagina).toEqual([]);
});

test('prévia que falha tem "Tentar de novo"; 422 do servidor volta às condições com a mensagem no campo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const estado = comCobrancas({ recusaDaRenegociacao: { rota: 'previa', status: 500, codigo: 'ERRO_INTERNO' } });
  const { errosDaPagina } = await abrir(page, estado);
  const folha = await abrirPeloLote(page);
  await folha.getByRole('button', { name: 'Continuar' }).click();
  await preencherCondicoes(folha);
  await folha.getByRole('button', { name: 'Ver prévia' }).click();
  await expect(folha.getByText('Não foi possível calcular a prévia agora. Tente de novo.')).toBeVisible();
  await expect(folha.getByRole('button', { name: 'Renegociar', exact: true })).toBeDisabled();
  await page.screenshot({ path: `${CAPTURAS}/previa-erro-1280.png` });
  await folha.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(folha.getByLabel(/^Total do acordo: R\$\s360,01$/)).toBeVisible();

  // Desconto que zera o total: o servidor recusa, a folha volta às condições com o erro no campo do desconto.
  await folha.getByRole('button', { name: 'Voltar' }).click();
  await folha.getByLabel('Desconto (opcional)').pressSequentially('99999999');
  await folha.getByRole('button', { name: 'Ver prévia' }).click();
  await expect(folha.getByText('O desconto não pode zerar o total.')).toBeVisible();
  await expect(folha.getByLabel('Desconto (opcional)')).toBeVisible();
  await expect(folha.getByText('Confira os campos destacados.')).toBeVisible();
  await page.screenshot({ path: `${CAPTURAS}/erro-422-1280.png` });
  expect(estado.renegociacoesRecebidas).toHaveLength(0);
  expect(errosDaPagina.filter((e) => !/500|422/.test(e))).toEqual([]);
});

test('409 do servidor ao confirmar: a folha trava com a mensagem, só deixa fechar, e a lista recarrega', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const estado = comCobrancas();
  const { pedidos, errosDaPagina } = await abrir(page, estado);
  const folha = await abrirPeloLote(page);
  await folha.getByRole('button', { name: 'Continuar' }).click();
  await preencherCondicoes(folha);
  await folha.getByRole('button', { name: 'Ver prévia' }).click();
  await expect(folha.getByLabel(/^Total do acordo/)).toBeVisible();
  const listasAntes = pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/financeiro/cobrancas').length;
  estado.recusaDaRenegociacao = { rota: 'confirmar', status: 409, codigo: 'CONFLITO_EDICAO' };
  await folha.getByRole('button', { name: 'Renegociar 2 cobranças em 3 parcelas' }).click();
  await expect(folha.getByText(/Alguma cobrança foi alterada em outro lugar enquanto você renegociava\. Nada foi renegociado\./)).toBeVisible();
  await expect(folha.getByRole('button', { name: /^Renegociar/ })).toHaveCount(0);
  // O X do topo e o "Fechar" do rodapé (o único botão que sobra embaixo).
  await expect(folha.getByRole('button', { name: 'Fechar' })).toHaveCount(2);
  await expect.poll(() => pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/financeiro/cobrancas').length).toBeGreaterThan(listasAntes);
  await semRolagemHorizontal(page);
  await page.screenshot({ path: `${CAPTURAS}/erro-409-390.png` });
  await folha.getByRole('button', { name: 'Fechar' }).last().click();
  await expect(folha).toHaveCount(0);
  expect(estado.cobrancas.filter((c) => c.situacao === 'RENEGOCIADA')).toHaveLength(0);
  expect(errosDaPagina.filter((e) => !/409/.test(e))).toEqual([]);
});

for (const largura of [1280, 390]) {
  test(`sem conexão ao confirmar em ${largura}px: de novo manda o mesmo pedido e o servidor devolve o que já fez, sem dobrar`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const estado = comCobrancas();
    const confirmar = rotasDoFinanceiro(estado)['POST /cobrancas/renegociar'];
    if (typeof confirmar !== 'function') throw new Error('A rota do falso mudou de forma.');
    let envios = 0;
    const { pedidos, errosDaPagina } = await abrir(page, estado, {
      'POST /cobrancas/renegociar': async (p, route) => {
        envios += 1;
        // 1º: caiu antes de chegar. 2º: o servidor fez, mas a resposta se perdeu. 3º: chega e recebe 200 com o que já fez.
        if (envios === 1) return route.abort('internetdisconnected');
        if (envios === 2) {
          await confirmar(p, Object.assign(Object.create(route) as Route, { fulfill: async () => undefined }));
          return route.abort('internetdisconnected');
        }
        return confirmar(p, route);
      },
    });
    const folha = await abrirPeloLote(page);
    await folha.getByRole('button', { name: 'Continuar' }).click();
    await preencherCondicoes(folha, '2');
    await folha.getByRole('button', { name: 'Ver prévia' }).click();
    const botao = folha.getByRole('button', { name: 'Renegociar 2 cobranças em 2 parcelas' });
    await botao.click();
    await expect(folha.getByText(/Sem conexão com o servidor\. .*Tente de novo: repetir não renegocia em dobro\./)).toBeVisible();
    await expect(botao).toBeEnabled();
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/sem-conexao-${largura}.png` });
    await botao.click();
    await expect(folha.getByText(/Sem conexão com o servidor\./)).toBeVisible();
    expect(estado.cobrancas.filter((c) => c.tipo === 'RENEGOCIACAO')).toHaveLength(2);
    await botao.click();
    await expect(page.getByText('2 cobranças renegociadas em 2 parcelas.')).toBeVisible();
    await expect(folha).toHaveCount(0);
    expect(estado.cobrancas.filter((c) => c.tipo === 'RENEGOCIACAO')).toHaveLength(2);
    const ids = pedidos.filter(ehConfirmar).map((p) => (p.corpo as { pedidoId?: unknown }).pedidoId);
    expect(ids).toHaveLength(3);
    expect(ids[0]).toMatch(UUID_V4);
    expect(ids).toEqual([ids[0], ids[0], ids[0]]);
    expect(errosDaPagina.filter((e) => !/internet|Failed to fetch/i.test(e))).toEqual([]);
  });
}

test('pela folha de uma cobrança: renegociar, ver o "Acordo" na original e desfazer com motivo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const estado = comCobrancas();
  const { errosDaPagina } = await abrir(page, estado);
  await page.getByRole('button', { name: 'Abrir cobrança de Dora Teste' }).click();
  await page.getByRole('dialog', { name: 'Cobrança de 10/2026' }).getByRole('button', { name: 'Renegociar' }).click();
  const folha = page.getByRole('dialog', { name: 'Renegociar cobrança' });
  // "Cancelar" volta ao detalhe da cobrança, sem fechar tudo.
  await folha.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('dialog', { name: 'Cobrança de 10/2026' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Cobrança de 10/2026' }).getByRole('button', { name: 'Renegociar' }).click();
  await folha.getByRole('button', { name: 'Continuar' }).click();
  await folha.getByLabel('Primeiro vencimento').fill('05/11/2026');
  await folha.getByLabel('Motivo', { exact: true }).fill('Novo vencimento combinado');
  await folha.getByRole('button', { name: 'Ver prévia' }).click();
  await expect(folha.getByText('Renegociação', { exact: true })).toBeVisible();
  await page.screenshot({ path: `${CAPTURAS}/uma-cobranca-previa-1280.png` });
  await folha.getByRole('button', { name: 'Renegociar 1 cobrança em 1 parcela' }).click();
  await expect(page.getByText('1 cobrança renegociada em 1 parcela.')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // A original: selo "Renegociada", o grupo "Acordo", o motivo e "Desfazer acordo".
  await page.getByRole('button', { name: 'Abrir cobrança de Dora Teste' }).click();
  const original = page.getByRole('dialog', { name: 'Cobrança de 10/2026' });
  await expect(original.getByText('Renegociada', { exact: true })).toBeVisible();
  await expect(original.getByText(/Entrou num acordo de renegociação e não é mais cobrada/)).toBeVisible();
  await expect(original.getByText('Novo vencimento combinado')).toBeVisible();
  await expect(original.getByRole('button', { name: 'Registrar pagamento' })).toHaveCount(0);
  await page.screenshot({ path: `${CAPTURAS}/folha-renegociada-1280.png` });
  await original.getByRole('button', { name: 'Desfazer acordo' }).click();
  const painel = page.getByRole('alertdialog', { name: 'Desfazer o acordo?' });
  await expect(painel.getByRole('button', { name: 'Desfazer acordo' })).toBeDisabled();
  await painel.getByRole('textbox', { name: 'Motivo' }).fill('Lançado por engano');
  await page.screenshot({ path: `${CAPTURAS}/desfazer-1280.png` });
  await painel.getByRole('button', { name: 'Desfazer acordo' }).click();
  await expect(page.getByText('Acordo desfeito.')).toBeVisible();
  expect(estado.cobrancas.find((c) => c.id === DORA.id)?.situacao).toBe('ABERTA');
  expect(estado.cobrancas.filter((c) => c.tipo === 'RENEGOCIACAO').map((c) => c.situacao)).toEqual(['CANCELADA']);
  expect(errosDaPagina).toEqual([]);
});

test('folha de uma cobrança em aberto em 390px com o recebimento online: o rodapé com Renegociar não toma o corpo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errosDaPagina } = await abrir(page, comCobrancas({ recebimento: { ...RECEBIMENTO_CONFIGURADO } }));
  await page.getByRole('button', { name: 'Abrir cobrança de Dora Teste' }).click();
  const folha = page.getByRole('dialog', { name: 'Cobrança de 10/2026' });
  for (const nome of ['Cancelar cobrança', 'Copiar link de pagamento', 'Renegociar', 'Registrar pagamento']) await expect(folha.getByRole('button', { name: nome })).toBeVisible();
  await expect(folha.getByText('R$ 100,00').first()).toBeInViewport();
  await semRolagemHorizontal(page);
  await page.screenshot({ path: `${CAPTURAS}/folha-aberta-rodape-390.png` });
  expect(errosDaPagina).toEqual([]);
});

test('o aluno só é informado: a original "Renegociada" sem "Pagar" e a parcela com o selo "Acordo"', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await fixarHoje(page);
  const contratacao: ContratacaoResponse = {
    id: 'e0000000-0000-4000-8000-0000000000cc', alunoId: ALUNO.id, planoComercialId: 'b0000000-0000-4000-8000-0000000000f1', planoNome: 'Consultoria mensal',
    periodicidade: 'MENSAL', valorCentavos: 15_000, motivoValor: null, inicio: '2026-09-05', diaVencimento: 5, situacao: 'ATIVA', encerradaEm: null,
    criadoEm: '2026-09-01T12:00:00Z', versao: 0, minimoAte: null,
  };
  const acordoId = 'f0000000-0000-4000-8000-0000000000a1';
  const estado = estadoFinanceiro({
    contratacoes: [contratacao],
    cobrancas: [
      { ...SETEMBRO, alunoId: ALUNO.id, situacao: 'RENEGOCIADA', vencida: false, diasDeAtraso: null, acordoId, motivo: 'Interno da equipe' },
      cobranca('9', ALUNO.nome, {
        alunoId: ALUNO.id, tipo: 'RENEGOCIACAO', contratacaoId: null, planoNome: null, competencia: null, descricao: 'Renegociação (Parcela 1/2)',
        vencimento: '2026-11-05', vencida: false, diasDeAtraso: null, acordoId,
      }),
    ],
  });
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessaoDeAluno(page)), ...(await sessao(page, ALUNO, { pagamentosHabilitados: true })), ...rotasDoFinanceiro(estado),
  });
  await page.goto('/aluno/conta');
  await expect(page.getByText('Renegociação (Parcela 1/2)')).toBeVisible();
  await expect(page.getByText('Acordo', { exact: true })).toBeVisible();
  await expect(page.getByText('Renegociada', { exact: true })).toBeVisible();
  await expect(page.getByText(/entrou num acordo de renegociação/)).toBeVisible();
  await expect(page.getByText('Interno da equipe')).toHaveCount(0);
  await semRolagemHorizontal(page);
  await page.getByText('Renegociação (Parcela 1/2)').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${CAPTURAS}/aluno-meu-plano-390.png`, fullPage: true });
  expect(errosDaPagina).toEqual([]);
});

const TEMAS = [
  { nome: 'claro', preferencias: { tema: 'CLARO' } },
  { nome: 'escuro', preferencias: { tema: 'ESCURO' } },
] as const;

for (const { nome, preferencias } of TEMAS) for (const largura of [1280, 390]) {
  test(`tema ${nome} em ${largura}px: as três etapas, a prévia e os selos na lista, sem rolagem horizontal`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.addInitScript(([id, p]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(p)), [TREINADOR.id, preferencias] as const);
    const { errosDaPagina } = await abrir(page, comCobrancas());
    const folha = await abrirPeloLote(page);
    await page.screenshot({ path: `${CAPTURAS}/${nome}-etapa1-${largura}.png` });
    await folha.getByRole('button', { name: 'Continuar' }).click();
    await preencherCondicoes(folha);
    await page.screenshot({ path: `${CAPTURAS}/${nome}-etapa2-${largura}.png` });
    await folha.getByRole('button', { name: 'Ver prévia' }).click();
    await expect(folha.getByLabel(/^Total do acordo/)).toBeVisible();
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/${nome}-etapa3-${largura}.png` });
    await folha.getByRole('button', { name: 'Renegociar 2 cobranças em 3 parcelas' }).click();
    await expect(page.getByText('Renegociada', { exact: true }).first()).toBeVisible();
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/${nome}-lista-${largura}.png`, fullPage: true });
    expect(errosDaPagina).toEqual([]);
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// D3 (18/11): cobrança com cobrança automática da Kiwify não se renegocia.
// ---------------------------------------------------------------------------------------------------------------------

const MOTIVO_AUTOMATICA = 'Esta cobrança é cobrada automaticamente pela Kiwify e não pode ser renegociada.';
const AUTOMATICA = cobranca('7', 'Dora Teste', {
  alunoId: DORA.alunoId, valorCentavos: 15_000, competencia: '2026-11-05', vencimento: '2026-11-05', vencida: false, diasDeAtraso: null, cobrancaAutomatica: 'KIWIFY',
});

for (const largura of [1280, 390]) {
  test(`cobrança automática da Kiwify em ${largura}px: "Renegociar" desabilitado com o motivo, na folha e no "Mais ações" do lote`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const estado = comCobrancas({ cobrancas: [SETEMBRO, OUTUBRO, AUTOMATICA].map((c) => ({ ...c })) });
    const { pedidos, errosDaPagina } = await abrir(page, estado);

    // Folha da cobrança: o botão existe, apagado, com o motivo logo abaixo; as outras ações seguem.
    await page.getByRole('button', { name: 'Abrir cobrança de Dora Teste' }).click();
    const folha = page.getByRole('dialog', { name: 'Cobrança de 11/2026' });
    await expect(folha.getByRole('button', { name: 'Renegociar' })).toBeDisabled();
    await expect(folha.getByText(MOTIVO_AUTOMATICA)).toBeVisible();
    await expect(folha.getByRole('button', { name: 'Registrar pagamento' })).toBeEnabled();
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/automatica-folha-${largura}.png` });
    await folha.getByRole('button', { name: 'Fechar' }).first().click();

    // Lote: uma automática junto com outras deixa o item apagado, com o motivo no lugar da explicação.
    await page.getByRole('checkbox', { name: /^Selecionar cobrança de Bruna Teste, 09\/2026/ }).click();
    await page.getByRole('checkbox', { name: /^Selecionar cobrança de Dora Teste, 11\/2026/ }).click();
    await page.getByRole('button', { name: 'Mais ações' }).click();
    const menu = page.getByRole('dialog', { name: 'Ações com 2 cobranças' });
    await expect(menu.getByRole('button', { name: /^Renegociar/ })).toBeDisabled();
    await expect(menu.getByText(MOTIVO_AUTOMATICA)).toBeVisible();
    await expect(menu.getByRole('button', { name: /^Exportar selecionadas/ })).toBeEnabled();
    await page.screenshot({ path: `${CAPTURAS}/automatica-lote-${largura}.png` });
    // Nenhum pedido de renegociação saiu.
    expect(pedidos.filter((p) => ehPrevia(p) || ehConfirmar(p))).toHaveLength(0);
    expect(errosDaPagina).toEqual([]);
  });
}

test('409 RENEGOCIACAO_COBRANCA_AUTOMATICA ao confirmar (a lista estava velha): a folha trava com a mensagem da API e a lista recarrega marcando a cobrança', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const estado = comCobrancas();
  const { pedidos, errosDaPagina } = await abrir(page, estado);
  await page.getByRole('button', { name: 'Abrir cobrança de Dora Teste' }).click();
  await page.getByRole('dialog', { name: 'Cobrança de 10/2026' }).getByRole('button', { name: 'Renegociar' }).click();
  const folha = page.getByRole('dialog', { name: 'Renegociar cobrança' });
  await folha.getByRole('button', { name: 'Continuar' }).click();
  await folha.getByLabel('Primeiro vencimento').fill('05/11/2026');
  await folha.getByLabel('Motivo', { exact: true }).fill('Novo vencimento combinado');
  await folha.getByRole('button', { name: 'Ver prévia' }).click();
  await expect(folha.getByLabel(/^Total do acordo/)).toBeVisible();
  // Depois de o app listar, a cobrança passou a ser automática (o servidor sabe; a tela ainda não).
  const dora = estado.cobrancas.find((c) => c.id === DORA.id);
  if (dora) dora.cobrancaAutomatica = 'KIWIFY';
  const listasAntes = pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/financeiro/cobrancas').length;
  await folha.getByRole('button', { name: 'Renegociar 1 cobrança em 1 parcela' }).click();
  await expect(folha.getByText(MOTIVO_AUTOMATICA)).toBeVisible();
  await expect(folha.getByRole('button', { name: /^Renegociar/ })).toHaveCount(0);
  await expect.poll(() => pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/financeiro/cobrancas').length).toBeGreaterThan(listasAntes);
  await semRolagemHorizontal(page);
  await page.screenshot({ path: `${CAPTURAS}/automatica-409-390.png` });
  await folha.getByRole('button', { name: 'Fechar' }).last().click();
  expect(estado.cobrancas.filter((c) => c.situacao === 'RENEGOCIADA')).toHaveLength(0);
  // A lista recarregada já sabe: agora o botão vem apagado.
  await page.getByRole('button', { name: 'Abrir cobrança de Dora Teste' }).click();
  await expect(page.getByRole('dialog', { name: 'Cobrança de 10/2026' }).getByRole('button', { name: 'Renegociar' })).toBeDisabled();
  expect(errosDaPagina.filter((e) => !/409/.test(e))).toEqual([]);
});
