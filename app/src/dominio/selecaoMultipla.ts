/** Quantos exercícios o "Progresso por exercício" compara de uma vez (cada um faz uma consulta à API). */
export const LIMITE_PROGRESSO = 10;

/** Marca ou desmarca um valor sem passar do limite. `recusado` = quis marcar além do limite (nada muda). */
export function alternarComLimite(marcados: ReadonlySet<string>, valor: string, marcar: boolean, limite: number) {
  if (marcar && !marcados.has(valor) && marcados.size >= limite) return { marcados: new Set(marcados), recusado: true };
  const novo = new Set(marcados);
  if (marcar) novo.add(valor);
  else novo.delete(valor);
  return { marcados: novo, recusado: false };
}

/**
 * "Marcar os visíveis": mantém o que já estava marcado e acrescenta os visíveis, na ordem da lista, até o limite.
 * `deixados` = quantos visíveis ficaram sem marca por causa do limite.
 */
export function marcarVisiveis(visiveis: readonly string[], marcados: ReadonlySet<string>, limite: number) {
  const novo = new Set(marcados);
  let deixados = 0;
  for (const v of visiveis) {
    if (novo.has(v)) continue;
    if (novo.size < limite) novo.add(v);
    else deixados++;
  }
  return { marcados: novo, deixados };
}
