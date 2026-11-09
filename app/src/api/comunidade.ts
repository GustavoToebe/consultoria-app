import { requisicao } from './cliente';
import type {
  AulaDaComunidade, ConquistaDoAluno, NovaAula, PaginaDoMural, PosicaoNoRanking, PostDoMural,
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

export const listarMinhasConquistas = () => requisicao<ConquistaDoAluno[]>('/aluno/comunidade/conquistas');

export const obterMeuRanking = () => requisicao<PosicaoNoRanking>('/aluno/comunidade/ranking');

// ---- Equipe (TREINO_LER para ler, TREINO_ALTERAR para publicar) ----

export const listarAulasDaEquipe = () => requisicao<AulaDaComunidade[]>('/comunidade/aulas');

export const criarAula = (aula: NovaAula) => requisicao<AulaDaComunidade>('/comunidade/aulas', { metodo: 'POST', corpo: aula });

export const listarMuralDaEquipe = () => requisicao<PaginaDoMural>(`/comunidade/mural${PAGINA_DO_MURAL}`);

export const publicarNoMuralDaEquipe = (texto: string) =>
  requisicao<PostDoMural>('/comunidade/mural', { metodo: 'POST', corpo: { texto } });
