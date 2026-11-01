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
 * "Filtrado por" tira o filtro. Só dados fictícios, API simulada.
 */
const OUTRA = { id: 'u0000000-0000-4000-8000-000000000007', nome: 'Bia Fictícia' };

const ultimo = (pedidos: PedidoFalso[], caminho: string) => pedidos.filter((p) => p.metodo === 'GET' && p.caminho === caminho).at(-1)?.busca;
const botaoFiltros = (page: Page) => page.getByRole('button', { name: /^Filtros, / });
const opcao = (onde: Locator, grupo: string, rotulo: string) =>
  onde.getByRole('radiogroup', { name: grupo }).getByRole('button', { name: rotulo, exact: true });

/** Abre os filtros: no PC o painel fica na página; no celular, a folha "Filtros". */
async function abrirFiltros(page: Page, celular: boolean): Promise<Locator> {
  if (celular || (await botaoFiltros(page).getAttribute('aria-expanded')) !== 'true') await botaoFiltros(page).click();
  const painel = celular ? page.getByRole('dialog', { name: 'Filtros' }) : page.locator('body');
  if (celular) await expect(painel).toBeVisible();
  return painel;
}

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

/** No celular as escolhas valem quando a folha fecha. */
async function verResultado(page: Page, celular: boolean, rotulo: string) {
  if (celular) await page.getByRole('button', { name: rotulo, exact: true }).click();
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
    perfilNome: 'Treinador', ativo: true, convitePendente: false, conviteExpiraEm: null, ultimoAcesso: null, ...extra,
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
        'GET /atualizacoes': (p, route) => json(route, p.busca.get('busca') === 'bruno'
          ? [atualizacao(2, 'Bruno Exemplo')] : [atualizacao(1, 'Ana Fictícia'), atualizacao(2, 'Bruno Exemplo')]),
        'GET /atualizacoes/contagens': (p, route) => json(route, p.busca.has('responsavel')
          ? { PARA_REVISAR: 1, ATRASADAS: 0, AVISARAM_ATRASO: 0, PROXIMAS: 0 } : { PARA_REVISAR: 2, ATRASADAS: 0, AVISARAM_ATRASO: 0, PROXIMAS: 0 }),
      });
      await page.goto('/treinador/atualizacoes?situacao=PARA_REVISAR');
      await expect(page.getByRole('link', { name: /Ana Fictícia/ })).toBeVisible();
      expect(ultimo(pedidos, '/atualizacoes')?.toString()).toBe('situacao=PARA_REVISAR&meus=false');
      await expect(page.getByRole('tab', { name: /Para revisar/ })).toContainText('2');

      // A busca vai à API (300 ms depois de digitar) e segue para a fila.
      await page.getByRole('textbox', { name: 'Buscar' }).fill('bruno');
      await expect.poll(() => ultimo(pedidos, '/atualizacoes')?.get('busca')).toBe('bruno');
      await expect(page.getByRole('link', { name: /Ana Fictícia/ })).toHaveCount(0);
      await expect(page.getByRole('link', { name: /Bruno Exemplo/ })).toHaveAttribute('href', /busca=bruno/);
      expect(ultimo(pedidos, '/atualizacoes/contagens')?.get('busca')).toBe('bruno');
      await page.getByRole('textbox', { name: 'Buscar' }).fill('');
      await expect(page.getByRole('link', { name: /Ana Fictícia/ })).toBeVisible();

      // Vários responsáveis: Bia e Sem responsável.
      const painel = await abrirFiltros(page, celular);
      await marcar(page, painel, 'Responsável', 'Todos', ['Bia Fictícia', 'Sem responsável'], celular);
      await verResultado(page, celular, 'Ver atualizações');
      await expect.poll(() => ultimo(pedidos, '/atualizacoes')?.getAll('responsavel')).toEqual([OUTRA.id, 'nenhum']);
      expect(ultimo(pedidos, '/atualizacoes')?.has('meus')).toBe(false);
      await expect(page).toHaveURL(new RegExp(`responsavel=${OUTRA.id}(%2C|,)nenhum`));
      await expect(page.getByRole('button', { name: 'Tirar filtro: Responsável: Bia Fictícia, Sem responsável' })).toBeVisible();
      // As abas contam com os mesmos filtros (GET /atualizacoes/contagens).
      await expect.poll(() => ultimo(pedidos, '/atualizacoes/contagens')?.getAll('responsavel')).toEqual([OUTRA.id, 'nenhum']);
      await expect(page.getByRole('tab', { name: /Para revisar/ })).toContainText('1');
      // A revisão em fila segue os mesmos filtros.
      await expect(page.getByRole('link', { name: /Ana Fictícia/ })).toHaveAttribute('href', new RegExp(`responsavel=${OUTRA.id}%2Cnenhum`));

      // Data: só vale com as duas pontas (a rota só aceita o par).
      const painel2 = await abrirFiltros(page, celular);
      await painel2.getByRole('textbox', { name: 'De', exact: true }).fill('01/10/2026');
      await expect(painel2.getByText('Preencha as duas datas.')).toBeVisible();
      await painel2.getByRole('textbox', { name: 'Até', exact: true }).fill('31/10/2026');
      await verResultado(page, celular, 'Ver atualizações');
      await expect.poll(() => ultimo(pedidos, '/atualizacoes')?.get('ate')).toBe('2026-10-31');
      expect(ultimo(pedidos, '/atualizacoes')?.get('de')).toBe('2026-10-01');
      await expect(page.getByRole('button', { name: 'Tirar filtro: Data: 01/10/2026 a 31/10/2026' })).toBeVisible();
      await expect(page.getByRole('link', { name: /Ana Fictícia/ })).toHaveAttribute('href', /de=2026-10-01&ate=2026-10-31/);

      // O ✕ tira só aquele filtro.
      await page.getByRole('button', { name: 'Tirar filtro: Responsável: Bia Fictícia, Sem responsável' }).click();
      await expect.poll(() => ultimo(pedidos, '/atualizacoes')?.get('meus')).toBe('false');
      expect(ultimo(pedidos, '/atualizacoes')?.get('de')).toBe('2026-10-01');
      await expect(page).not.toHaveURL(/responsavel=/);
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

      const painel = await abrirFiltros(page, celular);
      await marcar(page, painel, 'Responsável', 'Toda a equipe', ['Meus', 'Bia Fictícia'], celular);
      await marcar(page, painel, 'Origem', 'Todas', ['Instagram', 'Não informada'], celular);
      await painel.getByRole('group', { name: 'Entrada' }).getByRole('textbox', { name: 'De', exact: true }).fill('01/10/2026');
      await painel.getByRole('group', { name: 'Última atividade' }).getByRole('textbox', { name: 'Até', exact: true }).fill('31/10/2026');
      await verResultado(page, celular, 'Ver inscrições');
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

    test('Cobranças: busca pelo aluno, várias situações, plano e forma; o aluno vem do endereço e o ✕ o tira', async ({ page }) => {
      await fixarHoje(page);
      const PLANO = 'b0000000-0000-4000-8000-0000000000f1';
      const paga = { ...COBRANCA_ATRASADA, id: 'c0000000-0000-4000-8000-0000000000a9', alunoNome: 'Bruno Exemplo', situacao: 'PAGA' as const,
        vencida: false, diasDeAtraso: 0, pagoEm: '2026-10-18', forma: 'PIX' as const, provedor: 'INFINITEPAY' };
      const estado = estadoFinanceiro({ cobrancas: [COBRANCA_ATRASADA, paga] });
      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessaoComFinanceiro(page, undefined, false)),
        ...rotasDoFinanceiro(estado),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        'GET /financeiro/planos': (p, route) => json(route, p.busca.get('arquivados') === 'true' ? []
          : [{ id: PLANO, nome: 'Consultoria mensal', valorCentavos: 15_000, periodicidade: 'MENSAL', arquivado: false, criadoEm: '2026-10-01T12:00:00Z', versao: 0 }]),
      });
      await page.goto(`/treinador/financeiro?aba=cobrancas&alunoId=${COBRANCA_ATRASADA.alunoId}`);
      await expect(page.getByRole('button', { name: `Tirar filtro: Aluno: ${COBRANCA_ATRASADA.alunoNome}` })).toBeVisible();
      expect(ultimo(pedidos, '/financeiro/cobrancas')?.get('alunoId')).toBe(COBRANCA_ATRASADA.alunoId);
      await page.getByRole('button', { name: `Tirar filtro: Aluno: ${COBRANCA_ATRASADA.alunoNome}` }).click();
      await expect.poll(() => ultimo(pedidos, '/financeiro/cobrancas')?.has('alunoId')).toBe(false);

      await page.getByRole('textbox', { name: 'Buscar' }).fill('bruno');
      await expect.poll(() => ultimo(pedidos, '/financeiro/cobrancas')?.get('busca')).toBe('bruno');
      await expect(page.getByText('Bruno Exemplo', { exact: true }).first()).toBeVisible();
      await page.getByRole('textbox', { name: 'Buscar' }).fill('');

      const painel = await abrirFiltros(page, celular);
      await marcar(page, painel, 'Situação', 'Todas', ['Vencidas', 'Pagas'], celular);
      await opcao(painel, 'Plano', 'Consultoria mensal').click();
      await opcao(painel, 'Forma da baixa', 'Pagamento online').click();
      await verResultado(page, celular, 'Ver cobranças');
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

      const painel = await abrirFiltros(page, celular);
      await opcao(painel, 'Tipo', 'Saídas').click();
      await marcar(page, painel, 'Categoria', 'Todas', ['Aluguel, luz e água'], celular);
      await verResultado(page, celular, 'Ver lançamentos');
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

      const painel = await abrirFiltros(page, celular);
      await marcar(page, painel, 'Pessoa', 'Todas as pessoas', ['Bia Fictícia', 'Sistema'], celular);
      await verResultado(page, celular, 'Ver eventos');
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

      const painel = await abrirFiltros(page, celular);
      await opcao(painel, 'Situação', 'Falhou').click();
      await painel.getByRole('textbox', { name: 'De', exact: true }).fill('01/10/2026');
      await verResultado(page, celular, 'Ver importações');
      await expect.poll(() => ultimo(pedidos, '/importacoes')?.get('situacao')).toBe('FALHOU');
      await expect.poll(() => ultimo(pedidos, '/importacoes')?.get('de')).toBe('2026-10-01');
      await expect(page).toHaveURL(/situacao=FALHOU/);
      await expect(page.getByRole('button', { name: 'Tirar filtro: Data: a partir de 01/10/2026' })).toBeVisible();

      await page.getByRole('button', { name: 'Limpar filtros' }).first().click();
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

      const painel = await abrirFiltros(page, celular);
      await painel.getByRole('button', { name: 'Situação: Todas. Escolher.' }).click();
      const lista = page.getByRole('dialog', { name: 'Situação' });
      await lista.getByRole('checkbox', { name: 'Inativos' }).click();
      if (celular) await lista.getByRole('button', { name: 'Fechar' }).click();
      else await page.keyboard.press('Escape');
      await verResultado(page, celular, 'Ver membros');
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

      const painel = await abrirFiltros(page, celular);
      await opcao(painel, 'Publicação', 'Nunca publicados').click();
      await verResultado(page, celular, 'Ver questionários');
      await expect(page.getByText('Check-in semanal', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Rascunho novo', { exact: true })).toBeVisible();

      const painel2 = await abrirFiltros(page, celular);
      await opcao(painel2, 'Publicação', 'Todos').click();
      await opcao(painel2, 'Situação', 'Arquivados').click();
      await verResultado(page, celular, 'Ver questionários');
      await expect(page.getByText('Antigo', { exact: true })).toBeVisible();
      expect(ultimo(pedidos, '/questionarios')?.get('arquivados')).toBe('true');
      await expect(page.getByRole('button', { name: 'Tirar filtro: Situação: Arquivados' })).toBeVisible();

      // "Todos": ativos e arquivados juntos, numa consulta só.
      const painel3 = await abrirFiltros(page, celular);
      await opcao(painel3, 'Situação', 'Todos').click();
      await verResultado(page, celular, 'Ver questionários');
      await expect.poll(() => ultimo(pedidos, '/questionarios')?.get('arquivados')).toBe('todos');
      await expect(page.getByText('Antigo', { exact: true })).toBeVisible();
      await expect(page.getByText('Check-in semanal', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tirar filtro: Situação: Ativos e arquivados' })).toBeVisible();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}
