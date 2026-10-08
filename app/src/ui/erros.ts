import { ErroApi } from '../api/cliente';

/** Texto para mostrar na tela a partir de qualquer erro (a API já manda mensagens em português). */
export function textoDoErro(erro: unknown): string {
  if (erro instanceof ErroApi) {
    return erro.message;
  }
  return 'Algo deu errado. Tente de novo.';
}

/** Erros por campo da API (`fieldErrors`), indexados pelo nome do campo. */
export function errosPorCampo(erro: unknown): Record<string, string> {
  const mapa: Record<string, string> = {};
  if (erro instanceof ErroApi) {
    for (const c of erro.campos) {
      mapa[c.field] = c.message;
    }
  }
  return mapa;
}
