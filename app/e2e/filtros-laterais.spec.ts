import { expect, test, type Locator, type Page } from '@playwright/test';

import type { CobrancaResponse, ContratacaoResponse } from '../src/api/financeiroTipos';
import type { Alimento, AlunoDetalhe, Exercicio, Tema } from '../src/api/tipos';
import { ALUNO, json, MARCA, paginaDeExerciciosFalsa, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { fixarHoje } from './aluno';
import {
  ALUNO_FINANCEIRO_ID, COBRANCA_ATRASADA, estadoFinanceiro, PERMISSOES_FINANCEIRO, rotasDoFinanceiro, sessaoComFinanceiro,
} from './financeiro-falso';

/**
 * Painel lateral de filtros (`docs/planos/filtros-laterais.md`, passos 1 e 2): Financeiro › Cobranças e Biblioteca ›
 * Exercícios e Alimentos. O painel guarda um rascunho; só o "Aplicar filtros" vale (validando as datas); Cancelar, X, Esc
 * e o fundo descartam; o foco volta ao botão; a seleção em lote segue a regra D9. Relógio em 19/10/2026; só dados
 * fictícios, API simulada. As capturas vão para `CAPTURAS_FILTROS` (ou `test-results/filtros-laterais`).
 */
const CAPTURAS = process.env.CAPTURAS_FILTROS ?? 'test-results/filtros-laterais';

const cobranca = (id: string, alunoNome: string, parcial: Partial<CobrancaResponse>): CobrancaResponse => ({
  ...COBRANCA_ATRASADA, id: `c0000000-0000-4000-8000-${id.padStart(12, '0')}`, alunoNome, criadoEm: '2026-09-20T12:00:00Z', ...parcial,
});
const BRUNA = cobranca('1', 'Bruna Teste', {});
const CAIO = cobranca('2', 'Caio Teste', { vencimento: '2026-10-10', diasDeAtraso: 9 });
const DORA = cobranca('3', 'Dora Teste', { competencia: '2026-11-05', vencimento: '2026-11-05', vencida: false, diasDeAtraso: null });
const ELIS = cobranca('4', 'Elis Teste', {
  situacao: 'PAGA', vencida: false, diasDeAtraso: null, pagoEm: '2026-10-12', forma: 'PIX_DIRETO', provedor: 'MANUAL', versao: 1,
});
const FEITA = cobranca('5', 'Fábio Teste', { competencia: '2026-10-22', vencimento: '2026-10-22', vencida: false, diasDeAtraso: null });

interface Abertura { preferencias?: object; temaDaMarca?: Tema; menuRecolhido?: boolean }

async function abrirCobrancas(page: Page, largura: number, { preferencias, temaDaMarca, menuRecolhido }: Abertura = {}) {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
  await fixarHoje(page);
  if (preferencias) await page.addInitScript(([id, p]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(p)), [TREINADOR.id, preferencias] as const);
  if (menuRecolhido) await page.addInitScript(() => localStorage.setItem('menu-lateral-recolhido', '1'));
  const marca = { ...MARCA, ...(temaDaMarca ? { temaPadrao: temaDaMarca } : {}) };
  const base = await sessao(page, TREINADOR, { marca, pagamentosHabilitados: true, recebimentoOnlineHabilitado: false, permissoes: [...PERMISSOES_TREINADOR, ...PERMISSOES_FINANCEIRO] });
  const login = base['POST /auth/refresh'] as { corpo: object };
  const estado = estadoFinanceiro({ cobrancas: [BRUNA, CAIO, DORA, ELIS, FEITA].map((c) => ({ ...c })) });
  const api = await simularApi(page, {
    ...base,
    'POST /auth/refresh': (_p, route) => json(route, { ...login.corpo, marca }),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    ...rotasDoFinanceiro(estado),
  });
  await page.goto('/treinador/financeiro?aba=cobrancas');
  await expect(page.getByText('Bruna Teste').first()).toBeVisible();
  return api;
}

const botao = (page: Page) => page.getByRole('button', { name: /^Filtros, / });
const painelDe = (page: Page, nome = 'Filtros de cobranças') => page.getByRole('dialog', { name: nome });
const pedidosDeCobrancas = (pedidos: { metodo: string; caminho: string; busca: URLSearchParams }[]) =>
  pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/financeiro/cobrancas');
const linhas = (page: Page) => page.getByRole('button', { name: /^Abrir cobrança de/ });

async function abrirPainel(page: Page, nome?: string): Promise<Locator> {
  await botao(page).click();
  const painel = painelDe(page, nome);
  await expect(painel).toBeVisible();
  return painel;
}

/** Marca opções na lista suspensa de várias (o próprio diálogo dela); fecha com Esc, que só fecha a lista. */
async function marcar(page: Page, painel: Locator, rotulo: string, valorAtual: string, opcoes: string[]) {
  await painel.getByRole('button', { name: `${rotulo}: ${valorAtual}. Escolher.` }).click();
  const lista = page.getByRole('dialog', { name: rotulo });
  for (const o of opcoes) await lista.getByRole('checkbox', { name: o, exact: true }).click();
  // Marcar várias não fecha nem a lista nem o painel.
  await expect(lista).toBeVisible();
  await expect(painel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(lista).toHaveCount(0);
  await expect(painel).toBeVisible();
}

const data = (painel: Locator, grupo: string, campo: 'De' | 'Até') => painel.getByRole('group', { name: grupo }).getByRole('textbox', { name: campo });

async function rolarPainel(painel: Locator, ate: 'fim' | 'topo') {
  await painel.evaluate((d, a) => {
    const rola = [...d.querySelectorAll<HTMLElement>('*')].find((e) => e.scrollHeight > e.clientHeight + 4 && getComputedStyle(e).overflowY !== 'visible');
    if (rola) rola.scrollTop = a === 'fim' ? rola.scrollHeight : 0;
  }, ate);
}

for (const largura of [390, 1280]) {
  test(`Cobranças em ${largura}px: dois status e vencimento num rascunho; Aplicar vale de uma vez; botão, chips e lista batem; cobrança sem data de pagamento`, async ({ page }) => {
    const { pedidos, naoTratadas, errosDaPagina } = await abrirCobrancas(page, largura);
    await expect(linhas(page)).toHaveCount(5);
    // Sem baixa, a cobrança mostra "—" no pagamento (na tabela ou no cartão).
    const antes = pedidosDeCobrancas(pedidos).length;

    const painel = await abrirPainel(page);
    // O foco entra no painel.
    await expect.poll(() => painel.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await marcar(page, painel, 'Situação', 'Todas', ['Em aberto', 'Pagas']);
    await painel.getByRole('radiogroup', { name: 'Vencimento' }).getByRole('radio', { name: 'Escolher período' }).click();
    await data(painel, 'Vencimento entre', 'De').fill('01/10/2026');
    await data(painel, 'Vencimento entre', 'Até').fill('31/10/2026');
    // Rascunho: nada foi ao endereço nem à API ainda.
    expect(pedidosDeCobrancas(pedidos)).toHaveLength(antes);
    await expect(page).not.toHaveURL(/situacao=/);
    await painel.getByRole('button', { name: 'Aplicar filtros' }).click();

    await expect(painel).toHaveCount(0);
    await expect(botao(page)).toBeFocused();
    await expect(page).toHaveURL(/situacao=ABERTA(%2C|,)PAGA/);
    await expect(page).toHaveURL(/de=2026-10-01/);
    // O endereço muda antes de o pedido sair: espera o pedido novo, que tem de levar tudo de uma vez.
    await expect.poll(() => pedidosDeCobrancas(pedidos).at(-1)!.busca.getAll('situacao')).toEqual(['ABERTA', 'PAGA']);
    const ultimo = pedidosDeCobrancas(pedidos).at(-1)!;
    expect([ultimo.busca.get('de'), ultimo.busca.get('ate')]).toEqual(['2026-10-01', '2026-10-31']);
    // Botão, chips e lista contam o mesmo: dois critérios (as duas situações são um só) e as 4 de outubro.
    await expect(page.getByRole('button', { name: 'Filtros, 2 ligados' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tirar filtro: Situação: Em aberto, Pagas' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Tirar filtro: Vencimento: / })).toBeVisible();
    await expect(linhas(page)).toHaveCount(4);
    await expect(page.getByRole('button', { name: 'Abrir cobrança de Dora Teste' })).toHaveCount(0);
    await page.screenshot({ path: `${CAPTURAS}/depois-cobrancas-aplicado-${largura}.png`, fullPage: true });

    // Pagamento a partir de 01/10: a cobrança sem data de pagamento sai; só a paga fica.
    await abrirPainel(page);
    await data(painelDe(page), 'Pagamento', 'De').fill('01/10/2026');
    await painelDe(page).getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(linhas(page)).toHaveCount(1);
    await expect(page.getByText('Elis Teste').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filtros, 3 ligados' })).toBeVisible();

    // Lista vazia não esconde as condições: os chips continuam e o "Limpar filtros" da página limpa todos, a busca fica.
    await page.getByRole('textbox', { name: 'Buscar' }).fill('ninguem');
    await expect(page.getByText('Nenhuma cobrança nesta lista')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tirar filtro: Situação: Em aberto, Pagas' })).toBeVisible();
    await page.getByRole('button', { name: 'Limpar filtros' }).first().click();
    await expect(page.getByRole('button', { name: 'Filtros, nenhum ligado' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Buscar' })).toHaveValue('ninguem');
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`Cobranças em ${largura}px: Cancelar, X, Esc e o fundo descartam; Esc fecha o calendário antes; data inválida não aplica`, async ({ page }) => {
    const { pedidos, naoTratadas, errosDaPagina } = await abrirCobrancas(page, largura);
    const antes = pedidosDeCobrancas(pedidos).length;
    const descartar = async (como: (painel: Locator) => Promise<void>) => {
      const painel = await abrirPainel(page);
      // Abre sempre com o que está aplicado (nada), não com o rascunho descartado da vez anterior.
      await expect(painel.getByRole('button', { name: 'Situação: Todas. Escolher.' })).toBeVisible();
      await marcar(page, painel, 'Situação', 'Todas', ['Pagas']);
      await como(painel);
      await expect(painel).toHaveCount(0);
      await expect(botao(page)).toBeFocused();
      await expect(page.getByRole('button', { name: 'Filtros, nenhum ligado' })).toBeVisible();
    };
    await descartar((p) => p.getByRole('button', { name: 'Cancelar' }).click());
    await descartar((p) => p.getByRole('button', { name: 'Fechar', exact: true }).click());
    await descartar(() => page.keyboard.press('Escape'));
    // O fundo: à esquerda do painel no PC; acima da folha no celular.
    await descartar(() => page.mouse.click(largura < 768 ? largura / 2 : 40, largura < 768 ? 20 : 450));
    expect(pedidosDeCobrancas(pedidos)).toHaveLength(antes);
    await expect(page).not.toHaveURL(/situacao=/);

    // Esc com o calendário aberto fecha só o calendário.
    const painel = await abrirPainel(page);
    await painel.getByRole('group', { name: 'Emissão' }).getByRole('button', { name: 'Abrir calendário' }).first().click();
    await expect(page.getByRole('button', { name: 'Mês anterior' })).toBeVisible();
    await page.screenshot({ path: `${CAPTURAS}/depois-cobrancas-calendario-${largura}.png` });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Mês anterior' })).toHaveCount(0);
    await expect(painel).toBeVisible();

    // Datas erradas seguram o Aplicar: o painel fica, a frase diz quantos, o foco vai ao primeiro campo marcado.
    await data(painel, 'Emissão', 'De').fill('10/10/20');
    await data(painel, 'Pagamento', 'De').fill('20/10/2026');
    await data(painel, 'Pagamento', 'Até').fill('10/10/2026');
    await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(painel).toBeVisible();
    await expect(painel.getByText('Corrija os 2 campos marcados para aplicar os filtros.')).toBeVisible();
    await expect(painel.getByText('Complete a data (DD/MM/AAAA) ou apague.')).toBeVisible();
    await expect(painel.getByText('Fim antes do início.')).toBeVisible();
    await expect(data(painel, 'Emissão', 'De')).toBeFocused();
    await page.screenshot({ path: `${CAPTURAS}/depois-cobrancas-erro-${largura}.png` });
    expect(pedidosDeCobrancas(pedidos)).toHaveLength(antes);

    // Corrigido, a frase some e o Aplicar vale.
    await data(painel, 'Emissão', 'De').fill('');
    await data(painel, 'Pagamento', 'Até').fill('25/10/2026');
    await expect(painel.getByText(/Corrija o/)).toHaveCount(0);
    await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(painel).toHaveCount(0);
    await expect(page).toHaveURL(/pagoDe=2026-10-20/);
    await expect(page).toHaveURL(/pagoAte=2026-10-25/);

    // "Limpar filtros" do painel só limpa o rascunho: vale no Aplicar.
    const outra = await abrirPainel(page);
    await outra.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(data(outra, 'Pagamento', 'De')).toHaveValue('');
    await expect(page).toHaveURL(/pagoDe=/);
    await outra.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(page).not.toHaveURL(/pagoDe=/);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('Cobranças: seleção em lote antes de filtrar; Cancelar e os mesmos filtros a mantêm, filtros novos a limpam com aviso', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrirCobrancas(page, 1280);
  await page.getByRole('button', { name: 'Selecionar todas desta página' }).click();
  await expect(page.getByText('4 cobranças selecionadas')).toBeVisible();

  let painel = await abrirPainel(page);
  await marcar(page, painel, 'Situação', 'Todas', ['Pagas']);
  await painel.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByText('4 cobranças selecionadas')).toBeVisible();

  painel = await abrirPainel(page);
  await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(painel).toHaveCount(0);
  await expect(page.getByText('4 cobranças selecionadas')).toBeVisible();

  painel = await abrirPainel(page);
  await marcar(page, painel, 'Situação', 'Todas', ['Em aberto']);
  await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByText('As 4 cobranças marcadas saíram da seleção porque os filtros mudaram.')).toBeVisible();
  await expect(page.getByText('4 cobranças selecionadas')).toHaveCount(0);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('Cobranças em 1280px: o painel encosta à direita na altura da janela, a tabela não muda de largura e a página atrás não rola', async ({ page }) => {
  const { errosDaPagina } = await abrirCobrancas(page, 1280);
  const cabecalho = page.getByRole('columnheader', { name: 'Valor' });
  const antes = (await cabecalho.boundingBox())!;
  const painel = await abrirPainel(page);
  const caixa = (await painel.boundingBox())!;
  expect(Math.round(caixa.x + caixa.width)).toBe(1280);
  expect(Math.round(caixa.width)).toBe(460);
  expect(Math.round(caixa.height)).toBe(900);
  const titulo = (await page.getByRole('heading', { name: 'Financeiro', level: 1 }).boundingBox())!;
  await page.mouse.move(200, 600);
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(200);
  expect((await page.getByRole('heading', { name: 'Financeiro', level: 1 }).boundingBox())!.y).toBe(titulo.y);
  await painel.getByRole('button', { name: 'Cancelar' }).click();
  const depois = (await cabecalho.boundingBox())!;
  expect([depois.x, depois.width]).toEqual([antes.x, antes.width]);
  expect(errosDaPagina).toEqual([]);
});

// Capturas: larguras, menu recolhido, temas, contraste alto, bordas reforçadas e texto grande; topo e fim do painel.
const LARGURAS = [390, 1024, 1280, 1440, 1920];
for (const largura of LARGURAS) {
  test(`capturas do painel em ${largura}px (escuro): topo e fim`, async ({ page }) => {
    const { errosDaPagina } = await abrirCobrancas(page, largura, { preferencias: { tema: 'ESCURO' } });
    await page.screenshot({ path: `${CAPTURAS}/depois-cobrancas-pagina-${largura}.png` });
    const painel = await abrirPainel(page);
    await painel.getByRole('radiogroup', { name: 'Vencimento' }).getByRole('radio', { name: 'Escolher período' }).click();
    await page.screenshot({ path: `${CAPTURAS}/depois-cobrancas-painel-topo-${largura}.png` });
    await rolarPainel(painel, 'fim');
    await page.screenshot({ path: `${CAPTURAS}/depois-cobrancas-painel-fim-${largura}.png` });
    // Campo perto do rodapé com o calendário: abre acima do painel e por cima do rodapé, inteiro na janela.
    await painel.getByRole('group', { name: 'Pagamento' }).getByRole('button', { name: 'Abrir calendário' }).last().click();
    await expect(page.getByRole('button', { name: 'Próximo mês' })).toBeInViewport();
    await page.screenshot({ path: `${CAPTURAS}/depois-cobrancas-calendario-rodape-${largura}.png` });
    expect(errosDaPagina).toEqual([]);
  });
}

test('captura com o menu recolhido em 1280px', async ({ page }) => {
  const { errosDaPagina } = await abrirCobrancas(page, 1280, { menuRecolhido: true });
  await abrirPainel(page);
  await page.screenshot({ path: `${CAPTURAS}/depois-cobrancas-menu-recolhido-1280.png` });
  expect(errosDaPagina).toEqual([]);
});

const TEMAS: { nome: string; abertura: Abertura }[] = [
  { nome: 'claro', abertura: { preferencias: { tema: 'CLARO' } } },
  { nome: 'areia', abertura: { preferencias: { tema: 'AREIA' } } },
  { nome: 'lavanda', abertura: { temaDaMarca: 'LAVANDA' } },
  { nome: 'ceu', abertura: { temaDaMarca: 'CEU' } },
  { nome: 'rosa', abertura: { temaDaMarca: 'ROSA' } },
  { nome: 'contraste-alto', abertura: { preferencias: { tema: 'ESCURO', contraste: 'ALTO' } } },
  { nome: 'claro-contraste-alto', abertura: { preferencias: { tema: 'CLARO', contraste: 'ALTO' } } },
  { nome: 'bordas-reforcadas', abertura: { preferencias: { tema: 'CLARO', bordasReforcadas: true } } },
  { nome: 'texto-grande', abertura: { preferencias: { tema: 'ESCURO', tamanhoTexto: 'GRANDE' } } },
];
for (const { nome, abertura } of TEMAS) for (const largura of [1280, 390]) {
  test(`captura ${nome} em ${largura}px: painel com situação marcada e a lista aberta`, async ({ page }) => {
    const { errosDaPagina } = await abrirCobrancas(page, largura, abertura);
    const painel = await abrirPainel(page);
    await painel.getByRole('radiogroup', { name: 'Responsável' }).getByRole('radio', { name: 'Meus' }).click();
    await page.screenshot({ path: `${CAPTURAS}/depois-cobrancas-${nome}-${largura}.png` });
    await painel.getByRole('button', { name: 'Situação: Todas. Escolher.' }).click();
    await page.getByRole('dialog', { name: 'Situação' }).getByRole('checkbox', { name: 'Pagas', exact: true }).click();
    await page.screenshot({ path: `${CAPTURAS}/depois-cobrancas-${nome}-lista-${largura}.png` });
    expect(errosDaPagina).toEqual([]);
  });
}

// "Antes": o modo antigo, que segue nas telas ainda não migradas (Lançamentos e Importar do catálogo usam a mesma peça).
for (const largura of [390, 1280]) {
  test(`captura antes (modo antigo, Lançamentos) em ${largura}px`, async ({ page }) => {
    await abrirCobrancas(page, largura, { preferencias: { tema: 'ESCURO' } });
    await page.goto('/treinador/financeiro?aba=lancamentos');
    await botao(page).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${CAPTURAS}/antes-lancamentos-filtros-${largura}.png`, fullPage: largura >= 768 });
  });
}

// Período incompleto no painel (M1): o que foi digitado nunca é ignorado em silêncio; o intervalo aberto que as Cobranças
// já aceitam (só De ou só Até) continua valendo.
for (const largura of [390, 1280]) {
  test(`Cobranças em ${largura}px: vencimento com a data final pela metade segura o Aplicar no campo dela; só o De vale`, async ({ page }) => {
    const { pedidos, naoTratadas, errosDaPagina } = await abrirCobrancas(page, largura, { preferencias: { tema: 'ESCURO' } });
    const antes = pedidosDeCobrancas(pedidos).length;
    const painel = await abrirPainel(page);
    await painel.getByRole('radiogroup', { name: 'Vencimento' }).getByRole('radio', { name: 'Escolher período' }).click();
    await data(painel, 'Vencimento entre', 'De').fill('01/10/2026');
    await data(painel, 'Vencimento entre', 'Até').fill('3/10');
    await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(painel).toBeVisible();
    await expect(painel.getByText('Corrija o campo marcado para aplicar os filtros.')).toBeVisible();
    await expect(data(painel, 'Vencimento entre', 'Até')).toHaveAttribute('aria-invalid', 'true');
    await expect(data(painel, 'Vencimento entre', 'De')).toHaveAttribute('aria-invalid', 'false');
    await expect(data(painel, 'Vencimento entre', 'Até')).toBeFocused();
    await expect(painel.getByText('Complete a data (DD/MM/AAAA) ou apague.')).toBeVisible();
    await page.screenshot({ path: `${CAPTURAS}/a-cobrancas-periodo-incompleto-${largura}.png` });
    expect(pedidosDeCobrancas(pedidos)).toHaveLength(antes);

    // Apagado o Até, o intervalo aberto vale: vencimento a partir de 01/10.
    await data(painel, 'Vencimento entre', 'Até').fill('');
    await expect(painel.getByText(/Corrija o/)).toHaveCount(0);
    await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(painel).toHaveCount(0);
    await expect(page).toHaveURL(/de=2026-10-01/);
    expect(pedidosDeCobrancas(pedidos).at(-1)!.busca.has('ate')).toBe(false);
    await expect(page.getByRole('button', { name: 'Tirar filtro: Vencimento: a partir de 01/10/2026' })).toBeVisible();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

// Chegada pela ficha ("Ver no Financeiro"): o aluno é o contexto da lista (D5, D6).
const CONTRATACAO: ContratacaoResponse = {
  id: 'e0000000-0000-4000-8000-0000000000dd', alunoId: ALUNO_FINANCEIRO_ID, planoComercialId: 'b0000000-0000-4000-8000-0000000000f1',
  planoNome: 'Consultoria mensal', periodicidade: 'MENSAL', valorCentavos: 15_000, motivoValor: null, inicio: '2026-08-05', diaVencimento: 5,
  situacao: 'ATIVA', encerradaEm: null, criadoEm: '2026-08-05T12:00:00Z', versao: 0,
};
const FICHA: AlunoDetalhe = {
  id: ALUNO_FINANCEIRO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null, cpf: null, endereco: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};
const DO_ALUNO = { alunoId: ALUNO_FINANCEIRO_ID, alunoNome: ALUNO.nome, contratacaoId: CONTRATACAO.id };

async function chegarPelaFicha(page: Page, largura: number, tema: 'ESCURO' | 'CLARO') {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
  await fixarHoje(page);
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
  const estado = estadoFinanceiro({
    contratacoes: [{ ...CONTRATACAO }],
    cobrancas: [
      cobranca('6', ALUNO.nome, DO_ALUNO),
      cobranca('7', ALUNO.nome, { ...DO_ALUNO, situacao: 'PAGA', vencida: false, diasDeAtraso: null, pagoEm: '2026-10-12', forma: 'PIX_DIRETO', provedor: 'MANUAL', versao: 1 }),
      { ...BRUNA },
    ],
  });
  const api = await simularApi(page, {
    ...(await sessaoComFinanceiro(page, undefined, false)), ...rotasDoFinanceiro(estado),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } }, [`GET /alunos/${ALUNO_FINANCEIRO_ID}`]: { corpo: FICHA },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
  });
  await page.goto(`/treinador/alunos/${ALUNO_FINANCEIRO_ID}?aba=ficha`);
  await page.getByRole('link', { name: 'Ver no Financeiro' }).click();
  await expect(page).toHaveURL(new RegExp(`alunoId=${ALUNO_FINANCEIRO_ID}`));
  return api;
}

const faixaDoAluno = (page: Page) => page.getByRole('group', { name: 'Aluno', exact: true });

for (const largura of [1280, 390]) {
  test(`Cobranças em ${largura}px pela ficha: o aluno fica visível, fora do contador; Limpar filtros o mantém; "Ver cobranças de todos os alunos" tira só ele`, async ({ page }) => {
    const { pedidos, errosDaPagina } = await chegarPelaFicha(page, largura, 'ESCURO');
    const faixa = faixaDoAluno(page);
    await expect(faixa.getByText(ALUNO.nome, { exact: true })).toBeVisible();
    await expect(linhas(page)).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Filtros, nenhum ligado' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Tirar filtro: Aluno/ })).toHaveCount(0);
    await page.screenshot({ path: `${CAPTURAS}/a-cobrancas-pela-ficha-escuro-${largura}.png` });

    // No painel o aluno aparece só para leitura; um critério a mais conta 1.
    let painel = await abrirPainel(page);
    await expect(painel.getByLabel(`Aluno: ${ALUNO.nome}`)).toBeVisible();
    await page.screenshot({ path: `${CAPTURAS}/a-cobrancas-painel-com-aluno-escuro-${largura}.png` });
    await marcar(page, painel, 'Situação', 'Todas', ['Pagas']);
    await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(page.getByRole('button', { name: 'Filtros, 1 ligado' })).toBeVisible();
    await expect(linhas(page)).toHaveCount(1);
    expect(pedidosDeCobrancas(pedidos).at(-1)!.busca.get('alunoId')).toBe(ALUNO_FINANCEIRO_ID);

    // "Limpar filtros" da página tira o critério e mantém o aluno.
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(page.getByRole('button', { name: 'Filtros, nenhum ligado' })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`alunoId=${ALUNO_FINANCEIRO_ID}`));
    await expect(page).not.toHaveURL(/situacao=/);
    await expect(faixa.getByText(ALUNO.nome, { exact: true })).toBeVisible();
    await expect(linhas(page)).toHaveCount(2);

    // "Limpar filtros" do painel também.
    painel = await abrirPainel(page);
    await marcar(page, painel, 'Situação', 'Todas', ['Pagas']);
    await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(page).toHaveURL(/situacao=PAGA/);
    painel = await abrirPainel(page);
    await painel.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(painel.getByLabel(`Aluno: ${ALUNO.nome}`)).toBeVisible();
    await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(page).not.toHaveURL(/situacao=/);
    await expect(page).toHaveURL(new RegExp(`alunoId=${ALUNO_FINANCEIRO_ID}`));
    expect(pedidosDeCobrancas(pedidos).at(-1)!.busca.get('alunoId')).toBe(ALUNO_FINANCEIRO_ID);

    // "Ver cobranças de todos os alunos" tira só o aluno: o critério escolhido fica.
    painel = await abrirPainel(page);
    await marcar(page, painel, 'Situação', 'Todas', ['Em aberto']);
    await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(linhas(page)).toHaveCount(1);
    await faixa.getByRole('button', { name: 'Ver cobranças de todos os alunos' }).focus();
    await page.keyboard.press('Enter');
    await expect(faixa).toHaveCount(0);
    // O botão sumiu com a faixa: o foco vai à busca, logo abaixo, e não ao início da página.
    await expect(page.getByRole('textbox', { name: 'Buscar' })).toBeFocused();
    await expect(page).not.toHaveURL(/alunoId=/);
    await expect(page).toHaveURL(/situacao=ABERTA/);
    await expect.poll(() => pedidosDeCobrancas(pedidos).at(-1)!.busca.has('alunoId')).toBe(false);
    expect(pedidosDeCobrancas(pedidos).at(-1)!.busca.getAll('situacao')).toEqual(['ABERTA']);
    await expect(page.getByRole('button', { name: 'Filtros, 1 ligado' })).toBeVisible();
    await expect(linhas(page)).toHaveCount(2);
    expect(errosDaPagina).toEqual([]);
  });
}

test('captura pela ficha em tema claro (1280 e 390 px): o aluno na faixa', async ({ page }) => {
  const { errosDaPagina } = await chegarPelaFicha(page, 1280, 'CLARO');
  await expect(faixaDoAluno(page).getByText(ALUNO.nome, { exact: true })).toBeVisible();
  await page.screenshot({ path: `${CAPTURAS}/a-cobrancas-pela-ficha-claro-1280.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(faixaDoAluno(page).getByText(ALUNO.nome, { exact: true })).toBeVisible();
  await page.screenshot({ path: `${CAPTURAS}/a-cobrancas-pela-ficha-claro-390.png` });
  expect(errosDaPagina).toEqual([]);
});

// Biblioteca.
const exercicio = (n: number, nome: string, grupo: string): Exercicio => ({
  id: `e000000${n}-0000-4000-8000-000000000000`, nome, grupoMuscular: grupo, equipamento: null, modalidade: 'LIVRE', videoUrl: null,
  observacoes: null, origem: 'MANUAL', imagens: [], imagemPropriaEm: null,
});
const GRUPOS = ['Abdômen', 'Antebraço', 'Bíceps', 'Cardio', 'Costas', 'Glúteos', 'Lombar', 'Ombro', 'Panturrilha', 'Peito', 'Pernas', 'Posterior', 'Quadríceps', 'Trapézio', 'Tríceps'];
const EXERCICIOS = [exercicio(1, 'Supino reto', 'Peito'), exercicio(2, 'Supino inclinado', 'Peito'), exercicio(3, 'Remada curvada', 'Costas'),
  ...GRUPOS.map((g, i) => exercicio(i + 4, `Exercício de ${g}`, g))];

async function abrirBiblioteca(page: Page, largura: number, aba = '') {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
  const consultas: string[] = [];
  const alimentos: Alimento[] = [
    { id: 'a1', nome: 'Arroz branco cozido', baseQuantidade: 100, baseUnidade: 'g', kcal: 128, proteina: 2.5, carboidrato: 28, gordura: 0.2,
      gramasPorUnidade: null, fonte: 'TACO', origem: 'CATALOGO', fatorCorrecao: null, fatorCoccao: null, grupo: 'Cereais e derivados' },
    { id: 'a2', nome: 'Banana prata', baseQuantidade: 1, baseUnidade: 'un', kcal: 98, proteina: 1.3, carboidrato: 26, gordura: 0.1,
      gramasPorUnidade: 55, fonte: 'TACO', origem: 'CATALOGO', fatorCorrecao: null, fatorCoccao: null, grupo: 'Frutas e derivados' },
  ];
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios/pagina': paginaDeExerciciosFalsa(EXERCICIOS, consultas),
    'PUT /exercicios/{id}': (p, route) => json(route, { ...EXERCICIOS[0], ...(p.corpo as object) }),
    'GET /alimentos': { corpo: alimentos },
  });
  await page.goto(`/treinador/biblioteca${aba}`);
  return { ...api, consultas };
}

for (const largura of [390, 1280]) {
  test(`Biblioteca › Exercícios em ${largura}px: nome e grupo; voltar de uma edição mantém o filtro; sem resultado mostra as condições`, async ({ page }) => {
    const { consultas, naoTratadas, errosDaPagina } = await abrirBiblioteca(page, largura);
    await expect(page.getByText('Supino reto', { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Buscar exercício' }).fill('supino');
    await expect(page.getByText('Remada curvada', { exact: true })).toHaveCount(0);

    const painel = await abrirPainel(page, 'Filtros de exercícios');
    await painel.getByRole('button', { name: 'Grupo muscular: Todos os grupos. Escolher.' }).click();
    const lista = page.getByRole('dialog', { name: 'Grupo muscular' });
    await lista.getByRole('checkbox', { name: 'Peito' }).click();
    await page.screenshot({ path: `${CAPTURAS}/depois-exercicios-lista-longa-${largura}.png` });
    await page.keyboard.press('Escape');
    await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(painel).toHaveCount(0);
    await expect(botao(page)).toBeFocused();
    await expect.poll(() => consultas.at(-1)).toContain('grupo=Peito');
    expect(consultas.at(-1)).toContain('busca=supino');
    await expect(page.getByRole('button', { name: 'Filtros, 1 ligado' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tirar filtro: Grupo muscular: Peito' })).toBeVisible();

    // Editar e voltar: o filtro e a busca continuam.
    await page.getByRole('button', { name: 'Editar Supino reto' }).click();
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('button', { name: 'Tirar filtro: Grupo muscular: Peito' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Buscar exercício' })).toHaveValue('supino');
    expect(consultas.at(-1)).toContain('grupo=Peito');

    // Sem resultado: o vazio diz o porquê e os chips continuam; "Limpar filtros" do vazio tira só o grupo.
    await page.getByRole('textbox', { name: 'Buscar exercício' }).fill('remada');
    await expect(page.getByText('Nenhum exercício encontrado')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tirar filtro: Grupo muscular: Peito' })).toBeVisible();
    await page.screenshot({ path: `${CAPTURAS}/depois-exercicios-vazio-${largura}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Limpar filtros' }).last().click();
    await expect(page.getByText('Remada curvada', { exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Buscar exercício' })).toHaveValue('remada');
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`Biblioteca › Alimentos em ${largura}px: nome e grupo no painel lateral`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrirBiblioteca(page, largura, '?aba=alimentos');
    await expect(page.getByText('Banana prata', { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Buscar alimento' }).fill('a');
    const painel = await abrirPainel(page, 'Filtros de alimentos');
    await painel.getByRole('button', { name: 'Grupo: Todos os grupos. Escolher.' }).click();
    await page.getByRole('dialog', { name: 'Grupo' }).getByRole('checkbox', { name: 'Frutas e derivados' }).click();
    await page.keyboard.press('Escape');
    await page.screenshot({ path: `${CAPTURAS}/depois-alimentos-painel-${largura}.png` });
    // Rascunho: a lista ainda mostra os dois.
    await expect(page.getByText('Arroz branco cozido', { exact: true })).toBeVisible();
    await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(page.getByText('Arroz branco cozido', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Banana prata', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tirar filtro: Grupo: Frutas e derivados' })).toBeVisible();
    await page.screenshot({ path: `${CAPTURAS}/depois-alimentos-aplicado-${largura}.png`, fullPage: true });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`captura antes (modo antigo, Importar do catálogo) em ${largura}px`, async ({ page }) => {
    await abrirBiblioteca(page, largura, '?aba=catalogo');
    await page.waitForTimeout(500);
    const b = page.getByRole('button', { name: /^Filtros, / });
    if (await b.count()) await b.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${CAPTURAS}/antes-catalogo-filtros-${largura}.png` });
  });
}
