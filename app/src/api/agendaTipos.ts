/** Espelho dos DTOs de `agenda/AgendaDtos` da API (agenda presencial do consultório). */
export type SituacaoCompromisso = 'AGENDADO' | 'REALIZADO' | 'CANCELADO' | 'FALTOU';

/** Até onde uma edição, um cancelamento ou a situação de um aluno vale numa série (`?escopo=`; padrão da API: `ESTA`). */
export type EscopoDaSerie = 'ESTA' | 'SEGUINTES' | 'TODAS';

/** Como a série se repete. Sem "nunca": o fim é obrigatório. */
export type TipoDeRepeticao = 'DIARIA' | 'SEMANAL' | 'MENSAL' | 'ANUAL' | 'DIAS_UTEIS';

/** Nomes de `java.time.DayOfWeek` em texto (nunca número: o Jackson leria 1 como o ordinal do enum). */
export type DiaDaSemana = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

/** Um aluno do compromisso para a equipe: `id` é o do aluno (é o da rota da situação dele). */
export interface Participante {
  id: string;
  nome: string | null;
  situacao: SituacaoCompromisso;
}

/**
 * Um compromisso para a equipe. `data`, `hora` e `horaFim` são de Brasília; `inicio`/`fim`, instantes ISO. A situação de
 * cada aluno está em `participantes`; `cancelado` é o compromisso inteiro (todos os participantes cancelados). Numa série,
 * `serieId` liga as ocorrências, `ocorrenciaDaSerie` é a posição desta (1 a N, contando as canceladas) e `totalDaSerie` é N;
 * os três são nulos no compromisso avulso.
 */
export interface Compromisso {
  id: string;
  responsavelId: string | null;
  responsavelNome: string | null;
  inicio: string;
  fim: string;
  data: string;
  hora: string;
  horaFim: string;
  duracaoMinutos: number;
  local: string | null;
  /** Nula sem `ALUNO_SENSIVEL_LER` (dado sensível). */
  observacao: string | null;
  cancelado: boolean;
  participantes: Participante[];
  versao: number;
  serieId: string | null;
  ocorrenciaDaSerie: number | null;
  totalDaSerie: number | null;
}

/**
 * Repetição de um compromisso novo (só ao criar; ao remarcar a API recusa). Exatamente um de `ate` (AAAA-MM-DD, inclusive)
 * ou `vezes` (2 a 52, a primeira conta). `diasDaSemana` só em `SEMANAL`.
 */
export interface Repeticao {
  tipo: TipoDeRepeticao;
  diasDaSemana?: DiaDaSemana[] | null;
  ate?: string | null;
  vezes?: number | null;
}

/**
 * Marcar ou remarcar: `alunoIds` é a lista inteira de participantes (1 a 20, sem repetir); `data` (AAAA-MM-DD) e `hora`
 * (HH:MM) de Brasília. `versao` só ao remarcar; `repeticao` só ao marcar.
 */
export interface CompromissoRequest {
  alunoIds: string[];
  responsavelId: string;
  data: string;
  hora: string;
  duracaoMinutos: number;
  local: string | null;
  observacao: string | null;
  versao?: number;
  repeticao?: Repeticao | null;
}

/** Cancelar o compromisso inteiro (`true`) ou reabri-lo (`false`). */
export interface CancelamentoRequest {
  cancelado: boolean;
  versao: number;
}

/** A situação de um participante: realizado e falta só depois do início do compromisso. */
export interface SituacaoDoAlunoRequest {
  situacao: SituacaoCompromisso;
  versao: number;
}

/** Aluno que já tem outro compromisso sobreposto (só aviso): id e nome, sem horário nem observação do outro. */
export interface AlunoOcupado {
  id: string;
  nome: string | null;
}

/** O que o aluno vê: a situação DELE, sem observação, sem participantes e sem ids da equipe. */
export interface CompromissoDoAluno {
  id: string;
  inicio: string;
  fim: string;
  data: string;
  hora: string;
  horaFim: string;
  duracaoMinutos: number;
  local: string | null;
  situacao: SituacaoCompromisso;
  responsavelNome: string | null;
}

export type TipoAvisoCompromisso = 'NOVO' | 'REMARCADO' | 'CANCELADO';

/**
 * Aviso de compromisso do aluno (não visto): `inicio` e `responsavelNome` são a cópia do momento do aviso;
 * `responsavelNome` nulo = "a equipe". Sem observação, local nem nome de outro aluno.
 */
export interface AvisoDeCompromisso {
  id: string;
  tipo: TipoAvisoCompromisso;
  inicio: string;
  responsavelNome: string | null;
}

export interface FiltroCompromissos {
  de: string;
  ate: string;
  responsavel?: string | null;
  situacao?: SituacaoCompromisso | null;
}

/** Aviso de aluno ocupado: `ignorar` é o próprio compromisso, ao remarcar. */
export interface FiltroAlunosOcupados {
  data: string;
  hora: string;
  duracaoMinutos: number;
  alunoIds: readonly string[];
  ignorar?: string | null;
}

