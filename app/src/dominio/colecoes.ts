import type { PastaModelo, Receita, TipoReceita } from '../api/tipos';

/**
 * Regras do Planejamento agrupado por coleção (sem tela). Coleção é a pasta de modelos da API (`PastaModelo`); os
 * modelos de um tipo aparecem em grupos, um por coleção, como a Biblioteca › Outros agrupa por categoria
 * (`dominio/ergogenicos`). Não há filtro de coleção: a busca procura em todas e os grupos vazios somem.
 */

/** Modelo sem coleção (ou de uma coleção que não existe mais) fica no grupo "Sem coleção", sempre por último. */
export const SEM_COLECAO = 'Sem coleção';

export interface GrupoDeModelos {
  /** Id da coleção; `null` no grupo "Sem coleção". */
  pastaId: string | null;
  rotulo: string;
  itens: Receita[];
}

/**
 * Agrupa por coleção em ordem alfabética (português), "Sem coleção" por último; coleção sem modelo não aparece;
 * dentro do grupo, a ordem recebida (a da API).
 */
export function agruparPorColecao(modelos: readonly Receita[], colecoes: readonly PastaModelo[]): GrupoDeModelos[] {
  const ids = new Set(colecoes.map((c) => c.id));
  const grupos: GrupoDeModelos[] = [...colecoes]
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((c) => ({ pastaId: c.id, rotulo: c.nome, itens: modelos.filter((m) => m.pastaId === c.id) }))
    .filter((g) => g.itens.length > 0);
  const sem = modelos.filter((m) => !m.pastaId || !ids.has(m.pastaId));
  return sem.length ? [...grupos, { pastaId: null, rotulo: SEM_COLECAO, itens: sem }] : grupos;
}

/** "1 modelo" / "13 modelos". */
export function resumoDeModelos(quantidade: number): string {
  return quantidade === 1 ? '1 modelo' : `${quantidade} modelos`;
}

/** Modelos do tipo cujo nome ou descrição contém a busca (sem acento nem caixa); busca vazia = todos do tipo. */
export function filtrarModelos(modelos: readonly Receita[], tipo: TipoReceita, busca: string): Receita[] {
  const termo = semAcentoMinusculo(busca);
  return modelos.filter((m) => m.tipo === tipo && (!termo || semAcentoMinusculo(`${m.nome} ${m.descricao ?? ''}`).includes(termo)));
}

function semAcentoMinusculo(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
