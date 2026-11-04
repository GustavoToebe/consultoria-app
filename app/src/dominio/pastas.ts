export type FiltroPastas = 'todas' | 'abertas' | 'concluidas';

export const FILTROS_PASTAS: { valor: FiltroPastas; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'abertas', rotulo: 'Abertas' },
  { valor: 'concluidas', rotulo: 'Concluídas' },
];

/** Filtra as pastas do aluno pela situação: concluída é a que tem `concluidaEm`; aberta é a que não tem ("aberta" e não "ativa": o plano em uso pelo aluno é outra coisa, reunião de 29/10). */
export function filtrarPastas<T extends { concluidaEm: string | null }>(pastas: T[], filtro: FiltroPastas): T[] {
  if (filtro === 'todas') return pastas;
  return pastas.filter((p) => (filtro === 'concluidas') === !!p.concluidaEm);
}

/**
 * De onde a "Nova pasta" pode copiar o período. Só entra com mais de uma pasta e apenas as finalizadas
 * (`concluidaEm`). Uma pasta só, ou várias ainda abertas, devolve vazio: o campo não aparece.
 */
export function pastasParaCopiarNaNova<T extends { concluidaEm: string | null }>(pastas: readonly T[]): T[] {
  if (pastas.length <= 1) return [];
  return pastas.filter((p) => p.concluidaEm != null);
}
