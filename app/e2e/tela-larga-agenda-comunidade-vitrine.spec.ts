import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AgendaPessoal, Compromisso, OcorrenciaDeEvento } from '../src/api/agendaTipos';
import type { AulaDaComunidade, ConquistaDoAluno, PaginaDoMural, PlaylistDaComunidade, PodResumo, PosicaoNoRanking, PostDoMural } from '../src/api/comunidadeTipos';
import type { AlunoResumo, AtualizacaoDaLista } from '../src/api/tipos';
import type { ItemDaVitrine } from '../src/api/vitrineTipos';
import { fixarHoje, sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, json, PERMISSOES_TREINADOR, type PedidoFalso, sessao, simularApi, TREINADOR } from './api-falsa';
import { pngDeCor } from './imagens-falsas';

/**
 * tela larga: revisão (24/11). Agenda (Dia, Semana, Mês, Ano), Comunidade (Vídeos e Mural) e Vitrine em 1920, 2560 e
 * 3440 px com o menu aberto: o espaço extra vira colunas, nada estica além do limite e não sobra cartão sozinho na linha.
 * Mural (treinador e aluno, decisão 3 de 24/11): feed de ~720 px e coluna fixa à direita a partir de 1280 px de área, no topo
 * do feed abaixo disso, sem coluna quando vazia; também em 1280 e 390. Relógio em segunda, 19/10/2026, 12:00 de Brasília. API simulada, só dados fictícios. As capturas só saem com
 * `CAPTURAS_TELA_LARGA` (pasta base, fora do git) e `CAPTURAS_FASE` (`antes` ou `depois`): `<base>/<tela>/<fase>/<largura>.png`.
 */

const BASE_CAPTURAS = process.env.CAPTURAS_TELA_LARGA;
const FASE = process.env.CAPTURAS_FASE ?? 'depois';
const LARGURAS = [[1920, 1080], [2560, 1440], [3440, 1440]] as const;

const PERMISSOES = [
  ...PERMISSOES_TREINADOR, 'AGENDA_LER', 'AGENDA_ALTERAR', 'ATUALIZACAO_LER', 'ALUNO_SENSIVEL_LER', 'TREINO_LER', 'COMUNIDADE_MODERAR',
  'VITRINE_LER', 'VITRINE_ALTERAR',
];

async function capturar(page: Page, tela: string, largura: number) {
  if (!BASE_CAPTURAS) return;
  const pasta = path.join(BASE_CAPTURAS, tela, FASE);
  fs.mkdirSync(pasta, { recursive: true });
  await page.screenshot({ path: path.join(pasta, `${largura}.png`), fullPage: false });
}

async function preparar(page: Page, largura: number, altura: number, tema: 'ESCURO' | 'CLARO' | 'AREIA' = 'ESCURO', extraPrefs: Record<string, unknown> = {}, usuarioId = TREINADOR.id) {
  await page.setViewportSize({ width: largura, height: altura });
  await fixarHoje(page);
  await page.addInitScript(([id, prefs]) => {
    try {
      localStorage.removeItem('menu-lateral-recolhido');
      localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(prefs));
    } catch { /* quadro sem armazenamento (iframe do player) */ }
  }, [usuarioId, { tema, contraste: 'PADRAO', larguraConteudo: 'AUTOMATICA', ...extraPrefs }] as const);
}

const caixa = async (l: Locator) => {
  const c = await l.boundingBox();
  if (!c) throw new Error('elemento sem caixa');
  return c;
};
const semRolagemHorizontal = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
/** As posições só valem com o layout assentado (a faixa chega depois do primeiro desenho). */
const assentado = (conferir: () => Promise<void>) => expect(conferir).toPass({ timeout: 10_000 });

// ---------------------------------------------------------------- Agenda

const HOJE = '2026-10-19';
const instante = (data: string, hora: string) => new Date(`${data}T${hora}:00-03:00`);
const horaDe = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(11, 16);
const somarDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const NOMES = ['Ana Fictícia', 'Bruno Exemplo', 'Carla Teste', 'Diego Modelo', 'Elisa Amostra', 'Fábio Demonstração'];
const ALUNOS: AlunoResumo[] = NOMES.map((nome, i) => ({
  id: `a0000000-0000-4000-8000-00000000000${i + 1}`, nome, ativo: true, temAcesso: true, planoAtivo: null, ultimoRegistro: null, atualizacao: null,
}));
const AGENDAS: AgendaPessoal[] = [
  { id: 'g1', nome: 'Pessoal', cor: 'AZUL', versao: 0 },
  { id: 'g2', nome: 'Estudos', cor: 'VIOLETA', versao: 0 },
];

