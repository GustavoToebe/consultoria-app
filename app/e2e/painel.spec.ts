import { expect, test, type Page } from '@playwright/test';

import type { PaginaInadimplentes } from '../src/api/financeiroTipos';
import type { ResumoDaAgenda } from '../src/api/agendaTipos';
import type { PainelTreinador, RecordesDaSemana } from '../src/api/tipos';
import { fixarHoje } from './aluno';
import { erroApi, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type AparelhoFalso, type RespostasApi } from './api-falsa';
import { PAINEL_COM_DADOS } from './financeiro-falso';

/**
 * Painel novo do Início do treinador (passos 8 e 9, D7 a D9): blocos por permissão, "não carregou" no lugar de zero,
 * financeiro desligado, as três Folhas com "Mostrando N de M", o Editar que persiste, os Primeiros passos (andamento,
 * feitos recolhidos, Já conferi, Agora não, Desfazer, dispensar com confirmação, concluído), o Início sem alunos e o
 * passo novo do passeio. Só dados fictícios; relógio em 19/10/2026.
 */

const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const SEM_REGISTRO = Array.from({ length: 20 }, (_, i) => ({ id: id(100 + i), nome: `Aluno Fictício ${i + 1}`, ultimoRegistro: i === 0 ? null : '2026-10-05' }));
const A_RENOVAR = Array.from({ length: 20 }, (_, i) => ({
  pasta: { id: `p0000000-0000-4000-8000-${String(200 + i).padStart(12, '0')}`, titulo: `Ciclo ${i + 1}` },
  aluno: { id: id(200 + i), nome: `Aluna Fictícia ${i + 1}` }, fim: '2026-10-23',
}));

const PAINEL: PainelTreinador = {
  atualizacoesParaRevisar: 3, atualizacoesAtrasadas: 2, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 5, alunosAtivos: 24,
  alunosSemRegistro: SEM_REGISTRO, ultimasExecucoes: [], planosTerminando: [],
  pastasARenovar: 23, pastasParaRenovar: A_RENOVAR, alunosSemPastaComPeriodo: 2, alunosSemRegistroTotal: 34, alunosSemAcesso: 3,
  alunosInativos: 3, sessoesConcluidas7Dias: 18,
};

const RECORDES: RecordesDaSemana = {
  de: '2026-10-13', ate: '2026-10-19', total: 57,
  series: Array.from({ length: 50 }, (_, i) => ({
    alunoId: id(300 + i), alunoNome: `Atleta Fictício ${i + 1}`, data: '2026-10-18', exercicioId: `x${i}`, exercicioNome: 'Supino de teste',
    recordes: [{ tipo: 'MAIOR_CARGA', carga: 70, repeticoes: 8, valor: 70 }],
  })),
};

const AGENDA: ResumoDaAgenda = { dias: [{ data: '2026-10-19', compromissos: 4, eventos: 1 }, { data: '2026-10-21', compromissos: 5, eventos: 0 }] };
const INADIMPLENTES: PaginaInadimplentes = { itens: [], total: 4, valorTotalCentavos: 124_000, pagina: 0 };
const CONTAGENS = { porSituacao: { NOVA: 4, EM_CONTATO: 4, EM_NEGOCIACAO: 2 }, abertas: 10, todas: 10, retornosAtrasados: 1, retornosHoje: 1 };

