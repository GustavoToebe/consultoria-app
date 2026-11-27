import type { Page } from '@playwright/test';

import type { ConfiguracaoInscricao } from '../src/api/inscricoesTipos';
import type { ConteudoQuestionario, FinalidadeQuestionario, PerguntaAtualizacao, QuestionarioDetalhe, SalvarQuestionarioRequest, TipoPergunta } from '../src/api/tipos';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Editor de questionário em tela larga (`docs/design-e-front.md` 4.10, "editor com índice e prévia ao vivo"): uma
 * anamnese fictícia de 57 perguntas em 6 seções e as perguntas da inscrição. Só dados fictícios.
 */
export const ANAMNESE_ID = 'q0000000-0000-4000-8000-000000000057';
export const INSCRICAO_ID = 'q0000000-0000-4000-8000-000000000058';
export const ATUALIZACAO_ID = 'q0000000-0000-4000-8000-000000000059';

const tipos: TipoPergunta[] = ['TEXTO', 'SIM_NAO', 'ESCOLHA_UNICA', 'NUMERO', 'NOTA', 'TEXTO_LONGO'];
const pergunta = (secao: number, n: number, rotulo: string): PerguntaAtualizacao => {
  const tipo = tipos[n % tipos.length];
  const id = `s${secao}p${n}`;
  return {
    id, tipo, rotulo, obrigatoria: n % 3 === 0,
    ...(tipo === 'ESCOLHA_UNICA' ? { opcoes: [{ id: `${id}a`, rotulo: 'Pouco' }, { id: `${id}b`, rotulo: 'Às vezes' }, { id: `${id}c`, rotulo: 'Muito' }] } : {}),
  };
};
const secao = (i: number, titulo: string, rotulos: string[]) => ({ uid: `sec${i}`, titulo, perguntas: rotulos.map((r, n) => pergunta(i, n, r)) });

export const SECOES_DA_ANAMNESE = ['Dados pessoais', 'Histórico de saúde', 'Treino', 'Rotina e sono', 'Alimentação', 'Objetivos'];
export const ANAMNESE: ConteudoQuestionario = {
  formato: 2,
  instrucoes: ['Responda com calma: leva uns 10 minutos.', 'Se não souber uma resposta, deixe em branco e siga.'],
  secoes: [
    secao(0, 'Dados pessoais', ['Como prefere ser chamado?', 'Tem filhos?', 'Com que frequência viaja a trabalho?', 'Altura (cm)', 'Disposição no dia a dia',
      'Conte um pouco da sua rotina', 'Profissão', 'Trabalha sentado?', 'Quanto tempo de deslocamento por dia?', 'Horas de trabalho por dia']),
    secao(1, 'Histórico de saúde', ['Tem alguma lesão hoje?', 'Já operou alguma articulação?', 'Sente dor ao treinar?', 'Pressão arterial (se souber)',
      'Nível de dor nas costas', 'Descreva cirurgias anteriores', 'Usa algum remédio contínuo?', 'Tem liberação médica?', 'Quantas vezes adoeceu no ano?',
      'Disposição pela manhã', 'Algo mais que o treinador deva saber?', 'Alguma alergia?']),
    secao(2, 'Treino', ['Treina há quanto tempo?', 'Já treinou com treinador?', 'Quantos dias por semana pode treinar?', 'Minutos por sessão',
      'Gosto por treino de força', 'Como foi seu último treino?', 'Prefere treinar em casa ou na academia?', 'Tem acesso a halteres?', 'Ritmo que prefere', 'Carga máxima no agachamento (kg)']),
    secao(3, 'Rotina e sono', ['Que horas costuma acordar?', 'Dorme bem?', 'Quantas vezes acorda à noite?', 'Horas de sono por noite', 'Qualidade do sono',
      'Como é sua noite antes de treinar?', 'Usa telas antes de dormir?', 'Toma café?', 'Cochila durante o dia?']),
    secao(4, 'Alimentação', ['Quantas refeições faz por dia?', 'Segue alguma dieta?', 'Come fora com que frequência?', 'Copos de água por dia',
      'Satisfação com a alimentação', 'O que costuma comer no café da manhã?', 'Tem restrição alimentar?', 'Cozinha em casa?', 'Fome à noite', 'Litros de água por dia']),
    secao(5, 'Objetivos', ['Qual seu objetivo principal?', 'Já tentou antes?', 'Em quanto tempo quer ver resultado?', 'Peso que gostaria de alcançar (kg)',
      'Motivação hoje', 'O que mudaria na sua vida com o resultado?']),
  ],
};

