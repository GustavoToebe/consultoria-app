import { expect, test, type Page } from '@playwright/test';

import type { CobrancaResponse, ConferenciaDePagamento, ContratacaoResponse, PlanoResponse } from '../src/api/financeiroTipos';
import { MENSAGEM_REMOVER_KIWIFY, MOTIVOS_DA_KIWIFY, TEXTO_KIWIFY_NOS_LEMBRETES } from '../src/dominio/kiwify';
import { ALUNO, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { fixarHoje, sessaoDeAluno } from './aluno';
import { COBRANCA_ATRASADA, estadoFinanceiro, FORMAS_COM_PIX, RECEBIMENTO_CONFIGURADO, rotasDoFinanceiro, type EstadoFinanceiro } from './financeiro-falso';
import { CREDENCIAIS_FALSAS, estadoKiwify, KIWIFY_CONFIGURADA, rotasDaKiwify, URL_DO_WEBHOOK, type EstadoKiwify } from './kiwify-falso';

/**
 * Kiwify automática (D16 a D20, frente F7): a configuração na aba Recebimento (chave desligada, não configurada, 422, configurada
 * sem segredo na tela, remover), o plano mensal com "Assinatura cobrada pela Kiwify", o "Para conferir" com os motivos novos,
 * a folha da cobrança e o aluno. API simulada e Kiwify de mentira (`kiwify-falso.ts`); relógio em 19/10/2026; só dados
 * fictícios. O e2e só roda a web: em 390 px continua sendo a web, então a regra do celular (D7 + D18) está no Jest
 * (`CartaoMeuPlano.test.tsx`, `kiwify.test.ts`).
 */

const CAPTURAS = 'test-results/financeiro-kiwify';
const TEMAS = ['CLARO', 'ESCURO'] as const;
const LARGURAS = [1280, 390] as const;

async function tema(page: Page, id: string, t: (typeof TEMAS)[number]) {
  await page.addInitScript(([i, v]) => localStorage.setItem(`treinos:${i}:preferencias`, JSON.stringify({ tema: v })), [id, t] as const);
}

async function abrir(page: Page, caminho: string, o: {
  financeiro?: EstadoFinanceiro; kiwify?: EstadoKiwify; kiwifyHabilitada?: boolean; infinitePay?: boolean; permissoes?: string[]; extra?: RespostasApi;
} = {}) {
  await fixarHoje(page);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, {
      pagamentosHabilitados: true, recebimentoOnlineHabilitado: o.infinitePay ?? false, kiwifyHabilitada: o.kiwifyHabilitada ?? true,
      permissoes: [...PERMISSOES_TREINADOR, ...(o.permissoes ?? ['FINANCEIRO_LER', 'FINANCEIRO_ALTERAR'])],
    })),
    ...rotasDoFinanceiro(o.financeiro ?? estadoFinanceiro()), ...rotasDaKiwify(o.kiwify ?? estadoKiwify()), ...o.extra,
  });
  await page.goto(caminho);
  return api;
}

async function semRolagemHorizontal(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra).toBeLessThanOrEqual(0);
}

/** Nenhum texto nem campo da página traz um dos segredos (depois de salvos, eles nunca voltam). */
async function semSegredos(page: Page) {
  for (const s of [CREDENCIAIS_FALSAS.tokenDoWebhook, CREDENCIAIS_FALSAS.clientSecret, CREDENCIAIS_FALSAS.accountId, CREDENCIAIS_FALSAS.clientId]) {
    expect(await page.evaluate((c) => document.body.innerText.includes(c)
      || [...document.querySelectorAll('input, textarea')].some((e) => (e as HTMLInputElement).value.includes(c)), s)).toBe(false);
  }
}

const cartao = (page: Page) => page.getByText('Assinaturas pela Kiwify', { exact: true });
const salvar = (page: Page) => page.getByRole('button', { name: 'Salvar credenciais' });

/** O navegador de teste não deixa ler a área de transferência: um substituto guarda o que foi copiado. */
async function areaDeTransferencia(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (t: string) => { (window as unknown as { __copiado?: string }).__copiado = t; return Promise.resolve(); } },
    });
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Chave desligada: nada da Kiwify aparece nem é buscado, e o plano reenvia o que estava gravado.
// ---------------------------------------------------------------------------------------------------------------------

