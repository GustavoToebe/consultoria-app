import { codigoApi, erroDeConexao, errosPorCampo, mensagemApi } from '@plataforma/web';
import type {
  AulaDaComunidade, CodigoDeReacao, ConfiguracaoDoAluno, CriarPostRequest, EnqueteDoMural, FiltrosDoMural, MotivoDeDenuncia,
  NovaAula, PlaylistDaComunidade, PodResumo, PostDoMural, TipoDePost,
} from '../api/comunidadeTipos';
import { paraBusca } from './filtrosComuns';
import { dataDaTela, inteiroComMilhar } from './formatos';
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

/**
 * Comentários de um post do mural ou de um vídeo, em frase: "Nenhum comentário", "1 comentário", "N comentários". É texto
 * comum (a fonte numérica é só para número solto, como "40% · 4 votos").
 */
export const textoDeComentarios = (n: number): string =>
  n <= 0 ? 'Nenhum comentário' : n === 1 ? '1 comentário' : `${inteiroComMilhar(n)} comentários`;

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

// ---- Vídeos (aulões) e coleções (playlists, V088; "Coleções" na tela, `playlist` no código) ----

/** Tetos do `CriarAulaRequest` (o campo corta no limite; a API confere de novo). */
export const AULA_TITULO_MAXIMO = 120;
export const AULA_DESCRICAO_MAXIMA = 4000;

/** `capaId` começa com a da aula: o `PUT` sem ela apagaria a capa, então "Remover capa" é o único jeito de pôr `null`. */
export interface RascunhoDaAula { titulo: string; link: string; playlistId: string | null; descricao: string; capaId: string | null }

export const RASCUNHO_DA_AULA_VAZIO: RascunhoDaAula = { titulo: '', link: '', playlistId: null, descricao: '', capaId: null };

/** O formulário de edição começa com o que a aula tem, inclusive a coleção (o `PUT` sem ela tiraria o vídeo da coleção). */
export const rascunhoDaAula = (a: AulaDaComunidade): RascunhoDaAula =>
  ({ titulo: a.titulo, link: a.videoUrl ?? '', playlistId: a.playlistId, descricao: a.descricao ?? '', capaId: a.capaId ?? null });

/**
 * Com o que a folha abre: a aula na edição (a coleção inicial é ignorada); no "Novo vídeo", vazio, já na coleção do
 * "Adicionar vídeo" do cabeçalho dela (D4). A coleção que não existe mais vira "Sem coleção" na tela (`sumiu`).
 */
export const rascunhoInicialDaAula = (original?: AulaDaComunidade, colecaoInicialId?: string | null): RascunhoDaAula =>
  original ? rascunhoDaAula(original) : { ...RASCUNHO_DA_AULA_VAZIO, playlistId: colecaoInicialId ?? null };

/**
 * A folha tem algo a perder? Compara com o que ela abriu (`rascunhoInicialDaAula`; a capa trocada, removida ou vinda do
 * link também conta). Qualquer caractere diferente vale, para nada digitado sair sem a pergunta.
 */
export function aulaAlterada(r: RascunhoDaAula, inicial: RascunhoDaAula): boolean {
  return (Object.keys(inicial) as (keyof RascunhoDaAula)[]).some((k) => r[k] !== inicial[k]);
}

/**
 * De onde vem a capa do vídeo (D4). `automatica`: acompanha o link (`video` = o id do YouTube já atendido, com a capa dele
 * ou a tentativa feita). `fixa`: a pessoa decidiu (escolheu da galeria, removeu, ou é a capa da aula na edição) e o link
 * nunca a troca; `video` = o id do link quando ela decidiu, para saber se o link mudou de vídeo depois.
 */
export interface OrigemDaCapa { tipo: 'automatica' | 'fixa'; video: string | null }

/**
 * Abrir nunca busca nada (cada busca gasta uma das 100 capas do dia da consultoria e marcaria a folha como alterada): o
 * vídeo novo começa sem vídeo atendido; na edição, a capa da aula é fixa, e a aula sem capa só busca se o link mudar de vídeo.
 */
export const origemInicialDaCapa = (original?: AulaDaComunidade): OrigemDaCapa =>
  ({ tipo: original?.capaId ? 'fixa' : 'automatica', video: original ? idDoYoutube(original.videoUrl) : null });

/**
 * O link mudou: com a capa automática e outro vídeo (ou nenhum), a capa do vídeo anterior sai (`limpar`) e, sendo do
 * YouTube, a do novo é buscada (`buscar` = o id). O mesmo vídeo com outro parâmetro não muda nada; a capa fixa nunca muda.
 */
