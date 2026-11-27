import { expect, test, type Page } from '@playwright/test';

import type { FinanceiroDoAluno } from '../src/api/financeiroTipos';
import { ALUNO, json, sessao, simularApi, type RespostasApi } from './api-falsa';
import { fixarHoje, sessaoDeAluno } from './aluno';

/**
 * Overtraining Pay — jornada do aluno (Onda 3 E2E):
 * Conta › Meu plano (incluindo parcela vencida de Contrato Fechado) ->
 * abre FolhaCheckoutTransparente sem sair do app ->
 * pede CPF quando ausente -> gera QR Code Pix + Copia e Cola ->
 * confirma via polling ("Pagamento confirmado!") +
 * cartão pela página de pagamento do Asaas: "Pagar com cartão" abre a URL https fora do app e, ao voltar, o app confere a
 * situação. Nenhum campo de cartão existe no app.
 */

const PASTA_SWARM = 'C:/Users/gusta/.gemini/antigravity/brain/b355d9f2-0cd6-4d13-b55f-caccceb70abe';
const QR_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PIX_COPIA_E_COLA = '00020126580014br.gov.bcb.pix0136cobranca-aluno-ficticia-0015204000053039865406300.005802BR5916Treinadora Teste6008Cascavel6304EFGH';

const COBRANCA_VENCIDA_CONTRATO_ID = 'c0000000-0000-4000-8000-000000000101';
const COBRANCA_A_VENCER_ID = 'c0000000-0000-4000-8000-000000000102';
const URL_DA_FATURA = 'https://pagamento.asaas.exemplo.invalid/i/fatura-ficticia';

const TEMAS = ['ESCURO', 'CLARO', 'AREIA'] as const;
const LARGURAS = [390, 1280] as const;

type FinanceiroDoAlunoOvertraining = FinanceiroDoAluno & {
  overtrainingPayDisponivel: boolean;
  cpfPagadorCadastrado: boolean;
};

async function definirTema(page: Page, tema: (typeof TEMAS)[number]) {
  await page.addInitScript(([id, t]) => {
    localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t }));
  }, [ALUNO.id, tema] as const);
}

async function semRolagemHorizontal(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra).toBeLessThanOrEqual(0);
}

async function areaDeTransferencia(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (texto: string) => {
          (window as unknown as { __copiado?: string }).__copiado = texto;
          return Promise.resolve();
        },
      },
    });
  });
}

function financeiroInicial(cpfCadastrado = false): FinanceiroDoAlunoOvertraining {
  return {
    pagamentoOnline: true,
    formasDePagamento: ['MANUAL'],
    overtrainingPayDisponivel: true,
    cpfPagadorCadastrado: cpfCadastrado,
    plano: {
      contratacaoId: 'e0000000-0000-4000-8000-000000000101',
      planoNome: 'Contrato Semestral Fechado',
      periodicidade: 'SEMESTRAL',
      valorCentavos: 180_000,
      situacao: 'ATIVA',
      proximoVencimento: '2026-10-10',
      contratoFechado: true,
      linkDePagamento: null,
      terminoVigencia: '2027-03-10',
      diasRestantesVigencia: 142,
    },
    abertas: [
      {
        id: COBRANCA_VENCIDA_CONTRATO_ID,
        tipo: 'RENEGOCIACAO',
        descricao: 'Parcela 2/6',
        competencia: null,
        vencimento: '2026-10-10',
        valorCentavos: 30_000,
        situacao: 'ABERTA',
        vencida: true,
        forma: null,
        pagoEm: null,
        doContrato: true,
      },
      {
        id: COBRANCA_A_VENCER_ID,
        tipo: 'RENEGOCIACAO',
        descricao: 'Parcela 3/6',
        competencia: null,
        vencimento: '2026-11-10',
        valorCentavos: 30_000,
        situacao: 'ABERTA',
        vencida: false,
        forma: null,
        pagoEm: null,
        doContrato: true,
      },
    ],
    historico: [],
  };
}

