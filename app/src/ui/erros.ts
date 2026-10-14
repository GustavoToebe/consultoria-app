import { erroDeConexao, errosPorCampo, mensagemApi } from '@plataforma/web';

/** Texto para mostrar na tela a partir de qualquer erro (a API já manda mensagens em português). */
export function textoDoErro(erro: unknown): string {
  return mensagemApi(erro, 'Algo deu errado. Tente de novo.');
}

/** `erroDeConexao` (a requisição nem chegou à API) e `errosPorCampo` (`fieldErrors` pelo nome do campo) vêm do pacote. */
export { erroDeConexao, errosPorCampo };
