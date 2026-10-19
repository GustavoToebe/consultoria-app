import type { Marca } from '../api/tipos';

/**
 * A marca que chegou no painel do aluno é a mesma que a sessão já tem? O painel chega a cada abertura e a cada envio; se
 * a sessão trocasse o perfil mesmo com a marca igual, o app inteiro renderizaria de novo e a abertura do aluno, que
 * depende das funções da sessão, baixaria painel e mobilidade outra vez, sem parar (visto em produção em 19/10).
 */
export function mesmaMarca(a: Marca | null | undefined, b: Marca | null | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
