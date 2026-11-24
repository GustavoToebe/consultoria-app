/**
 * Grupos da lista de alunos em duas colunas (tela larga: revisão, 24/11). Numa coluna só, a tabela de 5 colunas de cada
 * grupo esticava até 3100 px em 3440 e as colunas ficavam a 500 px umas das outras. Com espaço para duas listas inteiras
 * lado a lado, cada uma pelo menos tão larga quanto a lista em 1280 px com o menu aberto (onde as colunas foram
 * desenhadas), os cartões de grupo dividem-se em duas colunas: a 4.10 ("Automática deixa as listas em duas colunas sem
 * teto"; espaço extra vira colunas). A divisão é por coluna e na ordem dos grupos (a esquerda leva os primeiros, a direita os
 * seguintes), então leitura e Tab seguem Para revisar → Atrasados → Em dia → Sem pasta; o corte equilibra as alturas.
 */

/** Largura mínima de cada metade: a lista na tela de 1280 px com o menu aberto (~1000 px de conteúdo), no texto padrão. */
export const MINIMO_DA_METADE = 1000;
/** Faixa do título e cabeçalho das colunas de cada cartão, em "linhas" de aluno, para equilibrar as alturas. */
export const CABECALHO_EM_LINHAS = 2;

/**
 * Quantos grupos vão para a coluna da esquerda, ou `null` para uma coluna só (menos de dois grupos, ou cada metade
 * abaixo do mínimo). `linhas` = alunos de cada grupo, na ordem da tela; `largura` = a da lista medida (não a janela).
 */
export function gruposNaEsquerda(linhas: readonly number[], largura: number, { vao, fatorTexto = 1 }: { vao: number; fatorTexto?: number }): number | null {
  if (linhas.length < 2 || !(largura > 0)) return null;
  if ((largura - vao) / 2 < Math.round(MINIMO_DA_METADE * fatorTexto)) return null;
  const pesos = linhas.map((n) => n + CABECALHO_EM_LINHAS);
  const total = pesos.reduce((s, p) => s + p, 0);
  let melhor = 1;
  let menorAltura = Infinity;
  let esquerda = 0;
  for (let k = 1; k < pesos.length; k++) {
    esquerda += pesos[k - 1];
    const altura = Math.max(esquerda, total - esquerda);
    // Empate fica com o primeiro corte: a esquerda nunca mais baixa sem necessidade.
    if (altura < menorAltura) {
      menorAltura = altura;
      melhor = k;
    }
  }
  return melhor;
}
