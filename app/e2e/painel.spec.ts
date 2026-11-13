import { expect, test, type Page } from '@playwright/test';

import type { PaginaInadimplentes } from '../src/api/financeiroTipos';
import type { ResumoDaAgenda } from '../src/api/agendaTipos';
import type { PainelTreinador, RecordesDaSemana } from '../src/api/tipos';
import { fixarHoje } from './aluno';
import { erroApi, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type AparelhoFalso, type RespostasApi } from './api-falsa';
import { PAINEL_COM_DADOS } from './financeiro-falso';
import { esperarValorInteiro } from './valor-inteiro';

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
    // C9: o texto "Alunos" no meio da rosca tem 12 px (o piso de texto do app), não mais 11.
    await expect(page.locator('svg text', { hasText: /^Alunos$/ })).toHaveCSS('font-size', '12px');
    // C2: os três ícones de cada bloco (abrir, atualizar, filtro) têm 44×44 de alvo; o filtro em "Meus" tem a moldura de 40.
    const icones = page.getByRole('button', { name: /^(Abrir |Atualizar |Filtro de )/ });
    expect(await icones.count()).toBeGreaterThanOrEqual(3);
    for (const caixa of await icones.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.width, r.height]))) {
      expect(Math.min(...caixa)).toBeGreaterThanOrEqual(43.5);
    }
    const filtroMeus = page.getByRole('button', { name: /^Filtro de .*: mostrando só os meus alunos/ }).first();
    expect((await filtroMeus.locator(':scope > div').first().boundingBox())!.width).toBeCloseTo(40, 0);
    // Só contagens nos blocos: nenhum nome de aluno fora das Folhas.
    await expect(page.getByText('Aluno Fictício 1', { exact: true })).toHaveCount(0);
    // O membro (sem acesso total) começa em "Meus" em todos os blocos.
    expect(pedidos.some((p) => p.caminho === '/inscricoes/contagens' && p.busca.get('meus') === 'true')).toBe(true);
    expect(pedidos.some((p) => p.caminho === '/agenda/resumo' && p.busca.get('responsavel') === TREINADOR.id)).toBe(true);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

/**
 * Como os blocos ficaram na tela: rolagem horizontal, cabeçalhos (título e ícones na mesma linha, sem se cobrirem) e
 * quantos blocos cabem na primeira linha.
 */
async function medirOPainel(page: Page) {
  return page.evaluate(() => {
    const caixa = (e: Element) => e.getBoundingClientRect();
    const blocos = [...document.querySelectorAll('[role="heading"][aria-level="2"]')].flatMap((h) => {
      const titulo = h.textContent ?? '';
      const abrir = document.querySelector(`[role="button"][aria-label="Abrir ${titulo}"]`);
      const atualizar = document.querySelector(`[role="button"][aria-label="Atualizar ${titulo}"]`);
      return abrir && atualizar ? [{ titulo, h: caixa(h), abrir: caixa(abrir), atualizar: caixa(atualizar) }] : [];
    });
    const topo = Math.min(...blocos.map((b) => b.h.top));
    return {
      rolagem: document.documentElement.scrollWidth - window.innerWidth,
      naPrimeiraLinha: blocos.filter((b) => Math.abs(b.h.top - topo) < 4).length,
      foraDaTela: blocos.filter((b) => b.h.left < 0 || b.atualizar.right > window.innerWidth + 0.5).map((b) => b.titulo),
      iconesSeparados: blocos.filter((b) => Math.abs(b.abrir.top - b.atualizar.top) > 1).map((b) => b.titulo),
      iconesAbaixoDoTitulo: blocos.filter((b) => b.abrir.top >= b.h.bottom).map((b) => b.titulo),
      tituloCobreIcone: blocos.filter((b) => b.abrir.top < b.h.bottom && b.h.right > b.abrir.left + 0.5).map((b) => b.titulo),
      total: blocos.length,
    };
  });
}

