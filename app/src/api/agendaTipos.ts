/** Espelho dos DTOs de `agenda/AgendaDtos` da API (agenda presencial do consultório). */
export type SituacaoCompromisso = 'AGENDADO' | 'REALIZADO' | 'CANCELADO' | 'FALTOU';

/** Um compromisso para a equipe. `data`, `hora` e `horaFim` são de Brasília; `inicio`/`fim`, instantes ISO. */
export interface Compromisso {
  id: string;
  alunoId: string;
  alunoNome: string | null;
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
  situacao: SituacaoCompromisso;
  versao: number;
}

/** Marcar ou remarcar: `data` (AAAA-MM-DD) e `hora` (HH:MM) de Brasília. `versao` só ao remarcar. */
export interface CompromissoRequest {
  alunoId: string;
  responsavelId: string;
  data: string;
  hora: string;
  duracaoMinutos: number;
  local: string | null;
  observacao: string | null;
  versao?: number;
}

/** O que o aluno vê: sem observação nem ids da equipe. */
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

export interface FiltroCompromissos {
  de: string;
  ate: string;
  responsavel?: string | null;
  situacao?: SituacaoCompromisso | null;
}
