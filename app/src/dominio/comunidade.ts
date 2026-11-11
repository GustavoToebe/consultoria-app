import type { ConfiguracaoDoAluno, CriarPostRequest, FiltrosDoMural, MotivoDeDenuncia, PostDoMural, TipoDePost } from '../api/comunidadeTipos';
import { linkExternoSeguro, MENSAGEM_LINK } from './links';

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

// ---- Publicações do mural: tipos, validação e quem pode publicar (espelho de `ComunidadeService.criarPostMural`) ----

export const TIPOS_DE_POST: readonly { tipo: TipoDePost; rotulo: string }[] = [
  { tipo: 'AVISO', rotulo: 'Aviso' },
  { tipo: 'VIDEO', rotulo: 'Vídeo' },
  { tipo: 'DUVIDA', rotulo: 'Dúvida' },
  { tipo: 'RESULTADO', rotulo: 'Resultado' },
  { tipo: 'CONVERSA', rotulo: 'Conversa' },
];

export const rotuloDoTipo = (tipo: TipoDePost): string => TIPOS_DE_POST.find((t) => t.tipo === tipo)?.rotulo ?? tipo;

/** Aluno publica só estes três; `AVISO` e `VIDEO` são da equipe (decisão C2). A API confere de novo. */
const TIPOS_DO_ALUNO: readonly TipoDePost[] = ['CONVERSA', 'DUVIDA', 'RESULTADO'];

export type PapelNoMural = 'aluno' | 'equipe';

/** Tipos que o papel pode escolher, na ordem de `TIPOS_DE_POST` (`CONVERSA` é o padrão e vai por último na equipe). */
export const tiposParaEscolher = (papel: PapelNoMural): readonly { tipo: TipoDePost; rotulo: string }[] =>
  papel === 'equipe' ? TIPOS_DE_POST : TIPOS_DE_POST.filter((t) => TIPOS_DO_ALUNO.includes(t.tipo));

export const TIPO_PADRAO_DO_POST: TipoDePost = 'CONVERSA';
/** O mesmo teto do `@Size` da API, contado em unidades UTF-16 sobre o texto como veio (antes do strip). */
export const POST_TEXTO_MAXIMO = 2000;
export const POST_FOTOS_MAXIMO = 4;
export const MENSAGEM_POST_VAZIO = 'Escreva a publicação.';
export const MENSAGEM_POST_LONGO = `Use até ${POST_TEXTO_MAXIMO} caracteres.`;
export const MENSAGEM_POST_VIDEO_SEM_LINK = 'Informe o link do vídeo.';

export type CampoDoPost = 'tipo' | 'texto' | 'videoUrl' | 'fotoIds';
export interface RascunhoDoPost { tipo: TipoDePost; texto: string; videoUrl?: string; fotoIds?: string[] }

/** Erros por campo (vazio = pode enviar), nas mesmas regras que o servidor devolve em 422 `POST_INVALIDO`. */
export function errosDoPost(r: RascunhoDoPost, papel: PapelNoMural): Partial<Record<CampoDoPost, string>> {
  const erros: Partial<Record<CampoDoPost, string>> = {};
  if (papel === 'aluno' && !TIPOS_DO_ALUNO.includes(r.tipo)) erros.tipo = 'Este tipo só a equipe publica.';
  if (!r.texto.trim()) erros.texto = MENSAGEM_POST_VAZIO;
  else if (r.texto.length > POST_TEXTO_MAXIMO) erros.texto = MENSAGEM_POST_LONGO;
  const link = r.videoUrl?.trim() ?? '';
  if (r.tipo === 'VIDEO') {
    if (!link) erros.videoUrl = MENSAGEM_POST_VIDEO_SEM_LINK;
    else if (!linkExternoSeguro(link)) erros.videoUrl = MENSAGEM_LINK;
  } else if (link) erros.videoUrl = 'Só a publicação de vídeo leva link.';
  const fotos = r.fotoIds ?? [];
  if (fotos.length > 0) {
    if (papel === 'equipe') erros.fotoIds = 'A equipe não anexa fotos.';
    else if (fotos.length > POST_FOTOS_MAXIMO || new Set(fotos).size !== fotos.length) erros.fotoIds = `Use de 1 a ${POST_FOTOS_MAXIMO} fotos, sem repetir.`;
  }
  return erros;
}

