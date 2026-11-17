import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AulaDaComunidade, PaginaDoMural, PostDoMural } from '../src/api/comunidadeTipos';
import type { CatalogoExercicio, ErgogenicoDaBiblioteca, QuestionarioResumo } from '../src/api/tipos';
import { fixarHoje, sessaoDeAluno } from './aluno';
import { ALUNO, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Frente C do painel lateral de filtros (`docs/planos/filtros-laterais.md`, passo 5): Agenda, Importação, Planejamento ›
 * questionários, Comunidade (mural do treinador e do aluno, aulões do treinador) e Biblioteca (Importar do catálogo, Outros,
 * Suplementos). Em cada tela, nas duas larguras: o rascunho não vai ao endereço nem à API; Cancelar descarta e devolve o
 * foco; Aplicar fecha, conta e mostra a etiqueta; Aplicar sem mudança não pede de novo; a lista vazia mantém as
 * etiquetas; data pela metade segura o Aplicar com o erro no campo. Com `CAPTURAS_FILTROS` (pasta), grava as capturas
 * `c-<tela>-…`. Só dados fictícios, API simulada.
 */
// Painel pronto, sem a entrada animada: aqui se mede e se captura o painel (a entrada tem spec próprio, filtros-laterais-entrada).
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const PASTA = process.env.CAPTURAS_FILTROS;
const OUTRO_MEMBRO = { id: 'u0000000-0000-4000-8000-000000000003', nome: 'Bruno Equipe' };

type Tema = 'ESCURO' | 'CLARO';
interface Caso {
  tela: string;
  caminho: string;
  painel: string;
  usuarioId: string;
  /** Caminho da API da lista (nulo = filtro local, sem pedido). */
  api: string | null;
  /** Parâmetro do pedido que só aparece com o filtro aplicado. */
  noPedido: string | null;
  /** Parâmetro do endereço que só aparece com o filtro aplicado (nulo = o filtro não vai ao endereço). */
  noEndereco: string | null;
  pronto: (page: Page) => Locator;
  sessao: (page: Page) => Promise<RespostasApi>;
  rotas: RespostasApi;
  ligar: (page: Page, painel: Locator) => Promise<void>;
  chip: string;
  /** Texto da lista vazia com o filtro aplicado; nulo = o filtro sozinho não esvazia a lista (as opções vêm dos dados). */
  vazio: RegExp | null;
  /** Busca que, somada ao filtro, esvazia a lista (só onde o filtro sozinho não esvazia). */
  buscaQueEsvazia?: { rotulo: string; vazio: RegExp };
  /** Deixa um período inválido no painel e diz qual campo deve ficar com o erro. */
  periodo?: (painel: Locator) => Promise<Locator>;
  /** Também em tema claro e em 1920 px (tabela ou grade larga). */
  largas?: boolean;
}

const opcao = (onde: Locator, grupo: string, rotulo: string) =>
  onde.getByRole('radiogroup', { name: grupo }).getByRole('radio', { name: rotulo, exact: true });
async function marcar(page: Page, painel: Locator, rotulo: string, todos: string, opcoes: string[]) {
  await painel.getByRole('button', { name: `${rotulo}: ${todos}. Escolher.` }).click();
  const lista = page.getByRole('dialog', { name: rotulo });
  for (const o of opcoes) await lista.getByRole('checkbox', { name: o, exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(lista).toHaveCount(0);
}

const treinador = (extra: string[] = []) => (page: Page) => sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, ...extra] });

