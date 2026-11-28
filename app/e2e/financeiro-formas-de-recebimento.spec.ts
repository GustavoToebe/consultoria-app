import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import type { CobrancaResponse, ContratacaoResponse, PlanoResponse } from '../src/api/financeiroTipos';
import { TEXTO_COMBINE_COM_O_TREINADOR } from '../src/dominio/financeiro';
import {
  DICA_DA_CHAVE_ALEATORIA, MENSAGEM_APAGAR_PIX, MENSAGEM_CONFLITO_DAS_FORMAS, MENSAGEM_CONFLITO_DO_APAGAR_PIX, MENSAGEM_PIX_APAGADO,
} from '../src/dominio/formasDeRecebimento';
import { ALUNO, erroApi, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { fixarHoje, sessaoDeAluno } from './aluno';
import {
  CHAVE_PIX_FALSA, CHAVE_PIX_FALSA_MASCARADA, CODIGO_PIX_FALSO, COBRANCA_ATRASADA, estadoFinanceiro, FORMAS_COM_PIX, RECEBIMENTO_CONFIGURADO,
  rotasDoFinanceiro, sessaoComFinanceiro, type EstadoFinanceiro,
} from './financeiro-falso';

/**
 * Financeiro, Fase 1 (C2): formas de recebimento na aba Recebimento (InfinitePay, link próprio, Pix e Manual), os dados do Pix
 * (a chave só volta mascarada), o "Link de pagamento" do plano e as ações do aluno ("Pagar" pela InfinitePay, pelo link do
 * treinador e "Copiar código Pix"). O e2e só roda a web: a regra das lojas no celular (D7) está no Jest
 * (`CartaoMeuPlano.test.tsx`, `financeiro.test.ts`). Relógio em 19/10/2026; só dados fictícios, API simulada.
 */

const CAPTURAS = 'test-results/financeiro-formas-de-recebimento';
const LINK_DO_PLANO = 'https://pagamento.exemplo.invalid/plano-mensal';

const ehPutDasFormas = (p: { metodo: string; caminho: string }) => p.metodo === 'PUT' && p.caminho === '/financeiro/formas-de-recebimento';
const corposDasFormas = (estado: EstadoFinanceiro) => estado.formasRecebidas;

async function abrirRecebimento(page: Page, estado: EstadoFinanceiro, opcoes: { permissoes?: string[]; infinitePay?: boolean; extra?: RespostasApi } = {}) {
  await fixarHoje(page);
  const api = await simularApi(page, {
    ...(await sessaoComFinanceiro(page, opcoes.permissoes, opcoes.infinitePay ?? true)), ...rotasDoFinanceiro(estado), ...opcoes.extra,
  });
  await page.goto('/treinador/financeiro?aba=recebimento');
  await expect(page.getByRole('tab', { name: 'Recebimento', selected: true })).toBeVisible();
  return api;
}

async function semRolagemHorizontal(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra).toBeLessThanOrEqual(0);
}

/** Nenhum texto nem campo da página traz a chave inteira (só a máscara). */
async function semAChaveInteira(page: Page, chave: string) {
  expect(await page.evaluate((c) => document.body.innerText.includes(c)
    || [...document.querySelectorAll('input, textarea')].some((e) => (e as HTMLInputElement).value.includes(c)), chave)).toBe(false);
}

