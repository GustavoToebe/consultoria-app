import { COMENTARIOS_POR_PAGINA } from '../dominio/comunidade';
import type { CorpoDoPerfil } from '../dominio/perfilDaComunidade';
import { COLEGAS_POR_PAGINA } from '../dominio/perfilDoColega';
import { requisicao } from './cliente';
import type {
  AlvoDosComentarios, AulaDaComunidade, ComentarioDoMural, ConfiguracaoDaComunidade, ConfiguracaoDoAluno, ConquistaDoAluno,
  CriarPostRequest, FiltrosDoMural, MotivoDeDenuncia, NovaAula, PaginaDeColegas, PaginaDeComentarios, PaginaDoMural,
  PerfilDaComunidade, PosicaoNoRanking, PostDoMural, PreferenciasDoPerfil,
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
  ].join('');
};

const comBusca =(caminho: string, busca?: string): string => {
  const b = busca?.trim();
  return b ? `${caminho}?busca=${encodeURIComponent(b)}` : caminho;
};

// ---- Aluno ----

export const listarAulasDoAluno = (busca?: string) => requisicao<AulaDaComunidade[]>(comBusca('/aluno/comunidade/aulas', busca));

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

/** Liga ou desliga a reação do aluno (a API alterna; responde 204). */
export const alternarReacaoDoAluno = (postId: string, emoji: string) =>
  requisicao<void>(`/aluno/comunidade/mural/${postId}/reacoes`, { metodo: 'POST', corpo: { emoji } });

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

/** Preferências do próprio perfil. O PUT substitui as quatro: mande sempre todas (`dominio/perfilDaComunidade.corpoDoPerfil`). */
export const meuPerfilDaComunidade = () => requisicao<PreferenciasDoPerfil>('/aluno/comunidade/perfil');

export const salvarMeuPerfilDaComunidade = (corpo: CorpoDoPerfil) =>
  requisicao<PreferenciasDoPerfil>('/aluno/comunidade/perfil', { metodo: 'PUT', corpo });

// ---- Equipe (TREINO_LER para ler, COMUNIDADE_MODERAR para publicar e moderar) ----

export const listarAulasDaEquipe = (busca?: string) => requisicao<AulaDaComunidade[]>(comBusca('/comunidade/aulas', busca));

export const criarAula = (aula: NovaAula) => requisicao<AulaDaComunidade>('/comunidade/aulas', { metodo: 'POST', corpo: aula });

export const listarMuralDaEquipe = (filtros?: FiltrosDoMural) =>
  requisicao<PaginaDoMural>(`/comunidade/mural${PAGINA_DO_MURAL}${filtrosDoMural(filtros, true)}`);

/** Equipe (`COMUNIDADE_MODERAR`): todos os tipos, sem fotos; `VIDEO` exige `videoUrl` https; `AVISO` nasce fixado. 422 `POST_INVALIDO`. */
export const publicarNoMuralDaEquipe = (post: CriarPostRequest) =>
  requisicao<PostDoMural>('/comunidade/mural', { metodo: 'POST', corpo: post });

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

export const listarComentariosDaEquipe = (alvo: AlvoDosComentarios, n: number) =>
  requisicao<PaginaDeComentarios>(`/comunidade/${comentariosDoAlvo(alvo)}${pagina(n)}`);

/** Moderação (`COMUNIDADE_MODERAR`): 204; 404 = o comentário já não existe. */
export const removerComentario = (tipo: AlvoDosComentarios['tipo'], comentarioId: string) =>
  requisicao<void>(`/comunidade/${DO_ALVO[tipo]}/comentarios/${encodeURIComponent(comentarioId)}`, { metodo: 'DELETE' });

/** Limpa o apelido de um aluno (moderação); ele pode pôr outro depois. */
export const removerApelidoDoAutor = (autorId: string) =>
  requisicao<void>(`/comunidade/perfis/${encodeURIComponent(autorId)}/apelido`, { metodo: 'DELETE' });
