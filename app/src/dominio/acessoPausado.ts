import { ErroApi } from '@plataforma/web';

/** Código que a API devolve (403) em qualquer rota do aluno fora da whitelist quando o acesso está pausado por atraso. */
export const CODIGO_ACESSO_PAUSADO = 'ACESSO_PAUSADO_POR_ATRASO';

/**
 * O erro é o "acesso do aluno pausado por atraso" (403 `ACESSO_PAUSADO_POR_ATRASO`)?
 * O cliente avisa a sessão, que marca `acessoPausado: true` no perfil sem deslogar o aluno, levando-o à tela de regularização.
 */
export function ehAcessoPausado(erro: unknown): boolean {
  return erro instanceof ErroApi && erro.status === 403 && erro.codigo === CODIGO_ACESSO_PAUSADO;
}

/**
 * Ordena cobranças em aberto na tela de acesso pausado: as vencidas aparecem primeiro, e dentro de cada grupo pelo
 * vencimento mais antigo primeiro.
 */
export function ordenarCobrancasParaRegularizacao<T extends { vencida: boolean; vencimento: string }>(cobrancas: readonly T[]): T[] {
  return [...cobrancas].sort((a, b) => {
    if (a.vencida !== b.vencida) return a.vencida ? -1 : 1;
    return a.vencimento.localeCompare(b.vencimento);
  });
}