// F01 de 12/11: a grade perde coluna antes de espremer o cabeçalho, contando o menu aberto ou recolhido.
for (const [largura, recolhido, colunas] of [[390, false, 1], [1280, false, 3], [1280, true, 3], [1440, false, 3], [1440, true, 4], [1920, false, 4]] as const) {
  test(`grade do Início em ${largura}px, menu ${recolhido ? 'recolhido' : 'aberto'}: ${colunas} por linha, sem rolagem lateral, título e ícones na mesma linha`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    if (recolhido) await page.addInitScript(() => localStorage.setItem('menu-lateral-recolhido', '1'));
    const { naoTratadas, errosDaPagina } = await abrir(page, { retorno: true });
    await expect(page.getByRole('link', { name: 'Atualizações para revisar: 3' })).toBeVisible();
    await expect(page.getByRole('img', { name: /^Recebido \(bruto\)/ })).toBeVisible();
    const m = await medirOPainel(page);
    expect(m.total).toBeGreaterThanOrEqual(8);
    expect(m.rolagem).toBeLessThanOrEqual(0);
    expect(m.naPrimeiraLinha).toBe(colunas);
    expect(m.foraDaTela).toEqual([]);
    expect(m.iconesSeparados).toEqual([]);
    expect(m.tituloCobreIcone).toEqual([]);
    // No PC, cada bloco tem largura para o título e os três ícones numa linha; no celular os ícones podem descer juntos.
    if (colunas > 1) expect(m.iconesAbaixoDoTitulo).toEqual([]);
    if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/inicio-${largura}${recolhido ? '-recolhido' : ''}.png` });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('grade do Início com o texto extra grande em 1280px: menos colunas, cabeçalho inteiro e sem rolagem lateral', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tamanhoTexto: 'EXTRA' })), TREINADOR.id);
  await abrir(page, { retorno: true });
  await expect(page.getByRole('link', { name: 'Atualizações para revisar: 3' })).toBeVisible();
  const m = await medirOPainel(page);
  expect(m.rolagem).toBeLessThanOrEqual(0);
  expect(m.naPrimeiraLinha).toBe(2);
  expect(m.foraDaTela).toEqual([]);
  expect(m.iconesSeparados).toEqual([]);
  expect(m.iconesAbaixoDoTitulo).toEqual([]);
  expect(m.tituloCobreIcone).toEqual([]);
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/inicio-1280-texto-extra.png` });
});

test('Todos/Meus é de cada bloco, fica gravado e o Restaurar padrão limpa; atualizar recarrega só o bloco', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { pedidos } = await abrir(page);
  const filtro = page.getByRole('button', { name: /^Filtro de Interessados: mostrando só os meus alunos/ });
  await expect(filtro).toBeVisible();
  await expect(page.getByText('Só os meus alunos')).toHaveCount(8);
  await filtro.click();
  await expect(page.getByRole('button', { name: /^Filtro de Interessados: mostrando todos os alunos/ })).toBeVisible();
  await expect(page.getByText('Só os meus alunos')).toHaveCount(7);
  await expect.poll(() => pedidos.filter((p) => p.caminho === '/inscricoes/contagens' && p.busca.get('meus') === 'false').length).toBe(1);
  const agendaAntes = pedidos.filter((p) => p.caminho === '/agenda/resumo').length;
  const painelAntes = pedidos.filter((p) => p.caminho === '/painel').length;
  await page.getByRole('button', { name: 'Atualizar Agenda' }).click();
  await expect.poll(() => pedidos.filter((p) => p.caminho === '/agenda/resumo').length).toBe(agendaAntes + 1);
  expect(pedidos.filter((p) => p.caminho === '/painel').length).toBe(painelAntes);

  // A escolha de cada bloco fica gravada: depois de recarregar, Interessados continua em Todos e os outros em Meus.
  await page.reload();
  await expect(page.getByRole('button', { name: /^Filtro de Interessados: mostrando todos os alunos/ })).toBeVisible();
  await expect(page.getByText('Só os meus alunos')).toHaveCount(7);
  // Restaurar padrão, no Editar, devolve todos os blocos ao padrão do perfil (Meus, para quem não tem acesso total).
  await page.getByRole('button', { name: 'Editar os blocos do Início' }).click();
  await page.getByRole('button', { name: 'Restaurar padrão' }).click();
  await page.getByRole('button', { name: 'Salvar o Início' }).click();
  await expect(page.getByRole('button', { name: /^Filtro de Interessados: mostrando só os meus alunos/ })).toBeVisible();
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
  await expect(page).toHaveURL(new RegExp(`/treinador/alunos/${id(300)}\\?aba=acompanhamento$`));
});

/**
 * Início editável (frente B, `docs/planos/inicio-editavel.md`): edição em rascunho na própria grade, com Salvar, Cancelar e
 * Restaurar padrão; ocultar pela chave e mostrar pela bandeja "Blocos ocultos"; Subir/Descer e o tamanho (Pequeno, Médio,
 * Grande) também pelo teclado; tudo só neste aparelho.
 */
