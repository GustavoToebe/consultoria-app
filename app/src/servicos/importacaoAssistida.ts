import { requisicao } from '../api/cliente';

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
  /** PDF, DOCX, XLSX, CSV, TEXTO_LIVRE e, com a leitura por imagem ligada (4.2), JPG ou PNG. */
  formato: string;
  tamanhoBytes: number;
  estado: string;
  erroCodigo?: string | null;
  criadoEm: string;
  cobertura?: CoberturaArquivo | null;
  /** Como este arquivo foi lido (1.6): `IA`, `REGRAS` ou nulo enquanto não foi lido. */
  modo?: 'IA' | 'REGRAS' | null;
  /** Por que caiu nas regras fixas (`RESPOSTA_CORTADA`, `TEMPO_ESGOTADO`, `ERRO_PROVEDOR`...); nulo quando não caiu. */
  motivoFallback?: string | null;
  /** 4.2: a leitura que valeu foi pela IA com o PDF ou a imagem inteiros anexos ("Lido pela imagem do documento"). */
  enviadoComoArquivo?: boolean;
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
  /** O que a leitura cortou neste grupo (teto de sessões, exercícios, textos...). Só com `TREINO_LER` e `DIETA_LER`. */
  avisos?: string[];
  /** Mesmo nome de outro aluno da sessão, com conflito de conteúdo: a tela oferece "Juntar com…" (D6). */
  possivelMesmoAluno?: boolean;
  possiveisParceiros?: { grupoId: string; nome: string }[];
  /** De onde veio o nome: só `CONTEUDO` foi lido do documento; `DIGITADO` = o treinador escreveu na revisão. */
  origemDoNome?: OrigemDoNome;
}

export type OrigemDoNome = 'CONTEUDO' | 'NOME_DO_ARQUIVO' | 'TITULO_DO_TEXTO' | 'AUSENTE' | 'DIGITADO';

/** Arquivos lidos até agora enquanto a sessão está em `PROCESSANDO`. */
export interface LeituraEmAndamento {
  lidos: number;
  total: number;
  /** Na fila da consultoria esperando outra leitura terminar (no máximo duas ao mesmo tempo); ausente = `false`. */
  aguardando?: boolean;
}

export interface SessaoDetalhe {
  id: string;
  estado: EstadoSessao;
  revisao: number;
  arquivos: ArquivoResumo[];
  grupos: GrupoImportavel[];
  duvidas: DuvidaImportacao[];
  decisoes?: DecisaoImportacao[];
  hashPrevia?: string | null;
  modoProcessamento?: ModoProcessamentoResumo | null;
  leitura?: LeituraEmAndamento | null;
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
  /** Alunos gravados, para abrir a ficha e o rascunho (só com `ALUNO_LER`; ausente sem ela). */
  alunos?: AlunoGravado[];
}

export interface AlunoGravado {
  alunoId: string;
  nome: string;
  criado: boolean;
  pastaId?: string | null;
  treinoId?: string | null;
  dietaId?: string | null;
}

export interface ApelidoDto {
  id: string;
  tipo: string;
  termoOriginal: string;
  valorMapeado: string;
  referenciaId?: string | null;
  criadoEm: string;
}

/** Envio de arquivo e confirmação passam dos 15 s padrão do cliente em rede lenta ou lote grande (0.5). */
export const LIMITE_DO_ENVIO_MS = 60_000;
export const LIMITE_DA_CONFIRMACAO_MS = 120_000;

/** Cria uma nova sessão de importação assistida (sem corpo: "O que importar" saiu, D3). */
export async function criarSessao(): Promise<SessaoDetalhe> {
  return requisicao<SessaoDetalhe>('/importacoes/assistidas/sessoes', { metodo: 'POST' });
}

/** Adiciona um arquivo à sessão. `dados` é o FormData de `formularioDaImportacao.formulario` (campo `arquivo`; no celular, pelos bytes). */
export async function adicionarArquivo(sessaoId: string, dados: FormData): Promise<ArquivoResumo> {
  return requisicao<ArquivoResumo>(`/importacoes/assistidas/sessoes/${sessaoId}/arquivos`, {
    metodo: 'POST',
    corpoBruto: dados,
    limiteMs: LIMITE_DO_ENVIO_MS,
  });
}

/** Adiciona texto livre (WhatsApp / Notas) à sessão */
export async function adicionarTexto(sessaoId: string, titulo: string, conteudo: string): Promise<ArquivoResumo> {
  return requisicao<ArquivoResumo>(`/importacoes/assistidas/sessoes/${sessaoId}/textos`, {
    metodo: 'POST',
    corpo: { titulo, conteudo },
    limiteMs: LIMITE_DO_ENVIO_MS,
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

/** Aceita de uma vez as dúvidas de exercício e alimento que têm uma única sugestão da biblioteca. */
export async function aceitarSugestoes(sessaoId: string, revisaoEsperada: number): Promise<SessaoDetalhe> {
  return requisicao<SessaoDetalhe>(`/importacoes/assistidas/sessoes/${sessaoId}/respostas/sugestoes`, {
    metodo: 'POST',
    corpo: { revisaoEsperada },
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

/** Atualiza o destino (criar, vincular, modelo, ignorar) ou o cadastro (nome, e-mail, WhatsApp) de um aluno da sessão */
export async function atualizarGrupo(
  sessaoId: string,
  grupoId: string,
  dados: { destino?: DestinoGrupo; alunoExistenteId?: string | null; nome?: string; email?: string; telefone?: string }
): Promise<SessaoDetalhe> {
  return requisicao<SessaoDetalhe>(`/importacoes/assistidas/sessoes/${sessaoId}/grupos/${grupoId}`, {
    metodo: 'PUT',
    corpo: dados,
  });
}

/**
 * Junta alunos da sessão que são a mesma pessoa ("Juntar com…", D6) ou, com a lista, as partes de um mesmo arquivo
 * ("Juntar as N partes", numa chamada só); devolve a sessão.
 */
export async function juntarGrupos(sessaoId: string, grupoId: string, com: string | string[]): Promise<SessaoDetalhe> {
  return requisicao<SessaoDetalhe>(`/importacoes/assistidas/sessoes/${sessaoId}/grupos/${grupoId}/juntar`, {
    metodo: 'POST',
    corpo: typeof com === 'string' ? { comGrupoId: com } : { comGruposIds: com },
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
    limiteMs: LIMITE_DA_CONFIRMACAO_MS,
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
