import { expect, test, type Page, type Route } from '@playwright/test';

import type { InscricaoDetalhe, InscricaoResumo } from '../src/api/inscricoesTipos';
import { erroApi, json, MARCA, type RespostasApi, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Achados da análise de 29/10 na tela Interessados: texto da consultoria trocado no meio do preenchimento (B2), última
 * página que esvazia (F1), nota não enviada que sumia ao salvar o andamento (F2) e resposta atrasada de outra inscrição
 * que deixava a aberta carregando para sempre (F3). Só dados fictícios.
 */

const CODIGO = 'codigo-de-teste-abcdefghijk';

function resumo(n: number, extra: Partial<InscricaoResumo> = {}): InscricaoResumo {
  return {
    id: `i0000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    nome: `Pessoa Fictícia ${n}`,
    objetivo: null,
    whatsapp: '(11) 98765-4321',
    email: null,
    situacao: 'NOVA',
    pagamento: 'NAO_CONTROLADO',
    responsavelId: null,
    responsavelNome: null,
    alunoId: null,
    criadaEm: '2026-10-18T13:00:00Z',
    duplicidade: { alunoExistente: false, alunoId: null, outrasInscricoesAbertas: 0 },
    ...extra,
  };
}

function detalheDe(r: InscricaoResumo, extra: Partial<InscricaoDetalhe> = {}): InscricaoDetalhe {
  return {
    ...r,
    observacao: null,
    cienciaEm: null,
    cienciaTexto: null,
    pagamentoConfirmadoPorNome: null,
    pagamentoConfirmadoEm: null,
    atualizadaEm: '2026-10-18T13:00:00Z',
    versao: 1,
    notas: [],
    ...extra,
  };
}

async function abrirTela(page: Page, respostas: RespostasApi) {
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
    'GET /inscricoes/configuracao': {
      corpo: { aberta: true, codigo: CODIGO, link: `https://consultoria.exemplo.test/inscricao/${CODIGO}`, responsavelId: null, texto: null, versao: 1 },
    },
    ...respostas,
  });
  await page.goto('/treinador/interessados');
  await expect(page.getByRole('heading', { name: 'Interessados', level: 1 })).toBeVisible();
  return api;
}

