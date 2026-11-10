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
 * Comentário do mural e das aulas: 1 a 280 caracteres depois do strip, contados em unidades UTF-16 (um emoji conta 2),
 * como a API: o que ela recusar volta no campo. Comentário antigo maior que isso continua aparecendo inteiro. O texto do
 * post do mural não tem este limite.
 */
export const COMENTARIO_MAXIMO = 280;
/** A partir daqui o contador também diz, em texto, quantos faltam (o aviso não depende só da cor). */
export const COMENTARIO_AVISO_A_PARTIR = 260;
export const MENSAGEM_COMENTARIO_VAZIO = 'Escreva o comentário.';
export const MENSAGEM_COMENTARIO_LONGO = `Use até ${COMENTARIO_MAXIMO} caracteres.`;

/** O que vai no `POST`; `null` = nada para enviar. */
export const comentarioParaEnviar = (texto: string): string | null => texto.trim() || null;

/** Em unidades UTF-16, como a API (um emoji conta 2): contar por caractere deixaria passar o que ela recusa. */
export const tamanhoDoComentario = (texto: string): number => texto.trim().length;

/** Erro do campo, ou `null` se o comentário pode ser enviado. */
export function erroDoComentario(texto: string): string | null {
  if (comentarioParaEnviar(texto) === null) return MENSAGEM_COMENTARIO_VAZIO;
  return tamanhoDoComentario(texto) > COMENTARIO_MAXIMO ? MENSAGEM_COMENTARIO_LONGO : null;
}

/**
 * Contador junto do campo: some com o campo vazio; perto do limite diz quantos faltam e, acima dele, quantos sobram,
 * sempre em texto (o tom só reforça). `null` = não mostrar.
 */
export function contadorDoComentario(texto: string): { texto: string; rotuloAcessivel: string; tom: 'normal' | 'atencao' | 'perigo' } | null {
  const tamanho = tamanhoDoComentario(texto);
  if (tamanho === 0) return null;
  const base = `${tamanho}/${COMENTARIO_MAXIMO}`;
  const lido = `${tamanho} de ${COMENTARIO_MAXIMO} caracteres`;
  if (tamanho > COMENTARIO_MAXIMO) {
    const sobra = tamanho - COMENTARIO_MAXIMO;
    const extra = `${sobra} a mais`;
    return { texto: `${base} · ${extra}`, rotuloAcessivel: `${lido}, ${extra}`, tom: 'perigo' };
  }
  if (tamanho >= COMENTARIO_AVISO_A_PARTIR) {
    const faltam = COMENTARIO_MAXIMO - tamanho;
    const extra = faltam === 0 ? 'no limite' : `faltam ${faltam}`;
    return { texto: `${base} · ${extra}`, rotuloAcessivel: `${lido}, ${extra}`, tom: 'atencao' };
  }
  return { texto: base, rotuloAcessivel: lido, tom: 'normal' };
}

/** Tamanho de cada página de comentários pedida à API (`?pagina=&tamanho=`, a mesma convenção de `/atualizacoes/pagina`). */
export const COMENTARIOS_POR_PAGINA = 30;

/**
 * Comentários já lidos de um post ou aula. `itens` é o começo da lista da API (mais antigo primeiro), página a página;
 * `enviados` são os que o aluno comentou enquanto ainda faltavam páginas (aparecem no fim e somem dali quando a página
 * que os traz chega). `total` é o da API, ajustado ao comentar e ao remover.
 */
export interface ComentariosLidos<T extends { id: string }> { itens: T[]; enviados: T[]; total: number }

export const comentariosDaPrimeiraPagina = <T extends { id: string }>(p: { itens: T[]; total: number }): ComentariosLidos<T> =>
  ({ itens: p.itens, enviados: [], total: p.total });

/** Quantos a API tem e a tela ainda não mostra. */
export const comentariosQueFaltam = (c: ComentariosLidos<{ id: string }>): number =>
  Math.max(0, c.total - c.itens.length - c.enviados.length);

/**
 * Página a pedir no "Carregar mais". Arredonda para baixo: depois de uma remoção a lista anda uma posição para trás e
 * `página + 1` pularia um comentário; pedir a página que contém o próximo e juntar por `id` não pula nem repete.
 */
export const proximaPaginaDeComentarios = (c: ComentariosLidos<{ id: string }>): number =>
  Math.floor(c.itens.length / COMENTARIOS_POR_PAGINA);

/** Acrescenta uma página sem perder o que já foi lido nem repetir comentário. */
export function juntarPaginaDeComentarios<T extends { id: string }>(c: ComentariosLidos<T>, p: { itens: T[]; total: number }): ComentariosLidos<T> {
  const vistos = new Set(c.itens.map((i) => i.id));
  const novos = p.itens.filter((i) => !vistos.has(i.id));
  const itens = [...c.itens, ...novos];
  const naLista = new Set(itens.map((i) => i.id));
  const enviados = c.enviados.filter((i) => !naLista.has(i.id));
  // Página sem nada novo (a lista encolheu no meio-tempo): encerra o "Carregar mais" em vez de oferecer de novo o mesmo.
  const total = novos.length === 0 ? Math.min(p.total, itens.length + enviados.length) : p.total;
  return { itens, enviados, total };
}

/** Comentário que o aluno acabou de enviar: entra no fim sem buscar a lista de novo. */
export function comComentarioEnviado<T extends { id: string }>(c: ComentariosLidos<T>, novo: T): ComentariosLidos<T> {
  if (c.itens.some((i) => i.id === novo.id) || c.enviados.some((i) => i.id === novo.id)) return c;
  return comentariosQueFaltam(c) === 0
    ? { ...c, itens: [...c.itens, novo], total: c.total + 1 }
    : { ...c, enviados: [...c.enviados, novo], total: c.total + 1 };
}

/** Comentário removido pela moderação (ou que já tinha saído): some da tela e do total. */
export function semOComentario<T extends { id: string }>(c: ComentariosLidos<T>, id: string): ComentariosLidos<T> {
  const estava = c.itens.some((i) => i.id === id) || c.enviados.some((i) => i.id === id);
  if (!estava) return c;
  return { itens: c.itens.filter((i) => i.id !== id), enviados: c.enviados.filter((i) => i.id !== id), total: Math.max(0, c.total - 1) };
}