const PLANO_KIWIFY: PlanoResponse = {
  id: 'b0000000-0000-4000-8000-0000000000k1', nome: 'Assinatura mensal', valorCentavos: 15_000, periodicidade: 'MENSAL', arquivado: false,
  criadoEm: '2026-09-01T12:00:00Z', versao: 0, tempoMinimoMeses: null, regraDeSaida: null, linkDePagamento: null, incluiTreino: true, incluiDieta: true,
  kiwifyAssinatura: true, kiwifyProdutoId: 'produto-ficticio-1',
};

test('chave desligada: sem cartão, sem campos no plano, sem busca à Kiwify; renomear o plano reenvia a assinatura gravada', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const financeiro = estadoFinanceiro({ planos: [{ ...PLANO_KIWIFY }] });
  const { pedidos, errosDaPagina } = await abrir(page, '/treinador/financeiro?aba=recebimento', { financeiro, kiwifyHabilitada: false });
  await expect(page.getByText('Formas de recebimento', { exact: true })).toBeVisible();
  await expect(cartao(page)).toHaveCount(0);

  await page.goto('/treinador/financeiro?aba=planos');
  await expect(page.getByText('Assinatura pela Kiwify')).toHaveCount(0);
  await page.getByRole('button', { name: 'Abrir plano Assinatura mensal' }).click();
  const folha = page.getByRole('dialog', { name: 'Editar plano' });
  await expect(folha.getByRole('switch', { name: 'Assinatura cobrada pela Kiwify' })).toHaveCount(0);
  await folha.getByLabel('Nome do plano').fill('Assinatura mensal nova');
  await folha.getByRole('button', { name: 'Salvar plano' }).click();
  await expect(page.getByText('Plano salvo.')).toBeVisible();
  const put = pedidos.find((p) => p.metodo === 'PUT' && p.caminho.startsWith('/financeiro/planos/'));
  expect(put?.corpo).toMatchObject({ kiwifyAssinatura: true, kiwifyProdutoId: 'produto-ficticio-1' });
  expect(pedidos.filter((p) => p.caminho === '/financeiro/kiwify')).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('503 KIWIFY_INDISPONIVEL com o /eu antigo dizendo ligada: o cartão some, sem erro na tela', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errosDaPagina } = await abrir(page, '/treinador/financeiro?aba=recebimento', { kiwify: estadoKiwify({ indisponivel: true }) });
  await expect(page.getByText('Formas de recebimento', { exact: true })).toBeVisible();
  await expect(cartao(page)).toHaveCount(0);
  await expect(page.getByText(/não está disponível/)).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------
// Configurar: não configurada → erros na tela → 422 do servidor → configurada, só a URL e o final do client_id.
// ---------------------------------------------------------------------------------------------------------------------

for (const largura of LARGURAS) for (const t of TEMAS) {
  test(`configurar em ${largura}px (${t}): passo a passo, erros na tela e do servidor, e depois só a URL, sem segredo`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await tema(page, TREINADOR.id, t);
    await areaDeTransferencia(page);
    const kiwify = estadoKiwify();
    const { errosDaPagina } = await abrir(page, '/treinador/financeiro?aba=recebimento', { kiwify });
    await expect(cartao(page)).toBeVisible();
    await expect(page.getByText('Ainda não configurada', { exact: true })).toBeVisible();
    await expect(page.getByText(/em Apps › API, crie uma chave de API/)).toBeVisible();
    await expect(page.getByText(/em Apps › Webhooks, crie o webhook/)).toBeVisible();
    // Os segredos vão em campo de senha e nenhum campo deixa o navegador lembrar.
    await expect(page.getByLabel('Token do webhook', { exact: true })).toHaveAttribute('type', 'password');
    await expect(page.getByLabel('Client secret', { exact: true })).toHaveAttribute('type', 'password');
    for (const r of ['Token do webhook', 'Client ID', 'Client secret', 'Account ID']) {
      await expect(page.getByLabel(r, { exact: true })).toHaveAttribute('autocomplete', 'off');
    }
    await cartao(page).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURAS}/nao-configurada-${largura}-${t}.png`, fullPage: true });

    // Vazio: cada campo diz o que falta, o foco vai ao primeiro e nada vai ao servidor.
    await salvar(page).click();
    await expect(page.getByText('Informe o token do webhook.')).toBeVisible();
    await expect(page.getByText('Informe o Account ID.')).toBeVisible();
    await expect(page.getByLabel('Token do webhook', { exact: true })).toBeFocused();
    await page.getByLabel('Token do webhook', { exact: true }).fill('curto');
    await expect(page.getByText('Use pelo menos 16 caracteres.')).toBeVisible();
    expect(kiwify.recebidos).toEqual([]);

    // O servidor recusa um campo (422 `KIWIFY_INVALIDA`): a mensagem dele fica no campo, sem repetir o valor.
    await page.getByLabel('Token do webhook', { exact: true }).fill(CREDENCIAIS_FALSAS.tokenDoWebhook);
    await page.getByLabel('Client ID', { exact: true }).fill(CREDENCIAIS_FALSAS.clientId);
    await page.getByLabel('Client secret', { exact: true }).fill(CREDENCIAIS_FALSAS.clientSecret);
    await page.getByLabel('Account ID', { exact: true }).fill(CREDENCIAIS_FALSAS.accountId);
    kiwify.recusa = [{ field: 'accountId', message: 'Account ID não aceito pela Kiwify.' }];
    await salvar(page).click();
    await expect(page.getByText('Account ID não aceito pela Kiwify.')).toBeVisible();
    await expect(page.getByLabel('Account ID', { exact: true })).toBeFocused();
    await page.screenshot({ path: `${CAPTURAS}/erro-422-${largura}-${t}.png`, fullPage: true });

    await salvar(page).click();
    await expect(page.getByText('Kiwify configurada. Agora crie o webhook na Kiwify com a URL abaixo.')).toBeVisible();
    expect(kiwify.recebidos.at(-1)).toEqual({ ...CREDENCIAIS_FALSAS, versao: null });
    await expect(page.getByText('Configurada', { exact: true })).toBeVisible();
    await expect(page.getByText(URL_DO_WEBHOOK)).toBeVisible();
    await expect(page.getByText('termina em a1b2')).toBeVisible();
    await expect(page.getByLabel('Token do webhook', { exact: true })).toHaveCount(0);
    await semSegredos(page);
    await semRolagemHorizontal(page);
    await page.getByRole('button', { name: 'Copiar URL do webhook' }).click();
    await expect(page.getByText('URL do webhook copiada.')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __copiado?: string }).__copiado)).toBe(URL_DO_WEBHOOK);
    await page.getByText('URL do webhook', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURAS}/configurada-${largura}-${t}.png`, fullPage: true });
    expect(errosDaPagina).toEqual([]);
  });
}

