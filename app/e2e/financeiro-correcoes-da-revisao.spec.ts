import { expect, test, type Page } from '@playwright/test';

import type { CobrancaResponse, ContratacaoResponse, PlanoResponse } from '../src/api/financeiroTipos';
import type { AlunoResumo } from '../src/api/tipos';
import { ALUNO, sessao, simularApi, TREINADOR } from './api-falsa';
import { fixarHoje, sessaoDeAluno } from './aluno';
import {
  CHAVE_PIX_FALSA, COBRANCA_ATRASADA, estadoFinanceiro, FORMAS_COM_PIX, LINK_DE_PAGAMENTO, RECEBIMENTO_CONFIGURADO, rotasDoFinanceiro,
  sessaoComFinanceiro, type EstadoFinanceiro,
} from './financeiro-falso';

/**
 * Correções da revisão de front do Financeiro, Fase 1: a cópia recusada pelo navegador nunca vira "copiado" (lote de links e
 * folha da cobrança) e os estados que a revisão não tinha visto, capturados em 390 e 1280 px (barra do lote com os quatro
 * botões, o menu "Mais ações", o resultado do cancelamento, a avulsa com 100 alunos e "Ver todos", e o rodapé da folha com a
 * tela baixa do teclado aberto). Relógio em 19/10/2026; só dados fictícios, API simulada.
 */

const CAPTURAS = 'test-results/financeiro-correcoes-da-revisao';

const cobranca = (n: number, alunoNome: string, parcial: Partial<CobrancaResponse> = {}): CobrancaResponse => ({
  ...COBRANCA_ATRASADA, id: `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, alunoNome, criadoEm: '2026-09-20T12:00:00Z', ...parcial,
});
const BRUNA = cobranca(1, 'Bruna Teste');
const CAIO = cobranca(2, 'Caio Teste', { valorCentavos: 20_000, vencimento: '2026-10-10', diasDeAtraso: 9 });
const DORA = cobranca(3, 'Dora Teste', { valorCentavos: 10_000, competencia: '2026-11-05', vencimento: '2026-11-05', vencida: false, diasDeAtraso: null });

const aluno = (n: number): AlunoResumo => ({
  id: `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, nome: `Aluno Fictício ${String(n).padStart(3, '0')}`, ativo: true,
  temAcesso: true, planoAtivo: null, ultimoRegistro: null,
});

async function abrir(page: Page, estado: EstadoFinanceiro) {
  await fixarHoje(page);
  const api = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
  // filtro padrão das cobranças (19/11): `filtro=nenhum` abre a lista sem o padrão (Ativas, mês de vencimento atual); o padrão tem o spec próprio.
  await page.goto('/treinador/financeiro?aba=cobrancas&filtro=nenhum');
  await expect(page.getByRole('button', { name: 'Nova cobrança avulsa' })).toBeVisible();
  return api;
}

async function semRolagemHorizontal(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra).toBeLessThanOrEqual(0);
}

/** O navegador recusa a cópia: `writeText` rejeita e a cópia antiga (`execCommand`) também falha; `setStringAsync` resolve `false`. */
async function copiaRecusada(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new DOMException('Recusado', 'NotAllowedError')) },
    });
    document.execCommand = () => { throw new Error('Recusado'); };
  });
}

