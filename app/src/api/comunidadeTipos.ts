/**
 * Tipos da Comunidade (aulões, mural, conquistas e ranking): espelham `comunidade/dto/ComunidadeDtos.java` da API.
 */

export interface AulaDaComunidade {
  id: string;
  titulo: string;
  descricao: string | null;
  /** Link https do vídeo; a API já omite o que não passa na regra de links. */
  videoUrl: string | null;
  /** Capa enviada pela equipe (bytes por `baixarCapa*`, com o token); nula = sem capa. */
  capaId: string | null;
  categoria: string | null;
  ordem: number;
  publicada: boolean;
  criadaEm: string;
  totalComentarios: number;
}

/**
 * Corpo do `POST` e do `PUT /comunidade/aulas[/{id}]` (`CriarAulaRequest`). O `PUT` substitui tudo: campo ausente vira
 * nulo, `ordem` ausente vira 0 e `publicada` ausente vira `true`; por isso a edição manda os sete (`dominio/comunidade.corpoDaAula`).
 */
export interface NovaAula {
  titulo: string;
  descricao?: string | null;
  videoUrl: string;
  /** Até 60 depois da normalização do servidor (espaços nas pontas e repetidos saem; vazio vira nulo). */
  categoria?: string | null;
  ordem?: number;
  publicada?: boolean;
  /** Id de `POST /comunidade/capas`. No `PUT`, ausente ou nulo REMOVE a capa: a edição manda sempre a do rascunho. */
  capaId?: string | null;
}

/** Tipo da publicação do mural (`TipoDePost` da API). */
export type TipoDePost = 'AVISO' | 'VIDEO' | 'DUVIDA' | 'RESULTADO' | 'CONVERSA' | 'ENQUETE';

/** Reação por código (D6, lista fechada da API); o emoji é só desenho no app (`dominio/comunidade.REACOES`). */
export type CodigoDeReacao = 'CURTIR' | 'FORCA' | 'FOGO' | 'PALMAS' | 'RISO';

/** Votante da amostra do cartão (até 3, mais recentes primeiro); `apelido` só vem quando existe. */
export interface VotanteDaAmostra { autorId: string; nome: string; apelido?: string; temFoto: boolean }

export interface OpcaoDaEnquete { id: string; texto: string; votos: number; votantesAmostra: VotanteDaAmostra[] }

/**
 * Enquete do post `ENQUETE` (`EnqueteResponse`). `encerrada` já considera `encerraEm`; `participantes` são pessoas distintas
 * (não a soma dos votos); `meusVotos` são as opções do usuário da sessão. Sem total de elegíveis.
 */
export interface EnqueteDoMural {
  variasRespostas: boolean;
  encerrada: boolean;
  encerraEm: string | null;
  opcoes: OpcaoDaEnquete[];
  meusVotos: string[];
  participantes: number;
}

/** Uma linha por voto, mais recente primeiro; `ehVoce` = o próprio usuário (a tela escreve "Você"). */
export interface VotanteDaEnquete {
  autorId: string;
  opcaoId: string;
  nome: string;
  apelido?: string;
  temFoto: boolean;
  votadoEm: string;
  ehVoce: boolean;
}

/** "Mostrar votos" (`GET .../mural/{id}/votos`): `votantes.total` conta os votos do filtro, não os participantes. */
export interface VotosDaEnquete {
  pergunta: string;
  participantes: number;
  opcoes: { opcaoId: string; texto: string; votos: number }[];
  votantes: { total: number; itens: VotanteDaEnquete[] };
}

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
  /** Capa do vídeo enviada pela equipe; nula fora do `VIDEO` ou sem capa. */
  capaId: string | null;
  /** Ids das fotos, na ordem (bytes por `baixarFotoDoMural`, com o token). Só posts do aluno têm. */
  fotos: string[];
  /** Só no tipo `ENQUETE` (a pergunta é o `texto`); nula nos outros. */
  enquete: EnqueteDoMural | null;
  /** Só vale em `DUVIDA`: já há comentário da equipe. */
  respondida: boolean;
  fixado: boolean;
  criadoEm: string;
  /** Contagem por código (código sem reação pode faltar). */
  reacoes: Partial<Record<CodigoDeReacao, number>>;
  /** Pod do post; nulo = mural geral (`podNome` vem junto). */
  podId: string | null;
  podNome: string | null;
  /** Códigos que o usuário da sessão marcou neste post. */
  minhasReacoes: CodigoDeReacao[];
  totalComentarios: number;
  /** Quantidade de denúncias: só na rota da equipe; o aluno nunca recebe (o campo some). */
  denuncias?: number | null;
}

/**
 * Corpo do `POST` do mural. `tipo` ausente = `CONVERSA`; `videoUrl` e `capaId` só em `VIDEO`; `fotoIds` do aluno e da equipe (0 a 4, enviadas antes pela rota do papel);
 * `opcoes`, `variasRespostas` e `encerraEm` só em `ENQUETE` (da equipe).
 */
export interface CriarPostRequest {
  tipo?: TipoDePost;
  texto: string;
  videoUrl?: string;
  fotoIds?: string[];
  capaId?: string;
  opcoes?: string[];
  variasRespostas?: boolean;
  /** Instante ISO futuro, no máximo 1 ano à frente; ausente = sem prazo. */
  encerraEm?: string;
  /** Publica no pod (o aluno só no próprio; a API confere no banco); ausente = mural geral. */
  podId?: string;
}

/** Pod da comunidade (`PodResumo`): `membros` é contagem e `temMenor` só diz se algum nasceu há menos de 18 anos; nunca lista de gente. */
export interface PodResumo { id: string; nome: string; membros: number; temMenor: boolean; criadoEm: string }

/** O pod do próprio aluno (`PodDoAluno`): só id e nome. */
export interface PodDoAluno { id: string; nome: string }

/** Chaves da Comunidade da equipe (`GET`/`PUT /comunidade/configuracao`). */
export interface ConfiguracaoDaComunidade { alunosPublicam: boolean; alunosAnexamFotos: boolean }

/** O que o aluno vê (`GET /aluno/comunidade/configuracao`): sem o motivo, que pode ser a idade. */
export interface ConfiguracaoDoAluno { alunosPublicam: boolean; podeAnexarFoto: boolean; pod: PodDoAluno | null }

/**
 * Filtros do mural: `tipo` (`undefined` = todos), `busca` livre, só na equipe `denunciados` e `podId` (ausente = mural geral;
 * o aluno só pede o próprio pod, senão 404).
 */
export interface FiltrosDoMural { tipo?: TipoDePost; busca?: string; denunciados?: boolean; podId?: string }

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

/**
 * Só a posição do próprio aluno: a API nunca manda nome, id ou contagem de outro aluno. Os quatro últimos são o XP dele
 * (`dominio/xp.ts`): `xpNoNivel` (0 a 99) e `faltam` (1 a 100) desenham a barra até o próximo nível. A tela nunca mostra `xp`.
 */
export interface PosicaoNoRanking {
  posicao: number;
  treinosConcluidos: number;
  pontuacao: number;
  participantes: number;
  nivel: number;
  xp: number;
  xpNoNivel: number;
  faltam: number;
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
