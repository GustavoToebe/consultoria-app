import { expect, test, type Locator, type Page } from '@playwright/test';

import type { MembroEquipe, PerfilEquipe } from '../src/api/equipeTipos';
import type { AlunoResumo, AtualizacaoDaLista } from '../src/api/tipos';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { fixarHoje } from './aluno';
import { estadoFinanceiro, rotasDoFinanceiro, sessaoComFinanceiro } from './financeiro-falso';
import { contagensFalsas, resumoFalso, rotasDaTela } from './inscricoes-falsas';

/**
 * Frente B do painel lateral de filtros (`docs/planos/filtros-laterais.md`, passo 4): Alunos, Financeiro › Lançamentos,
 * Auditoria, Atualizações, Interessados e Equipe › Membros. Em cada tela, nas duas larguras: o rascunho não vai ao
 * endereço nem à API; Cancelar descarta; Aplicar fecha, conta e mostra o chip; Aplicar sem mudança não pede de novo; a
 * lista vazia mantém os chips; com outro filtro, a lista filtrada aparece com o chip; data pela metade (ou só uma ponta, onde a rota pede as duas) segura o Aplicar com o erro
 * no campo. Com `CAPTURAS_FILTROS` (pasta), grava as capturas `b-<tela>-…`. Só dados fictícios, API simulada.
 */
// Painel pronto, sem a entrada animada: aqui se mede e se captura o painel (a entrada tem spec próprio, filtros-laterais-entrada).
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const OUTRA = { id: 'u0000000-0000-4000-8000-000000000007', nome: 'Bia Fictícia' };
const PASTA = process.env.CAPTURAS_FILTROS;

type Tema = 'ESCURO' | 'CLARO';
interface Caso {
  tela: string;
  caminho: string;
  painel: string;
  /** Caminho da API da lista (nulo = filtro local, sem pedido). */
  api: string | null;
  /** Parâmetro que só aparece com o filtro aplicado (no endereço e no pedido). */
  parametro: string | null;
  pronto: (page: Page) => Locator;
  rotas: () => Promise<RespostasApi> | RespostasApi;
  sessao: (page: Page) => Promise<RespostasApi>;
  /** Liga um filtro no painel que deixa a lista vazia. */
  ligar: (page: Page, painel: Locator) => Promise<void>;
  chip: string;
  vazio: RegExp;
  /** Outro filtro, que deixa resultado na lista (estado "aplicado"). */
  comResultado: { ligar: (page: Page, painel: Locator) => Promise<void>; chip: string; mostra: (page: Page) => Locator; some?: (page: Page) => Locator };
  /** Deixa um período inválido no painel e diz qual campo deve ficar com o erro. */
  periodo?: (painel: Locator) => Promise<Locator>;
  /** Também em tema claro e em 1920 px (tabelas largas). */
  largas?: boolean;
}

