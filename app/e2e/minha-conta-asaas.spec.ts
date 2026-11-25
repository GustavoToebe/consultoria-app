import { expect, test, type Page } from '@playwright/test';

import type { ConsumoDoPlano, MinhaConta } from '../src/api/tipos';
import { PERMISSOES_TREINADOR, json, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { fixarHoje } from './aluno';

/**
 * Minha conta — Asaas Checkout Transparente e Abatimento Automático pelo Split (Onda 5 E2E):
 * Treinador em Minha conta (`/treinador/minha-conta?aba=faturas`) vê o cartão de progresso
 * do Abatimento automático da mensalidade (`ABATER_MENSALIDADE`), abre o Checkout Transparente Asaas
 * (`FolhaPagamentoCentralAsaas`) com Pix/polling e Cartão de crédito, e conta com o botão secundário
 * de contingência (`Pagar por link externo`).
 */

const PASTA_SWARM = 'C:/Users/gusta/.gemini/antigravity/brain/b355d9f2-0cd6-4d13-b55f-caccceb70abe';
const QR_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PIX_FATURA_COPIA_E_COLA = '00020126580014br.gov.bcb.pix0136fatura-central-asaas-ficticia5204000053039865406199.005802BR5916OvertrainingApp6008Cascavel63041234';
const COBRANCA_CENTRAL_ID = 'f0000000-0000-4000-8000-000000000501';
const LINK_EXTERNO_CONTINGENCIA = 'https://pagamento.exemplo.invalid/fatura-central';

const TEMAS = ['ESCURO', 'CLARO', 'AREIA'] as const;
const LARGURAS = [390, 1280] as const;

type MinhaContaAsaas = MinhaConta & {
  provedorAtivo: 'ASAAS';
  politicaSplit: {
    modo: 'ABATER_MENSALIDADE';
    percentualBps: number;
    metaMensalCentavos: number;
    abatidoMesCentavos: number;
    restanteAbaterCentavos: number;
    cobrancaCentralId: string;
  };
};

async function definirTema(page: Page, tema: (typeof TEMAS)[number]) {
  await page.addInitScript(([id, t]) => {
    localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t }));
  }, [TREINADOR.id, tema] as const);
}

async function semRolagemHorizontal(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra).toBeLessThanOrEqual(0);
}

function minhaContaInicial(): MinhaContaAsaas {
  return {
    previa: false,
    provedorAtivo: 'ASAAS',
    politicaSplit: {
      modo: 'ABATER_MENSALIDADE',
      percentualBps: 1000,
      metaMensalCentavos: 19_900,
      abatidoMesCentavos: 12_000,
      restanteAbaterCentavos: 7_900,
      cobrancaCentralId: COBRANCA_CENTRAL_ID,
    },
    cliente: {
      nome: 'Consultoria Teste LTDA',
      documento: '11222333000181',
      endereco: {
        logradouro: 'Rua Exemplo',
        numero: '100',
        complemento: null,
        bairro: 'Centro',
        cidade: 'Cascavel',
        uf: 'PR',
        cep: '85801000',
      },
      contatos: [
        { nome: 'Treinadora Teste', email: 'treinadora@exemplo.test', telefone: '45999998888', principal: true },
      ],
    },
    contratacao: {
      planoNome: 'Plano Profissional',
      valor: 199,
      periodicidade: 'MENSAL',
      diaVencimento: 20,
      inicio: '2026-01-20',
      vigenteAte: null,
      situacaoComercial: 'ATIVA',
      nomeInstancia: 'equipe-teste',
      adicionais: [],
    },
    cobrancas: [
      {
        id: COBRANCA_CENTRAL_ID,
        competenciaInicio: '2026-10-01',
        competenciaFim: '2026-10-31',
        vencimento: '2026-10-20',
        valor: 199,
        situacao: 'ABERTA',
        vencida: false,
        pagoEm: null,
      },
    ],
  };
}

const CONSUMO_PADRAO: ConsumoDoPlano = {
  planoNome: 'Plano Profissional',
  versaoDireitos: 1,
  direitosConfirmadosEm: '2026-10-19T12:00:00Z',
  consultadoEm: '2026-10-19T12:00:00Z',
  itens: [
    { codigo: 'ALUNOS_ATIVOS', nome: 'Alunos ativos', usado: 18, limite: 50, disponivel: 32, unidade: 'alunos', estado: 'DISPONIVEL' },
  ],
};