const salvarFormas = (page: Page) => page.getByRole('button', { name: 'Salvar formas de recebimento' });
/** Lembretes e recebimento (19/11): sem alteração, a barra das formas só diz "Tudo salvo", sem botão desativado. */
async function semAlteracaoNasFormas(page: Page) {
  await expect(salvarFormas(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Descartar alterações das formas de recebimento' })).toHaveCount(0);
  await expect(page.getByText('Tudo salvo', { exact: true }).first()).toBeVisible();
}
const tipoDaChave = (page: Page, rotulo: string) => page.getByRole('radiogroup', { name: 'Tipo da chave' }).getByRole('radio', { name: rotulo, exact: true });

test('configurar o Pix pela primeira vez: erros na tela sem chamar a API, o corpo certo, a chave some e só a máscara fica', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const estado = estadoFinanceiro({ recebimento: { ...RECEBIMENTO_CONFIGURADO } });
  const { pedidos, errosDaPagina } = await abrirRecebimento(page, estado);

  await expect(page.getByText('Formas de recebimento', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Integrações externas opcionais, recolhido/i }).click();
  await expect(page.getByText('Recebimento online pela InfinitePay', { exact: true })).toBeVisible();
  await expect(page.getByText('Sempre ligado', { exact: true })).toBeVisible();
  await semAlteracaoNasFormas(page);
  await page.getByRole('switch', { name: 'Pix copia e cola' }).click();
  await expect(page.getByText(/A chave Pix vai dentro do código que o aluno copia/)).toBeVisible();

  // Vazio: cada campo diz o que falta; nada vai ao servidor.
  await salvarFormas(page).click();
  await expect(page.getByText('Escolha o tipo da chave.')).toBeVisible();
  await expect(page.getByText('Informe o nome de quem recebe.')).toBeVisible();
  await expect(page.getByText('Informe a cidade.')).toBeVisible();
  await expect(page.getByText('Confira os campos destacados.')).toBeVisible();
  await page.screenshot({ path: `${CAPTURAS}/pix-erros-1280.png`, fullPage: true });

  await tipoDaChave(page, 'E-mail').click();
  // Chave do tipo E-mail é onde o navegador poria o e-mail do login: o campo pede para não preencher (defeito de 28/11).
  for (const [nome, valor] of [['autocomplete', 'off'], ['id', 'chave-pix'], ['data-1p-ignore', 'true'], ['data-lpignore', 'true'], ['data-form-type', 'other']]) {
    await expect(page.getByLabel('Chave Pix', { exact: true })).toHaveAttribute(nome, valor);
  }
  await page.getByLabel('Chave Pix', { exact: true }).fill('treinador@');
  await page.getByLabel('Nome do recebedor').fill('Treino Exemplo');
  await page.getByLabel('Cidade').fill('Cascavel');
  await expect(page.getByText(/8 de 15 caracteres/)).toBeVisible();
  await expect(page.getByText(/14 de 25 caracteres/)).toBeVisible();
  await salvarFormas(page).click();
  await expect(page.getByText('Informe um e-mail válido.')).toBeVisible();
  expect(pedidos.filter(ehPutDasFormas)).toEqual([]);

  await page.getByLabel('Chave Pix', { exact: true }).fill(CHAVE_PIX_FALSA);
  await salvarFormas(page).click();
  await expect(page.getByText('Formas de recebimento salvas.')).toBeVisible();
  expect(corposDasFormas(estado)[0]).toEqual({
    infinitePay: true, linkProprio: false, pix: true, manual: true, versao: null,
    pixConfig: { tipoChave: 'EMAIL', chave: CHAVE_PIX_FALSA, nomeRecebedor: 'Treino Exemplo', cidade: 'Cascavel' },
  });
  // Depois de salvar, só a máscara: o campo some e a chave inteira não está em lugar nenhum da página.
  await expect(page.getByText(CHAVE_PIX_FALSA_MASCARADA)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Trocar a chave' })).toBeVisible();
  await semAChaveInteira(page, CHAVE_PIX_FALSA);
  await semAlteracaoNasFormas(page);
  await page.screenshot({ path: `${CAPTURAS}/pix-salvo-1280.png`, fullPage: true });

  // Mudar só a cidade: o corpo vai sem a chave (o servidor mantém a gravada) e com a versão nova.
  await page.getByLabel('Cidade').fill('Toledo');
  await salvarFormas(page).click();
  await expect(page.getByText('Formas de recebimento salvas.').first()).toBeVisible();
  await expect.poll(() => corposDasFormas(estado).length).toBe(2);
  const segundo = corposDasFormas(estado)[1];
  expect(segundo.versao).toBe(0);
  expect(segundo.pixConfig).toEqual({ tipoChave: 'EMAIL', nomeRecebedor: 'Treino Exemplo', cidade: 'Toledo' });
  expect(segundo.pixConfig && 'chave' in segundo.pixConfig).toBe(false);

  // Desligar o Pix: vai sem `pixConfig` e a tela diz que os dados continuam guardados.
  await page.getByRole('switch', { name: 'Pix copia e cola' }).click();
  await salvarFormas(page).click();
  await expect.poll(() => corposDasFormas(estado).length).toBe(3);
  const terceiro = corposDasFormas(estado)[2];
  expect(terceiro).toEqual({ infinitePay: true, linkProprio: false, pix: false, manual: true, versao: 1 });
  expect('pixConfig' in terceiro).toBe(false);
  await expect(page.getByText(/O Pix está desligado. A chave e os dados gravados continuam guardados/)).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('trocar a chave: o campo nasce vazio, a máscara segue o tipo e mudar o tipo pede a chave nova', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const estado = estadoFinanceiro({ formas: structuredClone(FORMAS_COM_PIX), chavePixGuardada: CHAVE_PIX_FALSA });
  const { errosDaPagina } = await abrirRecebimento(page, estado);

  await expect(page.getByText(CHAVE_PIX_FALSA_MASCARADA)).toBeVisible();
  await page.getByRole('button', { name: 'Trocar a chave' }).click();
  await expect(page.getByLabel('Nova chave Pix')).toHaveValue('');
  await expect(page.getByLabel('Nova chave Pix')).toBeFocused();
  // O fantasma "Manter" começa na mesma borda do campo (o texto, sem o recuo do preenchimento de 16 px).
  const campo = await page.getByLabel('Nova chave Pix').boundingBox();
  const manter = await page.getByRole('button', { name: 'Manter a chave gravada' }).boundingBox();
  expect(Math.abs((manter?.x ?? 0) + 16 - (campo?.x ?? 0))).toBeLessThan(1.5);
  await page.getByRole('button', { name: 'Manter a chave gravada' }).click();
  await expect(page.getByText(CHAVE_PIX_FALSA_MASCARADA)).toBeVisible();
  // O campo sumiu: o foco vai ao "Trocar a chave", que voltou no lugar dele (e não ao início da página).
  await expect(page.getByRole('button', { name: 'Trocar a chave' })).toBeFocused();

  // Mudar o tipo sem digitar a chave nova: o campo aparece e o salvar pede a chave daquele tipo.
  await tipoDaChave(page, 'CPF').click();
  await salvarFormas(page).click();
  await expect(page.getByText('Você mudou o tipo: informe a chave deste tipo.')).toBeVisible();
  await expect(page.getByLabel('Nova chave Pix')).toBeFocused();
  await page.getByLabel('Nova chave Pix').pressSequentially('52998224725');
  await expect(page.getByLabel('Nova chave Pix')).toHaveValue('529.982.247-25');
  await tipoDaChave(page, 'Telefone').click();
  await expect(page.getByLabel('Nova chave Pix')).toHaveValue('');
  await page.getByLabel('Nova chave Pix').pressSequentially('45999998888');
  await expect(page.getByLabel('Nova chave Pix')).toHaveValue('(45) 99999-8888');
  await tipoDaChave(page, 'CPF').click();
  await page.getByLabel('Nova chave Pix').pressSequentially('52998224725');
  await salvarFormas(page).click();
  await expect(page.getByText('Formas de recebimento salvas.')).toBeVisible();
  expect(corposDasFormas(estado).at(-1)?.pixConfig).toEqual({ tipoChave: 'CPF', chave: '52998224725', nomeRecebedor: 'Treino Exemplo', cidade: 'Cascavel' });
  await expect(page.getByText('***.***.***-25')).toBeVisible();
  await semAChaveInteira(page, '52998224725');
  await semAChaveInteira(page, '529.982.247-25');
  expect(errosDaPagina).toEqual([]);
});

test('erros do servidor: cada campo do Pix com a mensagem dele, campo que a tela não mostra no texto geral, e o 409 recarrega', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const estado = estadoFinanceiro({ formas: structuredClone(FORMAS_COM_PIX), chavePixGuardada: CHAVE_PIX_FALSA });
  const { pedidos, errosDaPagina } = await abrirRecebimento(page, estado);

  estado.recusaDasFormas = [
    { field: 'pixConfig.tipoChave', message: 'Tipo de chave não aceito.' },
    { field: 'pixConfig.chave', message: 'A chave não confere com o tipo.' },
    { field: 'pixConfig.nomeRecebedor', message: 'Use só letras no nome do recebedor.' },
    { field: 'pixConfig.cidade', message: 'Use só letras na cidade.' },
  ];
  await page.getByLabel('Cidade').fill('Toledo');
  await salvarFormas(page).click();
  for (const m of ['Tipo de chave não aceito.', 'A chave não confere com o tipo.', 'Use só letras no nome do recebedor.', 'Use só letras na cidade.']) {
    await expect(page.getByText(m)).toBeVisible();
  }
  await expect(page.getByText('Confira os campos destacados.')).toBeVisible();
  await page.screenshot({ path: `${CAPTURAS}/erros-do-servidor-1280.png`, fullPage: true });

  estado.recusaDasFormas = [{ field: 'manual', message: 'O Manual fica sempre ligado.' }];
  await salvarFormas(page).click();
  await expect(page.getByText('O Manual fica sempre ligado.')).toBeVisible();

  // Outra pessoa salvou no meio (versão nova no servidor): 409, aviso neutro e o formulário recarregado com o que vale agora.
  estado.formas = { ...estado.formas, linkProprio: false, versao: 7 };
  await page.getByRole('switch', { name: 'Pix copia e cola' }).click();
  await salvarFormas(page).click();
  await expect(page.getByText(MENSAGEM_CONFLITO_DAS_FORMAS)).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Pix copia e cola' })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Link de pagamento próprio' })).not.toBeChecked();
  await semAlteracaoNasFormas(page);
  expect(pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/financeiro/formas-de-recebimento').length).toBeGreaterThanOrEqual(2);
  expect(errosDaPagina).toEqual([]);
});

