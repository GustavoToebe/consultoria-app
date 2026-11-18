import { COMENTARIOS_POR_PAGINA, VOTANTES_POR_PAGINA } from '../dominio/comunidade';
import type { CorpoDoPerfil } from '../dominio/perfilDaComunidade';
import { COLEGAS_POR_PAGINA } from '../dominio/perfilDoColega';
import { requisicao } from './cliente';
import type {
  AlvoDosComentarios, AulaDaComunidade, CodigoDeReacao, ComentarioDoMural, ConfiguracaoDaComunidade, ConfiguracaoDoAluno,
  ConquistaDoAluno, CriarPostRequest, EnqueteDoMural, FiltrosDoMural, MotivoDeDenuncia, NovaAula, PaginaDeColegas,
  PaginaDeComentarios, PaginaDoMural, PerfilDaComunidade, PlaylistDaComunidade, PodResumo, PosicaoNoRanking, PostDoMural, PreferenciasDoPerfil,
  VotosDaEnquete,
} from './comunidadeTipos';

// Rotas reais da API (`AlunoComunidadeController` e `ComunidadeController`). Erro é erro: a tela mostra o aviso com
// "Tentar de novo"; nenhum dado de exemplo entra no lugar de uma resposta.

// shortcut: só a página mais recente do mural (50, o teto da API), sem "ver mais"; trocar por paginação quando o mural passar disso.
const PAGINA_DO_MURAL = '?pagina=0&tamanho=50';

// Comentários: post do mural (`/mural/{id}`) ou aula (`/aulas/{id}`); a lista vem por página (`{itens, total}`, página 0 primeiro).
const DO_ALVO = { post: 'mural', aula: 'aulas' } as const;
const comentariosDoAlvo = (alvo: AlvoDosComentarios) => `${DO_ALVO[alvo.tipo]}/${encodeURIComponent(alvo.id)}/comentarios`;
const pagina = (n: number) => `?pagina=${n}&tamanho=${COMENTARIOS_POR_PAGINA}`;

/** Filtros do mural na query: sem valor não vai (a API trata `tipo`/`busca` ausentes como "todos"); busca em branco não vai. */
const filtrosDoMural = (f: FiltrosDoMural | undefined, comDenunciados: boolean): string => {
  const busca = f?.busca?.trim();
  return [
    f?.tipo ? `&tipo=${f.tipo}` : '',
    busca ? `&busca=${encodeURIComponent(busca)}` : '',
    comDenunciados && f?.denunciados ? '&denunciados=true' : '',
    f?.podId ? `&podId=${encodeURIComponent(f.podId)}` : '',
  ].join('');
};

const paginaDeVotos = (opcaoId: string | null, n: number) =>
  `?pagina=${n}&tamanho=${VOTANTES_POR_PAGINA}${opcaoId ? `&opcaoId=${encodeURIComponent(opcaoId)}` : ''}`;

const comBusca = (caminho: string, busca?: string): string => {
  const b = busca?.trim();
  return b ? `${caminho}?busca=${encodeURIComponent(b)}` : caminho;
};

// ---- Aluno ----

export const listarAulasDoAluno = (busca?: string) => requisicao<AulaDaComunidade[]>(comBusca('/aluno/comunidade/aulas', busca));

/** Só as coleções com vídeo publicado; `totalAulas` conta só os publicados. Ordene por `playlistsEmOrdem`. */
export const listarPlaylistsDoAluno = () => requisicao<PlaylistDaComunidade[]>('/aluno/comunidade/playlists');

export const listarMuralDoAluno = (filtros?: FiltrosDoMural) =>
  requisicao<PaginaDoMural>(`/aluno/comunidade/mural${PAGINA_DO_MURAL}${filtrosDoMural(filtros, false)}`);

/**
 * Aluno: só `CONVERSA`, `DUVIDA` e `RESULTADO` (0 a 4 `fotoIds` enviados antes). 403 `PUBLICACAO_DESLIGADA`, 403 `FOTO_NAO_PERMITIDA`,
 * 422 `POST_INVALIDO` com o erro no campo (`tipo`, `videoUrl`, `fotoIds`).
 */
export const publicarNoMuralDoAluno = (post: CriarPostRequest) =>
  requisicao<PostDoMural>('/aluno/comunidade/mural', { metodo: 'POST', corpo: post });

/** Quem publica e se pode anexar foto; ler antes de mostrar o compositor. */
export const obterConfiguracaoDoAluno = () => requisicao<ConfiguracaoDoAluno>('/aluno/comunidade/configuracao');