test('cópia recusada: no lote de links e na folha da cobrança o aviso manda copiar à mão, nunca "copiado"', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await copiaRecusada(page);
  const estado = estadoFinanceiro({ cobrancas: [{ ...BRUNA }, { ...CAIO }], recebimento: { ...RECEBIMENTO_CONFIGURADO }, pagamentoOnline: true });
  const { errosDaPagina } = await abrir(page, estado);

  await page.getByRole('button', { name: 'Selecionar todas desta página' }).click();
  await page.getByRole('button', { name: 'Mais ações' }).click();
  await page.getByRole('dialog', { name: 'Ações com 2 cobranças' }).getByRole('button', { name: /Gerar links de pagamento/ }).click();
  const resultado = page.getByRole('dialog', { name: 'Links de pagamento' });
  await resultado.getByRole('button', { name: 'Copiar os 2 links' }).click();
  await expect(page.getByText('Não foi possível copiar sozinho. Selecione o link na lista e copie à mão.')).toBeVisible();
  await expect(page.getByText('Links copiados, um por linha.')).toHaveCount(0);
  await expect(resultado.getByText(/^https:\/\/pagamento\.exemplo\.invalid\/abc-/)).toHaveCount(2);
  await page.screenshot({ path: `${CAPTURAS}/lote-copia-recusada-1280.png` });
  await resultado.getByRole('button', { name: 'Fechar' }).first().click();

  await page.getByRole('button', { name: 'Abrir cobrança de Bruna Teste' }).click();
  const folha = page.getByRole('dialog', { name: /^Cobrança de/ });
  await folha.getByRole('button', { name: 'Copiar link de pagamento' }).click();
  await expect(page.getByText('Não foi possível copiar sozinho. Selecione o link e copie à mão.')).toBeVisible();
  await expect(page.getByText('Link copiado.')).toHaveCount(0);
  await expect(folha.getByText(LINK_DE_PAGAMENTO, { exact: true })).toBeVisible();
  await page.screenshot({ path: `${CAPTURAS}/folha-copia-recusada-1280.png` });
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [390, 1280]) {
  test(`lote em ${largura}px: a barra com os quatro botões, o menu "Mais ações" e o resultado do cancelamento`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const estado = estadoFinanceiro({ cobrancas: [{ ...BRUNA }, { ...CAIO }, { ...DORA }], recebimento: { ...RECEBIMENTO_CONFIGURADO }, recusasDoLote: { [CAIO.id]: 'CONFLITO_EDICAO' } });
    const { errosDaPagina } = await abrir(page, estado);
    await page.getByRole('checkbox', { name: /^Selecionar cobrança de Bruna/ }).click();
    await page.getByRole('checkbox', { name: /^Selecionar cobrança de Caio/ }).click();
    for (const nome of ['Selecionar todas desta página', 'Limpar seleção', 'Mais ações', 'Revisar pagamentos']) {
      const caixa = await page.getByRole('button', { name: nome }).boundingBox();
      expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect((caixa?.x ?? 0) + (caixa?.width ?? 0)).toBeLessThanOrEqual(largura);
    }
    await semRolagemHorizontal(page);
    await page.getByText('2 cobranças selecionadas').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURAS}/barra-do-lote-${largura}.png` });

    await page.getByRole('button', { name: 'Mais ações' }).click();
    const menu = page.getByRole('dialog', { name: 'Ações com 2 cobranças' });
    await expect(menu.getByRole('button', { name: /Cancelar cobranças/ })).toBeVisible();
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/menu-mais-acoes-${largura}.png` });

    await menu.getByRole('button', { name: /Cancelar cobranças/ }).click();
    await page.getByRole('alertdialog', { name: 'Cancelar 2 cobranças?' }).getByRole('button', { name: 'Cancelar 2 cobranças' }).click();
    const resultado = page.getByRole('dialog', { name: 'Resultado do cancelamento' });
    await expect(resultado.getByText('1 de 2 cobranças canceladas. 1 não foi cancelada: veja o motivo abaixo.')).toBeVisible();
    await expect(resultado.getByText('Não cancelada: A cobrança foi alterada por outra pessoa ou aba.')).toBeVisible();
    // Cancelar não tem "Tentar de novo" (só o link tem).
    await expect(resultado.getByRole('button', { name: /Tentar de novo/ })).toHaveCount(0);
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/resultado-cancelamento-${largura}.png` });
    expect(errosDaPagina).toEqual([]);
  });

  test(`avulsa em ${largura}px: 100 alunos em páginas de 30, "Ver todos" e o limite`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const alunos = Array.from({ length: 104 }, (_, i) => aluno(i + 1));
    const { errosDaPagina } = await abrir(page, estadoFinanceiro({ cobrancas: [{ ...BRUNA }], alunos }));
    await page.getByRole('button', { name: 'Nova cobrança avulsa' }).click();
    const folha = page.getByRole('dialog', { name: 'Nova cobrança avulsa' });
    for (let pagina = 0; pagina < 4; pagina += 1) {
      await folha.getByRole('button', { name: 'Marcar os visíveis (até 100)' }).click();
      if (pagina < 3) await folha.getByRole('button', { name: 'Próximos alunos' }).click();
    }
    await expect(folha.getByText('100 alunos selecionados')).toBeVisible();
    await expect(folha.getByText(/O limite é de 100 alunos por vez/)).toBeVisible();
    await folha.getByRole('button', { name: 'Ver todos (100)' }).click();
    await expect(folha.getByRole('list', { name: 'Alunos selecionados' }).getByRole('listitem')).toHaveCount(100);
    await semRolagemHorizontal(page);
    await folha.getByText('Selecionados', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURAS}/avulsa-100-alunos-${largura}.png` });
    expect(errosDaPagina).toEqual([]);
  });
}