/**
 * Códigos de erro (`codigo`) da agenda de compromissos. 400: `ALUNOS_INVALIDOS`, `ALUNOS_REPETIDOS`, `REPETICAO_INVALIDA`,
 * `SERIE_GRANDE_DEMAIS`, `REPETICAO_SO_AO_CRIAR`, `DATA_SO_NESTA_OCORRENCIA`, `SITUACAO_SO_NESTA_OCORRENCIA`,
 * `COMPROMISSO_SEM_SERIE`, `PERIODO_INVALIDO`. 409: `HORARIO_OCUPADO` (com `fieldErrors` `datasEmConflito`, uma data
 * AAAA-MM-DD por item), `COMPROMISSO_NO_FUTURO`, `SERIE_SEM_OCORRENCIAS`, `ALUNO_INATIVO`, `ALUNO_ANONIMIZADO`,
 * `CONFLITO_EDICAO`.
 */
export type CodigoDeErroDaAgenda =
  | 'ALUNOS_INVALIDOS' | 'ALUNOS_REPETIDOS' | 'REPETICAO_INVALIDA' | 'SERIE_GRANDE_DEMAIS' | 'REPETICAO_SO_AO_CRIAR'
  | 'DATA_SO_NESTA_OCORRENCIA' | 'SITUACAO_SO_NESTA_OCORRENCIA' | 'COMPROMISSO_SEM_SERIE' | 'PERIODO_INVALIDO'
  | 'HORARIO_OCUPADO' | 'COMPROMISSO_NO_FUTURO' | 'SERIE_SEM_OCORRENCIAS' | 'ALUNO_INATIVO' | 'ALUNO_ANONIMIZADO'
  | 'CONFLITO_EDICAO';

// ---- Calendário: agendas pessoais e eventos sem aluno (`agenda/AgendaCalendarioDtos`) ----

/** Chaves da paleta fixa das agendas (D7); o app tem o par claro e escuro de cada uma em `tema/tokens` (`PALETA_DA_AGENDA`). */
export type CorDaAgenda = 'AZUL' | 'INDIGO' | 'VIOLETA' | 'MAGENTA' | 'TURQUESA' | 'ARDOSIA' | 'TERRA' | 'OLIVA';

/** Uma agenda pessoal (só do dono). `versao` vai de volta ao renomear, recolorir e apagar. */
export interface AgendaPessoal {
  id: string;
  nome: string;
  cor: CorDaAgenda;
  versao: number;
}

/** Criar (sem `versao`) ou renomear/recolorir (com `versao`). */
export interface AgendaPessoalRequest {
  nome: string;
  cor: CorDaAgenda;
  versao?: number;
}

/** Quantos eventos (séries) a agenda tem: o número da confirmação de apagar. */
export interface ContagemDaAgenda {
  eventos: number;
}

/** Como o evento se repete. `NENHUMA` = avulso. */
export type TipoDeRepeticaoDeEvento = TipoDeRepeticao | 'NENHUMA';

/**
 * Repetição de um evento. Ao contrário do compromisso, o fim é opcional e no máximo um dos dois: `ate` (inclusive) ou
 * `vezes` (2 a 999, a primeira conta); sem nenhum, nunca termina. `diasDaSemana` só em `SEMANAL`.
 */
export interface RepeticaoDeEvento {
  tipo: TipoDeRepeticaoDeEvento;
  diasDaSemana?: DiaDaSemana[] | null;
  ate?: string | null;
  vezes?: number | null;
}

/**
 * Criar ou alterar um evento. Dia inteiro ignora `hora` e `duracaoMinutos`; senão os dois são obrigatórios (hora de
 * Brasília, duração de 5 a 1440). `versao` só no PUT. Evento avulso: `repeticao` nula.
 */
export interface EventoRequest {
  agendaId: string;
  titulo: string;
  local: string | null;
  descricao: string | null;
  /** AAAA-MM-DD. */
  data: string;
  diaInteiro: boolean;
  /** HH:MM; nula no dia inteiro. */
  hora: string | null;
  duracaoMinutos: number | null;
  repeticao: RepeticaoDeEvento | null;
  versao?: number;
}

/**
 * Pergunta de leitura do aviso "este evento cruza outro seu?" (`POST /agenda/eventos/cruzamentos`): o horário e a repetição do
 * formulário, sem título, local, descrição nem agenda. `eventoId` (na edição) é o próprio evento: nenhuma ocorrência dele conta.
 * Dia inteiro responde zero. Nunca grava nem bloqueia o salvar.
 */
export interface CruzamentoRequest {
  eventoId?: string | null;
  /** AAAA-MM-DD. */
  data: string;
  diaInteiro: boolean;
  /** HH:MM; nula no dia inteiro. */
  hora: string | null;
  duracaoMinutos: number | null;
  repeticao: RepeticaoDeEvento | null;
}

