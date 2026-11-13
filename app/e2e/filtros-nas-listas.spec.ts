import { expect, test, type Locator, type Page } from '@playwright/test';

import type { MembroEquipe, PerfilEquipe } from '../src/api/equipeTipos';
import type { AtualizacaoDaLista, QuestionarioResumo } from '../src/api/tipos';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso } from './api-falsa';
import { fixarHoje } from './aluno';
import { COBRANCA_ATRASADA, estadoFinanceiro, rotasDoFinanceiro, sessaoComFinanceiro } from './financeiro-falso';
import { contagensFalsas, resumoFalso, rotasDaTela } from './inscricoes-falsas';

/**
 * A barra de filtros nas listas do treinador (`docs/planos/filtros-nas-listas.md`, lotes 1 e 2): Atualizações,
 * Interessados, Financeiro (Cobranças e Lançamentos), Auditoria, Importação, Membros da equipe e Questionários. Cada
 * escolha vai ao pedido da API (ou filtra o que já veio) e, nas listas filtradas pela API, ao endereço; o chip do
 * "Filtrando:" tira o filtro. Só dados fictícios, API simulada.
 */
const OUTRA = { id: 'u0000000-0000-4000-8000-000000000007', nome: 'Bia Fictícia' };

const ultimo = (pedidos: PedidoFalso[], caminho: string) => pedidos.filter((p) => p.metodo === 'GET' && p.caminho === caminho).at(-1)?.busca;
const botaoFiltros = (page: Page) => page.getByRole('button', { name: /^Filtros, / });
const opcao = (onde: Locator, grupo: string, rotulo: string) =>
  onde.getByRole('radiogroup', { name: grupo }).getByRole('radio', { name: rotulo, exact: true });

/**
 * Marca opções num filtro de várias opções (`SelecaoMultiplaSuspensa`): o botão "Rótulo: valor. Escolher." abre a lista
 * (no PC suspensa, no celular uma folha), cada rótulo é uma caixa; fecha com Esc (PC) ou Fechar (celular).
 */
async function marcar(page: Page, onde: Locator, rotulo: string, valorAtual: string, opcoes: string[], celular: boolean) {
  await onde.getByRole('button', { name: `${rotulo}: ${valorAtual}. Escolher.` }).click();
  const lista = page.getByRole('dialog', { name: rotulo });
  for (const o of opcoes) await lista.getByRole('checkbox', { name: o, exact: true }).click();
  if (celular) await lista.getByRole('button', { name: 'Fechar' }).click();
  else await page.keyboard.press('Escape');
}

/**
 * Telas já no painel lateral (`docs/planos/filtros-laterais.md`): o botão abre o diálogo "Filtros de <assunto>" nas duas
 * larguras; as escolhas são rascunho e só valem no "Aplicar filtros", que fecha o painel. A lista de várias opções fecha
 * com Esc (só ela), nas duas larguras.
 */
async function abrirPainelLateral(page: Page, nome: string): Promise<Locator> {
  await botaoFiltros(page).click();
  const painel = page.getByRole('dialog', { name: nome });
  await expect(painel).toBeVisible();
  return painel;
}
async function aplicarFiltros(painel: Locator) {
  await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(painel).toHaveCount(0);
}

function atualizacao(n: number, nome: string): AtualizacaoDaLista {
  return {
    id: `b0000000-0000-4000-8000-00000000000${n}`, pastaId: `c0000000-0000-4000-8000-00000000000${n}`,
    alunoId: `a0000000-0000-4000-8000-00000000000${n}`, nomeAluno: nome, dataAtualizacao: '2026-10-20', fase: 'ENVIADA',
    diasParaData: -1, diasDeAtraso: 0, atrasoAte: null,
  };
}

