import { chaveDaTag } from './tagsDeAluno';

/**
 * A lista de gestão das tags (Configurações › Tags dos alunos, 28/11): ordem, busca, "Mais usadas" e os textos da
 * contagem. Puras; a tela só desenha. O nome da tag é do treinador e nunca opina sobre nada.
 */

/** A busca só aparece com mais tags que isto: até 12 a lista inteira cabe na tela e a busca seria um passo a mais. */
export const TAGS_SEM_BUSCA = 12;
export const mostrarBuscaDasTags = (total: number): boolean => total > TAGS_SEM_BUSCA;

/** Ordem alfabética do português, sem diferença de acento nem de caixa ("Água" junto de "agua"). */
export function ordenarTags<T extends { nome: string }>(tags: readonly T[]): T[] {
  return [...tags].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * As tags que a tela mostra: em ordem e, com a busca à vista, só as que têm o texto (sem acento nem caixa). Sem a busca à
 * vista (12 tags ou menos) o texto que sobrou é ignorado: senão linhas sumiriam por um campo que ninguém vê.
 */
export function tagsDaLista<T extends { nome: string }>(tags: readonly T[], busca: string): T[] {
  const chave = mostrarBuscaDasTags(tags.length) ? chaveDaTag(busca) : '';
  return ordenarTags(chave ? tags.filter((t) => chaveDaTag(t.nome).includes(chave)) : tags);
}

/** Mínimo para a coluna "Mais usadas" valer a pena (com uma ou duas ela só repete a lista). */
export const MINIMO_DE_MAIS_USADAS = 3;

/** As mais usadas: mais alunos primeiro, empate pelo nome; tag sem aluno não entra; no máximo `max`. */
export function maisUsadas<T extends { nome: string; totalAlunos: number }>(tags: readonly T[], max = 5): T[] {
  return ordenarTags(tags.filter((t) => t.totalAlunos > 0)).sort((a, b) => b.totalAlunos - a.totalAlunos).slice(0, max);
}

/** "Nenhum aluno", "1 aluno", "12 alunos". */
export const textoDosAlunosDaTag = (n: number): string => (n <= 0 ? 'Nenhum aluno' : `${n} ${n === 1 ? 'aluno' : 'alunos'}`);

/** O painel de excluir diz de quantos alunos a tag sai (o número é o `totalAlunos` da lista, que conta os inativos). */
export function textoDeExcluirTag(n: number): string {
  const quantos = n <= 0 ? 'Nenhum aluno tem esta tag.' : `A tag sai de ${textoDosAlunosDaTag(n)}; os alunos continuam como estão.`;
  return `${quantos} Não dá para desfazer.`;
}

/** Contador do nome dentro do campo ("12/30"). */
export const contadorDoNome = (texto: string, maximo: number): string => `${texto.length}/${maximo}`;