const IMPORTACAO = {
  id: 'i0000000-0000-4000-8000-000000000001', destino: 'alunos', nomeArquivo: 'alunos.csv', criadoEm: '2026-10-15T15:00:00Z',
  linhas: 3, novos: 2, atualizados: 0, ignorados: 0, comErro: 1, situacao: 'CONCLUIDA_COM_ERROS',
};
const QUESTIONARIO: QuestionarioResumo = {
  id: 'q0000000-0000-4000-8000-000000000001', nome: 'Check-in semanal', descricao: null, finalidade: 'ATUALIZACAO', padrao: false, arquivado: false,
  versaoPublicada: 1, publicadoEm: '2026-10-01T12:00:00Z', alteradoDesdePublicacao: false, rascunhoAlteradoEm: null,
  uso: { alunos: 0, pastas: 0, envios: 0 },
};
const POST: PostDoMural = {
  id: 'p1', autorId: 'u2', autorNome: 'Aluno Fictício', autorApelido: null, autorEhAluno: true, autorFotoUrl: null, texto: 'Treino feito.',
  tipo: 'CONVERSA', videoUrl: null, capaId: null, enquete: null, fotos: [], respondida: false, fixado: false, criadoEm: '2026-10-19T12:00:00-03:00', reacoes: {}, minhasReacoes: [],
  totalComentarios: 0, podId: null, podNome: null,
};
const mural = (...content: PostDoMural[]): PaginaDoMural => ({ content, totalElements: content.length });
const aula = (id: string, titulo: string, categoria: string | null): AulaDaComunidade => ({
  id, titulo, descricao: null, videoUrl: 'https://exemplo.test/video', capaId: null, categoria, ordem: 0, publicada: true,
  criadaEm: '2026-10-19T12:00:00-03:00', totalComentarios: 0,
});
const COMUNIDADE: RespostasApi = {
  'GET /comunidade/configuracao': { corpo: { alunosPublicam: true, alunosAnexamFotos: false } },
  'GET /comunidade/pods': { corpo: [] },
  'GET /aluno/comunidade/configuracao': { corpo: { alunosPublicam: true, podeAnexarFoto: false } },
  'GET /aluno/comunidade/aulas': { corpo: [] },
  'GET /aluno/comunidade/conquistas': { corpo: [] },
  'GET /aluno/comunidade/ranking': { corpo: { posicao: 1, treinosConcluidos: 1, pontuacao: 10, participantes: 2, nivel: 1, xp: 10, xpNoNivel: 10, faltam: 90 } },
};
const exercicioDoCatalogo = (n: number, nome: string, grupo: string): CatalogoExercicio => ({
  id: `c000000${n}-0000-4000-8000-000000000000`, nome, grupoMuscular: grupo, equipamento: null, modalidade: 'LIVRE', instrucoes: null, fonte: null, imagens: [],
});
const outro = (n: number, nome: string, categoria: string): ErgogenicoDaBiblioteca => ({
  id: `e000000${n}-0000-4000-8000-000000000000`, categoria, nome, principioAtivo: null, concentracao: null, apresentacao: null, observacao: null,
});
// Suplemento como a API manda (`GET /alimentos?tipo=SUPLEMENTO`): a categoria vem em `grupo`.
const suplemento = (n: number, nome: string, grupo: string) => ({
  id: `s000000${n}-0000-4000-8000-000000000000`, nome, grupo, tipo: 'SUPLEMENTO', marca: null, porcao: null, porcoesPorEmbalagem: null, sabores: [], link: null, cupom: null,
});

