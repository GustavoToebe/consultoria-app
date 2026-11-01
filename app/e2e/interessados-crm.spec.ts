import { expect, test, type Page } from '@playwright/test';

import type { IndicadoresInscricoes, InscricaoDetalhe, InscricaoResumo } from '../src/api/inscricoesTipos';
import { json, type RespostasApi, sessao, simularApi, TREINADOR } from './api-falsa';
import { contagensFalsas, detalheFalso, idDe, resumoFalso, rotasDaTela } from './inscricoes-falsas';

/**
 * CRM de interessados (análise de 29/10, seção 9): Kanban, encerrar e reabrir, proposta, retornos, respostas prontas,
 * busca e estados vazios, inscrições semelhantes e indicadores. A API é simulada; só dados fictícios.
 */

async function abrir(page: Page, respostas: RespostasApi, caminho = '/treinador/interessados') {
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...rotasDaTela(),
    'GET /questionarios/opcoes': { corpo: [] },
    ...respostas,
  });
  await page.goto(caminho);
  await expect(page.getByRole('heading', { name: 'Interessados', level: 1 })).toBeVisible();
  return api;
}

/** A lista com uma inscrição e o detalhe dela, que muda conforme as ações respondem. */
function comUma(r: InscricaoResumo, inicial: InscricaoDetalhe) {
  const estado = { atual: inicial };
  const rotas: RespostasApi = {
    'GET /inscricoes': { corpo: { itens: [r], total: 1 } },
    [`GET /inscricoes/${r.id}`]: (_p, route) => json(route, estado.atual),
  };
  return { estado, rotas };
}