export function capaAoMudarOLink(origem: OrigemDaCapa, link: string): { origem: OrigemDaCapa; buscar: string | null; limpar: boolean } {
  const video = idDoYoutube(link);
  if (origem.tipo === 'fixa' || video === origem.video) return { origem, buscar: null, limpar: false };
  return { origem: { tipo: 'automatica', video }, buscar: video, limpar: true };
}

export const AVISO_CAPA_DE_OUTRO_VIDEO = 'O link mudou, mas a capa continua a que estava. Para usar a do vídeo novo, toque em “Usar a capa do YouTube”.';

/**
 * "Usar a capa do YouTube" aparece com link do YouTube e sem capa (a busca automática falhou, estava sem internet ou a
 * pessoa removeu) ou com a capa fixa de outro vídeo: aí, com o aviso de que o link não a trocou.
 */
export function capaDoYoutubeNaTela(origem: OrigemDaCapa, link: string, capaId: string | null): { oferecer: boolean; aviso: string | null } {
  const video = idDoYoutube(link);
  if (!video) return { oferecer: false, aviso: null };
  if (!capaId) return { oferecer: true, aviso: null };
  const deOutroVideo = origem.tipo === 'fixa' && origem.video !== video;
  return { oferecer: deOutroVideo, aviso: deOutroVideo ? AVISO_CAPA_DE_OUTRO_VIDEO : null };
}

/** Link preenchido e fora do que a API aceita (https, `LinksExternos`): o Publicar fica desativado. O vazio deixa tocar e mostra o erro. */
export const linkTravaOEnvio = (link: string): boolean => !!link.trim() && erroDoLink(link) !== null;

/** Erros por campo (`null` = pode enviar), com as mensagens que a folha já mostrava. */
export function errosDaAula(r: RascunhoDaAula): { titulo: string | null; link: string | null } {
  return {
    titulo: r.titulo.trim() ? null : 'Escreva o título.',
    link: r.link.trim() ? erroDoLink(r.link) : 'Cole o link do vídeo.',
  };
}

/**
 * Corpo do envio. `playlistId` vai SEMPRE (nulo = sem coleção): o `PUT` sem ele tira o vídeo da coleção. A posição nunca vai
 * (a API põe o vídeo novo ou movido no fim e mantém a dele se a coleção não muda). Sem `original` (criar) a descrição e a
 * capa só vão preenchidas; com `original` (editar) vão os seis campos: o `PUT` substitui tudo, despublicaria (`publicada`
 * ausente = `true`) e apagaria a capa se faltassem. Vazio vira nulo, para limpar a descrição.
 */
export function corpoDaAula(r: RascunhoDaAula, original?: AulaDaComunidade): NovaAula {
  const titulo = r.titulo.trim();
  const videoUrl = r.link.trim();
  const descricao = r.descricao.trim() || null;
  if (!original) {
    return { titulo, descricao: descricao ?? undefined, videoUrl, playlistId: r.playlistId, ...(r.capaId ? { capaId: r.capaId } : {}) };
  }
  return { titulo, descricao, videoUrl, playlistId: r.playlistId, publicada: original.publicada, capaId: r.capaId };
}

/** Rótulo do grupo e da opção dos vídeos fora de qualquer coleção. */
export const SEM_COLECAO = 'Sem coleção';
/** O formulário do vídeo só escolhe coleção existente (D17): sem nenhuma, este texto diz onde criar. */
export const TEXTO_CRIE_EM_COLECOES = 'Crie em “+ Nova coleção”, no fim da aba Vídeos.';
/** 404 ou 409 `CONFLITO_EDICAO` nas rotas de ordem e de lote: a tela recarrega e avisa com isto. */
export const MENSAGEM_LISTA_MUDOU = 'A lista mudou. Confira e tente de novo.';

/** Coleções na ordem do treinador (`ordem`; empate pelo nome). A tela nunca confia na ordem da resposta. */
export const playlistsEmOrdem = <P extends Pick<PlaylistDaComunidade, 'ordem' | 'nome'>>(playlists: readonly P[]): P[] =>
  [...playlists].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));

/**
 * Vídeos de uma coleção (`null` = os sem coleção) na ordem dela: por `ordem`, que pode ter buracos (rascunhos), e no empate a
 * ordem que veio (o "Sem coleção" tem tudo 0). Para o `PUT .../aulas/ordem` use a lista INTEIRA da equipe (com os não
 * publicados), nunca a filtrada por busca ou filtro: a API exige a lista completa e daria 409 sempre. Serve para uma coleção que
 * existe: a lista "Sem coleção" da tela (que também leva os vídeos de coleção que a lista ainda não traz) vem do grupo de
 * `agruparPorPlaylist` ou de `filtrarPorPlaylist(aulas, '', playlists)`.
 */
