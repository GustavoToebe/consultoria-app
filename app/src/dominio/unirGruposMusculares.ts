import type { UniaoDeGrupos } from '../api/gruposMusculares';
import { inteiroComMilhar } from './formatos';
import { nomeDoGrupoNoServidor, type GrupoAgrupado } from './gruposMusculares';

/**
 * Biblioteca › Exercícios › "Organizar grupos musculares" (27/11): marcar grupos (uma linha agrupada já traz as variações),
 * escolher o nome e unir. A conta de quantos exercícios mudam é sempre da API (prévia); aqui só nomes, textos e limites.
 */

/** `exercicio.grupo_muscular varchar(60)`, o mesmo do campo Grupo muscular do exercício. */
export const MAXIMO_DO_NOME_DO_GRUPO = 60;
/** A API recusa mais de 50 nomes na origem. */
export const MAXIMO_DE_GRUPOS_PARA_UNIR = 50;

/** Lista (com o que está marcado) ou o passo de confirmar, com os nomes exatos que vão à união. */
export type PassoDaUniao = { passo: 'lista' } | { passo: 'confirmar'; nomes: string[] };

const porNome = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });

/** Os nomes exatos das linhas marcadas (pela `chave`), sem repetir, em ordem alfabética. */
export function nomesMarcados(linhas: readonly GrupoAgrupado[], marcadas: ReadonlySet<string>): string[] {
  const nomes = new Set(linhas.filter((l) => marcadas.has(l.chave)).flatMap((l) => l.nomes));
  return [...nomes].sort(porNome);
}

/** Por que "Unir" está apagado; nulo quando dá para unir. Conta nomes, não linhas: a linha agrupada sozinha já tem dois. */
export function motivoDoUnir(nomes: readonly string[]): string | null {
  if (nomes.length < 2) return 'Marque dois ou mais grupos para unir.';
  if (nomes.length > MAXIMO_DE_GRUPOS_PARA_UNIR) return `Marque até ${MAXIMO_DE_GRUPOS_PARA_UNIR} grupos de cada vez.`;
  return null;
}

/** O nome que o campo já traz: o mais curto (empate, o primeiro em ordem alfabética), a mesma regra do rótulo agrupado. */
export function sugestaoDoNome(nomes: readonly string[]): string {
  return [...nomes].sort((a, b) => a.length - b.length || porNome(a, b))[0] ?? '';
}

/** Erro do campo "Nome do grupo", contado depois de tirar os espaços das pontas (como a API). */
export function erroDoNomeDoGrupo(nome: string): string | null {
  const limpo = nome.trim();
  if (!limpo) return 'Informe o nome do grupo.';
  if (limpo.length > MAXIMO_DO_NOME_DO_GRUPO) return `Use até ${MAXIMO_DO_NOME_DO_GRUPO} caracteres.`;
  return null;
}

/** Corpo da prévia e da união: todos os nomes marcados (inclusive o igual ao destino, que só não muda) e o nome limpo. */
export function corpoDaUniao(nomes: readonly string[], nome: string): UniaoDeGrupos {
  // A origem leva o nome como o servidor o compara (só o espaço comum das pontas sai); o destino o servidor limpa de novo.
  return { origem: [...new Set(nomes.map(nomeDoGrupoNoServidor).filter((n) => n.trim()))], destino: nome.trim() };
}

const exercicios = (n: number) => (n === 1 ? '1 exercício' : `${inteiroComMilhar(n)} exercícios`);

/** A contagem da linha: "6 exercícios", "1 exercício". */
export const contagemDoGrupo = exercicios;

/** O número da prévia: "1 exercício muda", "125 exercícios mudam", "Nenhum exercício muda". */
export function textoDaPrevia(n: number): string {
  if (n === 0) return 'Nenhum exercício muda';
  return n === 1 ? '1 exercício muda' : `${exercicios(n)} mudam`;
}

/** O aviso depois de unir. */
export function mensagemDeGruposUnidos(n: number): string {
  if (n === 0) return 'Grupos unidos: nenhum exercício precisou mudar.';
  return `Grupos unidos: ${exercicios(n)} ${n === 1 ? 'renomeado' : 'renomeados'}.`;
}
