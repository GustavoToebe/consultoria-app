/**
 * Colunas da lista de Atualizações (tela larga: revisão, 24/11). Cada atualização é uma linha em caixa (nome, data, selo
 * e a seta); numa coluna só ela esticava até a borda e o selo ficava a mais de 2000 px do nome em 2560. Sobrando espaço,
 * entram mais colunas iguais (4.10: espaço extra vira colunas, nunca linha esticada), na ordem de leitura por linha.
 * Mede a largura da própria lista (dentro do cartão), não a janela; o texto ampliado aumenta a célula mínima.
 */

/** Célula mínima: o nome comprido, "Data: 18/10", o selo curto da situação e a seta, no texto padrão. */
export const MINIMO_DA_LINHA = 440;
/** O mesmo espaço entre as linhas em caixa da `ListaDeLinhas`. */
export const VAO_DA_LISTA = 16;
/** Teto de colunas (o mesmo do Início): acima disso a leitura da fila em ordem fica difícil. */
export const MAXIMO_DE_COLUNAS = 6;

export function colunasDaListaDeAtualizacoes(largura: number, fatorTexto = 1): number {
  if (!(largura > 0)) return 1;
  const celula = Math.round(MINIMO_DA_LINHA * fatorTexto);
  return Math.max(1, Math.min(MAXIMO_DE_COLUNAS, Math.floor((largura + VAO_DA_LISTA) / (celula + VAO_DA_LISTA))));
}
