/**
 * Regras da lista de dados (`ui/ListaDeDados`, 24/11; plano `docs/planos/ficha-lista-de-dados.md`): a largura da coluna
 * do rótulo, quando a lista empilha (rótulo em cima do valor, em todas as linhas juntas) (a fonte numérica do valor é a de
 * `ui/numerosNoTexto`, via `Texto numerico`). Sem React: a peça mede a própria largura e pergunta aqui.
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

/**
 * Ajuste do arranjo para a lista que pede outro desenho (a leitura das respostas, 26/11: `orientacoes-de-design-26-11.md`
 * 2.1). Sem ele, vale o de sempre (`empilhaDados` e `larguraDoRotulo`).
 */
export interface AjusteDoArranjo {
  /** Largura da lista abaixo da qual ela empilha, no lugar de rótulo + vão + valor mínimo. */
  empilharAbaixoDe?: number;
  /** Coluna do rótulo em fração da largura da lista, até `maximo`, no lugar da coluna fixa. */
  rotulo?: { fracao: number; maximo: number };
}

/** Empilha ou não e a largura da coluna do rótulo, com o ajuste opcional. Sem medida (0), empilha, como `empilhaDados`. */
export function arranjoDaLista(larguraDaLista: number, fatorTexto: number = 1, ajuste?: AjusteDoArranjo): { empilhado: boolean; rotulo: number } {
  const medida = larguraDaLista > 0;
  const empilhado = !medida ? true
    : ajuste?.empilharAbaixoDe != null ? larguraDaLista < ajuste.empilharAbaixoDe : empilhaDados(larguraDaLista, fatorTexto);
  const rotulo = ajuste?.rotulo && medida
    ? Math.min(Math.round(larguraDaLista * ajuste.rotulo.fracao), ajuste.rotulo.maximo) : larguraDoRotulo(fatorTexto);
  return { empilhado, rotulo };
}

/**
 * Qual linha fica sem divisória (24/11): só a última do cartão. Toda outra linha tem o fio embaixo, inclusive a última de
 * uma seção com outra seção depois (o fio fecha o grupo antes do subtítulo seguinte). `presentes` são as posições (contadas
 * na lista inteira, por cima dos subtítulos) das linhas que de fato aparecem: um filho que devolve `null` (a linha do ciclo,
 * que some sozinha) não conta, e a última que aparece fica sem fio. Antes de as linhas se anunciarem (`presentes` vazio),
 * vale a última posição. Sem linha nenhuma, `null`.
 */
export function linhaSemDivisoria(presentes: ReadonlySet<number>, total: number): number | null {
  if (total <= 0) return null;
  if (presentes.size === 0) return total - 1;
  return Math.max(...presentes);
}