test('trocar credenciais: em branco fica o gravado, só o digitado vai, com a versão; o 409 recarrega e avisa', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const kiwify = estadoKiwify({ config: { ...KIWIFY_CONFIGURADA } });
  const { errosDaPagina } = await abrir(page, '/treinador/financeiro?aba=recebimento', { kiwify });
  await page.getByRole('button', { name: 'Trocar credenciais' }).click();
  await expect(page.getByRole('button', { name: 'Salvar novas credenciais' })).toBeDisabled();
  await page.getByLabel('Client secret', { exact: true }).fill('outro-segredo-ficticio-1');
  await page.getByRole('button', { name: 'Salvar novas credenciais' }).click();
  await expect(page.getByText('Credenciais da Kiwify salvas.')).toBeVisible();
  expect(kiwify.recebidos.at(-1)).toEqual({ clientSecret: 'outro-segredo-ficticio-1', versao: 0 });
  await expect(page.getByLabel('Client secret', { exact: true })).toHaveCount(0);

  // Outra aba salvou no meio (versão nova no servidor): 409, aviso neutro e a tela recarregada.
  kiwify.config = { ...kiwify.config, versao: 9 };
  await page.getByRole('button', { name: 'Trocar credenciais' }).click();
  await page.getByLabel('Account ID', { exact: true }).fill('outra-conta-ficticia');
  await page.getByRole('button', { name: 'Salvar novas credenciais' }).click();
  await expect(page.getByText(/A configuração da Kiwify foi alterada em outro lugar/)).toBeVisible();
  await expect(page.getByLabel('Account ID', { exact: true })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

for (const largura of LARGURAS) {
  test(`remover em ${largura}px: o painel explica o webhook, Voltar não apaga, confirmar manda a versão e volta a não configurada`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const kiwify = estadoKiwify({ config: { ...KIWIFY_CONFIGURADA } });
    const { errosDaPagina } = await abrir(page, '/treinador/financeiro?aba=recebimento', { kiwify });
    await page.getByRole('button', { name: 'Remover Kiwify' }).click();
    const painel = page.getByRole('alertdialog', { name: 'Remover a Kiwify?' });
    await expect(painel.getByText(MENSAGEM_REMOVER_KIWIFY)).toBeVisible();
    await page.screenshot({ path: `${CAPTURAS}/remover-painel-${largura}.png` });
    await painel.getByRole('button', { name: 'Voltar' }).click();
    expect(kiwify.remocoes).toEqual([]);
    await page.getByRole('button', { name: 'Remover Kiwify' }).click();
    await page.getByRole('alertdialog', { name: 'Remover a Kiwify?' }).getByRole('button', { name: 'Remover Kiwify' }).click();
    await expect(page.getByText('Kiwify removida. Apague também o webhook no painel da Kiwify.')).toBeVisible();
    expect(kiwify.remocoes).toEqual(['0']);
    await expect(page.getByText('Ainda não configurada', { exact: true })).toBeVisible();
    await expect(page.getByText(URL_DO_WEBHOOK)).toHaveCount(0);
    await expect(salvar(page)).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });
}

test('só FINANCEIRO_LER: a situação e o final do client_id, sem URL, sem campos e sem botões', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const kiwify = estadoKiwify({ config: { ...KIWIFY_CONFIGURADA }, comUrl: false });
  const { errosDaPagina } = await abrir(page, '/treinador/financeiro?aba=recebimento', { kiwify, permissoes: ['FINANCEIRO_LER'] });
  await expect(cartao(page)).toBeVisible();
  await expect(page.getByText('termina em a1b2')).toBeVisible();
  await expect(page.getByText('Para mudar a Kiwify, peça a quem administra o financeiro.')).toBeVisible();
  await expect(page.getByText(URL_DO_WEBHOOK)).toHaveCount(0);
  for (const b of ['Trocar credenciais', 'Remover Kiwify', 'Copiar URL do webhook']) await expect(page.getByRole('button', { name: b })).toHaveCount(0);
  await semRolagemHorizontal(page);
  await cartao(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${CAPTURAS}/leitura-390.png`, fullPage: true });
  expect(errosDaPagina).toEqual([]);
});

test('sem conexão ao buscar: mensagem de erro e "Tentar de novo"', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  let vezes = 0;
  const kiwify = estadoKiwify();
  const { errosDaPagina } = await abrir(page, '/treinador/financeiro?aba=recebimento', {
    kiwify,
    extra: {
      'GET /financeiro/kiwify': (_p, route) => {
        vezes += 1;
        return vezes === 1 ? route.abort('internetdisconnected') : json(route, kiwify.config);
      },
    },
  });
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  await page.screenshot({ path: `${CAPTURAS}/sem-conexao-1280.png`, fullPage: true });
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(cartao(page)).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------
// Plano comercial: só o mensal tem a opção; ligada, o produto é obrigatório.
// ---------------------------------------------------------------------------------------------------------------------

for (const largura of LARGURAS) for (const t of TEMAS) {
  test(`plano em ${largura}px (${t}): mensal com Kiwify pede o produto, o 422 do servidor fica no campo; trimestral não tem a opção`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await tema(page, TREINADOR.id, t);
    // Um plano já usa o produto `produto-repetido`: a API recusa o mesmo produto em outro plano (a conciliação não saberia qual).
    const financeiro = estadoFinanceiro({ planos: [{ ...PLANO_KIWIFY, kiwifyProdutoId: 'produto-repetido' }] });
    const { pedidos, errosDaPagina } = await abrir(page, '/treinador/financeiro?aba=planos', { financeiro });
    await page.getByRole('button', { name: 'Novo plano' }).click();
    const folha = page.getByRole('dialog', { name: 'Novo plano' });
    await folha.getByLabel('Nome do plano').fill('Assinatura Kiwify');
    await folha.getByLabel('Valor', { exact: true }).pressSequentially('15000');
    const interruptor = folha.getByRole('switch', { name: 'Assinatura cobrada pela Kiwify' });
    await expect(interruptor).not.toBeChecked();
    await interruptor.click();
    await folha.getByRole('button', { name: 'Criar plano' }).click();
    await expect(folha.getByText('Informe o ID do produto na Kiwify.')).toBeVisible();
    await folha.getByLabel('ID do produto na Kiwify').fill('produto com espaço');
    await expect(folha.getByText(/Use só letras, números/)).toBeVisible();
    expect(financeiro.planos).toHaveLength(1);
    await folha.getByLabel('ID do produto na Kiwify').fill('produto-repetido');
    await folha.getByRole('button', { name: 'Criar plano' }).click();
    await expect(folha.getByText('Outro plano já usa este produto da Kiwify.')).toBeVisible();
    await folha.getByLabel('ID do produto na Kiwify').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURAS}/plano-erro-${largura}-${t}.png` });

    // Trimestral: a opção some (o servidor também recusa, D17); voltar ao mensal a traz de volta, com o que estava.
    await folha.getByRole('radio', { name: 'Trimestral' }).click();
    await expect(folha.getByRole('switch', { name: 'Assinatura cobrada pela Kiwify' })).toHaveCount(0);
    await folha.getByRole('radio', { name: 'Mensal' }).click();
    await folha.getByLabel('ID do produto na Kiwify').fill('produto-ficticio-9');
    await folha.getByRole('button', { name: 'Criar plano' }).click();
    await expect(page.getByText('Plano criado.')).toBeVisible();
    expect(financeiro.planos[1]).toMatchObject({ kiwifyAssinatura: true, kiwifyProdutoId: 'produto-ficticio-9' });
    await expect(page.getByText('Assinatura pela Kiwify').first()).toBeVisible();
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/planos-lista-${largura}-${t}.png`, fullPage: true });

    // Editar para anual avisa que a assinatura cai e o corpo vai desligado.
    await page.getByRole('button', { name: 'Abrir plano Assinatura Kiwify' }).click();
    const edicao = page.getByRole('dialog', { name: 'Editar plano' });
    await expect(edicao.getByRole('switch', { name: 'Assinatura cobrada pela Kiwify' })).toBeChecked();
    await edicao.getByRole('radio', { name: 'Anual' }).click();
    await expect(edicao.getByText(/A assinatura pela Kiwify vale só no plano mensal/)).toBeVisible();
    await edicao.getByRole('button', { name: 'Salvar plano' }).click();
    await expect(page.getByText('Plano salvo.')).toBeVisible();
    const put = pedidos.filter((p) => p.metodo === 'PUT' && p.caminho.startsWith('/financeiro/planos/')).at(-1);
    expect(put?.corpo).toMatchObject({ periodicidade: 'ANUAL', kiwifyAssinatura: false, kiwifyProdutoId: null });
    expect(errosDaPagina).toEqual([]);
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// "Para conferir": os motivos da Kiwify, com a InfinitePay desligada (o cartão aparece pela Kiwify).
// ---------------------------------------------------------------------------------------------------------------------

const conferencia = (n: number, motivo: ConferenciaDePagamento['motivo'], comAluno: boolean): ConferenciaDePagamento => ({
  id: `f0000000-0000-4000-8000-00000000k${String(n).padStart(3, '0')}`, provedor: 'KIWIFY', idExterno: `venda-ficticia-${n}`,
  alunoId: comAluno ? 'a0000000-0000-4000-8000-0000000000bb' : null, alunoNome: comAluno ? 'Aluna Kiwify' : null,
  cobrancaId: null, competencia: null, valorCobrancaCentavos: null, valorPagoCentavos: 15_000, motivo, recebidoEm: '2026-10-19T15:30:00Z',
});

const CONFERENCIAS: ConferenciaDePagamento[] = [
  conferencia(1, 'KIWIFY_EMAIL_SEM_ALUNO', false),
  conferencia(2, 'KIWIFY_EMAIL_DE_VARIOS_ALUNOS', false),
  conferencia(3, 'KIWIFY_SEM_CONTRATACAO_NO_PLANO', true),
  { ...conferencia(4, 'VALOR_DIFERENTE', true), valorCobrancaCentavos: 15_000, valorPagoCentavos: 12_000, competencia: '2026-10-05' },
  conferencia(5, 'KIWIFY_SEM_MENSALIDADE_ABERTA', true),
  conferencia(6, 'KIWIFY_ASSINATURA_CANCELADA', true),
  conferencia(7, 'KIWIFY_REEMBOLSO', true),
  conferencia(8, 'KIWIFY_CHARGEBACK', true),
];

for (const largura of LARGURAS) for (const t of TEMAS) {
  test(`para conferir em ${largura}px (${t}): os motivos da Kiwify em português, a origem e o id da venda`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await tema(page, TREINADOR.id, t);
    const financeiro = estadoFinanceiro({ conferencias: CONFERENCIAS.map((c) => ({ ...c })) });
    const { errosDaPagina } = await abrir(page, '/treinador/financeiro?aba=cobrancas', { financeiro });
    await expect(page.getByText('Pagamentos para conferir (8)')).toBeVisible();
    if (largura === 1280) {
      for (const m of Object.values(MOTIVOS_DA_KIWIFY)) await expect(page.getByText(m, { exact: true })).toBeVisible();
      await expect(page.getByText('Valor diferente do combinado', { exact: true })).toBeVisible();
      await expect(page.getByText('Kiwify', { exact: true })).toHaveCount(8);
    } else {
      await expect(page.getByRole('button', { name: /^Abrir pagamento para conferir de/ })).toHaveCount(8);
      await expect(page.getByText(/Kiwify · Pago R\$\s?150,00 · O e-mail da compra não é de nenhum aluno/)).toBeVisible();
    }
    await expect(page.getByText(/KIWIFY_/)).toHaveCount(0);
    await semRolagemHorizontal(page);
    await page.getByText('Pagamentos para conferir (8)').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURAS}/para-conferir-${largura}-${t}.png`, fullPage: true });

    if (largura === 390) {
      await page.getByRole('button', { name: /^Abrir pagamento para conferir de aluno não identificado/ }).first().click();
      const folha = page.getByRole('dialog', { name: 'Pagamento para conferir' });
      await expect(folha.getByText('venda-ficticia-1')).toBeVisible();
      await expect(folha.getByText('Kiwify', { exact: true })).toBeVisible();
      await page.screenshot({ path: `${CAPTURAS}/para-conferir-folha-390-${t}.png` });
    }
    expect(errosDaPagina).toEqual([]);
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Folha da cobrança (treinador) e Lembretes.
// ---------------------------------------------------------------------------------------------------------------------

