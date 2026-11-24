import { LARGURA_EDITOR_DE_CAMPOS, type FaixaDeLargura } from '../tema/tokens';
import type { AbaDaFicha, BlocoDaFicha } from './fichaDoAluno';

/**
 * Arranjo da aba Ficha do aluno › Dados em colunas independentes (24/11, `docs/planos/ficha-dados-colunas-independentes.md`).
 * A partir da faixa `normal` da `Tela` (4.10, `useFaixaDaTela`): duas pilhas verticais, cada uma com o mesmo vão entre os
 * cartões, sem alinhar os cartões de uma coluna com os da outra; a sobra de altura fica só no fim da mais curta. Uma
 * proporção para a página toda (3 à esquerda, 2 à direita). Abaixo da `normal`, uma coluna na ordem do celular (23/11).
 */

/** As quatro seções dos Dados do aluno (`SECOES_DO_ALUNO`, postas pelo `DadosDoAluno`) e os blocos da aba. */
export type PecaDaAbaDados = 'identificacao' | 'contato' | 'acompanhamento' | 'objetivo' | 'planoContratado' | 'acessoAoApp' | 'anamnese' | 'lesoes';

export const COLUNAS_DA_FICHA: Readonly<Record<'esquerda' | 'direita', readonly PecaDaAbaDados[]>> = {
  esquerda: ['identificacao', 'contato', 'planoContratado', 'lesoes'],
  direita: ['acompanhamento', 'objetivo', 'acessoAoApp', 'anamnese'],
};

/** Proporção das colunas (flex): a esquerda leva o plano e a tabela das lesões; a direita, os pares curtos. */
export const PROPORCAO_DAS_COLUNAS = { esquerda: 3, direita: 2 } as const;

export const emDuasColunas = (faixa: FaixaDeLargura): boolean => faixa !== 'compacta';

const SECOES: readonly PecaDaAbaDados[] = ['identificacao', 'contato', 'acompanhamento', 'objetivo'];

/** Os blocos de uma coluna que vêm depois das seções dos Dados, na ordem, só os que a aba mostra (`blocosDaAba`). */
export function blocosDaColuna(lado: 'esquerda' | 'direita', blocos: readonly BlocoDaFicha[]): BlocoDaFicha[] {
  return COLUNAS_DA_FICHA[lado].filter((p) => !SECOES.includes(p)).flatMap((p) => blocos.filter((b) => b === p));
}

/** Numa coluna, depois dos Dados: as lesões ativas no topo e as recuperadas no fim (a ordem do celular, 23/11). */
export type PecaNumaColuna = 'lesoesAtivas' | 'planoContratado' | 'acessoAoApp' | 'anamnese' | 'lesoesRecuperadas';

export function ordemNumaColuna(blocos: readonly BlocoDaFicha[]): PecaNumaColuna[] {
  const lesoes = blocos.includes('lesoes');
  return [
    ...(lesoes ? ['lesoesAtivas' as const] : []),
    ...(['planoContratado', 'acessoAoApp', 'anamnese'] as const).filter((b) => blocos.includes(b)),
    ...(lesoes ? ['lesoesRecuperadas' as const] : []),
  ];
}

/**
 * Teto da aba em duas colunas (revisão de tela larga, 24/11, `docs/planos/tela-larga-revisao-ficha.md`): a partir da faixa
 * `normal` o título, o formulário e as colunas não passam de `LARGURA_EDITOR_DE_CAMPOS` (a regra do editor de campos, 4.10),
 * alinhados à esquerda, e a sobra fica vazia à direita. Abaixo de 1400 px de aba (1280) não muda nada; antes, só a
 * `ultralarga` tinha teto e a `larga` (1920 e 2560 com o menu aberto) esticava as colunas até ~2270 px. Numa coluna
 * (`compacta`), a largura toda (`undefined`).
 */
export const larguraMaximaDasColunas = (faixa: FaixaDeLargura): number | undefined =>
  (emDuasColunas(faixa) ? LARGURA_EDITOR_DE_CAMPOS : undefined);

/** Largura mínima de cada uma das três colunas do Resumo (Planejamento, Última medição e Atividade recente). */
export const MINIMO_DA_COLUNA_DO_RESUMO = 640;

/**
 * Resumo em três colunas (Atividade recente ao lado do Planejamento e da Última medição) quando cabem três colunas de
 * `MINIMO_DA_COLUNA_DO_RESUMO` com o vão: a largura é a medida do próprio Resumo, não a faixa. Abre em 2560 com o menu
 * aberto (~2270 px de Resumo) e não em 1920 (~1630); antes só na `ultralarga`, e em 2560 a Atividade recente esticava.
 */
export const resumoEmTresColunas = (largura: number, vao: number): boolean => largura >= 3 * MINIMO_DA_COLUNA_DO_RESUMO + 2 * vao;

/** Blocos das abas Acompanhamento e Evolução que podem ir lado a lado, em duas pilhas independentes (como os Dados). */
const PILHAS: Partial<Record<AbaDaFicha, Readonly<Record<'esquerda' | 'direita', readonly BlocoDaFicha[]>>>> = {
  // Registros de treino à esquerda; água e respostas das atualizações à direita.
  acompanhamento: { esquerda: ['frequencia', 'treinosConcluidos', 'recordesDaSemana', 'trocasDeExercicio'], direita: ['agua', 'evolucaoDasRespostas'] },
  // Peso, progresso e fotos à esquerda; a avaliação física (o bloco mais alto) sozinha à direita.
  evolucao: { esquerda: ['peso', 'progresso', 'fotos'], direita: ['avaliacaoFisica'] },
};

/** Largura mínima de cada pilha: abaixo disso as tabelas e gráficos dos cartões apertam (a mesma régua dos grupos de Alunos). */
export const MINIMO_DA_PILHA = 1000;

/**
 * Duas pilhas independentes (1:1) nas abas Acompanhamento e Evolução quando cada uma tem pelo menos `MINIMO_DA_PILHA` px
 * (2560 e 3440 com o menu aberto; 1920 continua numa coluna). Só os blocos que a aba mostra, na ordem de cada pilha; um
 * bloco sem lugar definido vai para o fim da esquerda (nunca some). `null` = uma coluna: largura pequena, aba sem
 * pilhas ou uma das pilhas vazia (sem cartão sozinho de um lado e vão do outro).
 */
export function pilhasDaAba(aba: AbaDaFicha, blocos: readonly BlocoDaFicha[], largura: number, vao: number): Record<'esquerda' | 'direita', BlocoDaFicha[]> | null {
  const pilhas = PILHAS[aba];
  if (!pilhas || largura < 2 * MINIMO_DA_PILHA + vao) return null;
  const direita = pilhas.direita.filter((b) => blocos.includes(b));
  const esquerda = [...pilhas.esquerda.filter((b) => blocos.includes(b)), ...blocos.filter((b) => !pilhas.esquerda.includes(b) && !pilhas.direita.includes(b))];
  return esquerda.length && direita.length ? { esquerda, direita } : null;
}
