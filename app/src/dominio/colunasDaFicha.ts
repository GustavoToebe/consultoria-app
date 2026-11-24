import { LARGURA_EDITOR_DE_CAMPOS, type FaixaDeLargura } from '../tema/tokens';
import type { BlocoDaFicha } from './fichaDoAluno';

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
 * Teto da aba em duas colunas: na `ultralarga` o título, o formulário e as colunas não passam de `LARGURA_EDITOR_DE_CAMPOS`
 * (a regra do editor de campos, 4.10), alinhados à esquerda, e a sobra fica vazia à direita; nas outras faixas, a largura
 * toda (`undefined`).
 */
export const larguraMaximaDasColunas = (faixa: FaixaDeLargura): number | undefined =>
  (faixa === 'ultralarga' ? LARGURA_EDITOR_DE_CAMPOS : undefined);