const TODAS = [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER', 'REGISTRO_LER', 'TREINO_LER', 'AGENDA_LER', 'FINANCEIRO_LER', 'MODELO_ALTERAR'];

interface Cenario {
  permissoes?: string[];
  painel?: PainelTreinador | ((meus: boolean) => PainelTreinador);
  financeiro?: boolean;
  retorno?: boolean;
  acessoTotal?: boolean;
  aparelho?: AparelhoFalso;
  extra?: RespostasApi;
}

async function abrir(page: Page, c: Cenario = {}) {
  await fixarHoje(page);
  const painel = c.painel ?? PAINEL;
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, {
      permissoes: c.permissoes ?? TODAS,
      pagamentosHabilitados: c.financeiro ?? true,
      retornoHabilitado: c.retorno ?? false,
      perfil: { id: 'p1', nome: c.acessoTotal ? 'Administrador' : 'Treinador', acessoTotal: !!c.acessoTotal },
    }, c.aparelho)),
    'GET /painel': (p, route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(typeof painel === 'function' ? painel(p.busca.get('meus') === 'true') : painel),
    }),
    'GET /inscricoes/contagens': { corpo: CONTAGENS },
    // O ponto do menu em Interessados.
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /recordes/semana': { corpo: RECORDES },
    'GET /agenda/resumo': { corpo: AGENDA },
    'GET /financeiro/painel': { corpo: PAINEL_COM_DADOS },
    'GET /financeiro/inadimplentes': { corpo: INADIMPLENTES },
    'GET /inscricoes/configuracao': { corpo: { aberta: false, codigo: null, link: null, responsavelId: null, texto: null, versao: null } },
    ...c.extra,
  });
  await page.goto('/treinador');
  await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
  return api;
}

const titulosDosBlocos = (page: Page) => page.getByRole('heading', { level: 2 }).allTextContents();