/**
 * Uma foto pendente por chamada: `arquivo` é um `FormData` com o campo `arquivo` (JPEG já reduzido; `anexarFoto`). 403 `FOTO_NAO_PERMITIDA`;
 * 422 `FOTO_INVALIDA`, `FOTO_GRANDE_DEMAIS` (300 KB) ou `FOTOS_LIMITE_DIARIO` (20 em 24 h).
 */
export const enviarFotoDoMural = (arquivo: FormData) =>
  requisicao<{ id: string }>('/aluno/comunidade/mural/fotos', { metodo: 'POST', corpoBruto: arquivo, limiteMs: 60000 });

/** Remove a foto pendente do próprio aluno (204); a já publicada ou de outro autor dá 404. */
export const apagarFotoPendenteDoMural = (id: string) =>
  requisicao<void>(`/aluno/comunidade/mural/fotos/${encodeURIComponent(id)}`, { metodo: 'DELETE' });

/** Bytes da foto de um post visível ou da própria pendente, com o token. */
export const baixarFotoDoMuralDoAluno = (id: string) =>
  requisicao<Blob>(`/aluno/comunidade/mural/fotos/${encodeURIComponent(id)}`, { binario: true, limiteMs: 30000 });

/** 204, idempotente; o aluno nunca vê quem denunciou nem quantas há. 422 `DENUNCIA_INVALIDA` (motivo ou o próprio post). */
export const denunciarPost = (postId: string, motivo: MotivoDeDenuncia) =>
  requisicao<void>(`/aluno/comunidade/mural/${encodeURIComponent(postId)}/denuncias`, { metodo: 'POST', corpo: { motivo } });

/** Liga (`PUT`) ou desliga (`DELETE`) uma reação do aluno: idempotente, 204; código fora da lista = 422 `REACAO_INVALIDA`. */
export const reagirComoAluno = (postId: string, codigo: CodigoDeReacao, ligar: boolean) =>
  requisicao<void>(`/aluno/comunidade/mural/${encodeURIComponent(postId)}/reacoes/${codigo}`, { metodo: ligar ? 'PUT' : 'DELETE' });

/**
 * Substitui o voto do aluno (`[]` retira) e devolve a enquete atualizada. 409 `ENQUETE_ENCERRADA` (também ao retirar),
 * 422 `VOTO_INVALIDO`, 404 se o post saiu.
 */
export const votarComoAluno = (postId: string, opcaoIds: string[]) =>
  requisicao<EnqueteDoMural>(`/aluno/comunidade/mural/${encodeURIComponent(postId)}/votos`, { metodo: 'PUT', corpo: { opcaoIds } });

/** "Mostrar votos": uma página (base 0) de votantes, mais recentes primeiro; `opcaoId` filtra uma opção. */
export const listarVotosDoAluno = (postId: string, opcaoId: string | null, n: number) =>
  requisicao<VotosDaEnquete>(`/aluno/comunidade/mural/${encodeURIComponent(postId)}/votos${paginaDeVotos(opcaoId, n)}`);

/** Bytes da capa de um vídeo (post ou aulão), com o token. */
export const baixarCapaDoAluno = (id: string) =>
  requisicao<Blob>(`/aluno/comunidade/capas/${encodeURIComponent(id)}`, { binario: true, limiteMs: 30000 });

/** 404 se o post ou a aula não está ao alcance (outra consultoria, oculto ou aula não publicada). */
export const listarComentariosDoAluno = (alvo: AlvoDosComentarios, n: number) =>
  requisicao<PaginaDeComentarios>(`/aluno/comunidade/${comentariosDoAlvo(alvo)}${pagina(n)}`);

/** A API faz o trim e confere 1 a 280 caracteres (UTF-16); passa pelo limite de 120 por hora (429 `LOGIN_LIMITADO`). */
export const comentarComoAluno = (alvo: AlvoDosComentarios, texto: string) =>
  requisicao<ComentarioDoMural>(`/aluno/comunidade/${comentariosDoAlvo(alvo)}`, { metodo: 'POST', corpo: { texto } });

export const listarMinhasConquistas = () => requisicao<ConquistaDoAluno[]>('/aluno/comunidade/conquistas');

export const obterMeuRanking = () => requisicao<PosicaoNoRanking>('/aluno/comunidade/ranking');