export const INSCRICAO: ConteudoQuestionario = {
  formato: 2, instrucoes: [],
  secoes: [
    secao(0, 'Sobre o seu treino', ['Já treina?', 'Há quanto tempo treina?', 'Quantos dias por semana pode treinar?']),
    secao(1, 'Horários', ['Qual o melhor horário para o contato?', 'Prefere mensagem ou ligação?']),
  ],
};

const detalhe = (id: string, nome: string, finalidade: FinalidadeQuestionario, rascunho: ConteudoQuestionario): QuestionarioDetalhe => ({
  id, nome, descricao: null, finalidade, padrao: true, arquivado: false, versaoPublicada: 1, publicadoEm: '2026-11-10T12:00:00Z',
  alteradoDesdePublicacao: false, rascunhoAlteradoEm: '2026-11-10T12:00:00Z', uso: { alunos: 0, pastas: 0, envios: 0 }, versao: 1, rascunho,
  versoes: [{ numero: 1, publicadoEm: '2026-11-10T12:00:00Z' }],
});

const CONFIG: ConfiguracaoInscricao = {
  aberta: true, codigo: 'codigo-ficticio', link: 'https://consultoria.exemplo.test/inscricao/codigo-ficticio', responsavelId: null, texto: null,
  camposOcultos: ['ORIGEM'], versao: 1,
};

/** Abre o editor (anamnese ou inscrição) na largura dada, com o tema guardado no aparelho do treinador. */
export async function abrirEditor(page: Page, { qual, largura, altura = 900, tema = 'ESCURO', extra = {}, rascunho }: {
  qual: 'anamnese' | 'inscricao' | 'atualizacao'; largura: number; altura?: number; tema?: 'ESCURO' | 'CLARO'; extra?: RespostasApi;
  /** Rascunho próprio (no lugar da anamnese de 57 perguntas ou das perguntas da inscrição). */
  rascunho?: ConteudoQuestionario;
}) {
  await page.setViewportSize({ width: largura, height: altura });
  await page.addInitScript(([u, t]) => localStorage.setItem(`treinos:${u}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
  const id = qual === 'anamnese' ? ANAMNESE_ID : qual === 'atualizacao' ? ATUALIZACAO_ID : INSCRICAO_ID;
  let atual = qual === 'anamnese' ? detalhe(ANAMNESE_ID, 'Anamnese completa', 'ANAMNESE', rascunho ?? ANAMNESE)
    : qual === 'atualizacao' ? detalhe(ATUALIZACAO_ID, 'Atualização completa', 'ATUALIZACAO', rascunho ?? ANAMNESE) : detalhe(INSCRICAO_ID, 'Inscrição', 'INSCRICAO', rascunho ?? INSCRICAO);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'QUESTIONARIO_LER', 'QUESTIONARIO_ALTERAR', 'INSCRICAO_LER'] })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /inscricoes/configuracao': { corpo: CONFIG },
    [`GET /questionarios/${id}`]: (_p, route) => json(route, atual),
    [`PUT /questionarios/${id}`]: (p, route) => {
      atual = { ...atual, rascunho: (p.corpo as SalvarQuestionarioRequest).conteudo, versao: atual.versao + 1 };
      return json(route, atual);
    },
    ...extra,
  });
  await page.goto(`/treinador/planejamento/questionario/${id}`);
  return api;
}
