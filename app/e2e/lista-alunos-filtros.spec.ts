import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AlunoResumo, PainelTreinador } from '../src/api/tipos';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso, type Resposta } from './api-falsa';

/**
 * Filtros da lista de alunos no painel lateral (`docs/planos/filtros-laterais.md`, frente B; antes, o cartão "Filtros
 * avançados" e a folha de `docs/planos/filtros-da-lista-de-alunos.md`): o botão "Filtros" abre o diálogo "Filtros de
 * alunos" (PC encostado à direita, celular folha de baixo), as escolhas ficam num rascunho e só "Aplicar filtros" as leva
 * ao pedido de `GET /alunos` e ao endereço; os chips do "Filtrando:" têm ✕, "Limpar filtros" tira tudo, o endereço já
 * abre filtrado, o filtro sem permissão some e o Início abre a lista filtrada. Só dados fictícios, API simulada.
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

async function abrir(page: Page, { permissoes = TODAS, acessoTotal = true, lista }: { permissoes?: string[]; acessoTotal?: boolean; lista?: Resposta } = {}) {
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes, perfil: { id: 'p1', nome: acessoTotal ? 'Administrador' : 'Treinador', acessoTotal } })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: PAINEL },
    'GET /alunos': lista ?? { corpo: { itens: ALUNOS, total: ALUNOS.length } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }, OUTRA] },
  });
}

const pedidosDaLista = (pedidos: PedidoFalso[]) => pedidos.filter((x) => x.metodo === 'GET' && x.caminho === '/alunos');
/** O último pedido de `GET /alunos`, como lista de pares (parâmetros repetidos ficam em ordem). */
const ultimoPedido = (pedidos: PedidoFalso[]) => {
  const p = pedidosDaLista(pedidos).at(-1);
  return p ? [...p.busca.entries()] : [];
};
const filtrosDoPedido = (pedidos: PedidoFalso[]) => ultimoPedido(pedidos).filter(([k]) => k !== 'pagina' && k !== 'busca');
const busca = (page: Page) => new URL(page.url()).searchParams;
const botaoFiltros = (page: Page) => page.getByRole('button', { name: /^Filtros, / });
const painelDeFiltros = (page: Page) => page.getByRole('dialog', { name: 'Filtros de alunos' });
const opcao = (onde: Locator, grupo: string, rotulo: string) =>
  onde.getByRole('radiogroup', { name: grupo }).getByRole('radio', { name: rotulo, exact: true });

/** Marca opções numa `SelecaoMultiplaSuspensa` do painel e fecha a lista com Esc (o painel continua aberto). */
async function marcar(page: Page, painel: Locator, rotulo: string, todos: string, opcoes: string[]) {
  await painel.getByRole('button', { name: `${rotulo}: ${todos}. Escolher.` }).click();
  const lista = page.getByRole('dialog', { name: rotulo });
  for (const o of opcoes) await lista.getByRole('checkbox', { name: o }).click();
  await page.keyboard.press('Escape');
  await expect(lista).toHaveCount(0);
  await expect(painel).toBeVisible();
}