async function abrirContaAlunoComOvertrainingPay(page: Page, cpfCadastrado = false) {
  await fixarHoje(page);
  let dados = financeiroInicial(cpfCadastrado);
  const pixPedidos: unknown[] = [];
  const faturaPedidos: unknown[] = [];
  let consultasSituacao = 0;
  const fatura = { consultas: 0, paga: false };

  const rotasExtras: RespostasApi = {
    'GET /aluno/foto-perfil': { status: 204 },
    'GET /aluno/uso-de-imagem': { corpo: { autorizado: false } },
    'GET /aluno/financeiro': (_p, route) => json(route, dados),
    'GET /aluno/lembretes-de-cobranca': { corpo: { recebeLembretes: true } },
    [`POST /aluno/financeiro/cobrancas/${COBRANCA_VENCIDA_CONTRATO_ID}/overtraining-pay/pix`]: (pedido, route) => {
      pixPedidos.push(pedido.corpo);
      return json(route, {
        cobrancaId: COBRANCA_VENCIDA_CONTRATO_ID,
        asaasCobrancaId: 'pay_ficticio_pix_01',
        valorCentavos: 30_000,
        qrCodeBase64: QR_PNG_BASE64,
        codigoCopiaECola: PIX_COPIA_E_COLA,
        expiraEm: '2026-10-19T23:59:59Z',
      });
    },
    [`GET /aluno/financeiro/cobrancas/${COBRANCA_VENCIDA_CONTRATO_ID}/situacao`]: (_p, route) => {
      consultasSituacao += 1;
      dados = {
        ...dados,
        cpfPagadorCadastrado: true,
        abertas: dados.abertas.filter((c) => c.id !== COBRANCA_VENCIDA_CONTRATO_ID),
        historico: [
          {
            id: COBRANCA_VENCIDA_CONTRATO_ID,
            tipo: 'RENEGOCIACAO',
            descricao: 'Parcela 2/6',
            competencia: null,
            vencimento: '2026-10-10',
            valorCentavos: 30_000,
            situacao: 'PAGA',
            vencida: false,
            forma: 'PIX_DIRETO',
            pagoEm: '2026-10-19',
            doContrato: true,
          },
        ],
      };
      return json(route, {
        cobrancaId: COBRANCA_VENCIDA_CONTRATO_ID,
        situacao: 'PAGA',
        pagoEm: '2026-10-19T15:00:00Z',
      });
    },
    [`POST /aluno/financeiro/cobrancas/${COBRANCA_A_VENCER_ID}/overtraining-pay/fatura`]: (pedido, route) => {
      faturaPedidos.push(pedido.corpo);
      return json(route, { url: URL_DA_FATURA });
    },
    // Fica aberta até a "volta" do navegador (o teste liga `fatura.paga`): prova que o app confere ao voltar.
    [`GET /aluno/financeiro/cobrancas/${COBRANCA_A_VENCER_ID}/situacao`]: (_p, route) => {
      fatura.consultas += 1;
      if (fatura.paga) dados = { ...dados, abertas: dados.abertas.filter((c) => c.id !== COBRANCA_A_VENCER_ID) };
      return json(route, {
        cobrancaId: COBRANCA_A_VENCER_ID,
        situacao: fatura.paga ? 'PAGA' : 'ABERTA',
        pagoEm: fatura.paga ? '2026-10-19T15:05:00Z' : null,
      });
    },
  };

  const api = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    ...(await sessao(page, ALUNO, { pagamentosHabilitados: true })),
    ...rotasExtras,
  });

  await page.goto('/aluno/conta');
  await expect(page.getByText('Contrato Semestral Fechado')).toBeVisible();
  return { api, pixPedidos, faturaPedidos, fatura, obterConsultasSituacao: () => consultasSituacao };
}

