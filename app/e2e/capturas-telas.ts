import { expect, type Page, type Route } from '@playwright/test';

import type { ComentarioDoMural, PaginaDoMural, PostDoMural } from '../src/api/comunidadeTipos';
import type { AlunoDetalhe, Atualizacao, ItemDeAtividade, Receita, Serie } from '../src/api/tipos';
import { sessaoDeAluno, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';
import { ALUNO, erroApi, json, MARCA, PERMISSOES_TREINADOR, sessao, TREINADOR, type PedidoFalso, type RespostasApi } from './api-falsa';
import { ALUNO_ID, BIBLIOTECA, PLANO_ID, planoDetalhe } from './editor-inspetor.dados';

/**
 * Telas da prancha de `capturas-paletas.spec.ts` que vieram com a verificação final de
 * `docs/planos/hierarquia-visual-tres-temas.md`: editor de treino, folha "Usar receita", ficha do aluno, treino do aluno
 * com a barra de descanso aberta, Comunidade do aluno, mural da equipe (Avisos e Alunos) e o alimento novo sem macros.
 * Rotas e dados copiados dos e2e de cada tela (editor-de-treino-reorganizado, editor-clareza, ficha-em-abas,
 * treino-ao-vivo, comunidade, biblioteca-catalogo). `pronto` também faz o caminho até o estado da captura. Só dados fictícios.
 */
export interface Tela {
  nome: string;
  caminho: string;
  /** Dono da preferência de tema no aparelho; padrão, o treinador. */
  usuarioId?: string;
  rotas: (page: Page) => Promise<RespostasApi>;
  pronto: (page: Page) => Promise<void>;
}

const SEM_INSCRICOES: RespostasApi = { 'GET /inscricoes': { corpo: { itens: [], total: 0 } } };

// Editor de treino do aluno (o mesmo plano do editor-inspetor) e as receitas de séries da folha "Usar receita".
const PERMISSOES_DO_EDITOR = [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR'];
const semCarga = { modo: 'CARGA_TRABALHO' as const, percentualMin: null, percentualMax: null };
const serie = (uid: string, tipo: string, extra: Partial<Serie> = {}): Serie => ({
  uid, tipo, repsMin: 3, repsMax: 3, carga: semCarga, esforco: null, descansoSegundos: null, tecnica: null, ...extra,
});
const daWs = (percentualMin: number) => ({ modo: 'PERCENTUAL_WS' as const, percentualMin, percentualMax: null });
const PASTA_FORCA = 'p0000000-0000-4000-8000-000000000031';
const receita = (id: string, nome: string, series: Serie[], extra: Partial<Receita> = {}): Receita => ({
  id, tipo: 'SERIES', nome, descricao: null, pastaId: null, ordem: 1, versao: 1, conteudo: { series }, ...extra,
});
const RECEITAS: Receita[] = [
  receita('m0000000-0000-4000-8000-000000000032', 'Força com preparação', [
    serie('r1-fs', 'FEEDER', { repsMin: 5, repsMax: 5, carga: daWs(60) }),
    serie('r1-ws', 'WORKING', { repsMin: 4, repsMax: 6 }),
  ], { pastaId: PASTA_FORCA, descricao: 'Uma de preparação e uma de trabalho.' }),
  receita('m0000000-0000-4000-8000-000000000033', 'Volume fictício', [
    serie('r2-ws', 'WORKING', { repsMin: 8, repsMax: 10 }),
    serie('r2-bo1', 'BACK_OFF', { repsMin: 10, repsMax: 12, carga: daWs(85) }),
    serie('r2-bo2', 'BACK_OFF', { repsMin: 10, repsMax: 12, carga: daWs(85) }),
  ]),
];

const rotasDoEditor = async (page: Page): Promise<RespostasApi> => ({
  ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_DO_EDITOR })),
  ...SEM_INSCRICOES,
  [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
  [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
  'GET /exercicios': { corpo: BIBLIOTECA },
  [`GET /planos-treino/${PLANO_ID}`]: (_p, route) => json(route, planoDetalhe(false)),
  'GET /pastas-modelos': { corpo: [{ id: PASTA_FORCA, nome: 'Força', versao: 1 }] },
  'GET /receitas': (p, route) => json(route, p.busca.get('tipo') === 'SERIES' ? RECEITAS : []),
});

/** No estreito o exercício se escolhe em "Exercício aberto"; em duas colunas o 1º já vem aberto. */
async function abrirPrimeiroExercicio(page: Page) {
  await expect(page.getByRole('button', { name: /^Editar sessão/ })).toBeVisible();
  if ((page.viewportSize()?.width ?? 1280) < 1024) {
    await page.getByRole('button', { name: /^Exercício aberto/ }).click();
    await page.getByRole('radio', { name: /^1\. / }).click();
  }
}

// Ficha do aluno: Resumo com peso, atividade recente e sem atualização (ficha-em-abas).
const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};
const SEM_ATUALIZACAO: Atualizacao = {
  id: null, pastaId: null, alunoId: ALUNO_ID, nomeAluno: null, dataAtualizacao: null, fase: 'NENHUMA', diasParaData: 0, diasDeAtraso: 0,
  atrasoAte: null, atrasoMotivo: null, questionarioVersaoNumero: 0, questionarioVersaoId: null, questionarioNome: null, modelo: null,
  respostas: null, enviadaEm: null, feedback: null, versao: null, resumo: null,
};
const ATIVIDADE: ItemDeAtividade[] = [
  { tipo: 'ATUALIZACAO_ENVIADA', titulo: 'Atualização enviada', quando: '2026-10-19T11:00:00-03:00', destino: { tipo: 'ATUALIZACAO', id: 'b0000000-0000-4000-8000-0000000000b1' } },
  { tipo: 'PLANO_PUBLICADO', titulo: 'Plano publicado', quando: '2026-10-18T12:00:00-03:00', destino: { tipo: 'PASTA', id: 'f0000000-0000-4000-8000-0000000000a1' } },
  { tipo: 'TREINO_CONCLUIDO', titulo: 'Treino concluído', quando: '2026-10-17T12:00:00-03:00', destino: null },
];