export const auloesDaPlaylist = <T extends Pick<AulaDaComunidade, 'playlistId' | 'ordem'>>(aulas: readonly T[], playlistId: string | null): T[] =>
  aulas.filter((a) => a.playlistId === playlistId).sort((a, b) => a.ordem - b.ordem);

/** O número de cada vídeo é a posição na lista (1, 2, 3…), nunca `ordem + 1` (a `ordem` pode ter buracos). */
export const numerados = <T>(itens: readonly T[]): { item: T; numero: number }[] => itens.map((item, i) => ({ item, numero: i + 1 }));

export type Direcao = 'cima' | 'baixo';

/** Subir/Descer: se o `id` pode andar nessa direção (não está na ponta e está na lista). */
export function podeMover(ids: readonly string[], id: string, direcao: Direcao): boolean {
  const i = ids.indexOf(id);
  return i >= 0 && (direcao === 'cima' ? i > 0 : i < ids.length - 1);
}

/**
 * A nova ordem depois de Subir/Descer um vídeo ou uma coleção (o corpo `{ids}` das rotas de ordem). Na ponta, ou com `id` fora
 * da lista, devolve a mesma ordem.
 */
export function moverNaLista(ids: readonly string[], id: string, direcao: Direcao): string[] {
  const nova = [...ids];
  if (!podeMover(ids, id, direcao)) return nova;
  const i = ids.indexOf(id);
  const j = direcao === 'cima' ? i - 1 : i + 1;
  [nova[i], nova[j]] = [nova[j], nova[i]];
  return nova;
}

/** A chave do vídeo: a coleção dele se ela está na lista, senão `''` (sem coleção, ou coleção que a lista ainda não traz). */
const chaveDaPlaylist = (a: Pick<AulaDaComunidade, 'playlistId'>, conhecidas: ReadonlySet<string>): string =>
  a.playlistId && conhecidas.has(a.playlistId) ? a.playlistId : '';

export interface GrupoDePlaylist<T> { playlist: PlaylistDaComunidade | null; rotulo: string; itens: T[] }

/**
 * Os vídeos agrupados por coleção, na ordem das coleções; dentro de cada uma, na ordem dela (`auloesDaPlaylist`). Coleção sem
 * vídeo nesta lista some (no aluno, a que não tem vídeo publicado; numa busca, a que não bateu); "Sem coleção" vai por último,
 * só se houver. Vídeo cuja coleção não está na lista (corrida entre os dois GETs) cai em "Sem coleção" e nunca some. Se o GET
 * das coleções falhou, a tela não agrupa (como o Planejamento): agrupar sem elas poria tudo em "Sem coleção".
 */
export function agruparPorPlaylist<T extends Pick<AulaDaComunidade, 'playlistId' | 'ordem'>>(
  aulas: readonly T[], playlists: readonly PlaylistDaComunidade[],
): GrupoDePlaylist<T>[] {
  const conhecidas = new Set(playlists.map((p) => p.id));
  const grupos: GrupoDePlaylist<T>[] = playlistsEmOrdem(playlists)
    .map((p) => ({ playlist: p, rotulo: p.nome, itens: auloesDaPlaylist(aulas, p.id) }))
    .filter((g) => g.itens.length > 0);
  const sem = aulas.filter((a) => chaveDaPlaylist(a, conhecidas) === '');
  return sem.length ? [...grupos, { playlist: null, rotulo: SEM_COLECAO, itens: sem }] : grupos;
}

/**
 * A lista do treinador: TODAS as coleções na ordem dele, também as vazias (onde a coleção recém-criada aparece), e "Sem
 * coleção" por último, só se houver. O aluno usa `agruparPorPlaylist` (coleção vazia não aparece para ele, D16).
 */
export function gruposDaEquipe<T extends Pick<AulaDaComunidade, 'playlistId' | 'ordem'>>(
  aulas: readonly T[], playlists: readonly PlaylistDaComunidade[],
): GrupoDePlaylist<T>[] {
  const comVideo = agruparPorPlaylist(aulas, playlists);
  const doGrupo = (p: PlaylistDaComunidade) => comVideo.find((g) => g.playlist?.id === p.id) ?? { playlist: p, rotulo: p.nome, itens: [] };
  return [...playlistsEmOrdem(playlists).map(doGrupo), ...comVideo.filter((g) => !g.playlist)];
}

