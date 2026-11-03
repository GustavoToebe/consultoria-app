import { codigoApi, erroDeConexao, errosPorCampo, mensagemApi } from '@plataforma/web';
import type { RefObject } from 'react';
import type { TextInput } from 'react-native';

/** Texto para mostrar na tela a partir de qualquer erro (a API já manda mensagens em português). */
export function textoDoErro(erro: unknown): string {
  return mensagemApi(erro, 'Algo deu errado. Tente de novo.');
}

/**
 * `erroDeConexao` (a requisição nem chegou à API), `errosPorCampo` (`fieldErrors` pelo nome do campo) e `codigoApi`
 * (o `codigo` estável do erro) vêm do pacote.
 */
export { codigoApi, erroDeConexao, errosPorCampo };

/**
 * Erro do envio de um formulário (telas públicas, C6): o que a API apontou num campo que está na tela vai para o campo;
 * o alerta fica para o resto (rede, 5xx, 401/409 sem campo, ou campo que a tela não mostra, como o token do link), com
 * `geral` (o texto do alerta; por padrão o da API). Nunca perde a mensagem: sem campo visível, ela vai ao alerta.
 */
export function separarErros(erro: unknown, naTela: readonly string[], geral: string = textoDoErro(erro)): {
  campos: Record<string, string>; geral: string | null;
} {
  const todos = errosPorCampo(erro);
  const campos: Record<string, string> = {};
  let fora = false;
  for (const [campo, mensagem] of Object.entries(todos)) {
    if (naTela.includes(campo)) campos[campo] = mensagem;
    else fora = true;
  }
  return { campos, geral: Object.keys(campos).length === 0 || fora ? geral : null };
}

/** Leva o foco ao primeiro campo com erro, na ordem da tela (`refs`: nome do campo e o ref do `Campo`). */
export function focarPrimeiroComErro(campos: Record<string, string>, refs: readonly (readonly [string, RefObject<TextInput | null>])[]): void {
  refs.find(([campo]) => campos[campo])?.[1].current?.focus();
}
