/**
 * Regras do arrastar para reordenar (`ui/ArrasteDaLista`): onde o item solto cai e como levá-lo até lá com a MESMA
 * função das setas ↑↓ de cada lista, um passo por vez (plano `docs/planos/dieta-tabela-e-arrastar.md`, D3).
 */

/** Caixa de um item medida na janela no começo do arraste (`measureInWindow`). */
export interface CaixaDoItem {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Índice final do item `de` se for solto no ponto (coordenadas da janela). `vertical`: conta os outros itens cujo meio
 * fica acima do ponto. `linhas` (chips que quebram linha): conta os das linhas de cima inteiras e, na linha do ponto, os
 * que têm o meio à esquerda dele. Caixa ainda não medida não conta; `de` inválido devolve `de`.
 */
export function destinoDoArraste(caixas: readonly (CaixaDoItem | undefined)[], de: number, ponto: { x: number; y: number }, eixo: 'vertical' | 'linhas' = 'vertical'): number {
  if (de < 0 || de >= caixas.length || !caixas[de]) return de;
  let antes = 0;
  caixas.forEach((c, j) => {
    if (j === de || !c) return;
    const acima = eixo === 'vertical'
      ? c.y + c.h / 2 < ponto.y
      : ponto.y > c.y + c.h || (ponto.y >= c.y && c.x + c.w / 2 < ponto.x);
    if (acima) antes += 1;
  });
  return antes;
}

/** Leva o item de `de` para `para` numa lista simples (os outros andam uma casa). Fora dos limites devolve a mesma lista. */
export function moverPara<T>(lista: readonly T[], de: number, para: number): T[] {
  if (de === para || de < 0 || para < 0 || de >= lista.length || para >= lista.length) return lista as T[];
  const copia = [...lista];
  const [item] = copia.splice(de, 1);
  copia.splice(para, 0, item);
  return copia;
}

/**
 * Aplica o passo das setas (`passo(estado, indice, ±1)`) até o item chegar a `para`, achando-o de novo a cada passo
 * (`onde`): a função das setas pode pular mais de uma casa (o exercício solto passa por cima do grupo inteiro) ou juntar
 * blocos. Para ao chegar, ao cruzar o destino, quando o passo não muda nada ou depois de `limite` passos.
 */
export function reordenarPorPassos<E>(estado: E, para: number, onde: (e: E) => number, passo: (e: E, indice: number, delta: -1 | 1) => E, limite = 100): E {
  const inicio = onde(estado);
  if (inicio < 0 || para < 0 || inicio === para) return estado;
  const delta: -1 | 1 = para > inicio ? 1 : -1;
  let atual = estado;
  for (let n = 0; n < limite; n += 1) {
    const agora = onde(atual);
    if (agora < 0 || (delta > 0 ? agora >= para : agora <= para)) return atual;
    const proximo = passo(atual, agora, delta);
    if (proximo === atual) return atual;
    atual = proximo;
  }
  return atual;
}
