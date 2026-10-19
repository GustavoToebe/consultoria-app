import type { ConviteGerado, Marca } from './tipos';

/** Espelho dos DTOs de `inscricoes/InscricaoDtos` da API (inscrição por link e fila de interessados). */
export type SituacaoInscricao = 'NOVA' | 'EM_CONTATO' | 'EM_NEGOCIACAO' | 'ACEITA' | 'RECUSADA' | 'DESISTIU';
export type PagamentoInscricao = 'NAO_CONTROLADO' | 'AGUARDANDO' | 'CONFIRMADO_MANUAL';
/** Filtro da lista: `ABERTAS` (nova, em contato, em negociação), `TODAS` ou uma situação. */
export type FiltroInscricoes = 'ABERTAS' | 'TODAS' | SituacaoInscricao;

export interface InscricaoPublica {
  consultoria: Marca;
  /** Texto de apresentação e privacidade da consultoria; com texto, a ciência é obrigatória. */
  texto: string | null;
  aberta: boolean;
}

export interface InscricaoPublicaRequest {
  nome: string;
  whatsapp: string;
  email: string | null;
  objetivo: string | null;
  observacao: string | null;
  cienciaPrivacidade: boolean;
  turnstileToken?: string;
}

export interface ConfiguracaoInscricao {
  aberta: boolean;
  /** Nulos até o link ser gerado pela primeira vez. */
  codigo: string | null;
  link: string | null;
  responsavelId: string | null;
  texto: string | null;
  versao: number | null;
}

export interface ConfiguracaoInscricaoRequest {
  aberta: boolean;
  responsavelId: string | null;
  texto: string | null;
  versao: number | null;
}

/** Só aviso: aluno com o mesmo e-mail (`alunoId` só para quem vê alunos) e outras inscrições abertas com o mesmo contato. */
export interface DuplicidadeInscricao {
  alunoExistente: boolean;
  alunoId: string | null;
  outrasInscricoesAbertas: number;
}

export interface InscricaoResumo {
  id: string;
  nome: string;
  objetivo: string | null;
  whatsapp: string;
  email: string | null;
  situacao: SituacaoInscricao;
  pagamento: PagamentoInscricao;
  responsavelId: string | null;
  responsavelNome: string | null;
  alunoId: string | null;
  criadaEm: string;
  duplicidade: DuplicidadeInscricao;
}

export interface PaginaInscricoes {
  itens: InscricaoResumo[];
  total: number;
}

export interface NotaInscricao {
  id: string;
  texto: string;
  autorId: string | null;
  autorNome: string | null;
  criadaEm: string;
}

export interface InscricaoDetalhe {
  id: string;
  nome: string;
  whatsapp: string;
  email: string | null;
  objetivo: string | null;
  observacao: string | null;
  cienciaEm: string | null;
  cienciaTexto: string | null;
  situacao: SituacaoInscricao;
  pagamento: PagamentoInscricao;
  pagamentoConfirmadoPorNome: string | null;
  pagamentoConfirmadoEm: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  alunoId: string | null;
  criadaEm: string;
  atualizadaEm: string;
  versao: number;
  duplicidade: DuplicidadeInscricao;
  notas: NotaInscricao[];
}

export interface AlterarInscricaoRequest {
  situacao: SituacaoInscricao;
  pagamento: PagamentoInscricao;
  responsavelId: string | null;
  versao: number;
}

export interface AceiteInscricao {
  id: string;
  alunoId: string;
  convite: ConviteGerado | null;
}