const PERFIS: PerfilEquipe[] = [
  { id: 'p-1', nome: 'Treinador', descricao: null, acessoTotal: false, sistema: true, ativo: true, permissoes: [], usuarios: 1, versao: 1 },
  { id: 'p-2', nome: 'Assistente', descricao: null, acessoTotal: false, sistema: true, ativo: true, permissoes: [], usuarios: 1, versao: 1 },
];
function membro(n: number, nome: string, extra: Partial<MembroEquipe> = {}): MembroEquipe {
  return {
    id: `m0000000-0000-4000-8000-00000000000${n}`, nome, email: `${nome.split(' ')[0].toLowerCase()}@exemplo.test`, perfilId: 'p-1',
    perfilNome: 'Treinador', ativo: true, convitePendente: false, conviteExpiraEm: null, ultimoAcesso: null, limiteDeAlunos: null, ...extra,
  };
}

function questionario(n: number, nome: string, extra: Partial<QuestionarioResumo> = {}): QuestionarioResumo {
  return {
    id: `q0000000-0000-4000-8000-00000000000${n}`, nome, descricao: null, finalidade: 'ATUALIZACAO', padrao: false, arquivado: false,
    versaoPublicada: 1, publicadoEm: '2026-10-01T12:00:00Z', alteradoDesdePublicacao: false, rascunhoAlteradoEm: null,
    uso: { alunos: 0, pastas: 0, envios: 0 }, ...extra,
  };
}

