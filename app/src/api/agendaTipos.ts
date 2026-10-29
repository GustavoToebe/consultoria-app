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