function compromisso(n: number, data: string, hora: string, alunos: AlunoResumo[]): Compromisso {
  const inicio = instante(data, hora);
  const fim = new Date(inicio.getTime() + 60 * 60_000);
  return {
    id: `k${n}`, responsavelId: TREINADOR.id, responsavelNome: TREINADOR.nome,
    participantes: alunos.map((a) => ({ id: a.id, nome: a.nome, situacao: 'AGENDADO' })), cancelado: false,
    serieId: null, ocorrenciaDaSerie: null, totalDaSerie: null,
    inicio: inicio.toISOString(), fim: fim.toISOString(), data, hora, horaFim: horaDe(fim), duracaoMinutos: 60, local: 'Sala 2',
    observacao: null, versao: 0, lembretesMinutos: [30],
  };
}

/** Outubro cheio: 2 a 4 compromissos por dia útil, de 07:00 a 19:00. */
function compromissosDeOutubro(): Compromisso[] {
  const lista: Compromisso[] = [];
  const horas = ['07:00', '09:00', '11:00', '14:00', '16:00', '18:00'];
  for (let d = 0; d < 31; d++) {
    const data = somarDias('2026-10-01', d);
    const semana = new Date(`${data}T12:00:00Z`).getUTCDay();
    if (semana === 0) continue;
    const quantos = semana === 6 ? 1 : 2 + (d % 3);
    for (let i = 0; i < quantos; i++) lista.push(compromisso(lista.length, data, horas[(d + i * 2) % horas.length], [ALUNOS[(d + i) % ALUNOS.length]]));
  }
  return lista;
}

function ocorrencia(id: string, agendaId: string, titulo: string, data: string, hora: string): OcorrenciaDeEvento {
  const inicio = instante(data, hora);
  const fim = new Date(inicio.getTime() + 60 * 60_000);
  return {
    eventoId: id, agendaId, dataOriginal: data, data, hora, horaFim: horaDe(fim), inicio: inicio.toISOString(), fim: fim.toISOString(),
    diaInteiro: false, titulo, local: null, descricao: null, recorrente: false,
  };
}
const EVENTOS = [
  ocorrencia('e1', 'g1', 'Almoço', HOJE, '12:00'),
  ocorrencia('e2', 'g2', 'Curso online', '2026-10-21', '20:00'),
  ocorrencia('e3', 'g1', 'Dentista', '2026-10-23', '08:00'),
];
const ATUALIZACAO: AtualizacaoDaLista = {
  id: null as unknown as string, pastaId: 'c0000000-0000-4000-8000-000000000001', alunoId: ALUNOS[1].id,
  nomeAluno: ALUNOS[1].nome, dataAtualizacao: '2026-10-22', fase: 'ABERTA', diasParaData: 3, diasDeAtraso: 0, atrasoAte: null,
};

async function abrirAgenda(page: Page, visao: 'dia' | 'semana' | 'mes' | 'ano', compromissos = compromissosDeOutubro()) {
  const entre = (p: PedidoFalso, data: string) => data >= (p.busca.get('de') ?? '') && data <= (p.busca.get('ate') ?? '');
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 1, alunosAtivos: 6, alunosSemRegistro: [], ultimasExecucoes: [], planosTerminando: [] } },
    'GET /alunos': { corpo: { itens: ALUNOS, total: ALUNOS.length } },
    'GET /responsaveis': { corpo: [{ id: TREINADOR.id, nome: TREINADOR.nome }] },
    'GET /atualizacoes': { corpo: [ATUALIZACAO] },
    'GET /agenda/compromissos': (p, route) => json(route, compromissos.filter((c) => entre(p, c.data))),
    'GET /agenda/compromissos/alunos-ocupados': { corpo: [] },
    'GET /agenda/agendas': { corpo: AGENDAS },
    'GET /agenda/eventos': (p, route) => json(route, EVENTOS.filter((e) => entre(p, e.data))),
    'GET /agenda/resumo': (p, route) => {
      const dias = new Map<string, { data: string; compromissos: number; eventos: number }>();
      const dia = (d: string) => dias.get(d) ?? dias.set(d, { data: d, compromissos: 0, eventos: 0 }).get(d)!;
      for (const c of compromissos) if (entre(p, c.data)) dia(c.data).compromissos += 1;
      for (const e of EVENTOS) if (entre(p, e.data)) dia(e.data).eventos += 1;
      return json(route, { dias: [...dias.values()].sort((a, b) => a.data.localeCompare(b.data)) });
    },
  });
  await page.goto(`/treinador/agenda${visao === 'semana' ? '' : `?visao=${visao}`}`);
  await expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeVisible();
  return api;
}

// ---------------------------------------------------------------- Comunidade