/**
 * Quantas ocorrências do evento pedido, do primeiro dia a um ano depois (inclusive), cruzam outro evento pessoal do membro ou um
 * compromisso dele (não cancelado, em que ele é o responsável; só o horário conta), e as primeiras (até 5) datas (AAAA-MM-DD,
 * em ordem). Nunca traz texto de outro evento nem dado de compromisso (aluno, local, observação, id). `incompleto`: a conta bateu
 * num teto de segurança e pode ser maior.
 */
export interface CruzamentoDeEvento {
  quantidade: number;
  datas: string[];
  incompleto: boolean;
}

/**
 * Uma ocorrência já expandida pela API (nunca o app). `dataOriginal` é o dia da regra (a chave de `?ocorrencia=`);
 * `data` é onde ela cai hoje (difere se foi movida). Dia inteiro: `hora` e `horaFim` nulos e `inicio`/`fim` são o começo do
 * dia e o do dia seguinte em Brasília.
 */
export interface OcorrenciaDeEvento {
  eventoId: string;
  agendaId: string;
  dataOriginal: string;
  data: string;
  hora: string | null;
  horaFim: string | null;
  inicio: string;
  fim: string;
  diaInteiro: boolean;
  titulo: string;
  local: string | null;
  descricao: string | null;
  recorrente: boolean;
}

/** O evento (a regra) e, em `ocorrencia`, a pedida (ou a primeira); nula se essa foi cancelada. */
export interface EventoDetalhe {
  id: string;
  agendaId: string;
  titulo: string;
  local: string | null;
  descricao: string | null;
  /** O primeiro dia da regra. */
  data: string;
  diaInteiro: boolean;
  hora: string | null;
  duracaoMinutos: number | null;
  /** Nula no evento avulso. */
  repeticao: RepeticaoDeEvento | null;
  versao: number;
  ocorrencia: OcorrenciaDeEvento | null;
}

/** Um dia do resumo do Ano: só contagens. Dias sem nada não aparecem. */
export interface DiaDoResumo {
  data: string;
  compromissos: number;
  eventos: number;
}

export interface ResumoDaAgenda {
  dias: DiaDoResumo[];
}

/** Eventos do período: `agendas` filtra (vazio ou ausente = todas as minhas). */
export interface FiltroEventos {
  de: string;
  ate: string;
  agendas?: readonly string[] | null;
}

/** Resumo do Ano (até 366 dias): `responsavel`, `situacao` e `agendas` filtram como nas listagens. */
export interface FiltroResumo {
  de: string;
  ate: string;
  responsavel?: string | null;
  situacao?: SituacaoCompromisso | null;
  agendas?: readonly string[] | null;
}

/** Recortes novos de `GET /atualizacoes` (D14, D19): `de`/`ate` juntos (até 366 dias); `responsavel` não vale com `meus`. */
export interface FiltroAtualizacoes {
  /** Um id ou vários (ids de membros e/ou `nenhum`). */
  responsavel?: string | readonly string[] | null;
  /** Nome do aluno (a API ignora acento e caixa). */
  busca?: string | null;
  de?: string | null;
  ate?: string | null;
}

/** Em qual ocorrência de uma série o PUT e o DELETE agem: o `escopo` e, em `ESTA`/`SEGUINTES`, o `dataOriginal`. */
export interface AlvoDoEvento {
  escopo?: EscopoDaSerie;
  /** `dataOriginal` (AAAA-MM-DD) da ocorrência aberta. */
  ocorrencia?: string | null;
}

/**
 * Códigos de erro (`codigo`) das agendas pessoais e dos eventos. 400: `AGENDA_INVALIDA` (nome), `COR_INVALIDA`,
 * `EVENTO_INVALIDO`, `REPETICAO_INVALIDA`, `EVENTO_SEM_SERIE`, `OCORRENCIA_OBRIGATORIA`, `DATA_SO_NESTA_OCORRENCIA`,
 * `AGENDA_SO_NA_SERIE_TODA`, `PERIODO_INVALIDO`, `FILTRO_INVALIDO` (`meus` junto de `responsavel`). 409:
 * `LIMITE_DE_AGENDAS`, `AGENDA_NOME_EM_USO`, `LIMITE_DE_EVENTOS`, `CONFLITO_EDICAO`.
 */
export type CodigoDeErroDoCalendario =
  | 'AGENDA_INVALIDA' | 'COR_INVALIDA' | 'EVENTO_INVALIDO' | 'REPETICAO_INVALIDA' | 'EVENTO_SEM_SERIE'
  | 'OCORRENCIA_OBRIGATORIA' | 'DATA_SO_NESTA_OCORRENCIA' | 'AGENDA_SO_NA_SERIE_TODA' | 'PERIODO_INVALIDO'
  | 'FILTRO_INVALIDO' | 'LIMITE_DE_AGENDAS' | 'AGENDA_NOME_EM_USO' | 'LIMITE_DE_EVENTOS' | 'CONFLITO_EDICAO';
