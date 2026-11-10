import type { PostDoMural } from '../api/comunidadeTipos';

/** A única reação do app é a curtida; o resto das reações que a API aceita não aparece na tela. */
export const EMOJI_DA_CURTIDA = '❤️';

export const totalDeCurtidas = (post: Pick<PostDoMural, 'reacoes'>): number => post.reacoes[EMOJI_DA_CURTIDA] ?? 0;

export const curtidoPorMim = (post: Pick<PostDoMural, 'minhasReacoes'>): boolean => post.minhasReacoes.includes(EMOJI_DA_CURTIDA);

/** "3º de 12 participantes" (empate divide a posição, como na API). */
export function textoDaPosicao(posicao: number, participantes: number): string {
  return `${posicao}º de ${participantes} ${participantes === 1 ? 'participante' : 'participantes'}`;
}

/**
 * Apelido da Comunidade: espelho de `ApelidoDoAlunoService.normalizar` da API (o servidor decide de novo). Vazio apaga
 * (`null`); senão 2 a 24 caracteres depois do strip (contados por code point), letras com acento, números, espaço e
 * `_ . -`, sem link. Repetido entre alunos pode.
 */
export const APELIDO_MAXIMO = 24;
const APELIDO_MINIMO = 2;
const FORMATO_DO_APELIDO = /^[\p{L}\p{Nd} _.-]+$/u;
// Mesmas travas da API: preenchimentos invisíveis do Hangul passam por letra, e só pontuação ("...") não é apelido.
const INVISIVEL_NO_APELIDO = /[\u115F\u1160\u3164\uFFA0]/u;
const LETRA_OU_DIGITO = /[\p{L}\p{Nd}]/u;
// shortcut: lista curta de domínios, igual à da API; ampliar junto com ela se aparecer abuso.
const LINK_NO_APELIDO = /www\.|http|\.(com|net|org|br|io|gg|me|tv|app|link|dev|xyz|ly|co)(?![\p{L}\p{Nd}])/iu;
export const MENSAGEM_APELIDO_FORMATO = 'Use de 2 a 24 letras, números, espaço, _ . ou -.';
export const MENSAGEM_APELIDO_LINK = 'O apelido não pode ser um link.';

/** O que vai no `PUT`: `null` apaga. */
export const apelidoParaEnviar = (texto: string): string | null => texto.normalize('NFC').trim() || null;

/** Erro do campo, ou `null` se o apelido (ou o vazio, que apaga) pode ser enviado. */
export function erroDoApelido(texto: string): string | null {
  const limpo = apelidoParaEnviar(texto);
  if (limpo === null) return null;
  const tamanho = [...limpo].length;
  if (tamanho < APELIDO_MINIMO || tamanho > APELIDO_MAXIMO || !FORMATO_DO_APELIDO.test(limpo)
    || INVISIVEL_NO_APELIDO.test(limpo) || !LETRA_OU_DIGITO.test(limpo)) return MENSAGEM_APELIDO_FORMATO;
  // NFKC só para conferir o link (letras de largura total viram ASCII), como a API.
  if (LINK_NO_APELIDO.test(limpo.normalize('NFKC'))) return MENSAGEM_APELIDO_LINK;
  return null;
}

/**
 * Comentário do mural: 1 a 2000 caracteres depois do strip, contados por code point (um emoji conta 1). A API confere
 * de novo (`@Size(max = 2000)`, que conta UTF-16 antes do trim): o que ela recusar volta no campo.
 */
export const COMENTARIO_MAXIMO = 2000;
/** A partir daqui o contador aparece junto do campo. */
export const COMENTARIO_AVISO_A_PARTIR = 1800;
export const MENSAGEM_COMENTARIO_VAZIO = 'Escreva o comentário.';
export const MENSAGEM_COMENTARIO_LONGO = `Use até ${COMENTARIO_MAXIMO} caracteres.`;

/** O que vai no `POST`; `null` = nada para enviar. */
export const comentarioParaEnviar = (texto: string): string | null => texto.trim() || null;

/** Em unidades UTF-16, como o `@Size(max = 2000)` da API (um emoji conta 2): contar por caractere deixaria passar o que ela recusa. */
export const tamanhoDoComentario = (texto: string): number => texto.trim().length;

/** Erro do campo, ou `null` se o comentário pode ser enviado. */
export function erroDoComentario(texto: string): string | null {
  if (comentarioParaEnviar(texto) === null) return MENSAGEM_COMENTARIO_VAZIO;
  return tamanhoDoComentario(texto) > COMENTARIO_MAXIMO ? MENSAGEM_COMENTARIO_LONGO : null;
}
