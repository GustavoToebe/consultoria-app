import { expect, test, type Locator, type Page } from '@playwright/test';

import type { MembroEquipe, PerfilEquipe } from '../src/api/equipeTipos';
import type { AtualizacaoDaLista, QuestionarioResumo } from '../src/api/tipos';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso } from './api-falsa';

/**
 * A barra de filtros nas listas do treinador (`docs/planos/filtros-nas-listas.md`, lote 1): Atualizações, Auditoria,
 * Importação, Membros da equipe e Questionários. Cada escolha vai ao pedido da API (ou filtra o que já veio) e, nas listas
 * filtradas pela API, ao endereço; o chip do "Filtrado por" tira o filtro. Só dados fictícios, API simulada.
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

    test('Atualizações: busca pelo nome, responsável e data no pedido e no endereço; a fila leva os filtros', async ({ page }) => {
      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER'] })),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        'GET /painel': { corpo: { atualizacoesParaRevisar: 2, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 0 } },
        'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }, OUTRA] },
        'GET /atualizacoes': { corpo: [atualizacao(1, 'Ana Fictícia'), atualizacao(2, 'Bruno Exemplo')] },
      });
      await page.goto('/treinador/atualizacoes?situacao=PARA_REVISAR');
      await expect(page.getByRole('link', { name: /Ana Fictícia/ })).toBeVisible();
      expect(ultimo(pedidos, '/atualizacoes')?.toString()).toBe('situacao=PARA_REVISAR&meus=false');

      // Busca local: a lista vem inteira.
      await page.getByRole('textbox', { name: 'Buscar' }).fill('bruno');
      await expect(page.getByRole('link', { name: /Ana Fictícia/ })).toHaveCount(0);
      await expect(page.getByRole('link', { name: /Bruno Exemplo/ })).toBeVisible();
      await page.getByRole('textbox', { name: 'Buscar' }).fill('');

      const painel = await abrirFiltros(page, celular);
      await opcao(painel, 'Responsável', 'Bia Fictícia').click();
      await verResultado(page, celular, 'Ver atualizações');
      await expect.poll(() => ultimo(pedidos, '/atualizacoes')?.get('responsavel')).toBe(OUTRA.id);
      expect(ultimo(pedidos, '/atualizacoes')?.has('meus')).toBe(false);
      await expect(page).toHaveURL(new RegExp(`responsavel=${OUTRA.id}`));
      await expect(page.getByRole('button', { name: 'Tirar filtro: Responsável: Bia Fictícia' })).toBeVisible();
      // Com uma pessoa escolhida o número das abas (do /painel, só Todos/Meus) não aparece.
      await expect(page.getByRole('tab', { name: /Para revisar/ })).not.toContainText('2');
      // A revisão em fila segue os mesmos filtros.
      await expect(page.getByRole('link', { name: /Ana Fictícia/ })).toHaveAttribute('href', new RegExp(`responsavel=${OUTRA.id}`));

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
      await page.getByRole('button', { name: 'Tirar filtro: Responsável: Bia Fictícia' }).click();
      await expect.poll(() => ultimo(pedidos, '/atualizacoes')?.get('meus')).toBe('false');
      expect(ultimo(pedidos, '/atualizacoes')?.get('de')).toBe('2026-10-01');
      await expect(page).not.toHaveURL(/responsavel=/);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Auditoria: a ação vem do endereço, a pessoa vai ao pedido e o ✕ tira a ação', async ({ page }) => {
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
      expect(ultimo(pedidos, '/auditoria')?.get('acao')).toBe('ALUNO_CRIADO');

      const painel = await abrirFiltros(page, celular);
      await painel.getByRole('button', { name: 'Pessoa: Todas as pessoas. Escolher.' }).click();
      await page.getByRole('dialog', { name: 'Pessoa' }).getByRole('radio', { name: 'Bia Fictícia', exact: true }).click();
      await verResultado(page, celular, 'Ver eventos');
      await expect.poll(() => ultimo(pedidos, '/auditoria')?.get('usuarioId')).toBe(OUTRA.id);
      await expect(page.getByRole('button', { name: 'Tirar filtro: Pessoa: Bia Fictícia' })).toBeVisible();

      await page.getByRole('button', { name: 'Tirar filtro: Ação: Aluno cadastrado' }).click();
      await expect.poll(() => ultimo(pedidos, '/auditoria')?.has('acao')).toBe(false);
      expect(ultimo(pedidos, '/auditoria')?.get('usuarioId')).toBe(OUTRA.id);
      await expect(page).not.toHaveURL(/acao=/);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Importação: destino e arquivo do endereço; situação pelo painel; Limpar tira tudo', async ({ page }) => {
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
      expect([ultimo(pedidos, '/importacoes')?.get('destino'), ultimo(pedidos, '/importacoes')?.get('busca'), ultimo(pedidos, '/importacoes')?.get('situacao')])
        .toEqual(['alunos', '.csv', null]);

      const painel = await abrirFiltros(page, celular);
      await opcao(painel, 'Situação', 'Falhou').click();
      await verResultado(page, celular, 'Ver importações');
      await expect.poll(() => ultimo(pedidos, '/importacoes')?.get('situacao')).toBe('FALHOU');
      await expect(page).toHaveURL(/situacao=FALHOU/);

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
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  });
}
