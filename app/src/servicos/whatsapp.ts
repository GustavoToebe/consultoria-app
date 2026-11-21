import { requisicao } from '../api/cliente';

export type TipoDeAvisoWhatsApp =
  | 'ANTES'
  | 'NO_DIA'
  | 'DEPOIS'
  | 'COMPROMISSO_NOVO'
  | 'COMPROMISSO_REMARCADO'
  | 'COMPROMISSO_CANCELADO';

export interface ConexaoWhatsApp {
  habilitado: boolean;
  configurada: boolean;
  phoneNumberId: string | null;
  wabaId: string | null;
  tokenGravadoEm: string | null;
  versao: number | null;
}

export interface ConexaoWhatsAppRequest {
  phoneNumberId: string;
  wabaId: string;
  accessToken?: string | null;
  versao?: number | null;
}

export interface ModeloWhatsApp {
  tipo: TipoDeAvisoWhatsApp;
  configurado: boolean;
  nome: string | null;
  idioma: string | null;
  situacao: string | null;
  versao: number | null;
  textoSugerido: string;
  variaveis: string[];
}

export interface ModelosWhatsAppResponse {
  modelos: ModeloWhatsApp[];
}

export interface ModeloWhatsAppRequest {
  nome: string;
  idioma: string;
  versao?: number | null;
}

export interface AvisosWhatsAppDoAluno {
  receber: boolean;
  disponivel: boolean;
  temTelefone: boolean;
}

/** Lê a configuração atual da conexão Meta da consultoria (nunca devolve o token). */
export async function obterConexaoWhatsApp(): Promise<ConexaoWhatsApp> {
  return requisicao<ConexaoWhatsApp>('/whatsapp/conexao');
}

/** Cria ou atualiza a conexão Meta da consultoria (`WHATSAPP_ALTERAR`). */
export async function salvarConexaoWhatsApp(corpo: ConexaoWhatsAppRequest): Promise<ConexaoWhatsApp> {
  return requisicao<ConexaoWhatsApp>('/whatsapp/conexao', { metodo: 'PUT', corpo });
}

/** Remove a conexão Meta e cancela os avisos pendentes da consultoria. */
export async function removerConexaoWhatsApp(versao?: number | null): Promise<void> {
  const qs = versao !== undefined && versao !== null ? `?versao=${versao}` : '';
  await requisicao<void>(`/whatsapp/conexao${qs}`, { metodo: 'DELETE' });
}

/** Lista todos os tipos de aviso e a situação de cada modelo na Meta. */
export async function listarModelosWhatsApp(): Promise<ModelosWhatsAppResponse> {
  return requisicao<ModelosWhatsAppResponse>('/whatsapp/modelos');
}

/** Configura ou atualiza o modelo aprovado na Meta para um tipo de aviso. */
export async function salvarModeloWhatsApp(
  tipo: TipoDeAvisoWhatsApp,
  corpo: ModeloWhatsAppRequest,
): Promise<ModeloWhatsApp> {
  return requisicao<ModeloWhatsApp>(`/whatsapp/modelos/${tipo}`, { metodo: 'PUT', corpo });
}

/** Remove o modelo configurado para um tipo de aviso. */
export async function removerModeloWhatsApp(tipo: TipoDeAvisoWhatsApp, versao?: number | null): Promise<void> {
  const qs = versao !== undefined && versao !== null ? `?versao=${versao}` : '';
  await requisicao<void>(`/whatsapp/modelos/${tipo}${qs}`, { metodo: 'DELETE' });
}

/** Lê a preferência de avisos pelo WhatsApp do aluno logado. */
export async function obterAvisosWhatsAppAluno(): Promise<AvisosWhatsAppDoAluno> {
  return requisicao<AvisosWhatsAppDoAluno>('/aluno/avisos-pelo-whatsapp');
}

/** Atualiza o opt-in de avisos pelo WhatsApp do aluno logado. */
export async function atualizarAvisosWhatsAppAluno(receber: boolean): Promise<AvisosWhatsAppDoAluno> {
  return requisicao<AvisosWhatsAppDoAluno>('/aluno/avisos-pelo-whatsapp', {
    metodo: 'PUT',
    corpo: { receber },
  });
}
