/**
 * Chips das abas da Biblioteca (`docs/planos/filtros-nas-listas.md`, D13): cada aba tem a busca e um filtro só (grupo,
 * fatores ou categoria), filtrado no que já veio (o catálogo pela API). Funções puras.
 */
export interface ChipDaBiblioteca { chave: 'filtro'; texto: string }

/** Filtro de uma opção: chip só quando não é a opção "todos". */
export function chipDeUmaOpcao<T extends string>(rotulo: string, valor: T, todos: T, opcoes: readonly { valor: T; rotulo: string }[]): ChipDaBiblioteca[] {
  if (valor === todos) return [];
  return [{ chave: 'filtro', texto: `${rotulo}: ${opcoes.find((o) => o.valor === valor)?.rotulo ?? valor}` }];
}

/** Filtro de várias opções: chip com as marcadas que ainda existem, na ordem das opções. */
export function chipDeVarias(rotulo: string, marcados: ReadonlySet<string>, opcoes: readonly { valor: string; rotulo: string }[]): ChipDaBiblioteca[] {
  const nomes = opcoes.filter((o) => marcados.has(o.valor)).map((o) => o.rotulo);
  return nomes.length ? [{ chave: 'filtro', texto: `${rotulo}: ${nomes.join(', ')}` }] : [];
}