const botaoEditar = (page: Page) => page.getByRole('button', { name: 'Editar os blocos do Início' });
const botaoSalvar = (page: Page) => page.getByRole('button', { name: 'Salvar o Início' });
const botaoCancelar = (page: Page) => page.getByRole('button', { name: 'Cancelar a edição do Início' });
const tamanho = (page: Page, titulo: string, rotulo: string) => page.getByLabel(`Tamanho de ${titulo}`, { exact: true }).getByRole('radio', { name: rotulo, exact: true });
const CHAVE_PREFERENCIAS = `treinos:${TREINADOR.id}:preferencias`;

/** Preferência inicial do aparelho; só grava se ainda não há nenhuma, para o recarregar não apagar o que a tela salvou. */
async function preferir(page: Page, pref: object) {
  await page.addInitScript(([chave, valor]) => { if (!localStorage.getItem(chave)) localStorage.setItem(chave, valor); }, [CHAVE_PREFERENCIAS, JSON.stringify(pref)] as const);
}
const preferenciaGravada = (page: Page) => page.evaluate((chave) => JSON.parse(localStorage.getItem(chave) ?? '{}').painelDoInicio, CHAVE_PREFERENCIAS);

/** Largura de um bloco na grade (do título ao último ícone do cabeçalho). */
const larguraDoBloco = (page: Page, titulo: string) => page.evaluate((t) => {
  const h = [...document.querySelectorAll('[role="heading"][aria-level="2"]')].find((e) => e.textContent === t)!;
  const atualizar = document.querySelector(`[role="button"][aria-label="Atualizar ${t}"]`)!;
  return atualizar.getBoundingClientRect().right - h.getBoundingClientRect().left;
}, titulo);

test('Editar: ocultar e ordenar na grade, Salvar grava e continua depois de recarregar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errosDaPagina } = await abrir(page);
  await expect(page.getByRole('heading', { name: 'Agenda', level: 2 })).toBeVisible();
  await botaoEditar(page).click();
  await expect(page.getByText('Nenhuma alteração ainda.')).toBeVisible();
  // Em edição, o bloco não mostra dado nem ação dele: só a faixa, o tamanho, Subir/Descer e a chave.
  await expect(page.getByRole('button', { name: 'Atualizar Agenda' })).toHaveCount(0);
  await page.getByRole('switch', { name: 'Agenda aparece no Início' }).click();
  await expect(page.getByText('Agenda saiu do Início. Está em Blocos ocultos.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adicionar Agenda ao Início' })).toBeVisible();
  // A posição conta só os blocos que aparecem.
  await expect(page.getByRole('button', { name: 'Subir Atualizações (posição 1 de 7)' })).toBeDisabled();
  await page.getByRole('button', { name: 'Subir Alunos (posição 7 de 7)' }).click();
  await expect(page.getByText('Alunos: posição 6 de 7.')).toBeVisible();
  await botaoSalvar(page).click();
  await expect(botaoSalvar(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Agenda', level: 2 })).toHaveCount(0);
  const ordem = ['Atualizações', 'Interessados', 'Treinos', 'Pastas', 'Financeiro', 'Alunos', 'Recebido e lançamentos'];
  expect(await titulosDosBlocos(page)).toEqual(ordem);
  expect((await preferenciaGravada(page)).escondidos).toEqual(['agenda']);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Atualizações', level: 2 })).toBeVisible();
  expect(await titulosDosBlocos(page)).toEqual(ordem);
  expect(errosDaPagina).toEqual([]);
});