/** Depois de um 204 de ordem: os itens de `ids` ganham `ordem` = posição; os outros ficam como estão. */
export function reordenados<T extends { id: string; ordem: number }>(itens: readonly T[], ids: readonly string[]): T[] {
  const posicao = new Map(ids.map((id, i) => [id, i]));
  return itens.map((x) => (posicao.has(x.id) ? { ...x, ordem: posicao.get(x.id) ?? x.ordem } : x));
}

/**
 * O lote de verdade: os marcados na ordem da tela (a API põe no fim do destino "na ordem enviada"), sem os que já estão no
 * destino (senão pulariam para o fim dele). `destino` nulo = tirar da coleção.
 */
export const aulasParaMover = (naOrdemDaTela: readonly Pick<AulaDaComunidade, 'id' | 'playlistId'>[], marcados: ReadonlySet<string>,
  destino: string | null): string[] =>
  naOrdemDaTela.filter((a) => marcados.has(a.id) && a.playlistId !== destino).map((a) => a.id);

/** Contagem da barra do modo Selecionar. */
export const textoDosMarcados = (n: number): string =>
  (n === 0 ? 'Nenhum vídeo marcado' : n === 1 ? '1 vídeo marcado' : `${n} vídeos marcados`);

/** Aviso depois do lote. */
export const textoDoLoteMovido = (n: number, destino: string | null): string =>
  `${resumoDosAuloes(n)} ${n === 1 ? 'movido' : 'movidos'} para “${destino ?? SEM_COLECAO}”.`;

/** O painel de excluir coleção diz o que acontece com os vídeos dela (nunca são apagados). */
export function textoDeExcluirPlaylist(totalAulas: number): string {
  if (totalAulas === 0) return 'A coleção está vazia. Nenhum vídeo muda.';
  if (totalAulas === 1) return `O vídeo dela passa para “${SEM_COLECAO}”; ele não é apagado.`;
  return `Os ${totalAulas} vídeos dela passam para “${SEM_COLECAO}”; nenhum vídeo é apagado.`;
}

/** Filtro da lista do treinador: `null` = todas, `''` = sem coleção, id = a coleção. */
export type FiltroDePlaylist = string | null;

/** Opções do filtro, com a contagem: Todas, cada coleção com vídeo (na ordem das coleções) e "Sem coleção" só se houver. */
export function opcoesDoFiltroDePlaylist(aulas: readonly Pick<AulaDaComunidade, 'playlistId' | 'ordem'>[], playlists: readonly PlaylistDaComunidade[]):
  { valor: FiltroDePlaylist; rotulo: string; contagem: number }[] {
  return [
    { valor: null, rotulo: 'Todas', contagem: aulas.length },
    ...agruparPorPlaylist(aulas, playlists).map((g) => ({ valor: g.playlist?.id ?? '', rotulo: g.rotulo, contagem: g.itens.length })),
  ];
}

/** O filtro escolhido, ou "Todas" se a coleção sumiu (excluída, ou ficou sem vídeo). */
export const filtroDePlaylistValido = (filtro: FiltroDePlaylist, aulas: readonly Pick<AulaDaComunidade, 'playlistId' | 'ordem'>[],
  playlists: readonly PlaylistDaComunidade[]): FiltroDePlaylist =>
  opcoesDoFiltroDePlaylist(aulas, playlists).some((o) => o.valor === filtro) ? filtro : null;

/** Etiqueta da coleção aplicada ("Todas" não vira etiqueta). */
export const chipDaPlaylist = (filtro: FiltroDePlaylist, playlists: readonly PlaylistDaComunidade[]): { chave: 'playlist'; texto: string }[] =>
  filtro === null ? [] : [{ chave: 'playlist', texto: `Coleção: ${filtro ? playlists.find((p) => p.id === filtro)?.nome ?? SEM_COLECAO : SEM_COLECAO}` }];

/** Os vídeos do filtro, na ordem em que vieram (`''` também pega os de coleção que a lista não traz). */
export function filtrarPorPlaylist<T extends Pick<AulaDaComunidade, 'playlistId'>>(aulas: readonly T[], filtro: FiltroDePlaylist,
  playlists: readonly PlaylistDaComunidade[]): T[] {
  if (filtro === null) return [...aulas];
  const conhecidas = new Set(playlists.map((p) => p.id));
  return aulas.filter((a) => chaveDaPlaylist(a, conhecidas) === filtro);
}