test('sem FINANCEIRO_ALTERAR: as formas e o Pix só em leitura, com a chave mascarada e sem "Salvar"', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const estado = estadoFinanceiro({ formas: structuredClone(FORMAS_COM_PIX), recebimento: { ...RECEBIMENTO_CONFIGURADO } });
  const { pedidos, errosDaPagina } = await abrirRecebimento(page, estado, { permissoes: ['FINANCEIRO_LER'] });

  await expect(page.getByText('Para mudar as formas de recebimento, peça a quem administra o financeiro.')).toBeVisible();
  await expect(page.getByText(CHAVE_PIX_FALSA_MASCARADA)).toBeVisible();
  await expect(page.getByText('Sempre ligado')).toBeVisible();
  await expect(page.getByRole('switch')).toHaveCount(0);
  await expect(salvarFormas(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Trocar a chave' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Apagar dados do Pix' })).toHaveCount(0);
  await semRolagemHorizontal(page);
  await page.screenshot({ path: `${CAPTURAS}/leitura-390.png`, fullPage: true });
  expect(pedidos.filter(ehPutDasFormas)).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('sem a InfinitePay na instalação: a aba existe só com as formas, sem a linha da InfinitePay, e o valor gravado dela segue igual', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const estado = estadoFinanceiro({ formas: { ...structuredClone(FORMAS_COM_PIX), infinitePay: true } });
  const { pedidos, errosDaPagina } = await abrirRecebimento(page, estado, { infinitePay: false });

  await expect(page.getByText('Formas de recebimento', { exact: true })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'InfinitePay' })).toHaveCount(0);
  await expect(page.getByText('Recebimento online pela InfinitePay')).toHaveCount(0);
  await page.getByRole('switch', { name: 'Link de pagamento próprio' }).click();
  await salvarFormas(page).click();
  await expect.poll(() => corposDasFormas(estado).length).toBe(1);
  expect(corposDasFormas(estado)[0]).toMatchObject({ infinitePay: true, linkProprio: false, pix: true });
  expect(pedidos.filter((p) => p.caminho.startsWith('/financeiro/recebimento-online'))).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('carregando e erro ao buscar as formas: esqueleto e "Tentar de novo"', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  let liberar: () => void = () => undefined;
  const espera = new Promise<void>((r) => { liberar = r; });
  let vezes = 0;
  const estado = estadoFinanceiro();
  const { errosDaPagina } = await abrirRecebimento(page, estado, {
    extra: {
      'GET /financeiro/formas-de-recebimento': async (_p, route) => {
        vezes += 1;
        if (vezes === 1) { await espera; return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify(erroApi(500, 'Falha de teste.').corpo) }); }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(estado.formas) });
      },
    },
  });
  await page.screenshot({ path: `${CAPTURAS}/carregando-1280.png`, fullPage: true });
  liberar();
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  await page.screenshot({ path: `${CAPTURAS}/erro-1280.png`, fullPage: true });
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(page.getByRole('switch', { name: 'Pix copia e cola' })).toBeVisible();
  expect(errosDaPagina.filter((e) => !/500/.test(e))).toEqual([]);
});