test('inscrição pública: texto trocado enquanto a pessoa preenchia pede a ciência de novo e envia a versão nova (B2)', async ({ page }) => {
  let leituras = 0;
  let envios = 0;
  const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
    [`GET /publico/inscricoes/${CODIGO}`]: (_p, route) => {
      leituras += 1;
      return json(route, leituras === 1
        ? { consultoria: MARCA, texto: 'Texto fictício antigo.', textoVersao: 'versao-a', aberta: true }
        : { consultoria: MARCA, texto: 'Texto fictício novo.', textoVersao: 'versao-b', aberta: true });
    },
    [`POST /publico/inscricoes/${CODIGO}`]: (_p, route) => {
      envios += 1;
      if (envios === 1) {
        const { status, corpo } = erroApi(409, 'O texto da consultoria mudou.', 'TEXTO_ALTERADO');
        return json(route, corpo, status);
      }
      return json(route, { mensagem: 'Recebemos sua inscrição.' }, 202);
    },
  });
  await page.goto(`/inscricao/${CODIGO}`);
  await page.getByLabel('Nome').fill('Pessoa Fictícia');
  await page.getByLabel('WhatsApp com DDD').pressSequentially('11987654321');
  await page.getByRole('checkbox', { name: 'Li e estou ciente' }).click();
  await page.getByRole('button', { name: 'Enviar inscrição' }).click();

  await expect(page.getByText('O texto da consultoria mudou. Leia o texto novo, marque a ciência e envie de novo.')).toBeVisible();
  await expect(page.getByText('Texto fictício novo.')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Li e estou ciente' })).not.toBeChecked();
  // O que a pessoa digitou fica.
  await expect(page.getByLabel('Nome')).toHaveValue('Pessoa Fictícia');
  await page.getByRole('checkbox', { name: 'Li e estou ciente' }).click();
  await page.getByRole('button', { name: 'Enviar inscrição' }).click();
  await expect(page.getByRole('heading', { name: 'Inscrição enviada' })).toBeVisible();
  const enviados = pedidos.filter((p) => p.metodo === 'POST' && p.caminho.startsWith('/publico/')).map((p) => (p.corpo as { textoVersao: string }).textoVersao);
  expect(enviados).toEqual(['versao-a', 'versao-b']);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('Interessados: a última página esvaziada volta sozinha para a página que ainda tem inscrições (F1)', async ({ page }) => {
  const primeira = Array.from({ length: 30 }, (_, i) => resumo(i + 1));
  const ultima = resumo(31);
  let recusada = false;
  const { naoTratadas, errosDaPagina } = await abrirTela(page, {
    'GET /inscricoes': (p, route) => {
      const pagina = Number(p.busca.get('pagina') ?? '0');
      if (pagina === 0) return json(route, { itens: primeira, total: recusada ? 30 : 31 });
      return json(route, recusada ? { itens: [], total: 30 } : { itens: [ultima], total: 31 });
    },
    [`GET /inscricoes/${ultima.id}`]: { corpo: detalheDe(ultima) },
    [`POST /inscricoes/${ultima.id}/encerrar`]: (_p, route) => {
      recusada = true;
      return json(route, detalheDe(ultima, { situacao: 'RECUSADA', versao: 2 }));
    },
    [`POST /inscricoes/${ultima.id}/recusar`]: (_p, route) => {
      recusada = true;
      return json(route, detalheDe(ultima, { situacao: 'RECUSADA', versao: 2 }));
    },
  });
  await page.getByRole('button', { name: 'Próxima' }).click();
  await expect(page.getByText('Página 2 de 2')).toBeVisible();
  await page.getByRole('button', { name: 'Abrir inscrição de Pessoa Fictícia 31' }).click();
  await page.getByRole('button', { name: 'Recusar', exact: true }).click();
  await page.getByRole('button', { name: 'Recusar', exact: true }).last().click();
  await page.getByRole('button', { name: 'Fechar' }).first().click();

  await expect(page.getByText('Pessoa Fictícia 30', { exact: true })).toBeVisible();
  await expect(page.getByText('Nenhuma inscrição nesta lista')).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('Interessados: salvar o andamento não apaga a nota ainda não acrescentada (F2)', async ({ page }) => {
  const r = resumo(1);
  let atual = detalheDe(r, { versao: 3 });
  const { pedidos, naoTratadas, errosDaPagina } = await abrirTela(page, {
    'GET /inscricoes': { corpo: { itens: [r], total: 1 } },
    [`GET /inscricoes/${r.id}`]: (_p, route) => json(route, atual),
    [`PUT /inscricoes/${r.id}`]: (_p, route) => {
      atual = { ...atual, situacao: 'EM_CONTATO', versao: 4 };
      return json(route, atual);
    },
    [`PUT /inscricoes/${r.id}/etapa`]: (_p, route) => {
      atual = { ...atual, situacao: 'EM_CONTATO', versao: 4 };
      return json(route, atual);
    },
    [`POST /inscricoes/${r.id}/notas`]: (_p, route) => {
      atual = { ...atual, notas: [{ id: 'n1', texto: 'Ligou de volta.', autorId: TREINADOR.id, autorNome: TREINADOR.nome, criadaEm: '2026-10-29T13:00:00Z' }] };
      return json(route, atual);
    },
  });
  await page.getByRole('button', { name: 'Abrir inscrição de Pessoa Fictícia 1' }).click();
  await page.getByLabel('Nova nota').fill('Ligou de volta.');
  await page.getByRole('dialog').getByRole('button', { name: 'Em contato', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar andamento' }).click();
  await expect(page.getByText('Andamento salvo.')).toBeVisible();
  await expect(page.getByLabel('Nova nota')).toHaveValue('Ligou de volta.');

  // Fechar e abrir de novo também não perde a nota.
  await page.getByRole('button', { name: 'Fechar' }).first().click();
  await page.getByRole('button', { name: 'Abrir inscrição de Pessoa Fictícia 1' }).click();
  await expect(page.getByLabel('Nova nota')).toHaveValue('Ligou de volta.');

  await page.getByRole('button', { name: 'Acrescentar nota' }).click();
  await expect(page.getByText('Nota acrescentada.')).toBeVisible();
  await expect(page.getByLabel('Nova nota')).toHaveValue('');
  expect(pedidos.filter((p) => p.caminho.endsWith('/notas'))).toHaveLength(1);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('Interessados: resposta atrasada de outra inscrição não deixa a aberta carregando (F3)', async ({ page }) => {
  const a = resumo(1);
  const b = resumo(2);
  let soltarA: (() => void) | null = null;
  const { naoTratadas, errosDaPagina } = await abrirTela(page, {
    'GET /inscricoes': { corpo: { itens: [a, b], total: 2 } },
    [`GET /inscricoes/${a.id}`]: { corpo: detalheDe(a) },
    [`GET /inscricoes/${b.id}`]: { corpo: detalheDe(b) },
    [`POST /inscricoes/${a.id}/notas`]: async (_p, route: Route) => {
      await new Promise<void>((resolve) => { soltarA = resolve; });
      await json(route, detalheDe(a, { notas: [{ id: 'n1', texto: 'Nota A.', autorId: null, autorNome: null, criadaEm: '2026-10-29T13:00:00Z' }] }));
    },
  });
  await page.getByRole('button', { name: 'Abrir inscrição de Pessoa Fictícia 1' }).click();
  await page.getByLabel('Nova nota').fill('Nota A.');
  await page.getByRole('button', { name: 'Acrescentar nota' }).click();
  await expect.poll(() => soltarA !== null).toBe(true);
  await page.getByRole('button', { name: 'Fechar' }).first().click();
  await page.getByRole('button', { name: 'Abrir inscrição de Pessoa Fictícia 2' }).click();
  await expect(page.getByText('O que a pessoa escreveu')).toBeVisible();
  (soltarA as unknown as () => void)();
  // A resposta de A chega com B aberta: B continua visível e usável.
  await page.waitForTimeout(500);
  await expect(page.getByText('O que a pessoa escreveu')).toBeVisible();
  await expect(page.getByLabel('Nova nota')).toBeEditable();
  await expect(page.getByText('Nota A.')).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