/** Busca local no título e na descrição, sem acento nem caixa (o mesmo que a API procura); vazia = todas. */
export function buscarAuloes<T extends Pick<AulaDaComunidade, 'titulo' | 'descricao'>>(aulas: readonly T[], busca: string): T[] {
  const termo = paraBusca(busca);
  return termo ? aulas.filter((a) => paraBusca(`${a.titulo} ${a.descricao ?? ''}`).includes(termo)) : [...aulas];
}

/**
 * Busca do aluno: procura em todos os vídeos e devolve cada um com o nome da coleção ("Sem coleção" se não tem ou se a coleção
 * não está na lista), na ordem das coleções e, dentro delas, na ordem de cada uma.
 */
export function buscarAuloesComPlaylist<T extends Pick<AulaDaComunidade, 'titulo' | 'descricao' | 'playlistId' | 'ordem'>>(
  aulas: readonly T[], playlists: readonly PlaylistDaComunidade[], busca: string,
): { aula: T; playlist: string }[] {
  return agruparPorPlaylist(buscarAuloes(aulas, busca), playlists).flatMap((g) => g.itens.map((aula) => ({ aula, playlist: g.rotulo })));
}

/** "1 vídeo" / "3 vídeos", na faixa da coleção. */
export const resumoDosAuloes = (n: number): string => (n === 1 ? '1 vídeo' : `${n} vídeos`);

/** Teto do lote da API (`PUT /comunidade/aulas/playlist`, `aulaIds` de 1 a 100). */
export const LOTE_MAXIMO = 100;

/**
 * Divide a seleção em lotes de até `tamanho` (lista vazia = nenhum lote: a API exige pelo menos 1). Lotes em sequência não são
 * atômicos: se um falhar no meio, os anteriores já valeram, e a tela recarrega a lista.
 */
export function emLotes<T>(itens: readonly T[], tamanho: number = LOTE_MAXIMO): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
  return lotes;
}

export const PLAYLIST_NOME_MAXIMO = 60;
export const MENSAGEM_PLAYLIST_NOME = `Use de 1 a ${PLAYLIST_NOME_MAXIMO} caracteres.`;

/** O nome como a API grava (`PlaylistsService.nomeLimpo`: espaços repetidos viram um, strip e NFC). */
export const nomeDaPlaylistParaEnviar = (texto: string): string => normalizarGrupo(texto).normalize('NFC');

/** Mesma regra do servidor: de 1 a 60 em unidades UTF-16 (um emoji conta 2), depois da limpeza. */
export function erroDoNomeDaPlaylist(texto: string): string | null {
  const nome = nomeDaPlaylistParaEnviar(texto);
  return !nome || nome.length > PLAYLIST_NOME_MAXIMO ? MENSAGEM_PLAYLIST_NOME : null;
}

const statusDoErro = (erro: unknown): unknown => (typeof erro === 'object' && erro !== null ? (erro as { status?: unknown }).status : null);

/** 404 ou 409 `CONFLITO_EDICAO` nas rotas de ordem, de lote ou de uma coleção: a lista da tela está velha (recarregar e avisar). */
export const listaVelha = (erro: unknown): boolean => statusDoErro(erro) === 404 || codigoApi(erro) === 'CONFLITO_EDICAO';

const MENSAGEM_PADRAO_DA_PLAYLIST = 'Não foi possível concluir. Tente de novo.';

/**
 * Erro de criar, renomear, excluir ou reordenar coleção em português. `noCampoNome`: 422 `PLAYLIST_INVALIDA` (a mensagem do
 * campo `nome`, ou a fixa) e 409 `PLAYLIST_NOME_EM_USO`. `recarregar`: lista velha (`listaVelha`). Sem conexão e 403 mostram
 * o texto da API; o resto, frase fixa.
 */
export function traduzirErroDaPlaylist(erro: unknown): { mensagem: string; noCampoNome: boolean; recarregar: boolean } {
  const codigo = codigoApi(erro);
  if (codigo === 'PLAYLIST_INVALIDA') return { mensagem: errosPorCampo(erro).nome ?? MENSAGEM_PLAYLIST_NOME, noCampoNome: true, recarregar: false };
  if (codigo === 'PLAYLIST_NOME_EM_USO') return { mensagem: 'Já existe uma coleção com esse nome. Escolha outro.', noCampoNome: true, recarregar: false };
  if (listaVelha(erro)) return { mensagem: MENSAGEM_LISTA_MUDOU, noCampoNome: false, recarregar: true };
  const daApi = erroDeConexao(erro) || statusDoErro(erro) === 403;
  return { mensagem: daApi ? mensagemApi(erro, MENSAGEM_PADRAO_DA_PLAYLIST) : MENSAGEM_PADRAO_DA_PLAYLIST, noCampoNome: false, recarregar: false };
}
