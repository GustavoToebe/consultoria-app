import type { FaixaDeLargura } from '../tema/tokens';

/**
 * Tela larga do app do aluno na web. Desde 27/11 o contêiner é o do treinador (`Tela` sem teto próprio: começa ao lado do
 * menu e preenche; Limitada para em 1800) e as faixas são as da `Tela` (`useAreaDaTela`/`useFaixaDaTela`: normal 1024,
 * larga 1600, ultralarga 2400). Aqui só ficam as medidas de conteúdo do aluno.
 */

/** A faixa ganha colunas a mais (`larga` e `ultralarga`). */
export const telaLargaDoAluno = (faixa: FaixaDeLargura) => faixa === 'larga' || faixa === 'ultralarga';

/** Lista sequencial (refeições, séries, exercícios do dia, divisões, perguntas e respostas): acima disso o nome fica longe do número. */
export const LARGURA_LISTA_DO_ALUNO = 880;

/** Cartão de lista (divisão, exercício, refeição) não fica mais estreito que isto na grade larga. */
export const CELULA_MINIMA_DO_ALUNO = 360;

/**
 * Colunas iguais da quebra mais equilibrada sem cartão sozinho na última linha (5 em 3 + 2, 7 em 4 + 3, nunca 4 + 1), da
 * mais larga para a mais estreita, cada célula com ao menos `minimo`. Diferente da grade de indicadores (só divisores
 * exatos): lista do aluno aceita a última linha com um a menos.
 */
function colunasEquilibradas(largura: number, total: number, minimo: number, vao: number): number {
  for (let linhas = 1; linhas <= total; linhas++) {
    const colunas = Math.ceil(total / linhas);
    if (colunas === 1) return 1;
    if (total % colunas === 1) continue; // sobraria um cartão sozinho
    if (total % colunas !== 0 && total % colunas !== colunas - 1) continue; // última linha desequilibrada (8 em 5 + 3)
    if ((largura - vao * (colunas - 1)) / colunas >= minimo) return colunas;
  }
  return 1;
}

/**
 * Colunas de uma lista de cartões na tela larga do aluno, pela largura da própria grade: cabe numa linha só, as colunas são as
 * que cabem com a célula mínima (o cartão mantém o tamanho e a sobra fica no fim da linha, nunca cartão esticado); passou de
 * uma linha, colunas iguais sem cartão sozinho na última (`colunasEquilibradas`: 5 dão 3 + 2, nunca 4 + 1).
 */
export function colunasDaGradeDoAluno(largura: number, total: number, vao: number): number {
  if (!(largura > 0)) return 1;
  const cabem = Math.max(1, Math.floor((largura + vao) / (CELULA_MINIMA_DO_ALUNO + vao)));
  if (total <= cabem) return cabem;
  const iguais = colunasEquilibradas(largura, total, CELULA_MINIMA_DO_ALUNO, vao);
  // Sem divisão que evite o cartão sozinho (5 em 2 colunas), fica com as que cabem: um cartão sozinho é melhor que esticado.
  return iguais > 1 ? iguais : cabem;
}

/**
 * Coluna lateral das telas de trabalho na tela larga (o resumo e as ações da sessão do dia, o total e a água da dieta): fixa,
 * à esquerda, com a lista em colunas ao lado. 400 deixa três colunas de cartão ao lado já em 1920 com o menu aberto.
 */
export const LARGURA_LATERAL_DO_ALUNO = 400;