const CONTRATACAO: ContratacaoResponse = {
  id: 'e0000000-0000-4000-8000-0000000000k1', alunoId: ALUNO.id, planoComercialId: PLANO_KIWIFY.id, planoNome: PLANO_KIWIFY.nome,
  periodicidade: 'MENSAL', valorCentavos: 15_000, motivoValor: null, inicio: '2026-10-05', diaVencimento: 5, situacao: 'ATIVA', encerradaEm: null,
  criadoEm: '2026-10-01T12:00:00Z', versao: 0, minimoAte: null,
};
const MENSALIDADE_KIWIFY: CobrancaResponse = {
  ...COBRANCA_ATRASADA, id: 'c0000000-0000-4000-8000-0000000000k1', contratacaoId: CONTRATACAO.id, alunoId: ALUNO.id, alunoNome: ALUNO.nome,
  planoNome: PLANO_KIWIFY.nome, competencia: '2026-11-05', vencimento: '2026-11-05', vencida: false, diasDeAtraso: null, cobrancaAutomatica: 'KIWIFY',
};
const AVULSA: CobrancaResponse = {
  ...MENSALIDADE_KIWIFY, id: 'c0000000-0000-4000-8000-0000000000k2', tipo: 'AVULSA', contratacaoId: null, planoNome: null, competencia: null,
  descricao: 'Camiseta do time', valorCentavos: 5_000, cobrancaAutomatica: null,
};