const AULA: AulaDaComunidade = {
  id: 'v1', titulo: 'Vídeo fictício', descricao: 'Descrição fictícia do vídeo.', videoUrl: 'https://exemplo.test/video', capaId: null,
  playlistId: 'p1', ordem: 0, publicada: true, criadaEm: '2026-10-19T12:00:00-03:00', totalComentarios: 0,
};
const PLAYLISTS: PlaylistDaComunidade[] = [
  { id: 'p1', nome: 'Técnica', ordem: 0, totalAulas: 0 },
  { id: 'p2', nome: 'Alimentação', ordem: 1, totalAulas: 0 },
];
const AULAS_CHEIAS: AulaDaComunidade[] = [
  ...Array.from({ length: 9 }, (_, i) => ({ ...AULA, id: `t${i}`, titulo: `Técnica fictícia ${i + 1}`, playlistId: 'p1', ordem: i, totalComentarios: i })),
  ...Array.from({ length: 2 }, (_, i) => ({ ...AULA, id: `l${i}`, titulo: `Alimentação fictícia ${i + 1}`, playlistId: 'p2', ordem: i })),
  { ...AULA, id: 's0', titulo: 'Boas-vindas', playlistId: null, ordem: 0 },
];
const AULAS_POUCAS: AulaDaComunidade[] = [{ ...AULA, id: 't0', titulo: 'Técnica fictícia 1', playlistId: 'p1', ordem: 0 }];

const POST: PostDoMural = {
  id: 'x', autorId: 'u1', autorNome: 'Treinadora Teste', autorApelido: null, autorEhAluno: false, autorFotoUrl: null, texto: '',
  tipo: 'AVISO', videoUrl: null, capaId: null, enquete: null, fotos: [], respondida: false, fixado: false, criadoEm: '2026-10-18T09:00:00-03:00',
  reacoes: {}, minhasReacoes: [], totalComentarios: 0, podId: null, podNome: null,
};
const POSTS: PostDoMural[] = [
  { ...POST, id: 'm1', fixado: true, totalComentarios: 1, texto: 'Aviso fictício: a academia fecha mais cedo na sexta. Confiram o horário novo do treino em grupo e avisem quem faltou.' },
  {
    ...POST, id: 'm2', tipo: 'ENQUETE', texto: 'Qual horário fica melhor para o treino em grupo?', totalComentarios: 3,
    enquete: {
      variasRespostas: false, encerrada: false, encerraEm: '2026-10-28T23:59:00-03:00', meusVotos: [], participantes: 3,
      opcoes: [{ id: 'o1', texto: 'Manhã', votos: 2, votantesAmostra: [] }, { id: 'o2', texto: 'Noite', votos: 1, votantesAmostra: [] }],
    },
  },
  { ...POST, id: 'm3', texto: 'Aviso fictício: novos vídeos de técnica na aba Vídeos.', criadoEm: '2026-10-17T09:00:00-03:00' },
  { ...POST, id: 'm4', texto: 'Aviso fictício: lembrete de enviar a atualização até domingo.', criadoEm: '2026-10-16T09:00:00-03:00', totalComentarios: 4 },
];
const PODS: PodResumo[] = [{ id: 'd0000000-0000-4000-8000-0000000000a1', nome: 'Turma das 6h', membros: 5, temMenor: false, criadoEm: '2026-10-10T12:00:00-03:00' }];
const pagina = (content: PostDoMural[]): PaginaDoMural => ({ content, totalElements: content.length });

async function abrirComunidade(page: Page, aba: 'videos' | 'mural', aulas = AULAS_CHEIAS) {
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /comunidade/pods': { corpo: PODS },
    'GET /comunidade/configuracao': { corpo: { alunosPublicam: true, alunosAnexamFotos: false } },
    'GET /comunidade/playlists': (_p, route) => json(route, PLAYLISTS.map((p) => ({ ...p, totalAulas: aulas.filter((a) => a.playlistId === p.id).length }))),
    'GET /comunidade/aulas': { corpo: aulas },
    'GET /comunidade/mural': (p, route) => json(route, pagina(p.busca.get('podId') ? [] : POSTS.filter((x) => x.tipo === p.busca.get('tipo')))),
  });
  await page.goto(aba === 'mural' ? '/treinador/comunidade?aba=mural' : '/treinador/comunidade');
  await expect(page.getByRole('heading', { name: 'Comunidade', level: 1 })).toBeVisible();
  return api;
}