/** 404 de mensagem fixa para qualquer autor fora do alcance (equipe, outra consultoria, anonimizado); 429 no balde de 300/h. */
export const obterPerfilDaComunidade = (autorId: string) =>
  requisicao<PerfilDaComunidade>(`/aluno/comunidade/perfis/${encodeURIComponent(autorId)}`);

/** Foto do colega, com o token; o mesmo 404 para reservado, sem foto, equipe etc. Só pedir com `temFoto`. */
export const baixarFotoDoColega = (autorId: string) =>
  requisicao<Blob>(`/aluno/comunidade/perfis/${encodeURIComponent(autorId)}/foto`, { binario: true, limiteMs: 30000 });

/** Colegas com perfil visível, por nome; `pagina` base 0. */
export const listarColegasDaComunidade = (n: number) =>
  requisicao<PaginaDeColegas>(`/aluno/comunidade/perfis?pagina=${n}&tamanho=${COLEGAS_POR_PAGINA}`);

/** `null` apaga. 422 com o erro no campo `apelido`; o apelido nunca fica no aparelho. */
export const definirMeuApelido = (apelido: string | null) =>
  requisicao<void>('/aluno/comunidade/apelido', { metodo: 'PUT', corpo: { apelido } });

/**
 * Preferências do próprio perfil. O PUT substitui as cinco: mande sempre todas (`dominio/perfilDaComunidade.corpoDoPerfil`).
 * `exibicaoDoNome` fora da lista = 422 `PERFIL_INVALIDO` no campo `exibicaoDoNome`.
 */
export const meuPerfilDaComunidade = () => requisicao<PreferenciasDoPerfil>('/aluno/comunidade/perfil');

export const salvarMeuPerfilDaComunidade = (corpo: CorpoDoPerfil) =>
  requisicao<PreferenciasDoPerfil>('/aluno/comunidade/perfil', { metodo: 'PUT', corpo });

// ---- Equipe (TREINO_LER para ler, COMUNIDADE_MODERAR para publicar e moderar) ----

export const listarAulasDaEquipe = (busca?: string) => requisicao<AulaDaComunidade[]>(comBusca('/comunidade/aulas', busca));

export const criarAula = (aula: NovaAula) => requisicao<AulaDaComunidade>('/comunidade/aulas', { metodo: 'POST', corpo: aula });

/** Substitui a aula inteira (`COMUNIDADE_MODERAR`): mande os seis campos (`corpoDaAula` com a original). 404 = já saiu. */
export const alterarAula = (id: string, aula: NovaAula) =>
  requisicao<AulaDaComunidade>(`/comunidade/aulas/${encodeURIComponent(id)}`, { metodo: 'PUT', corpo: aula });

/** 204; os comentários da aula saem junto (FK `ON DELETE CASCADE`). 404 = já saiu. */
export const excluirAula = (id: string) =>
  requisicao<void>(`/comunidade/aulas/${encodeURIComponent(id)}`, { metodo: 'DELETE' });

// ---- Coleções (playlists, V088; `PlaylistsController`). Erros: `dominio/comunidade.traduzirErroDaPlaylist` e `listaVelha`. ----

/** Todas as coleções, também as vazias (`TREINO_LER`); `totalAulas` conta todos os vídeos. Ordene por `playlistsEmOrdem`. */
export const listarPlaylists = () => requisicao<PlaylistDaComunidade[]>('/comunidade/playlists');

/** Vazia é válida; vai para o fim. 422 `PLAYLIST_INVALIDA` (campo `nome`), 409 `PLAYLIST_NOME_EM_USO`. */
export const criarPlaylist = (nome: string) =>
  requisicao<PlaylistDaComunidade>('/comunidade/playlists', { metodo: 'POST', corpo: { nome } });

/** Os mesmos erros de `criarPlaylist`, mais 404 (já saiu). */
export const renomearPlaylist = (id: string, nome: string) =>
  requisicao<PlaylistDaComunidade>(`/comunidade/playlists/${encodeURIComponent(id)}`, { metodo: 'PUT', corpo: { nome } });

/** 204; os vídeos ficam sem coleção (com `ordem` 0), nunca são apagados. 404 = já saiu. */
export const excluirPlaylist = (id: string) =>
  requisicao<void>(`/comunidade/playlists/${encodeURIComponent(id)}`, { metodo: 'DELETE' });

/** A lista COMPLETA das coleções, na nova ordem (1 a 500, sem repetir); 409 `CONFLITO_EDICAO` ou 404 = lista velha. 204. */
export const reordenarPlaylists = (ids: string[]) =>
  requisicao<void>('/comunidade/playlists/ordem', { metodo: 'PUT', corpo: { ids } });

