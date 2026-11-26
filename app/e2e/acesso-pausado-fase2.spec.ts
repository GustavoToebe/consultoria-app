import { expect, test, type Locator, type Page } from '@playwright/test';

import type { FinanceiroDoAluno } from '../src/api/financeiroTipos';
import type { AlunoDetalhe, AlunoResumo } from '../src/api/tipos';
import { CLARO } from '../src/tema/tokens';
import { fixarHoje, sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import {
  ALUNO_FINANCEIRO_ID,
  COBRANCA_ATRASADA,
  estadoFinanceiro,
  LINK_DE_PAGAMENTO,
  PERMISSOES_FINANCEIRO,
  RECEBIMENTO_CONFIGURADO,
  rotasDoFinanceiro,
  sessaoComFinanceiro,
} from './financeiro-falso';

/**
 * Fase 2 (Pausar acesso do aluno por atraso, refeita em 26/11 sobre o "Desativar acesso": motivo `ATRASO`): tela exclusiva
 * do aluno pausado com cobranças em aberto e revalidação em "Verificar meu acesso"; no treinador, o selo "Acesso pausado"
 * (âmbar) com as mesmas palavras na lista, no cabeçalho e no cartão Acesso ao app, "Reativar acesso" na Situação e o ⋯
 * "Ações do acesso" com "Pausar acesso até quitar" (desabilitado sem cobrança vencida) e "Desativar acesso"; e
 * pausar/reativar na DetalheDaCobranca vencida. Só dados fictícios.
 */

const ALUNO_ID = ALUNO_FINANCEIRO_ID;

const FINANCEIRO_PAUSADO: FinanceiroDoAluno = {
  plano: {
    contratacaoId: 'ct-1',
    planoNome: 'Consultoria Mensal',
    valorCentavos: 25_000,
    periodicidade: 'MENSAL',
    situacao: 'ATIVA',
    proximoVencimento: '2026-10-05',
    terminoVigencia: null,
    diasRestantesVigencia: null,
    linkDePagamento: null,
  },
  abertas: [
    {
      id: 'c0000000-0000-4000-8000-000000000021',
      tipo: 'MENSALIDADE',
      competencia: '2026-10-05',
      vencimento: '2026-10-05',
      valorCentavos: 25_000,
      situacao: 'ABERTA',
      vencida: true,
      pagoEm: null,
      forma: null,
      descricao: null,
      cobrancaAutomatica: null,
    },
  ],
  historico: [],
  pagamentoOnline: true,
  formasDePagamento: ['INFINITEPAY', 'MANUAL'],
};

const ALUNO_DETALHE_BASE: AlunoDetalhe = {
  id: ALUNO_ID,
  nome: 'Carlos Atrasado',
  email: 'carlos@exemplo.test',
  telefone: '(11) 99999-1111',
  objetivo: null,
  ativo: true,
  temAcesso: true,
  acessoDesativadoEm: null,
  acessoDesativadoMotivo: null,
  conviteExpiraEm: null,
  versao: 1,
  diasAtualizacao: null,
  anonimizado: false,
  emailDeAcesso: 'carlos@exemplo.test',
  aguardandoPrimeiroAcesso: false,
};

async function capturar(page: Page, nome: string) {
  const pasta = process.env.SWARM_CAPTURAS_DIR;
  if (pasta) await page.screenshot({ path: `${pasta}/${nome}.png`, fullPage: false });
}

const rgbCss = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
/** O "●" do selo (6 x 6 px, só desenho): cor do ponto, do texto ao lado e do fundo da pílula (o mesmo de `acesso-aluno.spec.ts`). */
const pontosDoSelo = (el: Locator) => el.locator('[aria-hidden="true"]').evaluateAll((els) => els
  .filter((e) => (e as HTMLElement).offsetWidth === 6 && (e as HTMLElement).offsetHeight === 6)
  .map((e) => ({ ponto: getComputedStyle(e).backgroundColor, texto: getComputedStyle(e.nextElementSibling!).color, pilula: getComputedStyle(e.parentElement!).backgroundColor })));

/** A caixa do desenho (o primeiro filho do botão), não a do alvo de toque: no `IconeBotao compacto` o alvo tem 6 px a mais de cada lado. */
const desenhoDe = (botao: Locator) => botao.evaluate((el) => {
  const r = (el.firstElementChild ?? el).getBoundingClientRect();
  return { direita: r.right, meio: r.top + r.height / 2 };
});

/** Sessão do treinador com o financeiro ligado e a ficha do aluno fictício (o `aluno()` é lido a cada pedido). */
async function rotasDoTreinador(page: Page, aluno: () => AlunoDetalhe, permissoes: string[] = [...PERMISSOES_TREINADOR, ...PERMISSOES_FINANCEIRO]): Promise<RespostasApi> {
  const resumoLista = (): AlunoResumo => {
    const a = aluno();
    return { id: a.id, nome: a.nome, ativo: a.ativo, temAcesso: a.temAcesso, acessoDesativadoMotivo: a.acessoDesativadoMotivo, planoAtivo: null, ultimoRegistro: null, tags: [] };
  };
  return {
    ...(await sessao(page, TREINADOR, { pagamentosHabilitados: true, permissoes })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /consultoria': { corpo: { diasAtualizacaoPadrao: 30 } },
    'GET /questionarios/opcoes': { corpo: [] },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
    'GET /alunos': (_p, route) => json(route, { itens: [resumoLista()], total: 1 }),
    [`GET /alunos/${ALUNO_ID}`]: (_p, route) => json(route, aluno()),
    [`GET /alunos/${ALUNO_ID}/foto-perfil`]: { status: 404, corpo: { status: 404, message: 'Sem foto.', codigo: 'NAO_ENCONTRADO' } },
    [`GET /alunos/${ALUNO_ID}/lesoes`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/contratacao`]: { status: 204 },
    [`GET /alunos/${ALUNO_ID}/contratacoes`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/anamneses`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/cobrancas`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/responsavel-financeiro`]: { status: 204 },
  };
}

const semRolagemLateral = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

for (const largura of [390, 1280]) {
  test.describe(`${largura}px`, () => {
    test('Aluno pausado: vê apenas tela de regularização, sem menu do app, e destrava ao clicar em "Verificar meu acesso"', async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await fixarHoje(page);

      let pausado = true;
      const baseSessao = await sessaoDeAluno(page);
      const euBase = {
        ...(baseSessao['GET /eu'] as { corpo: Record<string, unknown> }).corpo,
        pagamentosHabilitados: true,
      };

      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...baseSessao,
        'GET /eu': (_p, route) => json(route, {
          ...euBase,
          aluno: { id: ALUNO_ID, nome: ALUNO.nome, acessoDesativadoMotivo: pausado ? 'ATRASO' : null },
        }),
        'GET /aluno/financeiro': (_p, route) => json(route, pausado ? FINANCEIRO_PAUSADO : { ...FINANCEIRO_PAUSADO, abertas: [] }),
        'GET /aluno/financeiro/lembretes': { corpo: { desativado: false } },
        'GET /aluno/foto-perfil': { status: 404, corpo: { status: 404, message: 'Sem foto.', codigo: 'NAO_ENCONTRADO' } },
        'GET /aluno/dieta': { status: 404, corpo: { status: 404, message: 'Sem dieta.', codigo: 'NAO_ENCONTRADO' } },
        'GET /aluno/atualizacao': { status: 404, corpo: { status: 404, message: 'Sem atualização.', codigo: 'NAO_ENCONTRADO' } },
      });

      await page.goto('/aluno');
      await expect(page.getByRole('heading', { name: 'Seu acesso está pausado. Quite aqui.', level: 1 })).toBeVisible();
      await expect(page.getByText('Cobranças em aberto')).toBeVisible();
      await expect(page.getByRole('button', { name: /^Pagar/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Verificar meu acesso' })).toBeVisible();
      // Sem menu de navegação do aluno enquanto pausado.
      await expect(page.getByRole('link', { name: 'Treino', exact: true })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Dieta', exact: true })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Comunidade', exact: true })).toHaveCount(0);

      if (largura === 390) await capturar(page, 'acesso-pausado-aluno-390');
      await semRolagemLateral(page);

      // Simula quitação no servidor e aciona revalidação pelo botão.
      pausado = false;
      const euAntes = pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/eu').length;
      await page.getByRole('button', { name: 'Verificar meu acesso' }).click();

      await expect.poll(() => pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/eu').length).toBeGreaterThan(euAntes);
      await expect(page.getByRole('heading', { name: 'Seu acesso está pausado. Quite aqui.' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Treino', exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Dieta', exact: true })).toBeVisible();
      await semRolagemLateral(page);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Treinador: "Acesso pausado" igual na lista, no cabeçalho e no cartão; "Reativar acesso" e "Pausar acesso até quitar" no ⋯', async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await fixarHoje(page);

      let aluno: AlunoDetalhe = { ...ALUNO_DETALHE_BASE, acessoDesativadoEm: '2026-10-18T12:00:00Z', acessoDesativadoMotivo: 'ATRASO' };
      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await rotasDoTreinador(page, () => aluno)),
        'GET /financeiro/alunos-em-atraso': { corpo: { alunoIds: [ALUNO_ID], truncado: false } },
        [`POST /alunos/${ALUNO_ID}/pausar-acesso`]: (_p, route) => {
          aluno = { ...aluno, acessoDesativadoEm: '2026-10-19T13:00:00Z', acessoDesativadoMotivo: 'ATRASO' };
          return json(route, aluno);
        },
        [`POST /alunos/${ALUNO_ID}/reativar-acesso`]: (_p, route) => {
          aluno = { ...aluno, acessoDesativadoEm: null, acessoDesativadoMotivo: null };
          return json(route, aluno);
        },
      });

      // 1. Lista de alunos: o selo âmbar "Acesso pausado" ao lado de "Cobrança vencida".
      await page.goto('/treinador/alunos');
      await expect(page.getByText('Carlos Atrasado')).toBeVisible();
      await expect(page.getByText('Acesso pausado', { exact: true })).toBeVisible();
      await expect(page.getByText('Cobrança vencida', { exact: true })).toBeVisible();

      // 2. Ficha: as mesmas palavras no cabeçalho e no cartão, com a data só na nota do cartão.
      await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=ficha`);
      await expect(page.getByRole('heading', { name: 'Carlos Atrasado', level: 1 })).toBeVisible();
      await expect(page.getByText('Acesso pausado', { exact: true })).toHaveCount(2);
      const acesso = page.getByLabel('Acesso ao app', { exact: true });
      await expect(acesso.getByLabel('Situação: Acesso pausado', { exact: true })).toBeVisible();
      // Âmbar: ponto e texto em `atencao` sobre a pílula `atencaoSuave` (tema claro, o padrão sem preferência).
      await page.mouse.move(0, 0);
      await expect.poll(() => pontosDoSelo(acesso.getByLabel('Situação: Acesso pausado', { exact: true }))).toEqual([
        { ponto: rgbCss(CLARO.atencao), texto: rgbCss(CLARO.atencao), pilula: rgbCss(CLARO.atencaoSuave) }]);
      await expect(acesso.getByText('Pausado em 18/10 por cobrança vencida. O aluno só vê as cobranças em aberto; o acesso volta ao quitar.', { exact: true })).toBeVisible();
      // Pausado, a conta segue: e-mail e senha continuam com as ações.
      await expect(acesso.getByRole('button', { name: 'Alterar e-mail de acesso' })).toBeVisible();
      await expect(acesso.getByRole('button', { name: 'Definir nova senha' })).toBeVisible();
      // A mesma borda direita (o desenho, não o alvo de toque) e cada ação no meio da altura da linha.
      const reativar = acesso.getByRole('button', { name: 'Reativar acesso' });
      const bordas = await Promise.all([reativar, acesso.getByRole('button', { name: 'Copiar e-mail de acesso' }),
        acesso.getByRole('button', { name: 'Definir nova senha' })].map(desenhoDe));
      for (const b of bordas) expect(Math.abs(b.direita - bordas[0].direita)).toBeLessThanOrEqual(1);
      for (const botao of [reativar, acesso.getByRole('button', { name: 'Definir nova senha' })]) {
        const d = await desenhoDe(botao);
        const linha = (await botao.locator('xpath=ancestor::*[@role="listitem"][1]').boundingBox())!;
        expect(Math.abs(d.meio - (linha.y + linha.height / 2))).toBeLessThanOrEqual(1.5);
      }
      // No ⋯, pausado: só "Desativar acesso" (troca o motivo para MANUAL); o "Pausar" não se repete.
      await acesso.getByRole('button', { name: 'Ações do acesso', exact: true }).click();
      const menu = page.getByRole('dialog', { name: 'Ações do acesso' });
      await expect(menu.getByRole('button', { name: /^Desativar acesso/ })).toBeVisible();
      await expect(menu.getByRole('button', { name: /^Pausar acesso até quitar/ })).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);

      // 3. "Reativar acesso" (sem painel: não tira nada do aluno) usa a rota do Financeiro.
      await reativar.click();
      await expect(page.getByText('Acesso reativado.')).toBeVisible();
      await expect(acesso.getByLabel('Situação: Com acesso', { exact: true })).toBeVisible();
      await expect(acesso.getByRole('button', { name: 'Reativar acesso' })).toHaveCount(0);

      // 4. "Pausar acesso até quitar" no ⋯, habilitado (há cobrança vencida), com painel.
      await acesso.getByRole('button', { name: 'Ações do acesso', exact: true }).click();
      const pausar = menu.getByRole('button', { name: /^Pausar acesso até quitar/ });
      await expect(pausar).toBeEnabled();
      await expect(menu.getByRole('button', { name: /^Desativar acesso/ })).toBeVisible();
      await pausar.click();
      const painelPausar = page.getByRole('alertdialog', { name: 'Pausar acesso até quitar?' });
      await expect(painelPausar.getByText(/vê só as cobranças em aberto/)).toBeVisible();
      await painelPausar.getByRole('button', { name: 'Pausar acesso' }).click();
      await expect(page.getByText('Acesso pausado até o aluno quitar as cobranças vencidas.')).toBeVisible();
      await expect(acesso.getByLabel('Situação: Acesso pausado', { exact: true })).toBeVisible();
      await expect(acesso.getByText(/^Pausado em 19\/10/)).toBeVisible();

      expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho.startsWith('/alunos/')).map((p) => p.caminho)).toEqual([
        `/alunos/${ALUNO_ID}/reativar-acesso`, `/alunos/${ALUNO_ID}/pausar-acesso`]);
      await semRolagemLateral(page);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Treinador: sem cobrança vencida o "Pausar" fica apagado com o motivo; sem saber, a API responde e o erro aparece; MANUAL e permissões', async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      let aluno: AlunoDetalhe = { ...ALUNO_DETALHE_BASE };
      let atrasoDisponivel = true;
      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await rotasDoTreinador(page, () => aluno)),
        'GET /financeiro/alunos-em-atraso': (_p, route) => (atrasoDisponivel
          ? json(route, { alunoIds: [], truncado: false })
          : json(route, erroApi(503, 'Financeiro indisponível.', 'FINANCEIRO_INDISPONIVEL').corpo, 503)),
        [`POST /alunos/${ALUNO_ID}/pausar-acesso`]: (_p, route) =>
          json(route, erroApi(409, 'O aluno não tem cobrança vencida em aberto para pausar o acesso.', 'SEM_COBRANCA_VENCIDA').corpo, 409),
        [`POST /alunos/${ALUNO_ID}/acesso/reativar`]: (_p, route) => {
          aluno = { ...aluno, acessoDesativadoEm: null, acessoDesativadoMotivo: null };
          return json(route, aluno);
        },
      });
      await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=ficha`);
      const acesso = page.getByLabel('Acesso ao app', { exact: true });
      await expect(acesso.getByLabel('Situação: Com acesso', { exact: true })).toBeVisible();

      // Em dia: o item aparece apagado, com o motivo no próprio item.
      await acesso.getByRole('button', { name: 'Ações do acesso', exact: true }).click();
      const menu = page.getByRole('dialog', { name: 'Ações do acesso' });
      const pausar = menu.getByRole('button', { name: 'Pausar acesso até quitar, Sem cobrança vencida', exact: true });
      await expect(pausar).toBeDisabled();
      await expect(menu.getByText('Sem cobrança vencida', { exact: true })).toBeVisible();
      if (largura === 1280) await capturar(page, 'acesso-menu-sem-vencida-1280');
      await page.keyboard.press('Escape');
      // A folha entra no histórico: espera ela fechar antes de recarregar.
      await expect(menu).toHaveCount(0);

      // Sem saber (a lista de atraso falhou): habilitado, e o 409 da API vira texto claro no cartão.
      atrasoDisponivel = false;
      await page.reload();
      await acesso.getByRole('button', { name: 'Ações do acesso', exact: true }).click();
      await menu.getByRole('button', { name: /^Pausar acesso até quitar/ }).click();
      await page.getByRole('alertdialog', { name: 'Pausar acesso até quitar?' }).getByRole('button', { name: 'Pausar acesso' }).click();
      await expect(acesso.getByText('Este aluno não tem cobrança vencida em aberto: o acesso só pausa com uma cobrança vencida.', { exact: true })).toBeVisible();
      await expect(acesso.getByLabel('Situação: Com acesso', { exact: true })).toBeVisible();

      // MANUAL: "Acesso desativado" neutro, sem ⋯, e o "Reativar acesso" é o da equipe (nunca o do Financeiro).
      aluno = { ...aluno, acessoDesativadoEm: '2026-10-17T15:00:00Z', acessoDesativadoMotivo: 'MANUAL' };
      await page.reload();
      await expect(acesso.getByLabel('Situação: Acesso desativado', { exact: true })).toBeVisible();
      await expect(page.getByText('Acesso desativado', { exact: true })).toHaveCount(2);
      await expect(acesso.getByRole('button', { name: 'Ações do acesso', exact: true })).toHaveCount(0);
      await acesso.getByRole('button', { name: 'Reativar acesso' }).click();
      await expect(acesso.getByLabel('Situação: Com acesso', { exact: true })).toBeVisible();

      expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho.startsWith('/alunos/')).map((p) => p.caminho)).toEqual([
        `/alunos/${ALUNO_ID}/pausar-acesso`, `/alunos/${ALUNO_ID}/acesso/reativar`]);
      // A lista de atraso falhou de propósito (503): ela é tratada; nada mais ficou sem resposta.
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Treinador sem a permissão do Financeiro: pausado mostra o selo, sem "Reativar acesso" nem "Pausar"; só "Desativar" no ⋯', async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      const aluno: AlunoDetalhe = { ...ALUNO_DETALHE_BASE, acessoDesativadoEm: '2026-10-18T12:00:00Z', acessoDesativadoMotivo: 'ATRASO' };
      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await rotasDoTreinador(page, () => aluno, PERMISSOES_TREINADOR)),
      });
      await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=ficha`);
      const acesso = page.getByLabel('Acesso ao app', { exact: true });
      await expect(acesso.getByLabel('Situação: Acesso pausado', { exact: true })).toBeVisible();
      await expect(acesso.getByRole('button', { name: 'Reativar acesso' })).toHaveCount(0);
      await acesso.getByRole('button', { name: 'Ações do acesso', exact: true }).click();
      const menu = page.getByRole('dialog', { name: 'Ações do acesso' });
      await expect(menu.getByRole('button', { name: /^Desativar acesso/ })).toBeVisible();
      await expect(menu.getByRole('button', { name: /^Pausar acesso até quitar/ })).toHaveCount(0);
      // Sem a permissão, a lista de atraso nem é pedida.
      expect(pedidos.some((p) => p.caminho === '/financeiro/alunos-em-atraso')).toBe(false);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Treinador: pausar e reativar acesso na folha de cobrança vencida (DetalheDaCobranca)', async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await fixarHoje(page);

      let aluno: AlunoDetalhe = { ...ALUNO_DETALHE_BASE };
      const vencida = { ...COBRANCA_ATRASADA, alunoId: ALUNO_ID, alunoNome: 'Carlos Atrasado' };
      const estado = estadoFinanceiro({
        cobrancas: [vencida],
        recebimento: { ...RECEBIMENTO_CONFIGURADO },
        lembretesDasCobrancas: {
          [vencida.id]: {
            itens: [],
            whatsapp: { telefone: '(11) 99999-1111', mensagem: 'Olá, Carlos.' },
            motivoSemWhatsapp: null,
            alunoDesligou: false,
            paraResponsavel: false,
          },
        },
      });

      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessaoComFinanceiro(page)),
        ...rotasDoFinanceiro(estado),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        [`POST /cobrancas/${vencida.id}/link`]: { corpo: { url: LINK_DE_PAGAMENTO } },
        [`POST /alunos/${ALUNO_ID}/pausar-acesso`]: (_p, route) => {
          aluno = { ...aluno, acessoDesativadoEm: '2026-10-19T13:00:00Z', acessoDesativadoMotivo: 'ATRASO' };
          return json(route, aluno);
        },
        [`POST /alunos/${ALUNO_ID}/reativar-acesso`]: (_p, route) => {
          aluno = { ...aluno, acessoDesativadoEm: null, acessoDesativadoMotivo: null };
          return json(route, aluno);
        },
      });

      await page.goto('/treinador/financeiro?aba=cobrancas');
      await page.getByRole('button', { name: 'Abrir cobrança de Carlos Atrasado' }).click();
      const folha = page.getByRole('dialog');
      await expect(folha.getByRole('heading', { name: 'Acesso ao aplicativo' })).toBeVisible();

      // Pausar acesso pela folha da cobrança vencida.
      await folha.getByRole('button', { name: 'Pausar acesso até quitar' }).click();
      const painelPausar = page.getByRole('alertdialog', { name: 'Pausar acesso até quitar?' });
      await expect(painelPausar).toBeVisible();
      await painelPausar.getByRole('button', { name: 'Pausar acesso' }).click();
      await expect(page.getByText('Acesso do aluno pausado até a quitação.')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Reativar acesso' })).toBeVisible();

      // Reativar acesso pela folha da cobrança vencida.
      await folha.getByRole('button', { name: 'Reativar acesso' }).click();
      const painelReativar = page.getByRole('alertdialog', { name: 'Reativar acesso do aluno?' });
      await expect(painelReativar).toBeVisible();
      await painelReativar.getByRole('button', { name: 'Reativar acesso' }).click();
      await expect(page.getByText('Acesso do aluno reativado.')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Pausar acesso até quitar' })).toBeVisible();

      expect(pedidos.some((p) => p.metodo === 'POST' && p.caminho === `/alunos/${ALUNO_ID}/pausar-acesso`)).toBe(true);
      expect(pedidos.some((p) => p.metodo === 'POST' && p.caminho === `/alunos/${ALUNO_ID}/reativar-acesso`)).toBe(true);
      await semRolagemLateral(page);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}
