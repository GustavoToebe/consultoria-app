import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AlunoResumo, PainelTreinador } from '../src/api/tipos';
import { PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso } from './api-falsa';

/**
 * Filtros avançados da lista de alunos (`docs/planos/filtros-da-lista-de-alunos.md`, 31/10): o botão "Filtros" abre o
 * painel (PC) ou a folha (celular), cada escolha vai para o pedido de `GET /alunos` e para o endereço, os chips do
 * "Filtrado por" têm ✕, "Limpar filtros" tira tudo, o endereço já abre filtrado, o filtro sem permissão some e o Início
 * abre a lista filtrada. Só dados fictícios, API simulada.
 */
const ontem = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
const OUTRA = { id: 'u0000000-0000-4000-8000-000000000007', nome: 'Bia Fictícia' };

function aluno(n: number, nome: string, extra: Partial<AlunoResumo> = {}): AlunoResumo {
  return {
    id: `a0000000-0000-4000-8000-00000000000${n}`, nome, ativo: true, temAcesso: true, planoAtivo: null, ultimoRegistro: ontem,
    responsavelId: TREINADOR.id, atualizacao: null, ...extra,
  };
}
const ALUNOS = [aluno(1, 'Ana Fictícia'), aluno(2, 'Bruno Exemplo', { temAcesso: false })];

const TODAS = [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER', 'TREINO_LER', 'REGISTRO_LER'];

const PAINEL: PainelTreinador = {
  atualizacoesParaRevisar: 0, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 0, alunosAtivos: 2,
  alunosSemRegistro: [], ultimasExecucoes: [], planosTerminando: [], pastasARenovar: 0, pastasParaRenovar: [],
  alunosSemPastaComPeriodo: 2, alunosSemRegistroTotal: 0, alunosSemAcesso: 1, alunosInativos: 1, sessoesConcluidas7Dias: null,
};

async function abrir(page: Page, { permissoes = TODAS, acessoTotal = true } = {}) {
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes, perfil: { id: 'p1', nome: acessoTotal ? 'Administrador' : 'Treinador', acessoTotal } })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: PAINEL },
    'GET /alunos': { corpo: { itens: ALUNOS, total: ALUNOS.length } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }, OUTRA] },
  });
}

/** O último pedido de `GET /alunos`, como lista de pares (parâmetros repetidos ficam em ordem). */
const ultimoPedido = (pedidos: PedidoFalso[]) => {
  const p = pedidos.filter((x) => x.metodo === 'GET' && x.caminho === '/alunos').at(-1);
  return p ? [...p.busca.entries()] : [];
};
const filtrosDoPedido = (pedidos: PedidoFalso[]) => ultimoPedido(pedidos).filter(([k]) => k !== 'pagina' && k !== 'busca');
const busca = (page: Page) => new URL(page.url()).searchParams;
const botaoFiltros = (page: Page) => page.getByRole('button', { name: /^Filtros, / });
const opcao = (onde: Locator, grupo: string, rotulo: string) =>
  onde.getByRole('radiogroup', { name: grupo }).getByRole('button', { name: rotulo, exact: true });

