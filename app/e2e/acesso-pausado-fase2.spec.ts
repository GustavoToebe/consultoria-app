import { expect, test, type Page } from '@playwright/test';

import type { FinanceiroDoAluno } from '../src/api/financeiroTipos';
import type { AlunoDetalhe, AlunoResumo } from '../src/api/tipos';
import { fixarHoje, sessaoDeAluno } from './aluno';
import { ALUNO, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
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
 * Fase 2 (Pausar acesso do aluno por atraso): tela exclusiva do aluno pausado com cobranças em aberto e
 * revalidação em "Já paguei, verificar agora"; no treinador, selo "Acesso pausado" na lista e cabeçalho,
 * além de pausar/reativar com confirmação em CartaoAcesso e na DetalheDaCobranca vencida. Só dados fictícios.
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
  acessoPausado: false,
  acessoPausadoEm: null,
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

const semRolagemLateral = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

for (const largura of [390, 1280]) {
  test.describe(`${largura}px`, () => {
    test('Aluno pausado: vê apenas tela de regularização, sem menu do app, e destrava ao clicar em "Já paguei, verificar agora"', async ({ page }) => {
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
          acessoPausado: pausado,
          aluno: { id: ALUNO_ID, nome: ALUNO.nome, acessoPausado: pausado, acessoPausadoEm: pausado ? '2026-10-18T12:00:00Z' : null },
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
      await expect(page.getByRole('button', { name: 'Já paguei, verificar agora' })).toBeVisible();
      // Sem menu de navegação do aluno enquanto pausado.
      await expect(page.getByRole('link', { name: 'Treino', exact: true })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Dieta', exact: true })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Comunidade', exact: true })).toHaveCount(0);

      if (largura === 390) await capturar(page, 'acesso-pausado-aluno-390');
      await semRolagemLateral(page);

      // Simula quitação no servidor e aciona revalidação pelo botão.
      pausado = false;
      const euAntes = pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/eu').length;
      await page.getByRole('button', { name: 'Já paguei, verificar agora' }).click();

      await expect.poll(() => pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/eu').length).toBeGreaterThan(euAntes);
      await expect(page.getByRole('heading', { name: 'Seu acesso está pausado. Quite aqui.' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Treino', exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Dieta', exact: true })).toBeVisible();
      await semRolagemLateral(page);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Treinador: selo "Acesso pausado" na lista e cabeçalho + pausar e reativar em CartaoAcesso', async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await fixarHoje(page);

      let aluno: AlunoDetalhe = { ...ALUNO_DETALHE_BASE, acessoPausado: true, acessoPausadoEm: '2026-10-18T12:00:00Z' };
      const resumoLista = (): AlunoResumo => ({
        id: aluno.id,
        nome: aluno.nome,
        ativo: aluno.ativo,
        temAcesso: aluno.temAcesso,
        acessoPausado: aluno.acessoPausado,
        acessoPausadoEm: aluno.acessoPausadoEm,
        planoAtivo: null,
        ultimoRegistro: null,
        tags: [],
      });

      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, {
          pagamentosHabilitados: true,
          permissoes: [...PERMISSOES_TREINADOR, ...PERMISSOES_FINANCEIRO],
        })),
        'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        'GET /consultoria': { corpo: { diasAtualizacaoPadrao: 30 } },
        'GET /questionarios/opcoes': { corpo: [] },
        'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
        'GET /financeiro/alunos-em-atraso': { corpo: { alunoIds: [ALUNO_ID] } },
        'GET /alunos': (_p, route) => json(route, { itens: [resumoLista()], total: 1 }),
        [`GET /alunos/${ALUNO_ID}`]: (_p, route) => json(route, aluno),
        [`GET /alunos/${ALUNO_ID}/foto-perfil`]: { status: 404, corpo: { status: 404, message: 'Sem foto.', codigo: 'NAO_ENCONTRADO' } },
        [`GET /alunos/${ALUNO_ID}/lesoes`]: { corpo: [] },
        [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [] },
        [`GET /alunos/${ALUNO_ID}/contratacao`]: { status: 204 },
        [`GET /alunos/${ALUNO_ID}/contratacoes`]: { corpo: [] },
        [`GET /alunos/${ALUNO_ID}/anamneses`]: { corpo: [] },
        [`GET /alunos/${ALUNO_ID}/cobrancas`]: { corpo: [] },
        [`GET /alunos/${ALUNO_ID}/responsavel-financeiro`]: { status: 204 },
        [`POST /alunos/${ALUNO_ID}/pausar-acesso`]: (_p, route) => {
          aluno = { ...aluno, acessoPausado: true, acessoPausadoEm: '2026-10-19T13:00:00Z' };
          return json(route, aluno);
        },
        [`POST /alunos/${ALUNO_ID}/reativar-acesso`]: (_p, route) => {
          aluno = { ...aluno, acessoPausado: false, acessoPausadoEm: null };
          return json(route, aluno);
        },
      });

      // 1. Lista de alunos mostra o selo "Acesso pausado".
      await page.goto('/treinador/alunos');
      await expect(page.getByText('Carlos Atrasado')).toBeVisible();
      await expect(page.getByText('Acesso pausado', { exact: true })).toBeVisible();

      // 2. Abre a ficha na aba "Ficha do aluno": selo no cabeçalho e no CartaoAcesso.
      await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=ficha`);
      await expect(page.getByRole('heading', { name: 'Carlos Atrasado', level: 1 })).toBeVisible();
      const acesso = page.getByLabel('Acesso ao app', { exact: true });
      await expect(acesso.getByText('Acesso pausado', { exact: true })).toBeVisible();
      await expect(acesso.getByRole('button', { name: 'Reativar acesso' })).toBeVisible();
      if (largura === 1280) await capturar(page, 'acesso-pausado-treinador-1280');

      // Reativar acesso com PainelConfirmacao.
      await acesso.getByRole('button', { name: 'Reativar acesso' }).click();
      const painelReativar = page.getByRole('alertdialog', { name: 'Reativar acesso do aluno?' });
      await expect(painelReativar).toBeVisible();
      await painelReativar.getByRole('button', { name: 'Reativar acesso' }).click();
      await expect(page.getByText('Acesso do aluno reativado.')).toBeVisible();
      await expect(acesso.getByRole('button', { name: 'Pausar acesso até quitar' })).toBeVisible();

      // Pausar novamente com PainelConfirmacao.
      await acesso.getByRole('button', { name: 'Pausar acesso até quitar' }).click();
      const painelPausar = page.getByRole('alertdialog', { name: 'Pausar acesso até quitar?' });
      await expect(painelPausar).toBeVisible();
      await painelPausar.getByRole('button', { name: 'Pausar acesso' }).click();
      await expect(page.getByText('Acesso do aluno pausado até a quitação.')).toBeVisible();
      await expect(acesso.getByText('Acesso pausado', { exact: true })).toBeVisible();

      expect(pedidos.some((p) => p.metodo === 'POST' && p.caminho === `/alunos/${ALUNO_ID}/reativar-acesso`)).toBe(true);
      expect(pedidos.some((p) => p.metodo === 'POST' && p.caminho === `/alunos/${ALUNO_ID}/pausar-acesso`)).toBe(true);
      await semRolagemLateral(page);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Treinador: pausar e reativar acesso na folha de cobrança vencida (DetalheDaCobranca)', async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await fixarHoje(page);

      let aluno: AlunoDetalhe = { ...ALUNO_DETALHE_BASE, acessoPausado: false, acessoPausadoEm: null };
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
          aluno = { ...aluno, acessoPausado: true, acessoPausadoEm: '2026-10-19T13:00:00Z' };
          return json(route, aluno);
        },
        [`POST /alunos/${ALUNO_ID}/reativar-acesso`]: (_p, route) => {
          aluno = { ...aluno, acessoPausado: false, acessoPausadoEm: null };
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
