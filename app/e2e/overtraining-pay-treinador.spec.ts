import { expect, test, type Page } from '@playwright/test';

import type { CobrancaTesteResponse, OvertrainingPayConfigRequest, OvertrainingPayConfigResponse } from '../src/api/financeiroOvertrainingPay';
import { PERMISSOES_TREINADOR, json, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { fixarHoje } from './aluno';
import { estadoFinanceiro, RECEBIMENTO_CONFIGURADO, rotasDoFinanceiro } from './financeiro-falso';
import { estadoKiwify, rotasDaKiwify } from './kiwify-falso';

/**
 * Overtraining Pay — jornada do treinador (Onda 3 E2E):
 * Hub Configurações ("Homologação e Conta de Repasse") -> Financeiro › Recebimento ->
 * Overtraining Pay principal no topo + integrações externas (InfinitePay/Kiwify) recolhidas ->
 * preenchimento de titular e conta de repasse -> PRONTA_PARA_TESTE ->
 * cobrança de teste de R$ 5,00 (QR Code Pix + Copia e Cola) -> confirmação via polling ->
 * conta "Ativo e homologado" + prévia "O que o aluno vê" atualizada.
 */

const PASTA_SWARM = 'C:/Users/gusta/.gemini/antigravity/brain/b355d9f2-0cd6-4d13-b55f-caccceb70abe';
const QR_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PIX_TESTE_COPIA_E_COLA = '00020126580014br.gov.bcb.pix0136teste-homologacao-ficticio-50052040000530398654045.005802BR5916Treinadora Teste6008Cascavel6304ABCD';

const TEMAS = ['ESCURO', 'CLARO', 'AREIA'] as const;
const LARGURAS = [390, 1280] as const;

async function definirTema(page: Page, tema: (typeof TEMAS)[number]) {
  await page.addInitScript(([id, t]) => {
    localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t }));
  }, [TREINADOR.id, tema] as const);
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

function criarConfigInicial(): OvertrainingPayConfigResponse {
  return {
    situacao: 'NAO_CONFIGURADA',
    etapas: { dadosCadastrados: false, documentosAprovados: false, testeHomologado: false, ativa: false },
    tipoPessoa: null,
    documentoMascarado: null,
    nomeTitular: null,
    emailFinanceiro: null,
    telefoneMascarado: null,
    cep: null,
    enderecoResumo: null,
    rendaMensalCentavos: null,
    bancoCodigo: null,
    bancoNome: null,
    tipoConta: null,
    agenciaMascarada: null,
    contaMascarada: null,
    repasseAutomatico: true,
    onboardingUrl: null,
    cobrancasLiquidadas: 0,
    homologadaEm: null,
    cobrancaTesteAtiva: null,
    versao: null,
  };
}

function criarRotasOvertrainingPay(inicial: OvertrainingPayConfigResponse) {
  let config = structuredClone(inicial);
  let consultasTeste = 0;
  const putsRecebidos: OvertrainingPayConfigRequest[] = [];
  const cobrancaTesteInicial: CobrancaTesteResponse = {
    cobrancaTesteId: 'ct-00000000-0000-4000-8000-000000000001',
    situacao: 'CRIADA',
    valorCentavos: 500,
    qrCodeBase64: QR_PNG_BASE64,
    pixCopiaECola: PIX_TESTE_COPIA_E_COLA,
    expiraEm: '2026-10-19T23:59:59Z',
  };

  const rotas: RespostasApi = {
    'GET /financeiro/overtraining-pay': (_p, route) => json(route, config),
    'PUT /financeiro/overtraining-pay': (pedido, route) => {
      const corpo = pedido.corpo as OvertrainingPayConfigRequest;
      putsRecebidos.push(corpo);
      config = {
        ...config,
        situacao: 'PRONTA_PARA_TESTE',
        etapas: { dadosCadastrados: true, documentosAprovados: true, testeHomologado: false, ativa: false },
        tipoPessoa: corpo.tipoPessoa,
        documentoMascarado: '***.982.247-**',
        nomeTitular: corpo.nomeTitular,
        emailFinanceiro: corpo.emailFinanceiro,
        telefoneMascarado: '(45) *****-8888',
        cep: corpo.cep,
        enderecoResumo: corpo.enderecoResumo,
        rendaMensalCentavos: corpo.rendaMensalCentavos,
        bancoCodigo: corpo.bancoCodigo,
        bancoNome: corpo.bancoNome,
        tipoConta: corpo.tipoConta,
        agenciaMascarada: '**01',
        contaMascarada: '****56-7',
        repasseAutomatico: corpo.repasseAutomatico,
        versao: (config.versao ?? 0) + 1,
      };
      return json(route, config);
    },
    'POST /financeiro/overtraining-pay/cobranca-teste': (_p, route) => {
      consultasTeste = 0;
      config = { ...config, cobrancaTesteAtiva: cobrancaTesteInicial };
      return json(route, cobrancaTesteInicial);
    },
    'GET /financeiro/overtraining-pay/cobranca-teste/{id}': (_p, route) => {
      consultasTeste += 1;
      const homologada: CobrancaTesteResponse = { ...cobrancaTesteInicial, situacao: 'HOMOLOGADA' };
      config = {
        ...config,
        situacao: 'ATIVA',
        etapas: { dadosCadastrados: true, documentosAprovados: true, testeHomologado: true, ativa: true },
        cobrancasLiquidadas: 1,
        homologadaEm: '2026-10-19T14:05:00Z',
        cobrancaTesteAtiva: homologada,
        versao: (config.versao ?? 1) + 1,
      };
      return json(route, homologada);
    },
  };

  return {
    rotas,
    putsRecebidos,
    obterConsultasTeste: () => consultasTeste,
  };
}