/** O corpo do `POST`: texto com strip, link só no vídeo, fotos só quando há. */
export function postParaEnviar(r: RascunhoDoPost): CriarPostRequest {
  const corpo: CriarPostRequest = { tipo: r.tipo, texto: r.texto.trim() };
  if (r.tipo === 'VIDEO' && r.videoUrl?.trim()) corpo.videoUrl = r.videoUrl.trim();
  if (r.fotoIds?.length) corpo.fotoIds = r.fotoIds;
  return corpo;
}

/**
 * O aluno publica com a chave ligada e a configuração conhecida (sem ela, por exemplo offline, não: a API é quem decide e
 * recusaria com 403 `PUBLICACAO_DESLIGADA`). A equipe publica sempre que tem a permissão de moderar, que a tela confere.
 */
export const podePublicar = (config: Pick<ConfiguracaoDoAluno, 'alunosPublicam'> | null | undefined): boolean => config?.alunosPublicam === true;

/** Anexar foto: só com a chave ligada e o servidor liberando (o motivo, como a idade, nunca chega ao app). */
export const podeAnexarFoto = (config: ConfiguracaoDoAluno | null | undefined): boolean =>
  podePublicar(config) && config?.podeAnexarFoto === true;

// ---- Denúncia ----

export const MOTIVOS_DE_DENUNCIA: readonly { motivo: MotivoDeDenuncia; rotulo: string }[] = [
  { motivo: 'OFENSIVO', rotulo: 'Ofensivo ou desrespeitoso' },
  { motivo: 'SPAM', rotulo: 'Propaganda ou spam' },
  { motivo: 'IMPROPRIO', rotulo: 'Conteúdo impróprio' },
  { motivo: 'OUTRO', rotulo: 'Outro motivo' },
];

export const rotuloDoMotivo = (motivo: MotivoDeDenuncia): string => MOTIVOS_DE_DENUNCIA.find((m) => m.motivo === motivo)?.rotulo ?? motivo;

// ---- Filtros do mural ----

/** Filtro da faixa de chips: um tipo, os denunciados (só a equipe) ou `null` = todos. */
export type FiltroDoMural = TipoDePost | 'DENUNCIADOS' | null;

const PLURAL_DO_TIPO: Record<TipoDePost, string> = {
  AVISO: 'Avisos', VIDEO: 'Vídeos', DUVIDA: 'Dúvidas', RESULTADO: 'Resultados', CONVERSA: 'Conversas',
};

/** Chips do mural na ordem da tela; "Denunciados" só para quem modera. */
export function filtrosDoMural(comDenunciados: boolean): { valor: FiltroDoMural; rotulo: string }[] {
  return [
    { valor: null, rotulo: 'Todos' },
    ...TIPOS_DE_POST.map((t) => ({ valor: t.tipo, rotulo: PLURAL_DO_TIPO[t.tipo] })),
    ...(comDenunciados ? [{ valor: 'DENUNCIADOS' as const, rotulo: 'Denunciados' }] : []),
  ];
}

/** O filtro da tela no formato da API (`FiltrosDoMural`); busca em branco não vai. */
export function filtrosParaApi(filtro: FiltroDoMural, busca: string): FiltrosDoMural {
  const b = busca.trim();
  return {
    ...(filtro === 'DENUNCIADOS' ? { denunciados: true } : filtro ? { tipo: filtro } : {}),
    ...(b ? { busca: b } : {}),
  };
}

/** Mural vazio: com filtro ou busca a frase diz que nada bateu, sem filtro que ninguém publicou. */
export const textoDoMuralVazio = (filtro: FiltroDoMural, busca: string): string =>
  filtro || busca.trim() ? 'Nenhuma publicação encontrada com esse filtro.' : 'Nenhuma publicação no mural ainda.';

/** "1 denúncia", "3 denúncias" (só a equipe vê o número). */
export const textoDasDenuncias = (n: number): string => `${n} ${n === 1 ? 'denúncia' : 'denúncias'}`;

/**
 * Tipo pedido pelo endereço (`?publicar=RESULTADO`, do "Bom trabalho!"), só se o papel pode escolhê-lo; outro valor é
 * ignorado e o formulário não abre.
 */
export const tipoPedido = (valor: string | undefined, papel: PapelNoMural): TipoDePost | null =>
  tiposParaEscolher(papel).find((t) => t.tipo === valor)?.tipo ?? null;

/** Fotos do mural: os mesmos tetos do servidor (`LADO_MAXIMO` 1600 px, `BYTES_MAXIMO` 300 KB); o reencode tira EXIF. */
export const LIMITES_FOTO_DO_MURAL = { lados: [1600, 1200, 900, 640], bytesMaximo: 300_000 } as const;
