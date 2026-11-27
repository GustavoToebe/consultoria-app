import { expect, test, type Page } from '@playwright/test';

import type { ContratacaoResponse, PlanoResponse } from '../src/api/financeiroTipos';
import type { AceiteInscricao, InscricaoDetalhe, InscricaoResumo } from '../src/api/inscricoesTipos';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { contagensFalsas, detalheFalso, resumoFalso, rotasDaTela } from './inscricoes-falsas';

/**
 * "Confirmar pagamento" e "Gerar cobrança" em Interessados (pedido 7, item 4, de 27/11): o plano escolhido na página (ou
 * o da proposta) já vem na confirmação. Antes do aceite só se registra o pagamento (`PUT /inscricoes/{id}`); depois dele,
 * "Gerar cobrança" contrata o plano pelo Financeiro sem valor no corpo (o servidor usa o do plano). Só dados fictícios.
 */

const PLANO: PlanoResponse = {
  id: 'p0000000-0000-4000-8000-000000000071', nome: 'Plano Trimestral', valorCentavos: 99700, periodicidade: 'TRIMESTRAL',
  arquivado: false, criadoEm: '2026-10-01T12:00:00Z', versao: 0, tempoMinimoMeses: null, regraDeSaida: null, linkDePagamento: null,
  incluiTreino: true, incluiDieta: true,
};
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000771';
const COM_FINANCEIRO = { pagamentosHabilitados: true, permissoes: [...PERMISSOES_TREINADOR, 'FINANCEIRO_LER', 'FINANCEIRO_ALTERAR'] };

function contratada(): ContratacaoResponse {
  return {
    id: 'c0000000-0000-4000-8000-000000000771', alunoId: ALUNO_ID, planoComercialId: PLANO.id, planoNome: PLANO.nome,
    periodicidade: 'TRIMESTRAL', valorCentavos: PLANO.valorCentavos, motivoValor: null, inicio: '2026-11-27', diaVencimento: 27,
    situacao: 'ATIVA', encerradaEm: null, criadoEm: '2026-11-27T12:00:00Z', versao: 0, minimoAte: null,
  };
}

async function capturar(page: Page, nome: string) {
  const pasta = process.env.CAPTURAS_INTERESSADOS;
  if (pasta) await page.screenshot({ path: `${pasta}/${nome}.png`, fullPage: false });
}

const semRolagemLateral = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

async function abrir(page: Page, largura: number, respostas: RespostasApi, opcoes: { escuro?: boolean; sessao?: Parameters<typeof sessao>[2]; caminho?: string } = {}) {
  await page.setViewportSize({ width: largura, height: 900 });
  if (opcoes.escuro) {
    await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), TREINADOR.id);
  }
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, opcoes.sessao ?? {})),
    ...rotasDaTela(),
    'GET /questionarios/opcoes': { corpo: [] },
    ...respostas,
  });
  await page.goto(opcoes.caminho ?? '/treinador/interessados');
  await expect(page.getByRole('heading', { name: 'Interessados', level: 1 })).toBeVisible();
  return api;
}

function aguardando(extra: Partial<InscricaoResumo> = {}) {
  return resumoFalso(1, {
    nome: 'Lucas Aguardando', email: 'lucas@exemplo.test', situacao: 'EM_CONTATO', pagamento: 'AGUARDANDO', versao: 2,
    planoComercialId: PLANO.id, planoComercialNome: PLANO.nome, ...extra,
  });
}

function aceita(extra: Partial<InscricaoDetalhe> = {}) {
  const r = resumoFalso(3, {
    nome: 'Rita Aceita', email: 'rita@exemplo.test', situacao: 'ACEITA', pagamento: 'CONFIRMADO_MANUAL', alunoId: ALUNO_ID, versao: 5,
    planoComercialId: PLANO.id, planoComercialNome: PLANO.nome,
  });
  return { resumo: r, detalhe: detalheFalso(r, { aceitaEm: '2026-11-20T12:00:00Z', ...extra }) };
}

