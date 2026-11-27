import type { Atualizacao, AtualizacaoDaLista, ConteudoQuestionario, FatoDeAtencao } from '../src/api/tipos';
import { ALUNO, type RespostasApi } from './api-falsa';

/**
 * Atualizações fictícias com pontos de atenção (`docs/planos/regras-de-atencao.md`): a lista (`pontosDeAtencao` por item) e
 * o detalhe da revisão (`atencao[]`, os fatos gravados no envio). Só dados fictícios.
 */

export const ID = 'e0000000-0000-4000-8000-0000000000a1';
export const ANTERIOR_ID = 'e0000000-0000-4000-8000-0000000000a0';
export const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
export const PASTA_ID = 'f0000000-0000-4000-8000-0000000000a1';

export const MODELO: ConteudoQuestionario = {
  formato: 2,
  instrucoes: [],
  secoes: [
    { uid: 's1', titulo: 'Rotina', perguntas: [
      { id: 'peso', tipo: 'PESO', rotulo: 'Peso em jejum', obrigatoria: true },
      { id: 'sono', tipo: 'NOTA', rotulo: 'Como foi o seu sono nas últimas semanas?', rotuloCurto: 'Sono', obrigatoria: true },
      { id: 'energia', tipo: 'NOTA', rotulo: 'Energia nos treinos', obrigatoria: true },
      { id: 'dores', tipo: 'SIM_NAO', rotulo: 'Sentiu dores nos treinos?', obrigatoria: true },
    ] },
  ],
};

const base = {
  pastaId: PASTA_ID, alunoId: ALUNO_ID, nomeAluno: ALUNO.nome, diasParaData: -2, diasDeAtraso: 0, atrasoAte: null, atrasoMotivo: null,
  questionarioVersaoNumero: 1, questionarioVersaoId: 'q0000000-0000-4000-8000-0000000000a1', questionarioNome: 'Padrão', modelo: MODELO, versao: 1,
} satisfies Partial<Atualizacao>;

const fato = (tipo: FatoDeAtencao['tipo'], perguntaId: string | null, limiteVigente: number | null, valorObservado: number | null = null): FatoDeAtencao =>
  ({ tipo, perguntaId, limiteVigente, valorObservado });

/**
 * Seis fatos: dois na mesma pergunta (sono 5 ou menos e caiu 2 ou mais: uma linha, duas legendas), o Sim das dores, uma
 * pergunta que não está nesta versão do questionário ("humor"), os dias com treino e o peso que veio sem pergunta (só a
 * legenda). O peso da pergunta continua no "O que mudou" (o fato do peso não tem pergunta, não ocupa a linha dela).
 */
export const FATOS: FatoDeAtencao[] = [
  fato('NOTA_ABAIXO', 'sono', 5, 4),
  fato('NOTA_CAIU', 'sono', 2, -3),
  fato('SIM', 'dores', null),
  fato('NOTA_ABAIXO', 'humor', 4, 3),
  fato('POUCOS_TREINOS', null, 4, 3),
  fato('PESO_MUDOU', null, 1.5, -2),
];

export const ATUAL: Atualizacao = {
  ...base, id: ID, dataAtualizacao: '2026-11-20', fase: 'ENVIADA', enviadaEm: '2026-11-20T12:00:00Z', feedback: null,
  respostas: { peso: 80, sono: 4, energia: 6, dores: true },
  resumo: { diasComTreino: 3, mediaDiasPorSemana: 0.8, pesoAnterior: 82 },
  atencao: FATOS,
};

export const ANTERIOR: Atualizacao = {
  ...base, id: ANTERIOR_ID, pastaId: 'f0000000-0000-4000-8000-0000000000a0', dataAtualizacao: '2026-10-23', fase: 'REVISADA', enviadaEm: '2026-10-23T12:00:00Z',
  feedback: { texto: 'Bom trabalho.', em: '2026-10-24T10:00:00Z', editadoEm: null, naoLido: false },
  respostas: { peso: 82, sono: 7, energia: 8, dores: false }, resumo: { diasComTreino: 9, mediaDiasPorSemana: 2.3, pesoAnterior: 83 },
};

/** Todas as mudanças viram ponto de atenção (só o sono mudou e bateu na regra). */
export const SO_PONTOS: Atualizacao = {
  ...ATUAL, respostas: { peso: 82, sono: 4, energia: 8, dores: false }, resumo: { diasComTreino: 9, mediaDiasPorSemana: 2.3, pesoAnterior: 82 },
  atencao: [fato('NOTA_ABAIXO', 'sono', 5, 4)],
};

/** Um item da lista; `n` vira o fim dos ids. */
export function itemDaLista(n: number, nome: string, pontosDeAtencao: number | null, extra: Partial<AtualizacaoDaLista> = {}): AtualizacaoDaLista {
  const fim = String(n).padStart(12, '0');
  return {
    id: `b0000000-0000-4000-8000-${fim}`, pastaId: `c0000000-0000-4000-8000-${fim}`, alunoId: `a0000000-0000-4000-8000-${fim}`,
    nomeAluno: nome, dataAtualizacao: '2026-11-20', fase: 'ENVIADA', diasParaData: -1, diasDeAtraso: 0, atrasoAte: null, pontosDeAtencao, ...extra,
  };
}

const NOMES = ['Ana Fictícia', 'Bruno Exemplo', 'Carla Teste', 'Diego Modelo', 'Elisa Amostra', 'Fábio Simulado', 'Gabi Fictícia', 'Heitor Exemplo'];

/** A lista inteira (1 ponto, vários, nenhum e nulo) e a filtrada (só as com pontos). */
export const LISTA: AtualizacaoDaLista[] = NOMES.map((nome, i) => itemDaLista(i + 1, nome, [2, null, 1, 0, 3, null, 6, 0][i]));
export const SO_COM_PONTOS = LISTA.filter((a) => (a.pontosDeAtencao ?? 0) > 0);

/** As rotas que a revisão sempre consulta, sem prescrito (o aluno não tem plano), e o menu. */
export function rotasDaRevisao(atual: Atualizacao, historico: RespostasApi[string] = { corpo: [atual, ANTERIOR] }): RespostasApi {
  return {
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /atualizacoes/${atual.id}`]: { corpo: atual },
    [`GET /alunos/${ALUNO_ID}/atualizacoes`]: historico,
    [`GET /alunos/${ALUNO_ID}/planos-treino`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/planos-dieta`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/atualizacoes/evolucao`]: { corpo: { limite: 6, atualizacoes: 2, series: [] } },
    [`GET /alunos/${ALUNO_ID}/fotos`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/avaliacoes-fisicas`]: { corpo: [] },
  };
}