test('plano com link de pagamento: http é recusado na tela, o 422 do servidor fica no campo, o link aparece na lista e o PUT o reenvia', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await fixarHoje(page);
  const estado = estadoFinanceiro();
  const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  await page.goto('/treinador/financeiro?aba=planos');
  await page.getByRole('button', { name: 'Novo plano' }).click();
  const folha = page.getByRole('dialog', { name: 'Novo plano' });
  await expect(folha.getByText(/Para quem cobra por outra plataforma/)).toBeVisible();
  await folha.getByLabel('Nome do plano').fill('Consultoria com link');
  await folha.getByLabel('Valor', { exact: true }).pressSequentially('15000');
  await folha.getByLabel('Link de pagamento (opcional)').fill('http://pagamento.exemplo.invalid/x');
  await folha.getByRole('button', { name: 'Criar plano' }).click();
  await expect(folha.getByText('Use https.')).toBeVisible();
  // Usuário e porta: o app diz qual é o problema antes de enviar.
  await folha.getByLabel('Link de pagamento (opcional)').fill('https://loja@pagamento.exemplo.invalid/x');
  await expect(folha.getByText('O link não pode ter usuário ou senha.')).toBeVisible();
  await folha.getByLabel('Link de pagamento (opcional)').fill('https://pagamento.exemplo.invalid:8443/x');
  await expect(folha.getByText('O link não pode ter porta.')).toBeVisible();
  expect(estado.planos).toEqual([]);

  // O que só o servidor recusa (host inválido) volta no campo com a mensagem dele.
  await folha.getByLabel('Link de pagamento (opcional)').fill('https://pagamento%zz.exemplo.invalid/x');
  await folha.getByRole('button', { name: 'Criar plano' }).click();
  await expect(folha.getByText('Link não aceito. Use um link https completo.')).toBeVisible();
  await page.screenshot({ path: `${CAPTURAS}/plano-link-erro-1280.png` });

  await folha.getByLabel('Link de pagamento (opcional)').fill(LINK_DO_PLANO);
  await expect(folha.getByText('Link não aceito. Use um link https completo.')).toHaveCount(0);
  await folha.getByRole('button', { name: 'Criar plano' }).click();
  await expect(page.getByText('Plano criado.')).toBeVisible();
  expect(estado.planos[0]?.linkDePagamento).toBe(LINK_DO_PLANO);
  await expect(page.getByText('Com link de pagamento')).toBeVisible();
  await page.screenshot({ path: `${CAPTURAS}/planos-com-link-1280.png`, fullPage: true });

  // Editar o nome reenvia o link (o PUT substitui inteiro); apagar o link manda nulo.
  await page.getByRole('button', { name: 'Abrir plano Consultoria com link' }).click();
  const edicao = page.getByRole('dialog', { name: 'Editar plano' });
  await expect(edicao.getByLabel('Link de pagamento (opcional)')).toHaveValue(LINK_DO_PLANO);
  await edicao.getByLabel('Nome do plano').fill('Consultoria mensal com link');
  await edicao.getByRole('button', { name: 'Salvar plano' }).click();
  await expect(page.getByText('Plano salvo.')).toBeVisible();
  expect(estado.planos[0]?.linkDePagamento).toBe(LINK_DO_PLANO);
  await page.getByRole('button', { name: 'Abrir plano Consultoria mensal com link' }).click();
  await page.getByRole('dialog', { name: 'Editar plano' }).getByLabel('Link de pagamento (opcional)').fill('');
  await page.getByRole('dialog', { name: 'Editar plano' }).getByRole('button', { name: 'Salvar plano' }).click();
  await expect.poll(() => estado.planos[0]?.linkDePagamento).toBeNull();
  await expect(page.getByText('Com link de pagamento')).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------
// Aluno (web). O e2e não prova o celular: em 390 px continua sendo a web, com o "Pagar" sempre permitido (D7 no Jest).
// ---------------------------------------------------------------------------------------------------------------------

const PLANO_COM_LINK: PlanoResponse = {
  id: 'b0000000-0000-4000-8000-0000000000f1', nome: 'Consultoria mensal', valorCentavos: 15_000, periodicidade: 'MENSAL', arquivado: false,
  criadoEm: '2026-09-01T12:00:00Z', versao: 0, tempoMinimoMeses: null, regraDeSaida: null, linkDePagamento: LINK_DO_PLANO, incluiTreino: true, incluiDieta: true,
};
const CONTRATACAO: ContratacaoResponse = {
  id: 'e0000000-0000-4000-8000-0000000000cc', alunoId: ALUNO.id, planoComercialId: PLANO_COM_LINK.id, planoNome: PLANO_COM_LINK.nome,
  periodicidade: 'MENSAL', valorCentavos: 15_000, motivoValor: null, inicio: '2026-10-05', diaVencimento: 5, situacao: 'ATIVA', encerradaEm: null,
  criadoEm: '2026-10-01T12:00:00Z', versao: 0, minimoAte: null,
};
const MENSALIDADE: CobrancaResponse = {
  ...COBRANCA_ATRASADA, id: 'c0000000-0000-4000-8000-0000000000d1', contratacaoId: CONTRATACAO.id, alunoId: ALUNO.id, alunoNome: ALUNO.nome,
  competencia: '2026-11-05', vencimento: '2026-11-05', vencida: false, diasDeAtraso: null,
};
const AVULSA: CobrancaResponse = {
  ...MENSALIDADE, id: 'c0000000-0000-4000-8000-0000000000d2', tipo: 'AVULSA', contratacaoId: null, planoNome: null, competencia: null,
  descricao: 'Camiseta do time', valorCentavos: 5_000,
};

const estadoDoAluno = (parcial: Partial<EstadoFinanceiro> = {}) => estadoFinanceiro({
  planos: [{ ...PLANO_COM_LINK }], contratacoes: [{ ...CONTRATACAO }], cobrancas: [{ ...MENSALIDADE }, { ...AVULSA }], pagamentoOnline: true,
  recebimento: { ...RECEBIMENTO_CONFIGURADO }, formas: structuredClone(FORMAS_COM_PIX), chavePixGuardada: CHAVE_PIX_FALSA, ...parcial,
});

async function servirPaginaDePagamento(context: BrowserContext) {
  await context.route('https://pagamento.exemplo.invalid/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Pagamento</title><p>Pagamento de teste</p>' }));
}

