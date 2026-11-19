import { requisicao } from '../api/cliente';

export type ObjetivoImportacao = 'SOMENTE_CADASTROS' | 'CADASTROS_E_PLANOS_ATUAIS' | 'INCLUIR_HISTORICO';
export type EstadoSessao =
  | 'RASCUNHO'
  | 'RECEBENDO'
  | 'PROCESSANDO'
  | 'REVISANDO'
  | 'CONCLUIDA'
  | 'CANCELADA'
  | 'ERRO'
  | 'EXPIRADA';
export type DestinoGrupo = 'CRIAR_ALUNO' | 'VINCULAR_EXISTENTE' | 'MODELO_BIBLIOTECA' | 'IGNORAR';
export type TipoDuvida =
  | 'EXERCICIO_NAO_RECONHECIDO'
  | 'ALIMENTO_NAO_RECONHECIDO'
  | 'ALUNO_AMBIGUO'
  | 'UNIDADE_CARGA'
  | 'CONFLITO_VERSAO';

export interface ModoProcessamentoResumo {
  modoEfetivo: string;
  provedorConfigurado?: string | null;
  fallbackParaRegras: boolean;
  motivoFallback?: string | null;
}

export interface CoberturaArquivo {
  status: string;
  paginasTotal?: number | null;
  paginasLidas?: number | null;
  paginasSemTexto?: number | null;
  blocos?: number | null;
  truncado?: boolean | null;
}

export interface ArquivoResumo {
  id: string;
  nomeOriginal: string;
  formato: string;
  tamanhoBytes: number;
  estado: string;
  erroCodigo?: string | null;
  criadoEm: string;
  cobertura?: CoberturaArquivo | null;
}

export interface CadastroImportavel {
  nome: string;
  email?: string | null;
  telefone?: string | null;
  objetivo?: string | null;
  observacoes?: string | null;
  ativo?: boolean | null;
}

export interface PesoImportavel {
  data: string;
  kg: number | string;
  observacao?: string | null;
}

export interface SugestaoDuvida {
  termo: string;
  referenciaId?: string | null;
  origem: string;
  nota: number | null;
}

export interface DuvidaImportacao {
  id: string;
  tipo: TipoDuvida;
  termoOriginal: string;
  trechoOriginal: string;
  arquivoOrigem: string;
  ocorrencias: number;
  ocorrenciaIds?: string[];
  sugestoes: SugestaoDuvida[];
  resolvida: boolean;
  respostaEscolhida?: string | null;
}

export interface DecisaoImportacao {
  decisaoId: string;
  duvidaId: string;
  ocorrenciaIds: string[];
  tipo: string;
  valorExtraido: string;
  valorAplicado: string;
  referenciaId?: string | null;
  ativa: boolean;
}

/** Aluno já cadastrado que pode ser o mesmo do arquivo. Por nome o servidor nunca vincula sozinho: o treinador escolhe. */
export interface CandidatoAluno {
  alunoId: string;
  nome: string;
  motivo: 'EMAIL' | 'NOME';
}

/**
 * Grupo da sessão. `IMPORTADO` e `IGNORADO` voltam só como esqueleto (sem nome, cadastro, peso, treino, dieta nem
 * candidatos). Sem `ALUNO_SENSIVEL_LER` o GET tira peso, objetivo e observações; sem `TREINO_LER`/`DIETA_LER`, o treino e a dieta.
 */
export interface GrupoImportavel {
  id: string;
  identificadorOrigem: string;
  nomeDetectado: string;
  destino: DestinoGrupo;
  alunoExistenteId?: string | null;
  arquivosOrigem: string[];
  cadastro?: CadastroImportavel | null;
  pesos: PesoImportavel[];
  treino?: any | null;
  dieta?: any | null;
  pendenciasIds: string[];
  estado: 'PRONTO' | 'COM_DUVIDAS' | 'IMPORTADO' | 'IGNORADO' | 'ERRO';
  /** Código fixo de por que o grupo não foi gravado (só em `ERRO`). */
  erroCodigo?: string | null;
  candidatos?: CandidatoAluno[];
}

export interface SessaoDetalhe {
  id: string;
  objetivo: string;
  estado: EstadoSessao;
  revisao: number;
  arquivos: ArquivoResumo[];
  grupos: GrupoImportavel[];
  duvidas: DuvidaImportacao[];
  decisoes?: DecisaoImportacao[];
  hashPrevia?: string | null;
  modoProcessamento?: ModoProcessamentoResumo | null;
  criadoEm: string;
  expiraEm: string;
}

export interface SessaoListaItem {
  id: string;
  estado: EstadoSessao;
  revisao: number;
  totalArquivos: number;
  totalGrupos: number;
  duvidasAbertas: number;
  criadoEm: string;
  expiraEm: string;
}

export type SituacaoDaConfirmacao = 'CONCLUIDA' | 'CONCLUIDA_COM_ERROS' | 'FALHOU';

/** `pesosIgnorados`: peso sem data legível, fora da faixa ou repetido na data (nunca ganha data inventada). */
export interface ConfirmacaoResultado {
  id: string;
  situacao: SituacaoDaConfirmacao;
  gruposImportados: number;
  alunosCriados: number;
  alunosVinculados: number;
  treinosCriados: number;
  dietasCriadas: number;
  modelosCriados: number;
  gruposComErro: number;
  pesosGravados: number;
  pesosIgnorados: number;
}

export interface ApelidoDto {
  id: string;
  tipo: string;
  termoOriginal: string;
  valorMapeado: string;
  referenciaId?: string | null;
  criadoEm: string;
}

