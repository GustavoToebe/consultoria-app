import { codigoApi, erroDeConexao, errosPorCampo, mensagemApi } from '@plataforma/web';
import type {
  AulaDaComunidade, CodigoDeReacao, ConfiguracaoDoAluno, CriarPostRequest, EnqueteDoMural, FiltrosDoMural, MotivoDeDenuncia,
  NovaAula, PodResumo, PostDoMural, TipoDePost,
} from '../api/comunidadeTipos';
import { paraBusca } from './filtrosComuns';
import { dataDaTela } from './formatos';
import { normalizarGrupo } from './gruposDaLista';
import { erroDoLink, linkExternoSeguro, MENSAGEM_LINK } from './links';

// ---- Reações (D6): o código vai à API; o emoji é só desenho ----

export const REACOES: readonly { codigo: CodigoDeReacao; emoji: string; rotulo: string }[] = [
  { codigo: 'CURTIR', emoji: '❤️', rotulo: 'Curtir' },
  { codigo: 'FORCA', emoji: '💪', rotulo: 'Força' },
  { codigo: 'FOGO', emoji: '🔥', rotulo: 'Fogo' },
  { codigo: 'PALMAS', emoji: '👏', rotulo: 'Palmas' },
  { codigo: 'RISO', emoji: '😂', rotulo: 'Risada' },
];

export const totalDaReacao = (post: Pick<PostDoMural, 'reacoes'>, codigo: CodigoDeReacao): number => post.reacoes[codigo] ?? 0;

export const reagiu = (post: Pick<PostDoMural, 'minhasReacoes'>, codigo: CodigoDeReacao): boolean => post.minhasReacoes.includes(codigo);

/** Nome lido pelo leitor de tela: começa pelo rótulo da reação e diz a contagem e se a pessoa já reagiu. */
export function rotuloDaReacao(rotulo: string, total: number, minha: boolean): string {
  const contagem = total === 1 ? '1 reação' : `${total} reações`;
  return `${rotulo}, ${contagem}${minha ? ', você reagiu' : ''}`;
}

/**
 * O post depois do `PUT` (ligar) ou `DELETE` (desligar) que a API confirmou (204): a contagem anda um e a marca entra ou
 * sai, sem buscar o mural de novo. Repetir o que já vale não muda nada (as rotas são idempotentes).
 */
export function comReacao<T extends Pick<PostDoMural, 'reacoes' | 'minhasReacoes'>>(post: T, codigo: CodigoDeReacao, ligar: boolean): T {
  if (reagiu(post, codigo) === ligar) return post;
  const total = Math.max(0, totalDaReacao(post, codigo) + (ligar ? 1 : -1));
  const minhas = ligar ? [...post.minhasReacoes, codigo] : post.minhasReacoes.filter((c) => c !== codigo);
  return {
    ...post,
    reacoes: { ...post.reacoes, [codigo]: total },
    minhasReacoes: REACOES.map((r) => r.codigo).filter((c) => minhas.includes(c)),
  };
}

// ---- Enquete ----

export const ENQUETE_OPCOES_MINIMO = 2;
export const ENQUETE_OPCOES_MAXIMO = 6;
export const ENQUETE_OPCAO_MAXIMA = 80;
/** Aviso fixo na criação (plano, passo 4). */
export const AVISO_AO_CRIAR_ENQUETE = 'O voto é identificado: não pergunte sobre saúde, lesão, peso ou dieta.';
/** Aviso fixo que aparece antes do voto, sempre (plano, passo 4). */
export const AVISO_ANTES_DO_VOTO = 'Seu nome, suas escolhas e o horário do voto ficam visíveis para quem tem acesso a esta enquete.';
export const MENSAGEM_PRAZO_DA_ENQUETE = 'O prazo tem de ser daqui para frente e em até 1 ano.';

