import { requisicao } from './cliente';
import type { AvisoAulao, Conquista, PostMural, RankingItem } from './comunidadeTipos';

// Seed inicial para demonstração e fallback
const POSTS_INICIAIS: PostMural[] = [
  {
    id: 'post-1',
    autorId: 'treinador-1',
    autorNome: 'Saraiva Team',
    papelAutor: 'TREINADOR',
    conteudo: 'Fala time! Parabéns a todos pelo ritmo forte essa semana. Lembrem-se que amanhã teremos aulão sobre periodização e progressão de cargas às 19h!',
    curtidas: 14,
    curtidoPorMim: false,
    comentariosCount: 5,
    criadoEm: '2026-11-08T18:30:00Z',
  },
  {
    id: 'post-2',
    autorId: 'aluno-1',
    autorNome: 'Carlos Eduardo',
    papelAutor: 'ALUNO',
    conteudo: 'Treino A concluído com sucesso! Bati PR no supino inclinado com halteres hoje. Seguimos no plano! 💪🔥',
    treinoCompartilhado: {
      titulo: 'Treino A · Peito e Tríceps',
      data: '2026-11-09',
      volumeKg: 12450,
      seriesFeitas: 18,
    },
    curtidas: 8,
    curtidoPorMim: true,
    comentariosCount: 2,
    criadoEm: '2026-11-09T10:15:00Z',
  },
];

const AVISOS_INICIAIS: AvisoAulao[] = [
  {
    id: 'aviso-1',
    titulo: 'Aulão Ao Vivo: Estratégias de Sobrecarga Progressiva',
    descricao: 'Como interpretar sua RIR e ajustar os blocos de WS, Feeder e Back-off para hipertrofia máxima.',
    tipo: 'AULAO_AO_VIVO',
    dataHorario: 'Quinta-feira às 19:30 (ao vivo no Zoom)',
    linkAcesso: 'https://zoom.us/j/saraivateam',
    autorNome: 'Saraiva',
    criadoEm: '2026-11-07T14:00:00Z',
  },
  {
    id: 'aviso-2',
    titulo: 'Gravação Disponível: Workshop de Ajuste Dietético',
    descricao: 'A gravação completa do nosso workshop de estratégias nutricionais para queima de gordura já está disponível.',
    tipo: 'WORKSHOP',
    gravacaoUrl: 'https://youtube.com/watch?v=demo',
    autorNome: 'Dr. Igor',
    criadoEm: '2026-11-05T12:00:00Z',
  },
];

const CONQUISTAS_INICIAIS: Conquista[] = [
  {
    id: 'c-1',
    titulo: 'Primeira Vitória',
    descricao: 'Concluiu o primeiro treino completo na plataforma.',
    icone: 'Trophy',
    desbloqueada: true,
    desbloqueadaEm: '2026-10-15',
  },
  {
    id: 'c-2',
    titulo: 'Ritmo Implacável',
    descricao: 'Completou 12 treinos dentro do mesmo mês.',
    icone: 'Flame',
    desbloqueada: true,
    desbloqueadaEm: '2026-11-01',
    progressoAtual: 12,
    progressoMaximo: 12,
  },
  {
    id: 'c-3',
    titulo: 'Mestre da Carga',
    descricao: 'Registrou cargas em todas as séries de trabalho por 4 semanas consecutivas.',
    icone: 'Dumbbell',
    desbloqueada: false,
    progressoAtual: 3,
    progressoMaximo: 4,
  },
  {
    id: 'c-4',
    titulo: 'Hidratação Perfeita',
    descricao: 'Atingiu a meta de água em 7 dias seguidos.',
    icone: 'Droplets',
    desbloqueada: true,
    desbloqueadaEm: '2026-11-08',
    progressoAtual: 7,
    progressoMaximo: 7,
  },
];

