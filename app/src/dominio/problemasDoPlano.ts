import type { Problema } from '../api/tipos';
import { localizar } from './caminhos';

/** "1 problema para publicar" / "3 problemas para publicar"; sem erro, vazio (avisos não impedem publicar). */
export function textoDosProblemas(erros: number): string {
  if (erros <= 0) return '';
  return `${erros} ${erros === 1 ? 'problema' : 'problemas'} para publicar`;
}

/**
 * Uids do primeiro erro, do item mais específico (exercício, refeição) para o mais geral (sessão): o editor
 * rola até o primeiro que estiver na tela. Erro que não aponta item (ex.: período) devolve lista vazia.
 */
export function uidsDoPrimeiroProblema(conteudo: unknown, erros: readonly Problema[]): string[] {
  const primeiro = erros[0];
  if (!primeiro) return [];
  return [...localizar(conteudo, primeiro.caminho).uids].reverse();
}