for (const largura of [390, 1280]) {
  test(`painel completo: blocos, números e gráficos (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { naoTratadas, errosDaPagina, pedidos } = await abrir(page, { retorno: true });
    await expect(page.getByRole('link', { name: 'Atualizações para revisar: 3' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Atualizações atrasadas: 2' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Atualizações nos próximos 7 dias: 5' })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Retornos a interessados atrasados ou de hoje: 2/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Interessados em contato ou negociação: 6' })).toBeVisible();
    await expect(page.getByText('Últimos 7 dias · Só os meus alunos', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Alunos sem registro há 7 dias: 34. Abre a lista' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Compromissos nesta semana, de segunda a domingo: 9' })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Cobranças vencidas: R\$\s1\.240,00, 4 cobranças$/ })).toBeVisible();
    await expect(page.getByText('R$', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('img', { name: /^Recebido \(bruto\) e entradas avulsas por mês/ })).toBeVisible();
    await expect(page.getByLabel('Ativos com acesso: 21')).toBeVisible();
    await expect(page.getByLabel('Inativos: 3')).toBeVisible();
    // Só contagens nos blocos: nenhum nome de aluno fora das Folhas.
    await expect(page.getByText('Aluno Fictício 1', { exact: true })).toHaveCount(0);
    // O membro (sem acesso total) começa em "Meus" em todos os blocos.
    expect(pedidos.some((p) => p.caminho === '/inscricoes/contagens' && p.busca.get('meus') === 'true')).toBe(true);
    expect(pedidos.some((p) => p.caminho === '/agenda/resumo' && p.busca.get('responsavel') === TREINADOR.id)).toBe(true);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('Todos/Meus é de cada bloco, fica gravado e o Voltar ao padrão limpa; atualizar recarrega só o bloco', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { pedidos } = await abrir(page);
  const filtro = page.getByRole('button', { name: /^Interessados: mostrando só os meus alunos/ });
  await expect(filtro).toBeVisible();
  await expect(page.getByText('Só os meus alunos')).toHaveCount(8);
  await filtro.click();
  await expect(page.getByRole('button', { name: /^Interessados: mostrando todos os alunos/ })).toBeVisible();
  await expect(page.getByText('Só os meus alunos')).toHaveCount(7);
  await expect.poll(() => pedidos.filter((p) => p.caminho === '/inscricoes/contagens' && p.busca.get('meus') === 'false').length).toBe(1);
  const agendaAntes = pedidos.filter((p) => p.caminho === '/agenda/resumo').length;
  const painelAntes = pedidos.filter((p) => p.caminho === '/painel').length;
  await page.getByRole('button', { name: 'Atualizar Agenda' }).click();
  await expect.poll(() => pedidos.filter((p) => p.caminho === '/agenda/resumo').length).toBe(agendaAntes + 1);
  expect(pedidos.filter((p) => p.caminho === '/painel').length).toBe(painelAntes);

  // A escolha de cada bloco fica gravada: depois de recarregar, Interessados continua em Todos e os outros em Meus.
  await page.reload();
  await expect(page.getByRole('button', { name: /^Interessados: mostrando todos os alunos/ })).toBeVisible();
  await expect(page.getByText('Só os meus alunos')).toHaveCount(7);
  // Voltar ao padrão, no Editar, devolve todos os blocos ao padrão do perfil (Meus, para quem não tem acesso total).
  await page.getByRole('button', { name: 'Editar os blocos do Início' }).click();
  const folha = page.getByRole('dialog', { name: 'Editar o Início' });
  await folha.getByRole('button', { name: 'Voltar ao padrão' }).click();
  await folha.getByRole('button', { name: 'Concluir' }).click();
  await expect(page.getByRole('button', { name: /^Interessados: mostrando só os meus alunos/ })).toBeVisible();
  await expect(page.getByText('Só os meus alunos')).toHaveCount(8);
});

test('consulta que falhou e campo nulo mostram "Não carregou", nunca zero; Atualizar tenta de novo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  let falhar = true;
  const { pedidos } = await abrir(page, {
    painel: { ...PAINEL, pastasARenovar: null, alunosSemPastaComPeriodo: null },
    extra: {
      'GET /agenda/resumo': (_p, route) => route.fulfill(falhar
        ? { status: 500, contentType: 'application/json', body: JSON.stringify(erroApi(500, 'Falha.').corpo) }
        : { contentType: 'application/json', body: JSON.stringify(AGENDA) }),
    },
  });
  await expect(page.getByLabel('Pastas a renovar em 7 dias: não carregou')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Alunos sem pasta com período: não carregou' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Compromissos nesta semana, de segunda a domingo: não carregou' })).toBeVisible();
  falhar = false;
  const antes = pedidos.filter((p) => p.caminho === '/agenda/resumo').length;
  await page.getByRole('button', { name: 'Atualizar Agenda' }).last().click();
  await expect.poll(() => pedidos.filter((p) => p.caminho === '/agenda/resumo').length).toBeGreaterThan(antes);
  await expect(page.getByRole('link', { name: 'Compromissos nesta semana, de segunda a domingo: 9' })).toBeVisible();
});

test('sem permissão: só os blocos do perfil, sem consultas a mais; financeiro desligado não aparece', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { pedidos, naoTratadas, errosDaPagina } = await abrir(page, { permissoes: [...PERMISSOES_TREINADOR, 'FINANCEIRO_LER'], financeiro: false });
  await expect(page.getByRole('heading', { name: 'Interessados', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Alunos', level: 2 })).toBeVisible();
  for (const t of ['Atualizações', 'Treinos', 'Pastas', 'Agenda', 'Financeiro', 'Recebido e lançamentos']) {
    await expect(page.getByRole('heading', { name: t, level: 2, exact: true })).toHaveCount(0);
  }
  expect(pedidos.some((p) => /^\/(financeiro|agenda|recordes)/.test(p.caminho))).toBe(false);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('as três Folhas: "Mostrando N de M" e a linha abre a ficha', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page, { retorno: true, extra: { 'GET /alunos/{id}': erroApi(404, 'Não encontrado.', 'NAO_ENCONTRADO') } });

  await page.getByRole('button', { name: 'Alunos sem registro há 7 dias: 34. Abre a lista' }).click();
  const semRegistro = page.getByRole('dialog', { name: 'Sem registro há 7 dias' });
  await expect(semRegistro.getByText('Mostrando 20 de 34 alunos. · Só os meus alunos')).toBeVisible();
  await expect(semRegistro.getByRole('link', { name: /^Aluno Fictício 1, nunca registrou/ })).toBeVisible();
  await semRegistro.getByRole('button', { name: 'Fechar' }).click();

  await page.getByRole('button', { name: 'Pastas a renovar em 7 dias: 23. Abre a lista' }).click();
  const pastas = page.getByRole('dialog', { name: 'A renovar em 7 dias' });
  await expect(pastas.getByText(/^Mostrando 20 de 23 pastas\./)).toBeVisible();
  await pastas.getByRole('button', { name: 'Fechar' }).click();

  await page.getByRole('button', { name: 'Recordes nos últimos 7 dias: 57. Abre a lista' }).click();
  const recordes = page.getByRole('dialog', { name: 'Recordes dos últimos 7 dias' });
  await expect(recordes.getByText(/^Mostrando 50 de 57 séries com recorde\./)).toBeVisible();
  await recordes.getByRole('link', { name: /^Atleta Fictício 1, Supino de teste/ }).click();
  await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${id(300)}$`));
});

