import { requisicao } from './cliente';
import type {
  AulaDaComunidade, ComentarioDoMural, ConquistaDoAluno, NovaAula, PaginaDoMural, PerfilDaComunidade, PosicaoNoRanking, PostDoMural,
} from './comunidadeTipos';

// Rotas reais da API (`AlunoComunidadeController` e `ComunidadeController`). Erro é erro: a tela mostra o aviso com
// "Tentar de novo"; nenhum dado de exemplo entra no lugar de uma resposta.

// shortcut: só a página mais recente do mural (50, o teto da API), sem "ver mais"; trocar por paginação quando o mural passar disso.
const PAGINA_DO_MURAL = '?pagina=0&tamanho=50';

// ---- Aluno ----

export const listarAulasDoAluno = () => requisicao<AulaDaComunidade[]>('/aluno/comunidade/aulas');

export const listarMuralDoAluno = () => requisicao<PaginaDoMural>(`/aluno/comunidade/mural${PAGINA_DO_MURAL}`);

export const publicarNoMuralDoAluno = (texto: string) =>
  requisicao<PostDoMural>('/aluno/comunidade/mural', { metodo: 'POST', corpo: { texto } });

/** Liga ou desliga a reação do aluno (a API alterna; responde 204). */
export const alternarReacaoDoAluno = (postId: string, emoji: string) =>
  requisicao<void>(`/aluno/comunidade/mural/${postId}/reacoes`, { metodo: 'POST', corpo: { emoji } });

/** 404 se o post não está ao alcance (outra consultoria ou oculto). */
export const listarComentariosDoMural = (postId: string) =>
  requisicao<ComentarioDoMural[]>(`/aluno/comunidade/mural/${encodeURIComponent(postId)}/comentarios`);

/** A API faz o trim e confere 1 a 2000 caracteres; passa pelo limite de 120 por hora (429 `LOGIN_LIMITADO`). */
export const comentarMural = (postId: string, texto: string) =>
  requisicao<ComentarioDoMural>(`/aluno/comunidade/mural/${encodeURIComponent(postId)}/comentarios`, { metodo: 'POST', corpo: { texto } });

export const listarMinhasConquistas = () => requisicao<ConquistaDoAluno[]>('/aluno/comunidade/conquistas');

export const obterMeuRanking = () => requisicao<PosicaoNoRanking>('/aluno/comunidade/ranking');

/** 404 para qualquer autor fora do alcance (equipe, outra consultoria, anonimizado). */
export const obterPerfilDaComunidade = (autorId: string) =>
  requisicao<PerfilDaComunidade>(`/aluno/comunidade/perfis/${encodeURIComponent(autorId)}`);

/** `null` apaga. 422 com o erro no campo `apelido`; o apelido nunca fica no aparelho. */
export const definirMeuApelido = (apelido: string | null) =>
  requisicao<void>('/aluno/comunidade/apelido', { metodo: 'PUT', corpo: { apelido } });

// ---- Equipe (TREINO_LER para ler, COMUNIDADE_MODERAR para publicar e moderar) ----

export const listarAulasDaEquipe = () => requisicao<AulaDaComunidade[]>('/comunidade/aulas');

export const criarAula = (aula: NovaAula) => requisicao<AulaDaComunidade>('/comunidade/aulas', { metodo: 'POST', corpo: aula });

export const listarMuralDaEquipe = () => requisicao<PaginaDoMural>(`/comunidade/mural${PAGINA_DO_MURAL}`);

export const publicarNoMuralDaEquipe = (texto: string) =>
  requisicao<PostDoMural>('/comunidade/mural', { metodo: 'POST', corpo: { texto } });

export const listarComentariosDoMuralEquipe = (postId: string) =>
  requisicao<ComentarioDoMural[]>(`/comunidade/mural/${encodeURIComponent(postId)}/comentarios`);

/** Moderação (`COMUNIDADE_MODERAR`): 204; 404 = o comentário já não existe. A equipe não comenta no mural. */
export const removerComentarioDoMural = (comentarioId: string) =>
  requisicao<void>(`/comunidade/mural/comentarios/${encodeURIComponent(comentarioId)}`, { metodo: 'DELETE' });

/** Limpa o apelido de um aluno (moderação); ele pode pôr outro depois. */
export const removerApelidoDoAutor = (autorId: string) =>
  requisicao<void>(`/comunidade/perfis/${encodeURIComponent(autorId)}/apelido`, { metodo: 'DELETE' });