async function marcar(page: Page, painel: Locator, rotulo: string, todos: string, opcoes: string[]) {
  await painel.getByRole('button', { name: `${rotulo}: ${todos}. Escolher.` }).click();
  const lista = page.getByRole('dialog', { name: rotulo });
  for (const o of opcoes) await lista.getByRole('checkbox', { name: o, exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(lista).toHaveCount(0);
}
const opcao = (onde: Locator, grupo: string, rotulo: string) =>
  onde.getByRole('radiogroup', { name: grupo }).getByRole('radio', { name: rotulo, exact: true });

function aluno(n: number, nome: string): AlunoResumo {
  return {
    id: `a0000000-0000-4000-8000-00000000000${n}`, nome, ativo: true, temAcesso: true, planoAtivo: null, ultimoRegistro: '2026-10-18',
    responsavelId: TREINADOR.id, atualizacao: null,
  };
}
function atualizacao(n: number, nome: string): AtualizacaoDaLista {
  return {
    id: `b0000000-0000-4000-8000-00000000000${n}`, pastaId: `c0000000-0000-4000-8000-00000000000${n}`,
    alunoId: `a0000000-0000-4000-8000-00000000000${n}`, nomeAluno: nome, dataAtualizacao: '2026-10-20', fase: 'ENVIADA',
    diasParaData: -1, diasDeAtraso: 0, atrasoAte: null,
  };
}
const PERFIS: PerfilEquipe[] = [
  { id: 'p-1', nome: 'Treinador', descricao: null, acessoTotal: false, sistema: true, ativo: true, permissoes: [], usuarios: 2, versao: 1 },
];
function membro(n: number, nome: string): MembroEquipe {
  return {
    id: `m0000000-0000-4000-8000-00000000000${n}`, nome, email: `${nome.split(' ')[0].toLowerCase()}@exemplo.test`, perfilId: 'p-1',
    perfilNome: 'Treinador', ativo: true, convitePendente: false, conviteExpiraEm: null, ultimoAcesso: null, limiteDeAlunos: null,
  };
}
const lancamento = (n: number, descricao: string) => ({
  id: `l0000000-0000-4000-8000-00000000000${n}`, data: '2026-10-10', descricao, valorCentavos: 5_000, tipo: 'ENTRADA' as const,
  categoria: 'Consultoria', criadoEm: '2026-10-10T12:00:00Z', versao: 0,
});

const CASOS: Caso[] = [
  {
    tela: 'alunos', caminho: '/treinador/alunos', painel: 'Filtros de alunos', api: '/alunos', parametro: 'acesso',
    pronto: (page) => page.getByRole('link', { name: /^Abrir Ana Fictícia/ }),
    sessao: (page) => sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER', 'TREINO_LER', 'REGISTRO_LER'], perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true } }),
    rotas: () => ({
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }, OUTRA] },
      'GET /alunos': (p, route) => json(route, p.busca.getAll('acesso').includes('SEM') ? { itens: [], total: 0 } : p.busca.has('acesso') ? { itens: [aluno(1, 'Ana Fictícia')], total: 1 } : { itens: [aluno(1, 'Ana Fictícia'), aluno(2, 'Bruno Exemplo')], total: 2 }),
    }),
    ligar: (page, painel) => marcar(page, painel, 'Acesso ao app', 'Todos', ['Sem acesso']),
    chip: 'Tirar filtro: Acesso: Sem acesso', vazio: /^Nenhum aluno encontrado$/,
    comResultado: {
      ligar: (page, painel) => marcar(page, painel, 'Acesso ao app', 'Todos', ['Com acesso']),
      chip: 'Tirar filtro: Acesso: Com acesso', mostra: (page) => page.getByRole('link', { name: /^Abrir Ana Fictícia/ }),
      some: (page) => page.getByRole('link', { name: /^Abrir Bruno Exemplo/ }),
    },
    largas: true,
  },
  {
    tela: 'lancamentos', caminho: '/treinador/financeiro?aba=lancamentos', painel: 'Filtros de lançamentos', api: '/financeiro/lancamentos', parametro: 'tipo',
    pronto: (page) => page.getByText('Aluguel da sala', { exact: true }).first(),
    sessao: (page) => sessaoComFinanceiro(page, undefined, false),
    rotas: () => ({
      ...rotasDoFinanceiro(estadoFinanceiro({ lancamentos: [lancamento(1, 'Aluguel da sala'), lancamento(2, 'Halteres')] })),
      'GET /financeiro/lancamentos': (p, route) => json(route, p.busca.get('tipo') === 'SAIDA' ? { itens: [], total: 0, pagina: 0 }
        : p.busca.has('tipo') ? { itens: [lancamento(1, 'Aluguel da sala')], total: 1, pagina: 0 } : { itens: [lancamento(1, 'Aluguel da sala'), lancamento(2, 'Halteres')], total: 2, pagina: 0 }),
    }),
    ligar: async (_page, painel) => { await opcao(painel, 'Tipo', 'Saídas').click(); },
    chip: 'Tirar filtro: Tipo: Saídas', vazio: /^Nenhum lançamento com esses filtros$/,
    comResultado: {
      ligar: async (_page, painel) => { await opcao(painel, 'Tipo', 'Entradas').click(); },
      chip: 'Tirar filtro: Tipo: Entradas', mostra: (page) => page.getByText('Aluguel da sala', { exact: true }).first(),
      some: (page) => page.getByText('Halteres', { exact: true }),
    },
    periodo: async (painel) => {
      await painel.getByRole('textbox', { name: 'De', exact: true }).fill('01/1');
      return painel.getByRole('textbox', { name: 'De', exact: true });
    },
    largas: true,
  },
  {
    tela: 'auditoria', caminho: '/treinador/auditoria', painel: 'Filtros de eventos', api: '/auditoria', parametro: 'usuarioId',
    pronto: (page) => page.getByText('Cadastrou um aluno.').first(),
    sessao: (page) => sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'AUDITORIA_LER'] }),
    rotas: () => ({
      'GET /auditoria/pessoas': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }, OUTRA] },
      'GET /auditoria': (p, route) => json(route, p.busca.getAll('usuarioId').includes(OUTRA.id) ? { itens: [], total: 0, pagina: 0 } : {
        itens: [{ id: 'e1', usuarioId: TREINADOR.id, nomeUsuario: TREINADOR.nome, acao: 'ALUNO_CRIADO', entidade: 'ALUNO', entidadeId: null, resumo: 'Cadastrou um aluno.', criadoEm: '2026-10-20T13:00:00Z' }],
        total: 1, pagina: 0,
      }),
    }),
    ligar: (page, painel) => marcar(page, painel, 'Pessoa', 'Todas as pessoas', ['Bia Fictícia']),
    chip: 'Tirar filtro: Pessoa: Bia Fictícia', vazio: /^Sem eventos neste filtro$/,
    comResultado: {
      ligar: (page, painel) => marcar(page, painel, 'Pessoa', 'Todas as pessoas', [TREINADOR.nome]),
      chip: `Tirar filtro: Pessoa: ${TREINADOR.nome}`, mostra: (page) => page.getByText('Cadastrou um aluno.').first(),
    },
    periodo: async (painel) => {
      await painel.getByRole('textbox', { name: 'Período: data inicial', exact: true }).fill('01/1');
      return painel.getByRole('textbox', { name: 'Período: data inicial', exact: true });
    },
    largas: true,
  },
  {
    tela: 'atualizacoes', caminho: '/treinador/atualizacoes?situacao=PARA_REVISAR', painel: 'Filtros de atualizações', api: '/atualizacoes/pagina', parametro: 'responsavel',
    pronto: (page) => page.getByRole('link', { name: /Ana Fictícia/ }),
    sessao: (page) => sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER'] }),
    rotas: () => ({
      'GET /painel': { corpo: { atualizacoesParaRevisar: 1, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 0 } },
      'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }, OUTRA] },
      'GET /atualizacoes/pagina': (p, route) => json(route, p.busca.getAll('responsavel').includes(OUTRA.id) ? { itens: [], total: 0 } : { itens: [atualizacao(1, 'Ana Fictícia')], total: 1 }),
      'GET /atualizacoes/contagens': { corpo: { PARA_REVISAR: 1, ATRASADAS: 0, AVISARAM_ATRASO: 0, PROXIMAS: 0 } },
    }),
    ligar: (page, painel) => marcar(page, painel, 'Responsável', 'Todos', ['Bia Fictícia']),
    chip: 'Tirar filtro: Responsável: Bia Fictícia', vazio: /^Nenhuma atualização com esses filtros$/,
    comResultado: {
      ligar: (page, painel) => marcar(page, painel, 'Responsável', 'Todos', ['Sem responsável']),
      chip: 'Tirar filtro: Responsável: Sem responsável', mostra: (page) => page.getByRole('link', { name: /Ana Fictícia/ }),
    },
    // A rota só aceita o par: só o De deixa o erro no Até.
    periodo: async (painel) => {
      await painel.getByRole('textbox', { name: 'Data da atualização: data inicial', exact: true }).fill('01/10/2026');
      return painel.getByRole('textbox', { name: 'Data da atualização: data final', exact: true });
    },
  },
  {
    tela: 'interessados', caminho: '/treinador/interessados', painel: 'Filtros de inscrições', api: '/inscricoes', parametro: 'origem',
    pronto: (page) => page.getByText('Pessoa Fictícia 1', { exact: true }).first(),
    sessao: (page) => sessao(page, TREINADOR),
    rotas: () => ({
      ...rotasDaTela(),
      'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }, OUTRA] },
      'GET /inscricoes': (p, route) => json(route, p.busca.getAll('origem').includes('INSTAGRAM') ? { itens: [], total: 0 } : { itens: [resumoFalso(1)], total: 1 }),
      'GET /inscricoes/contagens': { corpo: contagensFalsas({ NOVA: 1 }) },
    }),
    ligar: (page, painel) => marcar(page, painel, 'Origem', 'Todas', ['Instagram']),
    chip: 'Tirar filtro: Origem: Instagram', vazio: /^Nenhuma inscrição com estes filtros\.$/,
    comResultado: {
      ligar: (page, painel) => marcar(page, painel, 'Origem', 'Todas', ['Indicação']),
      chip: 'Tirar filtro: Origem: Indicação', mostra: (page) => page.getByText('Pessoa Fictícia 1', { exact: true }).first(),
    },
    periodo: async (painel) => {
      await painel.getByRole('textbox', { name: 'Entrada: data inicial', exact: true }).fill('01/1');
      return painel.getByRole('textbox', { name: 'Entrada: data inicial', exact: true });
    },
    largas: true,
  },
  {
    tela: 'equipe', caminho: '/treinador/equipe', painel: 'Filtros de membros', api: null, parametro: null,
    pronto: (page) => page.getByText('Ana Fictícia', { exact: true }),
    sessao: (page) => sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'EQUIPE_LER'] }),
    rotas: () => ({
      'GET /usuarios': { corpo: [membro(1, 'Ana Fictícia'), membro(2, 'Bia Exemplo')] },
      'GET /perfis': { corpo: PERFIS },
      'GET /permissoes/catalogo': { corpo: [] },
    }),
    ligar: (page, painel) => marcar(page, painel, 'Situação', 'Todas', ['Inativos']),
    chip: 'Tirar filtro: Situação: Inativos', vazio: /^Nenhum membro encontrado$/,
    comResultado: {
      ligar: (page, painel) => marcar(page, painel, 'Situação', 'Todas', ['Ativos']),
      chip: 'Tirar filtro: Situação: Ativos', mostra: (page) => page.getByText('Ana Fictícia', { exact: true }),
    },
  },
];