for (const largura of LARGURAS) {
  test(`aluno em ${largura}px: parcela vencida de Contrato Fechado -> Pix com CPF + polling e cartão pela página do Asaas`, async ({ page, context }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await definirTema(page, 'CLARO');
    await areaDeTransferencia(page);
    await context.route('https://pagamento.asaas.exemplo.invalid/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Fatura Asaas</title><p>Pagamento externo</p>' }));
    const { api, pixPedidos, faturaPedidos, fatura, obterConsultasSituacao } = await abrirContaAlunoComOvertrainingPay(page, false);

    // 1. Parcela vencida de Contrato Fechado visível e abre Checkout Transparente sem sair do app
    await expect(page.getByText('Parcela 2/6')).toBeVisible();
    await page.getByRole('button', { name: /Pagar agora: Parcela 2\/6/i }).click();

    const folha = page.getByRole('dialog', { name: 'Pagamento no app' });
    await expect(folha).toBeVisible();
    await expect(folha.getByText(/Venceu em 10\/10\/2026/)).toBeVisible();

    // 2. Pede CPF quando ausente e valida antes de gerar QR Code Pix
    await folha.getByRole('button', { name: 'Gerar QR Code Pix' }).click();
    await expect(folha.getByText('Informe o CPF do pagador.')).toBeVisible();
    expect(pixPedidos).toHaveLength(0);

    await folha.getByLabel('CPF do pagador').fill('52998224725');
    await folha.getByRole('button', { name: 'Gerar QR Code Pix' }).click();

    await expect(folha.getByLabel('QR Code Pix para pagamento')).toBeVisible();
    expect(pixPedidos).toEqual([{ cpfPagador: '52998224725' }]);

    if (largura === 390) {
      await page.screenshot({ path: `${PASTA_SWARM}/overtraining-aluno-checkout.png` });
    }

    await folha.getByRole('button', { name: 'Copiar código Pix copia e cola' }).click();
    await expect(page.getByText(/Código Pix copiado/)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __copiado?: string }).__copiado)).toBe(PIX_COPIA_E_COLA);

    // 3. Confirmação automática via polling
    await expect(folha.getByText('Pagamento confirmado!')).toBeVisible({ timeout: 10_000 });
    expect(obterConsultasSituacao()).toBeGreaterThanOrEqual(1);
    await folha.getByRole('button', { name: 'Fechar' }).last().click();
    await expect(folha).toHaveCount(0);

    // 4. Cartão pela página do Asaas na Parcela 3/6: sem formulário no app, abre a URL https fora dele
    await page.getByRole('button', { name: /Pagar agora: Parcela 3\/6/i }).click();
    const folhaCartao = page.getByRole('dialog', { name: 'Pagamento no app' });
    await expect(folhaCartao).toBeVisible();
    await expect(folhaCartao.getByRole('tab')).toHaveCount(0);
    for (const campo of ['Número do cartão', 'Validade', 'CVV', 'Nome impresso no cartão', 'CPF do titular', 'CEP']) {
      await expect(folhaCartao.getByLabel(campo)).toHaveCount(0);
    }
    await expect(folhaCartao.getByText(/não recebe nem guarda os dados do cartão/)).toBeVisible();

    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      folhaCartao.getByRole('button', { name: 'Pagar com cartão' }).click(),
    ]);
    await popup.waitForURL(URL_DA_FATURA);
    expect(await popup.evaluate(() => window.opener)).toBeNull();
    expect(faturaPedidos).toHaveLength(1);
    expect(faturaPedidos[0] ?? null).toBeNull();
    await expect(folhaCartao.getByText(/Aguardando pagamento/)).toBeVisible();

    // 5. Ao voltar ao app, confere a situação com a rota situacao e confirma quando PAGA
    await popup.close();
    const antes = fatura.consultas;
    fatura.paga = true;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(() => fatura.consultas).toBeGreaterThan(antes);
    await expect(folhaCartao.getByText('Pagamento confirmado!')).toBeVisible();
    await folhaCartao.getByRole('button', { name: 'Fechar' }).last().click();
    await expect(folhaCartao).toHaveCount(0);
    await expect(page.getByText('Parcela 3/6')).toHaveCount(0);

    await semRolagemHorizontal(page);
    expect(api.naoTratadas).toEqual([]);
    expect(api.errosDaPagina).toEqual([]);
  });
}

for (const tema of TEMAS) {
  for (const largura of LARGURAS) {
    test(`tema ${tema} em ${largura}px: Checkout Transparente do aluno sem rolagem horizontal`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await definirTema(page, tema);
      const { api } = await abrirContaAlunoComOvertrainingPay(page, true);

      await page.getByRole('button', { name: /Pagar agora: Parcela 2\/6/i }).click();
      const folha = page.getByRole('dialog', { name: 'Pagamento no app' });
      await expect(folha).toBeVisible();
      await expect(folha.getByLabel('CPF do pagador')).toHaveCount(0);
      await semRolagemHorizontal(page);
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });
  }
}
