import { expect, test, type Page } from '@playwright/test';

import type { AlunoResumo, AlunoDetalhe } from '../src/api/tipos';
import type { CobrancaResponse, ContratacaoResponse, PlanoResponse } from '../src/api/financeiroTipos';
import { ALUNO, simularApi, TREINADOR } from './api-falsa';
import { fixarHoje } from './aluno';
import { ALUNO_FINANCEIRO_ID, COBRANCA_ATRASADA, estadoDoResponsavel, estadoFinanceiro, rotasDoFinanceiro, rotasDoResponsavel, sessaoComFinanceiro } from './financeiro-falso';

/**
 * Contrato fechado (Fase 1, `docs/planos/contrato-fechado.md`): contratar com entrada + parcelas fixas (a divisão, a soma e
 * "a soma fecha" vêm da prévia da API falsa; editar uma parcela mostra a soma errada e trava o "Criar contrato") e com saldo
 * livre; o cartão com Valor total / Pago / Falta pagar, a barra, o alerta e a pílula "Vencida"; "Registrar pagamento do
 * saldo" (acima do limite = 422 no campo, saldo zerado = botão com o motivo); encerrar com multa rescisória; a pílula na
 * lista de alunos (some sem erro com o 503). Relógio em 19/10/2026; só dados fictícios. Capturas em `test-results/contrato-fechado/`.
 */

const FICHA: AlunoDetalhe = {
  id: ALUNO_FINANCEIRO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null, cpf: null, endereco: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

const PLANO: PlanoResponse = {
  id: 'b0000000-0000-4000-8000-0000000000c1', nome: 'Contrato Trimestral', valorCentavos: 300_000, periodicidade: 'TRIMESTRAL', arquivado: false,
  criadoEm: '2026-10-01T12:00:00Z', versao: 0, tempoMinimoMeses: null, regraDeSaida: null, linkDePagamento: null, incluiTreino: true, incluiDieta: true,
};

const CONTRATACAO: ContratacaoResponse = {
  id: 'e0000000-0000-4000-8000-0000000000c1', alunoId: ALUNO_FINANCEIRO_ID, planoComercialId: PLANO.id, planoNome: PLANO.nome, periodicidade: 'TRIMESTRAL',
  valorCentavos: 300_000, motivoValor: null, inicio: '2026-08-24', diaVencimento: 24, situacao: 'ATIVA', encerradaEm: null, criadoEm: '2026-08-24T12:00:00Z',
  versao: 0, minimoAte: null, terminoVigencia: '2026-11-24',
};

const cobranca = (id: string, extra: Partial<CobrancaResponse>): CobrancaResponse => ({
  ...COBRANCA_ATRASADA, id, contratacaoId: CONTRATACAO.id, alunoId: ALUNO_FINANCEIRO_ID, alunoNome: ALUNO.nome, planoNome: PLANO.nome, competencia: null,
  vencida: false, diasDeAtraso: null, criadoEm: '2026-08-24T12:00:00Z', ...extra,
});
const paga = (pagoEm: string) => ({ situacao: 'PAGA' as const, forma: 'PIX_DIRETO' as const, provedor: 'MANUAL', pagoEm });

/** Entrada paga, parcela 1 paga, parcela 2 vencida há 25 dias, parcela 3 a vencer: o caso da prancha. */
const PARCELADO: CobrancaResponse[] = [
  cobranca('c0000000-0000-4000-8000-0000000000c1', { tipo: 'AVULSA', descricao: 'Entrada', vencimento: '2026-08-24', valorCentavos: 60_000, ...paga('2026-08-24') }),
  cobranca('c0000000-0000-4000-8000-0000000000c2', { tipo: 'RENEGOCIACAO', descricao: 'Parcela 1/3', acordoId: 'f1', vencimento: '2026-09-01', valorCentavos: 80_000, ...paga('2026-09-01') }),
  cobranca('c0000000-0000-4000-8000-0000000000c3', { tipo: 'RENEGOCIACAO', descricao: 'Parcela 2/3', acordoId: 'f1', vencimento: '2026-09-24', valorCentavos: 80_000, situacao: 'ABERTA', vencida: true, diasDeAtraso: 25 }),
  cobranca('c0000000-0000-4000-8000-0000000000c4', { tipo: 'RENEGOCIACAO', descricao: 'Parcela 3/3', acordoId: 'f1', vencimento: '2026-11-24', valorCentavos: 80_000, situacao: 'ABERTA' }),
];

/** Saldo livre de R$ 2.000,00: entrada de R$ 500,00 paga e um pagamento de R$ 300,00 aberto e vencido (reserva saldo). */
const SALDO: CobrancaResponse[] = [
  cobranca('c0000000-0000-4000-8000-0000000000d1', { tipo: 'AVULSA', descricao: 'Entrada', vencimento: '2026-08-24', valorCentavos: 50_000, ...paga('2026-08-24') }),
  cobranca('c0000000-0000-4000-8000-0000000000d2', { tipo: 'AVULSA', descricao: 'Pagamento do saldo', vencimento: '2026-10-10', valorCentavos: 30_000, situacao: 'ABERTA', vencida: true, diasDeAtraso: 9 }),
];

const LARGURAS_E_TEMAS = [[390, 'ESCURO'], [1280, 'ESCURO'], [390, 'CLARO'], [1280, 'CLARO']] as const;
const captura = (nome: string) => `test-results/contrato-fechado/${nome}.png`;
// Movimento reduzido: as linhas da lista entram sem o fade, e a captura não pega a linha a meio caminho.
test.use({ contextOptions: { reducedMotion: 'reduce' } });

async function abrir(page: Page, largura: number, tema: 'CLARO' | 'ESCURO', estado: ReturnType<typeof estadoFinanceiro>, caminho = `/treinador/alunos/${ALUNO_FINANCEIRO_ID}?aba=ficha`,
  permissoes?: string[]) {
  await page.setViewportSize({ width: largura, height: 900 });
  await fixarHoje(page);
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
  const api = await simularApi(page, {
    ...(await sessaoComFinanceiro(page, permissoes)), ...rotasDoFinanceiro(estado), ...rotasDoResponsavel(estadoDoResponsavel()),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } }, [`GET /alunos/${ALUNO_FINANCEIRO_ID}`]: { corpo: FICHA },
  });
  await page.goto(caminho);
  return api;
}

