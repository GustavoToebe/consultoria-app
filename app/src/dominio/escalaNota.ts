/**
 * Contas do controle deslizante de nota (0 a 10 na Atualização). O centro do botão anda entre `margem` e
 * `largura - margem`; fora disso o valor trava no mínimo ou no máximo. Largura ainda não medida = sem valor.
 */
export function valorDaPosicao(x: number, largura: number, minimo: number, maximo: number, margem: number): number | null {
  const util = largura - 2 * margem;
  if (!(util > 0) || !Number.isFinite(x)) return null;
  const fracao = Math.min(1, Math.max(0, (x - margem) / util));
  return Math.round(minimo + fracao * (maximo - minimo));
}

/** Posição (px) do centro do botão para um valor; o valor é limitado à escala. */
export function posicaoDoValor(valor: number, largura: number, minimo: number, maximo: number, margem: number): number {
  const util = Math.max(0, largura - 2 * margem);
  const fracao = maximo === minimo ? 0 : (Math.min(maximo, Math.max(minimo, valor)) - minimo) / (maximo - minimo);
  return margem + fracao * util;
}

/** Passo do teclado e do leitor de tela: sem valor, a primeira ação cai no meio da escala; nunca sai de [mínimo, máximo]. */
export function valorAposPasso(atual: number | null, passo: 1 | -1, minimo: number, maximo: number): number {
  if (atual === null) return Math.round((minimo + maximo) / 2);
  return Math.min(maximo, Math.max(minimo, atual + passo));
}

/**
 * Botões da nota em linhas equilibradas (1 a 10 no celular: 5 + 5, não 6 + 4): quantos por linha e o lado de cada
 * botão, entre `menor` (o alvo de toque) e `maior`. Sem largura medida ainda, todos numa linha com o lado mínimo.
 */
export function disposicaoDaEscala(quantidade: number, largura: number, vao: number, menor = 44, maior = 56): { porLinha: number; lado: number } {
  if (quantidade <= 0) return { porLinha: 1, lado: menor };
  if (!(largura > 0)) return { porLinha: quantidade, lado: menor };
  const cabem = Math.max(1, Math.floor((largura + vao) / (menor + vao)));
  const linhas = Math.ceil(quantidade / cabem);
  const porLinha = Math.ceil(quantidade / linhas);
  const lado = Math.floor((largura - (porLinha - 1) * vao) / porLinha);
  return { porLinha, lado: Math.max(menor, Math.min(maior, lado)) };
}
