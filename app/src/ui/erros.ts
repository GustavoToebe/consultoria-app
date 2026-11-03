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
  const fora: string[] = [];
  for (const [campo, mensagem] of Object.entries(todos)) {
    if (naTela.includes(campo)) campos[campo] = mensagem;
    else fora.push(mensagem);
  }
  // O campo que a tela não mostra só tem onde aparecer no alerta: vai a mensagem dele, não o texto genérico.
  if (fora.length > 0) return { campos, geral: fora.join(' ') };
  return { campos, geral: Object.keys(campos).length === 0 ? geral : null };
}

function statusDoErro(erro: unknown): number | null {
  if (typeof erro === 'object' && erro !== null && 'status' in erro && typeof (erro as { status: unknown }).status === 'number') {
    return (erro as { status: number }).status;
  }
  return null;
}

/**
 * Regra de senha que a API devolve como 400 sem `fieldErrors` (tamanho, igual ao e-mail, igual à provisória): vai para
 * o campo da senha, como no Entrar. Link inválido, verificação humana e erro que já aponta um campo ficam de fora.
 */
export function erroDeSenhaNoCampo(erro: unknown): string | null {
  const codigo = codigoApi(erro);
  if (codigo === 'LINK_INVALIDO' || codigo === 'VERIFICACAO_HUMANA' || codigo === 'MFA_CODIGO_INVALIDO') return null;
  if (statusDoErro(erro) !== 400 || Object.keys(errosPorCampo(erro)).length > 0) return null;
  return textoDoErro(erro);
}

/** Código de verificação recusado: embaixo do campo, não no alerta. */
export function erroDeMfaNoCampo(erro: unknown): string | null {
  if (codigoApi(erro) !== 'MFA_CODIGO_INVALIDO') return null;
  return textoDoErro(erro);
}

/** Leva o foco ao primeiro campo com erro, na ordem da tela (`refs`: nome do campo e o ref do `Campo`). */
export function focarPrimeiroComErro(campos: Record<string, string>, refs: readonly (readonly [string, RefObject<TextInput | null>])[]): void {
  refs.find(([campo]) => campos[campo])?.[1].current?.focus();
}