// Comunidade: aviso, enquete e vídeo na aba Avisos; conversa, dúvida respondida e resultado na aba Alunos.
const post = (id: string, tipo: PostDoMural['tipo'], texto: string, extra: Partial<PostDoMural> = {}): PostDoMural => ({
  id, autorId: 'u1', autorNome: 'Treinadora Teste', autorApelido: null, autorEhAluno: false, autorFotoUrl: null, texto, tipo,
  videoUrl: null, capaId: null, enquete: null, fotos: [], respondida: false, fixado: false, criadoEm: '2026-10-19T09:00:00-03:00',
  reacoes: {}, minhasReacoes: [], totalComentarios: 0, podId: null, podNome: null, ...extra,
});
const doAluno = { autorId: 'u2', autorNome: 'Aluno Fictício', autorApelido: 'Fictí', autorEhAluno: true };
const POSTS: PostDoMural[] = [
  post('p1', 'AVISO', 'Aviso fictício: o treino coletivo de sábado começa às 8h.', { fixado: true, reacoes: { CURTIR: 6, FOGO: 3 }, totalComentarios: 2 }),
  post('p2', 'ENQUETE', 'Qual horário fica melhor para o próximo encontro?', {
    criadoEm: '2026-10-18T18:00:00-03:00',
    enquete: {
      variasRespostas: false, encerrada: false, encerraEm: '2026-10-25T23:59:00-03:00', meusVotos: ['o1'], participantes: 9,
      opcoes: [
        { id: 'o1', texto: 'Sábado de manhã', votos: 6, votantesAmostra: [] },
        { id: 'o2', texto: 'Domingo à tarde', votos: 3, votantesAmostra: [] },
      ],
    },
  }),
  post('p3', 'VIDEO', 'Vídeo fictício: técnica do agachamento', { videoUrl: 'https://exemplo.test/video', criadoEm: '2026-10-17T10:00:00-03:00', reacoes: { PALMAS: 4 } }),
  post('p4', 'CONVERSA', 'Semana de constância, time! Quatro treinos feitos.', { ...doAluno, reacoes: { CURTIR: 2, FOGO: 5 }, minhasReacoes: ['FOGO'], totalComentarios: 4 }),
  post('p5', 'DUVIDA', 'Posso trocar o supino pela máquina quando o banco estiver ocupado?', { ...doAluno, respondida: true, criadoEm: '2026-10-18T20:00:00-03:00', totalComentarios: 1 }),
  post('p6', 'RESULTADO', 'Treino concluído: Pernas.', { ...doAluno, autorNome: 'Aluna Fictícia de Teste', autorApelido: null, criadoEm: '2026-10-18T07:30:00-03:00', reacoes: { FORCA: 3 } }),
];
const pagina = (content: PostDoMural[]): PaginaDoMural => ({ content, totalElements: content.length });
/** Como a API: cada aba pede um `?tipo=` por vez. */
const mural = (p: PedidoFalso, route: Route) =>
  json(route, pagina(POSTS.filter((x) => !p.busca.get('tipo') || x.tipo === p.busca.get('tipo'))));
