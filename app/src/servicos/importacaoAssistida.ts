import { requisicao } from '../api/cliente';

export type ObjetivoImportacao = 'SOMENTE_CADASTROS' | 'CADASTROS_E_PLANOS_ATUAIS' | 'INCLUIR_HISTORICO';
export type EstadoSessao = 'RECEBENDO' | 'PROCESSANDO' | 'REVISANDO' | 'CONCLUIDA';
export type DestinoGrupo = 'CRIAR_ALUNO' | 'VINCULAR_EXISTENTE' | 'MODELO_BIBLIOTECA' | 'IGNORAR';
export type TipoDuvida =
  | 'EXERCICIO_NAO_RECONHECIDO'
  | 'ALIMENTO_NAO_RECONHECIDO'
  | 'ALUNO_AMBIGUO'
  | 'UNIDADE_CARGA'
  | 'CONFLITO_VERSAO';

export interface ArquivoResumo {
  id: string;
  nomeOriginal: string;
  formato: string;
  tamanhoBytes: number;
  estado: string;
  erroCodigo?: string | null;
  criadoEm: string;
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
  nota: number;
}

export interface DuvidaImportacao {
  id: string;
  tipo: TipoDuvida;
  termoOriginal: string;
  trechoOriginal: string;
  arquivoOrigem: string;
  ocorrencias: number;
  sugestoes: SugestaoDuvida[];
  resolvida: boolean;
  respostaEscolhida?: string | null;
}

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
  estado: 'PRONTO' | 'COM_DUVIDAS' | 'IMPORTADO' | 'ERRO';
}

export interface SessaoDetalhe {
  id: string;
  objetivo: string;
  estado: EstadoSessao;
  revisao: number;
  arquivos: ArquivoResumo[];
  grupos: GrupoImportavel[];
  duvidas: DuvidaImportacao[];
  criadoEm: string;
  expiraEm: string;
}

export interface ConfirmacaoResultado {
  id: string;
  situacao: string;
  gruposImportados: number;
  alunosCriados: number;
  alunosVinculados: number;
  treinosCriados: number;
  dietasCriadas: number;
  modelosCriados: number;
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

/** Dispara o processamento com redação LGPD e interpretação (IA / Regras) */
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

/** Envia resposta a uma dúvida, atualiza grupos e opcionalmente salva no dicionário */
export async function responderDuvida(
  sessaoId: string,
  duvidaId: string,
  respostaEscolhida: string,
  salvarNoDicionario: boolean,
  tipo?: string,
  termoOriginal?: string,
  referenciaId?: string
): Promise<SessaoDetalhe> {
  return requisicao<SessaoDetalhe>(`/importacoes/assistidas/sessoes/${sessaoId}/respostas`, {
    metodo: 'POST',
    corpo: {
      duvidaId,
      respostaEscolhida,
      salvarNoDicionario,
      tipo,
      termoOriginal,
      referenciaId,
    },
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

/** Confirma e grava grupos selecionados como rascunhos ou modelos */
export async function confirmarSessao(
  sessaoId: string,
  gruposIds: string[],
  revisaoEsperada: number
): Promise<ConfirmacaoResultado> {
  return requisicao<ConfirmacaoResultado>(`/importacoes/assistidas/sessoes/${sessaoId}/confirmar`, {
    metodo: 'POST',
    corpo: {
      gruposIds,
      revisaoEsperada,
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
