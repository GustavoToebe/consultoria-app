import { problemaDaNovaSenha } from './redefinirSenha';

/**
 * Trocar a própria senha (Meus dados do treinador e Conta do aluno, 28/11): quando o botão habilita e a força da nova.
 * O mínimo de 8, o teto de 72 bytes e "diferente do e-mail" são a `RegrasSenha` da API, já espelhada em
 * `redefinirSenha.problemaDaNovaSenha` (sem confirmação aqui: a nova vai como a própria confirmação).
 */

/**
 * O problema da nova que vai no próprio campo (72 bytes, igual ao e-mail). O tamanho mínimo não: quem diz "curta" é o
 * indicador de força, logo abaixo.
 */
export function problemaNoCampoDaNovaSenha(nova: string, email: string | null | undefined): string | null {
  return nova.length >= 8 ? problemaDaNovaSenha(nova, nova, email ?? undefined) : null;
}

/**
 * Por que "Trocar senha" está desabilitado, ou `null` quando dá para enviar (a API confere de novo). Com o problema já
 * escrito no campo, o motivo só aponta para ele (no celular os dois ficam à vista).
 */
export function motivoDaTrocaDeSenha(atual: string, nova: string, email: string | null | undefined): string | null {
  if (!atual || !nova) return 'Preencha a senha atual e a nova.';
  if (problemaNoCampoDaNovaSenha(nova, email)) return 'Corrija a nova senha.';
  return problemaDaNovaSenha(nova, nova, email ?? undefined);
}

/**
 * Indicador de força da senha nova. Só conta tamanho e variedade (minúscula, maiúscula, número, outro símbolo): não
 * consulta lista, não opina além disso e a senha nunca sai da tela. Abaixo do mínimo de 8 a senha é "curta".
 */
export type NivelDaSenha = 'curta' | 'fraca' | 'media' | 'forte';

export const ROTULO_DO_NIVEL: Record<NivelDaSenha, string> = { curta: 'curta', fraca: 'fraca', media: 'média', forte: 'forte' };

/** Quantas das três partes da barra ficam cheias. */
export const PARTES_DO_NIVEL: Record<NivelDaSenha, number> = { curta: 0, fraca: 1, media: 2, forte: 3 };

const TIPOS = [/\p{Ll}/u, /\p{Lu}/u, /\p{Nd}/u, /[^\p{L}\p{Nd}]/u];

/** `null` sem nada digitado (o indicador não aparece). */
export function forcaDaSenha(senha: string): NivelDaSenha | null {
  if (!senha) return null;
  const tamanho = [...senha].length;
  if (tamanho < 8) return 'curta';
  const variedade = TIPOS.filter((t) => t.test(senha)).length;
  const pontos = (tamanho >= 12 ? 1 : 0) + (tamanho >= 16 ? 1 : 0) + (variedade >= 2 ? 1 : 0) + (variedade >= 3 ? 1 : 0);
  return pontos <= 1 ? 'fraca' : pontos === 2 ? 'media' : 'forte';
}

/** A frase ao lado da barra; fora do "forte", a dica de como subir (sem dizer que alguma senha é segura). */
export function textoDaForca(nivel: NivelDaSenha): string {
  if (nivel === 'curta') return 'Força da senha: curta. Use pelo menos 8 caracteres.';
  if (nivel === 'forte') return 'Força da senha: forte.';
  return `Força da senha: ${ROTULO_DO_NIVEL[nivel]}. Mais caracteres e a mistura de letras, números e símbolos a deixam mais forte.`;
}