for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: altura } });
    const celular = largura < 768;

    test('Atualizações: busca pelo nome na API, vários responsáveis e data no pedido e no endereço; abas contam com os filtros; a fila leva tudo', async ({ page }) => {
      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER'] })),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        // O ponto de Atualizações no menu ainda vem do /painel; o número das abas, não.
        'GET /painel': { corpo: { atualizacoesParaRevisar: 9, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 0 } },
        'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }, OUTRA] },
        'GET /atualizacoes/pagina': (p, route) => json(route, p.busca.get('busca') === 'bruno'
          ? { itens: [atualizacao(2, 'Bruno Exemplo')], total: 1 } : { itens: [atualizacao(1, 'Ana Fictícia'), atualizacao(2, 'Bruno Exemplo')], total: 2 }),
        'GET /atualizacoes/contagens': (p, route) => json(route, p.busca.has('responsavel')
          ? { PARA_REVISAR: 1, ATRASADAS: 0, AVISARAM_ATRASO: 0, PROXIMAS: 0 } : { PARA_REVISAR: 2, ATRASADAS: 0, AVISARAM_ATRASO: 0, PROXIMAS: 0 }),
      });
      await page.goto('/treinador/atualizacoes?situacao=PARA_REVISAR');
      await expect(page.getByRole('link', { name: /Ana Fictícia/ })).toBeVisible();
      expect(ultimo(pedidos, '/atualizacoes/pagina')?.toString()).toBe('situacao=PARA_REVISAR&pagina=0&tamanho=30&meus=false');
      await expect(page.getByRole('tab', { name: /Para revisar/ })).toContainText('2');

      // A busca vai à API (300 ms depois de digitar) e segue para a fila.
      await page.getByRole('textbox', { name: 'Buscar' }).fill('bruno');
      await expect.poll(() => ultimo(pedidos, '/atualizacoes/pagina')?.get('busca')).toBe('bruno');
      await expect(page.getByRole('link', { name: /Ana Fictícia/ })).toHaveCount(0);
      await expect(page.getByRole('link', { name: /Bruno Exemplo/ })).toHaveAttribute('href', /busca=bruno/);
      expect(ultimo(pedidos, '/atualizacoes/contagens')?.get('busca')).toBe('bruno');
      await page.getByRole('textbox', { name: 'Buscar' }).fill('');
      await expect(page.getByRole('link', { name: /Ana Fictícia/ })).toBeVisible();

      // Vários responsáveis: Bia e Sem responsável (rascunho: nada vai à API antes do Aplicar).
      const painel = await abrirPainelLateral(page, 'Filtros de atualizações');
      const antes = pedidos.length;
      await marcar(page, painel, 'Responsável', 'Todos', ['Bia Fictícia', 'Sem responsável'], false);
      expect(pedidos.slice(antes).some((p) => p.caminho === '/atualizacoes/pagina')).toBe(false);
      await expect(page).not.toHaveURL(/responsavel=/);
      await aplicarFiltros(painel);
      await expect.poll(() => ultimo(pedidos, '/atualizacoes/pagina')?.getAll('responsavel')).toEqual([OUTRA.id, 'nenhum']);
      expect(ultimo(pedidos, '/atualizacoes/pagina')?.has('meus')).toBe(false);
      await expect(page).toHaveURL(new RegExp(`responsavel=${OUTRA.id}(%2C|,)nenhum`));
      await expect(page.getByRole('button', { name: 'Tirar filtro: Responsável: Bia Fictícia, Sem responsável' })).toBeVisible();
      // As abas contam com os mesmos filtros (GET /atualizacoes/contagens).
      await expect.poll(() => ultimo(pedidos, '/atualizacoes/contagens')?.getAll('responsavel')).toEqual([OUTRA.id, 'nenhum']);
      await expect(page.getByRole('tab', { name: /Para revisar/ })).toContainText('1');
      // A revisão em fila segue os mesmos filtros.
      await expect(page.getByRole('link', { name: /Ana Fictícia/ })).toHaveAttribute('href', new RegExp(`responsavel=${OUTRA.id}%2Cnenhum`));

      // Data: só vale com as duas pontas (a rota só aceita o par). Só o De segura o Aplicar: erro no Até, que recebe o
      // foco, e nada vai ao endereço nem à API.
      const painel2 = await abrirPainelLateral(page, 'Filtros de atualizações');
      await painel2.getByRole('textbox', { name: 'De', exact: true }).fill('01/10/2026');
      const antesDaData = pedidos.length;
      await painel2.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect(painel2).toBeVisible();
      await expect(painel2.getByRole('textbox', { name: 'Até', exact: true })).toHaveAttribute('aria-invalid', 'true');
      await expect(painel2.getByRole('textbox', { name: 'Até', exact: true })).toBeFocused();
      await expect(page).not.toHaveURL(/de=/);
      expect(pedidos.slice(antesDaData).some((p) => p.caminho === '/atualizacoes/pagina')).toBe(false);
      await painel2.getByRole('textbox', { name: 'Até', exact: true }).fill('31/10/2026');
      await aplicarFiltros(painel2);
      await expect.poll(() => ultimo(pedidos, '/atualizacoes/pagina')?.get('ate')).toBe('2026-10-31');
      expect(ultimo(pedidos, '/atualizacoes/pagina')?.get('de')).toBe('2026-10-01');
      await expect(page.getByRole('button', { name: 'Tirar filtro: Data: 01/10/2026 a 31/10/2026' })).toBeVisible();
      await expect(page.getByRole('link', { name: /Ana Fictícia/ })).toHaveAttribute('href', /de=2026-10-01&ate=2026-10-31/);

      // O ✕ tira só aquele filtro.
      await page.getByRole('button', { name: 'Tirar filtro: Responsável: Bia Fictícia, Sem responsável' }).click();
      await expect.poll(() => ultimo(pedidos, '/atualizacoes/pagina')?.get('meus')).toBe('false');
      expect(ultimo(pedidos, '/atualizacoes/pagina')?.get('de')).toBe('2026-10-01');
      await expect(page).not.toHaveURL(/responsavel=/);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Atualizações: 65 atualizações abrem 30 por vez; Próxima pede a página 1 e trocar de aba volta à primeira', async ({ page }) => {
      const todas = Array.from({ length: 65 }, (_, i) => ({ ...atualizacao(1, `Aluno ${String(i + 1).padStart(2, '0')}`), pastaId: `c0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}` }));
      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER'] })),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        'GET /painel': { corpo: { atualizacoesParaRevisar: 65, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 0 } },
        'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
        'GET /atualizacoes/pagina': (p, route) => {
          const n = Number(p.busca.get('pagina'));
          json(route, { itens: todas.slice(n * 30, n * 30 + 30), total: 65 });
        },
        'GET /atualizacoes/contagens': { corpo: { PARA_REVISAR: 65, ATRASADAS: 0, AVISARAM_ATRASO: 0, PROXIMAS: 0 } },
      });
      await page.goto('/treinador/atualizacoes?situacao=PARA_REVISAR');
      await expect(page.getByRole('link', { name: /Aluno 01/ })).toBeVisible();
      await expect(page.getByRole('link', { name: /Aluno 31/ })).toHaveCount(0);
      await expect(page.getByText('Página 1 de 3 · 65 atualizações')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Anterior' })).toBeDisabled();
      await page.getByRole('button', { name: 'Próxima' }).click();
      await expect.poll(() => ultimo(pedidos, '/atualizacoes/pagina')?.get('pagina')).toBe('1');
      await expect(page.getByRole('link', { name: /Aluno 31/ })).toBeVisible();
      await expect(page.getByRole('link', { name: /Aluno 01/ })).toHaveCount(0);
      await expect(page.getByText('Página 2 de 3 · 65 atualizações')).toBeVisible();
      // Outra aba é outra consulta: volta à primeira página.
      await page.getByRole('tab', { name: /Atrasadas/ }).click();
      await expect.poll(() => ultimo(pedidos, '/atualizacoes/pagina')?.get('situacao')).toBe('ATRASADAS');
      expect(ultimo(pedidos, '/atualizacoes/pagina')?.get('pagina')).toBe('0');
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Atualizações: página que volta vazia porque a lista encolheu cai na última página, sem laço', async ({ page }) => {
      const todas = Array.from({ length: 60 }, (_, i) => ({ ...atualizacao(1, `Aluno ${String(i + 1).padStart(2, '0')}`), pastaId: `c0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}` }));
      let encolheu = false;
      const { naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER'] })),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        'GET /painel': { corpo: { atualizacoesParaRevisar: 65, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 0 } },
        'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
        // A primeira resposta diz 65 (três páginas); quando a terceira é pedida, a lista já encolheu para 60 e vem vazia.
        'GET /atualizacoes/pagina': (p, route) => {
          const n = Number(p.busca.get('pagina'));
          if (n >= 2) encolheu = true;
          json(route, { itens: n >= 2 ? [] : todas.slice(n * 30, n * 30 + 30), total: encolheu ? 60 : 65 });
        },
        'GET /atualizacoes/contagens': { corpo: { PARA_REVISAR: 60, ATRASADAS: 0, AVISARAM_ATRASO: 0, PROXIMAS: 0 } },
      });
      await page.goto('/treinador/atualizacoes?situacao=PARA_REVISAR');
      await expect(page.getByText('Página 1 de 3 · 65 atualizações')).toBeVisible();
      await page.getByRole('button', { name: 'Próxima' }).click();
      await expect(page.getByText('Página 2 de 3 · 65 atualizações')).toBeVisible();
      await page.getByRole('button', { name: 'Próxima' }).click();
      await expect(page.getByText('Página 2 de 2 · 60 atualizações')).toBeVisible();
      await expect(page.getByRole('link', { name: /Aluno 31/ })).toBeVisible();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Interessados: várias pessoas e origens, entrada e última atividade no pedido, no endereço e nas contagens', async ({ page }) => {
      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR)),
        ...rotasDaTela(),
        'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }, OUTRA] },
        'GET /inscricoes': { corpo: { itens: [resumoFalso(1)], total: 1 } },
        'GET /inscricoes/contagens': { corpo: contagensFalsas({ NOVA: 1 }) },
      });
      const daTela = (n: number) => pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/inscricoes' && p.busca.get('situacao') !== 'NOVA').at(-n)?.busca;
      await page.goto('/treinador/interessados');
      await expect(page.getByText('Pessoa Fictícia 1', { exact: true }).first()).toBeVisible();

      const painel = await abrirPainelLateral(page, 'Filtros de inscrições');
      await marcar(page, painel, 'Responsável', 'Toda a equipe', ['Meus', 'Bia Fictícia'], false);
      await marcar(page, painel, 'Origem', 'Todas', ['Instagram', 'Não informada'], false);
      await painel.getByRole('textbox', { name: 'Entrada: data inicial', exact: true }).fill('01/10/2026');
      await painel.getByRole('textbox', { name: 'Última atividade: data final', exact: true }).fill('31/10/2026');
      // Rascunho: nada no endereço antes do Aplicar.
      await expect(page).not.toHaveURL(/origem=/);
      await aplicarFiltros(painel);
      // Meus junto de outra pessoa vira o id do usuário (a API recusa `meus` com `responsavel`).
      await expect.poll(() => daTela(1)?.get('atividadeAte')).toBe('2026-10-31');
      expect(daTela(1)?.getAll('responsavel').sort()).toEqual([OUTRA.id, TREINADOR.id].sort());
      expect(daTela(1)?.get('meus')).toBe('false');
      expect(daTela(1)?.getAll('origem')).toEqual(['INSTAGRAM', 'NAO_INFORMADA']);
      expect(daTela(1)?.get('de')).toBe('2026-10-01');
      const contagem = ultimo(pedidos, '/inscricoes/contagens');
      expect([contagem?.getAll('origem'), contagem?.get('de'), contagem?.get('atividadeAte')]).toEqual([['INSTAGRAM', 'NAO_INFORMADA'], '2026-10-01', '2026-10-31']);
      await expect(page).toHaveURL(/origem=INSTAGRAM(%2C|,)NAO_INFORMADA/);
      await expect(page.getByRole('button', { name: 'Tirar filtro: Origem: Instagram, Não informada' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tirar filtro: Responsável: Meus, Bia Fictícia' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tirar filtro: Entrada: a partir de 01/10/2026' })).toBeVisible();

      await page.getByRole('button', { name: 'Tirar filtro: Última atividade: até 31/10/2026' }).click();
      await expect.poll(() => daTela(1)?.has('atividadeAte')).toBe(false);
      expect(daTela(1)?.getAll('origem')).toEqual(['INSTAGRAM', 'NAO_INFORMADA']);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Cobranças: busca pelo aluno, várias situações, plano e forma; o aluno vem do endereço e "Ver cobranças de todos os alunos" o tira', async ({ page }) => {
      await fixarHoje(page);
      const PLANO = 'b0000000-0000-4000-8000-0000000000f1';
      const paga = { ...COBRANCA_ATRASADA, id: 'c0000000-0000-4000-8000-0000000000a9', alunoNome: 'Bruno Exemplo', situacao: 'PAGA' as const,
        vencida: false, diasDeAtraso: 0, pagoEm: '2026-10-18', forma: 'PIX' as const, provedor: 'INFINITEPAY' };
      const estado = estadoFinanceiro({ cobrancas: [COBRANCA_ATRASADA, paga] });
      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessaoComFinanceiro(page, undefined, false)),
        ...rotasDoFinanceiro(estado),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        [`GET /alunos/${COBRANCA_ATRASADA.alunoId}`]: { corpo: { id: COBRANCA_ATRASADA.alunoId, nome: COBRANCA_ATRASADA.alunoNome } },
        'GET /financeiro/planos': (p, route) => json(route, p.busca.get('arquivados') === 'true' ? []
          : [{ id: PLANO, nome: 'Consultoria mensal', valorCentavos: 15_000, periodicidade: 'MENSAL', arquivado: false, criadoEm: '2026-10-01T12:00:00Z', versao: 0 }]),
      });
      await page.goto(`/treinador/financeiro?aba=cobrancas&alunoId=${COBRANCA_ATRASADA.alunoId}`);
      // O aluno é o contexto da lista (faixa à parte), não um chip nem um critério do contador.
      const faixa = page.getByRole('group', { name: 'Aluno', exact: true });
      await expect(faixa.getByText(COBRANCA_ATRASADA.alunoNome!, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Filtros, nenhum ligado/ })).toBeVisible();
      expect(ultimo(pedidos, '/financeiro/cobrancas')?.get('alunoId')).toBe(COBRANCA_ATRASADA.alunoId);
      await faixa.getByRole('button', { name: 'Ver cobranças de todos os alunos' }).click();
      await expect.poll(() => ultimo(pedidos, '/financeiro/cobrancas')?.has('alunoId')).toBe(false);
      await expect(faixa).toHaveCount(0);

      await page.getByRole('textbox', { name: 'Buscar' }).fill('bruno');
      await expect.poll(() => ultimo(pedidos, '/financeiro/cobrancas')?.get('busca')).toBe('bruno');
      await expect(page.getByText('Bruno Exemplo', { exact: true }).first()).toBeVisible();
      await page.getByRole('textbox', { name: 'Buscar' }).fill('');

      // Painel lateral (`docs/planos/filtros-laterais.md`): rascunho nas duas larguras, vale no "Aplicar filtros".
      await botaoFiltros(page).click();
      const painel = page.getByRole('dialog', { name: 'Filtros de cobranças' });
      await expect(painel).toBeVisible();
      await marcar(page, painel, 'Situação', 'Todas', ['Vencidas', 'Pagas'], celular);
      await opcao(painel, 'Plano', 'Consultoria mensal').click();
      await opcao(painel, 'Forma da baixa', 'Pagamento online').click();
      await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect.poll(() => ultimo(pedidos, '/financeiro/cobrancas')?.get('forma')).toBe('ONLINE');
      expect(ultimo(pedidos, '/financeiro/cobrancas')?.getAll('situacao')).toEqual(['VENCIDA', 'PAGA']);
      expect(ultimo(pedidos, '/financeiro/cobrancas')?.get('planoId')).toBe(PLANO);
      await expect(page).toHaveURL(/situacao=VENCIDA(%2C|,)PAGA/);
      await expect(page).toHaveURL(new RegExp(`planoId=${PLANO}`));
      await expect(page.getByRole('button', { name: 'Tirar filtro: Situação: Vencidas, Pagas' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tirar filtro: Plano: Consultoria mensal' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tirar filtro: Forma: Pagamento online' })).toBeVisible();

      await page.getByRole('button', { name: 'Tirar filtro: Forma: Pagamento online' }).click();
      await expect.poll(() => ultimo(pedidos, '/financeiro/cobrancas')?.has('forma')).toBe(false);
      expect(ultimo(pedidos, '/financeiro/cobrancas')?.getAll('situacao')).toEqual(['VENCIDA', 'PAGA']);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Lançamentos: busca na descrição, tipo e categorias já usadas no pedido; categoria com vírgula vai inteira', async ({ page }) => {
      await fixarHoje(page);
      const lancamento = (n: number, descricao: string, categoria: string | null) => ({
        id: `l0000000-0000-4000-8000-00000000000${n}`, data: '2026-10-10', descricao, valorCentavos: 5_000, tipo: 'SAIDA' as const,
        categoria, criadoEm: '2026-10-10T12:00:00Z', versao: 0,
      });
      const estado = estadoFinanceiro({ lancamentos: [lancamento(1, 'Aluguel da sala', 'Aluguel, luz e água'), lancamento(2, 'Halteres', 'Equipamento')] });
      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessaoComFinanceiro(page, undefined, false)),
        ...rotasDoFinanceiro(estado),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      });
      await page.goto('/treinador/financeiro?aba=lancamentos');
      await expect(page.getByText('Aluguel da sala', { exact: true }).first()).toBeVisible();

      await page.getByRole('textbox', { name: 'Buscar' }).fill('halter');
      await expect.poll(() => ultimo(pedidos, '/financeiro/lancamentos')?.get('busca')).toBe('halter');
      await page.getByRole('textbox', { name: 'Buscar' }).fill('');

      const painel = await abrirPainelLateral(page, 'Filtros de lançamentos');
      await opcao(painel, 'Tipo', 'Saídas').click();
      await marcar(page, painel, 'Categoria', 'Todas', ['Aluguel, luz e água'], false);
      await expect(page).not.toHaveURL(/tipo=/);
      await aplicarFiltros(painel);
      await expect(page).toHaveURL(/tipo=SAIDA/);
      await expect.poll(() => ultimo(pedidos, '/financeiro/lancamentos')?.getAll('categoria')).toEqual(['Aluguel, luz e água']);
      expect(ultimo(pedidos, '/financeiro/lancamentos')?.get('tipo')).toBe('SAIDA');
      await expect(page.getByRole('button', { name: 'Tirar filtro: Categoria: Aluguel, luz e água' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tirar filtro: Tipo: Saídas' })).toBeVisible();

      // Recarregar a página lê a categoria do endereço inteira (a vírgula dela não separa).
      await page.reload();
      await expect(page.getByRole('button', { name: 'Tirar filtro: Categoria: Aluguel, luz e água' })).toBeVisible();
      await expect.poll(() => ultimo(pedidos, '/financeiro/lancamentos')?.getAll('categoria')).toEqual(['Aluguel, luz e água']);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Auditoria: a ação vem do endereço, várias pessoas (e Sistema) vão ao pedido e o ✕ tira a ação', async ({ page }) => {
      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'AUDITORIA_LER'] })),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        'GET /auditoria/pessoas': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }, OUTRA] },
        'GET /auditoria': (_p, route) => json(route, {
          itens: [{ id: 'e1', usuarioId: OUTRA.id, nomeUsuario: OUTRA.nome, acao: 'ALUNO_CRIADO', entidade: 'ALUNO', entidadeId: null, resumo: 'Cadastrou um aluno.', criadoEm: '2026-10-20T13:00:00Z' }],
          total: 1, pagina: 0,
        }),
      });
      await page.goto('/treinador/auditoria?acao=ALUNO_CRIADO');
      await expect(page.getByText('Cadastrou um aluno.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tirar filtro: Ação: Aluno cadastrado' })).toBeVisible();
      expect(ultimo(pedidos, '/auditoria')?.getAll('acao')).toEqual(['ALUNO_CRIADO']);

      const painel = await abrirPainelLateral(page, 'Filtros de eventos');
      await marcar(page, painel, 'Pessoa', 'Todas as pessoas', ['Bia Fictícia', 'Sistema'], false);
      await expect(page).not.toHaveURL(/usuarioId=/);
      await aplicarFiltros(painel);
      await expect.poll(() => ultimo(pedidos, '/auditoria')?.getAll('usuarioId')).toEqual([OUTRA.id, 'sistema']);
      await expect(page.getByRole('button', { name: 'Tirar filtro: Pessoa: Bia Fictícia, Sistema' })).toBeVisible();

      await page.getByRole('button', { name: 'Tirar filtro: Ação: Aluno cadastrado' }).click();
      await expect.poll(() => ultimo(pedidos, '/auditoria')?.has('acao')).toBe(false);
      expect(ultimo(pedidos, '/auditoria')?.getAll('usuarioId')).toEqual([OUTRA.id, 'sistema']);
      await expect(page).not.toHaveURL(/acao=/);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Importação: destino e arquivo do endereço; situação e período pelo painel; Limpar tira tudo', async ({ page }) => {
      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR })),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        'GET /importacoes': { corpo: { itens: [], total: 0, pagina: 0 } },
      });
      // `outros` a pessoa não pode importar: o filtro é ignorado.
      await page.goto('/treinador/importacao?destino=alunos&arquivo=csv&situacao=QUALQUER');
      await expect(page.getByRole('button', { name: 'Tirar filtro: Destino: Alunos' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tirar filtro: Arquivo: CSV (.csv)' })).toBeVisible();
      await expect(page.getByText('Nenhuma importação com esses filtros')).toBeVisible();
      expect([ultimo(pedidos, '/importacoes')?.get('destino'), ultimo(pedidos, '/importacoes')?.get('arquivo'), ultimo(pedidos, '/importacoes')?.get('situacao')])
        .toEqual(['alunos', 'csv', null]);
      expect(ultimo(pedidos, '/importacoes')?.has('busca')).toBe(false);

      const painel = await abrirPainelLateral(page, 'Filtros de importações');
      await opcao(painel, 'Situação', 'Falhou').click();
      await painel.getByRole('textbox', { name: 'De', exact: true }).fill('01/10/2026');
      await aplicarFiltros(painel);
      await expect.poll(() => ultimo(pedidos, '/importacoes')?.get('situacao')).toBe('FALHOU');
      await expect.poll(() => ultimo(pedidos, '/importacoes')?.get('de')).toBe('2026-10-01');
      await expect(page).toHaveURL(/situacao=FALHOU/);
      await expect(page.getByRole('button', { name: 'Tirar filtro: Data: a partir de 01/10/2026' })).toBeVisible();

      await page.getByRole('button', { name: 'Limpar filtros aplicados' }).click();
      await expect.poll(() => ultimo(pedidos, '/importacoes')?.toString()).toBe('pagina=0');
      await expect(page.getByRole('button', { name: /Tirar filtro/ })).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Equipe › Membros: busca local e situação no que já veio', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'EQUIPE_LER'] })),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        'GET /usuarios': { corpo: [membro(1, 'Ana Fictícia'), membro(2, 'Bia Exemplo', { ativo: false, perfilId: 'p-2', perfilNome: 'Assistente' })] },
        'GET /perfis': { corpo: PERFIS },
        'GET /permissoes/catalogo': { corpo: [] },
      });
      await page.goto('/treinador/equipe');
      await expect(page.getByText('Ana Fictícia', { exact: true })).toBeVisible();
      await expect(page.getByText('Bia Exemplo', { exact: true })).toBeVisible();

      await page.getByRole('textbox', { name: 'Buscar' }).fill('bia@');
      await expect(page.getByText('Ana Fictícia', { exact: true })).toHaveCount(0);
      await page.getByRole('textbox', { name: 'Buscar' }).fill('');

      const painel = await abrirPainelLateral(page, 'Filtros de membros');
      await marcar(page, painel, 'Situação', 'Todas', ['Inativos'], false);
      await aplicarFiltros(painel);
      await expect(page.getByText('Ana Fictícia', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Bia Exemplo', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Tirar filtro: Situação: Inativos' }).click();
      await expect(page.getByText('Ana Fictícia', { exact: true })).toBeVisible();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Planejamento › Atualização: arquivados pela API e publicação no que veio', async ({ page }) => {
      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'QUESTIONARIO_ALTERAR'] })),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        'GET /questionarios': (p, route) => json(route, p.busca.get('arquivados') === 'true'
          ? [questionario(3, 'Antigo', { arquivado: true })]
          : p.busca.get('arquivados') === 'todos'
            ? [questionario(1, 'Check-in semanal'), questionario(3, 'Antigo', { arquivado: true })]
            : [questionario(1, 'Check-in semanal'), questionario(2, 'Rascunho novo', { versaoPublicada: 0, publicadoEm: null })]),
      });
      await page.goto('/treinador/planejamento?aba=atualizacao');
      await expect(page.getByText('Check-in semanal', { exact: true })).toBeVisible();

      const painel = await abrirPainelLateral(page, 'Filtros de questionários');
      await opcao(painel, 'Publicação', 'Nunca publicados').click();
      await aplicarFiltros(painel);
      await expect(page.getByText('Check-in semanal', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Rascunho novo', { exact: true })).toBeVisible();

      const painel2 = await abrirPainelLateral(page, 'Filtros de questionários');
      await opcao(painel2, 'Publicação', 'Todos').click();
      await opcao(painel2, 'Situação', 'Arquivados').click();
      await aplicarFiltros(painel2);
      await expect(page.getByText('Antigo', { exact: true })).toBeVisible();
      expect(ultimo(pedidos, '/questionarios')?.get('arquivados')).toBe('true');
      await expect(page.getByRole('button', { name: 'Tirar filtro: Situação: Arquivados' })).toBeVisible();

      // "Todos": ativos e arquivados juntos, numa consulta só.
      const painel3 = await abrirPainelLateral(page, 'Filtros de questionários');
      await opcao(painel3, 'Situação', 'Todos').click();
      await aplicarFiltros(painel3);
      await expect.poll(() => ultimo(pedidos, '/questionarios')?.get('arquivados')).toBe('todos');
      await expect(page.getByText('Antigo', { exact: true })).toBeVisible();
      await expect(page.getByText('Check-in semanal', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tirar filtro: Situação: Ativos e arquivados' })).toBeVisible();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}
