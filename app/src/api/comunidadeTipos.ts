/**
 * Tipos da Comunidade, Aulões & Gamificação (C81 / N45).
 */

export interface PostMural {
  id: string;
  autorId: string;
  autorNome: string;
  autorFotoUrl?: string | null;
  papelAutor: 'TREINADOR' | 'ALUNO';
  conteudo: string;
  treinoCompartilhado?: {
    titulo: string;
    data: string;
    volumeKg?: number | null;
    seriesFeitas?: number | null;
  } | null;
  curtidas: number;
  curtidoPorMim: boolean;
  comentariosCount: number;
  criadoEm: string;
}

export interface AvisoAulao {
  id: string;
  titulo: string;
  descricao: string;
  tipo: 'AVISO' | 'AULAO_AO_VIVO' | 'WORKSHOP';
  dataHorario?: string | null;
  linkAcesso?: string | null;
  gravacaoUrl?: string | null;
  autorNome: string;
  criadoEm: string;
}

export interface Conquista {
  id: string;
  titulo: string;
  descricao: string;
  icone: string;
  desbloqueada: boolean;
  desbloqueadaEm?: string | null;
  progressoAtual?: number;
  progressoMaximo?: number;
}

export interface RankingItem {
  posicao: number;
  alunoId: string;
  nome: string;
  fotoUrl?: string | null;
  pontos: number;
  nivel: number;
  treinosNoMes: number;
  diasSeguidos: number;
  souEu: boolean;
}