/**
 * Prazo digitado (DD/MM/AAAA) → instante: a enquete encerra no fim daquele dia em Brasília (sem horário de verão desde
 * 2019). Vazio = `null` (sem prazo); data impossível = `undefined`.
 */
export function prazoDaEnquete(texto: string): string | null | undefined {
  const iso = dataDaTela(texto);
  if (!iso) return iso;
  return new Date(`${iso}T23:59:59-03:00`).toISOString();
}

/** Mesma regra de `EnquetesDoMuralService.conferirPrazo`: futuro e até 1 ano à frente (`agora` vem de fora, para testar). */
export function erroDoPrazo(texto: string, agora: Date): string | null {
  const prazo = prazoDaEnquete(texto);
  if (prazo === null) return null;
  if (prazo === undefined) return 'Data inválida. Use DD/MM/AAAA.';
  const limite = new Date(agora);
  limite.setUTCFullYear(limite.getUTCFullYear() + 1);
  const instante = new Date(prazo).getTime();
  return instante <= agora.getTime() || instante > limite.getTime() ? MENSAGEM_PRAZO_DA_ENQUETE : null;
}

/** Mesma regra de `opcoesLimpas`: 2 a 6, cada uma com 1 a 80 depois do strip, sem repetir (sem diferença de maiúsculas). */
export function erroDasOpcoes(opcoes: readonly string[]): string | null {
  if (opcoes.length < ENQUETE_OPCOES_MINIMO || opcoes.length > ENQUETE_OPCOES_MAXIMO) {
    return `Use de ${ENQUETE_OPCOES_MINIMO} a ${ENQUETE_OPCOES_MAXIMO} opções.`;
  }
  const limpas = opcoes.map((o) => o.trim());
  if (limpas.some((o) => !o || o.length > ENQUETE_OPCAO_MAXIMA)) return `Cada opção tem de 1 a ${ENQUETE_OPCAO_MAXIMA} caracteres.`;
  if (new Set(limpas.map((o) => o.toLowerCase())).size !== limpas.length) return 'Não repita opções.';
  return null;
}

/**
 * O conjunto que vai no `PUT .../votos` ao tocar numa opção. Escolha única: a opção tocada substitui a anterior, e tocar
 * na mesma retira o voto (`[]`). Várias respostas: liga ou desliga só a tocada.
 */
export function votosAoTocar(enquete: Pick<EnqueteDoMural, 'meusVotos' | 'variasRespostas'>, opcaoId: string): string[] {
  const marcada = enquete.meusVotos.includes(opcaoId);
  if (!enquete.variasRespostas) return marcada ? [] : [opcaoId];
  return marcada ? enquete.meusVotos.filter((id) => id !== opcaoId) : [...enquete.meusVotos, opcaoId];
}

/**
 * Percentual da opção sobre as pessoas que votaram (`participantes`), nunca sobre a soma dos votos: em "várias respostas"
 * a soma passa de 100% e cada barra continua dizendo quantas pessoas escolheram aquilo. Sem participantes = 0 (sem NaN).
 */
export const percentualDaOpcao = (votos: number, participantes: number): number =>
  participantes > 0 ? Math.round((Math.min(votos, participantes) / participantes) * 100) : 0;

export const textoDosVotos = (n: number): string => (n === 1 ? '1 voto' : `${n} votos`);

export function textoDosParticipantes(n: number): string {
  if (n === 0) return 'Ninguém votou ainda';
  return n === 1 ? '1 pessoa votou' : `${n} pessoas votaram`;
}

/** Nome do votante na lista: o próprio é "Você"; o apelido (só a equipe o recebe à parte) vem ao lado, nunca no lugar. */
export const nomeDoVotante = (v: { nome: string; apelido?: string | null; ehVoce?: boolean }): string =>
  v.ehVoce ? 'Você' : v.apelido ? `${v.nome} (${v.apelido})` : v.nome;

export const VOTANTES_POR_PAGINA = 30;

// ---- Vídeo do YouTube (D8): id por regex fechada; a URL gravada nunca vai direto ao player ----

