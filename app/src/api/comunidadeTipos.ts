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

/** Tipo da publicação do mural (`TipoDePost` da API). */
export type TipoDePost = 'AVISO' | 'VIDEO' | 'DUVIDA' | 'RESULTADO' | 'CONVERSA';

/** Motivo de uma denúncia (`MotivoDeDenuncia` da API, lista fechada). */
export type MotivoDeDenuncia = 'OFENSIVO' | 'SPAM' | 'IMPROPRIO' | 'OUTRO';

export interface PostDoMural {
  id: string;
  autorId: string;
  /** Nome e sobrenome; o apelido aparece ao lado, nunca no lugar. */
  autorNome: string;
  /** Apelido atual do aluno autor; nulo se não tem ou se o autor é da equipe. */
  autorApelido: string | null;
  /** `true` só quando o autor é aluno ativo (a API decide): só então o perfil abre; equipe nunca vira link. */
  autorEhAluno: boolean;
  autorFotoUrl: string | null;
  texto: string;
  tipo: TipoDePost;
  /** Link https; só no tipo `VIDEO`. */
  videoUrl: string | null;
  /** Ids das fotos, na ordem (bytes por `baixarFotoDoMural`, com o token). Só posts do aluno têm. */
  fotos: string[];
  /** Só vale em `DUVIDA`: já há comentário da equipe. */
  respondida: boolean;
  fixado: boolean;
  criadoEm: string;
  /** Contagem por emoji. */
  reacoes: Record<string, number>;
  /** Emojis que o usuário da sessão marcou neste post. */
  minhasReacoes: string[];
  totalComentarios: number;
  /** Quantidade de denúncias: só na rota da equipe; o aluno nunca recebe (o campo some). */
  denuncias?: number | null;
}

/** Corpo do `POST` do mural. `tipo` ausente = `CONVERSA`; `videoUrl` só em `VIDEO`; `fotoIds` só do aluno (0 a 4). */
export interface CriarPostRequest {
  tipo?: TipoDePost;
  texto: string;
  videoUrl?: string;
  fotoIds?: string[];
}

/** Chaves da Comunidade da equipe (`GET`/`PUT /comunidade/configuracao`). */
export interface ConfiguracaoDaComunidade { alunosPublicam: boolean; alunosAnexamFotos: boolean }

/** O que o aluno vê (`GET /aluno/comunidade/configuracao`): sem o motivo, que pode ser a idade. */
export interface ConfiguracaoDoAluno { alunosPublicam: boolean; podeAnexarFoto: boolean }

/** Filtros do mural: `tipo` (`undefined` = todos), `busca` livre e, só na equipe, `denunciados`. */
export interface FiltrosDoMural { tipo?: TipoDePost; busca?: string; denunciados?: boolean }

/** Comentário de um post do mural ou de uma aula (`ComentarioResponse`): autor como no post, sem ocultos, mais antigo primeiro. */
export interface ComentarioDoMural {
  id: string;
  autorId: string;
  /** Nome e sobrenome; o apelido aparece ao lado, nunca no lugar. */
  autorNome: string;
  autorApelido: string | null;
  /** `true` só para aluno ativo: só então o perfil abre; equipe e conta encerrada nunca viram link. */
  autorEhAluno: boolean;
  autorFotoUrl: string | null;
  texto: string;
  criadoEm: string;
  /** O autor comentou como equipe (a resposta da dúvida). */
  daEquipe: boolean;
}

/** De onde são os comentários: um post do mural ou uma aula (aulão). */
export interface AlvoDosComentarios { tipo: 'post' | 'aula'; id: string }

/** Uma página dos comentários (`?pagina=&tamanho=`, como `GET /atualizacoes/pagina`); `total` é o do post ou da aula. */
export interface PaginaDeComentarios { itens: ComentarioDoMural[]; total: number }

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

/**
 * Conquista no perfil de um colega: para outro aluno a API manda só `{tipo,titulo,descricao,icone}` (o instante mostraria
 * quando o colega abriu o app); `id` e `conquistadaEm` só vêm no próprio perfil. A tela chaveia por `tipo` e nunca mostra hora.
 */
export type ConquistaDoColega = Omit<ConquistaDoAluno, 'id' | 'conquistadaEm'> & { id?: string; conquistadaEm?: string };

/** Destaque escolhido pelo colega (até 4, já na ordem dele). */
export interface DestaqueDoColega { tipo: string; titulo: string; icone: string }

/** Conquista recente da atividade: só o dia (`AAAA-MM-DD`), nunca a hora. */
export interface ConquistaRecente extends DestaqueDoColega { data: string }

/** Maior carga (kg) de um exercício; nunca data, série nem treino. */
export interface RecordeDoColega { exercicio: string; carga: number }

/**
 * Perfil de um colega (`GET /aluno/comunidade/perfis/{autorId}`, `@JsonInclude(NON_NULL)`). Sempre: `autorId`, `nome`,
 * `apelido`, `ehVoce` e `reservado`. Reservado e visto por outro aluno, só isso; aberto (ou o próprio aluno, que vê tudo),
 * o resto. Nunca contato, peso corporal, medidas, dieta nem saúde.
 */
export interface PerfilDaComunidade {
  autorId: string;
  nome: string;
  apelido: string | null;
  ehVoce: boolean;
  reservado: boolean;
  treinosConcluidos?: number;
  nivel?: number;
  conquistas?: ConquistaDoColega[];
  destaques?: DestaqueDoColega[];
  cor?: string;
  moldura?: string;
  temFoto?: boolean;
  /** `diasTreinadosUltimos30`: `AAAA-MM-DD` de Brasília, de hoje−29 a hoje, sem repetir, do mais antigo ao mais novo. */
  atividade?: { diasTreinadosUltimos30: string[]; ultimasConquistas: ConquistaRecente[] };
  recordes?: RecordeDoColega[];
}

/** Colega na lista (`GET /aluno/comunidade/perfis`): só quem não reservou o perfil. Sem cor nem moldura. */
export interface ColegaDaLista { autorId: string; nome: string; apelido: string | null; nivel: number; temFoto: boolean }

/** Uma página da lista de colegas; `total` conta só os visíveis. */
export interface PaginaDeColegas { itens: ColegaDaLista[]; total: number }

/** Só a posição do próprio aluno: a API nunca manda nome, id ou contagem de outro aluno. */
export interface PosicaoNoRanking {
  posicao: number;
  treinosConcluidos: number;
  pontuacao: number;
  participantes: number;
}

/**
 * Preferências do próprio perfil (`GET`/`PUT /aluno/comunidade/perfil`). `perfilReservado` nulo = o aluno não escolheu (vale o
 * padrão da idade, que a API resolve em `reservadoEfetivo`). `destaques` são `tipo`s de conquista; `cor` e `moldura` vêm
 * sempre preenchidas.
 */
export interface PreferenciasDoPerfil {
  perfilReservado: boolean | null;
  reservadoEfetivo: boolean;
  destaques: string[];
  cor: string;
  moldura: string;
  opcoesDeDestaque: ConquistaDoAluno[];
}