const VARIANTES: { largura: number; altura: number; tema: Tema; soLargas?: boolean }[] = [
  { largura: 390, altura: 844, tema: 'ESCURO' },
  { largura: 1280, altura: 900, tema: 'ESCURO' },
  { largura: 1280, altura: 900, tema: 'CLARO', soLargas: true },
  { largura: 1920, altura: 1080, tema: 'CLARO', soLargas: true },
];

async function capturar(page: Page, caso: Caso, v: (typeof VARIANTES)[number], estado: string) {
  if (!PASTA) return;
  await page.screenshot({ path: `${PASTA}/b-${caso.tela}-${estado}-${v.largura}-${v.tema.toLowerCase()}.png` });
}

for (const caso of CASOS) {
  for (const v of VARIANTES) {
    if (v.soLargas && !caso.largas) continue;
    test(`${caso.tela} ${v.largura}px ${v.tema.toLowerCase()}: rascunho, Cancelar, Aplicar, chip, vazio com chips${caso.periodo ? ' e período inválido' : ''}`, async ({ page }) => {
      await page.setViewportSize({ width: v.largura, height: v.altura });
      await fixarHoje(page);
      await page.addInitScript(([id, prefs]) => localStorage.setItem(`treinos:${id}:preferencias`, prefs),
        [TREINADOR.id, JSON.stringify({ tema: v.tema, contraste: 'PADRAO' })] as const);
      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await caso.sessao(page)),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        ...(await caso.rotas()),
      });
      const daLista = () => (caso.api ? pedidos.filter((p) => p.metodo === 'GET' && p.caminho === caso.api) : []);
      const comFiltro = () => (caso.parametro ? daLista().filter((p) => p.busca.has(caso.parametro!)) : []);
      await page.goto(caso.caminho);
      await expect(caso.pronto(page)).toBeVisible();
      const botao = page.getByRole('button', { name: /^Filtros, / });
      await expect(botao).toHaveAccessibleName('Filtros, nenhum ligado');
      const enderecoAntes = page.url();

      // Rascunho e Cancelar: nada vai ao endereço nem à API.
      await botao.click();
      const painel = page.getByRole('dialog', { name: caso.painel });
      await expect(painel).toBeVisible();
      await capturar(page, caso, v, 'painel');
      await caso.ligar(page, painel);
      await expect(painel).toBeVisible();
      await painel.getByRole('button', { name: 'Cancelar' }).click();
      await expect(painel).toHaveCount(0);
      expect(page.url()).toBe(enderecoAntes);
      expect(comFiltro()).toEqual([]);
      await expect(page.getByRole('button', { name: caso.chip })).toHaveCount(0);
      await expect(botao).toBeFocused();

      // Período inválido segura o Aplicar: o painel fica, o campo leva o erro e o foco.
      if (caso.periodo) {
        await botao.click();
        await expect(painel).toBeVisible();
        const campo = await caso.periodo(painel);
        const antes = daLista().length;
        await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
        await expect(painel).toBeVisible();
        await expect(campo).toHaveAttribute('aria-invalid', 'true');
        await expect(campo).toBeFocused();
        await capturar(page, caso, v, 'erro-periodo');
        expect(daLista().length).toBe(antes);
        expect(page.url()).toBe(enderecoAntes);
        await painel.getByRole('button', { name: 'Cancelar' }).click();
        await expect(painel).toHaveCount(0);
      }

      // Aplicar: fecha, conta, mostra o chip; a lista vazia mantém os chips.
      await botao.click();
      await expect(painel).toBeVisible();
      await caso.ligar(page, painel);
      await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect(painel).toHaveCount(0);
      await expect(botao).toHaveAccessibleName('Filtros, 1 ligado');
      await expect(page.getByRole('button', { name: caso.chip })).toBeVisible();
      await expect(page.getByText(caso.vazio)).toBeVisible();
      await expect(page.getByRole('group', { name: 'Filtros aplicados' })).toBeVisible();
      if (caso.parametro) {
        await expect.poll(() => comFiltro().length).toBeGreaterThan(0);
        expect(new URL(page.url()).searchParams.has(caso.parametro)).toBe(true);
      }
      await capturar(page, caso, v, 'vazio-com-chips');

      // Aplicar sem mudança não pede de novo.
      const pedidosAntes = daLista().length;
      const enderecoAplicado = page.url();
      await botao.click();
      await expect(painel).toBeVisible();
      await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect(painel).toHaveCount(0);
      // Espera curta para um pedido indevido ter tempo de sair (não há evento a esperar quando nada acontece).
      await page.waitForTimeout(500);
      expect(daLista().length).toBe(pedidosAntes);
      expect(page.url()).toBe(enderecoAplicado);

      // O ✕ do chip tira na hora.
      await page.getByRole('button', { name: caso.chip }).click();
      await expect(caso.pronto(page)).toBeVisible();
      await expect(botao).toHaveAccessibleName('Filtros, nenhum ligado');
      await capturar(page, caso, v, 'depois-do-x');

      // Aplicado com resultado: o chip fica na página junto da lista filtrada.
      await botao.click();
      await expect(painel).toBeVisible();
      await caso.comResultado.ligar(page, painel);
      await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect(painel).toHaveCount(0);
      await expect(botao).toHaveAccessibleName('Filtros, 1 ligado');
      await expect(page.getByRole('button', { name: caso.comResultado.chip })).toBeVisible();
      await expect(caso.comResultado.mostra(page)).toBeVisible();
      if (caso.comResultado.some) await expect(caso.comResultado.some(page)).toHaveCount(0);
      await expect(page.getByText(caso.vazio)).toHaveCount(0);
      await capturar(page, caso, v, 'aplicado');
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}