test('Editar: esconder e ordenar os blocos, e continua depois de recarregar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page);
  await expect(page.getByRole('heading', { name: 'Agenda', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Editar os blocos do Início' }).click();
  const folha = page.getByRole('dialog', { name: 'Editar o Início' });
  await folha.getByRole('switch', { name: 'Agenda' }).click();
  await expect(folha.getByRole('button', { name: 'Subir Atualizações (posição 1 de 8)' })).toBeDisabled();
  await folha.getByRole('button', { name: 'Subir Alunos (posição 8 de 8)' }).click();
  await folha.getByRole('button', { name: 'Concluir' }).click();
  await expect(page.getByRole('heading', { name: 'Agenda', level: 2 })).toHaveCount(0);
  const ordem = ['Atualizações', 'Interessados', 'Treinos', 'Pastas', 'Financeiro', 'Alunos', 'Recebido e lançamentos'];
  expect(await titulosDosBlocos(page)).toEqual(ordem);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Atualizações', level: 2 })).toBeVisible();
  expect(await titulosDosBlocos(page)).toEqual(ordem);

  // Cancelar descarta e Voltar ao padrão desfaz.
  await page.getByRole('button', { name: 'Editar os blocos do Início' }).click();
  await folha.getByRole('button', { name: 'Voltar ao padrão' }).click();
  await folha.getByRole('button', { name: 'Cancelar' }).click();
  expect(await titulosDosBlocos(page)).toEqual(ordem);
  await page.getByRole('button', { name: 'Editar os blocos do Início' }).click();
  await folha.getByRole('button', { name: 'Voltar ao padrão' }).click();
  await folha.getByRole('button', { name: 'Concluir' }).click();
  await expect(page.getByRole('heading', { name: 'Agenda', level: 2 })).toBeVisible();
});

const SEM_PASSOS: AparelhoFalso = { primeirosPassos: null };
const PAINEL_COM_ACESSO: PainelTreinador = { ...PAINEL, alunosAtivos: 2, alunosSemAcesso: 0, alunosInativos: 0 };

for (const largura of [390, 1280]) {
  test(`primeiros passos: andamento, feitos recolhidos, Já conferi, Agora não, Desfazer e concluído (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrir(page, { aparelho: SEM_PASSOS, painel: PAINEL_COM_ACESSO });
    const bloco = page.getByRole('heading', { name: 'Primeiros passos', level: 2 });
    await expect(bloco).toBeVisible();
    await expect(page.getByLabel('Primeiros passos: 2 de 5 feitos ou deixados para depois')).toBeVisible();
    // Aberto, os Primeiros passos tomam o lugar do Próximo passo.
    await expect(page.getByText('Próximo passo', { exact: true })).toHaveCount(0);
    const feitos = page.getByRole('button', { name: '2 feitos. Mostrar' });
    await expect(feitos).toBeVisible();
    await feitos.click();
    await expect(page.getByRole('heading', { name: 'Cadastrar o primeiro aluno', level: 3 })).toBeVisible();
    await page.getByRole('button', { name: '2 feitos. Esconder' }).click();

    await page.getByRole('button', { name: 'Já conferi: Conferir a metodologia' }).click();
    await expect(page.getByLabel('Primeiros passos: 3 de 5 feitos ou deixados para depois')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Primeiros passos: 3 de 5 feitos ou deixados para depois')).toBeVisible();

    await page.getByRole('button', { name: 'Já conferi: Conferir os modelos de treino' }).click();
    await page.getByRole('button', { name: 'Agora não: Ligar o link de inscrição' }).click();
    // Tudo resolvido: a linha "Concluídos".
    await expect(page.getByText('5 de 5 · também na Ajuda')).toBeVisible();
    await expect(page.getByText('Concluídos', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Ver os primeiros passos' }).click();
    await page.getByRole('button', { name: 'Desfazer: Ligar o link de inscrição' }).click();
    await expect(page.getByLabel('Primeiros passos: 4 de 5 feitos ou deixados para depois')).toBeVisible();
    await page.getByRole('button', { name: 'Agora não: Ligar o link de inscrição' }).click();

    // O X tira do Início sem confirmação e o Próximo passo volta.
    await page.getByRole('button', { name: 'Tirar os primeiros passos do Início' }).click();
    await expect(page.getByText('5 de 5 · também na Ajuda')).toHaveCount(0);
    await expect(page.getByText('Próximo passo', { exact: true })).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });
}

test('dispensar pede confirmação, e a Ajuda traz os primeiros passos de volta', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page, { aparelho: SEM_PASSOS, painel: PAINEL_COM_ACESSO });
  await expect(page.getByRole('heading', { name: 'Primeiros passos', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Dispensar os primeiros passos' }).click();
  await expect(page.getByText('Dispensar os primeiros passos?')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar com eles' }).click();
  await expect(page.getByRole('heading', { name: 'Primeiros passos', level: 2 })).toBeVisible();

  await page.getByRole('button', { name: 'Dispensar os primeiros passos' }).click();
  await page.getByRole('button', { name: 'Dispensar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Primeiros passos', level: 2 })).toHaveCount(0);
  await expect(page.getByText('Primeiros passos dispensados. Eles continuam na Ajuda.')).toBeVisible();
  await expect(page.getByText('Próximo passo', { exact: true })).toBeVisible();

  // Pelo menu (sem recarregar): o Início continua montado e tem de ver a escolha feita na Ajuda.
  await page.getByRole('link', { name: 'Ajuda' }).first().click();
  await page.getByRole('button', { name: 'Mostrar no Início de novo' }).click();
  await expect(page.getByText('Os primeiros passos voltaram ao Início.')).toBeVisible();
  await page.getByRole('link', { name: 'Início' }).first().click();
  await expect(page.getByRole('heading', { name: 'Primeiros passos', level: 2 })).toBeVisible();
});

test('Início sem alunos: só a frase, sem contadores, com os Primeiros passos e o Editar desligado com o motivo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const vazio: PainelTreinador = { ...PAINEL, alunosAtivos: 0, alunosInativos: 0, alunosSemAcesso: 0, alunosSemRegistro: [], alunosSemRegistroTotal: 0, pastasARenovar: 0, pastasParaRenovar: [] };
  await abrir(page, { aparelho: SEM_PASSOS, painel: vazio });
  await expect(page.getByText('Os números da consultoria (atualizações, treinos, pastas e o resto) aparecem aqui quando houver alunos.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Atualizações', level: 2 })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Primeiros passos', level: 2 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir Alunos' })).toBeDisabled();
  await expect(page.getByText('Cadastre um aluno primeiro.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar os blocos do Início' })).toBeDisabled();
  await expect(page.getByText('O painel aparece quando houver alunos.')).toBeVisible();
});

test('Início sem alunos e sem os Primeiros passos: o Próximo passo pede o primeiro aluno', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const vazio: PainelTreinador = { ...PAINEL, alunosAtivos: 0, alunosInativos: 0, alunosSemAcesso: 0 };
  await abrir(page, { painel: vazio });
  await expect(page.getByText('Nenhum aluno ainda. Cadastre o primeiro para começar.')).toBeVisible();
  await page.getByRole('button', { name: 'Cadastrar aluno' }).click();
  await expect(page).toHaveURL(/\/treinador\/alunos\/novo$/);
});

test('o passeio termina apontando os Primeiros passos do Início', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page, { aparelho: { primeirosPassos: null, passeioVisto: false }, painel: PAINEL_COM_ACESSO });
  const passeio = page.getByRole('dialog');
  await expect(passeio.getByText('Boas-vindas')).toBeVisible();
  for (let i = 0; i < 20; i++) {
    if (await passeio.getByText('Este bloco do Início mostra o que falta', { exact: false }).isVisible()) break;
    await passeio.getByRole('button', { name: 'Próximo' }).click();
  }
  await expect(passeio.getByText('Este bloco do Início mostra o que falta', { exact: false })).toBeVisible();
  await expect(passeio.getByRole('button', { name: 'Começar' })).toBeVisible();
});