for (const largura of [390, 1280]) {
  for (const tema of ['claro', 'escuro'] as const) {
    test(`${largura}px ${tema}: Confirmar pagamento na folha mostra o plano escolhido e libera o Aceitar`, async ({ page }) => {
      const item = aguardando();
      let detalhe = detalheFalso(item);
      const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, largura, {
        'GET /inscricoes/contagens': { corpo: contagensFalsas({ EM_CONTATO: 1 }) },
        'GET /inscricoes': { corpo: { itens: [item], total: 1 } },
        [`GET /inscricoes/${item.id}`]: (_p, route) => json(route, detalhe),
        [`PUT /inscricoes/${item.id}`]: (_p, route) => {
          detalhe = { ...detalhe, pagamento: 'CONFIRMADO_MANUAL', versao: 3, pagamentoConfirmadoPorNome: TREINADOR.nome, pagamentoConfirmadoEm: '2026-11-27T12:00:00Z' };
          return json(route, detalhe);
        },
      }, { escuro: tema === 'escuro' });

      await page.getByRole('button', { name: 'Abrir inscrição de Lucas Aguardando' }).click();
      await expect(page.getByText('O que a pessoa escreveu')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Aceitar', exact: true })).toBeDisabled();
      await capturar(page, `folha-confirmar-${largura}-${tema}`);
      await page.getByRole('button', { name: 'Confirmar pagamento', exact: true }).click();
      const painel = page.getByRole('alertdialog', { name: 'Confirmar pagamento?' });
      await expect(painel).toBeVisible();
      await expect(painel.getByText(`Plano: ${PLANO.nome}`)).toBeVisible();
      await expect(painel.getByText('Registra que Lucas Aguardando pagou. O app não confere pagamento: confira no seu banco antes.')).toBeVisible();
      await capturar(page, `painel-confirmar-${largura}-${tema}`);
      await painel.getByRole('button', { name: 'Confirmar pagamento', exact: true }).click();

      await expect(page.getByText('Pagamento confirmado. Agora dá para aceitar.')).toBeVisible();
      const envio = pedidos.find((p) => p.metodo === 'PUT' && p.caminho === `/inscricoes/${item.id}`);
      expect(envio?.corpo).toEqual({ situacao: 'EM_CONTATO', pagamento: 'CONFIRMADO_MANUAL', responsavelId: null, versao: 2 });
      await expect(page.getByRole('button', { name: 'Aceitar', exact: true })).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Confirmar pagamento', exact: true })).toHaveCount(0);
      // Financeiro desligado nesta sessão: confirmar não toca em cobrança.
      expect(pedidos.some((p) => p.caminho.includes('financeiro') || p.caminho.includes('contratacoes'))).toBe(false);
      await semRolagemLateral(page);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test(`${largura}px ${tema}: depois do aceite, Gerar cobrança contrata o plano escolhido sem mandar valor`, async ({ page }) => {
      const item = resumoFalso(2, {
        nome: 'Marina Paga', email: 'marina@exemplo.test', situacao: 'EM_NEGOCIACAO', pagamento: 'CONFIRMADO_MANUAL', versao: 3,
        planoComercialId: PLANO.id, planoComercialNome: PLANO.nome,
      });
      const detalhe = detalheFalso(item, {
        pagamentoConfirmadoPorNome: TREINADOR.nome, pagamentoConfirmadoEm: '2026-11-27T12:00:00Z',
        proposta: { ...detalheFalso(item).proposta, planoId: PLANO.id, planoNome: PLANO.nome, periodicidade: 'TRIMESTRAL', valorReferenciaCentavos: 99700, valorCentavos: 89700 },
      });
      const resposta: AceiteInscricao = { id: item.id, alunoId: ALUNO_ID, convite: null, anamneseId: null };
      let contratacoes: ContratacaoResponse[] = [];
      const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, largura, {
        'GET /inscricoes/contagens': { corpo: contagensFalsas({ EM_NEGOCIACAO: 1 }) },
        'GET /inscricoes': { corpo: { itens: [item], total: 1 } },
        [`GET /inscricoes/${item.id}`]: { corpo: detalhe },
        [`POST /inscricoes/${item.id}/aceitar`]: { corpo: resposta },
        [`GET /alunos/${ALUNO_ID}/contratacoes`]: (_p, route) => json(route, contratacoes),
        'GET /financeiro/planos': { corpo: [PLANO] },
        [`POST /alunos/${ALUNO_ID}/contratacoes`]: (_p, route) => {
          contratacoes = [contratada()];
          return json(route, contratacoes[0], 201);
        },
      }, { escuro: tema === 'escuro', sessao: COM_FINANCEIRO });

      await page.getByRole('button', { name: 'Abrir inscrição de Marina Paga' }).click();
      await page.getByRole('button', { name: 'Aceitar', exact: true }).click();
      await page.getByRole('alertdialog', { name: 'Aceitar inscrição?' }).getByRole('button', { name: 'Aceitar e cadastrar' }).click();
      await expect(page.getByText('Inscrição aceita: o aluno foi cadastrado.')).toBeVisible();

      await page.getByRole('button', { name: 'Gerar cobrança', exact: true }).click();
      const painel = page.getByRole('alertdialog', { name: 'Gerar cobrança?' });
      await expect(painel).toBeVisible();
      await expect(painel.getByText(`Plano: ${PLANO.nome}`)).toBeVisible();
      await expect(painel.getByText('Valor do plano: R$ 997,00 · Trimestral')).toBeVisible();
      await expect(painel.getByText('A proposta tem outro valor (R$ 897,00). Para cobrar esse valor, contrate pelo Financeiro, na ficha do aluno.')).toBeVisible();
      await expect(painel.getByRole('checkbox', { name: 'Primeiro período já pago' })).toBeChecked();
      await capturar(page, `painel-gerar-${largura}-${tema}`);
      await painel.getByRole('button', { name: 'Gerar cobrança', exact: true }).click();

      await expect(page.getByText('Cobrança gerada: plano contratado para o aluno.')).toBeVisible();
      await expect(page.getByText(`Plano contratado (${PLANO.nome}): as cobranças ficam no Financeiro, na ficha do aluno.`)).toBeVisible();
      const envios = pedidos.filter((p) => p.metodo === 'POST' && p.caminho === `/alunos/${ALUNO_ID}/contratacoes`);
      expect(envios).toHaveLength(1);
      expect(envios[0].corpo).toMatchObject({ planoComercialId: PLANO.id, valorCentavos: null, primeiroPeriodoPago: true, gerarMesesAnteriores: false });
      await capturar(page, `resultado-gerado-${largura}-${tema}`);
      await semRolagemLateral(page);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }

  test(`${largura}px: Kanban, aceitar sem pagamento confirmado abre o Confirmar pagamento; 409 de versão recarrega`, async ({ page }) => {
    const item = aguardando({ situacao: 'NOVA' });
    const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, largura, {
      'GET /inscricoes/contagens': { corpo: contagensFalsas({ NOVA: 1 }) },
      'GET /inscricoes': (p, route) => json(route, p.busca.get('situacao') === 'NOVA' ? { itens: [item], total: 1 } : { itens: [], total: 0 }),
      [`GET /inscricoes/${item.id}`]: { corpo: detalheFalso(item) },
      [`PUT /inscricoes/${item.id}`]: erroApi(409, 'A inscrição foi alterada.', 'CONFLITO_EDICAO'),
    }, { caminho: '/treinador/interessados?visao=kanban' });

    await page.getByRole('button', { name: 'Mover Lucas Aguardando para' }).click();
    await page.getByRole('button', { name: 'Aceitar (cadastrar aluno)' }).click();
    await expect(page.getByText('Aceitar inscrição?')).toHaveCount(0);
    const painel = page.getByRole('alertdialog', { name: 'Confirmar pagamento?' });
    await expect(painel).toBeVisible();
    await expect(painel.getByText(`Plano: ${PLANO.nome}`)).toBeVisible();
    await capturar(page, `kanban-confirmar-${largura}`);
    await painel.getByRole('button', { name: 'Confirmar pagamento', exact: true }).click();
    await expect(page.getByText('A inscrição foi alterada em outro lugar. Recarregamos para você conferir.')).toBeVisible();
    expect(pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    expect(pedidos.some((p) => p.caminho.endsWith('/aceitar'))).toBe(false);
    await semRolagemLateral(page);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`${largura}px: recusa que não é de plano já contratado fica na folha e o botão continua`, async ({ page }) => {
    const { resumo, detalhe } = aceita();
    const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, largura, {
      'GET /inscricoes': { corpo: { itens: [resumo], total: 1 } },
      [`GET /inscricoes/${resumo.id}`]: { corpo: detalhe },
      [`GET /alunos/${ALUNO_ID}/contratacoes`]: { corpo: [] },
      'GET /financeiro/planos': { corpo: [PLANO] },
      [`POST /alunos/${ALUNO_ID}/contratacoes`]: erroApi(409, 'Aluno inativo não pode contratar um plano.', 'ALUNO_INATIVO'),
    }, { sessao: COM_FINANCEIRO });

    await page.getByRole('button', { name: 'Abrir inscrição de Rita Aceita' }).click();
    await page.getByRole('button', { name: 'Gerar cobrança', exact: true }).click();
    await page.getByRole('alertdialog', { name: 'Gerar cobrança?' }).getByRole('button', { name: 'Gerar cobrança', exact: true }).click();
    await expect(page.getByText('Aluno inativo não pode contratar um plano.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gerar cobrança', exact: true })).toBeEnabled();
    expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho === `/alunos/${ALUNO_ID}/contratacoes`).length).toBe(1);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`${largura}px: inscrição aceita, o 409 de plano já contratado vira aviso e o botão sai`, async ({ page }) => {
    const { resumo, detalhe } = aceita();
    let contratacoes: ContratacaoResponse[] = [];
    const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, largura, {
      'GET /inscricoes': { corpo: { itens: [resumo], total: 1 } },
      [`GET /inscricoes/${resumo.id}`]: { corpo: detalhe },
      [`GET /alunos/${ALUNO_ID}/contratacoes`]: (_p, route) => json(route, contratacoes),
      'GET /financeiro/planos': { corpo: [PLANO] },
      [`POST /alunos/${ALUNO_ID}/contratacoes`]: (_p, route) => {
        // Outra pessoa contratou enquanto o painel estava aberto.
        contratacoes = [contratada()];
        return json(route, erroApi(409, 'Este aluno já tem um plano comercial contratado.', 'CONTRATACAO_VIGENTE').corpo, 409);
      },
    }, { sessao: COM_FINANCEIRO });

    await page.getByRole('button', { name: 'Abrir inscrição de Rita Aceita' }).click();
    await expect(page.getByText('Aluno cadastrado')).toBeVisible();
    await page.getByRole('button', { name: 'Gerar cobrança', exact: true }).click();
    await page.getByRole('alertdialog', { name: 'Gerar cobrança?' }).getByRole('button', { name: 'Gerar cobrança', exact: true }).click();
    await expect(page.getByText('Este aluno já tem um plano contratado.')).toBeVisible();
    await expect(page.getByText(`Plano contratado (${PLANO.nome}): as cobranças ficam no Financeiro, na ficha do aluno.`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gerar cobrança', exact: true })).toHaveCount(0);
    expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho === `/alunos/${ALUNO_ID}/contratacoes`).length).toBe(1);
    await semRolagemLateral(page);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`${largura}px: sem permissão do financeiro fica só a frase, sem consultar o financeiro`, async ({ page }) => {
    const { resumo, detalhe } = aceita();
    const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, largura, {
      'GET /inscricoes': { corpo: { itens: [resumo], total: 1 } },
      [`GET /inscricoes/${resumo.id}`]: { corpo: detalhe },
    }, { sessao: { pagamentosHabilitados: true } });

    await page.getByRole('button', { name: 'Abrir inscrição de Rita Aceita' }).click();
    await expect(page.getByText('Aluno cadastrado')).toBeVisible();
    await expect(page.getByText('Para cobrar pelo app, cadastre a contratação no Financeiro, na ficha do aluno.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gerar cobrança', exact: true })).toHaveCount(0);
    expect(pedidos.some((p) => p.caminho.includes('financeiro') || p.caminho.includes('contratacoes'))).toBe(false);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`${largura}px: financeiro desligado esconde Gerar cobrança e a frase`, async ({ page }) => {
    const { resumo, detalhe } = aceita();
    const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, largura, {
      'GET /inscricoes': { corpo: { itens: [resumo], total: 1 } },
      [`GET /inscricoes/${resumo.id}`]: { corpo: detalhe },
    }, { sessao: { permissoes: COM_FINANCEIRO.permissoes } });

    await page.getByRole('button', { name: 'Abrir inscrição de Rita Aceita' }).click();
    await expect(page.getByText('Aluno cadastrado')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gerar cobrança', exact: true })).toHaveCount(0);
    await expect(page.getByText('Para cobrar pelo app, cadastre a contratação no Financeiro, na ficha do aluno.')).toHaveCount(0);
    expect(pedidos.some((p) => p.caminho.includes('financeiro') || p.caminho.includes('contratacoes'))).toBe(false);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