test('avulsa no celular com a tela baixa (teclado aberto, ~480 px): o rodapé da folha continua à vista com o campo focado', async ({ page }) => {
  // Aproximação: o navegador de teste não abre teclado; a altura da janela de 480 px faz o papel da área que sobra.
  await page.setViewportSize({ width: 390, height: 480 });
  const { errosDaPagina } = await abrir(page, estadoFinanceiro({ cobrancas: [{ ...BRUNA }], alunos: [aluno(1)] }));
  await page.getByRole('button', { name: 'Nova cobrança avulsa' }).click();
  const folha = page.getByRole('dialog', { name: 'Nova cobrança avulsa' });
  await folha.getByRole('checkbox', { name: 'Aluno Fictício 001' }).click();
  await folha.getByRole('button', { name: 'Continuar' }).click();
  await folha.getByRole('textbox', { name: 'Descrição' }).focus();
  const continuar = await folha.getByRole('button', { name: 'Continuar' }).boundingBox();
  const campo = await folha.getByRole('textbox', { name: 'Descrição' }).boundingBox();
  expect((continuar?.y ?? 0) + (continuar?.height ?? 0)).toBeLessThanOrEqual(480);
  expect((campo?.y ?? 0) + (campo?.height ?? 0)).toBeLessThanOrEqual(continuar?.y ?? 0);
  await semRolagemHorizontal(page);
  await page.screenshot({ path: `${CAPTURAS}/avulsa-tela-baixa-390x480.png` });
  expect(errosDaPagina).toEqual([]);
});

for (const tema of ['ESCURO', 'AREIA'] as const) {
  test(`barra do lote no tema ${tema.toLowerCase()} em 390px: as fileiras ocupam a largura, sem rolagem horizontal`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
    const { errosDaPagina } = await abrir(page, estadoFinanceiro({ cobrancas: [{ ...BRUNA }, { ...CAIO }, { ...DORA }] }));
    await page.getByRole('checkbox', { name: /^Selecionar cobrança de Bruna/ }).click();
    const selecionar = await page.getByRole('button', { name: 'Selecionar todas desta página' }).boundingBox();
    const revisar = await page.getByRole('button', { name: 'Revisar pagamentos' }).boundingBox();
    expect(Math.abs((selecionar?.width ?? 0) - (revisar?.width ?? 0))).toBeLessThan(1);
    await semRolagemHorizontal(page);
    await page.getByText('1 cobrança selecionada').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURAS}/barra-do-lote-${tema.toLowerCase()}-390.png` });
    expect(errosDaPagina).toEqual([]);
  });
}

const preferir = (page: Page, id: string, tema: string) =>
  page.addInitScript(([i, t]) => localStorage.setItem(`treinos:${i}:preferencias`, JSON.stringify({ tema: t })), [id, tema] as const);

for (const largura of [390, 1280]) {
  test(`formas em ${largura}px: "Trocar a chave" com o campo vazio e o "Manter" alinhado aos rótulos`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await fixarHoje(page);
    const estado = estadoFinanceiro({ formas: structuredClone(FORMAS_COM_PIX), chavePixGuardada: CHAVE_PIX_FALSA });
    const { errosDaPagina } = await simularApi(page, { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado) });
    await page.goto('/treinador/financeiro?aba=recebimento');
    await page.getByRole('button', { name: 'Trocar a chave' }).click();
    await expect(page.getByLabel('Nova chave Pix')).toHaveValue('');
    await page.getByRole('button', { name: 'Manter a chave gravada' }).hover();
    await semRolagemHorizontal(page);
    await page.getByLabel('Nova chave Pix').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURAS}/formas-trocar-a-chave-${largura}.png` });
    expect(errosDaPagina).toEqual([]);
  });
}