/** Mural do aluno: seis conversas (aba Alunos), quatro conquistas e a posição; `semNumeros` = nenhuma conquista e posição com erro. */
const CONQUISTAS: ConquistaDoAluno[] = ['Primeiro treino', 'Dez treinos', 'Semana completa', 'Novo recorde'].map((titulo, i) => ({
  id: `c${i}`, tipo: `T${i}`, titulo, descricao: `Conquista fictícia ${i + 1}.`, icone: 'award', conquistadaEm: `2026-10-1${i}T12:00:00-03:00`,
}));
const RANKING: PosicaoNoRanking = { posicao: 2, treinosConcluidos: 8, pontuacao: 80, participantes: 12, nivel: 2, xp: 130, xpNoNivel: 30, faltam: 70 };
const POSTS_DO_ALUNO: PostDoMural[] = Array.from({ length: 6 }, (_, i) => ({
  ...POST, id: `a${i}`, tipo: 'CONVERSA', autorId: `u${i + 2}`, autorNome: 'Aluno Fictício', autorEhAluno: true, totalComentarios: i,
  texto: `Publicação fictícia ${i + 1}: treino de teste concluído, cargas registradas e a semana fechada com constância.`,
}));

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** `atraso`: quanto a posição e as conquistas demoram a responder (ms), para conferir que o feed não anda quando chegam. */
async function abrirMuralDoAluno(page: Page, { semNumeros = false, atraso = {} as { ranking?: number; conquistas?: number } } = {}) {
  const api = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    'GET /aluno/comunidade/configuracao': { corpo: { alunosPublicam: true, podeAnexarFoto: false } },
    'GET /aluno/comunidade/mural': (p, route) => json(route, pagina(POSTS_DO_ALUNO.filter((x) => x.tipo === p.busca.get('tipo')))),
    'GET /aluno/comunidade/aulas': { corpo: [] },
    'GET /aluno/comunidade/conquistas': async (_p, route) => {
      await esperar(atraso.conquistas ?? 0);
      await json(route, semNumeros ? [] : CONQUISTAS);
    },
    'GET /aluno/comunidade/ranking': async (_p, route) => {
      await esperar(atraso.ranking ?? 0);
      await (semNumeros ? json(route, erroApi(500, 'Falha no servidor.').corpo, 500) : json(route, RANKING));
    },
  });
  await page.goto('/aluno/comunidade?mural=alunos');
  await expect(page.getByRole('heading', { name: 'Comunidade', level: 1 })).toBeVisible();
  return api;
}

// ---------------------------------------------------------------- Vitrine

