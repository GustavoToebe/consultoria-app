import { LARGURA_EDITOR_DE_CAMPOS, type FaixaDeLargura } from '../tema/tokens';
import type { AbaDaFicha, BlocoDaFicha } from './fichaDoAluno';

/**
 * Arranjo da aba Ficha do aluno › Dados em colunas independentes (24/11, `docs/planos/ficha-dados-colunas-independentes.md`).
 * A partir da faixa `normal` da `Tela` (4.10, `useFaixaDaTela`): duas pilhas verticais, cada uma com o mesmo vão entre os
 * cartões, sem alinhar os cartões de uma coluna com os da outra; a sobra de altura fica só no fim da mais curta. Uma
 * proporção para a página toda (3 à esquerda, 2 à direita), e o Histórico de lesões embaixo, na largura das duas (com a
 * esquerda vazia, uma coluna só, `colunaUnica`). Abaixo da `normal`, uma coluna na ordem do celular (23/11).
 * Com largura medida para três colunas (2560 e 3440 com o menu aberto), três pilhas (`colunasDaAbaDados`, 24/11).
 */

/** As quatro seções dos Dados do aluno (`SECOES_DO_ALUNO`, postas pelo `DadosDoAluno`) e os blocos da aba. */
export type PecaDaAbaDados = 'identificacao' | 'contato' | 'acompanhamento' | 'objetivo' | 'planoContratado' | 'acessoAoApp' | 'anamnese' | 'lesoes';
export type SecaoDosDados = Extract<PecaDaAbaDados, 'identificacao' | 'contato' | 'acompanhamento' | 'objetivo'>;
type BlocoDaAbaDados = Exclude<PecaDaAbaDados, SecaoDosDados>;

export const SECOES_DOS_DADOS: readonly SecaoDosDados[] = ['identificacao', 'contato', 'acompanhamento', 'objetivo'];
const ehSecao = (p: PecaDaAbaDados): p is SecaoDosDados => (SECOES_DOS_DADOS as readonly string[]).includes(p);

/**
 * Duas colunas (faixas normal e larga): 3 para 2; a esquerda leva o plano, a direita os pares curtos. O Histórico de lesões
 * fica abaixo das duas, na largura delas somada (`ABAIXO_DAS_DUAS_COLUNAS`, Gustavo, 24/11): na coluna de 3/5 a tabela não
 * cabia em 1280 e virava cartões.
 */
export const COLUNAS_DA_FICHA: Readonly<Record<'esquerda' | 'direita', readonly PecaDaAbaDados[]>> = {
  esquerda: ['identificacao', 'contato', 'planoContratado'],
  direita: ['acompanhamento', 'objetivo', 'acessoAoApp', 'anamnese'],
};
export const ABAIXO_DAS_DUAS_COLUNAS: readonly BlocoDaAbaDados[] = ['lesoes'];
export const PROPORCAO_DAS_COLUNAS = { esquerda: 3, direita: 2 } as const;

/**
 * Três colunas (tela larga, 24/11, decisão 1 de `docs/planos/tela-larga-revisao-2.md`): os dados pessoais, o financeiro e
 * a saúde, o acompanhamento e o app. A do meio é um pouco mais larga (1,2) para a tabela das lesões caber (760 px) já em
 * 2560 com o menu aberto; com terços iguais ela teria ~740 px e viraria cartões.
 */
export const TRES_COLUNAS_DA_FICHA: readonly (readonly PecaDaAbaDados[])[] = [
  ['identificacao', 'contato', 'objetivo'],
  ['planoContratado', 'lesoes'],
  ['acompanhamento', 'acessoAoApp', 'anamnese'],
];
export const PROPORCAO_DAS_TRES_COLUNAS: readonly number[] = [1, 1.2, 1];

/** Largura mínima de cada uma das três colunas do Resumo (Planejamento, Última medição e Atividade recente). */
export const MINIMO_DA_COLUNA_DO_RESUMO = 640;

export const emDuasColunas = (faixa: FaixaDeLargura): boolean => faixa !== 'compacta';

/** Uma coluna do arranjo: as seções dos Dados que abrem a pilha e os blocos da aba que vêm depois, na ordem. */
export interface ColunaDaAbaDados { secoes: SecaoDosDados[]; blocos: BlocoDaAbaDados[]; proporcao: number }

const coluna = (pecas: readonly PecaDaAbaDados[], blocos: readonly BlocoDaFicha[], proporcao: number): ColunaDaAbaDados => ({
  secoes: pecas.filter(ehSecao),
  blocos: pecas.filter((p): p is BlocoDaAbaDados => !ehSecao(p) && blocos.includes(p)),
  proporcao,
});