const RANKING_INICIAL: RankingItem[] = [
  { posicao: 1, alunoId: 'a1', nome: 'Matheus Fontes', pontos: 1850, nivel: 5, treinosNoMes: 16, diasSeguidos: 6, souEu: false },
  { posicao: 2, alunoId: 'a2', nome: 'Carlos Eduardo', pontos: 1620, nivel: 4, treinosNoMes: 14, diasSeguidos: 4, souEu: true },
  { posicao: 3, alunoId: 'a3', nome: 'Juliana Paes', pontos: 1540, nivel: 4, treinosNoMes: 13, diasSeguidos: 5, souEu: false },
  { posicao: 4, alunoId: 'a4', nome: 'Lucas Silva', pontos: 1280, nivel: 3, treinosNoMes: 11, diasSeguidos: 2, souEu: false },
  { posicao: 5, alunoId: 'a5', nome: 'Beatriz Lima', pontos: 1100, nivel: 3, treinosNoMes: 9, diasSeguidos: 3, souEu: false },
];

let postsLocais = [...POSTS_INICIAIS];
let avisosLocais = [...AVISOS_INICIAIS];

export async function listarPostsMural(): Promise<PostMural[]> {
  try {
    return await requisicao<PostMural[]>('/comunidade/mural');
  } catch {
    return postsLocais;
  }
}

export async function criarPostMural(dados: {
  conteudo: string;
  treinoCompartilhado?: PostMural['treinoCompartilhado'];
  autorNome: string;
  papelAutor?: 'TREINADOR' | 'ALUNO';
}): Promise<PostMural> {
  const novo: PostMural = {
    id: `post-${Date.now()}`,
    autorId: 'eu',
    autorNome: dados.autorNome,
    papelAutor: dados.papelAutor ?? 'ALUNO',
    conteudo: dados.conteudo,
    treinoCompartilhado: dados.treinoCompartilhado ?? null,
    curtidas: 0,
    curtidoPorMim: false,
    comentariosCount: 0,
    criadoEm: new Date().toISOString(),
  };
  try {
    const salvo = await requisicao<PostMural>('/comunidade/mural', { metodo: 'POST', corpo: dados });
    postsLocais = [salvo, ...postsLocais];
    return salvo;
  } catch {
    postsLocais = [novo, ...postsLocais];
    return novo;
  }
}

export async function curtirPostMural(postId: string): Promise<{ curtidas: number; curtidoPorMim: boolean }> {
  try {
    return await requisicao<{ curtidas: number; curtidoPorMim: boolean }>(`/comunidade/mural/${postId}/curtir`, { metodo: 'POST' });
  } catch {
    const post = postsLocais.find((p) => p.id === postId);
    if (post) {
      post.curtidoPorMim = !post.curtidoPorMim;
      post.curtidas += post.curtidoPorMim ? 1 : -1;
      return { curtidas: post.curtidas, curtidoPorMim: post.curtidoPorMim };
    }
    return { curtidas: 1, curtidoPorMim: true };
  }
}

export async function listarAvisosEAuloes(): Promise<AvisoAulao[]> {
  try {
    return await requisicao<AvisoAulao[]>('/comunidade/auloes');
  } catch {
    return avisosLocais;
  }
}

export async function criarAvisoAulao(dados: {
  titulo: string;
  descricao: string;
  tipo: 'AVISO' | 'AULAO_AO_VIVO' | 'WORKSHOP';
  dataHorario?: string | null;
  linkAcesso?: string | null;
  autorNome: string;
}): Promise<AvisoAulao> {
  const novo: AvisoAulao = {
    id: `aviso-${Date.now()}`,
    ...dados,
    criadoEm: new Date().toISOString(),
  };
  try {
    const salvo = await requisicao<AvisoAulao>('/comunidade/auloes', { metodo: 'POST', corpo: dados });
    avisosLocais = [salvo, ...avisosLocais];
    return salvo;
  } catch {
    avisosLocais = [novo, ...avisosLocais];
    return novo;
  }
}

export async function listarRanking(): Promise<RankingItem[]> {
  try {
    return await requisicao<RankingItem[]>('/comunidade/ranking');
  } catch {
    return RANKING_INICIAL;
  }
}

export async function listarMinhasConquistas(): Promise<Conquista[]> {
  try {
    return await requisicao<Conquista[]>('/comunidade/conquistas');
  } catch {
    return CONQUISTAS_INICIAIS;
  }
}