function item(n: number, extra: Partial<ItemDaVitrine> = {}): ItemDaVitrine {
  return {
    id: `v0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, nome: `Item fictício ${n}`, descricao: null, tipo: 'DIGITAL',
    precoCentavos: 9900, precoEspecialCentavos: null, precoVigenteCentavos: 9900, especialAte: null, cupom: null, linkUrl: null,
    ativo: true, naPaginaPublica: false, noMarketplace: false, ordem: n - 1, versao: 1, temFoto: n % 2 === 1, fotoAtualizadaEm: '2026-10-10T12:00:00Z', ...extra,
  };
}
const ITENS_CHEIOS = [
  item(1, { nome: 'Planilha de força', naPaginaPublica: true }), item(2, { nome: 'Camiseta do time', tipo: 'FISICO' }),
  item(3, { nome: 'Consultoria trimestral' }), item(4, { nome: 'Garrafa antiga', tipo: 'FISICO', ativo: false }),
  item(5, { nome: 'E-book de receitas' }), item(6, { nome: 'Faixa elástica', tipo: 'FISICO' }),
];

async function abrirVitrine(page: Page, itens = ITENS_CHEIOS) {
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES, vitrineHabilitada: true, lojaHabilitada: true })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /vitrine/itens': { corpo: itens },
    'GET /vitrine/configuracao': { corpo: { paginaLigada: true, codigo: 'demo', noMarketplace: false, versao: 1 } },
    'GET /vitrine/itens/{id}/foto': (_, route) => route.fulfill({ status: 200, contentType: 'image/png', body: pngDeCor(64, [120, 120, 120]) }),
  });
  await page.goto('/treinador/vitrine');
  await expect(page.getByRole('heading', { name: 'Vitrine', level: 1 })).toBeVisible();
  return api;
}

// ---------------------------------------------------------------- Capturas (antes e depois)

test.describe('capturas da tela larga (24/11)', () => {
  test.skip(!BASE_CAPTURAS, 'só com CAPTURAS_TELA_LARGA');
  for (const [largura, altura] of LARGURAS) {
    test(`agenda nas quatro visões em ${largura} px`, async ({ page }) => {
      await preparar(page, largura, altura);
      for (const visao of ['dia', 'semana', 'mes', 'ano'] as const) {
        await abrirAgenda(page, visao);
        await expect(page.getByRole('progressbar')).toHaveCount(0);
        await page.waitForTimeout(400);
        await capturar(page, `agenda-${visao}`, largura);
      }
    });
    test(`comunidade (vídeos e mural) em ${largura} px`, async ({ page }) => {
      await preparar(page, largura, altura);
      await abrirComunidade(page, 'videos');
      await expect(page.getByRole('heading', { level: 2, name: 'Técnica' })).toBeVisible();
      await page.waitForTimeout(400);
      await capturar(page, 'treinador-comunidade-videos', largura);
      await abrirComunidade(page, 'videos', AULAS_POUCAS);
      await expect(page.getByRole('heading', { level: 2, name: 'Técnica' })).toBeVisible();
      await page.waitForTimeout(400);
      await capturar(page, 'treinador-comunidade-videos-poucos', largura);
      await abrirComunidade(page, 'mural');
      await expect(page.getByText(POSTS[0].texto).first()).toBeVisible();
      await page.waitForTimeout(400);
      await capturar(page, 'treinador-comunidade-mural', largura);
    });
    test(`vitrine em ${largura} px`, async ({ page }) => {
      await preparar(page, largura, altura);
      await abrirVitrine(page);
      await expect(page.getByText('Planilha de força')).toBeVisible();
      await page.waitForTimeout(400);
      await capturar(page, 'treinador-vitrine', largura);
      await abrirVitrine(page, ITENS_CHEIOS.slice(0, 1));
      await expect(page.getByText('Planilha de força')).toBeVisible();
      await page.waitForTimeout(400);
      await capturar(page, 'treinador-vitrine-poucos', largura);
    });
  }
});

test.describe('capturas do mural com a coluna (24/11)', () => {
  test.skip(!BASE_CAPTURAS, 'só com CAPTURAS_TELA_LARGA');
  for (const [largura, altura] of [[390, 844], [1280, 900], ...LARGURAS] as const) {
    for (const tema of ['ESCURO', 'CLARO', 'AREIA'] as const) {
      const sufixo = tema === 'ESCURO' ? '' : `-${tema.toLowerCase()}`;
      test(`mural do treinador e do aluno, com e sem a coluna, em ${largura} px${sufixo}`, async ({ page }) => {
        test.slow();
        await preparar(page, largura, altura, tema);
        await abrirComunidade(page, 'mural');
        await expect(page.getByTestId('coluna-das-publicacoes').getByText(POSTS[0].texto).last()).toBeVisible();
        await page.waitForTimeout(400);
        await capturar(page, `treinador-mural${sufixo}`, largura);
        await page.getByRole('radiogroup', { name: 'Mural' }).getByRole('radio', { name: PODS[0].nome }).click();
        await expect(page.getByText(`Nenhum aviso, vídeo ou enquete no grupo ${PODS[0].nome} ainda.`)).toBeVisible();
        await page.waitForTimeout(300);
        await capturar(page, `treinador-mural-sem-destaques${sufixo}`, largura);
        await preparar(page, largura, altura, tema, {}, ALUNO.id);
        await abrirMuralDoAluno(page);
        await expect(page.getByText(POSTS_DO_ALUNO[0].texto)).toBeVisible();
        await expect(page.getByTestId(largura >= 1920 ? 'coluna-dos-numeros' : 'faixa-dos-numeros')).toBeVisible();
        await page.waitForTimeout(400);
        await capturar(page, `aluno-mural${sufixo}`, largura);
        await abrirMuralDoAluno(page, { semNumeros: true });
        await expect(page.getByText(POSTS_DO_ALUNO[0].texto)).toBeVisible();
        await page.waitForTimeout(400);
        await capturar(page, `aluno-mural-sem-numeros${sufixo}`, largura);
      });
    }
  }
});

// ---------------------------------------------------------------- Conferência em 1280 e 390 (temas e texto grande)

test.describe('conferência das telas mexidas em 1280 e 390 (24/11)', () => {
  test.skip(!BASE_CAPTURAS, 'só com CAPTURAS_TELA_LARGA');
  const casos = [
    [1280, 900, 'CLARO', {}], [1280, 900, 'ESCURO', {}], [1280, 900, 'AREIA', {}], [1280, 900, 'ESCURO', { tamanhoTexto: 'GRANDE' }],
    [390, 844, 'CLARO', {}], [390, 844, 'ESCURO', {}], [390, 844, 'AREIA', {}], [390, 844, 'CLARO', { tamanhoTexto: 'GRANDE' }],
  ] as const;
  for (const [largura, altura, tema, extra] of casos) {
    const nome = `${largura}-${tema.toLowerCase()}${'tamanhoTexto' in extra ? '-texto-grande' : ''}`;
    test(`agenda, vídeos e vitrine em ${nome}`, async ({ page }) => {
      await preparar(page, largura, altura, tema, extra);
      const salvar = async (tela: string) => {
        const pasta = path.join(BASE_CAPTURAS!, tela, 'conferencia');
        fs.mkdirSync(pasta, { recursive: true });
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(pasta, `${nome}.png`), fullPage: false });
      };
      for (const visao of ['dia', 'ano'] as const) {
        const { errosDaPagina } = await abrirAgenda(page, visao);
        await expect(page.getByRole('progressbar')).toHaveCount(0);
        await semRolagemHorizontal(page);
        expect(errosDaPagina).toEqual([]);
        await salvar(`agenda-${visao}`);
      }
      await abrirComunidade(page, 'videos');
      await expect(page.getByRole('heading', { level: 2, name: 'Técnica' })).toBeVisible();
      await semRolagemHorizontal(page);
      await salvar('treinador-comunidade-videos');
      await abrirVitrine(page);
      await expect(page.getByText('Planilha de força')).toBeVisible();
      await semRolagemHorizontal(page);
      await salvar('treinador-vitrine');
    });
  }
});

// ---------------------------------------------------------------- Geometria (tela larga: revisão, 24/11)

/** Quantos elementos ficam na mesma altura que o primeiro (as colunas da primeira linha). */
const naPrimeiraLinha = (alvo: Locator) =>
  alvo.evaluateAll((els) => {
    const ys = els.map((e) => Math.round(e.getBoundingClientRect().top));
    return ys.filter((y) => Math.abs(y - ys[0]) < 3).length;
  });

for (const [largura, altura] of [[1280, 900], ...LARGURAS] as const) {
  test.describe(`tela larga: revisão (24/11) em ${largura} px`, () => {
    test('Agenda › Ano: as linhas de meses saem cheias (o número por linha divide 12)', async ({ page }) => {
      await preparar(page, largura, altura);
      const { errosDaPagina } = await abrirAgenda(page, 'ano');
      const meses = page.getByRole('button', { name: /^Abrir .+ de 2026$/ });
      await expect(meses).toHaveCount(12);
      await assentado(async () => {
        const n = await naPrimeiraLinha(meses);
        expect(n).toBeGreaterThan(1);
        expect(12 % n).toBe(0);
        // Mais espaço, mais meses por linha (menu aberto, ao lado da coluna do mini calendário): 2 em 1280, 4 em 2560 (antes
        // 5 + 5 + 2) e 6 em 3440 (antes 8 + 4). 1920 fica no limite de 3 e 4 (a barra de rolagem do Windows decide): só
        // as linhas cheias valem ali.
        if (largura !== 1920) expect(n).toBe(largura >= 3440 ? 6 : largura >= 2560 ? 4 : 2);
      });
      await semRolagemHorizontal(page);
      expect(errosDaPagina).toEqual([]);
    });

    test('Agenda › Dia: o bloco não estica pela coluna do dia', async ({ page }) => {
      await preparar(page, largura, altura);
      const { errosDaPagina } = await abrirAgenda(page, 'dia');
      const bloco = page.getByRole('button', { name: /Ana Fictícia/ }).first();
      await expect(bloco).toBeVisible();
      await assentado(async () => {
        const b = await caixa(bloco);
        const coluna = await caixa(page.getByTestId('pista-dos-blocos').first().locator('..'));
        // 72ch do texto do app ficam por volta de 600 a 700 px; a coluna do dia passa de 1200 px a partir de 1920.
        expect(b.width).toBeLessThanOrEqual(760);
        if (largura >= 1920) expect(coluna.width).toBeGreaterThan(b.width + 400);
        // A pista não vira camada própria: o bloco aberto pelo rótulo continua por cima da linha do "agora".
        expect(await page.getByTestId('pista-dos-blocos').first().evaluate((e) => getComputedStyle(e).zIndex)).toBe('auto');
      });
      await semRolagemHorizontal(page);
      expect(errosDaPagina).toEqual([]);
    });

    test('Comunidade › Vídeos: mais colunas com mais espaço (3, 4, 5 e 6)', async ({ page }) => {
      await preparar(page, largura, altura);
      const { errosDaPagina } = await abrirComunidade(page, 'videos');
      await expect(page.getByRole('heading', { level: 2, name: 'Técnica' })).toBeVisible();
      const esperado = largura >= 3440 ? 6 : largura >= 2560 ? 5 : largura >= 1920 ? 4 : 3;
      await expect.poll(() => naPrimeiraLinha(page.getByRole('heading', { level: 3 }))).toBe(esperado);
      await semRolagemHorizontal(page);
      expect(errosDaPagina).toEqual([]);
    });

    for (const lado of ['treinador', 'aluno'] as const) {
      test(`Mural do ${lado}: feed de ~720 px e a coluna ${largura >= 1920 ? 'à direita, fixa ao rolar' : 'no topo do feed'}`, async ({ page }) => {
        const aluno = lado === 'aluno';
        await preparar(page, largura, altura, 'ESCURO', {}, aluno ? ALUNO.id : TREINADOR.id);
        const { errosDaPagina } = aluno ? await abrirMuralDoAluno(page) : await abrirComunidade(page, 'mural');
        const feed = page.getByTestId('coluna-das-publicacoes');
        const coluna = page.getByTestId(aluno ? 'coluna-dos-numeros' : 'coluna-dos-destaques');
        // No topo o aluno vê uma faixa de uma linha, para o feed começar na primeira dobra.
        const titulo = aluno && largura < 1920 ? page.getByTestId('faixa-dos-numeros')
          : page.getByRole('heading', { name: aluno ? 'Sua posição' : 'Fixados' });
        // A primeira publicação na tela (a ordem é a da API, a mais nova em cima).
        const primeiro = aluno ? feed.getByText(/^Publicação fictícia \d/).first() : feed.getByText(POSTS[0].texto, { exact: true }).last();
        await expect(primeiro).toBeVisible();
        await expect(titulo).toBeVisible();
        await assentado(async () => {
          const f = await caixa(feed);
          // A coluna de leitura: 720 px (o conteúdo de 1280 com o menu aberto já passa disso).
          expect(f.width).toBeGreaterThanOrEqual(700);
          expect(f.width).toBeLessThanOrEqual(721);
          if (largura >= 1920) {
            const c = await caixa(coluna);
            expect(c.x).toBeGreaterThanOrEqual(f.x + f.width + 24);
            expect(Math.abs(c.y - f.y)).toBeLessThan(4);
            expect(c.width).toBeLessThanOrEqual(341);
          } else {
            await expect(coluna).toHaveCount(0);
            // No topo do feed, na mesma borda, antes da primeira publicação.
            const t = await caixa(titulo);
            expect(t.y).toBeLessThan((await caixa(primeiro)).y);
            expect(t.x).toBeGreaterThanOrEqual(f.x);
            expect(t.x).toBeLessThan(f.x + 40);
          }
        });
        if (aluno && largura >= 1920) {
          // Ao lado, as três mais recentes e o caminho para a aba Conquistas, que mostra todas.
          await expect(coluna.getByText('Novo recorde', { exact: true })).toBeVisible();
          await expect(coluna.getByText('Primeiro treino', { exact: true })).toHaveCount(0);
          await expect(coluna.getByText('2º de 12 participantes')).toBeVisible();
          await expect(coluna.getByRole('button', { name: 'Ver todas as 4 conquistas' })).toBeVisible();
        } else if (aluno) {
          // No topo, uma linha só: posição e número de conquistas, e a faixa inteira leva à aba Conquistas.
          await expect(titulo).toHaveAccessibleName('Seus números: 2º de 12 · 4 conquistas. Ver conquistas');
          await expect(titulo).toContainText('2º de 12 · 4 conquistas');
          expect((await caixa(titulo)).height).toBeLessThanOrEqual(57);
          await expect(feed.getByText('Novo recorde', { exact: true })).toHaveCount(0);
        }
        await semRolagemHorizontal(page);
        if (largura >= 1920) {
          // Fixa ao rolar: numa janela baixa o feed passa da altura; a rolagem da `Tela` leva o feed e a coluna fica.
          await page.setViewportSize({ width: largura, height: 560 });
          await page.mouse.move(Math.round((await caixa(feed)).x + 200), 400);
          await page.mouse.wheel(0, 1200);
          await expect.poll(async () => (await primeiro.boundingBox())?.y ?? 0).toBeLessThan(0);
          await expect(coluna).toBeInViewport();
          await assentado(async () => expect((await caixa(coluna)).y).toBeGreaterThanOrEqual(0));
          await expect(titulo).toBeInViewport();
        }
        if (aluno) {
          // O botão leva à aba Conquistas, com todas (a mais antiga, que não cabe na coluna, também).
          await (largura >= 1920 ? page.getByRole('button', { name: 'Ver todas as 4 conquistas' }) : titulo).click();
          await expect(page).toHaveURL(/[?&]aba=ranking/);
          await expect(page.getByRole('heading', { name: 'Suas conquistas' })).toBeVisible();
          await expect(page.getByText('Primeiro treino', { exact: true })).toBeVisible();
        }
        expect(errosDaPagina).toEqual([]);
      });
    }

    test('Mural do aluno sem conquistas e sem a posição: nenhuma coluna e nenhum vão acima do feed', async ({ page }) => {
      await preparar(page, largura, altura, 'ESCURO', {}, ALUNO.id);
      const { errosDaPagina } = await abrirMuralDoAluno(page, { semNumeros: true });
      const feed = page.getByTestId('coluna-das-publicacoes');
      const primeiro = feed.getByText(/^Publicação fictícia \d/).first();
      await expect(primeiro).toBeVisible();
      await expect(page.getByTestId('coluna-dos-numeros')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Sua posição' })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Suas conquistas' })).toHaveCount(0);
      await expect(page.getByTestId('faixa-dos-numeros')).toHaveCount(0);
      await expect(page.getByTestId('faixa-dos-numeros-reservada')).toHaveCount(0);
      // A primeira publicação abre o feed: acima do texto só o recuo, o autor e a data do próprio cartão (~115 px), sem o vão
      // nem a altura de um bloco vazio.
      await assentado(async () => expect((await caixa(primeiro)).y - (await caixa(feed)).y).toBeLessThan(140));
      await semRolagemHorizontal(page);
      expect(errosDaPagina).toEqual([]);
    });

    test('Vitrine: na faixa larga, Página pública e Itens lado a lado, sem passar do teto', async ({ page }) => {
      await preparar(page, largura, altura);
      const { errosDaPagina } = await abrirVitrine(page);
      const pagina = page.getByRole('heading', { name: 'Página pública' });
      const itens = page.getByRole('heading', { name: 'Itens' });
      const linha = page.getByRole('button', { name: 'Editar Planilha de força' });
      await expect(linha).toBeVisible();
      await assentado(async () => {
        const p = await caixa(pagina);
        const i = await caixa(itens);
        const colunas = await caixa(page.getByTestId('colunas-da-vitrine'));
        if (largura >= 1920) {
          // Lado a lado: a página à esquerda, os itens à direita, na mesma altura; o par até 1400 px.
          expect(i.x).toBeGreaterThan(p.x + 300);
          expect(Math.abs(i.y - p.y)).toBeLessThan(40);
          expect(colunas.width).toBeLessThanOrEqual(1400 + 1);
        } else {
          // 1280 (faixa normal): empilhados como antes.
          expect(i.y).toBeGreaterThan(p.y + 100);
        }
      });
      await semRolagemHorizontal(page);
      expect(errosDaPagina).toEqual([]);
    });

    test('Vitrine sem a página pública: a lista para em LARGURA_EDITOR na faixa larga', async ({ page }) => {
      await preparar(page, largura, altura);
      await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES, vitrineHabilitada: true, lojaHabilitada: false })),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        'GET /vitrine/itens': { corpo: ITENS_CHEIOS },
        'GET /vitrine/itens/{id}/foto': (_, route) => route.fulfill({ status: 200, contentType: 'image/png', body: pngDeCor(64, [120, 120, 120]) }),
      });
      await page.goto('/treinador/vitrine');
      await expect(page.getByRole('button', { name: 'Editar Planilha de força' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Página pública' })).toHaveCount(0);
      await assentado(async () => {
        const colunas = await caixa(page.getByTestId('colunas-da-vitrine'));
        if (largura >= 1920) expect(colunas.width).toBeLessThanOrEqual(1040 + 1);
        else expect(colunas.width).toBeGreaterThan(900);
      });
      await semRolagemHorizontal(page);
    });
  });
}

// ---------------------------------------------------------------- Mural do aluno sem salto (faixa do topo, 24/11)

// Em 390 e 1280 (o teto do aluno é 1120, então o arranjo é o do topo): a faixa guarda o lugar enquanto os números carregam e
// o feed espera; nenhuma publicação já desenhada anda quando a resposta chega, com números ou sem.
for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
  test.describe(`mural do aluno sem salto em ${largura} px`, () => {
    const primeiroPost = (page: Page) => page.getByTestId('coluna-das-publicacoes').getByText(/^Publicação fictícia \d/).first();
    const parado = async (page: Page, y: number) => {
      await page.waitForTimeout(600);
      expect(Math.abs((await caixa(primeiroPost(page))).y - y)).toBeLessThan(1);
    };

    test('números lentos: a faixa reservada no topo, o feed espera e a primeira publicação não anda', async ({ page }) => {
      await preparar(page, largura, altura, 'ESCURO', {}, ALUNO.id);
      const { errosDaPagina } = await abrirMuralDoAluno(page, { atraso: { ranking: 1500, conquistas: 1500 } });
      await expect(page.getByTestId('faixa-dos-numeros-reservada')).toBeVisible();
      await expect(primeiroPost(page)).toHaveCount(0);
      const reservada = await caixa(page.getByTestId('faixa-dos-numeros-reservada'));
      await expect(primeiroPost(page)).toBeVisible();
      const y = (await caixa(primeiroPost(page))).y;
      const faixa = page.getByTestId('faixa-dos-numeros');
      await expect(faixa).toContainText('2º de 12 · 4 conquistas');
      // A faixa com texto ocupa o mesmo lugar da reservada.
      const cheia = await caixa(faixa);
      expect(Math.abs(cheia.y - reservada.y)).toBeLessThan(1);
      expect(Math.abs(cheia.height - reservada.height)).toBeLessThan(1);
      await parado(page, y);
      await semRolagemHorizontal(page);
      expect(errosDaPagina).toEqual([]);
    });

    test('a posição chega antes e as conquistas depois das publicações: a linha muda o texto e o feed fica parado', async ({ page }) => {
      await preparar(page, largura, altura, 'ESCURO', {}, ALUNO.id);
      const { errosDaPagina } = await abrirMuralDoAluno(page, { atraso: { conquistas: 1500 } });
      const faixa = page.getByTestId('faixa-dos-numeros');
      await expect(primeiroPost(page)).toBeVisible();
      await expect(faixa).toHaveText(/^2º de 12Ver conquistas$/);
      const y = (await caixa(primeiroPost(page))).y;
      await expect(faixa).toContainText('2º de 12 · 4 conquistas');
      await parado(page, y);
      expect(errosDaPagina).toEqual([]);
    });

    test('sem posição (erro) e sem conquistas: a faixa não existe e a primeira publicação não anda', async ({ page }) => {
      await preparar(page, largura, altura, 'ESCURO', {}, ALUNO.id);
      const { errosDaPagina } = await abrirMuralDoAluno(page, { semNumeros: true, atraso: { ranking: 1500, conquistas: 1500 } });
      await expect(page.getByTestId('faixa-dos-numeros-reservada')).toBeVisible();
      await expect(primeiroPost(page)).toHaveCount(0);
      await expect(primeiroPost(page)).toBeVisible();
      const y = (await caixa(primeiroPost(page))).y;
      await expect(page.getByTestId('faixa-dos-numeros')).toHaveCount(0);
      await expect(page.getByTestId('faixa-dos-numeros-reservada')).toHaveCount(0);
      await parado(page, y);
      await semRolagemHorizontal(page);
      expect(errosDaPagina).toEqual([]);
    });
  });
}