for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: altura } });
    const celular = largura < 768;

    test('o botão abre os filtros; cada escolha vai ao pedido e ao endereço; ✕ e Limpar tiram', async ({ page }) => {
      const { naoTratadas, errosDaPagina, pedidos } = await abrir(page);
      await page.goto('/treinador/alunos');
      await expect(page.getByRole('link', { name: /^Abrir Ana Fictícia/ })).toBeVisible();
      expect(filtrosDoPedido(pedidos)).toEqual([['situacao', 'ATIVO'], ['meus', 'false']]);

      // A busca digitada fica quando um filtro muda.
      await page.getByRole('textbox', { name: 'Buscar' }).fill('ana');
      await expect.poll(() => ultimoPedido(pedidos).find(([k]) => k === 'busca')?.[1]).toBe('ana');

      await expect(botaoFiltros(page)).toHaveAccessibleName('Filtros, nenhum ligado');
      await expect(botaoFiltros(page)).toHaveAttribute('aria-expanded', 'false');
      await botaoFiltros(page).click();
      // PC: o cartão "Filtros avançados" abaixo da barra, e cada escolha vale na hora. Celular: a folha "Filtros", com as
      // escolhas gravadas quando ela fecha.
      const painel = celular ? page.getByRole('dialog', { name: 'Filtros' }) : page.locator('body');
      if (celular) await expect(painel).toBeVisible();
      else {
        await expect(page.getByRole('heading', { name: 'Filtros avançados' })).toBeVisible();
        await expect(botaoFiltros(page)).toHaveAttribute('aria-expanded', 'true');
      }

      await opcao(painel, 'Situação', 'Todos').click();
      if (!celular) {
        await expect.poll(() => busca(page).get('situacao')).toBe('TODOS');
        await expect.poll(() => filtrosDoPedido(pedidos)).toEqual([['situacao', 'TODOS'], ['meus', 'false']]);
      }

      await painel.getByRole('button', { name: 'Acesso ao app: Todos. Escolher.' }).click();
      const lista = page.getByRole('dialog', { name: 'Acesso ao app' });
      await lista.getByRole('checkbox', { name: 'Sem acesso' }).click();
      await lista.getByRole('checkbox', { name: 'Aguardando o primeiro acesso' }).click();
      if (celular) await lista.getByRole('button', { name: 'Fechar', exact: true }).click();
      else await page.keyboard.press('Escape');
      await expect(lista).toHaveCount(0);
      if (!celular) {
        await expect.poll(() => busca(page).get('acesso')).toBe('SEM,AGUARDANDO');
        await expect.poll(() => filtrosDoPedido(pedidos)).toEqual([['situacao', 'TODOS'], ['meus', 'false'], ['acesso', 'SEM'], ['acesso', 'AGUARDANDO']]);
      }

      await opcao(painel, 'Último registro', 'Nunca registrou').click();

      await painel.getByRole('button', { name: 'Responsável: Todos. Escolher.' }).click();
      const resp = page.getByRole('dialog', { name: 'Responsável' });
      await resp.getByRole('checkbox', { name: 'Bia Fictícia' }).click();
      await resp.getByRole('checkbox', { name: 'Sem responsável' }).click();
      if (celular) await resp.getByRole('button', { name: 'Fechar', exact: true }).click();
      else await page.keyboard.press('Escape');
      await expect(resp).toHaveCount(0);

      if (celular) {
        // Nada foi gravado com a folha aberta; "Ver alunos" fecha e grava tudo de uma vez.
        expect(busca(page).get('situacao')).toBeNull();
        await painel.getByRole('button', { name: 'Ver alunos' }).click();
        await expect(painel).toHaveCount(0);
      }
      await expect.poll(() => busca(page).get('situacao')).toBe('TODOS');
      await expect.poll(() => busca(page).get('acesso')).toBe('SEM,AGUARDANDO');
      await expect.poll(() => busca(page).get('registro')).toBe('NUNCA');
      await expect.poll(() => busca(page).get('responsavel')).toBe(`${OUTRA.id},nenhum`);
      await expect.poll(() => filtrosDoPedido(pedidos)).toEqual([
        ['situacao', 'TODOS'], ['meus', 'false'], ['responsavel', OUTRA.id], ['responsavel', 'nenhum'], ['acesso', 'SEM'],
        ['acesso', 'AGUARDANDO'], ['registro', 'NUNCA'],
      ]);

      // A busca continua, e a contagem e os chips dizem o que está ligado.
      await expect(page.getByRole('textbox', { name: 'Buscar' })).toHaveValue('ana');
      await expect(botaoFiltros(page)).toHaveAccessibleName('Filtros, 4 ligados');
      const filtrado = page.getByRole('list', { name: 'Filtrado por' });
      await expect(filtrado.getByRole('button')).toHaveCount(4);
      await expect(filtrado.getByRole('button', { name: 'Tirar filtro: Responsável: Bia Fictícia, Sem responsável' })).toBeVisible();

      await filtrado.getByRole('button', { name: 'Tirar filtro: Acesso: Sem acesso, Aguardando o primeiro acesso' }).click();
      await expect.poll(() => busca(page).get('acesso')).toBeNull();
      await expect.poll(() => filtrosDoPedido(pedidos).some(([k]) => k === 'acesso')).toBe(false);
      expect(busca(page).get('registro')).toBe('NUNCA');
      await expect(botaoFiltros(page)).toHaveAccessibleName('Filtros, 3 ligados');

      await page.getByRole('button', { name: 'Limpar filtros', exact: true }).first().click();
      await expect.poll(() => [...busca(page).keys()]).toEqual([]);
      await expect.poll(() => filtrosDoPedido(pedidos)).toEqual([['situacao', 'ATIVO'], ['meus', 'false']]);
      await expect(page.getByRole('list', { name: 'Filtrado por' })).toHaveCount(0);

      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('o endereço já abre filtrado; valor desconhecido é ignorado', async ({ page }) => {
      const { errosDaPagina, pedidos } = await abrir(page);
      await page.goto('/treinador/alunos?acesso=SEM,AGUARDANDO&registro=NUNCA&atualizacao=SEM_PASTA,TALVEZ&plano=COM&pasta=A_RENOVAR&situacao=INATIVO');
      await expect(page.getByRole('link', { name: /^Abrir Ana Fictícia/ })).toBeVisible();
      await expect.poll(() => filtrosDoPedido(pedidos)).toEqual([
        ['situacao', 'INATIVO'], ['meus', 'false'], ['acesso', 'SEM'], ['acesso', 'AGUARDANDO'], ['atualizacao', 'SEM_PASTA'],
        ['plano', 'COM'], ['pasta', 'A_RENOVAR'], ['registro', 'NUNCA'],
      ]);
      await expect(botaoFiltros(page)).toHaveAccessibleName('Filtros, 6 ligados');
      await expect(page.getByRole('button', { name: 'Tirar filtro: Atualização: Sem pasta com período' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tirar filtro: Pasta a renovar' })).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });

    test('sem a permissão o filtro some e não vai à API; quem não tem acesso total começa nos seus', async ({ page }) => {
      const { errosDaPagina, pedidos } = await abrir(page, { permissoes: PERMISSOES_TREINADOR, acessoTotal: false });
      await page.goto('/treinador/alunos?registro=NUNCA&plano=COM&atualizacao=ATRASADA&acesso=SEM');
      await expect(page.getByRole('link', { name: /^Abrir Ana Fictícia/ })).toBeVisible();
      // Sem `meus` no endereço, o membro abre nos próprios alunos (como antes); o resto sem permissão é tirado.
      await expect.poll(() => filtrosDoPedido(pedidos)).toEqual([['situacao', 'ATIVO'], ['meus', 'true'], ['acesso', 'SEM']]);

      await botaoFiltros(page).click();
      const painel = celular ? page.getByRole('dialog', { name: 'Filtros' }) : page.locator('body');
      await expect(painel.getByRole('button', { name: /^Acesso ao app: / })).toBeVisible();
      await expect(painel.getByRole('button', { name: 'Responsável: Meus alunos. Escolher.' })).toBeVisible();
      await expect(painel.getByRole('button', { name: /^Atualização: / })).toHaveCount(0);
      await expect(painel.getByRole('radiogroup', { name: 'Plano em uso' })).toHaveCount(0);
      await expect(painel.getByRole('radiogroup', { name: 'Pasta' })).toHaveCount(0);
      await expect(painel.getByRole('radiogroup', { name: 'Último registro' })).toHaveCount(0);

      // "Limpar filtros" mostra todos os ativos: para quem começa nos seus, o endereço diz meus=false.
      await painel.getByRole('button', { name: 'Limpar filtros', exact: true }).first().click();
      if (celular) await painel.getByRole('button', { name: 'Ver alunos' }).click();
      await expect.poll(() => busca(page).get('meus')).toBe('false');
      await expect.poll(() => filtrosDoPedido(pedidos)).toEqual([['situacao', 'ATIVO'], ['meus', 'false']]);
      expect(errosDaPagina).toEqual([]);
    });

    test('o Início abre a lista filtrada e o voltar sai da tela', async ({ page }) => {
      const { errosDaPagina, pedidos } = await abrir(page, { acessoTotal: true });
      await page.goto('/treinador');
      await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
      const semAcesso = page.getByRole('link', { name: /^Ativos sem acesso: 1/ });
      await expect(semAcesso).toHaveAttribute('href', '/treinador/alunos?acesso=SEM&meus=false');
      await semAcesso.click();
      await expect(page).toHaveURL(/\/treinador\/alunos\?/);
      await expect.poll(() => filtrosDoPedido(pedidos)).toEqual([['situacao', 'ATIVO'], ['meus', 'false'], ['acesso', 'SEM']]);
      await expect(page.getByRole('button', { name: 'Tirar filtro: Acesso: Sem acesso' })).toBeVisible();

      // Trocar o filtro não empilha histórico: um voltar leva ao Início.
      await page.getByRole('button', { name: 'Tirar filtro: Acesso: Sem acesso' }).click();
      await expect.poll(() => busca(page).get('acesso')).toBeNull();
      await page.goBack();
      await expect(page).toHaveURL(/\/treinador$/);

      await expect(page.getByRole('link', { name: /^Inativos: 1/ })).toHaveAttribute('href', '/treinador/alunos?situacao=INATIVO&meus=false');
      expect(errosDaPagina).toEqual([]);
    });
  });
}