test('Editar: Cancelar descarta tudo e o Restaurar padrão só vale ao salvar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await preferir(page, { painelDoInicio: { ordem: [], escondidos: ['agenda'], meus: {}, tamanhos: { alunos: 3 } } });
  await abrir(page);
  await expect(page.getByRole('heading', { name: 'Atualizações', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Agenda', level: 2 })).toHaveCount(0);

  await botaoEditar(page).click();
  await page.getByRole('button', { name: 'Restaurar padrão' }).click();
  await expect(page.getByText(/^Padrão restaurado/)).toBeVisible();
  await expect(page.getByText('Alterações ainda não salvas.')).toHaveCount(0);
  await expect(page.getByRole('switch', { name: 'Agenda aparece no Início' })).toBeVisible();
  await expect(tamanho(page, 'Alunos', 'Pequeno')).toHaveAttribute('aria-checked', 'true');
  await botaoCancelar(page).click();
  await expect(page.getByRole('heading', { name: 'Agenda', level: 2 })).toHaveCount(0);
  expect(await preferenciaGravada(page)).toEqual({ ordem: expect.any(Array), escondidos: ['agenda'], meus: {}, tamanhos: { alunos: 3 } });

  await botaoEditar(page).click();
  await page.getByRole('button', { name: 'Restaurar padrão' }).click();
  await botaoSalvar(page).click();
  await expect(page.getByRole('heading', { name: 'Agenda', level: 2 })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Agenda', level: 2 })).toBeVisible();
  expect(await preferenciaGravada(page)).toMatchObject({ escondidos: [], meus: {}, tamanhos: {} });
});

test('Editar: o tamanho muda a largura do bloco na grade e fica gravado', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page);
  await expect(page.getByRole('heading', { name: 'Alunos', level: 2 })).toBeVisible();
  const umaColuna = await larguraDoBloco(page, 'Pastas');
  await botaoEditar(page).click();
  await tamanho(page, 'Alunos', 'Grande').click();
  await expect(page.getByText('Alunos: Grande.')).toBeVisible();
  await expect(tamanho(page, 'Alunos', 'Grande')).toHaveAttribute('aria-checked', 'true');
  await botaoSalvar(page).click();
  await expect(page.getByRole('button', { name: 'Atualizar Alunos' })).toBeVisible();
  // Grande = as 3 colunas da grade em 1280.
  expect(await larguraDoBloco(page, 'Alunos')).toBeGreaterThan(umaColuna * 2.5);
  expect(await preferenciaGravada(page)).toMatchObject({ tamanhos: { alunos: 3 } });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Atualizar Alunos' })).toBeVisible();
  expect(await larguraDoBloco(page, 'Alunos')).toBeGreaterThan(umaColuna * 2.5);
});

test('preferência gravada antes dos tamanhos: ordem e ocultos continuam e os tamanhos são os de fábrica', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await preferir(page, { painelDoInicio: { ordem: ['alunos', 'atualizacoes', 'interessados', 'treinos', 'pastas', 'agenda', 'financeiro', 'recebido'], escondidos: ['treinos'], meus: {} } });
  const { errosDaPagina } = await abrir(page);
  await expect(page.getByRole('heading', { name: 'Alunos', level: 2 })).toBeVisible();
  expect(await titulosDosBlocos(page)).toEqual(['Alunos', 'Atualizações', 'Interessados', 'Pastas', 'Agenda', 'Financeiro', 'Recebido e lançamentos']);
  await botaoEditar(page).click();
  await expect(tamanho(page, 'Agenda', 'Médio')).toHaveAttribute('aria-checked', 'true');
  await expect(tamanho(page, 'Recebido e lançamentos', 'Grande')).toHaveAttribute('aria-checked', 'true');
  await expect(tamanho(page, 'Alunos', 'Pequeno')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: 'Adicionar Treinos ao Início' })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('Editar só pelo teclado: cada ação devolve o foco a um lugar certo e é anunciada', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page);
  await expect(page.getByRole('heading', { name: 'Atualizações', level: 2 })).toBeVisible();
  await botaoEditar(page).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Restaurar padrão' })).toBeFocused();

  await page.getByRole('button', { name: 'Descer Atualizações (posição 1 de 8)' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Atualizações: posição 2 de 8.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Descer Atualizações (posição 2 de 8)' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Descer Atualizações (posição 3 de 8)' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Subir Atualizações (posição 3 de 8)' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Atualizações: posição 2 de 8.')).toBeVisible();

  await page.getByRole('switch', { name: 'Interessados aparece no Início' }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByText('Interessados saiu do Início. Está em Blocos ocultos.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adicionar Interessados ao Início' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Interessados voltou ao Início.')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Interessados aparece no Início' })).toBeFocused();

  await tamanho(page, 'Treinos', 'Médio').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Treinos: Médio.')).toBeVisible();
  await expect(tamanho(page, 'Treinos', 'Médio')).toHaveAttribute('aria-checked', 'true');

  await botaoSalvar(page).focus();
  await page.keyboard.press('Enter');
  await expect(botaoEditar(page)).toBeFocused();
  expect(await titulosDosBlocos(page)).toEqual(['Interessados', 'Atualizações', 'Treinos', 'Pastas', 'Agenda', 'Financeiro', 'Recebido e lançamentos', 'Alunos']);
  expect(await preferenciaGravada(page)).toMatchObject({ tamanhos: { treinos: 2 } });
});