/** O navegador de teste não deixa ler a área de transferência: um substituto guarda o que foi copiado (ou recusa). */
async function areaDeTransferencia(page: Page, recusar = false) {
  await page.addInitScript((r) => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (texto: string) => {
          if (r) return Promise.reject(new DOMException('Recusado', 'NotAllowedError'));
          (window as unknown as { __copiado?: string }).__copiado = texto;
          return Promise.resolve();
        },
      },
    });
    // A cópia antiga (`execCommand`) também falha quando o navegador recusa.
    if (r) document.execCommand = () => { throw new Error('Recusado'); };
  }, recusar);
}

async function abrirContaDoAluno(page: Page, estado: EstadoFinanceiro) {
  await fixarHoje(page);
  const api = await simularApi(page, {
    ...(await sessaoDeAluno(page)), ...(await sessao(page, ALUNO, { pagamentosHabilitados: true })), ...rotasDoFinanceiro(estado),
  });
  await page.goto('/aluno/conta');
  await expect(page.getByText('Em aberto', { exact: true }).first()).toBeVisible();
  return api;
}

for (const largura of [1280, 390]) {
  test(`aluno na web (${largura}px): InfinitePay, link do treinador e Pix com os rótulos certos; o link abre sem pedir nada à API e o Pix é copiado`, async ({ page, context }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await servirPaginaDePagamento(context);
    await areaDeTransferencia(page);
    const estado = estadoDoAluno();
    const { pedidos, errosDaPagina } = await abrirContaDoAluno(page, estado);

    // Mensalidade: as três ações; os dois "Pagar" com o nome de cada um. Avulsa: o link do plano não vale (só mensalidade), e a
    // InfinitePay tem o mesmo nome nas duas cobranças do cartão (nunca "Pagar" numa e "Pagar pela InfinitePay" na outra).
    await expect(page.getByRole('button', { name: /^Pagar pela InfinitePay: / })).toHaveCount(2);
    await expect(page.getByRole('button', { name: /^Pagar pelo link do treinador: / })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /^Pagar pela InfinitePay: Camiseta do time/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Pagar: / })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Copiar código Pix: / })).toHaveCount(2);
    await expect(page.getByText(TEXTO_COMBINE_COM_O_TREINADOR)).toHaveCount(0);
    // No celular e no PC as ações de uma cobrança vão em coluna, todas na mesma borda e na mesma largura, sem escadinha.
    const caixas = await Promise.all([/^Pagar pela InfinitePay: (?!Camiseta)/, /^Pagar pelo link do treinador: /, /^Copiar código Pix: (?!Camiseta)/]
      .map(async (nome) => (await page.getByRole('button', { name: nome }).boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 }));
    const larguras = caixas.map((c) => c.width);
    const bordas = caixas.map((c) => c.x);
    expect(Math.max(...larguras) - Math.min(...larguras)).toBeLessThan(1);
    expect(Math.max(...bordas) - Math.min(...bordas)).toBeLessThan(1);
    expect(Math.min(...larguras)).toBeGreaterThan(280);
    await semRolagemHorizontal(page);
    await page.getByText('Em aberto', { exact: true }).first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURAS}/aluno-acoes-${largura}.png` });

    const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: /^Pagar pelo link do treinador: / }).click()]);
    await popup.waitForURL(LINK_DO_PLANO);
    expect(await popup.evaluate(() => window.opener)).toBeNull();
    await popup.close();
    expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho.endsWith('/link'))).toEqual([]);

    await page.getByRole('button', { name: /^Copiar código Pix: (?!Camiseta)/ }).click();
    await expect(page.getByText(/Código Pix copiado/)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __copiado?: string }).__copiado)).toBe(CODIGO_PIX_FALSO);
    expect(estado.pixPedidos).toEqual([MENSALIDADE.id]);
    // O código nunca fica na tela quando a cópia dá certo.
    await expect(page.getByText(CODIGO_PIX_FALSO)).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
}

for (const largura of [390, 1280]) {
  test(`aluno em ${largura}px: o treinador desligou o Pix no meio (409 PIX_INDISPONIVEL): mensagem e a lista recarrega sem o botão`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await areaDeTransferencia(page);
    const estado = estadoDoAluno();
    const { errosDaPagina } = await abrirContaDoAluno(page, estado);
    estado.formas = { ...estado.formas, pix: false };
    await page.getByRole('button', { name: /^Copiar código Pix: (?!Camiseta)/ }).click();
    await expect(page.getByText('O Pix não está disponível para esta cobrança agora. Fale com o seu treinador.')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Copiar código Pix/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Pagar pela InfinitePay: / }).first()).toBeVisible();
    await semRolagemHorizontal(page);
    await page.getByText('Em aberto', { exact: true }).first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURAS}/aluno-pix-indisponivel-${largura}.png` });
    expect(errosDaPagina).toEqual([]);
  });

  test(`aluno em ${largura}px: a cópia recusada pelo navegador mostra o código para copiar à mão`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await areaDeTransferencia(page, true);
    const { errosDaPagina } = await abrirContaDoAluno(page, estadoDoAluno());
    await page.getByRole('button', { name: /^Copiar código Pix: (?!Camiseta)/ }).click();
    await expect(page.getByText('Não foi possível copiar sozinho. Selecione o código abaixo e copie à mão.')).toBeVisible();
    await expect(page.getByText('Código Pix copia e cola')).toBeVisible();
    await expect(page.getByText(CODIGO_PIX_FALSO)).toBeVisible();
    await expect(page.getByText(/Código Pix copiado/)).toHaveCount(0);
    await semRolagemHorizontal(page);
    await page.getByText('Código Pix copia e cola').scrollIntoViewIfNeeded();
    // O código leva a chave Pix (fictícia aqui): a captura cobre o texto dele, para a chave nunca aparecer inteira.
    await page.screenshot({ path: `${CAPTURAS}/aluno-pix-recusado-${largura}.png`, mask: [page.getByText(CODIGO_PIX_FALSO)] });
    expect(errosDaPagina).toEqual([]);
  });
}

