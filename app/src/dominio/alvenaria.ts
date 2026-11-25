/**
 * Alvenaria (colunas empilhadas, 24/11): cada item vai para a coluna mais baixa no momento, na ordem dada, pelo `peso`
 * estimado (no hub de Configurações, os itens do grupo + 1 do título); no empate, a mais à esquerda. Devolve o índice da
 * coluna de cada item. A escolha não depende da altura medida, então a tela não troca grupo de coluna depois de medir.
 */
export function colunasDaAlvenaria(pesos: readonly number[], colunas: number): number[] {
  const soma = Array<number>(Math.max(1, colunas)).fill(0);
  return pesos.map((peso) => {
    const menor = soma.indexOf(Math.min(...soma));
    soma[menor] += peso;
    return menor;
  });
}

/**
 * Topo de cada item na sua coluna, empilhando as alturas medidas com `vao` entre um e o de baixo (sem buraco além dele),
 * e a altura da coluna mais alta (a do contêiner).
 */
export function posicoesDaAlvenaria(coluna: readonly number[], alturas: readonly number[], colunas: number, vao: number): { topos: number[]; altura: number } {
  // Começa em `-vao`: o primeiro de cada coluna fica no topo, mesmo que o de cima ainda não tenha altura medida.
  const base = Array<number>(Math.max(1, colunas)).fill(-vao);
  const topos = coluna.map((c, i) => {
    const topo = base[c] + vao;
    base[c] = topo + alturas[i];
    return topo;
  });
  return { topos, altura: Math.max(0, ...base) };
}
