import type { CategoriaErgogenico, ErgogenicoDaBiblioteca } from '../api/tipos';
import { SEM_DADO } from './formatos';

/**
 * Regras de apresentação da biblioteca de medicação e ergogênicos (sem tela). O item é só o que está no rótulo: nada
 * aqui sugere dose, soma, compara nem avisa sobre combinação. Ausência de dado é "—".
 */

/** Categorias na ordem em que aparecem na lista. */
export const CATEGORIAS_ERGOGENICO: readonly { valor: CategoriaErgogenico; rotulo: string }[] = [
  { valor: 'INJETAVEL', rotulo: 'Injetáveis' },
  { valor: 'ORAL', rotulo: 'Orais' },
  { valor: 'PEPTIDEO', rotulo: 'Peptídeos' },
  { valor: 'MEDICAMENTO', rotulo: 'Medicamentos' },
  { valor: 'OUTRO', rotulo: 'Outros' },
];

export function rotuloDaCategoria(categoria: CategoriaErgogenico): string {
  return CATEGORIAS_ERGOGENICO.find((c) => c.valor === categoria)?.rotulo ?? SEM_DADO;
}

export interface GrupoDeErgogenicos {
  categoria: CategoriaErgogenico;
  rotulo: string;
  itens: ErgogenicoDaBiblioteca[];
}

/** Agrupa na ordem fixa das categorias, sem grupos vazios; dentro do grupo, mantém a ordem recebida. */
export function agruparErgogenicos(lista: ErgogenicoDaBiblioteca[]): GrupoDeErgogenicos[] {
  return CATEGORIAS_ERGOGENICO.map((c) => ({ categoria: c.valor, rotulo: c.rotulo, itens: lista.filter((e) => e.categoria === c.valor) }))
    .filter((g) => g.itens.length > 0);
}

/** "1 item" / "13 itens". */
export function resumoDoGrupo(quantidade: number): string {
  return quantidade === 1 ? '1 item' : `${quantidade} itens`;
}

/** Campo de texto do rótulo (concentração, apresentação…): o que faltar vira "—". */
export function textoOuTraco(valor: string | null | undefined): string {
  return valor?.trim() || SEM_DADO;
}

/** "Nome / Princípio ativo"; sem princípio ativo, só o nome. */
export function nomeEPrincipio(e: Pick<ErgogenicoDaBiblioteca, 'nome' | 'principioAtivo'>): string {
  const principio = e.principioAtivo?.trim();
  return principio ? `${e.nome} / ${principio}` : e.nome;
}

/** Busca sem acento e sem caixa no nome e no princípio ativo; categoria vazia = todas. */
export function filtrarErgogenicos(lista: ErgogenicoDaBiblioteca[], busca: string, categoria: CategoriaErgogenico | ''): ErgogenicoDaBiblioteca[] {
  const termo = semAcentoMinusculo(busca);
  return lista.filter((e) => {
    if (categoria && e.categoria !== categoria) return false;
    return !termo || semAcentoMinusculo(`${e.nome} ${e.principioAtivo ?? ''}`).includes(termo);
  });
}

function semAcentoMinusculo(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
