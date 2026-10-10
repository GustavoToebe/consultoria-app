export type FiltroPastas = 'todas' | 'ativas' | 'concluidas';

export const FILTROS_PASTAS: { valor: FiltroPastas; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'ativas', rotulo: 'Ativas' },
  { valor: 'concluidas', rotulo: 'Concluídas' },
];

/** Filtra as pastas do aluno pela situação: concluída é a que tem `concluidaEm`; ativa é a que não tem. */
export function filtrarPastas<T extends { concluidaEm: string | null }>(pastas: T[], filtro: FiltroPastas): T[] {
  if (filtro === 'todas') return pastas;
  return pastas.filter((p) => (filtro === 'concluidas') === !!p.concluidaEm);
}
