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
