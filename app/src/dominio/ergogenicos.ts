import type { ErgogenicoDaBiblioteca, ItemErgogenico } from '../api/tipos';
import { SEM_DADO } from './formatos';

/**
 * Regras de apresentação da biblioteca de medicação e ergogênicos (sem tela). O item é só o que está no rótulo: nada
 * aqui sugere dose, soma, compara nem avisa sobre combinação. Ausência de dado é "—".
 */

/**
 * A categoria é texto livre do treinador (pedido do Saraiva em 17/10: nada de "Injetáveis/Peptídeos" fixos na entrada).
 * Item sem categoria fica no grupo "Sem categoria", sempre por último.
 */
export const SEM_CATEGORIA = 'Sem categoria';

/** Categorias que existem na lista, sem repetir e em ordem alfabética (filtro e sugestões do formulário). */
export function categoriasDosErgogenicos(lista: readonly Pick<ErgogenicoDaBiblioteca, 'categoria'>[]): string[] {
  const nomes = new Set(lista.map((e) => e.categoria?.trim()).filter((c): c is string => !!c));
  return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Sugestões do campo Categoria: as que já existem e contêm o que foi digitado (sem acento e sem caixa); campo vazio =
 * todas. Some a que já é exatamente o texto digitado (não há o que sugerir).
 */
export function sugerirCategorias(categorias: readonly string[], digitado: string): string[] {
  const termo = semAcentoMinusculo(digitado);
  return categorias.filter((c) => {
    const nome = semAcentoMinusculo(c);
    return nome !== termo && nome.includes(termo);
  });
}

export interface GrupoDeErgogenicos {
  categoria: string | null;
  rotulo: string;
  itens: ErgogenicoDaBiblioteca[];
}

/** Agrupa por categoria em ordem alfabética, "Sem categoria" por último; dentro do grupo, mantém a ordem recebida. */
export function agruparErgogenicos(lista: ErgogenicoDaBiblioteca[]): GrupoDeErgogenicos[] {
  const grupos: GrupoDeErgogenicos[] = categoriasDosErgogenicos(lista).map((c) => ({
    categoria: c,
    rotulo: c,
    itens: lista.filter((e) => e.categoria?.trim() === c),
  }));
  const sem = lista.filter((e) => !e.categoria?.trim());
  return sem.length ? [...grupos, { categoria: null, rotulo: SEM_CATEGORIA, itens: sem }] : grupos;
}

/** "1 item" / "13 itens". */
export function resumoDoGrupo(quantidade: number): string {
  return quantidade === 1 ? '1 item' : `${quantidade} itens`;
}

/**
 * Linha da dieta a partir de um item da biblioteca: copia nome, princípio ativo e concentração (o que está no rótulo);
 * dose, horário, observação e prescrição ficam vazios para o treinador escrever. Nada é sugerido.
 */
export function linhaDeErgogenico(e: Pick<ErgogenicoDaBiblioteca, 'nome' | 'principioAtivo' | 'concentracao'>, uid: string): ItemErgogenico {
  return {
    uid,
    nome: e.nome,
    principioAtivo: e.principioAtivo?.trim() ?? '',
    concentracao: e.concentracao?.trim() ?? '',
    dose: '',
    horario: '',
    observacao: '',
    prescricao: '',
  };
}

/**
 * Linhas da dieta que têm algo escrito: a linha criada por "Adicionar linha" e deixada em branco não aparece para o
 * aluno nem no PDF (a API também não a cobra na publicação).
 */
export function ergogenicosPreenchidos(lista: readonly ItemErgogenico[] | null | undefined): ItemErgogenico[] {
  return (lista ?? []).filter((e) =>
    [e.nome, e.principioAtivo, e.concentracao, e.dose, e.horario, e.observacao, e.prescricao].some((t) => (t ?? '').trim() !== ''),
  );
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
export function filtrarErgogenicos(lista: ErgogenicoDaBiblioteca[], busca: string, categoria: string): ErgogenicoDaBiblioteca[] {
  const termo = semAcentoMinusculo(busca);
  return lista.filter((e) => {
    if (categoria && (e.categoria?.trim() ?? '') !== categoria) return false;
    return !termo || semAcentoMinusculo(`${e.nome} ${e.principioAtivo ?? ''}`).includes(termo);
  });
}

function semAcentoMinusculo(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
