/**
 * Tipos da Comunidade (aulões, mural, conquistas e ranking): espelham `comunidade/dto/ComunidadeDtos.java` da API.
 */

export interface AulaDaComunidade {
  id: string;
  titulo: string;
  descricao: string | null;
  /** Link https do vídeo; a API já omite o que não passa na regra de links. */
  videoUrl: string | null;
  miniaturaUrl: string | null;
  categoria: string | null;
  ordem: number;
  publicada: boolean;
  criadaEm: string;
  totalComentarios: number;
}

export interface NovaAula {
  titulo: string;
  descricao?: string;
  videoUrl: string;
  categoria?: string;
}

export interface PostDoMural {
  id: string;
  autorId: string;
  autorNome: string;
  autorFotoUrl: string | null;
  texto: string;
  imagemUrl: string | null;
  fixado: boolean;
  criadoEm: string;
  /** Contagem por emoji. */
  reacoes: Record<string, number>;
  /** Emojis que o usuário da sessão marcou neste post. */
  minhasReacoes: string[];
  totalComentarios: number;
}

/** Página do Spring (`Page`): só o que o app usa. */
export interface PaginaDoMural {
  content: PostDoMural[];
  totalElements: number;
}

export interface ConquistaDoAluno {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  icone: string;
  conquistadaEm: string;
}

/** Só a posição do próprio aluno: a API nunca manda nome, id ou contagem de outro aluno. */
export interface PosicaoNoRanking {
  posicao: number;
  treinosConcluidos: number;
  pontuacao: number;
  participantes: number;
}
