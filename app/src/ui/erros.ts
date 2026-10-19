import { codigoApi, erroDeConexao, errosPorCampo, mensagemApi } from '@plataforma/web';

/** Texto para mostrar na tela a partir de qualquer erro (a API já manda mensagens em português). */
export function textoDoErro(erro: unknown): string {
  return mensagemApi(erro, 'Algo deu errado. Tente de novo.');
}

/**
 * `erroDeConexao` (a requisição nem chegou à API), `errosPorCampo` (`fieldErrors` pelo nome do campo) e `codigoApi`
 * (o `codigo` estável do erro) vêm do pacote.
 */
export { codigoApi, erroDeConexao, errosPorCampo };
