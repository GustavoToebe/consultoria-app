import type { TipoDoItem } from '../api/vitrineTipos';
import { plural } from './formatos';
import { SEM_CATEGORIA } from './seletorDeCategoria';

/**
 * Categorias da vitrine (plano `docs/planos/vitrine-categorias.md`): validação do nome (espelho da API: mudou uma, mude a
 * outra), sugestões por tipo, textos da folha "Organizar categorias" e o agrupamento dos itens, o mesmo para a equipe e
 * para o aluno. Nada é criado sozinho: as sugestões só criam quando a pessoa toca.
 */

export const NOME_DA_CATEGORIA_MAXIMO = 40;
export const TETO_DE_CATEGORIAS = 30;
export { SEM_CATEGORIA };

/** Como a API compara nomes (`nome_normalizado`): sem espaços nas pontas, minúsculas e sem acento. */
export const normalizarNomeDaCategoria = (nome: string): string =>
  nome.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** As mesmas mensagens fixas da API (422 `VITRINE_CATEGORIA_INVALIDA`, 409 `VITRINE_CATEGORIA_DUPLICADA`), sem repetir o texto. */
export function erroDoNomeDaCategoria(nome: string, categorias: readonly { id: string; nome: string }[], exceto?: string): string | null {
  const limpo = nome.trim();
  if (!limpo) return 'Informe o nome da categoria.';
  if (limpo.length > NOME_DA_CATEGORIA_MAXIMO) return `Use no máximo ${NOME_DA_CATEGORIA_MAXIMO} caracteres.`;
  const chave = normalizarNomeDaCategoria(limpo);
  if (categorias.some((c) => c.id !== exceto && normalizarNomeDaCategoria(c.nome) === chave)) return 'Já existe uma categoria com esse nome.';
  return null;
}

const SUGESTOES: Record<TipoDoItem, readonly string[]> = {
  FISICO: ['Roupas', 'Calçados', 'Acessórios', 'Livros'],
  DIGITAL: ['E-books', 'Cursos', 'Guias', 'Serviços'],
};

/** Sugestões clicáveis do campo Categoria: só enquanto a consultoria não tem nenhuma categoria, conforme o tipo do item. */
export const sugestoesDeCategoria = (tipo: TipoDoItem, totalDeCategorias: number): readonly string[] =>
  (totalDeCategorias === 0 ? SUGESTOES[tipo] : []);

/** "12 itens", "1 item" ou "Nenhum item" (a contagem de cada linha da folha). */
export const quantidadeDeItens = (n: number): string => (n === 0 ? 'Nenhum item' : plural(n, 'item', 'itens'));

/** O que acontece com os itens ao excluir a categoria: nunca são apagados. */
export function mensagemDeExcluirCategoria(n: number): string {
  if (n === 0) return 'A categoria não tem itens.';
  if (n === 1) return 'O item continua na vitrine, sem categoria.';
  return `Os ${n} itens continuam na vitrine, sem categoria.`;
}

// ---- Agrupar e ordenar ----

export interface CategoriaDoGrupo { id: string; nome: string }

export interface GrupoDaVitrine<T> {
  /** Id da categoria, ou `null` no grupo dos itens sem categoria. */
  chave: string | null;
  /** O subtítulo; `null` quando nenhum item tem categoria (a lista fica sem subtítulos, como antes das categorias). */
  titulo: string | null;
  itens: T[];
}

/**
 * Itens em grupos por categoria, na ordem em que as categorias aparecem na lista (a API já manda na ordem definida) e
 * "Sem categoria" por último; dentro do grupo, a ordem recebida. Se nenhum item tem categoria, um grupo só, sem título.
 */
export function agruparPorCategoria<T>(itens: readonly T[], categoriaDe: (item: T) => CategoriaDoGrupo | null): GrupoDaVitrine<T>[] {
  const grupos = new Map<string, GrupoDaVitrine<T>>();
  const sem: T[] = [];
  for (const item of itens) {
    const c = categoriaDe(item);
    if (!c) { sem.push(item); continue; }
    const g = grupos.get(c.id) ?? { chave: c.id, titulo: c.nome, itens: [] };
    g.itens.push(item);
    grupos.set(c.id, g);
  }
  const lista = [...grupos.values()];
  if (sem.length) lista.push({ chave: null, titulo: lista.length ? SEM_CATEGORIA : null, itens: sem });
  return lista;
}

/** A categoria de um item da equipe (`categoriaId` + `categoriaNome`). */
export const categoriaDoItemDaEquipe = (i: { categoriaId: string | null; categoriaNome: string | null }): CategoriaDoGrupo | null =>
  (i.categoriaId ? { id: i.categoriaId, nome: i.categoriaNome ?? SEM_CATEGORIA } : null);

/** Leva o item da posição `de` para `para`; índices fora da lista não mudam nada. */
export function mover<T>(lista: readonly T[], de: number, para: number): T[] {
  if (de < 0 || de >= lista.length || para < 0 || para >= lista.length || de === para) return [...lista];
  const nova = [...lista];
  const [x] = nova.splice(de, 1);
  nova.splice(para, 0, x);
  return nova;
}

/**
 * A lista completa de ids para o `PUT /vitrine/itens/ordem` depois de mover um item DENTRO do grupo `chave` (de `de` para
 * `para`, índices do grupo): os grupos na ordem de exibição (categorias na ordem, sem categoria por último).
 */
export function idsDepoisDeMoverNoGrupo<T extends { id: string }>(grupos: readonly GrupoDaVitrine<T>[], chave: string | null, de: number, para: number): string[] {
  return grupos.flatMap((g) => (g.chave === chave ? mover(g.itens, de, para) : g.itens).map((i) => i.id));
}