async function montarSessaoTreinador(page: Page, rotasExtras: RespostasApi = {}) {
  await fixarHoje(page);
  const financeiro = estadoFinanceiro({ recebimento: { ...RECEBIMENTO_CONFIGURADO } });
  const kiwify = estadoKiwify();
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, {
      pagamentosHabilitados: true,
      recebimentoOnlineHabilitado: true,
      overtrainingPayHabilitado: true,
      kiwifyHabilitada: true,
      permissoes: [...PERMISSOES_TREINADOR, 'FINANCEIRO_LER', 'FINANCEIRO_ALTERAR'],
    })),
    ...rotasDoFinanceiro(financeiro),
    ...rotasDaKiwify(kiwify),
    'GET /inscricoes': { corpo: [] },
    ...rotasExtras,
  });
  return { api, financeiro };
}

for (const largura of LARGURAS) {
  test(`jornada completa do treinador em ${largura}px: Configurações -> Recebimento -> homologação -> cobrança teste -> ativo`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await definirTema(page, 'ESCURO');
    await areaDeTransferencia(page);
    const ot = criarRotasOvertrainingPay(criarConfigInicial());
    const { api } = await montarSessaoTreinador(page, ot.rotas);

    // 1. Hub Configurações -> cartão "Homologação e Conta de Repasse"
    await page.goto('/treinador/configuracoes');
    const cartaoHomologacao = page.getByRole('link', { name: /Homologação e Conta de Repasse/i })
      .or(page.getByRole('button', { name: /Homologação e Conta de Repasse/i }));
    await expect(cartaoHomologacao.first()).toBeVisible();
    await cartaoHomologacao.first().click();

    // 2. Financeiro › Recebimento: Overtraining Pay principal no topo + integrações externas recolhidas
    await expect(page.getByRole('tab', { name: 'Recebimento', selected: true })).toBeVisible();
    await expect(page.getByText('Overtraining Pay', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Homologação e conta de repasse', { exact: true })).toBeVisible();

    const botaoIntegracoes = page.getByRole('button', { name: /Integrações externas opcionais, recolhido/i });
    await expect(botaoIntegracoes).toBeVisible();
    await expect(page.getByText('Recebimento online pela InfinitePay', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Assinaturas pela Kiwify', { exact: true })).toHaveCount(0);

    // Botão de cobrança teste começa desabilitado antes de salvar homologação
    await expect(page.getByRole('button', { name: 'Gerar cobrança de teste' })).toBeDisabled();

    // 3. Preencher titular e conta de repasse. O documento pede ao navegador e aos gerenciadores de senha para não preencher
    // (defeito de 28/11), e nenhum campo da aba é de senha.
    const documento = page.getByLabel('CPF do titular');
    await expect(documento).toHaveAttribute('autocomplete', 'off');
    await expect(documento).toHaveAttribute('id', 'documento-do-titular');
    await expect(documento).toHaveAttribute('data-1p-ignore', 'true');
    await expect(documento).toHaveAttribute('data-lpignore', 'true');
    await expect(documento).toHaveAttribute('data-form-type', 'other');
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await documento.fill('52998224725');
    await page.getByLabel('Nome completo do titular').fill('Treinadora Teste Silva');
    await page.getByLabel('E-mail financeiro').fill('financeiro@exemplo.test');
    await page.getByLabel('Telefone').fill('45999998888');
    await page.getByLabel('CEP').fill('85801000');
    await page.getByLabel('Renda mensal aproximada').pressSequentially('800000');
    await page.getByLabel('Endereço completo').fill('Rua das Palmeiras, 120, Centro, Cascavel - PR');
    await page.getByLabel('Agência (sem dígito)').fill('0001');
    await page.getByLabel('Conta com dígito').fill('123456-7');

    await page.getByRole('button', { name: 'Salvar homologação' }).click();
    await expect(page.getByText('Dados de homologação salvos com sucesso.')).toBeVisible();
    await expect(page.getByText('Pronto para teste', { exact: true }).first()).toBeVisible();
    expect(ot.putsRecebidos).toHaveLength(1);
    expect(ot.putsRecebidos[0]).toMatchObject({
      tipoPessoa: 'PF',
      documento: '52998224725',
      bancoCodigo: '260',
      agencia: '0001',
      conta: '123456-7',
    });

    // 4. Gerar cobrança de teste (R$ 5,00 QR Code Pix) + copiar + polling -> homologado
    const botaoTeste = page.getByRole('button', { name: 'Gerar cobrança de teste' });
    await expect(botaoTeste).toBeEnabled();
    await botaoTeste.click();

    const folhaTeste = page.getByRole('dialog', { name: 'Cobrança de teste (homologação)' });
    await expect(folhaTeste).toBeVisible();
    await expect(folhaTeste.getByText(/R\$\s?5,00/)).toBeVisible();
    await expect(folhaTeste.getByLabel('QR Code Pix da cobrança de teste de R$ 5,00')).toBeVisible();
    await expect(folhaTeste.getByText('Cobrança Pix criada')).toBeVisible();

    if (largura === 1280) {
      await page.screenshot({ path: `${PASTA_SWARM}/overtraining-cobranca-teste.png` });
    }

    await folhaTeste.getByRole('button', { name: 'Copiar código Pix copia e cola' }).click();
    await expect(page.getByText('Código Pix copia e cola copiado.')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __copiado?: string }).__copiado)).toBe(PIX_TESTE_COPIA_E_COLA);

    // 5. Polling (4s) confirma e homologa a conta automaticamente
    await expect(page.getByText('Pagamento de teste confirmado! Conta homologada.')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Ativo e homologado', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    expect(ot.obterConsultasTeste()).toBeGreaterThanOrEqual(1);

    // 6. Interruptor Overtraining Pay liberado -> ligar -> prévia "O que o aluno vê" atualizada
    const switchOvertraining = page.getByRole('switch', { name: 'Overtraining Pay' });
    await expect(switchOvertraining).toBeEnabled();
    await switchOvertraining.click();
    await expect(page.getByText('No aplicativo: Pix na hora, pelo QR Code, e cartão pela página do Asaas.')).toBeVisible();

    if (largura === 1280) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${PASTA_SWARM}/overtraining-recebimento-ativo.png` });
    }

    await semRolagemHorizontal(page);
    expect(api.naoTratadas).toEqual([]);
    expect(api.errosDaPagina).toEqual([]);
  });
}

for (const tema of TEMAS) {
  for (const largura of LARGURAS) {
    test(`tema ${tema} em ${largura}px: Recebimento com Overtraining Pay ativo e integrações recolhidas sem rolagem horizontal`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await definirTema(page, tema);
      const ot = criarRotasOvertrainingPay({
        ...criarConfigInicial(),
        situacao: 'ATIVA',
        etapas: { dadosCadastrados: true, documentosAprovados: true, testeHomologado: true, ativa: true },
        tipoPessoa: 'PF',
        documentoMascarado: '***.982.247-**',
        nomeTitular: 'Treinadora Teste Silva',
        emailFinanceiro: 'financeiro@exemplo.test',
        cep: '85801-000',
        enderecoResumo: 'Rua das Palmeiras, 120',
        rendaMensalCentavos: 800_000,
        bancoCodigo: '260',
        bancoNome: 'Nubank',
        tipoConta: 'CORRENTE',
        agenciaMascarada: '**01',
        contaMascarada: '****56-7',
        cobrancasLiquidadas: 4,
        homologadaEm: '2026-10-18T10:00:00Z',
        versao: 2,
      });
      const { api } = await montarSessaoTreinador(page, ot.rotas);
      await page.goto('/treinador/financeiro?aba=recebimento');

      await expect(page.getByText('Ativo e homologado', { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Integrações externas opcionais, recolhido/i })).toBeVisible();
      await semRolagemHorizontal(page);
      expect(api.naoTratadas).toEqual([]);
      expect(api.errosDaPagina).toEqual([]);
    });
  }
}