test('aluno só com o Manual: nenhuma ação, o texto de combinar com o treinador e nenhum pedido de link ou Pix', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const estado = estadoDoAluno({ pagamentoOnline: false, formas: { infinitePay: true, linkProprio: false, pix: false, manual: true, pixConfig: null, versao: 0 } });
  const { pedidos, errosDaPagina } = await abrirContaDoAluno(page, estado);
  await expect(page.getByText(TEXTO_COMBINE_COM_O_TREINADOR)).toBeVisible();
  await expect(page.getByRole('button', { name: /pagar|Copiar código Pix/i })).toHaveCount(0);
  expect(pedidos.filter((p) => p.metodo === 'POST' && /\/(link|pix)$/.test(p.caminho))).toEqual([]);
  await page.getByText(TEXTO_COMBINE_COM_O_TREINADOR).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${CAPTURAS}/aluno-so-manual-390.png` });
  expect(errosDaPagina).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------
// D12: apagar os dados do Pix (painel de confirmação, nada de confirm()) e a dica da chave aleatória.
// ---------------------------------------------------------------------------------------------------------------------

const apagarPix = (page: Page) => page.getByRole('button', { name: 'Apagar dados do Pix', exact: true });

for (const largura of [1280, 390]) for (const tema of ['ESCURO', 'CLARO'] as const) {
  test(`apagar os dados do Pix em ${largura}px (${tema}): painel, corpo com a versão e o cartão sem chave, com aviso`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
    const estado = estadoFinanceiro({ formas: structuredClone(FORMAS_COM_PIX), chavePixGuardada: CHAVE_PIX_FALSA, recebimento: { ...RECEBIMENTO_CONFIGURADO } });
    const { errosDaPagina } = await abrirRecebimento(page, estado);
    await expect(page.getByText(CHAVE_PIX_FALSA_MASCARADA)).toBeVisible();
    await apagarPix(page).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURAS}/apagar-pix-botao-${largura}-${tema}.png` });
    expect((await apagarPix(page).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

    await apagarPix(page).click();
    const painel = page.getByRole('alertdialog', { name: 'Apagar os dados do Pix?' });
    await expect(painel.getByText(MENSAGEM_APAGAR_PIX)).toBeVisible();
    await page.screenshot({ path: `${CAPTURAS}/apagar-pix-painel-${largura}-${tema}.png` });
    // Voltar não apaga nada.
    await painel.getByRole('button', { name: 'Voltar' }).click();
    await expect(painel).toHaveCount(0);
    expect(estado.apagarPixRecebidos).toEqual([]);

    await apagarPix(page).click();
    await page.getByRole('alertdialog', { name: 'Apagar os dados do Pix?' }).getByRole('button', { name: 'Apagar dados do Pix' }).click();
    await expect(page.getByText(MENSAGEM_PIX_APAGADO)).toBeVisible();
    expect(estado.apagarPixRecebidos).toEqual([2]);
    // O cartão volta sem chave e com o Pix desligado; sem chave gravada, o botão some.
    await expect(page.getByRole('switch', { name: 'Pix copia e cola' })).not.toBeChecked();
    await expect(page.getByText(CHAVE_PIX_FALSA_MASCARADA)).toHaveCount(0);
    await expect(apagarPix(page)).toHaveCount(0);
    await expect(page.getByText(/O Pix está desligado. A chave e os dados gravados/)).toHaveCount(0);
    // Ligar de novo pede tudo do zero, com a dica da chave aleatória no campo.
    await page.getByRole('switch', { name: 'Pix copia e cola' }).click();
    await expect(page.getByLabel('Chave Pix', { exact: true })).toHaveValue('');
    await expect(page.getByText(DICA_DA_CHAVE_ALEATORIA)).toBeVisible();
    await expect(page.getByLabel('Nome do recebedor')).toHaveValue('');
    await semRolagemHorizontal(page);
    expect(errosDaPagina).toEqual([]);
  });
}

