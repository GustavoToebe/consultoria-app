export type AbaDaBiblioteca = 'exercicios' | 'alimentos' | 'suplementos' | 'ergogenicos' | 'catalogo' | 'csv';

/** Abas na ordem da tela; `permissao` é a que a aba exige além de ler a Biblioteca (a API autoriza de novo). */
const ABAS: readonly { valor: AbaDaBiblioteca; rotulo: string; permissao: string | null }[] = [
  { valor: 'exercicios', rotulo: 'Exercícios', permissao: null },
  { valor: 'alimentos', rotulo: 'Alimentos', permissao: null },
  { valor: 'suplementos', rotulo: 'Suplementos', permissao: null },
  { valor: 'ergogenicos', rotulo: 'Outros', permissao: 'ERGOGENICO_LER' },
  { valor: 'catalogo', rotulo: 'Importar do catálogo', permissao: null },
  { valor: 'csv', rotulo: 'Importar CSV', permissao: 'BIBLIOTECA_ALTERAR' },
];

/** Só as abas que o perfil pode abrir: sem a permissão, a aba nem aparece. */
export function abasDaBiblioteca(pode: (codigo: string) => boolean): { valor: AbaDaBiblioteca; rotulo: string }[] {
  return ABAS.filter((a) => a.permissao === null || pode(a.permissao)).map(({ valor, rotulo }) => ({ valor, rotulo }));
}

/** Aba pedida pelo endereço (`?aba=`); se não existe ou o perfil não pode, abre a primeira. */
export function abaInicial(parametro: string | string[] | undefined, permitidas: { valor: AbaDaBiblioteca }[]): AbaDaBiblioteca {
  const pedida = Array.isArray(parametro) ? parametro[0] : parametro;
  return permitidas.find((a) => a.valor === pedida)?.valor ?? permitidas[0]?.valor ?? 'exercicios';
}