const AULA = {
  id: 'a1', titulo: 'Vídeo de técnica', descricao: 'Pauta do vídeo de teste.', videoUrl: 'https://exemplo.test/video', capaId: null,
  categoria: 'Técnica', ordem: 0, publicada: true, criadaEm: '2026-10-19T12:00:00-03:00', totalComentarios: 0,
};
const COMENTARIOS: { itens: ComentarioDoMural[]; total: number } = { itens: [], total: 0 };
const rotasDaComunidadeDaEquipe = async (page: Page): Promise<RespostasApi> => ({
  ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'COMUNIDADE_MODERAR'] })),
  ...SEM_INSCRICOES,
  'GET /comunidade/configuracao': { corpo: { alunosPublicam: true, alunosAnexamFotos: false } },
  'GET /comunidade/mural': mural,
  'GET /comunidade/aulas': { corpo: [AULA] },
  'GET /comunidade/pods': { corpo: [] },
  'GET /comunidade/mural/{id}/comentarios': { corpo: COMENTARIOS },
});

export const TELAS_NOVAS: Tela[] = [
  {
    nome: 'editor-treino', caminho: `/treinador/treinos/${PLANO_ID}`,
    rotas: rotasDoEditor,
    pronto: async (page) => {
      await abrirPrimeiroExercicio(page);
      await expect(page.getByRole('button', { name: 'Usar receita de séries', exact: true }).first()).toBeVisible();
    },
  },
  {
    nome: 'usar-receita', caminho: `/treinador/treinos/${PLANO_ID}`,
    rotas: rotasDoEditor,
    pronto: async (page) => {
      await abrirPrimeiroExercicio(page);
      await page.getByRole('button', { name: 'Usar receita de séries', exact: true }).first().click();
      await expect(page.getByRole('button', { name: 'Receitas completas, aberto', exact: true })).toBeVisible();
      await expect(page.getByText('Volume fictício', { exact: true })).toBeVisible();
    },
  },
  {
    nome: 'ficha', caminho: `/treinador/alunos/${ALUNO_ID}`,
    rotas: async (page) => ({
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'REGISTRO_LER', 'ATUALIZACAO_LER', 'TREINO_LER', 'DIETA_LER'] })),
      ...SEM_INSCRICOES,
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
      [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
      [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: [{ id: 'p1', data: '2026-10-12', pesoKg: 80.5, variacao: null, observacao: null }] },
      [`GET /alunos/${ALUNO_ID}/lesoes`]: { corpo: [] },
      [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [] },
      [`GET /alunos/${ALUNO_ID}/atividade-recente`]: { corpo: { itens: ATIVIDADE } },
      [`GET /alunos/${ALUNO_ID}/atualizacao`]: { corpo: SEM_ATUALIZACAO },
      [`GET /alunos/${ALUNO_ID}/execucoes`]: { corpo: [] },
    }),
    pronto: async (page) => {
      await expect(page.getByRole('tab', { name: 'Resumo', exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { name: 'Próximo passo', exact: true })).toBeVisible();
      await expect(page.getByText('Treino concluído', { exact: true })).toBeVisible();
    },
  },
  {
    nome: 'treino-aluno-descanso', caminho: '/aluno/sessao/sx/sxe1?data=2026-10-19', usuarioId: ALUNO.id,
    rotas: async (page) => {
      const sessoes = [sessaoFalsa('sx', 'Treino curto', 1, 1)];
      // Sem última carga (como o treino-ao-vivo): com sugestão, o ✓ abre o painel "Sim, X" em vez de marcar a série.
      sessoes[0].exercicios[0] = { ...sessoes[0].exercicios[0], nome: 'Supino de teste' };
      sessoes[0].exercicios[0].series = sessoes[0].exercicios[0].series.map((s) => ({ ...s, descansoSegundos: 90 }));
      return {
        ...(await sessaoDeAlunoComTreino(page, sessoes)),
        'POST /aluno/execucoes/lote': (p, route) => {
          const lote = (p.corpo as { registros: { id: string }[] }).registros;
          return json(route, { resultados: lote.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) });
        },
      };
    },
    pronto: async (page) => {
      await page.getByRole('checkbox', { name: 'Série 1 feita', exact: true }).click();
      // Com o relógio fixo (fixarHoje) o descanso não anda: a barra fica aberta em 1:30.
      await expect(page.getByRole('button', { name: 'Pular o descanso', exact: true })).toBeVisible();
    },
  },
  {
    nome: 'comunidade-aluno', caminho: '/aluno/comunidade', usuarioId: ALUNO.id,
    rotas: async (page) => ({
      ...(await sessaoDeAluno(page)),
      'GET /aluno/comunidade/configuracao': { corpo: { alunosPublicam: true, podeAnexarFoto: false } },
      'GET /aluno/comunidade/mural': mural,
      'GET /aluno/comunidade/aulas': { corpo: [AULA] },
      'GET /aluno/comunidade/conquistas': { corpo: [] },
      'GET /aluno/comunidade/ranking': { corpo: { posicao: 2, treinosConcluidos: 8, pontuacao: 80, participantes: 12, nivel: 2, xp: 130, xpNoNivel: 30, faltam: 70 } },
      'GET /aluno/comunidade/mural/{id}/comentarios': { corpo: COMENTARIOS },
    }),
    pronto: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Comunidade' })).toBeVisible();
      await expect(page.getByText('Aviso fictício: o treino coletivo de sábado começa às 8h.')).toBeVisible();
    },
  },
  {
    nome: 'mural-equipe-avisos', caminho: '/treinador/comunidade?aba=mural',
    rotas: rotasDaComunidadeDaEquipe,
    pronto: async (page) => {
      await expect(page.getByRole('radio', { name: 'Avisos', exact: true })).toBeChecked();
      await expect(page.getByText('Aviso fictício: o treino coletivo de sábado começa às 8h.')).toBeVisible();
    },
  },
  {
    nome: 'mural-equipe-alunos', caminho: '/treinador/comunidade?aba=mural&mural=alunos',
    rotas: rotasDaComunidadeDaEquipe,
    pronto: async (page) => {
      await expect(page.getByRole('radio', { name: 'Alunos', exact: true })).toBeChecked();
      await expect(page.getByText('Semana de constância, time! Quatro treinos feitos.')).toBeVisible();
    },
  },
  {
    nome: 'alimento-novo', caminho: '/treinador/biblioteca?aba=alimentos',
    rotas: async (page) => ({
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
      ...SEM_INSCRICOES,
      'GET /alimentos': { corpo: [] },
      'GET /catalogo/alimentos/grupos': { corpo: [] },
    }),
    pronto: async (page) => {
      await page.getByRole('button', { name: 'Novo alimento', exact: true }).first().click();
      const folha = page.getByRole('dialog', { name: 'Novo alimento' });
      await expect(folha.getByText('Preencha os três para o app calcular a kcal.')).toBeVisible();
      await expect(folha.getByLabel(/^Kcal \(calculada\)/)).toBeVisible();
    },
  },
];