test('bloco oculto não busca dados, nem durante a edição; mostrado e salvo, busca', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await preferir(page, { painelDoInicio: { ordem: [], escondidos: ['agenda'], meus: {} } });
  const { pedidos } = await abrir(page);
  await expect(page.getByRole('heading', { name: 'Atualizações', level: 2 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Atualizações para revisar: 3' })).toBeVisible();
  const daAgenda = () => pedidos.filter((p) => p.caminho === '/agenda/resumo').length;
  expect(daAgenda()).toBe(0);
  await botaoEditar(page).click();
  await page.getByRole('button', { name: 'Adicionar Agenda ao Início' }).click();
  await expect(page.getByRole('switch', { name: 'Agenda aparece no Início' })).toBeVisible();
  expect(daAgenda()).toBe(0);
  await botaoSalvar(page).click();
  await expect.poll(daAgenda).toBeGreaterThan(0);
  await expect(page.getByRole('link', { name: 'Compromissos nesta semana, de segunda a domingo: 9' })).toBeVisible();
});

test('Editar sem permissão: o bloco que o perfil não vê não aparece nem na grade em edição nem na bandeja', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await preferir(page, { painelDoInicio: { ordem: [], escondidos: ['agenda'], meus: {} } });
  const { pedidos } = await abrir(page, { permissoes: [...PERMISSOES_TREINADOR, 'FINANCEIRO_LER'], financeiro: false });
  await expect(page.getByRole('heading', { name: 'Interessados', level: 2 })).toBeVisible();
  await botaoEditar(page).click();
  await expect(page.getByRole('button', { name: 'Descer Interessados (posição 1 de 2)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Subir Alunos (posição 2 de 2)' })).toBeVisible();
  for (const t of ['Agenda', 'Financeiro', 'Treinos', 'Atualizações']) {
    await expect(page.getByRole('switch', { name: `${t} aparece no Início` })).toHaveCount(0);
    await expect(page.getByRole('button', { name: `Adicionar ${t} ao Início` })).toHaveCount(0);
  }
  await expect(page.getByText('Nenhum bloco oculto.')).toBeVisible();
  expect(pedidos.some((p) => /^\/(financeiro|agenda|recordes)/.test(p.caminho))).toBe(false);
});

test('Editar com tudo oculto: a grade diz onde adicionar e o Início salvo vazio aponta o Editar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page);
  await expect(page.getByRole('heading', { name: 'Atualizações', level: 2 })).toBeVisible();
  await botaoEditar(page).click();
  for (const t of ['Atualizações', 'Interessados', 'Treinos', 'Pastas', 'Agenda', 'Financeiro', 'Recebido e lançamentos', 'Alunos']) {
    await page.getByRole('switch', { name: `${t} aparece no Início` }).click();
  }
  await expect(page.getByText('Nenhum bloco aparece no Início. Adicione um em Blocos ocultos.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Adicionar .* ao Início$/ })).toHaveCount(8);
  await botaoSalvar(page).click();
  await expect(page.getByText('Nenhum bloco ligado. Use "Editar" para escolher o que aparece aqui.')).toBeVisible();
  await expect(botaoEditar(page)).toBeEnabled();
});

test('sem internet ao abrir: o Editar fica desligado com o motivo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page);
  await expect(botaoEditar(page)).toBeEnabled();
  // Com o perfil já salvo no aparelho, a renovação da sessão sem rede abre o app no modo sem internet.
  await page.route('**/auth/refresh', (route) => route.abort('internetdisconnected'));
  await page.reload();
  await expect(page.getByText('Sem internet.', { exact: true })).toBeVisible();
  await expect(botaoEditar(page)).toBeDisabled();
  await expect(page.getByText('Precisa de internet.')).toBeVisible();
});

test('no celular (390px) a edição não trava a rolagem: sem arrastar, Subir/Descer e sem rolagem lateral', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await abrir(page);
  await expect(page.getByRole('heading', { name: 'Atualizações', level: 2 })).toBeVisible();
  await botaoEditar(page).click();
  await expect(page.getByText(/^Use Subir e Descer para mudar a ordem\./)).toBeVisible();
  const medida = await page.evaluate(() => ({
    rolagem: document.documentElement.scrollWidth - window.innerWidth,
    semToque: [...document.querySelectorAll('*')].filter((e) => getComputedStyle(e).touchAction === 'none').length,
  }));
  expect(medida.rolagem).toBeLessThanOrEqual(0);
  expect(medida.semToque).toBe(0);
  // Salvar e Cancelar empilhados abaixo de 768 px, o principal em cima (`RodapeDeAcoes empilhar`).
  const s = (await botaoSalvar(page).boundingBox())!;
  const c = (await botaoCancelar(page).boundingBox())!;
  expect(s.y).toBeLessThan(c.y);
  expect(Math.min(s.height, c.height)).toBeGreaterThanOrEqual(43.5);
});