async function abrirMinhaContaFaturas(page: Page) {
  await fixarHoje(page);
  let conta = minhaContaInicial();
  const pedidosPix: unknown[] = [];
  const pedidosLinkExterno: string[] = [];

  const rotasExtras: RespostasApi = {
    'GET /inscricoes': { corpo: [] },
    'GET /minha-conta': (_p, route) => json(route, conta),
    'GET /minha-conta/consumo': { corpo: CONSUMO_PADRAO },
    [`POST /minha-conta/cobrancas/${COBRANCA_CENTRAL_ID}/asaas/pix`]: (pedido, route) => {
      pedidosPix.push(pedido.corpo);
      return json(route, {
        cobrancaId: COBRANCA_CENTRAL_ID,
        idExterno: 'asaas_central_pix_1',
        valorCentavos: 19_900,
        qrCodeBase64: QR_PNG_BASE64,
        codigoCopiaECola: PIX_FATURA_COPIA_E_COLA,
        expiraEm: '2026-10-20T23:59:59Z',
      });
    },
    [`GET /minha-conta/cobrancas/${COBRANCA_CENTRAL_ID}/situacao`]: (_p, route) => {
      conta = {
        ...conta,
        cobrancas: conta.cobrancas.map((c) => (c.id === COBRANCA_CENTRAL_ID ? { ...c, situacao: 'PAGA', pagoEm: '2026-10-19' } : c)),
      };
      return json(route, {
        cobrancaId: COBRANCA_CENTRAL_ID,
        situacao: 'PAGA',
        pagoEm: '2026-10-19T14:30:00Z',
      });
    },
    [`POST /minha-conta/cobrancas/${COBRANCA_CENTRAL_ID}/pagar`]: (_p, route) => {
      pedidosLinkExterno.push(COBRANCA_CENTRAL_ID);
      return json(route, { url: LINK_EXTERNO_CONTINGENCIA });
    },
  };

  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, {
      pagamentosHabilitados: true,
      overtrainingPayHabilitado: true,
      permissoes: [...PERMISSOES_TREINADOR, 'CONTA_LER'],
    })),
    ...rotasExtras,
  });

  await page.goto('/treinador/minha-conta?aba=faturas');
  await expect(page.getByText('Abatimento automático da mensalidade')).toBeVisible();
  return { api, pedidosPix, pedidosLinkExterno };
}

for (const largura of LARGURAS) {
  test(`Minha conta em ${largura}px: cartão de progresso do Split + Checkout Transparente Asaas + contingência`, async ({ page, context }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await definirTema(page, 'ESCURO');
    await context.route('https://pagamento.exemplo.invalid/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Link Contingência</title><p>Checkout externo</p>' }));

    const { api, pedidosPix, pedidosLinkExterno } = await abrirMinhaContaFaturas(page);

    // 1. Cartão de progresso do Abatimento automático pelo Split (ABATER_MENSALIDADE)
    await expect(page.getByText('Abatimento automático da mensalidade')).toBeVisible();
    await expect(page.getByText('Split 10%')).toBeVisible();
    await expect(page.getByText('Progresso do abatimento automático')).toBeVisible();
    await expect(page.getByText('60%', { exact: true })).toBeVisible();
    await expect(page.getByText(/R\$\s?120,00/)).toBeVisible();
    await expect(page.getByText(/R\$\s?79,00/)).toBeVisible();

    // 2. Botão principal "Pagar no app" + botão secundário de contingência "Pagar por link externo"
    const botaoPagarApp = page.getByRole('button', { name: 'Pagar no app' });
    const botaoLinkExterno = page.getByRole('button', { name: 'Pagar por link externo' });
    await expect(botaoPagarApp).toBeVisible();
    await expect(botaoLinkExterno).toBeVisible();

    if (largura === 1280) {
      await page.screenshot({ path: `${PASTA_SWARM}/minha-conta-split-asaas.png` });
    }

    // 3. Testar botão secundário de contingência (chama POST /minha-conta/cobrancas/{id}/pagar)
    await botaoLinkExterno.click();
    await expect.poll(() => pedidosLinkExterno.length).toBe(1);

    // 4. Abrir Checkout Transparente Asaas (FolhaPagamentoCentralAsaas)
    await botaoPagarApp.click();
    const folha = page.getByRole('dialog', { name: 'Pagar fatura da assinatura' });
    await expect(folha).toBeVisible();
    await expect(folha.getByRole('tab', { name: 'Pix imediato', selected: true })).toBeVisible();
    await expect(folha.getByRole('tab', { name: 'Cartão de crédito' })).toBeVisible();

    // 5. Gerar QR Code Pix e confirmar via polling
    await folha.getByRole('button', { name: 'Gerar QR Code Pix' }).click();
    await expect(folha.getByLabel('QR Code Pix da fatura')).toBeVisible();
    expect(pedidosPix).toHaveLength(1);

    await expect(folha.getByText('Pagamento confirmado!')).toBeVisible({ timeout: 10_000 });
    await folha.getByRole('button', { name: 'Fechar' }).last().click();
    await expect(folha).toHaveCount(0);

    await semRolagemHorizontal(page);
    expect(api.naoTratadas).toEqual([]);
    expect(api.errosDaPagina).toEqual([]);
  });
}

for (const tema of TEMAS) {
  for (const largura of LARGURAS) {
    test(`tema ${tema} em ${largura}px: Minha conta com Split e botão Pagar no app sem rolagem horizontal`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await definirTema(page, tema);
      const { api } = await abrirMinhaContaFaturas(page);

      await expect(page.getByText('Abatimento automático da mensalidade')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Pagar no app' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Pagar por link externo' })).toBeVisible();
      await semRolagemHorizontal(page);
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });
  }
}