for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: altura } });

    test('o botão abre o painel; o rascunho só vai ao pedido e ao endereço no Aplicar; ✕ e Limpar tiram', async ({ page }) => {
      const { naoTratadas, errosDaPagina, pedidos } = await abrir(page);
      await page.goto('/treinador/alunos');
      await expect(page.getByRole('link', { name: /^Abrir Ana Fictícia/ })).toBeVisible();
      expect(filtrosDoPedido(pedidos)).toEqual([['situacao', 'ATIVO'], ['meus', 'false']]);

      // A busca digitada fica quando um filtro muda.
      await page.getByRole('textbox', { name: 'Buscar nome do aluno' }).fill('ana');
      await expect.poll(() => ultimoPedido(pedidos).find(([k]) => k === 'busca')?.[1]).toBe('ana');

      await expect(botaoFiltros(page)).toHaveAccessibleName('Filtros, nenhum ligado');
      await expect(botaoFiltros(page)).toHaveAttribute('aria-haspopup', 'dialog');
      await botaoFiltros(page).click();
      const painel = painelDeFiltros(page);
      await expect(painel).toBeVisible();
      // Grupos em uma coluna: Identificação, Situação e Outros.
      await expect(painel.getByRole('group', { name: 'Identificação' }).getByRole('button', { name: /^Responsável: / })).toBeVisible();
      await expect(painel.getByRole('group', { name: 'Situação' }).getByRole('button', { name: /^Atualização: / })).toBeVisible();
      await expect(painel.getByRole('group', { name: 'Outros' }).getByRole('radiogroup', { name: 'Último registro' })).toBeVisible();

      await opcao(painel, 'Situação', 'Todos').click();
      await marcar(page, painel, 'Acesso ao app', 'Todos', ['Sem acesso', 'Aguardando o primeiro acesso']);
      await opcao(painel, 'Último registro', 'Nunca registrou').click();
      await marcar(page, painel, 'Responsável', 'Todos', ['Bia Fictícia', 'Sem responsável']);

      // Nada foi gravado com o painel aberto.
      expect(busca(page).get('situacao')).toBeNull();
      expect(filtrosDoPedido(pedidos)).toEqual([['situacao', 'ATIVO'], ['meus', 'false']]);
      await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect(painel).toHaveCount(0);

      await expect.poll(() => busca(page).get('situacao')).toBe('TODOS');
      await expect.poll(() => busca(page).get('acesso')).toBe('SEM,AGUARDANDO');
      await expect.poll(() => busca(page).get('registro')).toBe('NUNCA');
      await expect.poll(() => busca(page).get('responsavel')).toBe(`${OUTRA.id},nenhum`);
      await expect.poll(() => filtrosDoPedido(pedidos)).toEqual([
        ['situacao', 'TODOS'], ['meus', 'false'], ['responsavel', OUTRA.id], ['responsavel', 'nenhum'], ['acesso', 'SEM'],
        ['acesso', 'AGUARDANDO'], ['registro', 'NUNCA'],
      ]);

      // A busca continua, e a contagem e os chips dizem o que está ligado.
      await expect(page.getByRole('textbox', { name: 'Buscar nome do aluno' })).toHaveValue('ana');
      await expect(botaoFiltros(page)).toHaveAccessibleName('Filtros, 4 ligados');
      const filtrado = page.getByRole('group', { name: 'Filtros aplicados' });
      await expect(filtrado.getByRole('button')).toHaveCount(4);
      await expect(filtrado.getByRole('button', { name: 'Tirar filtro: Responsável: Bia Fictícia, Sem responsável' })).toBeVisible();

      await filtrado.getByRole('button', { name: 'Tirar filtro: Acesso: Sem acesso, Aguardando o primeiro acesso' }).click();
      await expect.poll(() => busca(page).get('acesso')).toBeNull();
      await expect.poll(() => filtrosDoPedido(pedidos).some(([k]) => k === 'acesso')).toBe(false);
      expect(busca(page).get('registro')).toBe('NUNCA');
      await expect(botaoFiltros(page)).toHaveAccessibleName('Filtros, 3 ligados');

      await page.getByRole('button', { name: 'Limpar filtros aplicados' }).click();
      await expect.poll(() => [...busca(page).keys()]).toEqual([]);
      await expect.poll(() => filtrosDoPedido(pedidos)).toEqual([['situacao', 'ATIVO'], ['meus', 'false']]);
      await expect(page.getByRole('group', { name: 'Filtros aplicados' })).toHaveCount(0);

      // Os antigos atalhos com contagem saíram: nenhum pedido de `tamanho=1` só para contar.
      expect(pedidosDaLista(pedidos).some((p) => p.busca.get('tamanho') === '1')).toBe(false);
      await expect(page.getByRole('radiogroup', { name: 'Mostrar alunos' })).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Selecionar: filtro novo ou busca que limpa o lote avisa; sem nada marcado, não avisa (D9, como Cobranças)', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page);
      await page.goto('/treinador/alunos');
      await expect(page.getByRole('link', { name: /^Abrir Ana Fictícia/ })).toBeVisible();
      await page.getByRole('button', { name: 'Selecionar', exact: true }).click();

      // Nada marcado: aplicar um filtro não avisa nada.
      await botaoFiltros(page).click();
      let painel = painelDeFiltros(page);
      await marcar(page, painel, 'Acesso ao app', 'Todos', ['Sem acesso']);
      await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect.poll(() => busca(page).get('acesso')).toBe('SEM');
      await expect(page.getByText(/saíram? da seleção|foi limpa/)).toHaveCount(0);

      // Com dois marcados, um filtro diferente limpa e diz quantos saíram; Aplicar sem mudar nada mantém.
      await page.getByRole('checkbox', { name: 'Ana Fictícia' }).click();
      await page.getByRole('checkbox', { name: 'Bruno Exemplo' }).click();
      await expect(page.getByText('2 alunos marcados', { exact: false })).toBeVisible();
      await botaoFiltros(page).click();
      painel = painelDeFiltros(page);
      await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect(painel).toHaveCount(0);
      await expect(page.getByText('2 alunos marcados', { exact: false })).toBeVisible();
      await expect(page.getByText(/saíram? da seleção|foi limpa/)).toHaveCount(0);

      await botaoFiltros(page).click();
      painel = painelDeFiltros(page);
      await opcao(painel, 'Último registro', 'Nunca registrou').click();
      await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect(page.getByText('Os 2 alunos marcados saíram da seleção porque os filtros mudaram.')).toBeVisible();
      await expect(page.getByText('Nenhum aluno marcado', { exact: false })).toBeVisible();

      // Um marcado e a busca muda: limpa e avisa (uma vez só, digitar mais não repete).
      await page.getByRole('checkbox', { name: 'Ana Fictícia' }).click();
      await expect(page.getByText('1 aluno marcado', { exact: false })).toBeVisible();
      await page.getByRole('textbox', { name: 'Buscar nome do aluno' }).fill('an');
      await expect(page.getByText('A seleção de alunos foi limpa porque a lista mudou.')).toBeVisible();
      await expect(page.getByText('Nenhum aluno marcado', { exact: false })).toBeVisible();
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    test('Selecionar com a resposta do filtro novo atrasada: nada do filtro anterior se marca (nem por teclado) e o botão espera', async ({ page }) => {
      const NOVOS = [aluno(3, 'Carla Nova'), aluno(4, 'Davi Novo')];
      let soltar: () => void = () => {};
      const espera = new Promise<void>((r) => { soltar = r; });
      // Com o filtro de acesso a lista nova só vem depois do `soltar`; sem ele, a de sempre.
      const { naoTratadas, errosDaPagina } = await abrir(page, {
        lista: async (pedido, route) => {
          if (!pedido.busca.has('acesso')) return json(route, { itens: ALUNOS, total: ALUNOS.length });
          await espera;
          return json(route, { itens: NOVOS, total: NOVOS.length });
        },
      });
      await page.goto('/treinador/alunos');
      await expect(page.getByRole('link', { name: /^Abrir Ana Fictícia/ })).toBeVisible();
      await page.getByRole('button', { name: 'Selecionar', exact: true }).click();

      await botaoFiltros(page).click();
      const painel = painelDeFiltros(page);
      await marcar(page, painel, 'Acesso ao app', 'Todos', ['Sem acesso']);
      await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect(painel).toHaveCount(0);

      // A lista à vista ainda é a do filtro anterior; o botão espera e diz por quê.
      const marcarVisiveis = page.getByRole('button', { name: 'Marcar visíveis', exact: true });
      await expect(marcarVisiveis).toBeDisabled();
      await expect(page.getByText('Carregando o filtro novo.')).toBeVisible();
      await expect(page.getByRole('checkbox', { name: 'Ana Fictícia' })).toBeVisible();
      await marcarVisiveis.click({ force: true });
      // Por teclado (o `pointer-events: none` da lista esmaecida não tira o foco): também não marca.
      await page.getByRole('checkbox', { name: 'Ana Fictícia' }).focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('checkbox', { name: 'Ana Fictícia' })).toHaveAttribute('aria-checked', 'false');
      await expect(page.getByText('Nenhum aluno marcado', { exact: false })).toBeVisible();

      // Resposta chegou: a lista é a nova e marcar vale só para ela.
      soltar();
      await expect(page.getByRole('checkbox', { name: 'Carla Nova' })).toBeVisible();
      await expect(page.getByRole('checkbox', { name: 'Ana Fictícia' })).toHaveCount(0);
      await expect(marcarVisiveis).toBeEnabled();
      await expect(page.getByText('Carregando o filtro novo.')).toHaveCount(0);
      await expect(page.getByText('Nenhum aluno marcado', { exact: false })).toBeVisible();
      await marcarVisiveis.click();
      await expect(page.getByText('2 alunos marcados', { exact: false })).toBeVisible();
      await expect(page.getByRole('checkbox', { name: 'Carla Nova' })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('checkbox', { name: 'Davi Novo' })).toHaveAttribute('aria-checked', 'true');
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

    test('sem a permissão o filtro some e não vai à API; quem começa nos seus limpa, aplica e o recarregar mantém todos', async ({ page }) => {
      const { errosDaPagina, pedidos } = await abrir(page, { permissoes: PERMISSOES_TREINADOR, acessoTotal: false });
      await page.goto('/treinador/alunos?registro=NUNCA&plano=COM&atualizacao=ATRASADA&acesso=SEM');
      await expect(page.getByRole('link', { name: /^Abrir Ana Fictícia/ })).toBeVisible();
      // Sem `meus` no endereço, o membro abre nos próprios alunos (como antes); o resto sem permissão é tirado.
      await expect.poll(() => filtrosDoPedido(pedidos)).toEqual([['situacao', 'ATIVO'], ['meus', 'true'], ['acesso', 'SEM']]);

      await botaoFiltros(page).click();
      const painel = painelDeFiltros(page);
      await expect(painel.getByRole('button', { name: /^Acesso ao app: / })).toBeVisible();
      await expect(painel.getByRole('button', { name: 'Responsável: Meus alunos. Escolher.' })).toBeVisible();
      await expect(painel.getByRole('button', { name: /^Atualização: / })).toHaveCount(0);
      await expect(painel.getByRole('radiogroup', { name: 'Plano em uso' })).toHaveCount(0);
      await expect(painel.getByRole('radiogroup', { name: 'Pasta' })).toHaveCount(0);
      await expect(painel.getByRole('radiogroup', { name: 'Último registro' })).toHaveCount(0);
      // Sem plano nem registro, o grupo "Outros" nem aparece.
      await expect(painel.getByRole('group', { name: 'Outros' })).toHaveCount(0);

      // "Limpar filtros" do painel limpa só o rascunho; "Aplicar filtros" mostra todos os ativos: para quem começa nos
      // seus, o endereço diz meus=false.
      await painel.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
      await expect(painel.getByRole('button', { name: 'Responsável: Todos. Escolher.' })).toBeVisible();
      expect(busca(page).get('meus')).toBeNull();
      await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect(painel).toHaveCount(0);
      await expect.poll(() => busca(page).get('meus')).toBe('false');
      await expect.poll(() => filtrosDoPedido(pedidos)).toEqual([['situacao', 'ATIVO'], ['meus', 'false']]);

      // Recarregar não volta para "Meus alunos".
      await page.reload();
      await expect(page.getByRole('link', { name: /^Abrir Ana Fictícia/ })).toBeVisible();
      await expect.poll(() => filtrosDoPedido(pedidos)).toEqual([['situacao', 'ATIVO'], ['meus', 'false']]);
      await expect(botaoFiltros(page)).toHaveAccessibleName('Filtros, nenhum ligado');
      expect(errosDaPagina).toEqual([]);
    });

    test('o filtro Atualização do painel faz o que o antigo atalho "Para revisar" fazia, sem pedido só para contar', async ({ page }) => {
      const { errosDaPagina, pedidos } = await abrir(page);
      await page.goto('/treinador/alunos');
      await expect(page.getByRole('link', { name: /^Abrir Ana Fictícia/ })).toBeVisible();
      await expect(page.getByRole('radiogroup', { name: 'Mostrar alunos' })).toHaveCount(0);

      await botaoFiltros(page).click();
      const painel = painelDeFiltros(page);
      await marcar(page, painel, 'Atualização', 'Todos', ['Para revisar']);
      await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect.poll(() => busca(page).get('atualizacao')).toBe('ENVIADA');
      await expect.poll(() => filtrosDoPedido(pedidos)).toEqual([['situacao', 'ATIVO'], ['meus', 'false'], ['atualizacao', 'ENVIADA']]);
      await expect(page.getByRole('button', { name: 'Tirar filtro: Atualização: Para revisar' })).toBeVisible();
      expect(pedidosDaLista(pedidos).some((p) => p.busca.get('tamanho') === '1')).toBe(false);
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