test('apagar os dados do Pix com o Pix desligado; o 409 recarrega e avisa, e apagar de novo vai com a versão nova', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const estado = estadoFinanceiro({ formas: { ...structuredClone(FORMAS_COM_PIX), pix: false }, chavePixGuardada: CHAVE_PIX_FALSA });
  const { errosDaPagina } = await abrirRecebimento(page, estado);
  await expect(page.getByText(/O Pix está desligado. A chave e os dados gravados continuam guardados/)).toBeVisible();
  // Outra aba gravou as formas enquanto esta estava aberta: a versão da tela ficou velha.
  estado.formas = { ...estado.formas, versao: 3 };
  await apagarPix(page).click();
  await page.getByRole('alertdialog', { name: 'Apagar os dados do Pix?' }).getByRole('button', { name: 'Apagar dados do Pix' }).click();
  await expect(page.getByText(MENSAGEM_CONFLITO_DO_APAGAR_PIX)).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect(estado.apagarPixRecebidos).toEqual([2]);
  // Recarregou (versão 3): apagar de novo vai com ela e passa.
  await apagarPix(page).click();
  await page.getByRole('alertdialog', { name: 'Apagar os dados do Pix?' }).getByRole('button', { name: 'Apagar dados do Pix' }).click();
  await expect(page.getByText(MENSAGEM_PIX_APAGADO)).toBeVisible();
  expect(estado.apagarPixRecebidos).toEqual([2, 3]);
  expect(errosDaPagina).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------
// Temas: a aba Recebimento com o Pix gravado (só a máscara) e com os erros, em 390 e 1280, claro, escuro e areia.
// ---------------------------------------------------------------------------------------------------------------------

const TEMAS = [
  { nome: 'claro', preferencias: { tema: 'CLARO' } },
  { nome: 'escuro', preferencias: { tema: 'ESCURO' } },
  { nome: 'areia', preferencias: { tema: 'AREIA' } },
] as const;

for (const { nome, preferencias } of TEMAS) for (const largura of [1280, 390]) {
  test(`tema ${nome} em ${largura}px: a aba Recebimento com o Pix gravado e com os erros, sem rolagem horizontal`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.addInitScript(([id, p]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(p)), [TREINADOR.id, preferencias] as const);
    const estado = estadoFinanceiro({ formas: structuredClone(FORMAS_COM_PIX), chavePixGuardada: CHAVE_PIX_FALSA, recebimento: { ...RECEBIMENTO_CONFIGURADO } });
    const { errosDaPagina } = await abrirRecebimento(page, estado);
    await expect(page.getByText(CHAVE_PIX_FALSA_MASCARADA)).toBeVisible();
    await semRolagemHorizontal(page);
    // A escolha compacta do tipo da chave mantém o alvo de toque de 44 px em cada opção.
    for (const opcao of await page.getByRole('radiogroup', { name: 'Tipo da chave' }).getByRole('radio').all()) {
      expect((await opcao.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: `${CAPTURAS}/${nome}-recebimento-${largura}.png`, fullPage: true });

    await page.getByLabel('Nome do recebedor').fill('');
    await page.getByLabel('Cidade').fill('');
    await salvarFormas(page).click();
    await expect(page.getByText('Informe a cidade.')).toBeVisible();
    await semRolagemHorizontal(page);
    // Exato: "O que o aluno vê" também fala dos dados do Pix quando eles faltam (lembretes e recebimento, 19/11).
    await page.getByText('Dados do Pix', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURAS}/${nome}-recebimento-erros-${largura}.png`, fullPage: true });
    await semAChaveInteira(page, CHAVE_PIX_FALSA);
    expect(errosDaPagina).toEqual([]);
  });
}
