import { NOME_DO_PRODUTO } from './produto';

/**
 * Quem muda o e-mail de entrada do treinador (decisão do Gustavo, 28/11): o administrador fala com o suporte do produto; os
 * outros perfis, com o administrador da consultoria. Administrador = perfil com acesso total (`perfilEquipe.acessoTotal`).
 */
export function fraseDoEmailDeEntrada(administrador: boolean): string {
  return administrador
    ? `Para mudar o e-mail de entrada, fale com o suporte do ${NOME_DO_PRODUTO}.`
    : 'Para mudar o e-mail de entrada, fale com o administrador da consultoria.';
}

/** Assunto fixo do e-mail ao suporte: nada da pessoa (nome, e-mail, consultoria) vai no link. */
export const ASSUNTO_DO_SUPORTE = `Suporte ${NOME_DO_PRODUTO}`;

/** Endereço simples, sem nada que mude o `mailto:` (`?`, `&`, `#`, espaço, vírgula para outro destinatário). */
const ENDERECO = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

/** O `mailto:` do suporte com o assunto fixo; `null` sem contato ou com um endereço fora do formato. */
export function mailtoDoSuporte(contato: string | null): string | null {
  if (!contato || !ENDERECO.test(contato)) return null;
  return `mailto:${contato}?subject=${encodeURIComponent(ASSUNTO_DO_SUPORTE)}`;
}

/** O aviso quando o aparelho não abre o e-mail: o endereço por extenso, para escrever à mão. */
export function avisoSemEmail(contato: string): string {
  return `Não foi possível abrir o e-mail. Escreva para ${contato}.`;
}