/**
 * Hosts do YouTube que o player aceita (youtube.com, www, m e youtu.be; https, porta 443 ou nenhuma; o cadastro do link na
 * Comunidade aceita qualquer https por `LinksExternos`, e só o player usa esta regra) e os caminhos de vídeo
 * conhecidos (`watch?v=`, `shorts/`, `embed/`, `live/` e `youtu.be/<id>`). O host vem logo depois de `https://`: usuário
 * (`@`), outro domínio ou outra porta não passam. Id de exatamente 11 caracteres `[A-Za-z0-9_-]`.
 */
const VIDEO_DO_YOUTUBE =
  /^https:\/\/(?:(?:www\.|m\.)?youtube\.com(?::443)?\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be(?::443)?\/)([A-Za-z0-9_-]{11})(?=$|[?&#])/;

export function idDoYoutube(url: string | null | undefined): string | null {
  return VIDEO_DO_YOUTUBE.exec(url?.trim() ?? '')?.[1] ?? null;
}

/** O único `src` do player: molde fixo a partir do id já validado. */
export const urlDoEmbed = (id: string): string => `https://www.youtube-nocookie.com/embed/${id}`;

/**
 * C25: "Usar a capa do YouTube" só com link do YouTube reconhecido e ainda sem capa. O app nunca baixa a imagem do
 * YouTube: só manda o link à nossa API, que devolve o id de uma capa normal.
 */
export const podeUsarCapaDoYoutube = (videoUrl: string | null | undefined, capaId: string | null | undefined): boolean =>
  !capaId && idDoYoutube(videoUrl) !== null;

export const ROTULO_CAPA_DO_YOUTUBE = 'Usar a capa do YouTube';
export const ROTULO_BUSCANDO_A_CAPA = 'Buscando a capa…';
const SUGESTAO_DA_CAPA = 'Tente enviar a imagem.';

/** A mensagem da API; no 503 (YouTube indisponível) soma a saída que sobra: enviar a imagem da galeria. */
export const textoDoErroDaCapaDoYoutube = (status: number | null, mensagem: string): string =>
  status === 503 && !mensagem.includes(SUGESTAO_DA_CAPA) ? `${mensagem} ${SUGESTAO_DA_CAPA}` : mensagem;

/** "Abrir no YouTube": também montado pelo id, sem nenhum parâmetro da URL gravada. */
export const urlNoYoutube = (id: string): string => `https://www.youtube.com/watch?v=${id}`;

/** Atributos do iframe (web e o HTML do WebView no celular): sem autoplay, câmera nem microfone. */
export const ATRIBUTOS_DO_PLAYER = {
  referrerpolicy: 'strict-origin-when-cross-origin',
  allow: 'fullscreen; picture-in-picture; encrypted-media',
  sandbox: 'allow-scripts allow-same-origin allow-presentation',
  loading: 'lazy',
} as const;

const escaparHtml = (t: string): string => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Página do WebView: só o iframe montado pelo id (o `baseUrl` dá a origem que o embed pede no Referer). */
export function htmlDoPlayer(id: string, titulo: string): string {
  const a = ATRIBUTOS_DO_PLAYER;
  return '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style></head><body>'
    + `<iframe src="${urlDoEmbed(id)}" title="${escaparHtml(titulo)}" referrerpolicy="${a.referrerpolicy}" allow="${a.allow}"`
    + ` sandbox="${a.sandbox}" loading="${a.loading}" allowfullscreen></iframe></body></html>`;
}

/** Navegação do WebView: só a página acima (a `origem` exata) e o embed (host exato, https, sem usuário nem porta). */
export function navegacaoDoPlayerPermitida(url: unknown, origem: string): boolean {
  if (typeof url !== 'string') return false;
  if (url === 'about:blank' || url === 'about:srcdoc' || url === origem || url === `${origem}/`) return true;
  return /^https:\/\/www\.youtube-nocookie\.com(?:[/?#]|$)/.test(url);
}

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
  { tipo: 'ENQUETE', rotulo: 'Enquete' },
  { tipo: 'DUVIDA', rotulo: 'Dúvida' },
  { tipo: 'RESULTADO', rotulo: 'Resultado' },
  { tipo: 'CONVERSA', rotulo: 'Conversa' },
];

export const rotuloDoTipo = (tipo: TipoDePost): string => TIPOS_DE_POST.find((t) => t.tipo === tipo)?.rotulo ?? tipo;

/** Aluno publica só estes três; `AVISO`, `VIDEO` e `ENQUETE` são da equipe (decisão C2). A API confere de novo. */
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

export const MENSAGEM_ENQUETE_SEM_PERGUNTA = 'Escreva a pergunta.';

export type CampoDoPost = 'tipo' | 'texto' | 'videoUrl' | 'fotoIds' | 'capaId' | 'opcoes' | 'encerraEm';
/**
 * O que a folha guarda. Na enquete a pergunta é o `texto`, `opcoes` são os campos na ordem e `encerraEm` é a data digitada
 * (DD/MM/AAAA, vazia = sem prazo). `capaId` é a capa já enviada do vídeo.
 */
export interface RascunhoDoPost {
  tipo: TipoDePost;
  texto: string;
  videoUrl?: string;
  fotoIds?: string[];
  capaId?: string | null;
  opcoes?: string[];
  variasRespostas?: boolean;
  encerraEm?: string;
}

/** Folha nova de enquete: duas opções vazias, escolha única e sem prazo. */
export const OPCOES_INICIAIS_DA_ENQUETE: readonly string[] = ['', ''];

/** Erros por campo (vazio = pode enviar), nas mesmas regras que o servidor devolve em 422 `POST_INVALIDO`. */
export function errosDoPost(r: RascunhoDoPost, papel: PapelNoMural, agora: Date = new Date()): Partial<Record<CampoDoPost, string>> {
  const erros: Partial<Record<CampoDoPost, string>> = {};
  if (papel === 'aluno' && !TIPOS_DO_ALUNO.includes(r.tipo)) erros.tipo = 'Este tipo só a equipe publica.';
  if (!r.texto.trim()) erros.texto = r.tipo === 'ENQUETE' ? MENSAGEM_ENQUETE_SEM_PERGUNTA : MENSAGEM_POST_VAZIO;
  else if (r.texto.length > POST_TEXTO_MAXIMO) erros.texto = MENSAGEM_POST_LONGO;
  if (r.tipo === 'ENQUETE') {
    const opcoes = erroDasOpcoes(r.opcoes ?? []);
    if (opcoes) erros.opcoes = opcoes;
    const prazo = erroDoPrazo(r.encerraEm ?? '', agora);
    if (prazo) erros.encerraEm = prazo;
  }
  if (r.capaId && r.tipo !== 'VIDEO') erros.capaId = 'Só a publicação de vídeo leva capa.';
  const link = r.videoUrl?.trim() ?? '';
  if (r.tipo === 'VIDEO') {
    if (!link) erros.videoUrl = MENSAGEM_POST_VIDEO_SEM_LINK;
    else if (!linkExternoSeguro(link)) erros.videoUrl = MENSAGEM_LINK;
  } else if (link) erros.videoUrl = 'Só a publicação de vídeo leva link.';
  // De 0 a 4 fotos, sem repetir, para o aluno e (C36) para a equipe; quem pode anexar é decidido por `comFotos` na folha.
  const fotos = r.fotoIds ?? [];
  if (fotos.length > POST_FOTOS_MAXIMO || new Set(fotos).size !== fotos.length) erros.fotoIds = `Use de 1 a ${POST_FOTOS_MAXIMO} fotos, sem repetir.`;
  return erros;
}

/** O corpo do `POST`: texto com strip, link e capa só no vídeo, fotos só quando há, opções e prazo só na enquete. */
export function postParaEnviar(r: RascunhoDoPost): CriarPostRequest {
  const corpo: CriarPostRequest = { tipo: r.tipo, texto: r.texto.trim() };
  if (r.tipo === 'VIDEO' && r.videoUrl?.trim()) corpo.videoUrl = r.videoUrl.trim();
  if (r.tipo === 'VIDEO' && r.capaId) corpo.capaId = r.capaId;
  if (r.fotoIds?.length) corpo.fotoIds = r.fotoIds;
  if (r.tipo === 'ENQUETE') {
    corpo.opcoes = (r.opcoes ?? []).map((o) => o.trim());
    corpo.variasRespostas = r.variasRespostas === true;
    const prazo = prazoDaEnquete(r.encerraEm ?? '');
    if (prazo) corpo.encerraEm = prazo;
  }
  return corpo;
}

/**
 * O aluno publica com a chave ligada e a configuração conhecida (sem ela, por exemplo offline, não: a API é quem decide e
 * recusaria com 403 `PUBLICACAO_DESLIGADA`). A equipe publica sempre que tem a permissão de moderar, que a tela confere.
 */
export const podePublicar = (config: Pick<ConfiguracaoDoAluno, 'alunosPublicam'> | null | undefined): boolean => config?.alunosPublicam === true;

/** Anexar foto: só com a chave ligada e o servidor liberando (o motivo, como a idade, nunca chega ao app). */
export const podeAnexarFoto = (config: Pick<ConfiguracaoDoAluno, 'alunosPublicam' | 'podeAnexarFoto'> | null | undefined): boolean =>
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

/**
 * Filtros do mural (painel "Filtros do mural", `docs/planos/filtros-laterais.md`): um tipo (`null` = todos) e, só para quem
 * modera, as denunciadas. Os dois combinam: a API aplica `tipo` e `denunciados` juntos.
 */
export interface FiltroDoMural { tipo: TipoDePost | null; denunciados: boolean }
export type ChaveDoFiltroDoMural = keyof FiltroDoMural;

export const MURAL_SEM_FILTRO: FiltroDoMural = { tipo: null, denunciados: false };

const PLURAL_DO_TIPO: Record<TipoDePost, string> = {
  AVISO: 'Avisos', VIDEO: 'Vídeos', DUVIDA: 'Dúvidas', RESULTADO: 'Resultados', CONVERSA: 'Conversas', ENQUETE: 'Enquetes',
};

/** Opções do tipo de publicação, na ordem da tela. */
export function opcoesDoTipoDoMural(): { valor: TipoDePost | null; rotulo: string }[] {
  return [{ valor: null, rotulo: 'Todos' }, ...TIPOS_DE_POST.map((t) => ({ valor: t.tipo, rotulo: PLURAL_DO_TIPO[t.tipo] }))];
}

/** Etiquetas dos filtros aplicados (o contador do botão é o número delas). */
export function chipsDoMural(f: FiltroDoMural): { chave: ChaveDoFiltroDoMural; texto: string }[] {
  return [
    ...(f.tipo ? [{ chave: 'tipo' as const, texto: `Tipo: ${PLURAL_DO_TIPO[f.tipo]}` }] : []),
    ...(f.denunciados ? [{ chave: 'denunciados' as const, texto: 'Só denunciadas' }] : []),
  ];
}

export const semOFiltroDoMural = (f: FiltroDoMural, chave: ChaveDoFiltroDoMural): FiltroDoMural => ({ ...f, [chave]: MURAL_SEM_FILTRO[chave] });

/** O filtro da tela no formato da API (`FiltrosDoMural`); busca em branco não vai e `podId` ausente/nulo = mural geral. */
export function filtrosParaApi(filtro: FiltroDoMural, busca: string, podId?: string | null): FiltrosDoMural {
  const b = busca.trim();
  return {
    ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
    ...(filtro.denunciados ? { denunciados: true } : {}),
    ...(b ? { busca: b } : {}),
    ...(podId ? { podId } : {}),
  };
}

// ---- Pods: rótulo do post, aviso de menor, nome e erros (espelho de `PodsService`) ----

export const ROTULO_DO_MURAL_GERAL = 'Geral';

/** "Geral" ou o nome do pod do post. */
export const rotuloDoPost = (post: Pick<PostDoMural, 'podNome'>): string => post.podNome ?? ROTULO_DO_MURAL_GERAL;

/** Aviso do pod com algum menor (a API só diz `temMenor`; nunca idade nem nome). `null` = não mostrar. */
export const AVISO_DO_POD_COM_MENOR = 'Este grupo tem pelo menos um aluno menor de idade. Confira o que será publicado nele.';
export const avisoDoPod = (pod: Pick<PodResumo, 'temMenor'> | null | undefined): string | null =>
  pod?.temMenor ? AVISO_DO_POD_COM_MENOR : null;

/** Teto de alunos por pod, o mesmo `PodsService.TETO` da API (que confere de novo e responde 409 `POD_CHEIO`). */
export const POD_TETO = 12;

/**
 * Por que o pod não pode receber o aluno agora: cheio, a não ser que seja o pod atual dele (ficar onde está não ocupa vaga).
 * `null` = pode escolher. Só para mudar o grupo do aluno: publicar e filtrar não ocupam vaga.
 */
export const motivoDoGrupoCheio = (pod: Pick<PodResumo, 'id' | 'membros'>, grupoAtual: string | null): string | null =>
  pod.membros >= POD_TETO && pod.id !== grupoAtual ? `Grupo cheio: ${pod.membros} de ${POD_TETO}` : null;

export const POD_NOME_MINIMO = 2;
export const POD_NOME_MAXIMO = 40;
export const MENSAGEM_POD_NOME = `Use de ${POD_NOME_MINIMO} a ${POD_NOME_MAXIMO} caracteres.`;

/** O nome como a API grava (strip e NFC): é este texto que vai no corpo e que o campo confere. */
export const nomeDoPodParaEnviar = (texto: string): string => texto.trim().normalize('NFC');

/** Mesma regra do servidor: mínimo conta caracteres (um emoji vale 1), máximo conta UTF-16, depois do strip e do NFC. */
export function erroDoNomeDoPod(texto: string): string | null {
  const nome = nomeDoPodParaEnviar(texto);
  return [...nome].length < POD_NOME_MINIMO || nome.length > POD_NOME_MAXIMO ? MENSAGEM_POD_NOME : null;
}

const MENSAGEM_PADRAO_DO_POD = 'Não foi possível concluir. Tente de novo.';
const MENSAGENS_DO_POD: Record<string, string> = {
  POD_CHEIO: `Este grupo já tem ${POD_TETO} alunos. Tire alguém dele antes de incluir outro.`,
  POD_NOME_EM_USO: 'Já existe um grupo com esse nome. Escolha outro.',
  ALUNO_SEM_ACESSO: 'Só entra num grupo o aluno que já tem acesso ao app.',
  ALUNO_INATIVO: 'Aluno inativo não entra num grupo.',
  ALUNO_ANONIMIZADO: 'Este aluno foi anonimizado e não entra num grupo.',
};

/**
 * Erro de criar, renomear ou atribuir pod em português. `noCampoNome` = a mensagem é do campo do nome (422 `POD_INVALIDO`,
 * `fieldErrors` `nome`; cai no texto fixo se o campo não vier). Sem conexão e 403 mostram o texto da API; o resto, frase fixa.
 */
export function traduzirErroDoPod(erro: unknown): { mensagem: string; noCampoNome: boolean } {
  const codigo = codigoApi(erro);
  if (codigo === 'POD_INVALIDO') return { mensagem: errosPorCampo(erro).nome ?? MENSAGEM_POD_NOME, noCampoNome: true };
  const fixa = codigo ? MENSAGENS_DO_POD[codigo] : undefined;
  if (fixa) return { mensagem: fixa, noCampoNome: false };
  const status = typeof erro === 'object' && erro !== null ? (erro as { status?: unknown }).status : null;
  const daApi = erroDeConexao(erro) || status === 403;
  return { mensagem: daApi ? mensagemApi(erro, MENSAGEM_PADRAO_DO_POD) : MENSAGEM_PADRAO_DO_POD, noCampoNome: false };
}

/** Mural vazio: com filtro ou busca a frase diz que nada bateu, sem filtro que ninguém publicou. */
export function textoDoMuralVazio(filtro: FiltroDoMural, busca: string): string {
  if (filtro.denunciados && !filtro.tipo && !busca.trim()) return 'Nenhuma publicação denunciada.';
  return filtro.tipo || filtro.denunciados || busca.trim() ? 'Nenhuma publicação encontrada com esse filtro.' : 'Nenhuma publicação no mural ainda.';
}

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

// ---- Aulões: formulário, categorias (texto livre, decisão 8 de 12/11) e coleções ----

/** Tetos do `CriarAulaRequest` (o campo corta no limite; a API confere de novo). */
export const AULA_TITULO_MAXIMO = 120;
export const AULA_DESCRICAO_MAXIMA = 4000;
export const AULA_CATEGORIA_MAXIMA = 60;
export const SEM_CATEGORIA_DO_AULAO = 'Sem categoria';

/** `capaId` começa com a da aula: o `PUT` sem ela apagaria a capa, então "Remover capa" é o único jeito de pôr `null`. */
export interface RascunhoDaAula { titulo: string; link: string; categoria: string; descricao: string; capaId: string | null }

export const RASCUNHO_DA_AULA_VAZIO: RascunhoDaAula = { titulo: '', link: '', categoria: '', descricao: '', capaId: null };

/** O formulário de edição começa com o que a aula tem. */
export const rascunhoDaAula = (a: AulaDaComunidade): RascunhoDaAula =>
  ({ titulo: a.titulo, link: a.videoUrl ?? '', categoria: a.categoria ?? '', descricao: a.descricao ?? '', capaId: a.capaId ?? null });

/** Erros por campo (`null` = pode enviar), com as mensagens que a folha já mostrava. */
export function errosDaAula(r: RascunhoDaAula): { titulo: string | null; link: string | null } {
  return {
    titulo: r.titulo.trim() ? null : 'Escreva o título.',
    link: r.link.trim() ? erroDoLink(r.link) : 'Cole o link do vídeo.',
  };
}

/**
 * Corpo do envio. Sem `original` (criar) vai só o que a pessoa preencheu, e a API publica com ordem 0. Com `original`
 * (editar) vão os sete campos: o `PUT` substitui tudo e despublicaria (`publicada` ausente = `true`), voltaria a ordem a 0
 * e apagaria a capa se faltassem (a capa vem do rascunho, que começa com a da aula). Vazio vira nulo, para limpar a
 * descrição ou a categoria.
 */
export function corpoDaAula(r: RascunhoDaAula, original?: AulaDaComunidade): NovaAula {
  const titulo = r.titulo.trim();
  const videoUrl = r.link.trim();
  const descricao = r.descricao.trim() || null;
  const categoria = normalizarGrupo(r.categoria) || null;
  if (!original) {
    return { titulo, descricao: descricao ?? undefined, videoUrl, categoria: categoria ?? undefined, ...(r.capaId ? { capaId: r.capaId } : {}) };
  }
  return { titulo, descricao, videoUrl, categoria, ordem: original.ordem, publicada: original.publicada, capaId: r.capaId };
}

/** Categoria da aula como a API grava (espaços nas pontas e repetidos saem); vazia = `null`. */
const categoriaDa = (a: Pick<AulaDaComunidade, 'categoria'>): string | null => normalizarGrupo(a.categoria ?? '') || null;

/** Categorias usadas, sem repetir e em ordem alfabética (pt-BR). Grafias diferentes são categorias diferentes, como na API. */
export function categoriasDosAuloes(aulas: readonly Pick<AulaDaComunidade, 'categoria'>[]): string[] {
  const nomes = new Set(aulas.map(categoriaDa).filter((c): c is string => c !== null));
  return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Filtro da lista do treinador: `null` = todas, `''` = sem categoria, texto = a categoria. */
export type FiltroDeCategoria = string | null;

/** Chips do filtro com a contagem; "Sem categoria" só se alguma aula não tem. */
export function opcoesDoFiltroDeCategoria(aulas: readonly AulaDaComunidade[]): { valor: FiltroDeCategoria; rotulo: string; contagem: number }[] {
  const sem = aulas.filter((a) => categoriaDa(a) === null).length;
  return [
    { valor: null, rotulo: 'Todas', contagem: aulas.length },
    ...categoriasDosAuloes(aulas).map((c) => ({ valor: c, rotulo: c, contagem: aulas.filter((a) => categoriaDa(a) === c).length })),
    ...(sem ? [{ valor: '', rotulo: SEM_CATEGORIA_DO_AULAO, contagem: sem }] : []),
  ];
}

/** O filtro escolhido, ou "Todas" se a categoria sumiu (a última aula dela foi editada ou excluída). */
export const filtroDeCategoriaValido = (filtro: FiltroDeCategoria, aulas: readonly AulaDaComunidade[]): FiltroDeCategoria =>
  opcoesDoFiltroDeCategoria(aulas).some((o) => o.valor === filtro) ? filtro : null;

/** Etiqueta da categoria aplicada ("Todas" não vira etiqueta). */
export const chipDaCategoria = (filtro: FiltroDeCategoria): { chave: 'categoria'; texto: string }[] =>
  filtro === null ? [] : [{ chave: 'categoria', texto: `Categoria: ${filtro || SEM_CATEGORIA_DO_AULAO}` }];

export function filtrarAuloesPorCategoria<T extends Pick<AulaDaComunidade, 'categoria'>>(aulas: readonly T[], filtro: FiltroDeCategoria): T[] {
  if (filtro === null) return [...aulas];
  return aulas.filter((a) => (categoriaDa(a) ?? '') === filtro);
}

export interface ColecaoDeAuloes<T> { categoria: string | null; rotulo: string; itens: T[] }

/**
 * Coleções do aluno, uma por categoria: ordem alfabética (pt-BR), "Sem categoria" por último; dentro de cada uma, a ordem
 * da API (por `ordem` da aula). Categoria sem aula não aparece.
 */
export function agruparAuloesPorCategoria<T extends Pick<AulaDaComunidade, 'categoria'>>(aulas: readonly T[]): ColecaoDeAuloes<T>[] {
  const colecoes: ColecaoDeAuloes<T>[] = categoriasDosAuloes(aulas)
    .map((c) => ({ categoria: c, rotulo: c, itens: aulas.filter((a) => categoriaDa(a) === c) }));
  const sem = aulas.filter((a) => categoriaDa(a) === null);
  return sem.length ? [...colecoes, { categoria: null, rotulo: SEM_CATEGORIA_DO_AULAO, itens: sem }] : colecoes;
}

/** Busca local no título e na descrição, sem acento nem caixa (o mesmo que a API procura); vazia = todas. */
export function buscarAuloes<T extends Pick<AulaDaComunidade, 'titulo' | 'descricao'>>(aulas: readonly T[], busca: string): T[] {
  const termo = paraBusca(busca);
  return termo ? aulas.filter((a) => paraBusca(`${a.titulo} ${a.descricao ?? ''}`).includes(termo)) : [...aulas];
}

/** "1 aulão" / "3 aulões", na faixa da coleção. */
export const resumoDosAuloes = (n: number): string => (n === 1 ? '1 vídeo' : `${n} vídeos`);