for (const largura of LARGURAS) {
  test(`folha da cobrança em ${largura}px: "Cobrada pela Kiwify", sem copiar link, com baixa e cancelar manuais`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const financeiro = estadoFinanceiro({
      planos: [{ ...PLANO_KIWIFY }], contratacoes: [{ ...CONTRATACAO }], cobrancas: [{ ...MENSALIDADE_KIWIFY }], recebimento: { ...RECEBIMENTO_CONFIGURADO },
    });
    // As cobranças do cenário são de outros meses: sem o filtro padrão (Ativas, mês de vencimento atual), `filtro=nenhum`.
    const { errosDaPagina } = await abrir(page, '/treinador/financeiro?aba=cobrancas&filtro=nenhum', { financeiro, infinitePay: true });
    await page.getByRole('button', { name: /^Abrir cobrança de/ }).first().click();
    const folha = page.getByRole('dialog');
    await expect(folha.getByText('Cobrada pela Kiwify', { exact: true })).toBeVisible();
    await expect(folha.getByText(/A Kiwify cobra esta mensalidade e o app dá baixa sozinho/)).toBeVisible();
    await expect(folha.getByRole('button', { name: 'Registrar pagamento' })).toBeVisible();
    await expect(folha.getByRole('button', { name: 'Cancelar cobrança' })).toBeVisible();
    await expect(folha.getByRole('button', { name: 'Copiar link de pagamento' })).toHaveCount(0);
    await page.screenshot({ path: `${CAPTURAS}/folha-da-cobranca-${largura}.png` });
    expect(errosDaPagina).toEqual([]);
  });
}