const CASOS: Caso[] = [
  {
    tela: 'agenda', caminho: '/treinador/agenda?visao=semana&data=2026-10-19', painel: 'Filtros da agenda', usuarioId: TREINADOR.id,
    api: '/agenda/compromissos', noPedido: 'responsavel', noEndereco: 'meus',
    pronto: (page) => page.getByRole('heading', { level: 1, name: 'Agenda' }),
    sessao: treinador(['AGENDA_LER', 'AGENDA_ALTERAR', 'ATUALIZACAO_LER']),
    rotas: {
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /alunos': { corpo: { itens: [], total: 0 } },
      'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }, OUTRO_MEMBRO] },
      'GET /atualizacoes': { corpo: [] },
      'GET /agenda/compromissos': { corpo: [] },
      'GET /agenda/agendas': { corpo: [] },
      'GET /agenda/eventos': { corpo: [] },
    },
    ligar: async (_page, painel) => { await opcao(painel, 'Responsável', 'Só os meus').click(); },
    chip: 'Tirar filtro: Responsável: Só os meus', vazio: null, largas: true,
  },
  {
    tela: 'importacao', caminho: '/treinador/importacao', painel: 'Filtros de importações', usuarioId: TREINADOR.id,
    api: '/importacoes', noPedido: 'situacao', noEndereco: 'situacao',
    pronto: (page) => page.getByText('alunos.csv').first(),
    sessao: treinador(),
    rotas: { 'GET /importacoes': (p, route) => json(route, p.busca.has('situacao') ? { itens: [], total: 0, pagina: 0 } : { itens: [IMPORTACAO], total: 1, pagina: 0 }) },
    ligar: async (_page, painel) => { await opcao(painel, 'Situação', 'Falhou').click(); },
    chip: 'Tirar filtro: Situação: Falhou', vazio: /^Nenhuma importação com esses filtros/,
    periodo: async (painel) => {
      await painel.getByRole('textbox', { name: 'De', exact: true }).fill('01/1');
      return painel.getByRole('textbox', { name: 'De', exact: true });
    },
    largas: true,
  },
  {
    tela: 'questionarios', caminho: '/treinador/planejamento?aba=atualizacao', painel: 'Filtros de questionários', usuarioId: TREINADOR.id,
    // A publicação filtra o que já veio: nenhum pedido novo.
    api: '/questionarios', noPedido: null, noEndereco: null,
    pronto: (page) => page.getByText('Check-in semanal', { exact: true }),
    sessao: treinador(['QUESTIONARIO_ALTERAR']),
    rotas: { 'GET /questionarios': { corpo: [QUESTIONARIO] } },
    ligar: async (_page, painel) => { await opcao(painel, 'Publicação', 'Nunca publicados').click(); },
    chip: 'Tirar filtro: Publicação: Nunca publicados', vazio: /^Nenhum questionário com essa busca e esses filtros\.$/,
  },
  {
    tela: 'mural-treinador', caminho: '/treinador/comunidade?aba=mural&mural=alunos', painel: 'Filtros do mural', usuarioId: TREINADOR.id,
    // A aba Alunos (C39) já pede `tipo` (um por tipo dela): a presença do parâmetro não mede o filtro; o vazio mede.
    api: '/comunidade/mural', noPedido: null, noEndereco: null,
    pronto: (page) => page.getByText('Treino feito.'),
    sessao: treinador(['TREINO_LER', 'COMUNIDADE_MODERAR']),
    rotas: {
      ...COMUNIDADE,
      'GET /comunidade/aulas': { corpo: [] },
      'GET /comunidade/mural': (p, route) => json(route, p.busca.get('tipo') === POST.tipo ? mural(POST) : mural()),
    },
    ligar: async (_page, painel) => { await painel.getByRole('radio', { name: 'Dúvidas', exact: true }).click(); },
    chip: 'Tirar filtro: Tipo: Dúvidas', vazio: /^Nenhuma publicação encontrada com esse filtro\.$/,
  },
  {
    tela: 'mural-aluno', caminho: '/aluno/comunidade?mural=alunos', painel: 'Filtros do mural', usuarioId: ALUNO.id,
    api: '/aluno/comunidade/mural', noPedido: null, noEndereco: null,
    pronto: (page) => page.getByText('Treino feito.'),
    sessao: (page) => sessaoDeAluno(page),
    rotas: { ...COMUNIDADE, 'GET /aluno/comunidade/mural': (p, route) => json(route, p.busca.get('tipo') === POST.tipo ? mural(POST) : mural()) },
    ligar: async (_page, painel) => { await painel.getByRole('radio', { name: 'Dúvidas', exact: true }).click(); },
    chip: 'Tirar filtro: Tipo: Dúvidas', vazio: /^Nenhuma publicação encontrada com esse filtro\.$/,
  },
  {
    tela: 'auloes', caminho: '/treinador/comunidade', painel: 'Filtros de vídeos', usuarioId: TREINADOR.id,
    api: null, noPedido: null, noEndereco: null,
    pronto: (page) => page.getByRole('heading', { level: 2, name: 'Vídeo de boas-vindas' }),
    sessao: treinador(['TREINO_LER', 'COMUNIDADE_MODERAR']),
    rotas: {
      ...COMUNIDADE,
      'GET /comunidade/mural': { corpo: mural() },
      'GET /comunidade/aulas': { corpo: [aula('a1', 'Vídeo de técnica', 'Técnica'), aula('a2', 'Vídeo de boas-vindas', null), aula('a3', 'Vídeo de execução', 'Técnica')] },
    },
    ligar: async (_page, painel) => { await painel.getByRole('radio', { name: 'Técnica, 2', exact: true }).click(); },
    chip: 'Tirar filtro: Categoria: Técnica', vazio: null, largas: true,
  },
  {
    tela: 'catalogo', caminho: '/treinador/biblioteca?aba=catalogo', painel: 'Filtros do catálogo', usuarioId: TREINADOR.id,
    api: '/catalogo/exercicios', noPedido: 'grupo', noEndereco: null,
    pronto: (page) => page.getByText('Supino reto', { exact: true }),
    sessao: treinador(['BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR']),
    rotas: {
      'GET /exercicios': { corpo: [] },
      'GET /catalogo/exercicios/grupos': { corpo: ['Costas', 'Peito'] },
      'GET /catalogo/exercicios': (p, route) => json(route, p.busca.has('grupo') ? { itens: [], total: 0 }
        : { itens: [exercicioDoCatalogo(1, 'Supino reto', 'Peito'), exercicioDoCatalogo(2, 'Remada baixa', 'Costas')], total: 2 }),
    },
    ligar: (page, painel) => marcar(page, painel, 'Grupo', 'Todos', ['Peito']),
    chip: 'Tirar filtro: Grupo: Peito', vazio: /^Nenhum resultado no catálogo$/,
  },
  {
    tela: 'outros', caminho: '/treinador/biblioteca?aba=ergogenicos', painel: 'Filtros de outros itens', usuarioId: TREINADOR.id,
    api: null, noPedido: null, noEndereco: null,
    pronto: (page) => page.getByText('Testosterona', { exact: true }),
    sessao: treinador(['BIBLIOTECA_LER', 'ERGOGENICO_LER', 'ERGOGENICO_ALTERAR']),
    rotas: { 'GET /ergogenicos': { corpo: [outro(1, 'Lisdexanfetamina', 'Medicamentos'), outro(2, 'Testosterona', 'Injetáveis')] } },
    ligar: async (_page, painel) => { await opcao(painel, 'Categoria', 'Medicamentos').click(); },
    chip: 'Tirar filtro: Categoria: Medicamentos', vazio: null,
    buscaQueEsvazia: { rotulo: 'Buscar em Outros', vazio: /^Nenhum item encontrado$/ },
  },
  {
    tela: 'suplementos', caminho: '/treinador/biblioteca?aba=suplementos', painel: 'Filtros de suplementos', usuarioId: TREINADOR.id,
    api: null, noPedido: null, noEndereco: null,
    pronto: (page) => page.getByText('Creatina pura', { exact: true }),
    sessao: treinador(['BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR']),
    rotas: { 'GET /alimentos': { corpo: [suplemento(1, 'Whey Protein', 'Whey'), suplemento(2, 'Creatina pura', 'Creatina')] } },
    ligar: async (_page, painel) => { await opcao(painel, 'Categoria', 'Whey').click(); },
    chip: 'Tirar filtro: Categoria: Whey', vazio: null,
    buscaQueEsvazia: { rotulo: 'Buscar suplemento', vazio: /^Nenhum suplemento encontrado$/ },
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
  await page.screenshot({ path: `${PASTA}/c-${caso.tela}-${estado}-${v.largura}-${v.tema.toLowerCase()}.png` });
}

for (const caso of CASOS) {
  for (const v of VARIANTES) {
    if (v.soLargas && !caso.largas) continue;
    test(`${caso.tela} ${v.largura}px ${v.tema.toLowerCase()}: rascunho, Cancelar, Aplicar, etiqueta${caso.vazio || caso.buscaQueEsvazia ? ', vazio com etiquetas' : ''}${caso.periodo ? ' e período inválido' : ''}`, async ({ page }) => {
      await page.setViewportSize({ width: v.largura, height: v.altura });
      await fixarHoje(page);
      await page.addInitScript(([id, prefs]) => localStorage.setItem(`treinos:${id}:preferencias`, prefs),
        [caso.usuarioId, JSON.stringify({ tema: v.tema, contraste: 'PADRAO' })] as const);
      const { pedidos, naoTratadas, errosDaPagina } = await simularApi(page, {
        ...(await caso.sessao(page)),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        ...caso.rotas,
      });
      const daLista = () => (caso.api ? pedidos.filter((p) => p.metodo === 'GET' && p.caminho === caso.api) : []);
      const comFiltro = () => (caso.noPedido ? daLista().filter((p) => p.busca.has(caso.noPedido!)) : []);
      await page.goto(caso.caminho);
      await expect(caso.pronto(page)).toBeVisible();
      const botao = page.getByRole('button', { name: /^Filtros, / });
      await expect(botao).toHaveAccessibleName('Filtros, nenhum ligado');
      const enderecoAntes = page.url();

      // Rascunho e Cancelar: nada vai ao endereço nem à API; o foco volta ao botão.
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

      // Aplicar: fecha, conta, mostra a etiqueta (e o vazio, onde o filtro esvazia, com as etiquetas à vista).
      await botao.click();
      await expect(painel).toBeVisible();
      await caso.ligar(page, painel);
      await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect(painel).toHaveCount(0);
      await expect(botao).toHaveAccessibleName('Filtros, 1 ligado');
      await expect(page.getByRole('button', { name: caso.chip })).toBeVisible();
      await expect(page.getByRole('group', { name: 'Filtros aplicados' })).toBeVisible();
      if (caso.vazio) await expect(page.getByText(caso.vazio)).toBeVisible();
      if (caso.noPedido) await expect.poll(() => comFiltro().length).toBeGreaterThan(0);
      if (caso.noEndereco) expect(new URL(page.url()).searchParams.has(caso.noEndereco)).toBe(true);
      else expect(page.url()).toBe(enderecoAntes);
      await capturar(page, caso, v, caso.vazio ? 'vazio-com-chips' : 'aplicado');

      // Busca + filtro que esvaziam a lista: as etiquetas ficam e o vazio oferece "Limpar filtros".
      if (caso.buscaQueEsvazia) {
        const busca = page.getByRole('textbox', { name: caso.buscaQueEsvazia.rotulo });
        await busca.fill('zzzz');
        await expect(page.getByText(caso.buscaQueEsvazia.vazio)).toBeVisible();
        await expect(page.getByRole('button', { name: caso.chip })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Limpar filtros', exact: true })).toBeVisible();
        await capturar(page, caso, v, 'vazio-com-chips');
        await busca.fill('');
      }

      // Aplicar sem mudança não pede de novo nem mexe no endereço.
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

      // O ✕ da etiqueta tira na hora.
      await page.getByRole('button', { name: caso.chip }).click();
      await expect(caso.pronto(page)).toBeVisible();
      await expect(botao).toHaveAccessibleName('Filtros, nenhum ligado');
      await capturar(page, caso, v, 'depois-do-x');
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

// Agenda: o Aplicar troca o endereço sem criar passo no histórico; o Voltar sai da visão, não desfaz o filtro.
for (const largura of [390, 1280]) {
  test(`agenda ${largura}px: Aplicar não empilha; o Voltar volta à visão anterior, não ao endereço sem o filtro`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await fixarHoje(page);
    const agenda = CASOS[0];
    const { naoTratadas, errosDaPagina } = await simularApi(page, { ...(await agenda.sessao(page)), 'GET /inscricoes': { corpo: { itens: [], total: 0 } }, ...agenda.rotas });
    await page.goto(agenda.caminho);
    await expect(agenda.pronto(page)).toBeVisible();
    // Um passo no histórico pela barra (a troca de visão empilha): Semana → Mês.
    await page.getByRole('button', { name: /^Visão do calendário: / }).click();
    await page.getByRole('menu', { name: 'Visão do calendário', exact: true }).getByRole('menuitemradio', { name: 'Mês', exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('visao')).toBe('mes');

    const botao = page.getByRole('button', { name: /^Filtros, / });
    await botao.click();
    const painel = page.getByRole('dialog', { name: agenda.painel });
    await agenda.ligar(page, painel);
    await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(painel).toHaveCount(0);
    await expect(page.getByRole('button', { name: agenda.chip })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get('meus')).toBe('true');
    expect(new URL(page.url()).searchParams.get('visao')).toBe('mes');

    // Voltar: se o Aplicar tivesse empilhado, cairia no Mês sem o filtro; cai na Semana de antes.
    await page.goBack();
    await expect.poll(() => new URL(page.url()).searchParams.get('visao')).toBe('semana');
    await expect(page.getByRole('button', { name: 'Visão do calendário: Semana', exact: true })).toBeVisible();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

// Agenda: a barra é montada uma vez, só o layout muda; cruzar a largura (PC ↔ celular: o menu lateral a partir de 768 px e a lateral da Agenda a partir de 960 px de conteúdo) não fecha o painel nem
// perde o rascunho (antes, a barra estava em dois lugares da árvore e remontava).
test('agenda: o painel aberto e o rascunho sobrevivem a PC → celular → PC', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await fixarHoje(page);
  const agenda = CASOS[0];
  const { naoTratadas, errosDaPagina, pedidos } = await simularApi(page, { ...(await agenda.sessao(page)), 'GET /inscricoes': { corpo: { itens: [], total: 0 } }, ...agenda.rotas });
  await page.goto(agenda.caminho);
  await expect(agenda.pronto(page)).toBeVisible();
  await expect(page.getByTestId('lateral-da-agenda')).toBeVisible();

  await page.getByRole('button', { name: /^Filtros, / }).click();
  const painel = page.getByRole('dialog', { name: agenda.painel });
  await opcao(painel, 'Responsável', 'Só os meus').click();
  await expect(opcao(painel, 'Responsável', 'Só os meus')).toHaveAttribute('aria-checked', 'true');

  for (const [largura, altura, lateral] of [[390, 844, false], [1280, 900, true], [900, 900, false], [700, 900, false], [1280, 900, true]] as const) {
    await page.setViewportSize({ width: largura, height: altura });
    await expect(page.getByTestId('lateral-da-agenda')).toHaveCount(lateral ? 1 : 0);
    await expect(painel).toBeVisible();
    await expect(opcao(painel, 'Responsável', 'Só os meus')).toHaveAttribute('aria-checked', 'true');
  }

  // Nada foi aplicado no caminho: o endereço continua sem o filtro e o Aplicar ainda vale.
  expect(new URL(page.url()).searchParams.get('meus')).toBeNull();
  expect(pedidos.filter((p) => p.caminho === agenda.api && p.busca.get('responsavel') === 'meus')).toHaveLength(0);
  await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(painel).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get('meus')).toBe('true');
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
