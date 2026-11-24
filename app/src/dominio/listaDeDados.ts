/**
 * Regras da lista de dados (`ui/ListaDeDados`, 24/11; plano `docs/planos/ficha-lista-de-dados.md`): a largura da coluna
 * do rótulo, quando a lista empilha (rótulo em cima do valor, em todas as linhas juntas) e que pedaços do valor levam a
 * fonte numérica. Sem React: a peça mede a própria largura e pergunta aqui.
 */

/** Coluna do rótulo no texto normal: cabe "Questionário de atualização" numa linha só. */
export const LARGURA_DO_ROTULO = 200;
/** Vão entre o rótulo e o valor, e entre o valor e as ações. */
export const VAO_DA_LINHA = 16;
/** Menor espaço que o valor (com as ações da linha) precisa ao lado do rótulo; abaixo disso a lista empilha. */
export const VALOR_MINIMO = 200;

/** A coluna do rótulo cresce com o tamanho do texto da pessoa (Ajustes), para o rótulo não quebrar no "texto grande". */
export const larguraDoRotulo = (fatorTexto: number = 1): number => Math.round(LARGURA_DO_ROTULO * fatorTexto);

/**
 * A lista empilha quando o rótulo, o vão e o valor mínimo não cabem na largura dela. A decisão é da lista inteira (todas
 * as linhas iguais, nunca uma empilhada e a vizinha não). Sem medida (0), empilha: é o arranjo que nunca transborda.
 */
export function empilhaDados(larguraDaLista: number, fatorTexto: number = 1): boolean {
  if (!(larguraDaLista > 0)) return true;
  return larguraDaLista < larguraDoRotulo(fatorTexto) + VAO_DA_LINHA + Math.round(VALOR_MINIMO * fatorTexto);
}

export interface ParteDoValor {
  texto: string;
  numerico: boolean;
}

/** Um número com os separadores de dentro dele: "17/10/2026", "123.456.789-09", "18:38", "1.250,50". */
const NUMERO = /\d(?:[\d.,/:-]*\d)?/g;

/**
 * Só os números do valor levam a fonte numérica: "15 dias" → "15" + " dias"; "Padrão da consultoria (15 dias)" → o "15";
 * "(45) 99999-8888" → "45" e "99999-8888". Texto sem número sai numa parte só, normal.
 */
export function partesNumericas(texto: string): ParteDoValor[] {
  const partes: ParteDoValor[] = [];
  let desde = 0;
  for (const achado of texto.matchAll(NUMERO)) {
    const inicio = achado.index ?? 0;
    if (inicio > desde) partes.push({ texto: texto.slice(desde, inicio), numerico: false });
    partes.push({ texto: achado[0], numerico: true });
    desde = inicio + achado[0].length;
  }
  if (desde < texto.length || partes.length === 0) partes.push({ texto: texto.slice(desde), numerico: false });
  return partes;
}