test('lembretes: com a Kiwify ligada, a regra diz que a assinatura não recebe lembrete', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errosDaPagina } = await abrir(page, '/treinador/financeiro?aba=lembretes');
  await expect(page.getByText(TEXTO_KIWIFY_NOS_LEMBRETES)).toBeVisible();
  await page.screenshot({ path: `${CAPTURAS}/lembretes-1280.png`, fullPage: true });
  expect(errosDaPagina).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------
// Aluno (web): a mensalidade Kiwify só diz quem cobra; a avulsa ao lado mantém as ações dela.
// ---------------------------------------------------------------------------------------------------------------------

for (const largura of LARGURAS) for (const t of TEMAS) {
  test(`aluno em ${largura}px (${t}): só "Cobrança automática pela Kiwify" na mensalidade, sem Pagar, link nem Pix`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await tema(page, ALUNO.id, t);
    await fixarHoje(page);
    const estado = estadoFinanceiro({
      planos: [{ ...PLANO_KIWIFY }], contratacoes: [{ ...CONTRATACAO }], cobrancas: [{ ...MENSALIDADE_KIWIFY }, { ...AVULSA }], pagamentoOnline: true,
      recebimento: { ...RECEBIMENTO_CONFIGURADO }, formas: structuredClone(FORMAS_COM_PIX),
    });
    const { pedidos, errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAluno(page)), ...(await sessao(page, ALUNO, { pagamentosHabilitados: true, kiwifyHabilitada: true })), ...rotasDoFinanceiro(estado),
    });
    await page.goto('/aluno/conta');
    await expect(page.getByText('Em aberto', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Cobrança automática pela Kiwify · Vence em 05\/11\/2026/)).toBeVisible();
    // Só a avulsa tem ações; nenhum botão fala do mês da mensalidade Kiwify.
    await expect(page.getByRole('button', { name: /: nov\/2026/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Copiar código Pix: Camiseta do time/ })).toBeVisible();
    await expect(page.getByText('Seu treinador vai combinar a forma de pagamento com você e registrar quando receber.')).toHaveCount(0);
    await semRolagemHorizontal(page);
    await page.getByText('Em aberto', { exact: true }).first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURAS}/aluno-${largura}-${t}.png` });
    expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho.includes(MENSALIDADE_KIWIFY.id))).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