for (const largura of [390, 1280]) {
  test.describe(`${largura}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
    });

    test('Kanban: contagens, carregar mais, mover entre etapas pela versão e mover para Aceita abre a confirmação', async ({ page }) => {
      const novas = Array.from({ length: 25 }, (_, i) => resumoFalso(i + 1));
      const emContato = [resumoFalso(40, { situacao: 'EM_CONTATO', propostaPlanoNome: 'Plano Fictício' })];
      const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, {
        'GET /inscricoes/contagens': { corpo: contagensFalsas({ NOVA: 25, EM_CONTATO: 1 }) },
        'GET /inscricoes': (p, route) => {
          const tamanho = Number(p.busca.get('tamanho') ?? '30');
          const situacao = p.busca.get('situacao');
          if (situacao === 'NOVA') return json(route, { itens: novas.slice(0, tamanho), total: 25 });
          if (situacao === 'EM_CONTATO') return json(route, { itens: emContato, total: 1 });
          return json(route, { itens: [], total: 0 });
        },
        [`PUT /inscricoes/${idDe(1)}/etapa`]: { corpo: detalheFalso(novas[0], { situacao: 'EM_CONTATO', versao: 2 }) },
        [`GET /inscricoes/${idDe(2)}`]: { corpo: detalheFalso(novas[1]) },
      }, '/treinador/interessados?visao=kanban');

      await expect(page.getByText('Mostrando 20 de 25')).toBeVisible();
      await page.getByRole('button', { name: 'Carregar mais' }).click();
      await expect(page.getByText('Pessoa Fictícia 25', { exact: true })).toBeVisible();
      await expect(page.getByText('Mostrando 20 de 25')).toHaveCount(0);

      await page.getByRole('button', { name: 'Mover Pessoa Fictícia 1 para' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Em contato', exact: true }).click();
      await expect(page.getByText('Pessoa Fictícia 1: Em contato.')).toBeVisible();
      const etapa = pedidos.find((p) => p.metodo === 'PUT' && p.caminho.endsWith('/etapa'));
      expect(etapa?.corpo).toEqual({ situacao: 'EM_CONTATO', versao: 1 });

      // Para Aceita: abre a confirmação do aceite; nada é cadastrado só por mover.
      await page.getByRole('button', { name: 'Mover Pessoa Fictícia 2 para' }).click();
      await page.getByRole('button', { name: 'Aceitar (cadastrar aluno)' }).click();
      await expect(page.getByText('Aceitar inscrição?')).toBeVisible();
      await expect(page.getByText('Conferir antes de aceitar')).toBeVisible();
      expect(pedidos.some((p) => p.caminho.endsWith('/aceitar'))).toBe(false);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('encerrar pede o motivo e reabrir volta ao atendimento com o motivo da reabertura', async ({ page }) => {
      const r = resumoFalso(1);
      const { estado, rotas } = comUma(r, detalheFalso(r));
      const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, {
        ...rotas,
        [`POST /inscricoes/${r.id}/encerrar`]: (_p, route) => {
          estado.atual = detalheFalso(r, {
            situacao: 'DESISTIU', motivoEncerramento: 'SEM_RETORNO', motivoDetalhe: 'Não respondeu', encerradaEm: '2026-10-29T13:00:00Z',
            encerradaPorNome: TREINADOR.nome, versao: 2,
          });
          return json(route, estado.atual);
        },
        [`POST /inscricoes/${r.id}/reabrir`]: (_p, route) => {
          estado.atual = detalheFalso(r, { situacao: 'EM_CONTATO', ciclo: 2, versao: 3 });
          return json(route, estado.atual);
        },
      });
      await page.getByRole('button', { name: 'Abrir inscrição de Pessoa Fictícia 1' }).click();
      await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
      await page.getByRole('button', { name: 'A pessoa desistiu', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Registrar desistência' })).toBeDisabled();
      await page.getByRole('button', { name: 'Sem retorno', exact: true }).click();
      await page.getByLabel('Detalhe (opcional)').fill('Não respondeu');
      await page.getByRole('button', { name: 'Registrar desistência' }).click();
      await expect(page.getByText('Desistência registrada.')).toBeVisible();
      expect(pedidos.find((p) => p.caminho.endsWith('/encerrar'))?.corpo)
        .toEqual({ situacao: 'DESISTIU', motivo: 'SEM_RETORNO', detalhe: 'Não respondeu', versao: 1 });

      await expect(page.getByText('Sem retorno', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Reabrir atendimento', exact: true }).click();
      await expect(page.getByRole('button', { name: /^Reabrir\. / })).toBeDisabled();
      await page.getByLabel('Por que reabrir').fill('Voltou a procurar');
      await page.getByRole('button', { name: 'Reabrir', exact: true }).click();
      await expect(page.getByText('Atendimento reaberto.')).toBeVisible();
      await expect(page.getByText('2º atendimento')).toBeVisible();
      expect(pedidos.find((p) => p.caminho.endsWith('/reabrir'))?.corpo).toEqual({ motivo: 'Voltou a procurar', versao: 2 });
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('proposta com o plano do Financeiro copia nome, periodicidade e referência', async ({ page }) => {
      const r = resumoFalso(1);
      const { estado, rotas } = comUma(r, detalheFalso(r));
      const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, {
        ...rotas,
        'GET /inscricoes/planos-de-referencia': { corpo: [{ id: 'p-1', nome: 'Plano Fictício Mensal', valorCentavos: 19990, periodicidade: 'MENSAL' }] },
        [`PUT /inscricoes/${r.id}/proposta`]: (p, route) => {
          const corpo = p.corpo as Record<string, unknown>;
          estado.atual = detalheFalso(r, {
            versao: 2,
            proposta: {
              planoId: corpo.planoId as string, planoNome: corpo.planoNome as string, modalidade: null, periodicidade: 'MENSAL',
              valorReferenciaCentavos: 19990, valorCentavos: 15000, condicoes: corpo.condicoes as string,
              atualizadaEm: '2026-10-29T13:00:00Z', atualizadaPorNome: TREINADOR.nome,
            },
          });
          return json(route, estado.atual);
        },
      });
      await page.getByRole('button', { name: 'Abrir inscrição de Pessoa Fictícia 1' }).click();
      await page.getByRole('button', { name: 'Registrar proposta' }).click();
      await page.getByRole('button', { name: /^Plano do Financeiro:/ }).click();
      await page.getByRole('radio', { name: /Plano Fictício Mensal/ }).click();
      await page.getByLabel('Valor proposto (R$)').fill('150');
      await page.getByLabel('Condições combinadas').fill('Primeiro mês com desconto.');
      await page.getByRole('button', { name: 'Salvar proposta' }).click();
      await expect(page.getByText('Proposta salva.')).toBeVisible();
      expect(pedidos.find((p) => p.caminho.endsWith('/proposta'))?.corpo).toEqual({
        planoId: 'p-1', planoNome: 'Plano Fictício Mensal', modalidade: null, periodicidade: 'MENSAL',
        valorReferenciaCentavos: 19990, valorCentavos: 15000, condicoes: 'Primeiro mês com desconto.', versao: 1,
      });
      await expect(page.getByText(/25% de desconto/)).toBeVisible();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('proposta manual: valor inválido não vai à API', async ({ page }) => {
      const r = resumoFalso(1);
      const { estado, rotas } = comUma(r, detalheFalso(r));
      const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, {
        ...rotas,
        'GET /inscricoes/planos-de-referencia': { corpo: [] },
        [`PUT /inscricoes/${r.id}/proposta`]: (_p, route) => json(route, estado.atual),
      });
      await page.getByRole('button', { name: 'Abrir inscrição de Pessoa Fictícia 1' }).click();
      await page.getByRole('button', { name: 'Registrar proposta' }).click();
      await page.getByLabel('Plano', { exact: true }).fill('Consultoria online');
      await page.getByLabel('Valor de referência (R$)').fill('abc');
      await page.getByRole('button', { name: 'Salvar proposta' }).click();
      await expect(page.getByText('Valor inválido. Use, por exemplo, 199,90.')).toBeVisible();
      expect(pedidos.some((p) => p.caminho.endsWith('/proposta'))).toBe(false);
      await page.getByLabel('Valor de referência (R$)').fill('200');
      await page.getByRole('dialog').getByRole('button', { name: 'Online', exact: true }).click();
      await page.getByRole('button', { name: 'Salvar proposta' }).click();
      await expect(page.getByText('Proposta salva.')).toBeVisible();
      expect(pedidos.find((p) => p.caminho.endsWith('/proposta'))?.corpo).toEqual({
        planoId: null, planoNome: 'Consultoria online', modalidade: 'ONLINE', periodicidade: null,
        valorReferenciaCentavos: 20000, valorCentavos: null, condicoes: null, versao: 1,
      });
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('retorno: marcar com data e concluir', async ({ page }) => {
      const r = resumoFalso(1);
      const { estado, rotas } = comUma(r, detalheFalso(r));
      const retorno = {
        id: 'r-1', descricao: 'Ligar para falar do plano', data: '2030-10-30', responsavelId: null, responsavelNome: null,
        concluidoEm: null, concluidoPorNome: null, criadoEm: '2026-10-29T13:00:00Z', versao: 1,
      };
      const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, {
        ...rotas,
        [`POST /inscricoes/${r.id}/retornos`]: (_p, route) => {
          estado.atual = detalheFalso(r, { retornos: [retorno] });
          return json(route, estado.atual);
        },
        'POST /inscricoes/retornos/r-1/concluir': (_p, route) => {
          estado.atual = detalheFalso(r, { retornos: [{ ...retorno, concluidoEm: '2026-10-29T14:00:00Z', concluidoPorNome: TREINADOR.nome, versao: 2 }] });
          return json(route, estado.atual);
        },
      });
      await page.getByRole('button', { name: 'Abrir inscrição de Pessoa Fictícia 1' }).click();
      await page.getByRole('button', { name: 'Marcar retorno' }).click();
      await page.getByLabel('O que fazer').fill('Ligar para falar do plano');
      await page.getByLabel('Data do retorno').fill('30/10/2030');
      await page.getByRole('button', { name: 'Marcar', exact: true }).click();
      await expect(page.getByText('Retorno marcado.')).toBeVisible();
      expect(pedidos.find((p) => p.metodo === 'POST' && p.caminho.endsWith('/retornos'))?.corpo)
        .toEqual({ descricao: 'Ligar para falar do plano', data: '2030-10-30', responsavelId: null });
      await page.getByRole('button', { name: 'Concluir', exact: true }).click();
      await expect(page.getByText('Retorno concluído.')).toBeVisible();
      expect(pedidos.find((p) => p.caminho.endsWith('/concluir'))?.corpo).toEqual({ versao: 1 });
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('resposta pronta: variável faltando trava; copiar registra a mensagem preparada', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      const r = resumoFalso(1, { nome: 'Ana Fictícia' });
      const { rotas } = comUma(r, detalheFalso(r));
      const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, {
        ...rotas,
        'GET /inscricoes/modelos-de-mensagem': { corpo: [{ id: 'm-1', nome: 'Apresentação', texto: 'Oi, {primeiro_nome}! Sobre o {plano}.', ordem: 1, versao: 0 }] },
        [`POST /inscricoes/${r.id}/mensagens`]: { status: 204 },
      });
      await page.getByRole('button', { name: 'Abrir inscrição de Ana Fictícia' }).click();
      await page.getByRole('button', { name: 'Responder com modelo' }).click();
      await page.getByRole('button', { name: 'Apresentação', exact: true }).click();
      await expect(page.getByLabel('Mensagem')).toHaveValue('Oi, Ana! Sobre o {plano}.');
      await expect(page.getByRole('button', { name: 'Copiar', exact: true })).toBeDisabled();
      await page.getByLabel('Mensagem').fill('Oi, Ana! Sobre o plano mensal.');
      await page.getByRole('button', { name: 'Copiar', exact: true }).click();
      await expect(page.getByText('Mensagem copiada. Registre o envio numa nota quando mandar.')).toBeVisible();
      expect(pedidos.find((p) => p.caminho.endsWith('/mensagens'))?.corpo).toEqual({ modeloId: 'm-1', acao: 'COPIADA' });
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('busca e Meus: contagens nas situações e estados vazios distintos', async ({ page }) => {
      const itens = [resumoFalso(1), resumoFalso(2)];
      const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, {
        'GET /inscricoes/contagens': { corpo: contagensFalsas({ NOVA: 2 }) },
        'GET /inscricoes': (p, route) => {
          if (p.busca.get('busca') || p.busca.get('meus') === 'true') return json(route, { itens: [], total: 0 });
          return json(route, { itens, total: 2 });
        },
      });
      await page.getByLabel('Buscar').fill('ana');
      await expect(page.getByText('Nada encontrado para esta busca.')).toBeVisible();
      expect(pedidos.some((p) => p.caminho === '/inscricoes' && p.busca.get('busca') === 'ana')).toBe(true);
      await page.getByLabel('Buscar').fill('');
      await expect(page.getByText('Pessoa Fictícia 1', { exact: true })).toBeVisible();
      // Situação (com a contagem) e responsável ficam no painel de filtros (PC) ou na folha "Filtros" (celular).
      await page.getByRole('button', { name: /^Filtros, / }).click();
      const painel = largura < 768 ? page.getByRole('dialog', { name: 'Filtros' }) : page.locator('body');
      await expect(painel.getByRole('button', { name: 'Novas · 2' })).toBeVisible();
      // Responsável é de várias opções (nada marcado = toda a equipe): marcar só "Meus" vira `meus=true`.
      await painel.getByRole('button', { name: 'Responsável: Toda a equipe. Escolher.' }).click();
      const lista = page.getByRole('dialog', { name: 'Responsável' });
      await lista.getByRole('checkbox', { name: 'Meus' }).click();
      if (largura < 768) await lista.getByRole('button', { name: 'Fechar' }).click();
      else await page.keyboard.press('Escape');
      if (largura < 768) await page.getByRole('button', { name: 'Ver inscrições' }).click();
      await expect(page.getByText('Nenhuma inscrição atribuída a você nesta lista.')).toBeVisible();
      await expect(page).toHaveURL(/meus=true/);
      await expect(page.getByRole('button', { name: 'Tirar filtro: Responsável: Meus' })).toBeVisible();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('semelhantes: abre a lista e "É a mesma pessoa" relaciona sem juntar nada', async ({ page }) => {
      const r = resumoFalso(1, { duplicidade: { alunoExistente: false, alunoId: null, outrasInscricoesAbertas: 0, outrasInscricoesAnteriores: 1 } });
      const { estado, rotas } = comUma(r, detalheFalso(r));
      const anterior = idDe(9);
      const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, {
        ...rotas,
        [`GET /inscricoes/${r.id}/semelhantes`]: {
          corpo: { inscricoes: [{ id: anterior, nome: 'Pessoa Fictícia Antiga', situacao: 'DESISTIU', criadaEm: '2026-05-01T13:00:00Z', coincide: ['WHATSAPP'], relacionada: false }], aluno: null },
        },
        [`PUT /inscricoes/${r.id}/relacao`]: (_p, route) => {
          estado.atual = detalheFalso(r, { versao: 2, relacionadaA: { id: anterior, nome: 'Pessoa Fictícia Antiga', situacao: 'DESISTIU', criadaEm: '2026-05-01T13:00:00Z' } });
          return json(route, estado.atual);
        },
      });
      await page.getByRole('button', { name: 'Abrir inscrição de Pessoa Fictícia 1' }).click();
      await expect(page.getByText('Há 1 inscrição anterior com o mesmo e-mail ou WhatsApp.')).toBeVisible();
      await page.getByRole('button', { name: 'Ver inscrições semelhantes' }).click();
      await expect(page.getByText(/mesmo WhatsApp/)).toBeVisible();
      await page.getByRole('button', { name: 'É a mesma pessoa' }).click();
      await page.getByRole('button', { name: 'Relacionar', exact: true }).click();
      await expect(page.getByText('Inscrições relacionadas.')).toBeVisible();
      await expect(page.getByText(/Mesma pessoa de: Pessoa Fictícia Antiga/)).toBeVisible();
      expect(pedidos.find((p) => p.caminho.endsWith('/relacao'))?.corpo).toEqual({ outraId: anterior, versao: 1 });
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('indicadores: números do período e "—" no que não tem dado', async ({ page }) => {
      const indicadores: IndicadoresInscricoes = {
        de: '2026-09-30', ate: '2026-10-29', entradas: 0, pessoas: 0, aceites: 0, recusadas: 0, desistencias: 0, reaberturas: 0,
        aceitesDasEntradas: 0, conversao: null, diasAteAceite: { mediana: null, media: null }, porMotivo: [], porOrigem: [],
      };
      const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, {
        'GET /inscricoes/indicadores': { corpo: indicadores },
        // A primeira pintura pode sair antes de o endereço ser lido (visão Lista por um instante).
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      }, '/treinador/interessados?visao=indicadores');
      await expect(page.getByText('Conversão das entradas')).toBeVisible();
      await expect(page.getByText('Como contamos')).toBeVisible();
      await expect(page.getByText('—', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Média: —')).toBeVisible();
      const pedido = pedidos.find((p) => p.caminho === '/inscricoes/indicadores');
      expect(pedido?.busca.get('de')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}

test('Kanban no PC: arrastar o cartão para outra coluna aberta manda PUT /etapa com a versão', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const novas = [resumoFalso(1)];
  const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, {
    'GET /inscricoes/contagens': { corpo: contagensFalsas({ NOVA: 1 }) },
    'GET /inscricoes': (p, route) => json(route, p.busca.get('situacao') === 'NOVA' ? { itens: novas, total: 1 } : { itens: [], total: 0 }),
    [`PUT /inscricoes/${idDe(1)}/etapa`]: { corpo: detalheFalso(novas[0], { situacao: 'EM_NEGOCIACAO', versao: 2 }) },
  }, '/treinador/interessados?visao=kanban');
  const cartao = page.getByRole('button', { name: 'Abrir inscrição de Pessoa Fictícia 1' });
  await expect(cartao).toBeVisible();
  const destino = page.getByRole('list', { name: /^Em negociação/ });
  const de = await cartao.boundingBox();
  const para = await destino.boundingBox();
  if (!de || !para) throw new Error('sem medidas');
  await page.mouse.move(de.x + de.width / 2, de.y + de.height / 2);
  await page.mouse.down();
  // Segura antes de mover: o arraste só começa depois do toque longo (250 ms).
  await page.waitForTimeout(450);
  const passos = 12;
  for (let k = 1; k <= passos; k += 1) {
    await page.mouse.move(de.x + de.width / 2 + ((para.x + para.width / 2) - (de.x + de.width / 2)) * k / passos,
      de.y + de.height / 2 + ((para.y + 60) - (de.y + de.height / 2)) * k / passos);
  }
  await page.mouse.up();
  await expect(page.getByText('Pessoa Fictícia 1: Em negociação.')).toBeVisible();
  const etapa = pedidos.find((p) => p.metodo === 'PUT' && p.caminho.endsWith('/etapa'));
  expect(etapa?.corpo).toEqual({ situacao: 'EM_NEGOCIACAO', versao: 1 });
  // Soltar não abre a folha: o detalhe da inscrição nem é pedido.
  expect(pedidos.some((p) => p.metodo === 'GET' && p.caminho === `/inscricoes/${idDe(1)}`)).toBe(false);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