/**
 * As pilhas da aba Dados: `null` numa coluna (faixa `compacta`); três quando cabem três colunas de
 * `MINIMO_DA_COLUNA_DO_RESUMO` com o vão na largura MEDIDA da aba (a mesma régua do Resumo: abre em 2560 com o menu aberto,
 * ~2270 px, e não em 1920, ~1630; a faixa não serve porque 2560 com o menu aberto ainda é `larga`); senão as duas de 3:2.
 * Só os blocos que a aba mostra (`blocosDaAba`) e as seções quando a aba tem os Dados. Uma das três vazia (sem o financeiro
 * nem as lesões, a do meio) volta às duas, como as pilhas do Acompanhamento: nunca uma coluna oca ao lado das outras.
 */
export function colunasDaAbaDados(faixa: FaixaDeLargura, largura: number, vao: number, blocos: readonly BlocoDaFicha[]): ColunaDaAbaDados[] | null {
  if (!emDuasColunas(faixa)) return null;
  const comDados = blocos.includes('dadosDoAluno');
  const tirarSecoes = (c: ColunaDaAbaDados): ColunaDaAbaDados => (comDados ? c : { ...c, secoes: [] });
  if (largura >= 3 * MINIMO_DA_COLUNA_DO_RESUMO + 2 * vao) {
    const tres = TRES_COLUNAS_DA_FICHA.map((p, i) => tirarSecoes(coluna(p, blocos, PROPORCAO_DAS_TRES_COLUNAS[i])));
    if (tres.every((c) => c.secoes.length + c.blocos.length > 0)) return tres;
  }
  return [
    tirarSecoes(coluna(COLUNAS_DA_FICHA.esquerda, blocos, PROPORCAO_DAS_COLUNAS.esquerda)),
    tirarSecoes(coluna(COLUNAS_DA_FICHA.direita, blocos, PROPORCAO_DAS_COLUNAS.direita)),
  ];
}

/**
 * Duas colunas com a esquerda sem nada para mostrar (24/11): na edição as seções saem (o formulário fica em cima) e, sem o
 * financeiro, a esquerda fica sem o Plano contratado; na leitura só sem os Dados na aba (as seções 1 e 2 estão sempre lá).
 * A aba fica numa coluna só, que não passa de `tetoDaColunaUnica`. O arranjo continua o de duas (as chaves das colunas não
 * mudam: nada remonta ao entrar e sair da edição). Em três colunas, uma vazia já volta às duas; na compacta não há colunas.
 */
export const colunaUnica = (colunas: readonly ColunaDaAbaDados[] | null, editando: boolean): boolean =>
  colunas?.length === 2 && colunas[0].blocos.length + (editando ? 0 : colunas[0].secoes.length) === 0;

/**
 * Teto da coluna única: a largura que a coluna da esquerda (a maior, 3 de 5) teria no arranjo de duas com a mesma aba
 * (`largura`: a das duas colunas, a medida ou o teto delas, `larguraMaximaDasColunas`, menos o vão). ~542 px em 1280 e
 * ~965 em 1920 com o menu aberto.
 */
export const tetoDaColunaUnica = (largura: number, vao: number): number =>
  (PROPORCAO_DAS_COLUNAS.esquerda / (PROPORCAO_DAS_COLUNAS.esquerda + PROPORCAO_DAS_COLUNAS.direita)) * (largura - vao);

/** Os blocos que vão abaixo das colunas, na largura toda delas: só no arranjo de duas e só os que a aba mostra. */
export const abaixoDasColunas = (colunas: readonly ColunaDaAbaDados[] | null, blocos: readonly BlocoDaFicha[]): BlocoDaAbaDados[] =>
  (colunas?.length === 2 ? ABAIXO_DAS_DUAS_COLUNAS.filter((b) => blocos.includes(b)) : []);

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
 * Teto da aba (revisão de tela larga, 24/11; D1 de `docs/planos/ajustes-da-tarde-25-11.md`, 25/11): em duas colunas, nas
 * faixas `normal` e `larga`, nenhum (`undefined`): as colunas ocupam a largura do conteúdo, que só a `Tela` limita
 * ("Largura do conteúdo" limitada, 1800); antes paravam em `LARGURA_EDITOR_DE_CAMPOS` e sobrava uma faixa vazia à direita
 * em 1920 (Gustavo). Na `ultralarga` o arranjo normal é o de três, cada coluna até `LARGURA_EDITOR_DE_CAMPOS` (o `maxWidth`
 * dela) e a aba na soma (o "Editar dados" fica na borda da 3ª); quando ele volta às duas (a do meio vazia), as duas continuam
 * no teto do editor de campos, para não esticarem por ~3150 px. Numa coluna (`compacta`), a largura toda. O formulário da
 * edição continua no teto do editor de campos (`DadosDoAluno`).
 */
export const larguraMaximaDasColunas = (colunas: readonly ColunaDaAbaDados[] | null, vao: number, faixa: FaixaDeLargura): number | undefined =>
  (!colunas ? undefined : colunas.length === 3 ? 3 * LARGURA_EDITOR_DE_CAMPOS + 2 * vao : faixa === 'ultralarga' ? LARGURA_EDITOR_DE_CAMPOS : undefined);

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