for (const [largura, tema] of LARGURAS_E_TEMAS) {
  const sufixo = `${largura}-${tema.toLowerCase()}`;

  test(`contratar entrada + parcelas fixas em ${sufixo}: divisão e conferência da API, soma errada trava o botão, "Dividir" refaz e o corpo leva as parcelas`, async ({ page }) => {
    const estado = estadoFinanceiro({ planos: [{ ...PLANO }] });
    const { errosDaPagina, naoTratadas, pedidos } = await abrir(page, largura, tema, estado);
    await page.getByRole('button', { name: 'Contratar plano' }).click();
    const folha = page.getByRole('dialog', { name: 'Contratar plano' });
    await folha.getByRole('button', { name: /^Plano:/ }).click();
    await page.getByRole('radio', { name: /^Contrato Trimestral/ }).click();
    // Recorrente é o padrão; as três opções estão no grupo "Como cobrar".
    const comoCobrar = folha.getByRole('radiogroup', { name: 'Como cobrar' });
    await expect(comoCobrar.getByRole('radio', { name: /^Recorrente/ })).toBeChecked();
    await comoCobrar.getByRole('radio', { name: /^Entrada \+ parcelas fixas/ }).click();
    await expect(folha.getByLabel('Dia do vencimento')).toHaveCount(0);
    await folha.getByLabel('Valor total do contrato').fill('3.000,00');
    await folha.getByLabel('Valor da entrada').fill('600,00');
    await expect(folha.getByText('A soma fecha com o valor total')).toBeVisible();
    await expect(folha.getByText('Soma R$ 3.000,00 de R$ 3.000,00')).toBeVisible();
    await expect(folha.getByLabel('Valor da parcela 1')).toHaveValue('R$ 800,00');
    await expect(folha.getByLabel('Vencimento da parcela 3')).toHaveValue('19/01/2027');
    await expect(folha.getByLabel('Parcelas: 3 × R$ 800,00')).toBeVisible();
    await expect(folha.getByText('O aluno vê as cobranças na Conta dele.')).toBeVisible();
    const criar = folha.getByRole('button', { name: 'Criar contrato' });
    await expect(criar).toBeEnabled();
    await page.screenshot({ path: captura(`contratar-parcelado-${sufixo}`), fullPage: true });
    await folha.getByText('A soma fecha com o valor total').scrollIntoViewIfNeeded();
    await page.screenshot({ path: captura(`contratar-parcelado-fim-${sufixo}`), fullPage: true });

    // Parcela editada: a API soma e diz que não fecha; o botão trava com o motivo.
    await folha.getByLabel('Valor da parcela 2').fill('700,00');
    await expect(folha.getByText('A soma não fecha com o valor total')).toBeVisible();
    await expect(folha.getByText(/Soma R\$ 2\.900,00 de R\$ 3\.000,00 · diferença de R\$ 100,00/)).toBeVisible();
    await expect(criar).toBeDisabled();
    await expect(folha.getByText('A soma das cobranças precisa fechar com o valor total.')).toBeVisible();
    expect(estado.previasDoContrato.at(-1)?.parcelas).toEqual([
      { vencimento: '2026-11-19', valorCentavos: 80_000 }, { vencimento: '2026-12-19', valorCentavos: 70_000 }, { vencimento: '2027-01-19', valorCentavos: 80_000 },
    ]);
    await folha.getByText('A soma não fecha com o valor total').scrollIntoViewIfNeeded();
    await page.screenshot({ path: captura(`contratar-soma-nao-fecha-${sufixo}`), fullPage: true });

    // "Dividir o restante igual" pede a divisão do servidor de novo.
    await folha.getByRole('button', { name: 'Dividir o restante igual' }).click();
    await expect(folha.getByText('A soma fecha com o valor total')).toBeVisible();
    await expect(criar).toBeEnabled();
    await criar.click();
    await expect(page.getByText('Contrato criado.')).toBeVisible();
    expect(pedidos.find((p) => p.metodo === 'POST' && p.caminho.endsWith('/contratacoes'))?.corpo).toEqual({
      planoComercialId: PLANO.id, inicio: '2026-10-19',
      modoCobranca: 'PARCELADO_FIXO', valorTotalCentavos: 300_000, entrada: { valorCentavos: 60_000, data: '2026-10-19', jaPaga: false },
      parcelas: [{ vencimento: '2026-11-19', valorCentavos: 80_000 }, { vencimento: '2026-12-19', valorCentavos: 80_000 }, { vencimento: '2027-01-19', valorCentavos: 80_000 }],
    });
    expect(estado.cobrancas.map((c) => [c.descricao, c.valorCentavos, c.situacao])).toEqual([
      ['Entrada', 60_000, 'ABERTA'], ['Parcela 1/3', 80_000, 'ABERTA'], ['Parcela 2/3', 80_000, 'ABERTA'], ['Parcela 3/3', 80_000, 'ABERTA'],
    ]);
    // O cartão já mostra o contrato: indicadores e as cobranças dele, sem "Alterar".
    await expect(page.getByLabel(/^Valor total: R\$ 3\.000,00/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Alterar', exact: true })).toHaveCount(0);
    // A ficha chama outras rotas (pastas, lesões...) que este teste não simula; as do financeiro têm de estar todas.
    expect(naoTratadas.filter((r) => /contrat|financeiro|cobranc/.test(r))).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`contratar entrada + saldo livre em ${sufixo}: sem parcelas, a entrada paga com a forma e o corpo do saldo livre`, async ({ page }) => {
    const estado = estadoFinanceiro({ planos: [{ ...PLANO }] });
    const { pedidos, errosDaPagina } = await abrir(page, largura, tema, estado);
    await page.getByRole('button', { name: 'Contratar plano' }).click();
    const folha = page.getByRole('dialog', { name: 'Contratar plano' });
    await folha.getByRole('button', { name: /^Plano:/ }).click();
    await page.getByRole('radio', { name: /^Contrato Trimestral/ }).click();
    await folha.getByRole('radiogroup', { name: 'Como cobrar' }).getByRole('radio', { name: /^Entrada \+ saldo livre/ }).click();
    await folha.getByLabel('Valor total do contrato').fill('2.000,00');
    // Entrada acima do total: a prévia responde 422 no campo da entrada e o botão trava com o motivo.
    await folha.getByLabel('Valor da entrada').fill('2.500,00');
    await expect(folha.getByText('A entrada não pode passar do valor total.')).toBeVisible();
    await expect(folha.getByRole('button', { name: 'Criar contrato' })).toBeDisabled();
    await expect(folha.getByText('Preencha os campos destacados.')).toBeVisible();
    await folha.getByLabel('Valor da entrada').fill('500,00');
    await expect(folha.getByText('A entrada cabe no valor total')).toBeVisible();
    await folha.getByRole('switch', { name: 'A entrada já foi paga' }).click();
    await folha.getByRole('radiogroup', { name: 'Como foi paga' }).getByRole('radio', { name: 'Pix direto' }).click();
    await expect(folha.getByText('1 cobrança (a entrada). Cada pagamento do saldo vira outra.')).toBeVisible();
    await expect(folha.getByText('A entrada cabe no valor total')).toBeVisible();
    await page.screenshot({ path: captura(`contratar-saldo-livre-${sufixo}`), fullPage: true });
    await folha.getByRole('button', { name: 'Criar contrato' }).click();
    await expect(page.getByText('Contrato criado.')).toBeVisible();
    // A prévia do saldo livre leva só o total e a entrada.
    expect(estado.previasDoContrato.at(-1)).toEqual({ modoCobranca: 'SALDO_ABERTO', valorTotalCentavos: 200_000, entrada: { valorCentavos: 50_000, data: '2026-10-19', jaPaga: true, forma: 'PIX_DIRETO' } });
    expect(pedidos.find((p) => p.metodo === 'POST' && p.caminho.endsWith('/contratacoes'))?.corpo).toEqual({
      planoComercialId: PLANO.id, inicio: '2026-10-19',
      modoCobranca: 'SALDO_ABERTO', valorTotalCentavos: 200_000, entrada: { valorCentavos: 50_000, data: '2026-10-19', jaPaga: true, forma: 'PIX_DIRETO' },
    });
    await expect(page.getByRole('button', { name: 'Registrar pagamento do saldo' })).toBeEnabled();
    expect(errosDaPagina).toEqual([]);
  });

  test(`cartão do contrato com atraso e encerrar com multa em ${sufixo}: indicadores, pílula "Vencida", seções e a multa`, async ({ page }) => {
    const estado = estadoFinanceiro({
      planos: [{ ...PLANO }], contratacoes: [{ ...CONTRATACAO }], cobrancas: PARCELADO.map((c) => ({ ...c })),
      contratos: { [CONTRATACAO.id]: { modo: 'PARCELADO_FIXO', valorTotalCentavos: 300_000 } },
    });
    const { errosDaPagina, naoTratadas } = await abrir(page, largura, tema, estado);
    await expect(page.getByText('Entrada + 3 parcelas fixas · de 24/08/2026 a 24/11/2026')).toBeVisible();
    await expect(page.getByLabel('Valor total: R$ 3.000,00')).toBeVisible();
    await expect(page.getByLabel('Pago: R$ 1.400,00. 2 de 4 cobranças')).toBeVisible();
    await expect(page.getByLabel('Falta pagar: R$ 1.600,00. 1 vencida · 1 a vencer')).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Pago do contrato' })).toHaveAttribute('aria-valuetext', 'Pago R$ 1.400,00 de R$ 3.000,00');
    await expect(page.getByText('1 cobrança vencida · a mais antiga há 25 dias')).toBeVisible();
    await expect(page.getByText('R$ 800,00 em atraso (Parcela 2/3, venceu em 24/09/2026).')).toBeVisible();
    const vencida = page.getByRole('button', { name: 'Abrir Parcela 2/3, Vencida' });
    await expect(vencida).toBeVisible();
    await expect(vencida.getByText('Vencida', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Alterar', exact: true })).toHaveCount(0);
    // Sem pausa no contrato fechado: não há mensalidade a suspender.
    await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toHaveCount(0);
    const cartao = page.getByText('Plano contratado', { exact: true }).first();
    // A ficha rola por dentro (ScrollView): sobe o título do cartão para o topo antes da captura.
    await cartao.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: captura(`cartao-com-atraso-${sufixo}`) });

    // A folha da parcela do contrato não oferece "Desfazer acordo" nem "Renegociar" (D2 e D11).
    await vencida.click();
    const daParcela = page.getByRole('dialog').last();
    await expect(daParcela.getByRole('button', { name: 'Registrar pagamento' })).toBeVisible();
    await expect(daParcela.getByRole('button', { name: 'Desfazer acordo' })).toHaveCount(0);
    await expect(daParcela.getByRole('button', { name: 'Renegociar' })).toHaveCount(0);
    await daParcela.getByRole('button', { name: /Fechar/ }).first().click();

    await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
    const folha = page.getByRole('dialog', { name: 'Encerrar contrato antes do fim?' });
    await expect(folha.getByRole('list', { name: 'Serão canceladas' }).getByText('Parcela 3/3')).toBeVisible();
    await expect(folha.getByRole('list', { name: 'Continua em aberto' }).getByText('Parcela 2/3')).toBeVisible();
    await expect(folha.getByRole('list', { name: 'Continua em aberto' }).getByText('Vencida', { exact: true })).toBeVisible();
    await expect(folha.getByText('Ao encerrar: o contrato fica Encerrado e 1 cobrança futura é cancelada.')).toBeVisible();
    await expect(folha.getByRole('radio', { name: 'Meses que faltam para o mínimo' })).toHaveCount(0);
    await folha.getByRole('radiogroup', { name: 'Multa rescisória (opcional)' }).getByRole('radio', { name: 'Multa rescisória' }).click();
    await folha.getByLabel('Valor da multa').fill('300,00');
    await folha.getByLabel('Vence em').fill('01/12/2026');
    await expect(folha.getByText('O valor é você quem define, como combinado no contrato. O app não calcula multa nem juros.')).toBeVisible();
    await expect(folha.getByText('Ao encerrar: o contrato fica Encerrado, 1 cobrança futura é cancelada e é criada 1 cobrança de multa rescisória de R$ 300,00 com vencimento em 01/12/2026.')).toBeVisible();
    await page.screenshot({ path: captura(`encerrar-com-multa-${sufixo}`), fullPage: true });
    await folha.getByRole('list', { name: 'Serão canceladas' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: captura(`encerrar-com-multa-topo-${sufixo}`), fullPage: true });
    await folha.getByRole('button', { name: 'Encerrar contrato' }).click();
    await expect(page.getByText('Contrato encerrado. A cobrança da multa rescisória foi criada.')).toBeVisible();
    // O fechado sempre manda os ids das futuras que a prévia listou (a API confere e dá 409 se mudaram).
    expect(estado.encerramentos).toEqual([{ versao: 0, saida: { opcao: 'OUTRO', valorCentavos: 30_000, vencimento: '2026-12-01', cobrancasACancelar: ['c0000000-0000-4000-8000-0000000000c4'] } }]);
    expect(estado.cobrancas.find((c) => c.descricao === 'Parcela 3/3')?.situacao).toBe('CANCELADA');
    expect(estado.cobrancas.find((c) => c.descricao === 'Parcela 2/3')?.situacao).toBe('ABERTA');
    // A ficha chama outras rotas (pastas, lesões...) que este teste não simula; as do financeiro têm de estar todas.
    expect(naoTratadas.filter((r) => /contrat|financeiro|cobranc/.test(r))).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`registrar pagamento do saldo em ${sufixo}: saldo e limite da API, acima do limite no campo, depois paga`, async ({ page }) => {
    const estado = estadoFinanceiro({
      planos: [{ ...PLANO }], contratacoes: [{ ...CONTRATACAO }], cobrancas: SALDO.map((c) => ({ ...c })),
      contratos: { [CONTRATACAO.id]: { modo: 'SALDO_ABERTO', valorTotalCentavos: 200_000 } },
    });
    const { errosDaPagina } = await abrir(page, largura, tema, estado);
    await expect(page.getByText('Entrada + saldo livre · de 24/08/2026 a 24/11/2026')).toBeVisible();
    await page.getByRole('button', { name: 'Registrar pagamento do saldo' }).click();
    const folha = page.getByRole('dialog', { name: 'Registrar pagamento do saldo' });
    await expect(folha.getByLabel('Falta pagar: R$ 1.500,00')).toBeVisible();
    await expect(folha.getByLabel('Dá para lançar até: R$ 1.200,00')).toBeVisible();
    await folha.getByLabel('Valor', { exact: true }).fill('1.300,00');
    await folha.getByRole('radiogroup', { name: 'Como o aluno pagou' }).getByRole('radio', { name: 'Pix direto' }).click();
    await folha.getByRole('button', { name: 'Registrar pagamento' }).click();
    await expect(folha.getByText('O valor passa do que falta pagar no contrato.')).toBeVisible();
    await page.screenshot({ path: captura(`saldo-acima-do-limite-${sufixo}`), fullPage: true });
    await folha.getByLabel('Valor', { exact: true }).fill('200,00');
    await folha.getByRole('button', { name: 'Registrar pagamento' }).click();
    await expect(page.getByText('Pagamento registrado.')).toBeVisible();
    // O mesmo pedido nas duas tentativas (idempotência por abertura da folha).
    expect(estado.pagamentosDoSaldo.map((p) => p.valorCentavos)).toEqual([130_000, 20_000]);
    expect(new Set(estado.pagamentosDoSaldo.map((p) => p.pedidoId)).size).toBe(1);
    expect(estado.pagamentosDoSaldo[1]).toMatchObject({ vencimento: '2026-10-19', jaPaga: true, forma: 'PIX_DIRETO' });
    await expect(page.getByLabel(/^Pago: R\$ 700,00/)).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });

  test(`lista de alunos em ${sufixo}: a pílula "Cobrança vencida" ao lado de quem está em atraso`, async ({ page }) => {
    const alunos: AlunoResumo[] = [
      { id: ALUNO_FINANCEIRO_ID, nome: ALUNO.nome, ativo: true, temAcesso: true, planoAtivo: null, ultimoRegistro: null, responsavelId: null },
      { id: 'a0000000-0000-4000-8000-0000000000e2', nome: 'Bruno Exemplo da Silva', ativo: true, temAcesso: true, planoAtivo: null, ultimoRegistro: null, responsavelId: null },
    ];
    const estado = estadoFinanceiro({ alunos, alunosEmAtraso: { alunoIds: [ALUNO_FINANCEIRO_ID], truncado: false } });
    const { errosDaPagina } = await abrir(page, largura, tema, estado, '/treinador/alunos');
    const comAtraso = page.getByRole('link', { name: new RegExp(`^Abrir ${ALUNO.nome}\\. Cobrança vencida`) });
    await expect(comAtraso).toBeVisible();
    await expect(comAtraso.getByText('Cobrança vencida', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /^Abrir Bruno Exemplo/ }).getByText('Cobrança vencida', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: captura(`lista-de-alunos-${sufixo}`), fullPage: true });
    expect(errosDaPagina).toEqual([]);
  });
}

for (const largura of [390, 1280]) {
  test(`saldo zerado em ${largura}: o botão fica desabilitado com o motivo; financeiro desligado tira a pílula da lista sem erro`, async ({ page }) => {
    const quitado = [cobranca('c0000000-0000-4000-8000-0000000000f1', { tipo: 'AVULSA', descricao: 'Entrada', vencimento: '2026-08-24', valorCentavos: 200_000, ...paga('2026-08-24') })];
    const estado = estadoFinanceiro({
      planos: [{ ...PLANO }], contratacoes: [{ ...CONTRATACAO }], cobrancas: quitado,
      contratos: { [CONTRATACAO.id]: { modo: 'SALDO_ABERTO', valorTotalCentavos: 200_000 } }, alunosEmAtraso: null,
      alunos: [{ id: ALUNO_FINANCEIRO_ID, nome: ALUNO.nome, ativo: true, temAcesso: true, planoAtivo: null, ultimoRegistro: null, responsavelId: null }],
    });
    const { errosDaPagina } = await abrir(page, largura, 'ESCURO', estado);
    const botao = page.getByRole('button', { name: 'Registrar pagamento do saldo' });
    await expect(botao).toBeDisabled();
    await expect(page.getByText('O contrato está quitado: não há saldo a receber.')).toBeVisible();
    await expect(page.getByLabel('Falta pagar: R$ 0,00. Contrato quitado')).toBeVisible();
    await page.getByText('Plano contratado', { exact: true }).first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: captura(`saldo-zerado-${largura}-escuro`) });

    await page.goto('/treinador/alunos');
    await expect(page.getByRole('link', { name: new RegExp(`^Abrir ${ALUNO.nome}`) })).toBeVisible();
    await expect(page.getByText('Cobrança vencida', { exact: true })).toHaveCount(0);
    await expect(page.getByText('O financeiro está desligado.')).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
}

test('encerrar contrato em 1280: as futuras mudaram (409), a prévia recarrega e a multa continua escolhida', async ({ page }) => {
  const estado = estadoFinanceiro({
    planos: [{ ...PLANO }], contratacoes: [{ ...CONTRATACAO }], cobrancas: PARCELADO.map((c) => ({ ...c })),
    contratos: { [CONTRATACAO.id]: { modo: 'PARCELADO_FIXO', valorTotalCentavos: 300_000 } },
  });
  const { errosDaPagina } = await abrir(page, 1280, 'ESCURO', estado);
  await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
  const folha = page.getByRole('dialog', { name: 'Encerrar contrato antes do fim?' });
  await expect(folha.getByRole('list', { name: 'Serão canceladas' }).getByText('Parcela 3/3')).toBeVisible();
  const multa = folha.getByRole('radiogroup', { name: 'Multa rescisória (opcional)' }).getByRole('radio', { name: 'Multa rescisória' });
  await multa.click();
  await folha.getByLabel('Valor da multa').fill('300,00');
  // Enquanto a folha estava aberta nasceu outra cobrança futura do contrato: a lista enviada não bate com a do servidor.
  estado.cobrancas.push(cobranca('c0000000-0000-4000-8000-0000000000c9', { tipo: 'AVULSA', descricao: 'Pagamento extra', vencimento: '2026-12-10', valorCentavos: 10_000, situacao: 'ABERTA' }));
  await folha.getByRole('button', { name: 'Encerrar contrato' }).click();
  await expect(folha.getByRole('list', { name: 'Serão canceladas' }).getByText('Pagamento extra')).toBeVisible();
  expect(estado.contratacoes[0].situacao).toBe('ATIVA');
  await expect(multa).toBeChecked();
  await folha.getByRole('button', { name: 'Encerrar contrato' }).click();
  await expect(page.getByText('Contrato encerrado. A cobrança da multa rescisória foi criada.')).toBeVisible();
  expect(estado.encerramentos.map((e) => e.saida?.cobrancasACancelar)).toEqual([
    ['c0000000-0000-4000-8000-0000000000c4'], ['c0000000-0000-4000-8000-0000000000c4', 'c0000000-0000-4000-8000-0000000000c9'],
  ]);
  expect(estado.encerramentos.map((e) => e.saida?.opcao)).toEqual(['OUTRO', 'OUTRO']);
  expect(errosDaPagina).toEqual([]);
});

test('pagamento do saldo em aberto em 390: a folha da cobrança nova abre depois de recarregar', async ({ page }) => {
  const estado = estadoFinanceiro({
    planos: [{ ...PLANO }], contratacoes: [{ ...CONTRATACAO }], cobrancas: SALDO.map((c) => ({ ...c })),
    contratos: { [CONTRATACAO.id]: { modo: 'SALDO_ABERTO', valorTotalCentavos: 200_000 } },
  });
  const { errosDaPagina } = await abrir(page, 390, 'ESCURO', estado);
  await page.getByRole('button', { name: 'Registrar pagamento do saldo' }).click();
  const folha = page.getByRole('dialog', { name: 'Registrar pagamento do saldo' });
  await folha.getByLabel('Valor', { exact: true }).fill('400,00');
  await folha.getByRole('radiogroup', { name: 'Situação' }).getByRole('radio', { name: 'Fica em aberto' }).click();
  await folha.getByLabel('Vencimento').fill('30/10/2026');
  await folha.getByRole('button', { name: 'Criar cobrança' }).click();
  await expect(page.getByText('Cobrança criada em aberto. Copie o link de pagamento na folha dela.')).toBeVisible();
  const daCobranca = page.getByRole('dialog').last();
  await expect(daCobranca.getByText('R$ 400,00').first()).toBeVisible();
  await expect(daCobranca.getByText('30/10/2026').first()).toBeVisible();
  expect(estado.pagamentosDoSaldo.at(-1)).toMatchObject({ valorCentavos: 40_000, vencimento: '2026-10-30', jaPaga: false });
  expect(errosDaPagina).toEqual([]);
});

test('pagamento do saldo em 390: o pedido já existia com outros dados (409), a mensagem da API e um pedido novo no próximo toque', async ({ page }) => {
  const estado = estadoFinanceiro({
    planos: [{ ...PLANO }], contratacoes: [{ ...CONTRATACAO }], cobrancas: SALDO.map((c) => ({ ...c })),
    contratos: { [CONTRATACAO.id]: { modo: 'SALDO_ABERTO', valorTotalCentavos: 200_000 } }, pedidoDoSaldoJaUsado: true,
  });
  const { errosDaPagina } = await abrir(page, 390, 'ESCURO', estado);
  await page.getByRole('button', { name: 'Registrar pagamento do saldo' }).click();
  const folha = page.getByRole('dialog', { name: 'Registrar pagamento do saldo' });
  await folha.getByLabel('Valor', { exact: true }).fill('200,00');
  await folha.getByRole('radiogroup', { name: 'Como o aluno pagou' }).getByRole('radio', { name: 'Pix direto' }).click();
  await folha.getByRole('button', { name: 'Registrar pagamento' }).click();
  await expect(folha.getByText('Este pedido já foi usado em outra cobrança.')).toBeVisible();
  await expect(page.getByText('Pagamento registrado.')).toHaveCount(0);
  await folha.getByRole('button', { name: 'Registrar pagamento' }).click();
  await expect(page.getByText('Pagamento registrado.')).toBeVisible();
  const [primeiro, segundo] = estado.pagamentosDoSaldo;
  expect(segundo.pedidoId).not.toBe(primeiro.pedidoId);
  expect(errosDaPagina).toEqual([]);
});

test('contratar parcelado em 1280: datas fora de ordem vão ordenadas à API com o rótulo na linha certa, e parcela depois do fim passa', async ({ page }) => {
  const estado = estadoFinanceiro({ planos: [{ ...PLANO }] });
  const { errosDaPagina } = await abrir(page, 1280, 'ESCURO', estado);
  await page.getByRole('button', { name: 'Contratar plano' }).click();
  const folha = page.getByRole('dialog', { name: 'Contratar plano' });
  await folha.getByRole('button', { name: /^Plano:/ }).click();
  await page.getByRole('radio', { name: /^Contrato Trimestral/ }).click();
  await folha.getByRole('radiogroup', { name: 'Como cobrar' }).getByRole('radio', { name: /^Entrada \+ parcelas fixas/ }).click();
  await folha.getByLabel('Valor total do contrato').fill('3.000,00');
  await folha.getByLabel('Valor da entrada').fill('600,00');
  await expect(folha.getByText('A soma fecha com o valor total')).toBeVisible();
  const linha = (n: number) => folha.getByRole('row').filter({ has: page.getByLabel(`Vencimento da parcela ${n}`) });

  // A primeira linha passa a vencer depois da segunda: a tela mantém a ordem digitada, o corpo vai por vencimento e o
  // rótulo da linha é o da posição dela na ordem da API.
  await folha.getByLabel('Vencimento da parcela 1').fill('20/12/2026');
  await expect.poll(() => estado.previasDoContrato.at(-1)?.parcelas?.map((p) => p.vencimento)).toEqual(['2026-12-19', '2026-12-20', '2027-01-19']);
  await expect(linha(1)).toContainText('Parcela 2/3');
  await expect(linha(2)).toContainText('Parcela 1/3');

  await page.screenshot({ path: captura('parcelas-fora-de-ordem-1280-escuro') });

  // Parcela depois do fim da vigência (trimestral desde 19/10/2026 termina em 19/01/2027) é venda normal: a soma fecha e o
  // "Criar contrato" fica habilitado; a prévia não leva plano nem início.
  await folha.getByLabel('Vencimento da parcela 3').fill('19/04/2027');
  await expect.poll(() => estado.previasDoContrato.at(-1)?.parcelas?.map((p) => p.vencimento)).toEqual(['2026-12-19', '2026-12-20', '2027-04-19']);
  await expect(folha.getByText('A soma fecha com o valor total')).toBeVisible();
  await expect(folha.getByRole('button', { name: 'Criar contrato' })).toBeEnabled();
  expect(estado.previasDoContrato.every((p) => !('planoComercialId' in p) && !('inicio' in p))).toBe(true);
  expect(errosDaPagina).toEqual([]);
});

/** O contrato da prancha (parcelado com a Parcela 2 vencida) ativo: o inativar fica travado até encerrar (D13). */
const comContratoVigente = (extra: Parameters<typeof estadoFinanceiro>[0] = {}) => estadoFinanceiro({
  planos: [{ ...PLANO }], contratacoes: [{ ...CONTRATACAO }], cobrancas: PARCELADO.map((c) => ({ ...c })),
  contratos: { [CONTRATACAO.id]: { modo: 'PARCELADO_FIXO', valorTotalCentavos: 300_000 } }, ...extra,
});

for (const [largura, tema] of [[390, 'ESCURO'], [1280, 'CLARO']] as const) {
  const sufixo = `${largura}-${tema.toLowerCase()}`;
  test(`inativar com contrato fechado vigente em ${sufixo}: o aviso no lugar das linhas, "Inativar" travado com o motivo, encerrar pelo painel e inativar`, async ({ page }) => {
    const estado = comContratoVigente();
    const { errosDaPagina, pedidos, naoTratadas } = await abrir(page, largura, tema, estado);
    await page.getByRole('button', { name: 'Mais ações do aluno', exact: true }).click();
    await page.getByText('Inativar aluno', { exact: true }).click();
    const painel = page.getByRole('alertdialog', { name: `Inativar ${ALUNO.nome}?` });
    await expect(painel.getByText('Encerre o contrato antes de inativar (com ou sem multa).')).toBeVisible();
    await expect(painel.getByText(/serão canceladas|continua em aberto/)).toHaveCount(0);
    await expect(painel.getByRole('button', { name: /^Inativar/ })).toBeDisabled();
    await expect(painel.getByText('Falta encerrar o contrato.')).toBeVisible();
    await page.screenshot({ path: captura(`inativar-com-contrato-${sufixo}`) });

    // "Encerrar contrato" troca o painel pela folha (um diálogo por vez); encerrar sem multa e o painel volta ao normal.
    await painel.getByRole('button', { name: 'Encerrar contrato' }).click();
    const folha = page.getByRole('dialog', { name: 'Encerrar contrato antes do fim?' });
    await expect(folha).toBeVisible();
    await expect(painel).toHaveCount(0);
    await folha.getByRole('button', { name: 'Encerrar contrato' }).click();
    await expect(page.getByText(/^Contrato encerrado/)).toBeVisible();
    await expect(painel).toBeVisible();
    await expect(painel.getByText('Encerre o contrato antes de inativar (com ou sem multa).')).toHaveCount(0);
    const inativar = painel.getByRole('button', { name: 'Inativar', exact: true });
    await expect(inativar).toBeEnabled();
    await inativar.click();
    await expect(page.getByText('Aluno inativado. O acesso ao app foi encerrado.')).toBeVisible();
    expect(pedidos.filter((p) => p.metodo === 'PATCH' && p.caminho === `/alunos/${ALUNO_FINANCEIRO_ID}/situacao`).map((p) => p.corpo)).toEqual([{ ativo: false }]);
    expect(pedidos.filter((p) => p.caminho === `/alunos/${ALUNO_FINANCEIRO_ID}/resumo-da-saida`).length).toBeGreaterThanOrEqual(2);
    expect(naoTratadas.filter((r) => /contrat|financeiro|cobranc|situacao|resumo-da-saida/.test(r))).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('inativar sem a permissão do Financeiro e com contrato fechado vigente em 390: o 409 da API fica no painel e trava o "Inativar"', async ({ page }) => {
  const { errosDaPagina, pedidos } = await abrir(page, 390, 'ESCURO', comContratoVigente(), undefined, []);
  await page.getByRole('button', { name: 'Mais ações do aluno', exact: true }).click();
  await page.getByText('Inativar aluno', { exact: true }).click();
  const painel = page.getByRole('alertdialog', { name: `Inativar ${ALUNO.nome}?` });
  await painel.getByRole('button', { name: 'Inativar', exact: true }).click();
  await expect(painel.getByText('Encerre o contrato antes de inativar (com ou sem multa).')).toBeVisible();
  await expect(painel.getByRole('button', { name: /^Inativar/ })).toBeDisabled();
  await expect(painel.getByText('Falta encerrar o contrato.')).toBeVisible();
  // Sem `FINANCEIRO_ALTERAR` não há como encerrar daqui: só o aviso.
  await expect(painel.getByRole('button', { name: 'Encerrar contrato' })).toHaveCount(0);
  expect(pedidos.filter((p) => p.caminho.endsWith('/resumo-da-saida'))).toHaveLength(0);
  await page.screenshot({ path: captura('inativar-409-sem-financeiro-390-escuro') });
  expect(errosDaPagina).toEqual([]);
});

test('desativar em lote em 1280: quem tem contrato fechado vigente fica de fora e o aviso diz quantos e por quê', async ({ page }) => {
  const alunos: AlunoResumo[] = [
    { id: ALUNO_FINANCEIRO_ID, nome: ALUNO.nome, ativo: true, temAcesso: true, planoAtivo: null, ultimoRegistro: null, responsavelId: null },
    { id: 'a0000000-0000-4000-8000-0000000000e2', nome: 'Bruno Exemplo da Silva', ativo: true, temAcesso: true, planoAtivo: null, ultimoRegistro: null, responsavelId: null },
  ];
  const estado = comContratoVigente({ alunos });
  const { errosDaPagina } = await abrir(page, 1280, 'ESCURO', estado, '/treinador/alunos');
  await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
  await page.getByRole('button', { name: 'Marcar visíveis' }).click();
  await page.getByRole('button', { name: 'Ações', exact: true }).click();
  await page.getByRole('button', { name: 'Desativar', exact: true }).click();
  await page.getByRole('alertdialog', { name: 'Desativar os alunos marcados?' }).getByRole('button', { name: 'Desativar', exact: true }).click();
  await expect(page.getByText('1 aluno desativado. 1 não foi desativado: encerre o contrato antes (com ou sem multa).')).toBeVisible();
  expect(estado.alunos.map((a) => a.ativo)).toEqual([true, false]);
  expect(errosDaPagina).toEqual([]);
});