/** Cria uma nova sessão de importação assistida */
export async function criarSessao(objetivo: ObjetivoImportacao = 'CADASTROS_E_PLANOS_ATUAIS'): Promise<SessaoDetalhe> {
  return requisicao<SessaoDetalhe>('/importacoes/assistidas/sessoes', {
    metodo: 'POST',
    corpo: { objetivo },
  });
}

/** Adiciona um arquivo à sessão via FormData */
export async function adicionarArquivo(sessaoId: string, arquivo: Blob, nomeOriginal: string): Promise<ArquivoResumo> {
  const dados = new FormData();
  dados.append('arquivo', arquivo, nomeOriginal);

  return requisicao<ArquivoResumo>(`/importacoes/assistidas/sessoes/${sessaoId}/arquivos`, {
    metodo: 'POST',
    corpoBruto: dados,
  });
}

/** Adiciona texto livre (WhatsApp / Notas) à sessão */
export async function adicionarTexto(sessaoId: string, titulo: string, conteudo: string): Promise<ArquivoResumo> {
  return requisicao<ArquivoResumo>(`/importacoes/assistidas/sessoes/${sessaoId}/textos`, {
    metodo: 'POST',
    corpo: { titulo, conteudo },
  });
}

/** Lê os arquivos da sessão no servidor (por regras) e devolve os grupos e os termos para conferir */
export async function processarSessao(sessaoId: string): Promise<SessaoDetalhe> {
  return requisicao<SessaoDetalhe>(`/importacoes/assistidas/sessoes/${sessaoId}/processar`, {
    metodo: 'POST',
  });
}

/** Obtém o estado completo e atualizado da sessão */
export async function obterSessao(sessaoId: string): Promise<SessaoDetalhe> {
  return requisicao<SessaoDetalhe>(`/importacoes/assistidas/sessoes/${sessaoId}`, {
    metodo: 'GET',
  });
}

/** Lista as sessões recentes/abertas de importação assistida da consultoria */
export async function listarSessoes(): Promise<SessaoListaItem[]> {
  return requisicao<SessaoListaItem[]>('/importacoes/assistidas/sessoes', {
    metodo: 'GET',
  });
}

/** Cancela uma sessão de importação assistida em aberto */
export async function cancelarSessao(sessaoId: string): Promise<SessaoDetalhe> {
  return requisicao<SessaoDetalhe>(`/importacoes/assistidas/sessoes/${sessaoId}/cancelar`, {
    metodo: 'POST',
  });
}

/** Envia resposta a uma dúvida, atualiza grupos e opcionalmente salva no dicionário */
export async function responderDuvida(
  sessaoId: string,
  duvidaId: string,
  respostaEscolhida: string,
  salvarNoDicionario: boolean,
  tipo?: string,
  termoOriginal?: string,
  referenciaId?: string | null,
  ocorrenciaIds?: string[] | null
): Promise<SessaoDetalhe> {
  return requisicao<SessaoDetalhe>(`/importacoes/assistidas/sessoes/${sessaoId}/respostas`, {
    metodo: 'POST',
    corpo: {
      duvidaId,
      respostaEscolhida,
      salvarNoDicionario,
      tipo,
      termoOriginal,
      referenciaId: referenciaId ?? undefined,
      ocorrenciaIds: ocorrenciaIds ?? undefined,
    },
  });
}

/** Revoga uma decisão aplicada anteriormente e reabre a dúvida correspondente */
export async function revogarDecisao(
  sessaoId: string,
  decisaoId: string,
  revisaoEsperada: number
): Promise<SessaoDetalhe> {
  return requisicao<SessaoDetalhe>(`/importacoes/assistidas/sessoes/${sessaoId}/respostas/${decisaoId}/revogar`, {
    metodo: 'POST',
    corpo: { revisaoEsperada },
  });
}

/** Atualiza destino (Criar Aluno, Vincular Existente, Modelo, Ignorar) ou nome de um grupo */
export async function atualizarGrupo(
  sessaoId: string,
  grupoId: string,
  dados: { destino?: DestinoGrupo; alunoExistenteId?: string | null; nome?: string }
): Promise<SessaoDetalhe> {
  return requisicao<SessaoDetalhe>(`/importacoes/assistidas/sessoes/${sessaoId}/grupos/${grupoId}`, {
    metodo: 'PUT',
    corpo: dados,
  });
}

/** Grava os grupos explicitamente selecionados como rascunhos ou modelos, com trava de prévia e idempotência */
export async function confirmarSessao(
  sessaoId: string,
  gruposIds: string[],
  revisaoEsperada: number,
  hashPrevia: string,
  chaveIdempotencia: string
): Promise<ConfirmacaoResultado> {
  return requisicao<ConfirmacaoResultado>(`/importacoes/assistidas/sessoes/${sessaoId}/confirmar`, {
    metodo: 'POST',
    corpo: {
      gruposIds,
      revisaoEsperada,
      hashPrevia,
      chaveIdempotencia,
    },
  });
}

/** Lista apelidos e abreviações aprendidos no dicionário da consultoria */
export async function listarApelidos(): Promise<ApelidoDto[]> {
  return requisicao<ApelidoDto[]>('/importacoes/assistidas/apelidos', {
    metodo: 'GET',
  });
}

/** Remove um apelido do dicionário da consultoria */
export async function removerApelido(id: string): Promise<void> {
  return requisicao<void>(`/importacoes/assistidas/apelidos/${id}`, {
    metodo: 'DELETE',
  });
}