for (const tema of ['ESCURO', 'AREIA'] as const) {
  test(`avulsa no tema ${tema.toLowerCase()} em 390px: quem saiu da lista, o selo e "Remover os que não estão ativos"`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await preferir(page, TREINADOR.id, tema);
    const estado = estadoFinanceiro({ cobrancas: [{ ...BRUNA }], alunos: [aluno(1), aluno(2)] });
    const { errosDaPagina } = await abrir(page, estado);
    await page.getByRole('button', { name: 'Nova cobrança avulsa' }).click();
    const folha = page.getByRole('dialog', { name: 'Nova cobrança avulsa' });
    await folha.getByRole('checkbox', { name: 'Aluno Fictício 001' }).click();
    await folha.getByRole('checkbox', { name: 'Aluno Fictício 002' }).click();
    await folha.getByRole('button', { name: 'Continuar' }).click();
    await folha.getByRole('textbox', { name: 'Descrição' }).fill('Camiseta do time');
    await folha.getByLabel('Valor de cada parcela').pressSequentially('5000');
    await folha.getByRole('button', { name: 'Continuar' }).click();
    await folha.getByLabel('Primeiro vencimento').fill('31/10/2026');
    await folha.getByRole('button', { name: 'Revisar e gerar' }).click();
    estado.alunos[1].ativo = false;
    await page.getByRole('alertdialog', { name: 'Gerar 2 cobranças?' }).getByRole('button', { name: 'Gerar 2 cobranças' }).click();
    await expect(folha.getByRole('button', { name: 'Remover os que não estão ativos (1)' })).toBeVisible();
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/avulsa-quem-saiu-${tema.toLowerCase()}-390.png` });
    await folha.getByText('Selecionados', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURAS}/avulsa-selo-nao-esta-ativo-${tema.toLowerCase()}-390.png` });
    expect(errosDaPagina).toEqual([]);
  });

  test(`aluno no tema ${tema.toLowerCase()} em 1280px: as ações de cada cobrança em coluna, na mesma largura`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await preferir(page, ALUNO.id, tema);
    await fixarHoje(page);
    const plano: PlanoResponse = {
      id: 'b0000000-0000-4000-8000-0000000000f1', nome: 'Consultoria mensal', valorCentavos: 15_000, periodicidade: 'MENSAL', arquivado: false,
      criadoEm: '2026-09-01T12:00:00Z', versao: 0, tempoMinimoMeses: null, regraDeSaida: null, linkDePagamento: 'https://pagamento.exemplo.invalid/plano',
    };
    const contratacao: ContratacaoResponse = {
      id: 'e0000000-0000-4000-8000-0000000000cc', alunoId: ALUNO.id, planoComercialId: plano.id, planoNome: plano.nome, periodicidade: 'MENSAL',
      valorCentavos: 15_000, motivoValor: null, inicio: '2026-10-05', diaVencimento: 5, situacao: 'ATIVA', encerradaEm: null,
      criadoEm: '2026-10-01T12:00:00Z', versao: 0, minimoAte: null,
    };
    const mensalidade: CobrancaResponse = {
      ...COBRANCA_ATRASADA, id: 'c0000000-0000-4000-8000-0000000000d1', contratacaoId: contratacao.id, alunoId: ALUNO.id, alunoNome: ALUNO.nome,
      competencia: '2026-11-05', vencimento: '2026-11-05', vencida: false, diasDeAtraso: null,
    };
    const avulsa: CobrancaResponse = {
      ...mensalidade, id: 'c0000000-0000-4000-8000-0000000000d2', tipo: 'AVULSA', contratacaoId: null, planoNome: null, competencia: null,
      descricao: 'Camiseta do time', valorCentavos: 5_000,
    };
    const estado = estadoFinanceiro({
      planos: [plano], contratacoes: [contratacao], cobrancas: [mensalidade, avulsa], pagamentoOnline: true,
      recebimento: { ...RECEBIMENTO_CONFIGURADO }, formas: structuredClone(FORMAS_COM_PIX), chavePixGuardada: CHAVE_PIX_FALSA,
    });
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAluno(page)), ...(await sessao(page, ALUNO, { pagamentosHabilitados: true })), ...rotasDoFinanceiro(estado),
    });
    await page.goto('/aluno/conta');
    await expect(page.getByRole('button', { name: /^Pagar pela InfinitePay: / })).toHaveCount(2);
    await semRolagemHorizontal(page);
    await page.getByText('Em aberto', { exact: true }).first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURAS}/aluno-acoes-${tema.toLowerCase()}-1280.png` });
    expect(errosDaPagina).toEqual([]);
  });
}