/** A lista COMPLETA dos vídeos da coleção (com os não publicados), na nova ordem; 409 `CONFLITO_EDICAO` ou 404 = lista velha. 204. */
export const reordenarAulasDaPlaylist = (playlistId: string, ids: string[]) =>
  requisicao<void>(`/comunidade/playlists/${encodeURIComponent(playlistId)}/aulas/ordem`, { metodo: 'PUT', corpo: { ids } });

/**
 * Um lote de 1 a 100 vídeos para o fim da coleção, na ordem enviada (`playlistId` nulo = tira da coleção). Acima de 100, a tela
 * chama uma vez por lote (`emLotes`). 404 ou 409 `CONFLITO_EDICAO` = lista velha. 204.
 */
export const moverAulasParaPlaylist = (aulaIds: string[], playlistId: string | null) =>
  requisicao<void>('/comunidade/aulas/playlist', { metodo: 'PUT', corpo: { aulaIds, playlistId } });

export const listarMuralDaEquipe = (filtros?: FiltrosDoMural) =>
  requisicao<PaginaDoMural>(`/comunidade/mural${PAGINA_DO_MURAL}${filtrosDoMural(filtros, true)}`);

/** Equipe (`COMUNIDADE_MODERAR`): todos os tipos, com 0 a 4 `fotoIds`; `VIDEO` exige `videoUrl` https; `AVISO` nasce fixado. 422 `POST_INVALIDO`. */
export const publicarNoMuralDaEquipe = (post: CriarPostRequest) =>
  requisicao<PostDoMural>('/comunidade/mural', { metodo: 'POST', corpo: post });

/** C36: uma foto pendente por chamada, como a do aluno (`enviarFotoDoMural`), pela rota da equipe. */
export const enviarFotoDoMuralDaEquipe = (arquivo: FormData) =>
  requisicao<{ id: string }>('/comunidade/mural/fotos', { metodo: 'POST', corpoBruto: arquivo, limiteMs: 60000 });

/** Remove a foto pendente (204); a já publicada dá 404. */
export const apagarFotoPendenteDaEquipe = (id: string) =>
  requisicao<void>(`/comunidade/mural/fotos/${encodeURIComponent(id)}`, { metodo: 'DELETE' });

/** Fixa ou desafixa (a API alterna; 204). O aviso já nasce fixado. */
export const alternarFixadoDoPost = (postId: string) =>
  requisicao<void>(`/comunidade/mural/${encodeURIComponent(postId)}/fixar`, { metodo: 'POST' });

/** Remove o post do mural para todos (204; `COMUNIDADE_MODERAR`). */
export const removerPostDoMural = (postId: string) =>
  requisicao<void>(`/comunidade/mural/${encodeURIComponent(postId)}`, { metodo: 'DELETE' });

/** A equipe responde no mural (`COMUNIDADE_MODERAR`); o comentário volta com `daEquipe`. */
export const comentarComoEquipe = (postId: string, texto: string) =>
  requisicao<ComentarioDoMural>(`/comunidade/mural/${encodeURIComponent(postId)}/comentarios`, { metodo: 'POST', corpo: { texto } });

/** Bytes da foto de um post (`TREINO_LER`), com o token. */
export const baixarFotoDoMuralDaEquipe = (id: string) =>
  requisicao<Blob>(`/comunidade/mural/fotos/${encodeURIComponent(id)}`, { binario: true, limiteMs: 30000 });

/** Apaga todas as denúncias do post (204, idempotente); o post continua (`COMUNIDADE_MODERAR`). */
export const dispensarDenuncias = (postId: string) =>
  requisicao<void>(`/comunidade/mural/${encodeURIComponent(postId)}/denuncias/dispensar`, { metodo: 'POST' });

export const obterConfiguracaoDaComunidade = () => requisicao<ConfiguracaoDaComunidade>('/comunidade/configuracao');

/** Os dois campos são obrigatórios (`COMUNIDADE_MODERAR`). */
export const salvarConfiguracaoDaComunidade = (c: ConfiguracaoDaComunidade) =>
  requisicao<ConfiguracaoDaComunidade>('/comunidade/configuracao', { metodo: 'PUT', corpo: c });

// ---- Pods (`COMUNIDADE_MODERAR`; `PodsController`). Erros: `dominio/comunidade.traduzirErroDoPod`. ----

export const listarPods = () => requisicao<PodResumo[]>('/comunidade/pods');