// Capturas do Início normal e em edição (com um bloco na bandeja), claro e escuro, de 390 a 1920, e com o texto extra grande.
const CAPTURAS_DA_EDICAO: [number, 'CLARO' | 'ESCURO' | 'AREIA', 'PADRAO' | 'EXTRA' | 'ALTO'][] = [
  [1280, 'CLARO', 'PADRAO'], [1280, 'ESCURO', 'PADRAO'], [390, 'CLARO', 'PADRAO'], [390, 'ESCURO', 'PADRAO'],
  [768, 'CLARO', 'PADRAO'], [1920, 'CLARO', 'PADRAO'], [1280, 'CLARO', 'EXTRA'], [390, 'ESCURO', 'EXTRA'],
  [1280, 'AREIA', 'PADRAO'], [1280, 'ESCURO', 'ALTO'], [390, 'CLARO', 'ALTO'],
];
for (const [largura, tema, texto] of CAPTURAS_DA_EDICAO) {
  test(`Início em edição em ${largura}px, tema ${tema.toLowerCase()}, ${texto === 'ALTO' ? 'contraste alto' : `texto ${texto.toLowerCase()}`}: sem rolagem lateral, bandeja visível (capturas)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const aparencia = texto === 'ALTO' ? { contraste: 'ALTO' } : { tamanhoTexto: texto };
    await preferir(page, { tema, ...aparencia, painelDoInicio: { ordem: [], escondidos: ['agenda'], meus: {} } });
    const { errosDaPagina } = await abrir(page);
    await expect(page.getByRole('link', { name: 'Atualizações para revisar: 3' })).toBeVisible();
    const sufixo = texto === 'EXTRA' ? '-texto-extra' : texto === 'ALTO' ? '-contraste-alto' : '';
    const nome = `${process.env.CAPTURAS}/inicio-editavel-${largura}-${tema.toLowerCase()}${sufixo}`;
    if (process.env.CAPTURAS) await page.screenshot({ path: `${nome}-normal.png` });
    await botaoEditar(page).click();
    await expect(page.getByRole('button', { name: 'Restaurar padrão' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    if (process.env.CAPTURAS) await page.screenshot({ path: `${nome}-edicao.png` });
    await page.getByRole('switch', { name: 'Pastas aparece no Início' }).click();
    const bandeja = page.getByRole('button', { name: 'Adicionar Agenda ao Início' });
    await bandeja.scrollIntoViewIfNeeded();
    await expect(bandeja).toBeInViewport();
    // A barra fixa não cobre o botão da bandeja (WCAG 2.4.11).
    const b = (await bandeja.boundingBox())!;
    const barra = (await botaoCancelar(page).boundingBox())!;
    expect(b.y + b.height).toBeLessThanOrEqual(Math.min(barra.y, (await botaoSalvar(page).boundingBox())!.y) + 0.5);
    if (process.env.CAPTURAS) await page.screenshot({ path: `${nome}-bandeja.png` });
    expect(errosDaPagina).toEqual([]);
  });
}

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

test('primeiros passos: "Abrir Metodologias" abre o Planejamento já no chip Metodologias', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errosDaPagina } = await abrir(page, {
    aparelho: SEM_PASSOS, painel: PAINEL_COM_ACESSO, permissoes: [...TODAS, 'MODELO_LER'],
    extra: { 'GET /receitas': { corpo: [] }, 'GET /receitas/pastas': { corpo: [] } },
  });
  await page.getByRole('button', { name: /^Abrir Metodologias/ }).click();
  await expect(page).toHaveURL(/\/treinador\/planejamento\?aba=treino&tipo=metodologia$/);
  await expect(page.getByRole('heading', { name: 'Metodologias', exact: true })).toBeVisible();
  // O chip do tipo também fica marcado (não só o título do cartão). A `Escolha` sai como `radio` com `aria-checked` na web (WCAG 4.1.2).
  const chips = page.getByLabel('Modelos de treino', { exact: true });
  await expect(chips.getByRole('radio', { name: 'Metodologias', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(chips.getByRole('radio', { name: 'Semanas de treino', exact: true })).toHaveAttribute('aria-checked', 'false');
  expect(errosDaPagina).toEqual([]);
});

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
  const { pedidos } = await abrir(page, { painel: vazio });
  await expect(page.getByText('Nenhum aluno ainda. Cadastre o primeiro para começar.')).toBeVisible();
  await page.getByRole('button', { name: 'Cadastrar aluno' }).click();
  await expect(page).toHaveURL(/\/treinador\/alunos\/novo$/);

  // Volta ao Início: o painel recarrega, mas os blocos (que não aparecem sem alunos) não buscam nada.
  const dosBlocos = () => pedidos.filter((p) => /^\/(agenda|recordes|financeiro|cobrancas)/.test(p.caminho)).length;
  const blocosAntes = dosBlocos();
  const painelAntes = pedidos.filter((p) => p.caminho === '/painel').length;
  await page.goBack();
  await expect(page.getByText('Nenhum aluno ainda. Cadastre o primeiro para começar.')).toBeVisible();
  await expect.poll(() => pedidos.filter((p) => p.caminho === '/painel').length).toBeGreaterThan(painelAntes);
  expect(dosBlocos()).toBe(blocosAntes);
});

test('Início sem alunos: cadastrou o primeiro e voltou, os blocos voltam depois da resposta do painel', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const vazio: PainelTreinador = { ...PAINEL, alunosAtivos: 0, alunosInativos: 0, alunosSemAcesso: 0 };
  let comAlunos = false;
  const { pedidos } = await abrir(page, { painel: () => (comAlunos ? PAINEL : vazio) });
  await expect(page.getByText('Nenhum aluno ainda. Cadastre o primeiro para começar.')).toBeVisible();
  await page.getByRole('button', { name: 'Cadastrar aluno' }).click();
  await expect(page).toHaveURL(/\/treinador\/alunos\/novo$/);
  comAlunos = true;
  const agendaAntes = pedidos.filter((p) => p.caminho === '/agenda/resumo').length;
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Agenda', level: 2 })).toBeVisible();
  await expect.poll(() => pedidos.filter((p) => p.caminho === '/agenda/resumo').length).toBeGreaterThan(agendaAntes);
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

// Gustavo, 13/11: R$ 10.000 e R$ 100.000 inteiros nos mini-cartões do Financeiro no Início (em pé e o largo), com o "R$"
// pequeno na mesma linha do número, no celular e no PC; também com o texto extra grande (o caso mais apertado).
for (const extra of [false, true]) test(`valores grandes cabem inteiros nos cartões do financeiro, em 390 e 1280${extra ? ', texto extra grande' : ''}`, async ({ page }) => {
  if (extra) await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tamanhoTexto: 'EXTRA' })), TREINADOR.id);
  await abrir(page, {
    extra: {
      'GET /financeiro/painel': { corpo: {
        ...PAINEL_COM_DADOS,
        proximosRecebimentos: { fonte: 'VENCIMENTO', em7Dias: { valorCentavos: 1_000_000, cobrancas: 12 }, em30Dias: { valorCentavos: 10_000_000, cobrancas: 40 } },
        resultadoDoMes: { ...PAINEL_COM_DADOS.resultadoDoMes, recebidoCentavos: 10_000_000 },
      } },
      'GET /financeiro/inadimplentes': { corpo: { itens: [], total: 40, valorTotalCentavos: 10_000_000, pagina: 0 } },
    },
  });
  for (const largura of [390, 1280]) {
    await page.setViewportSize({ width: largura, height: 900 });
    await esperarValorInteiro(page.getByLabel('Cobranças vencidas: R$ 100.000,00'), ['R$', '100.000']);
    await esperarValorInteiro(page.getByLabel('Cobranças vencendo em 7 dias: R$ 10.000,00'), ['R$', '10.000']);
    await esperarValorInteiro(page.getByLabel('Recebido no mês, valor bruto: R$ 100.000,00'), ['R$', '100.000']);
  }
});
