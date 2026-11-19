import { expect, test, type Page } from '@playwright/test';

import type { PlanoResponse } from '../src/api/financeiroTipos';
import type { AlunoDetalhe, ConteudoDieta, ConteudoTreino, PlanoDetalhe, PlanoResumo } from '../src/api/tipos';
import { exercicio, serie, sessao as sessaoDeTreino } from '../src/dominio/exemplosDeTreino.apoioTeste';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { estadoFinanceiro, rotasDoFinanceiro, sessaoComFinanceiro } from './financeiro-falso';

/**
 * Planos ativos do aluno (D13, `docs/planos/planos-ativos-do-aluno.md`, passo 2): "O que inclui" no formulário do plano
 * comercial (nasce com os dois ligados, pelo menos um, 422 no campo), o texto neutro na lista, a linha "Planos ativos" nos
 * Dados do aluno (some sem `planosAtivos`; "Ver no Financeiro" só com `FINANCEIRO_LER`) e o Alerta de atenção nos editores de
 * treino e de dieta do aluno. Só dados fictícios; capturas em `CAPTURAS_PLANOS_ATIVOS` quando a variável existe.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const TREINO_ID = 'p0000000-0000-4000-8000-0000000000a1';
const DIETA_ID = 'p0000000-0000-4000-8000-0000000000b1';
const AVISO_DIETA = 'Este aluno não contratou dieta no plano atual.';
const AVISO_TREINO = 'Este aluno não contratou treino no plano atual.';

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};
const SO_TREINO = { incluiTreino: true, incluiDieta: false };
const SO_DIETA = { incluiTreino: false, incluiDieta: true };
const TUDO = { incluiTreino: true, incluiDieta: true };

const PLANO_SO_TREINO: PlanoResponse = {
  id: 'b0000000-0000-4000-8000-0000000000e1', nome: 'Só o treino mensal', valorCentavos: 12_000, periodicidade: 'MENSAL', arquivado: false,
  criadoEm: '2026-10-01T12:00:00Z', versao: 0, tempoMinimoMeses: null, regraDeSaida: null, linkDePagamento: null, incluiTreino: true, incluiDieta: false,
};

async function comTema(page: Page, tema?: string) {
  if (tema) await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema]);
}

async function capturar(page: Page, nome: string) {
  const pasta = process.env.CAPTURAS_PLANOS_ATIVOS;
  if (pasta) await page.screenshot({ path: `${pasta}/${nome}.png`, fullPage: false });
}

// ---------------------------------------------------------------------------------------------------------------------
// Formulário e lista do plano comercial

async function abrirPlanos(page: Page, o: { largura: number; tema?: string; extra?: RespostasApi; planos?: PlanoResponse[] }) {
  await comTema(page, o.tema);
  await page.setViewportSize({ width: o.largura, height: 900 });
  const estado = estadoFinanceiro({ planos: o.planos ?? [] });
  const api = await simularApi(page, {
    ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estado),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } }, 'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    ...o.extra,
  });
  await page.goto('/treinador/financeiro?aba=planos');
  return { ...api, estado };
}

for (const [tema, rotulo] of [['CLARO', 'claro'], ['ESCURO', 'escuro']] as const) {
  for (const largura of [1280, 390]) {
    test(`${largura}px ${rotulo}: plano novo nasce com treino e dieta; só treino vai no corpo e a lista diz "Só treino"`, async ({ page }) => {
      const { pedidos, errosDaPagina } = await abrirPlanos(page, { largura, tema });
      await page.getByRole('button', { name: 'Novo plano' }).click();
      const folha = page.getByRole('dialog');
      const grupo = folha.getByRole('group', { name: 'O que inclui' });
      await expect(grupo.getByRole('switch', { name: 'Treino' })).toBeChecked();
      await expect(grupo.getByRole('switch', { name: 'Dieta' })).toBeChecked();
      await expect(grupo.getByText('Marque o que este plano inclui. Pelo menos um.')).toBeVisible();
      await folha.getByLabel('Nome do plano').fill('Só o treino mensal');
      await folha.getByLabel('Valor', { exact: true }).fill('120,00');
      await capturar(page, `formulario-${largura}-${rotulo}`);

      // Os dois desligados: o erro aparece no grupo, no lugar da ajuda, e nada é enviado.
      await grupo.getByRole('switch', { name: 'Dieta' }).click();
      await grupo.getByRole('switch', { name: 'Treino' }).click();
      await expect(grupo.getByText('Marque pelo menos um: treino ou dieta.')).toBeVisible();
      await expect(grupo.getByText('Marque o que este plano inclui. Pelo menos um.')).toHaveCount(0);
      await capturar(page, `formulario-erro-${largura}-${rotulo}`);
      await folha.getByRole('button', { name: 'Criar plano' }).click();
      expect(pedidos.filter((p) => p.metodo === 'POST' && p.caminho === '/financeiro/planos')).toHaveLength(0);

      await grupo.getByRole('switch', { name: 'Treino' }).click();
      await expect(grupo.getByText('Marque pelo menos um: treino ou dieta.')).toHaveCount(0);
      await folha.getByRole('button', { name: 'Criar plano' }).click();
      await expect(page.getByText('Plano criado.')).toBeVisible();
      const corpo = pedidos.find((p) => p.metodo === 'POST' && p.caminho === '/financeiro/planos')?.corpo as { incluiTreino: boolean; incluiDieta: boolean };
      expect([corpo.incluiTreino, corpo.incluiDieta]).toEqual([true, false]);
      await expect(page.getByText('Só treino').first()).toBeVisible();
      await capturar(page, `lista-${largura}-${rotulo}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

for (const largura of [1280, 390]) {
  test(`${largura}px: 422 da API no "O que inclui" fica no grupo e some ao mexer`, async ({ page }) => {
    const { errosDaPagina } = await abrirPlanos(page, {
      largura,
      extra: {
        'POST /financeiro/planos': (_p, route) => json(route, {
          status: 422, message: 'Confira os dados do plano.', codigo: 'PLANO_INVALIDO',
          fieldErrors: [{ field: 'incluiTreino', message: 'Mensagem do campo vinda da API (fictícia).' }],
        }, 422),
      },
    });
    await page.getByRole('button', { name: 'Novo plano' }).click();
    const folha = page.getByRole('dialog');
    await folha.getByLabel('Nome do plano').fill('Plano recusado');
    await folha.getByLabel('Valor', { exact: true }).fill('99,00');
    await folha.getByRole('button', { name: 'Criar plano' }).click();
    const grupo = folha.getByRole('group', { name: 'O que inclui' });
    await expect(grupo.getByText('Mensagem do campo vinda da API (fictícia).')).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();
    await capturar(page, `formulario-422-${largura}`);
    await grupo.getByRole('switch', { name: 'Dieta' }).click();
    await expect(grupo.getByText('Mensagem do campo vinda da API (fictícia).')).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
}

test('plano existente abre com o que está gravado e o PUT reenvia os dois campos', async ({ page }) => {
  const { pedidos } = await abrirPlanos(page, { largura: 1280, planos: [{ ...PLANO_SO_TREINO }] });
  await expect(page.getByText('Só treino')).toBeVisible();
  await page.getByRole('button', { name: `Abrir plano ${PLANO_SO_TREINO.nome}` }).first().click();
  const grupo = page.getByRole('dialog').getByRole('group', { name: 'O que inclui' });
  await expect(grupo.getByRole('switch', { name: 'Treino' })).toBeChecked();
  await expect(grupo.getByRole('switch', { name: 'Dieta' })).not.toBeChecked();
  await grupo.getByRole('switch', { name: 'Dieta' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar plano' }).click();
  await expect(page.getByText('Plano salvo.')).toBeVisible();
  const corpo = pedidos.find((p) => p.metodo === 'PUT' && p.caminho === `/financeiro/planos/${PLANO_SO_TREINO.id}`)?.corpo as { incluiTreino: boolean; incluiDieta: boolean };
  expect([corpo.incluiTreino, corpo.incluiDieta]).toEqual([true, true]);
  await expect(page.getByText('Treino e dieta')).toBeVisible();
});

// ---------------------------------------------------------------------------------------------------------------------
// Ficha do aluno: a linha "Planos ativos" nos Dados do aluno

const ROTAS_DA_FICHA: RespostasApi = {
  'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
  'GET /inscricoes': { corpo: { itens: [], total: 0 } },
  'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
  'GET /questionarios/opcoes': { corpo: [] },
  [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
  [`GET /alunos/${ALUNO_ID}/lesoes`]: { corpo: [] },
  [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [] },
};

async function abrirFicha(page: Page, o: { largura: number; tema?: string; ficha: AlunoDetalhe; financeiro: boolean }) {
  await comTema(page, o.tema);
  await page.setViewportSize({ width: o.largura, height: 900 });
  const sessaoFalsa = o.financeiro
    ? { ...(await sessaoComFinanceiro(page)), ...rotasDoFinanceiro(estadoFinanceiro()) }
    // Financeiro ligado, mas a pessoa não lê o financeiro: a linha fica, o link não.
    : await sessao(page, TREINADOR, { pagamentosHabilitados: true, permissoes: PERMISSOES_TREINADOR });
  const api = await simularApi(page, { ...sessaoFalsa, ...ROTAS_DA_FICHA, [`GET /alunos/${ALUNO_ID}`]: { corpo: o.ficha } });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=ficha`);
  await expect(page.getByRole('heading', { name: 'Configuração do acompanhamento', exact: true })).toBeVisible();
  return api;
}

const linhaDosPlanos = (page: Page) => page.getByLabel(/^Planos ativos: /);
const verNoFinanceiro = (page: Page) => page.getByRole('link', { name: 'Ver no Financeiro', exact: true });

for (const [tema, rotulo] of [['CLARO', 'claro'], ['ESCURO', 'escuro']] as const) {
  for (const largura of [1280, 390]) {
    test(`${largura}px ${rotulo}: treino e dieta na ficha, com "Ver no Financeiro" que abre as cobranças do aluno`, async ({ page }) => {
      const { errosDaPagina } = await abrirFicha(page, { largura, tema, ficha: { ...FICHA, planosAtivos: TUDO }, financeiro: true });
      await expect(linhaDosPlanos(page)).toHaveAttribute('aria-label', 'Planos ativos: Treino · Dieta');
      await expect(page.getByText('Treino · Dieta', { exact: true })).toBeVisible();
      // Dois "Ver no Financeiro" na aba (o da linha e o do cartão Plano contratado, se houver contratação): o da linha é o primeiro.
      const link = verNoFinanceiro(page).first();
      await expect(link).toHaveAttribute('href', `/treinador/financeiro?aba=cobrancas&alunoId=${ALUNO_ID}`);
      const caixa = (await link.boundingBox())!;
      expect(caixa.height).toBeGreaterThanOrEqual(44);
      await page.getByRole('heading', { name: 'Configuração do acompanhamento', exact: true }).scrollIntoViewIfNeeded();
      await capturar(page, `ficha-${largura}-${rotulo}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('só treino: a linha diz só "Treino"', async ({ page }) => {
  await abrirFicha(page, { largura: 1280, ficha: { ...FICHA, planosAtivos: SO_TREINO }, financeiro: true });
  await expect(linhaDosPlanos(page)).toHaveAttribute('aria-label', 'Planos ativos: Treino');
});

test('sem FINANCEIRO_LER: a linha aparece sem o link', async ({ page }) => {
  await abrirFicha(page, { largura: 390, ficha: { ...FICHA, planosAtivos: SO_DIETA }, financeiro: false });
  await expect(linhaDosPlanos(page)).toHaveAttribute('aria-label', 'Planos ativos: Dieta');
  await expect(verNoFinanceiro(page)).toHaveCount(0);
  await capturar(page, 'ficha-sem-financeiro-390');
});

for (const planosAtivos of [null, undefined]) {
  test(`planosAtivos ${String(planosAtivos)}: a linha some, sem "Não informado" nem "não contratou"`, async ({ page }) => {
    await abrirFicha(page, { largura: 1280, ficha: { ...FICHA, planosAtivos }, financeiro: true });
    await expect(page.getByText('Treinador responsável', { exact: true })).toBeVisible();
    await expect(page.getByText('Planos ativos')).toHaveCount(0);
    await expect(page.getByText(/não contratou/)).toHaveCount(0);
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Alerta nos editores de treino e de dieta do aluno

function resumo(id: string, titulo: string): PlanoResumo {
  return {
    id, alunoId: ALUNO_ID, pastaId: null, titulo, inicio: '2026-11-01', fim: '2026-11-30', ativo: true,
    versaoPublicada: 1, publicadoEm: '2026-11-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 3,
  };
}
const TREINO: PlanoDetalhe<ConteudoTreino> = {
  plano: resumo(TREINO_ID, 'Treino de teste'),
  rascunho: { objetivo: null, orientacoes: null, sessoes: [sessaoDeTreino('sa', [exercicio('remada', { nome: 'Remada fictícia', series: [serie('s1')] })], [], { nome: 'Costas' })] },
  versoes: [{ id: 'v0000000-0000-4000-8000-0000000000a1', numero: 1, publicadoEm: '2026-11-01T12:00:00Z' }],
};
const DIETA: PlanoDetalhe<ConteudoDieta> = {
  plano: resumo(DIETA_ID, 'Dieta de teste'),
  rascunho: {
    objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, suplementacao: [], ergogenicos: null, aguaLitros: null, variacoes: [],
    refeicoes: [{ uid: 'almoco', nome: 'Almoço', horario: '12:00', observacao: null, opcoes: [{ uid: 'almoco-a', rotulo: 'A', itens: [] }] }],
  },
  versoes: [{ id: 'v0000000-0000-4000-8000-0000000000b1', numero: 1, publicadoEm: '2026-11-01T12:00:00Z' }],
};

async function abrirEditor(page: Page, o: { tipo: 'treino' | 'dieta'; largura: number; tema?: string; planosAtivos: AlunoDetalhe['planosAtivos'] }) {
  await comTema(page, o.tema);
  await page.setViewportSize({ width: o.largura, height: 900 });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR', 'DIETA_LER', 'DIETA_ALTERAR'] })),
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { ...FICHA, planosAtivos: o.planosAtivos } },
    [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /exercicios': { corpo: [] },
    'GET /alimentos': { corpo: [] },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /planos-treino/${TREINO_ID}`]: { corpo: TREINO },
    [`GET /planos-dieta/${DIETA_ID}`]: { corpo: DIETA },
  });
  await page.goto(o.tipo === 'treino' ? `/treinador/treinos/${TREINO_ID}` : `/treinador/dietas/${DIETA_ID}`);
  await expect(page.getByText(o.tipo === 'treino' ? 'Este treino é só deste aluno.' : 'Esta dieta é só deste aluno.', { exact: false })).toBeVisible();
  return api;
}

for (const [tema, rotulo] of [['CLARO', 'claro'], ['ESCURO', 'escuro']] as const) {
  for (const largura of [1280, 390]) {
    test(`${largura}px ${rotulo}: editor de dieta de quem só contratou treino mostra o aviso, sem travar nada`, async ({ page }) => {
      const { errosDaPagina } = await abrirEditor(page, { tipo: 'dieta', largura, tema, planosAtivos: SO_TREINO });
      await expect(page.getByText(AVISO_DIETA)).toBeVisible();
      // Só informação: a dieta continua editável.
      await expect(page.getByRole('button', { name: /Adicionar refeição/ }).first()).toBeEnabled();
      await capturar(page, `editor-dieta-${largura}-${rotulo}`);
      expect(errosDaPagina).toEqual([]);
    });

    test(`${largura}px ${rotulo}: editor de treino de quem só contratou dieta mostra o aviso`, async ({ page }) => {
      const { errosDaPagina } = await abrirEditor(page, { tipo: 'treino', largura, tema, planosAtivos: SO_DIETA });
      await expect(page.getByText(AVISO_TREINO)).toBeVisible();
      await capturar(page, `editor-treino-${largura}-${rotulo}`);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('editor com o item incluído ou sem planosAtivos: nenhum aviso', async ({ page }) => {
  await abrirEditor(page, { tipo: 'dieta', largura: 1280, planosAtivos: TUDO });
  await expect(page.getByText(/não contratou/)).toHaveCount(0);
});

test('editor de treino sem planosAtivos (Financeiro desligado ou sem contratação ativa): nenhum aviso', async ({ page }) => {
  await abrirEditor(page, { tipo: 'treino', largura: 390, planosAtivos: null });
  await expect(page.getByText(/não contratou/)).toHaveCount(0);
});