/** 422 `POD_INVALIDO` (campo `nome`), 409 `POD_NOME_EM_USO`. */
export const criarPod = (nome: string) => requisicao<PodResumo>('/comunidade/pods', { metodo: 'POST', corpo: { nome } });

export const renomearPod = (id: string, nome: string) =>
  requisicao<PodResumo>(`/comunidade/pods/${encodeURIComponent(id)}`, { metodo: 'PUT', corpo: { nome } });

/** 204; `podId` nulo tira o aluno do pod. 409 `POD_CHEIO`, `ALUNO_INATIVO`, `ALUNO_ANONIMIZADO` ou `ALUNO_SEM_ACESSO`. */
export const atribuirPod = (alunoId: string, podId: string | null) =>
  requisicao<void>(`/alunos/${encodeURIComponent(alunoId)}/pod`, { metodo: 'PUT', corpo: { podId } });

export const listarComentariosDaEquipe = (alvo: AlvoDosComentarios, n: number) =>
  requisicao<PaginaDeComentarios>(`/comunidade/${comentariosDoAlvo(alvo)}${pagina(n)}`);

/** Moderação (`COMUNIDADE_MODERAR`): 204; 404 = o comentário já não existe. */
export const removerComentario = (tipo: AlvoDosComentarios['tipo'], comentarioId: string) =>
  requisicao<void>(`/comunidade/${DO_ALVO[tipo]}/comentarios/${encodeURIComponent(comentarioId)}`, { metodo: 'DELETE' });

/** Limpa o apelido de um aluno (moderação); ele pode pôr outro depois. */
export const removerApelidoDoAutor = (autorId: string) =>
  requisicao<void>(`/comunidade/perfis/${encodeURIComponent(autorId)}/apelido`, { metodo: 'DELETE' });

/** Reação da equipe (`COMUNIDADE_MODERAR`): as mesmas regras da do aluno. */
export const reagirComoEquipe = (postId: string, codigo: CodigoDeReacao, ligar: boolean) =>
  requisicao<void>(`/comunidade/mural/${encodeURIComponent(postId)}/reacoes/${codigo}`, { metodo: ligar ? 'PUT' : 'DELETE' });

/** Voto da equipe (`TREINO_LER`): as mesmas regras e respostas do voto do aluno. */
export const votarComoEquipe = (postId: string, opcaoIds: string[]) =>
  requisicao<EnqueteDoMural>(`/comunidade/mural/${encodeURIComponent(postId)}/votos`, { metodo: 'PUT', corpo: { opcaoIds } });

export const listarVotosDaEquipe = (postId: string, opcaoId: string | null, n: number) =>
  requisicao<VotosDaEnquete>(`/comunidade/mural/${encodeURIComponent(postId)}/votos${paginaDeVotos(opcaoId, n)}`);

/** Foto de quem votou, vista pela equipe (`TREINO_LER`); fica só em memória, e a falha vira iniciais. */
export const baixarFotoDoVotanteDaEquipe = (autorId: string) =>
  requisicao<Blob>(`/comunidade/perfis/${encodeURIComponent(autorId)}/foto`, { binario: true, limiteMs: 30000 });

/**
 * Capa pendente do vídeo (`COMUNIDADE_MODERAR`): `FormData` com o campo `arquivo` (JPEG já reduzido, `anexarFoto`). Devolve
 * o id que vai em `capaId`. 422 `FOTO_INVALIDA`, `FOTO_GRANDE_DEMAIS` (300 KB) ou `IMAGENS_LIMITE_DIARIO`.
 */
export const enviarCapa = (arquivo: FormData) =>
  requisicao<{ id: string }>('/comunidade/capas', { metodo: 'POST', corpoBruto: arquivo, limiteMs: 60000 });

/**
 * C25: a API busca a miniatura do YouTube a partir do link e devolve o id de uma capa normal (mesma forma de `enviarCapa`);
 * o app nunca fala com o YouTube. 422 `CAPA_INVALIDA` (campo `videoUrl`) e 503 com mensagem neutra.
 */
export const criarCapaDoYoutube = (videoUrl: string) =>
  requisicao<{ id: string }>('/comunidade/capas/youtube', { metodo: 'POST', corpo: { videoUrl }, limiteMs: 30000 });

export const baixarCapaDaEquipe =(id: string) =>
  requisicao<Blob>(`/comunidade/capas/${encodeURIComponent(id)}`, { binario: true, limiteMs: 30000 });
