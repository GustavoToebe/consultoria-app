import { expect, test, type Page } from '@playwright/test';

import type { AceiteInscricao, ConfiguracaoInscricao, IndicadoresInscricoes, LinkDeInscricao } from '../src/api/inscricoesTipos';
import { json, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { CODIGO, contagensFalsas, detalheFalso, idDe, resumoFalso, rotasDaTela } from './inscricoes-falsas';

/**
 * Fase 3 (Ficha rápida pós-WhatsApp): criar e configurar link secundário ("Ficha rápida"),
 * aceite exigindo pagamento confirmado × "Aceitar sem cobrança" (cortesia), bloqueio no Kanban
 * sem pagamento confirmado e os 4 novos cartões nos Indicadores. Só dados fictícios.
 */

const FICHA_RAPIDA_ID = 'q0000000-0000-4000-8000-0000000000f3';
const CODIGO_FICHA_RAPIDA = 'ficha-rapida-teste-12345678';
const LINK_FICHA_RAPIDA = `https://consultoria.exemplo.test/inscricao/${CODIGO_FICHA_RAPIDA}`;
const ALUNO_CORTESIA_ID = 'a0000000-0000-4000-8000-000000000301';

async function capturar(page: Page, nome: string) {
  const pasta = process.env.SWARM_CAPTURAS_DIR;
  if (pasta) await page.screenshot({ path: `${pasta}/${nome}.png`, fullPage: false });
}

const semRolagemLateral = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

async function abrirInteressados(page: Page, largura: number, respostas: RespostasApi, caminho = '/treinador/interessados') {
  await page.setViewportSize({ width: largura, height: 900 });
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

for (const largura of [390, 1280]) {
  test.describe(`${largura}px`, () => {
    test('Ficha rápida: criar no cartão de link, copiar endereço e configurar na folha', async ({ page }) => {
      const linkPadrao: LinkDeInscricao = {
        id: 'q-padrao',
        nome: 'Inscrição',
        padrao: true,
        aberta: true,
        codigo: CODIGO,
        link: `https://consultoria.exemplo.test/inscricao/${CODIGO}`,
        responsavelId: TREINADOR.id,
        proximoQuestionarioId: null,
        texto: null,
        camposOcultos: [],
        versao: 2,
      };
      let fichaRapida: LinkDeInscricao | null = null;
      let configFicha: ConfiguracaoInscricao = {
        aberta: true,
        codigo: CODIGO_FICHA_RAPIDA,
        link: LINK_FICHA_RAPIDA,
        responsavelId: TREINADOR.id,
        texto: null,
        camposOcultos: ['SEXO', 'OBJETIVO', 'INTERESSE', 'MODALIDADE', 'PREVISAO_INICIO', 'ORIGEM'],
        versao: 0,
      };

      const { pedidos, naoTratadas, errosDaPagina } = await abrirInteressados(page, largura, {
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        'GET /inscricoes/links': (_p, route) => json(route, fichaRapida ? [linkPadrao, fichaRapida] : [linkPadrao]),
        'POST /inscricoes/links/ficha-rapida': (_p, route) => {
          fichaRapida = {
            id: FICHA_RAPIDA_ID,
            nome: 'Ficha rápida',
            padrao: false,
            aberta: true,
            codigo: CODIGO_FICHA_RAPIDA,
            link: LINK_FICHA_RAPIDA,
            responsavelId: TREINADOR.id,
            proximoQuestionarioId: null,
            texto: null,
            camposOcultos: [...configFicha.camposOcultos],
            versao: 0,
          };
          return json(route, fichaRapida, 201);
        },
        [`GET /questionarios/${FICHA_RAPIDA_ID}/link`]: (_p, route) => json(route, configFicha),
        [`PUT /questionarios/${FICHA_RAPIDA_ID}/link`]: (p, route) => {
          const corpo = p.corpo as { aberta: boolean; responsavelId: string | null; texto: string | null; versao: number };
          configFicha = { ...configFicha, aberta: corpo.aberta, responsavelId: corpo.responsavelId, texto: corpo.texto, versao: configFicha.versao + 1 };
          if (fichaRapida) fichaRapida = { ...fichaRapida, aberta: corpo.aberta, texto: corpo.texto, versao: configFicha.versao };
          return json(route, configFicha);
        },
      });

      await expect(page.getByRole('button', { name: 'Criar ficha rápida' })).toBeVisible();
      await page.getByRole('button', { name: 'Criar ficha rápida' }).click();
      await expect(page.getByText('Ficha rápida criada.')).toBeVisible();
      await expect(page.getByText(LINK_FICHA_RAPIDA)).toBeVisible();

      await page.getByRole('button', { name: 'Copiar link de Ficha rápida' }).click();
      await expect(page.getByText('Link de Ficha rápida copiado.')).toBeVisible();
      expect(await page.evaluate(() => (window as unknown as { __copiado?: string }).__copiado)).toBe(LINK_FICHA_RAPIDA);

      await page.getByRole('button', { name: 'Configurar Ficha rápida' }).click();
      const folha = page.getByRole('dialog', { name: 'Configurar Ficha rápida' });
      await expect(folha).toBeVisible();
      await folha.getByLabel('Texto de apresentação e privacidade (opcional)').fill('Preencha para concluir sua matrícula.');
      await folha.getByRole('button', { name: 'Salvar configuração' }).click();
      await expect(page.getByText('Ficha rápida salvo.')).toBeVisible();

      expect(pedidos.some((p) => p.metodo === 'POST' && p.caminho === '/inscricoes/links/ficha-rapida')).toBe(true);
      expect(pedidos.some((p) => p.metodo === 'PUT' && p.caminho === `/questionarios/${FICHA_RAPIDA_ID}/link`)).toBe(true);
      await semRolagemLateral(page);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('FolhaDaInscricao: AGUARDANDO trava Aceitar e permite cortesia; CONFIRMADO_MANUAL habilita Aceitar', async ({ page }) => {
      const aguardando = resumoFalso(1, { nome: 'Lucas Aguardando', email: 'lucas@exemplo.test', pagamento: 'AGUARDANDO', versao: 2 });
      const pago = resumoFalso(2, { nome: 'Marina Paga', email: 'marina@exemplo.test', pagamento: 'CONFIRMADO_MANUAL', versao: 3 });
      const detalheAguardando = detalheFalso(aguardando);
      const detalhePago = detalheFalso(pago, {
        pagamentoConfirmadoPorNome: TREINADOR.nome,
        pagamentoConfirmadoEm: '2026-10-19T12:00:00Z',
      });
      const aceiteCortesia: AceiteInscricao = {
        id: aguardando.id,
        alunoId: ALUNO_CORTESIA_ID,
        convite: null,
        anamneseId: null,
        aceitaSemCobranca: true,
      };

      const { pedidos, naoTratadas, errosDaPagina } = await abrirInteressados(page, largura, {
        'GET /inscricoes/contagens': { corpo: contagensFalsas({ NOVA: 2 }) },
        'GET /inscricoes': { corpo: { itens: [aguardando, pago], total: 2 } },
        [`GET /inscricoes/${aguardando.id}`]: { corpo: detalheAguardando },
        [`GET /inscricoes/${pago.id}`]: { corpo: detalhePago },
        [`POST /inscricoes/${aguardando.id}/aceitar`]: { corpo: aceiteCortesia },
      });

      // 1. Com AGUARDANDO: "Aceitar" desabilitado com motivo, e "Aceitar sem cobrança" disponível.
      await page.getByRole('button', { name: 'Abrir inscrição de Lucas Aguardando' }).click();
      await expect(page.getByText('O que a pessoa escreveu')).toBeVisible();
      const botaoAceitar = page.getByRole('button', { name: 'Aceitar', exact: true });
      await expect(botaoAceitar).toBeDisabled();
      await expect(page.getByText('Confirme o pagamento antes de aceitar.')).toBeVisible();
      if (largura === 1280) await capturar(page, 'ficha-rapida-cortesia-1280');

      await page.getByRole('button', { name: 'Aceitar sem cobrança', exact: true }).click();
      const painel = page.getByRole('alertdialog', { name: 'Aceitar sem cobrança?' });
      await expect(painel).toBeVisible();
      await expect(painel.getByText('Condição: Aceite sem cobrança (cortesia)')).toBeVisible();
      await painel.getByRole('button', { name: 'Aceitar sem cobrança', exact: true }).click();

      await expect(page.getByText('Inscrição aceita sem cobrança (cortesia): o aluno foi cadastrado.')).toBeVisible();
      await expect(page.getByText('Aceita sem cobrança (cortesia)', { exact: true })).toBeVisible();
      const envio = pedidos.find((p) => p.metodo === 'POST' && p.caminho === `/inscricoes/${aguardando.id}/aceitar`);
      expect(envio?.corpo).toMatchObject({ semCobranca: true, versao: 2 });

      // Fecha a folha e abre a inscrição com pagamento confirmado: "Aceitar" está habilitado.
      await page.getByRole('button', { name: 'Fechar', exact: true }).click();
      await page.getByRole('button', { name: 'Abrir inscrição de Marina Paga' }).click();
      await expect(page.getByText('O que a pessoa escreveu')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Aceitar', exact: true })).toBeEnabled();
      await semRolagemLateral(page);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Kanban: mover card sem pagamento confirmado para Aceita abre a folha sem abrir o painel de aceite pago', async ({ page }) => {
      const aguardando = resumoFalso(1, { nome: 'Card Aguardando', pagamento: 'AGUARDANDO', versao: 1 });
      const { pedidos, naoTratadas, errosDaPagina } = await abrirInteressados(page, largura, {
        'GET /inscricoes/contagens': { corpo: contagensFalsas({ NOVA: 1 }) },
        'GET /inscricoes': (p, route) => json(route, p.busca.get('situacao') === 'NOVA' ? { itens: [aguardando], total: 1 } : { itens: [], total: 0 }),
        [`GET /inscricoes/${aguardando.id}`]: { corpo: detalheFalso(aguardando) },
      }, '/treinador/interessados?visao=kanban');

      await page.getByRole('button', { name: 'Mover Card Aguardando para' }).click();
      await page.getByRole('button', { name: 'Aceitar (cadastrar aluno)' }).click();
      await expect(page.getByText('Confirme o pagamento na inscrição antes de aceitar, ou use Aceitar sem cobrança.')).toBeVisible();
      await expect(page.getByText('O que a pessoa escreveu')).toBeVisible();
      await expect(page.getByText('Aceitar inscrição?')).toHaveCount(0);
      expect(pedidos.some((p) => p.caminho.endsWith('/aceitar'))).toBe(false);
      await semRolagemLateral(page);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Indicadores: exibe os 4 cartões (Inscritos, Aguardando pagamento, Pagaram, Cortesias) separados de Aceites e glossário', async ({ page }) => {
      const indicadores: IndicadoresInscricoes = {
        de: '2026-10-01',
        ate: '2026-10-30',
        entradas: 18,
        pessoas: 16,
        aceites: 9,
        recusadas: 2,
        desistencias: 3,
        reaberturas: 1,
        aguardandoPagamento: 4,
        pagaram: 7,
        cortesias: 2,
        aceitesDasEntradas: 8,
        conversao: 8 / 18,
        diasAteAceite: { mediana: 3, media: 3.5 },
        porMotivo: [],
        porOrigem: [{ origem: 'INSTAGRAM', entradas: 12, aceites: 6 }],
      };

      const { naoTratadas, errosDaPagina } = await abrirInteressados(page, largura, {
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        'GET /inscricoes/indicadores': { corpo: indicadores },
      }, '/treinador/interessados?visao=indicadores');

      await expect(page.getByLabel(/^Aceites: 9/)).toBeVisible();
      await expect(page.getByLabel(/^Inscritos: 18/)).toBeVisible();
      await expect(page.getByLabel(/^Aguardando pagamento: 4/)).toBeVisible();
      await expect(page.getByLabel(/^Pagaram: 7/)).toBeVisible();
      await expect(page.getByLabel(/^Cortesias: 2/)).toBeVisible();

      // Glossário "Como contamos" explica os termos de pagamento e cortesia.
      await expect(page.getByText('Como contamos', { exact: true })).toBeVisible();
      await expect(page.getByText('Inscrições em atendimento cujo pagamento está marcado como aguardando confirmação.')).toBeVisible();
      await expect(page.getByText('Inscrições do período com pagamento confirmado manualmente pela equipe.')).toBeVisible();
      await expect(page.getByText('Inscrições aceitas sem cobrança (cortesia) no período, sem pagamento confirmado.')).toBeVisible();

      if (largura === 1280) await capturar(page, 'ficha-rapida-indicadores-1280');
      await semRolagemLateral(page);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}
