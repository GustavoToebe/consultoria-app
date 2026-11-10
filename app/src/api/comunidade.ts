import { COMENTARIOS_POR_PAGINA } from '../dominio/comunidade';
import type { CorpoDoPerfil } from '../dominio/perfilDaComunidade';
import { COLEGAS_POR_PAGINA } from '../dominio/perfilDoColega';
import { requisicao } from './cliente';
import type {
  AlvoDosComentarios, AulaDaComunidade, ComentarioDoMural, ConquistaDoAluno, NovaAula, PaginaDeColegas, PaginaDeComentarios, PaginaDoMural,
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

// ---- Aluno ----

export const listarAulasDoAluno = () => requisicao<AulaDaComunidade[]>('/aluno/comunidade/aulas');

export const listarMuralDoAluno = () => requisicao<PaginaDoMural>(`/aluno/comunidade/mural${PAGINA_DO_MURAL}`);

export const publicarNoMuralDoAluno = (texto: string) =>
  requisicao<PostDoMural>('/aluno/comunidade/mural', { metodo: 'POST', corpo: { texto } });

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

export const listarAulasDaEquipe = () => requisicao<AulaDaComunidade[]>('/comunidade/aulas');

export const criarAula = (aula: NovaAula) => requisicao<AulaDaComunidade>('/comunidade/aulas', { metodo: 'POST', corpo: aula });

export const listarMuralDaEquipe = () => requisicao<PaginaDoMural>(`/comunidade/mural${PAGINA_DO_MURAL}`);

export const publicarNoMuralDaEquipe = (texto: string) =>
  requisicao<PostDoMural>('/comunidade/mural', { metodo: 'POST', corpo: { texto } });

export const listarComentariosDaEquipe = (alvo: AlvoDosComentarios, n: number) =>
  requisicao<PaginaDeComentarios>(`/comunidade/${comentariosDoAlvo(alvo)}${pagina(n)}`);

/** Moderação (`COMUNIDADE_MODERAR`): 204; 404 = o comentário já não existe. A equipe não comenta (nem no mural, nem na aula). */
export const removerComentario = (tipo: AlvoDosComentarios['tipo'], comentarioId: string) =>
  requisicao<void>(`/comunidade/${DO_ALVO[tipo]}/comentarios/${encodeURIComponent(comentarioId)}`, { metodo: 'DELETE' });

/** Limpa o apelido de um aluno (moderação); ele pode pôr outro depois. */
export const removerApelidoDoAutor = (autorId: string) =>
  requisicao<void>(`/comunidade/perfis/${encodeURIComponent(autorId)}/apelido`, { metodo: 'DELETE' });
